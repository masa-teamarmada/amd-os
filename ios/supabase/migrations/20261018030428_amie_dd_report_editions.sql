-- DD資料の正本。閲覧・出力は既存のパッケージ認可を毎回検証するサーバ経由。
create table public.dd_report_editions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.dd_packages(id),
  title text not null,
  source_version text not null,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  summary jsonb not null default '{}'::jsonb,
  model_storage_path text not null,
  xlsx_storage_path text not null,
  legacy_snapshot_path text,
  input_overrides jsonb not null default '{}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(package_id,source_sha256)
);
create index dd_report_editions_package_idx on public.dd_report_editions(package_id,created_at desc);
create unique index dd_report_editions_published_idx on public.dd_report_editions(package_id) where status='published';
create table public.dd_report_chapters (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.dd_report_editions(id),
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  group_label text not null,
  sort_order integer not null,
  source_sheet text not null,
  body jsonb not null,
  revision integer not null default 1 check(revision > 0),
  updated_at timestamptz not null default now(),
  unique(edition_id,slug)
);
create index dd_report_chapters_edition_idx on public.dd_report_chapters(edition_id,sort_order);
create table public.dd_report_assets (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.dd_report_editions(id),
  asset_key text not null,
  storage_path text not null,
  mime_type text not null,
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes bigint not null check(size_bytes > 0),
  unique(edition_id,asset_key)
);
create table public.dd_report_changes (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.dd_report_editions(id),
  chapter_id uuid references public.dd_report_chapters(id),
  actor_member_id text not null,
  change_kind text not null check(change_kind in ('chapter','inputs','publication')),
  before_value jsonb not null,
  after_value jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.dd_report_editions enable row level security;
alter table public.dd_report_chapters enable row level security;
alter table public.dd_report_assets enable row level security;
alter table public.dd_report_changes enable row level security;
revoke all on public.dd_report_editions,public.dd_report_chapters,public.dd_report_assets,public.dd_report_changes from anon,authenticated;
grant all on public.dd_report_editions,public.dd_report_chapters,public.dd_report_assets,public.dd_report_changes to service_role;
insert into storage.buckets(id,name,public,file_size_limit)
values('dd-report-files','dd-report-files',false,52428800)
on conflict(id) do nothing;
