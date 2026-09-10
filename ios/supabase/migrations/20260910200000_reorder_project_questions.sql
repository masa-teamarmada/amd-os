-- 20260910200000_reorder_project_questions.sql
-- 問いの木の手動並び替えと、親の付け替えを1回の操作で行う。
-- 掴んで兄弟の間へ落とせば並びが変わり、別の問いの上へ落とせばその子になる。
-- 正本: pwa/spec/3-21-question-tree-current-spec.md
--
-- 本ファイルは apply_migration で適用済み（2026-09-10）。再実行しても同じ結果になる。

BEGIN;

CREATE OR REPLACE FUNCTION public.reorder_project_questions(
  p_project_id text,
  p_moved_id uuid,
  p_new_parent_id uuid,
  p_ordered_ids uuid[],
  p_changed_by text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_id uuid;
  v_index integer := 0;
  v_moved_project text;
  v_parent_project text;
  v_ordered_count integer;
BEGIN
  IF p_project_id IS NULL OR btrim(p_project_id) = '' THEN
    RAISE EXCEPTION 'project_id is required';
  END IF;

  SELECT project_id INTO v_moved_project
  FROM public.project_questions
  WHERE id = p_moved_id AND deleted_at IS NULL;
  IF v_moved_project IS NULL OR v_moved_project <> p_project_id THEN
    RAISE EXCEPTION 'moved question % not found in project %', p_moved_id, p_project_id;
  END IF;

  IF p_new_parent_id IS NOT NULL THEN
    SELECT project_id INTO v_parent_project
    FROM public.project_questions
    WHERE id = p_new_parent_id AND deleted_at IS NULL;
    IF v_parent_project IS NULL OR v_parent_project <> p_project_id THEN
      RAISE EXCEPTION 'parent question % not found in project %', p_new_parent_id, p_project_id;
    END IF;
    IF p_new_parent_id = p_moved_id THEN
      RAISE EXCEPTION 'a question cannot be its own parent';
    END IF;
    -- 自分の子孫の下へは移せない。木が輪になって画面が無限に潜る。
    IF EXISTS (
      WITH RECURSIVE descendants AS (
        SELECT id FROM public.project_questions
        WHERE parent_id = p_moved_id AND deleted_at IS NULL
        UNION
        SELECT q.id FROM public.project_questions q
        JOIN descendants d ON q.parent_id = d.id
        WHERE q.deleted_at IS NULL
      )
      SELECT 1 FROM descendants WHERE id = p_new_parent_id
    ) THEN
      RAISE EXCEPTION 'cannot move a question under its own descendant';
    END IF;
  END IF;

  -- 並べ替える兄弟は同じPJの生存行だけを受け付ける（他の枝を巻き込ませない）。
  SELECT count(*) INTO v_ordered_count
  FROM unnest(p_ordered_ids) AS t(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.project_questions q
    WHERE q.id = t.id AND q.project_id = p_project_id AND q.deleted_at IS NULL
  );
  IF v_ordered_count > 0 THEN
    RAISE EXCEPTION 'ordered_ids contains % row(s) outside project %', v_ordered_count, p_project_id;
  END IF;

  -- 親の付け替え。根へ出すと「親から見た役割」は意味を失うので外す。
  -- 子へ入れるときに未設定なら required から始める（あとで画面で変えられる）。
  UPDATE public.project_questions
  SET parent_id = p_new_parent_id,
      contribution = CASE
        WHEN p_new_parent_id IS NULL THEN NULL
        ELSE COALESCE(contribution, 'required')
      END,
      updated_by = COALESCE(NULLIF(p_changed_by, ''), updated_by),
      version = version + 1,
      updated_at = now()
  WHERE id = p_moved_id;

  -- 同じ親の中の並びを10刻みで振り直す。間に挿す余地を残す。
  FOREACH v_id IN ARRAY p_ordered_ids LOOP
    v_index := v_index + 1;
    UPDATE public.project_questions
    SET sort_order = v_index * 10,
        updated_by = COALESCE(NULLIF(p_changed_by, ''), updated_by),
        updated_at = now()
    WHERE id = v_id AND project_id = p_project_id AND deleted_at IS NULL;
  END LOOP;
END;
$fn$;

REVOKE ALL ON FUNCTION public.reorder_project_questions(text, uuid, uuid, uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_project_questions(text, uuid, uuid, uuid[], text) TO service_role;

-- 既存の sort_order は移行時のままで重複が多い。最初の掴み替えまで並びが不定に
-- 見えないよう、いま画面へ出ている順（sort_order → タイトル）で10刻みへ振り直す。
WITH renumbered AS (
  SELECT id,
         (row_number() OVER (
            PARTITION BY project_id, COALESCE(parent_id::text, '~root')
            ORDER BY sort_order, title
          )) * 10 AS next_sort_order
  FROM public.project_questions
  WHERE deleted_at IS NULL
)
UPDATE public.project_questions q
SET sort_order = r.next_sort_order
FROM renumbered r
WHERE q.id = r.id AND q.sort_order IS DISTINCT FROM r.next_sort_order;

COMMIT;
