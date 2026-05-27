-- 096_payout_notices_last_generated_at.sql
-- 支払通知書PDFの最終生成時刻を保持する。
-- /api/cron/payout-notice-prebuild が毎日深夜に先回り生成する際の差分検出と、
-- /admin/payouts の各メンバー行に「N分前に生成」を表示するために使う。
--
-- 仕様: pwa/manual/31-admin-payouts-reward-notice-spec.md
--   先回り生成セクション (= 2026-05-27 追加)

ALTER TABLE public.payout_notices
  ADD COLUMN IF NOT EXISTS last_generated_at timestamptz;

COMMENT ON COLUMN public.payout_notices.last_generated_at IS
  '支払通知書PDFの最終生成時刻。cron payout-notice-prebuild および admin/payouts の一括発行/確認時に更新される。pdf_url が NULL の場合は NULL。差分検出 (pdf_url 有り + total_yen 一致 → 再生成スキップ) のヒントにも使う。';
