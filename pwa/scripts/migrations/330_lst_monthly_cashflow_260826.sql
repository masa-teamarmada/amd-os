-- LiSTie 2026年8月取締役会資料 p.14 の月次資金繰り。
-- P/L（project_pl_monthly）と資金の入出金・残高を混ぜない。
CREATE TABLE IF NOT EXISTS project_monthly_cashflow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  ym TEXT NOT NULL,
  source_status TEXT NOT NULL CHECK (source_status IN ('actual', 'forecast', 'estimated')),
  cash_inflow_yen BIGINT NOT NULL DEFAULT 0,
  sbir_payment_yen BIGINT NOT NULL DEFAULT 0,
  nedo_payment_yen BIGINT NOT NULL DEFAULT 0,
  working_capital_payment_yen BIGINT NOT NULL DEFAULT 0,
  free_cash_flow_yen BIGINT NOT NULL DEFAULT 0,
  financing_cash_flow_yen BIGINT NOT NULL DEFAULT 0,
  net_cash_flow_yen BIGINT NOT NULL DEFAULT 0,
  opening_cash_yen BIGINT,
  closing_cash_yen BIGINT,
  sbir_account_balance_yen BIGINT,
  working_capital_balance_yen BIGINT,
  bank_borrowing_balance_yen BIGINT,
  source_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, ym)
);
CREATE INDEX IF NOT EXISTS idx_project_monthly_cashflow_project_ym ON project_monthly_cashflow(project_id, ym);
ALTER TABLE project_monthly_cashflow ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read ON project_monthly_cashflow;
CREATE POLICY anon_read ON project_monthly_cashflow FOR SELECT USING (true);
DROP POLICY IF EXISTS admin_all ON project_monthly_cashflow;
CREATE POLICY admin_all ON project_monthly_cashflow FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS service_role_bypass ON project_monthly_cashflow;
CREATE POLICY service_role_bypass ON project_monthly_cashflow FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

INSERT INTO project_monthly_cashflow (
  project_id, ym, source_status, cash_inflow_yen, sbir_payment_yen, nedo_payment_yen, working_capital_payment_yen,
  free_cash_flow_yen, financing_cash_flow_yen, net_cash_flow_yen, opening_cash_yen, closing_cash_yen,
  sbir_account_balance_yen, working_capital_balance_yen, bank_borrowing_balance_yen, source_note
) VALUES
  ('p07','2026-04','actual',495000,-19241000,-1827000,-5865000,-26438000,93805000,67367000,46081000,113448000,18307000,95141000,837097000,'2026年8月取締役会資料 p.14。実績。'),
  ('p07','2026-05','actual',26025000,-22922000,-1586000,-6410000,-4892000,0,-4892000,113448000,108556000,15961000,91370000,811072000,'2026年8月取締役会資料 p.14。実績。'),
  ('p07','2026-06','actual',132226000,-40598000,-3346000,-10511000,77772000,-83298000,-5527000,108556000,103029000,17186000,87068000,711533000,'2026年8月取締役会資料 p.14。実績。'),
  ('p07','2026-07','actual',0,-17088000,-2771000,-8797000,-28656000,149864000,121208000,103029000,224238000,3000000,224205000,711533000,'2026年8月取締役会資料 p.14。実績。J-KISS 150mは着金済み。'),
  ('p07','2026-08','forecast',33146000,-97396000,-1823000,-19109000,-85182000,0,-85182000,224238000,139055000,2636000,136419000,711533000,'2026年8月取締役会資料 p.14。見込。'),
  ('p07','2026-09','forecast',82760000,-39387000,-3807000,-43244000,-3677000,-14000000,-17677000,139055000,121378000,32010000,89368000,628773000,'2026年8月取締役会資料 p.14。見込。'),
  ('p07','2026-10','forecast',50000000,-70387000,-4807000,-13444000,-38638000,49275000,10638000,121378000,132015000,60898000,71117000,628773000,'2026年8月取締役会資料 p.14。見込。'),
  ('p07','2026-11','forecast',6958000,-34013000,-3940000,-9359000,-40355000,30000000,-10355000,132015000,121660000,56885000,64775000,628773000,'2026年8月取締役会資料 p.14。見込。'),
  ('p07','2026-12','forecast',83871000,-89013000,-17370000,-22105000,-44617000,50000000,5383000,121660000,127043000,101743000,25300000,544902000,'2026年8月取締役会資料 p.14。見込。'),
  ('p07','2027-01','forecast',50000000,-75063000,-9370000,-14080000,-48513000,73894000,25381000,127043000,152424000,130573000,21851000,544902000,'2026年8月取締役会資料 p.14。見込。'),
  ('p07','2027-02','forecast',20453000,-91113000,-3337000,-15082000,-89078000,45000000,-44078000,152424000,108346000,69460000,38886000,544902000,'2026年8月取締役会資料 p.14。見込。'),
  ('p07','2027-03','forecast',140413000,-106113000,-3337000,-16582000,14382000,-24000000,-9618000,108346000,98727000,69760000,28968000,404489000,'2026年8月取締役会資料 p.14。見込。')
ON CONFLICT (project_id, ym) DO UPDATE SET
  source_status = EXCLUDED.source_status, cash_inflow_yen = EXCLUDED.cash_inflow_yen, sbir_payment_yen = EXCLUDED.sbir_payment_yen,
  nedo_payment_yen = EXCLUDED.nedo_payment_yen, working_capital_payment_yen = EXCLUDED.working_capital_payment_yen,
  free_cash_flow_yen = EXCLUDED.free_cash_flow_yen, financing_cash_flow_yen = EXCLUDED.financing_cash_flow_yen,
  net_cash_flow_yen = EXCLUDED.net_cash_flow_yen, opening_cash_yen = EXCLUDED.opening_cash_yen, closing_cash_yen = EXCLUDED.closing_cash_yen,
  sbir_account_balance_yen = EXCLUDED.sbir_account_balance_yen, working_capital_balance_yen = EXCLUDED.working_capital_balance_yen,
  bank_borrowing_balance_yen = EXCLUDED.bank_borrowing_balance_yen, source_note = EXCLUDED.source_note, updated_at = NOW();
