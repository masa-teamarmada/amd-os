-- Shared readers must never inherit the internal project data feed.
ALTER TABLE public.project_slack_sources ADD COLUMN archive_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.project_slack_sources ADD COLUMN workspace_shared boolean NOT NULL DEFAULT false;
-- Preserve the requested free-workspace archive; disabled channels stay disabled.
UPDATE public.project_slack_sources SET archive_enabled=true,workspace_shared=enabled WHERE workspace_key='solviorax';
ALTER TABLE public.project_meeting_summaries ADD COLUMN workspace_shared boolean NOT NULL DEFAULT false;
ALTER TABLE public.project_strategy_signals ADD COLUMN workspace_shared boolean NOT NULL DEFAULT false;
ALTER TABLE public.member_activities ADD COLUMN workspace_shared boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.project_meeting_summaries.workspace_shared IS 'Explicit publication after content review. Internal/preparation content is private by default.';
COMMENT ON COLUMN public.project_slack_sources.archive_enabled IS 'Opt-in retention for free external Slack. ARMADA sources cannot be archived.';
ALTER TABLE public.project_slack_sources ADD CONSTRAINT no_armada_slack_archive CHECK (workspace_key NOT IN ('armada','teamarmadahq') OR (NOT archive_enabled AND NOT workspace_shared));
DROP POLICY IF EXISTS pms_read_anon ON public.project_meeting_summaries;
CREATE POLICY pms_internal_read ON public.project_meeting_summaries FOR SELECT TO authenticated USING (public.amd_os_can_access_project(project_id));
DROP POLICY IF EXISTS pss_select_anon ON public.project_strategy_signals;
CREATE POLICY pss_internal_read ON public.project_strategy_signals FOR SELECT TO authenticated USING (public.amd_os_can_access_project(project_id));
ALTER POLICY pss_insert_authenticated ON public.project_strategy_signals WITH CHECK (public.amd_os_can_access_project(project_id));
ALTER POLICY pss_update_authenticated ON public.project_strategy_signals USING (public.amd_os_can_access_project(project_id)) WITH CHECK (public.amd_os_can_access_project(project_id));
DROP POLICY IF EXISTS anon_read ON public.member_activities;
DROP POLICY IF EXISTS member_activities_select ON public.member_activities;
CREATE POLICY activities_internal_read ON public.member_activities FOR SELECT TO authenticated USING (public.amd_os_can_access_project(project_id));
DROP POLICY IF EXISTS anon_read ON public.project_config;
CREATE POLICY config_internal_read ON public.project_config FOR SELECT TO authenticated USING (public.amd_os_can_access_project(project_id));
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.amie_guard_slack_archive() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.source='slack' AND NOT EXISTS (
    SELECT 1 FROM public.project_slack_sources s
    WHERE s.project_id=NEW.project_id AND s.archive_enabled
      AND s.workspace_key NOT IN ('armada','teamarmadahq')
      AND s.channel_id=COALESCE(NEW.metadata_json->>'channel_id',split_part(NEW.item_id,':',1))
      AND substring(COALESCE(NEW.metadata_json->>'permalink',NEW.metadata_json->>'source_url','') from '^https://([^/]+)/')=s.workspace_key||'.slack.com'
  ) THEN
    -- Reject persistence even from stale collectors and service-role writers.
    RETURN NULL;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.amie_guard_slack_archive() FROM PUBLIC;
CREATE TRIGGER amie_guard_slack_archive BEFORE INSERT OR UPDATE ON public.source_cache FOR EACH ROW EXECUTE FUNCTION private.amie_guard_slack_archive();
