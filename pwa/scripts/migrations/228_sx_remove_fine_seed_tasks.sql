-- SX weekly-control: retain the two existing NewCo prerequisite MS records, but remove the
-- unstarted fine-grained task checklist that was seeded only to illustrate a possible path.
--
-- These are a known, recoverable visibility change — not a physical delete. The exact source_ref
-- identifies the 12 rows created by migration 215. The status and blank-date guards ensure that
-- only rows still in their original unstarted seed state match this migration.

UPDATE public.project_management_tasks
SET
  deleted_at = now(),
  deleted_by = 'migration:228_sx_remove_fine_seed_tasks'
WHERE project_id = 'p21'
  AND deleted_at IS NULL
  AND source_ref = '2026-08-02 週次管制 設立前提レーン要件'
  AND status = 'unassessed'
  AND planned_start IS NULL
  AND planned_end IS NULL
  AND actual_end IS NULL;
