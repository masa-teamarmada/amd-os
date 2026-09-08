-- SolvioraX (p21): replace the separate objective/condition map and the detailed old gantt
-- with the task hierarchy reviewed on 2026-09-09. Old rows are soft-deleted and remain
-- recoverable. A JSON snapshot was exported before this migration.

BEGIN;

DO $$
DECLARE
  actual integer[];
BEGIN
  SELECT ARRAY[
    (SELECT count(*) FROM public.project_management_objectives WHERE project_id = 'p21' AND deleted_at IS NULL),
    (SELECT count(*) FROM public.project_management_outcomes WHERE project_id = 'p21' AND deleted_at IS NULL),
    (SELECT count(*) FROM public.project_management_milestones WHERE project_id = 'p21' AND deleted_at IS NULL),
    (SELECT count(*) FROM public.project_management_tasks WHERE project_id = 'p21' AND deleted_at IS NULL),
    (SELECT count(*) FROM public.project_management_milestone_dependencies WHERE project_id = 'p21' AND deleted_at IS NULL),
    (SELECT count(*) FROM public.project_management_schedule_dependencies WHERE project_id = 'p21' AND deleted_at IS NULL)
  ] INTO actual;
  IF actual <> ARRAY[1, 4, 13, 67, 12, 12] THEN
    RAISE EXCEPTION 'p21 gantt changed after snapshot: %', actual;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.project_management_tasks
    WHERE id BETWEEN '21000000-2026-4000-9000-000000000001'::uuid
      AND '21000000-2026-4000-9000-000000000017'::uuid
  ) THEN
    RAISE EXCEPTION 'p21 reviewed task ids already exist';
  END IF;
END $$;

UPDATE public.project_management_schedule_dependencies
SET deleted_at = now(), deleted_by = 'sx-gantt-tree-rebuild-20260909'
WHERE project_id = 'p21' AND deleted_at IS NULL;

UPDATE public.project_management_milestone_dependencies
SET deleted_at = now(), deleted_by = 'sx-gantt-tree-rebuild-20260909'
WHERE project_id = 'p21' AND deleted_at IS NULL;

UPDATE public.project_management_tasks
SET deleted_at = now(), deleted_by = 'sx-gantt-tree-rebuild-20260909'
WHERE project_id = 'p21' AND deleted_at IS NULL;

UPDATE public.project_management_milestones
SET deleted_at = now(), deleted_by = 'sx-gantt-tree-rebuild-20260909'
WHERE project_id = 'p21' AND deleted_at IS NULL;

UPDATE public.project_management_outcomes
SET deleted_at = now(), deleted_by = 'sx-gantt-tree-rebuild-20260909'
WHERE project_id = 'p21' AND deleted_at IS NULL;

UPDATE public.project_management_objectives
SET deleted_at = now(), deleted_by = 'sx-gantt-tree-rebuild-20260909'
WHERE project_id = 'p21' AND deleted_at IS NULL;

-- Root first, then packages, then leaves so the hierarchy guard can validate each level.
INSERT INTO public.project_management_tasks
  (id, project_id, milestone_id, parent_task_id, track, title, description, status,
   planned_start, planned_end, date_certainty, owner_label, completion_criteria,
   sort_order, last_verified_at, confidence, source_kind, source_ref)
VALUES
  ('21000000-2026-4000-9000-000000000001', 'p21', NULL, NULL,
   'organizational_building', 'NewCo設立',
   '2027年4月1日の会社設立と事業開始に向けた準備を、一つの工程として管理する。',
   'not_started', '2026-09-08', '2027-04-01', 'provisional', '担当未確認',
   '4月1日の設立を実行できる', 10, '2026-09-09', 'high', 'manual',
   'sx-gantt-tree-20260909: NewCo設立');

INSERT INTO public.project_management_tasks
  (id, project_id, milestone_id, parent_task_id, track, title, description, status,
   planned_start, planned_end, date_certainty, owner_label, completion_criteria,
   sort_order, last_verified_at, confidence, source_kind, source_ref)
VALUES
  ('21000000-2026-4000-9000-000000000002', 'p21', NULL,
   '21000000-2026-4000-9000-000000000001', 'organizational_building',
   'NewCo体制案確定', '杉浦研とNewCoを分断せず、全員がワンチームで動く体制を固める。',
   'not_started', '2026-09-08', '2027-02-26', 'provisional', '担当未確認',
   'チーム設計、メンバー別の役割・最低エフォート、登記事項が合意されている',
   10, '2026-09-09', 'high', 'manual', 'sx-gantt-tree-20260909: NewCo体制案確定'),
  ('21000000-2026-4000-9000-000000000006', 'p21', NULL,
   '21000000-2026-4000-9000-000000000001', 'organizational_building',
   '出資の確約', '4月1日の設立を実行できる出資確約を得る。',
   'not_started', '2026-09-08', '2027-03-12', 'provisional', '担当未確認',
   'DDと出資条件の確定後、出資確約を取得している',
   20, '2026-09-09', 'high', 'manual', 'sx-gantt-tree-20260909: 出資の確約'),
  ('21000000-2026-4000-9000-000000000010', 'p21', NULL,
   '21000000-2026-4000-9000-000000000001', 'organizational_building',
   '愛媛大との諸手続き完了', '愛媛大学発SU認定、知財ライセンス、学内手続きを完了する。',
   'not_started', '2026-09-08', '2027-03-19', 'provisional', '担当未確認',
   '認定、ライセンス、学内手続きが完了している',
   30, '2026-09-09', 'high', 'manual', 'sx-gantt-tree-20260909: 愛媛大との諸手続き完了'),
  ('21000000-2026-4000-9000-000000000014', 'p21', NULL,
   '21000000-2026-4000-9000-000000000001', 'organizational_building',
   'SIERのMOU締結',
   'SIER参画企業とのMOUを締結する。NewCo設立前はAMDが契約主体となり、設立後のNewCoへの権利移転までを条件に含める。',
   'not_started', '2026-09-08', '2027-03-19', 'provisional', '担当未確認',
   '参画企業・役割と条件を合意し、MOUを締結している',
   40, '2026-09-09', 'high', 'manual', 'sx-gantt-tree-20260909: SIERのMOU締結');

INSERT INTO public.project_management_tasks
  (id, project_id, milestone_id, parent_task_id, track, title, description, status,
   planned_start, planned_end, date_certainty, owner_label, completion_criteria,
   sort_order, last_verified_at, confidence, source_kind, source_ref)
VALUES
  ('21000000-2026-4000-9000-000000000003', 'p21', NULL,
   '21000000-2026-4000-9000-000000000002', 'organizational_building',
   'チーム全体の設計', '杉浦研とNewCoを二分せず、意思決定、情報共有、責任分担をワンチームとして設計する。',
   'not_started', '2026-09-08', '2026-10-30', 'provisional', '担当未確認',
   'チーム全体の意思決定と連携方法が合意されている',
   10, '2026-09-09', 'high', 'manual', 'sx-gantt-tree-20260909: チーム全体の設計'),
  ('21000000-2026-4000-9000-000000000004', 'p21', NULL,
   '21000000-2026-4000-9000-000000000002', 'organizational_building',
   '役割・最低エフォート決定', '現メンバーごとに役割とNewCoに置く最低エフォート率を決める。',
   'not_started', '2026-09-08', '2026-10-30', 'provisional', '担当未確認',
   '全メンバーについて役割と最低エフォート率が合意されている',
   20, '2026-09-09', 'high', 'manual', 'sx-gantt-tree-20260909: 役割・最低エフォート決定'),
  ('21000000-2026-4000-9000-000000000005', 'p21', NULL,
   '21000000-2026-4000-9000-000000000002', 'organizational_building',
   '登記事項の最終合意', '登記に必要な事項を表で並べ、最終合意する。',
   'not_started', '2026-11-02', '2027-02-26', 'provisional', '担当未確認',
   '登記事項表の全項目が最終合意されている',
   30, '2026-09-09', 'high', 'manual', 'sx-gantt-tree-20260909: 登記事項の最終合意'),
  ('21000000-2026-4000-9000-000000000007', 'p21', NULL,
   '21000000-2026-4000-9000-000000000006', 'organizational_building',
   'DD対応', '出資判断に必要な資料提出と質疑対応を完了する。',
   'not_started', '2026-09-08', '2026-12-18', 'provisional', '担当未確認',
   '必要資料と主要な質疑回答が揃っている',
   10, '2026-09-09', 'high', 'manual', 'sx-gantt-tree-20260909: DD対応'),
  ('21000000-2026-4000-9000-000000000008', 'p21', NULL,
   '21000000-2026-4000-9000-000000000006', 'organizational_building',
   '出資者・出資額・条件の確定', '誰が、いくら、どの条件で出資するかを確定する。',
   'not_started', '2026-09-08', '2027-02-26', 'provisional', '担当未確認',
   '出資者、出資額、主要条件が合意されている',
   20, '2026-09-09', 'high', 'manual', 'sx-gantt-tree-20260909: 出資者・出資額・条件の確定'),
  ('21000000-2026-4000-9000-000000000009', 'p21', NULL,
   '21000000-2026-4000-9000-000000000006', 'organizational_building',
   '出資確約の取得', '確定した出資条件について、設立実行に使える確約を取得する。',
   'not_started', '2027-02-27', '2027-03-12', 'provisional', '担当未確認',
   '合意した出資条件について確約の証跡がある',
   30, '2026-09-09', 'high', 'manual', 'sx-gantt-tree-20260909: 出資確約の取得'),
  ('21000000-2026-4000-9000-000000000011', 'p21', NULL,
   '21000000-2026-4000-9000-000000000010', 'organizational_building',
   '愛媛大発SU認定', '愛媛大学発スタートアップとしての認定を取得する。',
   'not_started', '2026-09-08', '2027-03-19', 'provisional', '担当未確認',
   '認定が確認できる',
   10, '2026-09-09', 'high', 'manual', 'sx-gantt-tree-20260909: 愛媛大発SU認定'),
  ('21000000-2026-4000-9000-000000000012', 'p21', NULL,
   '21000000-2026-4000-9000-000000000010', 'organizational_building',
   '知財ライセンス合意', '事業に必要な知財の対象、利用範囲、条件を愛媛大学と合意する。',
   'not_started', '2026-09-08', '2027-03-19', 'provisional', '担当未確認',
   '対象知財、利用範囲、主要条件が合意されている',
   20, '2026-09-09', 'high', 'manual', 'sx-gantt-tree-20260909: 知財ライセンス合意'),
  ('21000000-2026-4000-9000-000000000013', 'p21', NULL,
   '21000000-2026-4000-9000-000000000010', 'organizational_building',
   '学内手続き', '認定、ライセンス、設立に必要な学内決裁と事務手続きを完了する。',
   'not_started', '2026-09-08', '2027-03-19', 'provisional', '担当未確認',
   '必要な決裁と事務手続きの完了が確認できる',
   30, '2026-09-09', 'high', 'manual', 'sx-gantt-tree-20260909: 学内手続き'),
  ('21000000-2026-4000-9000-000000000015', 'p21', NULL,
   '21000000-2026-4000-9000-000000000014', 'organizational_building',
   '参画企業・役割の確定', 'MOUに参加するSIER各社と、それぞれの役割を確定する。',
   'not_started', '2026-09-08', '2026-10-30', 'provisional', '担当未確認',
   '参画企業と各社の役割が合意されている',
   10, '2026-09-09', 'high', 'manual', 'sx-gantt-tree-20260909: 参画企業・役割の確定'),
  ('21000000-2026-4000-9000-000000000016', 'p21', NULL,
   '21000000-2026-4000-9000-000000000014', 'organizational_building',
   '条件合意', '役割、対象範囲、契約主体、NewCoへの権利移転を含むMOU条件を合意する。',
   'not_started', '2026-10-31', '2027-02-26', 'provisional', '担当未確認',
   'MOU締結に必要な条件が合意されている',
   20, '2026-09-09', 'high', 'manual', 'sx-gantt-tree-20260909: 条件合意'),
  ('21000000-2026-4000-9000-000000000017', 'p21', NULL,
   '21000000-2026-4000-9000-000000000014', 'organizational_building',
   'MOU締結', '合意した条件でSIER参画企業とのMOUを締結する。',
   'not_started', '2027-02-27', '2027-03-19', 'provisional', '担当未確認',
   '必要な当事者によるMOU締結が確認できる',
   30, '2026-09-09', 'high', 'manual', 'sx-gantt-tree-20260909: MOU締結');

INSERT INTO public.project_management_schedule_dependencies
  (id, project_id, predecessor_type, predecessor_task_id, successor_task_id,
   dependency_type, created_by, updated_by)
VALUES
  ('21000000-2026-4000-9001-000000000001', 'p21', 'task',
   '21000000-2026-4000-9000-000000000007', '21000000-2026-4000-9000-000000000009',
   'finish_to_start', 'sx-gantt-tree-rebuild-20260909', 'sx-gantt-tree-rebuild-20260909'),
  ('21000000-2026-4000-9001-000000000002', 'p21', 'task',
   '21000000-2026-4000-9000-000000000008', '21000000-2026-4000-9000-000000000009',
   'finish_to_start', 'sx-gantt-tree-rebuild-20260909', 'sx-gantt-tree-rebuild-20260909'),
  ('21000000-2026-4000-9001-000000000003', 'p21', 'task',
   '21000000-2026-4000-9000-000000000016', '21000000-2026-4000-9000-000000000017',
   'finish_to_start', 'sx-gantt-tree-rebuild-20260909', 'sx-gantt-tree-rebuild-20260909');

DO $$
BEGIN
  IF (SELECT count(*) FROM public.project_management_tasks WHERE project_id = 'p21' AND deleted_at IS NULL) <> 17 THEN
    RAISE EXCEPTION 'p21 reviewed gantt must contain 17 live tasks';
  END IF;
  IF (SELECT count(*) FROM public.project_management_tasks WHERE project_id = 'p21' AND parent_task_id IS NULL AND deleted_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'p21 reviewed gantt must contain one root task';
  END IF;
  IF (SELECT count(*) FROM public.project_management_schedule_dependencies WHERE project_id = 'p21' AND deleted_at IS NULL) <> 3 THEN
    RAISE EXCEPTION 'p21 reviewed gantt must contain three schedule dependencies';
  END IF;
END $$;

COMMIT;
