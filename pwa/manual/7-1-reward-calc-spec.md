# 報酬計算ロジック 詳細仕様

メンバーの月次報酬がどう決まるかの **計算正本**。 数式・入力データ・優先順位・キャップ制御まで一通り。 **現行の動作実装は `pwa/src/lib/reward-summary.ts` (= こちらが正本)**。 GAS版 `gas/059_RewardV2_Ops.js` は旧互換実装で、 主従は PWA 側。 ここはそれを読み手向けに明文化したもの。

> **2026-06-15 同期メモ**: 本章は元々 GAS実装基準で書かれていたが、 現行PWA実装 (`reward-summary.ts`) に合わせて以下を同期した — (1) PM確定 source 一覧を実装の `PM_LOCKED_PROGRESS_SOURCES` に更新、 (2) 期間按分を 2026-06-12 まさ確定の **アンカー方式** (`anchoredExpectedCumPctForYm`) に更新、 (3) **uncapped (キャップ前) 月次報酬** と、 それを使う **月次収支シミュレータの将来原価** の節を新設。 計算式の主従が GAS→PWA に逆転した点に注意。

メンバー向け使い方は [2-2 章 メンバーの日常ワークフロー](2-2-member-workflows-quick-start.md)、 admin 入口は [6-5 章 Admin Payouts / 支払通知書](6-5-admin-payouts-reward-notice-spec.md) を見る。

---

## まず一行で

> **「PJ 予算 × 65% から契約バッファと会社留保を先取りした残額」を、 「その月の MS 消化度合」と「メンバーごとの背負い度 (share)」で按分する**。

つまり、 PJ がたくさん進んだ月はみんなの報酬が増えて、 進まなかった月は少なくなる。 同じ MS でも、 share が大きい人ほど多く取る。

---

## 用語

| 用語 | 意味 |
|---|---|
| `feeAmount` | PJ の月額固定費 (= `projects.feeAmount`) |
| `monthlyGross` | `feeAmount × 0.65` (= AMD の月次総原資) |
| `grossBudget` | `monthlyGross × cycleMonths` (= 計画サイクル全期間の総原資) |
| `deductionTotal` | サイクル全期間の控除累計 (= `pj_deductions` から計算) |
| `netBudget` | `grossBudget − deductionTotal` (= 実際に分配できる原資) |
| `totalPt` | 計画サイクルの総ポイント (= `value_plan_cycles.total_points`、 通常 100) |
| `ptUnit` | `round(netBudget / totalPt)` (= 1pt あたりの円換算) |
| `cumPct` / `prevCumPct` | MS の累計進捗率と前月累計 |
| `thisMonthPct` | `cumPct − prevCumPct` (= 当月増分) |
| `consumedPt` | MS の当月消化 pt = `maxPt × thisMonthPct / 100` |
| `plannedShare` | MS 設計時点の予定担当比率 (= `milestone_responsibility.share`) |
| `actualShare` | 当月の活動ログから算出・確認した実績配分 (= `milestone_monthly_contribution_allocations.actual_share`) |
| `share` | 報酬計算に使う比率。`actualShare` が `auto_applied` / `confirmed` / `pm_override` なら実績配分、なければ `plannedShare` |
| `earnedPt` | メンバーの当月獲得 pt = `Σ_ms (consumedPt × share)` |
| `basePay` | `round(earnedPt × ptUnit)` (= ベース報酬) |
| `bonusPt` | bonus ポイント (= **現状 0 固定**、 後述) |
| `totalPay` | cap 前は `basePay + bonusPt`、 cap 後は実支払額 |
| `grossDue` | `totalPay + carryIn` (= cap 前にメンバーが「本来もらえる額」) |
| `capBudgetYen` | 月次の支払上限 |
| `budget_buffer_amount` | 契約上 AMD が先に回収する会社バッファの当月消化額。当月の `invoice × 65%` から先に差し引き、外部支払 cap には回さない |
| `companyReserveYen` / `officerReserveYen` | 役員メンバーに通常の cap 按分で割り当たった額を AMD 内部留保として認識した額。支払通知書には出さない |
| `externalPayoutCapYen` | 通常の cap 按分後、非役員メンバーの支払/stock返済に実際に使われた額 |
| `carryIn` | 前月から繰越された未払い分 |
| `stockYen` / `deferredYen` | cap 超過で翌月へ繰り越す分 (= 同義) |

---

## 計算式 (= 公式)

```text
# 原資
monthlyGross   = feeAmount × 0.65
grossBudget    = monthlyGross × cycleMonths
deductionTotal = Σ_ym (Σ_active_deductions (rate% × monthlyGross or fixedAmount))
netBudget      = max(0, grossBudget − deductionTotal)
ptUnit         = round(netBudget / totalPt)                  # totalPt = 0 のとき ptUnit = 0

# 当月消化 pt (MS ごと)
thisMonthPct      = max(0, cumPct − prevCumPct)
consumedPt[ms]    = ms.maxPt × thisMonthPct / 100
monthlyConsumedPt = Σ_ms consumedPt[ms]

# 個人配分
earnedPt[member]  = Σ_ms (consumedPt[ms] × share[member, ms]) # share は実績配分優先
basePay[member]   = round(earnedPt[member] × ptUnit)
totalPay[member]  = basePay[member] + bonusPt[member]        # bonusPt は現状 0

# キャップ制御 (= 月次支払上限)
grossDue[member]  = totalPay[member] + carryIn[member]

# 会社留保も他メンバーと同じ cap 按分に入れる
contractBufferYen = billing_cycles.budget_buffer_amount
grossDueForCap[officer] = basePay[officer]                 # 役員の過去 stock は carryIn しない
grossDueForCap[nonOfficer] = grossDue[nonOfficer]

if Σ grossDueForCap[all eligible] ≤ capBudgetYen:
    allocated[member] = grossDueForCap[member]
else:
    allocated[member] = round(capBudgetYen × grossDueForCap[member] / Σ grossDueForCap[all eligible])  # 按分

paid[nonOfficer] = allocated[nonOfficer]
stockYen[nonOfficer] = grossDue[nonOfficer] − paid[nonOfficer] # 翌月へ繰越
companyReserveYen[officer] = allocated[officer]
companyReserveUnfundedYen[officer] = basePay[officer] − allocated[officer]
paid[officer] = 0
```

---

## 入力データ (= source of truth)

| データ | テーブル | 取得条件 |
|---|---|---|
| 計画サイクル | `value_plan_cycles` | `project_id = pid AND status = 'fixed'` (= 必須、 無いと error) |
| マイルストーン | `value_milestones` | `plan_cycle_id` 一致 AND `is_active = true` AND `goal_level = 'annual'` |
| 月次進捗 | `milestone_monthly_progress` | `plan_cycle_id` 一致 (= 全 ym) |
| MS 背負い度 (= sub) | `milestone_sub_items` + `sub_item_responsibility` | `projectId` 一致 (= 優先) |
| MS 背負い度 (= MS直接) | `milestone_responsibility` | sub 側が空のときの fallback |
| 当月MS実績配分 | `milestone_monthly_contribution_allocations` | `(milestone_id, ym, member_id)`。`status in ('auto_applied','confirmed','pm_override')` だけ報酬計算に使用 |
| メンバー活動ログ | `member_activities` | `project_id` / `ym` / `milestone_id` が一致する活動から自動実績配分を算出 |
| PJ 固定費 | `projects.feeAmount` | `projectId` 一致 |
| 月次控除 | `pj_deductions` | active 行を期間内 ym で全月集計 |
| 月次予算 cap | `billing_cycles.budget_yen` | `(project_id, ym)` 一致 (= 優先) |
| 前月繰越 | `billing_cycles.reward_summary_json` (= 前月分) | `members[*].stockYen` / `deferredYen` |
| メンバー名 | `members.codeName` / `name` | コードネーム解決用 |

---

## 進捗ソースの優先順位

`milestone_monthly_progress` の `source` 列で同じ MS × ym に複数行あるとき、 報酬計算で**支払い対象にできる累積消化pt** (= payable cum) は「PM が確定した行」だけを信用し、 それ以外の月はスケジュール按分デフォルトで埋める。

**PM 確定 (= PM_LOCKED) と見なす source 一覧** (実装正本 `pwa/src/lib/ms-schedule-shared.ts` の `PM_LOCKED_PROGRESS_SOURCES`):

| source | 意味 |
|---|---|
| `pm_manual` | PM (まさ) が手入力した値 |
| `pm_confirmed` | PM が確認・承認した値 |
| `pm_rejected` | PM が却下した値 (= 確定値として扱う) |
| `criteria_toggle` | success_criteria のチェック完了で自動算出 (PM操作起点) |
| `tsukuyomi_revision` | つくよみの修正を PM が確定したリビジョン |

**それ以外の source (`routine_auto` / 野良 `l2_routine` / `tsukuyomi_estimate` 等) は報酬計算では一切参照しない**。 これらが入っていても、 報酬の payable cum は「PM確定行 + スケジュール按分デフォルト」だけで決まる。 「LLM や自動補完がいい加減に上げた値」を支払い差分にしないため。

**payable cum は cumulative max で取る** (= `payableCum(ym) = max over m≤ym`)。 「進捗が巻き戻って再上昇」しても差分が二重に支払われない構造。 実装は `reward-summary.ts` の `buildPayableCumMap`。

---

## 期間按分デフォルト (= アンカー方式、 2026-06-12 まさ確定)

PM確定行が無い月の累積消化ptは、 **その MS の期間 (`period_start_ym`〜`target_ym`) を月数で按分**して埋める。 「N か月で完了する計画の MS は 1 か月あたり `100/N` % ずつ累積で進む」という基本契約。 実装正本は `pwa/src/lib/ms-schedule-shared.ts`。

**まとめ達成は構造的に起こらない**: MS の pt は必ず `period_start_ym`〜`target_ym` の月数で散る。 たとえ複数 MS の `target_ym` が同月に重なっても、 各 MS は自分の開始月から按分されるので、 月次原価が一点に跳ねることはない (= 2026-06-15 まさ「必ず期間の月数で按分」確定。 [[feedback_pt_consumption_must_be_prorated]])。

### 基本按分 (アンカー無し)

```text
# expectedCumPctForYm: 開始前=0、最終月以降=100、間は経過月割り
totalMonths   = (target_ym − period_start_ym) + 1
elapsed       = (当月 − period_start_ym) + 1
expectedCumPct = min(100, round(elapsed / totalMonths × 100, 1 桁))
```

### アンカー方式 (PM確定行を起点に月割り)

当月より**前**の最新 PM確定行 (= アンカー) があれば、 そこを起点にして月割りで淡々と積む。 `target_ym` を過ぎても自動で 100% に飛ばさない:

```text
# anchoredExpectedCumPctForYm
anchorPct        = アンカー (asOf より前の最新 PM_LOCKED 行) の累積%
monthsSinceAnchor = 当月 − アンカー月
cumPct           = min(100, anchorPct + (100/totalMonths) × monthsSinceAnchor)
```

アンカーが無ければ基本按分にフォールバックする。 旧 `routineMonthPct = 100/totalMonths` の説明はこのアンカー方式に統合された。

按分デフォルト値は in-memory で計算されるだけで **DB に書かない** (= `milestone_monthly_progress` は触らない)。

---

## 予定担当比率と当月実績配分

`milestone_responsibility.share` は計画時の予定比率であり、その月に実際に誰が動いたかとは分けて扱う。

1. `member_activities(project_id, ym, milestone_id)` から、活動者・`raw_metadata.responsibilities`・`impact`・`depth`・source種別を重みづけして、MS月ごとの `actualShare` 自動案を作る
2. 自動案の確信度がしきい値以上なら `status='auto_applied'` として `milestone_monthly_contribution_allocations` に保存し、報酬計算に使う
3. 確信度が低い場合は `status='needs_review'` として保存するが、報酬計算では使わず `plannedShare` にfallbackする
4. PM/admin が明示調整した場合は `status='confirmed'` / `pm_override` として保存し、自動案より優先する

例: SX の `PoC先候補開拓` が予定 `まさ50% / かる50%` でも、5月の `member_activities` がまさ側だけなら、その月の `actualShare` は `まさ100% / かる0%` になり、報酬もそれで計算する。

### 4月稼働分の固定

202604 の支払額はすでに確定済みなので、実績配分を後から適用しない。`ym=202604` は `member_activities` / `milestone_monthly_contribution_allocations.actual_share` を無視し、従来どおり `milestone_responsibility.share` で計算する。

支払通知書PDFでは、ここで決まった税抜支払額に消費税10%だけを上乗せする。

## responsibility 解決順序

メンバー × MS の share は 2 段階で決まる:

```mermaid
flowchart TD
  A[rv2_readResponsibilityFromSubItems_] --> B{sub 側に行ある?}
  B -- yes --> C[share = Σsub_share / subItem 件数]
  B -- no --> D[rv2_readResponsibilityForProjectYm にフォールバック]
  D --> E[milestone_responsibility 直接読む]
```

**Sub 優先のロジック**:

1. `milestone_sub_items` から `subItemId → milestoneId` の対応を作る
2. `sub_item_responsibility` を `(subItemId, memberId)` でループ
3. MS 単位に集約: `share = Σ (sub_share) / そのMSの subItem 総数`
4. = sub レベルで分担を入れてあれば、 自動的に MS レベル share に丸め込まれる

**Fallback**: sub 側に 1 行も無ければ `milestone_responsibility` の `(milestone_id, member_id, share)` をそのまま使う。

---

## ptUnit の決まり方 (= 数値例)

ZMP (= `feeAmount = 300,000`, `cycleMonths = 12`, `totalPt = 100`, `deduction なし`) の場合:

```text
monthlyGross  = 300,000 × 0.65 = 195,000
grossBudget   = 195,000 × 12   = 2,340,000
deductionTotal = 0
netBudget     = 2,340,000
ptUnit        = round(2,340,000 / 100) = 23,400 円/pt
```

= **1 pt 消化したメンバーには 23,400 円が割り当てられる**。 MS が 30pt のものをひとりで 50% 進めれば、 `30 × 0.5 × 23,400 = 351,000 円` (cap 前) になる。

---

## bonusPt (= 現状 0 固定)

`rv2_calcRewardSummary` の出力では `members[*].bonusPt = 0` で固定されている。 旧 rv1 系 (`gas-main/052_RewardScoring_Ops.js` 経由の `appreciationBonus`) は廃止済み。

将来再実装する場合は:
- どこから採点入力するか (= /admin/payouts の admin 入力 / つくよみ自動 / メンバー相互投票)
- `billing_cycles.reward_summary_json` のどこに格納するか
- ptUnit との関係 (= bonusPt も ptUnit で円換算するのか、 円直入力か)

を決めてからこの章とコードを同時更新する。

---

## 月次キャップ (= `rv2_applyMonthlyCap_`)

### capBudgetYen の決まり方

```text
1. billing_cycles.budget_yen が明示されている → これを使う (= 0 も有効な cap)
2. fallback: feeAmount × 0.65            → monthlyGross をそのまま cap に使う
3. fallback: planCycle.budgetYen / cycleMonths → サイクル予算の月按分
```

`budget_yen = 0` は「この業務月は支払 cap が 0 円」という明示値。契約開始前に実働がある PJ では、earned / grossDue は発生させつつ、`totalPay = 0`、`stockYen = grossDue` として翌月以降へ繰り越す。`budget_yen IS NULL` は cap 未設定なので、上記 fallback を使う。

`budget_buffer_amount` がある月は、請求額の 65% からその額を先に AMD 回収分として差し引く。契約自動確定では `budget_yen = round(invoiceYen × 0.65) - budget_buffer_amount` として保存するため、報酬計算側が見る `capBudgetYen` はすでにバッファ消化後の値になる。

契約最終月に `ptUnit = round(cycleBudget / totalPt)` の円丸めで少額の stock が残る場合は、最終月の `billing_cycles.budget_yen` に丸め差分を加算して stock を 0 円にする。通常月 cap は契約月額 × 65% を維持し、丸め調整は最終月だけに限定する。

### 会社留保の扱い

cap は次の順番で扱う。これは全 PJ 共通で、特定 PJ だけの例外ルールにはしない。

1. `billing_cycles.budget_buffer_amount`: 契約台帳にある会社回収バッファを最優先で消化する。`projects.contract_terms_json.companyReserveBufferYen` などに総額があれば、契約自動確定が月ごとに未消化分を `budget_buffer_amount` へ入れる。`companyReserveBufferMonthlyYen` などの月次上限がある場合は、その金額を超えて一気に回収しない。
2. `members.is_officer=true` の当月 `basePay`: 役員も非役員・支払対象メンバーと同じ cap 按分に入れる。割り当たった額だけを `reward_summary_json.members[].companyReserveYen` / `officerReserveYen` に残し、`totalPay=0` のまま支払通知書からは除外する。
3. 非役員・支払対象メンバーの `grossDue`: 当月稼働分 + 前月 stock の返済を、役員 basePay と同じ cap 按分に入れる。

役員の過去 `stockYen` は支払予定へ繰り越さない。役員分は「未払い債務」ではなく会社留保の計画値なので、当月 cap で留保できなかった分は `companyReserveUnfundedYen` として監査用に残すだけにする。非役員メンバーの stock は従来どおり carryIn として翌月以降へ繰り越す。

### キャップ超過時の按分

`Σ grossDueForCap[eligible] ≤ capBudgetYen` なら非役員支払分と役員会社留保分をそのまま全額充当 (= `capped = false`)。

`Σ grossDueForCap[eligible] > capBudgetYen` のとき:

```text
remainingCap = capBudgetYen
remainingGross = Σ grossDueForCap[eligible]
for each member in members:                      # earnedPt 降順
    if 最後のメンバー:
        paid = remainingCap                       # 端数誤差を最後に押し込む
    else:
        allocated = round(remainingCap × grossDueForCap / remainingGross)
    allocated = max(0, min(grossDueForCap, allocated)) # クランプ
    if member is officer:
        member.companyReserveYen = allocated
        member.totalPay = 0
        member.companyReserveUnfundedYen = grossDueForCap − allocated
    else:
        member.totalPay = allocated
        member.stockYen = grossDueForCap − allocated # 翌月 carryIn
    remainingCap   -= allocated
    remainingGross -= grossDueForCap
```

端数処理: 各メンバーで `round` がかかるので、 微小な端数誤差は **最後のメンバーに集約** する。 これで `Σ paid = cap` が保証される。

### 前月繰越 (= carryIn)

前月 `billing_cycles.reward_summary_json.members[*].stockYen` を読んで `carryIn[memberId]` として加算。

特例: **当月の members 配列に居なくても、 前月 stockYen が残ってるメンバーは「carry-only 行」として members に追加** される (= `earnedPt = 0, basePay = 0, grossDue = carryIn`)。 これで「過去に働いて未払いだったメンバー」が忘れ去られない。

---

## uncapped (= キャップ前の生の月次報酬)

上のキャップ制御を**噛ませない**、 その月に発生した生の報酬。 実装は `reward-summary.ts` の `buildRewardSummaryUncapped`。

```text
# キャップ・キャリーストックを通さず、その月消化分だけで確定
earnedPt[member] = Σ_ms (consumedPt[ms] × share[member, ms])
payYen[member]   = round(earnedPt[member] × ptUnit)      # = そのまま支払額扱い
```

`buildRewardSummary` (= capped) との違いは **月次キャップ・carryIn・stockYen を一切通さない**こと。 「その月に得た pt だけでその月の報酬が決まる」という素の定義そのもの。 capped 版は、 この uncapped の値に対して支払い上限と繰越平準化 (キャリーストック) をかけた**支払いスケジュール**にすぎない。

### 何に使うか

| 用途 | capped / uncapped |
|---|---|
| 実際の月次支払い (= /admin/payouts、 支払通知書) | **capped** (支払上限と繰越で平準化) |
| 月次収支シミュレータの**メンバー原価** (下記) | **uncapped** (その月に発生した原価そのもの) |

収支シミュは「その月にいくら原価が発生したか」を見たいので、 支払いを翌月に繰り越す capped ではなく、 発生 baseの uncapped を使う。

---

## 月次収支シミュレータの将来原価 (= 予実管理)

`/management-score` の月次収支シミュレータは、 将来各月の**メンバー原価**を上記 uncapped 報酬で投影する。 「いつ・どの MS が・何 pt 消化される予定か」は [期間按分デフォルト](#期間按分デフォルト--アンカー方式-2026-06-12-まさ確定) で各月に散っているので、 将来月でも uncapped 月次報酬が出せる。

`/management-score` 下部の「PJ別 先12か月収支」表は、支払予定 (capped) とは別に `MS月割 +{pt}pt / {N}MS` を表示する。これは報酬計算をもう一度行う列ではなく、`value_milestones.period_start_ym`〜`target_ym` と `anchoredExpectedCumPctForYm` から、その月にどの程度MSが進む前提かを目視確認するための監査表示。PM locked 行があるMSは `PM確定` として表示し、非確定の `routine_auto` / LLM推定行は正本にしない。

> **`/admin/payouts`「先12か月 PJ収支」表の将来「支払予定」は capped + 役員除外を使う (2026-06-17, v0.25.4)**: `/admin/payouts` の「先12か月 PJ収支」収支表の支払予定列は、**月次収支シミュの原価 (uncapped) とは別物**で、実際にいくら払うか = **capped (月次キャップ `budget_yen` + stock 繰越平準化)** が正本 (上の表 279行)。`computeForwardCappedMemberCosts` が plan cycle 期間の各月を `buildRewardSummary` で投影し、`is_officer` / `exclude_from_payout_notice` のメンバーは支払予定から**単に落とす** (再配分しない = AMD 持ち出しが無限に膨らむのを防ぐ)。**将来月の支払予定に uncapped を入れたり `budget_yen` を決め打ちコピーするのは禁止** — uncapped は pt 消化が厚い月に budget を超えて跳ね、マイナス月・役員のみ PJ (KUTE) で巨額の支払いが出る嘘になる (BUGS.md 2026-06-17、v0.25.3 で一度この誤りを犯し v0.25.4 で訂正)。役員のみ PJ は capped 支払予定 = ¥0 が正しい結果なので、値 0 を「未計算」と誤判定して budget フォールバックに落とさないこと。

- **入力**: live テーブル (`projects` の `monthly_fixed` / `value_plan_cycles` (active) / `value_milestones` の `period_start_ym`・`target_ym`・`points` / `milestone_responsibility` / `billing_cycles`)。 旧 `company_budget_inputs` の凍結スナップショットは使わない。
- **将来原価 = 将来各月の uncapped 報酬**。 capped を使うと繰越で原価が翌月にずれて月次収支が歪むため、 uncapped が正。
- **DB に書く (= 予実管理)**: 将来月の予定報酬も `billing_cycles.reward_summary_json` に保存する。 後で実績が確定したら同じ行が上書きされ、 予実が 1 テーブルに並ぶ。 「シミュだから DB に書かない」は誤り (2026-06-15 まさ確定)。

> **注意 (uncapped の単月赤字)**: uncapped はキャリーストック平準化をしないので、 pt 消化が厚い月はメンバー原価が跳ねて**単月赤字**が出ることがある。 これは実運用の capped (繰越平準化) では均される性質。 シミュ上で赤字月が顕著なら、 按分計画 (MS の `period_start_ym`〜`target_ym`) かサイクル設計を見直すシグナルとして扱う。

詳細な収支シミュ仕様は [4-5 章 Management Score / 収支シミュレーション](4-5-management-score-and-finance-simulation-spec.md) を参照。

---

## 出力構造 (= `reward_summary_json`)

`billing_cycles.reward_summary_json` にキャッシュされる JSON:

```json
{
  "totalPaySum": 195000,
  "totalGrossDueYen": 251000,
  "capBudgetYen": 195000,
  "capped": true,
  "carryInYen": 32000,
  "carryOverYen": 56000,
  "monthlyBudget65": 195000,
  "planCycleId": "pc_xxx",
  "annualBudget": 3000000,
  "grossBudget": 2340000,
  "deductionTotal": 0,
  "netBudget": 2340000,
  "totalPt": 100,
  "ptUnit": 23400,
  "monthlyConsumedPt": 8.5,
  "cumulativeConsumedPt": 42.3,
  "progressRate": 42.3,
  "expectedRate": 33.3,
  "milestones": [
    {
      "milestoneKey": "ms_xxx",
      "title": "...",
      "maxPt": 30,
      "tag": "normal",
      "progressPct": 5.0,
      "pctUsed": 60.0,
      "consumedPt": 1.5,
      "cumPct": 60.0,
      "cumPt": 18.0,
      "source": "pm_manual"
    }
  ],
  "members": [
    {
      "memberId": "ID001",
      "memberName": "...",
      "earnedPt": 4.5,
      "basePay": 105300,
      "bonusPt": 0,
      "totalPay": 95000,
      "carryInYen": 0,
      "grossDueYen": 105300,
      "cappedFrom": 105300,
      "deferredYen": 10300,
      "stockYen": 10300,
      "breakdown": [
        { "msKey": "ms_xxx", "title": "...", "msConsumedPt": 1.5, "share": 1.0, "earnedPt": 1.5 }
      ]
    }
  ]
}
```

---

## 再計算トリガ

`reward_summary_json` は **キャッシュ**。 計算が走るのは以下のときだけ:

| トリガ | 入口 |
|---|---|
| 自動 (日次 03:05 JST) | `/api/cron/payout-reward-cache-refresh` |
| 手動ボタン | `/admin/payouts` の「報酬キャッシュ再計算」 |
| 保存系操作 | `/admin/payouts` で「支払データ保存」「通知書発行」「送付済化」を叩いたとき (= `refreshRewards=1` 付与) |

**通常 GET (= `/admin/payouts?ym=YYYYMM` を開くだけ) は絶対に再計算しない**。 過去事故: GET でも自動再計算してた頃、 admin が画面開いただけで承認済の過去月の数字がズレるという UX 事故が発生 (= 6-5 章「通常 GET は読むだけ原則」参照)。

## 月初合意との境界

`/monthly-agreement` は、この章の支払計算結果を確定額として表示する画面ではない。月初合意は、当月の月次予算を「当月の予定MS消化pt × active member 正規化 share」で配分した **月初合意用の予定報酬** と、担当MS/到達目標を本人へ表示し、`member_monthly_work_agreements.snapshot_json` と `snapshot_hash` に保存する確認レイヤー。合意 API は報酬キャッシュを再計算せず、`milestone_monthly_progress`、`milestone_responsibility`、`billing_cycles` も書き換えない。

月初合意画面では `reward_summary_json.members[].breakdown[].payYen`、cap、carry-over などの支払・精算内部情報は表示しない。本人確認に必要なのは「担当MS」「当月到達目標」「その対価としての予定報酬」。ただし SX のように当月 `totalPay=0` でも `stockYen` が翌月以降へ繰り越される PJ は、`totalPay` / `stockYen` / `grossDueYen` を read-only に表示し、「今月支払0円」「未払いストック（今月は支払われない）」を別枠で確認できるようにする。これは予定報酬計算には使わず、cap 由来の配賦や繰越の検証は `/admin/payouts` と本章の責務に残す。

本人からの修正要望は `member_monthly_work_agreement_requests` に保存する。これは報酬計算への直接入力ではなく、admin/PM が MS/share/予定報酬の元データを見直すための確認キュー。

snapshot hash が変わったときは「条件更新あり」として再合意を促す。これは報酬計算の入力変更ではなく、本人/admin が条件変更を見落とさないための状態。

`/admin/payouts` の支払 gate は、この月初合意レイヤーを server-side に read する。未合意 (`pending`) / 条件更新あり (`stale`) / 修正要望中 (`revision_requested`) の `member × 稼働月 × PJ` がある場合、支払データ保存・支払通知書PDF生成・送付・送付済み確定を止める。admin override は理由・actor・対象 member/PJ/月を `member_monthly_work_agreement_payout_overrides` に残した場合だけ許可する。

この gate は「支払へ進めるか」の判定であり、`buildRewardSummary`、cap、stockYen、carry-over、pt unit、PM locked progress の計算には影響しない。業務委託契約上の個別発注 / SOW / 条件確認として hard guard を本番運用するには、契約改定・メンバー同意・法務レビューを前提にする。ここでは法的助言として断定しない。

---

## edge case と過去ハマり

| ケース | 挙動 |
|---|---|
| `value_plan_cycles.status='fixed'` が無い PJ | `rv2_calcRewardSummary` は `{ error: "planCycle not found" }` を返す。 admin/payouts では「MSなしPJ 強制報酬確定」ルートを使う ([6-5 章](6-5-admin-payouts-reward-notice-spec.md#msなしpj-強制報酬確定)) |
| `pj_deductions` テーブル未作成 | `try/catch` で `deductionTotal = 0` にフォールバック |
| MS に responsibility 未設定 | そのメンバーには配分されない (= 0 円)。 routine MS で起こりがち |
| routine MS の前月補完 | 前月分の `routine_auto` も `allProgress` に push される。 ただし当月に pm_manual があれば自動補完は skip |
| 端数誤差 | キャップ按分は最後のメンバーに `remainingCap` を全部押し込む → `Σ paid = cap` 保証 |
| 当月 0 円なのに前月 stockYen 残 | carry-only 行として members に追加され、 前月分が今月支払われる |
| MSなしPJ | admin が `/admin/payouts` の「MSなしPJ 強制報酬確定」から PJ × 稼働月 × メンバー × 支払額を手入力。 source = `admin_manual_payout`。 ([6-5 章](6-5-admin-payouts-reward-notice-spec.md#msなしpj-強制報酬確定)) |

---

## トラブル時

| 症状 | 確認場所 |
|---|---|
| 自分の報酬が 0 円 | `milestone_responsibility` or `sub_item_responsibility` に自分の `share` 行があるか / `milestone_monthly_progress` の `progress_pct` が 0 でないか / `value_plan_cycles.status='fixed'` か |
| ptUnit が 0 | `projects.feeAmount` が 0、 または `value_plan_cycles.total_points` が 0 |
| 報酬が前月より急に増減 | `pj_deductions` の active 期間変更、 または cap budget の変更 (= `billing_cycles.budget_yen` 上書き) |
| stockYen が永遠に残る | cap が常に gross を下回り続けてる → cap budget 見直し or 控除見直し |
| routine MS で配分が偏る | sub_item_responsibility が一部メンバーしか入ってない可能性。 全員に share を入れるか、 milestone_responsibility に fallback させる |
| キャッシュが古い | `/admin/payouts` の「報酬キャッシュ再計算」を押す or `payout-reward-cache-refresh` cron 実行履歴を確認 |

---

## 関連

- 計算正本: `gas-main/059_RewardV2_Ops.js` (= `rv2_calcRewardSummary`)
- データ取得: `gas-main/058_RewardV2_Repo.js` (= `rv2_readProgressForPlanCycle`, `rv2_readResponsibilityFromSubItems_`, `rv2_readResponsibilityForProjectYm`)
- 控除計算: `gas-main/043_PjDeductions_Repo.js` (= `pjDed_calcCycleDeductionTotal_`)
- 試算 (= UI 上のシミュレーション): `gas-main/060_RewardV2_Estimator.js`
- メンバー側表示: [2-2 章 メンバーの日常ワークフロー](2-2-member-workflows-quick-start.md)
- /mypage 仕様: [6-6 章 Member Ops / Billing / Prompt](6-6-member-billing-prompts-spec.md#mypage)
- /admin/payouts 仕様: [6-5 章 Admin Payouts / 支払通知書](6-5-admin-payouts-reward-notice-spec.md)
- DB schema: [`pwa/design/db_schema.md`](../design/db_schema.md) (= `billing_cycles`, `value_milestones`, `value_plan_cycles`, `milestone_monthly_progress`, `milestone_responsibility`, `milestone_sub_items`)
- 設計: [`pwa/design/ms_progress.md`](../design/ms_progress.md) (= MS 進捗の source 設計)
- 設計: [`pwa/design/progress_estimation.md`](../design/progress_estimation.md) (= LLM 進捗推定)
