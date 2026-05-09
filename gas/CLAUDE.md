@../../CLAUDE.md

# CLAUDE.md — AMD OS 開発コンテキスト

共通の人格・作業姿勢・ハンドオフ・記憶管理は `/Users/masa/projects/CLAUDE.md` と `/Users/masa/projects/AGENTS.common.md` に従う。

## プロジェクト概要

AMD OS は Team ARMADA が複数のディープテックスタートアップ（DTSU）を同時並行・長期で経営するための業務OS。  
Google Apps Script + Google Spreadsheet を正本DBとし、Notion / Slack / freee / Google Drive / Calendar と連携する。

**思想：事実と解釈の徹底分離 / append-only / 人の判断を消さない**

---

## GASプロジェクト構成（4分割）

| プレフィックス | プロジェクト | 主な責務 |
|---|---|---|
| なし（000-799） | 本体GAS | UI + コアAPI |
| A（A000-A999） | AMD-Admin GAS | 管理機能 |
| R（R000-R999） | AMD-Report GAS | cronパイプライン・バックグラウンド |
| S（S000-S999） | AMD-Slack GAS | Slack連携・つくよみ |
| D（D000-D999） | dev-AMD-OS GAS | 開発管理ツール（Tickets/Blueprint/Code Search） |

**重要：** `google.script.run` はそのページを配信したGASプロジェクト内の関数しか呼べない。別プロジェクトの関数は参照不可。

---

## ファイル命名規則

- 全ファイルの先頭に **3桁番号 + アンダースコア**（例: `055_ProjectCockpit_Api.gs`）
- 同一機能は連番（例: `094_Repo / 095_Ops / 096_Cron`）
- 800番台は One-time関数（バックフィル・マイグレーション）専用
- ファイル冒頭にファイル名と役割コメントを必ず記載
- 新規ファイル追加前に使用済み番号を必ず確認

---

## DB配置方針

| スプレッドシート | ScriptPropertiesキー | 格納DB |
|---|---|---|
| 本体スプシ | `MAIN_SPREADSHEET_ID` | DB_Projects, DB_Members, DB_BillingCycle, DB_TsukuyomiContext 等 |
| Navigatorスプシ | `NAVIGATOR_SPREADSHEET_ID` | DB_SourceCache, DB_Tasks, DB_ProjectKnowledge, DB_TsukuyomiMemory 等 |
| Adminスプシ | `ADMIN_SPREADSHEET_ID` | DB_Settings, DB_BillingNudgeLog 等 |
| DevスプシID | `DEV_SHEET_ID` | DB_DesignLog, DB_Blueprint, Cache_Temp 等 |

**スタンドアロンGASでは `getActiveSpreadsheet()` は使えない。必ず `openById()` を使う。**

---

## 絶対に守るルール

### 1. コード変更の3点セット
コードを修正・追加するときは必ず：
1. どのファイルか
2. 置換前のコード（関数全体なら `function xxx(` だけでOK、「関数全体置換」と明記）
3. 置換後のコード

コードブロック内に説明文を混在させない。

### 2. LLMプロンプトはコードに書かない
すべてのLLMプロンプトは `DB_TsukuyomiContext` に格納する。コード内にsystemPromptの文字列リテラルを書くことを禁止。  
新しいtagを使うときは **必ず先に `DB_TsukuyomiContextTags` に登録** する。

### 3. google.script.run の返却値は toClientSafe_ でラップ
`JSON.parse(JSON.stringify())` だけではDate型が `{}` になる。  
`toClientSafe_` は `A003_Util.gs`（AMD-Admin）と `010_Utils.gs`（本体）に定義済み。

### 4. replace_original は必ず false
Slack の `response_url` 使用時は `replace_original: false` を必ず明示する。デフォルトが `true` のため元メッセージが消える。

### 5. codeName-only ルール
UI表示・コード内でメンバーの実名を表示しない。`codeName` がない場合は `"PM"` にフォールバック。`name` / `memberName` フィールドへのフォールバックは禁止。

### 6. 年月パラメータは yyyymm 形式
`yyyy-mm` 形式は禁止。Spreadsheetが日付型に自動変換してバグになる。

### 7. 日時表示は必ずJST・日本語フォーマット
`2026年3月22日 14:30` 形式。`toISOString()` をそのまま表示することを禁止。

### 8. DB_BillingCycleのym列はテキスト形式
書き込み後はセル書式を必ずテキスト（`@`）に設定する。数値型になると文字列比較が失敗する。

### 9. ScriptPropertiesキー名は推測しない
不明なキー名はユーザーに確認する。確認済みキー：`MAIN_SPREADSHEET_ID` / `NAVIGATOR_SPREADSHEET_ID` / `WEBAPP_BASE_URL` / `ADMIN_SPREADSHEET_ID` / `DEV_SHEET_ID`。

### 10. 既存関数は使う前にシグネチャを確認
「～があるはず」で呼ばない。複数の既存関数を組み合わせる新関数は、全シグネチャ確認後にコードを出す。

### 11. try-catch は最小単位のみ
関数全体を囲む広いtry-catchは禁止。エラーをcatchしたら必ず `Logger.log` でスタックトレース付きログを出す。

### 12. 新規関数追加前に重複確認
同名関数が既に存在すると実行時バグになる。追加前に必ず確認。

### 13. 累積 vs 増分
LLMは増分（delta）を出力する。DBは累積（cumulative）を保存する。変換は書き込み時に行う。

### 14. clasp push はGAS側のファイル削除をしない
`clasp push` はローカルのファイルをGASに同期するが、**GAS側にだけ残っている不要ファイルは削除されない**。ファイルリネームや削除を行った後は、push前に以下のチェックを必ず実行する：

```bash
cd /Users/masa/amd-os && grep -h '^let \|^const \|^var ' *.js | sed 's/ =.*//' | sort | uniq -d
```

- 出力が空なら安全。出力があれば重複ファイルが存在する
- `clasp push` が `Script is already up to date.` を返してファイル削除を反映しない場合、残すファイルにダミー変更を加えてpushし、push後にダミーを戻す
- **`clasp pull` はGAS側の全ファイルでローカルを上書きするため、安易に使わない**（削除済みファイルが復活する）

---

## 主要アーキテクチャパターン

### L1 → L2 パイプライン
- **L1（3:10 JST）**: `SourceCacheCron` が Notion/Slack/Gmail/Drive/GMeet を `DB_SourceCache` に蓄積
- **L2（5:00 JST）**: `MonthlyReportCron` が `DB_SourceCache` から読んで月次報告書を生成

### キャッシュ戦略（DB_BillingCycle）
- `msProgressSummaryJson`: MSの進捗バー表示用。毎日5:30のcronで更新
- `rewardSummaryJson`: 報酬計算結果キャッシュ。手動操作後は即時再構築する（clearではなくupdateを使う）

### Slack アーキテクチャ
```
Slack → Cloud Run (amd-slack-webhook, asia-northeast1) → GAS doPost
```
Cloud RunでSlackの3秒タイムアウトを回避し、GASに非同期転送。

### GAS並列配置ルール
共通関数（freeeコア・SheetHelpers・Utils等）は各GASプロジェクトに独立ファイルとして配置。  
例：`006_FreeeCore.gs` / `A006_FreeeCore.gs` / `R006_FreeeCore.gs`

---

## クロスプラットフォーム機能の正本仕様 (PWA / Supabase 横断)

GAS は外部サービスから Supabase へデータを供給するハブ役。Supabase スキーマや PWA 表示と密に絡む機能の仕様は PWA 側 `pwa/design/` 配下に正本がある。GAS 側で改修する前に必ず読む。

| 機能 | 正本 md | GAS 側責務 |
|---|---|---|
| **AMD OS 中核データ正本 (L2 + cron)** ⭐⭐⭐ | [`pwa/design/L2_DATA.md`](../pwa/design/L2_DATA.md) | **データに触る GAS 作業の前に必ず読む**。L2 6 種 / 全 cron / 動作状況の正本 |
| **MTG サマリ** (各回 decided/progress/nextActions/risks) | [`pwa/design/meeting_summaries.md`](../pwa/design/meeting_summaries.md) | **Phase 3 (毎時 polling)**: 153 が 60-180 分前に終わった events を毎時スキャン → 074 で Notion + Gmail 結合 → Gemini → Supabase `project_meeting_summaries` upsert (source_hash 差分検知) → 拾えれば `meeting_notifications` に upsert (iOS Swift APNs 連携)。Phase 2 月単位 fallback は 152 が 03:00 daily で実行 |
| **iOS APNs 通知** (議事録拾い時) | [`ios/HANDOFF_meeting_notifications.md`](../ios/HANDOFF_meeting_notifications.md) | Supabase `meeting_notifications` テーブルに upsert する役。Swift 側が notified_at IS NULL を polling/realtime sub で受信 → APNs 送信 → notified_at = now() に UPDATE |

新規にクロスプラットフォーム機能を追加するときも `pwa/design/` に正本を作り、ここに行を追加する。

---

## 主要ファイルマップ（本体GAS）

| ファイル | 役割 |
|---|---|
| `001_Router.gs` | doGet・ページルーティング |
| `000_Sheets.gs` | シート名定数 |
| `003_Util.gs` / `010_Utils.gs` | ユーティリティ（toClientSafe_等） |
| `040_ProjectRepo.gs` | DB_Projects CRUD |
| `055_ProjectCockpit_Api.gs` | Cockpit公開API（約2400行・肥大化中） |
| `058_RewardV2_Repo.gs` | DB_MilestoneMonthlyProgress CRUD |
| `059_RewardV2_Ops.gs` | 報酬計算ロジック（rv2_calcRewardSummary） |
| `060_RewardV2_Estimator.gs` | LLM進捗推定 |
| `068_CockpitNudgeQueue_Api.gs` | ナッジキュー |
| `069_SubItemRepo.gs` | DB_MilestoneSubItems CRUD |
| `074_MeetingSummaryRepo.js` | **MTGサマリ Phase 2/3 抽出ロジック** (1 PJ × 1 ym + 1 event 単位)。`nav_meeting_extractForProjectYm_` / `nav_meeting_processOneEvent_`。仕様 `pwa/design/meeting_summaries.md` |
| `086_ValuePlanRepo.gs` | DB_ValueMilestones CRUD |
| `092_AdminLLMExtractors.js` | Protocol Store の LLM プロンプト install 関数 (`run_installMeetingExtractorConfig` 等) |
| `097_BillingBudget_Repo.gs` | 請求額申告Repo |
| `098_BillingBudget_Api.gs` | 請求額申告API |
| `099_PwaApi.js` | PWA から GAS 関数を curl で叩くための Web App エンドポイント (listProps / runFunc) |
| `122_NotionBlocksRepo.js` | Notion ページ本文 (blocks) を rich_text として取得 |
| `152_NavigatorCron.js` | 03:00 daily cron (`nav_cronMonthlyExtractAt3`)。MTGサマリ Phase 2 月単位 fallback もここから呼ぶ |
| `153_MeetingHourlyTrigger.js` | **MTGサマリ Phase 3 毎時 polling cron** (`nav_meeting_pollRecentlyEndedEvents`) + setup (`nav_meeting_setupHourlyPollTrigger_`) |
| `163_LlmRouter.gs` | LLM呼び出し共通ルーター |
| `172_TsukuyomiContextRepo.gs` | DB_TsukuyomiContext読み書き |
| `180_SupabaseClient.js` | Supabase REST 共通クライアント (`supa_upsert` / `supa_select`、service_role 権限) |
| `313_MsProgressSummary_Cron.gs` | 毎日5:30のMS進捗サマリ更新cron |
| `CalendarToNotionMinutes.js` | 毎日 03:00 で「明日分の calendar event について Notion 議事録枠を自動生成」する cron (`cron_createMinutesFromCalendar`)。Phase 3 の上流 |
| `CalendarPJResolver.js` | CFG_ColorPJHistory + CFG_PJAlias で calendar event → PJ 判定 |

### Cockpit HTMLファイル（500番台）

| ファイル | 役割 |
|---|---|
| `500_CockpitPage.html` | メインHTML・2カラムレイアウト |
| `501_CockpitStyles.html` | CSS |
| `502_CockpitGoals.html` | MS一覧・サブMS・クライテリア |
| `503_CockpitModal.html` | モーダル制御・タブ切替・ユーティリティ |
| `504_CockpitReward.html` | 報酬ダッシュボード・進捗バー |
| `505_CockpitReport.html` | 報告書生成・FIX |
| `506_CockpitMsDesign.html` | MS設計モーダル |
| `507_CockpitMsRevision.html` | MS改定モーダル |
| `508_CockpitOrigin.html` | Origin関連 |
| `510_CockpitRoutine.html` | 月次ルーティンフロー |
| `511_CockpitInvoice.html` | 請求書発行・MTGスケジュール |
| `514_CockpitKanban.html` | TODOカンバン（pending/todo/doing/done） |
| `515_CockpitMacro.html` | マクロ提言パネル |

---

## AMD-Report GAS 主要ファイル

| ファイル | 役割 |
|---|---|
| `R301_MonthlyReport_Api.gs` | 月次報告書生成API |
| `R311_SourceCacheRepo.gs` | DB_SourceCache CRUD |
| `R313_MonthlyReport_Cron.gs` | 月次報告書cron（毎日5:00） |
| `R319_SourceCacheCron.gs` | SourceCache収集cron（毎日3:10） |
| `R320_SourceCacheGoogleMeet.gs` | GMeet議事録収集 |
| `R540_IssuesTasksLlm.gs` | SourceCache→LLM→DB_Tasks(pending) パイプライン |

---

## 頻出バグパターンと対処

| バグ | 原因 | 対処 |
|---|---|---|
| `DB_TsukuyomiContext` が取れない | `getActiveSpreadsheet()` をスタンドアロンGASで使用 | `openById(MAIN_SPREADSHEET_ID)` を使う |
| `DB_BillingCycle` の行が見つからない | ym列が数値型に変換されている | セル書式をテキスト(`@`)に設定 |
| `milestoneKey` が一致しない | `DB_ValueMilestones` の識別子は `milestoneId`、`DB_MilestoneMonthlyProgress` の識別子は `milestoneKey` だが同値 | lookupは必ず `ms.milestoneId` で行う |
| `withFailureHandler` に落ちる | Date型のシリアライズ失敗 | `toClientSafe_()` でラップ |
| freee取引先が0件 | `freee_listPartners_` はprivate関数で他GASから呼べない | `A006_FreeeCore.gs` の `b_freeeRequestAccounting_` を使う |
| `tsukuyomi_listContextRows` の戻り値 | `{ok, rows}` を返す | `.rows` を取り出してから使う |
| SubItemsのmsMap不一致 | `DB_MilestoneSubItems` に `projectId` 列がないため全PJのSubItemが混入 | `msMap` に存在する `milestoneKey` のみに絞り込んでからフォールバック判定 |
| キャッシュが古いまま | `clear` して空にするだけ | 手動操作後は必ず `cockpit_updateRewardSummaryCache_` / `cockpit_updateMsProgressSummary_` で再構築 |

---

## LLM設定

- モデル指定: `DB_LlmModelConfig` の `usageKey` で行う（モデル名のハードコード禁止）
- APIキー: `ANTHROPIC_API_KEY`（ScriptProperties）
- opts の `maxTokens` は camelCase（`max_tokens` ではない）
- `llm_callJson` はJSONパース失敗時に `null` を返す → 呼び出し側でnullチェック必須

---

## Slackナッジ（AMD-Slack GAS）の主要ファイル

| ファイル | 役割 |
|---|---|
| `S010_SlackApi.gs` | Slack API呼び出し基底 |
| `S030_TsukuyomiReply.gs` | Slackスレッド返信・記憶抽出 |
| `S040_TsukuyomiContext.gs` | systemPrompt構築・DB_TsukuyomiMemory注入 |
| `S060_NudgePoster.gs` | 月次ナッジ投稿cron |
| `S080_BillingNudge.gs` | 請求額申告催促DM |

---

## WebアプリURL管理

- 本体WebアプリURL: `ScriptProperties['WEBAPP_BASE_URL']`
- AdminページURL: `ScriptProperties['ADMIN_WEBAPP_URL']`
- `ScriptApp.getService().getUrl()` は使用禁止（デプロイごとにURLが変わる）

---

## ScriptProperties 正本リスト (本体 GAS)

**えいみへ**: ルール 9「キー名は推測しない」遵守。ここに無いキーを使うときは推測せず、まず以下の手順で listProps を叩いて確認する。

最終確認日: 2026-05-08 (リストは `?action=listProps` で随時取得可能)。

| キー | 用途 |
|---|---|
| `ANTHROPIC_API_KEY` | Claude (Anthropic) API |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | OpenAI API |
| `GEMINI_API_KEY` | Gemini (Google AI Studio) API ← MTG サマリ抽出 (2026-05-08 追加) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service_role secret (※ `_ROLE_KEY` ではない) |
| `NOTION_TOKEN` / `NOTION_DATABASE_ID` / `NOTION_PJ_DATABASE_ID` | Notion API + 議事録 DB / PJ DB |
| `NOTION_LAST_SYNC_ISO` | Notion 同期 last cursor |
| `MAIN_SPREADSHEET_ID` (※未確認) / `NAVIGATOR_SPREADSHEET_ID` / `NAVIGATOR_STORE_SPREADSHEET_ID` / `PROTOCOL_STORE_SPREADSHEET_ID` / `DEV_SHEET_ID` / `COLOR_PJ_CONFIG_SPREADSHEET_ID` | スプシ ID 各種 |
| `WEBAPP_BASE_URL` / `ADMIN_WEBAPP_URL` | Web App URL |
| `FREEE_*` (CLIENT_ID, CLIENT_SECRET, ACCESS_TOKEN, REFRESH_TOKEN, ACCESS_TOKEN_EXPIRES_AT, COMPANY_ID, INVOICE_FOLDER_ID) | freee API |
| `SLACK_BOT_TOKEN` / `SLACK_TSUKUYOMI_BOT_TOKEN` / `SLACK_TSUKUYOMI_BOT_USER_ID` / `SLACK_ADMIN_CHANNEL_ID` / `SLACK_ACTIVITY_CHANNELS` / `SLACK_INTERACTIVE_QUEUE_JSON` | Slack API |
| `MAIN_CALENDAR_ID` | (任意) MTG サマリ Phase 3 毎時 polling 用 calendar id override。本番 cron では Session.getEffectiveUser で取れるので未設定でも OK (2026-05-09 追加) |
| `MEETING_PENDING_TRIGGERS` | (廃) Phase 3 ad-hoc trigger 試作時の名残 (現在は使用してない、polling 方式に切替) |
| `MONTHLY_REPORT_SLIDE_TEMPLATE_ID` | 月次レポート slide テンプレ |
| `PAYOUT_*` (LOGOTYPE_FILE_ID, LOGO_FILE_ID, NOTICE_TEMPLATE_SLIDES_ID, PREVIEW_FOLDER_ID) | 支払通知書 |
| `REIMBURSE_NOTIFY_QUEUE_JSON` | 立替精算通知キュー |
| `DEV_EXPORT_DOC_ID` | dev export Doc |
| `_BACKFILL_SLACK_POINTER` | Slack バックフィル進捗 cursor |

新規キーを追加するときはこの表を更新する。

---

## GAS 関数を CLI/curl から実行する手順 (えいみ用)

`clasp run` は Cloud Project mismatch でうまく動かない。代わりに **Web App pwaApi の `runFunc` action** で任意関数を実行できる仕組みを `099_PwaApi.js` に組み込み済み (2026-05-08)。

### 1. コード反映 (clasp push + deployment update)

```bash
cd /Users/masa/projects/AMD/amd-os/gas   # または worktree の gas/
npx --yes @google/clasp@latest push --force
npx --yes @google/clasp@latest deploy \
  --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G \
  --description "v<NNNN>_<short_desc>"
```

`--deploymentId` は **PWA が叩いてる本番 deployment** (`amd-os-pwa` の `NEXT_PUBLIC_GAS_WEBAPP_URL` で使用中)。これを update することで `/exec` が新コードを serve するようになる。

### 2. 関数を呼ぶ (curl / GET only)

```bash
URL=$(grep '^NEXT_PUBLIC_GAS_WEBAPP_URL=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | cut -d= -f2- | tr -d '"')
KEY=$(grep '^NEXT_PUBLIC_GAS_API_KEY=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | cut -d= -f2- | tr -d '"')

# 引数なし
curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=run_installMeetingExtractorConfig"

# 引数あり (JSON 配列を URL encode)
ARGS=$(node -e 'console.log(encodeURIComponent(JSON.stringify(["p21","202604"])))')
curl -sL --max-time 360 \
  "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=nav_meeting_extractForProjectYm_&args=$ARGS"
```

レスポンスは `{ok, data: {fn, ms, result}}` の JSON。

### 3. ScriptProperties キー一覧を取る

```bash
curl -sL "$URL?mode=pwaApi&key=$KEY&action=listProps"
# → {"ok":true,"data":{"keys":[...], "count": N}}
```

値は伏せる仕様 (key 名のみ)。値を直接見たいときは GAS Editor の「プロジェクトの設定」を使う。

### 4. ScriptProperties に値をセット

`oneTime_setScriptProperty(name, value)` (180_SupabaseClient.js) を runFunc で呼ぶ。値は伏せて返却。

```bash
ARGS=$(node -e 'console.log(encodeURIComponent(JSON.stringify(["GEMINI_API_KEY","<key>"])))')
curl -sL "$URL?mode=pwaApi&key=$KEY&action=runFunc&fn=oneTime_setScriptProperty&args=$ARGS"
```

### 5. 制約

- **GAS Web App 実行制限 6 分**。1 関数呼び出しでこれを超えないこと。
- 長い処理は `maxItems` などのバッチ制限を入れて、bash ループ等で外側から繰り返し叩く。
- POST は doPost が未実装で 404 → GET のみ。値が長い場合は base64 等で encode。
- 認証は `NEXT_PUBLIC_GAS_API_KEY` (= `PWA_API_KEY`) のみ。漏れると任意関数を実行されるため、キー漏洩には特に注意。

詳細は `099_PwaApi.js` の `pwaApi_handle_` 内 `listProps` / `runFunc` 分岐参照。

---

## 関数の公開範囲

- 内部処理関数: 末尾アンダースコア（例: `rv2_calcRewardSummary_`）→ GASエディタの手動実行メニューに表示されない
- 公開関数: アンダースコアなし → `google.script.run` から呼び出し可能
- 手動実行を指示するときは **ファイル名と関数名の両方** を明記する

---

## Dev GAS（dev-AMD-OS）

開発管理ツール。AMD OSとは別のスタンドアロンGAS。

| タブ | 機能 |
|---|---|
| Tickets | 開発チケット管理（カンバン形式） |
| Design Log | 設計ログCRUD・一括JSON追加 |
| Blueprint | 設計仕様書（旧DataMap）管理・LLM可視化 |
| Code Search | 全GAS横断コード検索 |
| Files | 全GASファイル一覧・関数一覧 |
| Sheets | 全スプシのシート一覧・ヘッダコピー |

---

## セッション終了時の出力形式

設計ログJSON配列を出力すること：

```json
[
  {
    "category": "new|change|delete|refactor",
    "targetFiles": "ファイル名",
    "summary": "変更内容",
    "reason": "理由",
    "sessionNote": "補足"
  }
]
```
