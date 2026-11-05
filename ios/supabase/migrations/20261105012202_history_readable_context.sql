-- 変更時点の対象名・所属を最小限保存する。過去の監査行は更新しない。
BEGIN;
ALTER TABLE public.amd_os_data_change_history
  ADD COLUMN record_context jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.amd_os_data_change_history.record_context IS
  '変更時点の対象名と所属・参照先。before/afterを保持。導入前の履歴は空。元差分・undo値とは独立。';

CREATE FUNCTION public.amd_os_history_context(p_row jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_object_agg(key, public.amd_os_sanitize_history_values(
    CASE WHEN jsonb_typeof(value) = 'string' THEN to_jsonb(left(value #>> '{}', 120)) ELSE value END, key)), '{}'::jsonb)
  FROM jsonb_each(p_row)
  WHERE key = ANY(ARRAY[
    'title','name','display_name','short_name','title_snapshot','item_title','member_name','code_name','project_name',
    'project_id','member_id','user_id','game_server_id','server_boss_id','boss_id','server_name','world_name',
    'document_id','milestone_id','task_id','question_id','institution_id','seed_id','contract_id',
    'ym','week_start','scheduled_for','lead_minutes','spawn_at','next_spawn_at'
  ]) AND jsonb_typeof(value) IN ('string','number','boolean');
$$;
REVOKE ALL ON FUNCTION public.amd_os_history_context(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.amd_os_record_data_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_before_raw JSONB := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_after_raw JSONB := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE '{}'::jsonb END;
  v_before JSONB := '{}'::jsonb;
  v_after JSONB := '{}'::jsonb;
  v_changed_fields TEXT[] := '{}'::text[];
  v_record_pk JSONB := '{}'::jsonb;
  v_pk_columns TEXT[] := string_to_array(COALESCE(TG_ARGV[0], ''), ',');
  v_pk TEXT;
  v_claims JSONB := COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_headers JSONB := COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::jsonb;
  v_row JSONB := CASE WHEN TG_OP = 'DELETE' THEN v_before_raw ELSE v_after_raw END;
  v_undo_before JSONB;
  v_undo_after JSONB;
  v_undo_supported BOOLEAN := false;
  v_undo_block_reason TEXT;
  v_undo_of_history_id UUID;
  v_undo_actor_id TEXT;
  v_undo_actor_label TEXT;
  v_undo_sanitized_before JSONB;
  v_undo_sanitized_after JSONB;
  v_actor_id TEXT;
  v_actor_label TEXT;
  v_actor_source TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT
      COALESCE(array_agg(key ORDER BY key), '{}'::text[]),
      COALESCE(jsonb_object_agg(key, v_before_raw -> key), '{}'::jsonb),
      COALESCE(jsonb_object_agg(key, v_after_raw -> key), '{}'::jsonb)
    INTO v_changed_fields, v_before, v_after
    FROM (
      SELECT key
      FROM (
        SELECT jsonb_object_keys(v_before_raw || v_after_raw) AS key
      ) keys
      WHERE key NOT IN ('updated_at')
        AND (v_before_raw -> key) IS DISTINCT FROM (v_after_raw -> key)
    ) changed;

    IF cardinality(v_changed_fields) = 0 THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    SELECT COALESCE(array_agg(key ORDER BY key), '{}'::text[])
      INTO v_changed_fields
      FROM jsonb_object_keys(v_after_raw) AS key
     WHERE key NOT IN ('created_at', 'updated_at');
    v_after := v_after_raw;
  ELSE
    SELECT COALESCE(array_agg(key ORDER BY key), '{}'::text[])
      INTO v_changed_fields
      FROM jsonb_object_keys(v_before_raw) AS key
     WHERE key NOT IN ('created_at', 'updated_at');
    v_before := v_before_raw;
  END IF;

  v_undo_before := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN v_before ELSE '{}'::jsonb END;
  v_undo_after := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN v_after ELSE '{}'::jsonb END;

  FOREACH v_pk IN ARRAY v_pk_columns
  LOOP
    IF btrim(v_pk) <> '' AND v_row ? btrim(v_pk) THEN
      v_record_pk := v_record_pk || jsonb_build_object(btrim(v_pk), v_row -> btrim(v_pk));
    END IF;
  END LOOP;

  v_undo_sanitized_before := public.amd_os_sanitize_history_values(v_undo_before);
  v_undo_sanitized_after := public.amd_os_sanitize_history_values(v_undo_after);
  IF cardinality(v_pk_columns) = 0 OR v_record_pk = '{}'::jsonb THEN
    v_undo_block_reason := '主キーを取得できないため戻せない';
  ELSIF TG_OP = 'DELETE' AND EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = TG_RELID
      AND attnum > 0
      AND NOT attisdropped
      AND attidentity = 'a'
  ) THEN
    v_undo_block_reason := '自動採番IDを安全に復元できないため戻せない';
  ELSIF v_undo_sanitized_before IS DISTINCT FROM v_undo_before
     OR v_undo_sanitized_after IS DISTINCT FROM v_undo_after THEN
    v_undo_block_reason := '秘密値または大きい値を含むため戻せない';
  ELSE
    v_undo_supported := true;
  END IF;

  v_undo_of_history_id := NULLIF(current_setting('amd_os.undo_of_history_id', true), '')::UUID;
  v_undo_actor_id := NULLIF(current_setting('amd_os.undo_actor_id', true), '');
  v_undo_actor_label := NULLIF(current_setting('amd_os.undo_actor_label', true), '');

  v_actor_id := COALESCE(
    v_undo_actor_id,
    NULLIF(v_claims ->> 'sub', ''),
    NULLIF(v_row ->> 'updated_by', ''),
    NULLIF(v_row ->> 'created_by', ''),
    NULLIF(v_row ->> 'approved_by', ''),
    NULLIF(v_row ->> 'decided_by', ''),
    NULLIF(v_row ->> 'verified_by', '')
  );
  v_actor_label := COALESCE(
    v_undo_actor_label,
    NULLIF(v_headers ->> 'x-amd-os-actor', ''),
    NULLIF(v_claims ->> 'email', ''),
    NULLIF(v_row ->> 'updated_by', ''),
    NULLIF(v_row ->> 'created_by', ''),
    NULLIF(v_row ->> 'approved_by', ''),
    NULLIF(v_row ->> 'decided_by', ''),
    NULLIF(v_row ->> 'verified_by', ''),
    CASE WHEN COALESCE(v_claims ->> 'role', auth.role(), '') = 'service_role'
      THEN 'OS自動処理' ELSE '実行者未確認' END
  );
  v_actor_source := CASE
    WHEN v_undo_of_history_id IS NOT NULL THEN 'undo'
    WHEN NULLIF(v_headers ->> 'x-amd-os-actor', '') IS NOT NULL THEN 'request_header'
    WHEN NULLIF(v_claims ->> 'email', '') IS NOT NULL THEN 'authenticated_user'
    WHEN v_actor_id IS NOT NULL THEN 'row_attribution'
    WHEN COALESCE(v_claims ->> 'role', auth.role(), '') = 'service_role' THEN 'service_role'
    ELSE 'unknown'
  END;

  INSERT INTO public.amd_os_data_change_history (
    schema_name,
    table_name,
    operation,
    record_pk,
    record_context,
    actor_id,
    actor_label,
    actor_source,
    changed_fields,
    before_values,
    after_values,
    undo_before_values,
    undo_after_values,
    undo_supported,
    undo_block_reason,
    undo_of_history_id
  ) VALUES (
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    lower(TG_OP),
    v_record_pk,
    jsonb_build_object('before', public.amd_os_history_context(v_before_raw), 'after', public.amd_os_history_context(v_after_raw)),
    v_actor_id,
    v_actor_label,
    v_actor_source,
    v_changed_fields,
    public.amd_os_sanitize_history_values(v_before),
    public.amd_os_sanitize_history_values(v_after),
    CASE WHEN v_undo_supported THEN v_undo_before ELSE NULL END,
    CASE WHEN v_undo_supported THEN v_undo_after ELSE NULL END,
    v_undo_supported,
    v_undo_block_reason,
    v_undo_of_history_id
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$
;
COMMIT;
