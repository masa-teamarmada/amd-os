# 月次確認 — 設計の正本

> **2026-06-19 方針確定**: PM の月次ルーティンは廃止方向。cockpit / mypage に残す PM 向け月次通知は、月次報告書 draft に対する「これでいい？」確認 nudge だけ。
> 報告会は完全廃止。代わりに 2 か月に 1 回、対面のナレッジ会を月次ルーティン外で実施する。

---

## 画面位置

`/project/[projectId]/cockpit` 右カラム (`status === 'active' || 'sales'` の PJ のみ)。
SU 系・終了 PJ・`freeze_from_ym <= ym` の凍結 PJ では非表示。

```
┌──────────────────────┐
│ 月次確認             │  ← 見出し (CockpitRoutineGas)
├──────────────────────┤
│ 2026.05稼働分 100% │  ← 月見出し (クリック→ CockpitMonthlyModal)
│ └ 月次報告書確認    │  ← ステップ行 (クリック→ report tab)
└──────────────────────┘
```

---

## PMに送るnudge

- 表示順: `月次報告書確認` だけ。
- 目安: 翌月 3 日 (土日なら前営業日へ繰り上げ)。
- `/mypage` の PM 通知と cockpit 右カラムはこの step だけを見る。
- `月次報告書確認` は「これでいい？」のnudgeであり、未対応でも月次報酬の取り消し線・除外判定には使わない。

## PMから外したもの

- **報告会日程調整**: 完全廃止。隔月の対面ナレッジ会は月次ルーティン外で運用する。
- **立替精算確認**: PM 月次タスクから外す。立替の処理状況は `/reimburse` / admin 系で扱い、PM の月次nudgeには使わない。
- **請求書発行 / 請求書送付**: admin の役割。`/admin/billing` の `請求発行` / `請求送付` 列で扱う。
- **見積書送付 (CTB)**: CTB は停止中なので一旦廃止。`[[CTB_ESTIMATE_SENT]]` marker を PM ルーティンから更新しない。
- **請求額確定**: 契約由来の自動確定が正本。PM/PL の `/mypage` 月次nudgeと報酬除外判定には使わない。cockpit の `budget` direct step は、契約/報酬キャッシュの前提が崩れた時の例外復旧・個別差分入力用にだけ残す。

---

## stepId × クリック挙動

PWA では `CockpitView.resolveStepModalFromTap()` ([pwa/src/components/cockpit/CockpitView.tsx](../src/components/cockpit/CockpitView.tsx)) で振り分け。

| stepId | 表示ラベル | クリックで開くもの | 実装 |
|---|---|---|---|
| `reportFix` | 月次報告書確認 | `CockpitMonthlyModal` の `report` tab | 月次モーダル内の Markdown 表示/編集UIを正本にする |
| `budget` | 請求額確定 | `CockpitRoutineBudgetModal` | PMルーティンには出さない。契約/報酬キャッシュの例外復旧 direct step としてのみ残す |

**月見出し** (`YYYY.MM稼働分`) クリック → 既存の `CockpitMonthlyModal` (月次の集約モーダル)。
`reportFix` のステップ行だけは report tab を直接開く。旧 `meeting` / `reimburseConfirm` / `invoiceIssue` / `invoiceSend` / `estimateSend` deep link は PM タスクとしては no-op。

---

## 期日・自動判定ロジック

### 社外役員/顧問PJ (`projects.project_category='advisor'`)

社外役員/顧問PJは月次ルーティン対象外。コックピット右カラムではタスクを発生させず、`/mypage` の月次確認nudgeにも使わない。

### 請求月延期 (`invoice_ym !== ym`)

PM の月次確認は `reportFix` だけなので、`invoice_ym` による deferred 表示は使わない。
請求月の繰延は `/admin/billing` / `/admin/payouts` / finance 系の責務として扱う。

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

- 原則は契約 apply 済みデータから `contract-billing-auto-confirm` が自動確定する。PM/PL の `/mypage` 月次nudgeには出さない。
- 例外復旧・個別差分として `budget` で請求額とバッファを入力すると、承認前は `請求額案` として `billing_cycles.status='reported'`、`budget_reported_amount`、`budget_buffer_amount` を保存する。`budget_reported_amount` は列名互換のため残しているが、意味は「請求額（税抜）」であり、別の「予定請求額」ではない。
- PL Slack nudgeには請求額・バッファ・PJ予算 (`請求額×65%−バッファ`) を明記し、`承認する` / `差し戻す` / `OSで確認` を出す。
- Slackの `承認する`、またはOSモーダル内の `承認する` は `/api/admin/budget-approval` に集約され、`billing_cycles.status='budget_confirmed'`、`budget_yen`、`budget_confirmed_at/by` を更新する。承認後の `budget_reported_amount` は確定請求額として扱う。
- `差し戻す` は `status='budget_rejected'` にし、`budget_yen` は確定させない。再入力時に同じモーダルから修正できる。

### 支払条件・入金確認の正本

PJごとの支払条件はコックピットではなく `/admin/projects` で管理する。正本列は `projects.payment_due_rule`。

- 表示ラベルは稼働月基準の `当月末` / `当月25日` / `翌月末` / `翌月25日` / `翌々月末` / `翌々月25日`。
- 例: 5月稼働分を6月に請求して6月末支払なら `翌月末`。請求書発行月基準の表現は使わない。
- 請求書の支払期日、`/admin/payouts` の支払月自動判定、入金確認nudgeは同じ支払条件ヘルパーを使う。
- `billing_cycles.invoice_ym` が入っている場合は個別上書きとして優先する。空の場合は支払条件から支払月を計算する。
- 入金確認は `/admin/billing` の手動チップ、Slack nudgeのボタン、freee会計同期の3経路がある。どれも最終的には `billing_cycles.payment_confirmed_at` / `payment_confirmed_by` / `status='payment_confirmed'` を更新し、実額やfreee照合の証跡は `billing_log.detail` に保存する。
- 入金確認の税抜請求額は、freee発行済み明細 (`invoice_base_lines_json` + `invoice_issued_at`/`freee_invoice_number`) があれば明細合計を優先し、なければ確定請求額 (`budget_reported_amount`) を使う。`budget_yen` はAMD側の支払可能額なので、入金予定額の正本にはしない。
- Slack nudgeは active admin (`members.is_admin=true`) にDMする。「予定通り入金済み」は1クリックで予定額反映、「金額を入力」は `/payment-confirm` で実際の入金額を入力する。
- freee同期は収入取引 (`type=income`) の `payments` / `due_amount` に加え、取引登録前の口座明細 (`wallet_txns`, `entry_side=income`) も見る。取引先ID・請求番号・金額が合う収入取引、または金額/入金摘要がPJの `payment_alias` と合う口座明細だけ自動で入金確認済みにする。admin回答忘れを補うための補助線で、曖昧なものは手動確認へ残す。
- 入金確認まわりはLLMを使わない運用cronとして、Vercelで `freee-payment-sync` (09:10 JST) と `payment-confirm-nudges` (09:30 JST) だけを毎日動かす。LLM系cronは停止したまま。
- freee同期が失敗した場合はactive adminへSlack DMで失敗理由を通知し、その後の入金確認nudgeで手動確認できるようにする。

---

### deadline 一覧

| stepId | 締切 |
|---|---|
| `reportFix` | 翌月 3 日 |

**adjustBusinessDay** (土日なら前営業日へ繰り上げ) を通す。

---

## URL クエリでステップを直接開く

`/project/[projectId]/cockpit?ym=YYYYMM&step=reportFix` で、起動時に月次モーダルの report tab を開く。
mypage の TODO カード ([pwa/src/app/(app)/mypage/page.tsx](../src/app/(app)/mypage/page.tsx)) からこの URL に飛ばしてる。
`?ym=` だけなら従来通り月次モーダル。

---

## 関連ファイル

| 役割 | パス |
|---|---|
| 月次確認の右カラム描画 | `pwa/src/components/cockpit/CockpitRoutineGas.tsx` |
| stepId → モーダル振り分け | `pwa/src/components/cockpit/CockpitView.tsx` (`resolveStepModalFromTap`) |
| 月次の集約モーダル (月見出しクリック用) | `pwa/src/components/cockpit/CockpitMonthlyModal.tsx` |

---

## admin.billing 側の表示順 (参考)

admin.billing マトリックスは PM の月次確認とは別の admin 業務表:

- 標準: `予算確定 / 報告書 / 立替確認 / 請求発行 / 請求送付 / 支払通知 / 入金確認 / 報酬支払`
- CTB: `予算確定 / 請求発行 / 請求送付 / 報告書 / 立替確認 / 支払通知 / 入金確認 / 報酬支払`

実装: `pwa/src/components/admin/AdminBillingMatrix.tsx`。

---

## 🚨 回帰防止チェックリスト

新機能を入れる時、コックピット周りを触る時、以下を**必ず確認**:

- [ ] `CockpitRoutineGas.tsx` の表示 step が `reportFix` だけ
- [ ] `CockpitView.resolveStepModalFromTap()` で旧 `meeting` / `reimburseConfirm` / `invoiceIssue` / `invoiceSend` / `estimateSend` を PM タスクとして開かない
- [ ] 月見出し button だけが `onOpenModal` を呼んでいる
- [ ] `?step=reportFix` URL パラメータで report tab が開く
