-- 025_vc_cleanup_constraints_clg.sql
--
-- まさ指摘 (2026-05-08) の対応:
--
-- 1. AMD 側人物が誤って vc_contacts に登録されていた:
--    - 山地 = AMD CEO まさ本人
--    - タミル = KT (p04 輝翠TECH) の CEO
--    - 飯野 / 下里 / 武田 / 丸島 など複数も AMD 内部 or PJ 側
--    - これらを vc_contacts から削除し、関連 project_vc_relations の
--      vc_contact_id を NULL にリセット
--
-- 2. vcs.investment_constraints (TEXT) を新設
--    分野限定 / val 固定 / 初回ラウンドのみ など制約をフリーテキストで残す
--
-- 3. 既知制約を一括投入:
--    - Remeges Ventures: 創薬 SU 限定
--    - MedVenture Partners: 医療機器特化
--    - AN Venture Partners: ヘルスケア特化
--    - Medical Incubator Japan: 医療系特化
--    - NEWTON BIOCAPITAL: 創薬 / グローバル
--    - 大鵬薬品: 薬剤特化 (事業会社)
--    - JST SUCCESS: 公的補助 / 大学発限定
--    - DBJキャピタル: バイオ 1/4 制限、リードは取締役選任権必須
--    - 新生キャピタル: 1社最大 10億 MS、ファンドまたぎ不可
--    - IP Bridge VP: ヘルスケア将来出資希望
--    - エムスリー: ヘルスケア限定
--
-- 4. MZF = 前澤ファンド (株式会社前澤ファンド) - 前澤友作氏の個人ファンド更新
--
-- 5. CLG (p24, 株式会社チャレナジー) を project_ventures に登録
--    プロペラ無しのマグナス式垂直軸風力発電。長崎西部下水とは別 PJ。
--
-- 6. Challenergy 過去出資を vc_investments に投入:
--    - 2018: Real Tech Fund (UntroD), 三井住友海上キャピタル, THK ≈ 2.8億
--    - 2022: 前澤ファンド ≈ 12億 (リード)
--    - 2024 推定: ファーストライフ 等 6 社 ≈ 6億

-- =====================================================================
-- 1. 誤登録 AMD 側人物 を vc_contacts から削除
-- =====================================================================

DO $$
DECLARE excluded_names TEXT[] := ARRAY[
  '山地', '山地 正洋',           -- AMD CEO まさ
  'タミル',                      -- KT CEO
  '飯野', '下里', '武田', '丸島', -- AMD 内 / PJ 側っぽい人物
  'タミル＠KT',
  'masa',
  '山地ルート',
  -- 以下も sheet からの誤抽出っぽいもの (姓だけで本物 VC 担当か AMD 内かわからないもの)
  '高（長崎研出身）',            -- CTB 文中の人物、不明確
  '長崎研',
  '長崎研出身',
  '前澤',                        -- MZF GP は前澤友作だが「前澤ファンド」と社名で扱う
  'NTA瀬尾'                      -- 紹介者
];
BEGIN
  -- relations の vc_contact_id を null にリセット (該当 contact を参照してるもの)
  UPDATE project_vc_relations SET vc_contact_id = NULL
  WHERE vc_contact_id IN (
    SELECT id FROM vc_contacts WHERE name = ANY(excluded_names)
  );
  -- vc_contacts 削除
  DELETE FROM vc_contacts WHERE name = ANY(excluded_names);
END $$;


-- =====================================================================
-- 2. investment_constraints 列追加
-- =====================================================================

ALTER TABLE vcs ADD COLUMN IF NOT EXISTS investment_constraints TEXT;
COMMENT ON COLUMN vcs.investment_constraints IS
  '投資制約フリーテキスト。分野限定 / val 固定 / 初回ラウンドのみ / リード時の権利 / DD 期間 等';


-- =====================================================================
-- 3. 既知制約を一括投入
-- =====================================================================

UPDATE vcs SET investment_constraints =
  '創薬 SU 限定 (CTB / バイオのみ可)。海外含む。'
WHERE name = 'Remeges Ventures';

UPDATE vcs SET investment_constraints =
  '医療機器特化。CTB 系のみ。'
WHERE name = 'MedVenture Partners';

UPDATE vcs SET investment_constraints =
  'ヘルスケア / 医療領域限定。千代田化工系。'
WHERE name = 'AN Venture Partners (ANVP)' OR name = 'AN Venture Partners';

UPDATE vcs SET investment_constraints =
  '医療系限定 (CTB 等)。武田さん経由。'
WHERE name = 'Medical Incubator Japan (MIJ)' OR name = 'Medical Incubator Japan';

UPDATE vcs SET investment_constraints =
  '創薬 / グローバルヘルスケア限定。'
WHERE name = 'NEWTON BIOCAPITAL';

UPDATE vcs SET investment_constraints =
  '医薬品 / 薬剤 R&D 連携限定 (事業会社系)。'
WHERE name = '大鵬薬品';

UPDATE vcs SET investment_constraints =
  'JST 公的支援。大学発 R&D 段階のみ。グラント色強い。'
WHERE name = 'JST SUCCESS';

UPDATE vcs SET investment_constraints =
  'ファンドサイズ 343億 (2023/4 +120億増資)。バイオは 1/4 まで。リードは取締役選任権必須。DD 2-3 か月、IC は 2 名意思決定。'
WHERE name = 'DBJキャピタル';

UPDATE vcs SET investment_constraints =
  '1社最大 10億 MS、ファンドまたぎ不可。アーリーは 2025 シリーズ A 以降。ライフサイエンス限定 (1号 100億)。'
WHERE name = '新生キャピタルパートナーズ';

UPDATE vcs SET investment_constraints =
  'ヘルスケア将来出資希望。一般ファンド組成中、シリーズ後期狙い。'
WHERE name = 'IP Bridge VP (IPVP)';

UPDATE vcs SET investment_constraints =
  'CTB 文脈ではアーリー過ぎ + 市場規模小で見送り。ヘルスケア / 医療データ寄りの後期段階向き。'
WHERE name = 'エムスリー';

UPDATE vcs SET investment_constraints =
  '初回ラウンド限定 (シード〜アーリー)。'
WHERE name = 'CAC';

UPDATE vcs SET investment_constraints =
  'シード不可 (KT 案件)。後期以降向け。'
WHERE name IN (
  'EV', 'OUVC', 'Shizen Capital', 'GB',
  'KDDI Open Innovation Fund',
  'Scrum Ventures', 'JPI', 'D4V'
);


-- =====================================================================
-- 4. MZF = 前澤ファンド 更新
-- =====================================================================

UPDATE vcs SET
  name = '前澤ファンド',
  name_en = 'Maezawa Fund (MZF)',
  slug = 'maezawa-fund',
  type = 'corporate',
  thesis = '前澤友作氏の個人資産ベース。総額 100 億円規模。社会課題解決 / 宇宙 / ディープテック / 趣味追求テーマ。経営参画型 (約 20% 持ち + 自ら経営)。',
  hq = '東京 (港区)',
  website = 'https://www.mzfund.co.jp',
  amd_rating = 3,
  amd_rating_note = '個人資産 100 億級、ディープテック・宇宙テーマで実績あり (チャレナジー 12億 リード等)。アーリー OK、リード可。',
  amd_rating_updated_at = NOW(),
  notes = COALESCE(notes, '') || E'\n2026-05-08 更新: ZOZO 創業者 前澤友作氏のプライベートファンド。MZ Web3 ファンドとは別 (本体はディープテック・宇宙)。経営参画型 + 人脈・影響力フル活用。Challenergy / JC で接点あり。',
  investment_constraints = '前澤氏が経営参画する前提 (約 20% 株式 + 経営介入)。社会課題テーマ重視。',
  updated_at = NOW()
WHERE name = 'MZ Web3 Fund (MZF)';


-- =====================================================================
-- 5. CLG (p24, チャレナジー) を project_ventures に追加
-- =====================================================================

INSERT INTO project_ventures (
  project_id, display_name, short_label, lane,
  founded_at, outcome_pattern, origin_org, origin_pi, amd_role,
  short_description, is_public
)
VALUES (
  'p24', '株式会社チャレナジー', 'CLG', 'gx_energy',
  '2014-10-01', 'rocket', '東京工業大学', '清水敦史',
  'support',
  'マグナス式垂直軸風力発電 (プロペラ無し)。台風・乱風下でも発電可能。フィリピン・石垣島で実証。AMD 関与は事業推進サポート。',
  TRUE
)
ON CONFLICT (project_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  short_label = EXCLUDED.short_label,
  lane = EXCLUDED.lane,
  founded_at = EXCLUDED.founded_at,
  outcome_pattern = EXCLUDED.outcome_pattern,
  origin_org = EXCLUDED.origin_org,
  origin_pi = EXCLUDED.origin_pi,
  amd_role = EXCLUDED.amd_role,
  short_description = EXCLUDED.short_description,
  updated_at = NOW();


-- =====================================================================
-- 6. Challenergy 過去出資を vc_investments に投入
-- =====================================================================

DO $$
DECLARE
  v_untrod_id UUID;
  v_thk_id UUID;
  v_smm_id UUID;
  v_mzf_id UUID;
  v_first_id UUID;
BEGIN
  -- UntroD (Real Tech Fund 1 から 2018)
  SELECT id INTO v_untrod_id FROM vcs WHERE name = 'UntroD Capital Japan（旧リアルテックホールディングス）';
  IF v_untrod_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM vc_investments WHERE vc_id = v_untrod_id AND our_project_id = 'p24'
  ) THEN
    INSERT INTO vc_investments (vc_id, target_company, our_project_id, amount_jpy, round, invested_at, is_lead, source_url, notes)
    VALUES (v_untrod_id, '株式会社チャレナジー', 'p24', NULL, 'series_a', '2018-02-01', FALSE,
            'https://challenergy.com/2018/02/02/post_77/',
            '2018-02 第三者割当の一部 (Real Tech Fund 1)。SMM Cap, THK と共同。総額 約 2.8 億円。');
  END IF;

  -- 三井住友海上キャピタル
  INSERT INTO vcs (name, name_en, slug, type, amd_rating, amd_rating_note, amd_rating_updated_at, notes)
  VALUES ('三井住友海上キャピタル', 'Sumitomo Mitsui Marine Capital (SMMC)', 'smmc',
          'cvc', 2, '損保系 CVC。ディープテックも一部投資 (Challenergy 2018 出資実績)。',
          NOW(), 'AMD CLG (チャレナジー) 出資先。')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_smm_id FROM vcs WHERE name = '三井住友海上キャピタル';
  IF v_smm_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM vc_investments WHERE vc_id = v_smm_id AND our_project_id = 'p24'
  ) THEN
    INSERT INTO vc_investments (vc_id, target_company, our_project_id, amount_jpy, round, invested_at, is_lead, source_url, notes)
    VALUES (v_smm_id, '株式会社チャレナジー', 'p24', NULL, 'series_a', '2018-02-01', FALSE,
            'https://challenergy.com/2018/02/02/post_77/',
            '2018-02 第三者割当の一部。');
  END IF;

  -- THK (事業会社、CVC 寄り)
  INSERT INTO vcs (name, name_en, slug, type, amd_rating, amd_rating_note, amd_rating_updated_at, notes)
  VALUES ('THK', 'THK Co., Ltd.', 'thk', 'corporate', 1,
          '事業会社 (機械要素)。素材・機械系の戦略出資。',
          NOW(), 'AMD CLG (チャレナジー) 2018 出資先。')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_thk_id FROM vcs WHERE name = 'THK';
  IF v_thk_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM vc_investments WHERE vc_id = v_thk_id AND our_project_id = 'p24'
  ) THEN
    INSERT INTO vc_investments (vc_id, target_company, our_project_id, amount_jpy, round, invested_at, is_lead, source_url, notes)
    VALUES (v_thk_id, '株式会社チャレナジー', 'p24', NULL, 'series_a', '2018-02-01', FALSE,
            'https://challenergy.com/2018/02/02/post_77/',
            '2018-02 第三者割当の一部 (CVC 的事業会社出資)。');
  END IF;

  -- 前澤ファンド: 2022 約 12 億 (リード)
  SELECT id INTO v_mzf_id FROM vcs WHERE name = '前澤ファンド';
  IF v_mzf_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM vc_investments WHERE vc_id = v_mzf_id AND our_project_id = 'p24'
  ) THEN
    INSERT INTO vc_investments (vc_id, target_company, our_project_id, amount_jpy, round, invested_at, is_lead, source_url, notes)
    VALUES (v_mzf_id, '株式会社チャレナジー', 'p24', 1200000000, 'series_b', '2022-09-22', TRUE,
            'https://challenergy.com/2022/09/22/fundraising2022/',
            '2022-09 第三者割当 約 12 億円。前澤ファンド単独リード。マグナス風力発電大規模化。');
  END IF;

  -- 第一生命: 2024 推定 (約 6 億の一部)
  INSERT INTO vcs (name, name_en, slug, type, amd_rating, amd_rating_note, amd_rating_updated_at, notes)
  VALUES ('第一生命', 'The First Life Insurance', 'dai-ichi-life', 'corporate', 1,
          '生保系。ESG / インパクト投資の一環でディープテックにも出資。',
          NOW(), 'AMD CLG (チャレナジー) 2024 推定出資先。')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_first_id FROM vcs WHERE name = '第一生命';
  IF v_first_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM vc_investments WHERE vc_id = v_first_id AND our_project_id = 'p24'
  ) THEN
    INSERT INTO vc_investments (vc_id, target_company, our_project_id, amount_jpy, round, invested_at, is_lead, source_url, notes)
    VALUES (v_first_id, '株式会社チャレナジー', 'p24', NULL, 'series_b', '2024-01-01', FALSE,
            NULL,
            '2024 推定 / 6 社共同 約 6 億円の一部。詳細日は要確認。');
  END IF;
END $$;
