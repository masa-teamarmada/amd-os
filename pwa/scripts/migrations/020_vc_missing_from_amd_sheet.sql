-- 020_vc_missing_from_amd_sheet.sql
--
-- まさ提供の AMD VC リスト (Google Sheet) に基づき、016 seed では取り損ねた主要 VC を追加。
--
-- まさ明示指摘:
--   UMI (Universal Materials Incubator) - うちの案件に一番出資してるところ
--   archetype ventures
--   LtV / LTV (Lifetime Ventures)
--   クオンタムリープ (QXLV)
--   ANOBAKA
--   Plug and Play (PnP)
--
-- + AMD のティエム (p03) に確定出資した投資家陣 (シート table 確定額):
--   UMI 8.525億 (lead, 累計 10.525億)
--   京都大学iCAP 1.875億 (already exists)
--   NECキャピタルソリューションズ 1億 (lead, NECAP)
--   大和企業投資 1億 (DCI/Daiwa)
--   テックアクセルベンチャーズ 0.5億 (TAV)
--   サムライインキュベート 0.5億 (SCI)
--   MUCAP 0.35億 (already as 三菱UFJキャピタル)
--   FVC 0.25億 (フューチャーベンチャーキャピタル)
--   YKKAP 0.25億
--   めぶきキャピタル 1億
--
-- AMD rating (えいみ独断、DTSU アーリー / DD / リード 軸):
--   UMI ★5、archetype ★4、LtV ★3、QL ★3、ANOBAKA ★2、PnP ★2
--   tiem 関連の DT 系 VC は経験のある関係先として ★3-4

-- =====================================================================
-- まさ明示の 6 社
-- =====================================================================

INSERT INTO vcs (name, name_en, slug, type, thesis, stage_focus, ticket_min_jpy, ticket_max_jpy, hq, website, notes, amd_rating, amd_rating_note, amd_rating_updated_at)
VALUES
  ('Universal Materials Incubator',
   'Universal Materials Incubator (UMI)', 'umi',
   'corporate',
   '素材・化学領域に特化した独立系 VC (LPに JOGMEC、三井物産等)。素材ディープテックでは国内最大級、リード対応。',
   ARRAY['seed','series_a','series_b'], 100000000, 1000000000, '東京', 'https://www.umi.co.jp',
   'AMD ティエム (p03) のリードかつ累計 10.525 億円出資の最大出資者。素材系 PJ で第一候補級。',
   5, '国内素材 DT 特化のトップ。tiem に 10.525 億円リード出資 (累計)、AMD と最深の関係。DT 評価力 / リード / アーリー対応 すべて◎', NOW()),

  ('archetype ventures',
   'archetype ventures', 'archetype-ventures',
   'independent',
   'フロンティアテック (ロボット / マテリアル / ヘルス) 特化の早期投資 VC。アーリーリード対応。',
   ARRAY['seed','series_a'], 30000000, 300000000, '東京', 'https://archetype.vc',
   'KT / LST / r3kt 等で打診履歴あり。検討継続枠の常連。',
   4, 'フロンティア DT アーリーで一定のプレゼンス。リードも可、DD も DT 文脈分かる。AMD と相性良い。', NOW()),

  ('Lifetime Ventures',
   'Lifetime Ventures (LtV)', 'lifetime-ventures',
   'independent',
   'マルチセクター。DT もポートフォリオに含む。lead 50-180M レンジ。',
   ARRAY['seed','series_a'], 30000000, 200000000, '東京', 'https://lifetimeventures.jp',
   'KT / SE で ★3 評価、lead capable とのまさメモ。',
   3, 'DT 専門ではないが lead 取れる体制と蓄積あり。案件によっては第一候補にも。', NOW()),

  ('クオンタムリープベンチャーズ',
   'Quantum Leap Ventures (QXLV)', 'quantum-leap-ventures',
   'independent',
   'フロンティアテック (IoT / ロボティクス / ハード) 特化の VC。',
   ARRAY['seed','series_a'], 30000000, 300000000, '東京', 'https://www.quantumleaps.jp',
   'KT / CTB / LST / SE / r3kt 等で打診履歴。',
   3, 'フロンティア DT 領域の VC として一定の存在感。シード対応は要確認。', NOW()),

  ('ANOBAKA',
   'ANOBAKA', 'anobaka',
   'independent',
   'シードステージ特化の独立系 VC。Tech / SaaS / DT 一部。',
   ARRAY['pre_seed','seed'], 10000000, 100000000, '東京', 'https://anobaka.com',
   'KT / r3kt で打診履歴。KT では「シード不可」扱いだったが、本業はシード VC。',
   2, 'シード特化だが DT/ハード系は対象外気味。SaaS/web3 寄り。AMD 案件には合いづらい。', NOW()),

  ('Plug and Play Japan',
   'Plug and Play (PnP)', 'plug-and-play-japan',
   'overseas',
   'グローバルアクセラレータ + マルチセクターアーリー投資。日本拠点あり。',
   ARRAY['pre_seed','seed','series_a'], 10000000, 100000000, '東京 (US 本社)',
   'https://www.plugandplaytechcenter.com/japan',
   'AMD 各 PJ で打診履歴あり。KT で「シード不可」扱い。',
   2, '海外発の幅広いアクセラ系。DT 専門性は薄め、軽く参加程度の関係。', NOW())
ON CONFLICT (name) DO UPDATE SET
  thesis = COALESCE(EXCLUDED.thesis, vcs.thesis),
  notes = COALESCE(EXCLUDED.notes, vcs.notes),
  updated_at = NOW();


-- =====================================================================
-- ティエム (p03) 確定投資家で 016 seed にいないもの
-- =====================================================================

INSERT INTO vcs (name, name_en, slug, type, thesis, hq, notes, amd_rating, amd_rating_note, amd_rating_updated_at)
VALUES
  ('NECキャピタルソリューションズ',
   'NEC Capital Solutions (NECAP)', 'nec-capital-solutions',
   'cvc',
   'NEC 系 CVC + リース系。素材 / ICT / DT 一部。',
   '東京', 'tiem (p03) リード出資先 (1 億円)。',
   3, 'CVC として一定の DD 体制、tiem ではリード経験あり。', NOW()),

  ('大和企業投資',
   'Daiwa Corporate Investment (DCI)', 'daiwa-corporate-investment',
   'corporate',
   '大和証券系の独立 VC。マルチセクター、後期寄りも可能。',
   '東京', 'tiem (p03) フォロー出資 1 億円。',
   3, '大手証券系で安定感あるが DT 特化ではない。フォロー投資で頼れる。', NOW()),

  ('テックアクセルベンチャーズ',
   'Tech Accel Ventures (TAV)', 'tech-accel-ventures',
   'independent',
   '製造 / 産業 IoT / ハードウェア特化の VC。',
   '東京', 'tiem (p03) 出資 5 千万円。',
   3, '産業系ハード DT 領域で出資経験あり。アーリーは案件次第。', NOW()),

  ('サムライインキュベート',
   'Samurai Incubate (SCI)', 'samurai-incubate',
   'independent',
   'シード〜アーリー、グローバル DT (宇宙・モビリティ・気候) 含む幅広い VC。',
   '東京', 'tiem (p03) 出資 5 千万円。',
   3, 'アーリー対応、海外含む実績あり。DT も触る。', NOW()),

  ('フューチャーベンチャーキャピタル',
   'Future Venture Capital (FVC)', 'future-venture-capital',
   'independent',
   '地域特化 / 産学連携系の独立 VC。',
   '京都', 'tiem (p03) フォロー出資 2.5 千万円。AMD 各 PJ で打診履歴。',
   2, '案件で関わりはあるが DT 特化ではなく、アーリー対応も限定的。', NOW()),

  ('YKKAP',
   'YKKAP', 'ykkap',
   'corporate',
   'YKK AP の事業会社出資 (CVC ではない事業判断ベース)。',
   '東京', 'tiem (p03) フォロー出資 2.5 千万円 (素材接点)。',
   2, '事業会社直接出資で素材分野に縁あり。DT 専門 VC ではない。', NOW()),

  ('めぶきキャピタル',
   'Mebuki Capital', 'mebuki-capital',
   'cvc',
   '常陽 / 足利系の地銀 VC。製造業 / 地域 DT に強い。',
   '東京', 'tiem (p03) フォロー出資 1 億円。',
   2, '地銀系 CVC で製造業強い。DT アーリーは弱め、確実なフォロー先として有用。', NOW())
ON CONFLICT (name) DO UPDATE SET
  notes = COALESCE(EXCLUDED.notes, vcs.notes),
  updated_at = NOW();


-- =====================================================================
-- ティエム (p03) 出資イベント記録
-- =====================================================================

DO $$
DECLARE
  v_vc_id UUID;
BEGIN
  -- UMI: 累計 10.525 億 (リード)
  SELECT id INTO v_vc_id FROM vcs WHERE name = 'Universal Materials Incubator';
  IF v_vc_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vc_investments WHERE vc_id = v_vc_id AND our_project_id = 'p03') THEN
    INSERT INTO vc_investments (vc_id, target_company, our_project_id, amount_jpy, round, is_lead, notes)
    VALUES (v_vc_id, 'ティエムファクトリ', 'p03', 1052500000, 'series_a', TRUE,
            'AMD VC リスト (まさ提供) より。累計出資額。リード。');
  END IF;

  -- iCAP: 1.875 億
  SELECT id INTO v_vc_id FROM vcs WHERE name LIKE '京都大学%';
  IF v_vc_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vc_investments WHERE vc_id = v_vc_id AND our_project_id = 'p03') THEN
    INSERT INTO vc_investments (vc_id, target_company, our_project_id, amount_jpy, round, is_lead, notes)
    VALUES (v_vc_id, 'ティエムファクトリ', 'p03', 187500000, 'series_a', FALSE, 'AMD VC リストより');
  END IF;

  -- NECAP: 1 億 (リード)
  SELECT id INTO v_vc_id FROM vcs WHERE name = 'NECキャピタルソリューションズ';
  IF v_vc_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vc_investments WHERE vc_id = v_vc_id AND our_project_id = 'p03') THEN
    INSERT INTO vc_investments (vc_id, target_company, our_project_id, amount_jpy, round, is_lead, notes)
    VALUES (v_vc_id, 'ティエムファクトリ', 'p03', 100000000, 'series_a', TRUE, 'AMD VC リストより');
  END IF;

  -- 大和企業投資 DCI: 1 億
  SELECT id INTO v_vc_id FROM vcs WHERE name = '大和企業投資';
  IF v_vc_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vc_investments WHERE vc_id = v_vc_id AND our_project_id = 'p03') THEN
    INSERT INTO vc_investments (vc_id, target_company, our_project_id, amount_jpy, round, is_lead, notes)
    VALUES (v_vc_id, 'ティエムファクトリ', 'p03', 100000000, 'series_a', FALSE, 'AMD VC リストより');
  END IF;

  -- TAV: 0.5 億
  SELECT id INTO v_vc_id FROM vcs WHERE name = 'テックアクセルベンチャーズ';
  IF v_vc_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vc_investments WHERE vc_id = v_vc_id AND our_project_id = 'p03') THEN
    INSERT INTO vc_investments (vc_id, target_company, our_project_id, amount_jpy, round, is_lead, notes)
    VALUES (v_vc_id, 'ティエムファクトリ', 'p03', 50000000, 'series_a', FALSE, 'AMD VC リストより');
  END IF;

  -- SCI: 0.5 億
  SELECT id INTO v_vc_id FROM vcs WHERE name = 'サムライインキュベート';
  IF v_vc_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vc_investments WHERE vc_id = v_vc_id AND our_project_id = 'p03') THEN
    INSERT INTO vc_investments (vc_id, target_company, our_project_id, amount_jpy, round, is_lead, notes)
    VALUES (v_vc_id, 'ティエムファクトリ', 'p03', 50000000, 'series_a', FALSE, 'AMD VC リストより');
  END IF;

  -- MUCAP (三菱UFJキャピタル): 0.35 億
  SELECT id INTO v_vc_id FROM vcs WHERE name = '三菱UFJキャピタル';
  IF v_vc_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vc_investments WHERE vc_id = v_vc_id AND our_project_id = 'p03') THEN
    INSERT INTO vc_investments (vc_id, target_company, our_project_id, amount_jpy, round, is_lead, notes)
    VALUES (v_vc_id, 'ティエムファクトリ', 'p03', 35000000, 'series_a', FALSE, 'AMD VC リストより');
  END IF;

  -- FVC: 0.25 億
  SELECT id INTO v_vc_id FROM vcs WHERE name = 'フューチャーベンチャーキャピタル';
  IF v_vc_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vc_investments WHERE vc_id = v_vc_id AND our_project_id = 'p03') THEN
    INSERT INTO vc_investments (vc_id, target_company, our_project_id, amount_jpy, round, is_lead, notes)
    VALUES (v_vc_id, 'ティエムファクトリ', 'p03', 25000000, 'series_a', FALSE, 'AMD VC リストより');
  END IF;

  -- YKKAP: 0.25 億
  SELECT id INTO v_vc_id FROM vcs WHERE name = 'YKKAP';
  IF v_vc_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vc_investments WHERE vc_id = v_vc_id AND our_project_id = 'p03') THEN
    INSERT INTO vc_investments (vc_id, target_company, our_project_id, amount_jpy, round, is_lead, notes)
    VALUES (v_vc_id, 'ティエムファクトリ', 'p03', 25000000, 'series_a', FALSE, 'AMD VC リストより');
  END IF;

  -- めぶきキャピタル: 1 億
  SELECT id INTO v_vc_id FROM vcs WHERE name = 'めぶきキャピタル';
  IF v_vc_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vc_investments WHERE vc_id = v_vc_id AND our_project_id = 'p03') THEN
    INSERT INTO vc_investments (vc_id, target_company, our_project_id, amount_jpy, round, is_lead, notes)
    VALUES (v_vc_id, 'ティエムファクトリ', 'p03', 100000000, 'series_a', FALSE, 'AMD VC リストより');
  END IF;

  -- p03 narrative 再生成予約
  UPDATE project_ventures SET narrative_invalidated_at = NOW() WHERE project_id = 'p03';
END $$;
