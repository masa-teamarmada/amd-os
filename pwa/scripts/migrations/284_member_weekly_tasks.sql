-- 284: マイページの手動週次タスク。D-10 の member_activities は根拠ログのまま保持する。
BEGIN;

CREATE TABLE IF NOT EXISTS public.member_weekly_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id text NOT NULL REFERENCES public.members(member_id) ON DELETE CASCADE,
  project_id text REFERENCES public.projects(project_id) ON DELETE SET NULL,
  week_start date NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  completed_at timestamptz,
  source text NOT NULL DEFAULT 'manual',
  carried_from_task_id uuid REFERENCES public.member_weekly_tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (EXTRACT(ISODOW FROM week_start) = 1),
  CHECK (char_length(btrim(title)) BETWEEN 1 AND 240),
  CHECK (status IN ('open', 'completed')),
  CHECK (source IN ('manual', 'carryover')),
  CHECK (
    (status = 'open' AND completed_at IS NULL)
    OR (status = 'completed' AND completed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS member_weekly_tasks_member_week_idx
  ON public.member_weekly_tasks(member_id, week_start, status);

-- 同じ元タスクは同じ週へ一度しか繰越さない。翌々週以降は前週の繰越行を親にする。
CREATE UNIQUE INDEX IF NOT EXISTS member_weekly_tasks_rollover_once_idx
  ON public.member_weekly_tasks(member_id, week_start, carried_from_task_id)
  WHERE carried_from_task_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_member_weekly_task_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_weekly_tasks_set_updated_at ON public.member_weekly_tasks;
CREATE TRIGGER member_weekly_tasks_set_updated_at
  BEFORE UPDATE ON public.member_weekly_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_member_weekly_task_updated_at();

CREATE OR REPLACE FUNCTION public.rollover_member_weekly_tasks(
  target_member_id text,
  target_week_start date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer;
BEGIN
  IF EXTRACT(ISODOW FROM target_week_start) <> 1 THEN
    RAISE EXCEPTION 'target_week_start must be a Monday';
  END IF;

  INSERT INTO public.member_weekly_tasks (
    member_id,
    project_id,
    week_start,
    title,
    status,
    completed_at,
    source,
    carried_from_task_id
  )
  SELECT
    previous.member_id,
    previous.project_id,
    target_week_start,
    previous.title,
    'open',
    NULL,
    'carryover',
    previous.id
  FROM public.member_weekly_tasks AS previous
  WHERE previous.member_id = target_member_id
    AND previous.week_start = target_week_start - 7
    AND previous.status = 'open'
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

ALTER TABLE public.member_weekly_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_weekly_tasks FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_weekly_tasks TO service_role;
REVOKE ALL ON FUNCTION public.rollover_member_weekly_tasks(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rollover_member_weekly_tasks(text, date) TO service_role;

COMMENT ON TABLE public.member_weekly_tasks IS
  'マイページの手動週次タスク正本。member_activities(source=member_weekly)の抽出済み活動根拠とは分離する。未完了は週をまたいでも元週を残し、翌週へ一度だけ繰越す。';
COMMENT ON COLUMN public.member_weekly_tasks.carried_from_task_id IS
  '直前週で未完了だった繰越元タスク。member_id + week_startとの部分ユニーク制約で二重繰越を防ぐ。';
COMMENT ON FUNCTION public.rollover_member_weekly_tasks(text, date) IS
  '対象週の開始時に、直前週の未完了手動タスクだけを同じメンバーの対象週へ一度だけ繰越す。service_role API専用。';

COMMIT;
