-- 116_textbook_insight_candidate_metadata_gates.sql
--
-- D-7 Textbook Insights Textbook Insights metadata / confidentiality / BZM review gates.
-- 作成のみ。prod 適用は OS 司令塔レビュー後に apply_ddl.py で行う。

ALTER TABLE public.textbook_insight_candidates
  ADD COLUMN IF NOT EXISTS metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS confidentiality text NOT NULL DEFAULT 'internal_only'
    CHECK (confidentiality IN ('internal_only', 'sanitized', 'publishable')),
  ADD COLUMN IF NOT EXISTS bzm_review_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bzm_review_status text NOT NULL DEFAULT 'not_required'
    CHECK (bzm_review_status IN ('not_required', 'pending', 'approved', 'changes_requested', 'rejected')),
  ADD COLUMN IF NOT EXISTS theory_change_scope text NOT NULL DEFAULT 'none'
    CHECK (theory_change_scope IN ('none', 'terminology', 'axis_definition', 'rubric', 'formula', 'weight', 'chapter_structure'));

CREATE INDEX IF NOT EXISTS idx_textbook_insight_candidates_confidentiality
  ON public.textbook_insight_candidates(confidentiality, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_textbook_insight_candidates_bzm_review
  ON public.textbook_insight_candidates(bzm_review_required, bzm_review_status, status, created_at DESC);

COMMENT ON COLUMN public.textbook_insight_candidates.metadata_json IS
  'D-7 Textbook Insights practice metadata. practice_kind は 7 分類、theory_case_kind は edge_case / update_candidate を保持する。';
COMMENT ON COLUMN public.textbook_insight_candidates.confidentiality IS
  '候補本文と根拠の機密区分。internal_only / sanitized / publishable。BZM 追記時は internal_only を skip する。';
COMMENT ON COLUMN public.textbook_insight_candidates.bzm_review_required IS
  'BZM 理論・用語・rubric・数式・重み・章構成に触れる候補で true。approved になるまで local applier は skip する。';
COMMENT ON COLUMN public.textbook_insight_candidates.bzm_review_status IS
  'BZM review gate の状態。required=true または theory_change_scope!=none の候補は approved が必要。';
COMMENT ON COLUMN public.textbook_insight_candidates.theory_change_scope IS
  'BZM への影響範囲。none 以外は bzm_review_required=true / bzm_review_status=pending を要求する。';
