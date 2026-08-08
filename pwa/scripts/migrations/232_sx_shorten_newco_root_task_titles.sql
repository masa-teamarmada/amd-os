-- SX weekly-control: keep the nine agreed root-task names compact in the gantt while preserving
-- the original full sentence as the task description shown in the existing detail modal.
-- UUID, schedule, hierarchy and dependencies are deliberately untouched.

BEGIN;

DO $$
DECLARE
  matched_count integer;
  updated_count integer;
  final_count integer;
BEGIN
  WITH expected(id, old_title, short_title) AS (
    VALUES
      ('1823647a-67f7-4274-8ddb-0e9b7cae4523'::uuid, '対象企業と、有償で導入検討するための判断条件を定める', '導入判断条件の定義'),
      ('fdc90bb4-b84f-4095-8772-ac3774ca9449'::uuid, '実排液で判断条件を検証できるPoC装置を完成させる', '実排液PoC装置の完成'),
      ('c1c61414-b365-462e-a9ab-b6dbb6874fd4'::uuid, '実排液で、費用を払う価値がある成果を実証する', '有償価値の実証'),
      ('21c2a6fc-746e-46f4-9a54-6fd2eb4533b9'::uuid, '1社に有償PoCを提案し、条件交渉を完了する', '1社有償PoC条件交渉'),
      ('26786914-db5f-47a9-ae9c-87a35e680441'::uuid, 'ユニットエコノミクスの成立性を検証する', 'ユニットエコノミクス検証'),
      ('b2fc7be2-9591-42b3-a132-4257a79ae8d5'::uuid, 'NewCoの事業実行体制と権利関係を固める', 'NewCo体制・権利確定'),
      ('59d0da31-8f30-4639-b14c-a7b25745d81f'::uuid, '投資判断に耐える事業計画を完成させる', '事業計画の完成'),
      ('5b8bd75d-df8a-4a7c-bee5-aaad79873723'::uuid, '出資候補を絞り、DDを完了する', '出資候補選定・DD'),
      ('504ef913-7f24-4ca6-a580-e957d06c7809'::uuid, '出資条件の交渉を完了する', '出資条件交渉')
  )
  SELECT count(*) INTO matched_count
  FROM expected
  JOIN public.project_management_tasks task ON task.id = expected.id
  WHERE task.project_id = 'p21'
    AND task.deleted_at IS NULL
    AND task.title IN (expected.old_title, expected.short_title);

  IF matched_count <> 9 THEN
    RAISE EXCEPTION
      'SX root-task title migration expected 9 guarded active rows, found %',
      matched_count;
  END IF;

  WITH expected(id, old_title, short_title) AS (
    VALUES
      ('1823647a-67f7-4274-8ddb-0e9b7cae4523'::uuid, '対象企業と、有償で導入検討するための判断条件を定める', '導入判断条件の定義'),
      ('fdc90bb4-b84f-4095-8772-ac3774ca9449'::uuid, '実排液で判断条件を検証できるPoC装置を完成させる', '実排液PoC装置の完成'),
      ('c1c61414-b365-462e-a9ab-b6dbb6874fd4'::uuid, '実排液で、費用を払う価値がある成果を実証する', '有償価値の実証'),
      ('21c2a6fc-746e-46f4-9a54-6fd2eb4533b9'::uuid, '1社に有償PoCを提案し、条件交渉を完了する', '1社有償PoC条件交渉'),
      ('26786914-db5f-47a9-ae9c-87a35e680441'::uuid, 'ユニットエコノミクスの成立性を検証する', 'ユニットエコノミクス検証'),
      ('b2fc7be2-9591-42b3-a132-4257a79ae8d5'::uuid, 'NewCoの事業実行体制と権利関係を固める', 'NewCo体制・権利確定'),
      ('59d0da31-8f30-4639-b14c-a7b25745d81f'::uuid, '投資判断に耐える事業計画を完成させる', '事業計画の完成'),
      ('5b8bd75d-df8a-4a7c-bee5-aaad79873723'::uuid, '出資候補を絞り、DDを完了する', '出資候補選定・DD'),
      ('504ef913-7f24-4ca6-a580-e957d06c7809'::uuid, '出資条件の交渉を完了する', '出資条件交渉')
  )
  UPDATE public.project_management_tasks task
  SET
    title = expected.short_title,
    description = CASE
      WHEN NULLIF(btrim(task.description), '') IS NULL THEN expected.old_title
      ELSE task.description
    END,
    updated_by = 'migration:232_sx_shorten_newco_root_task_titles'
  FROM expected
  WHERE task.id = expected.id
    AND task.project_id = 'p21'
    AND task.deleted_at IS NULL
    AND task.title = expected.old_title;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'SX root-task compact titles: % row(s) updated', updated_count;

  WITH expected(id, short_title) AS (
    VALUES
      ('1823647a-67f7-4274-8ddb-0e9b7cae4523'::uuid, '導入判断条件の定義'),
      ('fdc90bb4-b84f-4095-8772-ac3774ca9449'::uuid, '実排液PoC装置の完成'),
      ('c1c61414-b365-462e-a9ab-b6dbb6874fd4'::uuid, '有償価値の実証'),
      ('21c2a6fc-746e-46f4-9a54-6fd2eb4533b9'::uuid, '1社有償PoC条件交渉'),
      ('26786914-db5f-47a9-ae9c-87a35e680441'::uuid, 'ユニットエコノミクス検証'),
      ('b2fc7be2-9591-42b3-a132-4257a79ae8d5'::uuid, 'NewCo体制・権利確定'),
      ('59d0da31-8f30-4639-b14c-a7b25745d81f'::uuid, '事業計画の完成'),
      ('5b8bd75d-df8a-4a7c-bee5-aaad79873723'::uuid, '出資候補選定・DD'),
      ('504ef913-7f24-4ca6-a580-e957d06c7809'::uuid, '出資条件交渉')
  )
  SELECT count(*) INTO final_count
  FROM expected
  JOIN public.project_management_tasks task
    ON task.id = expected.id AND task.title = expected.short_title
  WHERE task.project_id = 'p21' AND task.deleted_at IS NULL;

  IF final_count <> 9 THEN
    RAISE EXCEPTION
      'SX root-task title migration finished with % compact rows instead of 9',
      final_count;
  END IF;
END $$;

COMMIT;
