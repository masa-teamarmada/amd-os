-- ゴールツリー Phase 0: 型の追加
-- 正本: pwa/spec/3-22-goal-tree-plan.md §3（ゴールツリーの型）・§4（会議中と会議後）・§6（ptの配り方）
--
-- 入れるもの
--   1. 問いの種類に goal（到達点）と milestone（MS）。根だけ goal、milestone は goal の直下だけ
--   2. project_question_milestones … 木のMS ↔ シーズンのMS（value_milestones）の対応。多対多
--   3. project_actions に 見積pt / 確定pt / 受託の状態
--   4. project_action_owners … TODOの担当（複数可）。owner_label は表示互換で残す
--
-- Phase 0 は列と入力欄だけ。報酬計算（manual/7-1）とMS進捗（spec/3-10）の読み書きは変えない。

-- 1. 問いの種類 --------------------------------------------------------------

alter table public.project_questions
  drop constraint if exists project_questions_question_kind_check;

alter table public.project_questions
  add constraint project_questions_question_kind_check
  check (question_kind = any (array['open'::text, 'decision'::text, 'goal'::text, 'milestone'::text]));

-- 到達点は根にしか置けない。逆（根は必ず到達点）は強制しない。既存の根を
-- 到達点の下へ付け替えるのは Phase 0 の 0-4 で、それまで両方が並ぶ。
alter table public.project_questions
  drop constraint if exists project_questions_goal_is_root;

alter table public.project_questions
  add constraint project_questions_goal_is_root
  check (question_kind <> 'goal'::text or parent_id is null);

-- MSの置き場所は親を見ないと決まらないので CHECK では書けない。
-- 画面とAPIでも同じ検査をするが、直接SQLを流したときもここで止める。
create or replace function public.assert_goal_tree_placement()
returns trigger
language plpgsql
as $$
declare
  parent_kind text;
  live_milestone_children integer;
begin
  if new.question_kind = 'milestone' then
    if new.parent_id is null then
      raise exception 'MSは到達点の直下だけだよ。根には置けない';
    end if;
    select question_kind into parent_kind
      from public.project_questions
     where id = new.parent_id;
    if parent_kind is distinct from 'goal' then
      raise exception 'MSの親は到達点だけだよ（いまの親の種類: %）', coalesce(parent_kind, '親が見つからない');
    end if;
  end if;

  -- 到達点をやめるときは、直下にMSが残っていないこと。残したままだと
  -- MSが到達点でない親にぶら下がる。
  if tg_op = 'UPDATE'
     and old.question_kind = 'goal'
     and new.question_kind is distinct from 'goal' then
    select count(*) into live_milestone_children
      from public.project_questions
     where parent_id = new.id
       and question_kind = 'milestone'
       and deleted_at is null;
    if live_milestone_children > 0 then
      raise exception '直下にMSが%件あるから、到達点をやめられないよ', live_milestone_children;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists project_questions_goal_tree_placement on public.project_questions;

create trigger project_questions_goal_tree_placement
  before insert or update of question_kind, parent_id
  on public.project_questions
  for each row
  execute function public.assert_goal_tree_placement();

-- 2. 木のMS ↔ シーズンのMS ---------------------------------------------------

create table if not exists public.project_question_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  question_id uuid not null references public.project_questions(id) on delete cascade,
  milestone_id text not null references public.value_milestones(milestone_id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by text,
  constraint project_question_milestones_pair_unique unique (question_id, milestone_id)
);

create index if not exists project_question_milestones_project_idx
  on public.project_question_milestones (project_id);
create index if not exists project_question_milestones_milestone_idx
  on public.project_question_milestones (milestone_id);

alter table public.project_question_milestones enable row level security;

drop policy if exists project_question_milestones_member_select on public.project_question_milestones;
create policy project_question_milestones_member_select
  on public.project_question_milestones for select to authenticated
  using (amd_os_can_access_project(project_id));

drop policy if exists project_question_milestones_manager_insert on public.project_question_milestones;
create policy project_question_milestones_manager_insert
  on public.project_question_milestones for insert to authenticated
  with check (amd_os_can_manage_project_shared_data(project_id));

drop policy if exists project_question_milestones_manager_update on public.project_question_milestones;
create policy project_question_milestones_manager_update
  on public.project_question_milestones for update to authenticated
  using (amd_os_can_manage_project_shared_data(project_id))
  with check (amd_os_can_manage_project_shared_data(project_id));

drop policy if exists project_question_milestones_manager_delete on public.project_question_milestones;
create policy project_question_milestones_manager_delete
  on public.project_question_milestones for delete to authenticated
  using (amd_os_can_manage_project_shared_data(project_id));

drop policy if exists project_question_milestones_service_all on public.project_question_milestones;
create policy project_question_milestones_service_all
  on public.project_question_milestones for all to service_role
  using (true) with check (true);

-- 3. TODOのpt と 受託の状態 ---------------------------------------------------

alter table public.project_actions
  add column if not exists estimated_pt numeric(6,1),
  add column if not exists accepted_pt numeric(6,1),
  add column if not exists accept_state text not null default 'unassigned',
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text,
  add column if not exists review_result text;

alter table public.project_actions
  drop constraint if exists project_actions_accept_state_check;
alter table public.project_actions
  add constraint project_actions_accept_state_check
  check (accept_state = any (array['unassigned'::text, 'assigned'::text, 'accepted'::text, 'negotiating'::text]));

alter table public.project_actions
  drop constraint if exists project_actions_review_result_check;
alter table public.project_actions
  add constraint project_actions_review_result_check
  check (review_result is null or review_result = any (array['accepted'::text, 'returned'::text]));

-- pt 0 は許す（1時間で終わる確認・支払済みMSの残作業。3-22 §6 原則6・原則10）。
-- 負の pt は許さない。
alter table public.project_actions
  drop constraint if exists project_actions_pt_nonnegative;
alter table public.project_actions
  add constraint project_actions_pt_nonnegative
  check ((estimated_pt is null or estimated_pt >= 0) and (accepted_pt is null or accepted_pt >= 0));

-- 4. TODOの担当（複数可） -----------------------------------------------------

create table if not exists public.project_action_owners (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  action_id uuid not null references public.project_actions(id) on delete cascade,
  member_id text not null references public.members(member_id) on delete restrict,
  -- NULL は「均等」。人数で割った値を読み手が決める。明示した分だけ値が入る。
  share numeric(5,4),
  created_at timestamptz not null default now(),
  created_by text,
  constraint project_action_owners_pair_unique unique (action_id, member_id),
  constraint project_action_owners_share_range check (share is null or (share > 0 and share <= 1))
);

create index if not exists project_action_owners_project_idx
  on public.project_action_owners (project_id);
create index if not exists project_action_owners_member_idx
  on public.project_action_owners (member_id);

alter table public.project_action_owners enable row level security;

drop policy if exists project_action_owners_member_select on public.project_action_owners;
create policy project_action_owners_member_select
  on public.project_action_owners for select to authenticated
  using (amd_os_can_access_project(project_id));

drop policy if exists project_action_owners_manager_insert on public.project_action_owners;
create policy project_action_owners_manager_insert
  on public.project_action_owners for insert to authenticated
  with check (amd_os_can_manage_project_shared_data(project_id));

drop policy if exists project_action_owners_manager_update on public.project_action_owners;
create policy project_action_owners_manager_update
  on public.project_action_owners for update to authenticated
  using (amd_os_can_manage_project_shared_data(project_id))
  with check (amd_os_can_manage_project_shared_data(project_id));

drop policy if exists project_action_owners_manager_delete on public.project_action_owners;
create policy project_action_owners_manager_delete
  on public.project_action_owners for delete to authenticated
  using (amd_os_can_manage_project_shared_data(project_id));

drop policy if exists project_action_owners_service_all on public.project_action_owners;
create policy project_action_owners_service_all
  on public.project_action_owners for all to service_role
  using (true) with check (true);

-- 担当が付いた時点が委託（3-22 §4）。担当が全員外れたら未アサインへ戻す。
create or replace function public.sync_action_accept_state()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.project_actions
       set accept_state = 'assigned'
     where id = new.action_id
       and accept_state = 'unassigned';
    return new;
  end if;

  if tg_op = 'DELETE' then
    if not exists (
      select 1 from public.project_action_owners where action_id = old.action_id
    ) then
      update public.project_actions
         set accept_state = 'unassigned',
             accepted_at = null,
             accepted_by = null
       where id = old.action_id
         and accept_state in ('assigned', 'negotiating');
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists project_action_owners_sync_accept_state on public.project_action_owners;

create trigger project_action_owners_sync_accept_state
  after insert or delete on public.project_action_owners
  for each row
  execute function public.sync_action_accept_state();
