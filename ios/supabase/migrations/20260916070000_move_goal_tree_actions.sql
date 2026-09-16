-- 20260916070000_move_goal_tree_actions.sql
-- ゴールツリーでTODOを別の論点へ移す。TODOそのものの親子・日程・担当・依存関係は変えず、
-- project_question_actions の線だけを「移し替え」または「追加」で更新する。
-- 正本: pwa/spec/3-21-question-tree-current-spec.md

BEGIN;

CREATE OR REPLACE FUNCTION public.move_project_action_question_link(
  p_project_id text,
  p_action_id uuid,
  p_target_question_id uuid,
  p_mode text,
  p_changed_by text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_action_project text;
  v_action_parent_id uuid;
  v_action_review_state text;
  v_question_project text;
  v_question_status text;
  v_question_review_state text;
BEGIN
  IF p_project_id IS NULL OR btrim(p_project_id) = '' THEN
    RAISE EXCEPTION 'project_id is required';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('replace', 'add') THEN
    RAISE EXCEPTION 'action move mode must be replace or add';
  END IF;

  SELECT project_id, parent_id, review_state
  INTO v_action_project, v_action_parent_id, v_action_review_state
  FROM public.project_actions
  WHERE id = p_action_id AND deleted_at IS NULL;
  IF v_action_project IS NULL OR v_action_project <> p_project_id THEN
    RAISE EXCEPTION 'action % not found in project %', p_action_id, p_project_id;
  END IF;
  -- 子TODOだけを移すと、工程の親子と「何へ答える作業か」が食い違う。
  IF v_action_parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'move the parent action instead of a child action';
  END IF;

  SELECT project_id, status, review_state
  INTO v_question_project, v_question_status, v_question_review_state
  FROM public.project_questions
  WHERE id = p_target_question_id AND deleted_at IS NULL;
  IF v_question_project IS NULL OR v_question_project <> p_project_id THEN
    RAISE EXCEPTION 'target question % not found in project %', p_target_question_id, p_project_id;
  END IF;
  IF v_question_status <> 'open' THEN
    RAISE EXCEPTION 'cannot move an action to a closed question';
  END IF;
  IF v_question_review_state <> 'accepted' THEN
    RAISE EXCEPTION 'cannot move an action to a proposed question';
  END IF;

  -- 未承認のTODOは本物の線をまだ持たない。提案先だけを替え、複数の問いへは増やさない。
  IF v_action_review_state = 'proposed' THEN
    IF p_mode <> 'replace' THEN
      RAISE EXCEPTION 'a proposed action must have one proposed question';
    END IF;
    UPDATE public.project_actions
    SET proposed_question_id = p_target_question_id,
        updated_by = COALESCE(NULLIF(p_changed_by, ''), updated_by),
        last_verified_at = current_date,
        version = version + 1,
        updated_at = now()
    WHERE id = p_action_id;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.project_question_actions
    WHERE project_id = p_project_id
      AND question_id = p_target_question_id
      AND action_id = p_action_id
  ) THEN
    RAISE EXCEPTION 'action is already linked to target question';
  END IF;

  IF p_mode = 'replace' THEN
    DELETE FROM public.project_question_actions
    WHERE project_id = p_project_id AND action_id = p_action_id;
  END IF;

  INSERT INTO public.project_question_actions (project_id, question_id, action_id)
  VALUES (p_project_id, p_target_question_id, p_action_id);

  UPDATE public.project_actions
  SET updated_by = COALESCE(NULLIF(p_changed_by, ''), updated_by),
      last_verified_at = current_date,
      version = version + 1,
      updated_at = now()
  WHERE id = p_action_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.move_project_action_question_link(text, uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_project_action_question_link(text, uuid, uuid, text, text) TO service_role;

COMMIT;
