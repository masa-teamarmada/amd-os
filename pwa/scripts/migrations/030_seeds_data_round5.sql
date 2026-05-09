-- 030_seeds_data_round5.sql
--
-- Phase 1 第5ラウンド。26 件追加 (JST START SBIR 5 + AMED preF 8 + AMED シーズB 3 + NEDO 先導研究 10)。
--
-- データソース:
--   JST START プロジェクト推進型 SBIRフェーズ1 2024 採択 (start/sbir/project2024.html)
--   AMED 令和6年度 橋渡し研究プログラム preF / シーズB (1601C_00053)
--   NEDO 先導研究プログラム 2024 採択 (別紙1 PDF, 100977335.pdf)
--
-- NEDO 先導研究は「実施体制 = 複数機関連携」型のため、代表機関 (一覧の先頭) を org_name に。
-- researcher_name は PDF に記載なしのため NULL。

-- =====================================================================
-- A. JST START SBIRフェーズ1 2024 採択 (5件、AMD レーン適合)
-- =====================================================================

INSERT INTO seeds (
  title, summary, org_name, org_type, org_region,
  researcher_name, researcher_title, lab_name,
  domain_lane, industry_target, keywords,
  status, source, source_detail
) VALUES
  ('マルチバンド対応 再構成可能 電波吸収体 (Beyond 5G/6G)',
   'ミリ波・テラヘルツ帯モジュールの広帯域不要電波を抑制する再構成可能電波吸収体。Beyond 5G(6G) インフラ向け。',
   '東京工業大学', 'university', '東京都目黒区',
   'イ サンヨプ', NULL, '科学技術創成研究院',
   'materials', ARRAY['通信', '6G', '電磁波制御'],
   ARRAY['電波吸収体', 'Beyond 5G', '6G', 'メタマテリアル', 'JST SBIR'],
   'investigating', 'grant_db',
   'JST START SBIRフェーズ1 2024 採択 (Beyond 5G分野)'),

  ('軽量・電源レス AR ディスプレイ空間技術',
   '投影・表示系分離構成による軽量で電源不要な AR ディスプレイ空間技術。次世代 XR インフラ。',
   '東京大学', 'university', '東京都文京区',
   '伊藤 勇太', NULL, '大学院情報学環',
   'materials', ARRAY['XR', 'AR', 'ディスプレイ'],
   ARRAY['AR', 'ディスプレイ', '軽量', '電源レス', 'JST SBIR'],
   'investigating', 'grant_db',
   'JST START SBIRフェーズ1 2024 採択 (Beyond 5G分野)'),

  ('リグニン由来 PDC (プラットフォームケミカル) 大量発酵生産',
   '未利用木質資源リグニンから微生物機能で 2-ピロン-4,6-ジカルボン酸 (PDC) を大量発酵生産。石油化学原料代替バイオ素材。',
   '森林研究・整備機構 森林総合研究所', 'national_lab', '茨城県つくば市',
   '中村 雅哉', NULL, NULL,
   'gx_circular', ARRAY['化成品', 'バイオマス', '森林'],
   ARRAY['リグニン', 'PDC', 'バイオプラスチック', '木質バイオマス', 'JST SBIR'],
   'investigating', 'grant_db',
   'JST START SBIRフェーズ1 2024 採択 (木質バイオマス分野)'),

  ('自律移動 波浪観測小型ブイ × AI',
   '自転により移動可能な波浪観測用小型ブイと AI による波高計測システム。海洋気象・港湾・洋上風力向け。',
   '東京電機大学', 'university', '東京都足立区',
   '藤川 太郎', NULL, '未来科学部',
   'robo', ARRAY['海洋', '気象', '洋上風力'],
   ARRAY['波浪観測', '自律ブイ', 'AI', 'JST SBIR'],
   'investigating', 'grant_db',
   'JST START SBIRフェーズ1 2024 採択 (波浪観測分野)'),

  ('MEMS差圧センサ 波高センサ',
   'MEMS 差圧センサ (ピエゾ抵抗型カンチレバー) を用いた低価格・低消費電力・小型化波高センサ。',
   '慶應義塾大学', 'university', '東京都港区',
   '高橋 英俊', NULL, '理工学部',
   'materials', ARRAY['海洋', 'センサ'],
   ARRAY['MEMS', '差圧センサ', '波高センサ', 'JST SBIR'],
   'investigating', 'grant_db',
   'JST START SBIRフェーズ1 2024 採択 (波浪観測分野)'),

  -- =====================================================================
  -- B. AMED 令和6年度 preF (8件、Round 2 で1件のみ → 残りから厳選)
  -- =====================================================================

  ('粘膜再生 生体吸収性組織再生デバイス',
   '粘膜再生に最適化した生体吸収性組織再生デバイス。消化管・呼吸器粘膜の修復医療機器。',
   '香川大学', 'university', '香川県木田郡',
   '宮下 武憲', NULL, NULL,
   'life', ARRAY['医療機器', '再生医療', '消化器'],
   ARRAY['生体吸収性', '粘膜再生', '組織再生', 'AMED preF'],
   'investigating', 'grant_db',
   'AMED 令和6年度 橋渡し研究プログラム preF 採択'),

  ('神経芽腫向け CAR-NK 細胞療法 (T/NK 前駆細胞)',
   'T/NK 前駆細胞を用いた神経芽腫に対する CAR-NK 細胞療法。小児がん新規モダリティ。',
   '東京理科大学', 'university', '東京都新宿区',
   '伊川 友活', NULL, NULL,
   'life', ARRAY['創薬', 'がん免疫', '小児がん'],
   ARRAY['CAR-NK', '神経芽腫', 'T/NK前駆細胞', 'AMED preF'],
   'investigating', 'grant_db',
   'AMED 令和6年度 橋渡し研究プログラム preF 採択'),

  ('睡眠中音刺激による PTSD 新規治療法',
   '睡眠中の音刺激を用いて PTSD 病的記憶を消去する非薬物治療法。神経精神医療向け新規モダリティ。',
   '筑波大学', 'university', '茨城県つくば市',
   '坂口 昌徳', NULL, NULL,
   'life', ARRAY['精神医療', '神経科学'],
   ARRAY['PTSD', '睡眠中音刺激', '記憶消去', 'AMED preF'],
   'investigating', 'grant_db',
   'AMED 令和6年度 橋渡し研究プログラム preF 採択'),

  ('糖鎖修飾 GLP-1 点鼻薬 (アルツハイマー)',
   'アルツハイマー病の原因蛋白を標的とした糖鎖修飾 Glucagon-like Peptide-1 誘導体点鼻薬。経鼻 BBB 透過。',
   '東京理科大学', 'university', '東京都新宿区',
   '山下 親正', NULL, NULL,
   'life', ARRAY['創薬', 'アルツハイマー', '点鼻'],
   ARRAY['GLP-1', '糖鎖修飾', '点鼻薬', 'アルツハイマー', 'AMED preF'],
   'investigating', 'grant_db',
   'AMED 令和6年度 橋渡し研究プログラム preF 採択'),

  ('腫瘍微小環境 次世代代謝阻害剤',
   '腫瘍微小環境の代謝システムを制御する次世代代謝阻害剤。がん細胞の代謝依存性を標的。',
   '東京大学', 'university', '東京都文京区',
   '大澤 毅', NULL, NULL,
   'life', ARRAY['創薬', 'がん治療'],
   ARRAY['代謝阻害', '腫瘍微小環境', '抗がん剤', 'AMED preF'],
   'investigating', 'grant_db',
   'AMED 令和6年度 橋渡し研究プログラム preF 採択'),

  ('非麻薬性オピオイド鎮痛薬 (がん緩和医療)',
   'がん緩和医療および支持療法拡充のための依存性のない強力な非麻薬性オピオイド鎮痛薬。',
   '国立がん研究センター', 'national_lab', '東京都中央区',
   '成田 年', NULL, NULL,
   'life', ARRAY['創薬', '緩和医療', 'がん支持療法'],
   ARRAY['非麻薬性', 'オピオイド', '鎮痛薬', 'AMED preF'],
   'investigating', 'grant_db',
   'AMED 令和6年度 橋渡し研究プログラム preF 採択'),

  ('iPS細胞由来 骨癒合特化型 血小板製剤',
   '骨癒合に特化した iPS 細胞由来血小板製剤。整形外科向け再生医療。',
   '千葉大学', 'university', '千葉県千葉市',
   '志賀 康浩', NULL, NULL,
   'life', ARRAY['再生医療', '整形外科', '血液製剤'],
   ARRAY['iPS細胞', '血小板製剤', '骨癒合', 'AMED preF'],
   'investigating', 'grant_db',
   'AMED 令和6年度 橋渡し研究プログラム preF 採択'),

  ('クロスリアリティ × 運動錯覚 麻痺治療医療機器',
   'クロスリアリティ (XR) 技術を用いた運動錯覚誘導による感覚運動麻痺治療医療機器。脳卒中後リハビリ向け。',
   '東京都立大学', 'university', '東京都八王子市',
   '金子 文成', NULL, NULL,
   'life', ARRAY['医療機器', 'XR', 'リハビリ'],
   ARRAY['クロスリアリティ', '運動錯覚', '麻痺治療', 'AMED preF'],
   'investigating', 'grant_db',
   'AMED 令和6年度 橋渡し研究プログラム preF 採択'),

  -- =====================================================================
  -- C. AMED 令和6年度 シーズB (3件、AMD 視点 interesting)
  -- =====================================================================

  ('腱保護ハイドロゲル (腱損傷術後の可動域制限予防)',
   '腱損傷に対する手術後の可動域制限を予防するための腱保護用ハイドロゲル。整形外科医療材料。',
   '東京大学', 'university', '東京都文京区',
   '齋藤 琢', NULL, NULL,
   'life', ARRAY['医療機器', '整形外科'],
   ARRAY['ハイドロゲル', '腱保護', '可動域制限', 'AMED シーズB'],
   'investigating', 'grant_db',
   'AMED 令和6年度 橋渡し研究プログラム シーズB 採択'),

  ('一酸化炭素注腸投与 潰瘍性大腸炎治療',
   'ガス状治療分子としての一酸化炭素注腸投与による新規潰瘍性大腸炎治療法。希少難治性疾患向け。',
   '京都府立医科大学', 'university', '京都府京都市',
   '髙木 智久', NULL, NULL,
   'life', ARRAY['創薬', '消化器', '希少疾患'],
   ARRAY['一酸化炭素', 'ガス状治療', '潰瘍性大腸炎', 'AMED シーズB'],
   'investigating', 'grant_db',
   'AMED 令和6年度 橋渡し研究プログラム シーズB 採択'),

  ('特殊環状ペプチド 筋ジストロフィー疾患修飾療法',
   '特殊環状ペプチドによる筋ジストロフィー疾患修飾療法。希少疾患向け新規モダリティ。',
   '川崎医科大学', 'university', '岡山県倉敷市',
   '砂田 芳秀', NULL, NULL,
   'life', ARRAY['創薬', '希少疾患', '神経筋'],
   ARRAY['環状ペプチド', '筋ジストロフィー', '疾患修飾療法', 'AMED シーズB'],
   'investigating', 'grant_db',
   'AMED 令和6年度 橋渡し研究プログラム シーズB 採択'),

  -- =====================================================================
  -- D. NEDO 先導研究プログラム 2024 (10件、AMD レーン適合・革新性)
  -- =====================================================================

  ('易分解・軽量・低環境負荷 サステナブル PV モジュール (太陽電池リサイクル)',
   '太陽電池のリサイクル資源を経済合理性をもって太陽電池製造に利活用する革新的技術。サーキュラー型 PV。',
   '早稲田大学', 'university', '東京都新宿区',
   NULL, NULL, NULL,
   'gx_energy', ARRAY['太陽電池', 'GX', 'サーキュラー'],
   ARRAY['PV', 'リサイクル', 'サステナブル', '太陽電池', 'NEDO先導'],
   'investigating', 'grant_db',
   'NEDO 先導研究プログラム 2024 採択 (Ⅰ-A1 / 早大+東工大+九大+産総研+カネカ)'),

  ('浮体式洋上風力 HPC × AI 連携 解析技術',
   '浮体式洋上風力発電システム設計合理化に向けた革新的解析・評価技術。HPC × AI 連携活用型。',
   '東京大学', 'university', '東京都文京区',
   NULL, NULL, NULL,
   'gx_energy', ARRAY['洋上風力', 'GX', 'シミュレーション'],
   ARRAY['浮体式洋上風力', 'HPC', 'AI', '解析', 'NEDO先導'],
   'investigating', 'grant_db',
   'NEDO 先導研究プログラム 2024 採択 (Ⅰ-B1 / 東大+豊橋技科大ほか)'),

  ('液化アンモニアによる微細藻類 SAF 製造 (湿潤藻類成分抽出)',
   '微細藻類由来 SAF (持続可能航空燃料) 製造における乾燥・抽出工程の革新的高効率化・低コスト化。液化アンモニア利用。',
   '電力中央研究所', 'private_lab', '東京都狛江市',
   NULL, NULL, NULL,
   'gx_energy', ARRAY['SAF', '航空燃料', 'バイオマス'],
   ARRAY['SAF', '微細藻類', '液化アンモニア', 'バイオ燃料', 'NEDO先導'],
   'investigating', 'grant_db',
   'NEDO 先導研究プログラム 2024 採択 (Ⅰ-D1 / 電中研+東大ほか)'),

  ('低温型電解 アルミニウム高純度化',
   'ベースメタル資源循環を促進する革新的リサイクル技術。低温型電解法によるアルミニウムの高純度化プロセス。',
   '株式会社UACJ', 'private_lab', '東京都千代田区',
   NULL, NULL, NULL,
   'gx_circular', ARRAY['ベースメタル', 'リサイクル', '素材'],
   ARRAY['アルミニウム', '電解', 'リサイクル', 'NEDO先導'],
   'investigating', 'grant_db',
   'NEDO 先導研究プログラム 2024 採択 (Ⅰ-E1 / UACJ+北大+岩手大+千葉大+京大+日本軽金属)'),

  ('糖骨格利用型 バイオテレフタル酸合成',
   '革新的触媒や複合化技術により、生物特有の化学構造を活かして得られる機能性プラスチック・原料モノマー。',
   '東レ株式会社', 'private_lab', '東京都中央区',
   NULL, NULL, NULL,
   'gx_circular', ARRAY['バイオプラスチック', '化成品', '素材'],
   ARRAY['バイオテレフタル酸', '糖骨格', '機能性ポリマー', 'NEDO先導'],
   'investigating', 'grant_db',
   'NEDO 先導研究プログラム 2024 採択 (Ⅰ-G1 / 東レ+北大+日揮)'),

  ('省資源・軽量・高性能 有機リチウムイオン二次電池',
   '蓄電池の資源リスクフリー化。省資源・軽量・高性能な有機リチウムイオン二次電池。希少金属代替。',
   '慶應義塾大学', 'university', '東京都港区',
   NULL, NULL, NULL,
   'gx_energy', ARRAY['蓄電池', 'EV', 'GX'],
   ARRAY['有機リチウム電池', '資源リスクフリー', '希少金属代替', 'NEDO先導'],
   'investigating', 'grant_db',
   'NEDO 先導研究プログラム 2024 採択 (Ⅰ-H1 / 慶應+ソフトバンク)'),

  ('縦型ダイヤモンド パワー MOSFET (社会実装向け)',
   '社会実装を見据えた縦型ダイヤモンドパワー MOSFET の要素技術開発。EV・電力インフラ向け次世代パワー半導体。',
   '株式会社Power Diamond Systems', 'private_lab', NULL,
   NULL, NULL, NULL,
   'materials', ARRAY['パワー半導体', 'EV', '電力'],
   ARRAY['ダイヤモンド', 'パワーMOSFET', '縦型', 'NEDO先導'],
   'investigating', 'grant_db',
   'NEDO 先導研究プログラム 2024 採択 (Ⅰ-I1 / Power Diamond Systems+早大+九工大)'),

  ('トポロジカル物質 ユニバーサルメモリ',
   '革新的構造・材料を用いた次世代メモリ技術。トポロジカル物質を用いたユニバーサルメモリ (DRAM+不揮発性融合)。',
   'TopoLogic株式会社', 'private_lab', '東京都',
   NULL, NULL, NULL,
   'materials', ARRAY['半導体', 'メモリ', 'AI'],
   ARRAY['トポロジカル物質', 'ユニバーサルメモリ', '次世代メモリ', 'NEDO先導'],
   'investigating', 'grant_db',
   'NEDO 先導研究プログラム 2024 採択 (Ⅰ-I2 / TopoLogic+JSR+京大+早大+東大)'),

  ('アンモニア燃焼 ハイブリッド航空推進',
   '脱炭素化に向けた次世代航空機向けアンモニア燃焼技術。ハイブリッド航空推進システム。',
   '東北大学', 'university', '宮城県仙台市',
   NULL, NULL, NULL,
   'gx_energy', ARRAY['航空', 'GX', 'アンモニア'],
   ARRAY['アンモニア燃焼', '航空推進', 'ハイブリッド', 'NEDO先導'],
   'investigating', 'grant_db',
   'NEDO 先導研究プログラム 2024 採択 (Ⅰ-L1 / 東北大+三菱重工+広島大)'),

  ('次世代量子コンピュータ 部素材設計・評価技術',
   '量子コンピュータ大規模化に資する次世代部素材の設計・評価技術。半導体製造装置・素材サプライヤー支援。',
   '産業技術総合研究所', 'national_lab', '茨城県つくば市',
   NULL, NULL, NULL,
   'materials', ARRAY['量子コンピュータ', '半導体', '素材'],
   ARRAY['量子コンピュータ', '部素材', 'NEDO先導'],
   'investigating', 'grant_db',
   'NEDO 先導研究プログラム 2024 採択 (Ⅱ-A1 / 産総研+アドバンテスト)');

-- =====================================================================
-- 採択補助金履歴 (seed_funding) を一括投入
-- =====================================================================

-- JST START SBIR フェーズ1 (5件)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'JST 大学発新産業創出プログラム (START) プロジェクト推進型 SBIRフェーズ1支援', 'JST START SBIR1', 2024, 'awarded',
       'https://www.jst.go.jp/start/sbir/project2024.html'
FROM seeds WHERE source_detail LIKE 'JST START SBIRフェーズ1 2024 採択%';

-- AMED preF (8件)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'AMED 令和6年度 橋渡し研究プログラム preF', 'AMED preF', 2024, 'awarded',
       'https://www.amed.go.jp/koubo/16/01/1601C_00053.html'
FROM seeds
WHERE source_detail = 'AMED 令和6年度 橋渡し研究プログラム preF 採択'
  AND researcher_name IN ('宮下 武憲', '伊川 友活', '坂口 昌徳', '山下 親正', '大澤 毅', '成田 年', '志賀 康浩', '金子 文成');

-- AMED シーズB (3件)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'AMED 令和6年度 橋渡し研究プログラム シーズB', 'AMED シーズB', 2024, 'awarded',
       'https://www.amed.go.jp/koubo/16/01/1601C_00053.html'
FROM seeds WHERE source_detail = 'AMED 令和6年度 橋渡し研究プログラム シーズB 採択';

-- NEDO 先導研究 (10件)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'NEDO 先導研究プログラム / 新技術先導研究プログラム', 'NEDO 先導研究', 2024, 'awarded',
       'https://www.nedo.go.jp/koubo/SM3_100001_00062.html'
FROM seeds WHERE source_detail LIKE 'NEDO 先導研究プログラム 2024 採択%';

-- =====================================================================
-- 採択ニュース (seed_news) を一括投入
-- =====================================================================

-- JST START SBIR
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'JST START SBIRフェーズ1 2024 採択 — ' || title,
       '2024-09-01', 'https://www.jst.go.jp/start/sbir/project2024.html',
       'manual', true
FROM seeds WHERE source_detail LIKE 'JST START SBIRフェーズ1 2024 採択%'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- AMED preF (新規 8件、Round 2 で追加した3件は既に news 入ってる)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'AMED 令和6年度 橋渡し研究プログラム preF 採択 — ' || title,
       '2024-10-01', 'https://www.amed.go.jp/koubo/16/01/1601C_00053.html',
       'manual', true
FROM seeds
WHERE source_detail = 'AMED 令和6年度 橋渡し研究プログラム preF 採択'
  AND researcher_name IN ('宮下 武憲', '伊川 友活', '坂口 昌徳', '山下 親正', '大澤 毅', '成田 年', '志賀 康浩', '金子 文成')
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- AMED シーズB
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'AMED 令和6年度 橋渡し研究プログラム シーズB 採択 — ' || title,
       '2024-10-01', 'https://www.amed.go.jp/koubo/16/01/1601C_00053.html',
       'manual', true
FROM seeds WHERE source_detail = 'AMED 令和6年度 橋渡し研究プログラム シーズB 採択'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- NEDO 先導研究
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'NEDO 先導研究プログラム 2024 採択 — ' || title,
       '2024-09-01', 'https://www.nedo.go.jp/koubo/SM3_100001_00062.html',
       'manual', true
FROM seeds WHERE source_detail LIKE 'NEDO 先導研究プログラム 2024 採択%'
ON CONFLICT (seed_id, source_url) DO NOTHING;
