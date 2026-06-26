-- 152_app_notifications_native_delivery.sql
-- Split native/local-notification delivery from human read state for app_notifications.
-- PWA unread state keeps using read_at; Swift local notification delivery uses native_notified_at.

ALTER TABLE public.app_notifications
  ADD COLUMN IF NOT EXISTS native_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_app_notifications_connector_auth_native_unsent
  ON public.app_notifications (updated_at DESC)
  WHERE kind = 'connector_auth'
    AND native_notified_at IS NULL
    AND read_at IS NULL
    AND dismissed_at IS NULL;

COMMENT ON COLUMN public.app_notifications.native_notified_at IS
  'Native app local-notification delivery marker. Human read state remains read_at.';
