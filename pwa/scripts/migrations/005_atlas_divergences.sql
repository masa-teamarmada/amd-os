-- 世界×日本ズレマップ用のキャッシュテーブル
-- 週1で全テーマ再生成。1テーマ1レコード（UNIQUE theme_id）。

CREATE TABLE IF NOT EXISTS atlas_divergences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id UUID NOT NULL REFERENCES atlas_themes(id) ON DELETE CASCADE,
  global_summary TEXT,        -- 世界の動きを 200-400字で要約
  japan_summary TEXT,         -- 日本の動きを 200-400字で要約
  divergence_message TEXT,    -- 「世界はXだが日本はY」の差分メッセージ 100字
  divergence_score FLOAT,     -- 0.0-1.0 乖離の強さ（散布図/ヒートマップの色）
  global_intensity FLOAT,     -- 0.0-1.0 世界の動きの活発度（散布図 x軸）
  japan_intensity FLOAT,      -- 0.0-1.0 日本の動きの活発度（散布図 y軸）
  global_signal_count INT NOT NULL DEFAULT 0,
  japan_signal_count INT NOT NULL DEFAULT 0,
  signal_breakdown JSONB,     -- {global: [{title, url, date}], japan: [{title, url, date}]}
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (theme_id)
);

CREATE INDEX IF NOT EXISTS idx_atlas_divergences_score ON atlas_divergences(divergence_score DESC);
CREATE INDEX IF NOT EXISTS idx_atlas_divergences_generated ON atlas_divergences(generated_at DESC);

ALTER TABLE atlas_divergences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON atlas_divergences;
CREATE POLICY anon_read ON atlas_divergences FOR SELECT USING (true);
