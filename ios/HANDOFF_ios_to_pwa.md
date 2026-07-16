# iOS → PWA ハンドオフ

> See also: [DESIGN.md](DESIGN.md) — **全画面の正本仕様（必読）** / [HANDOFF_ios_to_android.md](HANDOFF_ios_to_android.md) — 並行する Android 向け引き継ぎ
>
> **このドキュメントの目的**: iOS（Swift / SwiftUI）で 2026-04-30 に実装した変更群を、別 PC で開発中の PWA（Next.js App Router）に移植する。
>
> **正本**: GitHub `masa-teamarmada/amd-os` (`main` ブランチ)

最終更新: 2026-07-16
対応 iOS commit: `3dfd235c` "feat(ios): add notification judgment deck"
対応 PWA 起点: 直近の `pwa/` の main HEAD

---

## 2026-07-16 追記: Swift通知判断キューとの境界

PWAの通知データ・feedback contractをSwift版から再利用し、iOSではスマホ向けの1件ずつ判断カードとして実装した。PWA側の追加実装は今回なし。

- iOS表示: `判断 / 未読 / 履歴`、1件カード、次カード予告、根拠展開、種別別の意味ラベル、修正コメント、セッション内`あとで`
- 共通write: `l2_feedbacks` と既存の通知種別ごとのstatus更新
- iOS固有境界: `project_registry_diff` はaccepted候補の記録まで。実DB（OS台帳）反映はPWA/helper側に残す
- `meeting_summary` の確認は確認記録だけで再抽出しない
- `connector_auth` は採否ではなく復旧アクション。リンクを開いた後も履歴から再試行可能

PWA側で通知action contractを変更する場合は、`ios/DESIGN.md` §2.1.1と`NotificationInboxView`の表示文言・effect説明を同時に更新する。

---

## 🚨 必読: 共通インフラはすでに本番適用済み

このセッションで以下を本番 Supabase に適用 / デプロイ済み。**PWA 側は SELECT / 呼び出すだけで OK、再適用しないこと**:

1. **DB schema**: `members` テーブルに5カラム追加 (`exclude_from_payout_notice`, `joined_at`, `left_at`, `slack_plan`, `google_plan`) — migration `20260430120000_add_member_metadata_columns.sql` 適用済
2. **Edge Function**: `send-budget-approval-nudge` を deploy 済（PMが予算申告したらadminにSlack DMを飛ばす）

`supabase/migrations/` と `supabase/functions/` のコードは正本としてリポジトリに入っている。

---

## ⚠️ PWA 側 Admin 判定の修正 (前提)

現状 PWA は `/m/reimburse/list/page.tsx` で **メールアドレス hard-code** (`kyoko@` / `masa@`) で admin 判定している。
iOS は `members.is_admin` フラグを使う設計。**PWA も合わせる**:

```ts
// PWA 側で実装する関数（lib/admin.ts 等）
export async function fetchIsAdmin(supabase, email: string): Promise<boolean> {
  const { data } = await supabase
    .from("members")
    .select("is_admin")
    .eq("email", email.toLowerCase())
    .limit(1)
    .single();
  return data?.is_admin === true;
}
```

これを Admin 判定が要る画面で使う。Hard-code を全廃。

---

## 移植する変更（7項目）

### 1. PM側マイページの「いまやること」フィルタ

**iOS**: `SupabaseService.fetchMyPageNotifications()`
- 各PJの `billing_cycles.status` を取得し、`status='reported'` のとき budget ステップを除外
- 「PMはもう自分の作業を終えている → admin承認待ちなので PM の TODO に出さない」

**PWA**: `pwa/src/app/m/page.tsx` の `deriveBillingActions()` 周辺
- 同じロジックを実装する
- billing_cycles.status を fetch し、`status === 'reported'` の budget アクションは「いまやること」リストから除外
- マイページの「いまやること」ロジックがどこにあるかは `/m/page.tsx` を確認

### 2. PMが予算申告したら admin に Slack nudge

**iOS**: `submitBudgetReport` 完了後 → `Task.detached` で `send-budget-approval-nudge` EF を fire-and-forget

**PWA**: 予算申告ボタンの handler から、申告 PATCH 成功後に EF を呼ぶ
```ts
// 申告 PATCH 後
fetch(`${SUPABASE_URL}/functions/v1/send-budget-approval-nudge`, {
  method: "POST",
  headers: { Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ projectId, ym, pmEmail }),
}).catch(() => {});  // 失敗しても申告自体はノーエラー
```

EF はすでに deploy 済み。リクエスト形式: `{ projectId: string, ym: string, pmEmail: string }`

### 3. 月次ルーティンから admin専任タスクを除外

**iOS**: `RoutineModels.swift` の `standardVisibleStepOrder` / `ctbVisibleStepOrder` から
`payoutNotice` / `payment` / `payout` を削除

**PWA**: 月次ルーティンステップ表示のロジックから、同じ3つを除外
- 「これらは月次後の admin 専任タスクなので、PM 中心の routine から外す」
- どこに routine ステップ定義があるか PWA 側で探して、3つを削除する
- 該当するアクション（`deriveBillingActions` 含む）も同じく除外

### 4. AdminTab の「今月やること」カード

**iOS**: `AdminTabView` 上部、`AdminMonthlyTasksCard`
- 4種類のカウントを表示: 予算承認待ち / 支払通知書未送付 / 入金未確認 / 報酬未支払い
- データ源: `SupabaseService.fetchAdminPendingSummary()`

**PWA**: Admin 用ダッシュボード（現状 `/m/reimburse/list/` にあるが、ちゃんとしたAdmin画面として再設計推奨）

集計ロジック（active PJ × 直近6ヶ月の billing_cycles から派生）:
| カウント | 条件 |
|---|---|
| 予算承認待ち | `status='reported'` |
| 支払通知書未送付 | `invoice_issued_at IS NOT NULL AND payout_notice_uploaded_at IS NULL` |
| 入金未確認 | `invoice_sent_at IS NOT NULL AND payment_confirmed_at IS NULL` |
| 報酬未支払い | `payment_confirmed_at IS NOT NULL AND reward_paid_at IS NULL` |

各タップ → 該当画面へ遷移（ `/m/admin/budget-approval` 等の admin route 整備をおすすめ）

### 5. 予算「取り下げる」ボタン

**iOS**: `BudgetStepView` の confirmedView / reportedView に「取り下げる」ボタン
- 確認ダイアログ → `withdrawBudget(projectId, ym)` で `status='draft'` に戻し、
  `budget_reported_*` / `budget_confirmed_*` / `budget_yen` / `member_allocations_json` を全 NULL クリア

**PWA**: `pwa/src/app/m/[projectCode]/page.tsx` の予算ステップ部分
- 申告済 / 承認済 状態で「取り下げる」ボタンを表示
- PATCH `billing_cycles?project_id=eq.X&ym=eq.Y` の body は上記フィールドを全部 null に
- 確認ダイアログ後に実行

### 6. メンバーリスト（admin専用）

**iOS**: `MemberListView` + `MemberDetailView`
- active / 離脱済み の2セクション
- 各メンバーで以下を編集: codeName, memberName, email, slackId, memberAddress, bankInfo, isAdmin, status, **excludeFromPayoutNotice**, joinedAt, leftAt, slackPlan, googlePlan

**PWA**: `/members` (現状スケルトン) を本実装する
- 一覧 + 詳細編集
- バッジ: admin / 通知書対象外 (excludeFromPayoutNotice=true)
- 詳細フォームで全 13 フィールドを編集可能に
- 保存は PATCH `members?member_id=eq.X`

### 7. `exclude_from_payout_notice` を支払通知書対象から除外

**iOS**: `fetchPayoutNoticeMembers(ym:)` の members select に
`.eq("exclude_from_payout_notice", value: false)` を追加

**PWA**: 支払通知書一覧を組み立てる query (おそらく `/m/reimburse/list/page.tsx` か今後の admin 画面) で、
members 取得時に `eq('exclude_from_payout_notice', false)` を追加

---

## DB schema 差分（参考、既に適用済み）

```sql
ALTER TABLE members
  ADD COLUMN exclude_from_payout_notice BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN joined_at  DATE,
  ADD COLUMN left_at    DATE,
  ADD COLUMN slack_plan TEXT,    -- 'paid' | 'free' | NULL
  ADD COLUMN google_plan TEXT;   -- 'paid' | 'free' | NULL
```

`members` テーブルの全カラム（参考）:
`member_id, code_name, member_name, email, slack_id, member_address, bank_info, is_admin, status, exclude_from_payout_notice, joined_at, left_at, slack_plan, google_plan`

---

## Edge Function 仕様（参考、既に deploy 済み）

### `send-budget-approval-nudge`
- メソッド: POST
- URL: `${SUPABASE_URL}/functions/v1/send-budget-approval-nudge`
- Body: `{ projectId: string, ym: string, pmEmail: string }`
- 動作: `is_admin=true AND status='active'` のメンバー全員 (slack_id 設定済) に DM 送信
- メッセージ: `💰 *{projectName}* {year}年{month}分の予算が申告されました\n\n申告者: *{pmName}*\n\nAMD OS を開いて *Admin → 予算承認* から確認・承認をお願いします！`

---

## 既存 PWA との対応マッピング

| iOS 画面 | PWA 対応ファイル | 状態 |
|---|---|---|
| `MyPageView` | `pwa/src/app/m/profile/page.tsx` | 現状ほぼ空、本実装が必要 |
| `RoutineFlowView` (月次ルーティン) | `pwa/src/app/m/page.tsx` (Billing Home) | 既存。3ステップ削除と reported budget フィルタを反映 |
| `BudgetStepView` | `pwa/src/app/m/[projectCode]/page.tsx` | 既存。「取り下げる」追加、予算申告時の Slack nudge fire |
| `AdminTabView` | 現状 `/m/reimburse/list/page.tsx` に admin機能集中 | 専用 admin tree (`/m/admin/*` 等) を新設推奨 |
| `BudgetApprovalView` | (`/m/reimburse/list` に混ざってる) | 専用画面に分離推奨 |
| `PayoutNoticeAdminListView` | (同上) | 同上 |
| `MemberListView` | `pwa/src/app/(dashboard)/members/` (スケルトン) | 本実装が必要 |
| `今月やることカード` | （未実装） | Admin top に新設 |

---

## Admin 判定のリファクタ（必須）

現状 `/m/reimburse/list/page.tsx`:
```ts
const isAdmin = email === "kyoko@..." || email === "masa@..."
```

これを `members.is_admin` ベースに置き換える。`lib/admin.ts` 等に共通関数を作る。

---

## 検証済み（iOS 側）

- masaiPhone (UDID `22F6F889-985D-5CAF-AFF3-D50D5E80FFA0`) で全機能の手動 QA 完了
- マイページ: CX 4月の予算ステップが PM TODO から消えることを確認
- AdminTab → 「今月やること」→ 「支払通知書未送付」タップ → ちゃんと PayoutNoticeAdminListView へ直行
- 予算取り下げ: 承認済み → 取り下げ → draft 状態に戻る挙動確認
- メンバーリスト: 表示・詳細・編集・保存まで動作確認

---

## PWA 反映状況

（PWA 担当 Claude / えいみ がここに追記する）

---

## 別 PC で開発を始めるための初手プロンプト

```text
あなたは「えいみ」、まさの専属 AI ペア。
AMD OS の PWA 版（Next.js / Vercel）に、iOS で先行実装された機能を移植する。

リポジトリ: masa-teamarmada/amd-os
作業ディレクトリ: pwa/

最初にやること:
1. git fetch --all --prune && git pull origin main
2. 以下を順に読む:
   - ios/HANDOFF_ios_to_pwa.md  ← 移植すべき変更の全リスト
   - ios/DESIGN.md              ← 全画面の正本仕様
   - pwa/AGENTS.md / pwa/CLAUDE.md
   - pwa/src/app/(dashboard) / pwa/src/app/m の構造把握
3. ios/HANDOFF_ios_to_pwa.md の「移植する変更（7項目）」を1個ずつ、
   PWA に反映していく。1項目1commit を目安に。
4. 変更が完了したら HANDOFF_ios_to_pwa.md の末尾「PWA 反映状況」に
   commit hash と要点を追記する。

注意:
- DB schema と Edge Function はすでに本番 Supabase に適用済み。再適用しない。
- Admin 判定は member.is_admin に統一する（Hard-code email 廃止）。
- TypeScript / Next.js App Router / Tailwind の流儀に合わせる。
- 各機能を実装したら必ず `npm run dev` で動作確認、push の前に `npm run build` を通す。
- 完了後は Vercel に deploy（PWA の流儀に従う）。
```
