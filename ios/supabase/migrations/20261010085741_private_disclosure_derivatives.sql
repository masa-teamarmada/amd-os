-- Internal derivative evidence is never a public disclosure surface.
DROP POLICY IF EXISTS anon_read ON public.monthly_reports;
CREATE POLICY monthly_reports_internal_read ON public.monthly_reports FOR SELECT TO authenticated USING(public.amd_os_can_access_project(project_id));
DROP POLICY IF EXISTS anon_read ON public.project_knowledge;
CREATE POLICY project_knowledge_internal_read ON public.project_knowledge FOR SELECT TO authenticated USING(public.amd_os_can_access_project(project_id));
DROP POLICY IF EXISTS amsrs_select_anon ON public.amd_management_score_raw_signals;
CREATE POLICY amsrs_internal_read ON public.amd_management_score_raw_signals FOR SELECT TO authenticated USING(public.amd_os_can_access_project(project_id));
