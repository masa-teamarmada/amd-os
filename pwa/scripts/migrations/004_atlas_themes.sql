-- Atlas テーマ定義
-- Phase 1 for 世界×日本ズレマップ: ストーリーよりも粗い「テーマ」単位を導入
-- 例: 「水素」「リチウム」「AI規制」「洋上風力」「半導体」など 30-50個

CREATE TABLE IF NOT EXISTS atlas_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  primary_domain TEXT,
  tag_keywords TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 多対多: 1ストーリーが複数テーマに属しうる（例: 「日中半導体規制応酬」は「半導体」「米中対立」両方）
CREATE TABLE IF NOT EXISTS atlas_story_themes (
  story_id UUID REFERENCES atlas_stories(id) ON DELETE CASCADE,
  theme_id UUID REFERENCES atlas_themes(id) ON DELETE CASCADE,
  confidence FLOAT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_atlas_story_themes_theme ON atlas_story_themes(theme_id);
CREATE INDEX IF NOT EXISTS idx_atlas_story_themes_story ON atlas_story_themes(story_id);
CREATE INDEX IF NOT EXISTS idx_atlas_themes_domain ON atlas_themes(primary_domain);

ALTER TABLE atlas_themes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON atlas_themes;
CREATE POLICY anon_read ON atlas_themes FOR SELECT USING (true);

ALTER TABLE atlas_story_themes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON atlas_story_themes;
CREATE POLICY anon_read ON atlas_story_themes FOR SELECT USING (true);
