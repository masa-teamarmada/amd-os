-- 支払通知書の金額だけを、代表の確定指示で上書きする追記専用台帳。
-- 稼働報酬・未払残・別財布の権利はこの台帳で変更しない。
create table if not exists public.member_payout_amount_confirmation_events (
  id bigint generated always as identity primary key,
  event_key text not null unique,
  project_id text not null references public.projects(project_id),
  source_ym text not null check (source_ym ~ '^[0-9]{6}$' and source_ym >= '202607'),
  payment_ym text not null check (payment_ym ~ '^[0-9]{6}$'),
  member_id text not null references public.members(member_id),
  action text not null check (action in ('set','clear')),
  amount_yen bigint check (amount_yen >= 0),
  reason text not null check (length(btrim(reason)) > 0),
  authorized_by text not null check (length(btrim(authorized_by)) > 0),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default now(),
  check ((action = 'set' and amount_yen is not null) or (action = 'clear' and amount_yen is null))
);

create index if not exists member_payout_amount_confirmation_events_target_idx
  on public.member_payout_amount_confirmation_events (project_id, source_ym, member_id, id desc);

alter table public.member_payout_amount_confirmation_events enable row level security;
revoke all on public.member_payout_amount_confirmation_events from anon, authenticated;
grant select, insert on public.member_payout_amount_confirmation_events to service_role;
grant usage, select on sequence public.member_payout_amount_confirmation_events_id_seq to service_role;

insert into amd_os_internal.history_table_scope (table_name)
values ('member_payout_amount_confirmation_events')
on conflict (table_name) do nothing;
select public.amd_os_refresh_data_change_history_triggers();
