-- 165_enable_rls_eimi_slack_usage_log.sql
--
-- Supabase Security Advisor reported rls_disabled_in_public for
-- public.eimi_slack_usage_log. This table stores Eimi Slack/Fugu usage
-- metadata and is written/read by GAS with the Supabase service key.
--
-- Security posture:
--   - anon / authenticated: no direct access.
--   - service_role: full access for GAS and server-side maintenance.
--   - admin authenticated users: SELECT only, for future diagnostics.

ALTER TABLE public.eimi_slack_usage_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.eimi_slack_usage_log FROM anon;
REVOKE ALL ON TABLE public.eimi_slack_usage_log FROM authenticated;
GRANT SELECT ON TABLE public.eimi_slack_usage_log TO authenticated;

DROP POLICY IF EXISTS eimi_slack_usage_log_admin_select ON public.eimi_slack_usage_log;
CREATE POLICY eimi_slack_usage_log_admin_select
  ON public.eimi_slack_usage_log
  FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS eimi_slack_usage_log_service_role_all ON public.eimi_slack_usage_log;
CREATE POLICY eimi_slack_usage_log_service_role_all
  ON public.eimi_slack_usage_log
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
