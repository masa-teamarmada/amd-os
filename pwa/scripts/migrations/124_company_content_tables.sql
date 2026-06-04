-- 124_company_content_tables.sql
--
-- Company content landing tables for Notion member/history/photo migration.
-- This migration intentionally inserts no seed data and stores no raw Notion
-- body or file URLs. Imports must land as imported/needs_review until an admin
-- reviewer clears visibility, review, usage, and consent gates.

create table if not exists public.company_profile_entries (
  entry_id uuid primary key default gen_random_uuid(),
  entry_key text not null unique,
  title text not null,
  body_md text not null default '',
  visibility text not null default 'admin_only'
    check (visibility in ('public_candidate','internal','admin_only','private','archived')),
  status text not null default 'imported'
    check (status in ('imported','needs_review','approved_internal','approved_public','archived','rejected')),
  source_confidence numeric(3,2) not null default 0.50
    check (source_confidence >= 0 and source_confidence <= 1),
  source_kind text not null default 'manual'
    check (source_kind in ('manual','codex','notion','drive','slack','gmail','calendar','meeting','import','other')),
  source_ref text,
  tags text[] not null default '{}'::text[],
  notion_source_id text,
  notion_source_url text,
  notion_last_synced_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_profiles (
  member_profile_id uuid primary key default gen_random_uuid(),
  member_id text not null references public.members(member_id) on delete cascade,
  display_name text not null,
  public_title text,
  internal_title text,
  bio_short text,
  bio_long text,
  expertise_tags text[] not null default '{}'::text[],
  visibility text not null default 'admin_only'
    check (visibility in ('public_candidate','internal','admin_only','private','archived')),
  status text not null default 'imported'
    check (status in ('imported','needs_review','approved_internal','approved_public','archived','rejected')),
  source_confidence numeric(3,2) not null default 0.50
    check (source_confidence >= 0 and source_confidence <= 1),
  source_kind text not null default 'manual'
    check (source_kind in ('manual','codex','notion','drive','slack','gmail','calendar','meeting','import','other')),
  source_ref text,
  tags text[] not null default '{}'::text[],
  photo_asset_id uuid,
  notion_source_id text,
  notion_source_url text,
  notion_last_synced_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id)
);

create table if not exists public.company_history_events (
  event_id uuid primary key default gen_random_uuid(),
  occurred_on date,
  title text not null,
  summary text,
  event_type text not null default 'company'
    check (event_type in ('company','project','award','media','funding','product','legal','people','other')),
  project_id text references public.projects(project_id) on delete set null,
  member_ids text[] not null default '{}'::text[],
  importance text not null default 'medium'
    check (importance in ('low','medium','high','milestone')),
  visibility text not null default 'admin_only'
    check (visibility in ('public_candidate','internal','admin_only','private','archived')),
  status text not null default 'imported'
    check (status in ('imported','needs_review','approved_internal','approved_public','archived','rejected')),
  source_confidence numeric(3,2) not null default 0.50
    check (source_confidence >= 0 and source_confidence <= 1),
  tags text[] not null default '{}'::text[],
  source_kind text not null default 'manual'
    check (source_kind in ('manual','codex','notion','drive','slack','gmail','calendar','meeting','import','other')),
  source_ref text,
  notion_source_id text,
  notion_source_url text,
  notion_last_synced_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  asset_id uuid primary key default gen_random_uuid(),
  title text not null,
  asset_kind text not null default 'photo'
    check (asset_kind in ('photo','logo','slide','document','video','other')),
  storage_bucket text,
  storage_path text,
  thumbnail_path text,
  captured_at date,
  photographer text,
  location_label text,
  project_ids text[] not null default '{}'::text[],
  member_ids text[] not null default '{}'::text[],
  event_id uuid references public.company_history_events(event_id) on delete set null,
  tags text[] not null default '{}'::text[],
  visibility text not null default 'admin_only'
    check (visibility in ('public_candidate','internal','admin_only','private','archived')),
  status text not null default 'needs_review'
    check (status in ('imported','needs_review','approved_internal','approved_public','archived','rejected')),
  source_confidence numeric(3,2) not null default 0.50
    check (source_confidence >= 0 and source_confidence <= 1),
  usage_permission text not null default 'unknown'
    check (usage_permission in ('unknown','internal_ok','public_ok','restricted','expired')),
  consent_status text not null default 'unknown'
    check (consent_status in ('unknown','not_needed','pending','granted','denied')),
  source_kind text not null default 'manual'
    check (source_kind in ('manual','codex','notion','drive','slack','gmail','calendar','meeting','import','other')),
  source_ref text,
  notion_source_id text,
  notion_source_url text,
  notion_last_synced_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'member_profiles_photo_asset_fk'
  ) then
    alter table public.member_profiles
      add constraint member_profiles_photo_asset_fk
      foreign key (photo_asset_id) references public.media_assets(asset_id) on delete set null;
  end if;
end $$;

create index if not exists idx_company_profile_entries_status
  on public.company_profile_entries(visibility, status, updated_at desc);
create index if not exists idx_company_profile_entries_tags
  on public.company_profile_entries using gin(tags);

create index if not exists idx_member_profiles_status
  on public.member_profiles(visibility, status, display_name);
create index if not exists idx_member_profiles_tags
  on public.member_profiles using gin(tags);

create index if not exists idx_company_history_events_date
  on public.company_history_events(occurred_on desc nulls last, importance);
create index if not exists idx_company_history_events_project
  on public.company_history_events(project_id, occurred_on desc nulls last);
create index if not exists idx_company_history_events_member_ids
  on public.company_history_events using gin(member_ids);
create index if not exists idx_company_history_events_tags
  on public.company_history_events using gin(tags);

create index if not exists idx_media_assets_status
  on public.media_assets(visibility, status, usage_permission, consent_status, captured_at desc nulls last);
create index if not exists idx_media_assets_project_ids
  on public.media_assets using gin(project_ids);
create index if not exists idx_media_assets_member_ids
  on public.media_assets using gin(member_ids);
create index if not exists idx_media_assets_tags
  on public.media_assets using gin(tags);

alter table public.company_profile_entries enable row level security;
alter table public.member_profiles enable row level security;
alter table public.company_history_events enable row level security;
alter table public.media_assets enable row level security;

revoke all on public.company_profile_entries from anon;
revoke all on public.member_profiles from anon;
revoke all on public.company_history_events from anon;
revoke all on public.media_assets from anon;

grant select on public.company_profile_entries to authenticated;
grant select on public.member_profiles to authenticated;
grant select on public.company_history_events to authenticated;
grant select on public.media_assets to authenticated;

grant select, insert, update, delete on public.company_profile_entries to service_role;
grant select, insert, update, delete on public.member_profiles to service_role;
grant select, insert, update, delete on public.company_history_events to service_role;
grant select, insert, update, delete on public.media_assets to service_role;

drop policy if exists company_profile_entries_auth_read on public.company_profile_entries;
create policy company_profile_entries_auth_read
  on public.company_profile_entries
  for select
  to authenticated
  using (
    (
      visibility in ('internal','public_candidate')
      and status in ('approved_internal','approved_public')
      and reviewed_by is not null
      and reviewed_at is not null
    )
    or public.amd_os_current_user_is_admin()
  );

drop policy if exists member_profiles_auth_read on public.member_profiles;
create policy member_profiles_auth_read
  on public.member_profiles
  for select
  to authenticated
  using (
    (
      visibility in ('internal','public_candidate')
      and status in ('approved_internal','approved_public')
      and reviewed_by is not null
      and reviewed_at is not null
    )
    or public.amd_os_current_user_is_admin()
  );

drop policy if exists company_history_events_auth_read on public.company_history_events;
create policy company_history_events_auth_read
  on public.company_history_events
  for select
  to authenticated
  using (
    (
      visibility in ('internal','public_candidate')
      and status in ('approved_internal','approved_public')
      and reviewed_by is not null
      and reviewed_at is not null
    )
    or public.amd_os_current_user_is_admin()
  );

drop policy if exists media_assets_auth_read on public.media_assets;
create policy media_assets_auth_read
  on public.media_assets
  for select
  to authenticated
  using (
    (
      visibility in ('internal','public_candidate')
      and status in ('approved_internal','approved_public')
      and usage_permission in ('internal_ok','public_ok')
      and consent_status in ('granted','not_needed')
      and reviewed_by is not null
      and reviewed_at is not null
    )
    or public.amd_os_current_user_is_admin()
  );

drop policy if exists company_profile_entries_service_role_all on public.company_profile_entries;
create policy company_profile_entries_service_role_all
  on public.company_profile_entries
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists member_profiles_service_role_all on public.member_profiles;
create policy member_profiles_service_role_all
  on public.member_profiles
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists company_history_events_service_role_all on public.company_history_events;
create policy company_history_events_service_role_all
  on public.company_history_events
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists media_assets_service_role_all on public.media_assets;
create policy media_assets_service_role_all
  on public.media_assets
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.company_profile_entries is
  'Company profile and boilerplate entries imported from reviewed sources. No raw Notion body or private wiki content should be copied blindly.';
comment on table public.member_profiles is
  'AMD member display profiles for company content. Contract, payout, login, address, and bank data stay in members.';
comment on table public.company_history_events is
  'Company-wide timeline events. PJ-specific operational events may remain in project_events.';
comment on table public.media_assets is
  'Company media/photo metadata with storage and permission gates. Do not store expiring Notion file URLs as public assets.';
