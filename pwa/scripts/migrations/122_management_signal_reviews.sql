-- 122: Management monthly signal reviews
--
-- 月次試算表の予算/実績/差分から、月末Codex評価で作る経営判断メモを保存する。
-- company_budget_variance_notes は短い差分メモ用なので、全文の月次評価はここで扱う。

CREATE TABLE IF NOT EXISTS company_management_signal_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ym TEXT NOT NULL CHECK (ym ~ '^[0-9]{6}$'),
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('auto_preview', 'candidate', 'confirmed', 'archived')),
  summary TEXT NOT NULL,
  forecast_summary TEXT,
  cost_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  pipeline_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  variance_findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
  decision_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_refs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  codex_thread_id TEXT,
  codex_automation_id TEXT,
  created_by TEXT NOT NULL DEFAULT 'codex_month_end_review',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ym, status)
);

CREATE INDEX IF NOT EXISTS cmsr_ym_status_idx ON company_management_signal_reviews(ym DESC, status);
CREATE INDEX IF NOT EXISTS cmsr_reviewed_at_idx ON company_management_signal_reviews(reviewed_at DESC);

ALTER TABLE company_management_signal_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cmsr_select_anon ON company_management_signal_reviews;
CREATE POLICY cmsr_select_anon ON company_management_signal_reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS cmsr_service_role_all ON company_management_signal_reviews;
CREATE POLICY cmsr_service_role_all ON company_management_signal_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON company_management_signal_reviews TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_management_signal_reviews TO service_role;

COMMENT ON TABLE company_management_signal_reviews IS
  '月次試算表の予実から作る経営シグナル評価。月末Codex専用チャットで作成し、古い月はUIで折りたたむ。';
