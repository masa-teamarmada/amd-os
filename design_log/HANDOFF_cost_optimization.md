# HANDOFF — Claude Code コスト最適化

## 最終更新
2026-04-11（3回目）/ Daily Intelligence GAS 動作確認・バグ修正完了

---

## 完了タスク

### CLAUDE.md 整備
- 共通CLAUDE.md（`claude/CLAUDE.md`）に以下を追記：
  - `### コスト最適化：モデル切り替え` — タスク難易度に応じて `/fast` を自動判断
  - `### コスト最適化：トークン多消費パターンの確認` — 丸投げ系依頼で確認を挟む
  - `### コスト参考単価（2026年4月・APIベース換算）` — 操作別コスト目安テーブル

### CLAUDE.md プラットフォーム別分割（コンテキスト汚染防止）
- `Chronicle/CLAUDE.md` → 共通のみにスリム化
- `Chronicle/ios/CLAUDE.md` → 新規作成（iOS専用）
- `Chronicle/gas/CLAUDE.md` → 新規作成（GAS専用・詳細ルール全移植）
- `Chronicle/web/CLAUDE.md` → PWA固有内容を追記
- `amd-os-pwa/CLAUDE.md` → 新規作成（AMD OS PWA専用）

### gas-external-research 新規GASプロジェクト（Gemini移行）
- フォルダ: `AMD_OS/gas-external-research/`
- Script ID: `1HdxZHquu9ezRB3cJHsQVhvwfNchM7BJ5NtmvYJmaTMsUOPJe7D2rkCks`
- GCP Project: `123807875383`（課金設定済み）
- 実装ファイル:
  - `010_Config.js` — 6PJ分の検索キーワード設定（overview.mdベース）
  - `020_GeminiSearch.js` — Gemini 2.5 Flash + Search Grounding
  - `030_Cron.js` — 平日9時cron、月曜72h、平日24h
- ScriptProperties設定済み: `GEMINI_API_KEY` / `REPORT_API_KEY` / `REPORT_API_URL`
- トリガー設定済み・MMOマシンの旧スケジュールタスク削除済み
- **節約効果: 月約¥8,000 → ほぼ¥0**

### overview.md 更新（ウェブ調査ベース）
- `AMD_Business/BWE/overview.md` — CO2回収から逆電気透析（RED）塩分濃度差発電に全面修正
- `AMD_Business/CTB/overview.md` — バイオ一般から虚血性脳卒中×レドックスナノ粒子（CTB211）に全面修正

### R163_LlmRouter.js: Gemini プロバイダ追加
- `llm_call()` に `gemini` ブランチ追加
- `admin_upsertLlmModelConfig()` のバリデーションに `gemini` 追加
- `llm_callGemini_()` 関数を追加（Gemini REST API直呼び、Search Groundingなし）
- gas-main に clasp push 済み

### SX overview.md: 杉浦先生の名前修正
- 「杉浦美和」→「杉浦美羽」に全置換

### Daily Intelligence: GAS + Gemini 実装完了・動作確認済み
- gas-external-research に 5ファイル追加してデプロイ済み（9ファイル）
  - `040_DiConfig.js` — DB_Projects(status=active) × DB_DiProjects でPJ管理。スプシ上で追加・編集可能
  - `050_DiCollector.js` — Phase 0+1（overview.md + Notion/Slack/Gmail/Calendar収集）
  - `060_DiAnalyzer.js` — Phase 2（Gemini 2.5 Flash で4種分析、maxOutputTokens: 16384）
  - `070_DiWriter.js` — Phase 3+4（R001_Api.js 5アクション書き込み + Slack投稿）
  - `080_DiCron.js` — cronエントリポイント + 手動テスト関数
- ScriptProperties設定済み: `MAIN_SPREADSHEET_ID` / `NOTION_TOKEN` / `SLACK_BOT_TOKEN`
- DB_DiProjects シート作成済み（6PJ）
- **動作確認済み**: `di_test_p20()` (CX) で全フロー通過確認

### Daily Intelligence: バグ修正（3回目セッション）
- **Gemini出力トランケート**: `maxOutputTokens: 4096` → `16384` に変更
- **Slackスレッド取得漏れ**: 親メッセージが古くても `latest_reply` が昨日以降なら取得（7日分遡る）
- **時刻ウィンドウ**: `26h固定` → `昨日0時JST固定` に変更（手動テスト・本番cron両方で確実に昨日全日分を取得）

### appsscript.json スコープ追加
- `spreadsheets.readonly` → `spreadsheets`（DB_DiProjects 初回作成に書き込み権限が必要）

---

## 未完了・継続タスク

### Daily Intelligence: GAS トリガー設定（まさが手動で設定）
- GASエディタで `di_cron_all` のトリガーを追加
- 時間帯: 毎日 3:00-4:00 JST

### Daily Intelligence: MMOマシンのスケジュールタスク削除
- 6PJ分のスケジュールタスク（p06-ctb-daily 等）が MMOマシンで動いているはず
- GAS cronが正常動作確認後、これらを削除して完全移行

### gas-external-research 手動テスト
- `externalResearch_run()` の手動1回実行（外部リサーチ全6PJ）をまだ実施していない

### overview.md 精度向上（残PJ）
- SE / ZMP / CX はウェブ調査未実施

---

## 既知の問題・ブロッカー

- Gemini APIキー（前セッション）がチャット履歴に残っている → Google AI Studio でローテーション推奨
- BWEの代表者名: 公式サイトは「Mari Yoshizaki / 吉崎真里」だがAMD内部記録では「吉﨑万莉」→ 要確認
- Daily Intelligence: Notion Integration が各PJのワークスペースにアクセス権を持っているか要確認（現状Notion 0件）

---

## このセッションで得た知見

### 1・2回目セッション（前回まで）
- **computer-use（スクショ）は1枚3,000〜5,000トークン** → API発行等のブラウザ操作はまさが自分でやる方が安い
- **GAS + Gemini Flash の Search Grounding** はWeb検索タスクに最適。Opusの65〜80倍安い
- **`gemini-2.0-flash` は新規ユーザー向け廃止** → `gemini-2.5-flash` を使う
- **新規GCPプロジェクトは課金設定なしだとクォータ0** → Google AI StudioのAPIキーでも課金アカウントのリンクが必要
- **Drive MCP は .md ファイルを検索・取得できない** → GAS内でDriveApp.getFolderById().getFilesByName()で取得する設計にした
- **Daily Intelligence は L1/L2 分割不要**。GAS + Gemini Flash なら1回の実行（1-3分）で完結する

### 3回目セッション（本日）
- **`spreadsheets.readonly` はシート作成に不足** → `spreadsheets`（フルスコープ）が必要
- **`MAIN_SPREADSHEET_ID` にScript IDを入れるミスに注意** → スプレッドシートのIDとGASスクリプトIDは別物
- **Gemini 2.5 Flash の出力上限**: `maxOutputTokens: 4096` は複数PJ分析に不足 → 16384推奨
- **Slackスレッドの時刻問題**: `conversations.history` は親メッセージのtsでフィルタされるため、古い親に昨日の返信があるスレッドは漏れる。`latest_reply`フィールドを使い7日分遡って補完する
- **テスト時刻と本番cron時刻のズレ**: 26h固定だと昼間テスト時に朝の活動が漏れる。「昨日0時JST」固定が最も意味的に正確
