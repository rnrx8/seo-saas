"""Integration tests against a dedicated LOCAL PostgreSQL test database.

Run after initdb/pg_ctl on port 55437 and createdb credit_accounting_test.
No AI generation, production requests, or real customer balances are used.
"""
import json
import subprocess
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

PSQL = '/opt/homebrew/Cellar/postgresql@18/18.3/bin/psql'
ARGS = [PSQL, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
        '-h', '127.0.0.1', '-p', '55437', '-d', 'credit_accounting_test']
OWNER = '00000000-0000-0000-0000-000000000001'
OTHER = '00000000-0000-0000-0000-000000000002'
PRO = '00000000-0000-0000-0000-000000000003'
ROOT = Path(__file__).resolve().parents[1]


def sql(query):
    return subprocess.run(ARGS, input=query, text=True, capture_output=True, check=True).stdout.strip()


class CreditAccountingTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sql('''
          do $$ begin
            if not exists (select from pg_roles where rolname='anon') then create role anon; end if;
            if not exists (select from pg_roles where rolname='authenticated') then create role authenticated; end if;
            if not exists (select from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
          end $$;
          create schema auth;
          create function auth.uid() returns uuid language sql as
          $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
          create function auth.role() returns text language sql as
          $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
          grant usage on schema auth to anon, authenticated, service_role;
          create table public.user_profiles (
            id uuid primary key, plan text default 'free',
            credits_remaining numeric(10,1) default 5,
            credits_total numeric(10,1) default 5, display_name text);
          create table public.jobs (
            id uuid primary key default gen_random_uuid(), tenant_id uuid,
            main_keyword text not null, status text not null default 'queued',
            delivery_type text default 'full', high_accuracy_mode boolean default false,
            current_step text);
          alter table public.user_profiles enable row level security;
          alter table public.jobs enable row level security;
          create policy own_profile on public.user_profiles to authenticated
            using (id=auth.uid()) with check (id=auth.uid());
          create policy own_job on public.jobs to authenticated
            using (tenant_id=auth.uid()) with check (tenant_id=auth.uid());
          grant all on public.user_profiles, public.jobs to authenticated, service_role;
        ''')
        sql(f"insert into public.user_profiles(id,plan) values ('{OWNER}','free'),('{OTHER}','free'),('{PRO}','pro');")
        cls.legacy = sql(f"insert into public.jobs(tenant_id,main_keyword,status) values ('{OWNER}','legacy','done') returning id;")
        sql('begin;\n' + (ROOT / 'db/job_credit_accounting.sql').read_text() + '\ncommit;')

    def setUp(self):
        sql('update public.user_profiles set credits_remaining=10, credits_total=10;')

    def job(self, delivery='full', high=False, owner=OWNER, status='queued', step=None):
        step_sql = 'null' if step is None else f"'{step}'"
        return sql(f"insert into public.jobs(tenant_id,main_keyword,delivery_type,high_accuracy_mode,status,current_step) values ('{owner}','test','{delivery}',{str(high).lower()},'{status}',{step_sql}) returning id;")

    def status(self, job, status):
        sql(f"update public.jobs set status='{status}' where id='{job}';")

    def balance(self, owner=OWNER):
        return float(sql(f"select credits_remaining from public.user_profiles where id='{owner}';"))

    def authenticated(self, query, owner=OWNER):
        return sql(f"begin; set local role authenticated; set local request.jwt.claim.sub='{owner}'; set local request.jwt.claim.role='authenticated'; {query}; commit;")

    def test_completion_without_browser_and_duplicate_completion(self):
        job = self.job()
        self.status(job, 'done')
        self.status(job, 'done')
        self.status(job, 'running')
        self.status(job, 'done')
        self.assertEqual(self.balance(), 9)

    def test_partial_deliveries_and_full_accuracy_cost(self):
        for delivery, high, cost in [('full', False, 1), ('full', True, 1.2),
                                     ('outline_only', True, .5), ('research_only', False, .5)]:
            with self.subTest(delivery=delivery, high=high):
                before = self.balance()
                self.status(self.job(delivery, high), 'done')
                self.assertAlmostEqual(self.balance(), before-cost)

    def test_concurrent_bulk_completions_do_not_lose_debits(self):
        jobs = [self.job(high=True) for _ in range(6)]
        def complete(job):
            sql(f"begin; update public.jobs set status='done' where id='{job}'; select pg_sleep(0.1); commit;")
        with ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(complete, jobs))
        self.assertAlmostEqual(self.balance(), 2.8)

    def test_failure_is_free_and_retry_charges_once(self):
        job = self.job()
        self.status(job, 'failed')
        self.assertEqual(self.balance(), 10)
        self.status(job, 'running')
        self.status(job, 'done')
        self.assertEqual(self.balance(), 9)

    def test_cancellation_uses_persisted_step_and_worker_cannot_overwrite(self):
        for step, cost in [(None, 0), ('serp', .2), ('search_intent', .2),
                           ('fact_sheet', .5), ('outline', .5), ('article', 1)]:
            with self.subTest(step=step):
                before = self.balance()
                job = self.job(status='running', step=step)
                self.authenticated(f"update public.jobs set status='cancelled' where id='{job}'")
                self.status(job, 'done')
                self.assertEqual(sql(f"select status from public.jobs where id='{job}'"), 'cancelled')
                self.assertAlmostEqual(self.balance(), before-cost)

    def test_cancelled_retry_charges_only_remainder(self):
        job = self.job(high=True, status='running', step='outline')
        self.status(job, 'cancelled')
        self.assertEqual(self.balance(), 9.5)
        self.status(job, 'queued')
        self.status(job, 'running')
        self.status(job, 'done')
        self.assertEqual(self.balance(), 8.8)

    def test_pro_and_tenantless_jobs_do_not_consume(self):
        self.status(self.job(owner=PRO), 'done')
        sql("insert into public.jobs(main_keyword,status) values ('CLI fixture','done');")
        self.assertEqual(self.balance(PRO), 10)
        self.assertEqual(self.balance(), 10)

    def test_legacy_jobs_not_charged_again(self):
        self.status(self.legacy, 'running')
        self.status(self.legacy, 'done')
        self.assertEqual(self.balance(), 10)

    def test_old_browser_balance_write_rejected_but_settings_work(self):
        with self.assertRaises(subprocess.CalledProcessError):
            self.authenticated(f"update public.user_profiles set credits_remaining=9 where id='{OWNER}'")
        self.authenticated(f"update public.user_profiles set display_name='test' where id='{OWNER}'")
        self.assertEqual(self.balance(), 10)

    def test_other_tenant_and_fake_completion_blocked(self):
        job = self.job()
        self.authenticated(f"update public.jobs set status='cancelled' where id='{job}'", OTHER)
        self.assertEqual(sql(f"select status from public.jobs where id='{job}'"), 'queued')
        with self.assertRaises(subprocess.CalledProcessError):
            self.authenticated(f"update public.jobs set status='done' where id='{job}'")
        with self.assertRaises(subprocess.CalledProcessError):
            self.authenticated(f"insert into public.jobs(tenant_id,main_keyword,status) values ('{OWNER}','fake','done')")

    def test_private_functions_and_ledger_not_accessible(self):
        permissions = json.loads(sql("select json_build_object('schema',has_schema_privilege('authenticated','billing_private','usage'),'function',has_function_privilege('authenticated','billing_private.settle_job_credits()','execute'),'table',has_table_privilege('authenticated','billing_private.job_credit_charges','select'));"))
        self.assertEqual(permissions, {'schema': False, 'function': False, 'table': False})

    def test_balance_and_completion_rollback_together(self):
        job = self.job()
        sql(f"begin; update public.jobs set status='done' where id='{job}'; rollback;")
        self.assertEqual(self.balance(), 10)
        self.assertEqual(sql(f"select status from public.jobs where id='{job}'"), 'queued')
        self.assertEqual(sql(f"select settled_cost from billing_private.job_credit_charges where job_id='{job}'"), '0.0')

    def test_limited_balance_never_becomes_negative(self):
        sql(f"update public.user_profiles set credits_remaining=.2 where id='{OWNER}';")
        self.status(self.job(high=True), 'done')
        self.assertEqual(self.balance(), 0)


if __name__ == '__main__':
    unittest.main()
