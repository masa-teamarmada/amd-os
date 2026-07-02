-- 162_zmp_2026_liability_offsets.sql
-- ZMP 2026 season: keep already paid/sent 202605 payouts unchanged, and offset only
-- Abi/Ume overpaid amounts from each same member's unpaid stock. Shin/Koh differences are
-- intentionally tolerated by Masa's 2026-07-02 decision.

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
  'ZMP 2026 paid/sent amount exceeded current reward basis; offset only from Abi same-member unpaid stock.',
  '{"policy":"same_member_stock_only","decision_date":"2026-07-02","tolerated_members":["ID004","ID010"],"source":"zmp_locked_actuals_audit"}'::jsonb,
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
  'ZMP 2026 paid/sent amount exceeded current reward basis; offset only from Ume same-member unpaid stock.',
  '{"policy":"same_member_stock_only","decision_date":"2026-07-02","tolerated_members":["ID004","ID010"],"source":"zmp_locked_actuals_audit"}'::jsonb,
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
