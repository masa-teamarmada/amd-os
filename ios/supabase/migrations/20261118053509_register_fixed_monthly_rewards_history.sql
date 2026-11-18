-- 本番で先行作成された固定月額台帳を、AMD OSの変更履歴へ登録する。
insert into amd_os_internal.history_table_scope (table_name)
values ('project_fixed_monthly_rewards')
on conflict (table_name) do nothing;
select public.amd_os_refresh_data_change_history_triggers();
