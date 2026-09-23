-- Team PWA: an explicitly confirmed kill updates the shared schedule in the
-- same transaction. The older review-only RPC remains available for legacy
-- clients, but the PWA uses this RPC exclusively.

create or replace function public.submit_l2m_boss_report_and_adopt(
  target_server_boss uuid,
  client_report_id uuid,
  expected_schedule_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_boss public.server_bosses;
  current_schedule public.boss_schedules;
  adopted_schedule public.boss_schedules;
  previous_report public.boss_reports;
  new_report public.boss_reports;
  dedupe_key text;
  dedupe_lock bigint;
  actual_revision bigint;
  visible_revision bigint;
  effective_baseline timestamptz;
  accepted_killed_at timestamptz;
  schedule_hidden boolean := false;
  conflict_code text;
begin
  if target_server_boss is null or client_report_id is null or expected_schedule_revision is null
     or expected_schedule_revision < 0 then
    raise exception 'boss, report id and expected revision are required' using errcode = '22004';
  end if;

  select * into target_boss from public.server_bosses
  where id = target_server_boss and is_enabled;
  if target_boss.id is null or not public.is_active_l2m_boss_member(target_boss.game_server_id) then
    raise exception 'not an active member of this game server' using errcode = '42501';
  end if;

  dedupe_key := encode(extensions.digest(auth.uid()::text || ':' || client_report_id::text, 'sha256'), 'hex');
  -- Share the old RPC's idempotency lock. A retry racing with the old RPC or
  -- another boss report cannot pass the duplicate check concurrently.
  dedupe_lock := ('x' || substr(dedupe_key, 1, 16))::bit(64)::bigint;
  perform pg_advisory_xact_lock(dedupe_lock);
  select * into previous_report from public.boss_reports
  where game_server_id = target_boss.game_server_id
    and input_source = 'app' and source_dedupe_key = dedupe_key;
  if previous_report.id is not null then
    return jsonb_build_object(
      'report_id', previous_report.id,
      'status', previous_report.status,
      'resolution_code', previous_report.resolution_code,
      'idempotent_replay', true
    );
  end if;

  -- Also serializes first reports where boss_schedules has no row to lock.
  perform pg_advisory_xact_lock(hashtextextended(target_server_boss::text, 0));

  select * into current_schedule from public.boss_schedules
  where server_boss_id = target_server_boss for update;
  actual_revision := coalesce(current_schedule.revision, 0);

  -- The snapshot hides a pre-reset report's schedule. Such a client sees no
  -- schedule and sends expected revision 0; compare against that same visible
  -- state, while retaining the real revision for the next accepted update.
  select coalesce(gs.server_reset_at, gs.maintenance_ended_at)
    into effective_baseline
  from public.game_servers gs where gs.id = target_boss.game_server_id;
  if current_schedule.server_boss_id is not null and effective_baseline is not null then
    select br.killed_at into accepted_killed_at
    from public.boss_reports br where br.id = current_schedule.accepted_report_id;
    schedule_hidden := accepted_killed_at < effective_baseline;
  end if;
  visible_revision := case when schedule_hidden then 0 else actual_revision end;

  -- An old screen or a report significantly before the shown spawn must not
  -- silently change everyone's timeline. Admin correction is a separate path.
  if expected_schedule_revision <> visible_revision then
    conflict_code := 'stale_revision';
  elsif not schedule_hidden and current_schedule.server_boss_id is not null
      and current_schedule.next_spawn_at > now() + interval '2 minutes' then
    conflict_code := 'before_expected_spawn';
  end if;

  if conflict_code is not null then
    insert into public.boss_reports (
      game_server_id, server_boss_id, killed_at, submitted_by, input_source,
      source_dedupe_key, status, resolved_at, resolved_by, resolution_code
    ) values (
      target_boss.game_server_id, target_server_boss, now(), auth.uid(), 'app',
      dedupe_key, 'conflict', now(), auth.uid(), conflict_code
    ) returning * into new_report;
    return jsonb_build_object(
      'report_id', new_report.id, 'status', 'conflict',
      'resolution_code', conflict_code, 'schedule_revision', actual_revision,
      'idempotent_replay', false
    );
  end if;

  insert into public.boss_reports (
    game_server_id, server_boss_id, killed_at, submitted_by, input_source,
    source_dedupe_key, status, resolved_at, resolved_by, resolution_code
  ) values (
    target_boss.game_server_id, target_server_boss, now(), auth.uid(), 'app',
    dedupe_key, 'accepted', now(), auth.uid(), 'app_confirmed'
  ) returning * into new_report;

  insert into public.boss_schedules (
    server_boss_id, game_server_id, accepted_report_id, next_spawn_at,
    missed_cycles, revision, updated_at
  ) values (
    target_server_boss, target_boss.game_server_id, new_report.id,
    new_report.killed_at + make_interval(secs => target_boss.respawn_seconds),
    0, 1, now()
  )
  on conflict (server_boss_id) do update set
    accepted_report_id = excluded.accepted_report_id,
    next_spawn_at = excluded.next_spawn_at,
    missed_cycles = 0,
    revision = public.boss_schedules.revision + 1,
    updated_at = now()
  returning * into adopted_schedule;

  return jsonb_build_object(
    'report_id', new_report.id, 'status', 'accepted',
    'schedule_revision', adopted_schedule.revision,
    'next_spawn_at', adopted_schedule.next_spawn_at,
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.submit_l2m_boss_report_and_adopt(uuid, uuid, bigint) from public;
grant execute on function public.submit_l2m_boss_report_and_adopt(uuid, uuid, bigint) to authenticated;
comment on function public.submit_l2m_boss_report_and_adopt(uuid, uuid, bigint) is
  'Confirmed member kill atomically adopts the shared schedule. Server time, membership, expected revision, early-spawn guard and idempotency are enforced in Postgres.';

-- Supabase Realtime Postgres Changes carries a refetch signal to connected
-- members. boss_schedules SELECT is already restricted by its membership RLS.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'boss_schedules'
     ) then
    alter publication supabase_realtime add table public.boss_schedules;
  end if;
end;
$$;

-- Web Push jobs are owned by the server. A later Edge Function claims due
-- rows and fans them out to active member subscriptions. No client can read
-- or mutate the queue directly.
create table if not exists public.boss_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  game_server_id uuid not null references public.game_servers(id) on delete cascade,
  server_boss_id uuid not null references public.server_bosses(id) on delete cascade,
  schedule_revision bigint not null check (schedule_revision > 0),
  lead_minutes smallint not null check (lead_minutes in (1, 3)),
  scheduled_for timestamptz not null,
  event_id text not null check (char_length(event_id) between 16 and 200),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'cancelled', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  claimed_at timestamptz,
  completed_at timestamptz,
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 80),
  created_at timestamptz not null default now(),
  unique (server_boss_id, schedule_revision, lead_minutes),
  unique (event_id)
);

create index if not exists boss_notification_jobs_due_idx
  on public.boss_notification_jobs (scheduled_for, id) where status = 'pending';

alter table public.boss_notification_jobs enable row level security;
revoke all on public.boss_notification_jobs from anon, authenticated;

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  game_server_id uuid not null references public.game_servers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id uuid not null,
  endpoint_hash text not null check (char_length(endpoint_hash) = 64),
  subscription_ciphertext text not null check (char_length(subscription_ciphertext) between 32 and 8192),
  three_minutes_enabled boolean not null default true,
  one_minute_enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_server_id, user_id, endpoint_hash),
  unique (installation_id)
);

create index if not exists web_push_subscriptions_active_idx
  on public.web_push_subscriptions (game_server_id, user_id) where revoked_at is null;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.boss_notification_jobs(id) on delete cascade,
  subscription_id uuid not null references public.web_push_subscriptions(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  outcome text not null check (outcome in ('accepted', 'expired', 'transient_failure', 'permanent_failure')),
  response_status integer,
  error_code text check (error_code is null or char_length(error_code) <= 80),
  attempted_at timestamptz not null default now(),
  unique (job_id, subscription_id, attempt_number)
);

alter table public.web_push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;
revoke all on public.web_push_subscriptions from anon, authenticated;
revoke all on public.notification_deliveries from anon, authenticated;

create or replace function public.revoke_l2m_push_devices_on_membership_revoke()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'revoked' and old.status is distinct from 'revoked' then
    update public.push_devices
    set revoked_at = now(), updated_at = now()
    where game_server_id = new.game_server_id and user_id = new.user_id and revoked_at is null;
    update public.web_push_subscriptions
    set revoked_at = now(), updated_at = now()
    where game_server_id = new.game_server_id and user_id = new.user_id and revoked_at is null;
  end if;
  return new;
end;
$$;

create or replace function public.schedule_l2m_boss_web_push_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.boss_notification_jobs
  set status = 'cancelled', completed_at = now()
  where server_boss_id = new.server_boss_id
    and schedule_revision <> new.revision
    and status in ('pending', 'processing');

  insert into public.boss_notification_jobs (
    game_server_id, server_boss_id, schedule_revision, lead_minutes,
    scheduled_for, event_id
  )
  select
    new.game_server_id, new.server_boss_id, new.revision, lead,
    new.next_spawn_at - make_interval(mins => lead),
    encode(extensions.digest(
      new.server_boss_id::text || ':' || new.revision::text || ':' || lead::text,
      'sha256'
    ), 'hex')
  from unnest(array[3, 1]) as lead
  where new.next_spawn_at - make_interval(mins => lead) > now()
  on conflict (server_boss_id, schedule_revision, lead_minutes) do nothing;

  return new;
end;
$$;

drop trigger if exists schedule_l2m_boss_web_push_jobs on public.boss_schedules;
create trigger schedule_l2m_boss_web_push_jobs
after insert or update of next_spawn_at, revision on public.boss_schedules
for each row execute function public.schedule_l2m_boss_web_push_jobs();

create or replace function public.claim_due_l2m_boss_notification_jobs(batch_size integer default 50)
returns setof public.boss_notification_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if batch_size is null or batch_size < 1 or batch_size > 200 then
    raise exception 'batch_size must be between 1 and 200' using errcode = '22023';
  end if;

  return query
  with due as (
    select id
    from public.boss_notification_jobs
    where status = 'pending' and scheduled_for <= now()
    order by scheduled_for, id
    for update skip locked
    limit batch_size
  )
  update public.boss_notification_jobs jobs
  set status = 'processing', claimed_at = now(), attempt_count = jobs.attempt_count + 1
  from due
  where jobs.id = due.id
  returning jobs.*;
end;
$$;

revoke all on function public.claim_due_l2m_boss_notification_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_due_l2m_boss_notification_jobs(integer) to service_role;
comment on function public.claim_due_l2m_boss_notification_jobs(integer) is
  'Claims due 3-minute and 1-minute team Web Push jobs with SKIP LOCKED. Service role only.';
