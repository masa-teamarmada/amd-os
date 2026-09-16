-- AMD OS 全体のデータ変更履歴と、外部ワークスペースのアクセス要求。
--
-- 変更履歴は public schema の既存テーブルへ AFTER trigger を付ける。
-- secret store と一時的なrate-limit状態だけは値を監査台帳へ複製しない。
-- 新しいテーブルを追加するmigrationは、末尾で
--   SELECT public.amd_os_refresh_data_change_history_triggers();
-- を呼び、同じ監査対象へ入れる。

BEGIN;

CREATE TABLE IF NOT EXISTS public.amd_os_data_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  schema_name TEXT NOT NULL DEFAULT 'public',
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  record_pk JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id TEXT,
  actor_label TEXT NOT NULL,
  actor_source TEXT NOT NULL,
  changed_fields TEXT[] NOT NULL DEFAULT '{}'::text[],
  before_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  undo_before_values JSONB,
  undo_after_values JSONB,
  undo_supported BOOLEAN NOT NULL DEFAULT false,
  undo_block_reason TEXT,
  undo_of_history_id UUID REFERENCES public.amd_os_data_change_history(id) ON DELETE RESTRICT,
  transaction_id BIGINT NOT NULL DEFAULT txid_current()
);

CREATE INDEX IF NOT EXISTS amd_os_data_change_history_occurred_at_idx
  ON public.amd_os_data_change_history (occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS amd_os_data_change_history_table_idx
  ON public.amd_os_data_change_history (table_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS amd_os_data_change_history_actor_idx
  ON public.amd_os_data_change_history (actor_label, occurred_at DESC);
CREATE INDEX IF NOT EXISTS amd_os_data_change_history_fields_idx
  ON public.amd_os_data_change_history USING GIN (changed_fields);
CREATE INDEX IF NOT EXISTS amd_os_data_change_history_undo_of_idx
  ON public.amd_os_data_change_history (undo_of_history_id)
  WHERE undo_of_history_id IS NOT NULL;

COMMENT ON TABLE public.amd_os_data_change_history IS
  'AMD OSのpublic schema全体を横断するappend-only変更履歴。誰が、いつ、どの行の何を、どう変えたかをadmin画面で読む。2026-09-16以降の変更が対象で、導入前の履歴は遡及生成しない。';
COMMENT ON COLUMN public.amd_os_data_change_history.before_values IS
  '変更前の差分値。秘密列は伏せ、大きい値は省略する。updateでは変わった列だけを持つ。';
COMMENT ON COLUMN public.amd_os_data_change_history.after_values IS
  '変更後の差分値。秘密列は伏せ、大きい値は省略する。updateでは変わった列だけを持つ。';

ALTER TABLE public.amd_os_data_change_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.amd_os_data_change_history FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.amd_os_block_change_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'amd_os_data_change_history is append-only';
END;
$$;

DROP TRIGGER IF EXISTS amd_os_data_change_history_append_only
  ON public.amd_os_data_change_history;
CREATE TRIGGER amd_os_data_change_history_append_only
BEFORE UPDATE OR DELETE ON public.amd_os_data_change_history
FOR EACH ROW EXECUTE FUNCTION public.amd_os_block_change_history_mutation();

CREATE OR REPLACE FUNCTION public.amd_os_sanitize_history_values(
  p_value JSONB,
  p_key TEXT DEFAULT NULL,
  p_depth INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_text TEXT;
  v_result JSONB;
BEGIN
  IF p_value IS NULL THEN
    RETURN 'null'::jsonb;
  END IF;

  IF p_key IS NOT NULL
     AND p_key ~* '(password|passwd|secret|token|api[_-]?key|private[_-]?key|credential|authorization|cookie|signature|oauth|refresh[_-]?token|access[_-]?token)' THEN
    RETURN to_jsonb('[伏せ字]'::TEXT);
  END IF;

  IF p_depth >= 5 OR length(p_value::TEXT) > 3200 THEN
    RETURN to_jsonb('[大きい値を省略]'::TEXT);
  END IF;

  CASE jsonb_typeof(p_value)
    WHEN 'object' THEN
      SELECT COALESCE(
        jsonb_object_agg(key, public.amd_os_sanitize_history_values(value, key, p_depth + 1)),
        '{}'::jsonb
      ) INTO v_result
      FROM jsonb_each(p_value);
      RETURN v_result;
    WHEN 'array' THEN
      IF jsonb_array_length(p_value) > 40 THEN
        RETURN to_jsonb('[大きい値を省略]'::TEXT);
      END IF;
      SELECT COALESCE(
        jsonb_agg(public.amd_os_sanitize_history_values(value, NULL, p_depth + 1)),
        '[]'::jsonb
      ) INTO v_result
      FROM jsonb_array_elements(p_value);
      RETURN v_result;
    WHEN 'string' THEN
      v_text := p_value #>> '{}';
      RETURN to_jsonb(CASE
        WHEN length(v_text) > 600 THEN left(v_text, 600) || '…[省略]'
        ELSE v_text
      END);
    ELSE
      RETURN p_value;
  END CASE;

  RETURN p_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.amd_os_record_data_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.amd_os_refresh_data_change_history_triggers()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_table RECORD;
  v_pk_columns TEXT;
  v_count INTEGER := 0;
BEGIN
  FOR v_table IN
    SELECT c.oid, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relispartition
      AND c.relname <> 'amd_os_data_change_history'
      AND c.relname NOT IN (
        'freee_oauth_tokens',
        'member_google_oauth_tokens',
        'member_microsoft_oauth_tokens',
        'microsoft_oauth_states',
        'workspace_email_otp_rate_limits',
        'workspace_access_requests'
      )
    ORDER BY c.relname
  LOOP
    SELECT string_agg(a.attname, ',' ORDER BY k.ordinality)
      INTO v_pk_columns
      FROM pg_index i
      JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ordinality) ON true
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
     WHERE i.indrelid = v_table.oid
       AND i.indisprimary;

    EXECUTE format('DROP TRIGGER IF EXISTS amd_os_data_change_history_trigger ON public.%I', v_table.relname);
    EXECUTE format(
      'CREATE TRIGGER amd_os_data_change_history_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.amd_os_record_data_change(%L)',
      v_table.relname,
      COALESCE(v_pk_columns, '')
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.amd_os_refresh_data_change_history_triggers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.amd_os_refresh_data_change_history_triggers() TO service_role;

CREATE TABLE IF NOT EXISTS public.workspace_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized TEXT NOT NULL,
  requested_path TEXT NOT NULL,
  target_kind TEXT NOT NULL DEFAULT 'unspecified'
    CHECK (target_kind IN ('institution', 'project', 'unspecified')),
  workspace_slug TEXT,
  project_id TEXT REFERENCES public.projects(project_id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
  first_requested_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  last_requested_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  user_account_id UUID REFERENCES public.workspace_user_accounts(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decided_by_member_id TEXT REFERENCES public.members(member_id) ON DELETE SET NULL,
  decision_source TEXT CHECK (decision_source IN ('slack', 'admin_page')),
  slack_channel_id TEXT,
  slack_message_ts TEXT,
  slack_notification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (slack_notification_status IN ('pending', 'sending', 'sent', 'failed', 'rate_limited', 'not_needed')),
  slack_notification_error TEXT,
  last_slack_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT workspace_access_requests_target_check CHECK (
    (target_kind = 'institution' AND workspace_slug IS NOT NULL AND project_id IS NULL)
    OR (target_kind = 'project' AND project_id IS NOT NULL)
    OR (target_kind = 'unspecified' AND workspace_slug IS NULL AND project_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_access_requests_pending_target_uq
  ON public.workspace_access_requests (email_normalized, requested_path)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS workspace_access_requests_status_idx
  ON public.workspace_access_requests (status, last_requested_at DESC);
CREATE INDEX IF NOT EXISTS workspace_access_requests_notification_idx
  ON public.workspace_access_requests (last_slack_notified_at DESC)
  WHERE last_slack_notified_at IS NOT NULL;

COMMENT ON TABLE public.workspace_access_requests IS
  '未登録または利用可能な権限を持たない外部メールのアクセス要求。admin/service_role以外は読めない。未登録メールを一般監査ログへ入れず、承認判断に必要なこの台帳だけへ保存する。';

ALTER TABLE public.workspace_access_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.workspace_access_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.workspace_access_requests TO authenticated;

DROP POLICY IF EXISTS workspace_access_requests_admin_select
  ON public.workspace_access_requests;
CREATE POLICY workspace_access_requests_admin_select
  ON public.workspace_access_requests
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.workspace_register_access_request(
  p_email_normalized TEXT,
  p_requested_path TEXT,
  p_target_kind TEXT,
  p_workspace_slug TEXT DEFAULT NULL,
  p_project_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email TEXT := lower(btrim(COALESCE(p_email_normalized, '')));
  v_path TEXT := left(COALESCE(p_requested_path, '/'), 500);
  v_existing public.workspace_access_requests%ROWTYPE;
  v_inserted public.workspace_access_requests%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role required';
  END IF;
  IF v_email = '' OR p_target_kind NOT IN ('institution', 'project', 'unspecified') THEN
    RAISE EXCEPTION 'invalid access request';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('workspace-access-request:' || v_email || ':' || v_path));

  SELECT * INTO v_existing
  FROM public.workspace_access_requests
  WHERE email_normalized = v_email
    AND requested_path = v_path
    AND status = 'pending'
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.workspace_access_requests
       SET request_count = request_count + 1,
           last_requested_at = clock_timestamp(),
           updated_at = clock_timestamp()
     WHERE id = v_existing.id
     RETURNING * INTO v_existing;

    RETURN jsonb_build_object(
      'requestId', v_existing.id,
      'created', false
    );
  END IF;

  INSERT INTO public.workspace_access_requests (
    email_normalized,
    requested_path,
    target_kind,
    workspace_slug,
    project_id
  ) VALUES (
    v_email,
    v_path,
    p_target_kind,
    NULLIF(p_workspace_slug, ''),
    NULLIF(p_project_id, '')
  )
  RETURNING * INTO v_inserted;

  RETURN jsonb_build_object(
    'requestId', v_inserted.id,
    'created', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.workspace_register_access_request(TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_register_access_request(TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.workspace_claim_access_request_notification(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.workspace_access_requests%ROWTYPE;
  v_recent_count INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RETURN FALSE;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('workspace-access-request-slack-budget'));

  SELECT * INTO v_request
  FROM public.workspace_access_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.status <> 'pending' THEN
    RETURN FALSE;
  END IF;
  IF v_request.last_slack_notified_at IS NOT NULL
     AND v_request.last_slack_notified_at > clock_timestamp() - INTERVAL '30 minutes' THEN
    RETURN FALSE;
  END IF;

  SELECT count(*) INTO v_recent_count
  FROM public.workspace_access_requests
  WHERE last_slack_notified_at > clock_timestamp() - INTERVAL '1 hour';

  IF v_recent_count >= 20 THEN
    UPDATE public.workspace_access_requests
       SET slack_notification_status = 'rate_limited',
           updated_at = clock_timestamp()
     WHERE id = p_request_id;
    RETURN FALSE;
  END IF;

  UPDATE public.workspace_access_requests
     SET slack_notification_status = 'sending',
         slack_notification_error = NULL,
         last_slack_notified_at = clock_timestamp(),
         updated_at = clock_timestamp()
   WHERE id = p_request_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.workspace_claim_access_request_notification(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_claim_access_request_notification(UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.workspace_decide_access_request(
  p_request_id UUID,
  p_decision TEXT,
  p_actor_member_id TEXT,
  p_decision_source TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.workspace_access_requests%ROWTYPE;
  v_workspace public.institution_workspaces%ROWTYPE;
  v_account public.workspace_user_accounts%ROWTYPE;
  v_membership public.institution_workspace_memberships%ROWTYPE;
  v_actor_ok BOOLEAN;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role required';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected')
     OR p_decision_source NOT IN ('slack', 'admin_page') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE member_id = p_actor_member_id
      AND status = 'active'
      AND is_admin = true
  ) INTO v_actor_ok;
  IF NOT v_actor_ok THEN
    RAISE EXCEPTION 'active admin required';
  END IF;

  SELECT * INTO v_request
  FROM public.workspace_access_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'access request not found';
  END IF;
  IF v_request.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'requestId', v_request.id,
      'status', v_request.status,
      'alreadyDecided', true,
      'email', v_request.email_normalized
    );
  END IF;

  IF p_decision = 'rejected' THEN
    UPDATE public.workspace_access_requests
       SET status = 'rejected',
           decided_at = clock_timestamp(),
           decided_by_member_id = p_actor_member_id,
           decision_source = p_decision_source,
           slack_notification_status = 'not_needed',
           updated_at = clock_timestamp()
     WHERE id = v_request.id;

    RETURN jsonb_build_object(
      'requestId', v_request.id,
      'status', 'rejected',
      'alreadyDecided', false,
      'email', v_request.email_normalized
    );
  END IF;

  IF v_request.target_kind <> 'institution' OR v_request.workspace_slug IS NULL THEN
    RAISE EXCEPTION 'access request needs an explicit institution workspace';
  END IF;

  SELECT * INTO v_workspace
  FROM public.institution_workspaces
  WHERE slug = v_request.workspace_slug
    AND status = 'active'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace is not active';
  END IF;

  SELECT * INTO v_account
  FROM public.workspace_user_accounts
  WHERE email_normalized = v_request.email_normalized
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.workspace_user_accounts (email, status)
    VALUES (v_request.email_normalized, 'invited')
    RETURNING * INTO v_account;
  ELSIF v_account.status = 'suspended' THEN
    RAISE EXCEPTION 'workspace account is suspended';
  END IF;

  SELECT * INTO v_membership
  FROM public.institution_workspace_memberships
  WHERE workspace_id = v_workspace.id
    AND user_account_id = v_account.id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.institution_workspace_memberships (
      workspace_id,
      user_account_id,
      role,
      status
    ) VALUES (
      v_workspace.id,
      v_account.id,
      'readonly',
      'invited'
    ) RETURNING * INTO v_membership;
  ELSIF v_membership.status IN ('suspended', 'revoked') THEN
    RAISE EXCEPTION 'workspace membership is stopped';
  END IF;

  UPDATE public.workspace_access_requests
     SET status = 'approved',
         user_account_id = v_account.id,
         decided_at = clock_timestamp(),
         decided_by_member_id = p_actor_member_id,
         decision_source = p_decision_source,
         slack_notification_status = 'not_needed',
         updated_at = clock_timestamp()
   WHERE id = v_request.id;

  INSERT INTO public.workspace_access_audit_logs (
    event_type,
    user_account_id,
    email,
    workspace_id,
    detail
  ) VALUES (
    'access_request_approved',
    v_account.id,
    v_account.email_normalized,
    v_workspace.id,
    jsonb_build_object(
      'request_id', v_request.id,
      'actor_member_id', p_actor_member_id,
      'source', p_decision_source,
      'role', 'readonly',
      'status', 'invited'
    )
  );

  RETURN jsonb_build_object(
    'requestId', v_request.id,
    'status', 'approved',
    'alreadyDecided', false,
    'email', v_request.email_normalized,
    'workspaceName', v_workspace.name,
    'workspaceSlug', v_workspace.slug,
    'accountId', v_account.id,
    'membershipId', v_membership.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.workspace_decide_access_request(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_decide_access_request(UUID, TEXT, TEXT, TEXT)
  TO service_role;

-- 履歴行の逆操作。現在値が履歴の変更後と一致する場合だけ、同じトランザクションで戻す。
-- undo自体も通常の変更としてtriggerに記録し、undo_of_history_idで元履歴へリンクする。
CREATE OR REPLACE FUNCTION public.amd_os_undo_data_change(
  p_history_id UUID,
  p_actor_member_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_history public.amd_os_data_change_history%ROWTYPE;
  v_table_oid OID;
  v_pk_columns TEXT[];
  v_pk_condition TEXT := 'TRUE';
  v_after_condition TEXT := 'TRUE';
  v_current JSONB;
  v_sql TEXT;
  v_column TEXT;
  v_rowcount INTEGER;
  v_undo_history_id UUID;
  v_actor_label TEXT;
  v_insert_columns TEXT;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role required';
  END IF;

  SELECT * INTO v_history
  FROM public.amd_os_data_change_history
  WHERE id = p_history_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'change history not found';
  END IF;
  IF v_history.undo_of_history_id IS NOT NULL THEN
    RAISE EXCEPTION 'undo history cannot be undone';
  END IF;
  IF NOT v_history.undo_supported THEN
    RAISE EXCEPTION '%', COALESCE(v_history.undo_block_reason, 'この変更は戻せない');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.members
    WHERE member_id = p_actor_member_id
      AND status = 'active'
      AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'active admin required';
  END IF;

  SELECT c.oid INTO v_table_oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = v_history.table_name
    AND c.relkind IN ('r', 'p')
    AND NOT c.relispartition
    AND c.relname <> 'amd_os_data_change_history'
    AND c.relname NOT IN (
      'freee_oauth_tokens',
      'member_google_oauth_tokens',
      'member_microsoft_oauth_tokens',
      'microsoft_oauth_states',
      'workspace_email_otp_rate_limits',
      'workspace_access_requests'
    );
  IF v_table_oid IS NULL THEN
    RAISE EXCEPTION 'target table cannot be undone';
  END IF;

  SELECT array_agg(a.attname ORDER BY k.ordinality)
    INTO v_pk_columns
  FROM pg_index i
  JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ordinality) ON true
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
  WHERE i.indrelid = v_table_oid
    AND i.indisprimary;
  IF COALESCE(cardinality(v_pk_columns), 0) = 0
     OR (SELECT count(*) FROM jsonb_object_keys(v_history.record_pk)) <> cardinality(v_pk_columns) THEN
    RAISE EXCEPTION 'target primary key is unavailable';
  END IF;

  v_actor_label := COALESCE(
    (SELECT member_name FROM public.members WHERE member_id = p_actor_member_id),
    (SELECT code_name FROM public.members WHERE member_id = p_actor_member_id),
    p_actor_member_id
  );
  FOREACH v_column IN ARRAY v_pk_columns LOOP
    v_pk_condition := v_pk_condition || format(
      ' AND (CASE WHEN ($1 -> %L) = ''null''::jsonb THEN t.%I IS NULL ELSE to_jsonb(t.%I) IS NOT DISTINCT FROM ($1 -> %L) END)',
      v_column, v_column, v_column, v_column
    );
  END LOOP;

  IF v_history.operation = 'insert' THEN
    PERFORM set_config('amd_os.undo_of_history_id', p_history_id::TEXT, true);
    PERFORM set_config('amd_os.undo_actor_id', p_actor_member_id, true);
    PERFORM set_config('amd_os.undo_actor_label', v_actor_label, true);
    v_sql := format(
      'DELETE FROM public.%I AS t WHERE %s AND to_jsonb(t) IS NOT DISTINCT FROM $2',
      v_history.table_name, v_pk_condition
    );
    EXECUTE v_sql USING v_history.record_pk, v_history.undo_after_values;
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount <> 1 THEN
      PERFORM set_config('amd_os.undo_of_history_id', '', true);
      PERFORM set_config('amd_os.undo_actor_id', '', true);
      PERFORM set_config('amd_os.undo_actor_label', '', true);
      RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', '現在の行が履歴の追加時点と一致しない');
    END IF;
  ELSIF v_history.operation = 'update' THEN
    IF COALESCE(cardinality(v_history.changed_fields), 0) = 0 THEN
      RAISE EXCEPTION 'changed fields are unavailable';
    END IF;
    FOREACH v_column IN ARRAY v_history.changed_fields LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = v_table_oid
          AND attname = v_column
          AND attnum > 0
          AND NOT attisdropped
      ) THEN
        RAISE EXCEPTION 'changed column is unavailable';
      END IF;
      v_after_condition := v_after_condition || format(
        ' AND (CASE WHEN ($2 -> %L) = ''null''::jsonb THEN t.%I IS NULL ELSE to_jsonb(t.%I) IS NOT DISTINCT FROM ($2 -> %L) END)',
        v_column, v_column, v_column, v_column
      );
    END LOOP;
    SELECT string_agg(format('%I = r.%I', a.attname, a.attname), ', ' ORDER BY k.ord)
      INTO v_sql
    FROM unnest(v_history.changed_fields) WITH ORDINALITY AS k(attname, ord)
    JOIN pg_attribute a ON a.attrelid = v_table_oid AND a.attname = k.attname
    WHERE a.attnum > 0 AND NOT a.attisdropped;
    v_sql := format(
      'UPDATE public.%I AS t SET %s FROM jsonb_populate_record(NULL::public.%I, $3) AS r WHERE %s AND %s',
      v_history.table_name, v_sql, v_history.table_name, v_pk_condition, v_after_condition
    );
    PERFORM set_config('amd_os.undo_of_history_id', p_history_id::TEXT, true);
    PERFORM set_config('amd_os.undo_actor_id', p_actor_member_id, true);
    PERFORM set_config('amd_os.undo_actor_label', v_actor_label, true);
    EXECUTE v_sql USING v_history.record_pk, v_history.undo_after_values, v_history.undo_before_values;
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount <> 1 THEN
      PERFORM set_config('amd_os.undo_of_history_id', '', true);
      PERFORM set_config('amd_os.undo_actor_id', '', true);
      PERFORM set_config('amd_os.undo_actor_label', '', true);
      RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', '現在値が履歴の変更後と一致しない');
    END IF;
  ELSIF v_history.operation = 'delete' THEN
    IF EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = v_table_oid
        AND attnum > 0
        AND NOT attisdropped
        AND attidentity = 'a'
    ) THEN
      RAISE EXCEPTION 'generated identity row cannot be restored safely';
    END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I AS t WHERE %s LIMIT 1', v_history.table_name, v_pk_condition)
      INTO v_current USING v_history.record_pk;
    IF v_current IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', '同じ主キーの行がすでに存在する');
    END IF;

    SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum)
      INTO v_insert_columns
    FROM pg_attribute a
    WHERE a.attrelid = v_table_oid
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attgenerated = ''
      AND a.attidentity <> 'a';
    IF v_insert_columns IS NULL THEN
      RAISE EXCEPTION 'insertable columns are unavailable';
    END IF;
    v_sql := format(
      'INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I, $2) AS r',
      v_history.table_name, v_insert_columns, v_insert_columns, v_history.table_name
    );
    PERFORM set_config('amd_os.undo_of_history_id', p_history_id::TEXT, true);
    PERFORM set_config('amd_os.undo_actor_id', p_actor_member_id, true);
    PERFORM set_config('amd_os.undo_actor_label', v_actor_label, true);
    EXECUTE v_sql USING v_history.record_pk, v_history.undo_before_values;
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount <> 1 THEN
      RAISE EXCEPTION 'restore insert failed';
    END IF;
  ELSE
    RAISE EXCEPTION 'unsupported operation';
  END IF;

  PERFORM set_config('amd_os.undo_of_history_id', '', true);
  PERFORM set_config('amd_os.undo_actor_id', '', true);
  PERFORM set_config('amd_os.undo_actor_label', '', true);

  -- 上の逆操作でtriggerが同一トランザクション内に履歴を追加する。
  SELECT id INTO v_undo_history_id
  FROM public.amd_os_data_change_history
  WHERE undo_of_history_id = p_history_id
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'historyId', p_history_id,
    'undoHistoryId', v_undo_history_id,
    'tableName', v_history.table_name,
    'operation', v_history.operation
  );
END;
$$;

REVOKE ALL ON FUNCTION public.amd_os_undo_data_change(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.amd_os_undo_data_change(UUID, TEXT)
  TO service_role;

-- 新設テーブルを含め、現時点のpublic tablesへ監査triggerを張る。
SELECT public.amd_os_refresh_data_change_history_triggers();

COMMIT;
