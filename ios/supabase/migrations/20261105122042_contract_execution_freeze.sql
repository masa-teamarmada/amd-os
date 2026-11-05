-- 締結の証跡・契約書上の期間と、実務上の履行凍結を別軸で保持する。
alter table public.contracts
  add column execution_status text not null default 'standard',
  add column execution_frozen_from_ym text,
  add column execution_status_note text;

alter table public.contracts
  add constraint contracts_execution_freeze_check check (
    (execution_status = 'standard' and execution_frozen_from_ym is null)
    or
    (execution_status = 'frozen' and execution_frozen_from_ym ~ '^[0-9]{4}(0[1-9]|1[0-2])$')
  );

comment on column public.contracts.execution_status is
  'standard=契約原本の期間から判定、frozen=実務上の契約凍結。締結済みの証跡はstatus=signedに残す。';
comment on column public.contracts.execution_frozen_from_ym is
  '実務上の履行凍結が始まった対象月 YYYYMM。原本の終了日ではない。';

do $$
declare updated_count integer;
begin
  update public.contracts
  set execution_status = 'frozen',
      execution_frozen_from_ym = '202605',
      execution_status_note = '2026年5月以降の発注保留。2026-11-05に、やりとりを再開する予定がない凍結状態と本人が確認。契約書上の解約日は未確認。',
      updated_at = now()
  where contract_id = '82b57da5-a2ab-508e-afbe-58ac9b8cb9cb'
    and project_id = 'p06'
    and status = 'signed'
    and registry_status = 'accepted';
  get diagnostics updated_count = row_count;
  if updated_count <> 1 then
    raise exception 'CTB accepted signed contract not found: % rows', updated_count;
  end if;
end $$;
