-- 034_app_notifications.sql
--
-- ユーザー向け汎用通知テーブル。/notifications ページで一覧表示する。
-- iOS APNs 用の meeting_notifications / l2_notifications とは別系統 (Web UI 専用)。
--
-- 用途:
--   - VC discover cron が新 VC や 新ニュースを検出したら通知
--   - つくよみ追加時の通知 (将来拡張)
--   - その他システムイベント
--
-- フィールド:
--   - kind: 'vc_new' | 'vc_news' | 'vc_fund' | 'misc' (将来拡張)
--   - title: 1 行サマリ
--   - body: 詳細 (省略可)
--   - link: クリック先 URL (例 /vcs/<uuid>)
--   - meta: 任意 jsonb
--   - related_vc_id: 関連 VC (あれば)
--   - source: 'cron_vc_discover' | 'cron_vc_news_ingest' | 'tsukuyomi' | 'manual' | 'system'
--   - read_at / dismissed_at: ユーザー操作タイムスタンプ

CREATE TABLE IF NOT EXISTS app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  meta JSONB,
  related_vc_id UUID REFERENCES vcs(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'system',
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_unread
  ON app_notifications (created_at DESC)
  WHERE read_at IS NULL AND dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_app_notifications_kind
  ON app_notifications (kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_notifications_related_vc
  ON app_notifications (related_vc_id, created_at DESC);

ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON app_notifications;
CREATE POLICY anon_read ON app_notifications FOR SELECT USING (true);
DROP POLICY IF EXISTS authenticated_all ON app_notifications;
CREATE POLICY authenticated_all ON app_notifications
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS service_role_bypass ON app_notifications;
CREATE POLICY service_role_bypass ON app_notifications
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE app_notifications IS 'ユーザー向け Web UI 通知 (/notifications ページで表示)';
