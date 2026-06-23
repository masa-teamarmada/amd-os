# 6-8. Admin / MS Overview (全PJ MS設計 一望)

`/admin/ms-overview` は AMD OS が抱える全 active シーズン (plan cycle) の MS (Milestone) 設計を 1 画面で並べて、「pt 配分が他 MS と比べて妥当か」「メンバー間の序列がおかしくないか」をまさが目で判断するための **設計レビュー画面**。

シーズン予実表 (`/admin/season-pl`) が「請求・原資・支払いが閉じているか」の **安全網** なのに対し、こちらは MS 設計そのものの **歪み検知**。実消化 (`milestone_monthly_progress`) は読まず、`plannedShare` ベースの理論値だけを並べる。

---

## 開く場面

- 新規シーズンの MS 設計をレビュー / 編集する
- メンバーから「自分の年計が他のメンバーと比べておかしくないか」と相談された
- まさ自身が「あびと しんで序列がおかしくなってないか」を一望したい
- 別財布 (cap_extra) を入れた PJ で「本契約と別財布で pt 単価が正しく分離されているか」をまとめて確認したい

MS 設計値の書き換え口はこの画面に集約する。cockpit は MS の表示と月次進捗確認に専念し、MS 本体・期間・pt・tag・担当 share の編集は `/admin/ms-overview` の編集モードで行う。

---

## 画面構造

全 active plan cycle (`value_plan_cycles.status in (active, confirmed, fixed, draft)`) を `budget_yen` 降順に並べたアコーディオン。各 PJ ブロックは初期は折りたたみ、先頭 PJ だけ開いた状態でロードする。

PJ ブロックを開くと以下の 4 ブロックが縦に並ぶ:

### ① メトリクスカード 4 枚

| カード | 値 | 補助情報 |
|---|---|---|
| 合計pt | `total_points` | 本契約 / 別財布 の pt 内訳 |
| 本契約 pt単価 | `regularPtUnitYen` | 原資 ÷ 本契約 pt |
| 別財布 pt単価 | `extraPtUnitYen` (無ければ `—`) | `Σ extra_budget_yen ÷ Σextra pt` |
| 主要メンバー比較 | 年計上位 2 名の金額 | 比 (倍率) |

### ② 全MS (pt順)

MS を `pt` 降順で並べ、各行に以下を出す:

- **MS 名 / 期間 (`period_start_ym` – `target_ym`) / tag** — tag は色付きで表示 (cap_extra 系は `cap_extra` と固定表示)
- **pt** — `value_milestones.points`
- **pt価値 (円)** — `points × pt単価` (cap_extra なら extra 単価、そうでなければ regular 単価)
- **横バー** — `ptValueYen` の最大値に対する比率で幅を取る
  - normal (本契約): `#1D9E75`
  - routine: `#888780`
  - cap_extra (別財布): `#7F77DD`
- **担当 share** — `milestone_responsibility` の share 降順、`codeName share%` 形式。担当未設定は赤字で警告。

### ③ メンバー別 年計 (plannedShare 理論値)

active メンバー (`project_members.is_active=true`) について、シーズン全期間の理論年計を `totalYen` 降順で出す:

- 1 本の横バーに **本契約 (濃い緑 `#1D9E75`) + 別財布 (淡い紫 `#7F77DD`, 不透明度 0.65)** を積み上げ
- 右に合計金額。別財布が乗っている人は `(本 ¥xxx 別 ¥yyy)` の内訳もインライン表示
- 計算式: `Σ (MS points × share × pt単価)` を tag (cap_extra か否か) で振り分けて regular / extra に積む

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
- 折りたたまれた過去分は表示されないが、メトリクス・メンバー年計・pt 単価には変わらず含まれる (= 計算からは外さない)

### ⑦ tag 凡例

normal / routine / cap_extra の色サンプル + ラベルを横並びで表示する (= バー色の意味をその場で確認できるようにする)。

---

## 計算ロジック (正本)

API: `GET /api/admin/ms-overview` (`src/app/api/admin/ms-overview/route.ts`)

**最重要原則: 算定ロジックを `computeSeasonPl` から剥がして route 内で再実装しない**。pt 単価と原資の正本は常に `src/lib/season-pl.ts` 側に置く。これを破ると `/admin/season-pl` (予実表) と乖離して、まさが見る数字が画面によって違うバグになる (= 2026-06-20 確定方針)。

route の流れ:

1. `value_plan_cycles` を active ステータス絞りで全件 load
2. 各 plan cycle について `computeSeasonPl({ progress: [] })` を呼ぶ
   - `progress` を空配列で渡すのは、この画面が **実消化を読まないため**
   - `regularPtUnitYen` / `extraPtUnitYen` / `extraPoolBudgetYen` / `extraPointsSum` だけ使う
3. MS 一覧は `value_milestones.is_active=true` かつ `goal_level ≠ monthly` を pt 順に並べ、`ptValueYen = points × (isCapExtra ? extraPtUnitYen : regularPtUnitYen)` で計算
4. メンバー年計は `Σ (points × share)` を tag で regular / extra プールに振り分け、最後に pt 単価を掛ける

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
      "budgetYen": 3000000,
      "totalPoints": 140,
      "regularPoints": 120,
      "extraPoints": 20,
      "regularPtUnitYen": 19500,
      "extraPtUnitYen": 65000,
      "extraPoolBudgetYen": 1300000,
      "projectMembers": [{ "memberId": "ID002", "codeName": "あび" }],
      "milestones": [
        {
          "milestoneId": "...",
          "title": "ファシリテーション",
          "points": 20,
          "tag": "normal",
          "goalLevel": "annual",
          "isCapExtra": false,
          "ptValueYen": 390000,
          "responsibilities": [{ "memberId": "ID002", "codeName": "あび", "share": 1, "role": "担当", "taskDescription": null }]
        }
      ],
      "memberYearTotals": [
        { "memberId": "ID002", "codeName": "あび", "regularYen": 700000, "extraYen": 0, "totalYen": 700000 }
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
- pt (`points`)
- tag (`normal` / `routine` / `buffer` / `cap_extra`)
- 期間 (`period_start_ym` / `target_ym`)
- 完了条件 (`success_criteria`)
- 担当 share / 役割 / 担当タスク (`milestone_responsibility.share`, `role`, `task_description`)
- MS 追加 / 無効化 (`is_active=false`)

### リアルタイム再計算

pt / tag / share を動かすたびに、API を叩かず **JS 側で即座に再計算** する。算定式は `src/lib/admin/ms-overview-calc.ts` の `recomputeMsOverview` で、`src/lib/season-pl.ts` の `computeSeasonPl` のメンバー予算配分式と完全一致 (= 編集中も DB 保存後も `/admin/season-pl` と齟齬が出ない):

```text
regularPts   = シーズン期間の月数 × 10pt
regularUnit  = round(budget_yen / regularPts)
extraPts     = Σ(cap_extra MS の points)
extraUnit    = round(extraPoolBudgetYen / extraPts)   // 別財布があるときのみ
memberYen[m] = Σ over MS of (MS.points × share[m] × (cap_extra ? extraUnit : regularUnit))
```

`total_points` の保存値は `regularPts + extraPts`。通常 MS の配分 pt 合計が変わっても、本契約 pt単価は動かない。

再計算結果は ① メトリクスカード 4 枚 (合計pt / 本契約 pt単価 / 別財布 pt単価 / 主要メンバー比較) ② 各 MS の pt 価値 ③ メンバー別 年計バー + 合計金額 ④ ヘッダの単価表示 にリアルタイムで反映する。

月次 override (`milestone_monthly_contribution_allocations.actual_share`) は読まない (= MS 設計を見る画面なので plannedShare × MS.points だけで計算)。

### フッターのボタン

- **↻ DB値に戻す** — 編集前の DB 値に戻す。`isDirty` のときだけ有効。
- **保存して DB へ反映** — 編集内容を確定。`isDirty` のときだけ有効。押下時の動作:
  1. `PUT /api/admin/ms-overview/{planCycleId}` を呼ぶ (body: `{ milestones: [...], deletedMilestoneIds: [...] }`)
  2. サーバ側は (a) 当該 plan_cycle 内の `value_milestones` を upsert / 無効化、(b) `milestone_responsibility` を保存値で置換、(c) `value_plan_cycles.total_points = 期間月数×10 + Σcap_extra points` に再計算、(d) `syncRewardSummariesForProject` で全月の `billing_cycles.reward_summary_json` を再計算 (PAID 月は内部で自動 skip) する
  3. 成功すると編集モード OFF へ戻り、`/api/admin/ms-overview` を再 fetch して最新値で再描画する
- **保存中の表示**: ボタンが「保存中…」、完了で `✓ 保存完了 → reward 再計算済` (緑) / 失敗で `保存失敗: {error}` (赤)

月次 override (`actual_share`) はここでは扱わない (= MS 設計画面なので plannedShare のみ)。

### 安全機構

- PUT route は payload の各 milestone が **本当に同じ plan_cycle に属するか** を `value_milestones.plan_cycle_id` 突合で検査し、他 PJ への巻き込み更新を防ぐ。
- `points < 0` や NaN は server で 400 で弾く。
- 期間は `YYYYMM` 形式、かつ `period_start_ym <= target_ym` でないと 400 で弾く。
- `syncRewardSummariesForProject` 内部で `reward_paid_at` / `payout_notice_uploaded_at` / `payment_confirmed_at` のある月は再計算対象から外れる (= 既に支払い済みの過去月を勝手に書き換えない)。

## なぜ「実消化」を読まないか

MS Overview は **設計値そのものを見せる画面** だから。実消化 (`milestone_monthly_progress.progress_pct`) を読むと:

- 期中はまだ消化が進んでいない MS が小さく見えてしまい、「pt 配分が小さい」と誤解する
- 「設計値 (= 期末に何 pt をどう配るつもりか)」と「現時点の進捗」が混ざって、判断軸が曖昧になる

→ 進捗を見る画面は cockpit / `/admin/payouts` / `/admin/season-pl` 側に既にあるので、ここは設計値専用とする。

---

## 関連

- 計算正本: [`pwa/src/lib/season-pl.ts`](../src/lib/season-pl.ts) の `computeSeasonPl`
- 報酬計算正本: [`pwa/manual/7-1-reward-calc-spec.md`](7-1-reward-calc-spec.md) (別財布章、plannedShare/actualShare の関係)
- 姉妹画面: [`pwa/manual/6-5-admin-payouts-reward-notice-spec.md`](6-5-admin-payouts-reward-notice-spec.md) §シーズン予実表 (= 実消化ベースの安全網)
- 設計セッション起点: `pwa/design_log/sessions_2026-06.md` 2026-06-20 ZMP MS 設計再考セッション
