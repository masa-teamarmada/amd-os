-- Expand company budget input kinds for payment obligations and cash outflows.
ALTER TABLE company_budget_inputs
  DROP CONSTRAINT IF EXISTS company_budget_inputs_input_kind_check;

ALTER TABLE company_budget_inputs
  ADD CONSTRAINT company_budget_inputs_input_kind_check
  CHECK (input_kind IN (
    'params',
    'project',
    'project_revenue',
    'fixed_cost',
    'var_cost',
    'loan',
    'spot',
    'scenario',
    'payment_obligation',
    'cash_outflow'
  ));
