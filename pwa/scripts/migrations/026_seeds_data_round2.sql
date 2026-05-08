-- 026_seeds_data_round2.sql
--
-- Phase 1 初期投入 第2ラウンド。30 件追加。
--
-- データソース:
--   Tongali GAPファンド ステップ2 2024 (gapfund2024-step2)
--   KSAC GAPファンド 2024 第1回 (1st.gapfund2024)
--   MASP みちのくGAPファンド 2024 (michinokugapfund2024)
--   GTIE GAPファンド 2024 エクスプロール (gap-fund/explore/2024-1/)
--   PARKS GAPファンド 2024 ステップ2-1 (parks-startup プレス)
--   AMED 令和6年度 橋渡し研究プログラム (1601C_00053)
--
-- 全て status='investigating' (= GAPファンド等で公的資金獲得済、AMD は未接触で技術調査段階)。
-- 採択補助金は seed_funding に同時記録。

INSERT INTO seeds (
  title, summary, org_name, org_type, org_region,
  researcher_name, researcher_title, lab_name,
  domain_lane, industry_target, keywords,
  status, source, source_detail
) VALUES
  -- ========== Tongali GAPファンド ステップ2 2024 (5件) ==========
  ('汎用外観検査AI (大規模画像言語マルチモーダルモデル)',
   'あらゆる検査を言語と画像の例示だけで実現する、大規模画像言語マルチモーダルモデルによる汎用外観検査 AI。製造・物流・インフラ点検など適用範囲広い。',
   '岐阜大学', 'university', '岐阜県', '加藤 邦人', NULL, NULL,
   'robo', ARRAY['製造業', '検査', 'AI'], ARRAY['外観検査', 'マルチモーダル', '画像言語', 'Tongali'],
   'investigating', 'grant_db', 'Tongali GAPファンド ステップ2 2024 採択'),
  ('間質性肺炎オンライン合議診断 SaMD',
   '全国疾患レジストリを背景とした間質性肺炎のオンライン合議診断プラットフォームと革新的診断・治療 SaMD。',
   '名古屋大学', 'university', '愛知県名古屋市', '古川 大記', NULL, NULL,
   'life', ARRAY['SaMD', '呼吸器', '希少疾患'], ARRAY['間質性肺炎', 'SaMD', 'レジストリ', 'Tongali'],
   'investigating', 'grant_db', 'Tongali GAPファンド ステップ2 2024 採択'),
  ('非環状型人工核酸プラットフォーム (核酸医薬)',
   '核酸医薬用新規プラットフォームとしての非環状型人工核酸の開発。次世代核酸医薬の基盤技術。',
   '名古屋大学', 'university', '愛知県名古屋市', '浅沼 浩之', NULL, NULL,
   'life', ARRAY['創薬', '核酸医薬'], ARRAY['人工核酸', '非環状型', '核酸医薬', 'Tongali'],
   'investigating', 'grant_db', 'Tongali GAPファンド ステップ2 2024 採択'),
  ('環状mRNA創薬 (持続性 × 組織疾患特異性)',
   '持続性および組織疾患特異性を有する環状 mRNA 創薬の開発。mRNA 医薬の次世代基盤。',
   '名古屋大学', 'university', '愛知県名古屋市', '阿部 洋', NULL, NULL,
   'life', ARRAY['創薬', 'mRNA医薬'], ARRAY['環状mRNA', '創薬', 'Tongali'],
   'investigating', 'grant_db', 'Tongali GAPファンド ステップ2 2024 採択'),
  ('次世代ホウ素中性子捕捉療法 (NextGen BNCT) - 血液がん・乳がん',
   '次世代 BNCT (ホウ素中性子捕捉療法) の事業化。血液がん、乳がんへの臨床適用を目指す。',
   '名古屋大学', 'university', '愛知県名古屋市', '瓜谷 章', NULL, NULL,
   'life', ARRAY['がん治療', '医療機器'], ARRAY['BNCT', 'ホウ素中性子', '血液がん', 'Tongali'],
   'investigating', 'grant_db', 'Tongali GAPファンド ステップ2 2024 採択'),

  -- ========== KSAC GAPファンド 2024 (8件、ディープテック厚め選定) ==========
  ('蓄電池ナノ粒子量産プラズマスプレー技術',
   '次世代高密度蓄電池向けナノ粒子の量産を実現するプラズマスプレー技術の高度化。',
   '大阪大学', 'university', '大阪府吹田市', '神原 淳', NULL, '大学院工学研究科',
   'materials', ARRAY['蓄電池', 'EV', '量産プロセス'], ARRAY['プラズマスプレー', 'ナノ粒子', '蓄電池', 'KSAC'],
   'investigating', 'grant_db', 'KSAC GAPファンド 2024 第1回 採択'),
  ('呼気エクソソーム検出 COPD 診断',
   '非侵襲リキッドバイオプシーのための呼気中細胞外小胞検出法。COPD 早期診断装置。',
   '大阪大学', 'university', '大阪府吹田市', '民谷 栄一', NULL, '産業科学研究所',
   'life', ARRAY['呼吸器診断', '医療機器'], ARRAY['エクソソーム', 'COPD', '呼気', 'KSAC'],
   'investigating', 'grant_db', 'KSAC GAPファンド 2024 第1回 採択'),
  ('ホウ素触媒による超高純度水素精製・貯蔵技術',
   '炭素資源由来の粗水素および地中水素から超高純度水素を製造する革新的技術。ホウ素触媒で精製・貯蔵を一体化。',
   '大阪大学', 'university', '大阪府吹田市', '星本 陽一', NULL, '大学院工学研究科',
   'gx_energy', ARRAY['水素', 'モビリティ', 'GX'], ARRAY['水素精製', 'ホウ素触媒', '高純度水素', 'KSAC'],
   'investigating', 'grant_db', 'KSAC GAPファンド 2024 第1回 採択'),
  ('触媒化学による糖の高速合成 (バイオ製造)',
   '持続可能なバイオものづくりを実現する糖の化学合成技術。発酵原料・医薬中間体・機能性食品向け。',
   '大阪大学', 'university', '大阪府吹田市', '田畑 裕', NULL, '基礎工学研究科',
   'gx_circular', ARRAY['バイオ製造', '化成品', '医薬'], ARRAY['糖合成', '触媒化学', 'バイオものづくり', 'KSAC'],
   'investigating', 'grant_db', 'KSAC GAPファンド 2024 第1回 採択'),
  ('廃棄硫黄ポリマー (持続可能社会向け高性能ポリマー)',
   '石油精製で発生する廃棄硫黄を原料とした高性能ポリマー開発。サーキュラー型素材。',
   '大阪大学', 'university', '大阪府吹田市', '小林 裕一郎', NULL, '大学院理学研究科',
   'gx_circular', ARRAY['素材', 'サーキュラー', '化成品'], ARRAY['硫黄ポリマー', '廃棄硫黄', 'サーキュラー', 'KSAC'],
   'investigating', 'grant_db', 'KSAC GAPファンド 2024 第1回 採択'),
  ('オール半導体プロセス エレクレットMEMS エナジーハーベスタ',
   'オール半導体プロセスによる振動発電 MEMS デバイス開発。量産化技術。',
   '立命館大学', 'university', '滋賀県草津市', '山根 大輔', NULL, '理工学部',
   'gx_energy', ARRAY['IoT', 'センサ', 'エナジーハーベスティング'], ARRAY['MEMS', 'エナジーハーベスタ', 'エレクレット', '振動発電', 'KSAC'],
   'investigating', 'grant_db', 'KSAC GAPファンド 2024 第1回 採択'),
  ('デュシェンヌ型筋ジストロフィー (DMD) 核酸医薬品',
   'デュシェンヌ型筋ジストロフィーに対する核酸医薬品創出。創薬スタートアップ起業準備中。',
   '京都大学', 'university', '京都府京都市', '粟屋 智就', NULL, '大学院医学研究科',
   'life', ARRAY['創薬', '希少疾患', '核酸医薬'], ARRAY['DMD', '核酸医薬', '筋ジストロフィー', 'KSAC'],
   'investigating', 'grant_db', 'KSAC GAPファンド 2024 第1回 採択'),
  ('抗 CD153 抗体治療薬 (慢性腎臓病)',
   '三次リンパ組織を形成する腎臓病に対する抗 CD153 抗体治療薬開発。慢性腎臓病向け新規モダリティ。',
   '京都大学', 'university', '京都府京都市', '柳田 素子', NULL, '大学院医学研究科',
   'life', ARRAY['創薬', '腎疾患', '抗体医薬'], ARRAY['抗CD153抗体', '慢性腎臓病', '三次リンパ組織', 'KSAC'],
   'investigating', 'grant_db', 'KSAC GAPファンド 2024 第1回 採択'),

  -- ========== MASP みちのくGAP 2024 (5件、GX/材料中心) ==========
  ('HumiDAC - 超省エネ二酸化炭素直接回収 (DAC)',
   '空気や排ガスから二酸化炭素を超省エネで固定する新規 DAC 技術 HumiDAC。CCU 起点。',
   '東北大学', 'university', '宮城県仙台市', '福島 康裕', NULL, NULL,
   'gx_circular', ARRAY['DAC', 'CCU', 'カーボンニュートラル'], ARRAY['DAC', 'CO2固定', 'HumiDAC', 'MASP'],
   'investigating', 'grant_db', 'MASP みちのくGAPファンド 2024 採択'),
  ('CO2 高度資源化',
   'CO2 を高付加価値物質に変換する触媒・プロセス。',
   '東北大学', 'university', '宮城県仙台市', '重野 真徳', NULL, NULL,
   'gx_circular', ARRAY['CCU', '化成品'], ARRAY['CO2資源化', 'カーボンリサイクル', 'MASP'],
   'investigating', 'grant_db', 'MASP みちのくGAPファンド 2024 採択'),
  ('iPS細胞由来 Cell Materials (医療機器)',
   'iPS細胞から創る医療機器 Cell Materials。再生医療×医療機器ハイブリッド。',
   '東北大学', 'university', '宮城県仙台市', '江草 宏', NULL, NULL,
   'life', ARRAY['再生医療', '医療機器'], ARRAY['iPS', 'Cell Materials', 'MASP'],
   'investigating', 'grant_db', 'MASP みちのくGAPファンド 2024 採択'),
  ('三次元バルクメタマテリアル (次世代通信)',
   '次世代通信技術を支える革新材料「三次元バルクメタマテリアル」。電磁波制御素材。',
   '東北大学', 'university', '宮城県仙台市', '金森 義明', NULL, NULL,
   'materials', ARRAY['通信', '素材', '電磁波'], ARRAY['メタマテリアル', '三次元', '通信', 'MASP'],
   'investigating', 'grant_db', 'MASP みちのくGAPファンド 2024 採択'),
  ('利熱ガラス (熱エネルギー透明ガラス部材)',
   '熱エネルギーを利用する透明ガラス部材を創製。建材・モビリティ向け。',
   '山形大学', 'university', '山形県米沢市', '松井 淳', NULL, NULL,
   'gx_energy', ARRAY['建材', 'モビリティ', '省エネ'], ARRAY['利熱ガラス', '熱エネルギー', '透明部材', 'MASP'],
   'investigating', 'grant_db', 'MASP みちのくGAPファンド 2024 採択'),

  -- ========== GTIE GAPファンド 2024 (6件) ==========
  ('Hero タンパク質を用いた革新的生体材料保存法',
   'ヒト天然由来の安定化剤「Hero タンパク質」で生体材料 (細胞・タンパク・酵素) を常温保存。コールドチェーン革命候補。',
   '東京大学', 'university', '東京都文京区', '泊 幸秀', NULL, NULL,
   'life', ARRAY['再生医療', 'バイオ物流', '創薬支援'], ARRAY['Hero タンパク質', '生体材料保存', 'GTIE'],
   'investigating', 'grant_db', 'GTIE GAPファンド 2024 エクスプロールコース 採択'),
  ('CO2 と炭素を使う大容量蓄電システム',
   '世界初の CO2 と炭素を使った大容量蓄電システムの実用化。GX × エネルギー貯蔵の融合。',
   '東京科学大学', 'university', '東京都目黒区', '伊原 学', '教授', NULL,
   'gx_energy', ARRAY['蓄電池', 'GX', 'CCU'], ARRAY['CO2蓄電', '大容量蓄電', 'GTIE'],
   'investigating', 'grant_db', 'GTIE GAPファンド 2024 エクスプロールコース 採択'),
  ('スモールデータ AI 希少疾患統合診断支援',
   'スモールデータ AI による希少疾患から主要疾患までを網羅する統合診断支援システム。',
   '東京科学大学', 'university', '東京都目黒区', '鈴木 賢治', NULL, NULL,
   'life', ARRAY['医療AI', '希少疾患', 'SaMD'], ARRAY['スモールデータAI', '希少疾患', '統合診断', 'GTIE'],
   'investigating', 'grant_db', 'GTIE GAPファンド 2024 エクスプロールコース 採択'),
  ('AC ナノポア法 微生物 AI センサ',
   'AI 駆動型 AC ナノポア法による微生物 AI センサ。食品・医療・環境向け迅速微生物検出。',
   '東京科学大学', 'university', '東京都目黒区', '山本 貴富喜', NULL, NULL,
   'life', ARRAY['食品', '医療', '環境', '検査'], ARRAY['ナノポア', '微生物センサ', 'AI', 'GTIE'],
   'investigating', 'grant_db', 'GTIE GAPファンド 2024 エクスプロールコース 採択'),
  ('量産型グラフェン搭載 ヘルスケアデバイス',
   '量産型グラフェンを搭載したヘルスケアデバイス事業。グローバル展開志向。',
   '慶應義塾大学', 'university', '東京都港区', '牧 英之', NULL, NULL,
   'materials', ARRAY['ヘルスケア', 'ウェアラブル', '素材'], ARRAY['グラフェン', 'ヘルスケアデバイス', '量産', 'GTIE'],
   'investigating', 'grant_db', 'GTIE GAPファンド 2024 エクスプロールコース 採択'),
  ('原子力発電所廃炉 デジタルツイン',
   '原子力発電所廃炉プロセスの高度化および除染・炉心解体技術改良に資するデジタルツイン技術。',
   '茨城大学', 'university', '茨城県水戸市', '田中 伸厚', NULL, NULL,
   'gx_energy', ARRAY['原子力', '廃炉', 'シミュレーション'], ARRAY['原子力廃炉', 'デジタルツイン', 'GTIE'],
   'investigating', 'grant_db', 'GTIE GAPファンド 2024 エクスプロールコース 採択'),

  -- ========== PARKS GAPファンド 2024 ステップ2-1 (2件) ==========
  ('プラズマ農業コンシェルジュ (プラズマ照射 × 農業)',
   '高レバレッジを実現するプラズマ農業コンシェルジュ事業。プラズマ照射技術で農業生産性 × 持続可能性を両立。',
   '九州大学', 'university', '福岡県福岡市', '奥村 賢直', '准教授', NULL,
   'robo', ARRAY['アグリテック', '農業'], ARRAY['プラズマ', 'スマート農業', 'PARKS'],
   'investigating', 'grant_db', 'PARKS GAPファンド 2024 ステップ2-1 採択 (INDEE Japan 事業化推進)'),
  ('自律型・人間中心型 外観検査 AI',
   '迅速に導入でき長期的に運用できる自律型と人間中心型の外観検査 AI。',
   '九州工業大学', 'university', '福岡県北九州市', '德永 旭将', '准教授', NULL,
   'robo', ARRAY['製造業', '検査', 'AI'], ARRAY['外観検査', '自律AI', '人間中心', 'PARKS'],
   'investigating', 'grant_db', 'PARKS GAPファンド 2024 ステップ2-1 採択 (みらい創造インベストメンツ事業化推進)'),

  -- ========== AMED 令和6年度 橋渡し研究 preF (3件、GX以外で AMD 関心高そうなもの) ==========
  ('組織幹細胞制御による革新的毛髪再生医薬',
   '組織幹細胞制御技術による革新的毛髪再生医薬開発。再生医療 × 巨大美容市場。',
   '東京大学', 'university', '東京都文京区', '西村 栄美', '教授', NULL,
   'life', ARRAY['再生医療', '美容', '毛髪'], ARRAY['幹細胞', '毛髪再生', 'AMED preF'],
   'investigating', 'grant_db', 'AMED 令和6年度 橋渡し研究プログラム preF 採択'),
  ('胃癌腹膜播種 アンチセンス核酸医薬',
   '胃癌腹膜播種に特化したアンチセンス核酸医薬開発。Tongali GAP ステップ2 + AMED シーズC 二重採択。',
   '名古屋大学', 'university', '愛知県名古屋市', '神田 光郎', NULL, NULL,
   'life', ARRAY['創薬', 'がん治療', '核酸医薬'], ARRAY['アンチセンス', '胃癌', '腹膜播種', 'AMED', 'Tongali'],
   'investigating', 'grant_db', 'AMED 令和6年度 橋渡し研究プログラム シーズC + Tongali GAP ステップ2 二重採択'),
  ('iPS細胞由来 大脳皮質神経細胞移植 (脳梗塞)',
   '脳梗塞に対する iPS 細胞由来大脳皮質神経細胞移植の開発。AMED シーズF 採択。',
   '京都大学', 'university', '京都府京都市', '高橋 淳', '教授', NULL,
   'life', ARRAY['再生医療', '脳神経'], ARRAY['iPS', '脳梗塞', '神経細胞移植', 'AMED シーズF'],
   'investigating', 'grant_db', 'AMED 令和6年度 橋渡し研究プログラム シーズF 採択');

-- =====================================================================
-- 採択補助金履歴 (seed_funding) を一括投入
-- =====================================================================

-- Tongali GAPファンド ステップ2 (5件)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'JST 大学発新産業創出基金事業 スタートアップ・エコシステム共創プログラム Tongali GAPファンド (ステップ2)', 'Tongali GAP S2', 2024, 'awarded',
       'https://tongali.net/x/gapfund2024-step2/'
FROM seeds WHERE source_detail = 'Tongali GAPファンド ステップ2 2024 採択';

-- KSAC GAPファンド 2024 第1回 (8件)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'JST 大学発新産業創出基金事業 スタートアップ・エコシステム共創プログラム KSAC GAPファンド (第1回)', 'KSAC GAP', 2024, 'awarded',
       'https://ksac.site/1st.gapfund2024/'
FROM seeds WHERE source_detail = 'KSAC GAPファンド 2024 第1回 採択';

-- MASP みちのくGAPファンド 2024 (5件)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'JST 大学発新産業創出基金事業 スタートアップ・エコシステム共創プログラム MASP みちのくGAPファンド', 'MASP GAP', 2024, 'awarded',
       'https://michinoku-academia-startup.jp/michinokugapfund2024/'
FROM seeds WHERE source_detail = 'MASP みちのくGAPファンド 2024 採択';

-- GTIE GAPファンド 2024 (6件)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'JST 大学発新産業創出基金事業 スタートアップ・エコシステム共創プログラム GTIE GAPファンド (エクスプロール)', 'GTIE GAP', 2024, 'awarded',
       'https://gtie.jp/gap-fund/explore/2024-1/'
FROM seeds WHERE source_detail = 'GTIE GAPファンド 2024 エクスプロールコース 採択';

-- PARKS GAPファンド 2024 ステップ2-1 (2件)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'JST 大学発新産業創出基金事業 スタートアップ・エコシステム共創プログラム PARKS GAPファンド (ステップ2-1)', 'PARKS GAP S2-1', 2024, 'awarded',
       'https://www.parks-startup.jp/'
FROM seeds WHERE source_detail LIKE 'PARKS GAPファンド 2024 ステップ2-1 採択%';

-- AMED preF (1件)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'AMED 令和6年度 橋渡し研究プログラム preF', 'AMED preF', 2024, 'awarded',
       'https://www.amed.go.jp/koubo/16/01/1601C_00053.html'
FROM seeds WHERE researcher_name = '西村 栄美' AND org_name = '東京大学';

-- AMED シーズC (神田光郎、Tongali と二重で seed_funding 2件作る)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'AMED 令和6年度 橋渡し研究プログラム シーズC', 'AMED シーズC', 2024, 'awarded',
       'https://www.amed.go.jp/koubo/16/01/1601C_00053.html'
FROM seeds WHERE researcher_name = '神田 光郎' AND org_name = '名古屋大学';

INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'JST 大学発新産業創出基金事業 スタートアップ・エコシステム共創プログラム Tongali GAPファンド (ステップ2)', 'Tongali GAP S2', 2024, 'awarded',
       'https://tongali.net/x/gapfund2024-step2/'
FROM seeds WHERE researcher_name = '神田 光郎' AND org_name = '名古屋大学';

-- AMED シーズF (高橋淳)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'AMED 令和6年度 橋渡し研究プログラム シーズF', 'AMED シーズF', 2024, 'awarded',
       'https://www.amed.go.jp/koubo/16/01/1601C_00053.html'
FROM seeds WHERE researcher_name = '高橋 淳' AND org_name = '京都大学';
