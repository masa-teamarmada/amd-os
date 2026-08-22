import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(DIR, "lst-sps-2-1-corrected-dynamic-v0-4.json");
const V02_MTS = path.join(DIR, "lst-sps-2-1-os-imputed-v0-2.mts");
const V02_JSON = path.join(DIR, "lst-sps-2-1-os-imputed-v0-2.json");
const V03_MTS = path.join(DIR, "lst-sps-2-1-audited-imputed-v0-3.mts");
const V03_JSON = path.join(DIR, "lst-sps-2-1-audited-imputed-v0-3.json");
const CHECK_ONLY = process.argv.includes("--check");
const VALUATION_DATE = "2026-08-12";
const INFORMATION_CUTOFF = "2026-08-12T23:59:59+09:00";
const MONTHS = 56;
const TAX_RATE = 0.3062;
const RECYCLING_SHARE = 570 / 7_980;

type ScenarioId = "low" | "central" | "high";
type CurrentAction =
  | "continue_and_raise"
  | "staged_scale_down_and_raise"
  | "start_license_negotiation"
  | "abandon_now";
type Availability = "available" | "future_conditional";

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

type FundingAssumptions = {
  coverageHazardEta: 1;
};

type LicenseAssumptions = {
  dealProbability: number;
  royaltySelfSufficiencyProbability: number;
};

type ActionRule = {
  action: CurrentAction;
  label: string;
  availability: Availability;
  revenueScale: number;
  revenueDelayMonths: number;
  cogsScale: number;
  sgaScale: number;
  researchScale: number;
  capexScale: number;
  capexDelayMonths: number;
  extraCost: number;
  terminalValueScale: number;
  probabilityDeltas: Partial<ProbabilityInputs>;
};

type Scenario = {
  id: ScenarioId;
  label: string;
  openingCash: number;
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
  facilityCapex: number;
  secondUnitResidualCapex: number;
  startupCapex: number;
  growthCapexShareOfSales: number;
  remainingAccountsPayable: number;
  grantAdvanceLiabilityAtValuation: number;
  grantAdvanceRecognitionMonths: number;
  grantRefundFractionOnExit: number;
  noncurrentAssetRecoveryFraction: number;
  closureCost: number;
  probability: ProbabilityInputs;
  funding: FundingAssumptions;
  license: LicenseAssumptions;
  actions: Record<CurrentAction, ActionRule>;
};

type MonthlyRow = {
  monthIndex: number;
  month: string;
  fiscalYearEnding: number;
  evidenceStatus: "estimated";
  revenue: number;
  licenseProceeds: number;
  cogs: number;
  sga: number;
  researchExpense: number;
  operatingProfit: number;
  capex: number;
  grantReceipts: number;
  tax: number;
  workingCapitalDelta: number;
  economicCashFlow: number;
  debtPrincipal: number;
  interestExpense: number;
  accountsPayableSettlement: number;
  financingInflows: number;
  financingEventId: string | null;
  netCashFlow: number;
  endingCash: number;
};

type PhysicalGate = {
  gateId: string;
  monthIndex: number;
  probability: number;
  sourceParameterIds: string[];
  financingEventId: string | null;
  note: string;
};

type V03Artifact = {
  schema: string;
  valuationDate: string;
  informationCutoff: string;
  calculationHash: string;
  auditedSource: Record<string, unknown>;
  auditedObservations: Record<string, unknown> & { noncurrentAssets: number };
  parameterProvenance: unknown[];
  scenarios: Array<{
    scenarioId: ScenarioId;
    label: string;
    inputs: Record<string, unknown> & {
      minimumCash: number;
      annualDiscountRate: number;
      terminalGrowth: number;
      terminalReinvestmentRate: number;
      postHorizonRevenueGrowth: number[];
      postHorizonEbitMargin: number[];
      netWorkingCapitalShareOfAnnualRevenue: number;
      annualRevenue: Record<string, number>;
      annualFixedCost: Record<string, number>;
      contributionMargin: number;
      facilityCapex: number;
      secondUnitResidualCapex: number;
      startupCapex: number;
      growthCapexShareOfSales: number;
      probability: ProbabilityInputs;
    };
    auditedRollForward: {
      openingUnrestrictedCashAtValuation: number;
      remainingAccountsPayableAtValuation: number;
      grantAdvanceLiabilityAtValuation: number;
    };
    exitAssumptions: {
      grantAdvanceRecognitionMonths: number;
      grantRefundFractionOnExit: number;
      noncurrentAssetRecoveryFraction: number;
      closureCost: number;
    };
  }>;
};

type V03RawScenario = V03Artifact["scenarios"][number] & {
  auditedRollForward: V03Artifact["scenarios"][number]["auditedRollForward"] & {
    postBalanceSheetOperatingSpend: number;
    postBalanceSheetCapex: number;
    accountsPayableSettlement: number;
    postBalanceSheetJkissCash: number;
    grantAdvanceRecognitionNonCash: number;
    restrictedCash: { restrictedCashAt20260331: number };
  };
};

const round = (value: number, digits = 6) => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};
const clamp = (value: number, low = 0, high = 1) =>
  Math.min(high, Math.max(low, value));
const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};
const clone = <T,>(value: T): T => structuredClone(value);
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

const FUNDING: Record<ScenarioId, FundingAssumptions> = {
  low: { coverageHazardEta: 1 },
  central: { coverageHazardEta: 1 },
  high: { coverageHazardEta: 1 },
};

const LICENSE: Record<ScenarioId, LicenseAssumptions> = {
  low: {
    dealProbability: 0.32,
    royaltySelfSufficiencyProbability: 0.35,
  },
  central: {
    dealProbability: 0.48,
    royaltySelfSufficiencyProbability: 0.5,
  },
  high: {
    dealProbability: 0.64,
    royaltySelfSufficiencyProbability: 0.65,
  },
};

const ACTIONS: Record<CurrentAction, ActionRule> = {
  continue_and_raise: {
    action: "continue_and_raise",
    label: "現行開発・量産計画を続行し必要資金を調達",
    availability: "available",
    revenueScale: 1,
    revenueDelayMonths: 0,
    cogsScale: 1,
    sgaScale: 1,
    researchScale: 1,
    capexScale: 1,
    capexDelayMonths: 0,
    extraCost: 0,
    terminalValueScale: 1,
    probabilityDeltas: {},
  },
  staged_scale_down_and_raise: {
    action: "staged_scale_down_and_raise",
    label: "支出と設備を段階縮小し、必要資金を調達",
    availability: "future_conditional",
    revenueScale: 0.58,
    revenueDelayMonths: 3,
    cogsScale: 1.08,
    sgaScale: 0.7,
    researchScale: 0.8,
    capexScale: 0.58,
    capexDelayMonths: 0,
    extraCost: 20,
    terminalValueScale: 0.62,
    probabilityDeltas: {
      quality: 0.05,
      firstShipment: -0.03,
      onTimeSlopeReach: 0.05,
      capitalIndependence: -0.12,
    },
  },
  start_license_negotiation: {
    action: "start_license_negotiation",
    label: "知財・膜・装置のライセンス交渉を開始",
    availability: "future_conditional",
    revenueScale: 0.12,
    revenueDelayMonths: 9,
    cogsScale: 0.2,
    sgaScale: 0.28,
    researchScale: 0.35,
    capexScale: 0.12,
    capexDelayMonths: 3,
    extraCost: 60,
    terminalValueScale: 0.3,
    probabilityDeltas: {},
  },
  abandon_now: {
    action: "abandon_now",
    label: "現在撤退して会社保有PJ資産を処分",
    availability: "available",
    revenueScale: 0,
    revenueDelayMonths: 0,
    cogsScale: 0,
    sgaScale: 0,
    researchScale: 0,
    capexScale: 0,
    capexDelayMonths: 0,
    extraCost: 0,
    terminalValueScale: 0,
    probabilityDeltas: {},
  },
};

const FUTURE_ONLY_ACTIONS = [
  {
    action: "wait",
    availability: "future_conditional",
    reason: "情報価値、待機burn、信用・期限損失を同じ台帳でまだ測れていない",
  },
  {
    action: "retry",
    availability: "future_conditional",
    reason: "再試行を解放する品質失敗と追加試験契約が未観測",
  },
  {
    action: "pivot",
    availability: "future_conditional",
    reason: "代替拠点の権利、費用、所要時間が未確定",
  },
  {
    action: "scale_up",
    availability: "future_conditional",
    reason: "品質確認と拡張資金条件が未確定",
  },
] as const;

function distributedAnnual(total: number, year: number): number[] {
  const indices = Array.from({ length: MONTHS }, (_, index) => index).filter(
    (index) =>
      fyEnding(addMonths(new Date("2026-08-01T00:00:00Z"), index)) === year,
  );
  if (indices.length === 0 || total === 0) return Array(MONTHS).fill(0);
  const weights = indices.map((_, index) => 1 + index * 0.04);
  const denominator = weights.reduce((sum, value) => sum + value, 0);
  const result = Array<number>(MONTHS).fill(0);
  indices.forEach((monthIndex, index) => {
    result[monthIndex] = (total * weights[index]) / denominator;
  });
  return result;
}

function shift(values: number[], months: number): number[] {
  return Array.from({ length: MONTHS }, (_, index) =>
    index - months >= 0 ? values[index - months] : 0,
  );
}

function addDelta(
  base: ProbabilityInputs,
  deltas: Partial<ProbabilityInputs>,
): ProbabilityInputs {
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [
      key,
      clamp(value + (deltas[key as keyof ProbabilityInputs] ?? 0)),
    ]),
  ) as ProbabilityInputs;
}

function loadScenarios(v03: V03Artifact): Scenario[] {
  return v03.scenarios.map((source) => {
    const annualRevenue = Object.fromEntries(
      Object.entries(source.inputs.annualRevenue).map(([year, value]) => [
        Number(year),
        value,
      ]),
    );
    const annualFixedCost = Object.fromEntries(
      Object.entries(source.inputs.annualFixedCost).map(([year, value]) => [
        Number(year),
        value,
      ]),
    );
    return {
      id: source.scenarioId,
      label: source.label,
      openingCash: source.auditedRollForward.openingUnrestrictedCashAtValuation,
      minimumCash: source.inputs.minimumCash,
      annualDiscountRate: source.inputs.annualDiscountRate,
      terminalGrowth: source.inputs.terminalGrowth,
      terminalReinvestmentRate: source.inputs.terminalReinvestmentRate,
      postHorizonRevenueGrowth: [...source.inputs.postHorizonRevenueGrowth],
      postHorizonEbitMargin: [...source.inputs.postHorizonEbitMargin],
      netWorkingCapitalShareOfAnnualRevenue:
        source.inputs.netWorkingCapitalShareOfAnnualRevenue,
      annualRevenue,
      annualFixedCost,
      contributionMargin: source.inputs.contributionMargin,
      facilityCapex: source.inputs.facilityCapex,
      secondUnitResidualCapex: source.inputs.secondUnitResidualCapex,
      startupCapex: source.inputs.startupCapex,
      growthCapexShareOfSales: source.inputs.growthCapexShareOfSales,
      remainingAccountsPayable:
        source.auditedRollForward.remainingAccountsPayableAtValuation,
      grantAdvanceLiabilityAtValuation:
        source.auditedRollForward.grantAdvanceLiabilityAtValuation,
      grantAdvanceRecognitionMonths:
        source.exitAssumptions.grantAdvanceRecognitionMonths,
      grantRefundFractionOnExit:
        source.exitAssumptions.grantRefundFractionOnExit,
      noncurrentAssetRecoveryFraction:
        source.exitAssumptions.noncurrentAssetRecoveryFraction,
      closureCost: source.exitAssumptions.closureCost,
      probability: clone(source.inputs.probability),
      funding: clone(FUNDING[source.scenarioId]),
      license: clone(LICENSE[source.scenarioId]),
      actions: clone(ACTIONS),
    };
  });
}

function remainingGrantAdvance(scenario: Scenario, monthIndex: number) {
  if (monthIndex < 0) return scenario.grantAdvanceLiabilityAtValuation;
  return round(
    scenario.grantAdvanceLiabilityAtValuation *
      Math.max(
        0,
        1 - (monthIndex + 1) / scenario.grantAdvanceRecognitionMonths,
      ),
  );
}

function exitSettlement(
  scenario: Scenario,
  auditedNoncurrentAssets: number,
  monthIndex: number,
) {
  const grantAdvance = remainingGrantAdvance(scenario, monthIndex);
  const assetRecovery =
    auditedNoncurrentAssets * scenario.noncurrentAssetRecoveryFraction;
  const grantRefund = grantAdvance * scenario.grantRefundFractionOnExit;
  return {
    monthIndex,
    auditedNoncurrentAssetBookValue: auditedNoncurrentAssets,
    assetRecoveryFraction: scenario.noncurrentAssetRecoveryFraction,
    estimatedAssetRecovery: round(assetRecovery),
    closureCost: scenario.closureCost,
    remainingGrantAdvanceLiability: round(grantAdvance),
    grantRefundFraction: scenario.grantRefundFractionOnExit,
    estimatedGrantRefund: round(grantRefund),
    netExitSettlement: round(
      assetRecovery - scenario.closureCost - grantRefund,
    ),
  };
}

function rawMonthlyRows(scenario: Scenario, rule: ActionRule): MonthlyRow[] {
  if (rule.action === "abandon_now") {
    return Array.from({ length: MONTHS }, (_, monthIndex) => ({
      monthIndex,
      month: monthKey(monthIndex),
      fiscalYearEnding: fyEnding(
        addMonths(new Date("2026-08-01T00:00:00Z"), monthIndex),
      ),
      evidenceStatus: "estimated" as const,
      revenue: 0,
      licenseProceeds: 0,
      cogs: 0,
      sga: 0,
      researchExpense: 0,
      operatingProfit: 0,
      capex: 0,
      grantReceipts: 0,
      tax: 0,
      workingCapitalDelta: 0,
      economicCashFlow: 0,
      debtPrincipal: 0,
      interestExpense: 0,
      accountsPayableSettlement: 0,
      financingInflows: 0,
      financingEventId: null,
      netCashFlow: 0,
      endingCash: scenario.openingCash,
    }));
  }
  const annualRevenue = Object.entries(scenario.annualRevenue).reduce(
    (result, [year, total]) => {
      const annual = distributedAnnual(total, Number(year));
      return result.map((value, index) => value + annual[index]);
    },
    Array<number>(MONTHS).fill(0),
  );
  const annualFixed = Object.entries(scenario.annualFixedCost).reduce(
    (result, [year, total]) => {
      const annual = distributedAnnual(total, Number(year));
      return result.map((value, index) => value + annual[index]);
    },
    Array<number>(MONTHS).fill(0),
  );
  const retention =
    1 - RECYCLING_SHARE * (1 - scenario.probability.blackMass);
  const revenue = shift(annualRevenue, rule.revenueDelayMonths).map(
    (value) => value * rule.revenueScale * retention,
  );
  const sga = annualFixed.map((value) => value * rule.sgaScale);
  const research = Array<number>(MONTHS).fill(0);
  for (let index = 0; index < 6; index += 1) {
    research[index] += (rule.extraCost * rule.researchScale) / 6;
  }
  const capex = Array<number>(MONTHS).fill(0);
  const putCapex = (index: number, amount: number) => {
    if (index >= 0 && index < MONTHS) capex[index] += amount * rule.capexScale;
  };
  putCapex(
    3 + rule.capexDelayMonths,
    scenario.secondUnitResidualCapex / 2,
  );
  putCapex(
    6 + rule.capexDelayMonths,
    scenario.secondUnitResidualCapex / 2,
  );
  for (let index = 0; index < 12; index += 1) {
    putCapex(
      1 + rule.capexDelayMonths + index,
      scenario.facilityCapex / 12,
    );
  }
  for (let index = 0; index < 6; index += 1) {
    putCapex(
      18 + rule.capexDelayMonths + index,
      scenario.startupCapex / 6,
    );
  }
  revenue.forEach((value, index) => {
    capex[index] += value * scenario.growthCapexShareOfSales;
  });
  const licenseProceeds = Array<number>(MONTHS).fill(0);
  let debtBalance = 80;
  let taxLossCarryforward = 0;
  let priorWorkingCapital = 0;
  return Array.from({ length: MONTHS }, (_, monthIndex) => {
    const baseRevenue = revenue[monthIndex];
    const proceeds = licenseProceeds[monthIndex];
    const totalRevenue = baseRevenue + proceeds;
    const cogs =
      baseRevenue * (1 - scenario.contributionMargin) * rule.cogsScale;
    const operatingProfit =
      totalRevenue - cogs - sga[monthIndex] - research[monthIndex];
    const taxable = Math.max(0, operatingProfit - taxLossCarryforward);
    const tax = taxable * TAX_RATE;
    taxLossCarryforward = Math.max(
      0,
      taxLossCarryforward - Math.max(0, operatingProfit),
    );
    if (operatingProfit < 0) taxLossCarryforward += -operatingProfit;
    const workingCapital =
      baseRevenue * 12 * scenario.netWorkingCapitalShareOfAnnualRevenue;
    const workingCapitalDelta = workingCapital - priorWorkingCapital;
    priorWorkingCapital = workingCapital;
    const interestRate = monthIndex < 21 ? 0.02 : 0.025;
    const interestExpense = (debtBalance * interestRate) / 12;
    const debtPrincipal =
      monthIndex >= 34 ? Math.min(80 / 60, debtBalance) : 0;
    debtBalance -= debtPrincipal;
    const economicCashFlow =
      operatingProfit - capex[monthIndex] - tax - workingCapitalDelta;
    return {
      monthIndex,
      month: monthKey(monthIndex),
      fiscalYearEnding: fyEnding(
        addMonths(new Date("2026-08-01T00:00:00Z"), monthIndex),
      ),
      evidenceStatus: "estimated" as const,
      revenue: round(totalRevenue),
      licenseProceeds: round(proceeds),
      cogs: round(cogs),
      sga: round(sga[monthIndex]),
      researchExpense: round(research[monthIndex]),
      operatingProfit: round(operatingProfit),
      capex: round(capex[monthIndex]),
      grantReceipts: 0,
      tax: round(tax),
      workingCapitalDelta: round(workingCapitalDelta),
      economicCashFlow: round(economicCashFlow),
      debtPrincipal: round(debtPrincipal),
      interestExpense: round(interestExpense),
      accountsPayableSettlement:
        monthIndex === 0 ? scenario.remainingAccountsPayable : 0,
      financingInflows: 0,
      financingEventId: null,
      netCashFlow: 0,
      endingCash: 0,
    };
  });
}

function rebuildLiquidity(rows: MonthlyRow[], scenario: Scenario) {
  const baseNet = rows.map(
    (row) =>
      row.economicCashFlow -
      row.interestExpense -
      row.debtPrincipal -
      row.accountsPayableSettlement,
  );
  let cashWithoutFunding = scenario.openingCash;
  let minimumWithoutFunding = cashWithoutFunding;
  let firstBufferBreach: string | null = null;
  for (let index = 0; index < MONTHS; index += 1) {
    cashWithoutFunding += baseNet[index];
    minimumWithoutFunding = Math.min(minimumWithoutFunding, cashWithoutFunding);
    if (
      cashWithoutFunding < scenario.minimumCash &&
      firstBufferBreach === null
    ) {
      firstBufferBreach = rows[index].month;
    }
  }
  let cashToRound = scenario.openingCash;
  let minimumBeforeRound = cashToRound;
  for (let index = 0; index < 8; index += 1) {
    cashToRound += baseNet[index];
    minimumBeforeRound = Math.min(minimumBeforeRound, cashToRound);
  }
  const bridgeFunding = round(
    Math.max(0, scenario.minimumCash - minimumBeforeRound),
  );
  let cashAfterBridge = scenario.openingCash;
  let minimumAfterRound = Number.POSITIVE_INFINITY;
  for (let index = 0; index < MONTHS; index += 1) {
    cashAfterBridge += baseNet[index] + (index === 0 ? bridgeFunding : 0);
    if (index >= 8) minimumAfterRound = Math.min(minimumAfterRound, cashAfterBridge);
  }
  const largeRoundFunding = round(
    Math.max(0, scenario.minimumCash - minimumAfterRound),
  );
  let cash = scenario.openingCash;
  const rebuiltRows = rows.map((row, index) => {
    const financingInflows =
      (index === 0 ? bridgeFunding : 0) +
      (index === 8 ? largeRoundFunding : 0);
    cash += baseNet[index] + financingInflows;
    return {
      ...row,
      financingInflows: round(financingInflows),
      financingEventId:
        index === 0 && bridgeFunding > 0
          ? "bridge_2026_08"
          : index === 8 && largeRoundFunding > 0
            ? "large_round_2027_04"
            : null,
      netCashFlow: round(baseNet[index] + financingInflows),
      endingCash: round(cash),
    };
  });
  const minimumWithFunding = Math.min(
    scenario.openingCash,
    ...rebuiltRows.map((row) => row.endingCash),
  );
  return {
    rows: rebuiltRows,
    schedule: [
      {
        financingEventId: "bridge_2026_08",
        monthIndex: 0,
        month: "2026-08",
        requiredAmount: bridgeFunding,
      },
      {
        financingEventId: "large_round_2027_04",
        monthIndex: 8,
        month: "2027-04",
        requiredAmount: largeRoundFunding,
      },
    ],
    bridgeFunding,
    largeRoundFunding,
    totalFunding: round(bridgeFunding + largeRoundFunding),
    minimumCashWithoutFunding: round(minimumWithoutFunding),
    minimumCashWithFunding: round(minimumWithFunding),
    firstMinimumBufferBreachWithoutFunding: firstBufferBreach,
    financingExcludedFromEconomicValue: true,
  };
}

function fundingCoverageProbabilities(
  continueCoverageProbability: number,
  actionFunding: { bridgeFunding: number; largeRoundFunding: number },
  continueFunding: { bridgeFunding: number; largeRoundFunding: number },
) {
  const actionTotal = actionFunding.bridgeFunding + actionFunding.largeRoundFunding;
  const continueTotal =
    continueFunding.bridgeFunding + continueFunding.largeRoundFunding;
  assert.ok(continueTotal > 0);
  const actionProbability =
    actionTotal <= 0
      ? 1
      : clamp(
          continueCoverageProbability ** (actionTotal / continueTotal),
        );
  const bridgeProbability =
    actionTotal <= 0
      ? 1
      : clamp(actionProbability ** (actionFunding.bridgeFunding / actionTotal));
  const largeRoundProbability =
    actionTotal <= 0
      ? 1
      : clamp(
          actionProbability ** (actionFunding.largeRoundFunding / actionTotal),
        );
  return {
    continueCoverageProbability,
    continueRequiredFunding: round(continueTotal),
    actionRequiredFunding: round(actionTotal),
    actionProbability: round(actionProbability, 12),
    bridgeProbability: round(bridgeProbability, 12),
    largeRoundProbability: round(largeRoundProbability, 12),
    eta: 1,
  };
}

function correlatedJoint(
  left: number,
  right: number,
  commonStateWeight: number,
) {
  return clamp(
    (1 - commonStateWeight) * left * right +
      commonStateWeight * Math.min(left, right),
    Math.max(0, left + right - 1),
    Math.min(left, right),
  );
}

function scenarioGateMonths(id: ScenarioId) {
  const months: Record<ScenarioId, Record<string, number>> = {
    low: {
      secondUnit: 8,
      site: 17,
      quality: 29,
      firstShipment: 43,
      timing: 54,
      capitalIndependence: 55,
    },
    central: {
      secondUnit: 6,
      site: 10,
      quality: 19,
      firstShipment: 31,
      timing: 54,
      capitalIndependence: 55,
    },
    high: {
      secondUnit: 4,
      site: 7,
      quality: 14,
      firstShipment: 23,
      timing: 46,
      capitalIndependence: 47,
    },
  };
  return months[id];
}

function internalDevelopmentGates(
  scenario: Scenario,
  rule: ActionRule,
  liquidity: ReturnType<typeof rebuildLiquidity>,
  continueLiquidity: ReturnType<typeof rebuildLiquidity>,
) {
  const p = addDelta(scenario.probability, rule.probabilityDeltas);
  const funding = fundingCoverageProbabilities(
    scenario.probability.largeFinancing,
    liquidity,
    continueLiquidity,
  );
  const bridgeProbability = funding.bridgeProbability;
  const largeRoundProbability = funding.largeRoundProbability;
  const siteProbability = clamp(
    p.kawasaki + (1 - p.kawasaki) * p.alternativeFacilityRescue,
  );
  const jointKawasakiAndFunding = correlatedJoint(
    p.kawasaki,
    funding.actionProbability,
    p.policyCorrelation,
  );
  const siteAndFunding = clamp(
    jointKawasakiAndFunding +
      p.alternativeFacilityRescue *
        (funding.actionProbability - jointKawasakiAndFunding),
  );
  const siteGivenFunded =
    funding.actionProbability > 0
      ? clamp(siteAndFunding / funding.actionProbability)
      : 0;
  const timingProbability = clamp(
    0.5 * p.onTimeSlopeReach + 0.5 * p.delayedSlopeReach,
  );
  const months = scenarioGateMonths(scenario.id);
  const delay = rule.action === "staged_scale_down_and_raise" ? 3 : 0;
  const gates: PhysicalGate[] = [
    {
      gateId: "bridge_financing",
      monthIndex: 0,
      probability: bridgeProbability,
      sourceParameterIds: [
        "probability.largeFinancing",
        "funding.coverageHazardEta",
      ],
      financingEventId: "bridge_2026_08",
      note: "月0の必要bridge額を全額満たす条件付き確率",
    },
    {
      gateId: "second_unit",
      monthIndex: Math.min(55, months.secondUnit + delay),
      probability: p.secondUnit,
      sourceParameterIds: ["probability.secondUnit"],
      financingEventId: null,
      note: "2号機の物理到達",
    },
  ];
  gates.push(
    {
      gateId: "large_round_financing",
      monthIndex: 8,
      probability: largeRoundProbability,
      sourceParameterIds: [
        "probability.largeFinancing",
        "funding.coverageHazardEta",
      ],
      financingEventId: "large_round_2027_04",
      note: "月8の必要大型調達額を全額満たす確率",
    },
    {
      gateId: "site_access_given_full_funding",
      monthIndex: Math.min(55, Math.max(8, months.site + delay)),
      probability: siteGivenFunded,
      sourceParameterIds: [
        "probability.kawasaki",
        "probability.alternativeFacilityRescue",
        "probability.policyCorrelation",
        "probability.largeFinancing",
      ],
      financingEventId: null,
      note:
        "全action資金schedule充足条件下の川崎または代替拠点到達。物理的拠点到達が月8より早いscenarioでも、結合状態はfull funding確定時に判定して先読みを避ける",
    },
  );
  gates.push(
    {
      gateId: "quality",
      monthIndex: Math.min(55, months.quality + delay),
      probability: p.quality,
      sourceParameterIds: ["probability.quality"],
      financingEventId: null,
      note: "量産品質到達",
    },
    {
      gateId: "first_shipment",
      monthIndex: Math.min(55, months.firstShipment + delay),
      probability: p.firstShipment,
      sourceParameterIds: ["probability.firstShipment"],
      financingEventId: null,
      note: "初回有償出荷",
    },
    {
      gateId: "timing",
      monthIndex: Math.min(55, months.timing + delay),
      probability: timingProbability,
      sourceParameterIds: [
        "probability.onTimeSlopeReach",
        "probability.delayedSlopeReach",
      ],
      financingEventId: null,
      note: "期限内到達。待機や遅延の外生加点なし",
    },
    {
      gateId: "capital_independence",
      monthIndex: Math.min(55, months.capitalIndependence + delay),
      probability: p.capitalIndependence,
      sourceParameterIds: ["probability.capitalIndependence"],
      financingEventId: null,
      note: "資本自立条件への物理到達。q合わせの逆算を行わない",
    },
  );
  return {
    gates: gates.sort(
      (left, right) =>
        left.monthIndex - right.monthIndex ||
        left.gateId.localeCompare(right.gateId),
    ),
    decomposition: {
      probabilityInputsAfterAction: p,
      fundingCoverage: funding,
      bridgeProbability: round(bridgeProbability),
      largeRoundProbability: round(largeRoundProbability),
      siteProbabilityWithoutFundingCondition: round(siteProbability),
      jointKawasakiAndFullFunding: round(jointKawasakiAndFunding),
      siteAndFunding: round(siteAndFunding),
      siteGivenFunded: round(siteGivenFunded),
      timingProbability: round(timingProbability),
      recyclingRevenueRetention: round(
        1 - RECYCLING_SHARE * (1 - p.blackMass),
      ),
    },
  };
}

function licenseGates(
  scenario: Scenario,
  rule: ActionRule,
  liquidity: ReturnType<typeof rebuildLiquidity>,
  continueLiquidity: ReturnType<typeof rebuildLiquidity>,
) {
  const funding = fundingCoverageProbabilities(
    scenario.probability.largeFinancing,
    liquidity,
    continueLiquidity,
  );
  const bridgeProbability = funding.bridgeProbability;
  const interimFundingProbability = funding.largeRoundProbability;
  const gates: PhysicalGate[] = [
    {
      gateId: "bridge_financing",
      monthIndex: 0,
      probability: bridgeProbability,
      sourceParameterIds: [
        "probability.largeFinancing",
        "funding.coverageHazardEta",
      ],
      financingEventId: "bridge_2026_08",
      note: "交渉開始から相手方入金までの必要bridgeを満たす確率",
    },
    {
      gateId: "interim_financing",
      monthIndex: 8,
      probability: interimFundingProbability,
      sourceParameterIds: [
        "probability.largeFinancing",
        "funding.coverageHazardEta",
      ],
      financingEventId: "large_round_2027_04",
      note: "交渉継続に必要な月8資金を満たす確率",
    },
    {
      gateId: "license_deal",
      monthIndex: 9,
      probability: scenario.license.dealProbability,
      sourceParameterIds: ["license.dealProbability"],
      financingEventId: null,
      note: "交渉開始と相手方受諾を分けたdeal成立確率",
    },
  ];
  return {
    gates: gates.sort(
      (left, right) =>
        left.monthIndex - right.monthIndex ||
        left.gateId.localeCompare(right.gateId),
    ),
    decomposition: {
      bridgeProbability: round(bridgeProbability),
      interimFundingProbability: round(interimFundingProbability),
      fundingCoverage: funding,
      dealProbability: scenario.license.dealProbability,
      royaltySelfSufficiencyProbability:
        scenario.license.royaltySelfSufficiencyProbability,
    },
  };
}

function successValueAt2031(scenario: Scenario, rule: ActionRule) {
  let revenue = scenario.annualRevenue[2031] * rule.revenueScale;
  let priorRevenue = revenue;
  const years = scenario.postHorizonRevenueGrowth.map((growth, index) => {
    revenue *= 1 + growth;
    const ebitMargin = scenario.postHorizonEbitMargin[index];
    const afterTaxEbit = revenue * ebitMargin * (1 - TAX_RATE);
    const reinvestment = revenue * scenario.terminalReinvestmentRate;
    const workingCapitalInvestment =
      (revenue - priorRevenue) * scenario.netWorkingCapitalShareOfAnnualRevenue;
    const freeCashFlow =
      afterTaxEbit - reinvestment - workingCapitalInvestment;
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
  assert.ok(scenario.annualDiscountRate > scenario.terminalGrowth);
  const terminalValueAt2036 =
    (finalFcf * (1 + scenario.terminalGrowth)) /
    (scenario.annualDiscountRate - scenario.terminalGrowth);
  const terminalValueAt2031 =
    terminalValueAt2036 /
    (1 + scenario.annualDiscountRate) ** years.length;
  const raw =
    years.reduce((sum, year) => sum + year.presentValueAt2031, 0) +
    terminalValueAt2031;
  const retention =
    1 - RECYCLING_SHARE * (1 - scenario.probability.blackMass);
  return {
    rawBeforeActionAndBlackMass: round(raw),
    terminalValueAt2031: round(terminalValueAt2031),
    actionScale: rule.terminalValueScale,
    recyclingRevenueRetention: round(retention),
    valueAt2031: round(raw * rule.terminalValueScale * retention),
    years,
  };
}

function evaluatePath(
  scenario: Scenario,
  rows: MonthlyRow[],
  valueGates: PhysicalGate[],
  continuationPresent: number,
  auditedNoncurrentAssets: number,
) {
  const monthlyRate = (1 + scenario.annualDiscountRate) ** (1 / 12) - 1;
  let survival = 1;
  let expectedPathCashFlowPresent = 0;
  let expectedFailureExitPresent = 0;
  const gateTrace: Array<
    PhysicalGate & {
      survivalBefore: number;
      failureProbability: number;
      survivalAfter: number;
      exitSettlement: ReturnType<typeof exitSettlement>;
      failureExitPresentContribution: number;
    }
  > = [];
  for (const row of rows) {
    for (const gate of valueGates.filter(
      (candidate) => candidate.monthIndex === row.monthIndex,
    )) {
      const survivalBefore = survival;
      const failureProbability = survivalBefore * (1 - gate.probability);
      const settlement = exitSettlement(
        scenario,
        auditedNoncurrentAssets,
        row.monthIndex,
      );
      const contribution =
        (failureProbability * settlement.netExitSettlement) /
        (1 + monthlyRate) ** (row.monthIndex + 1);
      expectedFailureExitPresent += contribution;
      survival *= gate.probability;
      gateTrace.push({
        ...gate,
        probability: round(gate.probability),
        survivalBefore: round(survivalBefore),
        failureProbability: round(failureProbability),
        survivalAfter: round(survival),
        exitSettlement: settlement,
        failureExitPresentContribution: round(contribution),
      });
    }
    expectedPathCashFlowPresent +=
      (survival * row.economicCashFlow) /
      (1 + monthlyRate) ** (row.monthIndex + 1);
  }
  const expectedSuccessValuePresent = survival * continuationPresent;
  return {
    physicalQ: round(survival),
    physicalQDirectProduct: round(
      valueGates.reduce((product, gate) => product * gate.probability, 1),
    ),
    expectedPathCashFlowPresentMillionJpy: round(
      expectedPathCashFlowPresent,
    ),
    expectedSuccessValuePresentMillionJpy: round(
      expectedSuccessValuePresent,
    ),
    expectedFailureExitPresentMillionJpy: round(
      expectedFailureExitPresent,
    ),
    expectedNetValueMillionJpy: round(
      expectedPathCashFlowPresent +
        expectedSuccessValuePresent +
        expectedFailureExitPresent,
    ),
    gateTrace,
  };
}

function evaluateAction(
  scenario: Scenario,
  action: CurrentAction,
  auditedNoncurrentAssets: number,
  continueLiquidity: ReturnType<typeof rebuildLiquidity> | null = null,
) {
  const rule = scenario.actions[action];
  const immediateExit = exitSettlement(scenario, auditedNoncurrentAssets, -1);
  if (action === "abandon_now") {
    const rows = rawMonthlyRows(scenario, rule);
    let cash = scenario.openingCash;
    rows[0].economicCashFlow = immediateExit.netExitSettlement;
    rows[0].accountsPayableSettlement = scenario.remainingAccountsPayable;
    rows[0].netCashFlow = round(
      immediateExit.netExitSettlement - scenario.remainingAccountsPayable,
    );
    cash += rows[0].netCashFlow;
    rows[0].endingCash = round(cash);
    for (let index = 1; index < rows.length; index += 1) {
      rows[index].endingCash = round(cash);
    }
    return {
      action,
      label: rule.label,
      currentAvailability: rule.availability,
      selected: false,
      companyHeldProjectFutureNetValueDefinition:
        "valuation-date-forward company-held PJ cash flows and PJ exit settlement; financing receipts, financing service and pre-valuation sunk costs excluded; only differences between actions are incremental values",
      physicalQ: 0,
      physicalQDirectProduct: 0,
      physicalQFormula: "0 (abandon terminal)",
      probabilityDecomposition: {},
      expectedNetValueMillionJpy: immediateExit.netExitSettlement,
      expectedPathCashFlowPresentMillionJpy:
        immediateExit.netExitSettlement,
      expectedSuccessValuePresentMillionJpy: 0,
      expectedFailureExitPresentMillionJpy: 0,
      conditionalSuccessPathValueMillionJpy: null,
      successValueDcf: null,
      continuingValuePresentMillionJpy: 0,
      exitSettlement: immediateExit,
      gateTrace: [],
      requiredFundingSchedule: [],
      totalAdditionalFundingRequiredMillionJpy: 0,
      minimumCashWithoutFundingMillionJpy: rows[0].endingCash,
      minimumCashWithFundingMillionJpy: rows[0].endingCash,
      firstMinimumBufferBreachWithoutFunding:
        rows[0].endingCash < scenario.minimumCash ? "2026-08" : null,
      cashFeasibilityConditionalOnFundingSuccess:
        rows[0].endingCash >= scenario.minimumCash,
      financingReceiptsIncludedInEconomicValue: false,
      monthlyCashFlow: rows,
    };
  }
  const rawRows = rawMonthlyRows(scenario, rule);
  const liquidity = rebuildLiquidity(rawRows, scenario);
  const continueReferenceLiquidity =
    continueLiquidity ??
    rebuildLiquidity(
      rawMonthlyRows(scenario, scenario.actions.continue_and_raise),
      scenario,
    );
  const physical =
    action === "start_license_negotiation"
      ? licenseGates(scenario, rule, liquidity, continueReferenceLiquidity)
      : internalDevelopmentGates(
          scenario,
          rule,
          liquidity,
          continueReferenceLiquidity,
        );
  const valueGates = physical.gates;
  const dcf = successValueAt2031(scenario, rule);
  const continuationPresent =
    dcf.valueAt2031 /
    (1 + scenario.annualDiscountRate) ** (MONTHS / 12);
  const pathValue = evaluatePath(
    scenario,
    liquidity.rows,
    valueGates,
    continuationPresent,
    auditedNoncurrentAssets,
  );
  const valuePathProbability = pathValue.physicalQ;
  const goalProbability =
    action === "start_license_negotiation"
      ? round(
          valuePathProbability *
            scenario.license.royaltySelfSufficiencyProbability,
        )
      : pathValue.physicalQ;
  const conditionalPathPresent = liquidity.rows.reduce(
    (sum, row) =>
      sum +
      row.economicCashFlow /
        (1 + scenario.annualDiscountRate) ** ((row.monthIndex + 1) / 12),
    0,
  );
  return {
    action,
    label: rule.label,
    currentAvailability: rule.availability,
    selected: false,
    companyHeldProjectFutureNetValueDefinition:
      "valuation-date-forward company-held PJ cash flows and PJ exit settlement; financing receipts, financing service and pre-valuation sunk costs excluded; only differences between actions are incremental values",
    goalProbability,
    valuePathProbability,
    physicalQ: goalProbability,
    physicalQDirectProduct:
      action === "start_license_negotiation"
        ? round(
            pathValue.physicalQDirectProduct *
              scenario.license.royaltySelfSufficiencyProbability,
          )
        : pathValue.physicalQDirectProduct,
    physicalQFormula:
      action === "start_license_negotiation"
        ? "valuePathProbability = product(value gateTrace); goalProbability = valuePathProbability * license.royaltySelfSufficiencyProbability; no q anchor, calibration multiplier or last-gate inversion"
        : "goalProbability = valuePathProbability = direct product of registered physical transition probabilities in gateTrace; no q anchor, calibration multiplier or last-gate inversion",
    probabilityDecomposition: physical.decomposition,
    expectedNetValueMillionJpy: pathValue.expectedNetValueMillionJpy,
    expectedPathCashFlowPresentMillionJpy:
      pathValue.expectedPathCashFlowPresentMillionJpy,
    expectedSuccessValuePresentMillionJpy:
      pathValue.expectedSuccessValuePresentMillionJpy,
    expectedFailureExitPresentMillionJpy:
      pathValue.expectedFailureExitPresentMillionJpy,
    conditionalSuccessPathValueMillionJpy: round(
      conditionalPathPresent + continuationPresent,
    ),
    successValueDcf: dcf,
    continuingValuePresentMillionJpy: round(continuationPresent),
    exitSettlement: immediateExit,
    gateTrace: pathValue.gateTrace,
    goalOnlyGateTrace:
      action === "start_license_negotiation"
        ? [
            {
              gateId: "royalty_capital_independence",
              monthIndex: scenario.id === "high" ? 47 : 55,
              probability:
                scenario.license.royaltySelfSufficiencyProbability,
              sourceParameterIds: [
                "license.royaltySelfSufficiencyProbability",
              ],
              note: "価値経路には掛けず、資本自立到達qにだけ掛ける",
            },
          ]
        : [],
    requiredFundingSchedule: liquidity.schedule.map((event) => ({
      ...event,
      probabilityGateId:
        physical.gates.find(
          (gate) => gate.financingEventId === event.financingEventId,
        )?.gateId ?? null,
      probability:
        physical.gates.find(
          (gate) => gate.financingEventId === event.financingEventId,
        )?.probability ?? null,
    })),
    totalAdditionalFundingRequiredMillionJpy: liquidity.totalFunding,
    minimumCashWithoutFundingMillionJpy: liquidity.minimumCashWithoutFunding,
    minimumCashWithFundingMillionJpy: liquidity.minimumCashWithFunding,
    firstMinimumBufferBreachWithoutFunding:
      liquidity.firstMinimumBufferBreachWithoutFunding,
    cashFeasibilityConditionalOnFundingSuccess:
      liquidity.minimumCashWithFunding >= scenario.minimumCash - 0.001,
    financingReceiptsIncludedInEconomicValue: false,
    monthlyCashFlow: liquidity.rows,
  };
}

function evaluateScenario(scenario: Scenario, auditedNoncurrentAssets: number) {
  const actionOrder: CurrentAction[] = [
    "continue_and_raise",
    "staged_scale_down_and_raise",
    "start_license_negotiation",
    "abandon_now",
  ];
  const continueLiquidity = rebuildLiquidity(
    rawMonthlyRows(scenario, scenario.actions.continue_and_raise),
    scenario,
  );
  const actions = actionOrder.map((action) =>
    evaluateAction(
      scenario,
      action,
      auditedNoncurrentAssets,
      continueLiquidity,
    ),
  );
  const ranked = [...actions].sort(
    (left, right) =>
      right.expectedNetValueMillionJpy - left.expectedNetValueMillionJpy ||
      left.totalAdditionalFundingRequiredMillionJpy -
        right.totalAdditionalFundingRequiredMillionJpy ||
      actionOrder.indexOf(left.action) - actionOrder.indexOf(right.action),
  );
  const selectedAction = ranked[0].action;
  const strictActions = actions.filter(
    (action) =>
      action.action === "continue_and_raise" || action.action === "abandon_now",
  );
  const strictRanked = [...strictActions].sort(
    (left, right) =>
      right.expectedNetValueMillionJpy - left.expectedNetValueMillionJpy ||
      left.totalAdditionalFundingRequiredMillionJpy -
        right.totalAdditionalFundingRequiredMillionJpy ||
      actionOrder.indexOf(left.action) - actionOrder.indexOf(right.action),
  );
  const strictSelected = strictRanked[0];
  actions.forEach((action) => {
    action.selected = action.action === selectedAction;
  });
  const selected = actions.find((action) => action.selected)!;
  return {
    scenarioId: scenario.id,
    label: scenario.label,
    selectedAction,
    selectedActionTieBreak:
      "highest company-held PJ future net value; exact tie -> lower required funding -> preregistered action order",
    sps21MillionJpy: selected.expectedNetValueMillionJpy,
    selectedPhysicalQ: selected.physicalQ,
    strictEvidenceClosedSelection: {
      actionSet: ["continue_and_raise", "abandon_now"],
      selectedAction: strictSelected.action,
      sps21MillionJpy: strictSelected.expectedNetValueMillionJpy,
      physicalQ: strictSelected.physicalQ,
    },
    provisionalFourCandidateSelection: {
      actionSet: actionOrder,
      selectedAction,
      sps21MillionJpy: selected.expectedNetValueMillionJpy,
      physicalQ: selected.physicalQ,
    },
    decisionStatus:
      "forced_low_precision_argmax_within_four_registered_current_actions_not_operational_recommendation",
    actionValueDifferencesMillionJpy: Object.fromEntries(
      actions.map((action) => [
        `${action.action}_minus_${selectedAction}`,
        round(
          action.expectedNetValueMillionJpy -
            selected.expectedNetValueMillionJpy,
        ),
      ]),
    ),
    inputs: scenario,
    futureOnlyActions: FUTURE_ONLY_ACTIONS,
    actions,
  };
}

type SensitivitySpec = {
  parameterId: string;
  low: number;
  central: number;
  high: number;
  sourceStatus: string;
  apply: (scenario: Scenario, value: number) => void;
};

function sensitivitySpecs(
  scenarios: Record<ScenarioId, Scenario>,
): SensitivitySpec[] {
  const low = scenarios.low;
  const central = scenarios.central;
  const high = scenarios.high;
  const specs: SensitivitySpec[] = [];
  const scenarioPath = (
    parameterId: string,
    lowValue: number,
    centralValue: number,
    highValue: number,
    apply: (scenario: Scenario, value: number) => void,
    sourceStatus = "carried_forward_imputed_v0.3",
  ) => {
    specs.push({
      parameterId,
      low: lowValue,
      central: centralValue,
      high: highValue,
      sourceStatus,
      apply,
    });
  };
  for (const key of Object.keys(central.probability) as Array<
    keyof ProbabilityInputs
  >) {
    scenarioPath(
      `probability.${key}`,
      low.probability[key],
      central.probability[key],
      high.probability[key],
      (scenario, value) => {
        scenario.probability[key] = value;
      },
      "OS_hearing_then_scenario_imputed",
    );
  }
  scenarioPath(
    "annualDiscountRate",
    low.annualDiscountRate,
    central.annualDiscountRate,
    high.annualDiscountRate,
    (scenario, value) => {
      scenario.annualDiscountRate = value;
    },
  );
  scenarioPath(
    "terminalGrowth",
    low.terminalGrowth,
    central.terminalGrowth,
    high.terminalGrowth,
    (scenario, value) => {
      scenario.terminalGrowth = value;
    },
  );
  scenarioPath(
    "terminalReinvestmentRate",
    low.terminalReinvestmentRate,
    central.terminalReinvestmentRate,
    high.terminalReinvestmentRate,
    (scenario, value) => {
      scenario.terminalReinvestmentRate = value;
    },
  );
  for (let index = 0; index < 5; index += 1) {
    scenarioPath(
      `postHorizonRevenueGrowth.${index}`,
      low.postHorizonRevenueGrowth[index],
      central.postHorizonRevenueGrowth[index],
      high.postHorizonRevenueGrowth[index],
      (scenario, value) => {
        scenario.postHorizonRevenueGrowth[index] = value;
      },
    );
    scenarioPath(
      `postHorizonEbitMargin.${index}`,
      low.postHorizonEbitMargin[index],
      central.postHorizonEbitMargin[index],
      high.postHorizonEbitMargin[index],
      (scenario, value) => {
        scenario.postHorizonEbitMargin[index] = value;
      },
    );
  }
  scenarioPath(
    "contributionMargin",
    low.contributionMargin,
    central.contributionMargin,
    high.contributionMargin,
    (scenario, value) => {
      scenario.contributionMargin = value;
    },
  );
  scenarioPath(
    "facilityCapex",
    low.facilityCapex,
    central.facilityCapex,
    high.facilityCapex,
    (scenario, value) => {
      scenario.facilityCapex = value;
    },
  );
  scenarioPath(
    "secondUnitResidualCapex",
    low.secondUnitResidualCapex,
    central.secondUnitResidualCapex,
    high.secondUnitResidualCapex,
    (scenario, value) => {
      scenario.secondUnitResidualCapex = value;
    },
  );
  scenarioPath(
    "startupCapex",
    low.startupCapex,
    central.startupCapex,
    high.startupCapex,
    (scenario, value) => {
      scenario.startupCapex = value;
    },
  );
  scenarioPath(
    "growthCapexShareOfSales",
    low.growthCapexShareOfSales,
    central.growthCapexShareOfSales,
    high.growthCapexShareOfSales,
    (scenario, value) => {
      scenario.growthCapexShareOfSales = value;
    },
  );
  scenarioPath(
    "netWorkingCapitalShareOfAnnualRevenue",
    low.netWorkingCapitalShareOfAnnualRevenue,
    central.netWorkingCapitalShareOfAnnualRevenue,
    high.netWorkingCapitalShareOfAnnualRevenue,
    (scenario, value) => {
      scenario.netWorkingCapitalShareOfAnnualRevenue = value;
    },
  );
  for (const year of [2027, 2028, 2029, 2030, 2031]) {
    scenarioPath(
      `annualRevenue.${year}`,
      low.annualRevenue[year],
      central.annualRevenue[year],
      high.annualRevenue[year],
      (scenario, value) => {
        scenario.annualRevenue[year] = value;
      },
      "frozen_OS_plan_and_scenario_imputed",
    );
    scenarioPath(
      `annualFixedCost.${year}`,
      low.annualFixedCost[year],
      central.annualFixedCost[year],
      high.annualFixedCost[year],
      (scenario, value) => {
        scenario.annualFixedCost[year] = value;
      },
      "frozen_OS_plan_and_scenario_imputed",
    );
  }
  scenarioPath(
    "grantAdvanceRecognitionMonths",
    low.grantAdvanceRecognitionMonths,
    central.grantAdvanceRecognitionMonths,
    high.grantAdvanceRecognitionMonths,
    (scenario, value) => {
      scenario.grantAdvanceRecognitionMonths = value;
    },
    "imputed_from_audited_anchor",
  );
  scenarioPath(
    "grantRefundFractionOnExit",
    low.grantRefundFractionOnExit,
    central.grantRefundFractionOnExit,
    high.grantRefundFractionOnExit,
    (scenario, value) => {
      scenario.grantRefundFractionOnExit = value;
    },
    "imputed_from_audited_anchor",
  );
  scenarioPath(
    "noncurrentAssetRecoveryFraction",
    low.noncurrentAssetRecoveryFraction,
    central.noncurrentAssetRecoveryFraction,
    high.noncurrentAssetRecoveryFraction,
    (scenario, value) => {
      scenario.noncurrentAssetRecoveryFraction = value;
    },
    "imputed_from_audited_anchor",
  );
  scenarioPath(
    "closureCost",
    low.closureCost,
    central.closureCost,
    high.closureCost,
    (scenario, value) => {
      scenario.closureCost = value;
    },
    "imputed_from_audited_anchor",
  );
  scenarioPath(
    "remainingAccountsPayable",
    low.remainingAccountsPayable,
    central.remainingAccountsPayable,
    high.remainingAccountsPayable,
    (scenario, value) => {
      scenario.remainingAccountsPayable = value;
    },
    "imputed_from_audited_anchor",
  );
  scenarioPath(
    "grantAdvanceLiabilityAtValuation",
    low.grantAdvanceLiabilityAtValuation,
    central.grantAdvanceLiabilityAtValuation,
    high.grantAdvanceLiabilityAtValuation,
    (scenario, value) => {
      scenario.grantAdvanceLiabilityAtValuation = value;
    },
    "imputed_from_audited_anchor",
  );
  for (const key of [
    "dealProbability",
    "royaltySelfSufficiencyProbability",
  ] as Array<keyof LicenseAssumptions>) {
    scenarioPath(
      `license.${key}`,
      low.license[key],
      central.license[key],
      high.license[key],
      (scenario, value) => {
        scenario.license[key] = value;
      },
      "v0.4_explicit_low_confidence_imputation",
    );
  }
  const scale = central.actions.staged_scale_down_and_raise;
  const scaleBounds: Array<
    [keyof ActionRule, number, number, number]
  > = [
    ["revenueScale", 0.45, scale.revenueScale, 0.75],
    ["revenueDelayMonths", 6, scale.revenueDelayMonths, 1],
    ["cogsScale", 1.15, scale.cogsScale, 1.02],
    ["sgaScale", 0.6, scale.sgaScale, 0.8],
    ["researchScale", 0.65, scale.researchScale, 0.95],
    ["capexScale", 0.45, scale.capexScale, 0.7],
    ["extraCost", 40, scale.extraCost, 10],
    ["terminalValueScale", 0.45, scale.terminalValueScale, 0.8],
  ];
  for (const [key, lowValue, centralValue, highValue] of scaleBounds) {
    scenarioPath(
      `actions.staged_scale_down_and_raise.${key}`,
      lowValue,
      centralValue as number,
      highValue,
      (scenario, value) => {
        (scenario.actions.staged_scale_down_and_raise[key] as number) = value;
      },
      "v0.4_action_design_imputation",
    );
  }
  for (const key of [
    "quality",
    "firstShipment",
    "onTimeSlopeReach",
    "capitalIndependence",
  ] as Array<keyof ProbabilityInputs>) {
    const centralDelta =
      central.actions.staged_scale_down_and_raise.probabilityDeltas[key] ?? 0;
    const spread = Math.abs(
      (high.probability[key] - low.probability[key]) / 2,
    );
    scenarioPath(
      `actions.staged_scale_down_and_raise.probabilityDeltas.${key}`,
      clamp(centralDelta - spread, -1, 1),
      centralDelta,
      clamp(centralDelta + spread, -1, 1),
      (scenario, value) => {
        scenario.actions.staged_scale_down_and_raise.probabilityDeltas[key] =
          value;
      },
      "v0.4_action_design_imputation",
    );
  }
  const licenseAction = central.actions.start_license_negotiation;
  const licenseBounds: Array<
    [keyof ActionRule, number, number, number]
  > = [
    ["revenueScale", 0.06, licenseAction.revenueScale, 0.24],
    ["revenueDelayMonths", 15, licenseAction.revenueDelayMonths, 4],
    ["cogsScale", 0.3, licenseAction.cogsScale, 0.1],
    ["sgaScale", 0.38, licenseAction.sgaScale, 0.2],
    ["researchScale", 0.5, licenseAction.researchScale, 0.2],
    ["capexScale", 0.18, licenseAction.capexScale, 0.08],
    ["capexDelayMonths", 6, licenseAction.capexDelayMonths, 1],
    ["extraCost", 100, licenseAction.extraCost, 30],
    ["terminalValueScale", 0.15, licenseAction.terminalValueScale, 0.5],
  ];
  for (const [key, lowValue, centralValue, highValue] of licenseBounds) {
    scenarioPath(
      `actions.start_license_negotiation.${key}`,
      lowValue,
      centralValue as number,
      highValue,
      (scenario, value) => {
        (scenario.actions.start_license_negotiation[key] as number) = value;
      },
      "v0.4_action_design_imputation",
    );
  }
  return specs;
}

function compactScenarioResult(
  result: ReturnType<typeof evaluateScenario>,
) {
  return {
    provisionalSelectedAction: result.selectedAction,
    provisionalSps21MillionJpy: result.sps21MillionJpy,
    provisionalSelectedPhysicalQ: result.selectedPhysicalQ,
    strictEvidenceClosedSelection: result.strictEvidenceClosedSelection,
    actionValues: Object.fromEntries(
      result.actions.map((action) => [
        action.action,
        {
          valueMillionJpy: action.expectedNetValueMillionJpy,
          physicalQ: action.physicalQ,
          requiredFundingMillionJpy:
            action.totalAdditionalFundingRequiredMillionJpy,
        },
      ]),
    ),
  };
}

function runOneWaySensitivity(
  scenarios: Record<ScenarioId, Scenario>,
  auditedNoncurrentAssets: number,
  v03Scenarios: Record<ScenarioId, V03RawScenario>,
) {
  const base = evaluateScenario(clone(scenarios.central), auditedNoncurrentAssets);
  return {
    method:
      "hold all central inputs fixed, replace one registered input with its low or high value, and rerun all four current actions",
    baseline: compactScenarioResult(base),
    cases: sensitivitySpecs(scenarios).map((spec) => {
      const lowScenario = clone(scenarios.central);
      spec.apply(lowScenario, spec.low);
      const highScenario = clone(scenarios.central);
      spec.apply(highScenario, spec.high);
      const lowResult = evaluateScenario(lowScenario, auditedNoncurrentAssets);
      const highResult = evaluateScenario(highScenario, auditedNoncurrentAssets);
      return {
        parameterId: spec.parameterId,
        sourceStatus: spec.sourceStatus,
        inputs: {
          low: spec.low,
          central: spec.central,
          high: spec.high,
        },
        lowResult: compactScenarioResult(lowResult),
        centralResult: compactScenarioResult(base),
        highResult: compactScenarioResult(highResult),
        centralSelectedValueRangeAcrossOneWayEndpointsMillionJpy: {
          min: Math.min(
            lowResult.sps21MillionJpy,
            base.sps21MillionJpy,
            highResult.sps21MillionJpy,
          ),
          max: Math.max(
            lowResult.sps21MillionJpy,
            base.sps21MillionJpy,
            highResult.sps21MillionJpy,
          ),
        },
        provisionalActionSwitchesAcrossEndpoints:
          new Set([
            lowResult.selectedAction,
            base.selectedAction,
            highResult.selectedAction,
          ]).size > 1,
        strictActionSwitchesAcrossEndpoints:
          new Set([
            lowResult.strictEvidenceClosedSelection.selectedAction,
            base.strictEvidenceClosedSelection.selectedAction,
            highResult.strictEvidenceClosedSelection.selectedAction,
          ]).size > 1,
      };
    }),
    preValuationRollForwardSensitivity: [
      {
        parameterId: "rollForward.postBalanceSheetOperatingSpend",
        inputs: {
          low: v03Scenarios.low.auditedRollForward.postBalanceSheetOperatingSpend,
          central:
            v03Scenarios.central.auditedRollForward.postBalanceSheetOperatingSpend,
          high: v03Scenarios.high.auditedRollForward.postBalanceSheetOperatingSpend,
        },
      },
      {
        parameterId: "rollForward.postBalanceSheetCapex",
        inputs: {
          low: v03Scenarios.low.auditedRollForward.postBalanceSheetCapex,
          central: v03Scenarios.central.auditedRollForward.postBalanceSheetCapex,
          high: v03Scenarios.high.auditedRollForward.postBalanceSheetCapex,
        },
      },
      {
        parameterId: "rollForward.accountsPayableSettlement",
        inputs: {
          low: v03Scenarios.low.auditedRollForward.accountsPayableSettlement,
          central:
            v03Scenarios.central.auditedRollForward.accountsPayableSettlement,
          high: v03Scenarios.high.auditedRollForward.accountsPayableSettlement,
        },
      },
      {
        parameterId: "rollForward.postBalanceSheetJkissCash",
        inputs: {
          low: v03Scenarios.low.auditedRollForward.postBalanceSheetJkissCash,
          central:
            v03Scenarios.central.auditedRollForward.postBalanceSheetJkissCash,
          high: v03Scenarios.high.auditedRollForward.postBalanceSheetJkissCash,
        },
      },
      {
        parameterId: "rollForward.restrictedCashAt20260331",
        inputs: {
          low: v03Scenarios.low.auditedRollForward.restrictedCash.restrictedCashAt20260331,
          central:
            v03Scenarios.central.auditedRollForward.restrictedCash.restrictedCashAt20260331,
          high: v03Scenarios.high.auditedRollForward.restrictedCash.restrictedCashAt20260331,
        },
      },
      {
        parameterId: "rollForward.grantAdvanceRecognitionNonCash",
        inputs: {
          low: v03Scenarios.low.auditedRollForward.grantAdvanceRecognitionNonCash,
          central:
            v03Scenarios.central.auditedRollForward.grantAdvanceRecognitionNonCash,
          high: v03Scenarios.high.auditedRollForward.grantAdvanceRecognitionNonCash,
        },
      },
    ].map((entry) => ({
      ...entry,
      status:
        "recorded_not_varied_in_v0.4_action_model: these pre-valuation assumptions are compressed into the registered valuation-date opening cash and grant liability; varying them without rerunning the v0.3 roll-forward would double count or invent a mapping",
      decisionImpactInCurrentV04: "none until the upstream roll-forward is rerun",
    })),
  };
}

function parameterRegister(scenarios: Record<ScenarioId, Scenario>) {
  const trio = (select: (scenario: Scenario) => unknown) => ({
    low: select(scenarios.low),
    central: select(scenarios.central),
    high: select(scenarios.high),
  });
  const rows: Array<Record<string, unknown>> = [];
  const add = (
    parameterId: string,
    values: unknown,
    status: string,
    source: string,
    use: string,
    severity: string,
  ) => rows.push({ parameterId, values, status, source, use, severity });
  for (const key of Object.keys(scenarios.central.probability) as Array<
    keyof ProbabilityInputs
  >) {
    add(
      `probability.${key}`,
      trio((scenario) => scenario.probability[key]),
      "OS_hearing_then_scenario_imputed",
      "LST preregistration and OS project records; not calibrated",
      key === "blackMass" ? "recycling value retention" : "physical q gate",
      key === "blackMass" ? "medium" : "critical",
    );
  }
  for (const key of Object.keys(scenarios.central.funding) as Array<
    keyof FundingAssumptions
  >) {
    add(
      `funding.${key}`,
      trio((scenario) => scenario.funding[key]),
      "v0.4_explicit_low_confidence_imputation",
      "OS financing interest plus fixed eta=1 log-hazard amount conversion rule",
      "convert action-specific required funding schedule to a physical success gate",
      "critical",
    );
  }
  for (const key of Object.keys(scenarios.central.license) as Array<
    keyof LicenseAssumptions
  >) {
    add(
      `license.${key}`,
      trio((scenario) => scenario.license[key]),
      "v0.4_explicit_low_confidence_imputation",
      "no binding license term sheet; scenario-only assumption",
      "license negotiation transitions and conditional cash flows",
      "critical",
    );
  }
  const financial: Array<
    [string, (scenario: Scenario) => unknown, string, string]
  > = [
    ["openingCash", (scenario) => scenario.openingCash, "audited-roll-forward imputation", "liquidity opening"],
    ["minimumCash", (scenario) => scenario.minimumCash, "scenario assumption", "cash feasibility boundary"],
    ["annualDiscountRate", (scenario) => scenario.annualDiscountRate, "v0.2 carried imputation", "monthly and terminal PV"],
    ["terminalGrowth", (scenario) => scenario.terminalGrowth, "v0.2 carried imputation", "terminal DCF"],
    ["terminalReinvestmentRate", (scenario) => scenario.terminalReinvestmentRate, "v0.2 carried imputation", "explicit and terminal DCF"],
    ["postHorizonRevenueGrowth", (scenario) => scenario.postHorizonRevenueGrowth, "v0.2 carried imputation", "FY2032-36 DCF"],
    ["postHorizonEbitMargin", (scenario) => scenario.postHorizonEbitMargin, "v0.2 carried imputation", "FY2032-36 DCF"],
    ["netWorkingCapitalShareOfAnnualRevenue", (scenario) => scenario.netWorkingCapitalShareOfAnnualRevenue, "scenario assumption", "monthly and DCF working capital"],
    ["annualRevenue", (scenario) => scenario.annualRevenue, "frozen plan plus scenario imputation", "monthly operating path and DCF base"],
    ["annualFixedCost", (scenario) => scenario.annualFixedCost, "frozen plan plus scenario imputation", "monthly SG&A"],
    ["contributionMargin", (scenario) => scenario.contributionMargin, "scenario assumption", "monthly COGS"],
    ["facilityCapex", (scenario) => scenario.facilityCapex, "OS partial plus company-share imputation", "monthly investment and required funding"],
    ["secondUnitResidualCapex", (scenario) => scenario.secondUnitResidualCapex, "OS partial plus imputation", "month 3/6 investment"],
    ["startupCapex", (scenario) => scenario.startupCapex, "scenario assumption", "month 18-23 investment"],
    ["growthCapexShareOfSales", (scenario) => scenario.growthCapexShareOfSales, "scenario assumption", "monthly growth investment"],
    ["remainingAccountsPayable", (scenario) => scenario.remainingAccountsPayable, "audited-roll-forward imputation", "liquidity only"],
    ["grantAdvanceLiabilityAtValuation", (scenario) => scenario.grantAdvanceLiabilityAtValuation, "audited anchor plus noncash recognition imputation", "exit refund base"],
    ["grantAdvanceRecognitionMonths", (scenario) => scenario.grantAdvanceRecognitionMonths, "scenario assumption", "failure-date remaining liability"],
    ["grantRefundFractionOnExit", (scenario) => scenario.grantRefundFractionOnExit, "scenario assumption", "exit refund"],
    ["noncurrentAssetRecoveryFraction", (scenario) => scenario.noncurrentAssetRecoveryFraction, "scenario assumption", "exit recovery"],
    ["closureCost", (scenario) => scenario.closureCost, "scenario assumption", "all exits"],
  ];
  for (const [id, select, status, use] of financial) {
    add(id, trio(select), status, "v0.3 audited artifact and frozen v0.2 plan", use, "critical");
  }
  for (const action of Object.keys(ACTIONS) as CurrentAction[]) {
    add(
      `actions.${action}`,
      trio((scenario) => scenario.actions[action]),
      "v0.4_action_design_imputation",
      "registered current action design; rights and execution capacity not independently verified",
      "action-specific monthly path, q gates and terminal value",
      "critical",
    );
  }
  for (const [id, value, use] of [
    ["taxRate", TAX_RATE, "monthly and DCF tax"],
    ["recyclingShare", RECYCLING_SHARE, "black-mass value retention"],
    ["months", MONTHS, "2026-08 through 2031-03 horizon"],
    ["debtOpeningBalance", 80, "liquidity only; assumed overlap with audited short-term debt 83"],
    ["debtInterestRateEarly", 0.02, "liquidity only"],
    ["debtInterestRateLate", 0.025, "liquidity only"],
    ["debtPrincipalStartMonth", 34, "liquidity only"],
    ["debtAmortizationMonths", 60, "liquidity only"],
    ["bridgeMonth", 0, "funding schedule and physical gate"],
    ["largeRoundMonth", 8, "funding schedule and physical gate"],
  ] as Array<[string, number, string]>) {
    add(id, { low: value, central: value, high: value }, "code_contract_imputed", "v0.2/v0.3 inherited explicit constant", use, "high");
  }
  return rows;
}

async function main() {
  const [v02Mts, v02Json, v03Mts, v03Json] = await Promise.all([
    readFile(V02_MTS),
    readFile(V02_JSON, "utf8"),
    readFile(V03_MTS),
    readFile(V03_JSON, "utf8"),
  ]);
  const sourceHashes = {
    v02ScriptSha256: sha256(v02Mts),
    v02ArtifactSha256: sha256(v02Json),
    v03ScriptSha256: sha256(v03Mts),
    v03ArtifactSha256: sha256(v03Json),
  };
  assert.deepEqual(sourceHashes, {
    v02ScriptSha256:
      "bfaac130b5a39f5de4df9e9c2f995f95da52e855fdae4c64a662bf53938f326a",
    v02ArtifactSha256:
      "b5e179cf72f486c7101ef4e54be5f39b9270ba9360faab15586993348a972a1d",
    v03ScriptSha256:
      "9879797ad0e633a3b8bca60e34111769816eb3680fdbcea7bef3fb4522193ff1",
    v03ArtifactSha256:
      "6a1b3a569504373d590f40e469de1f821d1415b07974ad8494402ab91775ae8d",
  });
  const v03 = JSON.parse(v03Json) as V03Artifact;
  assert.equal(v03.valuationDate, VALUATION_DATE);
  assert.equal(v03.informationCutoff, INFORMATION_CUTOFF);
  const loaded = loadScenarios(v03);
  const byId = Object.fromEntries(
    loaded.map((scenario) => [scenario.id, scenario]),
  ) as Record<ScenarioId, Scenario>;
  const auditedNoncurrentAssets = v03.auditedObservations.noncurrentAssets;
  const scenarioResults = loaded.map((scenario) =>
    evaluateScenario(scenario, auditedNoncurrentAssets),
  );
  for (const scenario of scenarioResults) {
    assert.equal(scenario.actions.length, 4);
    assert.equal(scenario.actions.filter((action) => action.selected).length, 1);
    for (const action of scenario.actions) {
      assert.ok(action.physicalQ >= 0 && action.physicalQ <= 1);
      assert.ok(
        Math.abs(action.physicalQ - action.physicalQDirectProduct) < 0.000001,
      );
      assert.equal(action.financingReceiptsIncludedInEconomicValue, false);
      if (action.action !== "abandon_now") {
        assert.equal(action.cashFeasibilityConditionalOnFundingSuccess, true);
        for (const event of action.requiredFundingSchedule) {
          assert.notEqual(event.probabilityGateId, null);
          assert.equal(typeof event.probability, "number");
        }
        for (const row of action.monthlyCashFlow) {
          assert.ok(
            Math.abs(
              row.netCashFlow -
                (row.economicCashFlow +
                  row.financingInflows -
                  row.interestExpense -
                  row.debtPrincipal -
                  row.accountsPayableSettlement),
            ) < 0.00001,
          );
        }
      }
    }
  }
  const central = scenarioResults.find(
    (scenario) => scenario.scenarioId === "central",
  )!;
  assert.ok(Number.isFinite(central.sps21MillionJpy));
  assert.ok(central.selectedAction.length > 0);
  const v03Scenarios = Object.fromEntries(
    v03.scenarios.map((scenario) => [scenario.scenarioId, scenario]),
  ) as Record<ScenarioId, V03RawScenario>;
  const sensitivity = runOneWaySensitivity(
    byId,
    auditedNoncurrentAssets,
    v03Scenarios,
  );
  const outputWithoutHash = {
    schema: "bzm-2.1-lst-corrected-dynamic-v0.4",
    modelStatus: "forced_fully_imputed_not_calibrated_not_validated",
    projectName: "LST",
    valuationDate: VALUATION_DATE,
    informationCutoff: INFORMATION_CUTOFF,
    currencyUnit: "million_JPY",
    forwardValidationCount: 0,
    valueDefinition:
      "valuation-date-forward company-held project future net value level under each action; financing receipts, financing service and pre-valuation sunk costs are excluded from economic value and retained only in cash feasibility; only differences between actions are incremental values",
    warning:
      "The audited FY2026 accounting anchor is observed. Monthly future cash flows, physical transition probabilities, the fixed eta=1 log-hazard funding amount conversion rule, license economics, grant settlement, exit recovery and DCF remain low-confidence imputations. The forced central argmax is not an operational recommendation or calibrated prediction.",
    correctionsFromV03: [
      "removed q anchors and all last-gate inversion/calibration",
      "physical q is the direct product of action-specific registered gates",
      "required bridge and large-round amounts create matched financing success gates on the same monthly path",
      "registered four comparison candidates on one company-held PJ future-net-value basis; only action differences are incremental",
      "retained wait, retry, pivot and scale-up as future-conditional only",
    ],
    sourceVersionIntegrity: {
      ...sourceHashes,
      status: "v0.2 and v0.3 read-only hashes asserted unchanged",
    },
    auditedSource: v03.auditedSource,
    auditedObservations: v03.auditedObservations,
    calculationRules: {
      physicalQ:
        "multiply the physical probabilities in each action gateTrace exactly once; correlated site and large-round states are represented by conditional gates whose product equals their registered joint probability",
      financing:
        "derive the minimum month-0 bridge and month-8 round that keep conditional-success cash at the minimum; translate each required amount into a physical success gate; never add financing receipts to economic value",
      value:
        "survival-weight valuation-date-forward unlevered PJ economic cash flows, add first-failure exit settlements and q-weighted success DCF on the same horizon",
      actionSelection:
        "forced imputation argmax across exactly four registered comparison candidates on the same company-held PJ future-net-value basis; strict evidence-closed argmax separately uses continue and abandon only",
      grants:
        "no unmapped future grant cash; audited grant-advance liability declines noncash and creates an imputed refund on exit",
      cashFeasibility:
        "debt service and remaining accounts payable affect liquidity but not unlevered PJ economic value",
    },
    actionRegistry: {
      strictEvidenceClosedCurrent: Object.values(ACTIONS)
        .filter((action) => action.availability === "available")
        .map((action) => ({
          action: action.action,
          label: action.label,
          availability: action.availability,
        })),
      provisionalComparisonCandidates: Object.values(ACTIONS).map((action) => ({
        action: action.action,
        label: action.label,
        availability: action.availability,
      })),
      futureOnly: FUTURE_ONLY_ACTIONS,
    },
    parameterProvenance: {
      inheritedFromV03: v03.parameterProvenance,
      v04Register: parameterRegister(byId),
      observedAccountingParametersNotVariedInSensitivity:
        "audited observations are retained as the common accounting anchor; one-way sensitivity varies decision-affecting imputed parameters, not the observed source values",
    },
    scenarioResults,
    oneWaySensitivity: sensitivity,
    decisionReadout: {
      status: "forced_low_precision_argmax_not_operational_recommendation",
      centralSelectedAction: central.selectedAction,
      centralSps21MillionJpy: central.sps21MillionJpy,
      centralPhysicalQ: central.selectedPhysicalQ,
      actionValues: Object.fromEntries(
        central.actions.map((action) => [
          action.action,
          {
            valueMillionJpy: action.expectedNetValueMillionJpy,
            physicalQ: action.physicalQ,
            requiredFundingMillionJpy:
              action.totalAdditionalFundingRequiredMillionJpy,
          },
        ]),
      ),
      centralContinueMinusAbandonMillionJpy: round(
        central.actions.find(
          (action) => action.action === "continue_and_raise",
        )!.expectedNetValueMillionJpy -
          central.actions.find((action) => action.action === "abandon_now")!
            .expectedNetValueMillionJpy,
      ),
      independentlyLocatedActionSwitchThresholds: {
        method:
          "separate bounded root search supplied by the sensitivity audit; retained as a cross-check against the endpoint one-way cases, not recomputed by this script",
        probabilityLargeFinancing: 0.53412646,
        annualDiscountRate: 0.12283281,
        annualRevenue2031MillionJpy: 9438.069,
        postHorizonEbitMargin2036: 0.20125043,
        terminalGrowth: 0.01992801,
        grantRefundFractionOnExit: 0.31548961,
        facilityCapexMillionJpy: 500.008,
      },
    },
    dominantUncertaintyDrivers: sensitivity.cases
      .map((entry) => ({
        parameterId: entry.parameterId,
        selectedValueEndpointRangeMillionJpy: round(
          entry.centralSelectedValueRangeAcrossOneWayEndpointsMillionJpy.max -
            entry.centralSelectedValueRangeAcrossOneWayEndpointsMillionJpy.min,
        ),
        provisionalActionSwitchesAcrossEndpoints:
          entry.provisionalActionSwitchesAcrossEndpoints,
        strictActionSwitchesAcrossEndpoints:
          entry.strictActionSwitchesAcrossEndpoints,
      }))
      .sort(
        (left, right) =>
          right.selectedValueEndpointRangeMillionJpy -
          left.selectedValueEndpointRangeMillionJpy,
      ),
  };
  const serializedWithoutHash = stableJson(outputWithoutHash);
  assert.equal(serializedWithoutHash.includes("goalProbabilityAnchor"), false);
  assert.equal(serializedWithoutHash.includes("calibrationMultiplier"), false);
  const output = {
    ...outputWithoutHash,
    calculationHash: sha256(serializedWithoutHash),
  };
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (CHECK_ONLY) {
    const current = await readFile(OUTPUT, "utf8");
    assert.equal(current, serialized);
    process.stdout.write(
      `OK ${path.basename(OUTPUT)} ${output.calculationHash}\n`,
    );
    return;
  }
  await writeFile(OUTPUT, serialized);
  process.stdout.write(
    `WROTE ${path.basename(OUTPUT)} ${output.calculationHash}\n`,
  );
}

await main();
