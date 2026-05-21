-- 063: AMD Management Score raw signal intake
--
-- スコア算出に必要な生データを、既存テーブルから月次 signal として集める保存先。
-- raw payload はここに保持し、score snapshot はこの signal を根拠として後段で計算する。

CREATE TABLE IF NOT EXISTS amd_management_score_source_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ym TEXT NOT NULL CHECK (ym ~ '^[0-9]{6}$'),
  source_kind TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS amd_management_score_raw_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES amd_management_score_source_runs(id) ON DELETE SET NULL,
  ym TEXT NOT NULL CHECK (ym ~ '^[0-9]{6}$'),
  axis TEXT NOT NULL CHECK (axis IN ('initiative', 'finance', 'retention', 'pipeline', 'direction')),
  source_kind TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  signal_key TEXT NOT NULL,
  signal_value_numeric NUMERIC,
  signal_value_text TEXT,
  project_id TEXT NULL REFERENCES projects(project_id) ON DELETE SET NULL,
  observed_at TIMESTAMPTZ,
  confidence NUMERIC NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  weight_hint NUMERIC NOT NULL DEFAULT 1 CHECK (weight_hint >= 0),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_hash TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ams_raw_signals_unique_source
  ON amd_management_score_raw_signals(ym, axis, source_table, source_id, signal_key);

CREATE INDEX IF NOT EXISTS ams_raw_signals_ym_axis_idx
  ON amd_management_score_raw_signals(ym DESC, axis);

CREATE INDEX IF NOT EXISTS ams_raw_signals_project_idx
  ON amd_management_score_raw_signals(project_id, ym DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ams_source_runs_ym_kind_idx
  ON amd_management_score_source_runs(ym DESC, source_kind, started_at DESC);

ALTER TABLE amd_management_score_source_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE amd_management_score_raw_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amssr_select_anon ON amd_management_score_source_runs;
CREATE POLICY amssr_select_anon ON amd_management_score_source_runs FOR SELECT USING (true);
DROP POLICY IF EXISTS amssr_service_role_all ON amd_management_score_source_runs;
CREATE POLICY amssr_service_role_all ON amd_management_score_source_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS amsrs_select_anon ON amd_management_score_raw_signals;
CREATE POLICY amsrs_select_anon ON amd_management_score_raw_signals FOR SELECT USING (true);
DROP POLICY IF EXISTS amsrs_service_role_all ON amd_management_score_raw_signals;
CREATE POLICY amsrs_service_role_all ON amd_management_score_raw_signals FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON amd_management_score_source_runs TO anon, authenticated;
GRANT SELECT ON amd_management_score_raw_signals TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON amd_management_score_source_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON amd_management_score_raw_signals TO service_role;

COMMENT ON TABLE amd_management_score_source_runs IS
  'AMD Management Score の raw data intake 実行ログ。freee / OS internal など source 単位で記録する。';
COMMENT ON TABLE amd_management_score_raw_signals IS
  'AMD Management Score 算出前の月次 raw signal。各軸の入力データを source ref / payload 付きで保存する。';
