-- 264_workspace_project_publication_access_rpc.sql
--
-- Adminの「個別PJ権限」1操作で、legacy exact-project membershipと
-- publication kernelのprincipal / organization / party / grantを同一transactionで作る。
-- 通常GETやログイン時には権限を作らない。停止・失効済みkernel rowは暗黙再開しない。

BEGIN;

CREATE OR REPLACE FUNCTION public.workspace_admin_grant_institution_project_access(
  p_request_id TEXT,
  p_actor_member_id TEXT,
  p_workspace_user_account_id UUID,
  p_workspace_id UUID,
  p_project_id TEXT,
  p_project_role TEXT DEFAULT 'contributor',
  p_membership_status TEXT DEFAULT 'invited'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_actor_principal_id UUID;
  v_actor_membership_id UUID;
  v_actor_grant_status TEXT;
  v_actor_capability TEXT;
  v_amd_organization_id UUID;
  v_studio_party_id UUID;
  v_target_principal_id UUID;
  v_target_organization_id UUID;
  v_target_membership_id UUID;
  v_target_party_id UUID;
  v_target_grant_id UUID;
  v_project_membership_id UUID;
  v_workspace_institution_id TEXT;
  v_workspace_slug TEXT;
  v_workspace_name TEXT;
  v_institution_role TEXT;
  v_institution_membership_status TEXT;
  v_account_status TEXT;
  v_existing_status TEXT;
  v_request_fingerprint TEXT;
  v_existing_request public.workspace_control_audit_logs%ROWTYPE;
  v_result JSONB;
BEGIN
  IF NULLIF(btrim(p_request_id), '') IS NULL
     OR char_length(btrim(p_request_id)) > 200
     OR NULLIF(btrim(p_actor_member_id), '') IS NULL
     OR p_workspace_user_account_id IS NULL
     OR p_workspace_id IS NULL
     OR NULLIF(btrim(p_project_id), '') IS NULL
     OR p_project_role NOT IN ('manager', 'contributor', 'readonly')
     OR p_membership_status NOT IN ('invited', 'active') THEN
    RAISE EXCEPTION 'workspace project grant request is incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.member_id = p_actor_member_id
      AND m.status = 'active' AND m.is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'active AMD admin actor is required';
  END IF;

  v_request_fingerprint := encode(digest(jsonb_build_object(
    'actorMemberId', p_actor_member_id,
    'workspaceAccountId', p_workspace_user_account_id,
    'workspaceId', p_workspace_id,
    'projectId', p_project_id,
    'projectRole', p_project_role,
    'membershipStatus', p_membership_status
  )::TEXT, 'sha256'), 'hex');

  PERFORM pg_advisory_xact_lock(hashtext('workspace-project-grant:' || btrim(p_request_id)));
  SELECT * INTO v_existing_request
  FROM public.workspace_control_audit_logs
  WHERE request_id = btrim(p_request_id);
  IF FOUND THEN
    IF v_existing_request.event_type <> 'admin_project_access_grant'
       OR v_existing_request.actor_principal_id IS NULL
       OR v_existing_request.project_id IS DISTINCT FROM p_project_id
       OR v_existing_request.request_fingerprint IS DISTINCT FROM v_request_fingerprint THEN
      RAISE EXCEPTION 'request_id was already used with a different project access grant';
    END IF;
    RETURN v_existing_request.detail -> 'result';
  END IF;

  -- The actor principal is created first with its own preallocated UUID. The AFTER
  -- audit trigger can then resolve the actor FK inside the same INSERT statement.
  SELECT id, status INTO v_actor_principal_id, v_existing_status
  FROM public.workspace_principals
  WHERE member_id = p_actor_member_id;
  IF v_actor_principal_id IS NULL THEN
    v_actor_principal_id := gen_random_uuid();
    PERFORM set_config('app.workspace_actor_principal_id', v_actor_principal_id::TEXT, true);
    INSERT INTO public.workspace_principals(id, member_id, status)
    VALUES (v_actor_principal_id, p_actor_member_id, 'active');
  ELSIF v_existing_status <> 'active' THEN
    RAISE EXCEPTION 'AMD admin principal is stopped';
  ELSE
    PERFORM set_config('app.workspace_actor_principal_id', v_actor_principal_id::TEXT, true);
  END IF;

  SELECT id INTO v_amd_organization_id
  FROM public.workspace_organizations
  WHERE source_kind = 'amd_internal' AND source_id = 'amd';
  IF v_amd_organization_id IS NULL THEN
    INSERT INTO public.workspace_organizations(
      kind, slug, display_name, source_kind, source_id, status
    ) VALUES (
      'amd', 'amd', '株式会社チームアルマダ', 'amd_internal', 'amd', 'active'
    ) RETURNING id INTO v_amd_organization_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.workspace_organizations
    WHERE id = v_amd_organization_id AND kind = 'amd' AND slug = 'amd'
      AND status = 'active' AND source_kind = 'amd_internal' AND source_id = 'amd'
      AND (expires_at IS NULL OR expires_at > NOW())
  ) THEN
    RAISE EXCEPTION 'canonical AMD organization is stopped or inconsistent';
  END IF;

  SELECT id, status INTO v_actor_membership_id, v_existing_status
  FROM public.workspace_organization_memberships
  WHERE organization_id = v_amd_organization_id
    AND principal_id = v_actor_principal_id;
  IF v_actor_membership_id IS NULL THEN
    INSERT INTO public.workspace_organization_memberships(
      organization_id, principal_id, role, status, accepted_at, terms_version
    ) VALUES (
      v_amd_organization_id, v_actor_principal_id, 'owner', 'active', NOW(), 'v1'
    ) RETURNING id INTO v_actor_membership_id;
  ELSIF v_existing_status <> 'active' THEN
    RAISE EXCEPTION 'AMD admin organization membership is stopped';
  END IF;

  SELECT p.id INTO v_studio_party_id
  FROM public.project_organization_parties p
  WHERE p.project_id = p_project_id AND p.party_role = 'studio'
    AND p.status = 'active';
  IF v_studio_party_id IS NULL THEN
    INSERT INTO public.project_organization_parties(
      project_id, organization_id, party_role, status
    ) VALUES (
      p_project_id, v_amd_organization_id, 'studio', 'active'
    ) RETURNING id INTO v_studio_party_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.project_organization_parties p
    WHERE p.id = v_studio_party_id AND p.project_id = p_project_id
      AND p.organization_id = v_amd_organization_id AND p.party_role = 'studio'
      AND p.status = 'active' AND (p.expires_at IS NULL OR p.expires_at > NOW())
  ) THEN
    RAISE EXCEPTION 'active studio party is not the canonical AMD organization';
  END IF;

  -- Read/approve are granted only when the admin is also an active member of this exact PJ.
  -- A previously revoked grant is never silently reactivated. Read lets the AMD cockpit
  -- inspect the exact sealed revision that external lenses receive.
  IF EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = p_project_id AND pm.member_id = p_actor_member_id
      AND pm.is_active = TRUE
  ) THEN
    FOREACH v_actor_capability IN ARRAY ARRAY['publication.view', 'publication.approve'] LOOP
      v_actor_grant_status := NULL;
      SELECT status INTO v_actor_grant_status
      FROM public.project_principal_grants
      WHERE project_id = p_project_id AND principal_id = v_actor_principal_id
        AND capability = v_actor_capability;
      IF v_actor_grant_status IS NULL THEN
        INSERT INTO public.project_principal_grants(
          project_id, organization_id, principal_id, organization_membership_id,
          project_party_id, capability, status
        ) VALUES (
          p_project_id, v_amd_organization_id, v_actor_principal_id,
          v_actor_membership_id, v_studio_party_id, v_actor_capability, 'active'
        );
      END IF;
    END LOOP;
  END IF;

  SELECT a.status INTO v_account_status
  FROM public.workspace_user_accounts a
  WHERE a.id = p_workspace_user_account_id;
  IF v_account_status IS NULL OR v_account_status = 'suspended' THEN
    RAISE EXCEPTION 'workspace account is missing or suspended';
  END IF;

  SELECT w.institution_id, w.slug, w.name
    INTO v_workspace_institution_id, v_workspace_slug, v_workspace_name
  FROM public.institution_workspaces w
  WHERE w.id = p_workspace_id AND w.status = 'active';
  IF v_workspace_institution_id IS NULL THEN
    RAISE EXCEPTION 'institution workspace is missing or paused';
  END IF;

  SELECT iwm.role, iwm.status
    INTO v_institution_role, v_institution_membership_status
  FROM public.institution_workspace_memberships iwm
  WHERE iwm.workspace_id = p_workspace_id
    AND iwm.user_account_id = p_workspace_user_account_id;
  IF v_institution_membership_status IS NULL
     OR v_institution_membership_status NOT IN ('invited', 'active') THEN
    RAISE EXCEPTION 'usable exact institution membership is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE project_id = p_project_id) THEN
    RAISE EXCEPTION 'project is missing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.project_access_memberships
    WHERE project_id = p_project_id
      AND user_account_id = p_workspace_user_account_id
  ) THEN
    RAISE EXCEPTION 'project membership already exists';
  END IF;

  INSERT INTO public.project_access_memberships(
    user_account_id, project_id, role, status
  ) VALUES (
    p_workspace_user_account_id, p_project_id, p_project_role, p_membership_status
  ) RETURNING id INTO v_project_membership_id;

  SELECT id, status INTO v_target_principal_id, v_existing_status
  FROM public.workspace_principals
  WHERE workspace_user_account_id = p_workspace_user_account_id;
  IF v_target_principal_id IS NULL THEN
    INSERT INTO public.workspace_principals(workspace_user_account_id, status)
    VALUES (p_workspace_user_account_id, 'active')
    RETURNING id INTO v_target_principal_id;
  ELSIF v_existing_status <> 'active' THEN
    RAISE EXCEPTION 'workspace account principal is stopped';
  END IF;

  SELECT id INTO v_target_organization_id
  FROM public.workspace_organizations
  WHERE source_kind = 'institution' AND source_id = v_workspace_institution_id;
  IF v_target_organization_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.workspace_organizations
      WHERE slug = 'research-' || lower(v_workspace_slug)
    ) THEN
      RAISE EXCEPTION 'institution organization slug belongs to another source';
    END IF;
    INSERT INTO public.workspace_organizations(
      kind, slug, display_name, source_kind, source_id, status
    ) VALUES (
      'research_institution', 'research-' || lower(v_workspace_slug),
      btrim(v_workspace_name), 'institution', v_workspace_institution_id, 'active'
    ) RETURNING id INTO v_target_organization_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.workspace_organizations
    WHERE id = v_target_organization_id AND kind = 'research_institution'
      AND source_kind = 'institution' AND source_id = v_workspace_institution_id
      AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())
  ) THEN
    RAISE EXCEPTION 'institution organization is stopped or inconsistent';
  END IF;

  SELECT id, status INTO v_target_membership_id, v_existing_status
  FROM public.workspace_organization_memberships
  WHERE organization_id = v_target_organization_id
    AND principal_id = v_target_principal_id;
  IF v_target_membership_id IS NULL THEN
    INSERT INTO public.workspace_organization_memberships(
      organization_id, principal_id, role, status, accepted_at, terms_version
    ) VALUES (
      v_target_organization_id, v_target_principal_id, v_institution_role,
      'active', CASE WHEN v_institution_membership_status = 'active' THEN NOW() ELSE NULL END, 'v1'
    ) RETURNING id INTO v_target_membership_id;
  ELSIF v_existing_status <> 'active' THEN
    RAISE EXCEPTION 'institution organization membership is stopped';
  END IF;

  SELECT id, status INTO v_target_party_id, v_existing_status
  FROM public.project_organization_parties
  WHERE project_id = p_project_id AND organization_id = v_target_organization_id;
  IF v_target_party_id IS NULL THEN
    INSERT INTO public.project_organization_parties(
      project_id, organization_id, party_role, status
    ) VALUES (
      p_project_id, v_target_organization_id, 'research', 'active'
    ) RETURNING id INTO v_target_party_id;
  ELSIF v_existing_status <> 'active' THEN
    RAISE EXCEPTION 'institution project party is stopped';
  END IF;

  SELECT id, status INTO v_target_grant_id, v_existing_status
  FROM public.project_principal_grants
  WHERE project_id = p_project_id AND principal_id = v_target_principal_id
    AND capability = 'publication.view';
  IF v_target_grant_id IS NULL THEN
    INSERT INTO public.project_principal_grants(
      project_id, organization_id, principal_id, organization_membership_id,
      project_party_id, capability, status
    ) VALUES (
      p_project_id, v_target_organization_id, v_target_principal_id,
      v_target_membership_id, v_target_party_id, 'publication.view', 'active'
    ) RETURNING id INTO v_target_grant_id;
  ELSIF v_existing_status <> 'active' THEN
    RAISE EXCEPTION 'publication view grant is revoked';
  END IF;

  v_result := jsonb_build_object(
    'projectMembershipId', v_project_membership_id,
    'principalId', v_target_principal_id,
    'organizationId', v_target_organization_id,
    'organizationMembershipId', v_target_membership_id,
    'projectPartyId', v_target_party_id,
    'grantId', v_target_grant_id
  );

  INSERT INTO public.workspace_access_audit_logs(
    event_type, user_account_id, workspace_id, project_id, detail
  ) VALUES (
    'admin_institution_project_access_grant', p_workspace_user_account_id,
    p_workspace_id, p_project_id,
    jsonb_build_object('role', p_project_role, 'status', p_membership_status)
  );

  INSERT INTO public.workspace_control_audit_logs(
    event_type, actor_principal_id, actor_project_party_id, actor_source,
    project_id, resource_type, resource_id, request_id, request_fingerprint, detail
  ) VALUES (
    'admin_project_access_grant', v_actor_principal_id, v_studio_party_id, 'rpc',
    p_project_id, 'project_principal_grants', v_target_grant_id::TEXT,
    btrim(p_request_id), v_request_fingerprint,
    jsonb_build_object(
      'workspaceId', p_workspace_id,
      'workspaceAccountId', p_workspace_user_account_id,
      'result', v_result
    )
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.workspace_admin_project_publication_context(
  p_actor_member_id TEXT,
  p_project_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_principal_id UUID;
  v_actor_party_ids UUID[];
  v_parties JSONB;
  v_latest JSONB;
BEGIN
  IF NULLIF(btrim(p_actor_member_id), '') IS NULL
     OR NULLIF(btrim(p_project_id), '') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.members m
       JOIN public.project_members pm ON pm.member_id = m.member_id
       WHERE m.member_id = p_actor_member_id
         AND m.status = 'active' AND m.is_admin = TRUE
         AND pm.project_id = p_project_id AND pm.is_active = TRUE
     ) THEN
    RAISE EXCEPTION 'active exact-project AMD admin is required';
  END IF;

  SELECT id INTO v_actor_principal_id
  FROM public.workspace_principals
  WHERE member_id = p_actor_member_id AND status = 'active';

  IF v_actor_principal_id IS NOT NULL THEN
    v_actor_party_ids := public.project_active_publication_parties(
      v_actor_principal_id, p_project_id, 'publication.approve'
    );
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'partyId', p.id,
    'kind', CASE WHEN o.kind = 'amd' THEN 'amd'
      WHEN o.kind = 'research_institution' THEN 'research' ELSE 'startup' END,
    'partyRole', p.party_role,
    'displayLabel', o.display_name
  ) ORDER BY p.party_role, o.display_name, p.id), '[]'::JSONB)
  INTO v_parties
  FROM public.project_organization_parties p
  JOIN public.workspace_organizations o ON o.id = p.organization_id
  WHERE p.project_id = p_project_id
    AND p.status = 'active' AND o.status = 'active'
    AND (p.expires_at IS NULL OR p.expires_at > NOW())
    AND (o.expires_at IS NULL OR o.expires_at > NOW());

  SELECT jsonb_build_object('id', r.id, 'number', r.revision)
  INTO v_latest
  FROM public.project_publication_revisions r
  WHERE r.project_id = p_project_id
  ORDER BY r.revision DESC LIMIT 1;

  RETURN jsonb_build_object(
    'configured', COALESCE(cardinality(v_actor_party_ids), 0) > 0,
    'actorPrincipalId', v_actor_principal_id,
    'actorPartyIds', COALESCE(to_jsonb(v_actor_party_ids), '[]'::JSONB),
    'parties', v_parties,
    'latestRevision', v_latest
  );
END;
$$;

REVOKE ALL ON FUNCTION public.workspace_admin_grant_institution_project_access(
  TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workspace_admin_grant_institution_project_access(
  TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT
) TO service_role;
REVOKE ALL ON FUNCTION public.workspace_admin_project_publication_context(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workspace_admin_project_publication_context(TEXT, TEXT)
  TO service_role;

COMMENT ON FUNCTION public.workspace_admin_grant_institution_project_access(
  TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT
) IS 'Admin-only atomic grant: legacy exact project membership + research organization party + publication.view. Never called from GET and never silently reactivates stopped kernel rows.';
COMMENT ON FUNCTION public.workspace_admin_project_publication_context(TEXT, TEXT)
IS 'Read-only publication context for an active exact-project AMD admin. Returns active project parties and latest linear revision without exposing kernel tables directly.';

COMMIT;
