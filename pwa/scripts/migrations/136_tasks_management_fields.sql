-- 136_tasks_management_fields.sql
--
-- OSタスク管理ページ (`/tasks`) 用に、既存 `tasks` カンバンテーブルを
-- 非破壊で拡張する。既存 cockpit kanban は task_id/title/status/assignee/priority
-- を読み続けるため、既存列の意味は変えない。

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assignee_member_id text REFERENCES public.members(member_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS progress int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_task_id text REFERENCES public.tasks(task_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mindmap_x numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mindmap_y numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active bool NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS task_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS updated_by text,
  ADD COLUMN IF NOT EXISTS position_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_progress_range'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_progress_range CHECK (progress >= 0 AND progress <= 100);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_project_active_status
  ON public.tasks(project_id, active, status);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_member
  ON public.tasks(assignee_member_id);

CREATE INDEX IF NOT EXISTS idx_tasks_parent_task
  ON public.tasks(parent_task_id);

CREATE INDEX IF NOT EXISTS idx_tasks_dates
  ON public.tasks(start_date, due_date);

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_authenticated_read ON public.tasks;
CREATE POLICY tasks_authenticated_read
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS tasks_admin_all ON public.tasks;
CREATE POLICY tasks_admin_all
  ON public.tasks
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS tasks_service_role_all ON public.tasks;
CREATE POLICY tasks_service_role_all
  ON public.tasks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
