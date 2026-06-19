-- 148_value_plan_cycle_buffer_breakdown.sql
-- シーズン予実表 (/admin/season-pl) のバッファ内訳表示用。
--
-- 背景: pt 単価の原資は `value_plan_cycles.budget_yen = (請求額 − Σバッファ) × 65%`。
-- バッファ (営業費用・旅費等、AMD が請求額から先取りする PJ コスト枠) は pt 単価計算に
-- 反映済みだが、現状 `billing_cycles.budget_buffer_amount` は月次の数値のみで内訳
-- (営業/旅費/その他) を持たない。シーズン予実表の②バッファ行を埋めるには内訳が要る。
--
-- 方針 (最小): plan cycle メタに表示専用の内訳を持たせる。原資計算には引き続き
-- `budget_yen` を使う (この列は表示専用 + 検算用)。内訳合計と
-- `(請求額×65% − budget_yen)/0.65` が一致するか検算列を予実表で出す。
--
-- 形式 (jsonb):
--   {
--     "items": [
--       {"label": "営業費用(PJ獲得)", "amount": 800000},
--       {"label": "旅費(10万×10ヶ月)", "amount": 1000000}
--     ],
--     "total": 1800000
--   }
-- null = 内訳未設定 (= バッファ合計は budget_yen から逆算した値で表示)。非破壊追加。
--
-- 恒久案 (別タスク): バッファを第一級入力にし deriveRewardBudgetForPt が
-- (請求額 − Σバッファ)×65% を自動計算する。今回は表示のみ先行。
-- 設計正本: pwa/design/season_budget_actual.md §3。

ALTER TABLE value_plan_cycles
  ADD COLUMN IF NOT EXISTS buffer_breakdown_json jsonb;

COMMENT ON COLUMN value_plan_cycles.buffer_breakdown_json IS
  'シーズン予実表のバッファ内訳 {items:[{label,amount}], total}。営業費用・旅費等の AMD 先取り PJ コスト枠の内訳。表示専用 + 検算用 (pt 単価原資は budget_yen を使う)。null=未設定。設計正本 pwa/design/season_budget_actual.md §3。';
