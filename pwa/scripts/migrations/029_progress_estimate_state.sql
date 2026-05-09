-- 029_progress_estimate_state.sql
-- L2 ③ MS進捗の毎時 polling 化 (Phase 4) のための差分検知用 state テーブル。
-- 1 PJ × 1 ym ごとに「最後に LLM 抽出したときの source_hash と timestamp」を持つ。
-- 毎時 cron から呼ばれた estimateProgress() が source_hash 一致なら LLM 呼ばずスキップする。
--
-- 仕様正本: pwa/design/ms_progress.md (Phase 4 セクション)

CREATE TABLE IF NOT EXISTS progress_estimate_state (
  project_id        TEXT NOT NULL,
  ym                TEXT NOT NULL,
  source_hash       TEXT NOT NULL,
  saved_count       INT  NOT NULL DEFAULT 0,
  skipped_count     INT  NOT NULL DEFAULT 0,
  total_count       INT  NOT NULL DEFAULT 0,
  llm_model         TEXT,
  message           TEXT,
  last_processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, ym)
);

CREATE INDEX IF NOT EXISTS idx_pes_last_processed_at
  ON progress_estimate_state (last_processed_at);

GRANT SELECT ON progress_estimate_state TO anon, authenticated;
GRANT INSERT, UPDATE ON progress_estimate_state TO service_role;

ALTER TABLE progress_estimate_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pes_select_anon ON progress_estimate_state;
CREATE POLICY pes_select_anon ON progress_estimate_state FOR SELECT USING (true);
