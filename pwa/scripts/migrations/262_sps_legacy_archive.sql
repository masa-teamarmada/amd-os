-- 262_sps_legacy_archive.sql
--
-- SPS 2.1をPJスコア詳細の主表示へ切り替える前に、現行SPSの入力、改訂履歴、
-- BZM 2.0観測履歴、当時のalphaをPJ単位の復元可能なsnapshotへ退避する。
-- 元テーブルは削除・更新しない。SPS 2.1のactive revisionが揃うまでは
-- registryをpreparingのまま保持する。

BEGIN;

CREATE TABLE IF NOT EXISTS public.sps_legacy_archives (
  archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE RESTRICT,
  snapshot_key text NOT NULL,
  snapshot_at timestamptz NOT NULL,
  source_cutoff timestamptz NOT NULL,
  source_counts_json jsonb NOT NULL,
  payload_json jsonb NOT NULL,
  payload_hash text NOT NULL,
  archive_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sps_legacy_archives_project_snapshot_uniq UNIQUE (project_id, snapshot_key),
  CONSTRAINT sps_legacy_archives_project_archive_uniq UNIQUE (project_id, archive_id),
  CONSTRAINT sps_legacy_archives_payload_hash_check CHECK (
    payload_hash ~ '^[0-9a-f]{64}$'
    AND payload_hash = encode(extensions.digest(payload_json::text, 'sha256'), 'hex')
  ),
  CONSTRAINT sps_legacy_archives_payload_identity_check CHECK (
    (
      payload_json ->> 'schema' = 'sps-legacy-archive-v1'
    AND payload_json ->> 'project_id' = project_id
    AND payload_json ->> 'restore_only' = 'true'
    AND payload_json ->> 'eligible_as_bzm_2_1_evidence' = 'false'
    ) IS TRUE
  ),
  CONSTRAINT sps_legacy_archives_payload_counts_check CHECK (
    (
      (source_counts_json ->> 'amd_score_inputs')::integer = jsonb_array_length(payload_json -> 'amd_score_inputs')
    AND (source_counts_json ->> 'amd_score_revisions')::integer = jsonb_array_length(payload_json -> 'amd_score_revisions')
    AND (source_counts_json ->> 'amd_score_alpha_proposals')::integer = jsonb_array_length(payload_json -> 'amd_score_alpha_proposals')
    AND (source_counts_json ->> 'bzm_2_model_revisions')::integer = jsonb_array_length(payload_json -> 'bzm_2_model_revisions')
    AND (source_counts_json ->> 'bzm_2_parameter_observations')::integer = jsonb_array_length(payload_json -> 'bzm_2_parameter_observations')
    AND (source_counts_json ->> 'amd_score_alpha')::integer = jsonb_array_length(payload_json -> 'amd_score_alpha')
    ) IS TRUE
  ),
  CONSTRAINT sps_legacy_archives_payload_object_check CHECK (jsonb_typeof(payload_json) = 'object'),
  CONSTRAINT sps_legacy_archives_counts_object_check CHECK (jsonb_typeof(source_counts_json) = 'object'),
  CONSTRAINT sps_legacy_archives_capture_time_check CHECK (snapshot_at = source_cutoff)
);

COMMENT ON COLUMN public.sps_legacy_archives.source_cutoff IS
  '旧台帳を取得したDB snapshot時刻。BZM 2.1の証拠締切ではなく、payloadはrestore_only。';

CREATE INDEX IF NOT EXISTS sps_legacy_archives_project_created_idx
  ON public.sps_legacy_archives(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sps_primary_model_registry (
  project_id text PRIMARY KEY REFERENCES public.projects(project_id) ON DELETE RESTRICT,
  primary_model text NOT NULL,
  switch_status text NOT NULL,
  legacy_archive_id uuid NOT NULL,
  active_bzm_2_1_revision_id uuid NULL,
  switched_at timestamptz NULL,
  switched_by text NOT NULL,
  rollback_note text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sps_primary_model_registry_model_check CHECK (primary_model IN ('legacy_sps', 'sps_2_1')),
  CONSTRAINT sps_primary_model_registry_status_check CHECK (switch_status IN ('preparing', 'active', 'rolled_back')),
  CONSTRAINT sps_primary_model_registry_active_check CHECK (
    (switch_status = 'active' AND primary_model = 'sps_2_1' AND active_bzm_2_1_revision_id IS NOT NULL AND switched_at IS NOT NULL)
    OR (switch_status = 'preparing' AND primary_model = 'legacy_sps' AND active_bzm_2_1_revision_id IS NULL AND switched_at IS NULL)
    OR (switch_status = 'rolled_back' AND primary_model = 'legacy_sps')
  ),
  CONSTRAINT sps_primary_model_registry_archive_project_fk
    FOREIGN KEY (project_id, legacy_archive_id)
    REFERENCES public.sps_legacy_archives(project_id, archive_id) ON DELETE RESTRICT,
  CONSTRAINT sps_primary_model_registry_revision_project_fk
    FOREIGN KEY (project_id, active_bzm_2_1_revision_id)
    REFERENCES public.bzm_2_1_model_revisions(project_id, revision_id) ON DELETE RESTRICT
);

ALTER TABLE public.sps_legacy_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sps_primary_model_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sps_legacy_archives_members_read" ON public.sps_legacy_archives;
CREATE POLICY "sps_legacy_archives_members_read"
  ON public.sps_legacy_archives FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "sps_legacy_archives_service" ON public.sps_legacy_archives;
DROP POLICY IF EXISTS "sps_legacy_archives_service_insert" ON public.sps_legacy_archives;
CREATE POLICY "sps_legacy_archives_service_insert"
  ON public.sps_legacy_archives FOR INSERT TO service_role
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.reject_sps_legacy_archive_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'sps_legacy_archives is append-only';
END;
$$;

DROP TRIGGER IF EXISTS sps_legacy_archives_immutable ON public.sps_legacy_archives;
CREATE TRIGGER sps_legacy_archives_immutable
BEFORE UPDATE OR DELETE ON public.sps_legacy_archives
FOR EACH ROW EXECUTE FUNCTION public.reject_sps_legacy_archive_mutation();

DROP POLICY IF EXISTS "sps_primary_model_registry_members_read" ON public.sps_primary_model_registry;
CREATE POLICY "sps_primary_model_registry_members_read"
  ON public.sps_primary_model_registry FOR SELECT TO authenticated
  USING (public.amd_os_is_member());

DROP POLICY IF EXISTS "sps_primary_model_registry_service" ON public.sps_primary_model_registry;
CREATE POLICY "sps_primary_model_registry_service"
  ON public.sps_primary_model_registry FOR ALL TO service_role
  USING (true) WITH CHECK (true);

WITH target_projects(project_id) AS (
  VALUES
    ('p03'), ('p04'), ('p06'), ('p07'), ('p09'), ('p11'),
    ('p18'), ('p20'), ('p21'), ('p24'), ('p26'), ('p29')
), project_payloads AS (
  SELECT
    target_projects.project_id,
    jsonb_build_object(
      'schema', 'sps-legacy-archive-v1',
      'project_id', target_projects.project_id,
      'restore_only', true,
      'eligible_as_bzm_2_1_evidence', false,
      'archived_before_primary_model', 'sps_2_1',
      'legacy_calculation_manifest', jsonb_build_object(
        'source_commit', '2bd2a3ceda51434076ba74df49c7c95b038883a0',
        'build_version_when_frozen', 'v3.72.1',
        'amd_score_ts_sha256', '68e1297e542ae5b6f7eddfc1a909949ccf24b6676e24e412ddeda8db548c9d6b',
        'amd_score_derived_ts_sha256', '167b76b095294eed4c4cda01a8f958d37bc9b8553c43dfbe88032fd0c9340322',
        'amd_score_data_ts_sha256', 'de98e321fb50201669eba6899a2181658a244aa675729576943a83924d1fac9f',
        'prs_alpha_default', jsonb_build_object(
          'P', 1.0, 'TRL', 1.0, 'BRL', 0.6, 'GRL', 0.3, 'SRL', 0.2,
          'HRL', 1.1, 'sigma_SU', 1.3, 'FRL', 1.5, 'R_net', 0.8
        )
      ),
      'amd_score_inputs', COALESCE((
        SELECT jsonb_agg(to_jsonb(inputs) ORDER BY inputs.evaluated_at, inputs.created_at, inputs.id)
        FROM public.amd_score_inputs AS inputs
        WHERE inputs.project_id = target_projects.project_id
      ), '[]'::jsonb),
      'amd_score_revisions', COALESCE((
        SELECT jsonb_agg(to_jsonb(revisions) ORDER BY revisions.revised_at, revisions.revision_id)
        FROM public.amd_score_revisions AS revisions
        WHERE revisions.project_id = target_projects.project_id
      ), '[]'::jsonb),
      'amd_score_alpha_proposals', COALESCE((
        SELECT jsonb_agg(to_jsonb(proposals) ORDER BY proposals.created_at, proposals.proposal_id)
        FROM public.amd_score_alpha_proposals AS proposals
        WHERE proposals.proposal_id IN (
          SELECT revisions.alpha_proposal_id
          FROM public.amd_score_revisions AS revisions
          WHERE revisions.project_id = target_projects.project_id
            AND revisions.alpha_proposal_id IS NOT NULL
        )
      ), '[]'::jsonb),
      'bzm_2_model_revisions', COALESCE((
        SELECT jsonb_agg(to_jsonb(revisions) ORDER BY revisions.revision_order, revisions.created_at)
        FROM public.bzm_2_model_revisions AS revisions
        WHERE revisions.project_id = target_projects.project_id
      ), '[]'::jsonb),
      'bzm_2_parameter_observations', COALESCE((
        SELECT jsonb_agg(to_jsonb(observations) ORDER BY revisions.revision_order, observations.sort_order, observations.parameter_key)
        FROM public.bzm_2_model_revisions AS revisions
        JOIN public.bzm_2_parameter_observations AS observations
          ON observations.revision_id = revisions.revision_id
        WHERE revisions.project_id = target_projects.project_id
      ), '[]'::jsonb),
      'amd_score_alpha', COALESCE((
        SELECT jsonb_agg(to_jsonb(alpha) ORDER BY alpha.effective_from, alpha.created_at)
        FROM public.amd_score_alpha AS alpha
      ), '[]'::jsonb)
    ) AS payload_json,
    jsonb_build_object(
      'amd_score_inputs', (SELECT count(*) FROM public.amd_score_inputs AS inputs WHERE inputs.project_id = target_projects.project_id),
      'amd_score_revisions', (SELECT count(*) FROM public.amd_score_revisions AS revisions WHERE revisions.project_id = target_projects.project_id),
      'amd_score_alpha_proposals', (
        SELECT count(*)
        FROM public.amd_score_alpha_proposals AS proposals
        WHERE proposals.proposal_id IN (
          SELECT revisions.alpha_proposal_id
          FROM public.amd_score_revisions AS revisions
          WHERE revisions.project_id = target_projects.project_id
            AND revisions.alpha_proposal_id IS NOT NULL
        )
      ),
      'bzm_2_model_revisions', (SELECT count(*) FROM public.bzm_2_model_revisions AS revisions WHERE revisions.project_id = target_projects.project_id),
      'bzm_2_parameter_observations', (
        SELECT count(*)
        FROM public.bzm_2_model_revisions AS revisions
        JOIN public.bzm_2_parameter_observations AS observations
          ON observations.revision_id = revisions.revision_id
        WHERE revisions.project_id = target_projects.project_id
      ),
      'amd_score_alpha', (SELECT count(*) FROM public.amd_score_alpha)
    ) AS source_counts_json
  FROM target_projects
)
INSERT INTO public.sps_legacy_archives (
  project_id,
  snapshot_key,
  snapshot_at,
  source_cutoff,
  source_counts_json,
  payload_json,
  payload_hash,
  archive_reason
)
SELECT
  project_payloads.project_id,
  'pre-sps-2-1-estimated-v0-1',
  statement_timestamp(),
  statement_timestamp(),
  project_payloads.source_counts_json,
  project_payloads.payload_json,
  encode(extensions.digest(project_payloads.payload_json::text, 'sha256'), 'hex'),
  '現行SPSをSPS 2.1の主表示へ切り替える前の復元用snapshot。元テーブルは変更しない'
FROM project_payloads
ON CONFLICT (project_id, snapshot_key) DO NOTHING;

INSERT INTO public.sps_primary_model_registry (
  project_id,
  primary_model,
  switch_status,
  legacy_archive_id,
  active_bzm_2_1_revision_id,
  switched_at,
  switched_by,
  rollback_note
)
SELECT
  archives.project_id,
  'legacy_sps',
  'preparing',
  archives.archive_id,
  NULL,
  NULL,
  'えいみ / BZM 2.1 extraction pipeline',
  '元テーブルは変更しない。rollbackは12PJを単一transactionでlegacy_spsへ戻し、理由と実行者を記録する'
FROM public.sps_legacy_archives AS archives
WHERE archives.snapshot_key = 'pre-sps-2-1-estimated-v0-1'
  AND archives.project_id IN (
    'p03', 'p04', 'p06', 'p07', 'p09', 'p11',
    'p18', 'p20', 'p21', 'p24', 'p26', 'p29'
  )
ON CONFLICT (project_id) DO NOTHING;

REVOKE ALL ON public.sps_legacy_archives FROM anon, authenticated, service_role;
GRANT SELECT ON public.sps_legacy_archives TO authenticated;
GRANT SELECT, INSERT ON public.sps_legacy_archives TO service_role;

REVOKE ALL ON public.sps_primary_model_registry FROM anon, authenticated, service_role;
GRANT SELECT ON public.sps_primary_model_registry TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sps_primary_model_registry TO service_role;

DO $$
DECLARE
  archive_count integer;
  registry_count integer;
  registry_state_count integer;
  archive_integrity_count integer;
BEGIN
  SELECT count(*) INTO archive_count
  FROM public.sps_legacy_archives
  WHERE snapshot_key = 'pre-sps-2-1-estimated-v0-1'
    AND project_id IN (
      'p03', 'p04', 'p06', 'p07', 'p09', 'p11',
      'p18', 'p20', 'p21', 'p24', 'p26', 'p29'
    );

  SELECT count(*) INTO registry_count
  FROM public.sps_primary_model_registry AS registry
  JOIN public.sps_legacy_archives AS archives
    ON archives.archive_id = registry.legacy_archive_id
   AND archives.project_id = registry.project_id
   AND archives.snapshot_key = 'pre-sps-2-1-estimated-v0-1'
  WHERE registry.project_id IN (
      'p03', 'p04', 'p06', 'p07', 'p09', 'p11',
      'p18', 'p20', 'p21', 'p24', 'p26', 'p29'
    )
    AND (
      (
        primary_model = 'legacy_sps'
        AND switch_status = 'preparing'
        AND active_bzm_2_1_revision_id IS NULL
      )
      OR (
        primary_model = 'sps_2_1'
        AND switch_status = 'active'
        AND active_bzm_2_1_revision_id IS NOT NULL
        AND switched_at IS NOT NULL
      )
      OR (
        primary_model = 'legacy_sps'
        AND switch_status = 'rolled_back'
      )
    );

  SELECT count(DISTINCT (primary_model, switch_status)) INTO registry_state_count
  FROM public.sps_primary_model_registry
  WHERE project_id IN (
    'p03', 'p04', 'p06', 'p07', 'p09', 'p11',
    'p18', 'p20', 'p21', 'p24', 'p26', 'p29'
  );

  SELECT count(*) INTO archive_integrity_count
  FROM public.sps_legacy_archives AS archives
  WHERE archives.snapshot_key = 'pre-sps-2-1-estimated-v0-1'
    AND archives.project_id IN (
      'p03', 'p04', 'p06', 'p07', 'p09', 'p11',
      'p18', 'p20', 'p21', 'p24', 'p26', 'p29'
    )
    AND archives.payload_hash = encode(extensions.digest(archives.payload_json::text, 'sha256'), 'hex')
    AND archives.payload_json ->> 'schema' = 'sps-legacy-archive-v1'
    AND archives.payload_json ->> 'project_id' = archives.project_id
    AND archives.payload_json ->> 'restore_only' = 'true'
    AND archives.payload_json ->> 'eligible_as_bzm_2_1_evidence' = 'false'
    AND (archives.source_counts_json ->> 'amd_score_inputs')::integer = jsonb_array_length(archives.payload_json -> 'amd_score_inputs')
    AND (archives.source_counts_json ->> 'amd_score_revisions')::integer = jsonb_array_length(archives.payload_json -> 'amd_score_revisions')
    AND (archives.source_counts_json ->> 'amd_score_alpha_proposals')::integer = jsonb_array_length(archives.payload_json -> 'amd_score_alpha_proposals')
    AND (archives.source_counts_json ->> 'bzm_2_model_revisions')::integer = jsonb_array_length(archives.payload_json -> 'bzm_2_model_revisions')
    AND (archives.source_counts_json ->> 'bzm_2_parameter_observations')::integer = jsonb_array_length(archives.payload_json -> 'bzm_2_parameter_observations')
    AND (archives.source_counts_json ->> 'amd_score_alpha')::integer = jsonb_array_length(archives.payload_json -> 'amd_score_alpha');

  IF archive_count <> 12 THEN
    RAISE EXCEPTION 'SPS legacy archive closure failed: expected 12 rows, got %', archive_count;
  END IF;
  IF registry_count <> 12 THEN
    RAISE EXCEPTION 'SPS primary registry closure failed: expected 12 valid rows, got %', registry_count;
  END IF;
  IF registry_state_count <> 1 THEN
    RAISE EXCEPTION 'SPS primary registry must move atomically: found % distinct primary/status states', registry_state_count;
  END IF;
  IF archive_integrity_count <> 12 THEN
    RAISE EXCEPTION 'SPS legacy archive integrity closure failed: expected 12 rows, got %', archive_integrity_count;
  END IF;
END $$;

COMMIT;
