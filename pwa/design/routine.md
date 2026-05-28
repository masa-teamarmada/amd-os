# 月次ルーティン — 設計の正本

> **回帰多発エリア**。「全部の stepId が同じ月次モーダルを開く」regression が
> 過去 3 度発生 (BUGS.md 参照)。ここに stepId × 挙動表が書かれていない or
> 見落とされると、新セッションが直すたびに同じ問題に戻す。**変更時は表を必ず更新**。

---

## 画面位置

`/project/[projectId]/cockpit` 右カラム (`status === 'active' || 'sales'` の PJ のみ)。
SU 系・終了 PJ では非表示。

```
┌──────────────────────┐
│ 月次ルーティン       │  ← 見出し (CockpitRoutineGas)
├──────────────────────┤
│ 2026.05稼働分  60% │  ← 月見出し (クリック→ CockpitMonthlyModal)
│ ├ 請求額確定        │  ← ステップ行 (クリック→ stepId 別モーダル)
│ ├ 報告会日程調整    │
│ ├ 月次報告書FIX     │
│ ├ 立替精算確認      │
│ ├ 請求書発行        │
│ └ 請求書送付        │
└──────────────────────┘
```

---

## ステップ並び

- 標準: `請求額確定 / 報告会日程調整 / 月次報告書FIX / 立替精算確認 / 請求書発行 / 請求書送付`
- CTB: `見積書送付 / 請求額確定 / 報告会日程調整 / 請求書発行 / 請求書送付 / 月次報告書FIX / 立替精算確認`
- **古い月が上**
- 期限超過かつ未完なら mypage の月次報酬から **取り消し線** で除外
- ただし `billing_cycles.status` が `payment_confirmed` / `reward_paid` / `completed`、または `payment_confirmed_at` / `reward_paid_at` あれば admin 救済済みとして除外しない

---

## stepId × クリック挙動 ⭐

正本は **iOS** `RoutineFlowView.handleTap()` ([ios/AMDOS/Features/Routine/RoutineFlowView.swift](../../ios/AMDOS/Features/Routine/RoutineFlowView.swift))。
PWA では `CockpitView.resolveStepModalFromTap()` ([pwa/src/components/cockpit/CockpitView.tsx](../src/components/cockpit/CockpitView.tsx)) で振り分け。

| stepId | 表示ラベル | クリックで開くもの | 実装 |
|---|---|---|---|
| `budget` | 請求額確定 | `CockpitRoutineBudgetModal` | `billing_cycles` へ申告保存 / `/api/notify/pl-review` (PLへ請求額・バッファ・PJ予算 + 承認/差し戻しボタン付きSlack DM) / `/api/admin/budget-approval` で確定 |
| `estimateSend` (CTBのみ) | 見積書送付 | `CockpitRoutineInvoiceModal` (documentType=`quotation`) | billing_cycles 直叩き / Edge Fn `issue-invoice` / `cancel-invoice` |
| `meeting` | 報告会日程調整 | `CockpitRoutineMeetingModal` | Edge Fn `meeting-slots` (GET) / `schedule-meeting` (GET) |
| `reportFix` | 月次報告書FIX | `CockpitRoutineReportFixModal` | monthly_reports 直読み + billing_cycles UPDATE / Edge Fn `send-slack-dm` |
| `reimburseConfirm` | 立替精算確認 | `/reimburse` ページに **遷移** (モーダルではない) | iOS は `navigation.selectedTab = .reimburse` |
| `invoiceIssue` | 請求書発行 | `CockpitRoutineInvoiceModal` (documentType=`invoice`) | 同上 estimateSend |
| `invoiceSend` | 請求書送付 | `CockpitRoutineInvoiceSendConfirm` 確認ダイアログ | billing_cycles UPDATE (`invoice_sent_at`) |

**月見出し** (`YYYY.MM稼働分`) クリック → 既存の `CockpitMonthlyModal` (月次の集約モーダル)。
**ステップ行クリックでは絶対に `CockpitMonthlyModal` を開かない**。

---

## 期日・自動判定ロジック

### 社外役員/顧問PJ (`projects.project_category='advisor'`)

社外役員/顧問PJは月次ルーティン対象外。コックピット右カラムではタスクを発生させず、`/mypage` の期限超過通知や報酬除外判定にも使わない。

### `立替確認` (reimburseConfirm)

- 締切: 翌月 4 日 (土日なら前営業日)
- **締切日前**: 必ず未完
- **締切日以降**: `reimbursements.status` が `submitted` / `pmapproved` の未処理がなければ完了
- 例: `202606` → 2026-07-04 が土曜 → 2026-07-03 に判定
- **手動変更不可** (Swift 版と同じ)

PWA 実装: `CockpitRoutineGas.tsx:139` (締切日チェック必須、無視するな)。

### 請求月延期時のスキップ動作 (`invoice_ym !== ym`)

`billing_cycles.invoice_ym` を翌月以降に設定した cycle (= 当月分を翌月以降にまとめて請求するケース) では、
**当月の月次ルーティンは `reportFix` (月次報告書FIX) 以外を全部スキップ表示**にする。

| 状態 | 当月 cycle | 翌月以降 cycle |
|---|---|---|
| `reportFix` (月次報告書FIX) | active (= 当月内に必ずやる) | active |
| `budget` / `meeting` / `reimburseConfirm` | **deferred → 非表示** | active |
| `invoiceIssue` / `invoiceSend` | **deferred → 非表示** (ラベルは "X月にまとめて請求") | active |
| `estimateSend` (CTB) | **deferred → 非表示** | active |

実装は `CockpitRoutineGas.buildSteps()` の `deferred` フラグ。
deferred は `activeSteps = steps.filter((s) => !s.deferred)` で UI 描画から除外され、`progressPct` も `reportFix` 1 個だけが分母になる。
月見出し横の `→7月` バッジ (オレンジ) が「翌月にまとめる意図」を示す唯一のシグナル。

理由: 翌月にまとめて請求する場合、当月の予算確定 / 報告会 / 立替確認 / 請求書発行・送付は翌月 cycle 側でまとめて回すため。
ただし月次報告書 (`monthly_reports`) は稼働月単位で必ず固定するので、`reportFix` だけは当月に残す。

### 後追い予算未確定の扱い (`invoice_ym !== ym` + `budget_yen` 未設定)

SX `202601-202603` のように、稼働開始後に複数月分の委託料が後から確定するケースでは、
稼働月時点では正式な予算超過判定をしない。

- `billing_cycles.invoice_ym` で対象稼働月を支払月へ束ねる。
- `/admin/payouts?ym=<支払月>` では `後追い予算未確定` と表示する。
- 確定した税抜委託料が入ったら、`PJ予算総額 = 税抜委託料 × 65% - バッファ` で計算する。
- PJ予算総額は対象稼働月の `reward_summary_json.members.totalPay` 合計比率で配分する。
- 報酬予定がまだ作れない場合だけ、対象稼働月で均等割りする。
- 確定PJ予算が報酬支払予定を下回る場合は `予算不足` として赤表示し、支払可否 / 減額 / 追加請求 / バッファを人間が合意してから保存する。
- PJが `projects.status='lost'` になった場合は `失注/破談: 予算なし` と表示し、支払原資なしの個別確認対象として扱う。
- 月額固定PJで `budget_reported_amount` または `projects.fee_amount` がある場合、報酬サマリー同期時に `billing_cycles.budget_yen` へ `請求額×65% - バッファ` を保存する。月次モーダルだけの暫定予算表示は使わない。
- ZMP のように月額固定 300,000 円で通常支払 cap が 195,000 円 (`300,000 × 65%`) のPJでも、OkuDoorシステム開発など追加受託分は `cap外追加支払枠` として別に足せる。保存後の `billing_cycles.budget_yen` は `通常cap + cap外追加支払枠` になり、報酬キャッシュ再計算で stockYen をその追加枠内で支払へ戻す。

### 請求額確定の承認フロー

- PM/PLが月次ルーティンの `budget` で請求額とバッファを申告すると、`billing_cycles.status='reported'`、`budget_reported_amount`、`budget_buffer_amount` を保存する。
- PL Slack nudgeには請求額・バッファ・PJ予算 (`請求額×65%−バッファ`) を明記し、`承認する` / `差し戻す` / `OSで確認` を出す。
- Slackの `承認する`、またはOSモーダル内の `承認する` は `/api/admin/budget-approval` に集約され、`billing_cycles.status='budget_confirmed'`、`budget_yen`、`budget_confirmed_at/by` を更新する。
- `差し戻す` は `status='budget_rejected'` にし、`budget_yen` は確定させない。再申告時に同じモーダルから修正できる。

### 支払条件・入金確認の正本

PJごとの支払条件はコックピットではなく `/admin/projects` で管理する。正本列は `projects.payment_due_rule`。

- 表示ラベルは稼働月基準の `当月末` / `当月25日` / `翌月末` / `翌月25日` / `翌々月末` / `翌々月25日`。
- 例: 5月稼働分を6月に請求して6月末支払なら `翌月末`。請求書発行月基準の表現は使わない。
- 請求書の支払期日、`/admin/payouts` の支払月自動判定、入金確認nudgeは同じ支払条件ヘルパーを使う。
- `billing_cycles.invoice_ym` が入っている場合は個別上書きとして優先する。空の場合は支払条件から支払月を計算する。
- 入金確認は `/admin/billing` の手動チップ、Slack nudgeのボタン、freee会計同期の3経路がある。どれも最終的には `billing_cycles.payment_confirmed_at` / `payment_confirmed_by` / `status='payment_confirmed'` を更新し、実額やfreee照合の証跡は `billing_log.detail` に保存する。
- Slack nudgeは active admin (`members.is_admin=true`) にDMする。「予定通り入金済み」は1クリックで予定額反映、「金額を入力」は `/payment-confirm` で実際の入金額を入力する。
- freee同期は収入取引 (`type=income`) の `payments` / `due_amount` に加え、取引登録前の口座明細 (`wallet_txns`, `entry_side=income`) も見る。取引先ID・請求番号・金額が合う収入取引、または金額/入金摘要がPJの `payment_alias` と合う口座明細だけ自動で入金確認済みにする。admin回答忘れを補うための補助線で、曖昧なものは手動確認へ残す。
- 入金確認まわりはLLMを使わない運用cronとして、Vercelで `freee-payment-sync` (09:10 JST) と `payment-confirm-nudges` (09:30 JST) だけを毎日動かす。LLM系cronは停止したまま。
- freee同期が失敗した場合はactive adminへSlack DMで失敗理由を通知し、その後の入金確認nudgeで手動確認できるようにする。

---

### deadline 一覧

| stepId | 締切 |
|---|---|
| `estimateSend` (CTB) | 前月 28 日 (営業日) |
| `budget` | 前月 25 日 (CTB は 28 日) |
| `meeting` | 当月 20 日 |
| `reportFix` | 翌月 3 日 |
| `reimburseConfirm` | 翌月 4 日 |
| `invoiceIssue` | 翌月 8 日 (CTB は当月 28 日) |
| `invoiceSend` | 翌月 9 日 (CTB は当月 28 日) |

すべて **adjustBusinessDay** (土日なら前営業日へ繰り上げ) を通す。

---

## URL クエリでステップを直接開く

`/project/[projectId]/cockpit?ym=YYYYMM&step=<stepId>` で、起動時にそのステップ用モーダルを開く。
mypage の TODO カード ([pwa/src/app/(app)/mypage/page.tsx:593](../src/app/(app)/mypage/page.tsx)) からこの URL に飛ばしてる。
`?ym=` だけなら従来通り月次モーダル。

---

## 関連ファイル

| 役割 | パス |
|---|---|
| 月次ルーティンの右カラム描画 | `pwa/src/components/cockpit/CockpitRoutineGas.tsx` |
| stepId → モーダル振り分け | `pwa/src/components/cockpit/CockpitView.tsx` (`resolveStepModalFromTap`) |
| 各ステップ専用モーダル | `pwa/src/components/cockpit/CockpitRoutine*Modal.tsx` |
| 月次の集約モーダル (月見出しクリック用) | `pwa/src/components/cockpit/CockpitMonthlyModal.tsx` |
| Edge Function (POST) ヘルパー | `pwa/src/lib/supabase/edge-functions.ts` (`callEdgeFunctionPOST` / `callEdgeFunctionGET`) |
| iOS 正本 | `ios/AMDOS/Features/Routine/RoutineFlowView.swift` (`handleTap()`) |
| iOS 各 StepView | `ios/AMDOS/Features/Routine/{Budget,Meeting,ReportFix,Invoice}StepView.swift` |

---

## admin.billing 側の表示順 (参考)

admin.billing マトリックスはルーティンとは別の並び:

- 標準: `予算確定 / 報告会 / 報告書 / 立替確認 / 請求発行 / 請求送付 / 支払通知 / 入金確認 / 報酬支払`
- CTB: `見積送付 / 予算確定 / 報告会 / 請求発行 / 請求送付 / 報告書 / 立替確認 / 支払通知 / 入金確認 / 報酬支払`

実装: `pwa/src/components/admin/AdminBillingMatrix.tsx`。

---

## 🚨 回帰防止チェックリスト

新機能を入れる時、コックピット周りを触る時、以下を**必ず確認**:

- [ ] `CockpitRoutineGas.tsx` の各ステップ button が `onStepClick` を呼んでる (= `onOpenModal` ではない)
- [ ] `CockpitView.resolveStepModalFromTap()` の switch case が上の表と一致してる
- [ ] 月見出し button だけが `onOpenModal` を呼んでいる
- [ ] `?step=` URL パラメータの `initialStep` ハンドリングが残ってる
