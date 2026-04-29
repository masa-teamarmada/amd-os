-- ============================================================
-- MS活動narrative + 提案フロー（つくよみ仲介、admin承認）
-- 2026-04-26
-- ============================================================

-- メンバー × MS × ym ごとの「やったこと」narrative
-- attribute-ms-activity Edge Function が生成・キャッシュする
CREATE TABLE IF NOT EXISTS member_ms_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     TEXT NOT NULL,
  milestone_id  TEXT NOT NULL,
  ym            TEXT NOT NULL,
  narrative     TEXT,
  source_note   TEXT,                 -- 抽出元 milestone_monthly_progress.note のスナップショット
  generated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (member_id, milestone_id, ym)
);
CREATE INDEX IF NOT EXISTS idx_member_ms_activities_lookup
  ON member_ms_activities (member_id, ym);
CREATE INDEX IF NOT EXISTS idx_member_ms_activities_ms
  ON member_ms_activities (milestone_id, ym);

-- メンバーから admin への進捗提案
CREATE TABLE IF NOT EXISTS ms_progress_proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       TEXT NOT NULL,
  project_id      TEXT NOT NULL,
  milestone_id    TEXT NOT NULL,
  ym              TEXT NOT NULL,
  -- 提案内容
  suggested_pct   NUMERIC(5,2),       -- 「進捗50%じゃなくて60%」
  suggested_text  TEXT,               -- 「こんなことも終わらせたよ」
  -- 状態管理
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  reject_reason_raw TEXT,             -- adminが書いた素の理由（メンバーには見せない）
  reviewed_by     TEXT,               -- admin member_id
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposals_member ON ms_progress_proposals (member_id, ym);
CREATE INDEX IF NOT EXISTS idx_proposals_pending ON ms_progress_proposals (status, created_at);
CREATE INDEX IF NOT EXISTS idx_proposals_ms ON ms_progress_proposals (milestone_id, ym);

-- 提案スレッド（LINE風やりとり）
-- sender_kind: 'member'（提案者）/ 'admin'（管理者の生メッセージ、通常は使わない）/ 'tsukuyomi'（差し戻し理由をつくよみ口調にしたもの）
CREATE TABLE IF NOT EXISTS ms_proposal_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id  UUID NOT NULL REFERENCES ms_progress_proposals(id) ON DELETE CASCADE,
  sender_kind  TEXT NOT NULL CHECK (sender_kind IN ('member', 'admin', 'tsukuyomi')),
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_proposal ON ms_proposal_messages (proposal_id, created_at);

-- updated_at trigger（共通関数があれば使う、なければ単発）
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
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_proposals_updated_at'
  ) THEN
    CREATE TRIGGER trg_proposals_updated_at
      BEFORE UPDATE ON ms_progress_proposals
      FOR EACH ROW EXECUTE FUNCTION set_updated_at_now();
  END IF;
END $$;
