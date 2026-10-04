import type { FinanceCashSourceRow } from "./project-finance-format";
import type { ProjectPlMonthly } from "./venture-status-data";
import type { Bzm22PilotProject } from "./bzm-2-2-pilot-ui";
import type { FinanceGrantEvidence } from "@/components/cockpit/finance-format-client";
export type ProjectFinancePageData = {
  plRows: ProjectPlMonthly[];
  cashRows: FinanceCashSourceRow[];
  capitalPlan: unknown | null;
  grants: FinanceGrantEvidence[];
  pilot: Bzm22PilotProject | null;
  foundedAt: string | null;
};
export const FINANCE_CASHFLOW_COLUMNS = [
  "ym",
  "source_status",
  "operating_cash_flow_yen",
  "investing_cash_flow_yen",
  "equity_funding_yen",
  "grant_receipt_yen",
  "cash_inflow_yen",
  "sbir_payment_yen",
  "nedo_payment_yen",
  "working_capital_payment_yen",
  "free_cash_flow_yen",
  "financing_cash_flow_yen",
  "net_cash_flow_yen",
  "opening_cash_yen",
  "closing_cash_yen",
  "sbir_account_balance_yen",
  "working_capital_balance_yen",
  "bank_borrowing_balance_yen",
  "source_note",
  "planning_details_json",
].join(", ");

