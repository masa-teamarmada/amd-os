# Finance / Payment Confirm 仕様

AMD の請求 → 入金確認 → 会計反映までの finance 系オペレーション仕様。 admin 専用画面 `/admin/finance`、 SU 側担当が叩く公開 confirm 画面 `/payment-confirm`、 自動 nudge / 同期 cron を含む。

> 関連: 入金確認 nudge 経由で更新される `billing_cycles.payment_confirmed_at` は [2-3 章 1.5 月次ルーティン](2-3-pj-cockpit.md#15-月次ルーティン--報告書--請求--会計) の「入金確認」ステップの正本。 freee API + Slack DM + admin 画面の 3 経路から更新される。

## 画面と API

| URL | 役割 | 認可 |
|---|---|---|
| `/admin/finance` | 月次 finance 概況。 recurring items、 receipt events、 freee 連携状況、 入金未確認 cycle 一覧を見る | admin |
| `/payment-confirm?token=XXX` | SU 側担当が「予定通り入金しました」を 1 クリックで申告する公開ページ | signed token で認可 |
| `POST /api/admin/payment-confirm` | confirm 申告を受けて `billing_cycles.payment_confirmed_at` を更新。`mode=expected` は入金予定額のまま Slack action から確定、通常 POST は実額入力フォームから確定 | signed token verify |
| `GET /api/cron/freee-payment-sync` | freee 会計の income deals を読み、 該当する `billing_cycles` を payment_confirmed に上げる | `CRON_SECRET` |
| `GET /api/cron/payment-confirm-nudges` | 当日が支払日付近の cycle を抽出、 SU 担当に Slack DM を送る | `CRON_SECRET` |

## signed token (= `payment-confirmation` token)

`pwa/src/lib/payment-confirmation.ts` が正本。 公開 `/payment-confirm` URL に SU 担当を誘導するための HMAC-SHA256 token。

### payload

```ts
type PaymentConfirmationPayload = {
  projectId: string;          // 対象 PJ
  invoiceYm: string;          // 請求書 ym (= YYYYMM)
  sourceYms: string[];        // 報酬計算源の ym 配列 (= 1 請求書に複数月含む場合あり)
  expectedAmountYen: number;  // 税込の入金予定額
  expectedNetAmountYen: number; // 請求額（税抜）
  recipientSlackId?: string | null; // Slack DM 送信先
  exp: number;                // expiry epoch ms
};
```

### 仕組み

```text
token = base64url(JSON.stringify(payload))
      + "."
      + base64url(HMAC-SHA256(secret, body))

secret = process.env.PAYMENT_CONFIRM_TOKEN_SECRET
       || process.env.CRON_SECRET
```

- `createPaymentConfirmationToken(payload)` で発行 (= 14 日 expiry default)
- `verifyPaymentConfirmationToken(token)` で検証 (= `crypto.timingSafeEqual` で signature 比較、 `exp` チェック)

期限切れ token は `Error("token expired")`。 改ざん token は `Error("invalid token signature")`。 公開 URL なので、 secret が漏れない限り 3rd party は他 PJ の confirm を叩けない。

## /payment-confirm 画面

`/payment-confirm?token=XXX` を Slack DM 経由で開いた SU 担当が見る画面 (= `pwa/src/app/payment-confirm/PaymentConfirmClient.tsx`)。

| 表示 | 内容 |
|---|---|
| 請求対象 | `payload.projectId` の `projects.project_name` |
| 請求書 ym | `payload.invoiceYm` |
| 源 ym リスト | `payload.sourceYms` |
| 入金予定額 | `payload.expectedAmountYen` (= 税込) / `expectedNetAmountYen` (= 請求額・税抜) |
| 入力欄 | 実振込額 (= 確認用、 default は expectedAmountYen)、 任意メモ |
| ボタン | 「入金確認しました」→ `POST /api/admin/payment-confirm` |

POST 完了後は `billing_cycles.payment_confirmed_at=now()` / `payment_confirmed_by` set、 `status='payment_confirmed'`、 `billing_log` に `action='payment_confirmed'` で 1 行 insert される。

### confirmPaymentGroup (= 複数月一括 confirm)

1 請求書が複数月分 (= `sourceYms` 配列長 > 1) を含むケースがある (= 報告会 1 回で 2 ヶ月分まとめて請求する PJ など)。 `confirmPaymentGroup` は payload の `sourceYms` 全件を一括 update する:

```ts
db.from("billing_cycles")
  .update({ payment_confirmed_at, payment_confirmed_by, status: "payment_confirmed" })
  .eq("project_id", payload.projectId)
  .in("ym", sourceYms);
```

すでに `payment_confirmed_at` set 済の cycle も update するが、 `alreadyConfirmed` カウントに含めて log の `detail` に残す。

`billing_log.detail` JSONB:

```json
{
  "source": "slack_actual" | "slack_expected" | "freee_deal" | "freee_wallet_txn",
  "invoice_ym": "202605",
  "source_yms": ["202604", "202605"],
  "amount_yen": 350000,
  "expected_amount_yen": 350000,
  "expected_net_amount_yen": 314125,
  "note": "ご担当さんメモ",
  "recipient_slack_id": "U01ABCDEF",
  "freee": {...} | null,
  "confirmed_at": "2026-06-01T01:00:00Z"
}
```

`source` の値:

| value | 入る経路 |
|---|---|
| `slack_actual` | SU 担当が `/payment-confirm` から実振込額を入れて確定 |
| `slack_expected` | SU 担当が `/payment-confirm` で予定額のまま「OK」を押した |
| `freee_deal` | `/api/cron/freee-payment-sync` が freee の income deal を引いて一致確認 |
| `freee_wallet_txn` | freee wallet_txn (= 銀行取引) で一致確認 |

## /admin/finance

admin が finance 全体を俯瞰する画面 (= `pwa/src/app/(app)/admin/finance/page.tsx`)。

| ブロック | 内容 | 主な table |
|---|---|---|
| recurring items 一覧 | サブスク / 固定継続費 (= サーバー代 / SaaS 等) のマスタ | `company_finance_recurring_items` |
| receipt events 直近 | Gmail 領収書 / freee 自動引落 / 振替明細 | `company_finance_receipt_events` |
| 未入金 cycle | `billing_cycles.invoice_sent_at IS NOT NULL AND payment_confirmed_at IS NULL` | `billing_cycles` |
| freee 連携状況 | `freee_oauth_tokens.updated_at` から token 鮮度判定 | `freee_oauth_tokens` |
| 入金確認 nudge 履歴 | `billing_log` の `action='payment_confirm_nudged'` / `'payment_confirmed'` | `billing_log` |

### recurring_items 列

| column | 役割 |
|---|---|
| `display_name` | 「OpenAI Plus」「Vercel Pro」 等の表示名 |
| `vendor_name` | 振込先名 |
| `item_kind` | `subscription` / `loan` / `tax_payment` 等 |
| `category` | `fixed_cost` / `cogs` 等 |
| `amount_yen` | 月額 (= 想定値、 実額は `company_finance_receipt_events` で補正) |
| `frequency` | `monthly` / `quarterly` / `annual` |
| `start_ym` / `end_ym` | 期間 |
| `auto_debit` | 自動引落か否か |
| `withdrawal_account` | 引落口座 |
| `next_expected_ym` | 次回引落予想 ym |
| `last_receipt_at` | 直近 receipt event の occurred_on |

### receipt_events 列

| column | 役割 |
|---|---|
| `recurring_item_id` | 紐付く recurring item (= NULL なら単発) |
| `ym` / `receipt_date` | 領収日 |
| `vendor_name` / `amount_yen` | 振込先と金額 |
| `payment_method` / `withdrawal_account` | 自動引落 / 振込 / クレカ 等 |
| `source_kind` | `gmail` / `freee_wallet_txn` / `manual` |
| `attachment_refs` | 添付 (= 領収書 PDF/PNG の Drive ref) |
| `budget_suggestion` | 予算割当の自動提案 (= category / project_id 候補) |
| `status` | `candidate` / `confirmed` / `rejected` |

## freee 入金同期 (= /api/cron/freee-payment-sync)

cadence: 日次 09:10 JST。 input: freee 会計 income deals + `projects.freee_partner_id` + `billing_cycles`。 output: `billing_cycles.payment_confirmed_at` + `billing_log`。

### 処理

1. freee `/deals?type=income&limit=100` を query (= `freee_oauth_tokens.refresh_token` で access_token refresh)
2. 各 deal の `partner_id` から `projects.freee_partner_id` で逆引き → 対象 PJ 確定
3. deal の `amount` (= 入金額) と入金確認グループの `expectedAmountYen` / `expectedNetAmountYen` を ±1% で一致確認
4. 一致したら `confirmPaymentGroup(payload, { source: 'freee_deal' })` を呼ぶ
5. 不一致 / multi-month 不明は `billing_log.action='freee_payment_unmatched'` で残す

`expectedNetAmountYen` は、freee 発行済み請求書の明細合計があればそれを最優先する。未発行または明細が無い場合は、月次ルーティンで承認済みの請求額 (`billing_cycles.budget_reported_amount`) を使う。`budget_yen` は AMD 側の支払可能額なので、クライアントへの請求額として直接使わない。

`dryRun=1` を query に付けると実 update を skip して候補のみ JSON 返す (= 月初の手動確認用)。

### 監視

- `freee_oauth_tokens.updated_at` が 30 日以上前 → refresh_token 期限切れの可能性。 admin が `/admin/finance` から再認可する
- `billing_log.action='freee_payment_unmatched'` が頻発 → `projects.freee_partner_id` 未設定 / 税込/税抜不一致を疑う

## 入金確認 nudge (= /api/cron/payment-confirm-nudges)

cadence: 日次 09:30 JST。 input: `billing_cycles` + `projects.payment_due_rule` + `members.is_admin` + `members.slack_id`。 output: Slack DM + `billing_log.action='payment_confirm_nudged'`。

### 対象判定

```text
SELECT billing_cycles
WHERE invoice_sent_at IS NOT NULL
  AND payment_confirmed_at IS NULL
  AND today >= (invoice_sent_at + projects.payment_due_rule の解釈 - 3 日)
```

`projects.payment_due_rule` は文字列 (= `"末締め翌月末払い"` 等)。 解釈は `pwa/src/lib/finance/payment-due.ts` (= 章 26 と共有) で行い、 due_date を date に変換する。 due_date の 3 日前から当日までを「nudge 対象」とする。

### Slack DM 内容

各対象 cycle ごとに、 PJ 担当 SU 側 contact (= `projects.payment_contact_*` or 既定値) と admin (= `members.is_admin=true`) 両方の `slack_id` に DM を送る。

```text
{projectName} の {invoiceYm} 月分入金が予定日に近づいてます。
入金予定額: ¥{expectedAmountYen}
請求額（税抜）: ¥{expectedNetAmountYen}
予定日: {paymentDueDate}

ボタン:
- 予定通り入金済み
- 金額を入力
```

`予定通り入金済み` は、GAS `slackInteractiveWorker` の `payment_confirm_expected` handler が本番デプロイ済みで、PWA env `PAYMENT_CONFIRM_SLACK_INTERACTIVE=1` のときだけ Slack interactive action になる。押すと GAS worker が value 内の signed token を使って `POST /api/admin/payment-confirm` を `mode=expected` で呼び、`billing_cycles.payment_confirmed_at` を更新する。完了後はブラウザを開かず、つくよみが元DMのスレッドに反映結果を返信する。

`PAYMENT_CONFIRM_SLACK_INTERACTIVE` が未設定の間は、既存互換の URL confirm ボタンとして出す。GAS 側の Google OAuth / `clasp` 再認証が切れていると action handler を本番反映できないため、壊れた押下体験を出さないための安全弁。

`金額を入力` だけは `/payment-confirm?token=...` を開く。実額・差額メモを入力するための公開フォームなので、ここはブラウザ導線のまま。

`token` は `createPaymentConfirmationToken(payload)` で発行 (= 14 日 expiry)。

### dryRun=1

実 DM 送信を skip して JSON 返す:

```json
{
  "total": 5,
  "nudges": [
    {
      "projectId": "p07",
      "invoiceYm": "202605",
      "expectedAmountYen": 350000,
      "recipientSlackIds": ["U01...", "U01..."],
      "url": "https://amd-os-pwa.vercel.app/payment-confirm?token=..."
    }
  ]
}
```

月初の漏れ確認や送信先確認に使う。 `/admin/settings` の Cron Control からは default `dryRun=0` だが、 手動 `Run Now` で `dryRun=1` に書き換え可能 ([6-1 章](6-1-operations-settings-spec.md))。

## 関連環境変数

| name | 用途 |
|---|---|
| `PAYMENT_CONFIRM_TOKEN_SECRET` | signed token の HMAC secret (= 未設定なら `CRON_SECRET` を fallback) |
| `CRON_SECRET` | cron API 認証 + signed token fallback |
| `SLACK_BOT_TOKEN` | nudge 送信用。GAS 側は interactivity worker のスレッド返信にも使う |
| `FREEE_CLIENT_ID` / `FREEE_CLIENT_SECRET` | freee OAuth |
| `APP_BASE_URL` | confirm URL 組み立て (= `https://amd-os-pwa.vercel.app`) |
| `PAYMENT_CONFIRM_SLACK_INTERACTIVE` | `1` のときだけ `予定通り入金済み` を Slack action ボタンにする。GAS worker デプロイ前は未設定にする |
| GAS `PWA_BASE_URL` | Slack action worker が PWA `POST /api/admin/payment-confirm` を呼ぶ先 |

## トラブル時

| 症状 | 確認場所 |
|---|---|
| `/payment-confirm` が「token expired」 | nudge から 14 日経過。 `/api/cron/payment-confirm-nudges` を再実行して新 token 発行 |
| 自動 confirm が freee 側で発火しない | `freee_oauth_tokens.updated_at` 鮮度、 `projects.freee_partner_id` 設定、 amount ±1% 一致判定 |
| nudge Slack DM が飛ばない | `SLACK_BOT_TOKEN` 設定、 admin の `members.slack_id`、 [6-1 章 トラブル時](6-1-operations-settings-spec.md#トラブル時) |
| billing_log に重複 confirm が残る | `confirmPaymentGroup` は冪等だが `alreadyConfirmed` カウントだけ増える。 detail の `source` を見て真の confirm 経路を判定 |

## 関連

- 設計: [`pwa/design/invoice_url_payout_auth.md`](../design/invoice_url_payout_auth.md) (= signed URL の経緯)
- 6-3 章 [Invoice / Billing Routine](6-3-invoice-and-billing-routine-spec.md) (= 請求書発行とサイクル全体)
- 6-5 章 [Admin Payouts / 支払通知書](6-5-admin-payouts-reward-notice-spec.md) (= 反対側、 AMD から SU への支払)
- 6-1 章 [Operations Settings](6-1-operations-settings-spec.md) (= cron の Run Now と dryRun)
- 2-6 章 [admin オペ](2-6-admin-ops.md) (= 月次ルーティン早見表)
- 4-5 章 [Management Score](4-5-management-score-and-finance-simulation-spec.md) (= finance 軸の入力に `billing_cycles` 入金状況を利用)
