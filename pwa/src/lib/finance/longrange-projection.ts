/**
 * 長期戦略試算表 (FY2026–FY2035) のトップダウン・モデル。
 *
 * /management-score の運用試算表 (monthly-pl-simulation.ts, company_budget_inputs, 18ヶ月・積み上げ・
 * freee実績連動) とは別物。こちらは中期経営計画の KPI 目標をアンカーにした長期の月次試算表。
 * 運用試算表には一切依存・影響しない。
 *
 * 設計思想「二アンカー」:
 *   売上 (revenue) と 年次フリーCF (fcf) の2つを目標値に固定し、原価・固定費はこの2つに
 *   整合するように導出する。これにより「この数値目標を達成する前提で」という要件を、
 *   売上とFCFの両方を構造的に満たす形で表現する。原価内訳 (変動費/固定費) は整合的な残差。
 *
 *   fee   = fundAum × 管理報酬率(2%)                      … 売上のうちファンド管理報酬
 *   P     = fcf / (1 − 実効税率)   (fcf>0のとき)          … 税前営業利益 (FCFアンカー)
 *   tax   = P − fcf                                        … 税
 *   varCost = 変動費率(FY) × (revenue − fee)              … 業務原価 (物差しシフトで逓減)
 *   fixed   = (revenue − P) − varCost                     … 体制・固定費 (残差)
 *   grossProfit = revenue − varCost / operatingProfit = P
 */

export interface LongRangeTarget {
  fy: number;
  revenueYen: number;
  fcfYen: number;
  fundAumYen: number;
  osInstitutions: number;
  partnerInstitutions: number;
  papersCumulative: number;
  note?: string | null;
}

export interface LongRangeAssumptions {
  /** ファンド管理報酬率 (運用額に対する年率)。 */
  fundMgmtFeeRate: number;
  /** 実効税率 (法人税等)。FCF→税前営業利益の逆算に使う。 */
  taxEffectiveRate: number;
  /** 開始時キャッシュ (FY2026 期首)。運用試算表の initialCash と同値。 */
  startCashYen: number;
  /** 変動費率 (非ファンド売上に対する業務原価率)。FY をキーに逓減。 */
  varCostRatioByFy: Record<number, number>;
}

export const LONGRANGE_ASSUMPTIONS: LongRangeAssumptions = {
  fundMgmtFeeRate: 0.02,
  taxEffectiveRate: 0.25,
  startCashYen: 606423,
  varCostRatioByFy: {
    2026: 0.55,
    2027: 0.53,
    2028: 0.5,
    2029: 0.46,
    2030: 0.42,
    2031: 0.39,
    2032: 0.36,
    2033: 0.33,
    2034: 0.31,
    2035: 0.3,
  },
};

export interface LongRangeAnnualRow {
  fy: number;
  revenue: number;
  fundFee: number;
  varCost: number;
  grossProfit: number;
  fixedCost: number;
  operatingProfit: number;
  tax: number;
  fcf: number;
  cashEnd: number;
  grossMarginPct: number;
  // KPI 併記 (passthrough)
  fundAum: number;
  osInstitutions: number;
  partnerInstitutions: number;
  papersCumulative: number;
  note?: string | null;
}

export interface LongRangeMonthlyPoint {
  ym: number;
  revenue: number;
  fcf: number;
  cashBalance: number;
}

export interface LongRangeProjection {
  annual: LongRangeAnnualRow[];
  monthly: LongRangeMonthlyPoint[];
  totals: {
    revenue: number;
    cumFcf: number;
    cashEnd: number;
  };
  assumptions: LongRangeAssumptions;
}

function round(n: number): number {
  return Math.round(n);
}

/**
 * 年次目標から長期試算表 (年次 + 月次) を構築する。
 * targets は fy 昇順で渡す前提だが、内部で昇順ソートする。
 */
export function buildLongRangeProjection(
  targets: LongRangeTarget[],
  assumptions: LongRangeAssumptions = LONGRANGE_ASSUMPTIONS
): LongRangeProjection {
  const sorted = [...targets].sort((a, b) => a.fy - b.fy);
  const annual: LongRangeAnnualRow[] = [];
  const monthly: LongRangeMonthlyPoint[] = [];

  let cash = assumptions.startCashYen;
  let cumFcf = 0;
  let totalRevenue = 0;

  for (const t of sorted) {
    const revenue = t.revenueYen;
    const fcf = t.fcfYen;
    const fee = round(t.fundAumYen * assumptions.fundMgmtFeeRate);
    const preTaxProfit = fcf > 0 ? round(fcf / (1 - assumptions.taxEffectiveRate)) : fcf;
    const tax = preTaxProfit - fcf;
    const varRatio = assumptions.varCostRatioByFy[t.fy] ?? 0.4;
    const varCost = round(varRatio * (revenue - fee));
    const totalCost = revenue - preTaxProfit;
    const fixedCost = totalCost - varCost;
    const grossProfit = revenue - varCost;
    const operatingProfit = preTaxProfit;
    const cashEnd = cash + fcf;
    const grossMarginPct = revenue > 0 ? Math.round((grossProfit / revenue) * 100) : 0;

    annual.push({
      fy: t.fy,
      revenue,
      fundFee: fee,
      varCost,
      grossProfit,
      fixedCost,
      operatingProfit,
      tax,
      fcf,
      cashEnd,
      grossMarginPct,
      fundAum: t.fundAumYen,
      osInstitutions: t.osInstitutions,
      partnerInstitutions: t.partnerInstitutions,
      papersCumulative: t.papersCumulative,
      note: t.note ?? null,
    });

    // 月次展開: 年内フラット (FY = 暦年 Jan-Dec、決算月12)。キャッシュは月次で累積。
    const monthlyRevenue = round(revenue / 12);
    const monthlyFcf = round(fcf / 12);
    for (let m = 1; m <= 12; m += 1) {
      cash += monthlyFcf;
      monthly.push({
        ym: t.fy * 100 + m,
        revenue: monthlyRevenue,
        fcf: monthlyFcf,
        cashBalance: cash,
      });
    }
    // 端数調整で年末キャッシュを年次の cashEnd に合わせる
    cash = cashEnd;
    if (monthly.length > 0) monthly[monthly.length - 1].cashBalance = cashEnd;

    cumFcf += fcf;
    totalRevenue += revenue;
  }

  return {
    annual,
    monthly,
    totals: {
      revenue: totalRevenue,
      cumFcf,
      cashEnd: cash,
    },
    assumptions,
  };
}
