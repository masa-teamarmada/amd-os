# 6-8. Admin / MS Overview (全PJ MS設計 一望)

`/admin/ms-overview` は AMD OS が抱える全 active シーズン (plan cycle) の MS (Milestone) 設計を 1 画面で並べて、「pt 配分が他 MS と比べて妥当か」「メンバー間の担当量がおかしくないか」をまさが目で判断するための **設計レビュー画面**。

シーズン予実表 (`/admin/season-pl`) が「請求・原資・支払いが閉じているか」の **安全網** なのに対し、こちらは MS 設計そのものの **歪み検知**。実消化 (`milestone_monthly_progress`) と支払額は読まず、`plannedShare` ベースの pt 配分だけを並べる。

---

## 開く場面

- 新規シーズンの MS 設計をレビュー / 編集する
- メンバーから「自分の担当量が他のメンバーと比べておかしくないか」と相談された
- まさ自身が「あびと しんで序列がおかしくなってないか」を一望したい
- 別財布 (cap_extra) を入れた PJ で「本契約と別財布の pt 配分が混ざっていないか」をまとめて確認したい

MS 設計値の書き換え口はこの画面に集約する。cockpit は MS の表示と月次進捗確認に専念し、MS 本体・期間・pt・tag・担当 share の編集は `/admin/ms-overview` の編集モードで行う。

---

## 画面構造

全 active plan cycle (`value_plan_cycles.status in (active, confirmed, fixed, draft)`) を `budget_yen` 降順に並べたアコーディオン。各 PJ ブロックは初期は折りたたみ、先頭 PJ だけ開いた状態でロードする。

PJ ブロックを開くと以下の 4 ブロックが縦に並ぶ:

### ① メトリクスカード 4 枚

| カード | 値 | 補助情報 |
|---|---|---|
| 合計pt | `total_points` | 本契約 / 別財布 の pt 内訳 |
| 本契約pt | `regularPoints` | 通常 MS の割当pt / 残り割り振り可能pt |
| 別財布pt | `extraPoints` (無ければ `—`) | cap_extra MS の pt 合計 |
| 主要メンバー比較 | pt配分上位 2 名の totalPt | 比 (倍率) |

### ② 全MS (pt順)

MS を `pt` 降順で並べ、各行に以下を出す:

- **MS 名 / 期間 (`period_start_ym` – `target_ym`) / tag** — tag は色付きで表示 (cap_extra 系は `cap_extra` と固定表示)
- **pt** — `value_milestones.points`
- **横バー** — `points` の最大値に対する比率で幅を取る
  - normal (本契約): `#1D9E75`
  - routine: `#888780`
  - cap_extra (別財布): `#7F77DD`
- **担当 share** — `milestone_responsibility` の share 降順、`codeName share%` 形式。担当未設定は赤字で警告。

### ③ メンバー別 pt配分 (plannedShare)

active メンバー (`project_members.is_active=true`) について、シーズン全期間の担当 pt を `totalPt` 降順で出す:

- 1 本の横バーに **本契約 (濃い緑 `#1D9E75`) + 別財布 (淡い紫 `#7F77DD`, 不透明度 0.65)** を積み上げ
- 右に合計 pt。別財布が乗っている人は `(本 xxpt 別 yypt)` の内訳もインライン表示
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

**最重要原則: `/admin/ms-overview` では支払額に見える円換算を作らない**。この画面は MS 設計レビュー専用なので、扱うのは pt と share だけ。実際の支払額は `reward-summary.ts` / `/admin/season-pl` / `/admin/payouts` 側を正本にする。別ロジックで「似たような年間支払額」を出すと、実支払額と数百円単位でズレて事故るため廃止する (= 2026-07-01 確定方針)。

route の流れ:

1. `value_plan_cycles` を active ステータス絞りで全件 load
2. 各 plan cycle について、シーズン期間から `regularPoints = 月数 × 10pt` を出す
3. `value_milestones.is_active=true` かつ `goal_level ≠ monthly` を pt 順に並べる
4. `cap_extra` 系 MS は MS 期間月数×10ptを effective points とし、`extraPoints` に積む
5. メンバー別配分は `Σ (effectivePoints × share)` を tag で regular / extra pt に振り分ける

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

pt / tag / share を動かすたびに、API を叩かず **JS 側で即座に再計算** する。算定式は `src/lib/admin/ms-overview-calc.ts` の `recomputeMsOverview`。支払額に見える円換算は行わず、編集画面内の判断材料は pt だけにする:

```text
regularPts   = シーズン期間の月数 × 10pt
extraPts     = Σ(cap_extra MS の期間月数 × 10pt)
memberPt[m]  = Σ over MS of (effectivePoints × share[m])
```

`total_points` の保存値は `regularPts + extraPts`。`cap_extra` の pt は保存時にも API 側で MS 期間×10ptへ正規化する。

編集モードでは、MS 一覧の先頭に **全MS pt配分スライダー** を置く。これは MS 名 / pt数値入力 / スライダー / 現在pt を並べた配分専用パネルで、全 MS の pt 重みを比較しながら調整するための入口。各編集カード内にも pt 数値入力 + pt配分スライダーを残し、どちらを動かしても同じ編集中 state を更新する。通常 MS のスライダー範囲は編集開始時点の最大 pt × 1.5 を右端に固定し、ドラッグ中に max を変えない (= 1px あたりの pt 幅を一定に保つ)。`cap_extra` は MS 期間の月数×10pt固定なので、まとめパネル・個別カードの両方で disabled 表示にする。

編集カードは左に MS 基本情報 (MS名 / pt数値入力 / pt配分スライダー / tag / 期間 / 完了条件)、右に担当 share 表を置く。担当 share 表は **メンバー1人=1行** で、横方向に `メンバー / share / 役割 / 担当pt / 担当タスク` を並べる。2カラムに分割しない。

通常 MS の pt を動かすと、編集画面上部と全MS見出しに **残り割り振り可能pt** をリアルタイム表示する。算定式は `regularPointBasis - Σ(non-cap_extra MS effectivePoints)`。配分超過時は負数として赤系で表示する。`cap_extra` は MS期間×10pt固定の別財布なので、この残り枠には混ぜない。

再計算結果は ① メトリクスカード 4 枚 (合計pt / 本契約pt / 別財布pt / 主要メンバー比較) ② 各 MS の pt 比 ③ 担当 share 行の **担当pt** (`effectivePoints × share`) ④ メンバー別 pt 配分バー ⑤ ヘッダの pt 表示 にリアルタイムで反映する。

月次 override (`milestone_monthly_contribution_allocations.actual_share`) は読まない (= MS 設計を見る画面なので plannedShare × MS.points だけで計算)。

### 保存導線

編集モード ON の直後、MS 一覧の上部に **保存バー** を表示する。長い MS 一覧でも保存場所が迷子にならないよう、同じ操作をフッターにも重複配置する。

- **未保存あり / 変更なし / 保存中** — 編集状態を表示。
- **保存先 DB / reward 再計算** — 保存時に `value_milestones` / `milestone_responsibility` と reward cache まで反映されることを表示。
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

- MS Overview pt計算: [`pwa/src/lib/admin/ms-overview-calc.ts`](../src/lib/admin/ms-overview-calc.ts) の `recomputeMsOverview`
- 報酬計算正本: [`pwa/manual/7-1-reward-calc-spec.md`](7-1-reward-calc-spec.md) (別財布章、plannedShare/actualShare の関係)。支払額の円計算はここから派生する reward cache / payout 側だけで扱う。
- 姉妹画面: [`pwa/manual/6-5-admin-payouts-reward-notice-spec.md`](6-5-admin-payouts-reward-notice-spec.md) §シーズン予実表 (= 実消化ベースの安全網)
- 設計セッション起点: `pwa/design_log/sessions_2026-06.md` 2026-06-20 ZMP MS 設計再考セッション
