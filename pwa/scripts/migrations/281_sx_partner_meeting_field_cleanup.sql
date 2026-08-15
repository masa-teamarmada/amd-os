-- 281: p21 関係先の次回面談フィールドの是正 (2026-08-16 まさ指示)
--
-- 1) メイトの next_meeting_prep が経緯メモの生文だった。一人称の依頼記録が入っていて、
--    外部共有の関係先リストにそのまま出る (伊予銀行メンバーへ共有予定)。
--    事実は変えずに、着地点 (next_meeting_goal) と持ち物 (next_meeting_prep) へ分ける。
-- 2) 住友金属鉱山の next_meeting_on が 2027-08-25 だった。年の打ち間違いなので 2026 へ直す。
--    ※ 同社の訪問は 8/5 定例で「9月第1週目安」と共有されており、due_date も 2026-09-01
--      (月精度)。8/25 という日付自体が正しいかは未確認のまま (時刻も「調整中」)。
--      年だけ直し、日付の当否はまさの確認に残す。
--
-- 冪等性: いずれも現在値と一致するときだけ更新する。

BEGIN;

UPDATE project_management_partners
SET next_meeting_goal = 'より上流の高濃度排液を提供してもらう合意と、工場見学の可否を得る',
    next_meeting_prep = '2回目に提供いただいた排液の処理結果の報告資料。ネオジム・ジスプロシウムの回収に必要な濃度条件をまとめたもの',
    updated_at = now()
WHERE project_id = 'p21'
  AND slug = 'poc-talk-05-x'
  AND deleted_at IS NULL
  AND next_meeting_prep LIKE '2回目にいただいた数種類の廃液の処理結果を報告した際%';

UPDATE project_management_partners
SET next_meeting_on = DATE '2026-08-25',
    updated_at = now()
WHERE project_id = 'p21'
  AND slug = 'poc-talk-10-x'
  AND deleted_at IS NULL
  AND next_meeting_on = DATE '2027-08-25';

COMMIT;
