-- l2m-boss: weekly reset baseline shared contract (段階A, next vertical slice)
--
-- BOSS_APP_DESIGN.md §13 未実装 says the weekly reset baseline (maintenance
-- end time / server reset time / per-boss initial spawn delay) described in
-- DESIGN.md「今週の基準日時と初回登場遅延」and implemented client-side in
-- Modules/L2MBossKit/Sources/L2MBossKit/BossWeeklyBaseline.swift is not yet
-- part of the shared Supabase contract. This migration is the first vertical
-- slice of that reflection:
--
--   * game_servers.maintenance_ended_at / server_reset_at: the server-wide
--     weekly baseline (nullable, minute-aligned, finite only; a reset value
--     alone is rejected by a DB constraint -- it always requires a
--     maintenance value to already be set).
--   * server_bosses.initial_spawn_delay_hours: per-boss non-negative hour
--     offset applied to the first spawn of the week, no fixed upper bound.
--   * get_l2m_boss_snapshot(): now also returns a weekly_baseline object
--     (maintenance_ended_at / server_reset_at / effective_baseline_at) and
--     each boss's initial_spawn_delay_hours. Each boss's schedule object now
--     also carries accepted_killed_at; when a weekly baseline is in effect
--     and the accepted report's killed_at predates the effective baseline,
--     the schedule is returned as null so the client falls back to
--     BossWeeklyBaseline.anchorKillAt's virtual first-spawn-of-the-week
--     anchor instead of a stale pre-reset kill. When no baseline is set,
--     behaviour is unchanged from the previous slice.
--   * set_l2m_boss_maintenance_ended_at(), set_l2m_boss_server_reset_at(),
--     set_l2m_boss_initial_spawn_delay_hours(): owner/admin-only, optimistic-
--     concurrency-checked writes for the three settings above.
--
-- This migration is append-only: it does not edit
-- 20260726090000_l2m_boss_server_scoped.sql or
-- 20260731230000_l2m_boss_shared_sync_contracts.sql. Everything here is
-- additive, or a `create or replace` of a function already owned by one of
-- those earlier migrations (get_l2m_boss_snapshot keeps its existing
-- signature and grants).
--
-- Not in scope for this slice: existing-data migration of the iPhone-local
-- UserDefaults baseline into this shared table, and any client (Swift)
-- changes to call the new RPCs or read weekly_baseline from the snapshot.

-- ---------------------------------------------------------------------------
-- 1. game_servers: weekly reset baseline columns
-- ---------------------------------------------------------------------------

alter table public.game_servers
  add column maintenance_ended_at timestamptz,
  add column server_reset_at timestamptz;

-- Only finite, minute-aligned instants may be stored. `date_trunc('minute', x)
-- = x` is timezone-invariant for every real-world UTC offset (all are whole
-- minutes), so this holds regardless of session timezone. `date_trunc` on an
-- infinite timestamptz returns the same infinite value, so the finiteness
-- check is required separately -- the minute-alignment check alone would not
-- reject 'infinity'/'-infinity'.
alter table public.game_servers
  add constraint game_servers_maintenance_ended_at_minute_check
  check (
    maintenance_ended_at is null
    or (
      maintenance_ended_at > '-infinity'::timestamptz
      and maintenance_ended_at < 'infinity'::timestamptz
      and maintenance_ended_at = date_trunc('minute', maintenance_ended_at)
    )
  );

alter table public.game_servers
  add constraint game_servers_server_reset_at_minute_check
  check (
    server_reset_at is null
    or (
      server_reset_at > '-infinity'::timestamptz
      and server_reset_at < 'infinity'::timestamptz
      and server_reset_at = date_trunc('minute', server_reset_at)
    )
  );

-- A reset override alone is meaningless (DESIGN.md: effective baseline falls
-- back to maintenance_ended_at, and is null entirely when that is null) --
-- reject it at the DB layer, not just in RPC logic.
alter table public.game_servers
  add constraint game_servers_server_reset_requires_maintenance_check
  check (server_reset_at is null or maintenance_ended_at is not null);

comment on column public.game_servers.maintenance_ended_at is
  'Weekly maintenance-end baseline for boss first-spawn-of-the-week calculation (DESIGN.md「今週の基準日時と初回登場遅延」). Null means no baseline is set. Always minute-aligned and finite.';
comment on column public.game_servers.server_reset_at is
  'Optional per-week override of maintenance_ended_at, used only when the actual server reset time differs from the announced maintenance end. Requires maintenance_ended_at to be set; cleared automatically when maintenance_ended_at moves to a different minute.';

-- ---------------------------------------------------------------------------
-- 2. server_bosses: per-boss initial spawn delay
-- ---------------------------------------------------------------------------

alter table public.server_bosses
  add column initial_spawn_delay_hours integer not null default 0
    check (initial_spawn_delay_hours >= 0);

comment on column public.server_bosses.initial_spawn_delay_hours is
  'Non-negative hour offset applied to this boss''s first spawn of the week, added to the effective weekly baseline. No fixed upper bound. 0 means no delay.';

-- ---------------------------------------------------------------------------
-- 3. get_l2m_boss_snapshot(): weekly_baseline + per-boss delay + gated schedule
-- ---------------------------------------------------------------------------

create or replace function public.get_l2m_boss_snapshot(target_server uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_active_l2m_boss_member(target_server) then
    raise exception 'not an active member of this game server' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'game_server_id', gs.id,
    'revision', gs.revision,
    'server_time', now(),
    'weekly_baseline', jsonb_build_object(
      'maintenance_ended_at', gs.maintenance_ended_at,
      'server_reset_at', gs.server_reset_at,
      'effective_baseline_at', case
        when gs.maintenance_ended_at is null then null
        else coalesce(gs.server_reset_at, gs.maintenance_ended_at)
      end
    ),
    'bosses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'server_boss_id', sb.id,
        'boss_id', sb.boss_id,
        'display_name', bc.display_name,
        'short_name', bc.short_name,
        'boss_kind', sb.boss_kind,
        'respawn_seconds', sb.respawn_seconds,
        'cycle_verified', sb.cycle_verified,
        'initial_spawn_delay_hours', sb.initial_spawn_delay_hours,
        'schedule', (
          -- When a weekly baseline is in effect and this schedule's accepted
          -- report predates it, surface no schedule at all: the client's
          -- BossWeeklyBaseline.anchorKillAt treats a pre-baseline kill the
          -- same way as no kill on record, and derives the first-spawn-of-
          -- the-week anchor from effective_baseline_at + this boss's
          -- initial_spawn_delay_hours instead. Absent a baseline, behaviour
          -- is unchanged from the previous slice.
          select case
            when gs.maintenance_ended_at is not null
              and br.killed_at < coalesce(gs.server_reset_at, gs.maintenance_ended_at)
            then null
            else jsonb_build_object(
              'next_spawn_at', bs.next_spawn_at,
              'missed_cycles', bs.missed_cycles,
              'revision', bs.revision,
              'updated_at', bs.updated_at,
              'accepted_killed_at', br.killed_at
            )
          end
          from public.boss_schedules bs
          join public.boss_reports br on br.id = bs.accepted_report_id
          where bs.server_boss_id = sb.id
        )
      ) order by bc.display_name)
      from public.server_bosses sb
      join public.boss_catalog bc on bc.id = sb.boss_id
      where sb.game_server_id = gs.id and sb.is_enabled
    ), '[]'::jsonb),
    'member_boss_preferences', coalesce((
      -- Preferences for bosses the admin has since disabled are excluded:
      -- they don't correspond to anything in the `bosses` array above, so a
      -- client keying off server_boss_id would otherwise hold an orphaned
      -- toggle for a boss it can no longer see.
      select jsonb_agg(jsonb_build_object(
        'server_boss_id', p.server_boss_id,
        'notify_enabled', p.notify_enabled,
        'personal_spawn_probability', p.personal_spawn_probability
      ))
      from public.member_boss_preferences p
      join public.server_bosses sb2
        on sb2.id = p.server_boss_id and sb2.game_server_id = gs.id
      where p.game_server_id = gs.id and p.user_id = auth.uid() and sb2.is_enabled
    ), '[]'::jsonb),
    'notification_preferences', coalesce((
      select jsonb_build_object(
        'notifications_enabled', np.notifications_enabled,
        'three_minutes_enabled', np.three_minutes_enabled,
        'one_minute_enabled', np.one_minute_enabled
      )
      from public.member_notification_preferences np
      where np.game_server_id = gs.id and np.user_id = auth.uid()
    ), jsonb_build_object(
      'notifications_enabled', true,
      'three_minutes_enabled', true,
      'one_minute_enabled', true
    ))
  )
  into result
  from public.game_servers gs
  where gs.id = target_server;

  return result;
end;
$$;

comment on function public.get_l2m_boss_snapshot(uuid) is
  'The one read RPC clients call on launch/foreground/login/push: returns server revision, the weekly reset baseline, enabled bosses (with their initial spawn delay), their accepted schedules (gated to null when the accepted kill predates the effective baseline), and the caller''s own preferences as a single consistent snapshot. Active-membership-only.';

-- Signature is unchanged from the previous slice, so the existing grant
-- (public.get_l2m_boss_snapshot(uuid) -> authenticated) should still apply
-- automatically. Re-assert it defensively anyway: relying on "CREATE OR
-- REPLACE preserves prior grants when the signature is unchanged" for a
-- security-relevant grant is exactly the kind of assumption that should be
-- checked, not trusted silently.
revoke all on function public.get_l2m_boss_snapshot(uuid) from public;
grant execute on function public.get_l2m_boss_snapshot(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. set_l2m_boss_maintenance_ended_at(): admin-only, optimistic-concurrency
-- ---------------------------------------------------------------------------

create or replace function public.set_l2m_boss_maintenance_ended_at(
  target_server uuid,
  target_maintenance_ended_at timestamptz,
  target_expected_revision bigint
)
returns public.game_servers
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.game_servers;
  normalized timestamptz;
  result public.game_servers;
begin
  if target_expected_revision is null then
    raise exception 'target_expected_revision is required' using errcode = '22004';
  end if;

  if not public.is_l2m_boss_admin(target_server) then
    raise exception 'not an admin of this game server' using errcode = '42501';
  end if;

  select * into current_row from public.game_servers where id = target_server for update;

  if current_row.id is null then
    raise exception 'game server not found' using errcode = 'P0002';
  end if;

  if target_expected_revision <> current_row.revision then
    raise exception 'expected_revision is stale (expected %, actual %)',
      target_expected_revision, current_row.revision using errcode = '40001';
  end if;

  normalized := case
    when target_maintenance_ended_at is null then null
    else date_trunc('minute', target_maintenance_ended_at)
  end;

  -- Same minute (including both null): no-op. The reset override, if any,
  -- is left exactly as it was and the revision does not move.
  if normalized is not distinct from current_row.maintenance_ended_at then
    return current_row;
  end if;

  -- A different minute (including null -> value, value -> null, or value ->
  -- a different value) always clears any reset override -- it no longer
  -- refers to a maintenance the caller just changed or removed -- and bumps
  -- the server-wide revision once.
  update public.game_servers
  set maintenance_ended_at = normalized,
      server_reset_at = null,
      revision = revision + 1
  where id = target_server
  returning * into result;

  return result;
end;
$$;

comment on function public.set_l2m_boss_maintenance_ended_at(uuid, timestamptz, bigint) is
  'Owner/admin-only write for the weekly maintenance-end baseline. Normalizes to the minute; a value in the same minute as the current one is a no-op (revision unchanged, reset override kept); any other change clears server_reset_at and bumps game_servers.revision by one. Requires target_expected_revision to match the current game_servers.revision (40001 if stale).';

revoke all on function public.set_l2m_boss_maintenance_ended_at(uuid, timestamptz, bigint) from public;
grant execute on function public.set_l2m_boss_maintenance_ended_at(uuid, timestamptz, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. set_l2m_boss_server_reset_at(): admin-only, optimistic-concurrency
-- ---------------------------------------------------------------------------

create or replace function public.set_l2m_boss_server_reset_at(
  target_server uuid,
  target_server_reset_at timestamptz,
  target_expected_revision bigint
)
returns public.game_servers
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.game_servers;
  normalized timestamptz;
  result public.game_servers;
begin
  if target_expected_revision is null then
    raise exception 'target_expected_revision is required' using errcode = '22004';
  end if;

  if not public.is_l2m_boss_admin(target_server) then
    raise exception 'not an admin of this game server' using errcode = '42501';
  end if;

  select * into current_row from public.game_servers where id = target_server for update;

  if current_row.id is null then
    raise exception 'game server not found' using errcode = 'P0002';
  end if;

  if target_expected_revision <> current_row.revision then
    raise exception 'expected_revision is stale (expected %, actual %)',
      target_expected_revision, current_row.revision using errcode = '40001';
  end if;

  normalized := case
    when target_server_reset_at is null then null
    else date_trunc('minute', target_server_reset_at)
  end;

  -- A non-null reset override is meaningless without a maintenance baseline
  -- already set (see game_servers_server_reset_requires_maintenance_check).
  -- Reject it explicitly here, before the no-op/update branches, so the
  -- caller gets a stable, descriptive exception (55000, "object not in
  -- prerequisite state") instead of a raw constraint-violation error; the
  -- DB-level check remains as a second line of defense for writers that
  -- bypass this RPC.
  if normalized is not null and current_row.maintenance_ended_at is null then
    raise exception 'server_reset_at requires maintenance_ended_at to be set first' using errcode = '55000';
  end if;

  -- Same value (including both null): no-op, revision unchanged.
  if normalized is not distinct from current_row.server_reset_at then
    return current_row;
  end if;

  -- Any real change or clearing bumps the revision once.
  update public.game_servers
  set server_reset_at = normalized,
      revision = revision + 1
  where id = target_server
  returning * into result;

  return result;
end;
$$;

comment on function public.set_l2m_boss_server_reset_at(uuid, timestamptz, bigint) is
  'Owner/admin-only write for the per-week server-reset override. Normalizes to the minute; the same value (including clearing an already-null override) is a no-op. Any real change or clearing bumps game_servers.revision by one. Setting a non-null value while maintenance_ended_at is null is explicitly rejected (55000) before the no-op/update branches; game_servers_server_reset_requires_maintenance_check enforces the same rule as a second line of defense at the DB layer. Requires target_expected_revision to match the current game_servers.revision (40001 if stale).';

revoke all on function public.set_l2m_boss_server_reset_at(uuid, timestamptz, bigint) from public;
grant execute on function public.set_l2m_boss_server_reset_at(uuid, timestamptz, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. set_l2m_boss_initial_spawn_delay_hours(): admin-only, optimistic-concurrency
-- ---------------------------------------------------------------------------

create or replace function public.set_l2m_boss_initial_spawn_delay_hours(
  target_server_boss uuid,
  target_hours integer,
  target_expected_revision bigint
)
returns public.server_bosses
language plpgsql
security definer
set search_path = public
as $$
declare
  server_id uuid;
  locked_server_id uuid;
  current_hours integer;
  actual_revision bigint;
  result public.server_bosses;
begin
  if target_expected_revision is null then
    raise exception 'target_expected_revision is required' using errcode = '22004';
  end if;

  if target_hours is null then
    raise exception 'target_hours is required' using errcode = '22004';
  end if;

  if target_hours < 0 then
    raise exception 'target_hours must not be negative' using errcode = '22003';
  end if;

  -- Discover which server this boss belongs to first, without locking the
  -- row: an unauthorized caller should not be able to force a row lock on
  -- server_bosses (or block a concurrent admin write) before the admin
  -- check below has a chance to reject them.
  select sb.game_server_id into server_id
  from public.server_bosses sb
  where sb.id = target_server_boss;

  if server_id is null then
    raise exception 'server boss not found' using errcode = 'P0002';
  end if;

  if not public.is_l2m_boss_admin(server_id) then
    raise exception 'not an admin of this game server' using errcode = '42501';
  end if;

  -- Safe lock order: game_servers first, matching every other
  -- set_l2m_boss_* function in this migration (none of which lock more
  -- than one table), then server_bosses below.
  select revision into actual_revision from public.game_servers where id = server_id for update;

  if target_expected_revision <> actual_revision then
    raise exception 'expected_revision is stale (expected %, actual %)',
      target_expected_revision, actual_revision using errcode = '40001';
  end if;

  -- Now lock the target boss row and re-confirm it still belongs to the
  -- server we just authorized against and locked -- it could conceivably
  -- have been deleted, or reassigned to a different server, between the
  -- unlocked read above and this lock.
  select sb.game_server_id, sb.initial_spawn_delay_hours
    into locked_server_id, current_hours
  from public.server_bosses sb
  where sb.id = target_server_boss
  for update;

  if locked_server_id is null then
    raise exception 'server boss not found' using errcode = 'P0002';
  end if;

  if locked_server_id <> server_id then
    raise exception 'server boss no longer belongs to the authorized game server' using errcode = '55000';
  end if;

  -- Same value: no-op. No UPDATE is run at all, so the existing
  -- server_bosses_bump_server_revision trigger does not fire and
  -- game_servers.revision does not move.
  if target_hours = current_hours then
    select * into result from public.server_bosses where id = target_server_boss;
    return result;
  end if;

  -- A real change runs the UPDATE; the pre-existing
  -- server_bosses_bump_server_revision trigger (after insert or update on
  -- server_bosses) bumps game_servers.revision by exactly one as a side
  -- effect -- this function does not bump it a second time itself.
  update public.server_bosses
  set initial_spawn_delay_hours = target_hours
  where id = target_server_boss
  returning * into result;

  return result;
end;
$$;

comment on function public.set_l2m_boss_initial_spawn_delay_hours(uuid, integer, bigint) is
  'Owner/admin-only write for one boss''s initial spawn delay (hours, no fixed upper bound). Rejects null/negative hours. Authorization is checked against an unlocked read of the target boss''s server before any row lock is acquired; game_servers is then locked and its revision validated, and only then is the target server_bosses row locked and re-confirmed to still belong to that server. The same value is a no-op; a real change is the only path that runs an UPDATE, so game_servers.revision is bumped exactly once, by the pre-existing server_bosses_bump_server_revision trigger. Requires target_expected_revision to match the current game_servers.revision (40001 if stale).';

revoke all on function public.set_l2m_boss_initial_spawn_delay_hours(uuid, integer, bigint) from public;
grant execute on function public.set_l2m_boss_initial_spawn_delay_hours(uuid, integer, bigint) to authenticated;
