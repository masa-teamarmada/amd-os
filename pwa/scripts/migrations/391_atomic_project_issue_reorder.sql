-- 論点・仮説リストの手動並び替えを1トランザクションで確定する (2026-09-10 まさ指示)。
-- 287 のタスク版と同じ形だが、project_management_issues には version を進める
-- touch_updated_at トリガーが無い (183 のFOREACH配列に issues が入っていない) ため、
-- 楽観ロックの expected_version は取らない。並び替えは sort_order だけを動かし、
-- last_verified_at / source_kind は触らない。触ると「更新切れ」判定 (last_verified_at)
-- が並び替えただけで解除され、論点の鮮度が嘘になる。
CREATE OR REPLACE FUNCTION public.reorder_project_management_issues(
  p_project_id text,
  p_items jsonb,
  p_changed_by text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_id uuid;
  v_sort_order integer;
  v_previous_sort_order integer;
  v_status text;
BEGIN
  IF p_project_id IS NULL OR btrim(p_project_id) = '' THEN
    RAISE EXCEPTION 'project_id is required';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 2 THEN
    RAISE EXCEPTION 'at least two reorder items are required';
  END IF;
  IF jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'too many reorder items';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) item
    GROUP BY item ->> 'id'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate reorder issue id';
  END IF;

  -- Lock every target in a deterministic order first. Any exception below rolls the whole
  -- function back, including earlier updates, so a half-applied order can never survive.
  PERFORM id
  FROM public.project_management_issues
  WHERE project_id = p_project_id
    AND deleted_at IS NULL
    AND id IN (
      SELECT (item ->> 'id')::uuid
      FROM jsonb_array_elements(p_items) item
    )
  ORDER BY id
  FOR UPDATE;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    BEGIN
      v_id := (v_item ->> 'id')::uuid;
      v_sort_order := (v_item ->> 'sort_order')::integer;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid reorder item';
    END;
    IF v_sort_order < 0 THEN
      RAISE EXCEPTION 'invalid reorder item';
    END IF;

    SELECT sort_order, status INTO v_previous_sort_order, v_status
    FROM public.project_management_issues
    WHERE id = v_id
      AND project_id = p_project_id
      AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'issue reorder row missing';
    END IF;
    IF v_previous_sort_order IS DISTINCT FROM v_sort_order THEN
      UPDATE public.project_management_issues
      SET sort_order = v_sort_order,
          updated_by = p_changed_by,
          updated_at = now()
      WHERE id = v_id
        AND project_id = p_project_id;

      -- 動いた行だけ履歴に残す。全件を毎回書くと、1回のドラッグで台帳が件数ぶん膨らむ。
      INSERT INTO public.project_management_update_history (
        project_id, entity_type, entity_id, update_kind, summary,
        changed_by, changed_on, from_status, to_status
      )
      VALUES (
        p_project_id, 'issue', v_id, 'manual_edit', '論点の並び順を更新',
        p_changed_by, (now() AT TIME ZONE 'Asia/Tokyo')::date, v_status, v_status
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_project_management_issues(text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_project_management_issues(text, jsonb, text) TO service_role;

-- 既存行の sort_order は 0 の重複だらけ (p19は17件で5種、p20/p25は全件0)。手動並びを
-- 第一キーにする前に、いま画面へ出ている順 (期限→作成順) で 10 刻みへ振り直しておく。
-- ここで一意にしておかないと、最初のドラッグまで並びが不定に見える。
WITH renumbered AS (
  SELECT id,
         (row_number() OVER (
            PARTITION BY project_id
            ORDER BY sort_order, COALESCE(due_date, '9999-12-31'::date), created_at, id
          ) - 1) * 10 AS next_sort_order
  FROM public.project_management_issues
  WHERE deleted_at IS NULL
)
UPDATE public.project_management_issues AS target
SET sort_order = renumbered.next_sort_order
FROM renumbered
WHERE target.id = renumbered.id
  AND target.sort_order IS DISTINCT FROM renumbered.next_sort_order;
