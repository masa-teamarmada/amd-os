-- The structured trademark-scope question now sits under OkuDoor system.
-- Retire the older duplicate root while preserving it as recoverable history.

BEGIN;

UPDATE public.project_questions
SET deleted_at = now(), deleted_by = 'ID001',
    last_verified_at = DATE '2026-09-16',
    updated_by = 'ID001', updated_at = now(), version = version + 1
WHERE id = '182d29c4-bcee-4bba-bfab-f3733f4d49f8'
  AND project_id = 'p19'
  AND deleted_at IS NULL;

DO $$
DECLARE
  duplicate_count integer;
  canonical_count integer;
BEGIN
  SELECT count(*) INTO duplicate_count
  FROM public.project_questions
  WHERE id = '182d29c4-bcee-4bba-bfab-f3733f4d49f8'
    AND deleted_at IS NULL;
  IF duplicate_count <> 0 THEN
    RAISE EXCEPTION 'duplicate trademark root remains active';
  END IF;

  SELECT count(*) INTO canonical_count
  FROM public.project_questions
  WHERE id = '19000000-2026-4000-8000-000000002441'
    AND parent_id = '19000000-2026-4000-8000-000000009106'
    AND deleted_at IS NULL;
  IF canonical_count <> 1 THEN
    RAISE EXCEPTION 'canonical trademark question is not under OkuDoor system';
  END IF;
END $$;

COMMIT;
