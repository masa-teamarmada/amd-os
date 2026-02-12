# AMD OS — Claude Code オンボーディングドキュメント

> 最終更新: 2026-02-13
> 対象: Claude Code に本プロジェクトのコンテキストを与えるための包括ドキュメント

---

## 1. プロジェクト概要

AMD OS は、株式会社チームアルマダ（Team ARMADA）が複数のディープテックスタートアップ（DTSU）を同時並行・長期・再現可能に経営するための業務OS。

単なる管理SaaSではなく、「事実を正しく積み上げ、人間の判断を支える」ことを最優先に設計されている。

### 技術スタック

- **バックエンド**: Google Apps Script（.gs ファイル）
- **フロントエンド**: HTML/CSS/JS（GAS の HtmlService でサーブ）
- **DB**: Google Spreadsheet（DB_* シートが正本）
- **外部連携**: Notion API / Slack API / Google Calendar / Google Drive / Gmail / freee API / OpenAI API (Claude)
- **LLM**: OpenAI Responses API 経由で Claude を利用（090_OpenAIClient.gs）

### デプロイ形態

- GAS の doGet/doPost による Web アプリケーション
- Slack Webhook / Interactivity エンドポイントとしても動作
- 月次報告書は別デプロイ（400/401）として独立 WebApp あり

---

## 2. 設計思想（AMD OS 憲章 v0.1 より）

1. **事実と解釈を分離する** — 事実は DB に、解釈や要約は派生物として扱う。派生物はいつでも捨てられるが、事実は捨てない。
2. **再生成より追記（append-only）を優先する** — 「もう一度作る」は原則禁止。時系列で積み上げ、履歴として残す。
3. **人の判断を消さない** — AMD OS は自動化装置ではなく判断補助装置。最終判断は必ず人（PM / クローザー / 管理者）が行う。
4. **設計は脳内に置かない** — 暗黙知は必ず外部化する。「知ってる前提」は事故の元。

### 正本（Single Source of Truth）

- PJ・契約・請求・支払・進捗などの事実 → **Spreadsheet（DB_*）が唯一の正本**
- UI / Slack / Notion / LLM の出力 → すべて派生物であり、正本ではない
- Notion は議事録・書き起こし・思考メモを置く場所。Notion 自体は正本ではなく、AMD OS に取り込まれた時点で DB 側が正となる

---

## 3. アーキテクチャ — 4層構造（厳守）

```
UI（HTML/CSS/JS）     — 表示と操作のみ。判断ロジックを持たない
API（*Api.gs）        — UIとの契約点。薄く保つ
Domain（*Ops.gs/*Domain.gs） — 状態遷移・業務ルール・判断の中核
Repo（*Repo.gs）      — DB I/O 専用。解釈を入れない
```

この責務分離は破ってはいけない前提。

---

## 4. ファイルナンバリング規則

すべてのファイル名は冒頭に3桁の数字を入れ、数字のあとはアンダースコアを入れる。各ファイルの冒頭にはファイル名とそのファイルの役割をコメントとして記載する。

| 番号帯 | 役割 |
|--------|------|
| 000–049 | 基盤（Router / AccessControl / Utils / Profiler） |
| 050–099 | プロジェクト共通ドメイン（Home / Charter / Billing 等の土台） |
| 100–149 | 外部連携（Slack / Notion / freee / Google 系） |
| 150–179 | Admin・運用（管理画面、監査、メンテ含む） |
| 170–179 | つくよみ専用枠（固定） |
| 200–219 | 共通 UI |
| 220–299 | ページ UI |
| 300–399 | モーダル / サブページ |
| 900–999 | 廃止 / 退避（置換した旧ファイルはここへ送る） |

同一機能は「Api / Repo / Ops」のように並べて連番にする。
例：つくよみ系は 170〜179 を連続で使う。

---

## 5. コーディング規約

### 年月パラメータ
- `yyyymm` 形式を正とする（`yyyy-mm` は禁止）
- 例: `202502`（2025年2月）

### 日時表示
- 日本時間（JST / Asia/Tokyo）を必ず使う
- 日本人なら誰でも理解できるフォーマットにする

### GAS 固有の制約
- `console` は使えない（`Logger.log` を使う）
- 引数付き手動実行は不可。引数なし手動実行ボタンのみ可能
- テスト用にはラッパー関数を作る

### スプシヘッダ行・初期データ
- タブ区切りで出力する（パイプ区切り禁止）
- そのままコピペで各列に入る形式にすること

---

## 6. ファイル一覧（主要ファイル）

### 基盤層（000–049）

| # | ファイル | 役割 |
|---|---------|------|
| 001 | 01_Router.gs | doGet/doPost 入口、HTML テンプレ切替、URL 生成、Nav 注入 |
| 002 | 02_AccessControl.gs | 権限管理、admin 判定、PJ アクセス判定、deny 画面生成 |
| 010 | 10_Utils.gs | HTML エスケープ、型変換、JSON 安全化、日付/ym 計算 |
| 011 | 11_Profiler.gs | 簡易プロファイラ（処理時間マーク取得と記録） |

### Home / Charter / Project（020–049）

| # | ファイル | 役割 |
|---|---------|------|
| 020 | 20_HomeApi.gs | HomePage から呼ばれる API（PJ 一覧、PJ 作成、月次タスク状況） |
| 021 | 21_HomeRepo.gs | Home の DB_* シート読み書き |
| 030 | 30_CharterApi.gs | Charter ページの API（チャーター取得/保存、ファイルアップロード） |
| 031 | 31_CharterRepo.gs | DB_ProjectCharter / DB_CharterSaveLog の読み書き |
| 040 | 40_ProjectRepo.gs | DB_Projects（PJ マスタ）の Repo |

### 共通ドメイン（050–099）

| # | ファイル | 役割 |
|---|---------|------|
| 050 | 50_FreeePartner.gs | freee 取引先確定の単機能 |
| 051 | 051_RewardScoring_Api.gs | 報酬スコアリング API エントリポイント |
| 052 | 052_RewardScoring_Ops.gs | イベントスコア集計・バッファ配分・A スコア正規化 |
| 053 | 053_RewardScoring_Repo.gs | DB_ProgressEvents / DB_EventResponsibility / DB_MonthlyRewardPayout |
| 054 | 054_RewardScoring_EventExtract.gs | LLM による月次報告書からの進捗イベント抽出 |
| 055 | 055_ProjectCockpit_Api.gs | コックピット画面 API（PJ 基本情報 + 直近 N 月分サマリ） |
| 056 | 056_RewardScoring_Trigger.gs | 報酬スコアリング日次トリガー（毎日 3:00 JST） |
| 060 | 60_ClientNameChange.gs | クライアント名変更申請フロー |
| 061–066 | 061_PayoutApi 〜 066_PayoutPaidRepo | Payout（支払）系の Api / Repo / Domain / freee 通知 / メール |

### Admin・運用（070–099）

| # | ファイル | 役割 |
|---|---------|------|
| 071 | 71_AdminActionLog.gs | DB_AdminActionLog への追記（監査ログ） |
| 072 | 072_NavigatorApi.gs | Navigator サーバ API（Monthly Extract / Open Issues / 履歴） |
| 073 | 073_NavigatorRepo.gs | Navigator のデータアクセス層 |
| 074–075 | 074_SettingsApi / 075_SettingsRepo | ユーザー通知設定（gmail/slack 切替） |
| 076–078 | 076〜078_Navigator* | Nudge / Observe / MonthlyFix の Repo / Api |
| 080–082 | 080_SlackWebhook / 081_SlackInteractive / 082_Reimburse | Slack 受信、立替ページ API |
| 083–084 | 083_TimelineApi / 084_TimelineSeedOps | Timeline ページ API、BillingCycle の存在保証 |
| 085–086 | 085_ValuePlanApi / 086_ValuePlanRepo | 年間価値設計（LLM 連携） |
| 088–089 | 088_ValueContributionRepo / 089_ValueContributionAi | タスク→マイルストーン貢献 |
| 090 | 090_OpenAIClient.gs | OpenAI Responses API クライアント（Claude 呼び出し） |
| 090 | 90_AdminProjects.gs | Admin PJ 管理（一覧取得、カスケード削除） |
| 091–093 | AdminProtocols / AdminGenreTags / AdminContextTags | Protocol / タグ管理 |
| 099 | 99_Maintenance.gs | 運用・移行用手動コマンド置き場 |

### 外部連携（100–149）

| # | ファイル | 役割 |
|---|---------|------|
| 112 | 112_FreeeInvoiceTemplates.gs | freee 請求書テンプレ一覧取得 |
| 115 | 115_SlackNotify.gs | PJ の Slack チャンネルへ通知投稿 |
| 122 | NotionBlocksRepo.gs | Notion ページ本文を blocks から取得・テキスト化 |

### Admin・つくよみ（150–179）

| # | ファイル | 役割 |
|---|---------|------|
| 150 | 150_AdminTsukuyomiProfiles.gs | DB_TsukuyomiProfiles ヘッダ保証 |
| 151 | 151_TsukuyomiProfilesOps.gs | Billing + Projects → Profiles 自動更新 |
| 152 | NavigatorCron.gs | 毎日深夜 3 時の Monthly Extract 自動生成 |
| 155–156 | AdminMembers / AdminUsers | メンバー DB ヘッダ保証、ユーザー管理 |
| 160 | 160_CodeSearch.gs | Admin 用コード横断検索 |
| 170 | 170_TsukuyomiOps.gs | Admin つくよみ入口（PJ 一覧・投稿生成） |
| 171 | 171_TsukuyomiReply.gs | スレッド返信（履歴→生成→返信） |
| 172 | 172_TsukuyomiContextRepo.gs | 人格 DB から persona 組立、systemPrompt 合成 |
| 173–174 | TsukuyomiMemoryRepo / Ops | 記憶 DB（append / 一次・二次要約） |
| 175 | 175_TsukuyomiMonthlyReminder.gs | 月次リマインド文面生成・投下 |
| 176–179 | TsukuyomiNudge* | Nudge Planner / Collector / Poster / Merge |

### 通知・アラート（182–187）

| # | ファイル | 役割 |
|---|---------|------|
| 182 | 182_NotifyCore.gs | 通知共通コア（Slack DM / チャンネル / Gmail） |
| 183 | 183_TsukuyomiBillingPaymentDueAlerts.gs | 未入金期日アラート |
| 185 | 185_SlackNotify.gs | Slack 通知送信基盤 |
| 186 | 186_SlackInteractive.gs | Slack Block Kit ボタン受信・署名検証 |
| 187 | 187_ReimburseAlerts.gs | 立替精算アラート |

### UI ファイル（220–260）

| # | ファイル | 役割 |
|---|---------|------|
| 220 | 220_HomePage.html | ダッシュボード（全 PJ 健康状態一覧 → コックピット遷移） |
| 221 | 221_PjShellPage.html | PJ 個別画面のシェル（SPA モード用） |
| 222 | 222_TimelinePage.html | タイムラインページ |
| 225 | 225_ProjectCockpit.html | PJ コックピット（目標階層 + 月次タイムライン + モーダル） |
| 230 | 230_NavigatorPage.html | Navigator ページ |
| 240 | 240_AdminPage.html | Admin ページ |
| 241–260 | AdminTabs 〜 TsukuyomiTab | Admin 各タブ、モーダル、データリスト |

### 月次報告書（301–312, 400–401）

| # | ファイル | 役割 |
|---|---------|------|
| 301 | 301_MonthlyReport_Api.gs | 月次報告書 API 入口 |
| 302 | 302_MonthlyReport_Collector.gs | 4 ソース（Notion/Slack/Drive/Gmail）収集オーケストレーション |
| 303 | 303_MonthlyReport_Generator.gs | LLM(Claude) で月次報告書生成（つくよみ人格） |
| 304 | 304_MonthlyReport_Repo.gs | DB_MonthlyReports 読み書き |
| 305–309 | NotionExtract / SlackExtract / GmailExtract / CalendarExtract / DriveExtract | 各ソース抽出 |
| 310 | 310_MonthlyReport_Formatter.gs | 日時フォーマット統一（全て JST） |
| 311 | 311_MonthlyReport_CollectionCache.gs | 収集データのスプシキャッシュ |
| 312 | 312_MonthlyReport_FixApi.gs | 修正プロンプト機能（修正指示→LLM 修正→override 保存） |
| 400 | 400_MonthlyReport_WebApp.gs | 月次報告書独立 WebApp バックエンド |
| 401 | 401_MonthlyReport_WebApp.html | 月次報告書 UI |

### Billing 系（B_* ファイル）

| ファイル | 役割 |
|---------|------|
| B_BillingApi.gs | Billing UI から呼ばれる api_ 関数集約 |
| B_BillingDomain.gs | Billing 状態管理・DB 更新ルール（BillingCycle / BillingLog） |
| B_FreeeCore.gs | freee OAuth + API 呼び口の唯一定義 |
| B_FreeeInvoiceFlow.gs | freee 請求書発行業務フロー（ドラフト→発行→PDF→DB 反映） |
| B_FreeeInvoicePdf.gs | freee 請求書 PDF の Drive 保存（署名 URL / Bearer フォールバック） |
| B_FreeeProjectSettings.gs | freee 取引先/テンプレ設定の同期 |
| B_InvoiceEmail.gs | 請求書送付（宛先解決→添付→送信→DB 反映） |
| B_PaymentConfirm.gs | 入金確認フロー（トークン→リンク→DB 反映） |
| B_PayoutDetail.gs | DB_PayoutDetail 高速読み取り |
| B_Agreement.gs | 配賦合意フロー（メール→トークン→合意→集計） |
| B_AdminBilling.gs | Billing 管理者操作（スキーマ初期化、承認系） |
| B_CalendarMonthly.gs | 月次報告会のカレンダー連携 |
| B_RoutineAlerts.gs | 月次ルーティン期限アラート |
| B_Sheets.gs | スプシ DB_* シートの汎用 I/O（open / header 保証 / read / upsert） |
| B_Util.gs | 共通純関数（文字列整形、日付正規化、配列集計、型変換） |

---

## 7. DB シート一覧（主要テーブル）

### メインスプレッドシート（AMD_OS_DB）

| シート名 | 用途 | 備考 |
|---------|------|------|
| DB_Projects | PJ マスタ | projectId, projectName, clientName, status, slackChannelId, driveFolderId, reportEmails, freee 設定 等 |
| DB_Members | メンバーマスタ | memberId, email, slackId, notifyChannel, isAdmin, bankInfo 等 |
| DB_ProjectMembers | PJ-メンバー紐付け | projectId, memberId, isActive, isPM, roleLabel |
| DB_BillingCycle | 月次請求サイクル正本 | projectId, ym, 各ステップの完了日時（budgetConfirmedAt, invoiceSentAt, paymentConfirmedAt 等） |
| DB_BillingLog | Billing 操作ログ（append-only） | |
| DB_MonthlyReports | 月次報告書正本 | projectId, ym, reportText, fixCount, lastFixedAtJst |
| DB_MonthlyCollectionCache | 月次報告書の収集データキャッシュ | |
| DB_MonthlyReportEdits | 修正ログ（before/after/feedback） | |
| DB_ProjectCharter | PJ 憲章 | |
| DB_CharterSaveLog | Charter 保存ログ | |
| DB_ProgressEvents | 進捗イベント（LLM 抽出） | eventId, projectId, ym, title, impact, depth, status(draft/confirmed/rejected) |
| DB_EventResponsibility | イベント×メンバーの貢献度 | eventId, memberId, responsibility, appreciation |
| DB_MonthlyRewardPayout | 月次報酬配分結果 | |
| DB_ProjectMonthlyPayout | PJ 月次配賦 | |
| DB_PayoutAgreement | 配賦合意記録 | |
| DB_PayoutDetail | 支払明細 | |
| DB_PayoutNotices | 支払通知書 | |
| DB_PayoutPaid | 振込完了正本（ym + memberId 複合キー） | |
| DB_Reimbursements | 立替精算正本 | |
| DB_Protocols | AMD Protocols | |
| DB_GenreTags | ジャンルタグマスタ | |
| DB_TsukuyomiContext | つくよみ人格 DB（tags で用途分類） | |
| DB_TsukuyomiProfiles | つくよみ PJ プロファイル（avgCloseDay, stuckStatus 等） | |
| DB_TsukuyomiNudgeQueue | つくよみ投稿予定キュー | |
| DB_TsukuyomiNudgeLog | つくよみ投稿ログ | |
| DB_TsukuyomiNudgeArtifacts | つくよみ Nudge 成果物 | |
| DB_TsukuyomiMemory | つくよみ記憶 DB | |
| DB_TsukuyomiMemoryDigest | つくよみ一次要約 | |
| DB_TsukuyomiMemoryDigest2 | つくよみ二次要約 | |
| DB_SlackEventLog | Slack イベント受信ログ | |
| DB_SlackInteractiveQueue | Slack Interactive 処理キュー | |
| DB_SlackInteractiveLog | Slack Interactive 処理ログ | |
| DB_NotionMinutesAudit | Notion 議事録監査 | |
| DB_AdminActionLog | Admin 操作監査ログ | |
| DB_AccessLog | アクセスログ | |
| DB_AccessGrants | アクセス権付与 | |
| DB_LicenseActionLog | ライセンス操作ログ | |
| DB_Users | ユーザーマスタ | |
| DB_InvoiceCancelTokens | 請求書取消トークン | |
| DB_ClientNameChangeTokens | クライアント名変更トークン | |
| DB_PaymentConfirmTokens | 入金確認トークン | |
| DB_ProjectStage | PJ ステージ | |
| DB_Stages | ステージマスタ | |
| DB_TaskTemplate | タスクテンプレート | |
| DB_TaskInstances | タスクインスタンス | |
| DB_ArtifactTemplates | アーティファクトテンプレート | |
| DB_ArtifactInstances | アーティファクトインスタンス | |
| DB_KnowledgeCards | ナレッジカード | |
| DB_Organizations | 組織マスタ | |
| Config | 設定 | |
| LOG_BillingInput | Billing 入力ログ | |
| VIEW_経理ToDo | 経理用ビュー | |
| VIEW_未入金アラート | 未入金アラートビュー | |
| VIEW_配賦チェック | 配賦チェックビュー | |
| VIEW_アラート | アラートビュー | |
| VIEW_StageTaskMatrix | ステージ×タスク マトリクスビュー | |

### Navigator スプレッドシート（Navigator_AMD_OS）

| シート名 | 用途 |
|---------|------|
| DB_NavigatorNudgeItems | つくよみ Nudge 由来の進捗アイテム |
| DB_ValueContributions | タスク→マイルストーン貢献 |
| DB_NavigatorMonthlyTodos | Navigator 月次 ToDo |
| DB_NavigatorMonthlyEdits | Navigator 修正ログ |
| DB_NavigatorTextBlocks | Navigator テキストブロック |
| DB_NavigatorHistory | Navigator 履歴 |
| DB_NavigatorIssues | Navigator 課題 |
| DB_NavigatorMonthlyItems | Navigator 月次アイテム |
| DB_NavigatorMonthly | Navigator 月次データ |
| DB_ValuePlanDraft | 年間価値計画ドラフト |
| DB_LLMChatLog | LLM チャットログ |
| DB_ValuePlanCycles | 価値計画サイクル |
| DB_ValueMilestones | 価値マイルストーン（年間 100pt 分解） |
| DB_ValuePlanRevisionLog | 価値計画改訂ログ |

### Calendar スプレッドシート（CalendarRepo_AMD_OS）

| シート名 | 用途 |
|---------|------|
| RAW_稼働ログ | カレンダーイベント生データ |
| VIEW_月別PJ別_稼働 | 月別 PJ 別稼働ビュー |
| VIEW_月別PJ別_経費 | 月別 PJ 別経費ビュー |
| CFG_* | 各種設定テーブル |

---

## 8. 報酬配分制度（v1.0）

AMD の報酬は月ごとに「進捗イベント」を拾い、4 ファクターでスコア化して支払額を決定する。

### 4 ファクター

```
イベント価値 × 個人貢献度 = (Impact × Depth) × (Responsibility × Appreciation)
```

- **Impact（インパクト）**: 1〜5。事業全体への波及度
- **Depth（確定度）**: 0.0〜1.0。「もう戻らない前提」になった度合い
- **Responsibility（背負い度）**: 結果がダメだったとき説明責任を負うか
- **Appreciation（ありがたさ）**: その貢献が誰かにとってどれだけ助けになったか

### 予算構造

```
クライアント請求額
  ├── 30% → AMD 運営費
  ├── 5%  → クローザー報酬
  └── 65% → PJ 予算（メンバー配分対象上限）
         ├── 50% → スコアベース配分
         ├── 10% → ありがたさボーナス
         └── 5%  → イレギュラータスク
```

年間価値 100 ポイントを正本とし、1pt = 年間予算の 1%。

### 技術実装

- 日次トリガー（056_RewardScoring_Trigger.gs）で月次報告書から LLM がイベント抽出
- DB_ProgressEvents に draft として保存 → PM が confirmed/rejected に更新
- Appreciation は Slack チャンネルの活動（リアクション・感謝メッセージ）から AI が自動スコアリング
- コックピット（225_ProjectCockpit.html）のモーダルから閲覧・操作可能

---

## 9. 開発完了済みタスク

7 タスクのロードマップのうち #1〜#6 が完了。

| # | タスク | 状態 |
|---|--------|------|
| 1 | Slack 連携テスト・修正 | ✅ 完了 |
| 2 | Admin PJ 管理リファクタ | ✅ 完了（バッチ保存、sticky columns） |
| 3 | Admin メンバー管理 | ✅ 完了 |
| 4 | つくよみ Admin（DB 移行） | ✅ 完了（DB_TsukuyomiContext 4 行管理） |
| 5 | active フィルタ + トグル | ✅ 完了 |
| 6 | 修正プロンプト機能 | ✅ 完了（312_MonthlyReport_FixApi.gs） |
| 7 | PJ ページ 6 点セット | 🔄 設計着手済み → 下記参照 |

### 追加で完了した作業

- 月次報告書 4 ソースリデザイン（reportEmails ベースの Gmail 抽出）
- Admin PJ テーブル：driveFolderId / reportEmails 列追加
- saveProjectRow の 6 段ネスト→バッチ化リファクタ
- ym フォーマット問題の修正（テキスト書式強制）
- 報酬スコアリング全体（051–056）の新規実装
- コックピット画面（225）の新規実装（目標階層 + 月次タイムライン + モーダル）
- ホームページ（220）の全面リデザイン（コンパクトカード式ダッシュボード）
- 日次自動トリガー（差分抽出、二重抽出防止、4 分タイムアウト制御）

---

## 10. 現在の設計方向と残課題

### 大方針の転換（2026-02-12 決定）

BillingPage を「月次ルーティンのステップバイステップ UI」として維持する方針を撤回。代わりに以下の 3 チャネル分散に移行する。

1. **Slack つくよみ**: PM の日常導線で予算確定・請求書発行等をボタン操作で完了
2. **Google カレンダー**: 月次報告会スケジューリング。webhook/バッチで BillingCycle に記録
3. **コックピット**: ステータス確認・配賦確定・報酬配分の操作場所

### Phase 計画

| Phase | 内容 | 状態 |
|-------|------|------|
| Phase 1 | コックピット新規作成（月次報告書 + 報酬配分） | ✅ 基本完成 |
| Phase 2 | Billing 機能をコックピット + Slack に移植 | 🔜 次の着手対象 |
| Phase 3 | PJ ストーリー画面（Charter + ステージ遷移 + 意思決定ログ） | 未着手 |

### 具体的な残タスク

**Phase 2 で必要なこと:**

- [ ] Slack ボタンアクションの追加（186_SlackInteractive.gs に予算確定・請求書発行・取消）
- [ ] 請求書発行→PDF→送付の自動パイプライン化（B_FreeeInvoiceFlow.gs 拡張）
- [ ] カレンダー→BillingCycle 連携バッチ
- [ ] コックピットに配賦サマリ + 確定ボタン設置
- [ ] 立替精算の請求書上乗せフロー設計・実装
- [ ] BillingPage.html / InvoicePdfUploadPage.html / ClientNameChangePage.html を 900 番台に退避

**API レイヤーで残すもの（Phase 2 でも維持）:**

- B_BillingApi.gs / B_BillingDomain.gs（状態遷移エンジン）
- B_FreeeCore.gs / B_FreeeInvoiceFlow.gs / B_FreeeInvoicePdf.gs（freee 連携）
- B_PaymentConfirm.gs（入金確認フロー、既に自動化済み）
- B_Agreement.gs（配賦合意フロー）
- B_Sheets.gs / B_Util.gs（汎用基盤）

**その他の残課題:**

- [ ] 報酬計算の年間予算値の設定（四半期→年間への変換が未確定）
- [ ] DB_ValueMilestones のデータ投入（目標階層の上 3 段はプレースホルダー）
- [ ] つくよみ Nudge 系（176–179）の安定化
- [ ] Navigator 系の今後の扱い決定（コックピットに統合 or 縮小）
- [ ] 221_PjShellPage の iframe アプローチ廃止判断

---

## 11. つくよみ（Tsukuyomi）について

つくよみは AMD OS 内の AI 人格。Slack 上でプロジェクトチャンネルに常駐し、以下の役割を担う。

- **月次リマインド**: 月次ルーティンの進捗を確認し、PM にやさしく催促
- **Nudge**: 停滞検知→事実ベースの刺し質問を投稿（メンション制御あり、20:00〜08:00 はメンション強制 OFF）
- **スレッド返信**: Slack スレッドで質問されたら、コンテキストを踏まえて返答
- **記憶**: 全スレッドの会話を記憶 DB に保存、100 件ごとに一次要約→二次要約
- **月次報告書生成**: 4 ソース（Notion/Slack/Drive/Gmail）から収集→Claude で報告書生成

人格は DB_TsukuyomiContext（tags 分類）で管理。コンテキストは 172_TsukuyomiContextRepo.gs で systemPrompt に合成される。

---

## 12. 重要な設計判断の履歴

1. **Navigator を「Notion 再走査装置」にしない** — Navigator は月次確定事実の閲覧・追記・可視化に限定。Notion 直接再走査は禁止。
2. **BillingPage の UI 集約主義からの脱却** — OSが持つべきは「状態の記録と可視化」であって「作業の実行場所」ではない。
3. **コックピットとストーリーの分離** — 月次フォーカス（コックピット）と通期フォーカス（ストーリー）はタイムスケールが違うので分離。
4. **報酬配分は絶対基準** — メンバー間の相対評価ではなく、年間 100pt に対する絶対的な貢献量で計算。低貢献月は未消化予算として残る。
5. **月次報告書の品質を最優先** — ここが高品質であれば、その上に報酬配分も意思決定ログもすべて載せられると判断。

---

## 13. 開発時の注意事項

- 新しい実装を考える前に、必ず既存コードを探す（160_CodeSearch.gs を使う）
- 「なさそうだから作る」は禁止 → 「調べたが存在しない」を明示してから作る
- 正本を増やす変更は、憲章改訂が必要
- コード修正は関数全体の置換で示す（部分パッチ禁止）
- GAS エディタでは console なし、引数付き手動実行不可
- テスト用にはラッパー関数を作る（例: `function test_xxx() { xxx("p21", "202601"); }`）

---

## 14. ScriptProperties に設定が必要なキー（主要）

| キー | 用途 |
|------|------|
| SLACK_BOT_TOKEN | Slack Bot Token |
| SLACK_SIGNING_SECRET | Slack 署名検証 |
| FREEE_CLIENT_ID / FREEE_CLIENT_SECRET | freee OAuth |
| FREEE_REFRESH_TOKEN | freee リフレッシュトークン |
| FREEE_COMPANY_ID | freee 事業所 ID |
| FREEE_IV_BASE | freee 請求書 API ベース URL |
| OPENAI_API_KEY | OpenAI API キー（Claude 利用） |
| PROTOCOL_STORE_SPREADSHEET_ID | Protocol Store 外部スプシ ID |
| NOTION_API_TOKEN | Notion API トークン |

## 絶対禁止事項
- `clasp push` は絶対に実行しないこと（リモート完全上書きで既存コードが消える）
- `clasp deploy` も禁止
- コード変更はすべてローカルのみ。リモート反映はまさが手動で行う