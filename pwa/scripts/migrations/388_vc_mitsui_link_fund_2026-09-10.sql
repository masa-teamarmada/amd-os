-- 388_vc_mitsui_link_fund_2026-09-10.sql
--
-- VC リストへ「三井リンクファンド」(三井不動産のライフサイエンス特化 CVC) を追加する。
-- あわせて、その GP であるアクシル・キャピタル (独立系ライフサイエンス VC) も 1 行として追加する。
-- 三井リンクファンドへ相談する際の投資判断主体は GP 側なので、両方を辿れる状態にしておく。
--
-- 一次情報 (2026-09-10 時点):
--   三井不動産 ニュースリリース 2026-08-31
--     https://www.mitsuifudosan.co.jp/corporate/news/2026/0831_01/
--   PR TIMES (同内容)
--     https://prtimes.jp/main/html/rd/p/000001118.000051782.html
--   アクシル・キャピタル 公式 https://www.axilcapital.com/
--   TaiAx Life Science Fund 設立リリース (2024-08-27)
--     https://prtimes.jp/main/html/rd/p/000000014.000148053.html
--
-- 非公表のため入れていない項目: 1 件あたり投資額、投資先社数目標、GP 側担当者、問い合わせ窓口。
--
-- 冪等性: slug / (vc_id, fund_no) / (vc_id, source_url) で ON CONFLICT DO UPDATE。再適用可。

-- =====================================================================
-- 1. vcs: 三井リンクファンド (CVC 本体)
-- =====================================================================
INSERT INTO vcs (name, name_en, slug, type, thesis, stage_focus, hq, website, investment_constraints, notes)
VALUES (
  '三井リンクファンド',
  'Mitsui Link-Fund',
  'mitsui-link-fund',
  'cvc',
  '三井不動産が単独 LP として総額 70 億円を拠出するライフサイエンス特化 CVC。2026-08-31 設立公表。'
  || '対象領域は創薬 / 再生・遺伝子治療 / 医療機器 / ヘルステック。シード期からレイター期まで、国内および海外へ投資。'
  || 'GP はライフサイエンス特化の独立系 VC アクシル・キャピタル (アクシル・キャピタル・オーブ 1 号有限責任事業組合)。'
  || '株式会社 RealizeEdge Partners がサイエンティフィックコラボレーターとして科学的評価と事業化支援を担う。'
  || '三井不動産は 2016 年のライフサイエンス・イノベーション推進事業開始以降、「場」(日本橋ライフサイエンスビルディング / 三井リンクラボ) と'
  || '「コミュニティ」(一般社団法人 LINK-J) を整備してきており、本ファンドは「資金」を直接投資機能として加える位置づけ。'
  || '既存の VC ファンドへの LP 出資は継続する。',
  ARRAY['seed','series_a','series_b','series_c','growth'],
  '東京',
  'https://www.mitsuifudosan.co.jp/corporate/news/2026/0831_01/',
  'ライフサイエンス領域 (創薬 / 再生・遺伝子治療 / 医療機器 / ヘルステック) 特化。同領域外は対象外。'
  || '1 件あたり投資額と投資先社数の目標は非公表 (2026-09-10 時点)。',
  'ファンド専用サイトは未開設のため website 欄は設立リリース URL。実際の投資判断と接触窓口は GP のアクシル・キャピタル側 (slug: axil-capital)。'
  || 'AMD 相性評価 (amd_rating) は未評価のまま。'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  type = EXCLUDED.type,
  thesis = EXCLUDED.thesis,
  stage_focus = EXCLUDED.stage_focus,
  hq = EXCLUDED.hq,
  website = EXCLUDED.website,
  investment_constraints = EXCLUDED.investment_constraints,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- =====================================================================
-- 2. vcs: アクシル・キャピタル (三井リンクファンドの GP)
-- =====================================================================
INSERT INTO vcs (name, name_en, slug, type, thesis, stage_focus, hq, website, investment_constraints, notes)
VALUES (
  'アクシル・キャピタル',
  'Axil Capital Advisors',
  'axil-capital',
  'independent',
  '2017 年にみずほ証券からスピンアウトして設立された、バイオメディカル / ヘルスケアテクノロジー特化の独立系 VC。'
  || '本社は東京。シード期からクロスオーバーラウンドまで、国内外のライフサイエンス案件へ投資し、累計 30 社以上の実績。'
  || '2024-08 に台湾の Taiwania Capital と共同で TaiAx Life Science Fund L.P. (目標規模 2 億ドル) を設立。'
  || '2026-08-31 に三井不動産の CVC「三井リンクファンド 1 号」の GP に就任。',
  ARRAY['seed','series_a','series_b','series_c','growth'],
  '東京',
  'https://www.axilcapital.com/',
  'ライフサイエンス (創薬 / プラットフォーム技術 / 医療機器 / デジタルヘルス / ヘルスケアサービス) 特化。同領域外は対象外。',
  '三井リンクファンド (slug: mitsui-link-fund) の GP。三井リンクファンド経由で接触する場合の実質的な相手方。'
  || '自社運用ファンドにアクシル・キャピタル・パートナーズ 2 号有限責任事業組合、TaiAx Life Science Fund L.P. がある。'
  || '代表者名は公開情報が一致しないため未記載。AMD 相性評価 (amd_rating) は未評価のまま。'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  type = EXCLUDED.type,
  thesis = EXCLUDED.thesis,
  stage_focus = EXCLUDED.stage_focus,
  hq = EXCLUDED.hq,
  website = EXCLUDED.website,
  investment_constraints = EXCLUDED.investment_constraints,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- =====================================================================
-- 3. vc_funds: 三井リンクファンド 1 号
-- =====================================================================
INSERT INTO vc_funds (vc_id, fund_no, name, size_jpy, vintage_year, status, first_close_at, source_url, notes)
SELECT
  v.id,
  1,
  '三井リンクファンド1号 (Mitsui Link-Fund 1) / 登記名: MF-AX1号投資事業有限責任組合',
  7000000000,
  2026,
  'investing',
  DATE '2026-08-31',
  'https://www.mitsuifudosan.co.jp/corporate/news/2026/0831_01/',
  'GP: アクシル・キャピタル・オーブ1号有限責任事業組合 / LP: 三井不動産 (単独) / ファンド期間 10 年。'
  || '投資対象は創薬・再生・遺伝子治療・医療機器・ヘルステック、シード期からレイター期まで、国内および海外。'
  || '2026-08-31 に設立を公表。ファーストクローズ / ファイナルクローズの区分は非公表のため、公表日を first_close_at に置いている。'
FROM vcs v WHERE v.slug = 'mitsui-link-fund'
ON CONFLICT (vc_id, fund_no) DO UPDATE SET
  name = EXCLUDED.name,
  size_jpy = EXCLUDED.size_jpy,
  vintage_year = EXCLUDED.vintage_year,
  status = EXCLUDED.status,
  first_close_at = EXCLUDED.first_close_at,
  source_url = EXCLUDED.source_url,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- =====================================================================
-- 4. vc_news: 設立ニュース (三井リンクファンド / アクシル・キャピタル 両方に紐付け)
-- =====================================================================
INSERT INTO vc_news (vc_id, kind, title, body, occurred_on, source_url, ingested_by, verified, related_fund_id)
SELECT
  v.id,
  'fundraise',
  '三井不動産、アクシル・キャピタルと共同で総額70億円のライフサイエンス特化型CVCファンド「三井リンクファンド」を新設',
  '三井不動産が単独 LP、アクシル・キャピタル・オーブ1号有限責任事業組合が GP。ファンド総額 70 億円、期間 10 年。'
  || '投資対象は創薬・再生・遺伝子治療・医療機器・ヘルステック、シード期からレイター期まで、国内および海外。'
  || '株式会社 RealizeEdge Partners がサイエンティフィックコラボレーターとして参画。'
  || '三井不動産の「場」「コミュニティ」「資金」の三本柱のうち、資金面を LP 出資から直接投資へ広げる位置づけ。',
  DATE '2026-08-31',
  'https://www.mitsuifudosan.co.jp/corporate/news/2026/0831_01/',
  'manual',
  TRUE,
  (SELECT f.id FROM vc_funds f JOIN vcs mv ON mv.id = f.vc_id WHERE mv.slug = 'mitsui-link-fund' AND f.fund_no = 1)
FROM vcs v WHERE v.slug IN ('mitsui-link-fund','axil-capital')
ON CONFLICT (vc_id, source_url) DO UPDATE SET
  kind = EXCLUDED.kind,
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  occurred_on = EXCLUDED.occurred_on,
  verified = EXCLUDED.verified,
  related_fund_id = EXCLUDED.related_fund_id,
  updated_at = NOW();
