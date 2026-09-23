-- l2m-boss: shared sync contracts (段階A, first vertical slice)
--
-- Adds the pieces required for BOSS_APP_DESIGN.md §5-§8:
--   * a game-server-wide revision counter clients use to decide whether to
--     refetch the shared snapshot (bumped by trigger whenever boss config or
--     an accepted schedule changes)
--   * per-member notification preferences (member_boss_preferences,
--     member_notification_preferences)
--   * push_devices extended with a random installation id, app kind, and
--     platform so l2m / l2m_boss / l2m_watch installs can be told apart
--   * get_l2m_boss_snapshot(): the single read RPC that returns server
--     revision + enabled bosses + accepted schedules + the caller's own
--     preferences as one consistent snapshot
--   * submit_l2m_boss_report(): rewritten to require the schedule revision
--     the client last saw and fail closed (conflict, no schedule mutation)
--     on stale revisions, future timestamps, or a disabled/foreign boss
--   * cancel_own_l2m_boss_report(), admin_resolve_l2m_boss_report(),
--     upsert_member_boss_preference(), upsert_member_notification_preference(),
--     upsert_l2m_push_device(), revoke_l2m_push_device()
--
-- This migration is append-only: it does not edit
-- 20260726090000_l2m_boss_server_scoped.sql. Everything here is additive or,
-- where a function/policy must change behaviour, a `create or replace` /
-- drop-then-recreate of an object owned by that earlier migration.
--
-- Not in scope for this slice (left for the next vertical slice, per
-- BOSS_APP_DESIGN.md §13 "未実装"): near-duplicate report bundling within a
-- confirmation window, Discord OAuth/invite issuance RPCs, APNs/FCM delivery
-- workers, and existing-data migration preview.

-- ---------------------------------------------------------------------------
-- 1. Game-server-wide revision counter
-- ---------------------------------------------------------------------------

alter table public.game_servers
  add column revision bigint not null default 0;

create or replace function public.bump_l2m_boss_server_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.game_servers
  set revision = revision + 1,
      updated_at = now()
  where id = coalesce(new.game_server_id, old.game_server_id);
  return new;
end;
$$;

comment on function public.bump_l2m_boss_server_revision() is
  'Bumps game_servers.revision whenever shared boss config or an accepted schedule changes, so clients know a fresh get_l2m_boss_snapshot() call is needed.';

create trigger server_bosses_bump_server_revision
  after insert or update on public.server_bosses
  for each row execute function public.bump_l2m_boss_server_revision();

create trigger boss_schedules_bump_server_revision
  after insert or update on public.boss_schedules
  for each row execute function public.bump_l2m_boss_server_revision();

-- ---------------------------------------------------------------------------
-- 1a. server_bosses: blue/red boss kind (BOSS_APP_DESIGN.md §5/§9)
-- ---------------------------------------------------------------------------

create type public.l2m_boss_kind as enum ('blue', 'red');

-- 'blue' is kept as a real, persistent default (not dropped after the ALTER):
-- it matches the existing l2m app's current behaviour of treating an
-- unspecified/unmigrated boss as blue. Every row -- pre-existing or
-- newly inserted without an explicit kind -- resolves to 'blue'.
alter table public.server_bosses
  add column boss_kind public.l2m_boss_kind not null default 'blue';

comment on column public.server_bosses.boss_kind is
  'Blue/red boss species classification. Shared server-wide (not a per-member setting) and returned by get_l2m_boss_snapshot(). Defaults to blue, matching existing l2m behaviour for an unspecified boss.';

-- ---------------------------------------------------------------------------
-- 2. Member preferences
-- ---------------------------------------------------------------------------

create table public.member_boss_preferences (
  id uuid primary key default gen_random_uuid(),
  game_server_id uuid not null references public.game_servers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  server_boss_id uuid not null,
  notify_enabled boolean not null default true,
  -- The "まさの体感メモ" per-member spawn probability override. Never forced
  -- onto other members' boss rush display (BOSS_APP_DESIGN.md §5).
  personal_spawn_probability numeric(4,3)
    check (personal_spawn_probability is null or (personal_spawn_probability >= 0 and personal_spawn_probability <= 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_server_id, user_id, server_boss_id),
  foreign key (server_boss_id, game_server_id)
    references public.server_bosses(id, game_server_id) on delete cascade
);

create table public.member_notification_preferences (
  game_server_id uuid not null references public.game_servers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notifications_enabled boolean not null default true,
  three_minutes_enabled boolean not null default true,
  one_minute_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game_server_id, user_id)
);

create index member_boss_preferences_lookup_idx
  on public.member_boss_preferences (game_server_id, user_id);

create trigger member_boss_preferences_updated_at
  before update on public.member_boss_preferences
  for each row execute function public.set_l2m_boss_updated_at();

create trigger member_notification_preferences_updated_at
  before update on public.member_notification_preferences
  for each row execute function public.set_l2m_boss_updated_at();

alter table public.member_boss_preferences enable row level security;
alter table public.member_notification_preferences enable row level security;

create policy member_boss_preferences_owner_read
  on public.member_boss_preferences for select to authenticated
  using (user_id = auth.uid() and public.is_active_l2m_boss_member(game_server_id));

create policy member_notification_preferences_owner_read
  on public.member_notification_preferences for select to authenticated
  using (user_id = auth.uid() and public.is_active_l2m_boss_member(game_server_id));

revoke all on public.member_boss_preferences, public.member_notification_preferences
  from anon, authenticated;
grant select on public.member_boss_preferences, public.member_notification_preferences
  to authenticated;

comment on table public.member_boss_preferences is
  'Per-member, per-boss notification toggle and personal spawn-probability override. Writes only via upsert_member_boss_preference().';
comment on table public.member_notification_preferences is
  'Per-member, per-server notification master switch and 3min/1min lead toggles. Writes only via upsert_member_notification_preference().';

-- ---------------------------------------------------------------------------
-- 3. push_devices: random installation id, app kind, platform
-- ---------------------------------------------------------------------------

create type public.l2m_boss_app_kind as enum ('l2m', 'l2m_boss', 'l2m_watch');
create type public.l2m_boss_platform as enum ('ios', 'android', 'watchos');

alter table public.push_devices
  add column installation_id uuid not null default gen_random_uuid(),
  add column app_kind public.l2m_boss_app_kind not null default 'l2m_boss',
  add column platform public.l2m_boss_platform not null default 'ios';

-- The defaults above only exist so the ALTER succeeds against an empty
-- table; every future row must state its app kind and platform explicitly.
alter table public.push_devices alter column app_kind drop default;
alter table public.push_devices alter column platform drop default;

-- token_ciphertext can rotate (APNs/FCM tokens are reissued); the natural key
-- for "one registered install" is the random installation id the client
-- persists, not the token bytes.
alter table public.push_devices
  drop constraint push_devices_game_server_id_user_id_token_ciphertext_key;

alter table public.push_devices
  add constraint push_devices_installation_id_key unique (installation_id);

create index push_devices_server_user_idx
  on public.push_devices (game_server_id, user_id) where revoked_at is null;

comment on column public.push_devices.installation_id is
  'Random per-install id generated by the client. The stable key for upsert_l2m_push_device()/revoke_l2m_push_device(), independent of token rotation.';
comment on column public.push_devices.app_kind is
  'Which app this install belongs to: l2m (existing REDMAGIC-monitoring app), l2m_boss (shared boss app), or l2m_watch (existing Apple Watch companion).';
comment on column public.push_devices.platform is
  'OS family for the install: ios, android, or watchos.';

-- watchOS installs are always l2m_watch (the existing Apple Watch companion);
-- Android installs are always l2m_boss (the monitoring app is a separate,
-- non-l2m_boss Android application per BOSS_APP_DESIGN.md §2/§3).
alter table public.push_devices
  add constraint push_devices_platform_app_kind_check
  check (
    (platform = 'watchos') = (app_kind = 'l2m_watch')
    and (platform <> 'android' or app_kind = 'l2m_boss')
  );

-- ---------------------------------------------------------------------------
-- 3a. Revoke push devices when a membership is revoked
-- ---------------------------------------------------------------------------

create or replace function public.revoke_l2m_push_devices_on_membership_revoke()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'revoked' and old.status is distinct from 'revoked' then
    update public.push_devices
    set revoked_at = now(),
        updated_at = now()
    where game_server_id = new.game_server_id
      and user_id = new.user_id
      and revoked_at is null;
  end if;
  return new;
end;
$$;

comment on function public.revoke_l2m_push_devices_on_membership_revoke() is
  'When a server_membership transitions into revoked, revokes every push_devices row for that (game_server_id, user_id) in the same transaction so notification delivery stops immediately, not just read/report/Realtime access.';

create trigger server_memberships_revoke_devices_on_revoke
  after update on public.server_memberships
  for each row execute function public.revoke_l2m_push_devices_on_membership_revoke();

-- ---------------------------------------------------------------------------
-- 4. get_l2m_boss_snapshot(): single consistent read
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
    'bosses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'server_boss_id', sb.id,
        'boss_id', sb.boss_id,
        'display_name', bc.display_name,
        'short_name', bc.short_name,
        'boss_kind', sb.boss_kind,
        'respawn_seconds', sb.respawn_seconds,
        'cycle_verified', sb.cycle_verified,
        'schedule', (
          select jsonb_build_object(
            'next_spawn_at', bs.next_spawn_at,
            'missed_cycles', bs.missed_cycles,
            'revision', bs.revision,
            'updated_at', bs.updated_at
          )
          from public.boss_schedules bs
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
  'The one read RPC clients call on launch/foreground/login/push: returns server revision, enabled bosses, their accepted schedules, and the caller''s own preferences as a single consistent snapshot. Active-membership-only.';

revoke all on function public.get_l2m_boss_snapshot(uuid) from public;
grant execute on function public.get_l2m_boss_snapshot(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. submit_l2m_boss_report(): expected-revision, fail-closed rewrite
-- ---------------------------------------------------------------------------

-- Replaces the initial-skeleton version from 20260726090000. The dedupe
-- semantics (client uuid -> keyed digest) are unchanged; what changes is the
-- required expected_schedule_revision and the fail-closed conflict handling.
drop function if exists public.submit_l2m_boss_report(uuid, timestamptz, uuid);

create or replace function public.submit_l2m_boss_report(
  target_server_boss uuid,
  occurred_at timestamptz,
  client_report_id uuid,
  -- The boss_schedules.revision the client had cached when it recorded this
  -- kill. 0 means "the client believes no schedule exists yet for this
  -- boss." Required: there is no "just overwrite whatever's there" mode.
  expected_schedule_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  server_id uuid;
  dedupe text;
  lock_key bigint;
  existing public.boss_reports;
  current_schedule public.boss_schedules;
  actual_revision bigint;
  new_report public.boss_reports;
begin
  if expected_schedule_revision is null then
    raise exception 'expected_schedule_revision is required' using errcode = '22004';
  end if;
  if occurred_at is null then
    raise exception 'occurred_at is required' using errcode = '22004';
  end if;
  if client_report_id is null then
    raise exception 'client_report_id is required' using errcode = '22004';
  end if;

  select sb.game_server_id into server_id
  from public.server_bosses sb
  where sb.id = target_server_boss and sb.is_enabled;

  if server_id is null or not public.is_active_l2m_boss_member(server_id) then
    raise exception 'not an active member of this game server' using errcode = '42501';
  end if;

  dedupe := encode(extensions.digest(auth.uid()::text || ':' || client_report_id::text, 'sha256'), 'hex');

  -- Idempotency is an advisory lock on (user, client_report_id), not a
  -- check-then-insert: two concurrent submits of the same client_report_id
  -- serialize on this lock instead of racing the "does it exist yet" select
  -- against the insert below (which could otherwise let both through).
  lock_key := ('x' || substr(dedupe, 1, 16))::bit(64)::bigint;
  perform pg_advisory_xact_lock(lock_key);

  select * into existing
  from public.boss_reports
  where game_server_id = server_id and input_source = 'app' and source_dedupe_key = dedupe;

  if found then
    return jsonb_build_object(
      'report_id', existing.id,
      'status', existing.status,
      'resolution_code', existing.resolution_code,
      'idempotent_replay', true
    );
  end if;

  -- Fail closed: any future-dated kill is rejected outright. No grace
  -- period; clock skew is the client's problem to correct, not ours to
  -- paper over.
  if occurred_at > now() then
    insert into public.boss_reports (
      game_server_id, server_boss_id, killed_at, submitted_by, input_source,
      source_dedupe_key, status, resolved_at, resolved_by, resolution_code
    ) values (
      server_id, target_server_boss, occurred_at, auth.uid(), 'app',
      dedupe, 'conflict', now(), auth.uid(), 'future_timestamp'
    )
    returning * into new_report;

    return jsonb_build_object(
      'report_id', new_report.id, 'status', new_report.status,
      'resolution_code', new_report.resolution_code, 'idempotent_replay', false
    );
  end if;

  -- Lock the schedule row (if any) so a concurrent admin resolution can't
  -- change the revision out from under this decision.
  select * into current_schedule
  from public.boss_schedules
  where server_boss_id = target_server_boss
  for update;

  actual_revision := coalesce(current_schedule.revision, 0);

  if expected_schedule_revision <> actual_revision then
    -- Stale or conflicting: leave the existing schedule untouched, flag for
    -- admin review.
    insert into public.boss_reports (
      game_server_id, server_boss_id, killed_at, submitted_by, input_source,
      source_dedupe_key, status, resolved_at, resolved_by, resolution_code
    ) values (
      server_id, target_server_boss, occurred_at, auth.uid(), 'app',
      dedupe, 'conflict', now(), auth.uid(), 'stale_revision'
    )
    returning * into new_report;

    return jsonb_build_object(
      'report_id', new_report.id, 'status', new_report.status,
      'resolution_code', new_report.resolution_code, 'idempotent_replay', false
    );
  end if;

  -- Correct revision: the report is accepted for review as `pending`. It
  -- does not move boss_schedules itself -- only admin_resolve_l2m_boss_report
  -- (or a future confirmation-window bundler) may mutate the schedule.
  insert into public.boss_reports (
    game_server_id, server_boss_id, killed_at, submitted_by, input_source,
    source_dedupe_key, status
  ) values (
    server_id, target_server_boss, occurred_at, auth.uid(), 'app',
    dedupe, 'pending'
  )
  returning * into new_report;

  return jsonb_build_object(
    'report_id', new_report.id, 'status', new_report.status,
    'resolution_code', new_report.resolution_code,
    'schedule_revision', actual_revision, 'idempotent_replay', false
  );
end;
$$;

comment on function public.submit_l2m_boss_report(uuid, timestamptz, uuid, bigint) is
  'The only client mutation for kill reports. Requires the schedule revision the client last saw; stale revisions and future timestamps fail closed into a conflict row. A correct-revision report is only ever queued as pending -- it never mutates boss_schedules itself, that happens exclusively via admin_resolve_l2m_boss_report. Same client_report_id always replays the same resolved result (guarded by an advisory lock, not a check-then-insert race).';

revoke all on function public.submit_l2m_boss_report(uuid, timestamptz, uuid, bigint) from public;
grant execute on function public.submit_l2m_boss_report(uuid, timestamptz, uuid, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. cancel own pending report
-- ---------------------------------------------------------------------------

create or replace function public.cancel_own_l2m_boss_report(target_report uuid)
returns public.boss_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.boss_reports;
  server_id uuid;
begin
  select game_server_id into server_id
  from public.boss_reports
  where id = target_report and submitted_by = auth.uid() and status = 'pending';

  if server_id is null or not public.is_active_l2m_boss_member(server_id) then
    raise exception 'report not found, not owned by caller, not pending, or membership inactive' using errcode = 'P0002';
  end if;

  update public.boss_reports
  set status = 'cancelled',
      resolved_at = now(),
      resolved_by = auth.uid(),
      resolution_code = 'cancelled_by_submitter'
  where id = target_report
    and submitted_by = auth.uid()
    and status = 'pending'
  returning * into updated;

  if updated.id is null then
    raise exception 'report not found, not owned by caller, or not pending' using errcode = 'P0002';
  end if;

  return updated;
end;
$$;

comment on function public.cancel_own_l2m_boss_report(uuid) is
  'Lets a member withdraw their own report while it is still pending (before the server has resolved it to accepted/conflict/rejected). Requires the caller to still be an active member. No effect on other members'' reports or the accepted schedule.';

revoke all on function public.cancel_own_l2m_boss_report(uuid) from public;
grant execute on function public.cancel_own_l2m_boss_report(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. admin accept/reject a pending or conflicted report
-- ---------------------------------------------------------------------------

create or replace function public.admin_resolve_l2m_boss_report(
  target_report uuid,
  target_accept boolean,
  -- The boss_schedules.revision the admin's client had cached (0 = "no
  -- schedule exists yet"). Required whenever target_accept is true: schedule
  -- mutation is optimistic-concurrency-checked the same way submit_l2m_boss_report
  -- is, so a stale admin client can't blindly clobber a newer schedule.
  target_expected_schedule_revision bigint default null,
  target_resolution_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rpt public.boss_reports;
  sb public.server_bosses;
  current_schedule public.boss_schedules;
  actual_revision bigint;
begin
  if target_accept is null then
    raise exception 'target_accept is required' using errcode = '22004';
  end if;

  if target_resolution_code is not null and char_length(target_resolution_code) > 80 then
    raise exception 'resolution_code too long' using errcode = '22001';
  end if;

  select * into rpt from public.boss_reports where id = target_report for update;

  if rpt.id is null then
    raise exception 'report not found' using errcode = 'P0002';
  end if;

  if not public.is_l2m_boss_admin(rpt.game_server_id) then
    raise exception 'not an admin of this game server' using errcode = '42501';
  end if;

  if rpt.status not in ('pending', 'conflict') then
    raise exception 'report is not in a resolvable state' using errcode = '55000';
  end if;

  if target_accept then
    -- Defense in depth: submit_l2m_boss_report already fails closed on a
    -- future occurred_at, so a legitimately app-submitted pending/conflict
    -- report should never carry one. A migration-sourced or otherwise
    -- directly-inserted report could; refuse to let an admin accept turn
    -- such a row into a schedule update.
    if rpt.killed_at > now() then
      raise exception 'report killed_at is in the future; refusing to update the schedule' using errcode = '22007';
    end if;

    select * into sb from public.server_bosses where id = rpt.server_boss_id;

    if sb.id is null or not sb.is_enabled then
      raise exception 'boss is disabled; schedule cannot be updated' using errcode = '55000';
    end if;

    if target_expected_schedule_revision is null then
      raise exception 'target_expected_schedule_revision is required to accept' using errcode = '22004';
    end if;

    select * into current_schedule from public.boss_schedules
    where server_boss_id = rpt.server_boss_id for update;

    actual_revision := coalesce(current_schedule.revision, 0);

    if target_expected_schedule_revision <> actual_revision then
      raise exception 'expected_schedule_revision is stale (expected %, actual %)',
        target_expected_schedule_revision, actual_revision using errcode = '40001';
    end if;

    if current_schedule.server_boss_id is null then
      insert into public.boss_schedules (
        server_boss_id, game_server_id, accepted_report_id, next_spawn_at, missed_cycles, revision
      ) values (
        rpt.server_boss_id, rpt.game_server_id, rpt.id, rpt.killed_at + make_interval(secs => sb.respawn_seconds), 0, 1
      );
    else
      update public.boss_schedules
      set accepted_report_id = rpt.id,
          next_spawn_at = rpt.killed_at + make_interval(secs => sb.respawn_seconds),
          missed_cycles = 0,
          revision = revision + 1,
          updated_at = now()
      where server_boss_id = rpt.server_boss_id;
    end if;

    update public.boss_reports
    set status = 'accepted',
        resolved_at = now(),
        resolved_by = auth.uid(),
        resolution_code = coalesce(target_resolution_code, 'admin_override_accept')
    where id = target_report
    returning * into rpt;
  else
    update public.boss_reports
    set status = 'rejected',
        resolved_at = now(),
        resolved_by = auth.uid(),
        resolution_code = coalesce(target_resolution_code, 'admin_reject')
    where id = target_report
    returning * into rpt;
  end if;

  return jsonb_build_object('report_id', rpt.id, 'status', rpt.status, 'resolution_code', rpt.resolution_code);
end;
$$;

comment on function public.admin_resolve_l2m_boss_report(uuid, boolean, bigint, text) is
  'Admin/owner-only override for a pending or conflicted report. target_accept is required (no default) and, when true, requires the report''s killed_at to not be in the future, target_expected_schedule_revision to match the current boss_schedules revision, and the boss to still be enabled before the schedule is recomputed from this report''s killed_at; rejecting leaves the existing schedule untouched.';

revoke all on function public.admin_resolve_l2m_boss_report(uuid, boolean, bigint, text) from public;
grant execute on function public.admin_resolve_l2m_boss_report(uuid, boolean, bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. member preference writes
-- ---------------------------------------------------------------------------

create or replace function public.upsert_member_boss_preference(
  target_server_boss uuid,
  target_notify_enabled boolean,
  target_personal_spawn_probability numeric default null
)
returns public.member_boss_preferences
language plpgsql
security definer
set search_path = public
as $$
declare
  server_id uuid;
  result public.member_boss_preferences;
begin
  select game_server_id into server_id from public.server_bosses where id = target_server_boss;

  if server_id is null or not public.is_active_l2m_boss_member(server_id) then
    raise exception 'not an active member of this game server' using errcode = '42501';
  end if;

  if target_personal_spawn_probability is not null
     and (target_personal_spawn_probability < 0 or target_personal_spawn_probability > 1) then
    raise exception 'personal_spawn_probability must be between 0 and 1' using errcode = '22003';
  end if;

  insert into public.member_boss_preferences (
    game_server_id, user_id, server_boss_id, notify_enabled, personal_spawn_probability
  ) values (
    server_id, auth.uid(), target_server_boss, target_notify_enabled, target_personal_spawn_probability
  )
  on conflict (game_server_id, user_id, server_boss_id) do update
    set notify_enabled = excluded.notify_enabled,
        personal_spawn_probability = excluded.personal_spawn_probability,
        updated_at = now()
  returning * into result;

  return result;
end;
$$;

comment on function public.upsert_member_boss_preference(uuid, boolean, numeric) is
  'Sets the caller''s own notify-on/off and personal spawn-probability override for one server boss. Never affects other members.';

revoke all on function public.upsert_member_boss_preference(uuid, boolean, numeric) from public;
grant execute on function public.upsert_member_boss_preference(uuid, boolean, numeric) to authenticated;

create or replace function public.upsert_member_notification_preference(
  target_server uuid,
  target_notifications_enabled boolean,
  target_three_minutes_enabled boolean,
  target_one_minute_enabled boolean
)
returns public.member_notification_preferences
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.member_notification_preferences;
begin
  if not public.is_active_l2m_boss_member(target_server) then
    raise exception 'not an active member of this game server' using errcode = '42501';
  end if;

  insert into public.member_notification_preferences (
    game_server_id, user_id, notifications_enabled, three_minutes_enabled, one_minute_enabled
  ) values (
    target_server, auth.uid(), target_notifications_enabled, target_three_minutes_enabled, target_one_minute_enabled
  )
  on conflict (game_server_id, user_id) do update
    set notifications_enabled = excluded.notifications_enabled,
        three_minutes_enabled = excluded.three_minutes_enabled,
        one_minute_enabled = excluded.one_minute_enabled,
        updated_at = now()
  returning * into result;

  return result;
end;
$$;

comment on function public.upsert_member_notification_preference(uuid, boolean, boolean, boolean) is
  'Sets the caller''s own master notification switch and 3min/1min lead toggles for one game server.';

revoke all on function public.upsert_member_notification_preference(uuid, boolean, boolean, boolean) from public;
grant execute on function public.upsert_member_notification_preference(uuid, boolean, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. push device registration writes
-- ---------------------------------------------------------------------------

create or replace function public.upsert_l2m_push_device(
  target_server uuid,
  target_installation_id uuid,
  target_app_kind public.l2m_boss_app_kind,
  target_platform public.l2m_boss_platform,
  target_token_ciphertext bytea,
  target_notification_preferences jsonb default null
)
returns public.push_devices
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.push_devices;
begin
  if not public.is_active_l2m_boss_member(target_server) then
    raise exception 'not an active member of this game server' using errcode = '42501';
  end if;

  insert into public.push_devices (
    game_server_id, user_id, installation_id, app_kind, platform,
    token_ciphertext, notification_preferences, last_seen_at, revoked_at
  ) values (
    target_server, auth.uid(), target_installation_id, target_app_kind, target_platform,
    target_token_ciphertext,
    coalesce(target_notification_preferences, '{"three_minutes":true,"one_minute":true}'::jsonb),
    now(), null
  )
  on conflict (installation_id) do update
    set token_ciphertext = excluded.token_ciphertext,
        app_kind = excluded.app_kind,
        platform = excluded.platform,
        notification_preferences = coalesce(target_notification_preferences, public.push_devices.notification_preferences),
        last_seen_at = now(),
        revoked_at = null,
        updated_at = now()
    where public.push_devices.user_id = auth.uid()
      and public.push_devices.game_server_id = target_server
  returning * into result;

  if result.id is null then
    raise exception 'installation_id belongs to another user or game server' using errcode = '42501';
  end if;

  return result;
end;
$$;

comment on function public.upsert_l2m_push_device(uuid, uuid, public.l2m_boss_app_kind, public.l2m_boss_platform, bytea, jsonb) is
  'Registers or refreshes one app install''s push routing. installation_id is the client-generated stable key; re-registering an id owned by a different user/server is rejected instead of silently reassigned.';

revoke all on function public.upsert_l2m_push_device(uuid, uuid, public.l2m_boss_app_kind, public.l2m_boss_platform, bytea, jsonb) from public;
grant execute on function public.upsert_l2m_push_device(uuid, uuid, public.l2m_boss_app_kind, public.l2m_boss_platform, bytea, jsonb) to authenticated;

create or replace function public.revoke_l2m_push_device(target_installation_id uuid)
returns public.push_devices
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.push_devices;
  server_id uuid;
begin
  select game_server_id into server_id
  from public.push_devices
  where installation_id = target_installation_id and user_id = auth.uid();

  if server_id is null or not public.is_active_l2m_boss_member(server_id) then
    raise exception 'device not found, not owned by caller, or membership inactive' using errcode = 'P0002';
  end if;

  update public.push_devices
  set revoked_at = now(),
      updated_at = now()
  where installation_id = target_installation_id
    and user_id = auth.uid()
  returning * into result;

  if result.id is null then
    raise exception 'device not found or not owned by caller' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

comment on function public.revoke_l2m_push_device(uuid) is
  'Marks the caller''s own push device install as revoked so it stops receiving boss_notification_jobs deliveries. Requires the caller to still be an active member of that device''s game server.';

revoke all on function public.revoke_l2m_push_device(uuid) from public;
grant execute on function public.revoke_l2m_push_device(uuid) to authenticated;
