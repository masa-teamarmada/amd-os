-- 304: 初回SPS評価向け第3波の公的一次資料を保存する。
-- 対象は独立監査で identity が確定した4 seedのみ。URL本文や連絡先は保存しない。
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.seeds
    WHERE id = 'c846d5db-de17-4fc3-9400-4dee372b2799'
      AND title = 'トポロジカル物質 ユニバーサルメモリ'
      AND org_name = 'TopoLogic株式会社'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.seeds
    WHERE id = 'e48c1a1a-ddf4-425e-b81b-266e922abde5'
      AND title = '縦型ダイヤモンド パワー MOSFET (社会実装向け)'
      AND org_name = '株式会社Power Diamond Systems'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.seeds
    WHERE id = 'de23ef96-e26b-47b0-b10b-24d19e965907'
      AND title = '次世代ペロブスカイト光電変換材料 (タンデム / 室内発電)'
      AND org_name = '京都大学'
      AND researcher_name = '若宮 淳志'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.seeds
    WHERE id = 'c2416dfc-1e78-4ba8-998a-8d1bcbe1c2af'
      AND title = 'デュシェンヌ型筋ジストロフィー (DMD) 核酸医薬品'
      AND org_name = '京都大学'
      AND researcher_name = '粟屋 智就'
  ) THEN
    RAISE EXCEPTION 'SPS public source wave3 seed identity mismatch';
  END IF;
END;
$$;

INSERT INTO public.seed_news (
  seed_id, kind, title, body, occurred_on, source_url,
  ingested_by, verified, dismissed
) VALUES
(
  'c846d5db-de17-4fc3-9400-4dee372b2799', 'grant',
  'NEDO先導研究プログラムに採択 — トポロジカル物質ユニバーサルメモリ',
  'TopoLogic株式会社公式発表。NEDO先導研究プログラム採択と、トポロジカル物質を用いたユニバーサルメモリの実用化研究を確認。',
  DATE '2024-05-29',
  'https://www.topologic.jp/b4380e82c49d457ea8f8587490b7f4dc',
  'codex_public_research_wave3', true, false
),
(
  'c846d5db-de17-4fc3-9400-4dee372b2799', 'grant',
  '2024年度NEDO先導研究プログラム実施体制 — ユニバーサルメモリ',
  'NEDO公式採択資料。TopoLogic株式会社・東京大学、再委託の京都大学・JSRによるトポロジカル物質ユニバーサルメモリ研究を確認。',
  DATE '2024-05-24',
  'https://www.nedo.go.jp/content/800034031.pdf',
  'codex_public_research_wave3', true, false
),
(
  'e48c1a1a-ddf4-425e-b81b-266e922abde5', 'other',
  'ダイヤモンド半導体による縦型MOSFET技術',
  'Power Diamond Systems公式技術情報。縦型ダイヤモンドMOSFETの開発と、高耐圧・低損失パワーデバイスを目指す技術領域を確認。量産性能や顧客採用は確認できない。',
  NULL,
  'https://powerdiamondsys.com/technology/',
  'codex_public_research_wave3', true, false
),
(
  'e48c1a1a-ddf4-425e-b81b-266e922abde5', 'grant',
  '2024年度NEDO先導研究プログラム — 縦型ダイヤモンドパワーMOSFET',
  'NEDO公式採択資料。株式会社Power Diamond Systems・早稲田大学・九州工業大学の実施体制と、大電流化・高耐圧化の要素技術開発を確認。',
  DATE '2024-05-24',
  'https://www.nedo.go.jp/content/100982034.pdf',
  'codex_public_research_wave3', true, false
),
(
  'de23ef96-e26b-47b0-b10b-24d19e965907', 'press',
  'ペロブスカイト/シリコン4端子タンデムで変換効率30%',
  '京都大学化学研究所・若宮研究室公式発表。seedと同じ研究室・タンデム系で変換効率30%を報告したことを確認。',
  DATE '2025-01-20',
  'https://www.kuicr.kyoto-u.ac.jp/sites/news/250120-2/',
  'codex_public_research_wave3', true, false
),
(
  'c2416dfc-1e78-4ba8-998a-8d1bcbe1c2af', 'grant',
  'KSAC-GAPファンド第1回採択 — デュシェンヌ型筋ジストロフィー核酸医薬品',
  'KSAC公式採択一覧。京都大学医学研究科の課題として、DMDに対する核酸医薬品創出のための創薬スタートアップ起業準備を確認。',
  NULL,
  'https://ksac.site/ja/wp-content/themes/ksac/pdf/ksac-gap-result-1st.pdf',
  'codex_public_research_wave3', true, false
),
(
  'c2416dfc-1e78-4ba8-998a-8d1bcbe1c2af', 'grant',
  'DMD核酸医薬の研究開発課題に関する事後評価',
  'AMED公式事後評価。粟屋智就氏によるDMD向けBP標的アンチセンス核酸の研究で、患者由来細胞における短縮ジストロフィン発現と複数の有望配列を確認。臨床段階や承認は未確認。',
  NULL,
  'https://www.amed.go.jp/content/000162641.pdf',
  'codex_public_research_wave3', true, false
)
ON CONFLICT (seed_id, source_url) DO NOTHING;

DO $$
DECLARE
  v_count integer;
BEGIN
  WITH expected(seed_id, kind, title, body, occurred_on, source_url) AS (VALUES
    ('c846d5db-de17-4fc3-9400-4dee372b2799'::uuid, 'grant', 'NEDO先導研究プログラムに採択 — トポロジカル物質ユニバーサルメモリ', 'TopoLogic株式会社公式発表。NEDO先導研究プログラム採択と、トポロジカル物質を用いたユニバーサルメモリの実用化研究を確認。', DATE '2024-05-29', 'https://www.topologic.jp/b4380e82c49d457ea8f8587490b7f4dc'),
    ('c846d5db-de17-4fc3-9400-4dee372b2799'::uuid, 'grant', '2024年度NEDO先導研究プログラム実施体制 — ユニバーサルメモリ', 'NEDO公式採択資料。TopoLogic株式会社・東京大学、再委託の京都大学・JSRによるトポロジカル物質ユニバーサルメモリ研究を確認。', DATE '2024-05-24', 'https://www.nedo.go.jp/content/800034031.pdf'),
    ('e48c1a1a-ddf4-425e-b81b-266e922abde5'::uuid, 'other', 'ダイヤモンド半導体による縦型MOSFET技術', 'Power Diamond Systems公式技術情報。縦型ダイヤモンドMOSFETの開発と、高耐圧・低損失パワーデバイスを目指す技術領域を確認。量産性能や顧客採用は確認できない。', NULL::date, 'https://powerdiamondsys.com/technology/'),
    ('e48c1a1a-ddf4-425e-b81b-266e922abde5'::uuid, 'grant', '2024年度NEDO先導研究プログラム — 縦型ダイヤモンドパワーMOSFET', 'NEDO公式採択資料。株式会社Power Diamond Systems・早稲田大学・九州工業大学の実施体制と、大電流化・高耐圧化の要素技術開発を確認。', DATE '2024-05-24', 'https://www.nedo.go.jp/content/100982034.pdf'),
    ('de23ef96-e26b-47b0-b10b-24d19e965907'::uuid, 'press', 'ペロブスカイト/シリコン4端子タンデムで変換効率30%', '京都大学化学研究所・若宮研究室公式発表。seedと同じ研究室・タンデム系で変換効率30%を報告したことを確認。', DATE '2025-01-20', 'https://www.kuicr.kyoto-u.ac.jp/sites/news/250120-2/'),
    ('c2416dfc-1e78-4ba8-998a-8d1bcbe1c2af'::uuid, 'grant', 'KSAC-GAPファンド第1回採択 — デュシェンヌ型筋ジストロフィー核酸医薬品', 'KSAC公式採択一覧。京都大学医学研究科の課題として、DMDに対する核酸医薬品創出のための創薬スタートアップ起業準備を確認。', NULL::date, 'https://ksac.site/ja/wp-content/themes/ksac/pdf/ksac-gap-result-1st.pdf'),
    ('c2416dfc-1e78-4ba8-998a-8d1bcbe1c2af'::uuid, 'grant', 'DMD核酸医薬の研究開発課題に関する事後評価', 'AMED公式事後評価。粟屋智就氏によるDMD向けBP標的アンチセンス核酸の研究で、患者由来細胞における短縮ジストロフィン発現と複数の有望配列を確認。臨床段階や承認は未確認。', NULL::date, 'https://www.amed.go.jp/content/000162641.pdf')
  )
  SELECT count(*) INTO v_count
  FROM expected e
  JOIN public.seed_news n
    ON n.seed_id = e.seed_id
   AND n.source_url = e.source_url
   AND n.kind = e.kind
   AND n.title = e.title
   AND n.body = e.body
   AND n.occurred_on IS NOT DISTINCT FROM e.occurred_on
   AND n.ingested_by = 'codex_public_research_wave3'
   AND n.verified = true
   AND n.dismissed = false;

  IF v_count <> 7 THEN
    RAISE EXCEPTION 'SPS public source wave3 incomplete: expected 7, got %', v_count;
  END IF;
END;
$$;

COMMIT;
