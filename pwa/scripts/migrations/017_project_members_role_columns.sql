-- 017_project_members_role_columns.sql
--
-- /project/[projectId]/config (PJ 設定画面) 移植のため、project_members に役割列を追加。
-- GAS DB_ProjectMembers の isPM / isCloser / roleLabel 相当。
--
-- 設計議論: HANDOFF_pwa_rebuild.md (2026-05-07 セッション、config link 移植タスク)
-- GAS source: gas/226_ProjectConfig.html, gas/042_ProjectConfig_Api.js

alter table public.project_members
  add column if not exists is_pm boolean not null default false,
  add column if not exists is_closer boolean not null default false,
  add column if not exists role_label text;

-- 既存の members.role が "pm" / "closer" の場合は反映
update public.project_members pm
set is_pm = true
from public.members m
where pm.member_id = m.member_id
  and m.role = 'pm'
  and pm.is_pm = false;
