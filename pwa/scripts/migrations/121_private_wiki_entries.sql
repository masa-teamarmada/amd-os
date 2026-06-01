-- 121_private_wiki_entries.sql
--
-- Admin-only private relationship wiki.
-- This stores sensitive person notes for AMD internal operation only.
-- No seed data is inserted by this migration.

create table if not exists public.private_wiki_entries (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects(project_id) on delete set null,
  person_name text not null,
  person_kind text not null default 'external_collaborator'
    check (person_kind in ('amd_member','client','partner','vendor','investor','researcher','external_collaborator','other')),
  affiliation text,
  relationship_context text,
  tags text[] not null default '{}'::text[],
  memo_body text not null default '',
  source_kind text not null default 'manual'
    check (source_kind in ('manual','codex','slack','gmail','notion','drive','calendar','meeting','other')),
  source_ref text,
  source_excerpt text,
  confidence numeric(3,2) not null default 0.50
    check (confidence >= 0 and confidence <= 1),
  visibility text not null default 'admin_private'
    check (visibility in ('admin_private')),
  status text not null default 'active'
    check (status in ('active','needs_review','archived','deleted')),
  created_by text,
  updated_by text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_private_wiki_entries_project_status
  on public.private_wiki_entries(project_id, status, updated_at desc);
create index if not exists idx_private_wiki_entries_person_kind
  on public.private_wiki_entries(person_kind);
create index if not exists idx_private_wiki_entries_tags
  on public.private_wiki_entries using gin(tags);
create index if not exists idx_private_wiki_entries_source_kind
  on public.private_wiki_entries(source_kind);

alter table public.private_wiki_entries enable row level security;

create or replace function public.amd_os_current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and m.is_admin is true
  );
$$;

revoke all on function public.amd_os_current_user_is_admin() from public;
grant execute on function public.amd_os_current_user_is_admin() to authenticated;

revoke all on public.private_wiki_entries from anon;
grant select, insert, update, delete on public.private_wiki_entries to authenticated;
grant select, insert, update, delete on public.private_wiki_entries to service_role;

drop policy if exists private_wiki_entries_admin_select on public.private_wiki_entries;
create policy private_wiki_entries_admin_select
  on public.private_wiki_entries
  for select
  to authenticated
  using (public.amd_os_current_user_is_admin());

drop policy if exists private_wiki_entries_admin_insert on public.private_wiki_entries;
create policy private_wiki_entries_admin_insert
  on public.private_wiki_entries
  for insert
  to authenticated
  with check (public.amd_os_current_user_is_admin());

drop policy if exists private_wiki_entries_admin_update on public.private_wiki_entries;
create policy private_wiki_entries_admin_update
  on public.private_wiki_entries
  for update
  to authenticated
  using (public.amd_os_current_user_is_admin())
  with check (public.amd_os_current_user_is_admin());

drop policy if exists private_wiki_entries_admin_delete on public.private_wiki_entries;
create policy private_wiki_entries_admin_delete
  on public.private_wiki_entries
  for delete
  to authenticated
  using (public.amd_os_current_user_is_admin());

drop policy if exists private_wiki_entries_service_role_all on public.private_wiki_entries;
create policy private_wiki_entries_service_role_all
  on public.private_wiki_entries
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.private_wiki_entries is
  'Admin-only private wiki for person-level relationship notes. Do not expose to normal project cockpit, public pages, or external institution workspaces.';
comment on column public.private_wiki_entries.project_id is
  'Optional grouping project. Null means AMD-wide or not yet assigned.';
comment on column public.private_wiki_entries.source_excerpt is
  'Short evidence excerpt only. Do not store full emails, transcripts, or documents here.';
comment on column public.private_wiki_entries.visibility is
  'Fixed admin_private marker. RLS and route gates must keep this table admin-only.';
