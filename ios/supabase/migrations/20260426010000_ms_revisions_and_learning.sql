-- ============================================================
-- (1) PM ↔ つくよみ: MS進捗の修正依頼フロー
-- (2) つくよみ学習: 承認された提案を蓄積
-- 2026-04-26
-- ============================================================

-- (1) PMからの「進捗を再推定して」依頼。LLMで新pct/noteを提案して、PMがOK/再依頼するフロー
CREATE TABLE IF NOT EXISTS ms_progress_revisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      TEXT NOT NULL,
  milestone_id    TEXT NOT NULL,
  ym              TEXT NOT NULL,
  -- LLMが提案する内容
  current_pct     NUMERIC(5,2),       -- 依頼時点の累積%
  current_note    TEXT,
  revised_pct     NUMERIC(5,2),       -- LLMが提案した新累積%
  revised_note    TEXT,               -- LLMが提案した新note
  -- 状態
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'discarded')),
  requested_by    TEXT,
  confirmed_by    TEXT,
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_revisions_ms ON ms_progress_revisions (milestone_id, ym);
CREATE INDEX IF NOT EXISTS idx_revisions_status ON ms_progress_revisions (status, created_at);

-- (1b) PM ↔ つくよみのスレッド
CREATE TABLE IF NOT EXISTS ms_revision_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id  UUID NOT NULL REFERENCES ms_progress_revisions(id) ON DELETE CASCADE,
  sender_kind  TEXT NOT NULL CHECK (sender_kind IN ('pm', 'tsukuyomi')),
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_revision_messages ON ms_revision_messages (revision_id, created_at);

-- (2) つくよみ学習: 承認済み提案テキストを member_ms_activities に蓄積
ALTER TABLE member_ms_activities
  ADD COLUMN IF NOT EXISTS learned_addendum TEXT;

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_now') THEN
    CREATE OR REPLACE FUNCTION set_updated_at_now()
    RETURNS TRIGGER AS $body$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $body$ LANGUAGE plpgsql;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_revisions_updated_at'
  ) THEN
    CREATE TRIGGER trg_revisions_updated_at
      BEFORE UPDATE ON ms_progress_revisions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at_now();
  END IF;
END $$;
