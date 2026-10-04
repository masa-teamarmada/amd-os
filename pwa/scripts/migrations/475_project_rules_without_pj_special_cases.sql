-- 475: PJ番号を名指しした DB の規則を、PJごとの設定（データ）で決まる全PJ共通の規則に置き換える。
--
-- 2026-10-04 まさ「どれか特定のPJだけの処理は実装しないで。使える機能なら全PJに適用して。
-- OSはあくまでシステムとして開発してるので、特定のPJだけの特例を入れたらシステムにならない。」
--
-- 1. タスクptの検収: 関数 accept_sx_task_pt は p21・202610 を本体に書いていた。
--    PJの設定 projects.task_point_review_from_ym（検収を始めた月）を読む accept_project_task_pt にする。
--    SOL は 202610 を入れるので、SOL の検収の結果は変わらない。ほかのPJは空のまま（始めるかはまさの判断）。
--    あわせて、検収者を引数で受け取るこの関数を anon・authenticated が直に呼べた権限を外す（呼ぶのはサーバだけ）。
-- 2. 旧タスク台帳の読み取り専用: guard_zmp_legacy_task_ledger は p19 を本体に書いていた。
--    PJの設定 projects.legacy_task_ledger_read_only を読む共通の guard にする（ZMP は true）。
-- 3. 前提条件のMS（口頭合意の確認）: 点のMSの決まりの例外を、p21 と2つの slug の名指しから
--    MS の列 gate_kind で決める形にする（SOL の2つは oral_agreement）。
-- 4. PJの別名（project_knowledge の category='alias'）に、コードへ直に書いていた別名を移す。
--
-- 画面・API は同じ commit で、この設定を読む形に変える。accept_sx_task_pt は本番の画面が新しい版に
-- 入れ替わるまでの橋渡しとして残し、次の migration で消す。

BEGIN;

-- ── 1. タスクptの検収を始めた月 ─────────────────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS task_point_review_from_ym text;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_task_point_review_from_ym_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_task_point_review_from_ym_check
  CHECK (task_point_review_from_ym IS NULL OR task_point_review_from_ym ~ '^[0-9]{4}(0[1-9]|1[0-2])$');

COMMENT ON COLUMN public.projects.task_point_review_from_ym IS
  'タスクptの検収を始めた月（YYYYMM）。空のPJは検収しない（MSの月割りのまま）。この月以降に始まるMSは、ゴールツリーのTODOの検収ptで報酬が決まる。始める前の2か月の支払保護が済むまで検収できない。2026-10-04 migration 475 で全PJ共通の設定にした。';

UPDATE public.projects SET task_point_review_from_ym = '202610' WHERE project_id = 'p21';

CREATE OR REPLACE FUNCTION public.accept_project_task_pt(
  p_project_id text,
  p_action_id uuid,
  p_accepted_pt numeric,
  p_reviewed_by text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_action public.project_actions%rowtype;
  v_from_ym text;
  v_prior_1 text;
  v_prior_2 text;
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
  select task_point_review_from_ym into v_from_ym
    from public.projects where project_id = p_project_id;
  if v_from_ym is null then
    raise exception 'このPJはタスクptの検収をまだ始めていないよ';
  end if;
  v_ym := to_char(v_now at time zone 'Asia/Tokyo', 'YYYYMM');
  if v_ym < v_from_ym then
    raise exception 'このPJのタスクptは%年%月からだよ', left(v_from_ym, 4), right(v_from_ym, 2)::integer;
  end if;
  v_prior_1 := to_char(to_date(v_from_ym || '01', 'YYYYMMDD') - interval '1 month', 'YYYYMM');
  v_prior_2 := to_char(to_date(v_from_ym || '01', 'YYYYMMDD') - interval '2 months', 'YYYYMM');
  select count(*) = 2 and bool_and(
    reward_paid_at is not null or payout_notice_uploaded_at is not null
    or payment_confirmed_at is not null
  ) into v_prior_protected
    from public.billing_cycles
   where project_id = p_project_id and ym in (v_prior_2, v_prior_1);
  if not coalesce(v_prior_protected, false) then
    raise exception '検収を始める前の2か月（%・%）の支払保護が済むまでタスクptは検収できないよ', v_prior_2, v_prior_1;
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
   where milestone_id = v_milestone_id and period_start_ym >= v_from_ym
   for update;
  if v_ms_points is null or v_ms_points <= 0 or lower(coalesce(v_ms_tag, '')) = 'routine' then
    raise exception '検収を始めた月以降に始まるMSだけがタスクptの対象だよ';
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
$function$;

COMMENT ON FUNCTION public.accept_project_task_pt(text, uuid, numeric, text) IS
  'タスクpt検収（全PJ共通）。projects.task_point_review_from_ym が入っているPJだけ、その月以降に検収できる。検収者は引数で受け取るので、呼ぶのはサーバ（service_role）だけ。2026-10-04 migration 475。';

REVOKE ALL ON FUNCTION public.accept_project_task_pt(text, uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_project_task_pt(text, uuid, numeric, text) TO service_role;

-- 本番の画面が新しい版になるまでの橋渡し。次の migration で消す。
CREATE OR REPLACE FUNCTION public.accept_sx_task_pt(
  p_project_id text,
  p_action_id uuid,
  p_accepted_pt numeric,
  p_reviewed_by text
)
RETURNS uuid
LANGUAGE sql
SET search_path TO 'public'
AS $function$
  select public.accept_project_task_pt(p_project_id, p_action_id, p_accepted_pt, p_reviewed_by);
$function$;

REVOKE ALL ON FUNCTION public.accept_sx_task_pt(text, uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_sx_task_pt(text, uuid, numeric, text) TO service_role;

-- ── 2. 旧タスク台帳を読み取り専用にしたPJ ─────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS legacy_task_ledger_read_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.projects.legacy_task_ledger_read_only IS
  'true のPJは、タスクの正本を project_actions（ゴールツリーのTODO）へ移し終えたので、旧台帳 project_management_tasks を履歴として読むだけにする（追加・更新・物理削除をDBで止める）。2026-10-04 migration 475 で全PJ共通の設定にした。';

UPDATE public.projects SET legacy_task_ledger_read_only = true WHERE project_id = 'p19';

CREATE OR REPLACE FUNCTION public.guard_read_only_legacy_task_ledger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old_project_id text := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.project_id ELSE NULL END;
  v_new_project_id text := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.project_id ELSE NULL END;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.projects
     WHERE project_id IN (v_old_project_id, v_new_project_id)
       AND legacy_task_ledger_read_only
  ) THEN
    RAISE EXCEPTION
      'このPJのタスクの正本は project_actions（ゴールツリーのTODO）。project_management_tasks は履歴として読むだけ'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_read_only_legacy_task_ledger() IS
  'projects.legacy_task_ledger_read_only が true のPJについて、旧タスク台帳 project_management_tasks への書き込みを止める（全PJ共通）。2026-10-04 migration 475。';

DROP TRIGGER IF EXISTS project_management_tasks_zmp_read_only ON public.project_management_tasks;
DROP TRIGGER IF EXISTS project_management_tasks_legacy_read_only ON public.project_management_tasks;
CREATE TRIGGER project_management_tasks_legacy_read_only
BEFORE INSERT OR UPDATE OR DELETE
ON public.project_management_tasks
FOR EACH ROW
EXECUTE FUNCTION public.guard_read_only_legacy_task_ledger();

DROP FUNCTION IF EXISTS public.guard_zmp_legacy_task_ledger();

-- ── 3. 前提条件のMS（口頭合意の確認） ───────────────────────────────────
ALTER TABLE public.project_management_milestones
  ADD COLUMN IF NOT EXISTS gate_kind text;

ALTER TABLE public.project_management_milestones
  DROP CONSTRAINT IF EXISTS project_management_milestones_gate_kind_check;
ALTER TABLE public.project_management_milestones
  ADD CONSTRAINT project_management_milestones_gate_kind_check
  CHECK (gate_kind IS NULL OR gate_kind IN ('oral_agreement'));

COMMENT ON COLUMN public.project_management_milestones.gate_kind IS
  '前提条件のMSの種類。oral_agreement は「口頭合意を確認する」MSで、後に続くMSの前提になり、確認する期間（開始日〜完了日）を持てる。完了の根拠に「先方・合意内容・確認日・根拠」の4行が要る。空なら普通のMS（一点の予定日）。2026-10-04 migration 475 で全PJ共通の列にした。';

UPDATE public.project_management_milestones
   SET gate_kind = 'oral_agreement'
 WHERE project_id = 'p21'
   AND slug IN ('business-paid-poc-oral-agreement', 'funding-investment-oral-agreement');

ALTER TABLE public.project_management_milestones
  DROP CONSTRAINT IF EXISTS project_management_milestones_point_ms_check;
ALTER TABLE public.project_management_milestones
  ADD CONSTRAINT project_management_milestones_point_ms_check
  CHECK (
    timeline_kind <> 'milestone'
    OR gate_kind IS NOT NULL
    OR planned_start IS NOT DISTINCT FROM planned_end
  );

-- ── 4. PJの別名 ─────────────────────────────────────────────────────────
-- 会議の予定の振り分け・活動の振り分けがコードに直に持っていた別名を、別名の台帳へ移す。
INSERT INTO public.project_knowledge (project_id, category, entity_name, fact_text, confidence, source, status)
SELECT v.project_id, 'alias', v.entity_name, v.fact_text, 'high', 'migration_475_alias_from_code', 'active'
  FROM (VALUES
    ('p19', '葛飾水素循環', '葛飾水素循環 は ZMP(p19) の別名・関連ワークストリーム（会議の予定の振り分けに使う）'),
    ('p21', 'SolvioraX', 'SolvioraX は SOL(p21) の会社名（会議の予定の振り分けに使う）'),
    ('p26', 'VSX', 'VSX は VasculaX(p26) の略称（会議の取り込みでPJを決めるときに使う）')
  ) AS v(project_id, entity_name, fact_text)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.project_knowledge k
    WHERE k.project_id = v.project_id AND k.category = 'alias'
      AND lower(k.entity_name) = lower(v.entity_name)
 );

COMMIT;
