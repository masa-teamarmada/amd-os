-- 20260910172000_question_tree_orphan_fix.sql
-- 移行時、削除済みの成立条件を親に持つ問いが8件（すべてp21）あり、
-- 画面では根に出るのに「必須」の印だけが残っていた。
-- 親を失った子は根へ上げ、印を外す。
-- 正本: pwa/spec/3-21-question-tree-current-spec.md

BEGIN;

UPDATE public.project_questions c
SET parent_id = NULL, contribution = NULL, updated_at = now()
WHERE c.deleted_at IS NULL
  AND c.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.project_questions p
    WHERE p.id = c.parent_id AND p.deleted_at IS NULL
  );

COMMIT;
