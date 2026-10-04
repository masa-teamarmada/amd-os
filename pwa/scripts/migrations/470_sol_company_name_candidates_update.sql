-- SOL（p21）タスク「社名の確認（solvio 案）」の説明の確認結果の行を、追加の代案と新しい資料の置き場所に置き換える（2026-10-04）
--
-- まさの依頼（2026-10-04）: 「もうちょっと他の名前の案も出してほしい」
-- 462 で足した「2026-10-03 確認: …」の行を置き換える。代案は3案から7案へ（Solnio・Solkai・Solrei・Metalga・Phycomine・Aonica・Mundio）。
-- 資料: Drive p21_sol/261004_社名候補の確認/SOL_社名候補の確認_20261004.md（10-03 版は 261003_社名候補solvioの確認/ に残す）
-- 状態（not_started）と期限（2026-10-23）は変えない。社名はまだ決まっていない。

BEGIN;

UPDATE project_management_tasks
SET description = regexp_replace(description, '\n2026-10-03 確認: .*$', '') || $m$
2026-10-03〜04 確認: solvio は採らないことを勧める。第1類（水質浄化剤など）に同じ読みの商標「ソルビオ」が生きていて、国内に同じ名前の会社が2社あり、主なドメインも他者の保有。代案は7案（Solnio・Solkai・Solrei・Metalga・Phycomine・Aonica・Mundio、一次確認済み、弁理士の調査はこれから）。資料: Drive p21_sol/261004_社名候補の確認/$m$,
    updated_by = 'amie',
    updated_at = NOW()
WHERE id = '21000000-2026-4000-9000-000000000018'
  AND project_id = 'p21'
  AND description NOT LIKE '%2026-10-03〜04 確認:%';

DO $chk$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM project_management_tasks
  WHERE id = '21000000-2026-4000-9000-000000000018'
    AND description LIKE '%2026-10-03〜04 確認: solvio は採らないことを勧める%'
    AND description LIKE '%261004_社名候補の確認%'
    AND description NOT LIKE '%2026-10-03 確認:%'
    AND description LIKE '現行の案「SolvioraX」を「solvio」に変える案が出た%';
  IF n <> 1 THEN RAISE EXCEPTION 'task description: expected 1, got %', n; END IF;
END $chk$;

COMMIT;
