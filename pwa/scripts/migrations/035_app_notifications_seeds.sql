-- 035_app_notifications_seeds.sql
--
-- app_notifications を Seeds (研究シーズリスト) にも対応させる。
-- /notifications ページに seed_new / seed_news 通知が並ぶようにする。
--
-- まさ指示 (2026-05-09): 通知は /notifications 一本に統一。
-- /seeds/inbox + GlobalNav Seeds バッジは廃止し、
-- cron seeds-ingest が発見したシーズは app_notifications に push する。

ALTER TABLE app_notifications
  ADD COLUMN IF NOT EXISTS related_seed_id UUID REFERENCES seeds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_app_notifications_related_seed
  ON app_notifications (related_seed_id, created_at DESC);

COMMENT ON COLUMN app_notifications.related_seed_id IS 'cron_seeds_ingest が発見したシーズへのリンク。kind=seed_new / seed_news の場合に使う';
