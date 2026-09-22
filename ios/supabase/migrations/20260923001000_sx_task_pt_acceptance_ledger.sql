-- SX 2026-10 以降: 成果物の検収とpt配分を一つの取引で確定する。
-- 既存の project_actions は作業の正本。支払根拠は検収時点の不変スナップショットにする。
-- ツリーの付け替えや担当変更で過去の支払額が変わらないための境界。

create table public.project_action_pt_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(project_id),
  action_id uuid not null unique references public.project_actions(id) on delete restrict,
  milestone_id text not null references public.value_milestones(milestone_id),
  title_snapshot text not null,
  accepted_pt numeric(6,1) not null check (accepted_pt >= 0),
  ym text not null check (ym ~ '^[0-9]{6}$'),
  reviewed_at timestamptz not null default now(),
  reviewed_by text not null references public.members(member_id)
);

create index project_action_pt_reviews_project_month_idx
  on public.project_action_pt_reviews (project_id, ym, milestone_id);

create table public.project_action_pt_review_allocations (
  review_id uuid not null references public.project_action_pt_reviews(id) on delete restrict,
  member_id text not null references public.members(member_id),
  earned_pt numeric(8,2) not null check (earned_pt >= 0),
  primary key (review_id, member_id)
);

alter table public.project_action_pt_reviews enable row level security;
alter table public.project_action_pt_review_allocations enable row level security;
create policy project_action_pt_reviews_service_all on public.project_action_pt_reviews
  for all to service_role using (true) with check (true);
create policy project_action_pt_review_allocations_service_all on public.project_action_pt_review_allocations
  for all to service_role using (true) with check (true);

create function public.reject_sx_task_pt_ledger_mutation()
returns trigger language plpgsql as $$
begin
  raise exception '検収台帳は修正・削除できないよ。訂正は別の監査付き処理で行ってね';
end;
$$;
create trigger project_action_pt_reviews_immutable
  before update or delete on public.project_action_pt_reviews
  for each row execute function public.reject_sx_task_pt_ledger_mutation();
create trigger project_action_pt_review_allocations_immutable
  before update or delete on public.project_action_pt_review_allocations
  for each row execute function public.reject_sx_task_pt_ledger_mutation();

create or replace function public.accept_sx_task_pt(
  p_project_id text,
  p_action_id uuid,
  p_accepted_pt numeric,
  p_reviewed_by text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action public.project_actions%rowtype;
  v_ms_ids text[];
  v_milestone_id text;
  v_ms_points numeric;
  v_ms_tag text;
  v_existing_pt numeric;
  v_owner_count integer;
  v_explicit_count integer;
  v_share_total numeric;
  v_owner record;
  v_share numeric;
  v_allocated numeric := 0;
  v_member_pt numeric;
  v_review_id uuid;
  v_now timestamptz := clock_timestamp();
  v_ym text;
  v_cumulative numeric;
  v_prior_protected boolean;
begin
  if p_project_id <> 'p21' then
    raise exception 'タスクptの検収はSXの試行だけだよ';
  end if;
  v_ym := to_char(v_now at time zone 'Asia/Tokyo', 'YYYYMM');
  if v_ym < '202610' then
    raise exception 'SXのタスクptは2026年10月からだよ';
  end if;
  select count(*) = 2 and bool_and(
    reward_paid_at is not null or payout_notice_uploaded_at is not null
    or payment_confirmed_at is not null
  ) into v_prior_protected
    from public.billing_cycles
   where project_id = p_project_id and ym in ('202608', '202609');
  if not coalesce(v_prior_protected, false) then
    raise exception 'SXの8月・9月の支払保護が済むまでタスクptは検収できないよ';
  end if;
  if exists (
    select 1 from public.billing_cycles
     where project_id = p_project_id and ym = v_ym
       and (reward_paid_at is not null or payout_notice_uploaded_at is not null
            or payment_confirmed_at is not null)
  ) then
    raise exception 'この月の支払は保護済みなので、タスクptを追加検収できないよ';
  end if;
  if p_accepted_pt is null or p_accepted_pt < 0 or p_accepted_pt > 9999.9
     or p_accepted_pt <> round(p_accepted_pt, 1) then
    raise exception '確定ptは0以上・小数1桁で入れてね';
  end if;
  if p_reviewed_by is null or not exists (
    select 1 from public.members where member_id = p_reviewed_by and status = 'active'
  ) then
    raise exception '検収者を名簿で確認できないよ';
  end if;
  if not exists (
    select 1 from public.project_members
     where project_id = p_project_id and member_id = p_reviewed_by
       and is_active = true and (is_pm = true or is_pl = true)
  ) then
    raise exception 'このPJのPMまたはPLだけが検収できるよ';
  end if;

  select * into v_action from public.project_actions
   where id = p_action_id and project_id = p_project_id and deleted_at is null
   for update;
  if not found then raise exception 'TODOが見つからないよ'; end if;
  if v_action.review_state is distinct from 'accepted'
     or v_action.status <> 'done' or v_action.actual_end is null
     or nullif(btrim(coalesce(v_action.done_evidence, '')), '') is null then
    raise exception '承認済み・完了済み・完了証跡ありのTODOだけ検収できるよ';
  end if;
  if v_action.review_result is not null or v_action.accepted_pt is not null
     or exists (select 1 from public.project_action_pt_reviews where action_id = p_action_id) then
    raise exception 'このTODOはすでに検収済みだよ';
  end if;
  if exists (
    select 1 from public.project_action_owners
     where action_id = p_action_id and member_id = p_reviewed_by
  ) then
    raise exception '自分が担当したTODOは自分で検収できないよ';
  end if;

  -- TODOの親子と問いへの線をたどる。MSが0本・複数なら報酬先が曖昧なので確定しない。
  with recursive task_chain as (
    select id, parent_id, origin_question_id from public.project_actions
     where id = p_action_id and project_id = p_project_id and deleted_at is null
    union all
    select parent.id, parent.parent_id, parent.origin_question_id
      from public.project_actions parent join task_chain child on parent.id = child.parent_id
     where parent.project_id = p_project_id and parent.deleted_at is null
  ), question_seeds as (
    select origin_question_id as id from task_chain where origin_question_id is not null
    union
    select qa.question_id from public.project_question_actions qa
      join task_chain tc on tc.id = qa.action_id
     where qa.project_id = p_project_id
  ), question_chain as (
    select q.id, q.parent_id from public.project_questions q
      join question_seeds seed on seed.id = q.id
     where q.project_id = p_project_id and q.deleted_at is null
    union all
    select parent.id, parent.parent_id from public.project_questions parent
      join question_chain child on parent.id = child.parent_id
     where parent.project_id = p_project_id and parent.deleted_at is null
  )
  select array_agg(distinct qm.milestone_id) into v_ms_ids
    from question_chain qc
    join public.project_question_milestones qm
      on qm.question_id = qc.id and qm.project_id = p_project_id
    join public.value_milestones ms
      on ms.milestone_id = qm.milestone_id and ms.is_active = true
    join public.value_plan_cycles plan
      on plan.plan_cycle_id = ms.plan_cycle_id and plan.project_id = p_project_id
     and plan.period_start_ym <= v_ym and plan.period_end_ym >= v_ym;
  if coalesce(array_length(v_ms_ids, 1), 0) <> 1 then
    raise exception 'TODOの報酬対象MSは1本に確定してね（現在%本）', coalesce(array_length(v_ms_ids, 1), 0);
  end if;
  v_milestone_id := v_ms_ids[1];
  -- 同一MSの検収を直列化し、同時承認で上限ptを超えないようにする。
  select points, tag into v_ms_points, v_ms_tag from public.value_milestones
   where milestone_id = v_milestone_id and period_start_ym >= '202610'
   for update;
  if v_ms_points is null or v_ms_points <= 0 or lower(coalesce(v_ms_tag, '')) = 'routine' then
    raise exception '10月開始の新MSだけがタスクptの対象だよ';
  end if;
  select coalesce(sum(accepted_pt), 0) into v_existing_pt
    from public.project_action_pt_reviews where milestone_id = v_milestone_id;
  if v_existing_pt + p_accepted_pt > v_ms_points then
    raise exception '検収ptがMSの残ptを超えるよ（残り%pt）', v_ms_points - v_existing_pt;
  end if;

  select count(*), count(share), coalesce(sum(share), 0)
    into v_owner_count, v_explicit_count, v_share_total
    from public.project_action_owners where action_id = p_action_id and project_id = p_project_id;
  if p_accepted_pt > 0 and v_owner_count = 0 then
    raise exception 'ptがあるTODOには担当者が必要だよ';
  end if;
  if v_explicit_count <> 0 and (v_explicit_count <> v_owner_count or abs(v_share_total - 1) > 0.0001) then
    raise exception '担当割合は全員均等か、合計100%%にしてね';
  end if;

  insert into public.project_action_pt_reviews
    (project_id, action_id, milestone_id, title_snapshot, accepted_pt, ym, reviewed_at, reviewed_by)
  values (p_project_id, p_action_id, v_milestone_id, v_action.title, p_accepted_pt, v_ym, v_now, p_reviewed_by)
  returning id into v_review_id;

  for v_owner in
    select member_id, share, row_number() over (order by member_id) as n
      from public.project_action_owners
     where action_id = p_action_id and project_id = p_project_id
     order by member_id
  loop
    v_share := case when v_explicit_count = 0 then 1::numeric / v_owner_count else v_owner.share end;
    v_member_pt := case when v_owner.n = v_owner_count
      then p_accepted_pt - v_allocated
      else round(p_accepted_pt * v_share, 2) end;
    insert into public.project_action_pt_review_allocations (review_id, member_id, earned_pt)
    values (v_review_id, v_owner.member_id, v_member_pt);
    v_allocated := v_allocated + v_member_pt;
  end loop;

  update public.project_actions
     set accepted_pt = p_accepted_pt, reviewed_at = v_now, reviewed_by = p_reviewed_by,
         review_result = 'accepted', last_verified_at = (v_now at time zone 'Asia/Tokyo')::date,
         updated_by = p_reviewed_by, version = version + 1
   where id = p_action_id;

  v_cumulative := v_existing_pt + p_accepted_pt;
  insert into public.milestone_monthly_progress
    (milestone_key, ym, progress_pct, consumed_pt, source, confirmed_at, note)
  values (v_milestone_id, v_ym, round(v_cumulative * 100 / v_ms_points, 1),
          v_cumulative, 'todo_acceptance', v_now, 'TODO検収実績')
  on conflict (milestone_key, ym) do update
     set progress_pct = excluded.progress_pct, consumed_pt = excluded.consumed_pt,
         source = excluded.source, confirmed_at = excluded.confirmed_at, note = excluded.note;

  return v_review_id;
end;
$$;

revoke all on function public.accept_sx_task_pt(text, uuid, numeric, text) from public;
grant execute on function public.accept_sx_task_pt(text, uuid, numeric, text) to service_role;
