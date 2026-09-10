-- 20260910190000_question_tree_proposals.sql
-- つくよみが議事録から拾った問い・やること・分かったことを、人が確認するまで
-- 「提案」として区別して持つ。勝手に木へつながず、親の候補だけを添える。
-- 正本: pwa/spec/3-21-question-tree-current-spec.md

BEGIN;

ALTER TABLE public.project_questions
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'accepted'
    CHECK (review_state IN ('proposed', 'accepted')),
  ADD COLUMN IF NOT EXISTS proposed_parent_id uuid REFERENCES public.project_questions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proposed_contribution text
    CHECK (proposed_contribution IN ('required', 'alternative')),
  ADD COLUMN IF NOT EXISTS proposal_reason text;

ALTER TABLE public.project_actions
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'accepted'
    CHECK (review_state IN ('proposed', 'accepted')),
  ADD COLUMN IF NOT EXISTS proposed_question_id uuid REFERENCES public.project_questions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proposal_reason text;

ALTER TABLE public.project_findings
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'accepted'
    CHECK (review_state IN ('proposed', 'accepted')),
  ADD COLUMN IF NOT EXISTS proposed_question_id uuid REFERENCES public.project_questions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proposal_reason text;

COMMENT ON COLUMN public.project_questions.review_state IS
  'proposed = つくよみが拾ったまま人が見ていない / accepted = 人が確認した。手入力は最初から accepted。';
COMMENT ON COLUMN public.project_questions.proposed_parent_id IS
  'つくよみが推定した親。人が承認するまで parent_id へは入れない。';
COMMENT ON COLUMN public.project_actions.proposed_question_id IS
  'つくよみが推定した、このやることが答えを出す問い。承認で project_question_actions へ入る。';

CREATE INDEX IF NOT EXISTS project_questions_review_idx
  ON public.project_questions (project_id, review_state)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS project_actions_review_idx
  ON public.project_actions (project_id, review_state)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS project_findings_review_idx
  ON public.project_findings (project_id, review_state)
  WHERE deleted_at IS NULL;

COMMIT;
