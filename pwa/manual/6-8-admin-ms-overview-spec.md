# 6-8. Admin / MS Overview (全PJ MS設計 一望)

`/admin/ms-overview` は AMD OS が抱える全 active シーズン (plan cycle) の MS (Milestone) 設計を 1 画面で並べて、「pt 配分が他 MS と比べて妥当か」「メンバー間の担当量がおかしくないか」をまさが目で判断するための **設計レビュー画面**。

シーズン予実表 (`/admin/season-pl`) が「請求・原資・支払いが閉じているか」の **安全網** なのに対し、こちらは MS 設計そのものの **歪み検知**。実消化 (`milestone_monthly_progress`) と支払確定額は読まず、`plannedShare` ベースの pt 配分と設計額の目安を並べる。

---

## 開く場面

- 新規シーズンの MS 設計をレビュー / 編集する
- メンバーから「自分の担当量が他のメンバーと比べておかしくないか」と相談された
- まさ自身が「あびと しんで序列がおかしくなってないか」を一望したい
- 別財布 (cap_extra) を入れた PJ で「本契約と別財布の pt 配分が混ざっていないか」をまとめて確認したい

MS 設計値の書き換え口はこの画面に集約する。cockpit は MS の表示と月次進捗確認に専念し、MS 本体・期間・pt・tag・担当 share と設計額確認は `/admin/ms-overview` の編集モードで行う。

---

## 画面構造

全 active plan cycle (`value_plan_cycles.status in (active, confirmed, fixed, draft)`) を `budget_yen` 降順に並べたアコーディオン。各 PJ ブロックは初期は折りたたみ、先頭 PJ だけ開いた状態でロードする。

PJ ブロックを開くと以下の 4 ブロックが縦に並ぶ:

### ① メトリクスカード 4 枚

| カード | 値 | 補助情報 |
|---|---|---|
| 合計pt | `total_points` | 割当済み設計額 |
| 本契約pt | `regularPoints` | 通常 MS の割当pt / 本契約の設計単価 |
| 別財布pt | `extraPoints` (無ければ `—`) | 別財布原資 / 別財布の設計単価 |
| PJ予算残 / 不足額 / 予算不足 / 原資超過 | 保存前支払検算 `budgetImpact` の残予算または不足額 | PJ予算 / 期末未払 |

主要メンバー比較カードは上段メトリクスに出さない。メンバーごとの担当量と設計額は、下段の **メンバー別 pt配分 / 設計額** で確認する。

### ② 全MS (pt順)

MS を `pt` 降順で並べ、各行に以下を出す:

- **MS 名 / 期間 (`period_start_ym` – `target_ym`) / tag** — tag は色付きで表示 (cap_extra 系は `cap_extra` と固定表示)
- **pt** — `value_milestones.points`
- **設計額** — `effectivePoints × designUnitYen`。支払確定額ではなく、MS 設計の目安。
- **横バー** — `points` の最大値に対する比率で幅を取る
  - normal (本契約): `#1D9E75`
  - routine: `#888780`
  - cap_extra (別財布): `#7F77DD`
- **担当 share** — `milestone_responsibility` の share 降順、`codeName share%` 形式。担当未設定は赤字で警告。

### ③ メンバー別 pt配分 / 設計額 (plannedShare)

active メンバー (`project_members.is_active=true`) について、シーズン全期間の担当 pt を `totalPt` 降順で出す:

- 1 本の横バーに **本契約 (濃い緑 `#1D9E75`) + 別財布 (淡い紫 `#7F77DD`, 不透明度 0.65)** を積み上げ
- 右に合計 pt と設計額。別財布が乗っている人は `(本 xxpt 別 yypt)` の内訳もインライン表示
- 計算式: `Σ (MS points × share)` を tag (cap_extra か否か) で振り分けて regular / extra に積む

### ④ PJ ヘルス順での並び替え (2026-06-21 追加)

PJ ブロックの並び順は **PJ の健全性** を最優先で決める:

1. **healthy** (= `projects.status='active'` かつ freeze 中でない) — 上段
2. **frozen** (= `projects.status='active'` だが `projects.freeze_from_ym ≤ 今月` か `project_freeze_periods` で freeze 期間中) — 中段
3. **inactive** (= `projects.status != 'active'`、例: `ended` / `suspended`) — 下段

各層内は `budgetYen` 降順 → `projectId` 昇順。グループ単位の health は「PJ 内の最も良い cycle の state」(= 健全な cycle が 1 つでもあれば healthy 扱い)。

PJ ヘッダには状態 chip を出す:
- healthy: chip 非表示 (= デフォルト)
- frozen: 琥珀色 `❄ freeze {fromYm}〜` (= ホバーで `freeze_from_ym=...`)
- inactive: スレート色 `■ {projectStatus}` (= ホバーで `projects.status=...`)

判定は JST 起点の今月で評価する。

### ⑤ 過去シーズン (= 過去 plan_cycle) トグル

route は active/confirmed/fixed/draft の全 plan_cycle を 1 ブロックずつ返すため、同一 PJ で複数 cycle (active + fixed 等) があると素朴に並べるとブロック重複が起きる (例: CX p20 は active `PC-p20-202606-202609` と fixed `PC-p20-202601-202603` で 2 ブロック)。client 側で **PJ 単位にグループ化** し、`period_end_ym` 降順で先頭の cycle を **「現役シーズン」** として常時表示、それ以外を **「過去シーズン」** としてトグル `▸ 過去シーズン (N件) を表示` で畳む (= `ProjectCycleGroup`)。グループ内 cycle 並び順は `period_end_ym` → `period_start_ym` → `planCycleId` の辞書順。

### ⑥ 過去分 MS トグル

MS 一覧は plan_cycle ブロックの中でさらに **現役 MS** と **過去分 MS** に分けて表示する。判定は MS の `target_ym` (なければ `period_start_ym`) を **JST 起点の今月 (YYYYMM)** と比較し、`target_ym < 今月` なら過去分扱い。期間情報がない MS は隠れない方が安全なので「現役」として扱う。

- 現役 MS は常時表示
- 過去分 MS はデフォルト折りたたみ、`▸ 過去分 (N件) を表示` トグルで展開
- 見出しに「現役 N件 / 過去分 N件」を出して件数だけは常に見える
- 編集モードでは全 MS を設計エディタとして並べる。保存対象は画面内の全 active MS。
- 折りたたまれた過去分は表示されないが、メトリクス・メンバー別 pt 配分には変わらず含まれる (= 計算からは外さない)

### ⑦ tag 凡例

normal / routine / cap_extra の色サンプル + ラベルを横並びで表示する (= バー色の意味をその場で確認できるようにする)。

---

## 計算ロジック (正本)

API: `GET /api/admin/ms-overview` (`src/app/api/admin/ms-overview/route.ts`)

**最重要原則: `/admin/ms-overview` では支払確定額に見える円換算を作らない**。この画面は MS 設計レビュー専用なので、pt と share から **設計額** (`effectivePoints × designUnitYen`) だけを出す。実際の支払額は `reward-summary.ts` / `/admin/season-pl` / `/admin/payouts` 側を正本にする。別ロジックで「似たような支払確定額」を出すと、実支払額と数百円単位でズレて事故るため禁止する。

route の流れ:

1. `value_plan_cycles` を active ステータス絞りで全件 load
2. 各 plan cycle について、シーズン期間から `regularPoints = 月数 × 10pt` を出す
3. `value_milestones.is_active=true` かつ `goal_level ≠ monthly` を pt 順に並べる
4. `cap_extra` 系 MS は MS 期間月数×10ptを effective points とし、`extraPoints` に積む
5. 本契約の設計単価は `value_plan_cycles.budget_yen ÷ regularPoints`、別財布の設計単価は `Σbilling_cycles.extra_budget_yen ÷ extraPoints` で出す。別財布原資が未設定なら別財布設計単価は 0。
6. メンバー別配分は `Σ (effectivePoints × share)` を tag で regular / extra pt に振り分け、同時に `Σ (effectivePoints × share × designUnitYen)` を設計額として出す

別財布判定の tag セット (season-pl と一致させる):
`cap_extra` / `extra_contract` / `contract_extra` / `cap_outside` / `uncapped`

レスポンス例:

```jsonc
{
  "ok": true,
  "planCycles": [
	    {
	      "planCycleId": "...",
	      "projectId": "p19",
	      "projectName": "ZMP",
	      "periodStartYm": "202601",
	      "periodEndYm": "202612",
	      "budgetYen": 2340000,
	      "totalPoints": 180,
	      "regularPoints": 120,
	      "extraPoints": 60,
	      "projectMembers": [{ "memberId": "ID002", "codeName": "あび" }],
	      "milestones": [
	        {
	          "milestoneId": "...",
	          "title": "ファシリテーション",
	          "points": 20,
	          "tag": "normal",
	          "goalLevel": "annual",
	          "isCapExtra": false,
	          "responsibilities": [{ "memberId": "ID002", "codeName": "あび", "share": 1, "role": "担当", "taskDescription": null }]
	        }
	      ],
	      "memberPointTotals": [
	        { "memberId": "ID002", "codeName": "あび", "regularPt": 20, "extraPt": 0, "totalPt": 20 }
	      ]
	    }
	  ]
}
```

---

## 編集モード (2026-06-23 更新)

各 PJ ブロックに **「編集モードに切替」** トグルがあり、ON にするとその PJ の MS 一覧が **MS設計エディタ** に切り替わる。cockpit 側には MS 設計の保存口を置かない。

### 編集できる項目

- MS 名 (`title`)
- pt (`points`; 数値入力 + pt配分スライダーで調整。`cap_extra` は MS 期間の月数×10ptで自動算出し、数値入力/スライダーとも無効)
- tag (`normal` / `routine` / `buffer` / `cap_extra`)
- 期間 (`period_start_ym` / `target_ym`)
- 完了条件 (`success_criteria`)
- 担当 share / 役割 / 担当タスク (`milestone_responsibility.share`, `role`, `task_description`)
- MS 追加 / 無効化 (`is_active=false`)

### リアルタイム再計算

pt / tag / share を動かすたびに、API を叩かず **JS 側で即座に再計算** する。算定式は `src/lib/admin/ms-overview-calc.ts` の `recomputeMsOverview`。支払確定額は作らず、編集画面内の円表示は **設計額** に限定する:

```text
regularPts   = シーズン期間の月数 × 10pt
extraPts     = Σ(cap_extra MS の期間月数 × 10pt)
memberPt[m]  = Σ over MS of (effectivePoints × share[m])
memberDesignYen[m] = Σ over MS of (effectivePoints × share[m] × designUnitYen)
```

`total_points` の保存値は `regularPts + extraPts`。`cap_extra` の pt は保存時にも API 側で MS 期間×10ptへ正規化する。

編集モードでは、MS 一覧の先頭に **全MS 編集テーブル** を置く。これは MS 名 / tag / 期間 / pt数値入力 / pt配分スライダー / 設計額 / メンバーのエフォートを並べた編集パネルで、全 MS の重み・期間・担当量・金額感を比較しながら調整するための入口。各編集カード内にも pt 数値入力 + pt配分スライダーを残し、どちらを動かしても同じ編集中 state を更新する。通常 MS のスライダー範囲は編集開始時点の最大 pt × 1.5 を右端に固定し、ドラッグ中に max を変えない (= 1px あたりの pt 幅を一定に保つ)。`cap_extra` は MS 期間の月数×10pt固定なので、まとめパネル・個別カードの両方で disabled 表示にする。

編集カードは左に MS 基本情報 (MS名 / pt数値入力 / pt配分スライダー / tag / 期間 / 完了条件 / 設計額)、右に担当 share 表を置く。担当 share 表は **メンバー1人=1行** で、横方向に `メンバー / share / 役割 / 担当pt / 担当設計額 / 担当タスク` を並べる。2カラムに分割しない。

通常 MS の pt を動かすと、編集画面上部と全MS見出しに **残り割り振り可能pt** をリアルタイム表示する。算定式は `regularPointBasis - Σ(non-cap_extra MS effectivePoints)`。配分超過時は負数として赤系で表示する。`cap_extra` は MS期間×10pt固定の別財布なので、この残り枠には混ぜない。

再計算結果は ① メトリクスカード 4 枚 (合計pt / 本契約pt / 別財布pt / PJ予算残または不足額) ② 各 MS の pt 比と設計額 ③ 担当 share 行の **担当pt** (`effectivePoints × share`) と **担当設計額** ④ メンバー別 pt 配分バーと設計額 ⑤ ヘッダの pt 表示 にリアルタイムで反映する。

月次 override (`milestone_monthly_contribution_allocations.actual_share`) は読まない (= MS 設計を見る画面なので plannedShare × MS.points だけで計算)。

### 保存導線

編集モード ON の直後、MS 一覧の上部に **保存バー** を表示する。長い MS 一覧でも保存場所が迷子にならないよう、同じ操作をフッターにも重複配置する。

- **未保存あり / 変更なし / 保存中** — 編集状態を表示。
- **保存前支払検算** — 編集中 payload を `POST /api/admin/ms-overview/{planCycleId}` に送り、まだ DB へ保存していない MS 案で protected 月の reward 差額とシーズン末ゼロ着地をサーバー側で仮計算する。結果は `safe` / `warning` / `blocked` で返り、`blocked` の間は保存ボタンを無効にする。編集モードに入った時点で現行案も検算し、変更前から不足がある場合も見えるようにする。
- **閲覧時の支払検算** — cycle を開いた時点でも現行案を `POST /api/admin/ms-overview/{planCycleId}` で検算し、期末未払または PJ 予算不足がある場合は MS 一覧の上に `MS編集停止中` の赤い帯を出す。編集モードへ入らなくても、既存状態が危険なら「正常な MS 一覧」に見えないようにする。
- **保存先 DB / protected月は差額精算** — 保存時に `value_milestones` / `milestone_responsibility` と reward cache まで反映されること、protected 月は過去 cache を書き換えず差額台帳で精算することを表示。
- **↻ DB値に戻す** — 編集前の DB 値に戻す。`isDirty` のときだけ有効。
- **保存して DB へ反映** — 編集内容を確定。`isDirty` のときだけ有効。押下時の動作:
  1. 画面側で `POST /api/admin/ms-overview/{planCycleId}` の保存前支払検算が `blocked` でないことを確認する
  2. `PUT /api/admin/ms-overview/{planCycleId}` を呼ぶ (body: `{ milestones: [...], deletedMilestoneIds: [...] }`)
  3. サーバ側でも同じ保存前支払検算を再実行し、`blocked` なら 409 で保存を止める
  4. サーバ側は (a) 当該 plan_cycle 内の `value_milestones` を upsert / 無効化、(b) `milestone_responsibility` を保存値で置換、(c) `value_plan_cycles.total_points = 期間月数×10 + Σcap_extra points` に再計算、(d) protected 月 (`reward_paid_at` / `payout_notice_uploaded_at` / `payment_confirmed_at`) の旧 reward cache と新計算値の member×pool 差額を `reward_member_liability_offsets` に記録、(e) `syncRewardSummariesForProject` で未保護月だけ `billing_cycles.reward_summary_json` を再計算する
  5. 成功すると編集モード OFF へ戻り、`/api/admin/ms-overview` を再 fetch して最新値で再描画する
- **保存中の表示**: ボタンが「保存中…」、完了で `✓ 保存完了 → reward 再計算済` (緑) / 失敗で `保存失敗: {error}` (赤)

月次 override (`actual_share`) はここでは扱わない (= MS 設計画面なので plannedShare のみ)。

### 保存前支払検算の見え方

編集モード中は **保存前支払検算** パネルを MS 編集テーブルの直上に出す。ここは設計額ではなく、保存した場合の支払事故防止だけを扱う。

- `protectedCycleCount` — 変更の影響を比べる保護済み月数
- `offsetCount` / `positiveOffsetYen` / `negativeOffsetYen` — 本人別に次回以降へ精算される差額
- `applyYms` — 差額を反映する未保護月
- `memberImpacts` — メンバー別の追加支払 / 過払い回収 / 本契約・別財布内訳
- `budgetImpact` — freee銀行出金と `monthly_reward_payout` 明細が一致した支払済み実績だけを固定し、これから支払う見込み・会社留保・期末未払い残を足した PJ 予算影響。表示項目は `クライアント支払` / `バッファ` / `原資上限` / `PJ予算` / `メンバー支払` / `会社留保` / `支払済み固定` / `実績未照合` / `これから支払予定` / `期末未払` / `保存後残予算または予算不足`。`クライアント支払` は本契約に別財布売上を加算し、schedule_based 契約では `contract_terms_json.monthlySchedule.amountTaxExcl` も予定売上として読む。`バッファ` は `value_plan_cycles.buffer_breakdown_json` を優先する。`原資上限 = (クライアント支払 - バッファ) × 65%`。`PJ予算 = 本契約原資 + 別財布原資`、`メンバー支払 = 支払済み固定 + これから支払予定`。会社留保は支払通知書対象外だが、PJ予算を消費するため支払義務側に含める。期末未払と原資超過は不足額そのものとして赤表示する。
- `blockers` — 保存不可理由。旧 reward cache が無い、次回精算先が無い、過払い回収がシーズン内で吸収できない可能性がある、支払済み印はあるが実支払証跡と明細額が未照合の月がある、期末未払残が 1 円以上ある、メンバー支払義務が PJ 予算を 1 円以上超える、など。

このパネルの目的は「差分を見せる」ことではなく、MS を期中変更しても **払いすぎ・払い足りなさを作らず、証跡つき支払済み実績を固定し、シーズン終了時の未払残を必ず 0 円にすること** を編集中に判定すること。実支払額と同一だと確認できない月は `実績未照合` に分け、保存は `blocked` にする。期末未払残、メンバー支払義務の PJ 予算超過、または PJ 予算の原資上限超過が 1 円でもある状態では MS 編集を終えられない。AMD運営側が認識していないところでバッファ/運営費が勝手に削られてメンバー支払に回る設計は禁止する。`warning` は保存可能だが本人別精算などの注意が残る状態、`blocked` は保存不可。

### 安全機構

- PUT route は payload の各 milestone が **本当に同じ plan_cycle に属するか** を `value_milestones.plan_cycle_id` 突合で検査し、他 PJ への巻き込み更新を防ぐ。
- `points < 0` や NaN は server で 400 で弾く。
- 期間は `YYYYMM` 形式、かつ `period_start_ym <= target_ym` でないと 400 で弾く。
- `syncRewardSummariesForProject` 内部で `reward_paid_at` / `payout_notice_uploaded_at` / `payment_confirmed_at` のある月は再計算対象から外れる (= 既に支払い済みの過去月を勝手に書き換えない)。
- protected 月に MS 修正差額が出た場合、過去月の `reward_summary_json` は保存し直さず、同じ member の次の未保護月へ `reward_member_liability_offsets.offset_yen` として精算する。正の差額は追加支払、負の差額は将来支払から本人単位で回収する。同じ source_ym の既存 pending offset は保存のたびに `voided` にして入れ直すので、複数回編集しても二重精算しない。
- 保存前支払検算で `blocked` の場合、UI の保存ボタンを無効化するだけでなく、PUT route も 409 を返して保存前に止める。

## なぜ「実消化」を読まないか

MS Overview は **設計値そのものを見せる画面** だから。実消化 (`milestone_monthly_progress.progress_pct`) を読むと:

- 期中はまだ消化が進んでいない MS が小さく見えてしまい、「pt 配分が小さい」と誤解する
- 「設計値 (= 期末に何 pt をどう配るつもりか)」と「現時点の進捗」が混ざって、判断軸が曖昧になる

→ 進捗を見る画面は cockpit / `/admin/payouts` / `/admin/season-pl` 側に既にあるので、ここは設計値専用とする。

---

## 関連

- MS Overview pt計算: [`pwa/src/lib/admin/ms-overview-calc.ts`](../src/lib/admin/ms-overview-calc.ts) の `recomputeMsOverview`
- 報酬計算正本: [`pwa/manual/7-1-reward-calc-spec.md`](7-1-reward-calc-spec.md) (別財布章、plannedShare/actualShare の関係)。支払確定額の円計算はここから派生する reward cache / payout 側だけで扱う。MS Overview の円表示は設計額の目安に限る。
- 姉妹画面: [`pwa/manual/6-5-admin-payouts-reward-notice-spec.md`](6-5-admin-payouts-reward-notice-spec.md) §シーズン予実表 (= 実消化ベースの安全網)
- 設計セッション起点: `pwa/design_log/sessions_2026-06.md` 2026-06-20 ZMP MS 設計再考セッション
