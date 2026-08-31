-- 20260901093000_project_theme_hub_standalone_milestone.sql
--
-- Phase 2 blocking fix (root review /tmp/amie-zmp-theme.imx1hK/phase2-root-review.md):
-- p19 (ZMP) currently has 0 project_management_objectives and 0 project_management_outcomes.
-- project_management_milestones.objective_id / outcome_id are both NOT NULL (183_
-- project_management_workspace.sql), so "運用マイルストーン追加" from the theme hub has no
-- working creation path today — the objective/outcome pickers would always be empty, and there
-- is no acceptable "just pick something" fallback (brief explicitly forbids fabricating parent
-- objective/outcome rows to satisfy a FK, the same principle already applied to the standalone
-- task fix in 20260831120000).
--
-- Root-approved design: objective_id and outcome_id may both be NULL for a theme-only
-- operational milestone (no objective/outcome hierarchy built yet), but never independently —
-- a milestone with one set and the other NULL is not a valid state. Milestones that DO belong to
-- an objective/outcome (the existing p21/SolvioraX rows, and any future project that builds that
-- hierarchy) keep the exact same parent-consistency requirements as today; nothing about
-- assertMilestoneParentIntegrity's (the app-layer check in /management/route.ts) existing
-- behavior for bound milestones changes.
--
-- Root's rollback test caught a second, DB-level enforcer of the same NOT NULL invariant that the
-- app-layer check alone does not cover: the BEFORE INSERT/UPDATE trigger
-- project_management_milestones_parent_integrity_trigger (pwa/scripts/migrations/220_
-- sx_gantt_direct_editing.sql lines 159-214, function project_management_milestone_parent_
-- integrity()) unconditionally looks up NEW.outcome_id / NEW.objective_id and RAISEs "does not
-- exist" when NOT FOUND — which a NULL id always is. A standalone insert failed there even after
-- the column-level NOT NULL was dropped. This migration CREATE OR REPLACEs that exact function,
-- adding ONE early-return branch for the both-NULL case; every existing check for a bound
-- milestone (parent-exists, not-soft-deleted, same-project, outcome-belongs-to-objective,
-- outcome-track-matches-milestone-track) is reproduced verbatim, unchanged, for every other case.
-- A mixed NULL (exactly one of the two set) still reaches those existing lookups and fails loudly
-- there too, on top of project_management_milestones_objective_outcome_paired below being the
-- authoritative bouncer for that case.
--
-- The separate generic parent-project guard from migration 184 already skips NULL parent ids on
-- its own; it is unrelated to this trigger and is not touched here.
--
-- Additive only: DROP NOT NULL + one new paired CHECK + one CREATE OR REPLACE FUNCTION (same
-- trigger binding, no DROP/CREATE TRIGGER needed). No data changes, no existing row can violate
-- the new CHECK (every existing row already has both columns non-null), and no existing row can
-- newly fail the replaced trigger (the only behavioral change is a NEW early-return, not a new
-- rejection).
--
-- NOT applied by this worker. Root reviews and applies.

BEGIN;

ALTER TABLE public.project_management_milestones
  ALTER COLUMN objective_id DROP NOT NULL;

ALTER TABLE public.project_management_milestones
  ALTER COLUMN outcome_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_milestones_objective_outcome_paired'
      AND conrelid = 'public.project_management_milestones'::regclass
  ) THEN
    ALTER TABLE public.project_management_milestones
      ADD CONSTRAINT project_management_milestones_objective_outcome_paired
      CHECK ((objective_id IS NULL) = (outcome_id IS NULL));
  END IF;
END $$;

COMMENT ON COLUMN public.project_management_milestones.objective_id IS
  'NULLABLE (migration 20260901093000): a theme-only operational milestone with no built objective/outcome hierarchy yet leaves this NULL. Must match outcome_id''s nullness (project_management_milestones_objective_outcome_paired). Never fabricate a placeholder objective to satisfy this — leave both NULL instead.';
COMMENT ON COLUMN public.project_management_milestones.outcome_id IS
  'NULLABLE (migration 20260901093000): see objective_id. Must match objective_id''s nullness.';

-- CREATE OR REPLACE of pwa/scripts/migrations/220_sx_gantt_direct_editing.sql's
-- project_management_milestone_parent_integrity() (lines 159-209 there). Identical to the
-- original except for the new early-return block right after the existing soft-delete
-- early-return. The trigger binding itself (project_management_milestones_parent_integrity_
-- trigger) is untouched — CREATE OR REPLACE FUNCTION does not require re-creating it.
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

  -- Theme-only operational milestone (migration 20260901093000): no objective/outcome hierarchy
  -- built yet. project_management_milestones_objective_outcome_paired is the authoritative check
  -- for "both or neither" — a mixed NULL still falls through to the lookups below and fails there
  -- (outcome_id or objective_id NOT FOUND), same as any other invalid id would.
  IF NEW.objective_id IS NULL AND NEW.outcome_id IS NULL THEN
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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'project_management_milestones'
      AND column_name = 'objective_id' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'project_management_milestones.objective_id is still NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'project_management_milestones'
      AND column_name = 'outcome_id' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'project_management_milestones.outcome_id is still NOT NULL';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_milestones_objective_outcome_paired'
  ) THEN
    RAISE EXCEPTION 'project_management_milestones_objective_outcome_paired missing';
  END IF;
  -- Regression guard: the trigger function must actually contain the new early-return, not just
  -- exist. Cheap static check on its live source (pg_get_functiondef) rather than trusting that
  -- CREATE OR REPLACE ran the body we intended.
  IF pg_get_functiondef('public.project_management_milestone_parent_integrity()'::regprocedure)
     NOT LIKE '%NEW.objective_id IS NULL AND NEW.outcome_id IS NULL%' THEN
    RAISE EXCEPTION 'project_management_milestone_parent_integrity() is missing the standalone-milestone early-return';
  END IF;
END $$;

COMMIT;
