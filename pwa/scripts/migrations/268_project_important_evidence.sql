-- 268_project_important_evidence.sql
-- 決算書に限定しない、5生データ由来の承認済み重要情報の原本索引。
-- raw本文は保存せず、候補→通知採否→非LLM applier の境界を維持する。

BEGIN;

CREATE TABLE IF NOT EXISTS public.project_important_evidence (
  important_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  source_gap_id text NOT NULL REFERENCES public.l2_coverage_gaps(gap_id),
  source text NOT NULL,
  source_ref text NOT NULL,
  source_hash text NOT NULL,
  content_sha256 text NOT NULL,
  material_kind text NOT NULL,
  document_class text NOT NULL,
  title text NOT NULL,
  mime_type text,
  importance_json jsonb NOT NULL,
  ownership_json jsonb NOT NULL,
  effective_period_start date,
  effective_period_end date,
  balance_sheet_date date,
  audited boolean NOT NULL DEFAULT false,
  audit_opinion text NOT NULL DEFAULT 'unknown',
  audit_signed_on date,
  canonical_source_ref text NOT NULL,
  lineage_json jsonb NOT NULL,
  version_family_key text NOT NULL,
  version_rank integer NOT NULL,
  version_state text NOT NULL,
  facts_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  due_items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  proposed_targets_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  bzm_input_candidates_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_fields_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  text_read_required boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'confirmed',
  confirmed_by text NOT NULL,
  confirmed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_important_evidence_gap_uniq UNIQUE (source_gap_id),
  CONSTRAINT project_important_evidence_content_uniq UNIQUE (project_id, content_sha256),
  CONSTRAINT project_important_evidence_source_hash_uniq UNIQUE (source_hash),
  CONSTRAINT project_important_evidence_sha256_check CHECK (
    content_sha256 ~ '^[0-9a-f]{64}$' AND source_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT project_important_evidence_source_check CHECK (
    source IN ('gmail', 'drive', 'calendar', 'slack', 'notion')
  ),
  CONSTRAINT project_important_evidence_kind_check CHECK (
    material_kind IN ('document', 'message', 'event', 'thread', 'page')
  ),
  CONSTRAINT project_important_evidence_period_check CHECK (
    effective_period_start IS NULL OR effective_period_end IS NULL OR effective_period_start <= effective_period_end
  ),
  CONSTRAINT project_important_evidence_audit_check CHECK (
    audit_opinion IN ('unqualified', 'other', 'unknown')
  ),
  CONSTRAINT project_important_evidence_version_check CHECK (
    version_rank > 0 AND version_state IN ('canonical_candidate', 'superseded_candidate')
  ),
  CONSTRAINT project_important_evidence_status_check CHECK (
    status IN ('confirmed', 'archived')
  ),
  CONSTRAINT project_important_evidence_json_check CHECK (
    jsonb_typeof(importance_json) = 'object'
    AND jsonb_typeof(importance_json->'categories') = 'array'
    AND jsonb_array_length(importance_json->'categories') > 0
    AND jsonb_typeof(ownership_json) = 'object'
    AND jsonb_typeof(lineage_json) = 'array'
    AND jsonb_array_length(lineage_json) > 0
    AND jsonb_typeof(facts_json) = 'array'
    AND jsonb_typeof(due_items_json) = 'array'
    AND jsonb_typeof(proposed_targets_json) = 'array'
    AND jsonb_typeof(bzm_input_candidates_json) = 'array'
    AND jsonb_typeof(missing_fields_json) = 'array'
  ),
  CONSTRAINT project_important_evidence_nonempty_check CHECK (
    btrim(source_ref) <> ''
    AND btrim(document_class) <> ''
    AND btrim(title) <> ''
    AND btrim(canonical_source_ref) <> ''
    AND btrim(version_family_key) <> ''
    AND btrim(confirmed_by) <> ''
  )
);

CREATE INDEX IF NOT EXISTS project_important_evidence_project_created_idx
  ON public.project_important_evidence(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS project_important_evidence_family_version_idx
  ON public.project_important_evidence(version_family_key, version_rank, created_at DESC);
CREATE INDEX IF NOT EXISTS project_important_evidence_due_idx
  ON public.project_important_evidence USING gin(due_items_json);

COMMENT ON TABLE public.project_important_evidence IS
  '5生データから承認された重要情報。PDF/Office/Google文書/メッセージ等を内容hashで束ね、raw本文なしでlineageとfield provenanceを保持する';
COMMENT ON COLUMN public.project_important_evidence.text_read_required IS
  'trueは本文を0扱いせず、OCRまたは形式変換が未完であることを明示する';
COMMENT ON COLUMN public.project_important_evidence.bzm_input_candidates_json IS
  '財務候補だけが持つBZM次版入力候補。現行revisionを直接更新しない';

CREATE OR REPLACE FUNCTION public.guard_project_important_evidence_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF ROW(
    NEW.project_id, NEW.source_gap_id, NEW.source, NEW.source_ref, NEW.source_hash,
    NEW.content_sha256, NEW.material_kind, NEW.document_class, NEW.title, NEW.mime_type,
    NEW.importance_json, NEW.ownership_json, NEW.effective_period_start, NEW.effective_period_end,
    NEW.balance_sheet_date, NEW.audited, NEW.audit_opinion, NEW.audit_signed_on,
    NEW.canonical_source_ref, NEW.lineage_json, NEW.version_family_key, NEW.version_rank,
    NEW.version_state, NEW.facts_json, NEW.due_items_json, NEW.proposed_targets_json,
    NEW.bzm_input_candidates_json, NEW.missing_fields_json, NEW.text_read_required,
    NEW.confirmed_by, NEW.confirmed_at
  ) IS DISTINCT FROM ROW(
    OLD.project_id, OLD.source_gap_id, OLD.source, OLD.source_ref, OLD.source_hash,
    OLD.content_sha256, OLD.material_kind, OLD.document_class, OLD.title, OLD.mime_type,
    OLD.importance_json, OLD.ownership_json, OLD.effective_period_start, OLD.effective_period_end,
    OLD.balance_sheet_date, OLD.audited, OLD.audit_opinion, OLD.audit_signed_on,
    OLD.canonical_source_ref, OLD.lineage_json, OLD.version_family_key, OLD.version_rank,
    OLD.version_state, OLD.facts_json, OLD.due_items_json, OLD.proposed_targets_json,
    OLD.bzm_input_candidates_json, OLD.missing_fields_json, OLD.text_read_required,
    OLD.confirmed_by, OLD.confirmed_at
  ) THEN
    RAISE EXCEPTION 'project_important_evidence is immutable; insert a new content version';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS project_important_evidence_immutable ON public.project_important_evidence;
CREATE TRIGGER project_important_evidence_immutable
  BEFORE UPDATE ON public.project_important_evidence
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_important_evidence_immutable();

ALTER TABLE public.project_important_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_important_evidence_member_read" ON public.project_important_evidence;
CREATE POLICY "project_important_evidence_member_read"
  ON public.project_important_evidence FOR SELECT TO authenticated
  USING (public.amd_os_can_access_project(project_id));

DROP POLICY IF EXISTS "project_important_evidence_service" ON public.project_important_evidence;
CREATE POLICY "project_important_evidence_service"
  ON public.project_important_evidence FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;
