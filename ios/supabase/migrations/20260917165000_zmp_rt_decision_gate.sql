-- ZMP hydrogen roundtable: decision gate before execution.
--
-- The roundtable is still a proposal. KOTA considers KR unlikely to be able
-- to host it, so only the decision task remains active. Every RT execution
-- task stays behind that gate until the host and go/no-go decision are clear.

BEGIN;

INSERT INTO public.project_questions (
  id, project_id, parent_id, contribution, children_logic,
  title, background, question_kind, status, confidence,
  owner_label, due_date, origin_kind, origin_ref, sort_order,
  last_verified_at, created_by, updated_by, review_state, client_token
)
VALUES (
  '19000000-2026-4000-8000-000000002414',
  'p19',
  '19000000-2026-4000-8000-000000002111',
  'required',
  'all',
  'KRはRTを主催できるのか？',
  '水素RTは提案段階。こたさんはKRが主催するのは難しいと見ている。主催主体、意思決定者、事務局負担、予算、代替主催案を確認し、実施・保留・見送りを決める。',
  'open',
  'open',
  'medium',
  'こたさん・まさ',
  DATE '2026-09-29',
  'manual',
  'まさ確認 2026-09-17',
  5,
  DATE '2026-09-17',
  'ID001',
  'ID001',
  'accepted',
  '19000000-2026-4000-8000-000000002414'
)
ON CONFLICT (id) DO UPDATE
SET parent_id = EXCLUDED.parent_id,
    contribution = EXCLUDED.contribution,
    children_logic = EXCLUDED.children_logic,
    title = EXCLUDED.title,
    background = EXCLUDED.background,
    question_kind = EXCLUDED.question_kind,
    status = EXCLUDED.status,
    confidence = EXCLUDED.confidence,
    owner_label = EXCLUDED.owner_label,
    due_date = EXCLUDED.due_date,
    origin_kind = EXCLUDED.origin_kind,
    origin_ref = EXCLUDED.origin_ref,
    sort_order = EXCLUDED.sort_order,
    last_verified_at = EXCLUDED.last_verified_at,
    review_state = 'accepted',
    deleted_at = NULL,
    deleted_by = NULL,
    updated_by = 'ID001',
    updated_at = now(),
    version = public.project_questions.version + 1;

UPDATE public.project_actions
SET title = 'KRのRT実施可否を確認する',
    detail = '水素RTは提案段階。KRが主催する場合に必要な責任者、事務局負担、予算、意思決定権限を整理し、こたさんと実施可否を確認する。KR主催が難しい場合は、別主体・保留・見送りを選べる形にする。',
    status = 'running',
    progress_pct = 20,
    planned_end = DATE '2026-09-29',
    blocker = 'こたさんはKR主催が難しいと見ている。主催主体、責任者、事務局負担、予算が未決。',
    done_criteria = 'KR主催、別主体で実施、保留、見送りのいずれかが、理由・責任者・次の扱いとともに記録されている。',
    last_verified_at = DATE '2026-09-17',
    updated_by = 'ID001',
    updated_at = now(),
    version = version + 1
WHERE id = '19000000-2026-4000-8000-000000002311'
  AND project_id = 'p19';

DELETE FROM public.project_question_actions
WHERE project_id = 'p19'
  AND action_id = '19000000-2026-4000-8000-000000002311';

INSERT INTO public.project_question_actions (project_id, question_id, action_id)
VALUES (
  'p19',
  '19000000-2026-4000-8000-000000002414',
  '19000000-2026-4000-8000-000000002311'
)
ON CONFLICT (question_id, action_id) DO NOTHING;

WITH held(action_id) AS (
  VALUES
    ('19000000-2026-4000-8000-000000002211'::uuid),
    ('19000000-2026-4000-8000-000000002212'::uuid),
    ('19000000-2026-4000-8000-000000002213'::uuid),
    ('19000000-2026-4000-8000-000000002312'::uuid),
    ('19000000-2026-4000-8000-000000002314'::uuid),
    ('19000000-2026-4000-8000-000000002315'::uuid),
    ('19000000-2026-4000-8000-000000002316'::uuid),
    ('19000000-2026-4000-8000-000000002317'::uuid),
    ('19000000-2026-4000-8000-000000002318'::uuid),
    ('19000000-2026-4000-8000-000000002319'::uuid),
    ('19000000-2026-4000-8000-000000002391'::uuid),
    ('19000000-2026-4000-8000-000000002392'::uuid)
)
UPDATE public.project_actions action
SET status = 'not_started',
    progress_pct = 0,
    blocker = CASE
      WHEN action.blocker LIKE 'KRのRT実施可否が未決。実施意思決定まで保留。%'
        THEN action.blocker
      WHEN action.blocker IS NULL OR btrim(action.blocker) = ''
        THEN 'KRのRT実施可否が未決。実施意思決定まで保留。'
      ELSE 'KRのRT実施可否が未決。実施意思決定まで保留。' || E'\n' || action.blocker
    END,
    last_verified_at = DATE '2026-09-17',
    updated_by = 'ID001',
    updated_at = now(),
    version = version + 1
FROM held
WHERE action.id = held.action_id
  AND action.project_id = 'p19'
  AND action.status NOT IN ('done', 'dropped');

INSERT INTO public.project_action_dependencies (
  project_id, predecessor_action_id, successor_action_id
)
SELECT
  'p19',
  '19000000-2026-4000-8000-000000002311'::uuid,
  held.action_id
FROM (
  VALUES
    ('19000000-2026-4000-8000-000000002211'::uuid),
    ('19000000-2026-4000-8000-000000002212'::uuid),
    ('19000000-2026-4000-8000-000000002213'::uuid),
    ('19000000-2026-4000-8000-000000002312'::uuid),
    ('19000000-2026-4000-8000-000000002314'::uuid),
    ('19000000-2026-4000-8000-000000002315'::uuid),
    ('19000000-2026-4000-8000-000000002316'::uuid),
    ('19000000-2026-4000-8000-000000002317'::uuid),
    ('19000000-2026-4000-8000-000000002318'::uuid),
    ('19000000-2026-4000-8000-000000002319'::uuid),
    ('19000000-2026-4000-8000-000000002391'::uuid),
    ('19000000-2026-4000-8000-000000002392'::uuid)
) AS held(action_id)
ON CONFLICT (predecessor_action_id, successor_action_id) DO NOTHING;

UPDATE public.project_theme_profiles
SET current_state_md = '水素RTは提案段階。こたさんはKRが主催するのは難しいと見ており、実施意思決定は未了。KRの主催可否が決まるまで、参加者設計、対価、MOU、外部打診、資料作成、開催準備は保留。',
    next_focus_note = 'KR主催、別主体で実施、保留、見送りのいずれかを決める。判断材料として、責任者、事務局負担、予算、意思決定権限、代替主催案を確認する。',
    updated_by_member_id = 'ID001',
    updated_at = now(),
    version = version + 1
WHERE project_id = 'p19'
  AND track_key = 'katsushika_hydrogen';

DO $$
DECLARE
  question_count integer;
  decision_links integer;
  held_dependencies integer;
  running_downstream integer;
BEGIN
  SELECT count(*) INTO question_count
  FROM public.project_questions
  WHERE id = '19000000-2026-4000-8000-000000002414'
    AND project_id = 'p19'
    AND deleted_at IS NULL
    AND status = 'open';

  SELECT count(*) INTO decision_links
  FROM public.project_question_actions
  WHERE question_id = '19000000-2026-4000-8000-000000002414'
    AND action_id = '19000000-2026-4000-8000-000000002311';

  SELECT count(*) INTO held_dependencies
  FROM public.project_action_dependencies
  WHERE project_id = 'p19'
    AND predecessor_action_id = '19000000-2026-4000-8000-000000002311';

  SELECT count(*) INTO running_downstream
  FROM public.project_actions
  WHERE id IN (
    '19000000-2026-4000-8000-000000002211','19000000-2026-4000-8000-000000002212',
    '19000000-2026-4000-8000-000000002213','19000000-2026-4000-8000-000000002312',
    '19000000-2026-4000-8000-000000002314','19000000-2026-4000-8000-000000002315',
    '19000000-2026-4000-8000-000000002316','19000000-2026-4000-8000-000000002317',
    '19000000-2026-4000-8000-000000002318','19000000-2026-4000-8000-000000002319',
    '19000000-2026-4000-8000-000000002391','19000000-2026-4000-8000-000000002392'
  )
    AND status = 'running';

  IF question_count <> 1 OR decision_links <> 1 OR held_dependencies <> 12 OR running_downstream <> 0 THEN
    RAISE EXCEPTION
      'ZMP RT decision gate incomplete: question %, link %, dependencies %, running downstream %',
      question_count, decision_links, held_dependencies, running_downstream;
  END IF;
END $$;

COMMIT;
