-- 079_cleanup_jc_duplicates.sql
--
-- まさ訂正 (2026-05-22) を踏まえた最終 cleanup:
--  - 「野田先生」 = 「野田」と同一人物。重複表記を invalid。
--  - 「赤津」 = source documents に実在しない誤抽出 (本来「赤土」)。invalid。
--
-- 中期 TODO: cron founding-members-extract に l2_feedbacks 注入機能を追加し、
-- /notifications で「いいえ」を押した名前は次回プロンプトに「過去に却下された」として
-- 渡すことで LLM の再生成を抑制する。

UPDATE project_founding_members
   SET status='invalid',
       notes=COALESCE(notes, '') || ' / [2026-05-22] 「野田」と同一人物の重複表記のため invalid',
       updated_at=now()
 WHERE project_id='p09'
   AND person_name='野田先生'
   AND status IN ('active','tentative');

UPDATE project_founding_members
   SET status='invalid',
       notes=COALESCE(notes, '') || ' / [2026-05-22] source に実在しない誤抽出 (本来「赤土」) のため invalid',
       updated_at=now()
 WHERE project_id='p09'
   AND person_name='赤津'
   AND status IN ('active','tentative');
