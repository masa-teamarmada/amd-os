-- l2m-boss: server-scoped shared ledger
-- Every operational row belongs to exactly one game server.  Client roles are
-- never trusted to provide a server id; RLS derives authority from an active
-- membership for the authenticated Supabase user.

create extension if not exists pgcrypto with schema extensions;

create type public.l2m_boss_member_role as enum ('owner', 'admin', 'member');
create type public.l2m_boss_membership_status as enum ('invited', 'pending', 'active', 'revoked');
create type public.l2m_boss_report_source as enum ('app', 'discord', 'migration');
create type public.l2m_boss_report_status as enum ('pending', 'accepted', 'rejected', 'conflict', 'cancelled');

create table public.game_servers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  time_zone text not null default 'Asia/Tokyo',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Global definitions contain no player, Discord, or device data.  A server
-- enables and, when necessary, overrides each boss in server_bosses below.
create table public.boss_catalog (
  id text primary key check (id ~ '^[a-z0-9_]{2,80}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  short_name text not null check (char_length(short_name) between 1 and 32),
  default_respawn_seconds integer not null check (default_respawn_seconds > 0),
  default_cycle_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.server_bosses (
  id uuid primary key default gen_random_uuid(),
  game_server_id uuid not null references public.game_servers(id) on delete cascade,
  boss_id text not null references public.boss_catalog(id) on delete restrict,
  respawn_seconds integer not null check (respawn_seconds > 0),
  cycle_verified boolean not null default false,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_server_id, boss_id),
  unique (id, game_server_id)
);

create table public.server_memberships (
  id uuid primary key default gen_random_uuid(),
  game_server_id uuid not null references public.game_servers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.l2m_boss_member_role not null default 'member',
  status public.l2m_boss_membership_status not null default 'pending',
  -- SHA-256 of the Discord user id with an application-held pepper.  Never the
  -- raw Discord id, display name, avatar, character name, or message body.
  discord_user_hash bytea,
  approved_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_server_id, user_id),
  check ((status = 'revoked') = (revoked_at is not null))
);

create table public.server_invites (
  id uuid primary key default gen_random_uuid(),
  game_server_id uuid not null references public.game_servers(id) on delete cascade,
  -- Only a salted hash of a one-time invite is persisted.  The plain token is
  -- shown once by the issuing API and is never recoverable from this table.
  token_hash bytea not null unique,
  requested_role public.l2m_boss_member_role not null default 'member',
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses between 1 and 100),
  used_count integer not null default 0 check (used_count >= 0),
  issued_by uuid not null references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (used_count <= max_uses)
);

create table public.boss_reports (
  id uuid primary key default gen_random_uuid(),
  game_server_id uuid not null references public.game_servers(id) on delete cascade,
  server_boss_id uuid not null,
  killed_at timestamptz not null,
  received_at timestamptz not null default now(),
  submitted_by uuid references auth.users(id) on delete set null,
  input_source public.l2m_boss_report_source not null,
  -- App reports use a user-scoped client UUID. Discord imports use a keyed
  -- digest of the message id. Raw provider text and ids are never stored.
  source_dedupe_key text not null check (char_length(source_dedupe_key) between 16 and 200),
  status public.l2m_boss_report_status not null default 'pending',
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_code text check (resolution_code is null or char_length(resolution_code) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (server_boss_id, game_server_id)
    references public.server_bosses(id, game_server_id) on delete restrict,
  unique (game_server_id, input_source, source_dedupe_key),
  check (
    (status in ('accepted', 'rejected', 'conflict', 'cancelled')) = (resolved_at is not null)
  ),
  check (input_source <> 'app' or submitted_by is not null)
);

-- This is a server-owned read model, updated only by the trusted API/worker
-- after it accepts a report.  Members receive schedules, not other members'
-- private report history.
create table public.boss_schedules (
  server_boss_id uuid primary key,
  game_server_id uuid not null references public.game_servers(id) on delete cascade,
  accepted_report_id uuid not null references public.boss_reports(id) on delete restrict,
  next_spawn_at timestamptz not null,
  missed_cycles integer not null default 0 check (missed_cycles >= 0),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  foreign key (server_boss_id, game_server_id)
    references public.server_bosses(id, game_server_id) on delete cascade
);

create table public.discord_sources (
  id uuid primary key default gen_random_uuid(),
  game_server_id uuid not null references public.game_servers(id) on delete cascade,
  -- Provider identifiers are operational routing values only. Bot credentials,
  -- channel bodies, and human-readable Discord identities never enter Postgres.
  guild_id_hash bytea not null,
  channel_id_hash bytea not null,
  is_enabled boolean not null default false,
  last_processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_server_id, channel_id_hash)
);

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  game_server_id uuid not null references public.game_servers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- APNs token encrypted by the trusted API. No device identifier is stored.
  token_ciphertext bytea not null,
  notification_preferences jsonb not null default '{"three_minutes":true,"one_minute":true}'::jsonb,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_server_id, user_id, token_ciphertext)
);

create index server_bosses_server_enabled_idx on public.server_bosses (game_server_id, is_enabled);
create index memberships_user_active_idx on public.server_memberships (user_id, game_server_id) where status = 'active';
create index reports_server_boss_time_idx on public.boss_reports (game_server_id, server_boss_id, killed_at desc);
create index reports_pending_idx on public.boss_reports (game_server_id, received_at) where status = 'pending';
create index schedules_server_spawn_idx on public.boss_schedules (game_server_id, next_spawn_at);
create index invites_server_expiry_idx on public.server_invites (game_server_id, expires_at) where revoked_at is null;

create or replace function public.set_l2m_boss_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger game_servers_updated_at before update on public.game_servers for each row execute function public.set_l2m_boss_updated_at();
create trigger boss_catalog_updated_at before update on public.boss_catalog for each row execute function public.set_l2m_boss_updated_at();
create trigger server_bosses_updated_at before update on public.server_bosses for each row execute function public.set_l2m_boss_updated_at();
create trigger memberships_updated_at before update on public.server_memberships for each row execute function public.set_l2m_boss_updated_at();
create trigger reports_updated_at before update on public.boss_reports for each row execute function public.set_l2m_boss_updated_at();
create trigger discord_sources_updated_at before update on public.discord_sources for each row execute function public.set_l2m_boss_updated_at();
create trigger push_devices_updated_at before update on public.push_devices for each row execute function public.set_l2m_boss_updated_at();

create or replace function public.is_active_l2m_boss_member(target_server uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.server_memberships m
    where m.game_server_id = target_server
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.is_l2m_boss_admin(target_server uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.server_memberships m
    where m.game_server_id = target_server
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin')
  );
$$;

-- The only client-side report mutation.  The caller cannot choose source,
-- acceptance, another user, or another server.
create or replace function public.submit_l2m_boss_report(
  target_server_boss uuid,
  occurred_at timestamptz,
  client_report_id uuid
)
returns public.boss_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  server_id uuid;
  inserted public.boss_reports;
begin
  select game_server_id into server_id
  from public.server_bosses
  where id = target_server_boss and is_enabled;

  if server_id is null or not public.is_active_l2m_boss_member(server_id) then
    raise exception 'not an active member of this game server' using errcode = '42501';
  end if;

  insert into public.boss_reports (
    game_server_id, server_boss_id, killed_at, submitted_by, input_source,
    source_dedupe_key, status
  ) values (
    server_id, target_server_boss, occurred_at, auth.uid(), 'app',
    encode(extensions.digest(auth.uid()::text || ':' || client_report_id::text, 'sha256'), 'hex'), 'pending'
  )
  on conflict (game_server_id, input_source, source_dedupe_key) do update
    set updated_at = public.boss_reports.updated_at
  returning * into inserted;

  return inserted;
end;
$$;

alter table public.game_servers enable row level security;
alter table public.boss_catalog enable row level security;
alter table public.server_bosses enable row level security;
alter table public.server_memberships enable row level security;
alter table public.server_invites enable row level security;
alter table public.boss_reports enable row level security;
alter table public.boss_schedules enable row level security;
alter table public.discord_sources enable row level security;
alter table public.push_devices enable row level security;

create policy game_servers_member_read on public.game_servers for select to authenticated using (public.is_active_l2m_boss_member(id));
create policy boss_catalog_authenticated_read on public.boss_catalog for select to authenticated using (true);
create policy server_bosses_member_read on public.server_bosses for select to authenticated using (public.is_active_l2m_boss_member(game_server_id));
create policy memberships_limited_read on public.server_memberships for select to authenticated using (user_id = auth.uid() or public.is_l2m_boss_admin(game_server_id));
create policy invites_admin_read on public.server_invites for select to authenticated using (public.is_l2m_boss_admin(game_server_id));
create policy reports_owner_or_admin_read on public.boss_reports for select to authenticated using (submitted_by = auth.uid() or public.is_l2m_boss_admin(game_server_id));
create policy schedules_member_read on public.boss_schedules for select to authenticated using (public.is_active_l2m_boss_member(game_server_id));
create policy discord_sources_admin_read on public.discord_sources for select to authenticated using (public.is_l2m_boss_admin(game_server_id));
create policy push_devices_owner_read on public.push_devices for select to authenticated using (user_id = auth.uid() and public.is_active_l2m_boss_member(game_server_id));

revoke all on public.game_servers, public.boss_catalog, public.server_bosses,
  public.server_memberships, public.server_invites, public.boss_reports,
  public.boss_schedules, public.discord_sources, public.push_devices from anon, authenticated;
grant select on public.game_servers, public.boss_catalog, public.server_bosses,
  public.server_memberships, public.server_invites, public.boss_reports,
  public.boss_schedules, public.discord_sources, public.push_devices to authenticated;
revoke all on function public.is_active_l2m_boss_member(uuid), public.is_l2m_boss_admin(uuid) from public;
grant execute on function public.is_active_l2m_boss_member(uuid), public.is_l2m_boss_admin(uuid) to authenticated;
revoke all on function public.submit_l2m_boss_report(uuid, timestamptz, uuid) from public;
grant execute on function public.submit_l2m_boss_report(uuid, timestamptz, uuid) to authenticated;

comment on table public.game_servers is 'The mandatory isolation boundary for every shared l2m-boss record.';
comment on table public.boss_reports is 'No Discord body, Discord display name, game character name, device id, or secret may be stored here.';
comment on table public.discord_sources is 'Provider routing hashes only. Bot credentials are managed outside Postgres.';
