// ⚠️ pwa/src/components/admin/kiyo-money-flow/ からのコピー。正本は pwa 側。
// これは「見せ方」だけの部品で、金額の計算は一切していない（数字は本体のAPIが返した値）。
// なのでズレても金額事故にはならないが、図の見た目が本体と食い違う。
// 本体側を直したらここも同じ内容にする。独自の見た目をここで足さないこと。

/**
 * きよ「00 お金の流れ」タブの型定義 (server / client 共有)。
 * server 側の実装は kiyo-money-flow.ts ("server-only")、ここは型だけなので
 * クライアントコンポーネントから直接 import してよい。
 */

export type KiyoMoneyFlowPeriod = "month" | "season" | "all";

export type KiyoMoneyFlowRange = {
  kind: KiyoMoneyFlowPeriod;
  label: string;
  startYm: string | null;
  endYm: string | null;
  seasonSource: "amd_plan_cycle" | "fallback_month" | null;
};

export type KiyoMoneyFlowInflowMonth = {
  /** 請求の対象月 (billing_cycles.ym)。UIは「◯年◯月分」と表示する。期間の絞り込みは入金確認月で別途行う */
  ym: string;
  amountYen: number;
  kind: "contract" | "extra";
  confirmedAt: string | null;
};

export type KiyoMoneyFlowInflowProject = {
  projectId: string;
  projectName: string;
  clientName: string | null;
  contractYen: number;
  extraYen: number;
  totalYen: number;
  months: KiyoMoneyFlowInflowMonth[];
};

export type KiyoMoneyFlowMemberRow = {
  memberId: string;
  memberName: string;
  amountYen: number;
  projectBreakdown: Array<{ projectId: string; projectName: string; ym: string; totalPayYen: number }>;
};

export type KiyoMoneyFlowMonthlyRow = { ym: string; amountYen: number };

export type KiyoMoneyFlowObligationRow = { title: string; date: string | null; amountYen: number; source: "obligation" | "tax_fixed_cost" };

export type KiyoMoneyFlowOpexRow = { accountName: string; amountYen: number };

export type KiyoMoneyFlowLoanRow = { vendorName: string; monthlyAmountYen: number; monthsCounted: number; amountYen: number };

export type KiyoMoneyFlowOutflowCategory =
  | { key: "member_reward"; label: string; totalYen: number; rows: KiyoMoneyFlowMemberRow[]; note: string }
  | { key: "executive_pay"; label: string; totalYen: number; rows: KiyoMoneyFlowMonthlyRow[]; note: string }
  | { key: "social_insurance_tax"; label: string; totalYen: number; rows: KiyoMoneyFlowObligationRow[]; note: string }
  | { key: "opex"; label: string; totalYen: number; rows: KiyoMoneyFlowOpexRow[]; note: string }
  | { key: "loan_payment"; label: string; totalYen: number; rows: KiyoMoneyFlowLoanRow[]; note: string };

export type KiyoMoneyFlowResult = {
  range: KiyoMoneyFlowRange;
  wallet: {
    balanceYen: number | null;
    balanceYm: string | null;
    netChangeYen: number;
    loanRemainingYen: number | null;
  };
  inflow: { totalYen: number; byProject: KiyoMoneyFlowInflowProject[] };
  outflow: { totalYen: number; categories: KiyoMoneyFlowOutflowCategory[] };
  summaryText: string;
  note: string;
  warnings: string[];
  computedAtIso: string;
};

export type KiyoMoneyFlowResponse = { ok: true } & KiyoMoneyFlowResult | { ok: false; error: string };
