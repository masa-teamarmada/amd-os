-- SX management corrective contract (184)
--
-- 183 is already applied in production.  This migration is intentionally
-- additive and repeatable: it corrects the unresolved-issue classification,
-- separates counterparty promises from SX follow-ups, and closes the
-- project-boundary gap for every parent FK used by the management API.

BEGIN;

-- An unresolved issue is not a recorded decision.  Keep the legacy value in
-- the check for old projects, but add the explicit waiting-for-decision kind
-- and migrate only the two 183 SX rows that were seeded with the wrong kind.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.project_management_issues'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%knowledge_type%'
  ORDER BY conname
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.project_management_issues DROP CONSTRAINT %I', constraint_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_issues_knowledge_type_check_184'
      AND conrelid = 'public.project_management_issues'::regclass
  ) THEN
    ALTER TABLE public.project_management_issues
      ADD CONSTRAINT project_management_issues_knowledge_type_check_184
      CHECK (knowledge_type IN ('fact', 'hypothesis', 'decision_needed', 'decision'));
  END IF;
END $$;

WITH changed AS (
  UPDATE public.project_management_issues
  SET knowledge_type = 'decision_needed',
      source_kind = 'current_truth',
      source_ref = '184 corrective: 7/14経営会議の意思決定待ち分類',
      updated_at = now()
  WHERE project_id = 'p21'
    AND slug IN ('trl5-gate', 'newco-governance')
    AND knowledge_type = 'decision'
  RETURNING id, project_id
)
INSERT INTO public.project_management_update_history (
  project_id, entity_type, entity_id, update_kind, summary, changed_by,
  changed_on, from_status, to_status
)
SELECT project_id, 'issue', id, 'corrective_classification',
  '未決論点を「意思決定待ち」に分類し、決定済みと混同しないよう補正した',
  'system-184', CURRENT_DATE, 'decision', 'decision_needed'
FROM changed;

-- Re-running 184 must also repair the first-run audit rows created before
-- the old value was preserved.  The correction is idempotent and records the
-- actual transition that occurred in the SX seed.
UPDATE public.project_management_update_history h
SET from_status = 'decision',
    to_status = 'decision_needed'
WHERE h.project_id = 'p21'
  AND h.entity_type = 'issue'
  AND h.update_kind = 'corrective_classification'
  AND h.entity_id IN (
    SELECT i.id FROM public.project_management_issues i
    WHERE i.project_id = 'p21'
      AND i.slug IN ('trl5-gate', 'newco-governance')
  );

-- Existing 183 next-commitment rows are SX-side follow-ups.  They have no
-- counterparty owner or primary evidence, so they must never be shown as an
-- external promise.  New rows default to the safer SX-side kind.
ALTER TABLE public.project_management_partner_commitments
  ADD COLUMN IF NOT EXISTS commitment_kind text NOT NULL DEFAULT 'sx_followup';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_partner_commitments_kind_check_184'
      AND conrelid = 'public.project_management_partner_commitments'::regclass
  ) THEN
    ALTER TABLE public.project_management_partner_commitments
      ADD CONSTRAINT project_management_partner_commitments_kind_check_184
      CHECK (commitment_kind IN ('counterparty_promise', 'sx_followup'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_partner_commitments_promise_requirements_184'
      AND conrelid = 'public.project_management_partner_commitments'::regclass
  ) THEN
    ALTER TABLE public.project_management_partner_commitments
      ADD CONSTRAINT project_management_partner_commitments_promise_requirements_184
      CHECK (
        commitment_kind <> 'counterparty_promise'
        OR (
          NULLIF(trim(counterparty_owner), '') IS NOT NULL
          AND promised_on IS NOT NULL
          AND NULLIF(trim(evidence), '') IS NOT NULL
        )
      );
  END IF;
END $$;

WITH changed AS (
  UPDATE public.project_management_partner_commitments c
  SET commitment_kind = 'sx_followup',
      counterparty_owner = NULL,
      evidence = NULL,
      source_kind = 'current_truth',
      source_ref = '184 corrective: SX側の次アクションとして再分類',
      updated_at = now()
  WHERE c.project_id = 'p21'
    AND c.partner_id IN (
      SELECT p.id FROM public.project_management_partners p
      WHERE p.project_id = 'p21'
        AND p.slug IN ('fc-hokuriku', 'partners-fund', 'ewir-candidate-a', 'ehime-university')
    )
    AND (c.commitment_kind <> 'sx_followup' OR c.counterparty_owner IS NOT NULL OR c.evidence IS NOT NULL)
  RETURNING c.id, c.project_id
)
INSERT INTO public.project_management_update_history (
  project_id, entity_type, entity_id, update_kind, summary, changed_by,
  changed_on
)
SELECT project_id, 'partner_commitment', id, 'corrective_classification',
  '相手の約束ではなくSX側の次アクションとして補正した',
  'system-184', CURRENT_DATE
FROM changed;

-- The API checks parent IDs before every write.  This trigger is the database
-- backstop: a manager cannot connect a record in project A to a parent in
-- project B even if the API is bypassed.
CREATE OR REPLACE FUNCTION public.project_management_parent_project_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_project text;
  parent_id_text text;
  pair_index integer;
BEGIN
  IF TG_NARGS % 2 <> 0 THEN
    RAISE EXCEPTION 'invalid project management parent guard configuration' USING ERRCODE = '22023';
  END IF;

  pair_index := 0;
  WHILE pair_index < TG_NARGS LOOP
    parent_id_text := to_jsonb(NEW) ->> TG_ARGV[pair_index + 1];
    IF parent_id_text IS NOT NULL AND parent_id_text <> '' THEN
      EXECUTE format(
        'SELECT project_id::text FROM public.%I WHERE id = $1::uuid',
        TG_ARGV[pair_index]
      ) INTO parent_project USING parent_id_text;
      IF parent_project IS NULL OR parent_project <> NEW.project_id THEN
        RAISE EXCEPTION 'management parent must stay inside one project' USING ERRCODE = '23514';
      END IF;
    END IF;
    pair_index := pair_index + 2;
  END LOOP;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('project_management_outcomes', 'objective_id', 'project_management_objectives', NULL::text),
      ('project_management_milestones', 'objective_id', 'project_management_objectives', 'outcome_id'),
      ('project_management_milestones', 'outcome_id', 'project_management_outcomes', NULL::text),
      ('project_management_kpis', 'outcome_id', 'project_management_outcomes', NULL::text),
      ('project_management_milestone_kpis', 'milestone_id', 'project_management_milestones', 'kpi_id'),
      ('project_management_milestone_kpis', 'kpi_id', 'project_management_kpis', NULL::text),
      ('project_management_issues', 'milestone_id', 'project_management_milestones', 'outcome_id'),
      ('project_management_issues', 'outcome_id', 'project_management_outcomes', NULL::text),
      ('project_management_hypotheses', 'issue_id', 'project_management_issues', NULL::text),
      ('project_management_evidence', 'issue_id', 'project_management_issues', 'hypothesis_id'),
      ('project_management_evidence', 'hypothesis_id', 'project_management_hypotheses', NULL::text),
      ('project_management_validation_runs', 'hypothesis_id', 'project_management_hypotheses', NULL::text),
      ('project_management_decisions', 'issue_id', 'project_management_issues', 'hypothesis_id'),
      ('project_management_decisions', 'hypothesis_id', 'project_management_hypotheses', NULL::text),
      ('project_management_action_items', 'decision_id', 'project_management_decisions', NULL::text),
      ('project_management_partner_commitments', 'partner_id', 'project_management_partners', NULL::text),
      ('project_management_raci', 'milestone_id', 'project_management_milestones', NULL::text),
      ('project_management_capacity', 'milestone_id', 'project_management_milestones', NULL::text),
      ('project_management_technical_tests', 'milestone_id', 'project_management_milestones', 'outcome_id'),
      ('project_management_technical_tests', 'outcome_id', 'project_management_outcomes', NULL::text),
      ('project_management_milestone_issue_links', 'milestone_id', 'project_management_milestones', 'issue_id'),
      ('project_management_milestone_issue_links', 'issue_id', 'project_management_issues', NULL::text),
      ('project_management_milestone_partner_links', 'milestone_id', 'project_management_milestones', 'partner_id'),
      ('project_management_milestone_partner_links', 'partner_id', 'project_management_partners', NULL::text)
    ) AS config(table_name, column_one, parent_table_one, column_two)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', item.table_name || '_parent_project_guard', item.table_name);
    IF item.column_two IS NULL THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.project_management_parent_project_guard(%L, %L)',
        item.table_name || '_parent_project_guard', item.table_name, item.parent_table_one, item.column_one
      );
    ELSE
      -- The second parent table is encoded in the same trigger arguments.
      -- For two-parent rows, the config row is paired by the explicit branch
      -- below so each parent table/column remains visible to the trigger.
      NULL;
    END IF;
  END LOOP;
END $$;

-- Two-parent rows need both parent table names in one trigger call.  Keep
-- these explicit and idempotent so the trigger remains easy to audit.
DO $$
BEGIN
  DROP TRIGGER IF EXISTS project_management_milestones_parent_project_guard ON public.project_management_milestones;
  CREATE TRIGGER project_management_milestones_parent_project_guard
    BEFORE INSERT OR UPDATE ON public.project_management_milestones
    FOR EACH ROW EXECUTE FUNCTION public.project_management_parent_project_guard(
      'project_management_objectives', 'objective_id',
      'project_management_outcomes', 'outcome_id'
    );
  DROP TRIGGER IF EXISTS project_management_milestone_kpis_parent_project_guard ON public.project_management_milestone_kpis;
  CREATE TRIGGER project_management_milestone_kpis_parent_project_guard
    BEFORE INSERT OR UPDATE ON public.project_management_milestone_kpis
    FOR EACH ROW EXECUTE FUNCTION public.project_management_parent_project_guard(
      'project_management_milestones', 'milestone_id',
      'project_management_kpis', 'kpi_id'
    );
  DROP TRIGGER IF EXISTS project_management_issues_parent_project_guard ON public.project_management_issues;
  CREATE TRIGGER project_management_issues_parent_project_guard
    BEFORE INSERT OR UPDATE ON public.project_management_issues
    FOR EACH ROW EXECUTE FUNCTION public.project_management_parent_project_guard(
      'project_management_milestones', 'milestone_id',
      'project_management_outcomes', 'outcome_id'
    );
  DROP TRIGGER IF EXISTS project_management_evidence_parent_project_guard ON public.project_management_evidence;
  CREATE TRIGGER project_management_evidence_parent_project_guard
    BEFORE INSERT OR UPDATE ON public.project_management_evidence
    FOR EACH ROW EXECUTE FUNCTION public.project_management_parent_project_guard(
      'project_management_issues', 'issue_id',
      'project_management_hypotheses', 'hypothesis_id'
    );
  DROP TRIGGER IF EXISTS project_management_decisions_parent_project_guard ON public.project_management_decisions;
  CREATE TRIGGER project_management_decisions_parent_project_guard
    BEFORE INSERT OR UPDATE ON public.project_management_decisions
    FOR EACH ROW EXECUTE FUNCTION public.project_management_parent_project_guard(
      'project_management_issues', 'issue_id',
      'project_management_hypotheses', 'hypothesis_id'
    );
  DROP TRIGGER IF EXISTS project_management_technical_tests_parent_project_guard ON public.project_management_technical_tests;
  CREATE TRIGGER project_management_technical_tests_parent_project_guard
    BEFORE INSERT OR UPDATE ON public.project_management_technical_tests
    FOR EACH ROW EXECUTE FUNCTION public.project_management_parent_project_guard(
      'project_management_milestones', 'milestone_id',
      'project_management_outcomes', 'outcome_id'
    );
  DROP TRIGGER IF EXISTS project_management_milestone_issue_links_parent_project_guard ON public.project_management_milestone_issue_links;
  CREATE TRIGGER project_management_milestone_issue_links_parent_project_guard
    BEFORE INSERT OR UPDATE ON public.project_management_milestone_issue_links
    FOR EACH ROW EXECUTE FUNCTION public.project_management_parent_project_guard(
      'project_management_milestones', 'milestone_id',
      'project_management_issues', 'issue_id'
    );
  DROP TRIGGER IF EXISTS project_management_milestone_partner_links_parent_project_guard ON public.project_management_milestone_partner_links;
  CREATE TRIGGER project_management_milestone_partner_links_parent_project_guard
    BEFORE INSERT OR UPDATE ON public.project_management_milestone_partner_links
    FOR EACH ROW EXECUTE FUNCTION public.project_management_parent_project_guard(
      'project_management_milestones', 'milestone_id',
      'project_management_partners', 'partner_id'
    );
END $$;

COMMENT ON COLUMN public.project_management_issues.knowledge_type IS 'fact, hypothesis, decision_needed, or legacy decision; unresolved SX issues use decision_needed.';
COMMENT ON COLUMN public.project_management_partner_commitments.commitment_kind IS 'counterparty_promise only with counterparty owner, promised date, and primary evidence; otherwise sx_followup.';
COMMENT ON TABLE public.project_management_partner_commitments IS 'Partner commitment history separated into counterparty promises and SX follow-up actions.';

COMMIT;
