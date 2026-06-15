# Invoice / Billing Routine 仕様

請求書 / 見積書発行と freee 連携、 月次ルーティンとの接続をまとめる。 入金確認は [6-4 章](6-4-finance-payment-confirm-spec.md)、 支払通知書 (= 反対側) は [6-5 章](6-5-admin-payouts-reward-notice-spec.md) を見る。

## `billing_cycles` (= 月次サイクルの正本)

PJ × ym の月次サイクル。 1 行で「予算確定 → 報告会 → 報告書 FIX → 請求書発行 → 送付 → 入金確認 → 支払」までの全状態を持つ。

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
   ↓ PM/PL が請求額案を入力
budget_reported
   ↓ admin / PL が PL レビュー → 請求額とPJ予算を承認
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

非標準ケース: 失注 / 凍結 PJ は `not_started` のまま、 月次ルーティン自体を出さない。

## 月次ルーティン (= cockpit 右カラム)

`/project/{projectId}/cockpit` 右カラムが「月次ルーティン」入口。 PJ の `status` が `active` / `sales` のときだけ表示。 詳細仕様 (= 回帰多発エリア) は [`pwa/design/routine.md`](../design/routine.md) と [01.5 月次ルーティン](2-3-pj-cockpit.md#15-月次ルーティン--報告書--請求--会計)。

`請求額確定` ステップで入力する金額は、別の「予定請求額」ではなく OS 上の請求額そのもの。承認前だけ `請求額案` と呼び、承認後は `確定請求額` として `budget_reported_amount` に保持する。PJ 予算 (`budget_yen`) は `確定請求額 × 65% - バッファ` を基本に計算する。

### ステップ並び

- 標準: `請求額確定 / 報告会日程調整 / 月次報告書FIX / 立替精算確認 / 請求書発行 / 請求書送付`
- CTB: `見積書送付 / 請求額確定 / 報告会日程調整 / 請求書発行 / 請求書送付 / 月次報告書FIX / 立替精算確認`
- **古い月が上**

### stepId × クリック挙動

正本は iOS `RoutineFlowView.handleTap()`、 PWA は `CockpitView.resolveStepModalFromTap()`。

| stepId | ラベル | クリックで開くもの |
|---|---|---|
| `budget` | 請求額確定 | `CockpitRoutineBudgetModal` |
| `estimateSend` (CTB) | 見積書送付 | `CockpitRoutineInvoiceModal` (= documentType='quotation') |
| `meeting` | 報告会日程調整 | `CockpitRoutineMeetingModal` |
| `reportFix` | 月次報告書FIX | `CockpitRoutineReportFixModal` |
| `reimburseConfirm` | 立替精算確認 | `/reimburse` ページに**遷移** (= モーダルではない) |
| `invoiceIssue` | 請求書発行 | `CockpitRoutineInvoiceModal` (= documentType='invoice') |
| `invoiceSend` | 請求書送付 | `CockpitRoutineInvoiceSendConfirm` 確認ダイアログ |

**月見出しクリック** (= `YYYY.MM稼働分`) → `CockpitMonthlyModal` (= 月次集約モーダル)。 **ステップ行クリックでは絶対に CockpitMonthlyModal を開かない** (= 回帰多発、 まさ #過去 教訓)。

### 期限超過と取り消し線

- 期限超過かつ未完なら mypage の月次報酬から取り消し線で除外
- 例外: `billing_cycles.status IN ('payment_confirmed','reward_paid','completed')`、 または `payment_confirmed_at` / `reward_paid_at` 集合済みなら救済済として除外しない

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

### PL レビュー API

`/api/notify/pl-review` (= PJ の `project_members.is_pl=true` の Slack DM へ):

- 内容: 請求額 / バッファ / PJ 予算 + `承認する` / `差し戻す` / `OS で確認` ボタン
- 開く: `conversations.open` で DM channel 確保
- 承認 / 差し戻し: `/api/admin/budget-approval` が `billing_cycles` を更新

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

- 当月 ym (= `202603`) の月次ルーティンは `reportFix` 以外を **スキップ表示**
- 翌月 `202604` の `billing_cycles` で `invoice_base_lines_json` に 2 月分を含めた請求書を発行
- mypage の月次報酬計算は `ym` (= 業務月) 基準で動く (= invoice_ym ではない)

契約開始前に実働だけが先行する PJ は、実働月の `billing_cycles.budget_yen = 0` を明示して、earned / grossDue を発生させたうえで支払額を 0 円にする。未払い分は `reward_summary_json.members[*].stockYen` として繰り越し、契約開始月以降の cap で順次支払う。`budget_yen IS NULL` は cap 未設定扱いで fallback するため、支払停止したい月では必ず `0` を保存する。

契約最終月に pt 単価の円丸めで stock が残る場合は、最終月の `budget_yen` に丸め差分を加えて stock を 0 円にする。契約月額ベースの通常 cap は途中月で維持し、最終月だけを精算月として扱う。

### スキップ表示の挙動

`CockpitRoutineGas.tsx` が `invoice_ym !== ym` を検知して、 `budget` / `meeting` / `invoiceIssue` / `invoiceSend` ステップを「スキップ」 表示にする (= 完了でも未完でもなく、 グレーアウト + ツールチップ「invoice_ym=YYYYMM に統合済」)。

## CTB (= Closed To Buyer) PJ

CTB PJ (= 営業段階のクローズした顧客向け短期 PJ) は **見積書ステップが先頭** に来る。 標準フローと違って:

1. 見積書送付 (= 価格合意)
2. 請求額確定
3. 報告会
4. 請求書発行
5. 請求書送付
6. 月次報告書 FIX
7. 立替確認

CTB 例外は `projects.project_type` または別フラグで判定 (= 実装は `CockpitView.tsx` を参照)。

## 立替精算確認 (= reimburseConfirm)

- 締切: 翌月 4 日 (= 土日なら前営業日)
- 締切日前: 必ず未完
- 締切日以降: `reimbursements.status IN ('submitted','pm_approved')` の未処理が無ければ完了
- 例: `202606` → 2026-07-04 が土曜 → 2026-07-03 に判定
- **手動変更不可** (= iOS と挙動を揃える)

PWA 実装: `CockpitRoutineGas.tsx:139` (= 締切日チェック必須、 無視しない)。

## URL 修正の教訓 (= 2026-04-09)

GAS で月次ルーティンの Slack 投稿に貼る URL は `WEBAPP_BASE_URL` (= ScriptProperty) を使う。 `ScriptApp.getService().getUrl()` はデプロイごとに変わるため CLAUDE.md で禁止。 修正対象は `gas-main/007_FreeeInvoiceFlow.js` L552 (uploadUrl) / L1218 (cancelUrl)。

## トラブル時

| 症状 | 確認場所 |
|---|---|
| 月次ルーティンステップが出ない | `projects.status IN ('active','sales')`、 `project_category != 'advisor'`、 `billing_cycles` 該当 ym 行の有無 |
| 全 stepId 押すと CockpitMonthlyModal が出る | `CockpitView.resolveStepModalFromTap()` の回帰、 [`routine.md`](../design/routine.md) の表と照合 |
| 立替確認が締切後でも未完 | `reimbursements.status` を確認 (= `submitted`/`pm_approved` が残ってないか) |
| 請求書 PDF URL が貼れない | `freee_invoice_number` set されてるか、 `invoice_pdf_url` の有効性 |
| 「請求月延期」が反映されない | `billing_cycles.invoice_ym` set、 `CockpitRoutineGas.tsx` スキップ判定 |
| freee 発行が失敗 | Edge Function `issue-invoice` のログ、 `freee_oauth_tokens.updated_at` 鮮度 |

## 関連

- 設計: [`pwa/design/routine.md`](../design/routine.md) (= 回帰多発エリアの正本)
- 設計: [`pwa/design/cockpit.md`](../design/cockpit.md) (= cockpit 全体)
- 設計: [`pwa/design/invoice_url_payout_auth.md`](../design/invoice_url_payout_auth.md)
- 2-3 章 [PJ コックピットの見方](2-3-pj-cockpit.md) (= 月次ルーティン入口の使い方)
- 6-4 章 [Finance / Payment Confirm](6-4-finance-payment-confirm-spec.md) (= 入金確認)
- 6-5 章 [Admin Payouts / 支払通知書](6-5-admin-payouts-reward-notice-spec.md) (= 反対側、 AMD から SU メンバーへの支払)
- 6-2 章 [Admin Projects / Members 台帳](6-2-admin-projects-members-ledger-spec.md) (= 契約条件)
- Edge Function: `ios/supabase/functions/issue-invoice/`, `cancel-invoice/`
- GAS: `gas-main/007_FreeeInvoiceFlow.js`
