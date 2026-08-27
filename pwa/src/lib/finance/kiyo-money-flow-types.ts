/**
 * きよ「00 お金の流れ」タブの型定義 (server / client 共有)。
 * server 側の実装は kiyo-money-flow.ts ("server-only")、ここは型だけなので
 * クライアントコンポーネントから直接 import してよい。
 */

export type KiyoMoneyFlowPeriod = "month" | "season" | "all";

/** 口座には動きがあるのに内訳へ結び付けられていない分を表す擬似PJのID */
export const UNCLASSIFIED_PROJECT_ID = "__unclassified__";

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
  /** 口座には入っているが、OS側で入金確認が済んでおらず、どのPJか特定できていない分 */
  unclassified?: boolean;
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

/** 口座から出ているのに内訳へ分類できていない分の、既知の理由 */
export type KiyoMoneyFlowGapRow = { label: string; detail: string };

export type KiyoMoneyFlowOutflowCategory =
  | { key: "member_reward"; label: string; totalYen: number; rows: KiyoMoneyFlowMemberRow[]; note: string }
  | { key: "executive_pay"; label: string; totalYen: number; rows: KiyoMoneyFlowMonthlyRow[]; note: string }
  | { key: "social_insurance_tax"; label: string; totalYen: number; rows: KiyoMoneyFlowObligationRow[]; note: string }
  | { key: "opex"; label: string; totalYen: number; rows: KiyoMoneyFlowOpexRow[]; note: string }
  | { key: "unclassified"; label: string; totalYen: number; rows: KiyoMoneyFlowGapRow[]; note: string };

export type KiyoMoneyFlowResult = {
  range: KiyoMoneyFlowRange;
  wallet: {
    balanceYen: number | null;
    balanceYm: string | null;
    /** 口座の実際の増減 (anchoredToBank=true のとき)。false のときは内訳で拾えている分の差 */
    netChangeYen: number;
    /**
     * true = 期間内の全経過月でfreee取引履歴の集計が揃っており、入り/出の合計を
     * 口座の実際の動きに一致させている (差額は「まだ分類できていない」へ入る)。
     * false = 突き合わせできる月が足りないので、内訳で拾えている分だけの合計。
     */
    anchoredToBank: boolean;
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
