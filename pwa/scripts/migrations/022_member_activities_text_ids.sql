-- 022: member_activities の member_id / project_id を UUID → text に変更
--
-- 背景: cron `/api/cron/member-activities` が以下のエラーで全件失敗していた:
--   "invalid input syntax for type uuid: \"ID001\""
--   "invalid input syntax for type uuid: \"まさ\""
-- 原因: テーブル作成時 (GAS 経由?) に UUID 型で作られていたが、
-- アプリ全体は member_id (text "ID001"), project_id (text "p20") で扱ってる。
--
-- データ確認: count = 0 (cron が UUID error で書けなかったので空のまま)。
-- なので USING キャストでも実害なし。

-- 既存ポリシー / FK を一時 DROP (型変更の妨げ)
drop policy if exists member_activities_select on member_activities;
drop policy if exists member_activities_insert on member_activities;
drop policy if exists member_activities_update on member_activities;
drop policy if exists member_activities_delete on member_activities;
drop policy if exists service_role_bypass on member_activities;

alter table member_activities
  drop constraint if exists member_activities_member_id_fkey,
  drop constraint if exists member_activities_project_id_fkey;

alter table member_activities
  alter column member_id type text using member_id::text,
  alter column project_id type text using project_id::text;

-- 新しい FK (member_id → members.member_id, project_id → projects.project_id, 共に text)
alter table member_activities
  add constraint member_activities_member_id_fkey
    foreign key (member_id) references members(member_id) on delete set null deferrable initially deferred,
  add constraint member_activities_project_id_fkey
    foreign key (project_id) references projects(project_id) on delete cascade deferrable initially deferred;

-- ポリシー再作成 (anon read + service_role 全権)
alter table member_activities enable row level security;
create policy member_activities_select on member_activities for select using (true);
create policy service_role_bypass on member_activities for all
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
