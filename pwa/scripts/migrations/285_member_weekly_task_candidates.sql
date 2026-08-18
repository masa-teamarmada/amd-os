-- 285: 来週の confirmed action_items を候補として取り込み、明示追加後だけ週次タスクへ保存する。
BEGIN;

ALTER TABLE public.member_weekly_tasks
  ADD COLUMN IF NOT EXISTS candidate_key text;

ALTER TABLE public.member_weekly_tasks
  DROP CONSTRAINT IF EXISTS member_weekly_tasks_source_check;

ALTER TABLE public.member_weekly_tasks
  ADD CONSTRAINT member_weekly_tasks_source_check
  CHECK (source IN ('manual', 'carryover', 'action_item'));

ALTER TABLE public.member_weekly_tasks
  ADD CONSTRAINT member_weekly_tasks_candidate_key_check
  CHECK (candidate_key IS NULL OR char_length(btrim(candidate_key)) BETWEEN 1 AND 600);

-- 同じ confirmed action_items の候補を、同じ本人・週へ二重追加しない。
CREATE UNIQUE INDEX IF NOT EXISTS member_weekly_tasks_candidate_once_idx
  ON public.member_weekly_tasks(member_id, week_start, candidate_key)
  WHERE candidate_key IS NOT NULL;

COMMENT ON COLUMN public.member_weekly_tasks.candidate_key IS
  'action_items から提示した来週候補の識別子。候補表示だけでは行を作らず、本人の明示追加後だけ保存する。';
COMMENT ON CONSTRAINT member_weekly_tasks_source_check ON public.member_weekly_tasks IS
  'manual=本人入力、carryover=前週未完了の繰越、action_item=本人が確認して取り込んだ confirmed 要対応。';

COMMIT;
