-- members に支払通知書生成で使う個人情報カラムを追加
-- GAS DB_Members の memberName / memberAddress / bankInfo に相当

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS member_name    TEXT,
  ADD COLUMN IF NOT EXISTS member_address TEXT,
  ADD COLUMN IF NOT EXISTS bank_info      TEXT;
