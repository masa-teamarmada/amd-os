-- 067_notification_read_at_split.sql
-- Split delivery marker (`notified_at`) from human read state (`read_at`).
-- `notified_at` is used by iOS/APNs delivery. PWA unread state must use `read_at`.

ALTER TABLE public.l2_notifications
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

ALTER TABLE public.meeting_notifications
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_l2_notifications_web_unread
  ON public.l2_notifications (created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_notifications_web_unread
  ON public.meeting_notifications (created_at DESC)
  WHERE read_at IS NULL;

COMMENT ON COLUMN public.l2_notifications.notified_at IS
  'Delivery marker for iOS/APNs/local notification. Not a human-read marker.';
COMMENT ON COLUMN public.l2_notifications.read_at IS
  'Human read marker used by PWA/notification inbox.';
COMMENT ON COLUMN public.meeting_notifications.notified_at IS
  'Delivery marker for iOS/APNs/local notification. Not a human-read marker.';
COMMENT ON COLUMN public.meeting_notifications.read_at IS
  'Human read marker used by PWA/notification inbox.';

UPDATE public.l2_notifications SET read_at = NULL;
UPDATE public.meeting_notifications SET read_at = NULL;
