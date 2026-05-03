-- Add note column to milestone_monthly_progress
-- Stores the LLM reason for progress estimation (from tsukuyomi_estimate)
ALTER TABLE milestone_monthly_progress
  ADD COLUMN IF NOT EXISTS note TEXT;
