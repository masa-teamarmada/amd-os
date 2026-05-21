-- 066_notifications_admin_only.sql
-- Notification center is admin-only. Previous policies allowed anon / all authenticated
-- users to read and mark notifications, which could make shared queues read accidentally.

CREATE OR REPLACE FUNCTION public.amd_os_current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND m.is_admin IS TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.amd_os_current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.amd_os_current_user_is_admin() TO authenticated;

-- l2_notifications
REVOKE SELECT ON public.l2_notifications FROM anon;
DROP POLICY IF EXISTS l2n_select_anon ON public.l2_notifications;
DROP POLICY IF EXISTS l2n_update_authenticated ON public.l2_notifications;
DROP POLICY IF EXISTS l2n_select_admin ON public.l2_notifications;
CREATE POLICY l2n_select_admin
  ON public.l2_notifications
  FOR SELECT
  TO authenticated
  USING (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS l2n_update_admin ON public.l2_notifications;
CREATE POLICY l2n_update_admin
  ON public.l2_notifications
  FOR UPDATE
  TO authenticated
  USING (public.amd_os_current_user_is_admin())
  WITH CHECK (public.amd_os_current_user_is_admin());

-- meeting_notifications
REVOKE SELECT ON public.meeting_notifications FROM anon;
DROP POLICY IF EXISTS meeting_notifications_read ON public.meeting_notifications;
DROP POLICY IF EXISTS meeting_notifications_mark_notified ON public.meeting_notifications;
DROP POLICY IF EXISTS meeting_notifications_select_admin ON public.meeting_notifications;
CREATE POLICY meeting_notifications_select_admin
  ON public.meeting_notifications
  FOR SELECT
  TO authenticated
  USING (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS meeting_notifications_update_admin ON public.meeting_notifications;
CREATE POLICY meeting_notifications_update_admin
  ON public.meeting_notifications
  FOR UPDATE
  TO authenticated
  USING (public.amd_os_current_user_is_admin())
  WITH CHECK (public.amd_os_current_user_is_admin());

-- app_notifications
REVOKE SELECT ON public.app_notifications FROM anon;
DROP POLICY IF EXISTS anon_read ON public.app_notifications;
DROP POLICY IF EXISTS authenticated_all ON public.app_notifications;
DROP POLICY IF EXISTS app_notifications_select_admin ON public.app_notifications;
CREATE POLICY app_notifications_select_admin
  ON public.app_notifications
  FOR SELECT
  TO authenticated
  USING (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS app_notifications_update_admin ON public.app_notifications;
CREATE POLICY app_notifications_update_admin
  ON public.app_notifications
  FOR UPDATE
  TO authenticated
  USING (public.amd_os_current_user_is_admin())
  WITH CHECK (public.amd_os_current_user_is_admin());

-- l2_feedbacks are only reachable from the notification review loop.
REVOKE SELECT ON public.l2_feedbacks FROM anon;
DROP POLICY IF EXISTS l2f_select_anon ON public.l2_feedbacks;
DROP POLICY IF EXISTS l2f_insert_authenticated ON public.l2_feedbacks;
DROP POLICY IF EXISTS l2f_update_authenticated ON public.l2_feedbacks;
DROP POLICY IF EXISTS l2f_select_admin ON public.l2_feedbacks;
CREATE POLICY l2f_select_admin
  ON public.l2_feedbacks
  FOR SELECT
  TO authenticated
  USING (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS l2f_insert_admin ON public.l2_feedbacks;
CREATE POLICY l2f_insert_admin
  ON public.l2_feedbacks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS l2f_update_admin ON public.l2_feedbacks;
CREATE POLICY l2f_update_admin
  ON public.l2_feedbacks
  FOR UPDATE
  TO authenticated
  USING (public.amd_os_current_user_is_admin())
  WITH CHECK (public.amd_os_current_user_is_admin());
