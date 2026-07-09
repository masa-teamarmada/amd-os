# 請求書発行 / 月次サイクル仕様

請求書 / 見積書発行と freee 連携、 月次カード・admin 請求書発行ページとの接続をまとめる。 入金確認は [6-4 章](6-4-finance-payment-confirm-spec.md)、 支払通知書 (= 反対側) は [6-5 章](6-5-admin-payouts-reward-notice-spec.md) を見る。

## `billing_cycles` (= 月次サイクルの正本)

PJ × ym の月次サイクル。 1 行で「予算確定 → 報告書確認 → 請求書発行 → 送付 → 入金確認 → 支払」までの全状態を持つ。報告会は月次サイクル上のPMタスクとしては廃止。

### 列一覧

| column | 用途 |
|---|---|
| `id` / `project_id` / `ym` | UNIQUE `(project_id, ym)` |
| `status` | `not_started` / `budget_reported` / `budget_confirmed` / `report_fixed` / `invoice_issued` / `invoice_sent` / `payment_confirmed` / `reward_paid` |
| `budget_yen` | 月次予算 (= 通常 cap + cap 外追加枠を含む確定額) |
| `budget_buffer_amount` | バッファ枠 (= 追加業務の上振れ枠) |
| `budget_reported_amount` / `budget_reported_at` / `budget_reported_by` | 請求額（税抜）。承認前は請求額案、承認後は確定請求額。列名は互換のため `budget_reported_*` のまま |
| `budget_confirmed_at` / `budget_confirmed_by` | admin が予算確定 |
| `meeting_event_id` / `meeting_start_at` / `meeting_html_link` | 報告会の Calendar event |
| `meeting_skipped` | true なら報告会 skip (= ステップを非表示にする) |
| `report_fixed_at` / `report_fixed_by` | 月次報告書 FIX 時刻 |
| `invoice_issued_at` / `invoice_issued_by` | 請求書発行 |
| `freee_invoice_number` | freee の請求書番号 |
| `invoice_pdf_url` | 請求書 PDF URL |
| `invoice_subject` | 請求書件名 |
| `invoice_base_lines_json` | 請求書本体明細 (= 行配列の JSONB) |
| `invoice_sent_at` / `invoice_sent_by` | 請求書送付 |
| `invoice_ym` | 翌月以降に請求する場合の請求月 (= 当月 ym と乖離あり) |
| `payment_confirmed_at` / `payment_confirmed_by` | 入金確認 |
| `payout_notice_uploaded_at` | 支払通知書 PDF アップロード時刻 (= 6-5 章) |
| `reward_paid_at` / `reward_paid_by` | 報酬支払済 |
| `reward_summary_json` | GAS rv2 計算結果キャッシュ |
| `member_allocations_json` | per-member 報酬配分 (= mypage 正本) |
| `ms_progress_summary_json` | 当月 MS 進捗サマリ |
| `cycle_id` | text 識別子 (= optional) |

### status 遷移

```text
not_started
   ↓ 契約由来の自動確定、またはadmin/例外復旧で請求額案を入力
budget_reported
   ↓ admin / PL が例外レビュー → 請求額とPJ予算を承認
budget_confirmed
   ↓ 月次報告書 FIX
report_fixed
   ↓ 請求書発行 (freee)
invoice_issued
   ↓ 請求書送付 (= invoice_to_emails へ)
invoice_sent
   ↓ 入金確認 (= 6-4 章)
payment_confirmed
   ↓ 支払通知書発行 + 報酬支払 (= 6-5 章)
reward_paid
```

非標準ケース: 失注 / 凍結 PJ は `not_started` のまま、OS 上の月次 TODO / nudge を出さない。

## 契約由来の請求額は つくよみ が毎月自動確定する (= 2026-06-18 (1)案)

> **契約書が抽出済み (= `/admin/contracts` で `contract_terms` を `applied` にした) PJ は、毎月の `請求額確定` を PM が手で押す必要はない。** つくよみ (月次 cron) が契約由来額を自動で `budget_confirmed` まで進め、PM には Slack DM で「契約どおりこの額で確定したよ」と事後通知する。PM は確認するだけ。

なぜ手入力を省けるか: `contract_terms` を `applied` にする操作そのものが「人 (admin) が契約金額を確認した」ポイント。以降の月次は契約から機械的に額が決まるので、毎月同じ額を PM に tap-confirm させる意味がない。これは KUTE 単発の話ではなく、契約抽出済みの全 PJ 共通の billing 確定システム。

- **対象**: `projects.start_ym ≤ 当月 ≤ end_ym` で、schedule_based なら当月 `billing_cycles` に `contract_source_term_id` が刻まれている / monthly_fixed なら `fee_type='monthly_fixed'` + `fee_amount` がある PJ。**`end_ym` が null の PJ は対象外** (無期限計上事故の防止)。
- **金額**: schedule_based はその月の `budget_yen ÷ 0.65` を請求額に逆算 (= 月により額が違う契約を月別に正しく確定。CX: 6月¥78,000 / 7-9月¥274,000)。monthly_fixed は `fee_amount` をそのまま請求額に。PJ 予算は `請求額 × 65%`。
- **触らない月**: その月の `billing_cycles.status` が既に `reported` 以降 (人が触っている) なら一切上書きしない。今月だけ違う額にしたい時は、PM が通知 DM のボタンからコックピットを開いて直す。
- **cron**: `/api/cron/contract-billing-auto-confirm` (毎月1日 JST 07:00)。実装・安全弁の詳細は [spec 5-6 章 §月次請求額の自動確定](../spec/5-6-contracts-management-current-spec.md)。
- **PM/PL nudge との関係**: OS 上の PM/PL 月次確認 nudge は廃止。報告書確認の軽い連絡は Slack 側で完結させ、`/mypage` / dashboard / cockpit には TODO / nudge として出さない。`請求額確定` は契約台帳/報酬キャッシュのデータ整備、`請求書発行/送付` はadmin業務、`立替確認` はPM月次タスク外として扱う。旧 PL レビュー DM route は削除済みで、例外復旧は `/admin/invoices` / `/admin/payouts` と budget approval 境界で扱う。

## 月次カード (= cockpit の確認面)

`/project/{projectId}/cockpit` の月次カードは、進捗・報酬・月次報告書を読むための確認面。月を選ぶと `CockpitMonthlyModal` が開く。これは TODO / nudge / PM step ではなく、旧 cockpit 右カラムの PM routine step UI は廃止済み。

`請求額確定` ステップで入力する金額は、別の「予定請求額」ではなく OS 上の請求額そのもの。承認前だけ `請求額案` と呼び、承認後は `確定請求額` として `budget_reported_amount` に保持する。PJ 予算 (`budget_yen`) は `確定請求額 × 65% - バッファ` を基本に計算する。

### ステップ並び

- PM/cockpit: 専用 step UI なし。OS 上の月次 TODO も出さない。必要な確認は月次カードから `CockpitMonthlyModal` を開く
- admin 請求書発行 (`/admin/invoices`): `予算確定 / 報告書 / 立替確認 / 請求書発行 / 請求送付 / 支払通知 / 入金確認 / 報酬支払`
- CTB見積: CTB停止中のため一旦廃止
- **古い月が上**

### legacy stepId の扱い

PWA cockpit は `?step=<stepId>&ym=YYYYMM` を現行導線として使わない。旧 `CockpitRoutine*` component / modal は削除済み。

| legacy stepId | 現行扱い |
|---|---|
| `reportFix` | PM 月次 step としては表示しない。必要なら月次カードから `CockpitMonthlyModal` の report tab を見る |
| `budget` | PM 月次 step としては表示しない。請求額確定は `/admin/invoices` / 自動確定側で扱う |

**月カードクリック** (= `YYYY.MM稼働分`) → `CockpitMonthlyModal` (= 月次集約モーダル)。旧 `meeting` / `reimburseConfirm` / `invoiceIssue` / `invoiceSend` / `estimateSend` は PM 月次タスクとしては開かない。

### nudgeと報酬の境界

- 報告書確認の軽い nudge は Slack 側で扱う。未対応でも mypage の月次報酬から取り消し線で除外しない
- 月次カードの閲覧や報告書確認は、報酬計算・支払可否の gate ではない。支払 gate は月初合意 / admin payouts 側で扱う

## 請求書 / 見積書 発行 (= freee 連携)

GAS `gas-main/007_FreeeInvoiceFlow.js` が freee API への発行を担当。

### Edge Function

`ios/supabase/functions/issue-invoice/index.ts` (= 共通インフラ) が freee API call の wrapper。 入出力:

- 入力: `{ projectId, ym, documentType: 'invoice'|'quotation', baseLines, subject }`
- 出力: `{ freeeInvoiceNumber, pdfUrl }`
- 副作用: freee 上で請求書 / 見積書を発行、 PDF URL を取得 → `billing_cycles` に反映

`ios/supabase/functions/cancel-invoice/index.ts` がキャンセル (= 取り下げ) 用。

### invoice_base_lines_json

請求書本体の明細行を JSONB で保持:

```json
[
  {
    "name": "業務委託費",
    "qty": 1,
    "unit_price": 300000,
    "tax_code": "10",
    "remarks": "..."
  },
  ...
]
```

### PL レビュー API (廃止済み)

旧 PL レビュー DM route は PM 月次ルーティン廃止に合わせて削除済み。請求額の通常確定は `contract-billing-auto-confirm` と `/admin/invoices` / `/admin/payouts` 側で扱う。Slack 承認フローを再導入する場合は、budget approval 境界を使う新しい current spec を先に追加する。

### 入金予定額の算出

入金確認で使う税抜請求額は `予定請求額` という別概念を持たない。算出順は次の通り。

1. freee 請求書が発行済み (`invoice_issued_at` または `freee_invoice_number` がある) で、`invoice_base_lines_json` に明細がある場合は、その明細合計を正本にする。
2. 未発行または明細が無い場合は、確定請求額 (`budget_reported_amount`) を使う。
3. 互換 fallback として、明細合計、最後に `budget_yen / 0.65` を使う。

税込の入金予定額はこの税抜請求額に消費税 10% を掛けたもの。freee 側に発行済み請求書がある場合、過去に入力した請求額案が残っていても発行済み明細を優先する。

### invoice 送付経路

`projects.invoice_send_manual=true` なら自動送付しない (= まさが個別に対応)。 `false` なら `invoice_to_emails` / `cc_emails` / `bcc_emails` に Gmail 送信。

## `billing_log` (= 操作監査)

| column | 用途 |
|---|---|
| `id` | UUID PK |
| `project_id` / `ym` | 対象 cycle |
| `action` | `budget_reported` / `budget_confirmed` / `report_fixed` / `invoice_issued` / `invoice_sent` / `payment_confirmed` / `payment_confirm_nudged` / `freee_payment_unmatched` / `reward_paid` 等 |
| `actor` | アクター |
| `detail` | JSONB (= 詳細情報) |

請求 / 入金 / 支払の全操作は `billing_log` に append される。 監査 / トラブルシュート時にここを見る。

## 請求月延期 (= `invoice_ym !== ym`)

「3 月分の業務を 4 月にまとめて請求」というケース。 `billing_cycles.invoice_ym='202604'`、 `ym='202603'` とする。 このとき:

- PM cockpit に請求 step は出さない。月次カードは当月 ym (= `202603`) の月次状態を表示する
- 翌月 `202604` の `billing_cycles` で `invoice_base_lines_json` に 2 月分を含めた請求書を発行
- mypage の月次報酬計算は `ym` (= 業務月) 基準で動く (= invoice_ym ではない)

契約開始前に実働だけが先行する PJ は、実働月の `billing_cycles.budget_yen = 0` を明示して、earned / grossDue を発生させたうえで支払額を 0 円にする。未払い分は `reward_summary_json.members[*].stockYen` として繰り越し、契約開始月以降の cap で順次支払う。`budget_yen IS NULL` は cap 未設定扱いで fallback するため、支払停止したい月では必ず `0` を保存する。

契約最終月に pt 単価の円丸めで stock が残る場合は、最終月の `budget_yen` に丸め差分を加えて stock を 0 円にする。契約月額ベースの通常 cap は途中月で維持し、最終月だけを精算月として扱う。

### スキップ表示の挙動

`invoice_ym` の繰延は `/admin/invoices` / `/admin/payouts` / finance 系で扱う。PMの月次カードでは deferred step 表示を使わない。

## CTB (= Closed To Buyer) PJ

CTB PJ は現在停止中。見積書送付 (`estimateSend`) は一旦廃止し、OS 上の月次 TODO・`/admin/invoices` のどちらにも表示しない。

## 立替精算確認

立替確認は PM 月次タスクから外す。`/admin/invoices` では `立替確認` の状態表示を残すが、PMの `/mypage` 通知には使わない。

## URL 修正の教訓 (= 2026-04-09)

GAS で請求系の Slack 投稿に貼る URL は `WEBAPP_BASE_URL` (= ScriptProperty) を使う。 `ScriptApp.getService().getUrl()` はデプロイごとに変わるため CLAUDE.md で禁止。 修正対象は `gas-main/007_FreeeInvoiceFlow.js` L552 (uploadUrl) / L1218 (cancelUrl)。

## トラブル時

| 症状 | 確認場所 |
|---|---|
| 月次カードが出ない | `billing_cycles` 該当 ym 行の有無、report-only month の場合は `monthly_reports` 行の有無 |
| 旧 stepId がPMタスクとして開く | `CockpitView` / `HudCockpitView` に routine step resolver が再導入されていないか確認 |
| 請求書 PDF URL が貼れない | `freee_invoice_number` set されてるか、 `invoice_pdf_url` の有効性 |
| 「請求月延期」が反映されない | `billing_cycles.invoice_ym` set、 `/admin/invoices` / `/admin/payouts` の表示と集計 |
| freee 発行が失敗 | Edge Function `issue-invoice` のログ、 `freee_oauth_tokens.updated_at` 鮮度 |

## 関連

- 設計: [`pwa/design/routine.md`](../design/routine.md) (= legacy routine history。current cockpit 導線は 3-8 spec を優先)
- 設計: [`pwa/design/cockpit.md`](../design/cockpit.md) (= cockpit 全体)
- 設計: [`pwa/design/invoice_url_payout_auth.md`](../design/invoice_url_payout_auth.md)
- 2-3 章 [PJ コックピットの見方](2-3-pj-cockpit.md) (= 月次カードの使い方)
- 6-4 章 [Finance / Payment Confirm](6-4-finance-payment-confirm-spec.md) (= 入金確認)
- 6-5 章 [Admin Payouts / 支払通知書](6-5-admin-payouts-reward-notice-spec.md) (= 反対側、 AMD から SU メンバーへの支払)
- 6-2 章 [Admin Projects / Members 台帳](6-2-admin-projects-members-ledger-spec.md) (= 契約条件)
- Edge Function: `ios/supabase/functions/issue-invoice/`, `cancel-invoice/`
- GAS: `gas-main/007_FreeeInvoiceFlow.js`
