-- 028: meeting_notifications テーブル
--
-- Phase 3「会議終了 +60 分の 1 event 抽出」で議事録を拾えたとき、
-- iOS 側 (Swift APNs) が拾って push 通知するための受け渡しキュー。
--
-- 設計:
-- - GAS (153_MeetingHourlyTrigger.js _meeting_insertNotification_) が upsert
-- - PK = meeting_id (project_meeting_summaries.meeting_id と同値) で重複通知を避ける
-- - iOS 側は notified_at IS NULL の行を polling (or realtime sub) → APNs 送信 → notified_at = now()
-- - 同じ MTG が再抽出されたら upsert で row が覆う (notified_at は NULL に戻して再通知させる方針)
--
-- 仕様正本: pwa/design/meeting_summaries.md (Phase 3 セクション)
--          ios/HANDOFF_meeting_notifications.md (iOS 側受け取り仕様)

CREATE TABLE IF NOT EXISTS meeting_notifications (
  meeting_id      TEXT PRIMARY KEY REFERENCES project_meeting_summaries(meeting_id) ON DELETE CASCADE,
  project_id      TEXT NOT NULL,
  title           TEXT NOT NULL,
  source_kinds    TEXT NOT NULL,                          -- 'notion' | 'gmail' | 'notion+gmail'
  summary_short   TEXT NOT NULL DEFAULT '',
  notified_at     TIMESTAMPTZ,                            -- iOS が APNs 送信したら更新する
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_notifications_unsent
  ON meeting_notifications(created_at DESC)
  WHERE notified_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_notifications_project
  ON meeting_notifications(project_id, created_at DESC);

-- updated_at 自動更新トリガ
CREATE OR REPLACE FUNCTION trg_meeting_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  -- 再 upsert で内容更新があれば notified_at をリセット (= iOS 側に再通知させる)
  IF NEW.source_kinds IS DISTINCT FROM OLD.source_kinds
     OR NEW.summary_short IS DISTINCT FROM OLD.summary_short
     OR NEW.title IS DISTINCT FROM OLD.title THEN
    NEW.notified_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS meeting_notifications_updated_at ON meeting_notifications;
CREATE TRIGGER meeting_notifications_updated_at
  BEFORE UPDATE ON meeting_notifications
  FOR EACH ROW EXECUTE FUNCTION trg_meeting_notifications_updated_at();

-- RLS: anon, authenticated とも SELECT 可 (Swift / PWA 両方で読む可能性)
-- 書き込みは service_role 経由 (GAS supa_upsert + Swift から notified_at UPDATE)
ALTER TABLE meeting_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_notifications_read ON meeting_notifications;
CREATE POLICY meeting_notifications_read
  ON meeting_notifications
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Swift (auth クライアント) が notified_at = now() を打てるように UPDATE 権限を authenticated に
DROP POLICY IF EXISTS meeting_notifications_mark_notified ON meeting_notifications;
CREATE POLICY meeting_notifications_mark_notified
  ON meeting_notifications
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
