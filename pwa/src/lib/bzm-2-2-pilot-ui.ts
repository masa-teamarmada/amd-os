const INTEGER_FORMATTER = new Intl.NumberFormat("ja-JP", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatMillionJpy(value: number) {
  const normalized = Math.abs(value) < 0.5 ? 0 : value;
  const sign = normalized < 0 ? "-" : "";
  return `${sign}¥${INTEGER_FORMATTER.format(Math.abs(normalized))}M`;
}

export type Bzm22Scenario<T> = {
  low: T;
  base: T;
  high: T;
};

export interface Bzm22PilotClaimBoundary {
  status: string;
  calibratedPrediction: boolean;
  causalEffect: boolean;
  allocationUse: string;
  crossProjectRankingUse: string;
  forwardValidationCount: number;
  currentControlStatus: string;
  qGateProductProxyStatus: string;
  qStressProxyStatus: string;
}

export interface Bzm22PilotSourceCoverage {
  allComplete: boolean;
  sources: Array<{
    key: string;
    paginationComplete: boolean;
    fetchedItems: number;
    uniqueItems: number;
  }>;
}

export interface Bzm22PilotParameter {
  index: number;
  id: string;
  section: string;
  key: string;
  value: unknown;
  observedStatus: string;
  imputed: Bzm22Scenario<unknown>;
  unit: string;
  rule: string;
  sourceRefs: string[];
  confidenceDriver: string | null;
  usedInCalculation: boolean;
  precisionLossContribution: string | number | boolean | null;
  cutoff: string | null;
}

export interface Bzm22PilotParameterGroup {
  key: string;
  label: string;
  count: number;
  parameters: Bzm22PilotParameter[];
}

export type Bzm22TimelineLaneKey =
  | "confirmed_decisions"
  | "registered_policy"
  | "future_decisions"
  | "business_events"
  | "external_events";

export type Bzm22TimelineItemKind =
  | "confirmed_decision"
  | "registered_current_control_shadow"
  | "future_decision_point"
  | "planned_or_assumed_event"
  | "confirmed_external_event";

export interface Bzm22TimelineItem {
  id: string;
  kind: Bzm22TimelineItemKind;
  label: string;
  category: "registered_policy" | "technical" | "facility" | "commercial" | "funding_external";
  startDate: string | null;
  endDate: string | null;
  dateRole: string;
  datePrecision: string;
  dateLabel: string;
  status: string;
  precision: string;
  sourceStatus?: string;
  sourceRefCount: number;
  description: string;
  choiceRole: "registered_evaluation_policy" | "inherited_registered_policy" | "not_a_choice";
  choiceLabel: string;
  authorityStatus?: string;
  occurrenceRole?: "occurred" | "available" | "recorded" | "conditional" | "imputed" | "unknown";
  commitmentStatus?: string;
  availabilityStatus?: string;
  amountMillionJpy?: number | null;
  probability?: number | null;
}

export interface Bzm22TimelineLane {
  key: Bzm22TimelineLaneKey;
  label: string;
  emptyMessage: string | null;
  items: Bzm22TimelineItem[];
}

export interface Bzm22PilotTimeline {
  axis: {
    startDate: string;
    endDate: string;
    valuationDate: string;
    dateRole: "shared_calendar_axis";
  };
  lanes: Bzm22TimelineLane[];
}

export interface Bzm22SharedMonthAxisCell {
  month: number;
  ym: string;
  year: number;
  calendarMonth: number;
}

function parseYearMonth(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})/);
  if (!match) throw new Error(`BZM 2.2 month axis requires an ISO date: ${value}`);
  return { year: Number(match[1]), monthIndex: Number(match[2]) - 1 };
}

/**
 * 評価月を M0、経済計算の各月を M1..MH とする共通時間軸。
 * イベントと project_pl_monthly を同じ calendar month 列へ置くための唯一の変換に使う。
 */
export function buildBzm22SharedMonthAxis(
  valuationDate: string,
  horizonMonths: number,
): Bzm22SharedMonthAxisCell[] {
  if (!Number.isInteger(horizonMonths) || horizonMonths <= 0) {
    throw new Error("BZM 2.2 shared month axis requires a positive integer horizon");
  }
  const start = parseYearMonth(valuationDate);
  return Array.from({ length: horizonMonths + 1 }, (_, month) => {
    const absoluteMonth = start.year * 12 + start.monthIndex + month;
    const year = Math.floor(absoluteMonth / 12);
    const calendarMonth = (absoluteMonth % 12) + 1;
    return {
      month,
      ym: `${year}-${String(calendarMonth).padStart(2, "0")}`,
      year,
      calendarMonth,
    };
  });
}

export function locateBzm22TimelineItemMonth(
  item: Pick<Bzm22TimelineItem, "startDate">,
  axis: readonly Bzm22SharedMonthAxisCell[],
) {
  if (!item.startDate) return null;
  const ym = item.startDate.slice(0, 7);
  const index = axis.findIndex((cell) => cell.ym === ym);
  return index >= 0 ? index : null;
}

export interface Bzm22SimulationPolicyOption {
  id: string;
  label: string;
  registrationRole: "registered_current" | "historical_terminal_shadow" | "unregistered_shadow_alternative";
  authorityStatus: "unconfirmed";
  sourceRefCount: number;
  metrics: {
    J: Bzm22SimulationMetric;
    P: Bzm22SimulationMetric;
    Q: Bzm22SimulationMetric;
    S: Bzm22SimulationMetric;
  };
}

export interface Bzm22SimulationMetric {
  status: "precomputed" | "not_calculable" | "not_applicable_historical_terminal";
  values: Bzm22Scenario<number> | null;
}

export interface Bzm22PilotSimulation {
  mode: "frozen_snapshot_comparison";
  saveMode: "browser_only_not_saved";
  valuationDate: string;
  currentPolicyId: string;
  policyOptions: Bzm22SimulationPolicyOption[];
  comparisonOptionIds: string[];
  engineConnection: {
    policySwitch: "precomputed_only";
    policyDateChange: "not_connected";
    parameterOverride: "not_connected";
    futureDecisionDate: "not_connected";
  };
}

export interface Bzm22CalculationGate {
  id: string;
  label: string;
  category: "technical" | "facility" | "commercial";
  month: number;
  probabilities: Bzm22Scenario<number>;
  cumulativeSurvival: Bzm22Scenario<number>;
  failureBranchWeight: Bzm22Scenario<number>;
  signedFailureSettlementMillionJpy: Bzm22Scenario<number>;
}

export interface Bzm22CalculationTrace {
  policyId: string;
  policyLabel: string;
  inputs: {
    horizonMonths: number;
    discountRate: Bzm22Scenario<number>;
    cashFlow: {
      monthCount: number;
      totalMillionJpy: Bzm22Scenario<number>;
      monthlyEconomicCFMillionJpy: Bzm22Scenario<number[]>;
    };
    gates: Bzm22CalculationGate[];
    terminalValueMillionJpy: Bzm22Scenario<number>;
    stressFamilies: Array<{
      id: string;
      label: string;
      gateProduct: Bzm22Scenario<number | null>;
      gateMultipliers: Record<string, Bzm22Scenario<number>>;
    }>;
  };
  outputs: Record<"low" | "base" | "high", {
    Q: number;
    S: number | null;
    fullPathPV: number;
    pathPV: number;
    terminalPV: number;
    successContribution: number;
    failureContribution: number;
    P: number | null;
    J: number;
    qTimesP: number | null;
  }>;
  identities: {
    Q: "product_of_gate_probabilities";
    S: "minimum_stress_family_gate_product";
    P: "full_path_pv_plus_terminal_pv";
    J: "path_pv_plus_success_contribution_plus_failure_contribution";
    qTimesPRelation: "comparison_only_not_identity_with_J";
  };
}

export type Bzm22FormulaSymbolKind = "policy" | "primitive" | "set_index" | "derived" | "output";

export const BZM22_FORMULA_SYMBOLS = [
  { key: "a", tex: String.raw`a\equiv\pi_{\mathrm{reg}}`, label: "今回の評価で固定した進め方", kind: "policy" },
  { key: "H", tex: String.raw`H`, label: "経済計算の最終月", kind: "primitive" },
  { key: "r_d", tex: String.raw`r_d`, label: "年率の割引率", kind: "primitive" },
  { key: "t", tex: String.raw`t`, label: "評価開始からの月番号", kind: "set_index" },
  { key: "T", tex: String.raw`\mathcal T=\{1,\ldots,H\}`, label: "計算する月の集合", kind: "set_index" },
  { key: "CF_t", tex: String.raw`CF_t(a)`, label: "t月目の経済収支", kind: "primitive" },
  { key: "d_t", tex: String.raw`d_t=(1+r_d)^{-t/12}`, label: "t月目の金額を現在価値へ直す係数", kind: "derived" },
  { key: "d_H", tex: String.raw`d_H`, label: "最終月Hの割引係数", kind: "derived" },
  { key: "i", tex: String.raw`i`, label: "条件の番号", kind: "set_index" },
  { key: "G", tex: String.raw`G`, label: "計算に含める条件の集合", kind: "set_index" },
  { key: "t_i", tex: String.raw`t_i`, label: "条件iを判定する月", kind: "primitive" },
  { key: "d_t_i", tex: String.raw`d_{t_i}`, label: "条件iの判定月の割引係数", kind: "derived" },
  { key: "p_i", tex: String.raw`p_i(a)`, label: "先行条件通過後の条件iの通過値", kind: "primitive" },
  { key: "W_t", tex: String.raw`W_t(a)=\prod_{i\in G:t_i\leq t}p_i(a)`, label: "t月まで計画経路が続く重み", kind: "derived" },
  { key: "W_before", tex: String.raw`W_{t_i^-}(a)=\prod_{j\in G:t_j<t_i}p_j(a)`, label: "条件iの直前まで経路が続く重み", kind: "derived" },
  { key: "failure_probability", tex: String.raw`1-p_i(a)`, label: "条件iで止まる値", kind: "derived" },
  { key: "branch_weight", tex: String.raw`W_{t_i^-}(a)(1-p_i(a))`, label: "条件iで初めて止まる分岐の重み", kind: "derived" },
  { key: "RV_i", tex: String.raw`RV_i(a)`, label: "条件iで止まった時の価値", kind: "primitive" },
  { key: "TV", tex: String.raw`TV(a)`, label: "H月目に全条件を通過した後の価値", kind: "primitive" },
  { key: "delta", tex: String.raw`\delta`, label: "逆風ケースの番号", kind: "set_index" },
  { key: "Delta", tex: String.raw`\Delta_{\mathrm{reg}}`, label: "今回計算する逆風ケースの集合", kind: "set_index" },
  { key: "m_i_delta", tex: String.raw`m_{i\delta}(a)`, label: "逆風δが条件iへ与える補正", kind: "primitive" },
  { key: "Q", tex: String.raw`Q(a)`, label: "基準到達指数", kind: "output" },
  { key: "S", tex: String.raw`S(a)`, label: "逆風耐久指数", kind: "output" },
  { key: "P", tex: String.raw`P(a)`, label: "全条件通過時の現在価値", kind: "output" },
  { key: "J", tex: String.raw`J(a)`, label: "全分岐込み現在価値", kind: "output" },
] as const satisfies ReadonlyArray<{ key: string; tex: string; label: string; kind: Bzm22FormulaSymbolKind }>;

export type Bzm22FormulaScenario = keyof Bzm22Scenario<unknown>;

export interface Bzm22FormulaTrace {
  scenario: Bzm22FormulaScenario;
  policy: { id: string; label: string };
  horizonMonths: number;
  discountRate: number;
  months: Array<{
    month: number;
    cashFlowMillionJpy: number;
    discountFactor: number;
    pathWeight: number;
    discountedFullPathCashFlowMillionJpy: number;
    discountedWeightedCashFlowMillionJpy: number;
  }>;
  gates: Array<{
    index: number;
    id: string;
    label: string;
    month: number;
    probability: number;
    priorPathWeight: number;
    failureValue: number;
    failureBranchWeight: number;
    discountFactor: number;
    signedFailureSettlementMillionJpy: number;
    discountedFailureContributionMillionJpy: number;
  }>;
  stresses: Array<{
    index: number;
    id: string;
    label: string;
    multipliers: Array<{ gateId: string; gateLabel: string; value: number }>;
    product: number | null;
  }>;
  terminal: {
    valueMillionJpy: number;
    discountFactor: number;
    discountedValueMillionJpy: number;
    successContributionMillionJpy: number;
  };
  outputs: Bzm22CalculationTrace["outputs"]["base"];
}

export function buildBzm22FormulaTrace(
  trace: Bzm22CalculationTrace,
  scenario: Bzm22FormulaScenario = "base",
): Bzm22FormulaTrace {
  const H = trace.inputs.horizonMonths;
  const r = trace.inputs.discountRate[scenario];
  const cashFlows = trace.inputs.cashFlow.monthlyEconomicCFMillionJpy[scenario];
  if (!Number.isInteger(H) || H <= 0 || cashFlows.length !== H || !Number.isFinite(r) || r <= -1) {
    throw new Error("BZM 2.2 formula trace input contract mismatch");
  }
  const discount = (month: number) => Math.pow(1 + r, -month / 12);
  const gates = trace.inputs.gates.map((gate, index) => {
    const probability = gate.probabilities[scenario];
    const priorPathWeight = trace.inputs.gates
      .slice(0, index)
      .reduce((value, previous) => value * previous.probabilities[scenario], 1);
    const failureValue = 1 - probability;
    const failureBranchWeight = priorPathWeight * failureValue;
    const discountFactor = discount(gate.month);
    const settlement = gate.signedFailureSettlementMillionJpy[scenario];
    return {
      index: index + 1,
      id: gate.id,
      label: gate.label,
      month: gate.month,
      probability,
      priorPathWeight,
      failureValue,
      failureBranchWeight,
      discountFactor,
      signedFailureSettlementMillionJpy: settlement,
      discountedFailureContributionMillionJpy: discountFactor * failureBranchWeight * settlement,
    };
  });
  const months = cashFlows.map((cashFlowMillionJpy, index) => {
    const month = index + 1;
    const discountFactor = discount(month);
    const pathWeight = trace.inputs.gates
      .filter((gate) => gate.month <= month)
      .reduce((value, gate) => value * gate.probabilities[scenario], 1);
    return {
      month,
      cashFlowMillionJpy,
      discountFactor,
      pathWeight,
      discountedFullPathCashFlowMillionJpy: discountFactor * cashFlowMillionJpy,
      discountedWeightedCashFlowMillionJpy: discountFactor * pathWeight * cashFlowMillionJpy,
    };
  });
  const stresses = trace.inputs.stressFamilies.map((stress, index) => ({
    index: index + 1,
    id: stress.id,
    label: stress.label,
    multipliers: trace.inputs.gates.map((gate) => ({
      gateId: gate.id,
      gateLabel: gate.label,
      value: stress.gateMultipliers[gate.id]?.[scenario] ?? Number.NaN,
    })),
    product: stress.gateProduct[scenario],
  }));
  const terminalDiscountFactor = discount(H);
  const terminalValue = trace.inputs.terminalValueMillionJpy[scenario];
  const output = trace.outputs[scenario];
  const gateProduct = trace.inputs.gates.reduce((value, gate) => value * gate.probabilities[scenario], 1);
  return {
    scenario,
    policy: { id: trace.policyId, label: trace.policyLabel },
    horizonMonths: H,
    discountRate: r,
    months,
    gates,
    stresses,
    terminal: {
      valueMillionJpy: terminalValue,
      discountFactor: terminalDiscountFactor,
      discountedValueMillionJpy: terminalDiscountFactor * terminalValue,
      successContributionMillionJpy: gateProduct * terminalDiscountFactor * terminalValue,
    },
    outputs: output,
  };
}

export function calculateBzm22TimingOnlyJ(
  trace: Bzm22CalculationTrace,
  gateMonths: Partial<Record<string, number>>,
  scenario: keyof Bzm22Scenario<unknown> = "base",
) {
  const gates = trace.inputs.gates.map((gate) => ({
    ...gate,
    month: gateMonths[gate.id] ?? gate.month,
    probability: gate.probabilities[scenario],
    settlement: gate.signedFailureSettlementMillionJpy[scenario],
  }));
  const orderInvalid = gates.some((gate, index) =>
    !Number.isFinite(gate.month)
    || gate.month < 0
    || gate.month > trace.inputs.horizonMonths
    || (index > 0 && gate.month < gates[index - 1].month));
  if (orderInvalid) return { status: "order_invalid" as const };

  const discountRate = trace.inputs.discountRate[scenario];
  let pathPV = 0;
  trace.inputs.cashFlow.monthlyEconomicCFMillionJpy[scenario].forEach((cashFlow, index) => {
    const month = index + 1;
    const survival = gates
      .filter((gate) => gate.month <= month)
      .reduce((value, gate) => value * gate.probability, 1);
    pathPV += survival * cashFlow / Math.pow(1 + discountRate, month / 12);
  });
  let prior = 1;
  let failureContribution = 0;
  gates.forEach((gate) => {
    failureContribution += prior * (1 - gate.probability) * gate.settlement /
      Math.pow(1 + discountRate, gate.month / 12);
    prior *= gate.probability;
  });
  const successContribution = trace.outputs[scenario].successContribution;
  return {
    status: "calculated" as const,
    pathPV,
    successContribution,
    failureContribution,
    J: pathPV + successContribution + failureContribution,
  };
}

export interface Bzm22PilotProject {
  schemaVersion: "bzm2.2-pilot-ui/v1";
  artifactSha256: string;
  projectId: string;
  projectName: string;
  modelVersion: string;
  valuationDate: string;
  informationCutoff: string;
  claimBoundary: Bzm22PilotClaimBoundary;
  sourceCoverage: Bzm22PilotSourceCoverage;
  summary: {
    registeredCurrentControl: string | null;
    controlRegistrationStatus: string | null;
    qGateProductProxy: Bzm22Scenario<number | null>;
    qStressProxy: Bzm22Scenario<number | null>;
    jValueMillionJpy: Bzm22Scenario<number | null>;
    conditionalSuccessValueMillionJpy: Bzm22Scenario<number | null>;
    conditionalSuccessValueStatus: string;
    firstPathLossMonth: string | number | null;
    actionBoundaryCounts: {
      authorityApproved: number;
      shadow: number;
    };
    precisionStatus: string;
  };
  timeline: Bzm22PilotTimeline;
  simulation: Bzm22PilotSimulation;
  calculationTrace: Bzm22CalculationTrace;
  groups: Bzm22PilotParameterGroup[];
}

export interface Bzm22PilotApiPayload {
  pilot: Bzm22PilotProject;
}

export type Bzm22PilotSummary = Pick<
  Bzm22PilotProject,
  "projectId" | "projectName" | "modelVersion" | "valuationDate" | "claimBoundary" | "summary"
>;

export interface Bzm22PilotSummaryApiPayload {
  pilot: Bzm22PilotSummary;
}

export const BZM22_FIXED_POLICY = {
  formula: String.raw`a\equiv\pi_{\mathrm{reg}}`,
  label: "a = 登録済み固定方針（shadow・最適化なし）",
} as const;

export const BZM22_TOP_METRICS = {
  J: {
    title: "全分岐込み現在価値",
    formula: String.raw`J(a)=\sum_{t=1}^{H}d_tW_t(a)CF_t(a)+d_HQ(a)TV(a)+\sum_{i\in G}d_{t_i}W_{t_i^-}(a)(1-p_i(a))RV_i(a)`,
    description: "この方針を続けた場合の、成功・途中失敗・毎月の収支を起こりやすさで重み付けし、今日の金額に直した合計。",
  },
  P: {
    title: "全条件通過時の現在価値",
    formula: String.raw`P(a)=\sum_{t=1}^{H}d_tCF_t(a)+d_HTV(a)`,
    description: "同じ方針のまま、登録した条件を全部通過した場合の、毎月の収支と将来価値を今日の金額に直した合計。",
  },
  Q: {
    title: "基準到達指数",
    formula: String.raw`Q(a)=\prod_{i\in G}p_i(a)`,
    description: "通常の想定で、登録した条件を最後まで通り切れる強さをまとめた指数。",
  },
  S: {
    title: "逆風耐久指数",
    formula: String.raw`S(a)=\min_{\delta\in\Delta_{reg}}\prod_{i\in G}(p_i(a)m_{i\delta}(a))`,
    description: "厳しい想定ごとに同じ計算をし、その中で最も低かった指数。",
  },
} as const;
