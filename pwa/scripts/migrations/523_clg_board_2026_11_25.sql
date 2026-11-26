-- チャレナジー（p24）2026年11月25日 定時取締役会の反映
--
-- まさの依頼（2026-11-26）: 「昨日の取締役会の資料を下記に格納したので、OSに情報を入れておいてほしい」。登録内容の案をまさが承認（「この案で登録」）。
-- 出典
--   A. 取締役会招集通知（2026-11-18付、代表取締役 清水敦史）。共有ドライブ p24_clg/0_取締役会/261125_取締役会/ にまさが保存済み。MTGカードに添付。
--      フォルダ内は招集通知のみ。予実表・12月予算表・月次株主報告は未格納のため、数値は会議中の口頭説明による。
--   B. Notion「取締役会」2026-11-25 17:30 の要約と文字起こし（Notion連携で読んだ）。
--      文字起こしの「前田ファンド」は話の流れから前澤ファンド、「90.6万円」は内訳（589万円＋317万円）から906万円と判断。
--      「東京都グローバルサービスDX」は招集通知の正式名称「東京都グローバルサウスGX促進プロジェクト助成金」に合わせた。
--      沖縄のファンドと東京のベンチャーファンドは名称を聞き取れないため、名称を書かない。
--   C. Googleカレンダー: 12/23 17:30 のCLG取締役会は予定どおり。12/25 9:30 の「報告会」はカレンダー未登録。
-- 範囲（まさ承認の案）: MTGカード（招集通知を添付）、会社概要「総会・取締役会」への1件追加、
--   資本政策表の前澤ファンド出資行のメモに売却希望を追記、10/28カードの資金繰り表の宿題を済みに更新。
-- 冪等: ON CONFLICT / NOT EXISTS / 追記済み判定で再実行しても重複しない。

BEGIN;

-- 1. MTGカード（11/25取締役会）-------------------------------------------------------
INSERT INTO project_meeting_summaries (meeting_id, project_id, ym, meeting_date, meeting_start_at, title, notion_url, calendar_event_id,
  summary_short, decided, progress, next_actions, risks, source_hash, generated_at, generated_by_model, notion_page_id, source_kinds, narrative_md)
VALUES ($m$_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g8d1j4c1j651jahhl6spk8gpg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g60qjcc9m6csk8e2164o44ghk750j6gi18orj6dq58l338cq18cp0_20261104T083000Z$m$, 'p24', '202611', DATE '2026-11-25', TIMESTAMPTZ '2026-11-25 08:30:00+00', 'CLG 取締役会',
  $m$https://app.notion.com/p/42397749c60881d0835dcff8458a8c82$m$,
  $m$_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g8d1j4c1j651jahhl6spk8gpg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g60qjcc9m6csk8e2164o44ghk750j6gi18orj6dq58l338cq18cp0_20261104T083000Z$m$,
  $m$12月予算906万円と、バタネス州との公証書類への署名を承認。兵庫県信用保証協会（695万円）はマクニカを通さない直接受注とし、前金を前提に契約する。11月末残高約1,400万円が底の見込み。調達目標は今回1.2億円、その後2億円。前澤ファンドが売却を希望。$m$,
  jsonb_build_array(
    $m$第1号議案：2026年12月度の全社・開発予算906万円を承認（固定費約589万円、開発費約317万円）。受注済み案件の部品手配と税金が中心で、三宅島の監視カメラを半年延長（6万円）。$m$,
    $m$第2号議案：東京都グローバルサウスGX促進プロジェクト助成金で、風車設置自治体（バタネス州）との公証書類への署名を承認。清水さんを代表者として選任する一文で、顧問弁護士は問題なしと確認。$m$,
    $m$兵庫県信用保証協会の案件はマクニカを通さない直接受注として進め、今後の契約は前金を前提にする。$m$),
  jsonb_build_array(
    $m$10月予実：予算1,300万円に対し実績641万円。固定費は約73万円減（1名の時短、役員報酬の減額）。開発費の差額約586万円は支払いの後ろ倒しで、六ヶ所村の撤去費約400万円は1月払い。$m$,
    $m$開発費を除く月間支出は約600万円まで低下。$m$,
    $m$兵庫県信用保証協会から新社屋向け風車を受注：見積695万円、粗利約35%、製造原価約440万円。2027年2月にアンカー設置、風車設置は2027年10月（5月から変更）。前金は契約の20日後の見込みで、事業継続が条件。$m$,
    $m$残高は10月末約2,300万円、11月末約1,400万円（底）、12月の入金で回復。3月末予測は375万円。$m$,
    $m$六ヶ所村の撤去完了。園芸博の風車は設置済み。山梨の耐久試験は2月に結果報告。バタンとパラオの2か所は2027年6月までの設置完了を目標に、年内に部品見積を取り切る。$m$,
    $m$産業交流展でベンチャー技術大賞の特別賞を受賞。自動車ステアリングメーカーと12/8に打ち合わせ（資本業務提携の打診を予定）。$m$,
    $m$助成金：導入補助（3分の2補助、上限5,000万円）の結果が11月末に出る見込み。北海道は12月中旬に打ち合わせ、企業変革スクールの助成金は12月決定。1kW機・廉価モデルの開発は助成金で賄う方針。$m$,
    $m$資金調達：12/1に北陸銀行と石川（能登の大型風車案件）。沖縄のファンド1社が前向きで秘密保持契約を締結。東京のベンチャーファンドと次回東京で面談。坪井工業は見込みが低下。$m$,
    $m$人員は現メンバーで2027年を運営する方針。$m$),
  jsonb_build_array(
    $m$清水さん：第2号議案の決議書面に署名をそろえ、来週の週明けに先方へ提出する（住所欄に墨田区横川を追記）。$m$,
    $m$会社側（担当の発言なし）：月末預金予測の3月欄に、清水建設案件の部品代約270万円などの備考を追記し、株主向け資料にも載せる。$m$,
    $m$会社側（担当の発言なし）：収支均衡まであといくら調達が必要かを整理し、投資家に示せる形にする。$m$,
    $m$会社側：中期計画のファイルをまさに共有する（まさが会議外で確認するため）。$m$,
    $m$会社側：1月以降の取締役会日程を送る。原則は毎月最終週の水曜17:30、3月は31日にあたるため別日に調整。$m$,
    $m$会社側：株主総会を3月末（29〜31日ごろ）で調整して案内する。$m$,
    $m$会社側：来年度予算を中期計画をもとに作成する。$m$,
    $m$清水さん：12/1に北陸銀行と石川の行政へあいさつに行く（能登の大型風車案件）。$m$,
    $m$まさ：第2号議案の書面を読み直してから署名する（会議で発言。署名済みかは記録なし）。$m$,
    $m$まさ：1kW機の開発費を、まさが進める東京都のプロジェクトに組み込めるか検討する。$m$),
  jsonb_build_array(
    $m$兵庫県信用保証協会の案件で前金を何割受け取れるかは交渉中。$m$,
    $m$沖縄への本社登記の移転は、資金調達の状況を見て判断する（未決定）。$m$,
    $m$1.2億円と2億円で収支均衡に届く根拠（販売台数の増やし方、1kW機・廉価モデルへの投資効果）が数字で示されていない。$m$,
    $m$前澤ファンドが売却を希望し、売却先探しはBlack Water Financeに依頼するとの説明。以前から売却を希望していた株主と合わせて約40%との発言と読めるが、文字起こしが不明瞭で要確認。今回の調達への影響は未確定。$m$,
    $m$予実表・12月予算表・月次株主報告がDriveに未格納。数値は口頭説明からの値で、資料との照合が残る。$m$,
    $m$12月の予定：12/23 17:30の取締役会はカレンダーで予定どおり。会議では「12月の報告会は12/25 9:30」との案内があり、カレンダー未登録。$m$),
  $m$manual-notion:42397749c60881d0835dcff8458a8c82@2026-11-25T10:19:26Z+drive:1Qqvtr5x9m0xrWKWSFP21W_Ucvg4y89Zw$m$, NOW(), 'manual-amie-board-2026-11-25', $m$42397749-c608-81d0-835d-cff8458a8c82$m$, 'notion+calendar+drive',
  $m$## 🎯背景
2026年11月25日17:30からのチャレナジー定時取締役会（招集通知では押上オフィスとテレビ会議）。報告事項は10月度予算実績差異分析、11月月次報告、兵庫県信用保証協会の受注、資金調達状況。決議事項は12月度予算執行と、東京都グローバルサウスGX促進プロジェクト助成金に関するバタネス州との公証書類への署名の2件で、どちらも承認された。共有ドライブには招集通知だけが格納されており、数値は会議中の口頭説明による。

## 📊経緯
10月の支出は予算1,300万円に対し実績641万円だった。固定費は1名の時短と役員報酬の減額で約73万円下がり、開発費を除く月間支出は約600万円まで下がった。開発費の差額約586万円は支払いの後ろ倒しで、六ヶ所村の撤去費約400万円は廃棄完了が12月末のため1月に支払う。

兵庫県信用保証協会からは、新社屋の建て替えに合わせて風車1基を受注した。2月に設計会社から問い合わせがあり、理事長がテレビでチャレナジーを知っていたこと、検索で最上位に出たこと、建物の予算に組み込めたことが受注につながったと説明された。見積は695万円、粗利約35%、製造原価約440万円。2027年2月にアンカーを設置し、風車の設置は2027年10月に変わった。前金は契約の20日後に入る見込みで、事業継続が条件になる。マクニカを通さない直接受注のため、前金の交渉は会社自身が行う。マクニカが上乗せしていた200〜300万円がなくなるため、直販なら現行機でも約500万円で売れ、受注確率が上がると会社は見ている。

12月予算は906万円（固定費約589万円、開発費約317万円）。開発案件はほぼなく、園芸博（清水建設）の部品手配、兵庫案件のアンカー手配、三宅島の監視カメラ半年延長（6万円）、税金が中心。残高は10月末約2,300万円、11月末約1,400万円が底で、12月の入金で戻る。次の大きな支出は1月の六ヶ所村の支払い。3月末予測375万円について、入金352万円に対し支出が約1,000万円と大きい理由を問われ、清水建設案件の部品（約270万円）を2月末に買って3月に支払うためと説明された。

まさは、収支均衡まであといくら調達が必要かを投資家に示せるようにすべきと指摘した。会社の計画は、今回のラウンドで1.2億円を集めて売上で走り、さらに伸ばすために2億円を調達し、2027年の黒字化を目指す形。販売は広告費をかけず問い合わせを受ける方針で、展示会は補助金の範囲で選んで出る。マーケティング担当の採用は2028年以降。1kW機と廉価モデルの開発は、沖縄（来年度の助成金、沖縄への登記が条件）、北海道（12月中旬に打ち合わせ）、企業変革スクール（12月決定）の助成金で賄う方針で、現行の100W機は販売を続ける。海外ODA・JICA案件は、ODAに強いコンサルからの問い合わせが続き、12月に海外コンサルの交流会に参加する。まさは、1kW機の開発費を自身が進める東京都のプロジェクトに組み込めないか検討すると述べた。

第2号議案は、フィリピン側の議会承認に向けて代表者の権限を示す書面を求められたもの。顧問弁護士は、権限が実質的に広がるものではなく問題なしと確認した。設置は2都市で、今回求められたのは1都市分。住所欄に墨田区横川を追記する。

11月の月次報告では、フィリピンの保険金は状況が変わらず、入金見込みには入れていない。六ヶ所村の撤去は完了し、園芸博の風車は設置済みで移設もできる。三宅島は年内の作業なし、山梨（富士山科学研究所）の耐久試験は2月に結果報告を受ける。産業交流展でベンチャー技術大賞の特別賞を受け、自動車ステアリングメーカーとの打ち合わせが12/8に入った。導入補助（3分の2補助、上限5,000万円）が採択されれば販売に効く。資金調達は、12/1に北陸銀行と能登の大型風車案件で石川の行政へあいさつ、沖縄のファンド1社が前向きで秘密保持契約を締結、東京のベンチャーファンドとは次回東京で面談。坪井工業は見込みが下がった。前澤ファンドから先週、売却を希望すると連絡があり、売却先はBlack Water Financeに探してもらうとのこと。会社としては新規資金と合わせて株価を下げる形で受け入れる方向で考える。人員は現メンバーで2027年を回す。

## ✅決まったこと
- 第1号議案：2026年12月度の全社・開発予算906万円を承認（固定費約589万円、開発費約317万円）。
- 第2号議案：東京都グローバルサウスGX促進プロジェクト助成金における風車設置自治体（バタネス州）との公証書類への署名を承認。
- 兵庫県信用保証協会の案件はマクニカを通さない直接受注として進め、今後の契約は前金を前提にする。

## ▶️次の一手
- 清水さん：第2号議案の決議書面に署名をそろえ、来週の週明けに先方へ提出する（住所欄に墨田区横川を追記）。
- 会社側（担当の発言なし）：月末預金予測の3月欄に清水建設案件の部品代約270万円などの備考を追記し、株主向け資料にも載せる。
- 会社側（担当の発言なし）：収支均衡まであといくら調達が必要かを整理し、投資家に示せる形にする。
- 会社側：中期計画のファイルをまさに共有する。
- 会社側：1月以降の取締役会日程を送る（原則は毎月最終週の水曜17:30、3月は別日に調整）。
- 会社側：株主総会を3月末（29〜31日ごろ）で調整して案内する。来年度予算を中期計画をもとに作成する。
- 清水さん：12/1に北陸銀行と石川の行政へあいさつに行く。
- まさ：第2号議案の書面を読み直してから署名する（署名済みかは記録なし）。
- まさ：1kW機の開発費を東京都のプロジェクトに組み込めるか検討する。

## ⚠️残課題
- 兵庫県信用保証協会の前金の割合は交渉中。
- 沖縄への本社登記の移転は未決定で、資金調達の状況による。
- 1.2億円と2億円で収支均衡に届く根拠（販売台数の増やし方、1kW機・廉価モデルへの投資効果）が数字で示されていない。
- 前澤ファンドの売却希望が今回の調達に与える影響は未確定。以前から売却を希望していた株主と合わせて約40%との発言と読めるが、文字起こしが不明瞭で要確認。
- 予実表・12月予算表・月次株主報告がDriveに未格納で、数値は口頭説明からの値。
- 12/23 17:30の取締役会はカレンダーで予定どおり。会議で案内された「12月の報告会（12/25 9:30）」はカレンダー未登録。$m$)
ON CONFLICT (meeting_id) DO UPDATE SET summary_short = EXCLUDED.summary_short, decided = EXCLUDED.decided, progress = EXCLUDED.progress,
  next_actions = EXCLUDED.next_actions, risks = EXCLUDED.risks, narrative_md = EXCLUDED.narrative_md, notion_url = EXCLUDED.notion_url,
  notion_page_id = EXCLUDED.notion_page_id, source_kinds = EXCLUDED.source_kinds, source_hash = EXCLUDED.source_hash, title = EXCLUDED.title,
  generated_by_model = EXCLUDED.generated_by_model, generated_at = NOW(), updated_at = NOW();

UPDATE meeting_minutes_backfill_ledger SET status = 'recovered', last_attempt_at = NOW(), last_outcome = 'backfilled_manually',
  notes = $m$招集通知（Drive）とNotionの要約・文字起こしから手動でカードを作成（2026-11-26、migration 523）$m$, updated_at = NOW()
WHERE calendar_event_id = $m$_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g8d1j4c1j651jahhl6spk8gpg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g60qjcc9m6csk8e2164o44ghk750j6gi18orj6dq58l338cq18cp0_20261104T083000Z$m$;

INSERT INTO meeting_assets (meeting_id, project_id, storage_bucket, storage_path, file_name, media_type, file_size_bytes, asset_kind, caption,
  source_url, sort_order, created_by, drive_file_id, project_drive_folder_id, drive_folder_id, drive_folder_name, drive_folder_web_view_link,
  web_view_link, folder_display_path)
VALUES ($m$_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g8d1j4c1j651jahhl6spk8gpg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g60qjcc9m6csk8e2164o44ghk750j6gi18orj6dq58l338cq18cp0_20261104T083000Z$m$, 'p24', 'google-drive', $m$1Qqvtr5x9m0xrWKWSFP21W_Ucvg4y89Zw$m$, $m$2026年11月25日_取締役会招集通知.pdf$m$, 'application/pdf', 363690, 'upload',
  $m$取締役会招集通知と議案（2026-11-18付）$m$,
  $m$https://drive.google.com/file/d/1Qqvtr5x9m0xrWKWSFP21W_Ucvg4y89Zw/view?usp=drivesdk$m$, 10, 'amie', $m$1Qqvtr5x9m0xrWKWSFP21W_Ucvg4y89Zw$m$, $m$1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd$m$, $m$1YYRPUB3gYMsSyvSdxnTEZTWD2qw9vJPw$m$, '261125_取締役会',
  $m$https://drive.google.com/drive/folders/1YYRPUB3gYMsSyvSdxnTEZTWD2qw9vJPw$m$, $m$https://drive.google.com/file/d/1Qqvtr5x9m0xrWKWSFP21W_Ucvg4y89Zw/view?usp=drivesdk$m$, $m$PJフォルダ / 0_取締役会 / 261125_取締役会$m$)
ON CONFLICT (storage_path) DO NOTHING;

-- 2. 会社概要「総会・取締役会」---------------------------------------------------------
INSERT INTO project_shareholder_meetings (project_id, meeting_type, meeting_date, meeting_ym, location, agenda_summary, resolutions_json,
  amd_response, attachments_json, source_ref, notes)
SELECT 'p24', 'board', DATE '2026-11-25', '202611',$m$当社押上オフィス（テレビ会議）$m$,
  $m$2026年11月25日定時取締役会（17:30〜）。第1号議案「2026年12月度全社および開発予算執行」、第2号議案「東京都グローバルサウスGX促進プロジェクト助成金における風車設置自治体（バタネス州）との公証書類への署名」。$m$,
  jsonb_build_array(
    jsonb_build_object('type', '予算', 'title', $m$第1号議案：2026年12月度全社および開発予算執行（906万円。固定費約589万円、開発費約317万円）$m$, 'result', '可決'),
    jsonb_build_object('type', '契約・署名', 'title', $m$第2号議案：東京都グローバルサウスGX促進プロジェクト助成金における風車設置自治体（バタネス州）との公証書類への署名（清水さんを代表者として選任する一文）$m$, 'result', '可決')),
  'none',
  jsonb_build_array(jsonb_build_object(
    'kind', 'governance_attachment', 'name', $m$2026年11月25日_取締役会招集通知.pdf$m$, 'storage', 'google-drive', 'mime_type', 'application/pdf', 'size_bytes', 363690,
    'drive_file_id', '1Qqvtr5x9m0xrWKWSFP21W_Ucvg4y89Zw', 'drive_folder_id', '1YYRPUB3gYMsSyvSdxnTEZTWD2qw9vJPw', 'drive_folder_name', '261125_取締役会',
    'project_drive_folder_id', '1xg46zrp2tL0_bGkOqHDXOCEzYVgSCbkd', 'folder_display_path', $m$PJフォルダ / 0_取締役会 / 261125_取締役会$m$,
    'url', 'https://drive.google.com/file/d/1Qqvtr5x9m0xrWKWSFP21W_Ucvg4y89Zw/view?usp=drivesdk',
    'web_view_link', 'https://drive.google.com/file/d/1Qqvtr5x9m0xrWKWSFP21W_Ucvg4y89Zw/view?usp=drivesdk')),
  $m$drive:1Qqvtr5x9m0xrWKWSFP21W_Ucvg4y89Zw+notion:42397749c60881d0835dcff8458a8c82$m$,
  $m$招集通知（2026-11-18付）とNotionの文字起こしに基づく。2議案とも挙手で承認。議事録は未受領。報告事項：10月度予算実績差異分析、11月月次報告、兵庫県信用保証協会の受注（695万円、直接受注）、資金調達状況。資金調達状況の報告で、前澤ファンドが持ち株の売却を希望し、売却先探しはBlack Water Financeに依頼するとの説明があった。$m$
WHERE NOT EXISTS (SELECT 1 FROM project_shareholder_meetings WHERE project_id = 'p24' AND meeting_type = 'board' AND meeting_date = DATE '2026-11-25');

-- 3. 資本政策表: 前澤ファンド・前澤友作 A1種優先株式（Series C）の行のメモ ----------------------
UPDATE project_equity_transactions SET notes = notes || $m$
【2026-11-25 取締役会で報告】前澤ファンドが持ち株の売却を希望。売却先探しはBlack Water Financeに依頼するとの説明。会社は新規資金と合わせて株価を下げる形での受け入れを前向きに検討。売却の相手・株数・価格は未定。$m$,
  updated_at = NOW()
WHERE id = $m$ef04af4d-c2af-44b6-b8bb-bcbee3b70bb3$m$::uuid AND project_id = 'p24' AND notes NOT LIKE '%2026-11-25 取締役会で報告%';

-- 4. 10/28取締役会カード: 資金繰り表の宿題を済みに ------------------------------------------
UPDATE project_meeting_summaries
SET next_actions = jsonb_set(next_actions, '{0}', to_jsonb((next_actions->>0) || $m$ → 済み：11/25取締役会で3月末までの月末預金予測が提示された。$m$)),
    narrative_md = narrative_md || $m$

## 🔄その後の状況
- 2026-11-25の取締役会で、3月末までの月末預金予測が提示された（3月末予測375万円）。資金繰り表を3月末まで計算し直す宿題は済み。$m$,
    updated_at = NOW()
WHERE meeting_id = $m$_60q30c1g60o30e1i60o4ac1g60rj8gpl88rj2c1h84s34h9g60s30c1g60o30c1g8d1j4c1j651jahhl6spk8gpg64o30c1g60o30c1g60o30c1g60o32c1g60o30c1g60qjcc9m6csk8e2164o44ghk750j6gi18orj6dq58l338cq18cp0_20261007T083000Z$m$
  AND project_id = 'p24' AND (next_actions->>0) NOT LIKE '%済み：11/25%';

COMMIT;
