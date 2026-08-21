-- 308_project_ip_ledger.sql
-- PJコックピット「知財」タブの正本台帳。
-- スコープはAMD自社知財だけでなく、その技術領域のIP全体マップ (before zero の定石):
--   own       = AMD / PJ会社が権利者または出願人
--   university= 大学・研究機関の基本特許 (ライセンス元候補)
--   joint     = 共同出願 (大学 × 企業 など)
--   blocking  = 他社の障害特許 (実施の自由度を下げる)
--   watch     = 直接の障害ではないが技術動向として追う出願
-- 外部API (特許庁 特許情報取得API / EPO OPS) からの同期結果もこの台帳へ入れる。

create table if not exists project_ip_assets (
  ip_asset_id text primary key,
  project_id text not null references projects(project_id) on delete cascade,
  relation text not null default 'own'
    check (relation in ('own', 'university', 'joint', 'blocking', 'watch')),
  ip_kind text not null default 'patent'
    check (ip_kind in ('patent', 'utility_model', 'design', 'trademark', 'trade_secret', 'know_how', 'copyright')),
  title text not null,
  abstract_text text,
  -- 出願先国・地域。JP / US / EP / WO / CN など。同一発明の他国出願は family_key で束ねる。
  jurisdiction text not null default 'JP',
  family_key text,
  application_number text,
  publication_number text,
  registration_number text,
  application_date date,
  publication_date date,
  registration_date date,
  expiry_date date,
  applicants text[] not null default array[]::text[],
  inventors text[] not null default array[]::text[],
  status text not null default 'unknown'
    check (status in ('idea', 'drafting', 'filed', 'published', 'under_examination',
                      'granted', 'rejected', 'withdrawn', 'expired', 'abandoned', 'unknown')),
  -- 特許マップの軸。tech_domain = 技術区分 (X軸)、claim_breadth = 権利範囲の広さ 1-5 (Y軸)。
  tech_domain text,
  ipc_codes text[] not null default array[]::text[],
  cpc_codes text[] not null default array[]::text[],
  claim_breadth smallint check (claim_breadth between 1 and 5),
  importance smallint not null default 3 check (importance between 1 and 5),
  -- blocking / watch のときだけ意味を持つ。自社実施への脅威度。
  threat_level text check (threat_level in ('none', 'low', 'medium', 'high')),
  confidentiality text not null default 'internal'
    check (confidentiality in ('public', 'internal', 'confidential')),
  note_md text,
  external_url text,
  source_kind text not null default 'manual'
    check (source_kind in ('manual', 'l2_extraction', 'jpo_api', 'epo_api')),
  external_sync_at timestamptz,
  external_raw jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 権利化・維持の期限。手続を落とすと権利が消えるため、通知の発火元にする。
create table if not exists project_ip_deadlines (
  ip_deadline_id text primary key,
  ip_asset_id text not null references project_ip_assets(ip_asset_id) on delete cascade,
  project_id text not null references projects(project_id) on delete cascade,
  deadline_kind text not null
    check (deadline_kind in ('examination_request', 'pct_national_phase', 'priority_claim',
                             'office_action_response', 'annuity', 'grace_period', 'other')),
  label text,
  due_on date not null,
  status text not null default 'open'
    check (status in ('open', 'done', 'waived', 'missed')),
  owner_member_id text,
  note text,
  source_kind text not null default 'manual'
    check (source_kind in ('manual', 'l2_extraction', 'jpo_api', 'epo_api')),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 権利の持ち分とライセンス条件。大学基本特許の実施許諾・不実施補償をここで持つ。
create table if not exists project_ip_rights (
  ip_right_id text primary key,
  ip_asset_id text not null references project_ip_assets(ip_asset_id) on delete cascade,
  holder_kind text not null
    check (holder_kind in ('amd', 'project_company', 'university', 'partner_company', 'inventor', 'other')),
  holder_name text not null,
  share_pct numeric check (share_pct >= 0 and share_pct <= 100),
  license_to_project text not null default 'none'
    check (license_to_project in ('none', 'negotiating', 'option', 'non_exclusive', 'exclusive')),
  license_agreement_status text not null default 'none'
    check (license_agreement_status in ('none', 'negotiating', 'drafted', 'executed', 'expired')),
  royalty_terms text,
  -- 不実施補償 (大学が自ら実施しない代わりに受け取る対価)。共同出願の交渉論点。
  non_practice_compensation text,
  contract_id uuid references contracts(contract_id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 経過ログ。手続の履歴と、外部API同期で拾った状態変化を時系列で残す。
create table if not exists project_ip_events (
  ip_event_id text primary key,
  ip_asset_id text not null references project_ip_assets(ip_asset_id) on delete cascade,
  project_id text not null references projects(project_id) on delete cascade,
  event_date date not null,
  event_kind text not null
    check (event_kind in ('filed', 'published', 'office_action', 'response', 'granted',
                          'rejected', 'appeal', 'assignment', 'license', 'annuity_paid',
                          'lapsed', 'opposition', 'search_report', 'note', 'other')),
  title text not null,
  detail text,
  source_kind text not null default 'manual'
    check (source_kind in ('manual', 'l2_extraction', 'jpo_api', 'epo_api')),
  external_raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_ip_assets_project
  on project_ip_assets(project_id, relation, importance desc, updated_at desc);
create index if not exists idx_project_ip_assets_family
  on project_ip_assets(family_key) where family_key is not null;
create unique index if not exists idx_project_ip_assets_appno
  on project_ip_assets(project_id, jurisdiction, application_number)
  where application_number is not null;
create index if not exists idx_project_ip_deadlines_due
  on project_ip_deadlines(project_id, status, due_on);
create index if not exists idx_project_ip_rights_asset
  on project_ip_rights(ip_asset_id, holder_kind);
create index if not exists idx_project_ip_events_asset
  on project_ip_events(ip_asset_id, event_date desc);

alter table project_ip_assets enable row level security;
alter table project_ip_deadlines enable row level security;
alter table project_ip_rights enable row level security;
alter table project_ip_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'project_ip_assets',
    'project_ip_deadlines',
    'project_ip_rights',
    'project_ip_events'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || '_member_read', t);
    execute format('drop policy if exists %I on %I', t || '_admin_all', t);
    execute format('drop policy if exists %I on %I', t || '_service_role', t);
    execute format('create policy %I on %I for select to authenticated using (amd_os_is_member())', t || '_member_read', t);
    execute format('create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())', t || '_admin_all', t);
    execute format('create policy %I on %I for all to service_role using (true) with check (true)', t || '_service_role', t);
  end loop;
end $$;

comment on table project_ip_assets is
  'PJの知財台帳。自社知財だけでなく大学基本特許・共同出願・他社障害特許まで含むIP全体マップ。relationで立場を分ける。';
comment on column project_ip_assets.claim_breadth is
  '権利範囲の広さ1-5。特許マップのY軸。5=上位概念で広い、1=実施例限定で狭い。';
comment on column project_ip_assets.tech_domain is
  '技術区分。特許マップのX軸で、PJごとに自由な語彙を使う (IPCへ機械的に潰さない)。';
comment on table project_ip_deadlines is
  '知財の手続期限。落とすと権利が消えるため、コックピットと通知の発火元にする。';
comment on column project_ip_rights.non_practice_compensation is
  '不実施補償の条件。大学が自ら実施しない代わりに受け取る対価で、共同出願の主要交渉論点。';
