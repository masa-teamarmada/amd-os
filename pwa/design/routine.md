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
