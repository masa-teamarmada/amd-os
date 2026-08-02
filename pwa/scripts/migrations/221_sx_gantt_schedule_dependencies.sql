-- 221_sx_gantt_schedule_dependencies.sql
-- Directly editable finish-to-start links drawn in the weekly-control gantt.
--
-- This is deliberately separate from project_management_milestone_dependencies:
-- that older table drives gate/readiness logic between milestones.  The gantt links here are
-- schedule relationships whose predecessor can be a task or a milestone, and whose successor is
-- always a task.  Mixing the two would make a visual task link silently change NewCo gate logic.

BEGIN;

CREATE TABLE IF NOT EXISTS public.project_management_schedule_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  predecessor_type text NOT NULL CHECK (predecessor_type IN ('task', 'milestone')),
  predecessor_task_id uuid REFERENCES public.project_management_tasks(id) ON DELETE CASCADE,
  predecessor_milestone_id uuid REFERENCES public.project_management_milestones(id) ON DELETE CASCADE,
  successor_task_id uuid NOT NULL REFERENCES public.project_management_tasks(id) ON DELETE CASCADE,
  dependency_type text NOT NULL DEFAULT 'finish_to_start'
    CHECK (dependency_type = 'finish_to_start'),
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by text,
  version int4 NOT NULL DEFAULT 1,
  CHECK (
    (predecessor_type = 'task' AND predecessor_task_id IS NOT NULL AND predecessor_milestone_id IS NULL)
    OR
    (predecessor_type = 'milestone' AND predecessor_task_id IS NULL AND predecessor_milestone_id IS NOT NULL)
  ),
  CHECK (predecessor_task_id IS NULL OR predecessor_task_id <> successor_task_id)
);

ALTER TABLE public.project_management_schedule_dependencies
  ADD COLUMN IF NOT EXISTS updated_by text;

CREATE UNIQUE INDEX IF NOT EXISTS project_management_schedule_dependencies_task_unique
  ON public.project_management_schedule_dependencies(project_id, predecessor_task_id, successor_task_id)
  WHERE deleted_at IS NULL AND predecessor_task_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS project_management_schedule_dependencies_milestone_unique
  ON public.project_management_schedule_dependencies(project_id, predecessor_milestone_id, successor_task_id)
  WHERE deleted_at IS NULL AND predecessor_milestone_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS project_management_schedule_dependencies_successor_idx
  ON public.project_management_schedule_dependencies(project_id, successor_task_id)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.project_management_schedule_dependency_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  predecessor_project text;
  successor_project text;
  successor_milestone uuid;
  creates_cycle boolean;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Endpoint UPDATE triggers already own their row lock before they can take the project advisory
  -- lock. Keep the same order here (endpoint rows -> advisory lock) to avoid a row/advisory lock
  -- inversion. Task-to-task endpoints are locked by UUID order so opposite links cannot deadlock.
  IF NEW.predecessor_type = 'task' THEN
    PERFORM 1
    FROM public.project_management_tasks
    WHERE id IN (NEW.predecessor_task_id, NEW.successor_task_id)
      AND deleted_at IS NULL
    ORDER BY id
    FOR UPDATE;
  ELSE
    PERFORM 1
    FROM public.project_management_tasks
    WHERE id = NEW.successor_task_id AND deleted_at IS NULL
    FOR UPDATE;

    PERFORM 1
    FROM public.project_management_milestones
    WHERE id = NEW.predecessor_milestone_id AND deleted_at IS NULL
    FOR UPDATE;
  END IF;

  SELECT project_id, milestone_id INTO successor_project, successor_milestone
  FROM public.project_management_tasks
  WHERE id = NEW.successor_task_id AND deleted_at IS NULL;
  IF successor_project IS NULL OR successor_project <> NEW.project_id THEN
    RAISE EXCEPTION 'schedule dependency successor task must be active and inside the project'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.predecessor_type = 'task' THEN
    SELECT project_id INTO predecessor_project
    FROM public.project_management_tasks
    WHERE id = NEW.predecessor_task_id AND deleted_at IS NULL;
    IF predecessor_project IS NULL OR predecessor_project <> NEW.project_id THEN
      RAISE EXCEPTION 'schedule dependency predecessor task must be active and inside the project'
        USING ERRCODE = '23514';
    END IF;

    -- Serialize graph validation per project. Without this, two concurrent inserts could each
    -- pass the recursive cycle check before either new edge becomes visible to the other.
    PERFORM pg_advisory_xact_lock(hashtextextended('sx-gantt-dependency:' || NEW.project_id, 0));

    -- Adding predecessor -> successor is cyclic iff successor already reaches predecessor through
    -- active task-to-task schedule links.  Milestone predecessors cannot participate in a cycle
    -- because milestone targets are intentionally unsupported by this table.
    WITH RECURSIVE reachable(task_id) AS (
      SELECT NEW.successor_task_id
      UNION
      SELECT edge.successor_task_id
      FROM public.project_management_schedule_dependencies edge
      JOIN reachable r ON edge.predecessor_task_id = r.task_id
      WHERE edge.project_id = NEW.project_id
        AND edge.deleted_at IS NULL
        AND edge.predecessor_type = 'task'
        AND edge.id IS DISTINCT FROM NEW.id
    )
    SELECT EXISTS (
      SELECT 1 FROM reachable WHERE task_id = NEW.predecessor_task_id
    ) INTO creates_cycle;
    IF creates_cycle THEN
      RAISE EXCEPTION 'schedule dependency would create a task cycle' USING ERRCODE = '23514';
    END IF;
  ELSE
    SELECT project_id INTO predecessor_project
    FROM public.project_management_milestones
    WHERE id = NEW.predecessor_milestone_id AND deleted_at IS NULL;
    IF predecessor_project IS NULL OR predecessor_project <> NEW.project_id THEN
      RAISE EXCEPTION 'schedule dependency predecessor milestone must be active and inside the project'
        USING ERRCODE = '23514';
    END IF;
    IF successor_milestone = NEW.predecessor_milestone_id THEN
      RAISE EXCEPTION 'a milestone cannot gate a task that belongs to itself'
        USING ERRCODE = '23514';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('sx-gantt-dependency:' || NEW.project_id, 0));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_management_schedule_dependencies_guard
  ON public.project_management_schedule_dependencies;
CREATE TRIGGER project_management_schedule_dependencies_guard
BEFORE INSERT OR UPDATE OF project_id, predecessor_type, predecessor_task_id,
  predecessor_milestone_id, successor_task_id, deleted_at
ON public.project_management_schedule_dependencies
FOR EACH ROW EXECUTE FUNCTION public.project_management_schedule_dependency_guard();

-- Keep the invariant closed under later endpoint edits as well. Validating only when an edge is
-- inserted is insufficient: a task could otherwise be moved under its predecessor milestone, or
-- an endpoint could be soft-deleted while the live edge remains.
CREATE OR REPLACE FUNCTION public.project_management_schedule_endpoint_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  has_active_edge boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'sx-gantt-dependency:' || COALESCE(NEW.project_id, OLD.project_id),
      0
    )
  );

  IF TG_TABLE_NAME = 'project_management_tasks' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.project_management_schedule_dependencies edge
        WHERE edge.deleted_at IS NULL
          AND (edge.predecessor_task_id = OLD.id OR edge.successor_task_id = OLD.id)
      ) INTO has_active_edge;
      IF has_active_edge THEN
        RAISE EXCEPTION 'disconnect active gantt dependencies before deleting this task'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.project_management_schedule_dependencies edge
        WHERE edge.deleted_at IS NULL
          AND (edge.predecessor_task_id = OLD.id OR edge.successor_task_id = OLD.id)
      ) INTO has_active_edge;
      IF has_active_edge THEN
        RAISE EXCEPTION 'disconnect active gantt dependencies before moving this task to another project'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    IF NEW.deleted_at IS NULL AND NEW.milestone_id IS DISTINCT FROM OLD.milestone_id THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.project_management_schedule_dependencies edge
        WHERE edge.deleted_at IS NULL
          AND edge.predecessor_type = 'milestone'
          AND edge.predecessor_milestone_id = NEW.milestone_id
          AND edge.successor_task_id = NEW.id
      ) INTO has_active_edge;
      IF has_active_edge THEN
        RAISE EXCEPTION 'a task cannot move under the milestone that gates it'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'project_management_milestones' THEN
    IF
      (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
    THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.project_management_schedule_dependencies edge
        LEFT JOIN public.project_management_tasks source_task
          ON source_task.id = edge.predecessor_task_id
        LEFT JOIN public.project_management_tasks target_task
          ON target_task.id = edge.successor_task_id
        WHERE edge.deleted_at IS NULL
          AND (
            edge.predecessor_milestone_id = OLD.id
            OR source_task.milestone_id = OLD.id
            OR target_task.milestone_id = OLD.id
          )
      ) INTO has_active_edge;
      IF has_active_edge THEN
        RAISE EXCEPTION 'disconnect active gantt dependencies before deleting or moving this milestone'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_management_tasks_schedule_endpoint_guard
  ON public.project_management_tasks;
CREATE TRIGGER project_management_tasks_schedule_endpoint_guard
BEFORE UPDATE OF deleted_at, project_id, milestone_id
ON public.project_management_tasks
FOR EACH ROW EXECUTE FUNCTION public.project_management_schedule_endpoint_guard();

DROP TRIGGER IF EXISTS project_management_milestones_schedule_endpoint_guard
  ON public.project_management_milestones;
CREATE TRIGGER project_management_milestones_schedule_endpoint_guard
BEFORE UPDATE OF deleted_at, project_id
ON public.project_management_milestones
FOR EACH ROW EXECUTE FUNCTION public.project_management_schedule_endpoint_guard();

DROP TRIGGER IF EXISTS project_management_schedule_dependencies_touch_updated_at
  ON public.project_management_schedule_dependencies;
CREATE TRIGGER project_management_schedule_dependencies_touch_updated_at
BEFORE UPDATE ON public.project_management_schedule_dependencies
FOR EACH ROW EXECUTE FUNCTION public.project_management_touch_updated_at();

DROP TRIGGER IF EXISTS project_management_schedule_dependencies_block_delete
  ON public.project_management_schedule_dependencies;
CREATE TRIGGER project_management_schedule_dependencies_block_delete
BEFORE DELETE ON public.project_management_schedule_dependencies
FOR EACH ROW EXECUTE FUNCTION public.project_management_block_authenticated_delete();

DROP TRIGGER IF EXISTS project_management_schedule_dependencies_field_audit
  ON public.project_management_schedule_dependencies;
CREATE TRIGGER project_management_schedule_dependencies_field_audit
AFTER INSERT OR UPDATE ON public.project_management_schedule_dependencies
FOR EACH ROW EXECUTE FUNCTION public.project_management_audit_fields();

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.project_management_schedule_dependencies TO authenticated, service_role;
ALTER TABLE public.project_management_schedule_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_management_schedule_dependencies_member_select
  ON public.project_management_schedule_dependencies;
CREATE POLICY project_management_schedule_dependencies_member_select
ON public.project_management_schedule_dependencies FOR SELECT TO authenticated
USING (public.amd_os_can_access_project(project_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS project_management_schedule_dependencies_manager_insert
  ON public.project_management_schedule_dependencies;
CREATE POLICY project_management_schedule_dependencies_manager_insert
ON public.project_management_schedule_dependencies FOR INSERT TO authenticated
WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_management_schedule_dependencies_manager_update
  ON public.project_management_schedule_dependencies;
CREATE POLICY project_management_schedule_dependencies_manager_update
ON public.project_management_schedule_dependencies FOR UPDATE TO authenticated
USING (public.amd_os_can_manage_project_shared_data(project_id))
WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_management_schedule_dependencies_service_all
  ON public.project_management_schedule_dependencies;
CREATE POLICY project_management_schedule_dependencies_service_all
ON public.project_management_schedule_dependencies FOR ALL TO service_role
USING (true) WITH CHECK (true);

COMMENT ON TABLE public.project_management_schedule_dependencies IS
  'Manual gantt finish-to-start links. Predecessor is a task or milestone; successor is a task. Separate from gate/readiness milestone dependencies.';

COMMIT;
