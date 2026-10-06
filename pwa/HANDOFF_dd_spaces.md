# DD・3領域の引き継ぎ（2026-10-05）
仕事種別: development。製品修正は完了、次の製品変更は未指定。

- コックピット・ワークスペース・DDを並列化し、同じ正本データと本文を使う。使い方はmanual/2-1・2-3・2-6、確定仕様はspec/2-1・3-23・3-24・5-17、全画面仕様はios/DESIGN。
- DD本文共通化の最終commitは4f52e150（v3.157.1）。前セッションで本番配信・画面確認済み。今回の着手時main/origin/mainは6d75f288、未pushなし。開始時に再取得する。
- 検証・ファイル単位の履歴はdesign_log/sessions_2026-10.mdのDD引き継ぎ項。移行プロンプトは ../SESSION_MIGRATION_PROMPT.md。
- 技術・競合本文の3領域一致、13非資料ページの読取り、PL/CF・資本政策・廃液/燃料両試算・会社概要・資料室を確認。ファイル公開対象と正式PDF選択は維持。追加認可や書込みなし。
- migration469は本番適用済み。ネイティブDDは未移植。理論/model変更なし。

## 共有checkoutの保全・次の判定
今回の引き継ぎは別作業が編集中のHANDOFF_pwa_rebuild.mdを変更しない。
月次報告書の印刷3ファイル、4更新API、PDF API、MonthlyReports/Selectors、PDF生成2lib、next.configと関連manual/spec/DESIGN/build-infoは別作業。所有者は月次報告書/PDF改善担当（チャットIDは未特定）。期限/次判定: 担当のcommit・push・配信確認後にstatusを照合。現在アクティブ継続は未確認なのでアーカイブ不可。
旧SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは9/22別作業の未完タスク報酬移行資料として保持。所有者はタスクpt移行担当。次判定: 現行spec/3-14と移行完了履歴を照合して採否を確定。削除・今回commit対象ではない。
旧root移行プロンプト（Gmail照合）は別作業資料なので原文をdesign_logではなくrootの専用保存先へ退避。最新プロンプトはDD用。
最初の行動: 共通ルールと上記正本を読み、fetch/statusで並行作業を確認してからまさの次依頼を扱う。

## 2026-10-06 契約リスト

契約リストを3領域へ常設し、専用APIで契約単位のDD表示選択を保存。詳細正本はspec5-17・3-24、機能とguardはFEATURE_REGISTRY。migration482は本番適用済み、再適用不要。SOLいよぎんNDAはaccepted/under_review、未締結・日付条件未確認、dd_visible=true。主キーb5e39c23-6039-428d-bddf-5f90bb6f862a。取得・表示の検証はPCだけ（まさ指定）。Swiftの追加実装なし。外部共有やメール送信なし。決議ページも3会議体の器の表示まで反映済み。

## 2026-10-06 掲載範囲の訂正

「関連PJだけで契約リストに載せる」は撤回。project_partyまたは明示採用したproject_relatedだけを掲載・計上する。SOLは指定NDA1件のみ、ほかの4件はstudio_serviceで一覧対象外、元台帳は維持。migration483本番適用済み、再適用しない。詳細はspec5-17。今後未分類を自動で関連契約にせず、契約主体/明示採用を確認する。
