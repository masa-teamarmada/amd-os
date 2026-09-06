-- Source-backed monthly cash-flow categories. Nullable for existing board-report rows.
ALTER TABLE public.project_monthly_cashflow
  ADD COLUMN IF NOT EXISTS operating_cash_flow_yen BIGINT,
  ADD COLUMN IF NOT EXISTS investing_cash_flow_yen BIGINT,
  ADD COLUMN IF NOT EXISTS equity_funding_yen BIGINT,
  ADD COLUMN IF NOT EXISTS grant_receipt_yen BIGINT;
COMMENT ON COLUMN public.project_monthly_cashflow.operating_cash_flow_yen IS 'Source operating cash flow, including non-cash and working-capital adjustments; not operating profit.';
COMMENT ON COLUMN public.project_monthly_cashflow.investing_cash_flow_yen IS 'Signed source investing cash flow; equipment purchases are negative.';
NOTIFY pgrst, 'reload schema';
