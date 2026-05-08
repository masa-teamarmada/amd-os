-- 027_seeds_data_round3.sql
--
-- Phase 1 初期投入 第3ラウンド。25 件追加 (NEP 14 件 + IJIE 10 件 + TeSH 1 件)。
--
-- データソース:
--   NEDO NEP 躍進コース 2024 採択者 PDF (100982057.pdf)
--   IJIE GAPファンド 2024 ステップ1/2 採択者 (ijie.jp/adopted/)
--   TeSH GAPファンド 2024 ステップ2 (jaist.ac.jp プレス)
--
-- NEP 注: NEP は「事業者 (法人 or 法人設立前個人)」が主体。法人化済のものも、
-- AMD のシーズリストには「事業化推進中の起業前後シーズ」として登録 (status='investigating')。
-- 法人化済シーズは AMD として「並走可能性のある外部ベンチャー」リストでもある。

-- =====================================================================
-- A. 既存「量産型グラフェン搭載 ヘルスケアデバイス」(慶應 牧英之 GTIE) を拡張
--    NEP 躍進3000 でも採択されているので summary 拡張 + seed_funding 追加
-- =====================================================================

UPDATE seeds
SET
  title = '量産型グラフェン (チップ上光源 / ヘルスケアデバイス) - 慶應 牧研',
  summary = '量産型グラフェン技術。GTIE では「グラフェン搭載ヘルスケアデバイス事業 (グローバル展開)」、NEP 躍進3000 ではグラフェナリー株式会社として「量産型チップ上グラフェンの革新的赤外光源・分析センシング事業」と二系統で展開。',
  keywords = ARRAY['グラフェン', 'ヘルスケアデバイス', '赤外光源', '分析センシング', '量産', 'GTIE', 'NEP'],
  source_detail = 'GTIE GAPファンド 2024 エクスプロールコース 採択 + NEP 躍進3000 2024 採択 (グラフェナリー)',
  updated_at = NOW()
WHERE researcher_name = '牧 英之' AND org_name = '慶應義塾大学';

INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'NEDO ディープテック分野 NEP 躍進コース 3000', 'NEP 躍進3000', 2024, 'awarded',
       'https://www.nedo.go.jp/content/100982057.pdf'
FROM seeds WHERE researcher_name = '牧 英之' AND org_name = '慶應義塾大学';

-- =====================================================================
-- B. NEP 躍進コース 2024 — 個人代表 (法人設立前) 4件
-- =====================================================================

INSERT INTO seeds (
  title, summary, org_name, org_type, org_region,
  researcher_name, researcher_title, lab_name,
  domain_lane, industry_target, keywords,
  status, source, source_detail
) VALUES
  ('アキシャルフィード式 大気圧プラズマ溶射装置',
   '次世代大気圧プラズマ溶射装置。アキシャルフィード方式で精密成膜。半導体・MEMS・耐熱コーティング向け。トヨチ合同会社として法人化進行中。',
   '不明 (個人代表)', 'private_lab', NULL,
   '豊田 建蔵', NULL, NULL,
   'materials', ARRAY['半導体', 'コーティング', '製造装置'],
   ARRAY['プラズマ溶射', 'アキシャルフィード', '成膜', 'NEP'],
   'investigating', 'grant_db',
   'NEP 躍進500 2024 採択 (トヨチ合同会社、提案時点で法人設立前)'),

  ('超小型センサヘッドによる多点非接触温度測定',
   '超小型センサヘッドで多点同時の非接触温度測定を実現。半導体製造・電池モニタリング向け。株式会社OICTとして事業化進行中。',
   '広島大学 (推定)', 'university', '広島県',
   '東 清一郎', NULL, NULL,
   'materials', ARRAY['半導体', '電池', 'プロセスモニタリング'],
   ARRAY['非接触温度', '多点センサ', '超小型', 'NEP'],
   'investigating', 'grant_db',
   'NEP 躍進500 2024 採択 (株式会社OICT、提案時点で法人設立前)'),

  ('C型肝炎撲滅向け 簡易診断キット',
   'C型肝炎の撲滅を目指した簡易診断キットの市場導入検討。NIMS 荏原研究室 (バイオマテリアル) のシーズを SPHinX 株式会社で展開中。',
   '物質・材料研究機構', 'national_lab', '茨城県つくば市',
   '荏原 充宏', NULL, '高分子・バイオ材料研究センター',
   'life', ARRAY['診断', '感染症'],
   ARRAY['C型肝炎', '簡易診断', 'バイオマテリアル', 'NEP', 'SPHinX'],
   'investigating', 'grant_db',
   'NEP 躍進500 2024 採択 (SPHinX 株式会社)'),

  ('超高感度磁気センサによる生体磁気計測',
   '超高感度磁気センサを用いた生体磁気計測。脳磁・心磁等の非侵襲計測デバイス。株式会社IZANAとして法人化進行中。',
   '不明 (個人代表)', 'private_lab', NULL,
   '大前 緩奈', NULL, NULL,
   'life', ARRAY['医療機器', '脳磁・心磁'],
   ARRAY['磁気センサ', '生体磁気', '脳磁', 'NEP'],
   'investigating', 'grant_db',
   'NEP 躍進500 2024 採択 (株式会社IZANA、提案時点で法人設立前)'),

  ('横隔神経刺激デバイス (人工呼吸器患者向け)',
   '人工呼吸器装着患者の長期化を防ぐ横隔神経刺激デバイス。VentEase株式会社として法人化進行中。',
   '不明 (個人代表)', 'private_lab', NULL,
   '篠倉 啓純', NULL, NULL,
   'life', ARRAY['医療機器', '呼吸器', 'ICU'],
   ARRAY['横隔神経', '人工呼吸器', '神経刺激', 'NEP', 'VentEase'],
   'investigating', 'grant_db',
   'NEP 躍進3000 2024 採択 (VentEase株式会社、提案時点で法人設立前)'),

  ('宇宙天気 AI 予報技術',
   '宇宙天気 AI 予報技術の事業化促進に向けた研究開発・実証。電力網・通信・衛星運用への影響予測。Space Weather Company として法人化進行中。',
   '不明 (個人代表)', 'private_lab', NULL,
   '高崎 宏之', NULL, NULL,
   'ict', ARRAY['宇宙', '電力', '衛星'],
   ARRAY['宇宙天気', 'AI予報', '太陽フレア', 'NEP'],
   'investigating', 'grant_db',
   'NEP 躍進3000 2024 採択 (Space Weather Company、提案時点で法人設立前)'),

-- =====================================================================
-- C. NEP 躍進コース 2024 — 法人化済 (注目ディープテック 8件)
-- =====================================================================

  ('植物 CO2 固定機能を向上させる資源循環型有機肥料',
   '植物の CO2 固定機能を向上させる資源循環型有機肥料の開発。農業由来 CO2 削減 × 食料生産。株式会社WAKUとして事業化中。',
   '不明 (法人化済)', 'private_lab', NULL,
   NULL, NULL, NULL,
   'gx_circular', ARRAY['農業', 'CCU', '有機肥料'],
   ARRAY['CO2固定', '資源循環', '有機肥料', 'NEP', 'WAKU'],
   'investigating', 'grant_db',
   'NEP 躍進3000 2024 採択 (株式会社WAKU)'),

  ('エクソソーム創薬向け高回収率・高純度精製技術',
   'エクソソーム創薬に向けた高回収率・高純度精製技術の事業化。徳島大学発ベンチャー Egret・Lab として展開。',
   '徳島大学', 'university', '徳島県徳島市',
   NULL, NULL, NULL,
   'life', ARRAY['創薬', 'エクソソーム', 'バイオ製造'],
   ARRAY['エクソソーム', '精製技術', '創薬支援', 'NEP', 'Egret・Lab'],
   'investigating', 'grant_db',
   'NEP 躍進500 2024 採択 (株式会社Egret・Lab、徳島大学発ベンチャー)'),

  ('革新的プロトン伝導膜による アンモニア電解合成',
   '革新的プロトン伝導膜を利用したアンモニア電解合成デバイス。グリーン水素・グリーンアンモニアの常温・低圧合成。株式会社QioN として展開。',
   '不明 (法人化済)', 'private_lab', NULL,
   NULL, NULL, NULL,
   'gx_energy', ARRAY['アンモニア', '水素', 'GX'],
   ARRAY['プロトン伝導膜', 'アンモニア合成', '電解合成', 'NEP', 'QioN'],
   'investigating', 'grant_db',
   'NEP 躍進3000 2024 採択 (株式会社QioN)'),

  ('バイオガスを原料とする 光オンデマンド化学品生産',
   'バイオガスを原料とする光オンデマンド化学品生産事業。光触媒で必要な化学品を必要な時だけ生産。光オンデマンドケミカル株式会社として展開。',
   '不明 (法人化済)', 'private_lab', NULL,
   NULL, NULL, NULL,
   'gx_circular', ARRAY['化成品', 'バイオガス', '光触媒'],
   ARRAY['光オンデマンド', 'バイオガス', '化学品', 'NEP'],
   'investigating', 'grant_db',
   'NEP 躍進3000 2024 採択 (光オンデマンドケミカル株式会社)'),

  ('MOF (金属有機構造体) を用いた分子構造決定技術',
   'MOF (Metal-Organic Framework) を用いた分子構造決定技術。創薬・有機合成・触媒分野でのパラダイムシフト候補。テクモフ株式会社として展開。',
   '不明 (法人化済)', 'private_lab', NULL,
   NULL, NULL, NULL,
   'materials', ARRAY['創薬支援', '分析装置', '材料解析'],
   ARRAY['MOF', '分子構造解析', '結晶スポンジ法', 'NEP', 'テクモフ'],
   'investigating', 'grant_db',
   'NEP 躍進3000 2024 採択 (テクモフ株式会社)'),

  ('ダイヤモンド電子舌センサ (溶液ビッグデータ)',
   '溶液のビッグデータを取得するダイヤモンド電子舌センサの量産化。化学・食品・医薬品の溶液品質モニタリング。株式会社ExtenD として展開。',
   '不明 (法人化済)', 'private_lab', NULL,
   NULL, NULL, NULL,
   'materials', ARRAY['食品', '化学', '医薬', 'センサ'],
   ARRAY['ダイヤモンド', '電子舌', '溶液センサ', 'NEP', 'ExtenD'],
   'investigating', 'grant_db',
   'NEP 躍進3000 2024 採択 (株式会社ExtenD)'),

  ('血管新生治療薬 (新規アプローチ)',
   '新しいアプローチによる血管新生治療薬の開発。虚血性疾患・創傷治癒向け。株式会社Walkable Future として展開。',
   '不明 (法人化済)', 'private_lab', NULL,
   NULL, NULL, NULL,
   'life', ARRAY['創薬', '虚血性疾患', '創傷治癒'],
   ARRAY['血管新生', '治療薬', 'NEP', 'Walkable Future'],
   'investigating', 'grant_db',
   'NEP 躍進3000 2024 採択 (株式会社Walkable Future)'),

  ('し尿から栄養素資源を回収するシステム',
   'し尿から窒素・リン等の栄養素資源を回収するシステムの制御技術。インフラ未整備地域・宇宙・離島向け。株式会社Nocnum として展開。',
   '不明 (法人化済)', 'private_lab', NULL,
   NULL, NULL, NULL,
   'gx_circular', ARRAY['水処理', '栄養素回収', 'インフラ'],
   ARRAY['し尿', '栄養素回収', '窒素', 'リン', 'NEP', 'Nocnum'],
   'investigating', 'grant_db',
   'NEP 躍進500 2024 採択 (株式会社Nocnum)'),

-- =====================================================================
-- D. IJIE GAPファンド 2024 ステップ2 (信州大、2件)
-- =====================================================================

  ('アップサイクル水熱・酵素技術 地域資源循環',
   'アップサイクル用水熱・酵素技術を活用した地域資源循環による新規産業創出。バイオマス・農業残渣・食品残渣の高付加価値化。',
   '信州大学', 'university', '長野県',
   '天野 良彦', '教授', NULL,
   'gx_circular', ARRAY['バイオマス', 'アップサイクル', '地域循環'],
   ARRAY['水熱', '酵素', 'アップサイクル', '地域資源', 'IJIE'],
   'investigating', 'grant_db',
   'IJIE GAPファンド 2024 ステップ2 採択 (みらい創造インベストメンツ事業化推進)'),

  ('極超低圧駆動 超高透水逆浸透膜',
   '極超低圧で駆動する超高透水逆浸透膜・モジュールの製造・販売事業。海水淡水化・水処理コストの劇的低減。',
   '信州大学', 'university', '長野県',
   '遠藤 守信', '特別特任教授', NULL,
   'gx_circular', ARRAY['水処理', '海水淡水化', '膜分離'],
   ARRAY['逆浸透膜', '超低圧', '超高透水', 'IJIE'],
   'investigating', 'grant_db',
   'IJIE GAPファンド 2024 ステップ2 採択 (丸紅 事業化推進)'),

-- =====================================================================
-- E. IJIE GAPファンド 2024 ステップ1 (厳選 8件)
-- =====================================================================

  ('血友病A 革新的遺伝子治療薬',
   '革新的な血友病Aに対する遺伝子治療薬の創出。AAV ベクター系の改良で長期持続性・安全性を向上。',
   '自治医科大学', 'university', '栃木県下野市',
   '大森 司', NULL, NULL,
   'life', ARRAY['遺伝子治療', '希少疾患'],
   ARRAY['血友病A', '遺伝子治療', 'AAV', 'IJIE'],
   'investigating', 'grant_db',
   'IJIE GAPファンド 2024 ステップ1 プレ 採択'),

  ('炭素材料 革新的分子構造解析技術',
   '炭素材料 (グラフェン・CNT・カーボンブラック等) の革新的分子構造解析技術。電池・複合材料・電子材料向け。',
   '群馬大学', 'university', '群馬県',
   '石井 孝文', NULL, NULL,
   'materials', ARRAY['カーボン素材', '電池', '複合材料'],
   ARRAY['炭素材料', '分子構造解析', 'グラフェン', 'IJIE'],
   'investigating', 'grant_db',
   'IJIE GAPファンド 2024 ステップ1 プレ 採択 (起業済)'),

  ('自家細胞 心筋再生治療',
   '自家細胞を用いた心筋再生治療の実用化開発。重症心不全向け次世代再生医療。',
   '信州大学', 'university', '長野県松本市',
   '柴 祐司', NULL, NULL,
   'life', ARRAY['再生医療', '心筋'],
   ARRAY['自家細胞', '心筋再生', '心不全', 'IJIE'],
   'investigating', 'grant_db',
   'IJIE GAPファンド 2024 ステップ1 プレ 採択'),

  ('AR/MR ホログラフィック導光板デバイス',
   'AR/MR 用ホログラフィック導光板デバイス。次世代 XR 表示の基盤光学素子。',
   '宇都宮大学', 'university', '栃木県宇都宮市',
   '藤村 隆史', NULL, NULL,
   'materials', ARRAY['XR', 'AR/MR', '光学'],
   ARRAY['ホログラフィック', '導光板', 'AR/MR', 'IJIE'],
   'investigating', 'grant_db',
   'IJIE GAPファンド 2024 ステップ1 プレ 採択'),

  ('免疫モジュレーター抗がん剤',
   '免疫モジュレーター因子を用いた抗がん剤開発。免疫チェックポイント阻害剤の次世代候補。',
   '群馬大学', 'university', '群馬県',
   '二村 圭祐', NULL, NULL,
   'life', ARRAY['創薬', 'がん免疫'],
   ARRAY['免疫モジュレーター', '抗がん剤', 'IJIE'],
   'investigating', 'grant_db',
   'IJIE GAPファンド 2024 ステップ1 プレ 採択'),

  ('スマートインフルエンザウイルス 肺疾患ウイルス療法',
   'ゲノム改変スマートインフルエンザウイルスを用いた肺疾患のウイルス療法。',
   '信州大学', 'university', '長野県松本市',
   '小笠原 慎治', NULL, NULL,
   'life', ARRAY['創薬', '呼吸器', 'ウイルス療法'],
   ARRAY['ウイルス療法', 'インフルエンザウイルス', '肺疾患', 'IJIE'],
   'investigating', 'grant_db',
   'IJIE GAPファンド 2024 ステップ1 プレ 採択'),

  ('オンデマンド富化酸素供給 高速気体分離膜',
   'オンデマンド富化酸素供給用の高速気体分離膜材料の開発・製造。在宅酸素療法・産業用酸素生成。',
   '信州大学', 'university', '長野県',
   '大塚 隼人', NULL, NULL,
   'materials', ARRAY['医療機器', '産業ガス', '膜分離'],
   ARRAY['気体分離膜', '酸素供給', 'オンデマンド', 'IJIE'],
   'investigating', 'grant_db',
   'IJIE GAPファンド 2024 ステップ1 プレ 採択'),

  ('AI サクランボ自動選果機 (アグリテック)',
   'AI 技術を搭載したサクランボ自動選果機。果実の高度判別 × ロボット選果。',
   '山梨大学', 'university', '山梨県甲府市',
   '小谷 信司', NULL, NULL,
   'robo', ARRAY['アグリテック', '果樹', '選果'],
   ARRAY['AI', '選果', 'サクランボ', 'アグリテック', 'IJIE'],
   'investigating', 'grant_db',
   'IJIE GAPファンド 2024 ステップ1 プレ 採択'),

-- =====================================================================
-- F. TeSH GAPファンド 2024 ステップ2 (1件、JAIST)
-- =====================================================================

  ('超越がん細菌療法',
   '改変細菌を腫瘍内へ送達し、特異的に腫瘍を破壊する次世代がん細菌療法。固形がん向け新規モダリティ。',
   '北陸先端科学技術大学院大学', 'university', '石川県能美市',
   '都 英次郎', '教授', '物質化学フロンティア研究領域',
   'life', ARRAY['創薬', 'がん治療', '細菌療法'],
   ARRAY['細菌療法', 'がん', 'バクテリアセラピー', 'TeSH'],
   'investigating', 'grant_db',
   'TeSH GAPファンド 2024 ステップ2 採択 (QBキャピタル合同会社 事業化推進、最大3年・6,000万円)');

-- =====================================================================
-- 採択補助金履歴 (seed_funding) を一括投入
-- =====================================================================

-- NEP 躍進500 (5件: 牧除く)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'NEDO ディープテック分野 NEP 躍進コース 500', 'NEP 躍進500', 2024, 'awarded',
       'https://www.nedo.go.jp/content/100982057.pdf'
FROM seeds WHERE source_detail LIKE 'NEP 躍進500 2024 採択%';

-- NEP 躍進3000 (8件: 牧除く)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'NEDO ディープテック分野 NEP 躍進コース 3000', 'NEP 躍進3000', 2024, 'awarded',
       'https://www.nedo.go.jp/content/100982057.pdf'
FROM seeds WHERE source_detail LIKE 'NEP 躍進3000 2024 採択%';

-- IJIE ステップ2 (2件)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'JST 大学発新産業創出基金事業 IJIE GAPファンド (ステップ2)', 'IJIE GAP S2', 2024, 'awarded',
       'https://ijie.jp/adopted/adopted-cat/step2_2024/'
FROM seeds WHERE source_detail LIKE 'IJIE GAPファンド 2024 ステップ2%';

-- IJIE ステップ1 (8件)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'JST 大学発新産業創出基金事業 IJIE GAPファンド (ステップ1 プレ)', 'IJIE GAP S1', 2024, 'awarded',
       'https://ijie.jp/adopted/adopted-cat/step1_2024/'
FROM seeds WHERE source_detail LIKE 'IJIE GAPファンド 2024 ステップ1%';

-- TeSH ステップ2 (1件)
INSERT INTO seed_funding (seed_id, program, program_short, amount_jpy, fiscal_year, status, source_url)
SELECT id, 'JST 大学発新産業創出基金事業 TeSH GAPファンド (ステップ2)', 'TeSH GAP S2', 60000000, 2024, 'awarded',
       'https://www.jaist.ac.jp/whatsnew/info/2024/12/25-2.html'
FROM seeds WHERE source_detail LIKE 'TeSH GAPファンド 2024 ステップ2%';
