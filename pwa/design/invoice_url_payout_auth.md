# 請求書PDFアップロードURL修正 + Payout権限エラー修正

## 2026-04-09: ScriptApp.getService().getUrl() → WEBAPP_BASE_URL 修正
- **背景**: 旧Slack投稿の「請求書PDFアップロード」ボタンのURLが古いadmin GASデプロイURLに飛んでしまい、何を押しても反応しなかった
- **決定**: `gas-main/007_FreeeInvoiceFlow.js` の2箇所で `ScriptApp.getService().getUrl()` を `PropertiesService.getScriptProperties().getProperty("WEBAPP_BASE_URL")` に修正
- **理由**: `ScriptApp.getService().getUrl()` はデプロイごとにURLが変わるためCLAUDE.mdで禁止されているパターン。正本URLである `WEBAPP_BASE_URL` ScriptPropertyを使うべき
- **影響範囲**: `007_FreeeInvoiceFlow.js` L552（uploadUrl）、L1218（cancelUrl）。L1588はフォールバックとして残存するが先に WEBAPP_BASE_URL を読むため問題なし

## 2026-04-09: Admin GAS Payout権限エラー修正（OAuth再認可）
- **背景**: admin GASのPayoutsタブを開くと `SpreadsheetApp.openById を呼び出す権限がありません` エラーが発生。appsscript.json にはスコープあり。GASエディタからの手動実行では問題なし
- **決定**: GAS実行ログの失敗エントリにある「権限を付与するにはここをクリック」リンクからOAuth再認可を実施
- **理由**: `admin_listPayoutYmCandidates` (A066_PayoutPaidRepo:73) がWebアプリ経由で実行される際、GCPプロジェクト（AMD-OS-GCP）のOAuth認可が切れていた。デプロイ更新では認可プロンプトは出ない。実行ログの失敗エントリから認可フローを起動する必要があった
- **影響範囲**: admin GAS Webアプリのスプレッドシートアクセス全般
