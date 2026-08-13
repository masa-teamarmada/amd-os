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
    formula: String.raw`J(\pi_{\mathrm{reg}})\equiv J(a)=\sum_t d_t s_t(a)CF_t(a)+d_HQ(a)\,TV(a)+\sum_i d_i s_{i^-}(a)(1-p_i(a))RV_i(a)`,
    description: "この方針を続けた場合の、成功・途中失敗・毎月の収支を起こりやすさで重み付けし、今日の金額に直した合計。",
  },
  P: {
    title: "全条件通過時の現在価値",
    formula: String.raw`P(\pi_{\mathrm{reg}})\equiv P(a)=\operatorname E[V_{\mathrm{net}}\mid G,a]=\sum_t d_tCF_t(a)+d_H TV(a)`,
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
