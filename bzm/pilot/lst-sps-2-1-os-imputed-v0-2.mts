import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const INFORMATION_CUTOFF = "2026-08-12T23:59:59+09:00";
const VALUATION_DATE = "2026-08-12";
const OUTPUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lst-sps-2-1-os-imputed-v0-2.json",
);
const CHECK_ONLY = process.argv.includes("--check");
const MONTHS = 56;
const RECYCLING_SHARE = 570 / 7_980;
const ACTION_KINDS = [
  "continue",
  "wait",
  "retry",
  "pivot",
  "scale_down",
  "scale_up",
  "license",
  "abandon",
] as const;
type ActionKind = (typeof ACTION_KINDS)[number];
type ScenarioId = "low" | "central" | "high";

type Scenario = {
  id: ScenarioId;
  label: string;
  openingCash: number;
  facilityCapex: number;
  minimumCash: number;
  annualDiscountRate: number;
  terminalGrowth: number;
  terminalReinvestmentRate: number;
  postHorizonRevenueGrowth: number[];
  postHorizonEbitMargin: number[];
  netWorkingCapitalShareOfAnnualRevenue: number;
  annualRevenue: Record<number, number>;
  annualFixedCost: Record<number, number>;
  contributionMargin: number;
  secondUnitResidualCapex: number;
  startupCapex: number;
  grantReceiptsCumulative: number;
  growthCapexShareOfSales: number;
  goalProbabilityAnchor: number;
  successValueAt2031RoundedCheck: number;
  requiredFundingBufferAnchor: number;
  firstCashCliffAnchor: string;
  failureMonth: number;
  salvageValue: number;
  closureCost: number;
  probability: ProbabilityInputs;
};

type ProbabilityInputs = {
  secondUnit: number;
  kawasaki: number;
  quality: number;
  blackMass: number;
  firstShipment: number;
  largeFinancing: number;
  policyCorrelation: number;
  alternativeFacilityRescue: number;
  onTimeSlopeReach: number;
  delayedSlopeReach: number;
  capitalIndependence: number;
};

type ActionRule = {
  kind: ActionKind;
  label: string;
  revenueScale: number;
  revenueDelayMonths: number;
  cogsScale: number;
  sgaScale: number;
  researchScale: number;
  capexScale: number;
  capexDelayMonths: number;
  extraCost: number;
  probabilityDeltas: Partial<ProbabilityInputs>;
  failureMonthDelta: number;
  terminalValueScale: number;
  currentAvailability: "available" | "future_conditional" | "unavailable";
  currentCondition: string;
};

type MonthRow = {
  monthIndex: number;
  month: string;
  fiscalYearEnding: number;
  evidenceStatus: "estimated";
  revenue: number;
  cogs: number;
  sga: number;
  researchExpense: number;
  operatingProfit: number;
  capex: number;
  grantReceipts: number;
  financingInflows: number;
  financingDetail: {
    knownJkiss: number;
    imputedBridge: number;
    imputedLargeRound: number;
  };
  debtPrincipal: number;
  interestExpense: number;
  tax: number;
  workingCapitalDelta: number;
  economicCashFlow: number;
  netCashFlow: number;
  endingCash: number;
};

type GateSchedule = {
  monthIndex: number;
  key:
    | "secondUnit"
    | "siteAndFunding"
    | "quality"
    | "firstShipment"
    | "timing"
    | "capitalIndependence";
  probability: number;
};

const round = (value: number, digits = 6) => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};
const clamp = (value: number, low = 0, high = 1) =>
  Math.min(high, Math.max(low, value));
const addMonths = (start: Date, offset: number) => {
  const value = new Date(start);
  value.setUTCMonth(value.getUTCMonth() + offset);
  return value;
};
const monthKey = (index: number) =>
  addMonths(new Date("2026-08-01T00:00:00Z"), index)
    .toISOString()
    .slice(0, 7);
const fyEnding = (date: Date) =>
  date.getUTCMonth() + 1 <= 3 ? date.getUTCFullYear() : date.getUTCFullYear() + 1;
const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const SCENARIOS: Scenario[] = [
  {
    id: "low",
    label: "低位（遅延・費用超過・補助金回収率低下）",
    openingCash: 60,
    facilityCapex: 550,
    minimumCash: 30,
    annualDiscountRate: 0.2,
    terminalGrowth: 0.01,
    terminalReinvestmentRate: 0.04,
    postHorizonRevenueGrowth: [0.2, 0.15, 0.1, 0.08, 0.05],
    postHorizonEbitMargin: [0.02, 0.05, 0.08, 0.1, 0.11],
    netWorkingCapitalShareOfAnnualRevenue: 0.15,
    annualRevenue: { 2027: 0.1, 2028: 0, 2029: 100, 2030: 1_965, 2031: 5_000 },
    annualFixedCost: { 2027: 440, 2028: 840, 2029: 849.6, 2030: 849.6, 2031: 849.6 },
    contributionMargin: 0.1,
    secondUnitResidualCapex: 120,
    startupCapex: 200,
    grantReceiptsCumulative: 500,
    growthCapexShareOfSales: 0.03,
    goalProbabilityAnchor: 0.0106,
    successValueAt2031RoundedCheck: 343,
    requiredFundingBufferAnchor: 4_485,
    firstCashCliffAnchor: "2026-09",
    failureMonth: 15,
    salvageValue: 15,
    closureCost: 90,
    probability: {
      secondUnit: 0.65,
      kawasaki: 0.75,
      quality: 0.5,
      blackMass: 0.55,
      firstShipment: 0.45,
      largeFinancing: 0.35,
      policyCorrelation: 0.6,
      alternativeFacilityRescue: 0.15,
      onTimeSlopeReach: 0.35,
      delayedSlopeReach: 0.35,
      capitalIndependence: 0.65,
    },
  },
  {
    id: "central",
    label: "中央（OS内計画＋明示推定）",
    openingCash: 116,
    facilityCapex: 420,
    minimumCash: 30,
    annualDiscountRate: 0.12,
    terminalGrowth: 0.025,
    terminalReinvestmentRate: 0.02,
    postHorizonRevenueGrowth: [0.35, 0.25, 0.18, 0.12, 0.08],
    postHorizonEbitMargin: [0.12, 0.15, 0.18, 0.2, 0.21],
    netWorkingCapitalShareOfAnnualRevenue: 0.08,
    annualRevenue: { 2027: 0.1, 2028: 0, 2029: 300, 2030: 3_930, 2031: 9_840 },
    annualFixedCost: { 2027: 400, 2028: 740.4, 2029: 783.6, 2030: 670.8, 2031: 670.8 },
    contributionMargin: 0.145872,
    secondUnitResidualCapex: 114,
    startupCapex: 100,
    grantReceiptsCumulative: 1_000,
    growthCapexShareOfSales: 0.015,
    goalProbabilityAnchor: 0.0884,
    successValueAt2031RoundedCheck: 23_225,
    requiredFundingBufferAnchor: 2_004,
    firstCashCliffAnchor: "2026-11",
    failureMonth: 18,
    salvageValue: 75,
    closureCost: 45,
    probability: {
      secondUnit: 0.8,
      kawasaki: 0.9,
      quality: 0.7,
      blackMass: 0.6,
      firstShipment: 0.65,
      largeFinancing: 0.6,
      policyCorrelation: 0.35,
      alternativeFacilityRescue: 0.35,
      onTimeSlopeReach: 0.5,
      delayedSlopeReach: 0.5,
      capitalIndependence: 0.85,
    },
  },
  {
    id: "high",
    label: "高位（早期立上げ・費用抑制・補助金満額）",
    openingCash: 170,
    facilityCapex: 300,
    minimumCash: 30,
    annualDiscountRate: 0.06,
    terminalGrowth: 0.03,
    terminalReinvestmentRate: 0.01,
    postHorizonRevenueGrowth: [0.45, 0.35, 0.25, 0.18, 0.12],
    postHorizonEbitMargin: [0.22, 0.24, 0.26, 0.27, 0.28],
    netWorkingCapitalShareOfAnnualRevenue: 0.04,
    annualRevenue: { 2027: 0.1, 2028: 0, 2029: 1_200, 2030: 8_000, 2031: 14_000 },
    annualFixedCost: { 2027: 366.4, 2028: 660, 2029: 680.4, 2030: 700, 2031: 750 },
    contributionMargin: 0.25,
    secondUnitResidualCapex: 108,
    startupCapex: 50,
    grantReceiptsCumulative: 1_400,
    growthCapexShareOfSales: 0.01,
    goalProbabilityAnchor: 0.3218,
    successValueAt2031RoundedCheck: 231_348,
    requiredFundingBufferAnchor: 299,
    firstCashCliffAnchor: "2026-12",
    failureMonth: 22,
    salvageValue: 250,
    closureCost: 20,
    probability: {
      secondUnit: 0.9,
      kawasaki: 0.97,
      quality: 0.85,
      blackMass: 0.72,
      firstShipment: 0.8,
      largeFinancing: 0.8,
      policyCorrelation: 0.2,
      alternativeFacilityRescue: 0.6,
      onTimeSlopeReach: 0.7,
      delayedSlopeReach: 0.7,
      capitalIndependence: 0.95,
    },
  },
];

const ACTIONS: ActionRule[] = [
  {
    kind: "continue",
    label: "現行計画を続行",
    revenueScale: 1,
    revenueDelayMonths: 0,
    cogsScale: 1,
    sgaScale: 1,
    researchScale: 1,
    capexScale: 1,
    capexDelayMonths: 0,
    extraCost: 0,
    probabilityDeltas: {},
    failureMonthDelta: 0,
    terminalValueScale: 1,
    currentAvailability: "available",
    currentCondition: "現行計画の続行・拡張束として現在選択可能",
  },
  {
    kind: "wait",
    label: "6か月待って情報を取得",
    revenueScale: 1,
    revenueDelayMonths: 6,
    cogsScale: 1,
    sgaScale: 0.92,
    researchScale: 0.8,
    capexScale: 1,
    capexDelayMonths: 6,
    extraCost: 30,
    probabilityDeltas: {
      quality: 0.03,
      firstShipment: -0.03,
      largeFinancing: -0.04,
      onTimeSlopeReach: -0.15,
      delayedSlopeReach: -0.05,
    },
    failureMonthDelta: 5,
    terminalValueScale: 0.95,
    currentAvailability: "unavailable",
    currentCondition: "支払・期限が進行中のため現在WAITは利用不可",
  },
  {
    kind: "retry",
    label: "技術課題を再試行してから量産",
    revenueScale: 1,
    revenueDelayMonths: 6,
    cogsScale: 0.97,
    sgaScale: 1.02,
    researchScale: 1.18,
    capexScale: 1.05,
    capexDelayMonths: 1,
    extraCost: 120,
    probabilityDeltas: {
      secondUnit: -0.03,
      quality: 0.12,
      onTimeSlopeReach: -0.18,
      delayedSlopeReach: 0.05,
    },
    failureMonthDelta: 4,
    terminalValueScale: 1.03,
    currentAvailability: "future_conditional",
    currentCondition: "工程#3の品質失敗が観測された後に有効化",
  },
  {
    kind: "pivot",
    label: "塩湖経路・代替拠点へ迂回",
    revenueScale: 1 - RECYCLING_SHARE,
    revenueDelayMonths: 9,
    cogsScale: 1.08,
    sgaScale: 0.98,
    researchScale: 1.1,
    capexScale: 1.12,
    capexDelayMonths: 4,
    extraCost: 150,
    probabilityDeltas: {
      kawasaki: -0.15,
      quality: -0.05,
      blackMass: 0.4,
      alternativeFacilityRescue: 0.3,
      onTimeSlopeReach: -0.25,
      delayedSlopeReach: 0.1,
    },
    failureMonthDelta: 6,
    terminalValueScale: 0.93,
    currentAvailability: "future_conditional",
    currentCondition: "工程#2の川崎経路失敗が観測された後に有効化",
  },
  {
    kind: "scale_down",
    label: "設備・固定費を縮小して段階拡張",
    revenueScale: 0.58,
    revenueDelayMonths: 3,
    cogsScale: 1.08,
    sgaScale: 0.7,
    researchScale: 0.8,
    capexScale: 0.58,
    capexDelayMonths: 0,
    extraCost: 20,
    probabilityDeltas: {
      quality: 0.05,
      firstShipment: -0.03,
      largeFinancing: 0.1,
      onTimeSlopeReach: 0.05,
      capitalIndependence: -0.12,
    },
    failureMonthDelta: 2,
    terminalValueScale: 0.62,
    currentAvailability: "future_conditional",
    currentCondition: "量産品質の確認後に有効化",
  },
  {
    kind: "scale_up",
    label: "川崎フル構成へ先行拡張",
    revenueScale: 1.35,
    revenueDelayMonths: 0,
    cogsScale: 0.94,
    sgaScale: 1.15,
    researchScale: 1.1,
    capexScale: 1.4,
    capexDelayMonths: 0,
    extraCost: 100,
    probabilityDeltas: {
      quality: -0.05,
      firstShipment: 0.05,
      largeFinancing: -0.1,
      onTimeSlopeReach: -0.05,
      capitalIndependence: 0.04,
    },
    failureMonthDelta: -2,
    terminalValueScale: 1.32,
    currentAvailability: "future_conditional",
    currentCondition: "量産品質の確認後に有効化",
  },
  {
    kind: "license",
    label: "装置・膜・知財をライセンス",
    revenueScale: 0.12,
    revenueDelayMonths: 9,
    cogsScale: 0.2,
    sgaScale: 0.28,
    researchScale: 0.35,
    capexScale: 0.12,
    capexDelayMonths: 3,
    extraCost: 60,
    probabilityDeltas: {},
    failureMonthDelta: 0,
    terminalValueScale: 0.3,
    currentAvailability: "future_conditional",
    currentCondition: "ライセンス対象権利と相手方条件の確定後に有効化",
  },
  {
    kind: "abandon",
    label: "現在撤退して設備・知財を処分",
    revenueScale: 0,
    revenueDelayMonths: 0,
    cogsScale: 0,
    sgaScale: 0,
    researchScale: 0,
    capexScale: 0,
    capexDelayMonths: 0,
    extraCost: 0,
    probabilityDeltas: {},
    failureMonthDelta: 0,
    terminalValueScale: 0,
    currentAvailability: "available",
    currentCondition: "現在撤退として比較可能",
  },
];

function distributedAnnual(total: number, year: number): number[] {
  const indices = Array.from({ length: MONTHS }, (_, index) => index).filter(
    (index) => fyEnding(addMonths(new Date("2026-08-01T00:00:00Z"), index)) === year,
  );
  if (indices.length === 0 || total === 0) return Array(MONTHS).fill(0);
  const weights = indices.map((_, index) => 1 + index * 0.04);
  const denominator = weights.reduce((sum, value) => sum + value, 0);
  const result = Array(MONTHS).fill(0);
  indices.forEach((monthIndex, index) => {
    result[monthIndex] = total * weights[index] / denominator;
  });
  return result;
}

function shift(values: number[], months: number): number[] {
  return Array.from({ length: MONTHS }, (_, index) =>
    index - months >= 0 ? values[index - months] : 0,
  );
}

function correlatedJoint(pA: number, pB: number, commonShockWeight: number): number {
  // A transparent mixture between independence and a shared-policy-state
  // branch. This avoids multiplying Kawasaki and financing as independent
  // events even though the OS preregistration says they share Z_policy.
  return clamp(
    (1 - commonShockWeight) * pA * pB + commonShockWeight * Math.min(pA, pB),
    Math.max(0, pA + pB - 1),
    Math.min(pA, pB),
  );
}

function actionProbabilities(scenario: Scenario, action: ActionRule) {
  const p = Object.fromEntries(
    Object.entries(scenario.probability).map(([key, value]) => [
      key,
      clamp(value + (action.probabilityDeltas[key as keyof ProbabilityInputs] ?? 0)),
    ]),
  ) as ProbabilityInputs;
  if (action.kind === "abandon") {
    return { goalProbability: 0, valuePathProbability: 1, p, decomposition: {} };
  }
  if (action.kind === "license") {
    const dealProbability = scenario.id === "low" ? 0.32 : scenario.id === "central" ? 0.48 : 0.64;
    const royaltySelfSufficiency = scenario.id === "low" ? 0.35 : scenario.id === "central" ? 0.5 : 0.65;
    return {
      goalProbability: round(dealProbability * royaltySelfSufficiency),
      valuePathProbability: dealProbability,
      p,
      decomposition: {
        dealProbability,
        royaltySelfSufficiency,
        licenseFutureConditionalNotDecisionReady: true,
      },
    };
  }
  const jointPolicy = correlatedJoint(p.kawasaki, p.largeFinancing, p.policyCorrelation);
  const siteAndFunding = clamp(
    jointPolicy + p.alternativeFacilityRescue * (p.largeFinancing - jointPolicy),
  );
  const timing = 0.5 * p.onTimeSlopeReach + 0.5 * p.delayedSlopeReach;
  // Black-mass failure does not stop the salt-lake route. It affects revenue
  // and terminal value through recyclingRevenueRetention, not q as an
  // independent kill switch.
  const rawStructuralProbability = clamp(
    p.secondUnit *
      siteAndFunding *
      p.quality *
      p.firstShipment *
      timing *
      p.capitalIndependence,
  );
  const centralStructuralProbability = (() => {
    const base = scenario.probability;
    const joint = correlatedJoint(base.kawasaki, base.largeFinancing, base.policyCorrelation);
    const site = joint + base.alternativeFacilityRescue * (base.largeFinancing - joint);
    const timingBase = 0.5 * base.onTimeSlopeReach + 0.5 * base.delayedSlopeReach;
    return base.secondUnit * site * base.quality * base.firstShipment * timingBase * base.capitalIndependence;
  })();
  const goalProbability = clamp(
    scenario.goalProbabilityAnchor * rawStructuralProbability / centralStructuralProbability,
  );
  return {
    goalProbability: round(goalProbability),
    valuePathProbability: round(goalProbability),
    p,
    decomposition: {
      jointPolicy: round(jointPolicy),
      alternativeFacilityContribution: round(
        p.alternativeFacilityRescue * (p.largeFinancing - jointPolicy),
      ),
      siteAndFunding: round(siteAndFunding),
      timing: round(timing),
      recyclingRevenueRetention: round(1 - RECYCLING_SHARE * (1 - p.blackMass)),
    },
  };
}

function rawMonthlyInputs(scenario: Scenario, action: ActionRule) {
  if (action.kind === "abandon") return Array.from({ length: MONTHS }, () => ({
    revenue: 0, cogs: 0, sga: 0, research: 0, capex: 0, grants: 0,
  }));
  const probability = actionProbabilities(scenario, action);
  const retention = Number(
    (probability.decomposition as Record<string, number>).recyclingRevenueRetention ?? 1,
  );
  const annualRevenue = Object.entries(scenario.annualRevenue).reduce(
    (result, [year, total]) => {
      const annual = distributedAnnual(total, Number(year));
      return result.map((value, index) => value + annual[index]);
    },
    Array(MONTHS).fill(0),
  );
  const annualFixed = Object.entries(scenario.annualFixedCost).reduce(
    (result, [year, total]) => {
      const annual = distributedAnnual(total, Number(year));
      return result.map((value, index) => value + annual[index]);
    },
    Array(MONTHS).fill(0),
  );
  const revenue = shift(annualRevenue, action.revenueDelayMonths).map(
    (value) => value * action.revenueScale * retention,
  );
  const cogs = revenue.map(
    (value) => value * (1 - scenario.contributionMargin) * action.cogsScale,
  );
  const sga = annualFixed.map((value) => value * action.sgaScale);
  const research = Array(MONTHS).fill(0);
  const capex = Array(MONTHS).fill(0);
  const putCapex = (index: number, amount: number) => {
    if (index >= 0 && index < MONTHS) capex[index] += amount * action.capexScale;
  };
  putCapex(3 + action.capexDelayMonths, scenario.secondUnitResidualCapex / 2);
  putCapex(6 + action.capexDelayMonths, scenario.secondUnitResidualCapex / 2);
  const facilityStart = 1 + action.capexDelayMonths;
  for (let index = 0; index < 12; index += 1) {
    putCapex(facilityStart + index, scenario.facilityCapex / 12);
  }
  for (let index = 0; index < 6; index += 1) {
    putCapex(18 + action.capexDelayMonths + index, scenario.startupCapex / 6);
  }
  revenue.forEach((value, index) => {
    capex[index] += value * scenario.growthCapexShareOfSales;
  });
  if (action.extraCost > 0) {
    for (let index = 0; index < 6; index += 1) {
      if (index < MONTHS) {
        research[index] += action.extraCost * action.researchScale / 6;
      }
    }
  }
  const grants = Array(MONTHS).fill(0);
  const grantMonths = [5, 11, 17, 23, 29, 35, 41, 47, 53];
  const grantWeight = grantMonths.reduce(
    (sum, month, index) => sum + (month < MONTHS ? index + 1 : 0),
    0,
  );
  grantMonths.forEach((month, index) => {
    if (month < MONTHS) grants[month] += scenario.grantReceiptsCumulative * (index + 1) / grantWeight;
  });
  return Array.from({ length: MONTHS }, (_, index) => ({
    revenue: revenue[index],
    cogs: cogs[index],
    sga: sga[index],
    research: research[index],
    capex: capex[index],
    grants: grants[index],
  }));
}

function generateLedger(scenario: Scenario, action: ActionRule): {
  rows: MonthRow[];
  bridgeFunding: number;
  largeRoundFunding: number;
  firstCashCliffWithoutImputedFunding: string | null;
  minimumCashWithoutImputedFunding: number;
} {
  if (action.kind === "abandon") {
    const netExit = scenario.salvageValue - scenario.closureCost;
    return {
      rows: Array.from({ length: MONTHS }, (_, index) => ({
        monthIndex: index,
        month: monthKey(index),
        fiscalYearEnding: fyEnding(addMonths(new Date("2026-08-01T00:00:00Z"), index)),
        evidenceStatus: "estimated" as const,
        revenue: 0, cogs: 0, sga: 0, researchExpense: 0, operatingProfit: 0,
        capex: 0, grantReceipts: 0, financingInflows: 0,
        financingDetail: { knownJkiss: 0, imputedBridge: 0, imputedLargeRound: 0 },
        debtPrincipal: 0, interestExpense: 0, tax: 0, workingCapitalDelta: 0,
        economicCashFlow: index === 0 ? netExit : 0,
        netCashFlow: index === 0 ? netExit : 0,
        endingCash: scenario.openingCash + netExit,
      })),
      bridgeFunding: 0,
      largeRoundFunding: 0,
      firstCashCliffWithoutImputedFunding: null,
      minimumCashWithoutImputedFunding: scenario.openingCash + netExit,
    };
  }
  const inputs = rawMonthlyInputs(scenario, action);
  const knownFunding = Array(MONTHS).fill(0);
  // J-KISS 100 received is an August financing cash-flow rather than opening
  // non-J-KISS cash. The remaining committed 50 is timed by scenario.
  knownFunding[0] = 100;
  knownFunding[scenario.id === "low" ? 4 : scenario.id === "central" ? 1 : 0] += 50;
  const construct = (bridge: number, largeRound: number) => {
    let cash = scenario.openingCash;
    let debtBalance = 80;
    let taxLossCarryforward = 0;
    let priorWorkingCapital = 0;
    const rows: MonthRow[] = [];
    for (let index = 0; index < MONTHS; index += 1) {
      const input = inputs[index];
      const operatingProfit = input.revenue - input.cogs - input.sga - input.research;
      const taxable = Math.max(0, operatingProfit - taxLossCarryforward);
      const tax = taxable * 0.3062;
      taxLossCarryforward = Math.max(0, taxLossCarryforward - Math.max(0, operatingProfit));
      if (operatingProfit < 0) taxLossCarryforward += -operatingProfit;
      const workingCapital =
        input.revenue * 12 * scenario.netWorkingCapitalShareOfAnnualRevenue;
      const workingCapitalDelta = workingCapital - priorWorkingCapital;
      priorWorkingCapital = workingCapital;
      const annualInterestRate = index < 21 ? 0.02 : 0.025;
      const interest = debtBalance * annualInterestRate / 12;
      const principal = index >= 34 ? Math.min(80 / 60, debtBalance) : 0;
      debtBalance -= principal;
      const imputedBridge = index === 0 ? bridge : 0;
      const imputedLargeRound = index === 8 ? largeRound : 0;
      const financingInflows = knownFunding[index] + imputedBridge + imputedLargeRound;
      // Financing receipts are cash-feasibility inputs, not economic benefits.
      // Existing debt service remains an obligation of the company path.
      const economicCashFlow =
        operatingProfit + input.grants - input.capex - tax - workingCapitalDelta;
      const netCashFlow = economicCashFlow + financingInflows - interest - principal;
      cash += netCashFlow;
      rows.push({
        monthIndex: index,
        month: monthKey(index),
        fiscalYearEnding: fyEnding(addMonths(new Date("2026-08-01T00:00:00Z"), index)),
        evidenceStatus: "estimated",
        revenue: round(input.revenue),
        cogs: round(input.cogs),
        sga: round(input.sga),
        researchExpense: round(input.research),
        operatingProfit: round(operatingProfit),
        capex: round(input.capex),
        grantReceipts: round(input.grants),
        financingInflows: round(financingInflows),
        financingDetail: {
          knownJkiss: round(knownFunding[index]),
          imputedBridge: round(imputedBridge),
          imputedLargeRound: round(imputedLargeRound),
        },
        debtPrincipal: round(principal),
        interestExpense: round(interest),
        tax: round(tax),
        workingCapitalDelta: round(workingCapitalDelta),
        economicCashFlow: round(economicCashFlow),
        netCashFlow: round(netCashFlow),
        endingCash: round(cash),
      });
    }
    return rows;
  };
  const noRescue = construct(0, 0);
  const firstCashCliff = noRescue.find((row) => row.endingCash < 0)?.month ?? null;
  const preLargeMinimum = Math.min(...noRescue.slice(0, 8).map((row) => row.endingCash));
  const bridge = round(Math.max(0, scenario.minimumCash - preLargeMinimum));
  const withBridge = construct(bridge, 0);
  const postLargeMinimum = Math.min(...withBridge.slice(8).map((row) => row.endingCash));
  const largeRound = round(Math.max(0, scenario.minimumCash - postLargeMinimum));
  return {
    rows: construct(bridge, largeRound),
    bridgeFunding: bridge,
    largeRoundFunding: largeRound,
    firstCashCliffWithoutImputedFunding: firstCashCliff,
    minimumCashWithoutImputedFunding: round(Math.min(...noRescue.map((row) => row.endingCash))),
  };
}

function npv(rows: MonthRow[], annualRate: number, endIndex = rows.length - 1): number {
  const monthlyRate = (1 + annualRate) ** (1 / 12) - 1;
  return rows.slice(0, endIndex + 1).reduce(
    (sum, row) => sum + row.economicCashFlow / (1 + monthlyRate) ** (row.monthIndex + 1),
    0,
  );
}

function gateSchedule(
  scenario: Scenario,
  probabilities: ReturnType<typeof actionProbabilities>,
): GateSchedule[] {
  if (
    (probabilities.decomposition as Record<string, unknown>)
      .licenseFutureConditionalNotDecisionReady === true
  ) {
    return [
      {
        monthIndex: 8,
        key: "siteAndFunding",
        probability: probabilities.valuePathProbability,
      },
    ];
  }
  const siteAndFunding = Number(
    (probabilities.decomposition as Record<string, number>).siteAndFunding ?? 1,
  );
  const timing = Number(
    (probabilities.decomposition as Record<string, number>).timing ?? 1,
  );
  const monthsByScenario: Record<ScenarioId, number[]> = {
    low: [8, 17, 29, 43, 54, 55],
    central: [6, 10, 19, 31, 54, 55],
    high: [4, 7, 14, 23, 46, 47],
  };
  const probabilitiesInOrder = [
    probabilities.p.secondUnit,
    siteAndFunding,
    probabilities.p.quality,
    probabilities.p.firstShipment,
    timing,
    probabilities.p.capitalIndependence,
  ];
  const rawProduct = probabilitiesInOrder.reduce(
    (product, probability) => product * probability,
    1,
  );
  if (rawProduct > 0) {
    probabilitiesInOrder[probabilitiesInOrder.length - 1] = clamp(
      probabilitiesInOrder.at(-1)! * probabilities.goalProbability / rawProduct,
    );
  }
  const keys: GateSchedule["key"][] = [
    "secondUnit",
    "siteAndFunding",
    "quality",
    "firstShipment",
    "timing",
    "capitalIndependence",
  ];
  return monthsByScenario[scenario.id].map((monthIndex, index) => ({
    monthIndex,
    key: keys[index],
    probability: probabilitiesInOrder[index],
  }));
}

function pathWeightedValue(
  rows: MonthRow[],
  scenario: Scenario,
  probabilities: ReturnType<typeof actionProbabilities>,
  continuationPresent: number,
) {
  const monthlyRate = (1 + scenario.annualDiscountRate) ** (1 / 12) - 1;
  const gates = gateSchedule(scenario, probabilities);
  let survivalProbability = 1;
  let expectedPathCashFlowPresent = 0;
  let expectedFailureExitPresent = 0;
  const gateTrace: Array<GateSchedule & { survivalBefore: number; survivalAfter: number }> = [];
  for (const row of rows) {
    for (const gate of gates.filter((candidate) => candidate.monthIndex === row.monthIndex)) {
      const survivalBefore = survivalProbability;
      const failedProbability = survivalBefore * (1 - gate.probability);
      const discount = (1 + monthlyRate) ** (row.monthIndex + 1);
      expectedFailureExitPresent +=
        failedProbability * (scenario.salvageValue - scenario.closureCost) / discount;
      survivalProbability *= gate.probability;
      gateTrace.push({
        ...gate,
        survivalBefore: round(survivalBefore),
        survivalAfter: round(survivalProbability),
      });
    }
    expectedPathCashFlowPresent +=
      survivalProbability *
      row.economicCashFlow /
      (1 + monthlyRate) ** (row.monthIndex + 1);
  }
  const expectedSuccessValuePresent = survivalProbability * continuationPresent;
  return {
    expectedNetValue: round(
      expectedPathCashFlowPresent +
        expectedSuccessValuePresent +
        expectedFailureExitPresent,
    ),
    expectedPathCashFlowPresent: round(expectedPathCashFlowPresent),
    expectedSuccessValuePresent: round(expectedSuccessValuePresent),
    expectedFailureExitPresent: round(expectedFailureExitPresent),
    survivalProbability: round(survivalProbability),
    gateTrace,
  };
}

function successValueAt2031(scenario: Scenario): {
  value: number;
  roundedCheck: number;
  differenceFromRoundedCheck: number;
  years: Array<{
    year: number;
    revenue: number;
    ebitMargin: number;
    freeCashFlow: number;
    presentValueAt2031: number;
  }>;
  terminalValueAt2031: number;
} {
  const taxRate = 0.3062;
  let revenue = scenario.annualRevenue[2031];
  let priorRevenue = revenue;
  const years = scenario.postHorizonRevenueGrowth.map((growth, index) => {
    revenue *= 1 + growth;
    const ebitMargin = scenario.postHorizonEbitMargin[index];
    const afterTaxEbit = revenue * ebitMargin * (1 - taxRate);
    const reinvestment = revenue * scenario.terminalReinvestmentRate;
    const workingCapitalInvestment =
      (revenue - priorRevenue) * scenario.netWorkingCapitalShareOfAnnualRevenue;
    const freeCashFlow = afterTaxEbit - reinvestment - workingCapitalInvestment;
    const presentValueAt2031 =
      freeCashFlow / (1 + scenario.annualDiscountRate) ** (index + 1);
    priorRevenue = revenue;
    return {
      year: 2032 + index,
      revenue: round(revenue),
      ebitMargin,
      freeCashFlow: round(freeCashFlow),
      presentValueAt2031: round(presentValueAt2031),
    };
  });
  const finalFcf = years.at(-1)!.freeCashFlow;
  const terminalValueAt2036 =
    finalFcf * (1 + scenario.terminalGrowth) /
    (scenario.annualDiscountRate - scenario.terminalGrowth);
  const terminalValueAt2031 =
    terminalValueAt2036 / (1 + scenario.annualDiscountRate) ** years.length;
  const rawValue =
    years.reduce((sum, year) => sum + year.presentValueAt2031, 0) +
    terminalValueAt2031;
  return {
    value: round(rawValue),
    roundedCheck: scenario.successValueAt2031RoundedCheck,
    differenceFromRoundedCheck: round(
      rawValue - scenario.successValueAt2031RoundedCheck,
    ),
    years,
    terminalValueAt2031: round(terminalValueAt2031),
  };
}

function continuingValueAtHorizon(
  rows: MonthRow[],
  scenario: Scenario,
  action: ActionRule,
): number {
  if (action.kind === "abandon") return 0;
  const probability = actionProbabilities(scenario, action);
  const recyclingRevenueRetention = Number(
    (probability.decomposition as Record<string, number>).recyclingRevenueRetention ?? 1,
  );
  const dcf = successValueAt2031(scenario);
  return round(
    dcf.value *
      action.terminalValueScale *
      recyclingRevenueRetention,
  );
}

function evaluateAction(scenario: Scenario, action: ActionRule) {
  const probabilities = actionProbabilities(scenario, action);
  const ledger = generateLedger(scenario, action);
  if (action.kind === "abandon") {
    const value = scenario.salvageValue - scenario.closureCost;
    return {
      action: action.kind,
      label: action.label,
      currentAvailability: action.currentAvailability,
      currentCondition: action.currentCondition,
      selected: false,
      goalProbability: 0,
      valuePathProbability: 1,
      expectedNetValueMillionJpy: round(value),
      conditionalGoalValueMillionJpy: null,
      successPathNpvMillionJpy: round(value),
      failurePathNpvMillionJpy: round(value),
      continuingValueAt2031MillionJpy: 0,
      continuingValuePresentMillionJpy: 0,
      firstCashCliffWithoutImputedFunding: null,
      bridgeFundingRequiredMillionJpy: 0,
      largeRoundRequiredMillionJpy: 0,
      totalAdditionalFundingRequiredMillionJpy: 0,
      minimumCashWithoutImputedFundingMillionJpy: ledger.minimumCashWithoutImputedFunding,
      probabilityDecomposition: probabilities.decomposition,
      monthlyCashFlow: ledger.rows,
    };
  }
  const continuationAtHorizon = continuingValueAtHorizon(ledger.rows, scenario, action);
  const horizonYears = MONTHS / 12;
  const continuationPresent = continuationAtHorizon / (1 + scenario.annualDiscountRate) ** horizonYears;
  const successNpv = npv(ledger.rows, scenario.annualDiscountRate) + continuationPresent;
  const pathProbability = probabilities.valuePathProbability;
  const pathValue = pathWeightedValue(
    ledger.rows,
    scenario,
    probabilities,
    continuationPresent,
  );
  const calculatedExpected = pathValue.expectedNetValue;
  const expected = calculatedExpected;
  return {
    action: action.kind,
    label: action.label,
    currentAvailability: action.currentAvailability,
    currentCondition: action.currentCondition,
    selected: false,
    goalProbability: probabilities.goalProbability,
    valuePathProbability: pathProbability,
    expectedNetValueMillionJpy: round(expected),
    rawPathCalculationExpectedNetValueMillionJpy: round(calculatedExpected),
    shadowAnchorApplied: null,
    expectedPathCashFlowPresentMillionJpy:
      pathValue.expectedPathCashFlowPresent,
    expectedSuccessValuePresentMillionJpy:
      pathValue.expectedSuccessValuePresent,
    expectedFailureExitPresentMillionJpy:
      pathValue.expectedFailureExitPresent,
    pathSurvivalProbability: pathValue.survivalProbability,
    gateTrace: pathValue.gateTrace,
    conditionalGoalValueMillionJpy:
      probabilities.goalProbability > 0 ? round(successNpv) : null,
    successPathNpvMillionJpy: round(successNpv),
    failurePathNpvMillionJpy: null,
    failurePathNpvStatus:
      "not_applicable: SPS uses first-failure gate contributions rather than one synthetic failure month",
    continuingValueAt2031MillionJpy: round(continuationAtHorizon),
    continuingValuePresentMillionJpy: round(continuationPresent),
    successValueDcf: successValueAt2031(scenario),
    expectedFailureLossMillionJpy: null,
    expectedExitValueMillionJpy: pathValue.expectedFailureExitPresent,
    expectedExitValueDefinition:
      "discounted first-failure gate contribution used by the SPS calculation",
    firstCashCliffWithoutImputedFunding: ledger.firstCashCliffWithoutImputedFunding,
    bridgeFundingRequiredMillionJpy: ledger.bridgeFunding,
    largeRoundRequiredMillionJpy: ledger.largeRoundFunding,
    totalAdditionalFundingRequiredMillionJpy: round(ledger.bridgeFunding + ledger.largeRoundFunding),
    minimumCashWithoutImputedFundingMillionJpy: ledger.minimumCashWithoutImputedFunding,
    probabilityDecomposition: probabilities.decomposition,
    monthlyCashFlow: ledger.rows,
  };
}

const scenarioResults = SCENARIOS.map((scenario) => {
  const actions = ACTIONS.map((action) => evaluateAction(scenario, action));
  const currentActions = actions.filter(
    (action) => action.currentAvailability === "available",
  );
  const bestValue = Math.max(
    ...currentActions.map((action) => action.expectedNetValueMillionJpy),
  );
  const selected = currentActions.find(
    (action) => action.expectedNetValueMillionJpy === bestValue,
  )!;
  selected.selected = true;
  return {
    scenarioId: scenario.id,
    label: scenario.label,
    inputs: scenario,
    selectedAction: selected.action,
    sps21MillionJpy: selected.expectedNetValueMillionJpy,
    q: selected.goalProbability,
    selectedActionFundingRequiredMillionJpy: selected.totalAdditionalFundingRequiredMillionJpy,
    continueCounterfactualFundingRequiredMillionJpy: actions.find(
      (action) => action.action === "continue",
    )!.totalAdditionalFundingRequiredMillionJpy,
    frozenRequiredFundingBufferMillionJpy: scenario.requiredFundingBufferAnchor,
    frozenFirstCashCliffAnchor: scenario.firstCashCliffAnchor,
    monthlyAllocationFundingGapVsFrozenMillionJpy: round(
      actions.find((action) => action.action === "continue")!
        .totalAdditionalFundingRequiredMillionJpy -
        scenario.requiredFundingBufferAnchor,
    ),
    selectedActionFirstCashCliffWithoutImputedFunding:
      selected.firstCashCliffWithoutImputedFunding,
    actions,
    excludedCurrentActions: actions
      .filter((action) => action.currentAvailability !== "available")
      .map((action) => ({
        action: action.action,
        availability: action.currentAvailability,
        condition: action.currentCondition,
      })),
  };
});

for (const scenario of scenarioResults) {
  assert.equal(scenario.actions.length, ACTION_KINDS.length);
  assert.deepEqual(scenario.actions.map((action) => action.action), [...ACTION_KINDS]);
  assert.ok(Number.isFinite(scenario.sps21MillionJpy));
  assert.ok(scenario.q >= 0 && scenario.q <= 1);
  for (const action of scenario.actions) {
    assert.equal(action.monthlyCashFlow.length, MONTHS);
    assert.equal(action.monthlyCashFlow[0].month, "2026-08");
    assert.equal(action.monthlyCashFlow.at(-1)?.month, "2031-03");
    assert.ok(action.monthlyCashFlow.every((row) => Number.isFinite(row.endingCash)));
    let priorCash = scenario.inputs.openingCash;
    for (const row of action.monthlyCashFlow) {
      assert.ok(
        Math.abs(
          row.netCashFlow -
            (row.economicCashFlow +
              row.financingInflows -
              row.interestExpense -
              row.debtPrincipal),
        ) < 0.00001,
      );
      assert.ok(Math.abs(row.endingCash - (priorCash + row.netCashFlow)) < 0.00002);
      priorCash = row.endingCash;
    }
    if (action.action !== "abandon" && action.action !== "license") {
      assert.ok(
        Math.abs(action.pathSurvivalProbability - action.goalProbability) < 0.000001,
      );
      assert.ok(
        Math.abs(
          action.expectedNetValueMillionJpy -
            (action.expectedPathCashFlowPresentMillionJpy +
              action.expectedSuccessValuePresentMillionJpy +
              action.expectedFailureExitPresentMillionJpy),
        ) < 0.00001,
      );
      assert.ok(Math.abs(action.successValueDcf.differenceFromRoundedCheck) < 1);
    }
  }
}

assert.deepEqual(
  scenarioResults.map(({ scenarioId, selectedAction, q }) => ({
    scenarioId,
    selectedAction,
    q,
  })),
  [
    { scenarioId: "low", selectedAction: "abandon", q: 0 },
    { scenarioId: "central", selectedAction: "abandon", q: 0 },
    { scenarioId: "high", selectedAction: "continue", q: 0.3218 },
  ],
);

const centralScenarioResult = scenarioResults.find(
  (scenario) => scenario.scenarioId === "central",
)!;
const centralContinueResult = centralScenarioResult.actions.find(
  (action) => action.action === "continue",
)!;
const centralSuccessValueDcf = centralContinueResult.successValueDcf;
const centralGateTrace = centralContinueResult.gateTrace;
if (!centralSuccessValueDcf || !centralGateTrace) {
  throw new Error("central continue action must have DCF and gate trace");
}

function revalueCentral(annualRate: number, targetQ: number) {
  const scenario = centralScenarioResult.inputs;
  const years = centralSuccessValueDcf!.years;
  const explicitValueAt2031 = years.reduce(
    (sum, year, index) =>
      sum + year.freeCashFlow / (1 + annualRate) ** (index + 1),
    0,
  );
  const terminalValueAt2031 =
    years.at(-1)!.freeCashFlow * (1 + scenario.terminalGrowth) /
    (annualRate - scenario.terminalGrowth) /
    (1 + annualRate) ** years.length;
  const successValueAt2031 = explicitValueAt2031 + terminalValueAt2031;
  const retention = Number(
    (centralContinueResult.probabilityDecomposition as Record<string, number>)
      .recyclingRevenueRetention,
  );
  const successValuePresent =
    successValueAt2031 * retention / (1 + annualRate) ** (MONTHS / 12);
  const gates = centralGateTrace!.map((gate) => ({ ...gate }));
  const preFinalSurvival = gates
    .slice(0, -1)
    .reduce((product, gate) => product * gate.probability, 1);
  gates.at(-1)!.probability = clamp(targetQ / preFinalSurvival);
  const monthlyRate = (1 + annualRate) ** (1 / 12) - 1;
  let survivalProbability = 1;
  let expectedPathCashFlowPresent = 0;
  let expectedFailureExitPresent = 0;
  for (const row of centralContinueResult.monthlyCashFlow) {
    for (const gate of gates.filter((candidate) => candidate.monthIndex === row.monthIndex)) {
      const failureProbability = survivalProbability * (1 - gate.probability);
      expectedFailureExitPresent +=
        failureProbability *
        (scenario.salvageValue - scenario.closureCost) /
        (1 + monthlyRate) ** (row.monthIndex + 1);
      survivalProbability *= gate.probability;
    }
    expectedPathCashFlowPresent +=
      survivalProbability *
      row.economicCashFlow /
      (1 + monthlyRate) ** (row.monthIndex + 1);
  }
  const expectedSuccessValuePresent = survivalProbability * successValuePresent;
  return {
    annualRate,
    targetQ,
    expectedNetValueMillionJpy: round(
      expectedPathCashFlowPresent +
        expectedSuccessValuePresent +
        expectedFailureExitPresent,
    ),
  };
}

let breakEvenQLow = 0;
let breakEvenQHigh = 1;
for (let index = 0; index < 80; index += 1) {
  const midpoint = (breakEvenQLow + breakEvenQHigh) / 2;
  if (
    revalueCentral(0.12, midpoint).expectedNetValueMillionJpy <
    centralScenarioResult.actions.find((action) => action.action === "abandon")!
      .expectedNetValueMillionJpy
  ) {
    breakEvenQLow = midpoint;
  } else {
    breakEvenQHigh = midpoint;
  }
}

const sensitivityDiagnostics = {
  centralDiscountRate: [0.1, 0.12, 0.14].map((annualRate) =>
    revalueCentral(annualRate, centralContinueResult.goalProbability),
  ),
  centralBreakEvenGoalProbabilityVsImmediateAbandon: round(breakEvenQHigh),
  centralOnePercentagePointQIncreaseValueDeltaMillionJpy: round(
    revalueCentral(0.12, centralContinueResult.goalProbability + 0.01)
      .expectedNetValueMillionJpy -
      revalueCentral(0.12, centralContinueResult.goalProbability)
        .expectedNetValueMillionJpy,
  ),
  continueFundingNeedMillionJpy: scenarioResults.map((scenario) => {
    const continuation = scenario.actions.find((action) => action.action === "continue")!;
    return {
      scenarioId: scenario.scenarioId,
      monthlyLedger: continuation.totalAdditionalFundingRequiredMillionJpy,
      independentAggregateCheck: scenario.frozenRequiredFundingBufferMillionJpy,
      difference:
        continuation.totalAdditionalFundingRequiredMillionJpy -
        scenario.frozenRequiredFundingBufferMillionJpy,
    };
  }),
};

const outputWithoutHash = {
  schema: "bzm-2.1-lst-os-only-fully-imputed-v0.2",
  modelStatus: "hypothesis_fully_imputed_not_calibrated",
  projectName: "LST",
  valuationDate: VALUATION_DATE,
  informationCutoff: INFORMATION_CUTOFF,
  currencyUnit: "million_JPY",
  valueDefinition:
    "company-held PJ expected future net value under the selected action; financing receipts are excluded from economic benefit",
  warning:
    "Every previously missing field has an explicit estimate. These are scenario assumptions, not observations, confidence intervals, market-consistent prices, or investment recommendations.",
  forwardValidationCount: 0,
  sensitivityDiagnostics,
  decisionReadout: (() => {
    const central = scenarioResults.find((scenario) => scenario.scenarioId === "central")!;
    const centralContinue = central.actions.find((action) => action.action === "continue")!;
    const centralAbandon = central.actions.find((action) => action.action === "abandon")!;
    return {
      status: "decision_indeterminate_across_imputation_scenarios",
      forcedCentralSelectedAction: central.selectedAction,
      forcedCentralSps21MillionJpy: central.sps21MillionJpy,
      centralContinueValueMillionJpy: centralContinue.expectedNetValueMillionJpy,
      centralContinueGoalProbability: centralContinue.goalProbability,
      centralAbandonValueMillionJpy: centralAbandon.expectedNetValueMillionJpy,
      centralActionValueGapMillionJpy: round(
        Math.abs(
          centralContinue.expectedNetValueMillionJpy -
            centralAbandon.expectedNetValueMillionJpy,
        ),
      ),
      explanation:
        "The strict central argmax is reported because the user requested a forced value, but the low/high scenarios select different actions and the central action gap is smaller than the imputation error. This is not an operational recommendation.",
    };
  })(),
  calculationRules: {
    q:
      "node probabilities with correlated Kawasaki/funding state and alternative-facility rescue; black-mass failure only scales the 570/7,980 recycling revenue path",
    monthlyCash:
      "opening cash plus grants and financing minus monthly operating, investing, working-capital, tax and debt-service cash flows",
    additionalFunding:
      "minimum imputed bridge at 2026-08 and large round at 2027-04 that keep month-end cash at or above the scenario minimum",
    conditionalValue:
      "discounted 2026-08..2031-03 economic CF plus a five-year FY2032..FY2036 explicit DCF and terminal growth value; the raw DCF and its rounded calculation check are both retained",
    sps21:
      "each monthly unlevered project CF is weighted by survival through the decision gates already reached; first-failure exit value and q-weighted success DCF are then added; the available action with the largest company value is selected",
    noT0CostCompression:
      "capex, R&D, operating costs, grants and debt service remain in their imputed calendar months; remaining cost is never deducted as one t=0 lump sum",
  },
  sourceAnchors: [
    "SPS_2_0_PREREGISTRATION_LST_2026-08-09.md: 2031-03-31 deadline, eight node judgments, revenue/production plan, funding cliff",
    "2026-05 monthly report: JFC 80 alone was forecast to leave about 30 at 2027-03 and another 120 to extend runway to about 2027-09; non-J-KISS opening cash 60/116/170 is an imputed range, not a bank-balance observation",
    "monthly_reports/project_strategy_signals: J-KISS 100 received enters 2026-08 financing CF and remaining 50 committed enters Dec/Sep/Aug by scenario; both are excluded from economic benefit; second LiSMIC unit under 200 with 40/30/30 schedule",
    "project_grants: SBIR 1,500 active, Startup Global up to 200 active, NEDO active amount missing",
    "frozen v1.0 plan: FY2029 revenue 300, FY2030 revenue 3,930, FY2030 operating loss 97.736, FY2031 operating profit 764.087",
  ],
  parameterProvenance: [
    {
      parameters: ["valuationDate", "informationCutoff", "deadline"],
      status: "observed_or_frozen",
      source: "BZM 2.0 LST preregistration and this v0.2 freeze",
      use: "valuation clock, hindsight prevention and 2031-03-31 reachability horizon",
    },
    {
      parameters: ["openingCash"],
      status: "estimated",
      source: "OS monthly-report anchors: 2026-03 cash forecast, JFC execution and stated runway",
      use: "low/central/high non-J-KISS opening cash 60/116/170",
    },
    {
      parameters: ["J-KISS received", "J-KISS committed"],
      status: "partial_observation",
      source: "OS financing and monthly-report records",
      use: "100 received in 2026-08 and remaining 50 timed by scenario; liquidity only",
    },
    {
      parameters: ["JFC principal", "interest", "repayment schedule"],
      status: "mixed_observed_and_estimated",
      source: "OS JFC execution record plus imputed repayment terms",
      use: "liquidity ledger; principal and interest excluded from unlevered PJ value",
    },
    {
      parameters: ["annualRevenue", "contributionMargin", "annualFixedCost"],
      status: "mixed_plan_and_estimated",
      source: "frozen LST plan values plus low/high scenarios and margin/fixed-cost imputation",
      use: "monthly revenue, cost and operating-profit paths",
    },
    {
      parameters: ["secondUnitResidualCapex", "facilityCapex", "startupCapex"],
      status: "mixed_partial_observation_and_estimated",
      source: "OS second-unit 40/30/30 schedule and Kawasaki gross-cost records; company share imputed",
      use: "monthly investment cash flows",
    },
    {
      parameters: ["grantReceiptsCumulative"],
      status: "estimated_from_partial_observation",
      source: "OS SBIR, Startup Global and NEDO statuses; disbursement timing and eligible share missing",
      use: "monthly grant cash receipts, never a direct value bonus",
    },
    {
      parameters: ["netWorkingCapitalShareOfAnnualRevenue", "growthCapexShareOfSales"],
      status: "estimated",
      source: "scenario assumptions constrained by the LST sales ramp",
      use: "monthly working-capital and growth-investment cash demand",
    },
    {
      parameters: ["secondUnit", "kawasaki", "quality", "firstShipment", "largeFinancing", "capitalIndependence"],
      status: "hearing_based_then_scenario_imputed",
      source: "eight-node LST preregistration judgments and OS project records",
      use: "sequential first-passage survival probabilities",
    },
    {
      parameters: ["policyCorrelation", "alternativeFacilityRescue", "onTimeSlopeReach", "delayedSlopeReach"],
      status: "estimated",
      source: "OS notes that Kawasaki and financing share a policy state and that an alternative site remains possible",
      use: "dependence, rescue branch and deadline reachability",
    },
    {
      parameters: ["blackMass", "recyclingRevenueRetention"],
      status: "hearing_based_then_calculated",
      source: "LST preregistration and 570/7,980 recycling-volume share",
      use: "scales only the recycling revenue/value path, not total q",
    },
    {
      parameters: ["postHorizonRevenueGrowth", "postHorizonEbitMargin", "annualDiscountRate", "terminalGrowth", "terminalReinvestmentRate"],
      status: "estimated",
      source: "LST plan and IPO target used only as scenario anchors",
      use: "FY2032-FY2036 explicit DCF and terminal value; the raw result and rounded calculation check are retained without a hidden overwrite",
    },
    {
      parameters: ["salvageValue", "closureCost", "failureMonth"],
      status: "estimated",
      source: "equipment/IP recoverability and contract/grant close-out assumptions",
      use: "first-failure and immediate-abandon values",
    },
    {
      parameters: ["action bundle availability and action deltas"],
      status: "estimated_with_structural_constraints",
      source: "OS milestones, deadlines, rights gaps and current plan",
      use: "continue and abandon are currently selectable; six other action types remain unavailable or future-conditional",
    },
  ],
  highestUncertaintyDrivers: [
    "post-2031 revenue/FCF growth and discount rate used by continuing DCF",
    "current unrestricted cash and monthly grant reimbursement timing",
    "FY2027 large-round amount, timing and success probability",
    "Kawasaki/second-unit cost scope, cost sharing, alternative-facility delay and incremental cost",
    "quality, first-shipment and capital-independence transition probabilities",
    "failure timing, salvage value, closure cost and licensing economics",
  ],
  scenarios: scenarioResults,
};

const output = {
  ...outputWithoutHash,
  calculationHash: createHash("sha256").update(stableJson(outputWithoutHash)).digest("hex"),
};

const serializedOutput = `${JSON.stringify(output, null, 2)}\n`;
if (CHECK_ONLY) {
  assert.equal(await readFile(OUTPUT, "utf8"), serializedOutput);
} else {
  await writeFile(OUTPUT, serializedOutput, "utf8");
}
console.log(JSON.stringify({
  mode: CHECK_ONLY ? "check" : "write",
  output: OUTPUT,
  results: scenarioResults.map((scenario) => ({
    scenario: scenario.scenarioId,
    selectedAction: scenario.selectedAction,
    q: scenario.q,
    sps21MillionJpy: scenario.sps21MillionJpy,
    additionalFundingMillionJpy: scenario.selectedActionFundingRequiredMillionJpy,
    firstCashCliff: scenario.selectedActionFirstCashCliffWithoutImputedFunding,
  })),
  calculationHash: output.calculationHash,
}, null, 2));
