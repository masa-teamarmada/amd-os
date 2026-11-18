-- 稼働月の固定報酬。1行で「この月以降は記載メンバーだけ稼働」を表す。
create table if not exists public.project_fixed_monthly_rewards (
  project_id text not null references public.projects(project_id),
  effective_from_ym text not null check (effective_from_ym ~ '^[0-9]{6}$'),
  member_amounts_json jsonb not null check (jsonb_typeof(member_amounts_json) = 'object'),
  reason text not null,
  confirmed_by text not null,
  created_at timestamptz not null default now(),
  primary key (project_id, effective_from_ym)
);

alter table public.project_fixed_monthly_rewards enable row level security;
revoke all on public.project_fixed_monthly_rewards from anon, authenticated;
grant select, insert, update on public.project_fixed_monthly_rewards to service_role;

insert into public.project_fixed_monthly_rewards
  (project_id, effective_from_ym, member_amounts_json, reason, confirmed_by)
values
  ('p19', '202611', '{"ID009":63960,"ID004":19500}'::jsonb,
   '2026年11月以降はあび・こうのみ稼働。各人の稼働月の報酬は毎月同額。', 'masa')
on conflict (project_id, effective_from_ym) do nothing;

insert into amd_os_internal.history_table_scope (table_name)
values ('project_fixed_monthly_rewards')
on conflict (table_name) do nothing;
select public.amd_os_refresh_data_change_history_triggers();
