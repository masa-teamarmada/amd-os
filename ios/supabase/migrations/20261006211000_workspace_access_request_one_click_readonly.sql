-- One decision creates the account and the requested workspace readonly grant atomically.
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
  v_document public.workspace_documents%ROWTYPE;
  v_project_membership public.project_access_memberships%ROWTYPE;
  v_project_name TEXT;
  v_document_id TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
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
  IF NOT v_actor_ok OR (p_decision_source = 'slack' AND p_actor_member_id IS DISTINCT FROM 'ID001') THEN
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

  -- A shared document link carries its workspace intent through its owner row.
  -- Never infer grants from an email domain, and never use internal/deleted files.
  IF v_request.target_kind = 'unspecified' THEN
    v_document_id := substring(v_request.requested_path FROM '^/api/workspace-documents/([0-9a-fA-F-]{36})/(render|download)([/?#]|$)');
    IF v_document_id IS NULL THEN
      v_document_id := substring(v_request.requested_path FROM '^/workspace-document/([0-9a-fA-F-]{36})([/?#]|$)');
    END IF;
    IF v_document_id IS NOT NULL THEN
      SELECT * INTO v_document FROM public.workspace_documents
        WHERE document_id = v_document_id::UUID AND upload_status = 'active'
          AND visibility = 'workspace_shared' FOR SHARE;
      IF FOUND THEN
        IF v_document.scope_kind = 'project' AND v_document.project_id IS NOT NULL THEN
          v_request.target_kind := 'project';
          v_request.project_id := v_document.project_id;
        ELSIF v_document.scope_kind = 'institution' THEN
          SELECT * INTO v_workspace FROM public.institution_workspaces
            WHERE id = v_document.institution_workspace_id AND status = 'active' FOR SHARE;
          IF FOUND THEN
            v_request.target_kind := 'institution';
            v_request.workspace_slug := v_workspace.slug;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
  IF v_request.target_kind = 'institution' AND v_request.workspace_slug IS NOT NULL THEN
    SELECT * INTO v_workspace FROM public.institution_workspaces
      WHERE slug = v_request.workspace_slug AND status = 'active' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'workspace is not active'; END IF;
  ELSIF v_request.target_kind = 'project' AND v_request.project_id IS NOT NULL THEN
    SELECT project_name INTO v_project_name FROM public.projects
      WHERE project_id = v_request.project_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'project workspace not found'; END IF;
  ELSE
    RAISE EXCEPTION 'access request needs an explicit institution workspace or project workspace';
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

  IF v_request.target_kind = 'institution' THEN
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

  ELSE
    SELECT * INTO v_project_membership FROM public.project_access_memberships
      WHERE project_id = v_request.project_id AND user_account_id = v_account.id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.project_access_memberships (project_id, user_account_id, role, status)
        VALUES (v_request.project_id, v_account.id, 'readonly', 'invited')
        RETURNING * INTO v_project_membership;
    ELSIF v_project_membership.status IN ('suspended', 'revoked') THEN
      RAISE EXCEPTION 'project workspace membership is stopped';
    END IF;
  END IF;

  UPDATE public.workspace_access_requests
     SET status = 'approved',
         target_kind = v_request.target_kind,
         workspace_slug = v_request.workspace_slug,
         project_id = v_request.project_id,
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
    project_id,
    detail
  ) VALUES (
    'access_request_approved',
    v_account.id,
    v_account.email_normalized,
    v_workspace.id,
    v_request.project_id,
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
    'workspaceName', COALESCE(v_workspace.name, v_project_name),
    'workspaceSlug', v_workspace.slug,
    'accountId', v_account.id,
    'membershipId', COALESCE(v_membership.id, v_project_membership.id),
    'projectId', v_request.project_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.workspace_decide_access_request(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_decide_access_request(UUID, TEXT, TEXT, TEXT)
  TO service_role;

