-- 260_publication_approver_studio_guard.sql
-- publication.approve is an AMD-studio capability. A research/startup party must
-- never be able to seal an external publication, even if a bad grant is inserted.

BEGIN;

CREATE OR REPLACE FUNCTION public.workspace_validate_publication_approve_grant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_party_role TEXT;
  v_organization_kind TEXT;
  v_organization_source_kind TEXT;
  v_organization_source_id TEXT;
BEGIN
  IF NEW.capability = 'publication.approve' AND NEW.status = 'active' THEN
    SELECT p.party_role, o.kind, o.source_kind, o.source_id
    INTO v_party_role, v_organization_kind, v_organization_source_kind, v_organization_source_id
    FROM public.project_organization_parties p
    JOIN public.workspace_organizations o ON o.id = p.organization_id
    WHERE p.id = NEW.project_party_id
      AND p.project_id = NEW.project_id
      AND p.organization_id = NEW.organization_id;

    IF v_party_role IS DISTINCT FROM 'studio'
       OR v_organization_kind IS DISTINCT FROM 'amd'
       OR v_organization_source_kind IS DISTINCT FROM 'amd_internal'
       OR v_organization_source_id IS DISTINCT FROM 'amd' THEN
      RAISE EXCEPTION 'publication.approve requires the canonical AMD studio project party';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspace_publication_approve_studio_guard
  ON public.project_principal_grants;
CREATE TRIGGER workspace_publication_approve_studio_guard
BEFORE INSERT OR UPDATE OF capability, status, project_party_id, project_id, organization_id
ON public.project_principal_grants
FOR EACH ROW
EXECUTE FUNCTION public.workspace_validate_publication_approve_grant();

-- Replacing this resolver also protects the existing publish RPC. Even if an
-- invalid grant predates the trigger, publication.approve resolves only through
-- the exact active studio party.
CREATE OR REPLACE FUNCTION public.project_active_publication_parties(
  p_principal_id UUID,
  p_project_id TEXT,
  p_required_capability TEXT
)
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT array_agg(DISTINCT g.project_party_id)
  FROM public.project_principal_grants g
  JOIN public.workspace_principals pr ON pr.id = g.principal_id
  JOIN public.workspace_organization_memberships m
    ON m.id = g.organization_membership_id
   AND m.organization_id = g.organization_id AND m.principal_id = g.principal_id
  JOIN public.workspace_organizations o ON o.id = g.organization_id
  JOIN public.project_organization_parties p
    ON p.id = g.project_party_id AND p.project_id = g.project_id
   AND p.organization_id = g.organization_id
  WHERE g.principal_id = p_principal_id AND g.project_id = p_project_id
    AND g.capability = p_required_capability AND g.status = 'active'
    AND (p_required_capability <> 'publication.approve' OR (
      p.party_role = 'studio'
      AND o.kind = 'amd'
      AND o.source_kind = 'amd_internal'
      AND o.source_id = 'amd'
    ))
    AND (g.expires_at IS NULL OR g.expires_at > NOW())
    AND pr.status = 'active'
    AND ((pr.member_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.members mm
      JOIN public.project_members pm ON pm.member_id = mm.member_id
      WHERE mm.member_id = pr.member_id AND mm.status = 'active'
        AND pm.project_id = p_project_id AND pm.is_active = TRUE
    )) OR (pr.workspace_user_account_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_user_accounts wa
      JOIN public.project_access_memberships pam ON pam.user_account_id = wa.id
      WHERE wa.id = pr.workspace_user_account_id AND wa.status = 'active'
        AND pam.project_id = p_project_id AND pam.status = 'active'
    )))
    AND m.status = 'active' AND (m.expires_at IS NULL OR m.expires_at > NOW())
    AND o.status = 'active' AND (o.expires_at IS NULL OR o.expires_at > NOW())
    AND p.status = 'active' AND (p.expires_at IS NULL OR p.expires_at > NOW());
$$;

REVOKE ALL ON FUNCTION public.workspace_validate_publication_approve_grant()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.project_active_publication_parties(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.project_principal_grants g
    JOIN public.project_organization_parties p
      ON p.id = g.project_party_id
     AND p.project_id = g.project_id
     AND p.organization_id = g.organization_id
    JOIN public.workspace_organizations o ON o.id = g.organization_id
    WHERE g.capability = 'publication.approve'
      AND g.status = 'active'
      AND (
        p.party_role <> 'studio'
        OR o.kind <> 'amd'
        OR o.source_kind <> 'amd_internal'
        OR o.source_id <> 'amd'
      )
  ) THEN
    RAISE EXCEPTION 'active non-AMD-studio publication.approve grant exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'workspace_publication_approve_studio_guard'
      AND tgrelid = 'public.project_principal_grants'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'publication approve studio guard trigger is missing';
  END IF;
END;
$$;

COMMIT;
