-- SOL（p21）タスク「社名の確認（solvio 案）」に確認結果と資料の置き場所を足す（2026-10-03）
--
-- まさの依頼（2026-10-03）: 社名候補「solvio」の綴り・ドメイン・商標・同じ名前の会社を確かめ、
--   終わったら AMD OS のタスク「社名の確認（solvio 案）」の説明に、結論と資料の置き場所を一言足す。
-- 確認の内容: Drive p21_sol/261003_社名候補solvioの確認/SOL_社名候補solvioの確認_20261003.md（J-PlatPat・WIPO・法人番号公表サイト・WHOIS・Web検索）
-- 状態（not_started）と期限（2026-10-23）は変えない。社名はまだ決まっていない。

BEGIN;

UPDATE project_management_tasks
SET description = description || $m$
2026-10-03 確認: solvio は採らないことを勧める。第1類（水質浄化剤など）に同じ読みの商標「ソルビオ」が生きていて、国内に同じ名前の会社が2社あり、主なドメインも他者の保有。代案は Solnio・Solrei・Aonica（一次確認済み、弁理士の調査はこれから）。資料: Drive p21_sol/261003_社名候補solvioの確認/$m$,
    updated_by = 'amie',
    updated_at = NOW()
WHERE id = '21000000-2026-4000-9000-000000000018'
  AND project_id = 'p21'
  AND description NOT LIKE '%2026-10-03 確認: solvio%';

DO $chk$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM project_management_tasks
  WHERE id = '21000000-2026-4000-9000-000000000018' AND description LIKE '%2026-10-03 確認: solvio は採らないことを勧める%' AND description LIKE '%261003_社名候補solvioの確認%';
  IF n <> 1 THEN RAISE EXCEPTION 'task description: expected 1, got %', n; END IF;
END $chk$;

COMMIT;
