-- 282_institution_regulation_ledger.sql
-- SU関連規程を、全研究機関の比較表と研究機関コックピットで共用する正本台帳。

create table if not exists institution_regulation_types (
  regulation_type_id text primary key,
  group_key text not null check (group_key in ('core', 'supporting')),
  label text not null,
  short_label text not null,
  description text,
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists institution_regulations (
  regulation_id text primary key,
  institution_id text not null references institutions(institution_id) on delete cascade,
  title text not null,
  stage smallint not null default 0 check (stage between 0 and 4),
  lifecycle_state text not null default 'drafting'
    check (lifecycle_state in ('drafting', 'review', 'approved', 'effective', 'superseded')),
  current_state_note text,
  next_gate text,
  next_gate_timing text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists institution_regulation_cells (
  institution_id text not null references institutions(institution_id) on delete cascade,
  regulation_type_id text not null references institution_regulation_types(regulation_type_id) on delete cascade,
  regulation_id text references institution_regulations(regulation_id) on delete set null,
  state text not null default 'unconfirmed'
    check (state in ('unconfirmed', 'not_established', 'drafting', 'review', 'approved', 'effective', 'not_applicable')),
  confirmed_at date,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (institution_id, regulation_type_id),
  check (regulation_id is not null or state in ('unconfirmed', 'not_established', 'not_applicable'))
);

create table if not exists institution_regulation_versions (
  version_id text primary key,
  regulation_id text not null references institution_regulations(regulation_id) on delete cascade,
  label text not null,
  file_name text,
  version_state text not null default 'draft'
    check (version_state in ('reference', 'draft', 'review', 'approved', 'effective', 'superseded')),
  external_url text,
  version_date date,
  is_current boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_institution_regulations_institution
  on institution_regulations(institution_id, updated_at desc);
create index if not exists idx_institution_regulation_cells_type
  on institution_regulation_cells(regulation_type_id, state);
create index if not exists idx_institution_regulation_versions_regulation
  on institution_regulation_versions(regulation_id, is_current desc, version_date desc, created_at desc);
create unique index if not exists idx_institution_regulation_versions_one_current
  on institution_regulation_versions(regulation_id) where is_current;

create or replace function institution_regulation_keep_one_current_version()
returns trigger
language plpgsql
as $$
begin
  if new.is_current then
    update institution_regulation_versions
       set is_current = false, updated_at = now()
     where regulation_id = new.regulation_id
       and version_id <> new.version_id
       and is_current;
  end if;
  return new;
end;
$$;

drop trigger if exists institution_regulation_one_current_version on institution_regulation_versions;
create trigger institution_regulation_one_current_version
before insert or update of is_current on institution_regulation_versions
for each row execute function institution_regulation_keep_one_current_version();

alter table institution_regulation_types enable row level security;
alter table institution_regulations enable row level security;
alter table institution_regulation_cells enable row level security;
alter table institution_regulation_versions enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'institution_regulation_types',
    'institution_regulations',
    'institution_regulation_cells',
    'institution_regulation_versions'
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

insert into institution_regulation_types
  (regulation_type_id, group_key, label, short_label, description, sort_order)
values
  ('recognition', 'core', '大学発スタートアップ認定規程', '認定', '認定要件、審査、称号、更新、取消を定める規程。', 101),
  ('conflict_of_interest', 'core', '利益相反マネジメント規程', '利益相反', '役員就任、株式保有、共同研究等の利益相反管理。', 102),
  ('side_job', 'core', '大学発SUとの兼業規程', '兼業', '教職員の役員兼業、休職兼業、勤務時間等の扱い。', 103),
  ('ip_license', 'core', '知財取扱・大学発SUライセンス規程', '知財・ライセンス', '知財帰属、実施許諾、譲渡、優遇条件等。', 104),
  ('equity_stock_option', 'core', '大学発SUへの出資・新株予約権規程', '出資・SO', '株式・新株予約権の取得、評価、保有、処分等。', 105),
  ('joint_research', 'core', '大学発SUとの共同研究規程', '共同研究', '大学発SUとの共同研究条件、契約、責任分界等。', 106),
  ('shared_equipment', 'core', '大学発SUの共有機器利用規程', '共有機器', '設備利用、料金、安全、事故時責任等。', 107),
  ('recognition_committee', 'supporting', '認定委員会内規', '認定委員会', '委員構成、審議、議決、利益相反回避等。', 201),
  ('support_rules', 'supporting', '大学発スタートアップ支援細則', '支援細則', '認定後の支援申請、審査、期間、条件等。', 202),
  ('review_checksheet', 'supporting', '認定審査チェックシート', '審査様式', '認定審査の観点と記録様式。', 203)
on conflict (regulation_type_id) do update set
  group_key = excluded.group_key,
  label = excluded.label,
  short_label = excluded.short_label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into institution_regulations
  (regulation_id, institution_id, title, stage, lifecycle_state, current_state_note, next_gate, next_gate_timing, updated_by)
values
  ('reg_kute_recognition', 'inst_kute', '大学発スタートアップ認定規程', 4, 'review', '確定版あり・メール審議中', 'メール審議の決裁結果を反映', '大学側日程 未確定', 'migration:282'),
  ('reg_kute_coi', 'inst_kute', '利益相反マネジメント規程', 1, 'effective', '現行原典を回収済み', '大学発SU対応の差分を整理', '8月 素案', 'migration:282'),
  ('reg_kute_side_job', 'inst_kute', '大学発SUとの兼業規程', 0, 'drafting', '対象のみ確定・AMD原案なし', '兼業許可と利益相反接続の原案を起案', '8月 素案', 'migration:282'),
  ('reg_kute_ip', 'inst_kute', '知財取扱・大学発SUライセンス規程', 0, 'effective', '既存規程あり・原典未回収', '知財規程とライセンス雛形を回収', '8月 素案', 'migration:282'),
  ('reg_kute_equity', 'inst_kute', '大学発SUへの出資・新株予約権規程', 0, 'drafting', '対象のみ確定・AMD原案なし', '取得・評価・決裁の原案を起案', '8月 素案', 'migration:282'),
  ('reg_kute_joint_research', 'inst_kute', '大学発SUとの共同研究規程', 0, 'effective', '既存規程あり・原典未回収', '共同研究規程と契約雛形を回収', '8月 素案', 'migration:282'),
  ('reg_kute_equipment', 'inst_kute', '大学発SUの共有機器利用規程', 0, 'drafting', '対象のみ確定・AMD原案なし', '設備・料金・安全・責任分界の原案を起案', '8月 素案', 'migration:282'),
  ('reg_kute_committee', 'inst_kute', '認定委員会内規', 4, 'review', '8/7修正版あり・メール審議中', 'メール審議の決裁結果を反映', '大学側日程 未確定', 'migration:282'),
  ('reg_kute_support', 'inst_kute', '大学発スタートアップ支援細則', 2, 'drafting', '6/22案あり・適用範囲を再設計中', '認定規程との役割分担を確定', '9/4 修正案・進捗確認', 'migration:282'),
  ('reg_kute_checksheet', 'inst_kute', '認定審査チェックシート', 3, 'review', '7/17版あり・内規との最終整合', '内規決裁を反映して確定', '9/4 修正案・進捗確認', 'migration:282'),
  ('reg_ehime_recognition', 'inst_ehime', '国立大学法人愛媛大学における大学発ベンチャーの認定に関する規程', 4, 'effective', '公式現行規程を確認済み', null, null, 'migration:282'),
  ('reg_ehime_ip', 'inst_ehime', '国立大学法人愛媛大学知的財産に関する基本方針', 4, 'effective', '公式現行文書を確認済み', null, null, 'migration:282'),
  ('reg_kagawa_recognition', 'inst_kagawa', '国立大学法人香川大学における大学発ベンチャーの認定に関する規則', 4, 'effective', '公式現行規則を確認済み', null, null, 'migration:282'),
  ('reg_nims_venture_support', 'inst_nims', 'NIMSベンチャー援助等規程', 4, 'effective', '公式現行規程を確認済み', null, null, 'migration:282')
on conflict (regulation_id) do update set
  title = excluded.title,
  stage = excluded.stage,
  lifecycle_state = excluded.lifecycle_state,
  current_state_note = excluded.current_state_note,
  next_gate = excluded.next_gate,
  next_gate_timing = excluded.next_gate_timing,
  updated_at = now(),
  updated_by = excluded.updated_by;

insert into institution_regulation_cells
  (institution_id, regulation_type_id, regulation_id, state, confirmed_at, updated_by)
values
  ('inst_kute', 'recognition', 'reg_kute_recognition', 'review', '2026-08-17', 'migration:282'),
  ('inst_kute', 'conflict_of_interest', 'reg_kute_coi', 'effective', '2026-08-17', 'migration:282'),
  ('inst_kute', 'side_job', 'reg_kute_side_job', 'drafting', '2026-08-17', 'migration:282'),
  ('inst_kute', 'ip_license', 'reg_kute_ip', 'effective', '2026-08-17', 'migration:282'),
  ('inst_kute', 'equity_stock_option', 'reg_kute_equity', 'drafting', '2026-08-17', 'migration:282'),
  ('inst_kute', 'joint_research', 'reg_kute_joint_research', 'effective', '2026-08-17', 'migration:282'),
  ('inst_kute', 'shared_equipment', 'reg_kute_equipment', 'drafting', '2026-08-17', 'migration:282'),
  ('inst_kute', 'recognition_committee', 'reg_kute_committee', 'review', '2026-08-17', 'migration:282'),
  ('inst_kute', 'support_rules', 'reg_kute_support', 'drafting', '2026-08-17', 'migration:282'),
  ('inst_kute', 'review_checksheet', 'reg_kute_checksheet', 'review', '2026-08-17', 'migration:282'),
  ('inst_ehime', 'recognition', 'reg_ehime_recognition', 'effective', '2026-08-17', 'migration:282'),
  ('inst_ehime', 'shared_equipment', 'reg_ehime_recognition', 'effective', '2026-08-17', 'migration:282'),
  ('inst_ehime', 'ip_license', 'reg_ehime_ip', 'effective', '2026-08-17', 'migration:282'),
  ('inst_kagawa', 'recognition', 'reg_kagawa_recognition', 'effective', '2026-08-17', 'migration:282'),
  ('inst_nims', 'recognition', 'reg_nims_venture_support', 'effective', '2026-08-17', 'migration:282'),
  ('inst_nims', 'ip_license', 'reg_nims_venture_support', 'effective', '2026-08-17', 'migration:282'),
  ('inst_nims', 'equity_stock_option', 'reg_nims_venture_support', 'effective', '2026-08-17', 'migration:282'),
  ('inst_nims', 'shared_equipment', 'reg_nims_venture_support', 'effective', '2026-08-17', 'migration:282'),
  ('inst_nims', 'support_rules', 'reg_nims_venture_support', 'effective', '2026-08-17', 'migration:282')
on conflict (institution_id, regulation_type_id) do update set
  regulation_id = excluded.regulation_id,
  state = excluded.state,
  confirmed_at = excluded.confirmed_at,
  updated_by = excluded.updated_by,
  updated_at = now();

insert into institution_regulation_versions
  (version_id, regulation_id, label, file_name, version_state, external_url, version_date, is_current, created_by)
values
  ('regver_kute_recognition_20260624', 'reg_kute_recognition', '確定版 06/24', '大学発スタートアップ認定に関する規程_確定版_20260624.docx', 'review', 'https://docs.google.com/document/d/1tmEEzxEfe3MOkYEuBH_4-zo71TTgBM3L/edit?usp=drivesdk', '2026-06-24', true, 'migration:282'),
  ('regver_kute_recognition_20260622', 'reg_kute_recognition', '06/22', '大学発ベンチャーの認定に関する規程_修正案_260622.docx', 'superseded', 'https://docs.google.com/document/d/1XizS-_vBDDGY5aW364UoVdg_90br3-Oj/edit?usp=drivesdk', '2026-06-22', false, 'migration:282'),
  ('regver_kute_recognition_20260610', 'reg_kute_recognition', '06/10', '大学発ベンチャーの認定に関する規程_修正案_260610.docx', 'superseded', 'https://docs.google.com/document/d/1is56V6w-pHB052KgX16Uu5EYXPFQU0RM/edit?usp=drivesdk', '2026-06-10', false, 'migration:282'),
  ('regver_kute_coi_current', 'reg_kute_coi', '現行管理規程', '工学院大学利益相反管理規程_現行原典.pdf', 'effective', 'https://drive.google.com/file/d/13P_pNuchrpf0uVE4eYIbuQw18ADdDfKj/view?usp=drivesdk', null, true, 'migration:282'),
  ('regver_kute_coi_policy', 'reg_kute_coi', 'ポリシー', '工学院大学利益相反マネジメントポリシー_現行原典.pdf', 'reference', 'https://drive.google.com/file/d/103oaDDmUxPjNjiOffTvpj0QT1zv8Mneo/view?usp=drivesdk', null, false, 'migration:282'),
  ('regver_kute_committee_20260807', 'reg_kute_committee', 'Fixver 08/07', '工学院大学発スタートアップ認定委員会内規_Fixver_20260807.docx', 'review', 'https://docs.google.com/document/d/1kCXuwVGk5Gi68uHHQAFvjp6eB77zoUtE/edit?usp=drivesdk', '2026-08-07', true, 'migration:282'),
  ('regver_kute_committee_20260722', 'reg_kute_committee', '07/22', '工学院大学大学発ベンチャー認定員会内規20260722_yf.docx', 'superseded', 'https://docs.google.com/document/d/1-mEVJS_lAKC-22kAPAB_O6vXctczwtJh/edit?usp=drivesdk', '2026-07-22', false, 'migration:282'),
  ('regver_kute_committee_20260717', 'reg_kute_committee', '07/17', '工学院大学大学発ベンチャー認定員会内規20260717_yf.docx', 'superseded', 'https://docs.google.com/document/d/15aKaTfE6FvaAwsnpItY2K2PC6gI4zXPU/edit?usp=drivesdk', '2026-07-17', false, 'migration:282'),
  ('regver_kute_committee_20260622', 'reg_kute_committee', '06/22', '工学院大学大学発ベンチャー認定員会細則20260622.docx', 'superseded', 'https://docs.google.com/document/d/1d7pirKz4gibJ4Zt1912mCyfn8oIcw0N0/edit?usp=drivesdk', '2026-06-22', false, 'migration:282'),
  ('regver_kute_committee_20260611', 'reg_kute_committee', '06/11', '工学院大学大学発ベンチャー認定員会細則20260611.docx', 'superseded', 'https://docs.google.com/document/d/1tHwFhEz-oMsQsfzqIC83z8KdAEHQN0yY/edit?usp=drivesdk', '2026-06-11', false, 'migration:282'),
  ('regver_kute_support_20260622', 'reg_kute_support', '06/22', '工学院大学発ベンチャー支援細則20260622.docx', 'draft', 'https://docs.google.com/document/d/1bRaGWaR7vpW1cZ5xFbi26udUPbdRaj-V/edit?usp=drivesdk', '2026-06-22', true, 'migration:282'),
  ('regver_kute_support_20260611', 'reg_kute_support', '06/11', '工学院大学発ベンチャー支援細則20260611.docx', 'superseded', 'https://docs.google.com/document/d/1lGQ7ASemn6tZ9TQSsiNH8ihnc0vlKWew/edit?usp=drivesdk', '2026-06-11', false, 'migration:282'),
  ('regver_kute_checksheet_20260717', 'reg_kute_checksheet', '07/17', '認定審査委員会_参考用_チェックシート20260717yf.docx', 'review', 'https://docs.google.com/document/d/1uzD9ORkTrNxCPc68J1ovhL3j_pVqrso_/edit?usp=drivesdk', '2026-07-17', true, 'migration:282'),
  ('regver_ehime_recognition_current', 'reg_ehime_recognition', '現行規程', '国立大学法人愛媛大学における大学発ベンチャーの認定に関する規程.pdf', 'effective', 'https://kiteisv.office.ehime-u.ac.jp/愛媛大学規則集/第０４編　社会連携/第０１章　社会連携/07-2◎国立大学法人愛媛大学における大学発ベンチャーの認定に関する規程.pdf', null, true, 'migration:282'),
  ('regver_ehime_ip_current', 'reg_ehime_ip', '現行基本方針', '国立大学法人愛媛大学知的財産に関する基本方針.pdf', 'effective', 'https://kiteisv.office.ehime-u.ac.jp/愛媛大学規則集/第０４編　社会連携/第０２章　知的財産/01◎国立大学法人愛媛大学知的財産に関する基本方針.PDF', null, true, 'migration:282'),
  ('regver_kagawa_recognition_current', 'reg_kagawa_recognition', '現行規則', '国立大学法人香川大学における大学発ベンチャーの認定に関する規則.pdf', 'effective', 'https://www.kagawa-u.ac.jp/files/7216/2320/1207/210601_.pdf', null, true, 'migration:282'),
  ('regver_nims_venture_current', 'reg_nims_venture_support', '現行規程', 'NIMSベンチャー援助等規程.pdf', 'effective', 'https://www.nims.go.jp/nims/disclosure/qqllln0000005rhz-att/qqllln0000005sro.pdf', null, true, 'migration:282')
on conflict (version_id) do update set
  label = excluded.label,
  file_name = excluded.file_name,
  version_state = excluded.version_state,
  external_url = excluded.external_url,
  version_date = excluded.version_date,
  is_current = excluded.is_current,
  updated_at = now();
