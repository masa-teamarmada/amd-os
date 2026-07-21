-- 190_sx_finechem_priority_correction.sql
-- 2026-07-21 の経営判断を SX 管理正本へ反映する。
-- 対象機関は正式名へ統一し、優先度低・保留・重要経路外として扱う。

DO $$
DECLARE
  target_count integer;
BEGIN
  SELECT count(*) INTO target_count
  FROM public.project_management_partners
  WHERE project_id = 'p21' AND slug = 'fc-hokuriku';

  IF target_count <> 1 THEN
    RAISE EXCEPTION 'p21 の対象協力機関が exactly 1 件ではありません (found=%)', target_count;
  END IF;
END $$;

UPDATE public.project_management_partners
SET name = 'ファインケム',
    role_label = '補助候補（優先度低・保留）',
    relationship_stage = 'on_hold',
    next_commitment = '重要経路外として保留',
    due_date = NULL,
    last_verified_at = DATE '2026-07-21',
    source_kind = 'current_truth',
    source_ref = 'user:2026-07-21#finechem-priority',
    updated_at = now()
WHERE project_id = 'p21'
  AND slug = 'fc-hokuriku';

UPDATE public.project_management_partner_tracks track
SET role_label = '補助候補（優先度低・保留）'
FROM public.project_management_partners partner
WHERE track.partner_id = partner.id
  AND partner.project_id = 'p21'
  AND partner.slug = 'fc-hokuriku';

UPDATE public.project_management_partner_commitments commitment
SET status = 'cancelled',
    last_verified_at = DATE '2026-07-21',
    source_kind = 'current_truth',
    source_ref = 'user:2026-07-21#finechem-priority',
    updated_at = now()
FROM public.project_management_partners partner
WHERE commitment.partner_id = partner.id
  AND partner.project_id = 'p21'
  AND partner.slug = 'fc-hokuriku'
  AND commitment.status IN ('open', 'in_progress', 'blocked');

DELETE FROM public.project_management_milestone_partner_links link
USING public.project_management_partners partner
WHERE link.partner_id = partner.id
  AND partner.project_id = 'p21'
  AND partner.slug = 'fc-hokuriku';

INSERT INTO public.project_management_update_history (
  project_id, entity_type, entity_id, update_kind, summary, changed_by, changed_on, from_status, to_status
)
SELECT 'p21', 'partner', partner.id, 'partner_priority_correction',
  'ファインケムを優先度低・保留・重要経路外へ変更した',
  'user_current_truth', DATE '2026-07-21', 'candidate', 'on_hold'
FROM public.project_management_partners partner
WHERE partner.project_id = 'p21'
  AND partner.slug = 'fc-hokuriku'
  AND NOT EXISTS (
    SELECT 1 FROM public.project_management_update_history history
    WHERE history.project_id = 'p21'
      AND history.entity_id = partner.id
      AND history.update_kind = 'partner_priority_correction'
      AND history.changed_on = DATE '2026-07-21'
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.project_management_partners partner
    WHERE partner.project_id = 'p21'
      AND partner.slug = 'fc-hokuriku'
      AND (
        partner.name <> 'ファインケム'
        OR partner.relationship_stage <> 'on_hold'
        OR partner.due_date IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'ファインケムの優先度補正が完了していません';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.project_management_milestone_partner_links link
    JOIN public.project_management_partners partner ON partner.id = link.partner_id
    WHERE partner.project_id = 'p21' AND partner.slug = 'fc-hokuriku'
  ) THEN
    RAISE EXCEPTION 'ファインケムが重要ゲートへ残っています';
  END IF;
END $$;
