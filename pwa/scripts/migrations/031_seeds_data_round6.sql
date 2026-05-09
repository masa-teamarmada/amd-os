-- 031_seeds_data_round6.sql
--
-- Phase 1 第6ラウンド。27 件追加 (JST CREST 12 + JST 創発 15)。
--
-- データソース:
--   JST CREST 2024 採択課題 (8 領域 × 5-6 件 = 計50件、別紙2 PDF)
--   JST 創発的研究支援事業 第5回 採択課題 (246名、文科省 PDF)
--
-- 選定基準: AMD レーン適合 × 事業化適性 × ディープテック度。
-- CREST は領域ごとに 1-2 件、創発は 246名から 15件。
-- さきがけ (175件) は重複が多くなるため Phase 2 に回す。
-- HSFC 25件は PDF 取得失敗 + 北海道大学から個別広報なしのため Phase 2 に回す。

INSERT INTO seeds (
  title, summary, org_name, org_type, org_region,
  researcher_name, researcher_title, lab_name,
  domain_lane, industry_target, keywords,
  status, source, source_detail
) VALUES
  -- ========== JST CREST 2024 (12件) ==========
  ('メタマテリアル医療用 AR グラス',
   'メタマテリアル技術を活用した医療用 AR グラスの実現。手術ナビゲーション・診断補助。',
   '東京工業大学', 'university', '東京都目黒区',
   '雨宮 智宏', '准教授', '工学院',
   'materials', ARRAY['医療AR', '医療機器', 'XR'],
   ARRAY['メタマテリアル', 'ARグラス', '医療AR', 'JST CREST'],
   'investigating', 'grant_db',
   'JST CREST 2024 採択 (光と情報・通信・センシング・材料の融合フロンティア)'),

  ('集積光コム × 異種材料集積 超多次元光テンソルコア',
   '集積光コムと異種材料集積による超多次元光テンソルコア。AI 時代の光演算プロセッサ基盤。',
   '慶應義塾大学', 'university', '東京都港区',
   '田邉 孝純', '教授', '理工学部',
   'materials', ARRAY['光演算', 'AI', '半導体'],
   ARRAY['光コム', '光テンソルコア', '光演算', 'JST CREST'],
   'investigating', 'grant_db',
   'JST CREST 2024 採択 (光と情報融合)'),

  ('テラヘルツ光電インターフェース (高速スピンデバイス向け)',
   '高速スピンデバイスに向けたテラヘルツ光電インターフェース。次世代通信・スピントロニクス。',
   '京都大学', 'university', '京都府宇治市',
   '廣理 英基', '准教授', '化学研究所',
   'materials', ARRAY['通信', 'スピントロニクス', 'テラヘルツ'],
   ARRAY['テラヘルツ', 'スピンデバイス', '光電', 'JST CREST'],
   'investigating', 'grant_db',
   'JST CREST 2024 採択 (光と情報融合)'),

  ('物質循環型 半導体集積回路',
   '物質循環型半導体集積回路の創製。サステナブル半導体の新パラダイム。',
   '東京工業大学', 'university', '東京都目黒区',
   '岡本 敏宏', '教授', '物質理工学院',
   'materials', ARRAY['半導体', 'サーキュラー'],
   ARRAY['物質循環', '半導体', '集積回路', 'JST CREST'],
   'investigating', 'grant_db',
   'JST CREST 2024 採択 (材料創製および循環プロセス)'),

  ('二次資源からの材料生産チェーン設計学 (R-PSPP)',
   'ばらつきを制する R-PSPP に基づく二次資源からの材料生産チェーン設計学。リサイクル材料の量産基盤。',
   '東京大学', 'university', '東京都目黒区',
   '醍醐 市朗', '准教授', '先端科学技術研究センター',
   'gx_circular', ARRAY['素材', 'リサイクル', '量産'],
   ARRAY['二次資源', 'R-PSPP', 'リサイクル設計', 'JST CREST'],
   'investigating', 'grant_db',
   'JST CREST 2024 採択 (材料創製および循環)'),

  ('未利用有機物炭素化 マルチナリーカーボン',
   '未利用有機物の炭素化:資源循環のためのマルチナリーカーボンの創出。バイオマス → 機能性カーボン。',
   '岡山大学', 'university', '岡山県岡山市',
   '仁科 勇太', '教授', '異分野基礎科学研究所',
   'materials', ARRAY['カーボン素材', 'バイオマス', 'サーキュラー'],
   ARRAY['マルチナリーカーボン', '未利用有機物', '炭素化', 'JST CREST'],
   'investigating', 'grant_db',
   'JST CREST 2024 採択 (材料創製および循環)'),

  ('海中レーザー CO2 計測 (脱炭素貢献)',
   '海中レーザー CO2 計測が拓く脱炭素への貢献。海洋 CCS モニタリング・ブルーカーボン定量化。',
   '(公財) レーザー技術総合研究所', 'private_lab', '大阪府',
   '染川 智弘', NULL, 'レーザー計測研究チーム',
   'gx_circular', ARRAY['海洋', 'CCS', 'CO2計測'],
   ARRAY['海中レーザー', 'CO2計測', '脱炭素', 'JST CREST'],
   'investigating', 'grant_db',
   'JST CREST 2024 採択 (海洋とCO2の関係性解明)'),

  ('海藻養殖漁場 ブルーカーボン高精度定量化',
   '海藻養殖漁場におけるブルーカーボンの高精度定量化と固定能評価。海藻 CCU の定量基盤。',
   '長崎大学', 'university', '長崎県長崎市',
   'ニシハラ グレゴリーナオキ', '教授', '海洋未来イノベーション機構',
   'gx_circular', ARRAY['海洋', 'ブルーカーボン', '養殖'],
   ARRAY['ブルーカーボン', '海藻', '養殖', 'JST CREST'],
   'investigating', 'grant_db',
   'JST CREST 2024 採択 (海洋とCO2)'),

  ('Ge 量子マテリアル 半導体量子技術',
   'industrial-grade Ge quantum materials を活用した半導体量子技術。シリコン互換量子デバイス。',
   '大阪大学', 'university', '大阪府吹田市',
   '大岩 顕', '教授', '産業科学研究所',
   'materials', ARRAY['量子コンピュータ', '半導体'],
   ARRAY['Ge', '量子マテリアル', '半導体量子技術', 'JST CREST'],
   'investigating', 'grant_db',
   'JST CREST 2024 採択 (ナノ物質を用いた半導体デバイス)'),

  ('ウエハースケール vdW エピタキシー × 2D-CMOS 集積化',
   'ウエハースケール vdW エピタキシーの確立と 2D-CMOS 集積化のためのプロセス技術。次世代半導体プロセス基盤。',
   '東京大学', 'university', '東京都文京区',
   '長汐 晃輔', '教授', '大学院工学系研究科',
   'materials', ARRAY['半導体', '2D材料', 'プロセス'],
   ARRAY['vdWエピタキシー', '2D-CMOS', 'ウエハースケール', 'JST CREST'],
   'investigating', 'grant_db',
   'JST CREST 2024 採択 (ナノ物質半導体)'),

  ('ペプチド界面基盤技術 グラフェンバイオセンサ',
   'ペプチド界面基盤技術によるグラフェン・バイオセンサの開拓。臨床・食品検査向け。',
   '東京工業大学', 'university', '東京都目黒区',
   '早水 裕平', '准教授', '物質理工学院',
   'materials', ARRAY['バイオセンサ', '医療', '食品検査'],
   ARRAY['ペプチド', 'グラフェン', 'バイオセンサ', 'JST CREST'],
   'investigating', 'grant_db',
   'JST CREST 2024 採択 (ナノ物質半導体)'),

  ('細胞膜の自在造形 生体物資の万能送達',
   '細胞膜の自在造形による生体物資の万能送達。次世代 DDS (核酸医薬・タンパク医薬の細胞内送達)。',
   '奈良先端科学技術大学院大学', 'university', '奈良県生駒市',
   '末次 志郎', '教授', '先端科学技術研究科',
   'life', ARRAY['DDS', '創薬', '核酸医薬'],
   ARRAY['細胞膜造形', 'DDS', '生体物資送達', 'JST CREST'],
   'investigating', 'grant_db',
   'JST CREST 2024 採択 (細胞操作)'),

  -- ========== JST 創発的研究支援事業 第5回 (15件、AMD レーン適合厳選) ==========
  ('拡散 MRI による新たながん微小環境イメージング',
   '拡散 MRI による新たながん微小環境イメージングの確立。診断・治療効果モニタリング。',
   '名古屋大学', 'university', '愛知県名古屋市',
   '飯間 麻美', '特任教授', '大学院医学系研究科',
   'life', ARRAY['医療画像', 'がん診断'],
   ARRAY['拡散MRI', 'がん微小環境', 'イメージング', '創発'],
   'investigating', 'grant_db',
   'JST 創発的研究支援事業 第5回 採択 (馬場パネル)'),

  ('熱産生脂肪細胞フェロトーシス治療応用',
   '熱産生脂肪細胞におけるフェロトーシスの役割の解明と治療応用。肥満・代謝疾患向け。',
   '東京科学大学', 'university', '東京都文京区',
   '池田 賢司', '准教授', '大学院医歯学総合研究科',
   'life', ARRAY['創薬', '代謝疾患', '肥満'],
   ARRAY['熱産生脂肪', 'フェロトーシス', '創発'],
   'investigating', 'grant_db',
   'JST 創発的研究支援事業 第5回 採択 (有田パネル)'),

  ('感覚 - 運動の多義性 ノイズ利用',
   'ノイズによる感覚 - 運動の多義性解決と利用。ロボット制御・脳機械インターフェース基盤。',
   '九州工業大学', 'university', '福岡県北九州市',
   '池本 周平', '准教授', '大学院生命体工学研究科',
   'robo', ARRAY['ロボット', 'BMI', '神経'],
   ARRAY['感覚運動', 'ノイズ', 'ロボット制御', '創発'],
   'investigating', 'grant_db',
   'JST 創発的研究支援事業 第5回 採択 (後藤パネル)'),

  ('シールドレス超高感度磁気センサ 生体磁気計測',
   'シールドレス超高感度磁気センサの開発と生体磁気計測への応用。脳磁・心磁の小型計測機器。',
   '京都大学', 'university', '京都府京都市',
   '伊藤 陽介', '准教授', '大学院工学研究科',
   'life', ARRAY['医療機器', '磁気計測', '脳磁・心磁'],
   ARRAY['シールドレス', '磁気センサ', '生体磁気', '創発'],
   'investigating', 'grant_db',
   'JST 創発的研究支援事業 第5回 採択 (鄭パネル)'),

  ('ガスハイドレート マイクロプラスチック分離',
   'ガスハイドレートによる革新的マイクロプラスチック分離技術。水処理・海洋環境の MPs 課題向け。',
   '東北大学', 'university', '宮城県仙台市',
   '神田 雄貴', '助教', '流体科学研究所',
   'gx_circular', ARRAY['水処理', '海洋', '環境'],
   ARRAY['ガスハイドレート', 'マイクロプラスチック', '分離', '創発'],
   'investigating', 'grant_db',
   'JST 創発的研究支援事業 第5回 採択 (塩見(淳)パネル)'),

  ('磁気エネルギー × 免疫療法 超低侵襲 転移リンパ節治療',
   '磁気エネルギーと免疫療法の融合による超低侵襲の転移リンパ節治療。がん転移治療の革新。',
   '東北大学', 'university', '宮城県仙台市',
   '桑波田 晃弘', '准教授', '工学研究科',
   'life', ARRAY['がん治療', '医療機器', '免疫療法'],
   ARRAY['磁気エネルギー', '免疫療法', '転移リンパ節', '創発'],
   'investigating', 'grant_db',
   'JST 創発的研究支援事業 第5回 採択 (鄭パネル)'),

  ('リアルタイム神経活動制御 診断デバイス',
   'リアルタイム神経活動制御と診断を可能にするデバイス技術。BCI / 神経疾患治療向け。',
   '名城大学', 'university', '愛知県名古屋市',
   '関口 寛人', '教授', '大学院工学研究科',
   'life', ARRAY['医療機器', 'BCI', '神経疾患'],
   ARRAY['神経活動制御', 'BCI', 'デバイス', '創発'],
   'investigating', 'grant_db',
   'JST 創発的研究支援事業 第5回 採択 (塩見(淳)パネル)'),

  ('二つの温暖化と人間活動フィードバック',
   '二つの温暖化と人間活動のフィードバックの探索。気候政策・適応策設計の科学的基盤。',
   '国立環境研究所', 'national_lab', '茨城県つくば市',
   '高根 雄也', '主任研究員', '気候変動適応センター',
   'gx_circular', ARRAY['気候変動', '政策', 'モデリング'],
   ARRAY['温暖化', '人間活動', 'フィードバック', '創発'],
   'investigating', 'grant_db',
   'JST 創発的研究支援事業 第5回 採択 (沖パネル)'),

  ('3次元超格子ペロブスカイト量子ドット 光電デバイス',
   '3次元超格子ペロブスカイト量子ドットの構築と光電デバイスの創出。次世代ディスプレイ・光検出器。',
   '山形大学', 'university', '山形県米沢市',
   '千葉 貴之', '教授', '大学院有機材料システム研究科',
   'materials', ARRAY['ディスプレイ', '光電デバイス', '太陽電池'],
   ARRAY['ペロブスカイト量子ドット', '3次元超格子', '光電', '創発'],
   'investigating', 'grant_db',
   'JST 創発的研究支援事業 第5回 採択 (森パネル)'),

  ('半導体製造プロセス大幅簡易化 持続可能ものづくり',
   '半導体デバイス製造プロセスの大幅な簡易化に資する持続可能なものづくり技術。半導体 CN 化。',
   '大阪大学', 'university', '大阪府吹田市',
   '藤 大雪', '助教', '大学院工学研究科',
   'materials', ARRAY['半導体', 'プロセス', 'GX'],
   ARRAY['半導体プロセス', '簡易化', '持続可能', '創発'],
   'investigating', 'grant_db',
   'JST 創発的研究支援事業 第5回 採択 (塩見(淳)パネル)'),

  ('光共振器による不斉分離プロセス',
   '光共振器による不斉分離プロセスの確立。医薬中間体・化粧品など chiral 分子の精密分離。',
   '北海道大学', 'university', '北海道札幌市',
   '平井 健二', '准教授', '電子科学研究所',
   'materials', ARRAY['化学プロセス', '医薬', '化成品'],
   ARRAY['光共振器', '不斉分離', 'キラル', '創発'],
   'investigating', 'grant_db',
   'JST 創発的研究支援事業 第5回 採択 (森パネル)'),

  ('宇宙天気予測リードタイム革新',
   '宇宙天気予測リードタイムの革新的向上。電力網・通信・衛星運用の事業継続向け。',
   '名古屋大学', 'university', '愛知県名古屋市',
   '堀田 英之', '教授', '宇宙地球環境研究所',
   'ict', ARRAY['宇宙', '電力', '衛星'],
   ARRAY['宇宙天気予測', 'リードタイム', '創発'],
   'investigating', 'grant_db',
   'JST 創発的研究支援事業 第5回 採択 (酒見パネル)'),

  ('走化性人工細胞',
   '走化性人工細胞の創出。生体内ターゲティング治療・診断・センサの基盤。',
   '東北大学', 'university', '宮城県仙台市',
   '松林 英明', '助教', '生命医科学研究センター',
   'life', ARRAY['DDS', '人工細胞', 'バイオデバイス'],
   ARRAY['走化性', '人工細胞', 'ケモタクシス', '創発'],
   'investigating', 'grant_db',
   'JST 創発的研究支援事業 第5回 採択 (岡田パネル)'),

  ('灌流血管付き 大型脳オルガノイドによるバイオ AI',
   '灌流血管付き大型脳オルガノイドの創製。バイオハイブリッド AI コンピューティングの基盤。',
   '産業技術総合研究所', 'national_lab', '茨城県つくば市',
   '森 宣仁', '主任研究員', '生命工学領域',
   'life', ARRAY['再生医療', 'バイオAI', '創薬支援'],
   ARRAY['脳オルガノイド', '灌流血管', 'バイオAI', '創発'],
   'investigating', 'grant_db',
   'JST 創発的研究支援事業 第5回 採択 (鄭パネル)'),

  ('毛管力 × 弾性力 × 静電力 ソフトロボティクス',
   '毛管力と弾性力、静電力の連成による新奇ソフトロボティクス。柔軟・微細マイクロロボ。',
   '産業技術総合研究所', 'national_lab', '茨城県つくば市',
   '矢菅 浩規', NULL, 'エレクトロニクス・製造領域',
   'robo', ARRAY['ロボット', 'マイクロロボ', '医療機器'],
   ARRAY['ソフトロボ', '毛管力', '静電力', '創発'],
   'investigating', 'grant_db',
   'JST 創発的研究支援事業 第5回 採択 (塩見(淳)パネル)');

-- =====================================================================
-- 採択補助金履歴 (seed_funding) 一括投入
-- =====================================================================

-- JST CREST (12件)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'JST 戦略的創造研究推進事業 (CREST)', 'JST CREST', 2024, 'awarded',
       'https://www.jst.go.jp/kisoken/crest/application/2024/240917/240917.html'
FROM seeds WHERE source_detail LIKE 'JST CREST 2024 採択%';

-- JST 創発 (15件)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'JST 創発的研究支援事業 (第5回公募)', '創発(第5回)', 2024, 'awarded',
       'https://www.mext.go.jp/b_menu/houdou/2024/mext_00004.html'
FROM seeds WHERE source_detail LIKE 'JST 創発的研究支援事業 第5回 採択%';

-- =====================================================================
-- 採択ニュース (seed_news) 一括投入
-- =====================================================================

INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'JST CREST 2024 採択 — ' || title,
       '2024-09-17', 'https://www.jst.go.jp/kisoken/crest/application/2024/240917/240917crest.pdf',
       'manual', true
FROM seeds WHERE source_detail LIKE 'JST CREST 2024 採択%'
ON CONFLICT (seed_id, source_url) DO NOTHING;

INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'JST 創発的研究支援事業 第5回 採択 — ' || title,
       '2024-09-20', 'https://www.mext.go.jp/content/20250725-mext_gakjokik-000043874_2.pdf',
       'manual', true
FROM seeds WHERE source_detail LIKE 'JST 創発的研究支援事業 第5回 採択%'
ON CONFLICT (seed_id, source_url) DO NOTHING;
