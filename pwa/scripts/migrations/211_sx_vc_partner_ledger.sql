-- 211_sx_vc_partner_ledger.sql
-- Register the three VC counterparties explicitly requested for the p21
-- relationship ledger. These are separate counterparties: the existing
-- daiki-axis row remains the reactor-prototype relationship and must not mix
-- its delivery ball/history with DAVP's investment relationship.
--
-- The user confirmed only that these organizations belong in the VC list.
-- Contact, owner, ball, goal, dates, and investment terms therefore remain
-- unconfirmed. The legacy relationship_stage column has no unconfirmed value,
-- so candidate is used only as its minimum technical placeholder; the
-- normalized relationship_state is the authoritative unconfirmed value.
-- Additive, repeatable, and soft-delete safe.

BEGIN;

INSERT INTO public.project_management_partners (
  id, project_id, slug, name, role_label, primary_track, relationship_stage,
  agreement_state, agreed_scope, unagreed_scope, last_contact_date,
  next_commitment, due_date, owner_label, last_verified_at, confidence,
  source_kind, source_ref, sort_order, current_ball_side, current_ball_owner,
  next_ball_owner, target_state, due_date_precision
)
VALUES
  (
    '02cb575e-2be5-41b4-bf03-ad745692bef1', 'p21', 'davp',
    'ダイキアクシスベンチャーパートナーズ（DAVP）', 'VC', 'funding',
    'candidate', 'unagreed', '', '接触状況・投資検討条件は未確認', NULL,
    '次の一手 未登録', NULL, '担当未確認', DATE '2026-08-01', 'unknown',
    'current_truth', 'user:2026-08-01#vc-list', 71,
    'unknown', NULL, NULL, NULL, 'unknown'
  ),
  (
    '406a8ac5-f08b-4aa2-adea-323cb0b316f5', 'p21', 'bnv',
    'Beyond Next Ventures（BNV）', 'VC', 'funding',
    'candidate', 'unagreed', '', '接触状況・投資検討条件は未確認', NULL,
    '次の一手 未登録', NULL, '担当未確認', DATE '2026-08-01', 'unknown',
    'current_truth', 'user:2026-08-01#vc-list', 72,
    'unknown', NULL, NULL, NULL, 'unknown'
  ),
  (
    'ab22478d-4eb9-460e-9eed-40bccd5d9517', 'p21', 'iyogin-capital',
    'いよぎんキャピタル', 'VC', 'funding',
    'candidate', 'unagreed', '', '接触状況・投資検討条件は未確認', NULL,
    '次の一手 未登録', NULL, '担当未確認', DATE '2026-08-01', 'unknown',
    'current_truth', 'user:2026-08-01#vc-list', 73,
    'unknown', NULL, NULL, NULL, 'unknown'
  )
ON CONFLICT DO NOTHING;

WITH role_seed(id, partner_slug) AS (
  VALUES
    ('49dc8f33-5dd7-49b6-a050-6fd95f4d0cf7'::uuid, 'davp'),
    ('c1a3d542-d72c-42ad-a757-580bcf36a1d9'::uuid, 'bnv'),
    ('ebfa743e-72ec-4df4-90ea-cba380913077'::uuid, 'iyogin-capital')
)
INSERT INTO public.project_management_partner_roles (
  id, project_id, partner_id, role_kind, relationship_state, role_label,
  is_primary, sort_order, source_kind, source_ref
)
SELECT seed.id, partner.project_id, partner.id, 'shareholder_investor',
       'unconfirmed', 'VC',
       NOT EXISTS (
         SELECT 1
         FROM public.project_management_partner_roles primary_role
         WHERE primary_role.partner_id = partner.id
           AND primary_role.is_primary
           AND primary_role.deleted_at IS NULL
       ),
       0, 'current_truth', 'user:2026-08-01#vc-list'
FROM role_seed seed
JOIN public.project_management_partners partner
  ON partner.project_id = 'p21'
 AND partner.slug = seed.partner_slug
WHERE NOT EXISTS (
  SELECT 1
  FROM public.project_management_partner_roles existing
  WHERE existing.id = seed.id
)
AND NOT EXISTS (
  SELECT 1
  FROM public.project_management_partner_roles existing
  WHERE existing.partner_id = partner.id
    AND existing.role_kind = 'shareholder_investor'
    AND existing.deleted_at IS NULL
);

DO $$
DECLARE
  partner_count integer;
  vc_role_count integer;
BEGIN
  SELECT count(*) INTO partner_count
  FROM public.project_management_partners
  WHERE project_id = 'p21'
    AND slug IN ('partners-fund', 'davp', 'bnv', 'iyogin-capital')
    AND deleted_at IS NULL;

  SELECT count(DISTINCT partner.slug) INTO vc_role_count
  FROM public.project_management_partners partner
  JOIN public.project_management_partner_roles role
    ON role.partner_id = partner.id
  WHERE partner.project_id = 'p21'
    AND partner.slug IN ('partners-fund', 'davp', 'bnv', 'iyogin-capital')
    AND partner.deleted_at IS NULL
    AND role.role_kind = 'shareholder_investor'
    AND role.deleted_at IS NULL;

  IF partner_count <> 4 OR vc_role_count <> 4 THEN
    RAISE EXCEPTION
      'p21 active VC ledger incomplete: partners %, VC roles % (expected 4/4)',
      partner_count, vc_role_count;
  END IF;
END $$;

COMMIT;
