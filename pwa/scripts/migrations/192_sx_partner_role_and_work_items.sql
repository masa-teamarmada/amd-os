-- 192_sx_partner_role_and_work_items.sql
-- Two-lane ball control for the SX partner ledger.
--
-- Adds a normalized role/relationship classification (many-to-many, one
-- primary + optional secondary roles per partner) so the UI can group
-- "共同開発先" / "共同開発候補先" etc. without guessing from free text.
-- Adds a per-partner "who is holding what" work-item ledger, separated by
-- side (sx/partner/shared/unknown), so a single institution can carry
-- several open tasks/questions/deliverables/decisions/approvals/responses
-- at once instead of collapsing to one nextCommitment string.
-- Adds actor_side/actor_label to project_management_partner_interactions so
-- "who acted" is recorded data, not something inferred from ball_side_after.
-- Adds completed_on/completion_evidence/accepted_by/accepted_on to the work
-- item ledger so a completion is auditable, not just a status flip.
-- Additive and repeatable.

BEGIN;

-- -------------------------------------------------------------------------
-- 1. project_management_partner_roles
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_management_partner_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.project_management_partners(id) ON DELETE CASCADE,
  role_kind text NOT NULL CHECK (role_kind IN (
    'joint_development', 'contract_manufacturing', 'customer', 'shareholder_investor',
    'government', 'media', 'financial_institution', 'university_research',
    'support_organization', 'other', 'unclassified'
  )),
  relationship_state text NOT NULL DEFAULT 'unconfirmed' CHECK (relationship_state IN (
    'candidate', 'in_progress', 'established', 'on_hold', 'ended', 'unconfirmed'
  )),
  role_label text,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  deleted_by text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_management_partner_roles IS 'Two-axis partner classification: role_kind (what kind of counterparty) x relationship_state (how far along). Many-to-many with partners; at most one is_primary row per partner among live rows (enforced by a partial unique index below). role_kind must never be guessed from free-text role_label; unconfirmed classifications use unclassified/unconfirmed.';
COMMENT ON COLUMN public.project_management_partner_roles.role_label IS 'Optional short sub-label for this specific role assignment (e.g. a more specific descriptor than the coarse role_kind). Nullable; leave null rather than fabricate.';

-- source_kind/source_ref: added defensively (not baked only into the CREATE
-- TABLE) because both the seed below and the /management API's
-- createFor()/patchFor() write these columns on every insert/update — the
-- table must have them regardless of whether this migration's CREATE TABLE
-- or an earlier partial apply created the table first.
ALTER TABLE public.project_management_partner_roles
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS source_ref text;

UPDATE public.project_management_partner_roles
SET source_kind = 'current_truth'
WHERE source_kind IS NULL;

ALTER TABLE public.project_management_partner_roles
  ALTER COLUMN source_kind SET DEFAULT 'current_truth',
  ALTER COLUMN source_kind SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_partner_roles_source_kind_check_192'
      AND conrelid = 'public.project_management_partner_roles'::regclass
  ) THEN
    ALTER TABLE public.project_management_partner_roles
      ADD CONSTRAINT project_management_partner_roles_source_kind_check_192
      CHECK (source_kind IN ('current_truth', 'manual', 'imported'));
  END IF;
END $$;

COMMENT ON COLUMN public.project_management_partner_roles.source_kind IS 'Same current_truth/manual/imported contract as every other SX management table. Required so the API can always write it on create/update.';
COMMENT ON COLUMN public.project_management_partner_roles.source_ref IS 'Free-text pointer to where this classification came from (seed marker or "PWA共有管理画面"). Nullable.';

-- At most one primary role per partner among live (non-deleted) rows.
DROP INDEX IF EXISTS project_management_partner_roles_one_primary_192;
CREATE UNIQUE INDEX project_management_partner_roles_one_primary_192
  ON public.project_management_partner_roles(partner_id)
  WHERE is_primary AND deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_management_partner_roles TO authenticated, service_role;
ALTER TABLE public.project_management_partner_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_management_partner_roles_member_select ON public.project_management_partner_roles;
CREATE POLICY project_management_partner_roles_member_select
  ON public.project_management_partner_roles FOR SELECT TO authenticated
  USING (public.amd_os_can_access_project(project_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS project_management_partner_roles_manager_insert ON public.project_management_partner_roles;
CREATE POLICY project_management_partner_roles_manager_insert
  ON public.project_management_partner_roles FOR INSERT TO authenticated
  WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_management_partner_roles_manager_update ON public.project_management_partner_roles;
CREATE POLICY project_management_partner_roles_manager_update
  ON public.project_management_partner_roles FOR UPDATE TO authenticated
  USING (public.amd_os_can_manage_project_shared_data(project_id))
  WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_management_partner_roles_service_all ON public.project_management_partner_roles;
CREATE POLICY project_management_partner_roles_service_all
  ON public.project_management_partner_roles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS project_management_partner_roles_touch_updated_at ON public.project_management_partner_roles;
CREATE TRIGGER project_management_partner_roles_touch_updated_at
  BEFORE UPDATE ON public.project_management_partner_roles
  FOR EACH ROW EXECUTE FUNCTION public.project_management_touch_updated_at();

DROP TRIGGER IF EXISTS project_management_partner_roles_block_delete ON public.project_management_partner_roles;
CREATE TRIGGER project_management_partner_roles_block_delete
  BEFORE DELETE ON public.project_management_partner_roles
  FOR EACH ROW EXECUTE FUNCTION public.project_management_block_authenticated_delete();

DROP TRIGGER IF EXISTS project_management_partner_roles_field_audit ON public.project_management_partner_roles;
CREATE TRIGGER project_management_partner_roles_field_audit
  AFTER INSERT OR UPDATE ON public.project_management_partner_roles
  FOR EACH ROW EXECUTE FUNCTION public.project_management_audit_fields();

DROP TRIGGER IF EXISTS project_management_partner_roles_parent_project_guard ON public.project_management_partner_roles;
CREATE TRIGGER project_management_partner_roles_parent_project_guard
  BEFORE INSERT OR UPDATE ON public.project_management_partner_roles
  FOR EACH ROW EXECUTE FUNCTION public.project_management_parent_project_guard(
    'project_management_partners', 'partner_id'
  );

CREATE INDEX IF NOT EXISTS project_management_partner_roles_partner_idx
  ON public.project_management_partner_roles(project_id, partner_id, sort_order);

-- -------------------------------------------------------------------------
-- 2. project_management_partner_work_items
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_management_partner_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.project_management_partners(id) ON DELETE CASCADE,
  side text NOT NULL DEFAULT 'unknown' CHECK (side IN ('sx', 'partner', 'shared', 'unknown')),
  item_kind text NOT NULL CHECK (item_kind IN ('task', 'question', 'deliverable', 'decision', 'approval', 'response')),
  title text NOT NULL,
  detail text,
  owner_label text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'blocked', 'on_hold', 'completed', 'cancelled')),
  due_date date,
  due_date_precision text NOT NULL DEFAULT 'unknown' CHECK (due_date_precision IN ('day', 'month', 'unknown')),
  completion_criteria text,
  completed_on date,
  completion_evidence text,
  accepted_by text,
  accepted_on date,
  handoff_to text,
  related_milestone_id uuid REFERENCES public.project_management_milestones(id) ON DELETE SET NULL,
  last_verified_at date NOT NULL,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  sort_order integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  deleted_by text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_management_partner_work_items IS 'What each side of a partner relationship is currently holding: task/question/deliverable/decision/approval/response, per side (sx/partner/shared/unknown). A partner can carry several concurrent items; this replaces collapsing "current holdings" into a single nextCommitment string. Existing project_management_partner_commitments (counterparty promise vs SX follow-up) is unchanged and still holds the formal-promise boundary; the UI merges live commitments into the relevant side lane for display without altering that boundary.';
COMMENT ON COLUMN public.project_management_partner_work_items.completion_criteria IS 'Leave NULL when not confirmable. Never fabricate a completion criterion.';
COMMENT ON COLUMN public.project_management_partner_work_items.handoff_to IS 'Who/what this item hands off to once done, in plain language. Nullable.';

-- completed_on/completion_evidence/accepted_by/accepted_on: added defensively
-- (same reasoning as source_kind/source_ref above) so a partial earlier apply
-- of this migration still ends up with the full completion-audit contract.
ALTER TABLE public.project_management_partner_work_items
  ADD COLUMN IF NOT EXISTS completed_on date,
  ADD COLUMN IF NOT EXISTS completion_evidence text,
  ADD COLUMN IF NOT EXISTS accepted_by text,
  ADD COLUMN IF NOT EXISTS accepted_on date;

COMMENT ON COLUMN public.project_management_partner_work_items.completed_on IS 'Date this item was actually completed. Required by CHECK once status=completed — never leave a completed item without a completion date.';
COMMENT ON COLUMN public.project_management_partner_work_items.completion_evidence IS 'What confirms this item is done (a link, a message, a delivered file, a named confirmation). Required by CHECK once status=completed. Leave the whole item non-completed rather than fabricate this.';
COMMENT ON COLUMN public.project_management_partner_work_items.accepted_by IS 'Who accepted/confirmed a completed deliverable. Required by CHECK once item_kind=deliverable AND status=completed.';
COMMENT ON COLUMN public.project_management_partner_work_items.accepted_on IS 'Date a completed deliverable was accepted. Required by CHECK once item_kind=deliverable AND status=completed.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_partner_work_items_due_date_consistency_192'
      AND conrelid = 'public.project_management_partner_work_items'::regclass
  ) THEN
    ALTER TABLE public.project_management_partner_work_items
      ADD CONSTRAINT project_management_partner_work_items_due_date_consistency_192
      CHECK (
        (due_date_precision = 'unknown' AND due_date IS NULL)
        OR (due_date_precision IN ('day', 'month') AND due_date IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON CONSTRAINT project_management_partner_work_items_due_date_consistency_192 ON public.project_management_partner_work_items IS 'due_date_precision=unknown must have due_date NULL; day/month must have due_date set.';

-- A completed item must be auditable: never just a status flip. This mirrors
-- the same "no fabricated completion" contract already enforced for
-- project_management_decisions (185) and project_management_action_items.
-- btrim(...) <> '' (not just IS NOT NULL) on the two text fields matches the
-- API contract: createFor()/patchFor() route every optional text field
-- through optionalTextValue()/optionalText(), which already collapses ""
-- and whitespace-only input to NULL before it reaches the DB (see route.ts
-- text()). This CHECK makes that guarantee a DB-level invariant instead of
-- an API-only one, so a future write path that skips optionalTextValue()
-- still can't fabricate a "completed" row with an empty-string criterion.
--
-- Constraint name kept under Postgres's 63-byte identifier limit
-- (NAMEDATALEN). The name this migration first shipped with
-- (project_management_partner_work_items_completion_requirements_192, 65
-- bytes) is silently truncated by Postgres to 63 bytes at ADD CONSTRAINT
-- time, landing as project_management_partner_work_items_completion_requirements_1
-- on any DB where an earlier version of this migration already ran — not the
-- name this file declared, so a naive "does the declared name exist" check
-- would try to re-add a duplicate constraint on reapply. The block below is
-- idempotent across all three cases: short name already present (fresh apply
-- of this version) -> no-op; legacy truncated name present (pre-2026-07-24
-- apply) -> RENAME CONSTRAINT onto the short name, preserving the existing
-- constraint object rather than dropping/re-adding it; neither present
-- (brand new table) -> ADD CONSTRAINT under the short name directly.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pm_partner_work_items_completion_check_192'
      AND conrelid = 'public.project_management_partner_work_items'::regclass
  ) THEN
    NULL;
  ELSIF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_partner_work_items_completion_requirements_1'
      AND conrelid = 'public.project_management_partner_work_items'::regclass
  ) THEN
    ALTER TABLE public.project_management_partner_work_items
      RENAME CONSTRAINT "project_management_partner_work_items_completion_requirements_1" TO pm_partner_work_items_completion_check_192;
  ELSE
    ALTER TABLE public.project_management_partner_work_items
      ADD CONSTRAINT pm_partner_work_items_completion_check_192
      CHECK (
        status <> 'completed'
        OR (
          completion_criteria IS NOT NULL AND btrim(completion_criteria) <> ''
          AND completion_evidence IS NOT NULL AND btrim(completion_evidence) <> ''
          AND completed_on IS NOT NULL
        )
      );
  END IF;
END $$;

COMMENT ON CONSTRAINT pm_partner_work_items_completion_check_192 ON public.project_management_partner_work_items IS 'status=completed requires non-blank completion_criteria, non-blank completion_evidence, and completed_on to already be set. An unconfirmable completion must stay in a non-completed status, not fabricate these fields.';

-- A completed deliverable additionally needs an acceptor: "we shipped it" is
-- not the same claim as "the other side confirmed receipt." Same btrim
-- reasoning as above applies to accepted_by (text); accepted_on is a date
-- and keeps a plain IS NOT NULL.
--
-- Same 63-byte truncation issue and same idempotent
-- short-name/legacy-truncated-name/neither handling as the completion check
-- above. The name this migration first shipped with
-- (project_management_partner_work_items_deliverable_acceptance_192, 64
-- bytes) truncates to project_management_partner_work_items_deliverable_acceptance_19 at 63 bytes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pm_partner_work_items_acceptance_check_192'
      AND conrelid = 'public.project_management_partner_work_items'::regclass
  ) THEN
    NULL;
  ELSIF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_partner_work_items_deliverable_acceptance_19'
      AND conrelid = 'public.project_management_partner_work_items'::regclass
  ) THEN
    ALTER TABLE public.project_management_partner_work_items
      RENAME CONSTRAINT "project_management_partner_work_items_deliverable_acceptance_19" TO pm_partner_work_items_acceptance_check_192;
  ELSE
    ALTER TABLE public.project_management_partner_work_items
      ADD CONSTRAINT pm_partner_work_items_acceptance_check_192
      CHECK (
        NOT (item_kind = 'deliverable' AND status = 'completed')
        OR (accepted_by IS NOT NULL AND btrim(accepted_by) <> '' AND accepted_on IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON CONSTRAINT pm_partner_work_items_acceptance_check_192 ON public.project_management_partner_work_items IS 'item_kind=deliverable AND status=completed additionally requires a non-blank accepted_by and an accepted_on. A delivered item is not "done" until someone named accepted it.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_management_partner_work_items TO authenticated, service_role;
ALTER TABLE public.project_management_partner_work_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_management_partner_work_items_member_select ON public.project_management_partner_work_items;
CREATE POLICY project_management_partner_work_items_member_select
  ON public.project_management_partner_work_items FOR SELECT TO authenticated
  USING (public.amd_os_can_access_project(project_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS project_management_partner_work_items_manager_insert ON public.project_management_partner_work_items;
CREATE POLICY project_management_partner_work_items_manager_insert
  ON public.project_management_partner_work_items FOR INSERT TO authenticated
  WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_management_partner_work_items_manager_update ON public.project_management_partner_work_items;
CREATE POLICY project_management_partner_work_items_manager_update
  ON public.project_management_partner_work_items FOR UPDATE TO authenticated
  USING (public.amd_os_can_manage_project_shared_data(project_id))
  WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_management_partner_work_items_service_all ON public.project_management_partner_work_items;
CREATE POLICY project_management_partner_work_items_service_all
  ON public.project_management_partner_work_items FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS project_management_partner_work_items_touch_updated_at ON public.project_management_partner_work_items;
CREATE TRIGGER project_management_partner_work_items_touch_updated_at
  BEFORE UPDATE ON public.project_management_partner_work_items
  FOR EACH ROW EXECUTE FUNCTION public.project_management_touch_updated_at();

DROP TRIGGER IF EXISTS project_management_partner_work_items_block_delete ON public.project_management_partner_work_items;
CREATE TRIGGER project_management_partner_work_items_block_delete
  BEFORE DELETE ON public.project_management_partner_work_items
  FOR EACH ROW EXECUTE FUNCTION public.project_management_block_authenticated_delete();

DROP TRIGGER IF EXISTS project_management_partner_work_items_field_audit ON public.project_management_partner_work_items;
CREATE TRIGGER project_management_partner_work_items_field_audit
  AFTER INSERT OR UPDATE ON public.project_management_partner_work_items
  FOR EACH ROW EXECUTE FUNCTION public.project_management_audit_fields();

DROP TRIGGER IF EXISTS project_management_partner_work_items_parent_project_guard ON public.project_management_partner_work_items;
CREATE TRIGGER project_management_partner_work_items_parent_project_guard
  BEFORE INSERT OR UPDATE ON public.project_management_partner_work_items
  FOR EACH ROW EXECUTE FUNCTION public.project_management_parent_project_guard(
    'project_management_partners', 'partner_id',
    'project_management_milestones', 'related_milestone_id'
  );

CREATE INDEX IF NOT EXISTS project_management_partner_work_items_partner_idx
  ON public.project_management_partner_work_items(project_id, partner_id, side, due_date);

-- -------------------------------------------------------------------------
-- 3. project_management_partner_interactions: actor_side / actor_label
-- -------------------------------------------------------------------------
-- Who acted in this interaction is separate data from ball_side_after (who
-- holds the ball afterward). Existing rows start unknown; never backfilled
-- by inferring actor from ball_side_after.

ALTER TABLE public.project_management_partner_interactions
  ADD COLUMN IF NOT EXISTS actor_side text,
  ADD COLUMN IF NOT EXISTS actor_label text;

UPDATE public.project_management_partner_interactions
SET actor_side = COALESCE(actor_side, 'unknown')
WHERE actor_side IS NULL;

ALTER TABLE public.project_management_partner_interactions
  ALTER COLUMN actor_side SET DEFAULT 'unknown',
  ALTER COLUMN actor_side SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_partner_interactions_actor_side_check_192'
      AND conrelid = 'public.project_management_partner_interactions'::regclass
  ) THEN
    ALTER TABLE public.project_management_partner_interactions
      ADD CONSTRAINT project_management_partner_interactions_actor_side_check_192
      CHECK (actor_side IN ('sx', 'partner', 'shared', 'unknown'));
  END IF;
END $$;

COMMENT ON COLUMN public.project_management_partner_interactions.actor_side IS 'Who performed this interaction: sx, partner, shared, or unknown. Independent of ball_side_after (who holds the ball afterward) — never derived from it.';
COMMENT ON COLUMN public.project_management_partner_interactions.actor_label IS 'Named actor for this interaction, if safely known. Nullable.';

-- Known p21 seed interactions (source_ref='user:2026-07-23#partner-progress'):
-- NDA=shared, prototype-complete=partner, first meeting=shared, handoff
-- plan=sx. The August-delivery-date confirmation is deliberately left
-- unknown below (section 3b) — who confirmed that date is not established
-- by any primary source, and it must not be guessed from which side
-- currently holds the ball. Only touches live (non-deleted) rows: a row a
-- user has since soft-deleted must not be silently backfilled on reapply.
UPDATE public.project_management_partner_interactions
SET actor_side = 'shared'
WHERE project_id = 'p21' AND source_ref = 'user:2026-07-23#partner-progress'
  AND summary IN ('NDAを締結した', '初回面談を実施した')
  AND actor_side = 'unknown'
  AND deleted_at IS NULL;

UPDATE public.project_management_partner_interactions
SET actor_side = 'partner'
WHERE project_id = 'p21' AND source_ref = 'user:2026-07-23#partner-progress'
  AND summary = '試作リアクターの製作が完了した'
  AND actor_side = 'unknown'
  AND deleted_at IS NULL;

UPDATE public.project_management_partner_interactions
SET actor_side = 'sx'
WHERE project_id = 'p21' AND source_ref = 'user:2026-07-23#partner-progress'
  AND summary = '窓口移管方針を確認した'
  AND actor_side = 'unknown'
  AND deleted_at IS NULL;

-- 3b. '2026年8月の納品予定を確認した' (August delivery date confirmation) is
-- deliberately NOT backfilled here — no-op, kept as an explicit anchor so a
-- future reader does not "complete the pattern" and add it back to the
-- partner-side UPDATE above. Either side could have been the one who
-- confirmed the date; ball_side_after must not be used to infer it.

-- -------------------------------------------------------------------------
-- 4. p21 current-truth seed: role classification (2026-07-24)
-- -------------------------------------------------------------------------
-- role_kind is only set where safely confirmable; everything else stays
-- 'unclassified'. relationship_state is a deterministic, documented
-- normalization of the already-confirmed relationship_stage column
-- (candidate -> candidate; information_exchange..agreement_confirmation ->
-- in_progress; executing -> established; on_hold -> on_hold), except where
-- explicitly overridden below (Partners Fund is a shareholder/investor
-- candidate per 2026-07-24 direction, ahead of where relationship_stage
-- alone would place it).
--
-- Each seed row carries a fixed, explicit UUID (not gen_random_uuid()) and
-- the existence check below is keyed on that id alone (not on source_ref,
-- deleted_at, or title). A fixed id is the only identity that survives a
-- user editing role_kind/relationship_state/role_label or soft-deleting the
-- row through the API: source_ref is provenance, but an ordinary edit
-- through route.ts's PATCH now overwrites it to 'PWA共有管理画面' (2026-07-24
-- P0: ordinary edits always stamp manual provenance) — this migration must
-- never depend on source_ref staying at its seed value, and title/label text
-- can legitimately change too. Checking
-- only live (deleted_at IS NULL) rows would make a soft-deleted seed "come
-- back to life" as a new active row on the next migration re-apply, which
-- is exactly the revival bug this migration must not have; id-based
-- NOT EXISTS is immune to that regardless of deleted_at.

WITH partner_role_seed(seed_id, partner_slug, role_kind, relationship_state) AS (
  VALUES
    ('110ca817-4f7c-4491-b103-6b137aa6d0a2'::uuid, 'ehime-university', 'university_research', 'in_progress'),
    ('09c7a5e1-a8be-4407-93bc-27901fe625ed'::uuid, 'smbc', 'financial_institution', 'in_progress'),
    ('38510cf1-7575-400d-8b8e-800cf2661b5a'::uuid, 'partners-fund', 'shareholder_investor', 'candidate'),
    ('f8a0d5ae-3136-4860-a682-fe2daa935d85'::uuid, 'daiki-axis', 'unclassified', 'established'),
    ('0a343ddb-b57b-4b4a-bc46-24cab352cc08'::uuid, 'ewir-candidate-a', 'unclassified', 'candidate'),
    ('badd7dfd-8ddd-42c8-a090-b74aa94ca60d'::uuid, 'fc-hokuriku', 'unclassified', 'on_hold')
)
INSERT INTO public.project_management_partner_roles (
  id, project_id, partner_id, role_kind, relationship_state, role_label, is_primary, sort_order,
  source_kind, source_ref
)
SELECT seed.seed_id, p.project_id, p.id, seed.role_kind, seed.relationship_state, NULL, true, 0,
  'current_truth', 'user:2026-07-24#partner-role-normalization'
FROM partner_role_seed seed
JOIN public.project_management_partners p ON p.project_id = 'p21' AND p.slug = seed.partner_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_management_partner_roles existing
  WHERE existing.id = seed.seed_id
);

-- -------------------------------------------------------------------------
-- 5. p21 current-truth seed: work items (2026-07-24, confirmed facts only)
-- -------------------------------------------------------------------------
-- Same fixed-id re-appliability contract as section 4: each row carries an
-- explicit id and the existence check is keyed on that id alone, regardless
-- of deleted_at/source_ref/title, so a soft-deleted or edited seeded item is
-- never silently re-created or revived.

WITH daiki AS (
  SELECT id AS partner_id, project_id FROM public.project_management_partners WHERE project_id = 'p21' AND slug = 'daiki-axis'
),
daiki_seed(seed_id, side, item_kind, title, owner_label, status, due_date, due_date_precision, handoff_to, sort_order) AS (
  VALUES
    ('8bfb7054-df7e-468d-bea5-f1aa03a7fd96'::uuid, 'partner', 'deliverable', '試作リアクター納品', NULL::text, 'open', DATE '2026-08-31', 'month', 'SX受入確認担当未確認', 10),
    ('5d87b67f-ec62-466c-b82d-ac9d71fe7ea1'::uuid, 'sx', 'task', '納品日と受入確認条件を確認', NULL::text, 'open', NULL::date, 'unknown', NULL::text, 20)
)
INSERT INTO public.project_management_partner_work_items (
  id, project_id, partner_id, side, item_kind, title, owner_label, status, due_date, due_date_precision,
  handoff_to, last_verified_at, confidence, source_kind, source_ref, sort_order
)
SELECT daiki_seed.seed_id, daiki.project_id, daiki.partner_id, daiki_seed.side, daiki_seed.item_kind, daiki_seed.title, daiki_seed.owner_label,
  daiki_seed.status, daiki_seed.due_date, daiki_seed.due_date_precision, daiki_seed.handoff_to,
  DATE '2026-07-24', 'medium', 'current_truth', 'user:2026-07-24#partner-work-items', daiki_seed.sort_order
FROM daiki, daiki_seed
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_management_partner_work_items existing
  WHERE existing.id = daiki_seed.seed_id
);

WITH smbc AS (
  SELECT id AS partner_id, project_id FROM public.project_management_partners WHERE project_id = 'p21' AND slug = 'smbc'
),
smbc_seed(seed_id, side, item_kind, title, owner_label, status, due_date, due_date_precision, handoff_to, sort_order) AS (
  VALUES
    ('dafc6821-0db6-4a0e-91be-68998da76d70'::uuid, 'sx', 'task', '石原先生から窓口変更案内', '石原先生', 'open', NULL::date, 'unknown', 'まさ', 10),
    ('003b1c64-512d-4592-8f68-6d036108e5e4'::uuid, 'sx', 'task', '窓口引継ぎと直接連絡開始', 'まさ', 'waiting', NULL::date, 'unknown', NULL::text, 20)
)
INSERT INTO public.project_management_partner_work_items (
  id, project_id, partner_id, side, item_kind, title, owner_label, status, due_date, due_date_precision,
  handoff_to, last_verified_at, confidence, source_kind, source_ref, sort_order
)
SELECT smbc_seed.seed_id, smbc.project_id, smbc.partner_id, smbc_seed.side, smbc_seed.item_kind, smbc_seed.title, smbc_seed.owner_label,
  smbc_seed.status, smbc_seed.due_date, smbc_seed.due_date_precision, smbc_seed.handoff_to,
  DATE '2026-07-24', 'medium', 'current_truth', 'user:2026-07-24#partner-work-items', smbc_seed.sort_order
FROM smbc, smbc_seed
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_management_partner_work_items existing
  WHERE existing.id = smbc_seed.seed_id
);

INSERT INTO public.project_management_update_history (
  project_id, entity_type, entity_id, update_kind, summary, changed_by, changed_on, from_status, to_status
)
SELECT 'p21', 'partner', p.id, 'partner_role_normalization',
  'COO向け二車線ボール管制への再実装に伴い、役割・関係状態と当方/先方の保有事項台帳を追加した',
  'user_current_truth', DATE '2026-07-24', NULL, role.relationship_state
FROM public.project_management_partners p
JOIN public.project_management_partner_roles role ON role.partner_id = p.id AND role.is_primary AND role.deleted_at IS NULL
WHERE p.project_id = 'p21'
  AND NOT EXISTS (
    SELECT 1 FROM public.project_management_update_history history
    WHERE history.project_id = 'p21'
      AND history.entity_id = p.id
      AND history.update_kind = 'partner_role_normalization'
  );

-- -------------------------------------------------------------------------
-- 6. Verification (re-appliable: role/work-item checks are id-existence
--    checks against the fixed seed ids from sections 4/5 — NOT counts keyed
--    on deleted_at/source_ref/title. A legitimate later edit or soft-delete
--    of a seeded row must never turn a harmless migration re-apply into a
--    failure, and an id existing regardless of its current deleted_at/
--    source_ref/title is exactly what "the seed was applied" means here.)
-- -------------------------------------------------------------------------

DO $$
DECLARE
  missing_role_ids uuid[];
  missing_work_item_ids uuid[];
  still_unknown_actor_count integer;
BEGIN
  SELECT array_agg(seed.seed_id) INTO missing_role_ids
  FROM (VALUES
    ('110ca817-4f7c-4491-b103-6b137aa6d0a2'::uuid),
    ('09c7a5e1-a8be-4407-93bc-27901fe625ed'::uuid),
    ('38510cf1-7575-400d-8b8e-800cf2661b5a'::uuid),
    ('f8a0d5ae-3136-4860-a682-fe2daa935d85'::uuid),
    ('0a343ddb-b57b-4b4a-bc46-24cab352cc08'::uuid),
    ('badd7dfd-8ddd-42c8-a090-b74aa94ca60d'::uuid)
  ) AS seed(seed_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.project_management_partner_roles existing WHERE existing.id = seed.seed_id
  );
  IF missing_role_ids IS NOT NULL THEN
    RAISE EXCEPTION 'p21 の協力機関に主分類roleのseed id が揃っていません: %', missing_role_ids;
  END IF;

  SELECT array_agg(seed.seed_id) INTO missing_work_item_ids
  FROM (VALUES
    ('8bfb7054-df7e-468d-bea5-f1aa03a7fd96'::uuid),
    ('5d87b67f-ec62-466c-b82d-ac9d71fe7ea1'::uuid),
    ('dafc6821-0db6-4a0e-91be-68998da76d70'::uuid),
    ('003b1c64-512d-4592-8f68-6d036108e5e4'::uuid)
  ) AS seed(seed_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.project_management_partner_work_items existing WHERE existing.id = seed.seed_id
  );
  IF missing_work_item_ids IS NOT NULL THEN
    RAISE EXCEPTION 'ダイキアクシス/SMBCの保有事項seed id が揃っていません: %', missing_work_item_ids;
  END IF;

  -- The interaction actor_side backfill (section 3) is a plain UPDATE, not an id-seeded INSERT, so it
  -- has no fabricated identity to check against. It must NOT be a fixed count(4): a user is free to
  -- edit a backfilled row's summary/actor_side (taking it out of the "known summary, still unknown"
  -- set) or soft-delete it (excluded via deleted_at IS NULL) between migration re-applies, and neither
  -- of those is a failure — a legitimate later edit must never turn a harmless re-apply into a
  -- RAISE EXCEPTION. The only real failure mode is: a row that is still LIVE, still carries the known
  -- source_ref + one of the known original summaries, and STILL has actor_side='unknown' — meaning the
  -- backfill UPDATE in section 3 above never actually ran against it. Section 3's UPDATE already
  -- guards deleted_at IS NULL, so a soft-deleted row is never silently backfilled or revived here
  -- either.
  SELECT count(*) INTO still_unknown_actor_count
  FROM public.project_management_partner_interactions i
  JOIN public.project_management_partners p ON p.id = i.partner_id
  WHERE p.project_id = 'p21'
    AND i.deleted_at IS NULL
    AND i.source_ref = 'user:2026-07-23#partner-progress'
    AND i.summary IN ('NDAを締結した', '初回面談を実施した', '試作リアクターの製作が完了した', '窓口移管方針を確認した')
    AND i.actor_side = 'unknown';
  IF still_unknown_actor_count > 0 THEN
    RAISE EXCEPTION 'p21 の既存やり取り履歴に行為主体backfillが効いていない行が%件残っています（live かつ既知summaryなのにactor_side=unknown）', still_unknown_actor_count;
  END IF;
END $$;

COMMIT;
