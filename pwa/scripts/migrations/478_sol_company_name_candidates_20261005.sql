-- SOL（p21）タスク「社名の確認（solvio 案）」の説明の確認結果の行を、10-05 の案と新しい資料の場所に置き換える（2026-10-05）
--
-- まさの依頼（2026-10-05）: 「全部の方向で、もっともっと広げて出して」（道後温泉・松山ゆかり・水の神様・熟田津・白鷺伝説・
--   シアノバクテリアの和色・「蒼い水が汚れを取り除く」「水から金属を生み出す」のイメージ）、
--   「アクロニム系とか今までひとつも出てきてなくない？」「瀬戸内法があるくらい、瀬戸内って水を綺麗にしようっていう地域」
-- 473 で置き換えた「2026-10-03〜04 確認: …」の行を置き換える。代案の一覧と判定は資料に置き、説明には一次確認を通った主な案だけ書く。
-- 資料: Drive p21_sol/261005_社名候補の確認/SOL_社名候補の確認_20261005.md（10-04 版は 261004_社名候補の確認/ に残す）
-- 状態（not_started）と期限（2026-10-23）は変えない。社名はまだ決まっていない。

BEGIN;

UPDATE project_management_tasks
SET description = regexp_replace(description, '\n2026-10-03〜0[45] 確認: .*$', '') || $m$
2026-10-03〜05 確認: solvio は採らないことを勧める。第1類（水質浄化剤など）に同じ読みの商標「ソルビオ」が生きていて、国内に同じ名前の会社が2社あり、主なドメインも他者の保有。代案は約180案を出し、一次確認を通った主な案は Solnio・Solkai・Metalga・Aonica（青丹）・テツイロ（鉄色）・アスミズ（明日の水）・ユアオ（湯＋蒼）・セトミズ。弁理士の調査はこれから。資料: Drive p21_sol/261005_社名候補の確認/$m$,
    updated_by = 'amie',
    updated_at = NOW()
WHERE id = '21000000-2026-4000-9000-000000000018'
  AND project_id = 'p21'
  AND description NOT LIKE '%261005_社名候補の確認%';

DO $chk$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM project_management_tasks
  WHERE id = '21000000-2026-4000-9000-000000000018'
    AND description LIKE '%2026-10-03〜05 確認: solvio は採らないことを勧める%'
    AND description LIKE '%261005_社名候補の確認%'
    AND description NOT LIKE '%2026-10-03〜04 確認:%'
    AND description LIKE '現行の案「SolvioraX」を「solvio」に変える案が出た%';
  IF n <> 1 THEN RAISE EXCEPTION 'task description: expected 1, got %', n; END IF;
END $chk$;

COMMIT;
