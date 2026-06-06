-- 121_prs_primary_inputs.sql
--
-- PRS primary model input storage.
--
-- Add nullable review fields to amd_score_inputs so PRS can be the visible primary model
-- without silently falling back to legacy AMD/MXF. NULL means "review pending", not zero.

ALTER TABLE public.amd_score_inputs
  ADD COLUMN IF NOT EXISTS prs_potential REAL,
  ADD COLUMN IF NOT EXISTS prs_r_net REAL;

COMMENT ON COLUMN public.amd_score_inputs.prs_potential IS
  'PRS primary input P (Potential / target success ceiling, 0-9). NULL = review pending.';

COMMENT ON COLUMN public.amd_score_inputs.prs_r_net IS
  'PRS primary input R_net (gross margin - operating cost - main-project resource damage, 0-9). NULL = review pending.';
