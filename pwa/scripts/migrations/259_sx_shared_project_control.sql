-- 259_sx_shared_project_control.sql
--
-- SX p21を先行例に、PJ横断の本人・組織・party・grantと、明示audienceを持つ
-- immutable publicationを追加する。既存project_management_*は変更せず、
-- 公開RPCはsource refからDBがpayloadを組み立て、任意の自由文を受け取らない。

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SELECT set_config('app.workspace_migration', '259', true);

-- ---------------------------------------------------------------------
-- 1. Principal / organization / party / exact capability grant
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.workspace_principals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT REFERENCES public.members(member_id) ON DELETE RESTRICT,
  workspace_user_account_id UUID REFERENCES public.workspace_user_accounts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_principals_exactly_one_source
    CHECK (num_nonnulls(member_id, workspace_user_account_id) = 1),
  UNIQUE (member_id),
  UNIQUE (workspace_user_account_id)
);

CREATE TABLE IF NOT EXISTS public.workspace_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL
    CHECK (kind IN ('amd', 'research_institution', 'startup_team', 'startup_company')),
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  source_kind TEXT NOT NULL
    CHECK (source_kind IN ('amd_internal', 'institution', 'external')),
  source_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'revoked')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_organizations_slug_format
    CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT workspace_organizations_source_pair CHECK (
    (kind = 'amd' AND source_kind = 'amd_internal' AND source_id = 'amd') OR
    (kind = 'research_institution' AND source_kind = 'institution' AND source_id IS NOT NULL) OR
    (kind IN ('startup_team', 'startup_company') AND source_kind = 'external' AND source_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_organizations_slug_lower_key
  ON public.workspace_organizations(lower(slug));
CREATE UNIQUE INDEX IF NOT EXISTS workspace_organizations_source_key
  ON public.workspace_organizations(source_kind, source_id)
  WHERE source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.workspace_organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES public.workspace_organizations(id) ON DELETE RESTRICT,
  principal_id UUID NOT NULL
    REFERENCES public.workspace_principals(id) ON DELETE RESTRICT,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'member', 'readonly')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'revoked')),
  accepted_at TIMESTAMPTZ,
  terms_version TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, principal_id),
  UNIQUE (id, organization_id, principal_id)
);

CREATE TABLE IF NOT EXISTS public.project_organization_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES public.projects(project_id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL
    REFERENCES public.workspace_organizations(id) ON DELETE RESTRICT,
  party_role TEXT NOT NULL
    CHECK (party_role IN ('studio', 'startup', 'research', 'partner')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'revoked')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, organization_id),
  UNIQUE (id, project_id),
  UNIQUE (id, project_id, organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS project_one_active_studio_party_key
  ON public.project_organization_parties(project_id)
  WHERE party_role = 'studio' AND status = 'active';

CREATE TABLE IF NOT EXISTS public.project_principal_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  organization_id UUID NOT NULL,
  principal_id UUID NOT NULL,
  organization_membership_id UUID NOT NULL,
  project_party_id UUID NOT NULL,
  capability TEXT NOT NULL
    CHECK (capability IN ('publication.view', 'publication.approve')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, principal_id, capability),
  FOREIGN KEY (organization_membership_id, organization_id, principal_id)
    REFERENCES public.workspace_organization_memberships
      (id, organization_id, principal_id) ON DELETE RESTRICT,
  FOREIGN KEY (project_party_id, project_id, organization_id)
    REFERENCES public.project_organization_parties
      (id, project_id, organization_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.project_publication_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES public.projects(project_id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  as_of TIMESTAMPTZ NOT NULL,
  supersedes_revision_id UUID,
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  published_by_principal_id UUID NOT NULL
    REFERENCES public.workspace_principals(id) ON DELETE RESTRICT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sealed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, revision),
  UNIQUE (id, project_id),
  FOREIGN KEY (supersedes_revision_id, project_id)
    REFERENCES public.project_publication_revisions(id, project_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.project_publication_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  item_kind TEXT NOT NULL CHECK (item_kind IN (
    'project_summary.v1', 'party.v1', 'pillar.v1', 'control_item.v1'
  )),
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_version INTEGER NOT NULL CHECK (source_version > 0),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (publication_id, item_kind, source_table, source_id),
  FOREIGN KEY (publication_id, project_id)
    REFERENCES public.project_publication_revisions(id, project_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.project_publication_audiences (
  publication_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  project_party_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (publication_id, project_party_id),
  FOREIGN KEY (publication_id, project_id)
    REFERENCES public.project_publication_revisions(id, project_id) ON DELETE RESTRICT,
  FOREIGN KEY (project_party_id, project_id)
    REFERENCES public.project_organization_parties(id, project_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.workspace_control_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  actor_principal_id UUID REFERENCES public.workspace_principals(id) ON DELETE RESTRICT,
  actor_project_party_id UUID,
  actor_source TEXT NOT NULL CHECK (actor_source IN ('rpc', 'migration')),
  project_id TEXT,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  request_id TEXT,
  request_fingerprint TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_control_audit_request_key
  ON public.workspace_control_audit_logs(request_id)
  WHERE request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.workspace_reject_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '%.% is append-only: % is not allowed',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE OR REPLACE FUNCTION public.workspace_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.workspace_record_control_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row JSONB := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_actor UUID;
  v_actor_source TEXT;
BEGIN
  BEGIN
    v_actor := NULLIF(current_setting('app.workspace_actor_principal_id', true), '')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    v_actor := NULL;
  END;
  IF v_actor IS NOT NULL THEN
    v_actor_source := 'rpc';
  ELSIF NULLIF(current_setting('app.workspace_migration', true), '') IS NOT NULL THEN
    v_actor_source := 'migration';
  ELSE
    RAISE EXCEPTION 'workspace control mutation requires an explicit actor or migration context';
  END IF;
  INSERT INTO public.workspace_control_audit_logs(
    event_type, actor_principal_id, actor_source, project_id,
    resource_type, resource_id, detail
  ) VALUES (
    'security_row_mutation', v_actor, v_actor_source,
    NULLIF(v_row ->> 'project_id', ''), TG_TABLE_NAME,
    COALESCE(v_row ->> 'id', v_row ->> 'publication_id', 'unknown'),
    jsonb_build_object('operation', lower(TG_OP), 'status', COALESCE(v_row ->> 'status', 'sealed'))
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'workspace_principals', 'workspace_organizations',
    'workspace_organization_memberships', 'project_organization_parties',
    'project_principal_grants'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS workspace_touch_updated_at ON public.%I', v_table);
    EXECUTE format('CREATE TRIGGER workspace_touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.workspace_touch_updated_at()', v_table);
  END LOOP;
  FOREACH v_table IN ARRAY ARRAY[
    'project_publication_revisions', 'project_publication_items',
    'project_publication_audiences', 'workspace_control_audit_logs'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS workspace_reject_update ON public.%I', v_table);
    EXECUTE format('CREATE TRIGGER workspace_reject_update BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.workspace_reject_mutation()', v_table);
  END LOOP;
  FOREACH v_table IN ARRAY ARRAY[
    'workspace_principals', 'workspace_organizations',
    'workspace_organization_memberships', 'project_organization_parties',
    'project_principal_grants', 'project_publication_revisions',
    'project_publication_items', 'project_publication_audiences'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS workspace_control_mutation_audit ON public.%I', v_table);
    EXECUTE format('CREATE TRIGGER workspace_control_mutation_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.workspace_record_control_mutation()', v_table);
  END LOOP;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.project_control_item_from_source_ref(
  p_project_id TEXT,
  p_ref JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source_table TEXT;
  v_source_id UUID;
  v_source_version INTEGER;
  v_pillar_key TEXT;
  v_title TEXT;
  v_state TEXT;
  v_due_date DATE;
  v_track TEXT;
  v_entity_type TEXT;
  v_ball_party_ids JSONB;
  v_dependency_item_ids JSONB;
  v_joint BOOLEAN;
  v_critical_rank INTEGER;
BEGIN
  IF jsonb_typeof(p_ref) <> 'object'
     OR NOT (p_ref ?& ARRAY[
       'sourceTable','sourceId','sourceVersion','pillarKey','ballPartyIds',
       'jointDecision','criticalRank','dependencyItemIds'
     ]) OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(p_ref) key
       WHERE NOT (key = ANY (ARRAY[
         'sourceTable','sourceId','sourceVersion','pillarKey','ballPartyIds',
         'jointDecision','criticalRank','dependencyItemIds'
       ]))
     ) THEN
    RAISE EXCEPTION 'source ref envelope is invalid';
  END IF;

  v_source_table := p_ref ->> 'sourceTable';
  v_source_id := (p_ref ->> 'sourceId')::UUID;
  v_source_version := (p_ref ->> 'sourceVersion')::INTEGER;
  v_pillar_key := p_ref ->> 'pillarKey';
  v_ball_party_ids := p_ref -> 'ballPartyIds';
  v_dependency_item_ids := p_ref -> 'dependencyItemIds';
  v_joint := (p_ref ->> 'jointDecision')::BOOLEAN;
  v_critical_rank := NULLIF(p_ref ->> 'criticalRank', '')::INTEGER;

  IF v_source_table IS NULL OR v_source_id IS NULL OR v_source_version IS NULL
     OR v_source_version <= 0 OR v_pillar_key IS NULL
     OR v_pillar_key NOT IN (
       'business_development','technology_development','organizational_building','funding'
     ) OR jsonb_typeof(v_ball_party_ids) <> 'array'
     OR jsonb_typeof(v_dependency_item_ids) <> 'array'
     OR v_joint IS NULL
     OR (v_critical_rank IS NOT NULL AND v_critical_rank <= 0) THEN
    RAISE EXCEPTION 'source ref contains an invalid structural value';
  END IF;

  IF EXISTS (
    SELECT (party_id::UUID)
    FROM jsonb_array_elements_text(v_ball_party_ids) ball(party_id)
    GROUP BY party_id::UUID HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'ballPartyIds must contain unique canonical UUIDs';
  END IF;
  IF EXISTS (
    SELECT btrim(item_id)
    FROM jsonb_array_elements_text(v_dependency_item_ids) dependency(item_id)
    GROUP BY btrim(item_id)
    HAVING btrim(item_id) = '' OR count(*) > 1
  ) THEN
    RAISE EXCEPTION 'dependencyItemIds must contain unique non-empty IDs';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb((party_id::UUID)::TEXT) ORDER BY ordinal), '[]'::JSONB)
    INTO v_ball_party_ids
    FROM jsonb_array_elements_text(v_ball_party_ids) WITH ORDINALITY ball(party_id, ordinal);
  SELECT COALESCE(jsonb_agg(to_jsonb(btrim(item_id)) ORDER BY ordinal), '[]'::JSONB)
    INTO v_dependency_item_ids
    FROM jsonb_array_elements_text(v_dependency_item_ids) WITH ORDINALITY dependency(item_id, ordinal);

  CASE v_source_table
    WHEN 'project_management_milestones' THEN
      SELECT title, status, planned_end, track, 'milestone'
        INTO v_title, v_state, v_due_date, v_track, v_entity_type
        FROM public.project_management_milestones
       WHERE id = v_source_id AND project_id = p_project_id
         AND version = v_source_version AND deleted_at IS NULL;
    WHEN 'project_management_issues' THEN
      SELECT title, status, due_date, track, 'issue'
        INTO v_title, v_state, v_due_date, v_track, v_entity_type
        FROM public.project_management_issues
       WHERE id = v_source_id AND project_id = p_project_id
         AND version = v_source_version AND deleted_at IS NULL;
    WHEN 'project_management_decisions' THEN
      SELECT title, decision_state, due_date, NULL, 'decision'
        INTO v_title, v_state, v_due_date, v_track, v_entity_type
        FROM public.project_management_decisions
       WHERE id = v_source_id AND project_id = p_project_id
         AND version = v_source_version AND deleted_at IS NULL;
    WHEN 'project_management_action_items' THEN
      SELECT title, status, due_date, NULL, 'action'
        INTO v_title, v_state, v_due_date, v_track, v_entity_type
        FROM public.project_management_action_items
       WHERE id = v_source_id AND project_id = p_project_id
         AND version = v_source_version AND deleted_at IS NULL;
    WHEN 'project_management_partner_work_items' THEN
      SELECT title, status, due_date, NULL, 'partner_work_item'
        INTO v_title, v_state, v_due_date, v_track, v_entity_type
        FROM public.project_management_partner_work_items
       WHERE id = v_source_id AND project_id = p_project_id
         AND version = v_source_version AND deleted_at IS NULL;
    ELSE
      RAISE EXCEPTION 'source table is not allowlisted: %', v_source_table;
  END CASE;

  -- Explicitly map every allowlisted source status. A future source value must not
  -- silently become an on-track shared state.
  v_state := CASE v_source_table
    WHEN 'project_management_milestones' THEN CASE v_state
      WHEN 'unassessed' THEN 'unknown'
      WHEN 'on_track' THEN 'on_track'
      WHEN 'attention' THEN 'attention'
      WHEN 'at_risk' THEN 'at_risk'
      WHEN 'blocked' THEN 'blocked'
      WHEN 'completed' THEN 'completed'
      ELSE 'unknown' END
    WHEN 'project_management_issues' THEN CASE v_state
      WHEN 'open' THEN 'open'
      WHEN 'validating' THEN 'validating'
      WHEN 'closed' THEN 'closed'
      WHEN 'on_hold' THEN 'on_hold'
      ELSE 'unknown' END
    WHEN 'project_management_decisions' THEN CASE v_state
      WHEN 'pending' THEN 'pending'
      WHEN 'decided' THEN 'decided'
      WHEN 'deferred' THEN 'deferred'
      ELSE 'unknown' END
    WHEN 'project_management_action_items' THEN CASE v_state
      WHEN 'open' THEN 'open'
      WHEN 'in_progress' THEN 'in_progress'
      WHEN 'completed' THEN 'completed'
      WHEN 'blocked' THEN 'blocked'
      ELSE 'unknown' END
    WHEN 'project_management_partner_work_items' THEN CASE v_state
      WHEN 'open' THEN 'open'
      WHEN 'in_progress' THEN 'in_progress'
      WHEN 'waiting' THEN 'waiting'
      WHEN 'blocked' THEN 'blocked'
      WHEN 'on_hold' THEN 'on_hold'
      WHEN 'completed' THEN 'completed'
      WHEN 'cancelled' THEN 'cancelled'
      ELSE 'unknown' END
    ELSE 'unknown'
  END;

  IF NULLIF(btrim(v_title), '') IS NULL OR char_length(btrim(v_title)) > 200 THEN
    RAISE EXCEPTION 'source row/version is outside the project or missing';
  END IF;
  v_title := btrim(v_title);
  IF v_track IS NOT NULL AND v_track <> v_pillar_key THEN
    RAISE EXCEPTION 'source pillar does not match its canonical track';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_ball_party_ids) ball(party_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.project_organization_parties p
      JOIN public.workspace_organizations o ON o.id = p.organization_id
      WHERE p.id = ball.party_id::UUID AND p.project_id = p_project_id
        AND p.status = 'active' AND o.status = 'active'
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        AND (o.expires_at IS NULL OR o.expires_at > NOW())
    )
  ) THEN
    RAISE EXCEPTION 'ball party is outside the active project scope';
  END IF;

  RETURN jsonb_build_object(
    'item_kind', 'control_item.v1', 'source_table', v_source_table,
    'source_id', v_source_id::TEXT, 'source_version', v_source_version,
    'payload', jsonb_build_object(
      'itemId', v_source_table || ':' || v_source_id::TEXT,
      'entityType', v_entity_type, 'entityId', v_source_id::TEXT,
      'pillarKey', v_pillar_key, 'label', v_title, 'state', v_state,
      'dueDate', v_due_date, 'ballPartyIds', v_ball_party_ids,
      'jointDecision', v_joint, 'criticalRank', v_critical_rank,
      'dependencyItemIds', v_dependency_item_ids,
      'downstreamImpactLabel', NULL
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.project_publish_control_revision(
  p_request_id TEXT,
  p_actor_principal_id UUID,
  p_project_id TEXT,
  p_as_of TIMESTAMPTZ,
  p_source_refs JSONB,
  p_audience_party_ids UUID[],
  p_supersedes_revision_id UUID DEFAULT NULL
)
RETURNS public.project_publication_revisions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_revision public.project_publication_revisions%ROWTYPE;
  v_existing public.workspace_control_audit_logs%ROWTYPE;
  v_actor_party_ids UUID[];
  v_latest_revision_id UUID;
  v_next_revision INTEGER;
  v_fingerprint TEXT;
  v_content_hash TEXT;
  v_items JSONB := '[]'::JSONB;
  v_control_items JSONB := '[]'::JSONB;
  v_ref JSONB;
  v_party_id UUID;
  v_all_party_ids UUID[];
  v_project_name TEXT;
  v_summary_state TEXT;
  v_summary_label TEXT;
  v_summary_reason TEXT;
  v_pillar RECORD;
  v_pillar_state TEXT;
  v_blocked_count INTEGER;
  v_unknown_count INTEGER;
  v_next_due DATE;
  v_gate TEXT;
BEGIN
  IF NULLIF(btrim(p_request_id), '') IS NULL OR p_actor_principal_id IS NULL
     OR NULLIF(btrim(p_project_id), '') IS NULL OR p_as_of IS NULL OR NOT isfinite(p_as_of)
     OR p_source_refs IS NULL OR jsonb_typeof(p_source_refs) <> 'array'
     OR COALESCE(cardinality(p_audience_party_ids), 0) = 0 THEN
    RAISE EXCEPTION 'publish request is incomplete';
  END IF;
  IF EXISTS (
    SELECT party_id FROM unnest(p_audience_party_ids) audience(party_id)
    GROUP BY party_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'audience party IDs must be unique';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('project-publication-request:' || p_request_id));
  v_fingerprint := encode(digest(jsonb_build_object(
    'actor', p_actor_principal_id, 'project', p_project_id, 'asOf', p_as_of,
    'sourceRefs', p_source_refs,
    'audiences', (SELECT jsonb_agg(x ORDER BY x) FROM unnest(p_audience_party_ids) x),
    'supersedes', p_supersedes_revision_id
  )::TEXT, 'sha256'), 'hex');

  SELECT * INTO v_existing FROM public.workspace_control_audit_logs
   WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.actor_principal_id IS DISTINCT FROM p_actor_principal_id
       OR v_existing.project_id IS DISTINCT FROM p_project_id
       OR v_existing.event_type <> 'publication_publish'
       OR v_existing.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'request_id was already used with a different request';
    END IF;
    SELECT * INTO v_revision FROM public.project_publication_revisions
     WHERE id = v_existing.resource_id::UUID;
    RETURN v_revision;
  END IF;

  v_actor_party_ids := public.project_active_publication_parties(
    p_actor_principal_id, p_project_id, 'publication.approve'
  );
  IF COALESCE(cardinality(v_actor_party_ids), 0) = 0 THEN
    RAISE EXCEPTION 'no active publication.approve grant';
  END IF;

  FOREACH v_party_id IN ARRAY p_audience_party_ids LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.project_organization_parties p
      JOIN public.workspace_organizations o ON o.id = p.organization_id
      WHERE p.id = v_party_id AND p.project_id = p_project_id
        AND p.status = 'active' AND o.status = 'active'
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        AND (o.expires_at IS NULL OR o.expires_at > NOW())
    ) THEN RAISE EXCEPTION 'audience party is outside the active project scope'; END IF;
  END LOOP;

  -- Lock the project lineage before both the latest-revision check and numbering.
  -- This prevents two different requests from superseding the same old revision.
  PERFORM pg_advisory_xact_lock(hashtext('project-publication:' || p_project_id));

  SELECT id INTO v_latest_revision_id
  FROM public.project_publication_revisions
  WHERE project_id = p_project_id ORDER BY revision DESC LIMIT 1;
  IF (v_latest_revision_id IS NULL AND p_supersedes_revision_id IS NOT NULL)
     OR (v_latest_revision_id IS NOT NULL
       AND p_supersedes_revision_id IS DISTINCT FROM v_latest_revision_id) THEN
    RAISE EXCEPTION 'first publication must not supersede; later publications must supersede the latest revision';
  END IF;

  IF EXISTS (
    SELECT ref ->> 'sourceTable', ref ->> 'sourceId'
    FROM jsonb_array_elements(p_source_refs) ref
    GROUP BY ref ->> 'sourceTable', ref ->> 'sourceId' HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'duplicate source ref'; END IF;

  FOR v_ref IN SELECT value FROM jsonb_array_elements(p_source_refs) LOOP
    v_control_items := v_control_items || jsonb_build_array(
      public.project_control_item_from_source_ref(p_project_id, v_ref)
    );
  END LOOP;

  IF EXISTS (
    SELECT (item -> 'payload' ->> 'criticalRank')::INTEGER
    FROM jsonb_array_elements(v_control_items) item
    WHERE item -> 'payload' ->> 'criticalRank' IS NOT NULL
    GROUP BY (item -> 'payload' ->> 'criticalRank')::INTEGER HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'criticalRank must be unique'; END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_control_items) item,
         jsonb_array_elements_text(item -> 'payload' -> 'dependencyItemIds') dependency(item_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_control_items) candidate
      WHERE candidate -> 'payload' ->> 'itemId' = dependency.item_id
    )
  ) THEN RAISE EXCEPTION 'dependency item is outside this publication'; END IF;

  SELECT array_agg(DISTINCT party_id) INTO v_all_party_ids
  FROM (
    SELECT unnest(p_audience_party_ids) AS party_id
    UNION
    SELECT value::TEXT::UUID
    FROM jsonb_array_elements(v_control_items) item,
         jsonb_array_elements_text(item -> 'payload' -> 'ballPartyIds') value
  ) parties;

  FOREACH v_party_id IN ARRAY COALESCE(v_all_party_ids, ARRAY[]::UUID[]) LOOP
    v_ref := NULL;
    SELECT jsonb_build_object(
      'item_kind', 'party.v1', 'source_table', 'project_organization_parties',
      'source_id', p.id::TEXT, 'source_version', 1,
      'payload', jsonb_build_object(
        'partyId', p.id::TEXT,
        'kind', CASE WHEN o.kind = 'amd' THEN 'amd'
          WHEN o.kind = 'research_institution' THEN 'research' ELSE 'startup' END,
        'displayLabel', btrim(o.display_name)
      )
    ) INTO v_ref
    FROM public.project_organization_parties p
    JOIN public.workspace_organizations o ON o.id = p.organization_id
    WHERE p.id = v_party_id AND p.project_id = p_project_id;
    IF v_ref IS NULL
       OR NULLIF(btrim(v_ref -> 'payload' ->> 'displayLabel'), '') IS NULL
       OR char_length(v_ref -> 'payload' ->> 'displayLabel') > 120 THEN
      RAISE EXCEPTION 'publication party display label is missing or too long';
    END IF;
    v_items := v_items || jsonb_build_array(v_ref);
  END LOOP;

  FOR v_pillar IN SELECT * FROM (VALUES
    ('business_development', '事業開発'),
    ('technology_development', '技術開発'),
    ('organizational_building', '組織構築'),
    ('funding', '資金調達')
  ) pillars(key, label) LOOP
    SELECT CASE
      WHEN count(*) = 0 THEN 'unknown'
      WHEN bool_or(item -> 'payload' ->> 'state' IN ('blocked','at_risk','failed')) THEN 'critical'
      WHEN bool_or(item -> 'payload' ->> 'state' IN ('unknown','missing','unshared','unassessed')) THEN 'unknown'
      WHEN bool_or(item -> 'payload' ->> 'state' IN (
        'active','attention','open','pending','in_progress','validating','waiting',
        'on_hold','deferred','planned','proposed','running','submitted'
      )) THEN 'attention'
      WHEN bool_and(item -> 'payload' ->> 'state' IN (
        'accepted','accepted_done','cancelled','closed','committed','completed',
        'confirmed','decided','filled','on_track','passed','rejected','validated'
      )) THEN 'on_track'
      ELSE 'unknown' END,
      count(*) FILTER (WHERE item -> 'payload' ->> 'state' IN ('blocked','at_risk','failed')),
      CASE WHEN count(*) = 0 THEN 1 ELSE count(*) FILTER (
        WHERE item -> 'payload' ->> 'state' IN ('unknown','missing','unshared','unassessed')
      ) END,
      min(NULLIF(item -> 'payload' ->> 'dueDate', '')::DATE) FILTER (
        WHERE item -> 'payload' ->> 'state' NOT IN (
          'accepted_done','cancelled','closed','completed','confirmed',
          'decided','filled','passed','rejected','validated'
        )
      ),
      (array_agg(item -> 'payload' ->> 'label' ORDER BY
        COALESCE(NULLIF(item -> 'payload' ->> 'criticalRank', '')::INTEGER, 2147483647),
        item -> 'payload' ->> 'itemId'
      ) FILTER (
        WHERE item -> 'payload' ->> 'state' NOT IN (
          'accepted_done','cancelled','closed','completed','confirmed',
          'decided','filled','passed','rejected','validated'
        )
      ))[1]
      INTO v_pillar_state, v_blocked_count, v_unknown_count, v_next_due, v_gate
    FROM jsonb_array_elements(v_control_items) item
    WHERE item -> 'payload' ->> 'pillarKey' = v_pillar.key;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'item_kind', 'pillar.v1', 'source_table', 'project_publication',
      'source_id', v_pillar.key, 'source_version', 1,
      'payload', jsonb_build_object(
        'key', v_pillar.key, 'label', v_pillar.label, 'state', v_pillar_state,
        'currentGateLabel', v_gate, 'nextDue', v_next_due,
        'blockedCount', v_blocked_count, 'unknownCount', v_unknown_count
      )
    ));
  END LOOP;

  v_items := v_items || v_control_items;
  SELECT btrim(project_name) INTO v_project_name FROM public.projects WHERE project_id = p_project_id;
  IF NULLIF(v_project_name, '') IS NULL OR char_length(v_project_name) > 200 THEN
    RAISE EXCEPTION 'project is missing or its publication name is invalid';
  END IF;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_items) item
    WHERE item ->> 'item_kind' = 'pillar.v1' AND item -> 'payload' ->> 'state' = 'critical') THEN
    v_summary_state := 'critical'; v_summary_label := '停止項目あり';
    v_summary_reason := '公開済みの4本柱に停止または重大リスクがある';
  ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(v_items) item
    WHERE item ->> 'item_kind' = 'pillar.v1' AND item -> 'payload' ->> 'state' = 'unknown') THEN
    v_summary_state := 'unknown'; v_summary_label := '共有項目を確認中';
    v_summary_reason := '公開済み項目が無い柱を未確認のまま保持している';
  ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(v_items) item
    WHERE item ->> 'item_kind' = 'pillar.v1' AND item -> 'payload' ->> 'state' = 'attention') THEN
    v_summary_state := 'attention'; v_summary_label := '要確認';
    v_summary_reason := '公開済みの重要経路に対応中の項目がある';
  ELSE
    v_summary_state := 'on_track'; v_summary_label := '公開範囲では進行中';
    v_summary_reason := '公開済み項目の範囲では停止を確認していない';
  END IF;

  v_items := jsonb_build_array(jsonb_build_object(
    'item_kind', 'project_summary.v1', 'source_table', 'projects',
    'source_id', p_project_id, 'source_version', 1,
    'payload', jsonb_build_object(
      'projectId', p_project_id, 'projectName', v_project_name,
      'asOf', p_as_of, 'lastVerifiedAt', NULL,
      'verdict', jsonb_build_object(
        'state', v_summary_state, 'label', v_summary_label, 'reason', v_summary_reason
      )
    )
  )) || v_items;

  v_content_hash := encode(digest(v_items::TEXT, 'sha256'), 'hex');
  SELECT COALESCE(MAX(revision), 0) + 1 INTO v_next_revision
  FROM public.project_publication_revisions WHERE project_id = p_project_id;

  PERFORM set_config('app.workspace_actor_principal_id', p_actor_principal_id::TEXT, true);
  INSERT INTO public.project_publication_revisions(
    project_id, revision, as_of, supersedes_revision_id, content_hash,
    published_by_principal_id, published_at, sealed_at
  ) VALUES (
    p_project_id, v_next_revision, p_as_of, p_supersedes_revision_id,
    v_content_hash, p_actor_principal_id, NOW(), NOW()
  ) RETURNING * INTO v_revision;

  FOR v_ref IN SELECT value FROM jsonb_array_elements(v_items) LOOP
    INSERT INTO public.project_publication_items(
      publication_id, project_id, item_kind, source_table,
      source_id, source_version, payload
    ) VALUES (
      v_revision.id, p_project_id, v_ref ->> 'item_kind',
      v_ref ->> 'source_table', v_ref ->> 'source_id',
      (v_ref ->> 'source_version')::INTEGER, v_ref -> 'payload'
    );
  END LOOP;
  FOREACH v_party_id IN ARRAY p_audience_party_ids LOOP
    INSERT INTO public.project_publication_audiences(
      publication_id, project_id, project_party_id
    ) VALUES (v_revision.id, p_project_id, v_party_id);
  END LOOP;

  INSERT INTO public.workspace_control_audit_logs(
    event_type, actor_principal_id, actor_project_party_id, actor_source,
    project_id, resource_type, resource_id, request_id, request_fingerprint, detail
  ) VALUES (
    'publication_publish', p_actor_principal_id, v_actor_party_ids[1], 'rpc',
    p_project_id, 'project_publication_revisions', v_revision.id::TEXT,
    p_request_id, v_fingerprint,
    jsonb_build_object(
      'revision', v_next_revision,
      'itemCount', jsonb_array_length(v_items),
      'audienceCount', cardinality(p_audience_party_ids),
      'audiencePartyIds', to_jsonb(p_audience_party_ids)
    )
  );
  RETURN v_revision;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_read_publication_for_principal(
  p_principal_id UUID,
  p_project_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_party_ids UUID[];
  v_revision public.project_publication_revisions%ROWTYPE;
  v_items JSONB;
BEGIN
  v_party_ids := public.project_active_publication_parties(
    p_principal_id, p_project_id, 'publication.view'
  );
  IF COALESCE(cardinality(v_party_ids), 0) = 0 THEN RETURN NULL; END IF;

  SELECT r.* INTO v_revision FROM public.project_publication_revisions r
  WHERE r.project_id = p_project_id ORDER BY r.revision DESC LIMIT 1;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.project_publication_audiences a
    WHERE a.publication_id = v_revision.id
      AND a.project_party_id = ANY(v_party_ids)
  ) THEN
    RETURN jsonb_build_object(
      'state', 'unpublished', 'projectId', p_project_id,
      'viewerPartyIds', to_jsonb(v_party_ids)
    );
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'itemKind', i.item_kind, 'sourceTable', i.source_table,
    'sourceId', i.source_id, 'sourceVersion', i.source_version,
    'payload', i.payload
  ) ORDER BY i.item_kind, i.source_id), '[]'::jsonb)
  INTO v_items FROM public.project_publication_items i
  WHERE i.publication_id = v_revision.id;

  RETURN jsonb_build_object(
    'state', 'published', 'viewerPartyIds', to_jsonb(v_party_ids),
    'revision', jsonb_build_object(
      'id', v_revision.id, 'number', v_revision.revision,
      'asOf', v_revision.as_of, 'publishedAt', v_revision.published_at,
      'contentHash', v_revision.content_hash
    ),
    'items', v_items
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.project_read_published_revision_for_workspace_account(
  p_workspace_user_account_id UUID,
  p_project_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE v_principal_id UUID;
BEGIN
  SELECT p.id INTO v_principal_id
  FROM public.workspace_principals p
  JOIN public.workspace_user_accounts a
    ON a.id = p.workspace_user_account_id AND a.status = 'active'
  JOIN public.project_access_memberships pam
    ON pam.user_account_id = a.id AND pam.project_id = p_project_id
   AND pam.status = 'active'
  WHERE p.workspace_user_account_id = p_workspace_user_account_id
    AND p.status = 'active';
  IF v_principal_id IS NULL THEN RETURN NULL; END IF;
  RETURN public.project_read_publication_for_principal(v_principal_id, p_project_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.project_read_published_revision_for_member(
  p_member_id TEXT,
  p_project_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE v_principal_id UUID;
BEGIN
  SELECT p.id INTO v_principal_id
  FROM public.workspace_principals p
  JOIN public.members m ON m.member_id = p.member_id AND m.status = 'active'
  JOIN public.project_members pm ON pm.member_id = m.member_id
   AND pm.project_id = p_project_id AND pm.is_active = TRUE
  WHERE p.member_id = p_member_id AND p.status = 'active';
  IF v_principal_id IS NULL THEN RETURN NULL; END IF;
  RETURN public.project_read_publication_for_principal(v_principal_id, p_project_id);
END;
$$;

-- New kernel tables have no direct app writer. SECURITY DEFINER RPCs are the only write path.
DO $$
DECLARE v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'workspace_principals', 'workspace_organizations',
    'workspace_organization_memberships', 'project_organization_parties',
    'project_principal_grants', 'project_publication_revisions',
    'project_publication_items', 'project_publication_audiences',
    'workspace_control_audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_admin_select', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_admin())',
      v_table || '_admin_select', v_table
    );
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', v_table);
    EXECUTE format('DROP TRIGGER IF EXISTS workspace_reject_hard_delete ON public.%I', v_table);
    EXECUTE format('CREATE TRIGGER workspace_reject_hard_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.workspace_reject_mutation()', v_table);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.project_active_publication_parties(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.project_control_item_from_source_ref(TEXT, JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.project_publish_control_revision(TEXT, UUID, TEXT, TIMESTAMPTZ, JSONB, UUID[], UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.project_read_publication_for_principal(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.project_read_published_revision_for_workspace_account(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.project_read_published_revision_for_member(TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.project_publish_control_revision(TEXT, UUID, TEXT, TIMESTAMPTZ, JSONB, UUID[], UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.project_read_published_revision_for_workspace_account(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.project_read_published_revision_for_member(TEXT, TEXT) TO service_role;

COMMIT;
