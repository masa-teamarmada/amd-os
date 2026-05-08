-- 025_seeds_initial_data_extended.sql
--
-- Phase 1 初期投入の拡張。下川房男先生 (香川大) の情報を詳細化 + GAP / NEP / D-Global の
-- 起業前資金獲得済みシーズ群を 12 件追加する。
--
-- 出典:
--   香川大 KIDI 研究紹介ページ (kadailab) + KAKEN
--   JST D-Global 2024 第2回 採択プロジェクト (project2024.html)
--   PSI GAPファンド 2025 ステップ2/ステップ1 採択者 (愛媛大学 産学連携推進本部)
--
-- ステータス方針:
--   - GAP/D-Global で資金獲得済 = 'investigating' (AMD 視点では候補→調査中段階)
--   - SX (杉浦美羽) は既に AMD PJ 化済 = 'spun_off' + spun_off_project_id='p21'

-- =====================================================================
-- 1. 既存「下川研究室シーズ」を詳細化
-- =====================================================================

UPDATE seeds
SET
  title = '植物生体情報センシング (微小水分・養分動態センサ)',
  summary = 'スマホ部品の最先端加工技術で従来比1/10の超小型化を達成。5mm角シリコンチップ上に水分/養分動態センサを集積。園芸作物・果樹の栽培支援、施設園芸環境制御、樹木衰退・枯死の生理メカニズム解明、森林生態系変化の将来予測まで応用展開。',
  org_type = 'university',
  org_region = '香川県高松市',
  org_url = 'https://www.kagawa-u.ac.jp/',
  researcher_name = '下川 房男',
  researcher_title = '特命教授',
  lab_name = 'イノベーションデザイン研究所 (KIDI)',
  researcher_url = 'https://kidi.kagawa-u.ac.jp/about/',
  domain_lane = 'robo',
  industry_target = ARRAY['アグリテック', '農業', '森林保全', '施設園芸'],
  keywords = ARRAY['MEMS', '植物センシング', '水分動態', '養分動態', 'スマート農業', '科研費基盤A'],
  source_detail = 'まさからの確定 / 香川大 KIDI 研究紹介 + KAKEN (90580598) 確認 (2026-05-08)',
  next_action = '研究室訪問 + 事業化シナリオすり合わせ。京大・北里・都留文科・森林総研との共同研究進行中。',
  updated_at = NOW()
WHERE title = '下川研究室シーズ' AND org_name = '香川大学';

-- =====================================================================
-- 2. JST D-Global 2024 第2回 採択 6 件 (起業直前〜起業初期、世界展開志向)
-- =====================================================================

INSERT INTO seeds (
  title, summary, org_name, org_type, org_region, org_url,
  researcher_name, researcher_title, lab_name,
  domain_lane, industry_target, keywords,
  status, source, source_detail
) VALUES
  -- D-Global #1
  (
    '低分子がん創薬 Magic Bullet',
    '抗体をしのぐ腫瘍集積性を有し、副作用が劇的に低減された抗がん剤「低分子 Magic Bullet」を開発。グローバル展開志向。',
    '筑波大学', 'university', '茨城県つくば市', 'https://www.tsukuba.ac.jp/',
    '長崎 幸夫', '教授', '数理物質系',
    'life', ARRAY['創薬', 'がん治療'],
    ARRAY['低分子医薬', 'がん', '腫瘍集積', 'Magic Bullet', 'D-Global'],
    'investigating', 'grant_db',
    'JST D-Global 2024 第2回 採択 / project2024.html'
  ),
  -- D-Global #2
  (
    '低張浸透圧バイオフィルム殺菌技術 (整形外科インプラント・創傷感染向け)',
    '整形外科インプラント感染および創傷感染に対する治療機器開発。バイオフィルムを物理的に殺菌する低張浸透圧技術。',
    '物質・材料研究機構', 'national_lab', '茨城県つくば市', 'https://www.nims.go.jp/',
    '岡本 章玄', NULL, '高分子・バイオ材料研究センター',
    'life', ARRAY['医療機器', '整形外科', '感染症'],
    ARRAY['バイオフィルム', '殺菌', '低張浸透圧', 'インプラント感染', 'D-Global'],
    'investigating', 'grant_db',
    'JST D-Global 2024 第2回 採択'
  ),
  -- D-Global #3
  (
    'ARF/GEF 阻害経口低分子抗がん剤',
    'チロシンキナーゼ高発現 TKI 不応がん、小胞体ストレス脆弱性がんを対象とした新規低分子抗がん剤開発。',
    '東京理科大学', 'university', '東京都新宿区', 'https://www.tus.ac.jp/',
    '椎名 勇', '教授', '理学部第一部 応用化学科',
    'life', ARRAY['創薬', 'がん治療'],
    ARRAY['ARF/GEF', '低分子医薬', 'チロシンキナーゼ', '抗がん剤', 'D-Global'],
    'investigating', 'grant_db',
    'JST D-Global 2024 第2回 採択'
  ),
  -- D-Global #4
  (
    'ホワイトリグニンと高付加価値バイオマス製品',
    '植物バイオマス分離技術による高純度ホワイトリグニン製造。化成品・素材原料への展開。',
    '京都大学', 'university', '京都府宇治市', 'https://www.rish.kyoto-u.ac.jp/',
    '西村 裕志', NULL, '生存圏研究所',
    'gx_circular', ARRAY['バイオマス', '化成品', '素材'],
    ARRAY['リグニン', 'バイオマス', 'ホワイトリグニン', '高付加価値素材', 'D-Global'],
    'investigating', 'grant_db',
    'JST D-Global 2024 第2回 採択'
  ),
  -- D-Global #5
  (
    'ナノ粒子構造色インク・塗料',
    '「軽い・薄い・強い」を実現する革新的な構造色インク・塗料の開発。色素を使わない発色技術で耐候性・環境負荷低減を実現。',
    '神戸大学', 'university', '兵庫県神戸市', 'https://www.kobe-u.ac.jp/',
    '杉本 泰', NULL, '大学院工学研究科',
    'materials', ARRAY['塗料', '化粧品', 'モビリティ', '建材'],
    ARRAY['構造色', 'ナノ粒子', '塗料', 'インク', '色素フリー', 'D-Global'],
    'investigating', 'grant_db',
    'JST D-Global 2024 第2回 採択'
  ),
  -- D-Global #6
  (
    '特発性肺線維症治療薬 (新規 ファースト・イン・クラス抗体医薬)',
    '難治性疾患である特発性肺線維症 (IPF) 向け新規ファースト・イン・クラス抗体医薬の創製。',
    '岡山大学', 'university', '岡山県岡山市', 'https://www.okayama-u.ac.jp/',
    '阪口 政清', NULL, '学術研究院 医歯薬学域',
    'life', ARRAY['創薬', '呼吸器疾患'],
    ARRAY['抗体医薬', 'ファーストインクラス', '特発性肺線維症', 'IPF', 'D-Global'],
    'investigating', 'grant_db',
    'JST D-Global 2024 第2回 採択'
  ),

-- =====================================================================
-- 3. PSI GAPファンド 2025 ステップ1 (愛媛大、4 件)
-- =====================================================================

  -- PSI Step1 #1
  (
    '耳下腺腫瘍の Deep Learning 良悪性鑑別アプリ',
    'Deep Learning 型 AI を組み込んだ耳下腺腫瘍の良悪性鑑別診断支援アプリ。',
    '愛媛大学', 'university', '愛媛県東温市', 'https://www.ehime-u.ac.jp/',
    '三谷 壮平', '特任講師', '大学院医学系研究科',
    'life', ARRAY['医療AI', '画像診断'],
    ARRAY['Deep Learning', 'AI', '耳下腺腫瘍', '画像診断', 'PSI'],
    'candidate', 'grant_db',
    'PSI GAPファンド 2025 ステップ1 採択 / 愛媛大学 産学連携推進本部'
  ),
  -- PSI Step1 #2
  (
    'スマートハザードマップ 2.0 (松山編)',
    '地震発生時に家屋倒壊や津波到達を考慮した最適避難行動支援システム。災害シミュレーション × 個別避難経路最適化。',
    '愛媛大学', 'university', '愛媛県松山市', 'https://www.ehime-u.ac.jp/',
    '多田 豊', '准教授', '大学院理工学研究科',
    'ict', ARRAY['防災', 'スマートシティ'],
    ARRAY['ハザードマップ', '避難行動支援', '地震', '津波', 'PSI'],
    'candidate', 'grant_db',
    'PSI GAPファンド 2025 ステップ1 採択'
  ),
  -- PSI Step1 #3
  (
    '生成AI クラフト文化研修パッケージ',
    '生成 AI 技術を活用した校内のものづくり文化振興研修プログラム開発。教育現場向け。',
    '愛媛大学', 'university', '愛媛県松山市', 'https://www.ehime-u.ac.jp/',
    '富田 英司', '教授', '教育学部',
    'ict', ARRAY['教育', 'EdTech'],
    ARRAY['生成AI', '教育', 'クラフト', '研修', 'PSI'],
    'candidate', 'grant_db',
    'PSI GAPファンド 2025 ステップ1 採択'
  ),
  -- PSI Step1 #4
  (
    'スポーツ組織における知識継承の社会実装',
    '地方クラブ発の知識継承の仕組みを実装し、スポーツが導く未来の組織運営モデルを構築。',
    '愛媛大学', 'university', '愛媛県松山市', 'https://www.ehime-u.ac.jp/',
    '山中 亮', '准教授', '社会共創学部',
    'other', ARRAY['スポーツ', '組織開発'],
    ARRAY['知識継承', 'スポーツ', '組織モデル', 'PSI'],
    'candidate', 'grant_db',
    'PSI GAPファンド 2025 ステップ1 採択'
  ),

-- =====================================================================
-- 4. PSI GAPファンド 2025 ステップ2 + サメ抗体 (愛媛大、2 件)
-- =====================================================================

  -- PSI Step2 (cyanobacteria 排水処理) — 既に AMD SX として PJ 化済
  (
    'CO2と太陽光を資源とする排水処理 (シアノバクテリア × カーボンニュートラル)',
    '特殊な微生物 (シアノバクテリア) を活用した排水処理技術。カーボンニュートラルで薬剤を使わない環境にやさしい特性。循環型社会向け。AMD SU として SolvioraX (SX) で事業化進行中。',
    '愛媛大学', 'university', '愛媛県松山市', 'https://www.ehime-u.ac.jp/',
    '杉浦 美羽', '准教授', 'プロテオサイエンスセンター',
    'gx_circular', ARRAY['排水処理', 'カーボンクレジット', '環境'],
    ARRAY['シアノバクテリア', '排水処理', 'カーボンニュートラル', 'バイオ', 'PSI', 'SolvioraX'],
    'spun_off', 'grant_db',
    'PSI GAPファンド 2025 ステップ2 採択 (約7,800万円) + AMD SX として PJ 化済 (project_id=p21)'
  ),

  -- 愛媛大 竹田浩之 サメ抗体
  (
    'サメ由来世界最小抗体を用いた難治性呼吸器疾患の革新的治療薬',
    'サメ由来の世界最小サイズの抗体 (VNAR) を活用した難治性呼吸器疾患向け新規治療薬。低分子量・高安定性・組織浸透性に優れる。',
    '愛媛大学', 'university', '愛媛県松山市', 'https://www.ehime-u.ac.jp/',
    '竹田 浩之', '教授', 'プロテオサイエンスセンター',
    'life', ARRAY['創薬', '呼吸器疾患'],
    ARRAY['抗体医薬', 'VNAR', 'サメ抗体', '難治性疾患', 'PSI'],
    'investigating', 'grant_db',
    'PSI GAPファンド ステップ2 採択 / 愛媛大学プロテオサイエンスセンター プレス'
  )
;

-- =====================================================================
-- 5. SX シーズの spun_off_project_id 紐付け (上記 INSERT で status='spun_off' 登録)
-- =====================================================================

UPDATE seeds
SET spun_off_project_id = 'p21'
WHERE title = 'CO2と太陽光を資源とする排水処理 (シアノバクテリア × カーボンニュートラル)'
  AND researcher_name = '杉浦 美羽';

-- =====================================================================
-- 6. 採択補助金履歴 (seed_funding) — D-Global / PSI 採択を seed_funding にも記録
-- =====================================================================

-- D-Global 6 件
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'JST 大学発新産業創出基金事業 ディープテック・スタートアップ国際展開プログラム (D-Global)', 'JST D-Global', 2024, 'awarded',
       'https://www.jst.go.jp/program/startupkikin/deeptech/project2024.html'
FROM seeds
WHERE source_detail LIKE 'JST D-Global 2024 第2回 採択%';

-- PSI 2025 ステップ1 4 件
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, source_url)
SELECT id, 'JST 大学発新産業創出基金事業 スタートアップ・エコシステム共創プログラム PSI GAPファンド (ステップ1)', 'PSI GAP S1', 2025, 'awarded',
       'https://ccr.ehime-u.ac.jp/ccr/news/post-1467/'
FROM seeds
WHERE source_detail LIKE 'PSI GAPファンド 2025 ステップ1 採択%';

-- PSI 2025 ステップ2 (杉浦先生)
INSERT INTO seed_funding (seed_id, program, program_short, amount_jpy, fiscal_year, status, source_url)
SELECT id, 'JST 大学発新産業創出基金事業 スタートアップ・エコシステム共創プログラム PSI GAPファンド (ステップ2)', 'PSI GAP S2', 78000000, 2025, 'awarded',
       'https://ccr.ehime-u.ac.jp/ccr/news/post-1640/'
FROM seeds
WHERE title = 'CO2と太陽光を資源とする排水処理 (シアノバクテリア × カーボンニュートラル)'
  AND researcher_name = '杉浦 美羽';

-- PSI ステップ2 (竹田先生)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status)
SELECT id, 'JST 大学発新産業創出基金事業 スタートアップ・エコシステム共創プログラム PSI GAPファンド (ステップ2)', 'PSI GAP S2', 2025, 'awarded'
FROM seeds
WHERE researcher_name = '竹田 浩之' AND org_name = '愛媛大学';

-- 下川先生の 科研費基盤(A)
INSERT INTO seed_funding (seed_id, program, program_short, fiscal_year, status, notes)
SELECT id, '日本学術振興会 科研費 基盤研究(A)', '科研費基盤A', 2024, 'ongoing',
       '令和6-9年度「水分/栄養物質動態用マイクロセンサの開発による樹木個体の生理計測システムの構築」'
FROM seeds
WHERE researcher_name = '下川 房男' AND org_name = '香川大学';
