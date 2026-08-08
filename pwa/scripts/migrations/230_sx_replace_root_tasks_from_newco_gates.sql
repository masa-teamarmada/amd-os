-- SX weekly-control: replace every currently visible p21 task with the nine root tasks agreed
-- from the two NewCo prerequisite milestones, then connect the strict finish-to-start chain into
-- each milestone. Keep the two milestone records themselves.
--
-- Existing tasks and their schedule links are recoverably hidden, never physically deleted.
-- Fixed replacement ids make the migration retry-safe without reviving a task later hidden by a
-- user. All nine rows are intentionally root tasks; child tasks can be added later from the UI.

BEGIN;

-- Schedule links used to accept only a task as their destination. A gate-ending chain needs the
-- milestone diamond itself to be a valid target, while preserving every existing task-target row.
ALTER TABLE public.project_management_schedule_dependencies
  ADD COLUMN IF NOT EXISTS successor_type text,
  ADD COLUMN IF NOT EXISTS successor_milestone_id uuid
    REFERENCES public.project_management_milestones(id) ON DELETE CASCADE;

UPDATE public.project_management_schedule_dependencies
SET successor_type = 'task'
WHERE successor_type IS NULL;

ALTER TABLE public.project_management_schedule_dependencies
  ALTER COLUMN successor_type SET DEFAULT 'task',
  ALTER COLUMN successor_type SET NOT NULL,
  ALTER COLUMN successor_task_id DROP NOT NULL;

COMMENT ON COLUMN public.project_management_schedule_dependencies.successor_type IS
  'Schedule target kind: task or milestone.';
COMMENT ON COLUMN public.project_management_schedule_dependencies.successor_milestone_id IS
  'Milestone target when successor_type is milestone.';

ALTER TABLE public.project_management_schedule_dependencies
  DROP CONSTRAINT IF EXISTS project_management_schedule_dependencies_successor_check,
  ADD CONSTRAINT project_management_schedule_dependencies_successor_check CHECK (
    (successor_type = 'task' AND successor_task_id IS NOT NULL AND successor_milestone_id IS NULL)
    OR
    (successor_type = 'milestone' AND successor_task_id IS NULL AND successor_milestone_id IS NOT NULL)
  ),
  DROP CONSTRAINT IF EXISTS project_management_schedule_dependencies_endpoint_distinct_check,
  ADD CONSTRAINT project_management_schedule_dependencies_endpoint_distinct_check CHECK (
    predecessor_type <> successor_type
    OR predecessor_type = 'task' AND predecessor_task_id <> successor_task_id
    OR predecessor_type = 'milestone' AND predecessor_milestone_id <> successor_milestone_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS project_management_schedule_dependencies_task_to_milestone_unique
  ON public.project_management_schedule_dependencies(
    project_id,
    predecessor_task_id,
    successor_milestone_id
  )
  WHERE deleted_at IS NULL
    AND predecessor_task_id IS NOT NULL
    AND successor_milestone_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS project_management_schedule_dependencies_milestone_to_milestone_unique
  ON public.project_management_schedule_dependencies(
    project_id,
    predecessor_milestone_id,
    successor_milestone_id
  )
  WHERE deleted_at IS NULL
    AND predecessor_milestone_id IS NOT NULL
    AND successor_milestone_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS project_management_schedule_dependencies_successor_milestone_idx
  ON public.project_management_schedule_dependencies(successor_milestone_id)
  WHERE deleted_at IS NULL AND successor_milestone_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.project_management_schedule_dependency_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  predecessor_project text;
  successor_project text;
  successor_task_milestone uuid;
  source_node text;
  target_node text;
  creates_cycle boolean;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Always lock task endpoints first and milestone endpoints second. Sorting within each table
  -- keeps opposite concurrent links on the same deterministic lock order.
  PERFORM 1
  FROM public.project_management_tasks
  WHERE id IN (NEW.predecessor_task_id, NEW.successor_task_id)
    AND deleted_at IS NULL
  ORDER BY id
  FOR UPDATE;

  PERFORM 1
  FROM public.project_management_milestones
  WHERE id IN (NEW.predecessor_milestone_id, NEW.successor_milestone_id)
    AND deleted_at IS NULL
  ORDER BY id
  FOR UPDATE;

  IF NEW.predecessor_type = 'task' THEN
    SELECT project_id INTO predecessor_project
    FROM public.project_management_tasks
    WHERE id = NEW.predecessor_task_id AND deleted_at IS NULL;
    source_node := 'task:' || NEW.predecessor_task_id::text;
  ELSE
    SELECT project_id INTO predecessor_project
    FROM public.project_management_milestones
    WHERE id = NEW.predecessor_milestone_id AND deleted_at IS NULL;
    source_node := 'milestone:' || NEW.predecessor_milestone_id::text;
  END IF;

  IF predecessor_project IS NULL OR predecessor_project <> NEW.project_id THEN
    RAISE EXCEPTION 'schedule dependency predecessor must be active and inside the project'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.successor_type = 'task' THEN
    SELECT project_id, milestone_id INTO successor_project, successor_task_milestone
    FROM public.project_management_tasks
    WHERE id = NEW.successor_task_id AND deleted_at IS NULL;
    target_node := 'task:' || NEW.successor_task_id::text;
  ELSE
    SELECT project_id INTO successor_project
    FROM public.project_management_milestones
    WHERE id = NEW.successor_milestone_id AND deleted_at IS NULL;
    target_node := 'milestone:' || NEW.successor_milestone_id::text;
  END IF;

  IF successor_project IS NULL OR successor_project <> NEW.project_id THEN
    RAISE EXCEPTION 'schedule dependency successor must be active and inside the project'
      USING ERRCODE = '23514';
  END IF;

  -- A milestone cannot finish before a task structurally owned by that same milestone starts.
  -- The reverse task -> owning milestone is valid and is how the final task reaches its gate.
  IF NEW.predecessor_type = 'milestone'
     AND NEW.successor_type = 'task'
     AND successor_task_milestone = NEW.predecessor_milestone_id THEN
    RAISE EXCEPTION 'a milestone cannot gate a task that belongs to itself'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('sx-gantt-dependency:' || NEW.project_id, 0));

  -- Validate one graph containing both tasks and milestones. Adding source -> target is cyclic
  -- exactly when target already reaches source through the active mixed-node graph.
  WITH RECURSIVE reachable(node_key) AS (
    SELECT target_node
    UNION
    SELECT CASE
      WHEN edge.successor_type = 'task'
        THEN 'task:' || edge.successor_task_id::text
      ELSE 'milestone:' || edge.successor_milestone_id::text
    END
    FROM public.project_management_schedule_dependencies edge
    JOIN reachable current_node
      ON current_node.node_key = CASE
        WHEN edge.predecessor_type = 'task'
          THEN 'task:' || edge.predecessor_task_id::text
        ELSE 'milestone:' || edge.predecessor_milestone_id::text
      END
    WHERE edge.project_id = NEW.project_id
      AND edge.deleted_at IS NULL
      AND edge.id IS DISTINCT FROM NEW.id
  )
  SELECT EXISTS (
    SELECT 1 FROM reachable WHERE node_key = source_node
  ) INTO creates_cycle;

  IF creates_cycle THEN
    RAISE EXCEPTION 'schedule dependency would create a cycle' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_management_schedule_dependencies_guard
  ON public.project_management_schedule_dependencies;
CREATE TRIGGER project_management_schedule_dependencies_guard
BEFORE INSERT OR UPDATE OF project_id, predecessor_type, predecessor_task_id,
  predecessor_milestone_id, successor_type, successor_task_id,
  successor_milestone_id, deleted_at
ON public.project_management_schedule_dependencies
FOR EACH ROW EXECUTE FUNCTION public.project_management_schedule_dependency_guard();

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
          AND edge.successor_type = 'task'
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
            OR edge.successor_milestone_id = OLD.id
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

DO $$
DECLARE
  required_milestone_count integer;
BEGIN
  SELECT count(*)
    INTO required_milestone_count
  FROM public.project_management_milestones
  WHERE project_id = 'p21'
    AND deleted_at IS NULL
    AND slug IN (
      'business-paid-poc-oral-agreement',
      'funding-investment-oral-agreement'
    );

  IF required_milestone_count <> 2 THEN
    RAISE EXCEPTION
      'SX parent-task replacement requires exactly two active prerequisite milestones; found %',
      required_milestone_count;
  END IF;
END;
$$;

-- Endpoint guards require active schedule links to be disconnected before their tasks are hidden.
-- Apply this visibility change only on the first run; the fixed replacement ids are the marker.
WITH migration_guard AS (
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.project_management_tasks
    WHERE id = '1823647a-67f7-4274-8ddb-0e9b7cae4523'::uuid
  ) AS should_apply
)
UPDATE public.project_management_schedule_dependencies
SET
  deleted_at = now(),
  deleted_by = 'migration:230_sx_replace_root_tasks_from_newco_gates'
WHERE project_id = 'p21'
  AND deleted_at IS NULL
  AND (SELECT should_apply FROM migration_guard);

WITH migration_guard AS (
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.project_management_tasks
    WHERE id = '1823647a-67f7-4274-8ddb-0e9b7cae4523'::uuid
  ) AS should_apply
)
UPDATE public.project_management_tasks
SET
  deleted_at = now(),
  deleted_by = 'migration:230_sx_replace_root_tasks_from_newco_gates'
WHERE project_id = 'p21'
  AND deleted_at IS NULL
  AND (SELECT should_apply FROM migration_guard);

WITH seed(id, milestone_slug, track, title, sort_order) AS (
  VALUES
    (
      '1823647a-67f7-4274-8ddb-0e9b7cae4523'::uuid,
      'business-paid-poc-oral-agreement',
      'business_development',
      '対象企業と、有償で導入検討するための判断条件を定める',
      100
    ),
    (
      'fdc90bb4-b84f-4095-8772-ac3774ca9449'::uuid,
      'business-paid-poc-oral-agreement',
      'technology_development',
      '実排液で判断条件を検証できるPoC装置を完成させる',
      100
    ),
    (
      'c1c61414-b365-462e-a9ab-b6dbb6874fd4'::uuid,
      'business-paid-poc-oral-agreement',
      'technology_development',
      '実排液で、費用を払う価値がある成果を実証する',
      200
    ),
    (
      '21c2a6fc-746e-46f4-9a54-6fd2eb4533b9'::uuid,
      'business-paid-poc-oral-agreement',
      'business_development',
      '1社に有償PoCを提案し、条件交渉を完了する',
      200
    ),
    (
      '26786914-db5f-47a9-ae9c-87a35e680441'::uuid,
      'funding-investment-oral-agreement',
      'business_development',
      'ユニットエコノミクスの成立性を検証する',
      300
    ),
    (
      'b2fc7be2-9591-42b3-a132-4257a79ae8d5'::uuid,
      'funding-investment-oral-agreement',
      'organizational_building',
      'NewCoの事業実行体制と権利関係を固める',
      100
    ),
    (
      '59d0da31-8f30-4639-b14c-a7b25745d81f'::uuid,
      'funding-investment-oral-agreement',
      'business_development',
      '投資判断に耐える事業計画を完成させる',
      400
    ),
    (
      '5b8bd75d-df8a-4a7c-bee5-aaad79873723'::uuid,
      'funding-investment-oral-agreement',
      'business_development',
      '出資候補を絞り、DDを完了する',
      500
    ),
    (
      '504ef913-7f24-4ca6-a580-e957d06c7809'::uuid,
      'funding-investment-oral-agreement',
      'business_development',
      '出資条件の交渉を完了する',
      600
    )
)
INSERT INTO public.project_management_tasks (
  id, project_id, milestone_id, parent_task_id, track, title, status,
  progress_pct, date_certainty, owner_label, sort_order, last_verified_at,
  confidence, source_kind, source_ref, created_by, updated_by
)
SELECT
  seed.id,
  'p21',
  milestone.id,
  NULL,
  seed.track,
  seed.title,
  'unassessed',
  0,
  'provisional',
  '担当未確認',
  seed.sort_order,
  CURRENT_DATE,
  'unknown',
  'manual',
  '2026-08-05 合意済みMS逆算親タスク9件',
  'migration:230_sx_replace_root_tasks_from_newco_gates',
  'migration:230_sx_replace_root_tasks_from_newco_gates'
FROM seed
JOIN public.project_management_milestones milestone
  ON milestone.project_id = 'p21'
 AND milestone.slug = seed.milestone_slug
 AND milestone.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.project_management_tasks existing
  WHERE existing.id = seed.id
);

-- Only strict finish-to-start dependencies are seeded. Work that can proceed in parallel is not
-- connected merely because it contributes to the same MS.
WITH edge(
  id,
  predecessor_type,
  predecessor_id,
  successor_type,
  successor_task_id,
  successor_milestone_slug
) AS (
  VALUES
    (
      'efa5027d-5a5f-4b7d-aebb-99601ffa987e'::uuid,
      'task',
      '1823647a-67f7-4274-8ddb-0e9b7cae4523'::uuid,
      'task',
      'fdc90bb4-b84f-4095-8772-ac3774ca9449'::uuid,
      NULL::text
    ),
    (
      '7d09d2a5-3b14-45da-8d31-4cd858cade17'::uuid,
      'task',
      'fdc90bb4-b84f-4095-8772-ac3774ca9449'::uuid,
      'task',
      'c1c61414-b365-462e-a9ab-b6dbb6874fd4'::uuid,
      NULL::text
    ),
    (
      '3849b7b9-2bc3-41fa-a638-d9db37549951'::uuid,
      'task',
      'c1c61414-b365-462e-a9ab-b6dbb6874fd4'::uuid,
      'task',
      '21c2a6fc-746e-46f4-9a54-6fd2eb4533b9'::uuid,
      NULL::text
    ),
    (
      '62c1dc7a-589d-47ce-95e1-5edcdbf63024'::uuid,
      'task',
      '21c2a6fc-746e-46f4-9a54-6fd2eb4533b9'::uuid,
      'milestone',
      NULL::uuid,
      'business-paid-poc-oral-agreement'
    ),
    (
      '34639659-a2ab-46ea-9cb9-5bfc8cc78bad'::uuid,
      'task',
      '26786914-db5f-47a9-ae9c-87a35e680441'::uuid,
      'task',
      '59d0da31-8f30-4639-b14c-a7b25745d81f'::uuid,
      NULL::text
    ),
    (
      'ab31b8e9-f444-4c39-8bb5-8a9c873fd177'::uuid,
      'task',
      'b2fc7be2-9591-42b3-a132-4257a79ae8d5'::uuid,
      'task',
      '59d0da31-8f30-4639-b14c-a7b25745d81f'::uuid,
      NULL::text
    ),
    (
      '85791183-3189-4421-9e7e-f064939bd225'::uuid,
      'task',
      '59d0da31-8f30-4639-b14c-a7b25745d81f'::uuid,
      'task',
      '5b8bd75d-df8a-4a7c-bee5-aaad79873723'::uuid,
      NULL::text
    ),
    (
      '36597478-65a7-4b41-a9ce-d580677286a3'::uuid,
      'task',
      '5b8bd75d-df8a-4a7c-bee5-aaad79873723'::uuid,
      'task',
      '504ef913-7f24-4ca6-a580-e957d06c7809'::uuid,
      NULL::text
    ),
    (
      '0b3e1025-2a9c-4f3a-ab65-1671ffb667ef'::uuid,
      'task',
      '504ef913-7f24-4ca6-a580-e957d06c7809'::uuid,
      'milestone',
      NULL::uuid,
      'funding-investment-oral-agreement'
    )
)
INSERT INTO public.project_management_schedule_dependencies (
  id,
  project_id,
  predecessor_type,
  predecessor_task_id,
  predecessor_milestone_id,
  successor_type,
  successor_task_id,
  successor_milestone_id,
  dependency_type,
  created_by,
  updated_by
)
SELECT
  edge.id,
  'p21',
  edge.predecessor_type,
  CASE WHEN edge.predecessor_type = 'task' THEN edge.predecessor_id ELSE NULL END,
  CASE WHEN edge.predecessor_type = 'milestone' THEN edge.predecessor_id ELSE NULL END,
  edge.successor_type,
  edge.successor_task_id,
  successor_milestone.id,
  'finish_to_start',
  'migration:230_sx_replace_root_tasks_from_newco_gates',
  'migration:230_sx_replace_root_tasks_from_newco_gates'
FROM edge
LEFT JOIN public.project_management_milestones successor_milestone
  ON edge.successor_type = 'milestone'
 AND successor_milestone.project_id = 'p21'
 AND successor_milestone.slug = edge.successor_milestone_slug
 AND successor_milestone.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.project_management_schedule_dependencies existing
  WHERE existing.id = edge.id
);

DO $$
DECLARE
  active_task_count integer;
  active_replacement_count integer;
  active_dependency_count integer;
  active_task_target_count integer;
  paid_poc_milestone_link_count integer;
  funding_milestone_link_count integer;
BEGIN
  SELECT count(*)
    INTO active_task_count
  FROM public.project_management_tasks
  WHERE project_id = 'p21'
    AND deleted_at IS NULL;

  SELECT count(*)
    INTO active_replacement_count
  FROM public.project_management_tasks
  WHERE project_id = 'p21'
    AND deleted_at IS NULL
    AND parent_task_id IS NULL
    AND source_ref = '2026-08-05 合意済みMS逆算親タスク9件';

  SELECT count(*)
    INTO active_dependency_count
  FROM public.project_management_schedule_dependencies
  WHERE project_id = 'p21'
    AND deleted_at IS NULL;

  SELECT count(*)
    INTO active_task_target_count
  FROM public.project_management_schedule_dependencies
  WHERE project_id = 'p21'
    AND deleted_at IS NULL
    AND successor_type = 'task';

  SELECT count(*)
    INTO paid_poc_milestone_link_count
  FROM public.project_management_schedule_dependencies edge
  JOIN public.project_management_milestones milestone
    ON milestone.id = edge.successor_milestone_id
   AND milestone.project_id = edge.project_id
   AND milestone.deleted_at IS NULL
  WHERE edge.project_id = 'p21'
    AND edge.deleted_at IS NULL
    AND edge.predecessor_task_id = '21c2a6fc-746e-46f4-9a54-6fd2eb4533b9'::uuid
    AND edge.successor_type = 'milestone'
    AND milestone.slug = 'business-paid-poc-oral-agreement';

  SELECT count(*)
    INTO funding_milestone_link_count
  FROM public.project_management_schedule_dependencies edge
  JOIN public.project_management_milestones milestone
    ON milestone.id = edge.successor_milestone_id
   AND milestone.project_id = edge.project_id
   AND milestone.deleted_at IS NULL
  WHERE edge.project_id = 'p21'
    AND edge.deleted_at IS NULL
    AND edge.predecessor_task_id = '504ef913-7f24-4ca6-a580-e957d06c7809'::uuid
    AND edge.successor_type = 'milestone'
    AND milestone.slug = 'funding-investment-oral-agreement';

  IF active_task_count <> 9 OR active_replacement_count <> 9 THEN
    RAISE EXCEPTION
      'SX parent-task replacement must leave exactly nine active root tasks; active %, replacement %',
      active_task_count,
      active_replacement_count;
  END IF;

  IF active_dependency_count <> 9
     OR active_task_target_count <> 7
     OR paid_poc_milestone_link_count <> 1
     OR funding_milestone_link_count <> 1
  THEN
    RAISE EXCEPTION
      'SX parent-task replacement links invalid; total %, task targets %, paid MS %, funding MS %',
      active_dependency_count,
      active_task_target_count,
      paid_poc_milestone_link_count,
      funding_milestone_link_count;
  END IF;
END;
$$;

COMMIT;
