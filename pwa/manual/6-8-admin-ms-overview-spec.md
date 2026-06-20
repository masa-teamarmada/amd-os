# 6-8. Admin / MS Overview (全PJ MS設計 一望)

`/admin/ms-overview` は AMD OS が抱える全 active シーズン (plan cycle) の MS (Milestone) 設計を 1 画面で並べて、「pt 配分が他 MS と比べて妥当か」「メンバー間の序列がおかしくないか」をまさが目で判断するための **設計レビュー画面**。

シーズン予実表 (`/admin/season-pl`) が「請求・原資・支払いが閉じているか」の **安全網** なのに対し、こちらは MS 設計そのものの **歪み検知**。実消化 (`milestone_monthly_progress`) は読まず、`plannedShare` ベースの理論値だけを並べる。

---

## 開く場面

- 新規シーズンの MS 設計をレビューする (= cockpit で MS を切ったあと、他 PJ と並べて pt 配分の妥当性を見たい)
- メンバーから「自分の年計が他のメンバーと比べておかしくないか」と相談された
- まさ自身が「あびと しんで序列がおかしくなってないか」を一望したい
- 別財布 (cap_extra) を入れた PJ で「本契約と別財布で pt 単価が正しく分離されているか」をまとめて確認したい

書き換え目的では使わない (= 閲覧専用)。設計値の変更は cockpit の MS 編集 / `/admin/projects/:id` 経由で行う。

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

### ④ tag 凡例

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
      "totalPoints": 200,
      "regularPoints": 133,
      "extraPoints": 67,
      "regularPtUnitYen": 22556,
      "extraPtUnitYen": 14925,
      "extraPoolBudgetYen": 1000000,
      "milestones": [
        {
          "milestoneId": "...",
          "title": "ファシリテーション",
          "points": 20,
          "tag": "normal",
          "isCapExtra": false,
          "ptValueYen": 451128,
          "responsibilities": [{ "memberId": "ID002", "codeName": "あび", "share": 1 }]
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
