-- 115_textbook_insight_candidates.sql
--
-- L2 ⑩ Textbook Insights / Before Zero 知見抽出。
-- Supabase 内の既存 L2 / OS データから、BZM 教科書に追記すべき候補を保存する。
-- 通知で admin が承認した後、local applier が git 管理の pwa/bzm/*.md へ追記する。
-- Vercel runtime から repo file / git commit を直接書かない。

CREATE TABLE IF NOT EXISTS public.textbook_insight_candidates (
  candidate_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id          TEXT NOT NULL DEFAULT 'p00',
  ym                 TEXT,
  scope_key          TEXT NOT NULL,
  topic              TEXT NOT NULL,
  title              TEXT NOT NULL,
  proposed_section   TEXT,
  target_bzm_slug    TEXT NOT NULL DEFAULT '8-1-amd-os-operations',
  insight_type       TEXT NOT NULL CHECK (
    insight_type IN (
      'before_zero_knowhow',
      'cross_project_pattern',
      'case_study',
      'theory_evidence'
    )
  ),
  priority           INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 4),
  body_md            TEXT NOT NULL,
  evidence_refs      JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_tables      JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_hash        TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'candidate' CHECK (
    status IN ('candidate', 'approved', 'rejected', 'applied', 'archived')
  ),
  extraction_run_id  TEXT,
  created_by         TEXT NOT NULL DEFAULT 'codex_automation_l10',
  reviewed_by        TEXT,
  review_comment     TEXT,
  reviewed_at        TIMESTAMPTZ,
  applied_file       TEXT,
  applied_commit     TEXT,
  applied_by         TEXT,
  applied_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_textbook_insight_candidates_scope
  ON public.textbook_insight_candidates(target_id, scope_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_textbook_insight_candidates_source_hash
  ON public.textbook_insight_candidates(source_hash);

CREATE INDEX IF NOT EXISTS idx_textbook_insight_candidates_status_priority
  ON public.textbook_insight_candidates(status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_textbook_insight_candidates_target_status
  ON public.textbook_insight_candidates(target_id, status, created_at DESC);

ALTER TABLE public.textbook_insight_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS textbook_insight_candidates_admin_select ON public.textbook_insight_candidates;
CREATE POLICY textbook_insight_candidates_admin_select
  ON public.textbook_insight_candidates
  FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS textbook_insight_candidates_admin_insert ON public.textbook_insight_candidates;
CREATE POLICY textbook_insight_candidates_admin_insert
  ON public.textbook_insight_candidates
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS textbook_insight_candidates_admin_update ON public.textbook_insight_candidates;
CREATE POLICY textbook_insight_candidates_admin_update
  ON public.textbook_insight_candidates
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS textbook_insight_candidates_service_role_all ON public.textbook_insight_candidates;
CREATE POLICY textbook_insight_candidates_service_role_all
  ON public.textbook_insight_candidates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.textbook_insight_candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.textbook_insight_candidates TO service_role;

COMMENT ON TABLE public.textbook_insight_candidates IS
  'L2 ⑩ Textbook Insights。BZM 教科書へ追記すべき Before Zero 知見候補。通知承認後、local applier が pwa/bzm/*.md へ追記する。';
COMMENT ON COLUMN public.textbook_insight_candidates.insight_type IS
  '抽出優先度分類。before_zero_knowhow が最重要、cross_project_pattern / case_study / theory_evidence が後続。';
COMMENT ON COLUMN public.textbook_insight_candidates.target_bzm_slug IS
  '追記候補の BZM 章 slug。Vercel runtime はこの file を直接編集しない。local applier が検証して追記する。';
COMMENT ON COLUMN public.textbook_insight_candidates.evidence_refs IS
  '根拠参照。table / row id / date / short snippet / hash 程度に留め、メール全文・議事録全文・Slack全文を保存しない。';
