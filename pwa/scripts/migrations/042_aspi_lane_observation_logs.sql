-- 042_aspi_lane_observation_logs.sql
--
-- Phase 2 の Schema 整備:
-- - 既存 papers_log / macro_index_log / macro_lane_weights の lane を旧 5 lane → ASPI 8 domain に migrate
-- - 新規 observation_log (B 公募予算 / V VC 投資 / I_R 研究費 を統合保存する観測量テーブル)
-- - 新規 lane_suggestions (LLM lane 推定 candidate を保存、admin 承認後に project_ventures.lanes に書き戻し)
-- - triple_helix_loading.available を B/V/I_R で TRUE に (= cron 実装に伴い取得可能になる)
--
-- 正本: pwa/design/aspi_lanes.md (まさ承認 2026-05-11)

-- ========================================================================
-- 1. papers_log: 旧 5 lane → ASPI 8 domain
-- ========================================================================
-- gx_energy + gx_circular は energy_environment に合算 (同じ observed_at がある場合 SUM)

CREATE TEMP TABLE _papers_energy_merged AS
SELECT 'energy_environment'::text AS lane, observed_at, SUM(paper_count)::int AS paper_count,
       MAX(source) AS source, MAX(query_hash) AS query_hash, MAX(computed_at) AS computed_at
FROM papers_log
WHERE lane IN ('gx_energy', 'gx_circular')
GROUP BY observed_at;

DELETE FROM papers_log WHERE lane IN ('gx_energy', 'gx_circular');

INSERT INTO papers_log (lane, observed_at, paper_count, source, query_hash, computed_at)
SELECT lane, observed_at, paper_count, source, query_hash, computed_at FROM _papers_energy_merged
ON CONFLICT (lane, observed_at) DO UPDATE
  SET paper_count = papers_log.paper_count + EXCLUDED.paper_count,
      source = EXCLUDED.source,
      computed_at = EXCLUDED.computed_at;

UPDATE papers_log SET lane = 'advanced_materials_manufacturing' WHERE lane = 'materials';
UPDATE papers_log SET lane = 'biotechnology' WHERE lane = 'life';
UPDATE papers_log SET lane = 'defence_space_robotics_transport' WHERE lane = 'robo';

-- ========================================================================
-- 2. macro_index_log: 旧 5 lane → ASPI 8 domain (履歴保持)
--    macro_index_log は UNIQUE (lane, observed_at)。gx_energy + gx_circular が
--    同 observed_at にある場合があるので合算 → DELETE のパターン (papers_log と同じ)。
-- ========================================================================

CREATE TEMP TABLE _macro_energy_merged AS
SELECT 'energy_environment'::text AS lane, observed_at,
       AVG(index_value)::numeric AS index_value,
       SUM(COALESCE(policy_density, 0))::numeric AS policy_density,
       SUM(COALESCE(budget_amount, 0))::numeric AS budget_amount,
       SUM(COALESCE(investment_amount, 0))::numeric AS investment_amount,
       SUM(COALESCE(policy_mention_count, 0))::numeric AS policy_mention_count,
       SUM(COALESCE(raw_signal_count, 0))::int AS raw_signal_count,
       MAX(computed_at) AS computed_at
FROM macro_index_log
WHERE lane IN ('gx_energy', 'gx_circular')
GROUP BY observed_at;

DELETE FROM macro_index_log WHERE lane IN ('gx_energy', 'gx_circular');

INSERT INTO macro_index_log (lane, observed_at, index_value, policy_density, budget_amount, investment_amount, policy_mention_count, raw_signal_count, computed_at)
SELECT lane, observed_at, index_value, policy_density, budget_amount, investment_amount, policy_mention_count, raw_signal_count, computed_at FROM _macro_energy_merged
ON CONFLICT (lane, observed_at) DO UPDATE
  SET index_value = (macro_index_log.index_value + EXCLUDED.index_value) / 2,
      policy_density = COALESCE(macro_index_log.policy_density, 0) + COALESCE(EXCLUDED.policy_density, 0),
      budget_amount = COALESCE(macro_index_log.budget_amount, 0) + COALESCE(EXCLUDED.budget_amount, 0),
      investment_amount = COALESCE(macro_index_log.investment_amount, 0) + COALESCE(EXCLUDED.investment_amount, 0),
      policy_mention_count = COALESCE(macro_index_log.policy_mention_count, 0) + COALESCE(EXCLUDED.policy_mention_count, 0),
      raw_signal_count = COALESCE(macro_index_log.raw_signal_count, 0) + COALESCE(EXCLUDED.raw_signal_count, 0),
      computed_at = EXCLUDED.computed_at;

UPDATE macro_index_log SET lane = 'advanced_materials_manufacturing' WHERE lane = 'materials';
UPDATE macro_index_log SET lane = 'biotechnology' WHERE lane = 'life';
UPDATE macro_index_log SET lane = 'defence_space_robotics_transport' WHERE lane = 'robo';

-- ========================================================================
-- 3. macro_lane_weights: ASPI 8 domain で再 seed
-- ========================================================================

DELETE FROM macro_lane_weights;

INSERT INTO macro_lane_weights (lane, alpha, beta, gamma, delta, lambda, eta, computed_at, computed_by, source_data_window_days)
VALUES
  -- α=政策 β=予算 γ=投資 δ=言及 λ=政策減衰 η=競合密度効き方
  ('advanced_ict',                       0.30, 0.20, 0.30, 0.20, 0.18, 1.10, NOW(), 'migration_042_seed', 1095),
  ('advanced_materials_manufacturing',   0.28, 0.30, 0.28, 0.14, 0.20, 1.00, NOW(), 'migration_042_seed', 1095),
  ('ai_technologies',                    0.25, 0.20, 0.35, 0.20, 0.16, 1.40, NOW(), 'migration_042_seed', 1095),
  ('biotechnology',                      0.20, 0.50, 0.18, 0.12, 0.08, 1.20, NOW(), 'migration_042_seed', 1095),
  ('defence_space_robotics_transport',   0.30, 0.32, 0.20, 0.18, 0.20, 1.30, NOW(), 'migration_042_seed', 1095),
  ('energy_environment',                 0.40, 0.25, 0.20, 0.15, 0.12, 1.20, NOW(), 'migration_042_seed', 1095),
  ('quantum',                            0.30, 0.40, 0.20, 0.10, 0.10, 1.00, NOW(), 'migration_042_seed', 1095),
  ('sensing_timing_navigation',          0.30, 0.25, 0.25, 0.20, 0.16, 1.10, NOW(), 'migration_042_seed', 1095);

-- ========================================================================
-- 4. observation_log 新規 (B / V / I_R 等の統合観測量)
-- ========================================================================

CREATE TABLE IF NOT EXISTS observation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lane TEXT NOT NULL,                     -- ASPI 8 domain id
  observed_at DATE NOT NULL,              -- quarter 開始日 (YYYY-MM-01)
  observation_key TEXT NOT NULL,          -- 'I_R' (研究費) / 'B' (公募予算) / 'V' (VC 投資)
  value NUMERIC NOT NULL,                 -- 観測値 (単位は unit 参照)
  unit TEXT,                              -- '億円' / '件' / '社' 等
  source TEXT NOT NULL,                   -- 'kaken' / 'nedo' / 'jst' / 'amed' / 'vc_news' / 'crunchbase'
  raw_meta JSONB,                         -- 採択件数 / 元 URL リスト / LLM raw etc.
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lane, observed_at, observation_key, source)
);

ALTER TABLE observation_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON observation_log;
CREATE POLICY anon_read ON observation_log FOR SELECT USING (true);
DROP POLICY IF EXISTS service_role_bypass ON observation_log;
CREATE POLICY service_role_bypass ON observation_log FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS observation_log_lane_observed_idx ON observation_log(lane, observed_at);
CREATE INDEX IF NOT EXISTS observation_log_key_observed_idx ON observation_log(observation_key, observed_at);

COMMENT ON TABLE observation_log IS
  'Triple Helix 観測量 B (公募予算) / V (VC 投資) / I_R (研究費) を統合保存。lane = ASPI 8 domain id。kaken-ingest / grant-ingest / vc-investment-ingest cron が書き込み、triple-helix-observations.ts が読み込む。';

-- ========================================================================
-- 5. lane_suggestions 新規 (LLM lane 推定 candidate)
-- ========================================================================

CREATE TABLE IF NOT EXISTS lane_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,                                -- projects.project_id (FK 制約は projects.project_id が unique 制約のためそのまま参照可)
  suggested_lanes JSONB NOT NULL,                          -- [{"domain": "...", "weight": ...}]
  reasoning TEXT,                                          -- LLM の判断理由 (まさ向け説明)
  model TEXT,                                              -- 'anthropic:claude-sonnet-4-5-20250929' 等
  confidence NUMERIC,                                      -- 0-1 (LLM 自己評価)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'superseded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewer TEXT
);

ALTER TABLE lane_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON lane_suggestions;
CREATE POLICY anon_read ON lane_suggestions FOR SELECT USING (true);
DROP POLICY IF EXISTS admin_all ON lane_suggestions;
CREATE POLICY admin_all ON lane_suggestions FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_bypass ON lane_suggestions;
CREATE POLICY service_role_bypass ON lane_suggestions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS lane_suggestions_status_idx ON lane_suggestions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS lane_suggestions_project_idx ON lane_suggestions(project_id, created_at DESC);

COMMENT ON TABLE lane_suggestions IS
  'LLM (Sonnet) による PJ.lanes 推定 candidate。lane-suggest cron が pending を作る、admin/projects UI で approved → project_ventures.lanes に書き戻す。';

-- ========================================================================
-- 6. triple_helix_loading の B / V / I_R を available=TRUE に
-- ========================================================================

UPDATE triple_helix_loading
SET available = TRUE,
    data_source = 'KAKEN API → observation_log (key=I_R, source=kaken)',
    updated_at = NOW()
WHERE observation = 'I_R';

UPDATE triple_helix_loading
SET available = TRUE,
    data_source = 'NEDO/JST/AMED 採択 → observation_log (key=B, source=grant)',
    updated_at = NOW()
WHERE observation = 'B';

UPDATE triple_helix_loading
SET available = TRUE,
    data_source = 'vc_news LLM 抽出 → observation_log (key=V, source=vc_news)',
    updated_at = NOW()
WHERE observation = 'V';

-- ========================================================================
-- 7. 動作確認
-- ========================================================================

DO $$
DECLARE
  weights_cnt INT;
  papers_legacy_cnt INT;
  loading_avail_cnt INT;
BEGIN
  SELECT COUNT(*) INTO weights_cnt FROM macro_lane_weights WHERE lane IN (
    'advanced_ict', 'advanced_materials_manufacturing', 'ai_technologies', 'biotechnology',
    'defence_space_robotics_transport', 'energy_environment', 'quantum', 'sensing_timing_navigation');
  SELECT COUNT(*) INTO papers_legacy_cnt FROM papers_log WHERE lane IN ('gx_energy', 'gx_circular', 'materials', 'life', 'robo');
  SELECT COUNT(*) INTO loading_avail_cnt FROM triple_helix_loading WHERE available = TRUE;
  RAISE NOTICE '[042] macro_lane_weights ASPI rows = % (expected 8)', weights_cnt;
  RAISE NOTICE '[042] papers_log legacy 5-lane rows = % (expected 0)', papers_legacy_cnt;
  RAISE NOTICE '[042] triple_helix_loading available=TRUE = % (expected 7)', loading_avail_cnt;
END $$;
