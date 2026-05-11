-- 044_freeze_period_backfills.sql
--
-- 休止期間 backfill (= 凍結期間中の進捗を再開月サマリにまとめて表示する) の保存先。
--
-- 仕様 (まさ要望 2026-05-11):
-- - 休止期間のある PJ (projects.freeze_from_ym + restart_expected_ym) について、
--   再開予定月の MS (= milestone_monthly_progress) が新しく登録されたタイミングで
--   休止期間中の monthly_reports + project_meeting_summaries を LLM (Sonnet) で
--   統合した summary を本テーブルに保存。
-- - cockpit が再開月の表示時にこの summary を join して「休止期間サマリ」セクションを出す。
-- - UNIQUE (project_id, freeze_from_ym, restart_ym) で 1 期間 1 行。再開月の MS が
--   更に増えても上書きされず最初の 1 回だけ走る (= source_hash で差分検知)。
--
-- 正本: pwa/HANDOFF_pwa_rebuild.md / pwa/design/cockpit.md

CREATE TABLE IF NOT EXISTS freeze_period_backfills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,             -- projects.project_id
  freeze_from_ym TEXT NOT NULL,         -- 休止開始 ym ("YYYYMM" 形式)
  restart_ym TEXT NOT NULL,             -- 再開予定月 ym ("YYYYMM" 形式)
  summary TEXT NOT NULL,                -- LLM 統合サマリ本文
  source_hash TEXT NOT NULL,            -- 元データ (reports + meetings) のハッシュ。差分検知用
  source_meta JSONB,                    -- { reports_count, meetings_count, llm_model, generated_at }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, freeze_from_ym, restart_ym)
);

ALTER TABLE freeze_period_backfills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON freeze_period_backfills;
CREATE POLICY anon_read ON freeze_period_backfills FOR SELECT USING (true);
DROP POLICY IF EXISTS service_role_bypass ON freeze_period_backfills;
CREATE POLICY service_role_bypass ON freeze_period_backfills FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS freeze_period_backfills_project_idx
  ON freeze_period_backfills(project_id, restart_ym);

COMMENT ON TABLE freeze_period_backfills IS
  '休止期間 backfill — 再開予定月の MS が登録されたタイミングで休止期間中の monthly_reports + project_meeting_summaries を LLM 統合して保存。cockpit が再開月の表示時に join して表示。';
