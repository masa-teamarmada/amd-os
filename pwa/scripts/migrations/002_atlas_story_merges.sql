-- ストーリー統合履歴（ユーザーフィードバック学習用）
CREATE TABLE IF NOT EXISTS atlas_story_merges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merged_from_title TEXT NOT NULL,
  merged_from_summary TEXT,
  merged_to_id UUID REFERENCES atlas_stories(id) ON DELETE SET NULL,
  merged_to_title TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atlas_story_merges_created ON atlas_story_merges(created_at DESC);

ALTER TABLE atlas_story_merges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON atlas_story_merges;
CREATE POLICY anon_read ON atlas_story_merges FOR SELECT USING (true);
