alter table public.value_milestones
  add column if not exists period_start_ym text,
  add column if not exists target_ym text;

comment on column public.value_milestones.period_start_ym is
  'MS-level start YM (YYYYMM). If null, clients fall back to the plan-cycle start YM.';
comment on column public.value_milestones.target_ym is
  'MS-level target/end YM (YYYYMM). If null, clients fall back to the plan-cycle end YM or legacy GAS schedule.';

create index if not exists idx_value_milestones_period_yms
  on public.value_milestones (plan_cycle_id, period_start_ym, target_ym);
