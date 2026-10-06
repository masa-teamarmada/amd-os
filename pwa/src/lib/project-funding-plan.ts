/** Source-authored cash budgets. They are independent of accrual P/L and historical financing. */
export interface FundingScenarioMonth {
  key: string; label: string; openingYen: number; ordinarySpendYen: number;
  equipmentSpendYen: number; interestYen: number; seedInflowYen: number;
  bridgeInflowYen: number; loanDrawdownYen: number; grantReceiptYen: number;
  loanRepaymentYen: number; loanBalanceYen: number; peakLoanYen: number;
  roundingYen: number; netCashFlowYen: number; closingYen: number;
  /** 現金予算の売上代金。発生主義の売上とは分ける。旧計画では未指定=0。 */
  salesReceiptYen?: number;
}
export interface FundingPlanSummary {
  version: string; asOf: string; startYm: string; endYm: string; nextRoundYm: string;
  nextRoundAmountYen: number | null; seedAmountYen: number; postMoneyCapYen: number;
  discount: number; conversionTriggerYen: number; reserveYen: number;
  improvementTargetYen: number; bridgeEnvelopeYen: number; loanFacilityTargetYen: number;
  assumptions: string[]; bridgePolicy: string[];
  cases: Array<{key: string; description: string}>;
  monthlyCosts: Array<{label: string; amountYen: number; status: string}>;
  equipment: Array<{label: string; amountYen: number; orderYm: string; deliveryYm: string; note: string}>;
  source: {workbookSha256: string; adoptedMaterial: string; cutoff: string};
}
export interface FundingPlanningDetails {
  version: string; scenarios: FundingScenarioMonth[]; summary: FundingPlanSummary | null;
}
export interface FundingPlanMonth {ym: string; planning_details_json: FundingPlanningDetails}
export interface FundingPlan {summary: FundingPlanSummary; months: FundingPlanMonth[]}

export function resolveFundingPlan(rows: Array<{ym: string; planning_details_json?: FundingPlanningDetails | null}>): FundingPlan | null {
  const withSummary = rows.filter(r => r.planning_details_json?.summary)
    .sort((a,b) => (b.planning_details_json!.summary!.asOf).localeCompare(a.planning_details_json!.summary!.asOf));
  if (!withSummary.length) return null;
  const summary = withSummary[0].planning_details_json!.summary!;
  const months = rows.filter((r): r is FundingPlanMonth => Boolean(r.planning_details_json?.version === summary.version && r.ym >= summary.startYm && r.ym <= summary.endYm))
    .sort((a,b) => a.ym.localeCompare(b.ym));
  const [sy,sm] = summary.startYm.split('-').map(Number), [ey,em] = summary.endYm.split('-').map(Number);
  if (months.length !== (ey-sy)*12+em-sm+1) throw new Error('資金計画の月数が不足している');
  const keys = summary.cases.map(s => s.key);
  if (!keys.includes('adopted') || new Set(keys).size !== keys.length) throw new Error('資金計画のケース定義が不正');
  months.forEach((m,i) => {
    const expected = new Date(Date.UTC(sy,sm-1+i,1)).toISOString().slice(0,7);
    if (m.ym !== expected) throw new Error('資金計画の月が連続していない');
    for (const key of keys) {
      const s=m.planning_details_json.scenarios.find(x => x.key===key);
      if (!s) throw new Error('資金計画のケースが不足している');
      if (m.planning_details_json.scenarios.length !== keys.length || Object.entries(s).some(([k,v]) => !['key','label'].includes(k) && !Number.isSafeInteger(v))) throw new Error('資金計画の数値・ケース数が不正');
      const priorLoan = i ? months[i-1].planning_details_json.scenarios.find(x=>x.key===key)!.loanBalanceYen : 0;
      if (Math.abs(priorLoan+s.loanDrawdownYen-s.loanRepaymentYen-s.loanBalanceYen)>1) throw new Error('資金計画の借入残高が一致しない');
      if (s.salesReceiptYen !== undefined && s.salesReceiptYen < 0) throw new Error('資金計画の売上入金が不正');
      const net=s.seedInflowYen+s.bridgeInflowYen+s.loanDrawdownYen+s.grantReceiptYen+(s.salesReceiptYen ?? 0)-s.loanRepaymentYen-s.ordinarySpendYen-s.equipmentSpendYen-s.interestYen+s.roundingYen;
      if (net!==s.netCashFlowYen || s.openingYen+net!==s.closingYen) throw new Error('資金計画の入出金と残高が一致しない');
      if (i && months[i-1].planning_details_json.scenarios.find(x=>x.key===key)!.closingYen!==s.openingYen) throw new Error('前月と当月の残高がつながっていない');
    }
  });
  return {summary,months};
}
