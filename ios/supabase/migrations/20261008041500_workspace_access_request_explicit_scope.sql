-- Explicit admin choice for requests without a recorded destination. All grants are atomic.
CREATE OR REPLACE FUNCTION public.workspace_decide_access_request_scoped(
  p_request_id UUID, p_scope_kind TEXT, p_scope_id TEXT,
  p_actor_member_id TEXT, p_decision_source TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_request public.workspace_access_requests%ROWTYPE;
  v_account public.workspace_user_accounts%ROWTYPE;
  v_package public.dd_packages%ROWTYPE;
  v_grant public.dd_package_grants%ROWTYPE;
  v_result JSONB;
  v_project_id TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role required'; END IF;
  IF p_decision_source NOT IN ('slack','admin_page') OR p_decision_source IS NULL THEN RAISE EXCEPTION 'invalid decision source'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.members WHERE member_id=p_actor_member_id AND is_admin AND status='active')
    OR (p_decision_source='slack' AND p_actor_member_id IS DISTINCT FROM 'ID001') THEN
    RAISE EXCEPTION 'active admin required';
  END IF;
  SELECT * INTO v_request FROM public.workspace_access_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'access request not found'; END IF;
  IF v_request.status <> 'pending' THEN
    RETURN jsonb_build_object('requestId',v_request.id,'status',v_request.status,'alreadyDecided',true,'email',v_request.email_normalized);
  END IF;
  IF v_request.target_kind <> 'unspecified' THEN RAISE EXCEPTION 'explicit scope only for an unidentified request'; END IF;
  IF p_scope_kind IS NULL OR p_scope_kind NOT IN ('institution','project','dd','project_dd') OR NULLIF(p_scope_id,'') IS NULL THEN
    RAISE EXCEPTION 'invalid access request scope';
  END IF;

  IF p_scope_kind IN ('dd','project_dd') THEN
    SELECT * INTO v_package FROM public.dd_packages WHERE id=p_scope_id::UUID AND status='open' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'DD package is not open'; END IF;
    v_project_id := v_package.project_id;
  ELSIF p_scope_kind='project' THEN
    v_project_id := p_scope_id;
  END IF;

  IF p_scope_kind <> 'dd' THEN
    UPDATE public.workspace_access_requests SET
      target_kind=CASE WHEN p_scope_kind='institution' THEN 'institution' ELSE 'project' END,
      workspace_slug=CASE WHEN p_scope_kind='institution' THEN p_scope_id ELSE NULL END,
      project_id=v_project_id
      WHERE id=v_request.id;
    v_result := public.workspace_decide_access_request(v_request.id,'approved',p_actor_member_id,p_decision_source);
    -- The existing canonical routine validates the destination, creates readonly access,
    -- rejects stopped accounts/grants, and records the decision in this same transaction.
  END IF;

  IF p_scope_kind IN ('dd','project_dd') THEN
    SELECT * INTO v_account FROM public.workspace_user_accounts WHERE email_normalized=v_request.email_normalized FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.workspace_user_accounts(email,status) VALUES(v_request.email_normalized,'invited') RETURNING * INTO v_account;
    ELSIF v_account.status='suspended' THEN RAISE EXCEPTION 'workspace account is suspended'; END IF;
    SELECT * INTO v_grant FROM public.dd_package_grants WHERE package_id=v_package.id AND user_account_id=v_account.id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.dd_package_grants(package_id,project_id,user_account_id,status,capabilities,granted_by_member_id,updated_by_member_id)
      VALUES(v_package.id,v_package.project_id,v_account.id,'invited',ARRAY['dd.view']::TEXT[],p_actor_member_id,p_actor_member_id)
      RETURNING * INTO v_grant;
    ELSIF v_grant.status NOT IN ('invited','active') OR (v_grant.expires_at IS NOT NULL AND v_grant.expires_at <= clock_timestamp()) THEN
      RAISE EXCEPTION 'DD grant is stopped or expired';
    END IF;
    UPDATE public.workspace_access_requests SET status='approved', user_account_id=v_account.id,
      decided_at=clock_timestamp(),decided_by_member_id=p_actor_member_id,decision_source=p_decision_source,
      slack_notification_status='not_needed',updated_at=clock_timestamp() WHERE id=v_request.id;
    INSERT INTO public.workspace_access_audit_logs(event_type,user_account_id,email,project_id,detail)
    VALUES('access_request_approved',v_account.id,v_account.email_normalized,v_package.project_id,
      jsonb_build_object('request_id',v_request.id,'actor_member_id',p_actor_member_id,'source',p_decision_source,
      'scope_kind',p_scope_kind,'package_id',v_package.id,'grant_id',v_grant.id,'capability','dd.view'));
    v_result := COALESCE(v_result,'{}'::JSONB) || jsonb_build_object('requestId',v_request.id,'status','approved','alreadyDecided',false,
      'email',v_account.email_normalized,'accountId',v_account.id,'ddPackageId',v_package.id,
      'workspaceName',CASE WHEN p_scope_kind='project_dd' THEN (v_result->>'workspaceName') || ' ワークスペース・' ELSE '' END || v_package.title || '（DD）');
  END IF;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.workspace_decide_access_request_scoped(UUID,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_decide_access_request_scoped(UUID,TEXT,TEXT,TEXT,TEXT) TO service_role;
