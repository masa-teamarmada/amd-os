-- 075_related_members_cleanup.sql
--
-- まさ判断 (2026-05-22):
--  「project_founding_members」は実質「関連メンバー」リスト。HRL 根拠には
--  「該当SUの社員 + AMD伴走メンバー」だけを含める。大学・研究機関のPI /
--  共同研究者 / 特許保有者、VC、顧客、行政、partner_company は HRL 根拠から外す。
--  AMD メンバーは `members.code_name` で記録 (フルネーム / 姓のみ表記との
--  重複行は invalid にして集約)。
--
-- 変更:
--  1) category 許可値に 'startup' (= 該当SUの社員 / 創業候補) を追加 (COMMENT 更新)
--  2) HRL根拠外カテゴリ (university/vc/partner_company/government/individual) を全PJで invalid 化
--  3) AMD member の重複 (フルネーム / 姓のみ / スペース付き) を invalid 化
--  4) category='amd' で AMD code_name に該当しない person_name は category='startup' へスライド
--  5) JOYCLE (p09): 2026-05-22 cleanup で invalid 化された JC 社員候補 (上原/小屋/小林/
--     斎藤/本橋/赤土/赤津) を category='startup' + status='active' に復活
--
-- 関連: pwa/src/app/api/cron/founding-members-extract/route.ts (v3 prompt)、
--       pwa/src/components/cockpit/CockpitFoundingMembersModal.tsx (ラベル変更)、
--       pwa/design/xrl_evidence.md / cockpit.md / L2_DATA.md。

-- (1) category COMMENT 更新
COMMENT ON COLUMN project_founding_members.category IS
  '''amd'' / ''startup'' / ''university'' / ''vc'' / ''partner_company'' / ''government'' / ''individual'' / ''unknown''. startup = 該当SUの社員 / 創業候補。HRL根拠は amd + startup のみで算出する。';

-- (2) HRL根拠外カテゴリを invalid
UPDATE project_founding_members
   SET status='invalid',
       notes=COALESCE(notes, '') || ' / [2026-05-22] HRL根拠外カテゴリのため invalid (大学/VC/協業先/行政/個人は該当SU+AMD外として除外)',
       updated_at=now()
 WHERE status='active'
   AND category IN ('university','vc','partner_company','government','individual');

-- (3) AMD member の重複 (フルネーム / 姓のみ) を invalid
UPDATE project_founding_members
   SET status='invalid',
       notes=COALESCE(notes, '') || ' / [2026-05-22] AMD code_name と同一人物の重複表記のため invalid',
       updated_at=now()
 WHERE status='active'
   AND person_name IN (
     -- フルネーム
     '山地正洋','山地 正洋','肥塚恭子','肥塚 恭子','輕部琢真','輕部 琢真','宮崎航一','宮崎 航一',
     '藤崎百合恵','藤崎 百合恵','遠藤千穂','遠藤 千穂','梅本隆司','梅本 隆司',
     '安孫子芽生','安孫子 芽生','小田切理沙','小田切 理沙','岡安真司','岡安 真司','末永晃理','末永 晃理',
     -- 姓のみ
     '山地','肥塚','輕部','宮崎','藤崎','遠藤','梅本','安孫子','小田切','岡安','末永'
   );

-- (4) category='amd' で AMD code_name に該当しない person を startup へスライド
UPDATE project_founding_members
   SET category='startup',
       affiliation=NULLIF(
         TRIM(BOTH ' /' FROM REGEXP_REPLACE(COALESCE(affiliation,''), '\s*/\s*AMD\s*$|^\s*AMD\s*/\s*|^\s*AMD\s*$', '', 'g')),
         ''
       ),
       notes=COALESCE(notes, '') || ' / [2026-05-22] AMD code_name 不一致のため category=startup (該当SU社員) へスライド',
       updated_at=now()
 WHERE category='amd'
   AND person_name NOT IN (
     'まさ','きよ','かる','こう','りり','ちこ','うめ','あび','りさ','info','しん','つくよみ','あき'
   );

-- (5) JOYCLE (p09): JC社員リストを active に復活 (まさ判断 2026-05-22)
UPDATE project_founding_members
   SET status='active',
       category='startup',
       affiliation='JC',
       notes=COALESCE(notes, '') || ' / [2026-05-22] JC社員として復活 (まさ判断)',
       updated_at=now()
 WHERE project_id='p09'
   AND status='invalid'
   AND person_name IN ('上原','小屋','小林','斎藤','本橋','赤土','赤津')
   AND notes LIKE '%2026-05-22 cleanup: 創業メンバー定義%';
