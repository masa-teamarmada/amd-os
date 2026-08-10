-- SX weekly-control task-only Gantt.
--
-- `timeline_kind='phase'` has historically been both a displayed engineering row and the
-- non-null FK container for tasks and several other SX records. Deleting it would break those
-- records. Keep it as a private compatibility container, promote its visible facts into a real
-- root task, and reparent only its direct task children. The weekly-control UI renders the task
-- tree and point milestones only; it never renders these phase rows.

ALTER TABLE public.project_management_tasks
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS next_deliverable text,
  ADD COLUMN IF NOT EXISTS blocker text;

COMMENT ON COLUMN public.project_management_tasks.goal IS
  'Operational goal owned by the task. Used by SX task-only gantt root tasks promoted from legacy phase containers.';
COMMENT ON COLUMN public.project_management_tasks.next_deliverable IS
  'Next concrete deliverable for the task. Preserves legacy phase next_deliverable when promoted.';
COMMENT ON COLUMN public.project_management_tasks.blocker IS
  'Current blockage for the task. Preserves legacy phase max_issue when promoted.';

-- Idempotent source_ref makes the conversion safe when migration runners retry after an
-- interrupted deployment. Keep the phase id in the marker so one hidden container maps to one
-- visible root task without guessing by title.
INSERT INTO public.project_management_tasks (
  project_id, milestone_id, parent_task_id, track, title, description, status,
  planned_start, planned_end, forecast_end, actual_end, progress_pct,
  date_certainty, owner_member_id, owner_label, goal, next_deliverable, blocker,
  completion_criteria, forecast_change_reason, sort_order, last_verified_at,
  confidence, source_kind, source_ref, created_by, updated_by
)
SELECT
  m.project_id, m.id, NULL, m.track, m.title, NULL, m.status,
  m.planned_start, m.planned_end, m.forecast_end, m.actual_end, m.progress_pct,
  m.date_certainty, m.owner_member_id, m.owner_label, m.gate, m.next_deliverable,
  m.max_issue, m.completion_criteria, m.forecast_change_reason,
  m.sort_order * 1000, m.last_verified_at, m.confidence, m.source_kind,
  'ui-root-from-phase:' || m.id::text, m.created_by, m.updated_by
FROM public.project_management_milestones m
WHERE m.project_id = 'p21'
  AND m.deleted_at IS NULL
  AND m.timeline_kind = 'phase'
  AND NOT EXISTS (
    SELECT 1
    FROM public.project_management_tasks existing
    WHERE existing.project_id = m.project_id
      AND existing.source_ref = 'ui-root-from-phase:' || m.id::text
      AND existing.deleted_at IS NULL
  );

-- Give every existing task a concrete display lane. This leaves manually supplied tracks
-- untouched and uses the internal compatibility container only as the source of a missing value.
UPDATE public.project_management_tasks t
SET track = m.track
FROM public.project_management_milestones m
WHERE t.project_id = 'p21'
  AND t.deleted_at IS NULL
  AND m.id = t.milestone_id
  AND m.project_id = t.project_id
  AND t.track IS NULL;

-- Only direct children move under the generated root. Their descendants remain attached to the
-- same direct child, preserving the existing hierarchy and all schedule/dependency ids.
UPDATE public.project_management_tasks t
SET parent_task_id = root.id
FROM public.project_management_tasks root
WHERE t.project_id = 'p21'
  AND t.deleted_at IS NULL
  AND t.parent_task_id IS NULL
  AND root.project_id = t.project_id
  AND root.deleted_at IS NULL
  AND root.milestone_id = t.milestone_id
  AND root.source_ref = 'ui-root-from-phase:' || t.milestone_id::text
  AND t.id <> root.id;
