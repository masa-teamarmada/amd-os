-- atlas_stories テーブル + atlas_signals.story_id
-- Phase 1 of A案: ストーリー化

CREATE TABLE IF NOT EXISTS atlas_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'ongoing'
    CHECK (status IN ('ongoing','concluded','dormant')),
  importance TEXT NOT NULL DEFAULT 'medium'
    CHECK (importance IN ('high','medium','low')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  primary_domain TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signal_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE atlas_signals
  ADD COLUMN IF NOT EXISTS story_id UUID REFERENCES atlas_stories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_atlas_signals_story ON atlas_signals(story_id);
CREATE INDEX IF NOT EXISTS idx_atlas_stories_status ON atlas_stories(status);
CREATE INDEX IF NOT EXISTS idx_atlas_stories_last_updated ON atlas_stories(last_updated_at DESC);

ALTER TABLE atlas_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON atlas_stories;
CREATE POLICY anon_read ON atlas_stories FOR SELECT USING (true);
