-- Versioned assumptions and cash-budget scenarios attached to source monthly rows.
-- Existing P/L and other projects remain unchanged. The existing monthly-row RLS applies.
ALTER TABLE public.project_monthly_cashflow
  ADD COLUMN IF NOT EXISTS planning_details_json jsonb;
COMMENT ON COLUMN public.project_monthly_cashflow.planning_details_json IS
  'Source-authored funding plan: version, scenarios, and first-month summary. Amounts are yen; no implied grant approval or financing execution. Kept separate from accrual PL.';
NOTIFY pgrst, 'reload schema';
