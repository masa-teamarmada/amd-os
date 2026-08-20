-- 305: 初回SPS評価向け第4波。ワイヤレス給電2社を新規シーズとして追加し、
--      PJ化済みで技術詳細が未確認だったシーズの記述を公開一次資料で補い、
--      根拠となる公開情報を seed_news へ保存する。
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.seeds WHERE id = '091afcac-a7c8-1b04-1690-2af19ea85a2f' AND org_name = '京都大学')
  OR NOT EXISTS (SELECT 1 FROM public.seeds WHERE id = '2d289848-9278-b741-3437-5856d8dce6ff' AND org_name = '東京大学')
  OR NOT EXISTS (SELECT 1 FROM public.seeds WHERE id = '6c1ced6c-33b0-130b-4ced-99c79fc68243' AND title = '光量子コンピュータ')
  OR NOT EXISTS (SELECT 1 FROM public.seeds WHERE id = '8050097b-1d38-3a3b-c877-49f30794312c' AND org_name = '東北大学')
  OR NOT EXISTS (SELECT 1 FROM public.seeds WHERE id = 'f18b5a65-9bed-ade4-7ed7-59d3d08ab86a' AND org_name = '京都大学')
  OR NOT EXISTS (SELECT 1 FROM public.seeds WHERE id = '00bb86dd-e1e3-9a69-4861-280b04424273' AND title = 'PDMSによるCO2吸着・分離')
  OR EXISTS (SELECT 1 FROM public.seeds WHERE id IN ('4b7c1d92-8a35-4e61-9c07-2f5d8b3a1c01','4b7c1d92-8a35-4e61-9c07-2f5d8b3a1c02'))
  THEN
    RAISE EXCEPTION 'SPS public source wave4 seed identity mismatch';
  END IF;
END;
$$;

-- 1) 新規シーズ: ワイヤレス給電2社
INSERT INTO public.seeds
  (id, title, summary, org_name, org_type, org_region, org_url, researcher_name, domain_lane, industry_target, keywords,
   status, is_public, source, source_detail, discovery_status, institution_id)
VALUES
  ('4b7c1d92-8a35-4e61-9c07-2f5d8b3a1c01',
   'レーザー無線給電（長距離・大電力）',
   '東京科学大学発の株式会社SolaNika（2025年5月設立）が開発するレーザー方式の無線給電。マイクロ波方式や電磁誘導方式に比べて長距離かつ大電力の送電を狙う。地上応用の起点はドローンの長時間浮揚で、HAPS（成層圏無人機）、月面探査ローバー、自律搬送ロボットへの展開を掲げる。2026年6月にインキュベイトファンドをリードとするシードラウンドを実施。',
   '株式会社SolaNika', 'private_lab', NULL, 'https://solanika.com/', NULL,
   'gx_energy',
   ARRAY['ドローン','HAPS','宇宙・月面','自律搬送ロボット'],
   ARRAY['ワイヤレス給電','レーザー無線給電','ドローン','東京科学大学'],
   'investigating', false, 'web_search',
   '公開情報（プレスリリース・報道）に基づき2026-08-20に新規登録。AMDとの接点は未確立。',
   'reviewed', NULL),
  ('4b7c1d92-8a35-4e61-9c07-2f5d8b3a1c02',
   'マイクロ波空間伝送型ワイヤレス給電 AirPlug',
   'エイターリンク株式会社が展開するマイクロ波方式の空間伝送型ワイヤレス給電。最大17m以上の給電距離を掲げ、FA（工場自動化）、ビルマネジメント、メディカルの3領域で商用展開中。2025年2月にシリーズBエクステンション18億円とベンチャーデット10億円を実施し、累計調達額は約68億円（借入・助成金を含む）。',
   'エイターリンク株式会社', 'private_lab', NULL, 'https://aeterlink.com/', NULL,
   'gx_energy',
   ARRAY['ファクトリーオートメーション','ビルマネジメント','医療機器'],
   ARRAY['ワイヤレス給電','空間伝送','マイクロ波','AirPlug'],
   'investigating', false, 'web_search',
   '公開情報（プレスリリース・報道）に基づき2026-08-20に新規登録。AMDとの接点は未確立。',
   'reviewed', NULL);

-- 2) PJ化済みで技術詳細が未確認だったシーズを公開一次資料で補う
UPDATE public.seeds SET
  title = '赤外光で発電する透明太陽電池・次世代熱線遮蔽材',
  summary = '京都大学発の株式会社OPTMASSが開発する、太陽光の未利用帯である赤外域を選択的に吸収して発電する透明な窓ガラス（発電する窓）と、次世代の熱線遮蔽材。省エネと発電の両立を狙い、2027年の社会実装を目標に掲げる。2023年7月にサムライインキュベートから出資を受けている。',
  org_url = 'https://optmass.jp/',
  domain_lane = 'gx_energy',
  industry_target = ARRAY['建材・窓ガラス','ビル','住宅','自動車'],
  keywords = ARRAY['透明太陽電池','赤外光発電','熱線遮蔽','建材一体型太陽電池'],
  updated_at = now()
WHERE id = '091afcac-a7c8-1b04-1690-2af19ea85a2f';

UPDATE public.seeds SET
  title = 'プレドープシリコン負極による高容量リチウムイオン電池',
  summary = '東京大学発の株式会社ORLIB（2020年5月設立）が開発する、プレドープしたシリコン負極とリン酸鉄リチウム（LFP）正極を組み合わせたリチウムイオン電池。JST STARTの成果を基に事業化し、2024年8月に国際興業を引受先とする第三者割当増資を実施している。',
  domain_lane = 'gx_energy',
  industry_target = ARRAY['蓄電池','モビリティ','産業機器'],
  keywords = ARRAY['リチウムイオン電池','シリコン負極','プレドープ','LFP'],
  updated_at = now()
WHERE id = '2d289848-9278-b741-3437-5856d8dce6ff';

UPDATE public.seeds SET
  title = '光量子コンピュータ（時間多重・常温動作）',
  summary = '東京大学・理化学研究所の光量子研究を基に2024年9月設立された株式会社OptQCが開発する光方式の量子コンピュータ。冷却を要さず常温常圧で動作する点と、1万量子モード級の大規模化を掲げる。2025年10月にシリーズA1として15億円を調達し、累計調達額は21.5億円。',
  org_name = '東京大学',
  domain_lane = 'ict',
  industry_target = ARRAY['量子コンピュータ','研究機関','金融・創薬計算'],
  keywords = ARRAY['光量子コンピュータ','時間多重','常温動作','OptQC'],
  updated_at = now()
WHERE id = '6c1ced6c-33b0-130b-4ced-99c79fc68243';

UPDATE public.seeds SET
  title = '銅ペーストによる銀代替導電材料',
  summary = '東北大学 小池淳一教授の技術を基に2013年4月設立された株式会社マテリアル・コンセプトの導電性銅ペースト。20ミクロン級の微細配線が可能で、銀・金・はんだ・銅めっき等の代替を狙う。太陽電池の配線、車載部品、通信センサー、LED照明、ディスプレイ等が用途。銅ペーストの量産化に成功し半導体配線での採用実績を持つ。',
  domain_lane = 'materials',
  industry_target = ARRAY['太陽電池','半導体','車載部品','ディスプレイ'],
  keywords = ARRAY['銅ペースト','導電材料','銀代替','微細配線'],
  updated_at = now()
WHERE id = '8050097b-1d38-3a3b-c877-49f30794312c';

UPDATE public.seeds SET
  domain_lane = 'gx_energy',
  industry_target = ARRAY['ワイヤレス給電','センサー','産業機器'],
  keywords = ARRAY['ワイヤレス給電','マイクロ波','RF/DC変換','ダイオード'],
  updated_at = now()
WHERE id = 'f18b5a65-9bed-ade4-7ed7-59d3d08ab86a';

UPDATE public.seeds SET
  researcher_name = '一ノ瀬 泉',
  domain_lane = 'gx_circular',
  industry_target = ARRAY['CO2回収','産業排ガス','素材'],
  keywords = ARRAY['CO2分離回収','PDMS','収着材','DAC'],
  updated_at = now()
WHERE id = '00bb86dd-e1e3-9a69-4861-280b04424273';

UPDATE public.seeds SET
  domain_lane = 'ict',
  industry_target = ARRAY['動画生成','教育','広告'],
  keywords = ARRAY['生成AI','動画生成','紙芝居型'],
  updated_at = now()
WHERE id = '5a1f4784-414f-47e4-d716-4988aee6cd40';

-- 3) 公開一次資料を seed_news へ保存
INSERT INTO public.seed_news (seed_id, kind, title, body, occurred_on, source_url, ingested_by, verified, dismissed) VALUES
('091afcac-a7c8-1b04-1690-2af19ea85a2f', 'press',
 'サムライインキュベートがOPTMASSへ出資',
 'サムライインキュベートがSamurai Incubate Fund 7号を通じて株式会社OPTMASS（京都府宇治市）へ出資したと発表。調達額は非開示。資金は赤外光で発電する透明太陽電池および次世代熱線遮蔽材の開発に充当し、2027年の社会実装を目標に掲げている。',
 DATE '2023-07-26', 'https://prtimes.jp/main/html/rd/p/000000255.000014738.html', 'codex_public_research_wave4', true, false),

('2d289848-9278-b741-3437-5856d8dce6ff', 'press',
 'ORLIBが国際興業を引受先とする第三者割当増資を実施',
 '東京大学発の株式会社ORLIBが国際興業を引受先とする第三者割当増資を実施したと発表。ORLIBはJST STARTの成果を基に2020年5月に設立され、プレドープシリコン負極とLFP正極による高容量リチウムイオン電池を開発している。',
 DATE '2024-08-08', 'https://prtimes.jp/main/html/rd/p/000000006.000089151.html', 'codex_public_research_wave4', true, false),

('6c1ced6c-33b0-130b-4ced-99c79fc68243', 'press',
 'OptQCがシリーズA1で15億円を調達（累計21.5億円）',
 '東京大学・理化学研究所の光量子研究を基に2024年9月に設立された株式会社OptQCが、シリーズA1ラウンドで15億円を調達し累計調達額が21.5億円に達したと発表。1万量子モード級の大規模化と、冷却を要さない常温常圧動作を掲げる。',
 DATE '2025-10-22', 'https://prtimes.jp/main/html/rd/p/000000013.000148901.html', 'codex_public_research_wave4', true, false),

('8050097b-1d38-3a3b-c877-49f30794312c', 'other',
 'マテリアル・コンセプト設立（東北大学発、銅ペースト）',
 '東北大学 小池淳一教授の技術を基に株式会社マテリアル・コンセプトが2013年4月に設立。導電性銅ペーストで20ミクロン級の微細配線を実現し、銀・金・はんだ・銅めっき等の代替を狙う。銅ペーストの量産化に成功し、半導体配線での採用実績を持つ。',
 DATE '2013-04-01', 'https://startup.tohoku.ac.jp/achievement/interview-material-concept/', 'codex_public_research_wave4', true, false),

('4b7c1d92-8a35-4e61-9c07-2f5d8b3a1c01', 'other',
 'SolaNikaがHonda IGNITIONに採択',
 '東京科学大学発のSolaNikaによるレーザー無線給電の事業化構想が、本田技研工業の新事業創出プログラムHonda IGNITIONに採択されたと報じられた。',
 DATE '2025-10-15', 'https://optronics-media.com/news/20251015/103918/', 'codex_public_research_wave4', true, false),

('4b7c1d92-8a35-4e61-9c07-2f5d8b3a1c01', 'other',
 'SolaNikaとイームズロボティクスがドローンへのレーザー給電で基本合意',
 '国産ドローンメーカーのイームズロボティクスとSolaNikaが、レーザー無線給電をドローンへ適用する取り組みで基本合意したと発表。',
 DATE '2026-03-09', 'https://eams-robo.co.jp/news/4597', 'codex_public_research_wave4', true, false),

('4b7c1d92-8a35-4e61-9c07-2f5d8b3a1c01', 'press',
 'SolaNikaがシードラウンドを実施',
 '株式会社SolaNika（東京科学大学発、2025年5月設立）が、インキュベイトファンドをリード投資家とするエクイティと、みずほ銀行の信用保証協会保証付き融資によるシードラウンドを実施したと発表。金額は非開示。レーザー無線給電で長距離・大電力の送電を狙い、2026年度に移動するドローンの長時間浮揚実証を計画する。用途としてドローン、HAPS、月面探査ローバー、自律搬送ロボットを挙げる。',
 DATE '2026-06-30', 'https://prtimes.jp/main/html/rd/p/000000007.000170243.html', 'codex_public_research_wave4', true, false),

('4b7c1d92-8a35-4e61-9c07-2f5d8b3a1c02', 'press',
 'エイターリンクがシリーズBエクステンション18億円とベンチャーデット10億円を実施',
 'エイターリンク株式会社がシリーズBエクステンションで18億円、ベンチャーデットで10億円を調達し、シリーズB合計38.6億円、累計調達額は借入・助成金を含め約68億円になったと発表。マイクロ波空間伝送型ワイヤレス給電AirPlugで最大17m以上の給電距離を掲げ、FA・ビルマネジメント・メディカルの3領域で展開している。',
 DATE '2025-02-26', 'https://prtimes.jp/main/html/rd/p/000000042.000071264.html', 'codex_public_research_wave4', true, false);

COMMIT;
