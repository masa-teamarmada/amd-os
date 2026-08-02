-- 220_sx_gantt_direct_editing.sql
-- SX weekly-control gantt direct editing: an explicit timeline_kind so the
-- gantt stops inferring "is this a milestone diamond or a phase bar" from
-- slug, plus a planned date-range guard so drag-edited dates can never be
-- saved inverted (start after end). project_management_milestones and
-- project_management_tasks already carry an auto-incrementing `version`
-- column (added in migration 183/200 via project_management_touch_updated_at);
-- this migration does not touch that — the API layer wires expected_version
-- optimistic-concurrency checks against the existing column.

BEGIN;

-- -------------------------------------------------------------------------
-- 1. timeline_kind: 'phase' (工程, rendered as a bar) vs. 'milestone'
--    (MS, rendered as a diamond). Backfill the two existing founding
--    prerequisite gates, which are conceptually milestones even though the
--    gantt has so far rendered them via slug-specific BLOCKING_MILESTONE
--    handling rather than this column.
-- -------------------------------------------------------------------------

ALTER TABLE public.project_management_milestones
  ADD COLUMN IF NOT EXISTS timeline_kind text NOT NULL DEFAULT 'phase';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_milestones_timeline_kind_check'
      AND conrelid = 'public.project_management_milestones'::regclass
  ) THEN
    ALTER TABLE public.project_management_milestones
      ADD CONSTRAINT project_management_milestones_timeline_kind_check
      CHECK (timeline_kind IN ('phase', 'milestone'));
  END IF;
END $$;

-- Scoped to project_id='p21' (the only project these 2 slugs exist in) — this is a targeted
-- backfill for known rows, not a blanket slug match across every project this schema might ever
-- serve.
UPDATE public.project_management_milestones
SET timeline_kind = 'milestone'
WHERE project_id = 'p21'
  AND slug IN ('business-paid-poc-oral-agreement', 'funding-investment-oral-agreement')
  AND timeline_kind <> 'milestone';

COMMENT ON COLUMN public.project_management_milestones.timeline_kind IS 'phase = rendered as a gantt bar (工程追加); milestone = rendered as a diamond (MSを置く). Rendering must read this column, not infer from slug.';

-- -------------------------------------------------------------------------
-- 2. planned_start <= planned_end guard. Manual gantt-drag edits (move /
--    resize handles) must never be able to persist an inverted range.
--    Existing NULL-either-side rows are unaffected. Fail with a clear,
--    actionable exception (instead of an opaque constraint-violation error)
--    if any existing row would already block this check.
-- -------------------------------------------------------------------------

DO $$
DECLARE
  inverted_count int;
BEGIN
  SELECT count(*) INTO inverted_count
  FROM public.project_management_milestones
  WHERE planned_start IS NOT NULL AND planned_end IS NOT NULL AND planned_start > planned_end;
  IF inverted_count > 0 THEN
    RAISE EXCEPTION 'migration 220: % existing project_management_milestones row(s) have planned_start > planned_end — fix that data before this migration can add project_management_milestones_planned_range_check', inverted_count;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_milestones_planned_range_check'
      AND conrelid = 'public.project_management_milestones'::regclass
  ) THEN
    ALTER TABLE public.project_management_milestones
      ADD CONSTRAINT project_management_milestones_planned_range_check
      CHECK (planned_start IS NULL OR planned_end IS NULL OR planned_start <= planned_end);
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- 3. Generic point-MS invariant: any timeline_kind='milestone' row other than the 2 NewCo
--    founding-prerequisite gates must have planned_start/planned_end null together or equal (a
--    single day) — a generic MS is a point in time, not a range. The 2 blocking gates are
--    explicitly exempted: they may keep planned_start<planned_end with only the end diamond
--    draggable (SxUnifiedTimeline's "milestone-end-move" drag mode). The exemption is scoped to
--    project_id='p21' AND those 2 slugs (not slug alone) — mirrors the API's
--    isBlockingMilestoneSlug(projectId, slug) — so a same-named slug that might ever exist in a
--    different project never inherits this exemption.
-- -------------------------------------------------------------------------

DO $$
DECLARE
  non_point_count int;
BEGIN
  SELECT count(*) INTO non_point_count
  FROM public.project_management_milestones
  WHERE timeline_kind = 'milestone'
    AND NOT (
      project_id = 'p21'
      AND slug IN ('business-paid-poc-oral-agreement', 'funding-investment-oral-agreement')
    )
    AND planned_start IS DISTINCT FROM planned_end;
  IF non_point_count > 0 THEN
    RAISE EXCEPTION 'migration 220: % existing generic timeline_kind=milestone row(s) have planned_start<>planned_end — fix that data before this migration can add project_management_milestones_point_ms_check', non_point_count;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_milestones_point_ms_check'
      AND conrelid = 'public.project_management_milestones'::regclass
  ) THEN
    ALTER TABLE public.project_management_milestones
      ADD CONSTRAINT project_management_milestones_point_ms_check
      CHECK (
        timeline_kind <> 'milestone'
        OR (project_id = 'p21' AND slug IN ('business-paid-poc-oral-agreement', 'funding-investment-oral-agreement'))
        OR planned_start IS NOT DISTINCT FROM planned_end
      );
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- 4. Milestone parent integrity (general invariant, all projects, not just p21): a milestone's
--    outcome_id must belong to its own objective_id, and the outcome's track must equal the
--    milestone's own track. The API already enforces this on create/PATCH
--    (assertMilestoneParentIntegrity in route.ts) — this trigger is the DB-level backstop so the
--    invariant holds even for rows written outside that API path. Idempotent (safe to re-run) and
--    fails with a clear exception, in the same transaction, if existing data already violates it.
-- -------------------------------------------------------------------------

DO $$
DECLARE
  mismatch_count int;
BEGIN
  SELECT count(*) INTO mismatch_count
  FROM public.project_management_milestones m
  LEFT JOIN public.project_management_outcomes o ON o.id = m.outcome_id
  LEFT JOIN public.project_management_objectives obj ON obj.id = m.objective_id
  WHERE m.deleted_at IS NULL
    AND (
       o.id IS NULL
     OR obj.id IS NULL
     OR o.deleted_at IS NOT NULL
     OR obj.deleted_at IS NOT NULL
     OR o.project_id IS DISTINCT FROM m.project_id
     OR obj.project_id IS DISTINCT FROM m.project_id
     OR o.objective_id IS DISTINCT FROM obj.id
     OR o.track IS DISTINCT FROM m.track
    );
  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'migration 220: % milestone row(s) have a missing/soft-deleted parent, cross-project parent, outcome outside objective, or outcome track mismatch — repair those parent links before adding project_management_milestones_parent_integrity_trigger', mismatch_count;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.project_management_milestone_parent_integrity()
RETURNS trigger AS $$
DECLARE
  outcome_objective_id uuid;
  outcome_project_id text;
  outcome_track text;
  outcome_deleted_at timestamptz;
  objective_project_id text;
  objective_deleted_at timestamptz;
BEGIN
  -- A hidden milestone may keep historical links to hidden parents. Restoring it changes
  -- deleted_at back to NULL and therefore runs the full validation below before it becomes live.
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT objective_id, project_id, track, deleted_at
    INTO outcome_objective_id, outcome_project_id, outcome_track, outcome_deleted_at
  FROM public.project_management_outcomes
  WHERE id = NEW.outcome_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'milestone % cannot use outcome_id %: that outcome does not exist', NEW.id, NEW.outcome_id;
  END IF;
  IF outcome_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'milestone % cannot use outcome_id %: that outcome is soft-deleted; restore it or select an active outcome', NEW.id, NEW.outcome_id;
  END IF;

  SELECT project_id, deleted_at INTO objective_project_id, objective_deleted_at
  FROM public.project_management_objectives
  WHERE id = NEW.objective_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'milestone % cannot use objective_id %: that objective does not exist', NEW.id, NEW.objective_id;
  END IF;
  IF objective_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'milestone % cannot use objective_id %: that objective is soft-deleted; restore it or select an active objective', NEW.id, NEW.objective_id;
  END IF;
  IF outcome_project_id IS DISTINCT FROM NEW.project_id THEN
    RAISE EXCEPTION 'milestone % project_id % does not match outcome_id % project_id %', NEW.id, NEW.project_id, NEW.outcome_id, outcome_project_id;
  END IF;
  IF objective_project_id IS DISTINCT FROM NEW.project_id THEN
    RAISE EXCEPTION 'milestone % project_id % does not match objective_id % project_id %', NEW.id, NEW.project_id, NEW.objective_id, objective_project_id;
  END IF;
  IF outcome_objective_id IS DISTINCT FROM NEW.objective_id THEN
    RAISE EXCEPTION 'milestone % cannot use outcome_id % with objective_id %: that outcome belongs to objective_id %', NEW.id, NEW.outcome_id, NEW.objective_id, outcome_objective_id;
  END IF;
  IF outcome_track IS DISTINCT FROM NEW.track THEN
    RAISE EXCEPTION 'milestone % track % does not match outcome_id % track %; align the milestone track or choose another outcome', NEW.id, NEW.track, NEW.outcome_id, outcome_track;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_management_milestones_parent_integrity_trigger ON public.project_management_milestones;
CREATE TRIGGER project_management_milestones_parent_integrity_trigger
  BEFORE INSERT OR UPDATE OF project_id, outcome_id, objective_id, track, deleted_at ON public.project_management_milestones
  FOR EACH ROW EXECUTE FUNCTION public.project_management_milestone_parent_integrity();

-- Parent-side guards keep the invariant true after the child has been created. Parent fields
-- are edited through the same management API (including soft-delete), so validating only the
-- milestone INSERT/PATCH would still allow a live child to be orphaned later. A parent may be
-- hidden only after all referencing milestones are hidden; restoring a milestone then re-runs
-- the child trigger above and requires active, coherent parents.
CREATE OR REPLACE FUNCTION public.project_management_outcome_preserve_milestones()
RETURNS trigger AS $$
DECLARE
  blocking_count int;
BEGIN
  SELECT count(*) INTO blocking_count
  FROM public.project_management_milestones m
  WHERE m.outcome_id = OLD.id
    AND m.deleted_at IS NULL
    AND (
      NEW.deleted_at IS NOT NULL
      OR NEW.project_id IS DISTINCT FROM m.project_id
      OR NEW.objective_id IS DISTINCT FROM m.objective_id
      OR NEW.track IS DISTINCT FROM m.track
    );
  IF blocking_count > 0 THEN
    RAISE EXCEPTION 'outcome % cannot be moved, re-parented, re-tracked, or hidden while % active milestone(s) depend on it; update or hide those milestones first', OLD.id, blocking_count;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_management_outcomes_preserve_milestones_trigger ON public.project_management_outcomes;
CREATE TRIGGER project_management_outcomes_preserve_milestones_trigger
  BEFORE UPDATE OF project_id, objective_id, track, deleted_at ON public.project_management_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.project_management_outcome_preserve_milestones();

CREATE OR REPLACE FUNCTION public.project_management_objective_preserve_milestones()
RETURNS trigger AS $$
DECLARE
  blocking_count int;
BEGIN
  SELECT count(*) INTO blocking_count
  FROM public.project_management_milestones m
  WHERE m.objective_id = OLD.id
    AND m.deleted_at IS NULL
    AND (
      NEW.deleted_at IS NOT NULL
      OR NEW.project_id IS DISTINCT FROM m.project_id
    );
  IF blocking_count > 0 THEN
    RAISE EXCEPTION 'objective % cannot be moved or hidden while % active milestone(s) depend on it; update or hide those milestones first', OLD.id, blocking_count;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_management_objectives_preserve_milestones_trigger ON public.project_management_objectives;
CREATE TRIGGER project_management_objectives_preserve_milestones_trigger
  BEFORE UPDATE OF project_id, deleted_at ON public.project_management_objectives
  FOR EACH ROW EXECUTE FUNCTION public.project_management_objective_preserve_milestones();

COMMIT;
