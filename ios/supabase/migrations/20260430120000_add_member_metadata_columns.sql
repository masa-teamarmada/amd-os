-- メンバー詳細管理用カラムを追加
--   exclude_from_payout_notice: 支払通知書送付対象から除外する（役員報酬・無償出向など）
--   joined_at / left_at:        AMD 参加・離脱日（メンバーリスト表示用）
--   slack_plan / google_plan:   有償/無償プラン（"paid" | "free" | NULL）

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS exclude_from_payout_notice BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS joined_at  DATE,
  ADD COLUMN IF NOT EXISTS left_at    DATE,
  ADD COLUMN IF NOT EXISTS slack_plan TEXT,
  ADD COLUMN IF NOT EXISTS google_plan TEXT;
