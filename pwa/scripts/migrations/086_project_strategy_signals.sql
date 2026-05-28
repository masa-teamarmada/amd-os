-- 086_project_strategy_signals.sql
--
-- L2 ⑨ 経営ハイライト。
-- コックピットのMSリスト下に、経営上の重要方針・事業上の進捗・戦略転換・重要リスクを
-- 5生データ由来の短い根拠付きで表示する。
-- 全文は保存せず、source refs / snippet / hash だけを保持する。

CREATE TABLE IF NOT EXISTS project_strategy_signals (
  signal_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  ym                TEXT,
  scope_key         TEXT GENERATED ALWAYS AS (COALESCE(ym, 'global')) STORED,
  signal_date       DATE,
  signal_type       TEXT NOT NULL CHECK (
    signal_type IN (
      'management_decision',
      'business_progress',
      'strategic_pivot',
      'commercial_progress',
      'partnership',
      'funding',
      'ip_regulatory',
      'risk',
      'next_move'
    )
  ),
  title             TEXT NOT NULL,
  summary           TEXT NOT NULL,
  impact_level      TEXT NOT NULL DEFAULT 'medium' CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
  decision_state    TEXT NOT NULL DEFAULT 'observed' CHECK (decision_state IN ('observed', 'proposed', 'decided', 'executing', 'revised')),
  status            TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'confirmed', 'rejected', 'archived')),
  source_refs_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_hash       TEXT NOT NULL,
  confidence        NUMERIC NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  extraction_run_id TEXT,
  created_by        TEXT NOT NULL DEFAULT 'codex_automation',
  confirmed_by      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_strategy_signals_unique
  ON project_strategy_signals(project_id, scope_key, signal_type, source_hash);

CREATE INDEX IF NOT EXISTS idx_project_strategy_signals_project_status
  ON project_strategy_signals(project_id, status, signal_date DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_strategy_signals_type_status
  ON project_strategy_signals(signal_type, status, created_at DESC);

ALTER TABLE project_strategy_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pss_select_anon ON project_strategy_signals;
CREATE POLICY pss_select_anon ON project_strategy_signals
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS pss_insert_authenticated ON project_strategy_signals;
CREATE POLICY pss_insert_authenticated ON project_strategy_signals
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS pss_update_authenticated ON project_strategy_signals;
CREATE POLICY pss_update_authenticated ON project_strategy_signals
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pss_service_role_all ON project_strategy_signals;
CREATE POLICY pss_service_role_all ON project_strategy_signals
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON project_strategy_signals TO anon, authenticated;
GRANT INSERT, UPDATE ON project_strategy_signals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON project_strategy_signals TO service_role;

COMMENT ON TABLE project_strategy_signals IS
  'L2 ⑨ 経営ハイライト。PJ単位の重要方針、事業進捗、戦略転換、提携、資金調達、IP/規制、重要リスク、次の一手を根拠付きで保持する。';
COMMENT ON COLUMN project_strategy_signals.source_refs_json IS
  '根拠参照。source id / date / title / short snippet / url / hash のみ。メール全文・議事録全文・Slack全文は保存しない。';
