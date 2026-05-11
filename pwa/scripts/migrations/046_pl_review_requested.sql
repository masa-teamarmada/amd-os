-- 046_pl_review_requested.sql
--
-- 月次報告書の「PL確認依頼」と「PL確定」を分離する。
--
-- 旧仕様 (バグ): PM が「PLに確認依頼する」を押した瞬間に
--   billing_cycles.report_fixed_at = NOW() を更新 → Slack 通知から開いたら既に「確定済」表示
-- 新仕様 (まさ要望 2026-05-11):
--   1. PM が「PL確認依頼」 → monthly_reports.pl_review_requested_at セット + Slack 通知
--      (billing_cycles.report_fixed_at は更新しない)
--   2. PL が Slack リンクから開く → 「PL として確定する」ボタンが見える
--   3. PL が「確定」を押す → 初めて billing_cycles.report_fixed_at = NOW() + report_confirmed_by 記録

ALTER TABLE monthly_reports
  ADD COLUMN IF NOT EXISTS pl_review_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pl_review_requested_by TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_by TEXT;

COMMENT ON COLUMN monthly_reports.pl_review_requested_at IS
  'PM が PL に確認依頼を出した時刻。Slack 通知発火と同時にセット。billing_cycles.report_fixed_at とは別物 (= 確定はまだ)';
COMMENT ON COLUMN monthly_reports.confirmed_by IS
  '実際にレポートを確定した PL の email (もしくは admin)。billing_cycles.report_fixed_at と同時にセット';
