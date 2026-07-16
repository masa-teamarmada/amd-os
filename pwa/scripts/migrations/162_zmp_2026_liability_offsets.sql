-- 162_zmp_2026_liability_offsets.sql
-- ZMP 2026 season legacy note:
-- This migration predated the 2026-07 policy correction. Migration 165 voids
-- these rows because pre-point-system months were agreed/paid under the old terms
-- and must not become retroactive point-basis payout differences.

INSERT INTO public.reward_member_liability_offsets (
  project_id,
  plan_cycle_id,
  member_id,
  pool,
  amount_yen,
  applies_from_ym,
  reason,
  metadata_json,
  created_by
)
SELECT
  'p19',
  'PC-p19-202601-202612',
  'ID009',
  'any',
  1658,
  '202605',
  'Legacy ZMP 2026 point-basis difference row; superseded and voided by migration 165 because pre-2026-07 months are fixed by prior agreement.',
  '{"policy":"same_member_stock_only","decision_date":"2026-07-02","tolerated_members":["ID004","ID026"],"source":"zmp_locked_actuals_audit"}'::jsonb,
  'codex:2026-07-02'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.reward_member_liability_offsets
  WHERE project_id = 'p19'
    AND plan_cycle_id = 'PC-p19-202601-202612'
    AND member_id = 'ID009'
    AND pool = 'any'
    AND applies_from_ym = '202605'
    AND status = 'active'
);

INSERT INTO public.reward_member_liability_offsets (
  project_id,
  plan_cycle_id,
  member_id,
  pool,
  amount_yen,
  applies_from_ym,
  reason,
  metadata_json,
  created_by
)
SELECT
  'p19',
  'PC-p19-202601-202612',
  'ID008',
  'any',
  1560,
  '202605',
  'Legacy ZMP 2026 point-basis difference row; superseded and voided by migration 165 because pre-2026-07 months are fixed by prior agreement.',
  '{"policy":"same_member_stock_only","decision_date":"2026-07-02","tolerated_members":["ID004","ID026"],"source":"zmp_locked_actuals_audit"}'::jsonb,
  'codex:2026-07-02'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.reward_member_liability_offsets
  WHERE project_id = 'p19'
    AND plan_cycle_id = 'PC-p19-202601-202612'
    AND member_id = 'ID008'
    AND pool = 'any'
    AND applies_from_ym = '202605'
    AND status = 'active'
);
