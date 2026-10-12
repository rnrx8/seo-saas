-- Job completion and credit consumption commit together, independently of tabs.
-- Apply once as a database migration. Existing terminal jobs are grandfathered;
-- this does not collect historical missed charges or change existing balances.
lock table public.jobs in share row exclusive mode;
create schema if not exists billing_private;
revoke all on schema billing_private from public, anon, authenticated;

create table billing_private.job_credit_charges (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  tenant_id uuid not null references public.user_profiles(id) on delete cascade,
  quoted_cost numeric(10,1) not null check (quoted_cost >= 0),
  settled_cost numeric(10,1) not null default 0 check (settled_cost >= 0),
  debited_cost numeric(10,1) not null default 0 check (debited_cost >= 0),
  grandfathered boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table billing_private.job_credit_charges enable row level security;
revoke all on billing_private.job_credit_charges from public, anon, authenticated;

create function billing_private.job_credit_cost(delivery text, high_accuracy boolean)
returns numeric language sql immutable set search_path = '' as $$
  select case when delivery in ('outline_only', 'research_only') then 0.5
              else 1.0 + case when high_accuracy then 0.2 else 0 end end;
$$;
revoke all on function billing_private.job_credit_cost(text, boolean) from public, anon, authenticated;

-- Only track a baseline for finished jobs; no balance UPDATE is performed here.
insert into billing_private.job_credit_charges
  (job_id, tenant_id, quoted_cost, settled_cost, grandfathered)
select id, tenant_id, billing_private.job_credit_cost(delivery_type, high_accuracy_mode),
       case when status in ('done', 'cancelled')
            then billing_private.job_credit_cost(delivery_type, high_accuracy_mode) else 0 end,
       status in ('done', 'cancelled')
from public.jobs where tenant_id is not null;

-- Keep old open tabs from overwriting the server balance with stale subtraction.
-- SECURITY INVOKER sees the real caller; the billing trigger below runs as owner.
create function billing_private.protect_credit_balance()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') and
     (new.credits_remaining is distinct from old.credits_remaining or
      new.credits_total is distinct from old.credits_total) then
    raise exception 'Credits are managed by the server' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function billing_private.protect_credit_balance() from public, anon, authenticated;
create trigger protect_credit_balance before update on public.user_profiles
for each row execute function billing_private.protect_credit_balance();

create function billing_private.guard_job_billing()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'A job owner cannot be changed' using errcode = '23514';
  end if;
  -- A worker finishing after cancellation must not charge the remainder.
  -- An intentional retry can first explicitly move the job back to queued.
  if old.status = 'cancelled' and new.status not in ('cancelled', 'queued') then
    new.status := 'cancelled';
    new.current_step := old.current_step;
  end if;
  if current_user in ('anon', 'authenticated') and
     new.status = 'done' and old.status is distinct from 'done' then
    raise exception 'Only the server can complete a job' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function billing_private.guard_job_billing() from public, anon, authenticated;
create trigger guard_job_billing before update on public.jobs
for each row execute function billing_private.guard_job_billing();

-- The private trigger needs owner privileges to debit the tenant's profile
-- when the worker completes a job. It is never exposed or callable as an RPC.
create function billing_private.settle_job_credits()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  charge billing_private.job_credit_charges%rowtype;
  target_cost numeric(10,1);
  delta numeric(10,1);
  available numeric(10,1);
  user_plan text;
begin
  if auth.role() = 'anon' or
     (auth.role() = 'authenticated' and auth.uid() is distinct from new.tenant_id) then
    raise exception 'Job owner mismatch' using errcode = '42501';
  end if;
  if new.tenant_id is null then return new; end if;
  if tg_op = 'INSERT' then
    if auth.role() = 'authenticated' and new.status not in ('queued', 'running') then
      raise exception 'New jobs must start queued or running' using errcode = '42501';
    end if;
    insert into billing_private.job_credit_charges (job_id, tenant_id, quoted_cost)
      values (new.id, new.tenant_id,
              billing_private.job_credit_cost(new.delivery_type, new.high_accuracy_mode));
  end if;
  if new.status not in ('done', 'cancelled') then return new; end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;

  select * into strict charge from billing_private.job_credit_charges
    where job_id = new.id for update;
  target_cost := charge.quoted_cost;
  if new.status = 'cancelled' then
    target_cost := least(charge.quoted_cost,
      case when new.current_step is null then 0
           when new.current_step in ('serp', 'search_intent') then 0.2
           when new.current_step in ('fact_sheet', 'outline') then 0.5
           else 1.0 end);
  end if;
  delta := greatest(0, target_cost - charge.settled_cost);
  if delta = 0 then return new; end if;

  -- Row lock + database subtraction prevents concurrent jobs losing a debit.
  select credits_remaining, plan into strict available, user_plan
    from public.user_profiles where id = charge.tenant_id for update;
  if user_plan = 'pro' then
    delta := 0;
  else
    delta := least(greatest(0, coalesce(available, 0)), delta);
    update public.user_profiles set credits_remaining = greatest(0, coalesce(available, 0) - delta)
      where id = charge.tenant_id;
  end if;
  update billing_private.job_credit_charges
    set settled_cost = greatest(settled_cost, target_cost),
        debited_cost = debited_cost + delta, updated_at = now()
    where job_id = new.id;
  return new;
end;
$$;
revoke all on function billing_private.settle_job_credits() from public, anon, authenticated;
create trigger settle_job_credits after insert or update of status on public.jobs
for each row execute function billing_private.settle_job_credits();
