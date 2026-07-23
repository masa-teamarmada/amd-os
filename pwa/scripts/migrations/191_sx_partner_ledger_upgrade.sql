-- 191_sx_partner_ledger_upgrade.sql
-- Upgrade project_management_partners into a management-grade counterpart
-- ledger: who currently holds the ball, who it goes to next, what state it
-- is aiming for, and how precise the target date really is. Adds a normal
-- interaction/history table so partner progress can be read as a timeline
-- instead of a single mutable row. Additive and repeatable.

BEGIN;

-- -------------------------------------------------------------------------
-- 1. project_management_partners: ball / target / date-precision columns
-- -------------------------------------------------------------------------

ALTER TABLE public.project_management_partners
  ADD COLUMN IF NOT EXISTS current_ball_side text,
  ADD COLUMN IF NOT EXISTS current_ball_owner text,
  ADD COLUMN IF NOT EXISTS next_ball_owner text,
  ADD COLUMN IF NOT EXISTS target_state text,
  ADD COLUMN IF NOT EXISTS due_date_precision text;

-- Safe backfill: only copy what is already known (owner_label / due_date
-- presence). Never invent which side currently holds the ball for rows that
-- predate this column, so current_ball_side defaults to 'unknown'.
UPDATE public.project_management_partners
SET current_ball_side = COALESCE(current_ball_side, 'unknown'),
    current_ball_owner = COALESCE(current_ball_owner, NULLIF(trim(owner_label), '')),
    due_date_precision = COALESCE(
      due_date_precision,
      CASE WHEN due_date IS NOT NULL THEN 'day' ELSE 'unknown' END
    )
WHERE current_ball_side IS NULL OR current_ball_owner IS NULL OR due_date_precision IS NULL;

ALTER TABLE public.project_management_partners
  ALTER COLUMN current_ball_side SET DEFAULT 'unknown',
  ALTER COLUMN current_ball_side SET NOT NULL,
  ALTER COLUMN due_date_precision SET DEFAULT 'unknown',
  ALTER COLUMN due_date_precision SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_partners_ball_side_check_191'
      AND conrelid = 'public.project_management_partners'::regclass
  ) THEN
    ALTER TABLE public.project_management_partners
      ADD CONSTRAINT project_management_partners_ball_side_check_191
      CHECK (current_ball_side IN ('sx', 'partner', 'shared', 'none', 'unknown'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_partners_due_precision_check_191'
      AND conrelid = 'public.project_management_partners'::regclass
  ) THEN
    ALTER TABLE public.project_management_partners
      ADD CONSTRAINT project_management_partners_due_precision_check_191
      CHECK (due_date_precision IN ('day', 'month', 'unknown'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_partners_due_date_consistency_191'
      AND conrelid = 'public.project_management_partners'::regclass
  ) THEN
    ALTER TABLE public.project_management_partners
      ADD CONSTRAINT project_management_partners_due_date_consistency_191
      CHECK (
        (due_date_precision = 'unknown' AND due_date IS NULL)
        OR (due_date_precision IN ('day', 'month') AND due_date IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON CONSTRAINT project_management_partners_due_date_consistency_191 ON public.project_management_partners IS 'due_date_precision=unknown must have due_date NULL; day/month must have due_date set. Prevents a fabricated day/month label with no underlying date and a real date silently losing its precision label.';

COMMENT ON COLUMN public.project_management_partners.current_ball_side IS 'Which side currently must act: sx, partner, shared, none, or unknown.';
COMMENT ON COLUMN public.project_management_partners.current_ball_owner IS 'Named person currently holding the ball (safe display name, no email).';
COMMENT ON COLUMN public.project_management_partners.next_ball_owner IS 'Named person the ball is expected to move to next.';
COMMENT ON COLUMN public.project_management_partners.target_state IS 'The state this relationship is aiming to reach next, in plain language.';
COMMENT ON COLUMN public.project_management_partners.due_date_precision IS 'How precise due_date really is: day, month, or unknown; UI must not fabricate a day when the source only confirms a month.';

-- -------------------------------------------------------------------------
-- 2. project_management_partner_interactions: append-friendly history
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_management_partner_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.project_management_partners(id) ON DELETE CASCADE,
  interaction_kind text NOT NULL CHECK (interaction_kind IN ('meeting', 'email', 'agreement', 'deliverable', 'handoff', 'status_update', 'note')),
  occurred_on date,
  occurred_on_precision text NOT NULL DEFAULT 'unknown' CHECK (occurred_on_precision IN ('day', 'month', 'unknown')),
  summary text NOT NULL,
  outcome_summary text,
  ball_side_after text NOT NULL DEFAULT 'unknown' CHECK (ball_side_after IN ('sx', 'partner', 'shared', 'none', 'unknown')),
  ball_owner_after text,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  source_kind text NOT NULL DEFAULT 'current_truth' CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text,
  deleted_at timestamptz,
  deleted_by text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_management_partner_interactions IS 'Append-friendly partner interaction history: meeting/email/agreement/deliverable/handoff/status_update/note. No raw email body or URL; summaries only.';

-- NOTE: the originally intended name
-- ('project_management_partner_interactions_occurred_on_consistency_191',
-- 67 chars) exceeds PostgreSQL's 63-byte identifier limit and gets silently
-- truncated to 'project_management_partner_interactions_occurred_on_consistency'
-- on creation. That mismatch broke idempotency checks that looked for the
-- untruncated name. Use a name that already fits under 63 chars, and
-- upgrade any already-applied production database by renaming the
-- truncated legacy constraint instead of trying to add a duplicate.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_partner_interactions_occurred_on_consistency'
      AND conrelid = 'public.project_management_partner_interactions'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_partner_interactions_date_consistency_191'
      AND conrelid = 'public.project_management_partner_interactions'::regclass
  ) THEN
    ALTER TABLE public.project_management_partner_interactions
      RENAME CONSTRAINT project_management_partner_interactions_occurred_on_consistency
      TO project_management_partner_interactions_date_consistency_191;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_partner_interactions_date_consistency_191'
      AND conrelid = 'public.project_management_partner_interactions'::regclass
  ) THEN
    ALTER TABLE public.project_management_partner_interactions
      ADD CONSTRAINT project_management_partner_interactions_date_consistency_191
      CHECK (
        (occurred_on_precision = 'unknown' AND occurred_on IS NULL)
        OR (occurred_on_precision IN ('day', 'month') AND occurred_on IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON CONSTRAINT project_management_partner_interactions_date_consistency_191 ON public.project_management_partner_interactions IS 'occurred_on_precision=unknown must have occurred_on NULL; day/month must have occurred_on set. Keeps the UI from fabricating a date or silently dropping a confirmed one.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_management_partner_interactions TO authenticated, service_role;
ALTER TABLE public.project_management_partner_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_management_partner_interactions_member_select ON public.project_management_partner_interactions;
CREATE POLICY project_management_partner_interactions_member_select
  ON public.project_management_partner_interactions FOR SELECT TO authenticated
  USING (public.amd_os_can_access_project(project_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS project_management_partner_interactions_manager_insert ON public.project_management_partner_interactions;
CREATE POLICY project_management_partner_interactions_manager_insert
  ON public.project_management_partner_interactions FOR INSERT TO authenticated
  WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_management_partner_interactions_manager_update ON public.project_management_partner_interactions;
CREATE POLICY project_management_partner_interactions_manager_update
  ON public.project_management_partner_interactions FOR UPDATE TO authenticated
  USING (public.amd_os_can_manage_project_shared_data(project_id))
  WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_management_partner_interactions_service_all ON public.project_management_partner_interactions;
CREATE POLICY project_management_partner_interactions_service_all
  ON public.project_management_partner_interactions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS project_management_partner_interactions_touch_updated_at ON public.project_management_partner_interactions;
CREATE TRIGGER project_management_partner_interactions_touch_updated_at
  BEFORE UPDATE ON public.project_management_partner_interactions
  FOR EACH ROW EXECUTE FUNCTION public.project_management_touch_updated_at();

DROP TRIGGER IF EXISTS project_management_partner_interactions_block_delete ON public.project_management_partner_interactions;
CREATE TRIGGER project_management_partner_interactions_block_delete
  BEFORE DELETE ON public.project_management_partner_interactions
  FOR EACH ROW EXECUTE FUNCTION public.project_management_block_authenticated_delete();

DROP TRIGGER IF EXISTS project_management_partner_interactions_field_audit ON public.project_management_partner_interactions;
CREATE TRIGGER project_management_partner_interactions_field_audit
  AFTER INSERT OR UPDATE ON public.project_management_partner_interactions
  FOR EACH ROW EXECUTE FUNCTION public.project_management_audit_fields();

DROP TRIGGER IF EXISTS project_management_partner_interactions_parent_project_guard ON public.project_management_partner_interactions;
CREATE TRIGGER project_management_partner_interactions_parent_project_guard
  BEFORE INSERT OR UPDATE ON public.project_management_partner_interactions
  FOR EACH ROW EXECUTE FUNCTION public.project_management_parent_project_guard(
    'project_management_partners', 'partner_id'
  );

CREATE INDEX IF NOT EXISTS project_management_partner_interactions_partner_idx
  ON public.project_management_partner_interactions(project_id, partner_id, occurred_on DESC, created_at DESC);

-- -------------------------------------------------------------------------
-- 3. p21 current-truth seed (2026-07-23): ダイキアクシス / SMBC
-- -------------------------------------------------------------------------

INSERT INTO public.project_management_partners (
  project_id, slug, name, role_label, primary_track, relationship_stage, agreement_state,
  agreed_scope, unagreed_scope, last_contact_date, next_commitment, due_date, owner_label,
  current_ball_side, current_ball_owner, next_ball_owner, target_state, due_date_precision,
  last_verified_at, confidence, source_kind, source_ref, sort_order
)
SELECT 'p21', 'daiki-axis', 'ダイキアクシス', 'リアクター試作・納品', 'technology_development', 'executing', 'partial',
  'NDA締結済み（2026-05-13） / 試作リアクター製作済み', '納品日と受入確認条件', NULL,
  'ダイキアクシスが試作リアクターを納品し、SXが受入確認する', DATE '2026-08-31', 'ダイキアクシス（担当者未確認）',
  'partner', 'ダイキアクシス（担当者未確認）', 'SX（受入確認担当未確認）',
  '試作リアクターが納品され、受入確認へ移れる', 'month',
  DATE '2026-07-23', 'medium', 'current_truth', 'user:2026-07-23#partner-progress', 50
WHERE EXISTS (SELECT 1 FROM public.projects WHERE project_id = 'p21')
ON CONFLICT (project_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  role_label = EXCLUDED.role_label,
  primary_track = EXCLUDED.primary_track,
  relationship_stage = EXCLUDED.relationship_stage,
  agreement_state = EXCLUDED.agreement_state,
  agreed_scope = EXCLUDED.agreed_scope,
  unagreed_scope = EXCLUDED.unagreed_scope,
  last_contact_date = EXCLUDED.last_contact_date,
  next_commitment = EXCLUDED.next_commitment,
  due_date = EXCLUDED.due_date,
  owner_label = EXCLUDED.owner_label,
  current_ball_side = EXCLUDED.current_ball_side,
  current_ball_owner = EXCLUDED.current_ball_owner,
  next_ball_owner = EXCLUDED.next_ball_owner,
  target_state = EXCLUDED.target_state,
  due_date_precision = EXCLUDED.due_date_precision,
  last_verified_at = EXCLUDED.last_verified_at,
  confidence = EXCLUDED.confidence,
  source_kind = EXCLUDED.source_kind,
  source_ref = EXCLUDED.source_ref,
  sort_order = EXCLUDED.sort_order;
-- deleted_at/deleted_by are intentionally excluded from the UPDATE SET above: this upsert must
-- refresh current-truth columns without silently un-deleting a row someone soft-deleted.

INSERT INTO public.project_management_partners (
  project_id, slug, name, role_label, primary_track, relationship_stage, agreement_state,
  agreed_scope, unagreed_scope, last_contact_date, next_commitment, due_date, owner_label,
  current_ball_side, current_ball_owner, next_ball_owner, target_state, due_date_precision,
  last_verified_at, confidence, source_kind, source_ref, sort_order
)
SELECT 'p21', 'smbc', 'SMBC', '資金調達・金融機関連携', 'funding', 'information_exchange', 'unagreed',
  '初回面談を実施', '今後の支援範囲と連絡窓口の正式確認', NULL,
  '石原先生から窓口変更を案内し、まさへ引き継ぐ', NULL, '石原先生 → まさ',
  'sx', '石原先生', 'まさ',
  'まさが窓口として認識され、SMBCとの直接連絡が開始している', 'unknown',
  DATE '2026-07-23', 'medium', 'current_truth', 'user:2026-07-23#partner-progress', 60
WHERE EXISTS (SELECT 1 FROM public.projects WHERE project_id = 'p21')
ON CONFLICT (project_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  role_label = EXCLUDED.role_label,
  primary_track = EXCLUDED.primary_track,
  relationship_stage = EXCLUDED.relationship_stage,
  agreement_state = EXCLUDED.agreement_state,
  agreed_scope = EXCLUDED.agreed_scope,
  unagreed_scope = EXCLUDED.unagreed_scope,
  last_contact_date = EXCLUDED.last_contact_date,
  next_commitment = EXCLUDED.next_commitment,
  due_date = EXCLUDED.due_date,
  owner_label = EXCLUDED.owner_label,
  current_ball_side = EXCLUDED.current_ball_side,
  current_ball_owner = EXCLUDED.current_ball_owner,
  next_ball_owner = EXCLUDED.next_ball_owner,
  target_state = EXCLUDED.target_state,
  due_date_precision = EXCLUDED.due_date_precision,
  last_verified_at = EXCLUDED.last_verified_at,
  confidence = EXCLUDED.confidence,
  source_kind = EXCLUDED.source_kind,
  source_ref = EXCLUDED.source_ref,
  sort_order = EXCLUDED.sort_order;
-- deleted_at/deleted_by are intentionally excluded from the UPDATE SET above: this upsert must
-- refresh current-truth columns without silently un-deleting a row someone soft-deleted.

INSERT INTO public.project_management_partner_tracks (project_id, partner_id, track, role_label, is_primary)
SELECT p.project_id, p.id, seed.track, seed.role_label, seed.is_primary
FROM (VALUES
  ('daiki-axis', 'technology_development', 'リアクター試作・納品', true),
  ('daiki-axis', 'business_development', '量産・事業化条件の接続', false),
  ('smbc', 'funding', '金融機関接続・支援窓口', true)
) AS seed(partner_slug, track, role_label, is_primary)
JOIN public.project_management_partners p ON p.project_id = 'p21' AND p.slug = seed.partner_slug
ON CONFLICT DO NOTHING;

INSERT INTO public.project_management_milestone_partner_links (project_id, milestone_id, partner_id)
SELECT m.project_id, m.id, p.id
FROM public.project_management_milestones m
JOIN public.project_management_partners p ON p.project_id = m.project_id
WHERE m.project_id = 'p21'
  AND (
    (m.slug IN ('tech-reactor-recheck', 'tech-poc-gate') AND p.slug = 'daiki-axis')
    OR (m.slug = 'funding-investor-conditions' AND p.slug = 'smbc')
  )
ON CONFLICT DO NOTHING;

-- Interaction history. Timestamps are staggered by explicit offsets so the
-- narrative order (NDA -> prototype built -> August delivery expectation;
-- first meeting -> handoff plan) survives even when the true calendar date
-- of an event is not confirmed.
WITH daiki AS (
  SELECT id AS partner_id FROM public.project_management_partners WHERE project_id = 'p21' AND slug = 'daiki-axis'
),
daiki_seed(interaction_kind, occurred_on, occurred_on_precision, summary, outcome_summary, ball_side_after, ball_owner_after, offset_seconds) AS (
  VALUES
    ('agreement', DATE '2026-05-13', 'day', 'NDAを締結した', 'ダイキアクシスとの秘密保持契約が有効になった', 'partner', 'ダイキアクシス（担当者未確認）', 0),
    ('deliverable', NULL, 'unknown', '試作リアクターの製作が完了した', '納品前の最終工程に入った', 'partner', 'ダイキアクシス（担当者未確認）', 1),
    ('status_update', NULL, 'unknown', '2026年8月の納品予定を確認した', '納品具体日は未確認のまま、受入確認の担当整備が次の課題', 'partner', 'ダイキアクシス（担当者未確認）', 2)
)
INSERT INTO public.project_management_partner_interactions (
  project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision, summary, outcome_summary,
  ball_side_after, ball_owner_after, confidence, source_kind, source_ref, created_at, updated_at
)
SELECT 'p21', daiki.partner_id, daiki_seed.interaction_kind, daiki_seed.occurred_on, daiki_seed.occurred_on_precision,
  daiki_seed.summary, daiki_seed.outcome_summary, daiki_seed.ball_side_after, daiki_seed.ball_owner_after,
  'medium', 'current_truth', 'user:2026-07-23#partner-progress',
  TIMESTAMPTZ '2026-07-23 00:00:00+09' + make_interval(secs => daiki_seed.offset_seconds),
  TIMESTAMPTZ '2026-07-23 00:00:00+09' + make_interval(secs => daiki_seed.offset_seconds)
FROM daiki, daiki_seed
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_management_partner_interactions existing
  WHERE existing.partner_id = daiki.partner_id
    AND existing.summary = daiki_seed.summary
    AND existing.source_ref = 'user:2026-07-23#partner-progress'
);

WITH smbc AS (
  SELECT id AS partner_id FROM public.project_management_partners WHERE project_id = 'p21' AND slug = 'smbc'
),
smbc_seed(interaction_kind, occurred_on, occurred_on_precision, summary, outcome_summary, ball_side_after, ball_owner_after, offset_seconds) AS (
  VALUES
    ('meeting', NULL::date, 'unknown', '初回面談を実施した', '連絡窓口が大学側として認識されている状態を確認した', 'sx', '石原先生', 0),
    ('handoff', NULL::date, 'unknown', '窓口移管方針を確認した', '石原先生から窓口変更を案内し、まさへ引き継ぐ方針で合意した', 'sx', '石原先生', 1)
)
INSERT INTO public.project_management_partner_interactions (
  project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision, summary, outcome_summary,
  ball_side_after, ball_owner_after, confidence, source_kind, source_ref, created_at, updated_at
)
SELECT 'p21', smbc.partner_id, smbc_seed.interaction_kind, smbc_seed.occurred_on, smbc_seed.occurred_on_precision,
  smbc_seed.summary, smbc_seed.outcome_summary, smbc_seed.ball_side_after, smbc_seed.ball_owner_after,
  'medium', 'current_truth', 'user:2026-07-23#partner-progress',
  TIMESTAMPTZ '2026-07-23 00:00:00+09' + make_interval(secs => smbc_seed.offset_seconds),
  TIMESTAMPTZ '2026-07-23 00:00:00+09' + make_interval(secs => smbc_seed.offset_seconds)
FROM smbc, smbc_seed
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_management_partner_interactions existing
  WHERE existing.partner_id = smbc.partner_id
    AND existing.summary = smbc_seed.summary
    AND existing.source_ref = 'user:2026-07-23#partner-progress'
);

INSERT INTO public.project_management_update_history (
  project_id, entity_type, entity_id, update_kind, summary, changed_by, changed_on, from_status, to_status
)
SELECT 'p21', 'partner', p.id, 'partner_ledger_seed',
  CASE p.slug WHEN 'daiki-axis' THEN 'ダイキアクシスを協力機関台帳へ登録した' ELSE 'SMBCを協力機関台帳へ登録した' END,
  'user_current_truth', DATE '2026-07-23', NULL, p.relationship_stage
FROM public.project_management_partners p
WHERE p.project_id = 'p21' AND p.slug IN ('daiki-axis', 'smbc')
  AND NOT EXISTS (
    SELECT 1 FROM public.project_management_update_history history
    WHERE history.project_id = 'p21'
      AND history.entity_id = p.id
      AND history.update_kind = 'partner_ledger_seed'
  );

-- Interaction counts below check the current seed batch (source_ref + the specific summaries
-- inserted above), not an exact total for the partner's whole history. A partner accumulates real
-- interactions over time via the app, and an exact-count RAISE EXCEPTION would make this migration
-- fail on every re-application once that happens. Checking ">= expected count for this batch" keeps
-- it re-appliable indefinitely.
DO $$
BEGIN
  IF (SELECT count(*) FROM public.project_management_partners WHERE project_id = 'p21' AND slug IN ('daiki-axis', 'smbc')) <> 2 THEN
    RAISE EXCEPTION 'p21 のダイキアクシス/SMBC seedが期待通りに揃っていません';
  END IF;
  IF (
    SELECT count(*) FROM public.project_management_partner_interactions i
    JOIN public.project_management_partners p ON p.id = i.partner_id
    WHERE p.project_id = 'p21' AND p.slug = 'daiki-axis' AND i.deleted_at IS NULL
      AND i.source_ref = 'user:2026-07-23#partner-progress'
      AND i.summary IN ('NDAを締結した', '試作リアクターの製作が完了した', '2026年8月の納品予定を確認した')
  ) < 3 THEN
    RAISE EXCEPTION 'ダイキアクシスの履歴seedが3件揃っていません';
  END IF;
  IF (
    SELECT count(*) FROM public.project_management_partner_interactions i
    JOIN public.project_management_partners p ON p.id = i.partner_id
    WHERE p.project_id = 'p21' AND p.slug = 'smbc' AND i.deleted_at IS NULL
      AND i.source_ref = 'user:2026-07-23#partner-progress'
      AND i.summary IN ('初回面談を実施した', '窓口移管方針を確認した')
  ) < 2 THEN
    RAISE EXCEPTION 'SMBCの履歴seedが2件揃っていません';
  END IF;
END $$;

COMMIT;
