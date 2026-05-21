-- #7 project_category:
-- 1. dtsu: ordinary deep-tech startup project
-- 2. ecosystem: research-institution startup ecosystem building
-- 3. advisor: Masa joins as outside director / management advisor only

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_category TEXT NOT NULL DEFAULT 'dtsu';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_project_category_check'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_project_category_check
      CHECK (project_category IN ('dtsu', 'ecosystem', 'advisor'));
  END IF;
END $$;

UPDATE public.projects
SET project_category = 'ecosystem'
WHERE project_id = 'p25'
   OR project_name ILIKE '%KUTE%'
   OR client_name ILIKE '%工学院%';

UPDATE public.projects
SET project_category = 'advisor'
WHERE project_id = 'p07'
   OR project_name ILIKE '%LST%';

COMMENT ON COLUMN public.projects.project_category IS
  'AMD OS project category: dtsu, ecosystem, or advisor. Ecosystem projects are excluded from AMD Score.';
