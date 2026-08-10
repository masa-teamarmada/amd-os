-- SX weekly-control: provisional schedule backcast from the user's 2027-01-29 NewCo
-- establishment target. The work order follows the 2026-07-22 SX regular-meeting gantt;
-- its previous 2027-04 establishment target is intentionally superseded by the user's
-- current target. Existing manually entered task/MS dates always win over this seed.

BEGIN;

-- The objective still carried the old 2027-03-31 target shown in weekly-control. Fail closed
-- on a concurrent edit: only the exact previous value is eligible for this replacement.
UPDATE public.project_management_objectives
SET
  title = '2027年1月末のNewCo設立ゲート',
  target_date = DATE '2027-01-29',
  date_certainty = 'provisional',
  last_verified_at = DATE '2026-08-05',
  confidence = 'medium',
  source_kind = 'manual',
  source_ref = '2026-08-05 1月末設立目標 / 2026-07-22 SX定例ガント',
  updated_by = 'migration:231_sx_january_founding_backcast_schedule'
WHERE project_id = 'p21'
  AND slug = 'sx-2027-founding'
  AND target_date = DATE '2027-03-31';

WITH schedule(id, expected_title, planned_start, planned_end) AS (
  VALUES
    (
      '1823647a-67f7-4274-8ddb-0e9b7cae4523'::uuid,
      '対象企業と、有償で導入検討するための判断条件を定める',
      DATE '2026-08-05',
      DATE '2026-08-21'
    ),
    (
      'fdc90bb4-b84f-4095-8772-ac3774ca9449'::uuid,
      '実排液で判断条件を検証できるPoC装置を完成させる',
      DATE '2026-08-24',
      DATE '2026-10-16'
    ),
    (
      'c1c61414-b365-462e-a9ab-b6dbb6874fd4'::uuid,
      '実排液で、費用を払う価値がある成果を実証する',
      DATE '2026-10-19',
      DATE '2026-11-20'
    ),
    (
      '21c2a6fc-746e-46f4-9a54-6fd2eb4533b9'::uuid,
      '1社に有償PoCを提案し、条件交渉を完了する',
      DATE '2026-11-24',
      DATE '2026-12-18'
    ),
    (
      '26786914-db5f-47a9-ae9c-87a35e680441'::uuid,
      'ユニットエコノミクスの成立性を検証する',
      DATE '2026-08-05',
      DATE '2026-09-25'
    ),
    (
      'b2fc7be2-9591-42b3-a132-4257a79ae8d5'::uuid,
      'NewCoの事業実行体制と権利関係を固める',
      DATE '2026-08-05',
      DATE '2026-09-25'
    ),
    (
      '59d0da31-8f30-4639-b14c-a7b25745d81f'::uuid,
      '投資判断に耐える事業計画を完成させる',
      DATE '2026-09-28',
      DATE '2026-10-30'
    ),
    (
      '5b8bd75d-df8a-4a7c-bee5-aaad79873723'::uuid,
      '出資候補を絞り、DDを完了する',
      DATE '2026-11-02',
      DATE '2026-12-04'
    ),
    (
      '504ef913-7f24-4ca6-a580-e957d06c7809'::uuid,
      '出資条件の交渉を完了する',
      DATE '2026-12-07',
      DATE '2026-12-18'
    )
)
UPDATE public.project_management_tasks AS task
SET
  planned_start = schedule.planned_start,
  planned_end = schedule.planned_end,
  date_certainty = 'provisional',
  last_verified_at = DATE '2026-08-05',
  confidence = 'medium',
  source_kind = 'manual',
  source_ref = '2026-08-05 1月末設立逆算 / 2026-07-22 SX定例ガント',
  updated_by = 'migration:231_sx_january_founding_backcast_schedule'
FROM schedule
WHERE task.id = schedule.id
  AND task.project_id = 'p21'
  AND task.deleted_at IS NULL
  AND task.title = schedule.expected_title
  AND task.planned_start IS NULL
  AND task.planned_end IS NULL;

-- Both oral agreements must land before the year-end/New Year break so the incorporation
-- process retains about six weeks before 2027-01-29. These remain provisional point MS dates.
UPDATE public.project_management_milestones
SET
  planned_start = DATE '2026-12-18',
  planned_end = DATE '2026-12-18',
  date_certainty = 'provisional',
  last_verified_at = DATE '2026-08-05',
  confidence = 'medium',
  source_kind = 'manual',
  source_ref = '2026-08-05 1月末設立逆算 / 2026-07-22 SX定例ガント',
  updated_by = 'migration:231_sx_january_founding_backcast_schedule'
WHERE project_id = 'p21'
  AND slug IN (
    'business-paid-poc-oral-agreement',
    'funding-investment-oral-agreement'
  )
  AND deleted_at IS NULL
  AND planned_start IS NULL
  AND planned_end IS NULL;

DO $$
DECLARE
  target_date_value date;
  scheduled_task_count integer;
  scheduled_milestone_count integer;
BEGIN
  SELECT target_date
    INTO target_date_value
  FROM public.project_management_objectives
  WHERE project_id = 'p21'
    AND slug = 'sx-2027-founding';

  SELECT count(*)
    INTO scheduled_task_count
  FROM public.project_management_tasks
  WHERE project_id = 'p21'
    AND deleted_at IS NULL
    AND id IN (
      '1823647a-67f7-4274-8ddb-0e9b7cae4523'::uuid,
      'fdc90bb4-b84f-4095-8772-ac3774ca9449'::uuid,
      'c1c61414-b365-462e-a9ab-b6dbb6874fd4'::uuid,
      '21c2a6fc-746e-46f4-9a54-6fd2eb4533b9'::uuid,
      '26786914-db5f-47a9-ae9c-87a35e680441'::uuid,
      'b2fc7be2-9591-42b3-a132-4257a79ae8d5'::uuid,
      '59d0da31-8f30-4639-b14c-a7b25745d81f'::uuid,
      '5b8bd75d-df8a-4a7c-bee5-aaad79873723'::uuid,
      '504ef913-7f24-4ca6-a580-e957d06c7809'::uuid
    )
    AND planned_start IS NOT NULL
    AND planned_end IS NOT NULL
    AND planned_start <= planned_end;

  SELECT count(*)
    INTO scheduled_milestone_count
  FROM public.project_management_milestones
  WHERE project_id = 'p21'
    AND deleted_at IS NULL
    AND slug IN (
      'business-paid-poc-oral-agreement',
      'funding-investment-oral-agreement'
    )
    AND planned_start IS NOT NULL
    AND planned_start = planned_end;

  IF target_date_value <> DATE '2027-01-29' THEN
    RAISE EXCEPTION
      'SX January founding backcast requires objective target 2027-01-29; found %',
      target_date_value;
  END IF;

  IF scheduled_task_count <> 9 OR scheduled_milestone_count <> 2 THEN
    RAISE EXCEPTION
      'SX January founding backcast invalid; scheduled tasks %, scheduled milestones %',
      scheduled_task_count,
      scheduled_milestone_count;
  END IF;
END;
$$;

COMMIT;
