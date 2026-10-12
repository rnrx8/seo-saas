-- Checks real production trigger behavior in a rolled-back subtransaction.
-- Fixtures are never visible to the worker and no balances or jobs persist.
create or replace function pg_temp.verify_job_credit_accounting()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  tenant uuid;
  job uuid;
  balance numeric;
  state text;
begin
  begin
    select id into strict tenant from public.user_profiles
      where coalesce(plan, 'free') <> 'pro' order by id limit 1;
    update public.user_profiles set credits_remaining = 10 where id = tenant;
    insert into public.jobs(tenant_id, main_keyword, high_accuracy_mode)
      values (tenant, 'credit verification - rolled back', true) returning id into job;
    update public.jobs set status = 'done' where id = job;
    select credits_remaining into balance from public.user_profiles where id = tenant;
    if balance <> 8.8 then raise exception 'Full completion did not debit 1.2'; end if;
    update public.jobs set status = 'done' where id = job;
    update public.jobs set status = 'running' where id = job;
    update public.jobs set status = 'done' where id = job;
    select credits_remaining into balance from public.user_profiles where id = tenant;
    if balance <> 8.8 then raise exception 'Duplicate completion consumed twice'; end if;

    insert into public.jobs(tenant_id, main_keyword, delivery_type, high_accuracy_mode)
      values (tenant, 'outline verification - rolled back', 'outline_only', true) returning id into job;
    update public.jobs set status = 'done' where id = job;
    select credits_remaining into balance from public.user_profiles where id = tenant;
    if balance <> 8.3 then raise exception 'Outline completion did not debit 0.5'; end if;

    insert into public.jobs(tenant_id, main_keyword, status, current_step, high_accuracy_mode)
      values (tenant, 'cancel verification - rolled back', 'running', 'outline', true) returning id into job;
    update public.jobs set status = 'cancelled' where id = job;
    update public.jobs set status = 'done' where id = job;
    select status into state from public.jobs where id = job;
    select credits_remaining into balance from public.user_profiles where id = tenant;
    if state <> 'cancelled' or balance <> 7.8 then
      raise exception 'Cancellation was overwritten or charged more than 0.5';
    end if;
    update public.jobs set status = 'queued' where id = job;
    update public.jobs set status = 'done' where id = job;
    select credits_remaining into balance from public.user_profiles where id = tenant;
    if balance <> 7.1 then raise exception 'Cancelled retry did not debit only the remainder'; end if;

    insert into public.jobs(tenant_id, main_keyword)
      values (tenant, 'failure verification - rolled back') returning id into job;
    update public.jobs set status = 'failed' where id = job;
    select credits_remaining into balance from public.user_profiles where id = tenant;
    if balance <> 7.1 then raise exception 'Failed job consumed credits'; end if;
    update public.user_profiles set plan = 'pro' where id = tenant;
    update public.jobs set status = 'done' where id = job;
    select credits_remaining into balance from public.user_profiles where id = tenant;
    if balance <> 7.1 then raise exception 'Pro plan consumed credits'; end if;

    -- Roll back ALL fixture writes, including profile, job and private ledger.
    raise exception using errcode = 'ZP001', message = 'Verification rollback';
  exception when sqlstate 'ZP001' then
    return jsonb_build_object('passed', true, 'fixtures_rolled_back', true,
      'checks', jsonb_build_array('full_accuracy_cost', 'outline_cost', 'duplicate_completion',
        'cancelled_worker', 'cancelled_retry_remainder', 'failed_free', 'pro_free'));
  end;
end;
$$;
select pg_temp.verify_job_credit_accounting();
