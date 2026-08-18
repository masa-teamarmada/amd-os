-- EHM data correction:
-- 1. 2026-08-18 Notion MTGで確認した澤崎シーズのNEDO NEP開拓コース採択を補助金履歴へ登録する。
-- 2. 正式PJ化済みのp30 EHMをactiveへ移し、active PJだけを読む左ナビ候補へ出す。

DO $$
DECLARE
  v_seed_id uuid;
BEGIN
  SELECT id INTO v_seed_id
  FROM seeds
  WHERE title = '植物種子による高価値タンパク質・ラビット抗体の低コスト生産';

  IF v_seed_id IS NULL THEN
    RAISE EXCEPTION '澤崎シーズが存在しない';
  END IF;

  IF (SELECT count(*) FROM seeds WHERE title = '植物種子による高価値タンパク質・ラビット抗体の低コスト生産') <> 1 THEN
    RAISE EXCEPTION '澤崎シーズが一意でない';
  END IF;

  INSERT INTO seed_funding (
    seed_id,
    program,
    program_short,
    fiscal_year,
    status,
    source_url,
    notes
  )
  SELECT
    v_seed_id,
    'NEDO NEP 開拓コース',
    'NEDO NEP',
    NULL,
    'awarded',
    'https://app.notion.com/p/3c097749c60881c4b526ef8b5978d905',
    '2026-08-18 Notion MTG要約でNEP採択済みと記録され、書き起こしで本人がNEP開拓コースへの参加を説明。採択年度・金額・実施期間は未確認。'
  WHERE NOT EXISTS (
    SELECT 1
    FROM seed_funding
    WHERE seed_id = v_seed_id
      AND program = 'NEDO NEP 開拓コース'
  );

  UPDATE seed_funding
  SET
    program_short = COALESCE(program_short, 'NEDO NEP'),
    status = 'awarded',
    source_url = COALESCE(source_url, 'https://app.notion.com/p/3c097749c60881c4b526ef8b5978d905'),
    notes = COALESCE(notes, '2026-08-18 Notion MTG要約でNEP採択済みと記録され、書き起こしで本人がNEP開拓コースへの参加を説明。採択年度・金額・実施期間は未確認。'),
    updated_at = now()
  WHERE seed_id = v_seed_id
    AND program = 'NEDO NEP 開拓コース';

  IF (
    SELECT count(*)
    FROM seed_funding
    WHERE seed_id = v_seed_id
      AND program = 'NEDO NEP 開拓コース'
      AND status = 'awarded'
  ) <> 1 THEN
    RAISE EXCEPTION '澤崎シーズのNEP開拓コース採択履歴が一意に登録されていない';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM institution_projects
    WHERE project_id = 'p30'
      AND institution_id = 'inst_ehime'
      AND engagement_scope = 'university_wide'
  ) THEN
    RAISE EXCEPTION 'p30が愛媛大学全体PJとして登録されていない';
  END IF;

  UPDATE projects
  SET
    status = 'active',
    updated_at = now()
  WHERE project_id = 'p30';

  IF NOT EXISTS (
    SELECT 1
    FROM projects
    WHERE project_id = 'p30'
      AND project_name = 'EHM'
      AND project_category = 'ecosystem'
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'p30 EHMのactive化に失敗';
  END IF;
END $$;
