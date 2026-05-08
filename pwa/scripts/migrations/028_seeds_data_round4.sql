-- 028_seeds_data_round4.sql
--
-- Phase 1 初期投入 第4ラウンド。KSAC 第2回 GAPファンド から 11 件追加。
--
-- データソース: 第2回 KSAC-GAPファンド 採択者一覧 PDF (ksac-gap-result-2nd.pdf、全45件)
-- 選定基準: AMD レーン適合 × ディープテック度 × 革新性 × 異色 (核融合・木造衛星・PFAS分解 等)
--
-- DTSU/GX 採択 17社は法人化済 (シリーズA以降) のため、AMD のシーズリスト
-- (Before 0) の本来スコープと乖離。今回は対象外 (将来「外部事業者リスト」として別管理検討)。

INSERT INTO seeds (
  title, summary, org_name, org_type, org_region,
  researcher_name, researcher_title, lab_name,
  domain_lane, industry_target, keywords,
  status, source, source_detail
) VALUES
  -- ライフサイエンス系 (3件)
  ('放射線誘導性がんワクチン Burst Therapy',
   '100年の放射線治療の概念を一新する放射線誘導性がんワクチン。Burst Therapy で全身性免疫応答を誘導。',
   '神戸大学', 'university', '兵庫県神戸市',
   '佐々木 良平', '教授', '医学部附属病院',
   'life', ARRAY['がん治療', '放射線', '免疫療法'],
   ARRAY['放射線', 'がんワクチン', 'Burst Therapy', 'KSAC'],
   'investigating', 'grant_db',
   'KSAC GAPファンド 第2回 IV ライフサイエンス 採択'),

  ('iPS細胞 大量培養ブレードレスバイオリアクタ',
   'ヒト iPS 細胞の大量培養を実現するブレードレスバイオリアクタ。再生医療・創薬の細胞供給インフラ。',
   '大阪大学', 'university', '大阪府吹田市',
   '渡邊 大記', '特任教授', '基礎工学研究科',
   'materials', ARRAY['再生医療', '創薬', 'バイオプロセス'],
   ARRAY['iPS細胞', 'バイオリアクタ', 'ブレードレス', 'KSAC'],
   'investigating', 'grant_db',
   'KSAC GAPファンド 第2回 IV ものづくり 採択'),

  ('励起一重項-三重項エネルギー逆転 有機EL材料',
   '励起一重項と三重項のエネルギーが逆転した有機 EL 材料。次世代ディスプレイ・照明の革新。',
   '大阪大学', 'university', '大阪府吹田市',
   '相澤 直矢', '助教 (若手卓越教員)', '工学研究科',
   'materials', ARRAY['ディスプレイ', '照明', '有機EL'],
   ARRAY['有機EL', '一重項三重項逆転', 'OLED', 'KSAC'],
   'investigating', 'grant_db',
   'KSAC GAPファンド 第2回 PSF ものづくり 採択'),

  -- ものづくり/AI 系 (2件)
  ('AI システムによる究極精度ものづくり設計最適化',
   '究極的精度のものづくりの設計・最適化を実現する AI システム。半導体・精密機械・航空宇宙向け。',
   '京都大学', 'university', '京都府京都市',
   '田辺 克明', '教授', '工学研究科',
   'robo', ARRAY['製造業', '設計', 'AI'],
   ARRAY['AI設計', '最適化', 'ものづくり', 'KSAC'],
   'investigating', 'grant_db',
   'KSAC GAPファンド 第2回 IV ものづくり 採択'),

  ('200℃以上で動作する ロジック半導体 (集積回路)',
   '200℃以上の高温環境で動作するロジック半導体の実現。EV パワー回路・地熱・宇宙環境向け。',
   '京都大学', 'university', '京都府京都市',
   '金子 光顕', '助教', '工学研究科',
   'materials', ARRAY['半導体', 'EV', '宇宙', '地熱'],
   ARRAY['高温半導体', 'ロジック', '集積回路', 'KSAC'],
   'investigating', 'grant_db',
   'KSAC GAPファンド 第2回 OD ものづくり 採択'),

  -- GX/カーボンリサイクル系 (3件)
  ('難分解性フッ素化合物 (PFAS) の温和光分解',
   '難分解性フッ素化合物 (PFAS) を温和な条件で光分解する技術。水・土壌の PFAS 規制対応。',
   '立命館大学', 'university', '滋賀県草津市',
   '小林 洋一', '教授', '生命科学部 応用化学科',
   'gx_circular', ARRAY['水処理', '土壌浄化', '環境'],
   ARRAY['PFAS', '光分解', 'フッ素化合物', '環境浄化', 'KSAC'],
   'investigating', 'grant_db',
   'KSAC GAPファンド 第2回 IV その他 採択'),

  ('低エネルギー高周波プラズマ アセチレン製造 (CO2 ゼロ)',
   'CO2 排出ゼロを実現する低エネルギー高周波プラズマによるアセチレン製造技術。化成品・燃料原料。',
   '京都工芸繊維大学', 'university', '京都府京都市',
   '比村 治彦', '教授', '電気電子工学系',
   'gx_circular', ARRAY['化成品', 'CCU', 'プラズマ化学'],
   ARRAY['プラズマ', 'アセチレン', 'CO2ゼロ', 'KSAC'],
   'investigating', 'grant_db',
   'KSAC GAPファンド 第2回 BCB ものづくり 採択'),

  ('海水からのグリーン水素製造',
   '海水を直接電解してグリーン水素を製造。淡水化前処理不要、低コスト・大規模水素生成。',
   '大阪大学', 'university', '大阪府吹田市',
   '片山 祐', '准教授', '産業科学研究所',
   'gx_energy', ARRAY['水素', 'GX', '海洋'],
   ARRAY['グリーン水素', '海水電解', '水素製造', 'KSAC'],
   'investigating', 'grant_db',
   'KSAC GAPファンド 第2回 PMF ものづくり 採択'),

  -- 異色シーズ (3件)
  ('木造人工衛星 (衛星コンステレーションビジネス向け)',
   '衛星コンステレーションビジネスに向けた木造人工衛星の開発。再突入時の完全燃焼で宇宙ゴミ低減。木材の宇宙耐性活用。',
   '京都大学', 'university', '京都府京都市',
   '仲村 匡司', '教授', '農学研究科',
   'materials', ARRAY['宇宙', '衛星', 'バイオマス'],
   ARRAY['木造衛星', 'LignoSat', '宇宙木材', 'KSAC'],
   'investigating', 'grant_db',
   'KSAC GAPファンド 第2回 IV その他 採択'),

  ('常温核融合炉 (発熱の高効率化)',
   '常温核融合炉の社会実装に向けた発熱の高効率化。脱炭素・脱放射能・純国産一次エネルギー源を目指す。異色シーズ。',
   '神戸大学', 'university', '兵庫県神戸市',
   '金崎 真聡', '准教授', '海事科学研究科',
   'gx_energy', ARRAY['エネルギー', '核融合'],
   ARRAY['常温核融合', 'LENR', '低エネルギー核反応', 'KSAC'],
   'investigating', 'grant_db',
   'KSAC GAPファンド 第2回 PSF その他 採択'),

  ('作物生体分子診断 (収量安定化・GHG削減)',
   '作物の生体分子診断を用いて、収量安定化や温室効果ガス削減を実現する生産管理システム。スマート農業 × CN。',
   '京都大学', 'university', '京都府京都市',
   '野田口 理孝', '教授', '理学研究科',
   'robo', ARRAY['アグリテック', '農業', 'GHG削減'],
   ARRAY['生体分子診断', 'スマート農業', 'GHG', 'KSAC'],
   'investigating', 'grant_db',
   'KSAC GAPファンド 第2回 PMF その他 採択');

-- =====================================================================
-- 採択補助金履歴 (KSAC GAP 第2回、11件分)
-- =====================================================================

INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'JST 大学発新産業創出基金事業 スタートアップ・エコシステム共創プログラム KSAC GAPファンド (第2回)', 'KSAC GAP 2nd', 2024, 'awarded',
       'https://ksac.site/ja/wp-content/themes/ksac/pdf/ksac-gap-result-2nd.pdf'
FROM seeds WHERE source_detail LIKE 'KSAC GAPファンド 第2回%';
