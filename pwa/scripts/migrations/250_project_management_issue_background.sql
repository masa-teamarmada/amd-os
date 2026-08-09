-- 250: 議論ログとは別に、論点が発生した背景・前提をワークベンチへ固定表示する。

ALTER TABLE public.project_management_issues
  ADD COLUMN IF NOT EXISTS background text;

COMMENT ON COLUMN public.project_management_issues.background IS
  'Context and assumptions that explain why the issue exists. Kept separate from append-only discussion progress.';
