-- Venture Map (16社マッピング+マクロ可視化) 用テーブル
-- 設計: design_log/2026-05_venture_map_demo.md (v2)

-- =====================================================================
-- 1. ventures: 過去・現在のSU実績（軌跡概念は廃止、設立点だけ）
-- =====================================================================

CREATE TABLE IF NOT EXISTS ventures (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  short_label TEXT,
  lane TEXT NOT NULL,                  -- 'gx_energy' | 'gx_circular' | 'materials' | 'life' | 'robo'
  founded_at DATE NOT NULL,
  status TEXT NOT NULL,                -- 'active' | 'exited' | 'terminated' | 'pre_founding'
  outcome_pattern TEXT NOT NULL,       -- 'rocket' | 'lifted' | 'deep_pivot' | 'burnout' | 'ue_fail'
  origin_org TEXT,
  origin_pi TEXT,
  amd_role TEXT,                       -- 'studio' | 'support' | 'founder_studio'
  short_description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ventures_lane ON ventures(lane);
CREATE INDEX IF NOT EXISTS idx_ventures_founded ON ventures(founded_at);

ALTER TABLE ventures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON ventures;
CREATE POLICY anon_read ON ventures FOR SELECT USING (true);

-- =====================================================================
-- 2. ventures_xrl_log: SU個別ビュー用 TRL/BRL/HRL/GRL/SRL の時系列
-- =====================================================================

CREATE TABLE IF NOT EXISTS ventures_xrl_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id TEXT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  observed_at DATE NOT NULL,
  trl INT,
  brl INT,
  hrl INT,
  grl INT,
  srl INT,
  bottleneck TEXT,                     -- 'TRL' | 'BRL' | 'HRL' | 'GRL' | 'SRL'
  milestone_label TEXT,
  source_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ventures_xrl_log ON ventures_xrl_log(venture_id, observed_at);

ALTER TABLE ventures_xrl_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON ventures_xrl_log;
CREATE POLICY anon_read ON ventures_xrl_log FOR SELECT USING (true);

-- =====================================================================
-- 3. macro_index_log: 領域別マクロトレンド指数の時系列
-- =====================================================================

CREATE TABLE IF NOT EXISTS macro_index_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lane TEXT NOT NULL,
  observed_at DATE NOT NULL,
  index_value NUMERIC NOT NULL,        -- 0-1 正規化
  policy_density NUMERIC,
  budget_amount NUMERIC,
  investment_amount NUMERIC,
  policy_mention_count NUMERIC,
  raw_signal_count INT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_macro_index_log_unique ON macro_index_log(lane, observed_at);

ALTER TABLE macro_index_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON macro_index_log;
CREATE POLICY anon_read ON macro_index_log FOR SELECT USING (true);

-- =====================================================================
-- 4. macro_lane_weights: 領域別重みベクトル (LLMで定期再学習)
-- =====================================================================

CREATE TABLE IF NOT EXISTS macro_lane_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lane TEXT NOT NULL,
  alpha NUMERIC NOT NULL,              -- 政策密度の重み
  beta NUMERIC NOT NULL,               -- 公募予算の重み
  gamma NUMERIC NOT NULL,              -- 投資額の重み
  delta NUMERIC NOT NULL,              -- 政策言及数の重み
  lambda NUMERIC,                      -- 政策効果減衰率
  eta NUMERIC,                         -- 競合密度の効き方
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  computed_by TEXT,                    -- 'llm-sonnet-4-7' | 'manual'
  source_data_window_days INT
);

CREATE INDEX IF NOT EXISTS idx_macro_lane_weights ON macro_lane_weights(lane, computed_at DESC);

ALTER TABLE macro_lane_weights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON macro_lane_weights;
CREATE POLICY anon_read ON macro_lane_weights FOR SELECT USING (true);

-- =====================================================================
-- 5. papers_log: 領域別論文数の時系列
-- =====================================================================

CREATE TABLE IF NOT EXISTS papers_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lane TEXT NOT NULL,
  observed_at DATE NOT NULL,
  paper_count INT NOT NULL,
  source TEXT NOT NULL,                -- 'openalex' | 'jstage' | 'lens' | 'elsevier'
  query_hash TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_papers_log ON papers_log(lane, observed_at);

ALTER TABLE papers_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON papers_log;
CREATE POLICY anon_read ON papers_log FOR SELECT USING (true);

-- =====================================================================
-- 6. seeds: 研究シーズ在庫
-- =====================================================================

CREATE TABLE IF NOT EXISTS seeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  origin_org TEXT,
  origin_pi TEXT,
  lane TEXT,
  trl INT,
  brl INT,
  hrl INT,
  status TEXT NOT NULL,                -- 'candidate' | 'reviewing' | 'venture_created' | 'rejected' | 'on_hold'
  linked_atlas_theme_ids UUID[],
  linked_venture_id TEXT REFERENCES ventures(id),
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seeds_lane ON seeds(lane);
CREATE INDEX IF NOT EXISTS idx_seeds_status ON seeds(status);

ALTER TABLE seeds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON seeds;
CREATE POLICY anon_read ON seeds FOR SELECT USING (true);
