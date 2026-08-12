-- 266_project_important_documents.sql
--
-- 株主総会・取締役会・計算書類など、正式性が高い重要書類の承認済み正本。
-- raw本文は保存せず、候補抽出時のcontent hash・全所在lineage・field provenanceを保持する。
-- LLM/collectorはこの表へ直接書かず、l2_coverage_gaps candidateを通知で採用した時だけ
-- notifications/feedback の非LLM routeが1行追加する。

BEGIN;

CREATE TABLE IF NOT EXISTS public.project_important_documents (
  important_document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  source_gap_id text NOT NULL REFERENCES public.l2_coverage_gaps(gap_id),
  source_hash text NOT NULL,
  content_sha256 text NOT NULL,
  document_class text NOT NULL,
  document_title text NOT NULL,
  company_name text NOT NULL,
  mime_type text NOT NULL,
  reporting_period_start date NOT NULL,
  reporting_period_end date NOT NULL,
  balance_sheet_date date,
  audited boolean NOT NULL DEFAULT false,
  audit_opinion text NOT NULL DEFAULT 'unknown',
  audit_signed_on date,
  canonical_file_id text NOT NULL,
  lineage_json jsonb NOT NULL,
  version_family_key text NOT NULL,
  version_rank integer NOT NULL,
  version_state text NOT NULL,
  facts_json jsonb NOT NULL,
  bzm_input_candidates_json jsonb NOT NULL,
  missing_fields_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'confirmed',
  confirmed_by text NOT NULL,
  confirmed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_important_documents_gap_uniq UNIQUE (source_gap_id),
  CONSTRAINT project_important_documents_content_uniq UNIQUE (project_id, content_sha256),
  CONSTRAINT project_important_documents_source_hash_uniq UNIQUE (source_hash),
  CONSTRAINT project_important_documents_sha256_check CHECK (
    content_sha256 ~ '^[0-9a-f]{64}$' AND source_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT project_important_documents_period_check CHECK (
    reporting_period_start <= reporting_period_end
  ),
  CONSTRAINT project_important_documents_audit_check CHECK (
    audit_opinion IN ('unqualified', 'other', 'unknown')
  ),
  CONSTRAINT project_important_documents_version_check CHECK (
    version_rank > 0 AND version_state IN ('canonical_candidate', 'superseded_candidate')
  ),
  CONSTRAINT project_important_documents_status_check CHECK (
    status IN ('confirmed', 'archived')
  ),
  CONSTRAINT project_important_documents_json_check CHECK (
    jsonb_typeof(lineage_json) = 'array'
    AND jsonb_array_length(lineage_json) > 0
    AND jsonb_typeof(facts_json) = 'array'
    AND jsonb_array_length(facts_json) > 0
    AND jsonb_typeof(bzm_input_candidates_json) = 'array'
    AND jsonb_typeof(missing_fields_json) = 'array'
  ),
  CONSTRAINT project_important_documents_nonempty_check CHECK (
    btrim(document_class) <> ''
    AND btrim(document_title) <> ''
    AND btrim(company_name) <> ''
    AND btrim(mime_type) <> ''
    AND btrim(canonical_file_id) <> ''
    AND btrim(version_family_key) <> ''
    AND btrim(confirmed_by) <> ''
  )
);

CREATE INDEX IF NOT EXISTS project_important_documents_project_period_idx
  ON public.project_important_documents(project_id, reporting_period_end DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS project_important_documents_family_version_idx
  ON public.project_important_documents(version_family_key, version_rank, created_at DESC);

COMMENT ON TABLE public.project_important_documents IS
  '通知採用済みの重要書類。raw本文は持たず、内容hash・全所在lineage・field provenance・BZM入力候補を追記型で保持する';
COMMENT ON COLUMN public.project_important_documents.bzm_input_candidates_json IS
  'BZM 2.1次版への接続候補。現行revisionを自動上書きせず、observed/calculated/missingと利用規則を保持する';
COMMENT ON COLUMN public.project_important_documents.facts_json IS
  '各値の期間区分、会計扱い、売上/会社価値への算入可否、根拠section/page/hashを持つfield-level provenance';

CREATE OR REPLACE FUNCTION public.guard_project_important_document_evidence_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.source_gap_id IS DISTINCT FROM OLD.source_gap_id
    OR NEW.source_hash IS DISTINCT FROM OLD.source_hash
    OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256
    OR NEW.document_class IS DISTINCT FROM OLD.document_class
    OR NEW.document_title IS DISTINCT FROM OLD.document_title
    OR NEW.company_name IS DISTINCT FROM OLD.company_name
    OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
    OR NEW.reporting_period_start IS DISTINCT FROM OLD.reporting_period_start
    OR NEW.reporting_period_end IS DISTINCT FROM OLD.reporting_period_end
    OR NEW.balance_sheet_date IS DISTINCT FROM OLD.balance_sheet_date
    OR NEW.audited IS DISTINCT FROM OLD.audited
    OR NEW.audit_opinion IS DISTINCT FROM OLD.audit_opinion
    OR NEW.audit_signed_on IS DISTINCT FROM OLD.audit_signed_on
    OR NEW.canonical_file_id IS DISTINCT FROM OLD.canonical_file_id
    OR NEW.lineage_json IS DISTINCT FROM OLD.lineage_json
    OR NEW.version_family_key IS DISTINCT FROM OLD.version_family_key
    OR NEW.version_rank IS DISTINCT FROM OLD.version_rank
    OR NEW.version_state IS DISTINCT FROM OLD.version_state
    OR NEW.facts_json IS DISTINCT FROM OLD.facts_json
    OR NEW.bzm_input_candidates_json IS DISTINCT FROM OLD.bzm_input_candidates_json
    OR NEW.missing_fields_json IS DISTINCT FROM OLD.missing_fields_json
    OR NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by
    OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
  THEN
    RAISE EXCEPTION 'project_important_documents evidence is immutable; insert a new content version';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS project_important_documents_evidence_immutable
  ON public.project_important_documents;
CREATE TRIGGER project_important_documents_evidence_immutable
  BEFORE UPDATE ON public.project_important_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_important_document_evidence_immutable();

ALTER TABLE public.project_important_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_important_documents_member_read" ON public.project_important_documents;
CREATE POLICY "project_important_documents_member_read"
  ON public.project_important_documents FOR SELECT TO authenticated
  USING (public.amd_os_can_access_project(project_id));

DROP POLICY IF EXISTS "project_important_documents_service" ON public.project_important_documents;
CREATE POLICY "project_important_documents_service"
  ON public.project_important_documents FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;
