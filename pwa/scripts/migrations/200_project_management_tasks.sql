-- 200_project_management_tasks.sql
-- 週次管制ガントの子タスク専用テーブル。legacy `tasks` / `/api/tasks` とは別物 (data boundary:
-- pwa/spec/5-7-task-management-current-spec.md)。milestone配下 + self parent の階層。
-- seedなし。project_management_* 既存慣行 (soft-delete/version/audit/provenance) に合わせる。

CREATE TABLE IF NOT EXISTS public.project_management_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES public.project_management_milestones(id) ON DELETE CASCADE,
  parent_task_id uuid REFERENCES public.project_management_tasks(id) ON DELETE SET NULL,
  track text CHECK (track IS NULL OR track IN ('business_development', 'technology_development', 'funding', 'organizational_building')),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'unassessed' CHECK (status IN ('unassessed', 'on_track', 'attention', 'at_risk', 'blocked', 'completed')),
  planned_start date,
  planned_end date,
  forecast_end date,
  actual_end date,
  progress_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  date_certainty text NOT NULL DEFAULT 'provisional' CHECK (date_certainty IN ('confirmed', 'provisional')),
  owner_member_id text REFERENCES public.members(member_id),
  owner_label text NOT NULL DEFAULT '担当未確認',
  completion_criteria text,
  forecast_change_reason text,
  sort_order int4 NOT NULL DEFAULT 0,
  last_verified_at date NOT NULL DEFAULT CURRENT_DATE,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by text,
  version int4 NOT NULL DEFAULT 1,
  CHECK (planned_start IS NULL OR planned_end IS NULL OR planned_start <= planned_end)
);

CREATE INDEX IF NOT EXISTS project_management_tasks_project_id_idx ON public.project_management_tasks(project_id);
CREATE INDEX IF NOT EXISTS project_management_tasks_milestone_id_idx ON public.project_management_tasks(project_id, milestone_id, sort_order);
CREATE INDEX IF NOT EXISTS project_management_tasks_parent_task_id_idx ON public.project_management_tasks(project_id, parent_task_id, sort_order);

CREATE OR REPLACE FUNCTION public.project_management_task_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  milestone_project text;
  parent_project text;
  parent_milestone uuid;
  parent_deleted timestamptz;
  creates_cycle boolean;
BEGIN
  SELECT project_id INTO milestone_project
  FROM public.project_management_milestones
  WHERE id = NEW.milestone_id AND deleted_at IS NULL;
  IF milestone_project IS NULL OR milestone_project <> NEW.project_id THEN
    RAISE EXCEPTION 'task milestone must stay inside the project' USING ERRCODE = '23514';
  END IF;

  IF NEW.parent_task_id IS NOT NULL THEN
    SELECT project_id, milestone_id, deleted_at
      INTO parent_project, parent_milestone, parent_deleted
    FROM public.project_management_tasks
    WHERE id = NEW.parent_task_id;
    IF parent_project IS NULL OR parent_deleted IS NOT NULL
       OR parent_project <> NEW.project_id OR parent_milestone <> NEW.milestone_id THEN
      RAISE EXCEPTION 'parent task must be active and in the same project and milestone' USING ERRCODE = '23514';
    END IF;
    IF NEW.parent_task_id = NEW.id THEN
      RAISE EXCEPTION 'task cannot be its own parent' USING ERRCODE = '23514';
    END IF;
    WITH RECURSIVE ancestors(id, parent_task_id) AS (
      SELECT t.id, t.parent_task_id
      FROM public.project_management_tasks t
      WHERE t.id = NEW.parent_task_id
      UNION ALL
      SELECT t.id, t.parent_task_id
      FROM public.project_management_tasks t
      JOIN ancestors a ON t.id = a.parent_task_id
      WHERE t.project_id = NEW.project_id
    )
    SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = NEW.id) INTO creates_cycle;
    IF creates_cycle THEN
      RAISE EXCEPTION 'task hierarchy would create a cycle' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_management_tasks_guard ON public.project_management_tasks;
CREATE TRIGGER project_management_tasks_guard
BEFORE INSERT OR UPDATE OF project_id, milestone_id, parent_task_id
ON public.project_management_tasks
FOR EACH ROW EXECUTE FUNCTION public.project_management_task_guard();

DROP TRIGGER IF EXISTS project_management_tasks_touch_updated_at ON public.project_management_tasks;
CREATE TRIGGER project_management_tasks_touch_updated_at
BEFORE UPDATE ON public.project_management_tasks
FOR EACH ROW EXECUTE FUNCTION public.project_management_touch_updated_at();

DROP TRIGGER IF EXISTS project_management_tasks_block_delete ON public.project_management_tasks;
CREATE TRIGGER project_management_tasks_block_delete
BEFORE DELETE ON public.project_management_tasks
FOR EACH ROW EXECUTE FUNCTION public.project_management_block_authenticated_delete();

DROP TRIGGER IF EXISTS project_management_tasks_field_audit ON public.project_management_tasks;
CREATE TRIGGER project_management_tasks_field_audit
AFTER INSERT OR UPDATE ON public.project_management_tasks
FOR EACH ROW EXECUTE FUNCTION public.project_management_audit_fields();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_management_tasks TO authenticated, service_role;
ALTER TABLE public.project_management_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_management_tasks_member_select ON public.project_management_tasks;
CREATE POLICY project_management_tasks_member_select
ON public.project_management_tasks FOR SELECT TO authenticated
USING (public.amd_os_can_access_project(project_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS project_management_tasks_manager_insert ON public.project_management_tasks;
CREATE POLICY project_management_tasks_manager_insert
ON public.project_management_tasks FOR INSERT TO authenticated
WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_management_tasks_manager_update ON public.project_management_tasks;
CREATE POLICY project_management_tasks_manager_update
ON public.project_management_tasks FOR UPDATE TO authenticated
USING (public.amd_os_can_manage_project_shared_data(project_id))
WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_management_tasks_service_all ON public.project_management_tasks;
CREATE POLICY project_management_tasks_service_all
ON public.project_management_tasks FOR ALL TO service_role
USING (true) WITH CHECK (true);
