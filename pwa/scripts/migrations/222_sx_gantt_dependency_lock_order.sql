-- 222_sx_gantt_dependency_lock_order.sql
-- Keep schedule-dependency graph writes and endpoint edits on one lock order:
-- endpoint row locks first, then the per-project advisory lock.

BEGIN;

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

COMMENT ON FUNCTION public.project_management_schedule_dependency_guard()
  IS 'Validates SX gantt finish-to-start links using endpoint-row then project-advisory lock order.';

COMMIT;
