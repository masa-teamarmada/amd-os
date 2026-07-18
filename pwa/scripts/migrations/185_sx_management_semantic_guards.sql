-- SX management semantic guards (185)
--
-- 184 separated external promises from SX follow-ups, but its API contract
-- still allowed a partial PATCH to erase fields that make either record
-- operable.  These checks are additive and repeatable.  NOT VALID keeps old
-- incomplete seed rows readable while enforcing every new INSERT/UPDATE.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_management_decisions_decided_requirements_185'
      AND conrelid = 'public.project_management_decisions'::regclass
  ) THEN
    ALTER TABLE public.project_management_decisions
      ADD CONSTRAINT project_management_decisions_decided_requirements_185
      CHECK (
        decision_state <> 'decided'
        OR (
          NULLIF(trim(decision_text), '') IS NOT NULL
          AND NULLIF(trim(decided_by), '') IS NOT NULL
          AND decided_on IS NOT NULL
        )
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_management_partner_commitments_sx_followup_requirements'
      AND conrelid = 'public.project_management_partner_commitments'::regclass
  ) THEN
    ALTER TABLE public.project_management_partner_commitments
      ADD CONSTRAINT project_management_partner_commitments_sx_followup_requirements
      CHECK (
        commitment_kind <> 'sx_followup'
        OR (
          NULLIF(trim(sx_owner), '') IS NOT NULL
          AND due_date IS NOT NULL
          AND next_review_on IS NOT NULL
        )
      ) NOT VALID;
  END IF;
END $$;

COMMENT ON CONSTRAINT project_management_decisions_decided_requirements_185
  ON public.project_management_decisions IS '決定済みは決定内容・決定者・決定日を必須にする。';

COMMENT ON CONSTRAINT project_management_partner_commitments_sx_followup_requirements
  ON public.project_management_partner_commitments IS 'SX側の次アクションはSX担当・期限・次回確認を必須にする。';

COMMIT;
