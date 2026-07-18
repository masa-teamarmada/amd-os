-- 182_project_scoped_workspace.sql
-- AMD OS portfolio users keep the all-project surface.
-- Pre-registered external members receive a project-only home and may only
-- access projects where project_members.is_active = true.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS os_access_scope text NOT NULL DEFAULT 'portfolio';

ALTER TABLE public.members
  DROP CONSTRAINT IF EXISTS members_os_access_scope_check;

ALTER TABLE public.members
  ADD CONSTRAINT members_os_access_scope_check
  CHECK (os_access_scope IN ('portfolio', 'project'));

COMMENT ON COLUMN public.members.os_access_scope IS
  'portfolio = AMD all-project workspace; project = active project_members rows only.';

-- Existing internal-only tables use amd_os_is_member() as their broad gate.
-- Project-only users authenticate into a narrow signed PWA session, not a
-- Supabase session, and this stricter definition is defense in depth if a
-- stale provider session ever survives the OAuth callback.
CREATE OR REPLACE FUNCTION public.amd_os_is_member()
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
      AND m.status = 'active'
      AND (m.is_admin = true OR m.os_access_scope = 'portfolio')
  );
$$;

REVOKE ALL ON FUNCTION public.amd_os_is_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.amd_os_is_member() TO authenticated;

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
      AND m.status = 'active'
      AND (
        m.is_admin = true
        OR m.os_access_scope = 'portfolio'
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

CREATE OR REPLACE FUNCTION public.amd_os_can_manage_project_effort(
  p_project_id text,
  p_member_id text
)
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
      AND m.status = 'active'
      AND (
        m.is_admin = true
        OR m.os_access_scope = 'portfolio'
        OR (
          m.member_id = p_member_id
          AND EXISTS (
            SELECT 1
            FROM public.project_members pm
            WHERE pm.project_id = p_project_id
              AND pm.member_id = m.member_id
              AND pm.is_active = true
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.amd_os_can_manage_project_effort(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.amd_os_can_manage_project_effort(text, text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.project_weekly_effort_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id),
  member_id text NOT NULL REFERENCES public.members(member_id),
  week_start date NOT NULL,
  work_category text NOT NULL CHECK (
    work_category IN ('basic', 'applied', 'development', 'su', 'coordination')
  ),
  planned_hours numeric(6,2) NOT NULL DEFAULT 0 CHECK (planned_hours >= 0 AND planned_hours <= 168),
  actual_hours numeric(6,2) NOT NULL DEFAULT 0 CHECK (actual_hours >= 0 AND actual_hours <= 168),
  note text,
  source_kind text NOT NULL DEFAULT 'manual' CHECK (
    source_kind IN ('manual', 'imported', 'inferred')
  ),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, member_id, week_start, work_category)
);

CREATE INDEX IF NOT EXISTS idx_project_weekly_effort_project_week
  ON public.project_weekly_effort_entries (project_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_project_weekly_effort_member_week
  ON public.project_weekly_effort_entries (member_id, week_start DESC);

ALTER TABLE public.project_weekly_effort_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_weekly_effort_member_select
  ON public.project_weekly_effort_entries;
CREATE POLICY project_weekly_effort_member_select
  ON public.project_weekly_effort_entries
  FOR SELECT
  TO authenticated
  USING (public.amd_os_can_access_project(project_id));

DROP POLICY IF EXISTS project_weekly_effort_member_insert
  ON public.project_weekly_effort_entries;
CREATE POLICY project_weekly_effort_member_insert
  ON public.project_weekly_effort_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (public.amd_os_can_manage_project_effort(project_id, member_id));

DROP POLICY IF EXISTS project_weekly_effort_member_update
  ON public.project_weekly_effort_entries;
CREATE POLICY project_weekly_effort_member_update
  ON public.project_weekly_effort_entries
  FOR UPDATE
  TO authenticated
  USING (public.amd_os_can_manage_project_effort(project_id, member_id))
  WITH CHECK (public.amd_os_can_manage_project_effort(project_id, member_id));

DROP POLICY IF EXISTS project_weekly_effort_member_delete
  ON public.project_weekly_effort_entries;
CREATE POLICY project_weekly_effort_member_delete
  ON public.project_weekly_effort_entries
  FOR DELETE
  TO authenticated
  USING (public.amd_os_can_manage_project_effort(project_id, member_id));

COMMENT ON TABLE public.project_weekly_effort_entries IS
  'Weekly planned/actual effort by project member and research-to-SU category.';
