-- 165_void_zmp_legacy_agreement_offsets.sql
-- ZMP 2026: months before the 2026-07 point-system transition were agreed and
-- paid under the old terms. Do not use the new point basis to create retroactive
-- differences for those months. Keep the audit rows, but void them for payout
-- calculation.

COMMENT ON COLUMN public.reward_member_liability_offsets.offset_yen IS
  '正=追加支払、負=ポイント制移行後の未確定月に対する差額控除。本人別に future reward summary へ反映する。';

UPDATE public.reward_member_liability_offsets
SET
  status = 'voided',
  voided_at = now(),
  voided_by = 'codex:2026-07-16-zmp-legacy-agreement-fixed',
  metadata_json = COALESCE(metadata_json, '{}'::jsonb) || jsonb_build_object(
    'void_reason',
    'Months before the 2026-07 point-system transition are fixed by prior agreement; new point basis does not create retroactive payout differences',
    'void_source',
    'payouts_legacy_agreement_fixed_202607'
  )
WHERE project_id = 'p19'
  AND plan_cycle_id = 'PC-p19-202601-202612'
  AND status IN ('pending', 'active')
  AND COALESCE(source_ym, applies_from_ym) < '202607'
  AND (
    origin_type = 'ms_overview_edit'
    OR metadata_json->>'source' = 'zmp_locked_actuals_audit'
  );

UPDATE public.reward_member_liability_offsets
SET metadata_json = (COALESCE(metadata_json, '{}'::jsonb) - 'void_reason') || jsonb_build_object(
    'void_reason',
    'Months before the 2026-07 point-system transition are fixed by prior agreement; new point basis does not create retroactive payout differences',
    'void_source',
    'payouts_legacy_agreement_fixed_202607'
  )
WHERE project_id = 'p19'
  AND plan_cycle_id = 'PC-p19-202601-202612'
  AND voided_by = 'codex:2026-07-16-zmp-shin-tolerated-recovery';
