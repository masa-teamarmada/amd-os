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
- CTB: `見積書送付` を先頭に挿入 + 標準
- **古い月が上**
- 期限超過かつ未完なら mypage の月次報酬から **取り消し線** で除外
- ただし `billing_cycles.status` が `payment_confirmed` / `reward_paid` / `completed`、または `payment_confirmed_at` / `reward_paid_at` あれば admin 救済済みとして除外しない

---

## stepId × クリック挙動 ⭐

正本は **iOS** `RoutineFlowView.handleTap()` ([ios/AMDOS/Features/Routine/RoutineFlowView.swift](../../ios/AMDOS/Features/Routine/RoutineFlowView.swift))。
PWA では `CockpitView.resolveStepModalFromTap()` ([pwa/src/components/cockpit/CockpitView.tsx](../src/components/cockpit/CockpitView.tsx)) で振り分け。

| stepId | 表示ラベル | クリックで開くもの | 実装 |
|---|---|---|---|
| `budget` | 請求額確定 | `CockpitRoutineBudgetModal` | billing_cycles 直叩き / Edge Fn `send-budget-approval-nudge` |
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
- CTB: `予算確定 / 見積送付 / 請求発行 / 報告会 / 請求送付 / 報告書 / 立替確認 / 支払通知 / 入金確認 / 報酬支払`

実装: `pwa/src/components/admin/AdminBillingMatrix.tsx`。

---

## 🚨 回帰防止チェックリスト

新機能を入れる時、コックピット周りを触る時、以下を**必ず確認**:

- [ ] `CockpitRoutineGas.tsx` の各ステップ button が `onStepClick` を呼んでる (= `onOpenModal` ではない)
- [ ] `CockpitView.resolveStepModalFromTap()` の switch case が上の表と一致してる
- [ ] 月見出し button だけが `onOpenModal` を呼んでいる
- [ ] `?step=` URL パラメータの `initialStep` ハンドリングが残ってる
