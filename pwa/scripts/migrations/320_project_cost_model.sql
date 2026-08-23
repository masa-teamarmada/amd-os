-- 320_project_cost_model.sql
-- PJコックピット / PJワークスペース「コスト試算」タブの正本 (2026-08-23 まさ確定)。
--
-- これまでの正本は Google Sheets (SX_コスト試算_260820)。
-- スプシのままだと「前提を1つ動かしたときに4シナリオがどう動くか」を
-- MTGの場で出せないため、変数と明細をAMD OS側へ移し、再計算をアプリで持つ。
--
-- 4テーブル:
--   project_cost_models      1試算 = 1行。★ケース (色素分解 / 重金属回収) を必ず持たせる。
--                            260820版はケース表記がないまま金属の式で色素を語れる状態だった。
--   project_cost_assumptions 変数辞書。role_key を計算エンジンが参照する。
--   project_cost_items       費用明細。price_rule で変数への連動を表す。
--   project_cost_questions   誰に何を聞けば確定するか。円/m³インパクト順。
--
-- visibility は行単位。既定 amd_internal。
-- 外部参画候補 (ダイキアクシス等) へ開くときに、開ける行だけ workspace_shared へ上げる。
-- 売価・利益率・単価内訳は既定で内部のまま置く (仕入先に値入れ構造を渡さないため)。

BEGIN;

create table if not exists project_cost_models (
  cost_model_id text primary key,
  project_id text not null references projects(project_id) on delete cascade,
  title text not null,
  -- ★ケースを構造として持つ。'unset' を許さない。
  case_kind text not null
    check (case_kind in ('dye_degradation', 'metal_recovery', 'other')),
  case_label text not null,
  version_label text,
  status text not null default 'active'
    check (status in ('draft', 'active', 'archived')),
  source_url text,
  source_note text,
  summary_md text,
  visibility text not null default 'amd_internal'
    check (visibility in ('amd_internal', 'workspace_shared')),
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_cost_models_project_idx
  on project_cost_models(project_id, status);

create table if not exists project_cost_assumptions (
  cost_assumption_id text primary key,
  cost_model_id text not null references project_cost_models(cost_model_id) on delete cascade,
  code text,
  group_label text not null,
  label text not null,
  value numeric,
  value_text text,
  unit text,
  -- S=確定値 / A=概算 (根拠のある見積) / H=仮説 (実験・見積で確かめる)
  confidence text check (confidence in ('S', 'A', 'H')),
  source_kind text
    check (source_kind in ('先生回答', '予測', '仮置き', '推定', '要検証', '実測', '出所不明')),
  owner text,
  is_key boolean not null default false,
  -- 計算エンジンが参照するキー。null なら表示のみ。
  role_key text,
  note text,
  visibility text not null default 'amd_internal'
    check (visibility in ('amd_internal', 'workspace_shared')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists project_cost_assumptions_role_key_uidx
  on project_cost_assumptions(cost_model_id, role_key) where role_key is not null;
create index if not exists project_cost_assumptions_model_idx
  on project_cost_assumptions(cost_model_id, sort_order);

create table if not exists project_cost_items (
  cost_item_id text primary key,
  cost_model_id text not null references project_cost_models(cost_model_id) on delete cascade,
  -- 共通 = どちらの方式でも発生 / 中央培養 = 全顧客共通の菌体製造拠点
  scenario text not null
    check (scenario in ('循環', '投入', '共通', '中央培養')),
  cost_type text not null check (cost_type in ('CAPEX', 'OPEX', '参考')),
  group_label text,
  mid_label text,
  leaf_label text,
  basis text not null
    check (basis in ('初期投資配賦', '毎m³比例', 'バッチ連動', '内訳')),
  quantity numeric not null default 1,
  quantity_unit text,
  unit_price numeric not null default 0,
  unit_price_unit text,
  -- 単価が変数へ連動する場合の規則。null = 単価をそのまま使う。
  --   biomass / broth        … 菌体量・培養液量の連動係数を掛ける (菌体使用回数の影響を受ける)
  --   module_swap            … モジュール単価 ÷ 耐用バッチ数 ÷ バッチ容量
  --   power_circulation/injection … 動力kW × HRT × 電力単価 ÷ バッチ容量
  price_rule text
    check (price_rule is null or price_rule in
      ('biomass', 'broth', 'module_swap', 'power_circulation', 'power_injection')),
  annual_factor numeric not null default 1,
  useful_life_years numeric,
  -- 親行の小計に含まれる内訳行。金額は集計しない。
  is_breakdown boolean not null default false,
  confidence text check (confidence in ('S', 'A', 'H')),
  source_kind text
    check (source_kind in ('先生回答', '予測', '仮置き', '推定', '要検証', '実測', '出所不明')),
  owner text,
  note text,
  visibility text not null default 'amd_internal'
    check (visibility in ('amd_internal', 'workspace_shared')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_cost_items_model_idx
  on project_cost_items(cost_model_id, sort_order);

create table if not exists project_cost_questions (
  cost_question_id text primary key,
  cost_model_id text not null references project_cost_models(cost_model_id) on delete cascade,
  addressee text not null,
  question text not null,
  why_it_matters text,
  -- 確定したときに動く幅 (円/m³)。会の時間配分をこの順で決める。
  impact_low numeric,
  impact_high numeric,
  status text not null default 'open'
    check (status in ('open', 'answered', 'dropped')),
  answer text,
  answered_on date,
  linked_assumption_id text references project_cost_assumptions(cost_assumption_id) on delete set null,
  visibility text not null default 'amd_internal'
    check (visibility in ('amd_internal', 'workspace_shared')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_cost_questions_model_idx
  on project_cost_questions(cost_model_id, status, sort_order);

alter table project_cost_models enable row level security;
alter table project_cost_assumptions enable row level security;
alter table project_cost_items enable row level security;
alter table project_cost_questions enable row level security;

-- 既存 project_ip_* と同じ形: read = ログイン済みAMDメンバー、write = admin、service_role は全権。
-- 外部 workspace_account はこのポリシーに一致しない。外部へ見せる面は
-- server component が service_role で読み、visibility='workspace_shared' の行だけを返す。
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['project_cost_models','project_cost_assumptions','project_cost_items','project_cost_questions']
  LOOP
    EXECUTE format('drop policy if exists %I on %I', t || '_member_read', t);
    EXECUTE format('drop policy if exists %I on %I', t || '_admin_all', t);
    EXECUTE format('drop policy if exists %I on %I', t || '_service_role', t);
    EXECUTE format('create policy %I on %I for select to authenticated using (amd_os_is_member())', t || '_member_read', t);
    EXECUTE format('create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())', t || '_admin_all', t);
    EXECUTE format('create policy %I on %I for all to service_role using (true) with check (true)', t || '_service_role', t);
  END LOOP;
END $$;

COMMIT;
