-- 302: 初回SPS評価に使う公的一次資料を、既存seedとの同一性確認後に構造化して保存する。
-- URL本文や連絡先は保存せず、評価器へ渡すbodyは確認済み事実の短い要約だけに限定する。
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.seeds
    WHERE id = '1b03061a-7187-4101-89c9-755bb14a5e4f'
      AND title = '低温型電解 アルミニウム高純度化'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.seeds
    WHERE id = '0994b4af-d972-45ed-9922-2cb82dd4d9a4'
      AND title = '極超低圧駆動 超高透水逆浸透膜'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.seeds
    WHERE id = '1104dbb1-c646-4340-87e3-f5410d099bc1'
      AND title = '革新的プロトン伝導膜による アンモニア電解合成'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.seeds
    WHERE id = '57e596b0-1ab1-4154-9e16-5e983afb6465'
      AND title = 'ARF/GEF 阻害経口低分子抗がん剤'
  ) THEN
    RAISE EXCEPTION 'SPS public source enrichment seed identity mismatch';
  END IF;
END;
$$;

INSERT INTO public.seed_news (
  seed_id,
  kind,
  title,
  body,
  occurred_on,
  source_url,
  ingested_by,
  verified,
  dismissed
) VALUES
(
  '1b03061a-7187-4101-89c9-755bb14a5e4f',
  'press',
  '低純度スクラップから高純度アルミニウムへのリサイクルの実現へ',
  '岩手大学公式発表。UACJ等とのNEDO先導研究、150℃以下の低温型電解、ラボで既存法比の消費電力25%以下、60〜80℃で電流効率90%以上、量産化と大型設備が課題であることを確認。',
  DATE '2025-01-24',
  'https://www.iwate-u.ac.jp/cat-research/2025/01/006336.html',
  'codex_public_research',
  true,
  false
),
(
  '0994b4af-d972-45ed-9922-2cb82dd4d9a4',
  'publication',
  'セルロースナノファイバーを用いた高透水性水処理用RO膜の開発',
  '信州大学公式成果。CM化CNFと芳香族ポリアミドの複合RO膜を0.2MPaで駆動し、高透水、耐ファウリング、耐塩素、無電源POU浄水器、農業・陸上養殖用途、海外現地評価を確認。',
  DATE '2024-05-08',
  'https://www.shinshu-u.ac.jp/project/agri-x/research-result/emphasis/post-23.html',
  'codex_public_research',
  true,
  false
),
(
  '0994b4af-d972-45ed-9922-2cb82dd4d9a4',
  'press',
  '超低圧高透水性CNF/PA複合RO膜・モジュールの開発とANSI58認証取得',
  '信州大学公式発表。POU用CNF/PA複合RO膜モジュールのNSF International ANSI58認証、水道水圧程度の超低圧運転、オフグリッド利用を確認。',
  DATE '2021-10-21',
  'https://www.shinshu-u.ac.jp/coi/press/press/cnfparonsf.php',
  'codex_public_research',
  true,
  false
),
(
  '1104dbb1-c646-4340-87e3-f5410d099bc1',
  'grant',
  'NEDO NEP採択者 株式会社QioN',
  'NEDO公式採択者情報。高い伝導度と強靭な力学特性を両立するイオン伝導膜について、コスト、耐久性、電気化学合成デバイスでの特性と経済性評価が製品化課題であることを確認。',
  NULL,
  'https://nep.nedo.go.jp/selected/5c7713e4-d3c2-4c22-8fc0-639b3bb94d63',
  'codex_public_research',
  true,
  false
),
(
  '57e596b0-1ab1-4154-9e16-5e983afb6465',
  'grant',
  'ARF-GEF阻害経口低分子医薬品の非臨床研究採択',
  'AMED公式採択情報。東京理科大学の椎名勇教授による、既存分子標的抗がん剤不応性がんを対象とするARF-GEF阻害経口低分子医薬品が、実用化に向けた非臨床試験領域で採択されたことを確認。',
  DATE '2022-03-22',
  'https://www.amed.go.jp/koubo/15/01/1501C_00038.html',
  'codex_public_research',
  true,
  false
),
(
  '57e596b0-1ab1-4154-9e16-5e983afb6465',
  'other',
  'ARF/GEF阻害経口低分子抗がん剤の研究課題',
  'J-GLOBAL公的研究課題情報。TKI不応がんと小胞体ストレス脆弱性がんを対象に、新機構の経口低分子抗がん剤を開発し、製造手段を中核技術とするスタートアップ設立を目指す課題であることを確認。',
  NULL,
  'https://jglobal.jst.go.jp/public/202504014270572140',
  'codex_public_research',
  true,
  false
)
ON CONFLICT (seed_id, source_url) DO NOTHING;

DO $$
DECLARE
  v_count integer;
BEGIN
  WITH expected(seed_id,kind,title,body,occurred_on,source_url) AS (VALUES
    ('1b03061a-7187-4101-89c9-755bb14a5e4f'::uuid,'press','低純度スクラップから高純度アルミニウムへのリサイクルの実現へ','岩手大学公式発表。UACJ等とのNEDO先導研究、150℃以下の低温型電解、ラボで既存法比の消費電力25%以下、60〜80℃で電流効率90%以上、量産化と大型設備が課題であることを確認。',DATE '2025-01-24','https://www.iwate-u.ac.jp/cat-research/2025/01/006336.html'),
    ('0994b4af-d972-45ed-9922-2cb82dd4d9a4'::uuid,'publication','セルロースナノファイバーを用いた高透水性水処理用RO膜の開発','信州大学公式成果。CM化CNFと芳香族ポリアミドの複合RO膜を0.2MPaで駆動し、高透水、耐ファウリング、耐塩素、無電源POU浄水器、農業・陸上養殖用途、海外現地評価を確認。',DATE '2024-05-08','https://www.shinshu-u.ac.jp/project/agri-x/research-result/emphasis/post-23.html'),
    ('0994b4af-d972-45ed-9922-2cb82dd4d9a4'::uuid,'press','超低圧高透水性CNF/PA複合RO膜・モジュールの開発とANSI58認証取得','信州大学公式発表。POU用CNF/PA複合RO膜モジュールのNSF International ANSI58認証、水道水圧程度の超低圧運転、オフグリッド利用を確認。',DATE '2021-10-21','https://www.shinshu-u.ac.jp/coi/press/press/cnfparonsf.php'),
    ('1104dbb1-c646-4340-87e3-f5410d099bc1'::uuid,'grant','NEDO NEP採択者 株式会社QioN','NEDO公式採択者情報。高い伝導度と強靭な力学特性を両立するイオン伝導膜について、コスト、耐久性、電気化学合成デバイスでの特性と経済性評価が製品化課題であることを確認。',NULL::date,'https://nep.nedo.go.jp/selected/5c7713e4-d3c2-4c22-8fc0-639b3bb94d63'),
    ('57e596b0-1ab1-4154-9e16-5e983afb6465'::uuid,'grant','ARF-GEF阻害経口低分子医薬品の非臨床研究採択','AMED公式採択情報。東京理科大学の椎名勇教授による、既存分子標的抗がん剤不応性がんを対象とするARF-GEF阻害経口低分子医薬品が、実用化に向けた非臨床試験領域で採択されたことを確認。',DATE '2022-03-22','https://www.amed.go.jp/koubo/15/01/1501C_00038.html'),
    ('57e596b0-1ab1-4154-9e16-5e983afb6465'::uuid,'other','ARF/GEF阻害経口低分子抗がん剤の研究課題','J-GLOBAL公的研究課題情報。TKI不応がんと小胞体ストレス脆弱性がんを対象に、新機構の経口低分子抗がん剤を開発し、製造手段を中核技術とするスタートアップ設立を目指す課題であることを確認。',NULL::date,'https://jglobal.jst.go.jp/public/202504014270572140')
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
   AND n.ingested_by = 'codex_public_research'
   AND n.verified = true
   AND n.dismissed = false;

  IF v_count <> 6 THEN
    RAISE EXCEPTION 'SPS public source enrichment incomplete: expected 6, got %', v_count;
  END IF;
END;
$$;

COMMIT;
