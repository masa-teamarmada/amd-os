-- 029_seeds_news_initial.sql
--
-- 全シーズに「採択プレス URL」を seed_news (kind='grant', verified=true) で投入。
-- + Round 1 の web 検索由来シーズには press/publication news も追加投入。
-- VC List の vc_news と同じ運用形式 (cron で追加収集できるベース)。
--
-- UNIQUE (seed_id, source_url) で重複防止 (再apply 安全)。

-- =====================================================================
-- 1. プログラム別 採択プレス URL を grant news として投入
-- =====================================================================

-- JST D-Global 2024 第2回 (6件)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'JST D-Global 2024 第2回 採択 — ' || title,
       '2024-10-01', 'https://www.jst.go.jp/program/startupkikin/deeptech/project2024.html',
       'manual', true
FROM seeds WHERE source_detail LIKE 'JST D-Global 2024 第2回 採択%'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- PSI 2025 ステップ1 (4件)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'PSI GAPファンド 2025 ステップ1 採択 — ' || title,
       '2025-04-01', 'https://ccr.ehime-u.ac.jp/ccr/news/post-1467/',
       'manual', true
FROM seeds WHERE source_detail LIKE 'PSI GAPファンド 2025 ステップ1 採択%'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- PSI 2025 ステップ2 杉浦 (1件)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'PSI GAPファンド 2025 ステップ2 採択 — ' || title || ' (約7,800万円)',
       '2025-04-01', 'https://ccr.ehime-u.ac.jp/ccr/news/post-1640/',
       'manual', true
FROM seeds WHERE researcher_name = '杉浦 美羽' AND org_name = '愛媛大学'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- PSI 2025 ステップ2 竹田 (1件)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'PSI GAPファンド ステップ2 採択 — ' || title,
       '2025-04-01', 'https://www.pros.ehime-u.ac.jp/proteodrugdiscovery/',
       'manual', true
FROM seeds WHERE researcher_name = '竹田 浩之' AND org_name = '愛媛大学'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- Tongali GAPファンド ステップ2 2024 (5件)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'Tongali GAPファンド 2024 ステップ2 採択 — ' || title,
       '2024-11-01', 'https://tongali.net/news/tongali-x/24292/',
       'manual', true
FROM seeds WHERE source_detail = 'Tongali GAPファンド ステップ2 2024 採択'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- KSAC GAPファンド 2024 第1回 (8件)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'KSAC GAPファンド 2024 第1回 採択 — ' || title,
       '2024-09-01', 'https://ksac.site/1st.gapfund2024/',
       'manual', true
FROM seeds WHERE source_detail = 'KSAC GAPファンド 2024 第1回 採択'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- KSAC GAPファンド 第2回 (11件)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'KSAC GAPファンド 第2回 採択 — ' || title,
       '2025-02-01', 'https://ksac.site/ja/wp-content/themes/ksac/pdf/ksac-gap-result-2nd.pdf',
       'manual', true
FROM seeds WHERE source_detail LIKE 'KSAC GAPファンド 第2回%'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- MASP みちのくGAPファンド 2024 (5件)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'MASP みちのくGAPファンド 2024 採択 — ' || title,
       '2024-07-01', 'https://michinoku-academia-startup.jp/michinokugapfund2024/',
       'manual', true
FROM seeds WHERE source_detail = 'MASP みちのくGAPファンド 2024 採択'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- GTIE GAPファンド 2024 エクスプロール (6件)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'GTIE GAPファンド 2024 エクスプロール 採択 — ' || title,
       '2024-09-01', 'https://gtie.jp/gap-fund/explore/2024-1/',
       'manual', true
FROM seeds WHERE source_detail = 'GTIE GAPファンド 2024 エクスプロールコース 採択'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- PARKS 九大 奥村 (プラズマ農業)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'PARKS GAPファンド 2024 ステップ2-1 採択 (INDEE Japan 事業化推進) — ' || title,
       '2025-04-08', 'https://www.indee-jp.com/news/academia-20250408/',
       'manual', true
FROM seeds WHERE researcher_name = '奥村 賢直' AND org_name = '九州大学'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- PARKS 九工大 德永 (外観検査AI)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'PARKS GAPファンド 2024 ステップ2-1 採択 (みらい創造インベストメンツ事業化推進) — ' || title,
       '2025-04-01', 'https://prtimes.jp/main/html/rd/p/000000053.000048803.html',
       'manual', true
FROM seeds WHERE researcher_name = '德永 旭将' AND org_name = '九州工業大学'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- AMED preF / シーズC / シーズF
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'AMED 令和6年度 橋渡し研究プログラム 採択 — ' || title,
       '2024-10-01', 'https://www.amed.go.jp/koubo/16/01/1601C_00053.html',
       'manual', true
FROM seeds WHERE source_detail LIKE 'AMED 令和6年度 橋渡し研究プログラム%'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- IJIE GAPファンド 2024 ステップ1 (8件)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'IJIE GAPファンド 2024 ステップ1 プレ 採択 — ' || title,
       '2024-09-01', 'https://ijie.jp/adopted/adopted-cat/step1_2024/',
       'manual', true
FROM seeds WHERE source_detail LIKE 'IJIE GAPファンド 2024 ステップ1%'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- IJIE GAPファンド 2024 ステップ2 (2件)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'IJIE GAPファンド 2024 ステップ2 採択 — ' || title,
       '2024-12-01', 'https://ijie.jp/adopted/adopted-cat/step2_2024/',
       'manual', true
FROM seeds WHERE source_detail LIKE 'IJIE GAPファンド 2024 ステップ2%'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- TeSH GAPファンド 2024 ステップ2 (1件、JAIST 都)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'TeSH GAPファンド 2024 ステップ2 採択 (QBキャピタル合同会社 事業化推進、最大3年・6,000万円) — ' || title,
       '2024-12-25', 'https://www.jaist.ac.jp/whatsnew/info/2024/12/25-2.html',
       'manual', true
FROM seeds WHERE researcher_name = '都 英次郎' AND org_name = '北陸先端科学技術大学院大学'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- NEP 躍進500 / 躍進3000 (PDF 共通 URL)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       'NEDO NEP 躍進コース 2024 採択 — ' || title,
       '2024-09-01', 'https://www.nedo.go.jp/content/100982057.pdf',
       'manual', true
FROM seeds WHERE source_detail LIKE 'NEP 躍進%2024 採択%'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- 香川大 下川 科研費基盤A
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'grant',
       '科研費基盤(A) 令和6-9年度 採択 — 水分/栄養物質動態用マイクロセンサ',
       '2024-04-01', 'https://nrid.nii.ac.jp/ja/nrid/1000090580598/',
       'manual', true
FROM seeds WHERE researcher_name = '下川 房男' AND org_name = '香川大学'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- =====================================================================
-- 2. Round 1 web 検索由来シーズの press/publication news 追加
-- =====================================================================

-- 大阪大 武部 / 肝臓オルガノイド (Nature 2025/4)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'publication',
       'iPS細胞から世界初 機能的多層構造を持つ肝臓オルガノイドを開発 (Nature)',
       '2025-04-17', 'https://resou.osaka-u.ac.jp/ja/research/2025/20250417_1',
       'manual', true
FROM seeds WHERE researcher_name = '武部 貴則' AND org_name = '大阪大学'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- 東北大 全固体電池 Li-LLZO 界面 (2026/3)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'press',
       '室温・短時間で Li金属とガーネット型固体電解質の界面形成に成功 ― 全固体電池の実用化を後押し',
       '2026-03-24', 'https://www.tohoku.ac.jp/japanese/2026/03/press20260324-02-Lithium.html',
       'manual', true
FROM seeds WHERE org_name = '東北大学' AND title LIKE '%LLZO%'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- 産総研 大気濃度CO2合成ガス
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'press',
       '遷移金属不使用の触媒を用いて大気濃度CO2から合成ガスを製造する技術',
       '2022-05-13', 'https://www.aist.go.jp/aist_j/press_release/pr2022/pr20220513_2/pr20220513_2.html',
       'manual', true
FROM seeds WHERE org_name = '産業技術総合研究所' AND title LIKE '%CO2%'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- 大阪大 涙腺オルガノイド
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'publication',
       'iPS細胞から涙腺オルガノイドの作製法を確立',
       '2022-04-21', 'https://resou.osaka-u.ac.jp/ja/research/2022/20220421_1',
       'manual', true
FROM seeds WHERE org_name = '大阪大学' AND title LIKE '%涙腺%'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- 京大 若宮研 ペロブスカイト (エネコート関連)
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'press',
       'ペロブスカイト太陽電池独自技術の開発を加速 - エネコートテクノロジーズ シリーズC調達',
       '2024-07-19', 'https://www.kuicr.kyoto-u.ac.jp/sites/news/240719-2/',
       'manual', true
FROM seeds WHERE researcher_name = '若宮 淳志' AND org_name = '京都大学'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- 岐阜大 FiberCraze
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'press',
       '世界唯一の特殊繊維「ナノ多孔ファイバー」を開発 (岐阜大学広報)',
       '2015-06-01', 'https://www.gifu-u.ac.jp/about/publication/g_lec/special/201506_takeno.html',
       'manual', true
FROM seeds WHERE org_name = '岐阜大学' AND researcher_name = '竹野 敏弘'
ON CONFLICT (seed_id, source_url) DO NOTHING;

-- 香川大 下川 KIDI 紹介
INSERT INTO seed_news (seed_id, kind, title, occurred_on, source_url, ingested_by, verified)
SELECT id, 'press',
       '植物生体情報センシングよる新たな価値の創出 (香川大学 KIDI 研究紹介)',
       '2024-04-01', 'https://www.kagawa-u.ac.jp/kadailab/2024/2136/',
       'manual', true
FROM seeds WHERE researcher_name = '下川 房男' AND org_name = '香川大学'
ON CONFLICT (seed_id, source_url) DO NOTHING;
