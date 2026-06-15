alter table public.projects
  add column if not exists contract_terms_json jsonb;

comment on column public.projects.contract_terms_json is
  'Contract terms extracted from source contracts for admin/projects cross-project comparison. Expected keys: monthlyFeeYen, contractStartYm, contractEndYm, actualWorkStartYm, billingStartYm, rewardPoolYen, monthlyRewardCapYen, sourceTitle, sourceRef, notes.';
