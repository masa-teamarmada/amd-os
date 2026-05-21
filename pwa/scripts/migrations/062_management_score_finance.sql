-- 062: AMD Management Score finance foundation
--
-- GAS 月次収支シミュレーターを OS 側へ移植し、
-- freee 実績と突合して finance_score / 予実管理 UI に使うための保存先。

CREATE TABLE IF NOT EXISTS amd_management_score_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ym TEXT NOT NULL CHECK (ym ~ '^[0-9]{6}$'),
  total_score NUMERIC CHECK (total_score IS NULL OR (total_score >= 0 AND total_score <= 100)),
  initiative_score NUMERIC CHECK (initiative_score IS NULL OR (initiative_score >= 0 AND initiative_score <= 100)),
  finance_score NUMERIC CHECK (finance_score IS NULL OR (finance_score >= 0 AND finance_score <= 100)),
  retention_score NUMERIC CHECK (retention_score IS NULL OR (retention_score >= 0 AND retention_score <= 100)),
  pipeline_score NUMERIC CHECK (pipeline_score IS NULL OR (pipeline_score >= 0 AND pipeline_score <= 100)),
  direction_score NUMERIC CHECK (direction_score IS NULL OR (direction_score >= 0 AND direction_score <= 100)),
  weights_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  inputs_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_actions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  created_by TEXT NOT NULL DEFAULT 'automation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ym)
);

CREATE TABLE IF NOT EXISTS amd_management_score_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES amd_management_score_snapshots(id) ON DELETE CASCADE,
  ym TEXT NOT NULL CHECK (ym ~ '^[0-9]{6}$'),
  axis TEXT NOT NULL CHECK (axis IN ('initiative', 'finance', 'retention', 'pipeline', 'direction')),
  evidence_kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_type TEXT,
  source_ref TEXT,
  source_hash TEXT,
  impact NUMERIC NOT NULL DEFAULT 0 CHECK (impact >= -100 AND impact <= 100),
  confidence NUMERIC NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_budget_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_kind TEXT NOT NULL CHECK (input_kind IN ('params', 'project', 'project_revenue', 'fixed_cost', 'var_cost', 'loan', 'spot', 'scenario')),
  source_id TEXT,
  source_id_key TEXT GENERATED ALWAYS AS (COALESCE(source_id, '')) STORED,
  ym TEXT CHECK (ym IS NULL OR ym ~ '^[0-9]{6}$'),
  ym_key TEXT GENERATED ALWAYS AS (COALESCE(ym, 'global')) STORED,
  project_id TEXT NULL REFERENCES projects(project_id) ON DELETE SET NULL,
  project_key TEXT GENERATED ALWAYS AS (COALESCE(project_id, 'company')) STORED,
  label TEXT,
  amount_yen BIGINT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'gas_monthly_pl',
  version TEXT NOT NULL DEFAULT 'baseline',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS company_budget_inputs_unique_source
  ON company_budget_inputs(input_kind, source_id_key, ym_key, project_key, version);

CREATE TABLE IF NOT EXISTS company_budget_simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id TEXT,
  version TEXT NOT NULL DEFAULT 'baseline',
  source TEXT NOT NULL DEFAULT 'gas_monthly_pl',
  source_ref TEXT,
  engine_version TEXT,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_budget_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_run_id UUID REFERENCES company_budget_simulation_runs(id) ON DELETE SET NULL,
  ym TEXT NOT NULL CHECK (ym ~ '^[0-9]{6}$'),
  scope TEXT NOT NULL DEFAULT 'company' CHECK (scope IN ('company', 'project')),
  project_id TEXT NULL REFERENCES projects(project_id) ON DELETE SET NULL,
  project_key TEXT GENERATED ALWAYS AS (COALESCE(project_id, 'company')) STORED,
  category TEXT NOT NULL,
  account_name TEXT,
  account_key TEXT GENERATED ALWAYS AS (COALESCE(account_name, '')) STORED,
  budget_amount_yen BIGINT NOT NULL DEFAULT 0,
  cash_amount_yen BIGINT,
  runway_months NUMERIC,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'gas_monthly_pl',
  source_ref TEXT,
  version TEXT NOT NULL DEFAULT 'baseline',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS company_budget_monthly_unique_line
  ON company_budget_monthly(ym, scope, project_key, category, account_key, version);

CREATE TABLE IF NOT EXISTS company_actual_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ym TEXT NOT NULL CHECK (ym ~ '^[0-9]{6}$'),
  scope TEXT NOT NULL DEFAULT 'company' CHECK (scope IN ('company', 'project')),
  project_id TEXT NULL REFERENCES projects(project_id) ON DELETE SET NULL,
  project_key TEXT GENERATED ALWAYS AS (COALESCE(project_id, 'company')) STORED,
  category TEXT NOT NULL,
  account_name TEXT,
  account_key TEXT GENERATED ALWAYS AS (COALESCE(account_name, '')) STORED,
  actual_amount_yen BIGINT NOT NULL DEFAULT 0,
  freee_account_item_id TEXT,
  freee_partner_id TEXT,
  source_ref TEXT,
  raw_hash TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS company_actual_monthly_unique_line
  ON company_actual_monthly(ym, scope, project_key, category, account_key, COALESCE(freee_account_item_id, ''));

CREATE OR REPLACE VIEW company_budget_actual_monthly AS
SELECT
  COALESCE(b.ym, a.ym) AS ym,
  COALESCE(b.scope, a.scope) AS scope,
  COALESCE(b.project_id, a.project_id) AS project_id,
  COALESCE(b.category, a.category) AS category,
  COALESCE(b.account_name, a.account_name) AS account_name,
  COALESCE(b.budget_amount_yen, 0) AS budget_amount_yen,
  COALESCE(a.actual_amount_yen, 0) AS actual_amount_yen,
  COALESCE(a.actual_amount_yen, 0) - COALESCE(b.budget_amount_yen, 0) AS variance_yen,
  b.cash_amount_yen,
  b.runway_months,
  b.version AS budget_version,
  b.simulation_run_id,
  a.freee_account_item_id,
  a.freee_partner_id,
  b.payload AS budget_payload,
  a.payload AS actual_payload
FROM company_budget_monthly b
FULL OUTER JOIN company_actual_monthly a
  ON b.ym = a.ym
 AND b.scope = a.scope
 AND b.project_key = a.project_key
 AND b.category = a.category
 AND b.account_key = a.account_key;

CREATE TABLE IF NOT EXISTS company_budget_variance_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ym TEXT NOT NULL CHECK (ym ~ '^[0-9]{6}$'),
  project_id TEXT NULL REFERENCES projects(project_id) ON DELETE SET NULL,
  category TEXT,
  variance_kind TEXT NOT NULL CHECK (variance_kind IN (
    'revenue_shortfall',
    'cost_overrun',
    'payment_delay',
    'unbudgeted_revenue',
    'unbudgeted_expense',
    'timing_shift',
    'runway_change',
    'other'
  )),
  note TEXT NOT NULL,
  source_type TEXT,
  source_ref TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'confirmed', 'rejected', 'archived')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS amss_ym_idx ON amd_management_score_snapshots(ym DESC);
CREATE INDEX IF NOT EXISTS amse_ym_axis_idx ON amd_management_score_evidence(ym DESC, axis);
CREATE INDEX IF NOT EXISTS cbi_kind_version_idx ON company_budget_inputs(input_kind, version);
CREATE INDEX IF NOT EXISTS cbmr_ran_at_idx ON company_budget_simulation_runs(ran_at DESC);
CREATE INDEX IF NOT EXISTS cbm_ym_category_idx ON company_budget_monthly(ym DESC, category);
CREATE INDEX IF NOT EXISTS cam_ym_category_idx ON company_actual_monthly(ym DESC, category);
CREATE INDEX IF NOT EXISTS cbvn_ym_status_idx ON company_budget_variance_notes(ym DESC, status);

ALTER TABLE amd_management_score_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE amd_management_score_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_budget_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_budget_simulation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_budget_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_actual_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_budget_variance_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amss_select_anon ON amd_management_score_snapshots;
CREATE POLICY amss_select_anon ON amd_management_score_snapshots FOR SELECT USING (true);
DROP POLICY IF EXISTS amss_service_role_all ON amd_management_score_snapshots;
CREATE POLICY amss_service_role_all ON amd_management_score_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS amse_select_anon ON amd_management_score_evidence;
CREATE POLICY amse_select_anon ON amd_management_score_evidence FOR SELECT USING (true);
DROP POLICY IF EXISTS amse_service_role_all ON amd_management_score_evidence;
CREATE POLICY amse_service_role_all ON amd_management_score_evidence FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cbi_select_anon ON company_budget_inputs;
CREATE POLICY cbi_select_anon ON company_budget_inputs FOR SELECT USING (true);
DROP POLICY IF EXISTS cbi_service_role_all ON company_budget_inputs;
CREATE POLICY cbi_service_role_all ON company_budget_inputs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cbmr_select_anon ON company_budget_simulation_runs;
CREATE POLICY cbmr_select_anon ON company_budget_simulation_runs FOR SELECT USING (true);
DROP POLICY IF EXISTS cbmr_service_role_all ON company_budget_simulation_runs;
CREATE POLICY cbmr_service_role_all ON company_budget_simulation_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cbm_select_anon ON company_budget_monthly;
CREATE POLICY cbm_select_anon ON company_budget_monthly FOR SELECT USING (true);
DROP POLICY IF EXISTS cbm_service_role_all ON company_budget_monthly;
CREATE POLICY cbm_service_role_all ON company_budget_monthly FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cam_select_anon ON company_actual_monthly;
CREATE POLICY cam_select_anon ON company_actual_monthly FOR SELECT USING (true);
DROP POLICY IF EXISTS cam_service_role_all ON company_actual_monthly;
CREATE POLICY cam_service_role_all ON company_actual_monthly FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cbvn_select_anon ON company_budget_variance_notes;
CREATE POLICY cbvn_select_anon ON company_budget_variance_notes FOR SELECT USING (true);
DROP POLICY IF EXISTS cbvn_service_role_all ON company_budget_variance_notes;
CREATE POLICY cbvn_service_role_all ON company_budget_variance_notes FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON amd_management_score_snapshots TO anon, authenticated;
GRANT SELECT ON amd_management_score_evidence TO anon, authenticated;
GRANT SELECT ON company_budget_inputs TO anon, authenticated;
GRANT SELECT ON company_budget_simulation_runs TO anon, authenticated;
GRANT SELECT ON company_budget_monthly TO anon, authenticated;
GRANT SELECT ON company_actual_monthly TO anon, authenticated;
GRANT SELECT ON company_budget_actual_monthly TO anon, authenticated;
GRANT SELECT ON company_budget_variance_notes TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON amd_management_score_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON amd_management_score_evidence TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_budget_inputs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_budget_simulation_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_budget_monthly TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_actual_monthly TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_budget_variance_notes TO service_role;

COMMENT ON TABLE amd_management_score_snapshots IS
  'AMD会社全体の経営状況スコア snapshot。PJ/SU AMD Score とは別の会社全体スコア。';
COMMENT ON TABLE company_budget_inputs IS
  'GAS月次収支シミュレーターのCFG_*相当入力。予算/計画の編集・再計算に使う。';
COMMENT ON TABLE company_budget_simulation_runs IS
  'GAS runSimulation() 相当のOS側実行履歴。engine_version と params を保存する。';
COMMENT ON TABLE company_budget_monthly IS
  '予算/計画の月次計算結果。freee実績と company_budget_actual_monthly で突合する。';
COMMENT ON TABLE company_actual_monthly IS
  'freee API から正規化した月次実績。raw payload は payload / source_ref / raw_hash で辿る。';
COMMENT ON VIEW company_budget_actual_monthly IS
  '会社またはPJ単位の予算実績突合 view。finance_score と予実管理UIの主入力。';
COMMENT ON TABLE company_budget_variance_notes IS
  '予実差分理由・未反映予定・L2根拠の短いメモ。全文保存は禁止。';
