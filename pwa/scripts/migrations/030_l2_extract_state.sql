-- 030_l2_extract_state.sql
-- D-4 メンバーナレッジ / D-3 PJナレッジ / D-1 AMDプロトコル の毎時 polling cron で
-- 共通利用する差分検知 state テーブル (Phase 4)。
--
-- 仕様正本:
--   pwa/design/member_knowledge.md
--   pwa/design/project_knowledge.md
--   pwa/design/amd_protocol.md

CREATE TABLE IF NOT EXISTS l2_extract_state (
  l2_kind           TEXT NOT NULL,         -- 'member_knowledge' | 'project_knowledge' | 'protocols'
  target_id         TEXT NOT NULL,         -- member の code_name (member系) or project_id (PJ系)
  scope_key         TEXT NOT NULL,         -- ym (project系) or 'global' (member系)
  source_hash       TEXT NOT NULL,
  saved_count       INT  NOT NULL DEFAULT 0,
  total_count       INT  NOT NULL DEFAULT 0,
  llm_model         TEXT,
  message           TEXT,
  last_processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (l2_kind, target_id, scope_key)
);

CREATE INDEX IF NOT EXISTS idx_l2es_lpa
  ON l2_extract_state (last_processed_at);

CREATE INDEX IF NOT EXISTS idx_l2es_kind_lpa
  ON l2_extract_state (l2_kind, last_processed_at);

GRANT SELECT ON l2_extract_state TO anon, authenticated;
GRANT INSERT, UPDATE ON l2_extract_state TO service_role;

ALTER TABLE l2_extract_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS l2es_select_anon ON l2_extract_state;
CREATE POLICY l2es_select_anon ON l2_extract_state FOR SELECT USING (true);
