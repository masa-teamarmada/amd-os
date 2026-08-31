-- 20260901120000_project_theme_hub_client_token_extend.sql
--
-- UI completion phase (root followup after 3 prior theme-hub migrations applied):
-- "Stable UUID and exact ID retry recovery for all newly created canonical types, including
-- issue/discussion/decision/action/milestone, not only task. Never title/time heuristic dedupe."
--
-- 20260831120000 added project_management_tasks.client_token (+ partial UNIQUE index on
-- (project_id, client_token)) so a dropped-response retry of "create task" returns the original
-- row instead of a duplicate. The theme hub's new creation forms for operational milestone,
-- issue, discussion (hypothesis), decision, and action need the exact same retry-safety — a
-- resend after a network drop must never create a second row, and the app layer must never fall
-- back to guessing "is this the same thing" from title/time proximity.
--
-- All five target tables (183_project_management_workspace.sql) already carry their own
-- project_id column directly (verified: milestones, issues, hypotheses, decisions,
-- action_items all have `project_id text NOT NULL REFERENCES public.projects`), so this repeats
-- the exact same (project_id, client_token) partial-unique pattern as the task column, not a
-- parent-scoped variant.
--
-- Additive only: nullable client_token uuid + a partial UNIQUE index scoped to
-- (project_id, client_token) so unrelated NULLs (every pre-existing row, and any future caller
-- that never sends one) never collide. No existing row can violate a partial index that ignores
-- NULL.
--
-- NOT applied by this worker. Root reviews and applies.

BEGIN;

ALTER TABLE public.project_management_milestones
  ADD COLUMN IF NOT EXISTS client_token uuid;
CREATE UNIQUE INDEX IF NOT EXISTS project_management_milestones_client_token_uq
  ON public.project_management_milestones (project_id, client_token)
  WHERE client_token IS NOT NULL;

ALTER TABLE public.project_management_issues
  ADD COLUMN IF NOT EXISTS client_token uuid;
CREATE UNIQUE INDEX IF NOT EXISTS project_management_issues_client_token_uq
  ON public.project_management_issues (project_id, client_token)
  WHERE client_token IS NOT NULL;

ALTER TABLE public.project_management_hypotheses
  ADD COLUMN IF NOT EXISTS client_token uuid;
CREATE UNIQUE INDEX IF NOT EXISTS project_management_hypotheses_client_token_uq
  ON public.project_management_hypotheses (project_id, client_token)
  WHERE client_token IS NOT NULL;

ALTER TABLE public.project_management_decisions
  ADD COLUMN IF NOT EXISTS client_token uuid;
CREATE UNIQUE INDEX IF NOT EXISTS project_management_decisions_client_token_uq
  ON public.project_management_decisions (project_id, client_token)
  WHERE client_token IS NOT NULL;

ALTER TABLE public.project_management_action_items
  ADD COLUMN IF NOT EXISTS client_token uuid;
CREATE UNIQUE INDEX IF NOT EXISTS project_management_action_items_client_token_uq
  ON public.project_management_action_items (project_id, client_token)
  WHERE client_token IS NOT NULL;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'project_management_milestones', 'project_management_issues',
    'project_management_hypotheses', 'project_management_decisions',
    'project_management_action_items'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'client_token'
    ) THEN
      RAISE EXCEPTION '%.client_token missing', t;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = t || '_client_token_uq') THEN
      RAISE EXCEPTION '%_client_token_uq missing', t;
    END IF;
  END LOOP;
END $$;

COMMIT;
