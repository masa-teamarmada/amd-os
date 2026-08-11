-- Workspace security closure (migration 258).
-- 1. OTP send claims are serialized and limited per registered account.
-- 2. Critical workspace row mutations receive a transaction-local audit record.
-- 3. Deleting a workspace/project cannot cascade document metadata while leaving Storage objects.

BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_email_otp_rate_limits (
  user_account_id UUID PRIMARY KEY
    REFERENCES public.workspace_user_accounts(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  send_count INTEGER NOT NULL DEFAULT 0 CHECK (send_count >= 0),
  last_claimed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.workspace_email_otp_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_email_otp_rate_limits_service_role_all
  ON public.workspace_email_otp_rate_limits;
CREATE POLICY workspace_email_otp_rate_limits_service_role_all
  ON public.workspace_email_otp_rate_limits
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.workspace_email_otp_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.workspace_claim_email_otp_send(
  p_user_account_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_limit public.workspace_email_otp_rate_limits%ROWTYPE;
BEGIN
  IF p_user_account_id IS NULL THEN
    RETURN FALSE;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('workspace-email-otp:' || p_user_account_id::TEXT));

  SELECT *
    INTO v_limit
    FROM public.workspace_email_otp_rate_limits
   WHERE user_account_id = p_user_account_id
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.workspace_email_otp_rate_limits (
      user_account_id,
      window_started_at,
      send_count,
      last_claimed_at,
      updated_at
    ) VALUES (
      p_user_account_id,
      v_now,
      1,
      v_now,
      v_now
    );
    RETURN TRUE;
  END IF;

  -- Suppressed attempts never extend the cooldown, so repeated abuse cannot keep a user locked out.
  IF v_limit.last_claimed_at IS NOT NULL
     AND v_limit.last_claimed_at > v_now - INTERVAL '60 seconds' THEN
    RETURN FALSE;
  END IF;

  IF v_limit.window_started_at <= v_now - INTERVAL '15 minutes' THEN
    UPDATE public.workspace_email_otp_rate_limits
       SET window_started_at = v_now,
           send_count = 1,
           last_claimed_at = v_now,
           updated_at = v_now
     WHERE user_account_id = p_user_account_id;
    RETURN TRUE;
  END IF;

  IF v_limit.send_count >= 5 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.workspace_email_otp_rate_limits
     SET send_count = send_count + 1,
         last_claimed_at = v_now,
         updated_at = v_now
   WHERE user_account_id = p_user_account_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.workspace_claim_email_otp_send(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_claim_email_otp_send(UUID) TO service_role;

COMMENT ON TABLE public.workspace_email_otp_rate_limits IS
  '外部workspaceのemail OTP送信claim。登録account単位で60秒cooldown、15分5回までをDB transactionで直列化する。';
COMMENT ON FUNCTION public.workspace_claim_email_otp_send(UUID) IS
  'OTP送信前にservice_roleだけが呼ぶatomic claim。抑止時も同じHTTP responseを返し、email登録有無を漏らさない。';

CREATE OR REPLACE FUNCTION public.workspace_record_security_row_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row JSONB := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_user_account_id UUID;
  v_workspace_id UUID;
  v_project_id TEXT;
  v_row_id TEXT;
BEGIN
  IF TG_OP <> 'DELETE' THEN
    IF TG_TABLE_NAME = 'workspace_user_accounts' THEN
      v_user_account_id := NULLIF(v_row ->> 'id', '')::UUID;
    ELSE
      v_user_account_id := NULLIF(
        COALESCE(v_row ->> 'user_account_id', v_row ->> 'created_by_account_id'),
        ''
      )::UUID;
    END IF;
  END IF;

  v_workspace_id := NULLIF(
    COALESCE(v_row ->> 'workspace_id', v_row ->> 'institution_workspace_id'),
    ''
  )::UUID;
  v_project_id := NULLIF(v_row ->> 'project_id', '');
  v_row_id := COALESCE(
    v_row ->> 'document_id',
    v_row ->> 'id',
    v_row ->> 'project_id',
    'unknown'
  );

  INSERT INTO public.workspace_access_audit_logs (
    event_type,
    user_account_id,
    workspace_id,
    project_id,
    detail
  ) VALUES (
    'security_row_mutation',
    v_user_account_id,
    v_workspace_id,
    v_project_id,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', lower(TG_OP),
      'row_id', v_row_id
    )
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'workspace_user_accounts',
    'institution_workspace_memberships',
    'project_access_memberships',
    'workspace_documents'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS workspace_security_row_audit ON public.%I', v_table);
    EXECUTE format(
      'CREATE TRIGGER workspace_security_row_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.workspace_record_security_row_mutation()',
      v_table
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.workspace_record_security_row_mutation() IS
  '外部account、grant、資料metadataの変更と監査insertを同一transactionに置く。本文、URL、email、Storage pathは記録しない。';

ALTER TABLE public.workspace_documents
  DROP CONSTRAINT IF EXISTS workspace_documents_institution_workspace_id_fkey;
ALTER TABLE public.workspace_documents
  ADD CONSTRAINT workspace_documents_institution_workspace_id_fkey
  FOREIGN KEY (institution_workspace_id)
  REFERENCES public.institution_workspaces(id)
  ON DELETE RESTRICT;

ALTER TABLE public.workspace_documents
  DROP CONSTRAINT IF EXISTS workspace_documents_project_id_fkey;
ALTER TABLE public.workspace_documents
  ADD CONSTRAINT workspace_documents_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES public.projects(project_id)
  ON DELETE RESTRICT;

DO $$
DECLARE
  v_trigger_count INTEGER;
  v_restrict_fk_count INTEGER;
BEGIN
  IF to_regclass('public.workspace_email_otp_rate_limits') IS NULL THEN
    RAISE EXCEPTION 'workspace_email_otp_rate_limits was not created';
  END IF;

  IF to_regprocedure('public.workspace_claim_email_otp_send(uuid)') IS NULL THEN
    RAISE EXCEPTION 'workspace_claim_email_otp_send(uuid) was not created';
  END IF;

  SELECT COUNT(*)
    INTO v_trigger_count
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN (
       'workspace_user_accounts',
       'institution_workspace_memberships',
       'project_access_memberships',
       'workspace_documents'
     )
     AND t.tgname = 'workspace_security_row_audit'
     AND NOT t.tgisinternal;

  IF v_trigger_count <> 4 THEN
    RAISE EXCEPTION 'workspace security audit trigger count is %, expected 4', v_trigger_count;
  END IF;

  SELECT COUNT(*)
    INTO v_restrict_fk_count
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'workspace_documents'
     AND con.conname IN (
       'workspace_documents_institution_workspace_id_fkey',
       'workspace_documents_project_id_fkey'
     )
     AND con.confdeltype = 'r';

  IF v_restrict_fk_count <> 2 THEN
    RAISE EXCEPTION 'workspace document RESTRICT foreign key count is %, expected 2', v_restrict_fk_count;
  END IF;
END;
$$;

COMMIT;
