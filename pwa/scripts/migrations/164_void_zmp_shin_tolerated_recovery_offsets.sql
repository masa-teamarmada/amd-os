-- 164_void_zmp_shin_tolerated_recovery_offsets.sql
-- ZMP 2026 season: Shin (ID026) small overpayment was explicitly tolerated by
-- Masa's 2026-07-02 decision. Later MS edits generated pending negative recovery
-- rows for the protected 202601-202605 months and applied them to 202606,
-- which zeroed Shin's July payout. Keep the audit trail, but do not recover it.

UPDATE public.reward_member_liability_offsets
SET
  status = 'voided',
  voided_at = now(),
  voided_by = 'codex:2026-07-16-zmp-shin-tolerated-recovery',
  metadata_json = metadata_json || jsonb_build_object(
    'void_reason',
    'Shin (ID026) negative MS-overview recovery is tolerated for ZMP 2026 per Masa 2026-07-02 decision',
    'void_source',
    'payouts_shin_missing_202607'
  )
WHERE project_id = 'p19'
  AND plan_cycle_id = 'PC-p19-202601-202612'
  AND member_id = 'ID026'
  AND status = 'pending'
  AND origin_type = 'ms_overview_edit'
  AND apply_ym = '202606'
  AND offset_yen < 0;
