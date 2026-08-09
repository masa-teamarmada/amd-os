-- 248: 論点・仮説を解決するまでの議論を、結論で上書きせず追記履歴として保存する。

CREATE TABLE IF NOT EXISTS public.project_management_issue_discussions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  issue_id      uuid NOT NULL REFERENCES public.project_management_issues(id) ON DELETE CASCADE,
  summary       text NOT NULL,
  discussed_on  date NOT NULL,
  created_by    text NOT NULL REFERENCES public.members(member_id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_management_issue_discussions_summary_check_248
    CHECK (char_length(btrim(summary)) BETWEEN 1 AND 1600)
);

CREATE INDEX IF NOT EXISTS project_management_issue_discussions_issue_date_idx_248
  ON public.project_management_issue_discussions(project_id, issue_id, discussed_on DESC, created_at DESC);

-- issue_id と project_id が同じPJを指すことをDBでも保証する。
CREATE OR REPLACE FUNCTION public.project_management_validate_issue_discussion_248()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.project_management_issues AS issue
    WHERE issue.id = NEW.issue_id
      AND issue.project_id = NEW.project_id
      AND issue.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'issue discussion must reference a live issue in the same project';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_management_issue_discussions_validate_248
  ON public.project_management_issue_discussions;
CREATE TRIGGER project_management_issue_discussions_validate_248
  BEFORE INSERT OR UPDATE ON public.project_management_issue_discussions
  FOR EACH ROW EXECUTE FUNCTION public.project_management_validate_issue_discussion_248();

GRANT SELECT, INSERT ON public.project_management_issue_discussions TO authenticated;
GRANT ALL ON public.project_management_issue_discussions TO service_role;

ALTER TABLE public.project_management_issue_discussions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_management_issue_discussions_member_select
  ON public.project_management_issue_discussions;
CREATE POLICY project_management_issue_discussions_member_select
  ON public.project_management_issue_discussions FOR SELECT TO authenticated
  USING (public.amd_os_can_access_project(project_id));

DROP POLICY IF EXISTS project_management_issue_discussions_manager_insert
  ON public.project_management_issue_discussions;
CREATE POLICY project_management_issue_discussions_manager_insert
  ON public.project_management_issue_discussions FOR INSERT TO authenticated
  WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_management_issue_discussions_service_all
  ON public.project_management_issue_discussions;
CREATE POLICY project_management_issue_discussions_service_all
  ON public.project_management_issue_discussions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.project_management_issue_discussions IS
  'Append-only discussion progress for a management issue. Each row preserves what was learned or remains unresolved at that point in time.';
COMMENT ON COLUMN public.project_management_issue_discussions.summary IS
  'Short progress note: what was discussed, learned, or remains as a question.';
