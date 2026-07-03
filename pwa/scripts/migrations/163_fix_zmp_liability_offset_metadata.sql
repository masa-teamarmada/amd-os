-- 163_fix_zmp_liability_offset_metadata.sql
-- Correct audit metadata only: ID010 is ran; the tolerated ZMP 2026 small-overpayment
-- members are kou (ID004) and shin (ID026). This does not change offset amounts or
-- reward calculation behavior.

UPDATE public.reward_member_liability_offsets
SET metadata_json = jsonb_set(
    jsonb_set(
      metadata_json,
      '{tolerated_members}',
      '["ID004","ID026"]'::jsonb,
      true
    ),
    '{metadata_corrected_at}',
    to_jsonb(now()),
    true
  )
WHERE project_id = 'p19'
  AND plan_cycle_id = 'PC-p19-202601-202612'
  AND member_id IN ('ID008', 'ID009')
  AND applies_from_ym = '202605'
  AND metadata_json->>'source' = 'zmp_locked_actuals_audit'
  AND metadata_json->'tolerated_members' = '["ID004","ID010"]'::jsonb;
