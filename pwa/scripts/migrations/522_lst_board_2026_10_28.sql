-- LiSTie（p07）2026年10月28日 定時取締役会の反映（特許・川崎拠点の賃貸借契約・議事録の添付）
--
-- まさの依頼（2026-11-25）: 「順番なんでもいいので、やるべきことをすべてやっておいてほしい」
--   （11/25 取締役会の反映後、AMD OS に 10/14 より後の LiSTie の会議カードが無いこと、10/28 の議事録が共有ドライブにあることを報告した続き）
-- 出典: Docusignで送信_取締役会議事録_20261028.pdf（共有ドライブ p07_lst/0_取締役会/。議事録本文4ページ＋別紙の2026年9月度月次報告）
--   決議: 第1号議案 特許出願の件（6件、全会一致）。審議・報告: 川崎拠点にかかる不動産賃貸借契約の件、9月度の月次報告。
--   9月度の月次報告の数値（資金繰りなど）は、11/25 の取締役会資料（migration 521）で更新済みのため入れない。
-- 会議カード本体は backfill API（scripts/backfill_meeting_minutes.mjs）で別に入れる。ここでは添付を、カードがある場合だけつなぐ。

BEGIN;

-- 1. 知財タブ ---------------------------------------------------------------
-- 1-a. PCT・外国出願を決議した2件。2026-01-21 の取締役会で決議した新規の国内出願4件のうち、題材が一致する2件の台帳行に番号を入れる。
UPDATE project_ip_assets SET
  application_number = '特願2026-045883',
  note_md = note_md || $m$

2026-10-28 追記: 取締役会で、特願2026-045883「電極接続方法」（LiSMICユニットのスタックの電気的な接続方法）の外国出願を決議（全会一致）。PCT国際出願（369,490円）とアルゼンチンへの出願（1,970,000円）を行い、PCTの各国移行は移行時に改めて審議する（SBIR対象）。この台帳行（電源の直列・並列の組み合わせ）と題材が一致するため、同じ出願として番号を入れた。$m$,
  updated_by = 'amie', updated_at = NOW(), last_verified_on = DATE '2026-11-25'
WHERE ip_asset_id = 'ipa_lst_own_power' AND project_id = 'p07' AND note_md NOT LIKE '%2026-10-28 追記%';

UPDATE project_ip_assets SET
  application_number = '特願2026-043680',
  note_md = note_md || $m$

2026-10-28 追記: 取締役会で、特願2026-043680「膜の混酸処理」（従来の塩酸に代えて混酸を使い、膜の表面処理の時間を縮める酸処理方法）のPCT国際出願を決議（369,490円、SBIR対象。全会一致）。各国移行は移行時に改めて審議する。この台帳行（表面処理の時間を縮める方法）と題材が一致するため、同じ出願として番号を入れた。$m$,
  updated_by = 'amie', updated_at = NOW(), last_verified_on = DATE '2026-11-25'
WHERE ip_asset_id = 'ipa_lst_own_surface100' AND project_id = 'p07' AND note_md NOT LIKE '%2026-10-28 追記%';

-- 1-b. 新規の国内出願4件（P2026001〜004）。P2026003 は 11/25 に入れた受入検査の行を正式名に直す。
INSERT INTO project_ip_assets (ip_asset_id, project_id, relation, ip_kind, title, abstract_text, jurisdiction, family_key, status,
  applicants, inventors, tech_domain, importance, confidentiality, note_md, source_kind, pct_status, practice_status, annuity_status,
  created_by, updated_by, last_verified_on)
SELECT v.id, 'p07', 'own', 'patent', v.title, v.abstract, 'JP', v.family, 'drafting',
  ARRAY['株式会社LiSTie'], ARRAY[]::text[], v.domain, 3, 'internal', v.note, 'manual', 'none', 'planned', 'na',
  'amie', 'amie', DATE '2026-11-25'
FROM (VALUES
  ('ipa_lst_own_p2026001', $m$リチウムイオン回収装置のセルおよびスタック（乱流発生構造を備えたセル、P2026001）$m$,
   $m$LiSMICの回収液側で局所的に濃度が上がって析出物ができるのを抑えるため、セル内の通液部に乱流を起こす構造物を設ける。$m$,
   'lst-2026-p2026001-turbulence', 'セル・電極',
   $m$2026-10-28 の取締役会で、日本国内で基礎となる新規出願を行うことを決議（約60万円、SBIR対象。全会一致）。出願番号・出願日は未確認。

出典: 2026年10月取締役会議事録 p.2$m$),
  ('ipa_lst_own_p2026002', $m$積層セル構造（P2026002）$m$,
   $m$LiSMICユニットのセルを積層し、温度の維持と部材コストの低減、流路の均一化、電極接続の改善、圧力差による膜破損の抑制を図る。$m$,
   'lst-2026-p2026002-stacked-cell', 'セル・電極',
   $m$2026-10-28 の取締役会で、日本国内で基礎となる新規出願を行うことを決議（約60万円、SBIR対象。全会一致）。出願番号・出願日は未確認。

出典: 2026年10月取締役会議事録 p.2$m$),
  ('ipa_lst_own_p2026004', $m$保護層を備えたイオン伝導体（P2026004）$m$,
   $m$既存のリチウムを通す膜（LICGC）は、ナトリウムなどを含む原液で割れ、回収液が強いアルカリ性になると成分が溶け出す。ナトリウムやカリウムの侵入を防ぐ材料（LLTO）を表面に重ね、保護層として表面を改質する。$m$,
   'lst-2026-p2026004-protective-layer', '膜（選択透過膜）',
   $m$2026-10-28 の取締役会で、日本国内のみの出願を予定として決議（約60万円、SBIR対象。全会一致）。出願番号・出願日は未確認。

出典: 2026年10月取締役会議事録 p.2$m$)
) AS v(id, title, abstract, family, domain, note)
ON CONFLICT (ip_asset_id) DO NOTHING;

UPDATE project_ip_assets SET
  title = $m$測定用治具または測定用セル（膜の受入検査用、P2026003）$m$,
  abstract_text = $m$膜を挟んだカセットを着脱できる検査用セル。不織布を1枚ずつ交換する従来の方法と比べ、液中のリチウム濃度の変化や作業者による組立ての差を抑えて測定値のばらつきを減らす。くさび式の固定でねじ締めをなくし、膜破損や液漏れのリスクを減らす。$m$,
  family_key = 'lst-2026-p2026003-acceptance-cell',
  note_md = $m$2026-10-28 の取締役会で、日本国内のみの出願を予定として決議（約60万円、SBIR対象。全会一致）。2026年11月取締役会資料 p.1 では、受入検査方法は11月中の出願を目標とし、検査セルの改良と並行して準備中（検査セルはMEC Internationalと製作を議論中、口頭報告）。マイルストーン「2025年度中に特許10件出願」の1件。出願したかは未確認。

出典: 2026年10月取締役会議事録 p.2、2026年11月取締役会議事録 別紙 p.1、Notion 文字起こし$m$,
  updated_by = 'amie', updated_at = NOW(), last_verified_on = DATE '2026-11-25'
WHERE ip_asset_id = 'ipa_lst_idea_acceptance_test' AND project_id = 'p07';

-- 2. 関係先: JFE（川崎の拠点）に、10/28 に報告された賃貸借契約の条件を足す --------------------
UPDATE project_management_partners SET
  agreed_scope = coalesce(agreed_scope, '') || $m$
2026-10-28 の取締役会で賃貸借契約の状況を報告（審議事項、決議ではない）: 契約先はJFEスチール。対象は水江地区のカラー工場の一部（月額396万円、SusHi Tech補助金）、事務所（月額31.5万円、運転資金）、駐車場（月額8.75万円、運転資金）。いずれも税抜、契約期間2026年11月1日〜2031年3月31日、解約は6か月前までに書面で通知、2社見積は選定理由書で対応。前日の招集メールでは、環境測定で堆積物から六価クロム、空気中からアスベストが通常より高い数値で出たため、今後の扱いも含めて審議したいと説明されていた。$m$,
  last_verified_at = DATE '2026-11-25', updated_at = NOW(), version = version + 1
WHERE project_id = 'p07' AND slug = 'org-jfe-ogimachi' AND agreed_scope NOT LIKE '%2026-10-28 の取締役会で賃貸借契約%';

-- 3. 議事録PDFを 10/28 取締役会のカードに添付（カードがある場合だけ）----------------------------
INSERT INTO meeting_assets (meeting_id, project_id, storage_bucket, storage_path, file_name, media_type, file_size_bytes, asset_kind, caption,
  source_url, sort_order, created_by, drive_file_id, project_drive_folder_id, drive_folder_id, drive_folder_name, drive_folder_web_view_link,
  web_view_link, folder_display_path)
SELECT s.meeting_id, 'p07', 'google-drive', '1w-6OgbNuYSqGGQJCsDl9NU1crWTv-mXH', 'Docusignで送信_取締役会議事録_20261028.pdf', 'application/pdf', 1313373, 'upload',
  'Docusign署名済みの議事録（本文4ページ＋別紙の2026年9月度月次報告）',
  'https://drive.google.com/file/d/1w-6OgbNuYSqGGQJCsDl9NU1crWTv-mXH/view?usp=drivesdk', 10, 'amie', '1w-6OgbNuYSqGGQJCsDl9NU1crWTv-mXH',
  '109-4kVJfO4w8DLuRAGHBPTDApAtVc8_W', '10DuN3uvVRDgbACy5MHvcrmEScL1hzf3v', '0_取締役会',
  'https://drive.google.com/drive/folders/10DuN3uvVRDgbACy5MHvcrmEScL1hzf3v',
  'https://drive.google.com/file/d/1w-6OgbNuYSqGGQJCsDl9NU1crWTv-mXH/view?usp=drivesdk', 'PJフォルダ / 0_取締役会'
FROM project_meeting_summaries s
WHERE s.project_id = 'p07'
  AND s.meeting_id = '_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g6krjccq468s4adi18p248gpg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g6csjehi16gsj2gph8co4ch1k750j8d9p6ork8gi368pj8c1k8gpg_20261028T043000Z'
ON CONFLICT (storage_path) DO NOTHING;

COMMIT;
