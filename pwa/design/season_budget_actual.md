# シーズン予実表 (Season Budget vs Actual) — 設計正本

> **目的 (まさ 2026-06-19)**: 「そのシーズン(= plan cycle)で合計いくら入ってきて、内訳がどうなってて、差し引きいくらになるか」を**全PJで常時確認**できる予実表。シーズン頭に「予算」を確定し、毎月の入金・支払で「実績」が埋まる予実ビュー。`pt単価バグ`・`役員取りこぼし`・`未割当pt`・`cap/原資の不整合(ZMP)` のような歪みを、まさが不安なく一目で検知できる安全網にする。
>
> 起点: 2026-06-19 SX 愛媛大契約の旅費別請求不可 → pt単価是正 → 役員stock繰越是正の一連で、「入金と配分が閉じているか」を全PJで見える化する必要が判明。

---

## 1. 何を出すか (1 PJ × 1 plan cycle = 1 予実表)

### ① 収入 (Revenue)
| 行 | 予算 | 実績 | ソース |
|---|---|---|---|
| 請求額 (税抜・シーズン合計) | `feeAmount × cycleMonths` (monthly_fixed) or 契約 schedule 合計 | 入金確認済み合計 | `projects.fee_amount`/`contract_terms` / `billing_cycles.payment_confirmed_at` 済みの税抜額 |

### ② 配分 (Allocation) — 予算 vs 実消化
| 行 | 予算 | 実績 | 算定 |
|---|---|---|---|
| バッファ: 営業費用 | 確定値 | 回収済み | `(請求額 − バッファ)×65%` を超える先取り分。**内訳は plan cycle メタに持たせる (下記 §3)** |
| バッファ: 旅費 | 確定値 | 回収済み | 同上 |
| バッファ: その他 | 確定値 | 回収済み | 同上 |
| **メンバー原資 (PJ予算)** | `(請求額 − バッファ) × 65%` = `value_plan_cycles.budget_yen` | 実支払 + 会社留保確定の累計 | reward_summary 集計 |
| AMD マージン (35%) | `(請求額 − バッファ) × 35%` | — | 派生 |
| **合計 (= 請求額)** | バッファ + 原資 + マージン | | **閉じ検算**: 合計 == 請求額 を必ず表示 |

### ③ メンバー別 (pt比 予算 vs 実績)
| 列 | 予算 | 実績 |
|---|---|---|
| 獲得pt (シーズン累計) | 計画pt | 実績pt |
| pt比予算取り分 = `earnedPt × pt単価` | ✓ | — |
| 実支払 (非役員=現金 / 役員=会社留保) 累計 | — | ✓ |
| 今月末 繰越stock (= 未払い債務) | — | ✓ |
| 差 (実績 − 予算) | — | 収束チェック (最終的に 0 が正) |

役員(`is_officer`)は「会社留保」列、非役員は「現金支払」列で分ける (6-5章の支払通知書対象と同じ区分)。

### 検知したい歪み (この表の目的)
- **閉じない**: `バッファ + 原資 + マージン ≠ 請求額` → 設定ミス。
- **未割当pt**: `Σ(earnedPt) < total_points` → MS未設定 (SX 0.93pt の穴)。
- **原資 ≠ Σ月cap**: `value_plan_cycles.budget_yen ≠ Σ billing_cycles.budget_yen` → cap/原資の不整合 (ZMP で検出)。
- **pt単価過大**: `pt単価 ≠ (請求額−バッファ)×65% ÷ total_points` → バッファ未反映バグ。
- **役員取りこぼし**: 最終月で役員stockが0に収束しない → 役員繰越が効いてない。

---

## 2. データソース (既存・新規追加なしで作れる)
- `value_plan_cycles` (plan_cycle_id, project_id, status, period_start_ym, period_end_ym, total_points, budget_yen)
- `billing_cycles` (project_id, ym, status, budget_yen, budget_reported_amount, budget_buffer_amount, reward_summary_json, payment_confirmed_at)
- `projects` (fee_type, fee_amount, start_ym, end_ym)
- 計算は `src/lib/reward-summary.ts` の既存集計を流用 (各月 reward_summary_json の members[].{earnedPt, regularBasePay, totalPay, companyReserveYen, stockYen, payoutExcluded})。
- 請求額(税抜): monthly_fixed = `fee_amount × cycleMonths`。schedule_based は `contract_terms` の月別合計。
- pt単価: `budget_yen ÷ total_points` (= 既存 deriveRewardBudgetForPt/total_points)。

---

## 3. 唯一の新規データ: バッファ内訳
現状 `billing_cycles.budget_buffer_amount` は月次の数値のみで**内訳(営業/旅費/その他)を持たない**。予実表の②バッファ行を埋めるには内訳が要る。

**方針 (最小)**: `value_plan_cycles` に `buffer_breakdown_json jsonb` を追加。
```json
{ "items": [
  {"label":"営業費用(PJ獲得)","amount":800000},
  {"label":"旅費(10万×10ヶ月)","amount":1000000}
], "total": 1800000 }
```
- pt単価の原資は引き続き `value_plan_cycles.budget_yen = (請求額 − Σbuffer_breakdown) × 65%` (= 既存ロジックそのまま、人がこの値を入れる)。
- `buffer_breakdown_json` は**表示専用**(原資計算には `budget_yen` を使う)。内訳の合計と `(請求額×65% − budget_yen)/0.65` が一致するか検算列を出す。
- migration: `scripts/migrations/NNN_value_plan_cycle_buffer_breakdown.sql` で列追加 → `dump_schema.py` 再生成。

> 恒久案 (別タスク): バッファを第一級入力にし、`deriveRewardBudgetForPt` が `(請求額 − Σbuffer) × 65%` を自動計算する。そうすれば `budget_yen` 手入力が不要になる。今回は表示のみ追加で先行。

---

## 4. 画面配置
- **新規 admin ページ `/admin/season-pl`** (= 全PJ一覧 + PJ選択でシーズン予実表)。
- 入口: `/admin/payouts` と `/admin/billing` の近くにリンク (6-5/6-3章の admin 導線)。FEATURE_REGISTRY に登録。
- 一覧トップ: 全 active plan cycle を1行ずつ (PJ / 請求額 / バッファ / 原資 / pt単価 / 閉じ検算✓✗ / 未割当pt / 原資≠Σcap 警告)。
- 行クリック → そのシーズンの①②③フル予実表。
- 既存UIパターンは `/admin/payouts` (`AdminPayoutsClient.tsx` 等) を踏襲。

---

## 5. 実装ステップ (2026-06-19 実装完了 ✅)
1. ✅ migration `148_value_plan_cycle_buffer_breakdown.sql` で `value_plan_cycles.buffer_breakdown_json jsonb` 追加 + `dump_schema.py` 再生成。
2. ✅ 集計ロジック `src/lib/season-pl.ts` `computeSeasonPl` 純関数: plan cycle → {revenue, buffer items, member原資, AMDマージン, members[](pt比予実), 検算フラグ} を返す。`reward-summary.ts` の `buildRewardSummary` を cycle 全期間に集約 (cap + stock 繰越連鎖は内部で効く)。
3. ✅ API `GET /api/admin/season-pl` (`mode=list` 全 active cycle 一覧 / `?planCycleId=` で `mode=detail` 単一 cycle 詳細)。
4. ✅ ページ `/admin/season-pl` (一覧 + 詳細)。`AdminSeasonPlClient.tsx`。AdminSidebar に `シーズン予実` 導線。FEATURE_REGISTRY 登録 + `check_pwa_critical_ui.cjs` anchor。
5. ✅ SX `PC-p21-202604.buffer_breakdown_json` に {営業80万, 旅費100万} 投入済み。
6. ✅ build → deploy (v0.29.0)。

### 実装で確定した検算の定義 (設計時の文言を実データで修正)
- **未割当pt**: 設計の `Σ(earnedPt) < total_points` は期中だと必ず不足して誤検知するため、`total_points − Σ(MS points, goal_level≠monthly)` で判定する (= pt単価分母が MS で裏打ちされているか)。**SX で 120pt 設定 vs MS 119pt = 1pt 穴を実検出**。加えて担当者 share 合計 0 で points を持つ MS (宙吊り pt) も検出する。
- **収束差 (member delta)**: `(実支払 + 最終stock) − earnedPt×pt単価`。期中は支払が先行するので 0 にならないのが正常。最終月で 0 に収束するのが正。
- **実データ確認の発見 (要・別タスク監査)**:
  - SX: closes/原資=Σcap/pt単価/役員収束すべて ✅。未割当 1pt の穴のみ (要 MS 1pt 補完 or total_points を 119 に是正)。
  - ZMP: `原資≠Σ月cap` (Σcap 366万 > 原資 234万) + 役員stock非収束 (まさ stock 約4万残) + 未割当10pt。**設計が予言した ZMP cap/原資不整合をそのまま検出**。別財布(OkuDoor)cap が Σcap を押し上げている構造。
  - KUTE: `閉じない` + `pt単価不整合`。原資 720万 ≈ 請求額 720万 (= バッファ 0 だが (請求×65%) ではない)。budget_yen が (請求−バッファ)×65% の式から外れている設定異常。

---

## 6. 関連
- 報酬計算正本: [`manual/7-1-reward-calc-spec.md`](../manual/7-1-reward-calc-spec.md) (pt単価原資=(請求額−バッファ)×65% / 役員stock繰越)
- 請求: [`manual/6-3-invoice-and-billing-routine-spec.md`](../manual/6-3-invoice-and-billing-routine-spec.md)
- 支払/payouts: [`manual/6-5-admin-payouts-reward-notice-spec.md`](../manual/6-5-admin-payouts-reward-notice-spec.md)
- 起点の議論: 2026-06-19 SX 旅費別請求不可 → pt単価是正 → 役員繰越是正 (本セッション handoff)

## Changelog
| 日付 | 変更 | 誰 |
|---|---|---|
| 2026-06-19 | 初版。SX一連の議論から予実表を設計正本化。データソース・バッファ内訳列・画面配置・実装ステップを確定 | えいみ |
| 2026-06-19 | §5 実装完了 (v0.29.0)。migration 148 + `season-pl.ts` + `/admin/season-pl` + API + FEATURE_REGISTRY + critical-ui anchor。未割当pt 検算を `total_points − Σ(MS points)` に修正。SX 1pt 穴 / ZMP cap-原資不整合 / KUTE 非閉じ を実検出 (別タスク監査へ) | えいみ |
