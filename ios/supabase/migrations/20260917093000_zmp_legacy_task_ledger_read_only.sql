-- ZMP's execution ledger moved to the goal-tree model on 2026-09-10.
-- Keep the former management tasks as recoverable history, but reject new writes
-- so meeting imports cannot silently split the task list again.

CREATE OR REPLACE FUNCTION public.guard_zmp_legacy_task_ledger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old_project_id text := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.project_id ELSE NULL END;
  v_new_project_id text := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.project_id ELSE NULL END;
BEGIN
  IF v_old_project_id = 'p19' OR v_new_project_id = 'p19' THEN
    RAISE EXCEPTION
      'ZMP task ledger is project_actions; project_management_tasks is read-only history'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_management_tasks_zmp_read_only
  ON public.project_management_tasks;

CREATE TRIGGER project_management_tasks_zmp_read_only
BEFORE INSERT OR UPDATE OR DELETE
ON public.project_management_tasks
FOR EACH ROW
EXECUTE FUNCTION public.guard_zmp_legacy_task_ledger();

COMMENT ON FUNCTION public.guard_zmp_legacy_task_ledger() IS
  'Blocks p19 writes to the retired project_management_tasks ledger. ZMP uses project_actions.';

