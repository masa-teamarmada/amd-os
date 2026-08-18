-- Persist a gantt sibling reorder as one transaction. The previous UI issued one
-- PATCH per row, so a later conflict/error could leave a partial order and the
-- subsequent authoritative refetch appeared to undo the drag.
CREATE OR REPLACE FUNCTION public.reorder_project_management_tasks(
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
  v_expected_version integer;
  v_sort_order integer;
  v_parent_task_id uuid;
  v_group_parent_task_id uuid;
  v_group_initialized boolean := false;
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
    RAISE EXCEPTION 'duplicate reorder task id';
  END IF;

  -- Lock every target in a deterministic order before checking versions. Any
  -- exception below rolls the whole function back, including earlier updates.
  PERFORM id
  FROM public.project_management_tasks
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
      v_expected_version := (v_item ->> 'expected_version')::integer;
      v_sort_order := (v_item ->> 'sort_order')::integer;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid reorder item';
    END;
    IF v_expected_version < 1 OR v_sort_order < 0 THEN
      RAISE EXCEPTION 'invalid reorder item';
    END IF;

    SELECT parent_task_id INTO v_parent_task_id
    FROM public.project_management_tasks
    WHERE id = v_id
      AND project_id = p_project_id
      AND deleted_at IS NULL
      AND version = v_expected_version;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'task reorder version conflict';
    END IF;
    IF NOT v_group_initialized THEN
      v_group_parent_task_id := v_parent_task_id;
      v_group_initialized := true;
    ELSIF v_parent_task_id IS DISTINCT FROM v_group_parent_task_id THEN
      RAISE EXCEPTION 'reorder tasks must be siblings';
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_id := (v_item ->> 'id')::uuid;
    v_expected_version := (v_item ->> 'expected_version')::integer;
    v_sort_order := (v_item ->> 'sort_order')::integer;
    UPDATE public.project_management_tasks
    SET sort_order = v_sort_order,
        last_verified_at = (now() AT TIME ZONE 'Asia/Tokyo')::date,
        source_kind = 'manual',
        source_ref = 'PWA共有管理画面',
        updated_by = p_changed_by
    WHERE id = v_id
      AND project_id = p_project_id
      AND version = v_expected_version;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'task reorder version conflict';
    END IF;

    INSERT INTO public.project_management_update_history (
      project_id, entity_type, entity_id, update_kind, summary,
      changed_by, changed_on, from_status, to_status
    )
    SELECT p_project_id, 'task', v_id, 'manual_edit', 'タスクの並び順を更新',
      p_changed_by, (now() AT TIME ZONE 'Asia/Tokyo')::date, status, status
    FROM public.project_management_tasks
    WHERE id = v_id AND project_id = p_project_id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_project_management_tasks(text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_project_management_tasks(text, jsonb, text) TO service_role;
