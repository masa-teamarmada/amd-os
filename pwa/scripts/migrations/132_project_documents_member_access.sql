-- 132_project_documents_member_access.sql
-- PJ cockpit documents read/write access.
-- Active PJ members can read and add/update project document metadata.
-- File bodies remain in Google Drive; DB stores metadata/link only.

CREATE OR REPLACE FUNCTION public.amd_os_can_access_project(p_project_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE lower(m.email) = lower(auth.email())
      AND (
        m.is_admin = true
        OR EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = p_project_id
            AND pm.member_id = m.member_id
            AND pm.is_active = true
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.amd_os_can_access_project(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.amd_os_can_access_project(text) TO authenticated;

DROP POLICY IF EXISTS project_documents_project_member_select ON public.project_documents;
CREATE POLICY project_documents_project_member_select
  ON public.project_documents
  FOR SELECT
  TO authenticated
  USING (public.amd_os_can_access_project(project_id));

DROP POLICY IF EXISTS project_documents_project_member_insert ON public.project_documents;
CREATE POLICY project_documents_project_member_insert
  ON public.project_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.amd_os_can_access_project(project_id));

DROP POLICY IF EXISTS project_documents_project_member_update ON public.project_documents;
CREATE POLICY project_documents_project_member_update
  ON public.project_documents
  FOR UPDATE
  TO authenticated
  USING (public.amd_os_can_access_project(project_id))
  WITH CHECK (public.amd_os_can_access_project(project_id));
