-- ZMP active-tree correction after Masa's 2026-09-16 review.
--
-- KR management reform is not an active client goal under the current fee.
-- Preserve the old branch as soft-deleted history, leave one closed decision,
-- and keep operational training/rehearsal as tasks rather than goal-tree nodes.

BEGIN;

-- Trademark and the IT fee boundary belong to OkuDoor system delivery, not to
-- a KR management-reform engagement.
UPDATE public.project_questions
SET parent_id = '19000000-2026-4000-8000-000000009106',
    contribution = 'required',
    last_verified_at = DATE '2026-09-16',
    updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE id = '19000000-2026-4000-8000-000000002441';

-- Retire the old KR goal, milestone, and all remaining descendants from the
-- active tree. deleted_at retains their audit history and can be reversed.
WITH RECURSIVE retired_questions AS (
  SELECT id
  FROM public.project_questions
  WHERE id = '19000000-2026-4000-8000-000000009001'
    AND deleted_at IS NULL
  UNION ALL
  SELECT child.id
  FROM public.project_questions child
  JOIN retired_questions parent ON child.parent_id = parent.id
  WHERE child.deleted_at IS NULL
)
UPDATE public.project_questions question
SET deleted_at = now(), deleted_by = 'ID001',
    last_verified_at = DATE '2026-09-16',
    updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE question.id IN (SELECT id FROM retired_questions);

-- One closed decision communicates the commercial boundary without presenting
-- management reform as an active goal or expanding it into a large issue tree.
INSERT INTO public.project_questions (
  id, project_id, parent_id, contribution, title, background, question_kind,
  status, answer, answered_on, answered_by, confidence, owner_label, due_date,
  origin_kind, origin_ref, sort_order, last_verified_at, created_by, updated_by,
  review_state, client_token
)
VALUES (
  '19000000-2026-4000-8000-000000009107', 'p19', NULL, NULL,
  'KR経営改革は追加契約成立時のみ再検討する',
  '契約金額の増額は見送り。現行契約の範囲では、KRの経営改革をAMDの実行対象にしない。',
  'decision', 'answered',
  '追加費用と対象業務が合意された場合だけ再検討する。増額・追加契約が成立しない限り着手しない。',
  DATE '2026-09-16', 'ID001', 'high', 'まさ', NULL,
  'manual', 'まさ確認 2026-09-16', 900, DATE '2026-09-16', 'ID001', 'ID001',
  'accepted', '19000000-2026-4000-8000-000000009107'
)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, background = EXCLUDED.background,
    question_kind = EXCLUDED.question_kind, status = EXCLUDED.status,
    answer = EXCLUDED.answer, answered_on = EXCLUDED.answered_on,
    answered_by = EXCLUDED.answered_by, confidence = EXCLUDED.confidence,
    owner_label = EXCLUDED.owner_label, due_date = EXCLUDED.due_date,
    origin_kind = EXCLUDED.origin_kind, origin_ref = EXCLUDED.origin_ref,
    sort_order = EXCLUDED.sort_order, last_verified_at = EXCLUDED.last_verified_at,
    review_state = 'accepted', deleted_at = NULL, deleted_by = NULL,
    updated_by = 'ID001', updated_at = now(), version = public.project_questions.version + 1;

-- Work that existed only to establish the rejected management-reform scope is
-- no longer running. Completed records remain completed as evidence.
UPDATE public.project_actions
SET status = 'dropped', progress_pct = 0,
    blocker = '契約金額の増額・追加契約が未成立のため、現行契約では着手しない。追加契約成立時のみ再検討する。',
    last_verified_at = DATE '2026-09-16',
    updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE id IN (
  '19000000-2026-4000-8000-000000002201',
  '19000000-2026-4000-8000-000000002202',
  '19000000-2026-4000-8000-000000002302',
  '19000000-2026-4000-8000-000000002304',
  '19000000-2026-4000-8000-000000002306',
  '19000000-2026-4000-8000-000000009202'
)
AND status <> 'done';

-- Remove links to retired questions so completed/dropped records remain task
-- history rather than appearing as active goal-tree work.
DELETE FROM public.project_question_actions link
USING public.project_questions question
WHERE link.question_id = question.id
  AND question.project_id = 'p19'
  AND question.deleted_at IS NOT NULL;

-- Training and rehearsal are execution tasks. They stay in the task list and
-- gantt, but do not claim to answer a question in the active goal tree.
DELETE FROM public.project_question_actions
WHERE project_id = 'p19'
  AND action_id IN (
    '19000000-2026-4000-8000-000000002223',
    '19000000-2026-4000-8000-000000002327'
  );

UPDATE public.project_theme_profiles
SET current_state_md = CASE track_key
      WHEN 'kr_management_reform' THEN
        '契約金額の増額は見送り。現行契約の範囲ではKR経営改革に着手しない。追加費用と対象業務が合意された場合だけ再検討する。'
      ELSE current_state_md
    END,
    next_focus_note = CASE track_key
      WHEN 'kr_management_reform' THEN
        '追加契約が成立するまでは実行対象外。条件と金額が合意された場合のみ、対象業務と成果物をあらためて定義する。'
      ELSE next_focus_note
    END,
    updated_by_member_id = 'ID001', updated_at = now(), version = version + 1
WHERE project_id = 'p19' AND track_key = 'kr_management_reform';

DO $$
DECLARE
  active_kr_rows integer;
  training_links integer;
BEGIN
  SELECT count(*) INTO active_kr_rows
  FROM public.project_questions
  WHERE project_id = 'p19'
    AND deleted_at IS NULL
    AND id IN (
      '19000000-2026-4000-8000-000000009001',
      '19000000-2026-4000-8000-000000009101',
      '19000000-2026-4000-8000-000000002001'
    );
  IF active_kr_rows <> 0 THEN
    RAISE EXCEPTION 'old KR branch still has % active rows', active_kr_rows;
  END IF;

  SELECT count(*) INTO training_links
  FROM public.project_question_actions
  WHERE project_id = 'p19'
    AND action_id IN (
      '19000000-2026-4000-8000-000000002223',
      '19000000-2026-4000-8000-000000002327'
    );
  IF training_links <> 0 THEN
    RAISE EXCEPTION 'training/rehearsal still has % goal-tree links', training_links;
  END IF;
END $$;

COMMIT;
