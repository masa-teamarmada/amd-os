export const BZM21_DYNAMIC_POLICY_SCHEMA =
  "bzm-2.1-dynamic-policy-v0.1" as const;

export const BZM21_OBJECTIVES = ["company", "bzsf", "public"] as const;

export type Bzm21Objective = (typeof BZM21_OBJECTIVES)[number];

export const BZM21_ACTION_KINDS = [
  "continue",
  "wait",
  "retry",
  "pivot",
  "scale_down",
  "scale_up",
  "license",
  "abandon",
] as const;

export type Bzm21ActionKind = (typeof BZM21_ACTION_KINDS)[number];

export const BZM21_TERMINAL_OUTCOMES = [
  "capital_independent",
  "licensed",
  "transferred",
  "abandoned",
  "liquidated",
  "failed",
  "unresolved",
] as const;

export type Bzm21TerminalOutcome =
  (typeof BZM21_TERMINAL_OUTCOMES)[number];

export const BZM21_EVIDENCE_KINDS = [
  "document",
  "record",
  "structured_hearing",
  "calculation",
  "synthetic",
] as const;

export type Bzm21EvidenceKind = (typeof BZM21_EVIDENCE_KINDS)[number];

/**
 * All three entries are kept separate deliberately. A company payoff, a BZSF
 * investment payoff, and a public social payoff must never be added together.
 * null means missing; it is never coerced to zero.
 */
export type Bzm21ObjectiveAmounts = Record<
  Bzm21Objective,
  number | null
>;

export type Bzm21ObjectiveAmountDeltas = Partial<
  Record<Bzm21Objective, number | null>
>;

export const BZM21_CASH_FLOW_CATEGORIES = [
  "immediate_cost",
  "immediate_benefit",
  "transition_cash_flow",
  "terminal_value",
  "failure_loss",
] as const;

export type Bzm21CashFlowCategory =
  (typeof BZM21_CASH_FLOW_CATEGORIES)[number];

export const BZM21_CASH_FLOW_ECONOMIC_NATURES = [
  "operating",
  "investing",
  "financing",
  "tax",
  "transfer",
  "social",
] as const;

export type Bzm21CashFlowEconomicNature =
  (typeof BZM21_CASH_FLOW_ECONOMIC_NATURES)[number];

export const BZM21_TAX_TREATMENTS = [
  "pre_tax",
  "post_tax",
  "tax_payment",
  "tax_exempt",
  "not_applicable",
] as const;

export type Bzm21TaxTreatment =
  (typeof BZM21_TAX_TREATMENTS)[number];

/**
 * The single calculation ledger for every monetary input. Aggregate amount
 * fields on actions and transitions are derived caches and are validated
 * against these events before evaluation.
 */
export type Bzm21CashFlowEvent = {
  eventId: string;
  label: string;
  stateId: string;
  actionId: string;
  transitionId: string | null;
  timing: "action_start" | "action_end";
  includedIn: Bzm21CashFlowCategory;
  economicNature: Bzm21CashFlowEconomicNature;
  objectiveAmountsMillionJpy: Bzm21ObjectiveAmounts;
  owner: string;
  counterparty: string;
  scope: string;
  amountBasis: "nominal";
  taxTreatment: Bzm21TaxTreatment;
  evidence: Bzm21EvidenceRef;
};

export type Bzm21EvidenceRef = {
  kind: Bzm21EvidenceKind;
  ref: string;
  informationCutoff: string;
};

export type Bzm21Transition = {
  transitionId: string;
  label: string;
  probability: number | null;
  nextStateId: string | null;
  terminalOutcome: Bzm21TerminalOutcome | null;
  /** Absolute first-passage month from valuation date, not a terminal label. */
  goalReachedAtMonths: number | null;
  /** Absolute month when strategic slack was first lost on this branch. */
  slackLostAtMonths: number | null;
  cashFlowEventIds: string[];
  /** Derived cache from transition_cash_flow ledger events. */
  transitionCashFlowMillionJpy: Bzm21ObjectiveAmounts;
  /** Derived cache from terminal_value ledger events. */
  terminalValueMillionJpy: Bzm21ObjectiveAmounts;
  /** Derived cache from failure_loss ledger events. */
  failureLossMillionJpy: Bzm21ObjectiveAmounts;
  evidence: Bzm21EvidenceRef;
};

export const BZM21_GATE_STATUSES = [
  "confirmed",
  "blocked",
  "unknown",
  "not_required",
] as const;

export type Bzm21GateStatus = (typeof BZM21_GATE_STATUSES)[number];

export type Bzm21DecisionGate = {
  status: Bzm21GateStatus;
  note: string;
  evidence: Bzm21EvidenceRef;
};

export type Bzm21ConsentGate = Bzm21DecisionGate & {
  consentId: string;
  label: string;
};

export const BZM21_FINANCING_STATUSES = [
  "secured",
  "contracted",
  "not_required",
  "conditional",
  "uncontracted",
  "blocked",
  "unknown",
] as const;

export type Bzm21FinancingStatus =
  (typeof BZM21_FINANCING_STATUSES)[number];

export type Bzm21FinancingFeasibility = {
  status: Bzm21FinancingStatus;
  /** Cash already available at the decision time. */
  openingCashMillionJpy: number | null;
  committedFundingMillionJpy: number | null;
  /** Required cash-outs. Every amount must be tied to an absolute month. */
  requiredFundingSchedule: Array<{
    scheduleId: string;
    atMonths: number | null;
    amountMillionJpy: number | null;
    purpose: string;
    evidence: Bzm21EvidenceRef;
  }>;
  /** Contracted or secured cash-ins; purpose restrictions are explicit. */
  committedFundingSchedule: Array<{
    scheduleId: string;
    atMonths: number | null;
    amountMillionJpy: number | null;
    permittedPurposes: string[];
    evidence: Bzm21EvidenceRef;
  }>;
  note: string;
  evidence: Bzm21EvidenceRef;
};

export type Bzm21Action = {
  actionId: string;
  bundleId: string;
  kind: Bzm21ActionKind;
  componentKinds: Bzm21ActionKind[];
  customComponents: string[];
  /** Each top-level item is a serial stage; a nested array runs in parallel. */
  sequence: Array<string | string[]>;
  sharedResourceRequirements: Array<{
    resourceId: string;
    amount: number | null;
    unit: string;
    evidence: Bzm21EvidenceRef;
  }>;
  label: string;
  availability: "available" | "unavailable" | "unknown";
  feasibility: Bzm21DecisionGate;
  authority: Bzm21DecisionGate;
  consents: Bzm21ConsentGate[];
  financingFeasibility: Bzm21FinancingFeasibility;
  durationMonths: number | null;
  immediateCostMillionJpy: Bzm21ObjectiveAmounts;
  immediateBenefitMillionJpy: Bzm21ObjectiveAmounts;
  requiredFundingMillionJpy: number | null;
  informationGain: string[];
  cashFlowEventIds: string[];
  transitions: Bzm21Transition[];
  evidence: Bzm21EvidenceRef;
};

export type Bzm21BeliefState = {
  beliefId: string;
  label: string;
  possibleValues: Array<{
    value: string;
    probability: number | null;
  }>;
  evidence: Bzm21EvidenceRef;
};

export type Bzm21DecisionController = {
  controllerId: string;
  kind: "company" | "bzsf" | "public" | "joint" | "external";
  objective: Bzm21Objective | null;
  evidence: Bzm21EvidenceRef;
};

export type Bzm21ReachabilityHistory = {
  goal: {
    status: "not_reached" | "reached" | "unknown";
    firstReachedAtMonths: number | null;
    evidence: Bzm21EvidenceRef;
  };
  strategicSlack: {
    status: "available" | "lost" | "unknown";
    firstLostAtMonths: number | null;
    evidence: Bzm21EvidenceRef;
  };
};

export type Bzm21DecisionState = {
  stateId: string;
  label: string;
  decisionOrder: number;
  elapsedMonths: number | null;
  currentState: Record<string, string | number | boolean | null>;
  beliefs: Bzm21BeliefState[];
  reachabilityHistory: Bzm21ReachabilityHistory;
  decisionController: Bzm21DecisionController;
  /** Historical expenditure for reporting only; never enters Bellman value. */
  sunkCostMillionJpy: number | null;
  remainingCostMillionJpy: number | null;
  remainingTimeMonths: number | null;
  availableInformation: string[];
  actions: Bzm21Action[];
  evidence: Bzm21EvidenceRef;
};

export type Bzm21TransitionInterventionEffect = {
  transitionId: string;
  probabilityDelta?: number | null;
};

export type Bzm21CashFlowEventInterventionEffect = {
  eventId: string;
  amountDeltaMillionJpy: Bzm21ObjectiveAmountDeltas;
};

/**
 * An intervention may change an action's economics or its transition law. It
 * cannot add a free-standing bonus to q or P. This makes support affect q only
 * through the action selected and the resulting future path.
 */
export type Bzm21InterventionEffect = {
  stateId: string;
  actionId: string;
  requiredFundingDeltaMillionJpy?: number | null;
  committedFundingDeltaMillionJpy?: number | null;
  requiredFundingScheduleDeltas?: Array<{
    scheduleId: string;
    amountDeltaMillionJpy: number | null;
  }>;
  committedFundingScheduleDeltas?: Array<{
    scheduleId: string;
    amountDeltaMillionJpy: number | null;
  }>;
  cashFlowEventDeltas?: Bzm21CashFlowEventInterventionEffect[];
  transitions?: Bzm21TransitionInterventionEffect[];
};

export type Bzm21Intervention = {
  interventionId: string;
  label: string;
  enabled: boolean;
  effects: Bzm21InterventionEffect[];
  evidence: Bzm21EvidenceRef;
};

export type Bzm21DynamicPolicyModel = {
  schema: typeof BZM21_DYNAMIC_POLICY_SCHEMA;
  modelId: string;
  modelVersion: string;
  dataMode: "project" | "synthetic";
  currency: "JPY";
  valuationDate: string;
  informationCutoff: string;
  forwardValidationCount: number;
  initialStateId: string;
  planDeadlineMonths: number | null;
  evaluationHorizonMonths: number | null;
  discountRatePerMonth: Bzm21ObjectiveAmounts;
  valuationRuleByObjective: Record<
    Bzm21Objective,
    {
      ruleId: string;
      ruleRef: string;
      probabilityMeasure: "physical";
      discounting: "deterministic_rate";
      discountRateBasis: "nominal";
      taxBasis:
        | "pre_tax_plus_explicit_tax_payments"
        | "post_tax_inclusive"
        | "tax_exempt";
      evidence: Bzm21EvidenceRef;
    }
  >;
  decisionCriterionByObjective: Record<
    Bzm21Objective,
    {
      criterion: "max_expected_net_value";
      nearTieToleranceMillionJpy: number;
      evidence: Bzm21EvidenceRef;
    }
  >;
  uncertaintyRule:
    | {
        status: "stable" | "not_assessed" | "decision_switches";
        methodRef: string;
        evidence: Bzm21EvidenceRef;
      }
    | null;
  tieBreakRule:
    | {
        rule:
          | "higher_goal_probability"
          | "lower_required_funding"
          | "action_priority";
        actionPriorityByState: Record<string, string[]>;
        evidence: Bzm21EvidenceRef;
      }
    | null;
  publicValueRule:
    | {
        fiscalRuleRef: string;
        socialMandateRef: string;
        socialConversionRuleRef: string;
        aggregationRuleRef: string;
        preregisteredAt: string;
        evidence: Bzm21EvidenceRef;
      }
    | null;
  baselinePolicyId: string;
  baselinePolicy: Record<string, string>;
  policyDefinitionRef: string;
  cashFlowEvents: Bzm21CashFlowEvent[];
  states: Bzm21DecisionState[];
  interventions?: Bzm21Intervention[];
};

export type Bzm21ValidationIssue = {
  severity: "error" | "warning";
  domain: "reachability" | "valuation" | "funding" | "measurement";
  perspective: Bzm21Objective | null;
  code: string;
  path: string;
  message: string;
};

export type Bzm21ActionEvaluation = {
  actionId: string;
  actionKind: Bzm21ActionKind;
  actionLabel: string;
  expectedNetValueMillionJpy: number;
  goalProbability: number;
  planDeadlineGoalProbability: number;
  conditionalGoalValueMillionJpy: number | null;
  expectedCumulativeFundingMillionJpy: number;
  expectedFailureLossMillionJpy: number;
  expectedExitValueMillionJpy: number;
  expectedTerminalValueMillionJpy: number;
  expectedCostMillionJpy: number;
  expectedBenefitMillionJpy: number;
};

export type Bzm21StateDecisionEvaluation = {
  stateId: string;
  selectedActionId: string;
  actions: Bzm21ActionEvaluation[];
  excludedActions: Array<{
    actionId: string;
    reason: string;
  }>;
};

export type Bzm21PolicyEvaluation = {
  policyKind: "fixed_baseline" | "optimized";
  perspective: Bzm21Objective;
  selectionObjective: Bzm21Objective | null;
  expectedNetValueMillionJpy: number;
  goalProbability: number;
  planDeadlineGoalProbability: number;
  conditionalGoalValueMillionJpy: number | null;
  expectedCumulativeFundingMillionJpy: number;
  expectedFailureLossMillionJpy: number;
  expectedExitValueMillionJpy: number;
  expectedTerminalValueMillionJpy: number;
  expectedCostMillionJpy: number;
  expectedBenefitMillionJpy: number;
  controllerByState: Record<string, Bzm21DecisionController>;
  selectedActionByState: Record<string, string>;
  stateDecisions: Bzm21StateDecisionEvaluation[];
};

export type Bzm21PerspectiveEvaluation =
  | {
      status: "computed";
      perspective: Bzm21Objective;
      baseline: Bzm21PolicyEvaluation;
      optimal: Bzm21PolicyEvaluation;
      valueDifferenceFromBaselineMillionJpy: number;
      controllerOptionValueMillionJpy: number | null;
      goalProbabilityChange: number;
      planDeadlineGoalProbabilityChange: number;
    }
  | {
      status: "not_computable";
      perspective: Bzm21Objective;
      issues: Bzm21ValidationIssue[];
    }
  | {
      status: "decision_indeterminate";
      perspective: Bzm21Objective;
      issues: Bzm21ValidationIssue[];
    };

export type Bzm21ReachabilityEvaluation =
  | {
      status: "computed";
      policyId: string;
      goalProbability: number;
      planDeadlineGoalProbability: number;
    }
  | {
      status: "not_computable";
      policyId: string;
      issues: Bzm21ValidationIssue[];
    };

export type Bzm21DynamicPolicyEvaluation = {
  status: "computed" | "partial" | "not_computable";
  modelId: string;
  modelVersion: string;
  informationCutoff: string;
  forwardValidationCount: number;
  activeInterventionIds: string[];
  issues: Bzm21ValidationIssue[];
  baselineReachability: Bzm21ReachabilityEvaluation;
  perspectives: Record<Bzm21Objective, Bzm21PerspectiveEvaluation>;
};

type InternalMetrics = {
  expectedNetValueMillionJpy: number;
  goalProbability: number;
  planDeadlineGoalProbability: number;
  /** E[future net value * 1{G first reached before slack/horizon}]. */
  goalNetValueContributionMillionJpy: number;
  expectedCumulativeFundingMillionJpy: number;
  expectedFailureLossMillionJpy: number;
  expectedExitValueMillionJpy: number;
  expectedTerminalValueMillionJpy: number;
  expectedCostMillionJpy: number;
  expectedBenefitMillionJpy: number;
};

const EXIT_OUTCOMES = new Set<Bzm21TerminalOutcome>([
  "licensed",
  "transferred",
  "abandoned",
  "liquidated",
]);

const EPSILON = 1e-9;
/** Numeric safety bound only; it is not a valuation prior or PJ cap. */
export const BZM21_MAX_ABS_AMOUNT_MILLION_JPY = 1_000_000_000_000;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isBoundedAmount(value: unknown): value is number {
  return (
    isFiniteNumber(value) &&
    Math.abs(value) <= BZM21_MAX_ABS_AMOUNT_MILLION_JPY
  );
}

function isNonNegativeAmount(value: unknown): value is number {
  return isBoundedAmount(value) && value >= 0;
}

function clampProbability(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function asNumberOrInfinity(value: unknown): number {
  return isFiniteNumber(value) ? value : Number.POSITIVE_INFINITY;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
  );
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) &&
    Number.isFinite(Date.parse(value))
  );
}

function issue(
  severity: Bzm21ValidationIssue["severity"],
  domain: Bzm21ValidationIssue["domain"],
  code: string,
  path: string,
  message: string,
  perspective: Bzm21Objective | null = null,
): Bzm21ValidationIssue {
  return { severity, domain, perspective, code, path, message };
}

function validateEvidence(
  evidence: Bzm21EvidenceRef,
  path: string,
  model: Bzm21DynamicPolicyModel,
  issues: Bzm21ValidationIssue[],
) {
  if (
    !evidence ||
    !(BZM21_EVIDENCE_KINDS as readonly string[]).includes(evidence.kind) ||
    typeof evidence.ref !== "string" ||
    evidence.ref.trim() === "" ||
    !isIsoTimestamp(evidence.informationCutoff)
  ) {
    issues.push(
      issue(
        "error",
        "measurement",
        "invalid_evidence",
        path,
        "数値入力を支える根拠種別・参照・情報締切が揃っていない。",
      ),
    );
    return;
  }
  if (
    isIsoTimestamp(model.informationCutoff) &&
    Date.parse(evidence.informationCutoff) > Date.parse(model.informationCutoff)
  ) {
    issues.push(
      issue(
        "error",
        "measurement",
        "future_evidence",
        path,
        "モデルの情報締切より後の根拠を入力へ戻すことはできない。",
      ),
    );
  }
  if (model.dataMode === "project" && evidence.kind === "synthetic") {
    issues.push(
      issue(
        "error",
        "measurement",
        "synthetic_evidence_in_project_model",
        path,
        "PJ実測モデルへ合成テスト用の根拠を混ぜることはできない。",
      ),
    );
  }
}

function validateObjectiveAmounts(
  values: Bzm21ObjectiveAmounts,
  path: string,
  issues: Bzm21ValidationIssue[],
  options: { allowNegative?: boolean } = {},
) {
  for (const perspective of BZM21_OBJECTIVES) {
    const value = values?.[perspective];
    const valid = options.allowNegative
      ? isBoundedAmount(value)
      : isNonNegativeAmount(value);
    if (!valid) {
      issues.push(
        issue(
          "error",
          "valuation",
          value === null ? "missing_objective_value" : "invalid_objective_value",
          `${path}.${perspective}`,
          value === null
            ? "欠測値は0へ置換せず、この視点を計算不能にする。"
            : options.allowNegative
              ? `金額は絶対値${BZM21_MAX_ABS_AMOUNT_MILLION_JPY}百万円以下の有限値でなければならない。`
              : `費用・便益・損失は0以上${BZM21_MAX_ABS_AMOUNT_MILLION_JPY}百万円以下でなければならない。`,
          perspective,
        ),
      );
    }
  }
}

function validateDeltaAmounts(
  values: Bzm21ObjectiveAmountDeltas | undefined,
  path: string,
  issues: Bzm21ValidationIssue[],
) {
  if (!values) return;
  for (const perspective of BZM21_OBJECTIVES) {
    if (!(perspective in values)) continue;
    const value = values[perspective];
    if (!isBoundedAmount(value)) {
      issues.push(
        issue(
          "error",
          "valuation",
          value === null ? "missing_intervention_delta" : "invalid_intervention_delta",
          `${path}.${perspective}`,
          "支援効果の差分は根拠のある有限値でなければならない。",
          perspective,
        ),
      );
    }
  }
}

function applyObjectiveDeltas(
  base: Bzm21ObjectiveAmounts,
  deltas: Bzm21ObjectiveAmountDeltas | undefined,
): Bzm21ObjectiveAmounts {
  return Object.fromEntries(
    BZM21_OBJECTIVES.map((perspective) => {
      const baseValue = base[perspective];
      if (!deltas || !(perspective in deltas)) return [perspective, baseValue];
      const delta = deltas[perspective];
      return [
        perspective,
        baseValue === null || delta === null || delta === undefined
          ? null
          : baseValue + delta,
      ];
    }),
  ) as Bzm21ObjectiveAmounts;
}

function applyNumberDelta(
  base: number | null,
  delta: number | null | undefined,
): number | null {
  if (delta === undefined) return base;
  if (base === null || delta === null) return null;
  return base + delta;
}

function zeroObjectiveAmounts(): Bzm21ObjectiveAmounts {
  return { company: 0, bzsf: 0, public: 0 };
}

function addObjectiveAmounts(
  left: Bzm21ObjectiveAmounts,
  right: Bzm21ObjectiveAmounts,
): Bzm21ObjectiveAmounts {
  return Object.fromEntries(
    BZM21_OBJECTIVES.map((perspective) => {
      const leftValue = left[perspective];
      const rightValue = right[perspective];
      return [
        perspective,
        leftValue === null || rightValue === null
          ? null
          : leftValue + rightValue,
      ];
    }),
  ) as Bzm21ObjectiveAmounts;
}

function cashFlowEventAmounts(
  model: Bzm21DynamicPolicyModel,
  stateId: string,
  actionId: string,
  event: Bzm21CashFlowEvent,
  includeEnabledInterventions: boolean,
): Bzm21ObjectiveAmounts {
  let amounts = { ...event.objectiveAmountsMillionJpy };
  if (!includeEnabledInterventions) return amounts;
  for (const intervention of model.interventions ?? []) {
    if (!intervention.enabled) continue;
    for (const effect of intervention.effects) {
      if (effect.stateId !== stateId || effect.actionId !== actionId) continue;
      for (const eventDelta of effect.cashFlowEventDeltas ?? []) {
        if (eventDelta.eventId !== event.eventId) continue;
        amounts = applyObjectiveDeltas(
          amounts,
          eventDelta.amountDeltaMillionJpy,
        );
      }
    }
  }
  return amounts;
}

function deriveCashFlowCategory(
  model: Bzm21DynamicPolicyModel,
  stateId: string,
  actionId: string,
  eventIds: string[] | undefined,
  category: Bzm21CashFlowCategory,
  includeEnabledInterventions: boolean,
): Bzm21ObjectiveAmounts {
  const eventById = new Map(
    (model.cashFlowEvents ?? []).map((event) => [event.eventId, event]),
  );
  return (eventIds ?? []).reduce((sum, eventId) => {
    const event = eventById.get(eventId);
    if (!event || event.includedIn !== category) return sum;
    return addObjectiveAmounts(
      sum,
      cashFlowEventAmounts(
        model,
        stateId,
        actionId,
        event,
        includeEnabledInterventions,
      ),
    );
  }, zeroObjectiveAmounts());
}

function amountsEqual(
  left: Bzm21ObjectiveAmounts,
  right: Bzm21ObjectiveAmounts,
): boolean {
  return BZM21_OBJECTIVES.every((perspective) => {
    if (left[perspective] === null || right[perspective] === null) {
      return left[perspective] === right[perspective];
    }
    return Math.abs(left[perspective] - right[perspective]) <= EPSILON;
  });
}

function effectiveAction(
  model: Bzm21DynamicPolicyModel,
  stateId: string,
  action: Bzm21Action,
): Bzm21Action {
  let result: Bzm21Action = {
    ...action,
    financingFeasibility: {
      ...action.financingFeasibility,
      requiredFundingSchedule:
        action.financingFeasibility.requiredFundingSchedule.map((row) => ({ ...row })),
      committedFundingSchedule:
        action.financingFeasibility.committedFundingSchedule.map((row) => ({ ...row })),
    },
    transitions: action.transitions.map((transition) => ({
      ...transition,
    })),
  };
  for (const intervention of model.interventions ?? []) {
    if (!intervention.enabled) continue;
    for (const effect of intervention.effects) {
      if (effect.stateId !== stateId || effect.actionId !== action.actionId) {
        continue;
      }
      result = {
        ...result,
        requiredFundingMillionJpy: applyNumberDelta(
          result.requiredFundingMillionJpy,
          effect.requiredFundingDeltaMillionJpy,
        ),
        financingFeasibility: {
          ...result.financingFeasibility,
          committedFundingMillionJpy: applyNumberDelta(
            result.financingFeasibility.committedFundingMillionJpy,
            effect.committedFundingDeltaMillionJpy,
          ),
          requiredFundingSchedule:
            result.financingFeasibility.requiredFundingSchedule.map((row) => {
              const delta = effect.requiredFundingScheduleDeltas?.find(
                (candidate) => candidate.scheduleId === row.scheduleId,
              );
              return delta
                ? {
                    ...row,
                    amountMillionJpy: applyNumberDelta(
                      row.amountMillionJpy,
                      delta.amountDeltaMillionJpy,
                    ),
                  }
                : row;
            }),
          committedFundingSchedule:
            result.financingFeasibility.committedFundingSchedule.map((row) => {
              const delta = effect.committedFundingScheduleDeltas?.find(
                (candidate) => candidate.scheduleId === row.scheduleId,
              );
              return delta
                ? {
                    ...row,
                    amountMillionJpy: applyNumberDelta(
                      row.amountMillionJpy,
                      delta.amountDeltaMillionJpy,
                    ),
                  }
                : row;
            }),
        },
        transitions: result.transitions.map((transition) => {
          const transitionEffect = effect.transitions?.find(
            (candidate) =>
              candidate.transitionId === transition.transitionId,
          );
          if (!transitionEffect) return transition;
          return {
            ...transition,
            probability: applyNumberDelta(
              transition.probability,
              transitionEffect.probabilityDelta,
            ),
          };
        }),
      };
    }
  }
  return {
    ...result,
    immediateCostMillionJpy: deriveCashFlowCategory(
      model,
      stateId,
      action.actionId,
      action.cashFlowEventIds,
      "immediate_cost",
      true,
    ),
    immediateBenefitMillionJpy: deriveCashFlowCategory(
      model,
      stateId,
      action.actionId,
      action.cashFlowEventIds,
      "immediate_benefit",
      true,
    ),
    transitions: result.transitions.map((transition) => ({
      ...transition,
      transitionCashFlowMillionJpy: deriveCashFlowCategory(
        model,
        stateId,
        action.actionId,
        transition.cashFlowEventIds,
        "transition_cash_flow",
        true,
      ),
      terminalValueMillionJpy: deriveCashFlowCategory(
        model,
        stateId,
        action.actionId,
        transition.cashFlowEventIds,
        "terminal_value",
        true,
      ),
      failureLossMillionJpy: deriveCashFlowCategory(
        model,
        stateId,
        action.actionId,
        transition.cashFlowEventIds,
        "failure_loss",
        true,
      ),
    })),
  };
}

function validateDecisionGate(
  gate: Bzm21DecisionGate,
  path: string,
  model: Bzm21DynamicPolicyModel,
  issues: Bzm21ValidationIssue[],
) {
  if (
    !gate ||
    !(BZM21_GATE_STATUSES as readonly string[]).includes(gate.status) ||
    typeof gate.note !== "string" ||
    gate.note.trim() === ""
  ) {
    issues.push(
      issue(
        "error",
        "measurement",
        "invalid_decision_gate",
        path,
        "実行可能性・権限・同意の状態と理由を明示する。",
      ),
    );
    return;
  }
  validateEvidence(gate.evidence, `${path}.evidence`, model, issues);
}

function fundingScheduleExclusionReason(action: Bzm21Action): string | null {
  const financing = action.financingFeasibility;
  const requiredTotal = action.requiredFundingMillionJpy;
  if (requiredTotal === null) return "必要資金額が欠測";
  if (financing.openingCashMillionJpy === null) return "判断時点の現金残高が欠測";
  if (
    !Array.isArray(financing.requiredFundingSchedule) ||
    !Array.isArray(financing.committedFundingSchedule)
  ) {
    return "資金の入出金時点が欠測";
  }

  const requiredRows = financing.requiredFundingSchedule;
  const committedRows = financing.committedFundingSchedule;
  if (
    requiredRows.some(
      (row) =>
        !isNonNegativeNumber(row.atMonths) ||
        !isNonNegativeNumber(row.amountMillionJpy) ||
        !row.purpose?.trim(),
    ) ||
    committedRows.some(
      (row) =>
        !isNonNegativeNumber(row.atMonths) ||
        !isNonNegativeNumber(row.amountMillionJpy) ||
        !Array.isArray(row.permittedPurposes),
    )
  ) {
    return "資金scheduleの金額・時点・使途が欠測";
  }

  const scheduledRequired = requiredRows.reduce(
    (sum, row) => sum + (row.amountMillionJpy ?? 0),
    0,
  );
  if (Math.abs(scheduledRequired - requiredTotal) > EPSILON) {
    return "必要資金総額と支払scheduleが不一致";
  }
  const committedTotal = financing.committedFundingMillionJpy;
  if (committedTotal === null) return "契約済み・確保済み資金額が欠測";
  const scheduledCommitted = committedRows.reduce(
    (sum, row) => sum + (row.amountMillionJpy ?? 0),
    0,
  );
  if (Math.abs(scheduledCommitted - committedTotal) > EPSILON) {
    return "確保済み資金総額と入金scheduleが不一致";
  }

  const sources = [
    {
      atMonths: 0,
      remaining: financing.openingCashMillionJpy,
      permittedPurposes: [] as string[],
    },
    ...committedRows.map((row) => ({
      atMonths: row.atMonths ?? Number.POSITIVE_INFINITY,
      remaining: row.amountMillionJpy ?? 0,
      permittedPurposes: row.permittedPurposes,
    })),
  ];
  const requirements = [...requiredRows].sort(
    (left, right) => (left.atMonths ?? 0) - (right.atMonths ?? 0),
  );
  for (const requirement of requirements) {
    let remaining = requirement.amountMillionJpy ?? 0;
    const eligible = sources
      .filter(
        (source) =>
          source.atMonths <= (requirement.atMonths ?? -1) &&
          (source.permittedPurposes.length === 0 ||
            source.permittedPurposes.includes(requirement.purpose)),
      )
      .sort((left, right) => {
        const leftFlexibility =
          left.permittedPurposes.length === 0
            ? Number.POSITIVE_INFINITY
            : left.permittedPurposes.length;
        const rightFlexibility =
          right.permittedPurposes.length === 0
            ? Number.POSITIVE_INFINITY
            : right.permittedPurposes.length;
        return leftFlexibility - rightFlexibility;
      });
    for (const source of eligible) {
      const used = Math.min(source.remaining, remaining);
      source.remaining -= used;
      remaining -= used;
      if (remaining <= EPSILON) break;
    }
    if (remaining > EPSILON) {
      return `資金の崖: ${requirement.atMonths}か月時点の${requirement.purpose}支払に不足`;
    }
  }
  return null;
}

function actionExclusionReason(action: Bzm21Action): string | null {
  if (action.availability === "unavailable") return "行動が利用不可";
  if (action.availability === "unknown") return "行動の利用可否が未確認";
  if (!action.feasibility || !action.authority || !action.financingFeasibility) {
    return "実行ゲートが欠測";
  }
  if (action.feasibility.status === "blocked") return "実行可能性が否定";
  if (action.feasibility.status === "unknown") return "実行可能性が未確認";
  if (action.authority.status === "blocked") return "意思決定権限がない";
  if (action.authority.status === "unknown") return "意思決定権限が未確認";
  const blockedConsent = (action.consents ?? []).find(
    (consent) => consent.status === "blocked",
  );
  if (blockedConsent) return `必要同意が未取得: ${blockedConsent.label}`;
  const unknownConsent = (action.consents ?? []).find(
    (consent) => consent.status === "unknown",
  );
  if (unknownConsent) return `必要同意が未確認: ${unknownConsent.label}`;
  if (
    action.financingFeasibility.status === "conditional" ||
    action.financingFeasibility.status === "uncontracted" ||
    action.financingFeasibility.status === "blocked"
  ) {
    return "必要資金が現在は実行可能でない";
  }
  if (action.financingFeasibility.status === "unknown") {
    return "資金実行可能性が未確認";
  }
  return fundingScheduleExclusionReason(action);
}

function isActionUncertain(action: Bzm21Action): boolean {
  return (
    action.availability === "unknown" ||
    action.feasibility?.status === "unknown" ||
    action.authority?.status === "unknown" ||
    (action.consents ?? []).some((consent) => consent.status === "unknown") ||
    action.financingFeasibility?.status === "unknown"
  );
}

function isActionExecutable(action: Bzm21Action): boolean {
  return actionExclusionReason(action) === null;
}

function hasCompleteWaitContract(
  action: Bzm21Action,
  controllerObjective: Bzm21Objective | null,
): boolean {
  if (!action.componentKinds.includes("wait")) return true;
  const positiveProbabilityDestinations = new Set(
    action.transitions
      .filter(
        (transition) =>
          isFiniteNumber(transition.probability) &&
          transition.probability > EPSILON,
      )
      .map((transition) =>
        transition.nextStateId
          ? `state:${transition.nextStateId}`
          : `terminal:${transition.terminalOutcome ?? "unknown"}`,
      ),
  );
  const hasWaitingCost = controllerObjective
    ? (action.immediateCostMillionJpy[controllerObjective] ?? 0) > 0 ||
      action.transitions.some(
        (transition) =>
          (transition.transitionCashFlowMillionJpy?.[controllerObjective] ??
            0) < 0,
      )
    : BZM21_OBJECTIVES.some(
        (perspective) =>
          (action.immediateCostMillionJpy[perspective] ?? 0) > 0,
      );
  return (
    isFiniteNumber(action.durationMonths) &&
    action.durationMonths > 0 &&
    action.informationGain.length > 0 &&
    positiveProbabilityDestinations.size >= 2 &&
    hasWaitingCost
  );
}

export function validateBzm21DynamicPolicyModel(
  model: Bzm21DynamicPolicyModel,
): Bzm21ValidationIssue[] {
  const issues: Bzm21ValidationIssue[] = [];
  if (model.schema !== BZM21_DYNAMIC_POLICY_SCHEMA) {
    issues.push(
      issue(
        "error",
        "reachability",
        "invalid_schema",
        "schema",
        "BZM 2.1動的方針モデルのスキーマ版が一致しない。",
      ),
    );
  }
  if (!model.modelId?.trim() || !model.modelVersion?.trim()) {
    issues.push(
      issue(
        "error",
        "measurement",
        "missing_model_identity",
        "modelId",
        "モデルIDと版を空欄にはできない。",
      ),
    );
  }
  if (
    !model.baselinePolicyId?.trim() ||
    !model.policyDefinitionRef?.trim()
  ) {
    issues.push(
      issue(
        "error",
        "measurement",
        "missing_policy_identity",
        "baselinePolicyId",
        "固定方針IDと、その凍結定義への参照を空欄にはできない。",
      ),
    );
  }
  if (!isIsoDate(model.valuationDate)) {
    issues.push(
      issue(
        "error",
        "valuation",
        "invalid_valuation_date",
        "valuationDate",
        "評価日はYYYY-MM-DDで固定する。",
      ),
    );
  }
  if (!isIsoTimestamp(model.informationCutoff)) {
    issues.push(
      issue(
        "error",
        "measurement",
        "invalid_information_cutoff",
        "informationCutoff",
        "情報締切を再現可能な日時で固定する。",
      ),
    );
  }
  if (
    !Number.isInteger(model.forwardValidationCount) ||
    model.forwardValidationCount < 0
  ) {
    issues.push(
      issue(
        "error",
        "measurement",
        "invalid_forward_validation_count",
        "forwardValidationCount",
        "前向き検証件数は0以上の整数で記録する。",
      ),
    );
  }
  if (model.currency !== "JPY") {
    issues.push(
      issue(
        "error",
        "valuation",
        "unsupported_currency",
        "currency",
        "最小契約v0.1の金額単位はJPYに固定する。",
      ),
    );
  }
  if (
    !isNonNegativeNumber(model.planDeadlineMonths) ||
    !isNonNegativeNumber(model.evaluationHorizonMonths) ||
    asNumberOrInfinity(model.planDeadlineMonths) >
      asNumberOrInfinity(model.evaluationHorizonMonths)
  ) {
    issues.push(
      issue(
        "error",
        "reachability",
        "invalid_model_horizon",
        "planDeadlineMonths",
        "計画期限と共通経済評価地平を月数で固定し、計画期限を評価地平以内に置く。",
      ),
    );
  }
  if (!model.tieBreakRule) {
    issues.push(
      issue(
        "error",
        "valuation",
        "missing_tie_break_rule",
        "tieBreakRule",
        "同価値で到達見込みが異なる方針をコード順で選ばないため、事前の同率処理規則が必要。",
      ),
    );
  } else {
    validateEvidence(
      model.tieBreakRule.evidence,
      "tieBreakRule.evidence",
      model,
      issues,
    );
  }
  if (!model.publicValueRule) {
    issues.push(
      issue(
        "error",
        "valuation",
        "missing_public_value_rule",
        "publicValueRule",
        "公的視点の単一価値は、事前登録した政策目的と貨幣換算規則がなければ計算しない。",
        "public",
      ),
    );
  } else {
    if (
      !model.publicValueRule.fiscalRuleRef.trim() ||
      !model.publicValueRule.socialMandateRef.trim() ||
      !model.publicValueRule.socialConversionRuleRef.trim() ||
      !model.publicValueRule.aggregationRuleRef.trim() ||
      !isIsoTimestamp(model.publicValueRule.preregisteredAt) ||
      (isIsoTimestamp(model.informationCutoff) &&
        Date.parse(model.publicValueRule.preregisteredAt) >
          Date.parse(model.informationCutoff))
    ) {
      issues.push(
        issue(
          "error",
          "valuation",
          "invalid_public_value_rule",
          "publicValueRule",
          "基金財政、社会的使命、社会便益換算、両者の集約規則と事前登録時点を分けて固定する。",
          "public",
        ),
      );
    }
    validateEvidence(
      model.publicValueRule.evidence,
      "publicValueRule.evidence",
      model,
      issues,
    );
  }
  validateObjectiveAmounts(
    model.discountRatePerMonth,
    "discountRatePerMonth",
    issues,
  );
  for (const perspective of BZM21_OBJECTIVES) {
    const valuationRule = model.valuationRuleByObjective?.[perspective];
    if (
      !valuationRule ||
      !valuationRule.ruleId?.trim() ||
      !valuationRule.ruleRef?.trim()
    ) {
      issues.push(
        issue(
          "error",
          "valuation",
          "missing_valuation_rule",
          `valuationRuleByObjective.${perspective}`,
          "最小版は物理確率と明示した一定割引だけを計算し、他の価格づけ測度を同じ算術へ流用しない。",
          perspective,
        ),
      );
    } else if (
      valuationRule.probabilityMeasure !== "physical" ||
      valuationRule.discounting !== "deterministic_rate" ||
      valuationRule.discountRateBasis !== "nominal" ||
      ![
        "pre_tax_plus_explicit_tax_payments",
        "post_tax_inclusive",
        "tax_exempt",
      ].includes(valuationRule.taxBasis)
    ) {
      issues.push(
        issue(
          "error",
          "valuation",
          "unsupported_valuation_measure",
          `valuationRuleByObjective.${perspective}`,
          "最小版は物理確率と明示した一定割引だけを計算し、リスク中立測度やSDFを同じ算術へ流用しない。",
          perspective,
        ),
      );
    } else {
      validateEvidence(
        valuationRule.evidence,
        `valuationRuleByObjective.${perspective}.evidence`,
        model,
        issues,
      );
    }
    const criterion = model.decisionCriterionByObjective?.[perspective];
    if (
      !criterion ||
      criterion.criterion !== "max_expected_net_value" ||
      !isNonNegativeNumber(criterion.nearTieToleranceMillionJpy)
    ) {
      issues.push(
        issue(
          "error",
          "valuation",
          "invalid_decision_criterion",
          `decisionCriterionByObjective.${perspective}`,
          "価値評価とは別に、期待正味価値の最大化基準と近接判定幅を固定する。",
          perspective,
        ),
      );
    } else {
      validateEvidence(
        criterion.evidence,
        `decisionCriterionByObjective.${perspective}.evidence`,
        model,
        issues,
      );
    }
  }
  if (
    !model.uncertaintyRule ||
    !["stable", "not_assessed", "decision_switches"].includes(
      model.uncertaintyRule.status,
    ) ||
    !model.uncertaintyRule.methodRef?.trim()
  ) {
    issues.push(
      issue(
        "error",
        "valuation",
        "missing_uncertainty_rule",
        "uncertaintyRule",
        "入力区間・分布・評価者差で行動順位が変わるかを判定する事前規則が必要。",
      ),
    );
  } else {
    validateEvidence(
      model.uncertaintyRule.evidence,
      "uncertaintyRule.evidence",
      model,
      issues,
    );
    if (
      model.uncertaintyRule.status === "decision_switches" ||
      (model.dataMode === "project" &&
        model.uncertaintyRule.status === "not_assessed")
    ) {
      issues.push(
        issue(
          "warning",
          "valuation",
          "decision_indeterminate_under_uncertainty",
          "uncertaintyRule.status",
          "入力不確実性の範囲で最高行動が入れ替わるか未確認のため、単一最適方針を出さない。",
        ),
      );
    }
  }

  const cashFlowEventById = new Map<string, Bzm21CashFlowEvent>();
  for (const [eventIndex, event] of (model.cashFlowEvents ?? []).entries()) {
    const eventPath = `cashFlowEvents[${eventIndex}]`;
    if (!event.eventId?.trim() || cashFlowEventById.has(event.eventId)) {
      issues.push(
        issue(
          "error",
          "valuation",
          "duplicate_or_missing_cashflow_event_id",
          `${eventPath}.eventId`,
          "キャッシュフロー事象IDは空欄不可かつ計算台帳内で一意にする。",
        ),
      );
    } else {
      cashFlowEventById.set(event.eventId, event);
    }
    if (
      !event.label?.trim() ||
      !event.stateId?.trim() ||
      !event.actionId?.trim() ||
      !event.owner?.trim() ||
      !event.counterparty?.trim() ||
      !event.scope?.trim() ||
      event.amountBasis !== "nominal" ||
      !(BZM21_CASH_FLOW_ECONOMIC_NATURES as readonly string[]).includes(
        event.economicNature,
      ) ||
      !(BZM21_TAX_TREATMENTS as readonly string[]).includes(
        event.taxTreatment,
      ) ||
      !(BZM21_CASH_FLOW_CATEGORIES as readonly string[]).includes(
        event.includedIn,
      ) ||
      !["action_start", "action_end"].includes(event.timing)
    ) {
      issues.push(
        issue(
          "error",
          "valuation",
          "invalid_cashflow_event",
          eventPath,
          "単一CF台帳の帰属、範囲、時点、金額基準、税区分、集計区分を固定する。",
        ),
      );
    }
    if (
      event.economicNature === "financing" &&
      event.objectiveAmountsMillionJpy.company !== null &&
      Math.abs(event.objectiveAmountsMillionJpy.company) > EPSILON
    ) {
      issues.push(
        issue(
          "error",
          "valuation",
          "company_value_includes_financing_cashflow",
          `${eventPath}.objectiveAmountsMillionJpy.company`,
          "資金調達の入出金は会社保有PJの事業価値へ入れず、資金制約とBZSF証券CFへ分離する。",
          "company",
        ),
      );
    }
    const isImmediate =
      event.includedIn === "immediate_cost" ||
      event.includedIn === "immediate_benefit";
    if (
      (isImmediate &&
        (event.transitionId !== null || event.timing !== "action_start")) ||
      (!isImmediate &&
        (!event.transitionId?.trim() || event.timing !== "action_end"))
    ) {
      issues.push(
        issue(
          "error",
          "valuation",
          "cashflow_timing_scope_mismatch",
          eventPath,
          "即時CFは行動開始へ、遷移・終端・失敗CFは一つの遷移終了へだけ帰属させる。",
        ),
      );
    }
    validateObjectiveAmounts(
      event.objectiveAmountsMillionJpy,
      `${eventPath}.objectiveAmountsMillionJpy`,
      issues,
      {
        allowNegative:
          event.includedIn === "transition_cash_flow" ||
          event.includedIn === "terminal_value",
      },
    );
    validateEvidence(event.evidence, `${eventPath}.evidence`, model, issues);
  }
  if ((model.cashFlowEvents ?? []).length === 0) {
    issues.push(
      issue(
        "error",
        "valuation",
        "missing_cashflow_ledger",
        "cashFlowEvents",
        "価値計算は単一の経路キャッシュフロー台帳からだけ派生させる。",
      ),
    );
  }

  const cashFlowReferenceCount = new Map<string, number>();
  const stateById = new Map<string, Bzm21DecisionState>();
  let registeredControllerId: string | null = null;
  let registeredControllerObjective: Bzm21Objective | null = null;
  for (const [stateIndex, state] of model.states.entries()) {
    const statePath = `states[${stateIndex}]`;
    if (!state.stateId?.trim() || stateById.has(state.stateId)) {
      issues.push(
        issue(
          "error",
          "reachability",
          "duplicate_or_missing_state_id",
          `${statePath}.stateId`,
          "状態IDは空欄不可かつモデル内で一意でなければならない。",
        ),
      );
    } else {
      stateById.set(state.stateId, state);
    }
    if (!Number.isInteger(state.decisionOrder) || state.decisionOrder < 0) {
      issues.push(
        issue(
          "error",
          "reachability",
          "invalid_decision_order",
          `${statePath}.decisionOrder`,
          "有限地平を保証するため意思決定順序は0以上の整数にする。",
        ),
      );
    }
    if (
      !isNonNegativeNumber(state.elapsedMonths) ||
      (isNonNegativeNumber(model.evaluationHorizonMonths) &&
        asNumberOrInfinity(state.elapsedMonths) > model.evaluationHorizonMonths)
    ) {
      issues.push(
        issue(
          "error",
          "reachability",
          "invalid_state_elapsed_months",
          `${statePath}.elapsedMonths`,
          "状態時点は評価日からの経過月数で置き、共通評価地平を超えないようにする。",
        ),
      );
    }
    const history = state.reachabilityHistory;
    const goalHistory = history?.goal;
    const slackHistory = history?.strategicSlack;
    const goalHistoryValid =
      goalHistory &&
      ["not_reached", "reached", "unknown"].includes(goalHistory.status) &&
      ((goalHistory.status === "reached" &&
        isNonNegativeNumber(goalHistory.firstReachedAtMonths)) ||
        (goalHistory.status !== "reached" &&
          goalHistory.firstReachedAtMonths === null));
    const slackHistoryValid =
      slackHistory &&
      ["available", "lost", "unknown"].includes(slackHistory.status) &&
      ((slackHistory.status === "lost" &&
        isNonNegativeNumber(slackHistory.firstLostAtMonths)) ||
        (slackHistory.status !== "lost" &&
          slackHistory.firstLostAtMonths === null));
    if (!goalHistoryValid || !slackHistoryValid) {
      issues.push(
        issue(
          "error",
          "reachability",
          "invalid_reachability_history",
          `${statePath}.reachabilityHistory`,
          "各状態でGへの初回到達と戦略余力の初回喪失を、時刻つき履歴として保持する。",
        ),
      );
    } else {
      validateEvidence(
        goalHistory.evidence,
        `${statePath}.reachabilityHistory.goal.evidence`,
        model,
        issues,
      );
      validateEvidence(
        slackHistory.evidence,
        `${statePath}.reachabilityHistory.strategicSlack.evidence`,
        model,
        issues,
      );
      if (
        goalHistory.status === "unknown" ||
        slackHistory.status === "unknown"
      ) {
        issues.push(
          issue(
            "error",
            "reachability",
            "unknown_reachability_history",
            `${statePath}.reachabilityHistory`,
            "過去の到達・余力喪失が未確認の状態ではfirst-passage到達率を計算しない。",
          ),
        );
      }
      if (
        (goalHistory.firstReachedAtMonths !== null &&
          isNonNegativeNumber(state.elapsedMonths) &&
          goalHistory.firstReachedAtMonths > state.elapsedMonths + EPSILON) ||
        (slackHistory.firstLostAtMonths !== null &&
          isNonNegativeNumber(state.elapsedMonths) &&
          slackHistory.firstLostAtMonths > state.elapsedMonths + EPSILON)
      ) {
        issues.push(
          issue(
            "error",
            "reachability",
            "future_event_in_state_history",
            `${statePath}.reachabilityHistory`,
            "状態時点より後の出来事を履歴へ先回りして入れない。",
          ),
        );
      }
    }
    if (!state.currentState || Object.keys(state.currentState).length === 0) {
      issues.push(
        issue(
          "warning",
          "measurement",
          "empty_current_state",
          `${statePath}.currentState`,
          "現在状態の観測変数が空欄になっている。",
        ),
      );
    }
    if (
      !state.decisionController ||
      !state.decisionController.controllerId?.trim() ||
      !["company", "bzsf", "public", "joint", "external"].includes(
        state.decisionController.kind,
      ) ||
      (state.decisionController.objective !== null &&
        !(BZM21_OBJECTIVES as readonly string[]).includes(
          state.decisionController.objective,
        ))
    ) {
      issues.push(
        issue(
          "error",
          "measurement",
          "missing_decision_controller",
          `${statePath}.decisionController`,
          "価値を評価する視点とは別に、実際の意思決定権限主体を固定する。",
        ),
      );
    } else {
      validateEvidence(
        state.decisionController.evidence,
        `${statePath}.decisionController.evidence`,
        model,
        issues,
      );
      if (
        state.decisionController.kind === "joint" ||
        state.decisionController.kind === "external" ||
        state.decisionController.objective === null
      ) {
        issues.push(
          issue(
            "error",
            "valuation",
            "multi_actor_decision_not_closed",
            `${statePath}.decisionController`,
            "最小版は単一権限主体と、その主体が事前登録した一つの目的だけを最適化する。共同・外部主体は交渉拡張まで計算しない。",
          ),
        );
      } else if (registeredControllerId === null) {
        registeredControllerId = state.decisionController.controllerId;
        registeredControllerObjective = state.decisionController.objective;
      } else if (
        registeredControllerId !== state.decisionController.controllerId ||
        registeredControllerObjective !== state.decisionController.objective
      ) {
        issues.push(
          issue(
            "error",
            "valuation",
            "controller_changes_within_model",
            `${statePath}.decisionController`,
            "ノード間で権限主体または目的が変わる問題は、単一主体Bellman問題として閉じていない。",
          ),
        );
      }
    }
    for (const [beliefIndex, belief] of (state.beliefs ?? []).entries()) {
      const beliefPath = `${statePath}.beliefs[${beliefIndex}]`;
      if (
        !belief.beliefId?.trim() ||
        !belief.label?.trim() ||
        !Array.isArray(belief.possibleValues) ||
        belief.possibleValues.length === 0
      ) {
        issues.push(
          issue(
            "error",
            "reachability",
            "invalid_belief_state",
            beliefPath,
            "潜在状態は候補値と信念確率を持つ台帳として表現する。",
          ),
        );
      } else {
        const probabilitySum = belief.possibleValues.reduce(
          (sum, candidate) =>
            sum +
            (isFiniteNumber(candidate.probability)
              ? candidate.probability
              : 0),
          0,
        );
        if (
          belief.possibleValues.some(
            (candidate) =>
              !candidate.value?.trim() ||
              !isFiniteNumber(candidate.probability) ||
              candidate.probability < 0 ||
              candidate.probability > 1,
          ) ||
          Math.abs(probabilitySum - 1) > EPSILON
        ) {
          issues.push(
            issue(
              "error",
              "reachability",
              "belief_probabilities_not_closed",
              `${beliefPath}.possibleValues`,
              "潜在状態の信念確率は欠測を0にせず、合計1へ閉じる。",
            ),
          );
        }
      }
      validateEvidence(
        belief.evidence,
        `${beliefPath}.evidence`,
        model,
        issues,
      );
    }
    if (
      state.sunkCostMillionJpy !== null &&
      !isNonNegativeNumber(state.sunkCostMillionJpy)
    ) {
      issues.push(
        issue(
          "error",
          "measurement",
          "invalid_sunk_cost",
          `${statePath}.sunkCostMillionJpy`,
          "埋没費用は履歴表示用の0以上の値か欠測nullにする。将来比較へ再控除しない。",
        ),
      );
    }
    if (state.remainingCostMillionJpy === null) {
      issues.push(
        issue(
          "warning",
          "measurement",
          "missing_remaining_cost_summary",
          `${statePath}.remainingCostMillionJpy`,
          "残り費用の状態要約は欠測。行動別費用を代わりに推測しない。",
        ),
      );
    } else if (!isNonNegativeNumber(state.remainingCostMillionJpy)) {
      issues.push(
        issue(
          "error",
          "measurement",
          "invalid_remaining_cost_summary",
          `${statePath}.remainingCostMillionJpy`,
          "残り費用は0以上の有限値か欠測nullにする。",
        ),
      );
    }
    if (state.remainingTimeMonths === null) {
      issues.push(
        issue(
          "warning",
          "measurement",
          "missing_remaining_time_summary",
          `${statePath}.remainingTimeMonths`,
          "残り時間の状態要約は欠測。行動期間を代わりに推測しない。",
        ),
      );
    } else if (!isNonNegativeNumber(state.remainingTimeMonths)) {
      issues.push(
        issue(
          "error",
          "measurement",
          "invalid_remaining_time_summary",
          `${statePath}.remainingTimeMonths`,
          "残り時間は0以上の有限値か欠測nullにする。",
        ),
      );
    }
    if (!Array.isArray(state.actions) || state.actions.length === 0) {
      issues.push(
        issue(
          "error",
          "reachability",
          "no_available_action",
          `${statePath}.actions`,
          "意思決定状態にはPJで実行可能な行動を1つ以上置く。",
        ),
      );
    }
    validateEvidence(state.evidence, `${statePath}.evidence`, model, issues);

    const actionIds = new Set<string>();
    for (const [actionIndex, rawAction] of state.actions.entries()) {
      const actionPath = `${statePath}.actions[${actionIndex}]`;
      const sequenceStages = Array.isArray(rawAction.sequence)
        ? rawAction.sequence
        : [];
      const sequenceIsValid = sequenceStages.every(
        (stage) =>
          (typeof stage === "string" && stage.trim() !== "") ||
          (Array.isArray(stage) &&
            stage.length >= 2 &&
            stage.every(
              (component) =>
                typeof component === "string" && component.trim() !== "",
            )),
      );
      const flattenedSequence = sequenceIsValid
        ? sequenceStages.flatMap((stage) =>
            typeof stage === "string" ? [stage] : stage,
          )
        : [];
      if (!rawAction.actionId?.trim() || actionIds.has(rawAction.actionId)) {
        issues.push(
          issue(
            "error",
            "reachability",
            "duplicate_or_missing_action_id",
            `${actionPath}.actionId`,
            "行動IDは同じ状態内で一意にする。",
          ),
        );
      }
      actionIds.add(rawAction.actionId);
      if (
        !rawAction.bundleId?.trim() ||
        !Array.isArray(rawAction.componentKinds) ||
        rawAction.componentKinds.length === 0 ||
        !rawAction.componentKinds.includes(rawAction.kind) ||
        rawAction.componentKinds.some(
          (component) =>
            !(BZM21_ACTION_KINDS as readonly string[]).includes(component),
        ) ||
        !Array.isArray(rawAction.customComponents) ||
        !sequenceIsValid ||
        rawAction.sequence.length === 0 ||
        rawAction.customComponents.some(
          (component) => !component?.trim(),
        ) ||
        new Set([
          ...rawAction.componentKinds,
          ...rawAction.customComponents,
        ]).size !==
          rawAction.componentKinds.length + rawAction.customComponents.length ||
        flattenedSequence.length !==
          rawAction.componentKinds.length + rawAction.customComponents.length ||
        new Set(flattenedSequence).size !== flattenedSequence.length ||
        ![
          ...rawAction.componentKinds,
          ...rawAction.customComponents,
        ].every((component) => flattenedSequence.includes(component))
      ) {
        issues.push(
          issue(
            "error",
            "reachability",
            "invalid_action_bundle",
            actionPath,
            "Bellman行動は、直列stageと並列stageを区別したbundleで表し、全componentを一度ずつ配置する。",
          ),
        );
      }
      if (
        !(BZM21_ACTION_KINDS as readonly string[]).includes(rawAction.kind)
      ) {
        issues.push(
          issue(
            "error",
            "reachability",
            "unsupported_action_kind",
            `${actionPath}.kind`,
            "行動種別がBZM 2.1の表現可能な集合に含まれていない。",
          ),
        );
      }
      if (
        rawAction.availability !== "available" &&
        rawAction.availability !== "unavailable" &&
        rawAction.availability !== "unknown"
      ) {
        issues.push(
          issue(
            "error",
            "valuation",
            "invalid_action_availability",
            `${actionPath}.availability`,
            "行動の利用可否をavailable / unavailable / unknownで明示する。",
          ),
        );
      }
      validateDecisionGate(
        rawAction.feasibility,
        `${actionPath}.feasibility`,
        model,
        issues,
      );
      validateDecisionGate(
        rawAction.authority,
        `${actionPath}.authority`,
        model,
        issues,
      );
      for (const [consentIndex, consent] of rawAction.consents.entries()) {
        const consentPath = `${actionPath}.consents[${consentIndex}]`;
        if (!consent.consentId?.trim() || !consent.label?.trim()) {
          issues.push(
            issue(
              "error",
              "measurement",
              "invalid_consent_gate",
              consentPath,
              "必要同意にはIDと名称を付ける。",
            ),
          );
        }
        validateDecisionGate(consent, consentPath, model, issues);
      }
      const financing = rawAction.financingFeasibility;
      if (
        !financing ||
        !(BZM21_FINANCING_STATUSES as readonly string[]).includes(
          financing.status,
        ) ||
        typeof financing.note !== "string" ||
        financing.note.trim() === "" ||
        (financing.openingCashMillionJpy !== null &&
          !isNonNegativeAmount(financing.openingCashMillionJpy)) ||
        (financing.committedFundingMillionJpy !== null &&
          !isNonNegativeAmount(financing.committedFundingMillionJpy)) ||
        !Array.isArray(financing.requiredFundingSchedule) ||
        !Array.isArray(financing.committedFundingSchedule)
      ) {
        issues.push(
          issue(
            "error",
            "funding",
            "invalid_financing_feasibility",
            `${actionPath}.financingFeasibility`,
            "契約済み・確保済み・未契約・条件付き・不明を分け、実行可能な資金額を記録する。",
          ),
        );
      } else {
        validateEvidence(
          financing.evidence,
          `${actionPath}.financingFeasibility.evidence`,
          model,
          issues,
        );
        const scheduleIds = new Set<string>();
        for (const [scheduleIndex, row] of [
          ...financing.requiredFundingSchedule.map((entry) => ({
            ...entry,
            scheduleKind: "required" as const,
          })),
          ...financing.committedFundingSchedule.map((entry) => ({
            ...entry,
            scheduleKind: "committed" as const,
          })),
        ].entries()) {
          const schedulePath = `${actionPath}.financingFeasibility.schedule[${scheduleIndex}]`;
          const purposeValid =
            row.scheduleKind === "required"
              ? "purpose" in row && typeof row.purpose === "string" && row.purpose.trim() !== ""
              : "permittedPurposes" in row &&
                Array.isArray(row.permittedPurposes) &&
                row.permittedPurposes.every(
                  (purpose) => typeof purpose === "string" && purpose.trim() !== "",
                );
          if (
            !row.scheduleId?.trim() ||
            scheduleIds.has(row.scheduleId) ||
            !isNonNegativeNumber(row.atMonths) ||
            !isNonNegativeNumber(row.amountMillionJpy) ||
            !purposeValid
          ) {
            issues.push(
              issue(
                "error",
                "funding",
                "invalid_funding_schedule",
                schedulePath,
                "資金の入出金は一意ID、絶対月、金額、使途または使途制限、根拠を持たせる。",
              ),
            );
          }
          scheduleIds.add(row.scheduleId);
          validateEvidence(row.evidence, `${schedulePath}.evidence`, model, issues);
        }
      }
      for (const [resourceIndex, resource] of (
        rawAction.sharedResourceRequirements ?? []
      ).entries()) {
        const resourcePath = `${actionPath}.sharedResourceRequirements[${resourceIndex}]`;
        if (
          !resource.resourceId?.trim() ||
          !resource.unit?.trim() ||
          !isNonNegativeNumber(resource.amount)
        ) {
          issues.push(
            issue(
              "error",
              "measurement",
              "invalid_shared_resource_requirement",
              resourcePath,
              "共有設備・人員等の必要量はID、単位、根拠ある量で固定する。",
            ),
          );
        }
        validateEvidence(
          resource.evidence,
          `${resourcePath}.evidence`,
          model,
          issues,
        );
      }
      validateEvidence(rawAction.evidence, `${actionPath}.evidence`, model, issues);
      if (!isNonNegativeNumber(rawAction.durationMonths)) {
        issues.push(
          issue(
            "error",
            "valuation",
            rawAction.durationMonths === null
              ? "missing_action_duration"
              : "invalid_action_duration",
            `${actionPath}.durationMonths`,
            "行動期間は0以上の有限値が必要。欠測を0か月にしない。",
          ),
        );
      } else if (
        isNonNegativeNumber(state.elapsedMonths) &&
        isNonNegativeNumber(model.evaluationHorizonMonths) &&
        state.elapsedMonths + rawAction.durationMonths - EPSILON >
          model.evaluationHorizonMonths
      ) {
        issues.push(
          issue(
            "error",
            "reachability",
            "action_exceeds_evaluation_horizon",
            `${actionPath}.durationMonths`,
            "行動の終了時点が共通経済評価地平を超える。地平時点のunresolved状態へ切る。",
          ),
        );
      }
      if (!isNonNegativeAmount(rawAction.requiredFundingMillionJpy)) {
        issues.push(
          issue(
            "error",
            "funding",
            rawAction.requiredFundingMillionJpy === null
              ? "missing_required_funding"
              : "invalid_required_funding",
            `${actionPath}.requiredFundingMillionJpy`,
            "必要資金は0以上の有限値が必要。欠測を0円にしない。",
          ),
        );
      }
      validateObjectiveAmounts(
        rawAction.immediateCostMillionJpy,
        `${actionPath}.immediateCostMillionJpy`,
        issues,
      );
      validateObjectiveAmounts(
        rawAction.immediateBenefitMillionJpy,
        `${actionPath}.immediateBenefitMillionJpy`,
        issues,
      );
      if (!Array.isArray(rawAction.cashFlowEventIds)) {
        issues.push(
          issue(
            "error",
            "valuation",
            "missing_cashflow_event_refs",
            `${actionPath}.cashFlowEventIds`,
            "行動開始時の集約額を単一CF台帳の事象IDへ対応づける。",
          ),
        );
      } else {
        const referencedCategories = new Set(
          rawAction.cashFlowEventIds
            .map((eventId) => cashFlowEventById.get(eventId)?.includedIn)
            .filter(
              (category): category is Bzm21CashFlowCategory =>
                category !== undefined,
            ),
        );
        for (const requiredCategory of [
          "immediate_cost",
          "immediate_benefit",
        ] as const) {
          if (!referencedCategories.has(requiredCategory)) {
            issues.push(
              issue(
                "error",
                "valuation",
                "missing_explicit_cashflow_category",
                `${actionPath}.cashFlowEventIds`,
                "金額0も根拠付きCF事象として明示し、費目不在を暗黙の0へ変換しない。",
              ),
            );
          }
        }
        for (const eventId of rawAction.cashFlowEventIds) {
          cashFlowReferenceCount.set(
            eventId,
            (cashFlowReferenceCount.get(eventId) ?? 0) + 1,
          );
          const event = cashFlowEventById.get(eventId);
          if (
            !event ||
            event.stateId !== state.stateId ||
            event.actionId !== rawAction.actionId ||
            event.transitionId !== null ||
            ![
              "immediate_cost",
              "immediate_benefit",
            ].includes(event.includedIn)
          ) {
            issues.push(
              issue(
                "error",
                "valuation",
                "cashflow_event_scope_mismatch",
                `${actionPath}.cashFlowEventIds`,
                "CF事象は台帳上の状態・行動・遷移・集計区分と一致する場所から一度だけ参照する。",
              ),
            );
          }
        }
        const derivedImmediateCost = deriveCashFlowCategory(
          model,
          state.stateId,
          rawAction.actionId,
          rawAction.cashFlowEventIds,
          "immediate_cost",
          false,
        );
        const derivedImmediateBenefit = deriveCashFlowCategory(
          model,
          state.stateId,
          rawAction.actionId,
          rawAction.cashFlowEventIds,
          "immediate_benefit",
          false,
        );
        if (
          !amountsEqual(
            rawAction.immediateCostMillionJpy,
            derivedImmediateCost,
          ) ||
          !amountsEqual(
            rawAction.immediateBenefitMillionJpy,
            derivedImmediateBenefit,
          )
        ) {
          issues.push(
            issue(
              "error",
              "valuation",
              "cashflow_cache_mismatch",
              actionPath,
              "行動の集約額が単一CF台帳からの再集計と一致しない。",
            ),
          );
        }
      }
      if (rawAction.componentKinds.includes("wait")) {
        if (
          !hasCompleteWaitContract(
            rawAction,
            state.decisionController?.objective ?? null,
          )
        ) {
          issues.push(
            issue(
              "error",
              "valuation",
              "incomplete_wait_contract",
              actionPath,
              "WAITには正の待機期間、到来情報、情報で分かれる複数経路、権限主体が負担する待機費用を同時に置く。",
            ),
          );
        }
      }
      if (!Array.isArray(rawAction.transitions) || rawAction.transitions.length === 0) {
        issues.push(
          issue(
            "error",
            "reachability",
            "no_transition",
            `${actionPath}.transitions`,
            "各行動には少なくとも1つの将来経路が必要。",
          ),
        );
      }
      const transitionIds = new Set<string>();
      for (const [transitionIndex, transition] of rawAction.transitions.entries()) {
        const transitionPath = `${actionPath}.transitions[${transitionIndex}]`;
        if (
          !transition.transitionId?.trim() ||
          transitionIds.has(transition.transitionId)
        ) {
          issues.push(
            issue(
              "error",
              "reachability",
              "duplicate_or_missing_transition_id",
              `${transitionPath}.transitionId`,
              "遷移IDは同じ行動内で一意にする。",
            ),
          );
        }
        transitionIds.add(transition.transitionId);
        if (
          !isFiniteNumber(transition.probability) ||
          transition.probability < 0 ||
          transition.probability > 1
        ) {
          issues.push(
            issue(
              "error",
              "reachability",
              transition.probability === null
                ? "missing_transition_probability"
                : "invalid_transition_probability",
              `${transitionPath}.probability`,
              "遷移確率は0から1の根拠ある有限値が必要。",
            ),
          );
        }
        const hasNext = typeof transition.nextStateId === "string";
        const hasTerminal = transition.terminalOutcome !== null;
        if (hasNext === hasTerminal) {
          issues.push(
            issue(
              "error",
              "reachability",
              "ambiguous_transition_destination",
              transitionPath,
              "遷移先は次状態か終端結果のどちらか一方だけにする。",
            ),
          );
        }
        if (
          hasTerminal &&
          !(BZM21_TERMINAL_OUTCOMES as readonly string[]).includes(
            transition.terminalOutcome as string,
          )
        ) {
          issues.push(
            issue(
              "error",
              "reachability",
              "unsupported_terminal_outcome",
              `${transitionPath}.terminalOutcome`,
              "終端結果がBZM 2.1の結果集合に含まれていない。",
            ),
          );
        }
        const transitionStart = state.elapsedMonths;
        const transitionEnd =
          isFiniteNumber(state.elapsedMonths) &&
          isFiniteNumber(rawAction.durationMonths)
            ? state.elapsedMonths + rawAction.durationMonths
            : null;
        for (const [field, value] of [
          ["goalReachedAtMonths", transition.goalReachedAtMonths],
          ["slackLostAtMonths", transition.slackLostAtMonths],
        ] as const) {
          if (
            value !== null &&
            (!isNonNegativeNumber(value) ||
              !isFiniteNumber(transitionStart) ||
              transitionEnd === null ||
              value + EPSILON < transitionStart ||
              value - EPSILON > transitionEnd ||
              (isNonNegativeNumber(model.evaluationHorizonMonths) &&
                value - EPSILON > model.evaluationHorizonMonths))
          ) {
            issues.push(
              issue(
                "error",
                "reachability",
                "invalid_first_passage_time",
                `${transitionPath}.${field}`,
                "G初回到達と戦略余力喪失は、遷移区間内かつ共通評価地平内の絶対月で記録する。",
              ),
            );
          }
        }
        if (
          transition.terminalOutcome === "capital_independent" &&
          transition.goalReachedAtMonths === null &&
          state.reachabilityHistory?.goal.status !== "reached"
        ) {
          issues.push(
            issue(
              "error",
              "reachability",
              "goal_terminal_without_first_passage",
              `${transitionPath}.goalReachedAtMonths`,
              "資本自立終端にはGへの初回到達月が必要。終端名だけでqを立てない。",
            ),
          );
        }
        if (
          (state.reachabilityHistory?.goal.status === "reached" &&
            transition.goalReachedAtMonths !== null) ||
          (state.reachabilityHistory?.strategicSlack.status === "lost" &&
            transition.slackLostAtMonths !== null)
        ) {
          issues.push(
            issue(
              "error",
              "reachability",
              "duplicate_first_passage_event",
              transitionPath,
              "状態履歴にある初回到達・初回喪失を後続遷移で再記録しない。",
            ),
          );
        }
        validateObjectiveAmounts(
          transition.transitionCashFlowMillionJpy,
          `${transitionPath}.transitionCashFlowMillionJpy`,
          issues,
          { allowNegative: true },
        );
        validateObjectiveAmounts(
          transition.terminalValueMillionJpy,
          `${transitionPath}.terminalValueMillionJpy`,
          issues,
          { allowNegative: true },
        );
        validateObjectiveAmounts(
          transition.failureLossMillionJpy,
          `${transitionPath}.failureLossMillionJpy`,
          issues,
        );
        if (!Array.isArray(transition.cashFlowEventIds)) {
          issues.push(
            issue(
              "error",
              "valuation",
              "missing_cashflow_event_refs",
              `${transitionPath}.cashFlowEventIds`,
              "遷移中・終端・失敗の集約額を単一CF台帳の事象IDへ対応づける。",
            ),
          );
        } else {
          const referencedCategories = new Set(
            transition.cashFlowEventIds
              .map((eventId) => cashFlowEventById.get(eventId)?.includedIn)
              .filter(
                (category): category is Bzm21CashFlowCategory =>
                  category !== undefined,
              ),
          );
          const requiredCategories: Bzm21CashFlowCategory[] = [
            "transition_cash_flow",
          ];
          if (!hasNext) {
            requiredCategories.push("terminal_value", "failure_loss");
          }
          for (const requiredCategory of requiredCategories) {
            if (!referencedCategories.has(requiredCategory)) {
              issues.push(
                issue(
                  "error",
                  "valuation",
                  "missing_explicit_cashflow_category",
                  `${transitionPath}.cashFlowEventIds`,
                  "金額0も根拠付きCF事象として明示し、費目不在を暗黙の0へ変換しない。",
                ),
              );
            }
          }
          for (const eventId of transition.cashFlowEventIds) {
            cashFlowReferenceCount.set(
              eventId,
              (cashFlowReferenceCount.get(eventId) ?? 0) + 1,
            );
            const event = cashFlowEventById.get(eventId);
            if (
              !event ||
              event.stateId !== state.stateId ||
              event.actionId !== rawAction.actionId ||
              event.transitionId !== transition.transitionId ||
              ["immediate_cost", "immediate_benefit"].includes(
                event.includedIn,
              )
            ) {
              issues.push(
                issue(
                  "error",
                  "valuation",
                  "cashflow_event_scope_mismatch",
                  `${transitionPath}.cashFlowEventIds`,
                  "CF事象は台帳上の状態・行動・遷移・集計区分と一致する場所から一度だけ参照する。",
                ),
              );
            }
          }
          const derivedTransitionCashFlow = deriveCashFlowCategory(
            model,
            state.stateId,
            rawAction.actionId,
            transition.cashFlowEventIds,
            "transition_cash_flow",
            false,
          );
          const derivedTerminalValue = deriveCashFlowCategory(
            model,
            state.stateId,
            rawAction.actionId,
            transition.cashFlowEventIds,
            "terminal_value",
            false,
          );
          const derivedFailureLoss = deriveCashFlowCategory(
            model,
            state.stateId,
            rawAction.actionId,
            transition.cashFlowEventIds,
            "failure_loss",
            false,
          );
          if (
            !amountsEqual(
              transition.transitionCashFlowMillionJpy,
              derivedTransitionCashFlow,
            ) ||
            !amountsEqual(
              transition.terminalValueMillionJpy,
              derivedTerminalValue,
            ) ||
            !amountsEqual(
              transition.failureLossMillionJpy,
              derivedFailureLoss,
            )
          ) {
            issues.push(
              issue(
                "error",
                "valuation",
                "cashflow_cache_mismatch",
                transitionPath,
                "遷移の集約額が単一CF台帳からの再集計と一致しない。",
              ),
            );
          }
        }
        if (
          hasNext &&
          (BZM21_OBJECTIVES.some(
            (perspective) =>
              Math.abs(
                transition.terminalValueMillionJpy[perspective] ?? 0,
              ) > EPSILON,
          ) ||
            BZM21_OBJECTIVES.some(
              (perspective) =>
                Math.abs(
                  transition.failureLossMillionJpy[perspective] ?? 0,
                ) > EPSILON,
            ))
        ) {
          issues.push(
            issue(
              "error",
              "valuation",
              "nonterminal_uses_terminal_cashflow",
              transitionPath,
              "次状態へ進む遷移では終端価値・失敗損失を使わず、遷移中CFへ一度だけ記録する。",
            ),
          );
        }
        validateEvidence(
          transition.evidence,
          `${transitionPath}.evidence`,
          model,
          issues,
        );
      }
      const probabilitySum = rawAction.transitions.reduce(
        (sum, transition) =>
          sum + (isFiniteNumber(transition.probability) ? transition.probability : 0),
        0,
      );
      if (
        rawAction.transitions.every((transition) =>
          isFiniteNumber(transition.probability),
        ) &&
        Math.abs(probabilitySum - 1) > EPSILON
      ) {
        issues.push(
          issue(
            "error",
            "reachability",
            "transition_probabilities_not_closed",
            `${actionPath}.transitions`,
            "同じ行動から出る遷移確率の合計は1にする。",
          ),
        );
      }
      const exclusionReason = actionExclusionReason(rawAction);
      if (isActionUncertain(rawAction)) {
        issues.push(
          issue(
            "error",
            rawAction.financingFeasibility?.status === "unknown"
              ? "funding"
              : "valuation",
            "uncertain_action_admissibility",
            actionPath,
            "利用可否・実行可能性・権限・同意・資金の不明な行動を除外して最適と呼ぶことはできない。",
          ),
        );
      } else if (exclusionReason) {
        issues.push(
          issue(
            "warning",
            "valuation",
            "known_inadmissible_action",
            actionPath,
            exclusionReason,
          ),
        );
      }
    }
    const effectiveActions = state.actions.map((candidate) =>
      effectiveAction(model, state.stateId, candidate),
    );
    if (!effectiveActions.some(isActionExecutable)) {
      issues.push(
        issue(
          "error",
          "valuation",
          "no_executable_action",
          `${statePath}.actions`,
          "既知の制約下で実行可能な行動が1つもない。",
        ),
      );
    }
  }

  for (const [eventId] of cashFlowEventById) {
    const referenceCount = cashFlowReferenceCount.get(eventId) ?? 0;
    if (referenceCount !== 1) {
      issues.push(
        issue(
          "error",
          "valuation",
          "cashflow_event_reference_count",
          `cashFlowEvents.${eventId}`,
          "各CF事象は行動または遷移の一つの集計区分から一度だけ参照する。",
        ),
      );
    }
  }

  if (!stateById.has(model.initialStateId)) {
    issues.push(
      issue(
        "error",
        "reachability",
        "missing_initial_state",
        "initialStateId",
        "初期状態IDが状態台帳に存在しない。",
      ),
    );
  }

  for (const [stateIndex, state] of model.states.entries()) {
    for (const [actionIndex, action] of state.actions.entries()) {
      for (const [transitionIndex, transition] of action.transitions.entries()) {
        if (transition.nextStateId === null) continue;
        const nextState = stateById.get(transition.nextStateId);
        const path = `states[${stateIndex}].actions[${actionIndex}].transitions[${transitionIndex}].nextStateId`;
        if (!nextState) {
          issues.push(
            issue(
              "error",
              "reachability",
              "unknown_next_state",
              path,
              "遷移先の状態IDが状態台帳に存在しない。",
            ),
          );
        } else if (nextState.decisionOrder <= state.decisionOrder) {
          issues.push(
            issue(
              "error",
              "reachability",
              "non_forward_transition",
              path,
              "有限地平を保証するため遷移先の意思決定順序は必ず後にする。",
            ),
          );
        } else if (
          isNonNegativeNumber(state.elapsedMonths) &&
          isNonNegativeNumber(action.durationMonths) &&
          (!isNonNegativeNumber(nextState.elapsedMonths) ||
            Math.abs(
              nextState.elapsedMonths -
                (state.elapsedMonths + action.durationMonths),
            ) > EPSILON)
        ) {
          issues.push(
            issue(
              "error",
              "reachability",
              "next_state_time_mismatch",
              path,
              "遷移先状態の経過月は、現在状態と行動期間から再現できなければならない。",
            ),
          );
        } else {
          const currentGoalAt =
            state.reachabilityHistory?.goal.status === "reached"
              ? state.reachabilityHistory.goal.firstReachedAtMonths
              : null;
          const currentSlackLostAt =
            state.reachabilityHistory?.strategicSlack.status === "lost"
              ? state.reachabilityHistory.strategicSlack.firstLostAtMonths
              : null;
          const derivedGoalAt = currentGoalAt ?? transition.goalReachedAtMonths;
          const derivedSlackLostAt =
            currentSlackLostAt ?? transition.slackLostAtMonths;
          const nextGoalAt =
            nextState.reachabilityHistory?.goal.status === "reached"
              ? nextState.reachabilityHistory.goal.firstReachedAtMonths
              : null;
          const nextSlackLostAt =
            nextState.reachabilityHistory?.strategicSlack.status === "lost"
              ? nextState.reachabilityHistory.strategicSlack.firstLostAtMonths
              : null;
          if (
            (currentGoalAt !== null &&
              transition.goalReachedAtMonths !== null) ||
            (currentSlackLostAt !== null &&
              transition.slackLostAtMonths !== null) ||
            derivedGoalAt !== nextGoalAt ||
            derivedSlackLostAt !== nextSlackLostAt
          ) {
            issues.push(
              issue(
                "error",
                "reachability",
                "reachability_history_transition_mismatch",
                path,
                "次状態は遷移までのG初回到達・余力初回喪失の履歴を失わず、重複記録もしない。履歴が異なる経路は別状態へ分ける。",
              ),
            );
          }
        }
      }
    }
    const baselineActionId = model.baselinePolicy[state.stateId];
    const baselineRawAction = state.actions.find(
      (action) => action.actionId === baselineActionId,
    );
    if (typeof baselineActionId !== "string" || !baselineRawAction) {
      issues.push(
        issue(
          "error",
          "reachability",
          "invalid_baseline_policy",
          `baselinePolicy.${state.stateId}`,
          "固定方針は全状態で実行可能な行動を1つ指定する。",
        ),
      );
    } else if (
      !isActionExecutable(
        effectiveAction(model, state.stateId, baselineRawAction),
      )
    ) {
      issues.push(
        issue(
          "error",
          "reachability",
          "baseline_policy_not_executable",
          `baselinePolicy.${state.stateId}`,
          "固定方針が未契約資金、未確認権限、未取得同意等に依存しており、実行可能な基準線として計算できない。",
        ),
      );
    }
  }

  const interventionIds = new Set<string>();
  const enabledTransitionDeltaTargets = new Set<string>();
  for (const [interventionIndex, intervention] of (
    model.interventions ?? []
  ).entries()) {
    const interventionPath = `interventions[${interventionIndex}]`;
    validateEvidence(
      intervention.evidence,
      `${interventionPath}.evidence`,
      model,
      issues,
    );
    if (
      !intervention.interventionId?.trim() ||
      interventionIds.has(intervention.interventionId)
    ) {
      issues.push(
        issue(
          "error",
          "measurement",
          "duplicate_or_missing_intervention_id",
          `${interventionPath}.interventionId`,
          "支援条件IDは空欄不可かつモデル内で一意にする。",
        ),
      );
    }
    interventionIds.add(intervention.interventionId);
    for (const [effectIndex, effect] of intervention.effects.entries()) {
      const effectPath = `${interventionPath}.effects[${effectIndex}]`;
      const state = stateById.get(effect.stateId);
      const action = state?.actions.find(
        (candidate) => candidate.actionId === effect.actionId,
      );
      if (!state || !action) {
        issues.push(
          issue(
            "error",
            "reachability",
            "unknown_intervention_target",
            effectPath,
            "支援条件の対象状態・行動がモデルに存在しない。",
          ),
        );
        continue;
      }
      const cashFlowDeltaIds = new Set<string>();
      for (const [eventDeltaIndex, eventDelta] of (
        effect.cashFlowEventDeltas ?? []
      ).entries()) {
        const eventDeltaPath = `${effectPath}.cashFlowEventDeltas[${eventDeltaIndex}]`;
        const event = cashFlowEventById.get(eventDelta.eventId);
        if (
          !event ||
          event.stateId !== effect.stateId ||
          event.actionId !== effect.actionId ||
          cashFlowDeltaIds.has(eventDelta.eventId)
        ) {
          issues.push(
            issue(
              "error",
              "valuation",
              "invalid_intervention_cashflow_target",
              eventDeltaPath,
              "支援によるCF差分は対象行動の単一台帳事象へ一度だけ対応づける。",
            ),
          );
        }
        cashFlowDeltaIds.add(eventDelta.eventId);
        validateDeltaAmounts(
          eventDelta.amountDeltaMillionJpy,
          `${eventDeltaPath}.amountDeltaMillionJpy`,
          issues,
        );
      }
      if (
        effect.requiredFundingDeltaMillionJpy !== undefined &&
        !isFiniteNumber(effect.requiredFundingDeltaMillionJpy)
      ) {
        issues.push(
          issue(
            "error",
            "funding",
            "invalid_intervention_funding_delta",
            `${effectPath}.requiredFundingDeltaMillionJpy`,
            "支援による必要資金差分は根拠のある有限値にする。",
          ),
        );
      }
      if (
        effect.committedFundingDeltaMillionJpy !== undefined &&
        !isFiniteNumber(effect.committedFundingDeltaMillionJpy)
      ) {
        issues.push(
          issue(
            "error",
            "funding",
            "invalid_intervention_committed_funding_delta",
            `${effectPath}.committedFundingDeltaMillionJpy`,
            "支援による確保済み資金差分は根拠のある有限値にする。",
          ),
        );
      }
      for (const [scheduleKind, deltas, rows] of [
        [
          "required",
          effect.requiredFundingScheduleDeltas ?? [],
          action.financingFeasibility.requiredFundingSchedule,
        ],
        [
          "committed",
          effect.committedFundingScheduleDeltas ?? [],
          action.financingFeasibility.committedFundingSchedule,
        ],
      ] as const) {
        const seenScheduleIds = new Set<string>();
        for (const [deltaIndex, delta] of deltas.entries()) {
          const deltaPath = `${effectPath}.${scheduleKind}FundingScheduleDeltas[${deltaIndex}]`;
          if (
            !delta.scheduleId?.trim() ||
            seenScheduleIds.has(delta.scheduleId) ||
            !rows.some((row) => row.scheduleId === delta.scheduleId) ||
            !isFiniteNumber(delta.amountDeltaMillionJpy)
          ) {
            issues.push(
              issue(
                "error",
                "funding",
                "invalid_intervention_funding_schedule_delta",
                deltaPath,
                "支援による資金schedule差分は既存の一意な入出金行と有限値へ対応づける。",
              ),
            );
          }
          seenScheduleIds.add(delta.scheduleId);
        }
      }
      for (const [transitionEffectIndex, transitionEffect] of (
        effect.transitions ?? []
      ).entries()) {
        const transitionEffectPath = `${effectPath}.transitions[${transitionEffectIndex}]`;
        if (
          !action.transitions.some(
            (transition) =>
              transition.transitionId === transitionEffect.transitionId,
          )
        ) {
          issues.push(
            issue(
              "error",
              "reachability",
              "unknown_intervention_transition",
              transitionEffectPath,
              "支援条件が参照する遷移IDが対象行動に存在しない。",
            ),
          );
        }
        if (
          transitionEffect.probabilityDelta !== undefined &&
          !isFiniteNumber(transitionEffect.probabilityDelta)
        ) {
          issues.push(
            issue(
              "error",
              "reachability",
              "invalid_intervention_probability_delta",
              `${transitionEffectPath}.probabilityDelta`,
              "支援による遷移確率差分は根拠のある有限値にする。",
            ),
          );
        }
        if (
          intervention.enabled &&
          transitionEffect.probabilityDelta !== undefined
        ) {
          const targetKey = [
            effect.stateId,
            effect.actionId,
            transitionEffect.transitionId,
          ].join(":");
          if (enabledTransitionDeltaTargets.has(targetKey)) {
            issues.push(
              issue(
                "error",
                "reachability",
                "duplicate_enabled_transition_delta",
                transitionEffectPath,
                "同じ有効化状態・行動・遷移の確率差分は一つへ統合し、適用順で結果を変えない。",
              ),
            );
          }
          enabledTransitionDeltaTargets.add(targetKey);
        }
      }
    }
  }

  // Revalidate enabled intervention results. Deltas may not create negative
  // costs, funding, values, losses, or a transition distribution that is open.
  for (const [stateIndex, state] of model.states.entries()) {
    for (const [actionIndex, rawAction] of state.actions.entries()) {
      const action = effectiveAction(model, state.stateId, rawAction);
      const path = `effective.states[${stateIndex}].actions[${actionIndex}]`;
      validateObjectiveAmounts(
        action.immediateCostMillionJpy,
        `${path}.immediateCostMillionJpy`,
        issues,
      );
      validateObjectiveAmounts(
        action.immediateBenefitMillionJpy,
        `${path}.immediateBenefitMillionJpy`,
        issues,
      );
      if (
        !hasCompleteWaitContract(
          action,
          state.decisionController?.objective ?? null,
        )
      ) {
        issues.push(
          issue(
            "error",
            "valuation",
            "invalid_effective_wait_contract",
            path,
            "介入反映後もWAITには情報で分かれる経路と権限主体が負担する待機費用が必要。",
          ),
        );
      }
      if (!isNonNegativeAmount(action.requiredFundingMillionJpy)) {
        issues.push(
          issue(
            "error",
            "funding",
            "invalid_effective_required_funding",
            `${path}.requiredFundingMillionJpy`,
            "支援反映後の必要資金は0以上でなければならない。",
          ),
        );
      }
      for (const [transitionIndex, transition] of action.transitions.entries()) {
        validateObjectiveAmounts(
          transition.transitionCashFlowMillionJpy,
          `${path}.transitions[${transitionIndex}].transitionCashFlowMillionJpy`,
          issues,
          { allowNegative: true },
        );
        validateObjectiveAmounts(
          transition.terminalValueMillionJpy,
          `${path}.transitions[${transitionIndex}].terminalValueMillionJpy`,
          issues,
          { allowNegative: true },
        );
        validateObjectiveAmounts(
          transition.failureLossMillionJpy,
          `${path}.transitions[${transitionIndex}].failureLossMillionJpy`,
          issues,
        );
        if (
          !isFiniteNumber(transition.probability) ||
          transition.probability < 0 ||
          transition.probability > 1
        ) {
          issues.push(
            issue(
              "error",
              "reachability",
              "invalid_effective_transition_probability",
              `${path}.transitions[${transitionIndex}].probability`,
              "支援反映後の遷移確率は0から1に収める。",
            ),
          );
        }
      }
      const sum = action.transitions.reduce(
        (total, transition) =>
          total + (isFiniteNumber(transition.probability) ? transition.probability : 0),
        0,
      );
      if (
        action.transitions.every((transition) =>
          isFiniteNumber(transition.probability),
        ) &&
        Math.abs(sum - 1) > EPSILON
      ) {
        issues.push(
          issue(
            "error",
            "reachability",
            "effective_transition_probabilities_not_closed",
            `${path}.transitions`,
            "支援反映後も遷移確率の合計は1にする。",
          ),
        );
      }
    }
  }

  return issues;
}

function asNumber(value: number | null): number {
  if (value === null || !Number.isFinite(value)) {
    throw new Error("validated BZM 2.1 input unexpectedly became missing");
  }
  return value;
}

function emptyMetrics(): InternalMetrics {
  return {
    expectedNetValueMillionJpy: 0,
    goalProbability: 0,
    planDeadlineGoalProbability: 0,
    goalNetValueContributionMillionJpy: 0,
    expectedCumulativeFundingMillionJpy: 0,
    expectedFailureLossMillionJpy: 0,
    expectedExitValueMillionJpy: 0,
    expectedTerminalValueMillionJpy: 0,
    expectedCostMillionJpy: 0,
    expectedBenefitMillionJpy: 0,
  };
}

function toActionEvaluation(
  action: Bzm21Action,
  metrics: InternalMetrics,
): Bzm21ActionEvaluation {
  return {
    actionId: action.actionId,
    actionKind: action.kind,
    actionLabel: action.label,
    expectedNetValueMillionJpy: metrics.expectedNetValueMillionJpy,
    goalProbability: metrics.goalProbability,
    planDeadlineGoalProbability: metrics.planDeadlineGoalProbability,
    conditionalGoalValueMillionJpy:
      metrics.goalProbability > 0
        ? metrics.goalNetValueContributionMillionJpy /
          metrics.goalProbability
        : null,
    expectedCumulativeFundingMillionJpy:
      metrics.expectedCumulativeFundingMillionJpy,
    expectedFailureLossMillionJpy: metrics.expectedFailureLossMillionJpy,
    expectedExitValueMillionJpy: metrics.expectedExitValueMillionJpy,
    expectedTerminalValueMillionJpy:
      metrics.expectedTerminalValueMillionJpy,
    expectedCostMillionJpy: metrics.expectedCostMillionJpy,
    expectedBenefitMillionJpy: metrics.expectedBenefitMillionJpy,
  };
}

function evaluateAction(
  action: Bzm21Action,
  state: Bzm21DecisionState,
  perspective: Bzm21Objective,
  monthlyDiscountRate: number,
  planDeadlineMonths: number,
  evaluationHorizonMonths: number,
  resolveNextState: (stateId: string) => InternalMetrics,
): InternalMetrics {
  const durationMonths = asNumber(action.durationMonths);
  const discountFactor = Math.pow(1 + monthlyDiscountRate, -durationMonths);
  const immediateCost = asNumber(action.immediateCostMillionJpy[perspective]);
  const immediateBenefit = asNumber(
    action.immediateBenefitMillionJpy[perspective],
  );
  const result = emptyMetrics();
  result.expectedNetValueMillionJpy = immediateBenefit - immediateCost;
  result.expectedCumulativeFundingMillionJpy = asNumber(
    action.requiredFundingMillionJpy,
  );
  result.expectedCostMillionJpy = immediateCost;
  result.expectedBenefitMillionJpy = immediateBenefit;
  const historicalGoalReachedAt =
    state.reachabilityHistory.goal.status === "reached"
      ? state.reachabilityHistory.goal.firstReachedAtMonths
      : null;
  const historicalSlackLostAt =
    state.reachabilityHistory.strategicSlack.status === "lost"
      ? state.reachabilityHistory.strategicSlack.firstLostAtMonths
      : null;

  for (const transition of action.transitions) {
    const probability = asNumber(transition.probability);
    const terminalValue = asNumber(
      transition.terminalValueMillionJpy[perspective],
    );
    const transitionCashFlow = asNumber(
      transition.transitionCashFlowMillionJpy[perspective],
    );
    const failureLoss = asNumber(
      transition.failureLossMillionJpy[perspective],
    );
    const downstream = transition.nextStateId
      ? resolveNextState(transition.nextStateId)
      : emptyMetrics();
    const goalReachedAt =
      historicalGoalReachedAt ?? transition.goalReachedAtMonths;
    const slackLostAt = historicalSlackLostAt ?? transition.slackLostAtMonths;
    const reachedGoalOnBranch =
      goalReachedAt !== null &&
      goalReachedAt <= evaluationHorizonMonths + EPSILON &&
      (slackLostAt === null || goalReachedAt + EPSILON < slackLostAt);
    const lostSlackBeforeGoal =
      slackLostAt !== null &&
      (!reachedGoalOnBranch || slackLostAt <= (goalReachedAt ?? Infinity));
    const isExit =
      transition.terminalOutcome !== null &&
      EXIT_OUTCOMES.has(transition.terminalOutcome);
    const branchGoalProbability = reachedGoalOnBranch
      ? 1
      : lostSlackBeforeGoal
        ? 0
        : downstream.goalProbability;
    const transitionNetValue =
      transitionCashFlow + terminalValue - failureLoss;

    result.expectedNetValueMillionJpy +=
      probability *
      discountFactor *
      (transitionNetValue + downstream.expectedNetValueMillionJpy);
    result.goalProbability +=
      probability *
      branchGoalProbability;
    result.planDeadlineGoalProbability +=
      probability *
      (reachedGoalOnBranch && goalReachedAt <= planDeadlineMonths + EPSILON
        ? 1
        : lostSlackBeforeGoal
          ? 0
          : downstream.planDeadlineGoalProbability);
    result.goalNetValueContributionMillionJpy +=
      probability *
      discountFactor *
      (reachedGoalOnBranch
        ? transitionNetValue + downstream.expectedNetValueMillionJpy
        : lostSlackBeforeGoal
          ? 0
          : transitionNetValue * downstream.goalProbability +
            downstream.goalNetValueContributionMillionJpy);
    result.expectedCumulativeFundingMillionJpy +=
      probability * downstream.expectedCumulativeFundingMillionJpy;
    result.expectedFailureLossMillionJpy +=
      probability *
      discountFactor *
      (failureLoss + downstream.expectedFailureLossMillionJpy);
    result.expectedExitValueMillionJpy +=
      probability *
      discountFactor *
      ((isExit ? terminalValue : 0) + downstream.expectedExitValueMillionJpy);
    result.expectedTerminalValueMillionJpy +=
      probability *
      discountFactor *
      (terminalValue + downstream.expectedTerminalValueMillionJpy);
    result.expectedCostMillionJpy +=
      probability *
      discountFactor *
      (Math.max(-transitionCashFlow, 0) + downstream.expectedCostMillionJpy);
    result.expectedBenefitMillionJpy +=
      probability *
      discountFactor *
      (Math.max(transitionCashFlow, 0) +
        downstream.expectedBenefitMillionJpy);
  }
  const rawGoalProbability = result.goalProbability;
  result.goalProbability = clampProbability(rawGoalProbability);
  if (
    rawGoalProbability > 0 &&
    Math.abs(result.goalProbability - rawGoalProbability) > 0
  ) {
    result.goalNetValueContributionMillionJpy *=
      result.goalProbability / rawGoalProbability;
  }
  result.planDeadlineGoalProbability = Math.min(
    result.goalProbability,
    clampProbability(result.planDeadlineGoalProbability),
  );
  result.goalNetValueContributionMillionJpy +=
    (immediateBenefit - immediateCost) * result.goalProbability;
  return result;
}

function evaluateFixedReachability(
  model: Bzm21DynamicPolicyModel,
): { goalProbability: number; planDeadlineGoalProbability: number } {
  const stateById = new Map(model.states.map((state) => [state.stateId, state]));
  const memo = new Map<
    string,
    { goalProbability: number; planDeadlineGoalProbability: number }
  >();
  const visit = (
    stateId: string,
  ): { goalProbability: number; planDeadlineGoalProbability: number } => {
    const cached = memo.get(stateId);
    if (cached !== undefined) return cached;
    const state = stateById.get(stateId);
    if (!state) throw new Error(`unknown validated state: ${stateId}`);
    const rawAction = state.actions.find(
      (action) => action.actionId === model.baselinePolicy[stateId],
    );
    if (!rawAction) throw new Error(`unknown validated action: ${stateId}`);
    const action = effectiveAction(model, stateId, rawAction);
    const historicalGoalReachedAt =
      state.reachabilityHistory.goal.status === "reached"
        ? state.reachabilityHistory.goal.firstReachedAtMonths
        : null;
    const historicalSlackLostAt =
      state.reachabilityHistory.strategicSlack.status === "lost"
        ? state.reachabilityHistory.strategicSlack.firstLostAtMonths
        : null;
    const probability = action.transitions.reduce(
      (sum, transition) => {
      const branchProbability = asNumber(transition.probability);
      const goalReachedAt =
        historicalGoalReachedAt ?? transition.goalReachedAtMonths;
      const slackLostAt =
        historicalSlackLostAt ?? transition.slackLostAtMonths;
      const reachedGoal =
        goalReachedAt !== null &&
        goalReachedAt <= asNumber(model.evaluationHorizonMonths) + EPSILON &&
        (slackLostAt === null || goalReachedAt + EPSILON < slackLostAt);
      const slackLostFirst =
        slackLostAt !== null &&
        (!reachedGoal || slackLostAt <= (goalReachedAt ?? Infinity));
      if (reachedGoal) {
        return {
          goalProbability: sum.goalProbability + branchProbability,
          planDeadlineGoalProbability:
            sum.planDeadlineGoalProbability +
            (goalReachedAt <= asNumber(model.planDeadlineMonths) + EPSILON
              ? branchProbability
              : 0),
        };
      }
      if (transition.nextStateId && !slackLostFirst) {
        const downstream = visit(transition.nextStateId);
        return {
          goalProbability:
            sum.goalProbability +
            branchProbability * downstream.goalProbability,
          planDeadlineGoalProbability:
            sum.planDeadlineGoalProbability +
            branchProbability * downstream.planDeadlineGoalProbability,
        };
      }
      return sum;
      },
      { goalProbability: 0, planDeadlineGoalProbability: 0 },
    );
    const boundedGoalProbability = clampProbability(
      probability.goalProbability,
    );
    const boundedProbability = {
      goalProbability: boundedGoalProbability,
      planDeadlineGoalProbability: Math.min(
        boundedGoalProbability,
        clampProbability(probability.planDeadlineGoalProbability),
      ),
    };
    memo.set(stateId, boundedProbability);
    return boundedProbability;
  };
  return visit(model.initialStateId);
}

class DecisionIndeterminateError extends Error {
  readonly validationIssue: Bzm21ValidationIssue;

  constructor(stateId: string, perspective: Bzm21Objective) {
    super(`decision is indeterminate at ${stateId} for ${perspective}`);
    this.validationIssue = issue(
      "error",
      "valuation",
      "decision_indeterminate",
      `states.${stateId}`,
      "事前登録した同率処理でも近接する行動を一意に選べないため、最適方針と到達見込みを確定しない。",
      perspective,
    );
  }
}

function solvePerspective(
  model: Bzm21DynamicPolicyModel,
  perspective: Bzm21Objective,
  policyKind: Bzm21PolicyEvaluation["policyKind"],
  selectedPolicy?: Record<string, string>,
): Bzm21PolicyEvaluation {
  const stateById = new Map(model.states.map((state) => [state.stateId, state]));
  const monthlyDiscountRate = asNumber(model.discountRatePerMonth[perspective]);
  const memo = new Map<string, InternalMetrics>();
  const decisions = new Map<string, Bzm21StateDecisionEvaluation>();
  const selectedActionByState: Record<string, string> = {};
  const controllerByState: Record<string, Bzm21DecisionController> = {};

  const visit = (stateId: string): InternalMetrics => {
    const cached = memo.get(stateId);
    if (cached) return cached;
    const state = stateById.get(stateId);
    if (!state) throw new Error(`unknown validated state: ${stateId}`);
    const actions = state.actions
      .map((action) => effectiveAction(model, stateId, action))
      .sort((left, right) => left.actionId.localeCompare(right.actionId));
    const executableActions = actions.filter(isActionExecutable);
    const candidates = executableActions.map((action) => ({
      action,
      metrics: evaluateAction(
        action,
        state,
        perspective,
        monthlyDiscountRate,
        asNumber(model.planDeadlineMonths),
        asNumber(model.evaluationHorizonMonths),
        visit,
      ),
    }));
    let selected = candidates.find((candidate) => {
      const selectedActionId =
        policyKind === "fixed_baseline"
          ? model.baselinePolicy[stateId]
          : selectedPolicy?.[stateId];
      return (
        selectedActionId !== undefined &&
        candidate.action.actionId === selectedActionId
      );
    });
    if (policyKind === "optimized" && !selectedPolicy) {
      const bestValue = Math.max(
        ...candidates.map(
          (candidate) => candidate.metrics.expectedNetValueMillionJpy,
        ),
      );
      const tolerance =
        model.decisionCriterionByObjective[perspective]
          .nearTieToleranceMillionJpy;
      const nearTies = candidates.filter(
        (candidate) =>
          bestValue - candidate.metrics.expectedNetValueMillionJpy <=
          tolerance + EPSILON,
      );
      const exactTies = candidates.filter(
        (candidate) =>
          Math.abs(
            bestValue - candidate.metrics.expectedNetValueMillionJpy,
          ) <= EPSILON,
      );
      if (nearTies.length > exactTies.length) {
        throw new DecisionIndeterminateError(stateId, perspective);
      }
      if (exactTies.length === 1) {
        selected = exactTies[0];
      } else if (model.tieBreakRule?.rule === "higher_goal_probability") {
        const bestQ = Math.max(
          ...exactTies.map((candidate) => candidate.metrics.goalProbability),
        );
        const qTies = exactTies.filter(
          (candidate) =>
            Math.abs(candidate.metrics.goalProbability - bestQ) <= EPSILON,
        );
        if (qTies.length !== 1) {
          throw new DecisionIndeterminateError(stateId, perspective);
        }
        selected = qTies[0];
      } else if (
        model.tieBreakRule?.rule === "lower_required_funding"
      ) {
        const lowestFunding = Math.min(
          ...exactTies.map(
            (candidate) =>
              candidate.metrics.expectedCumulativeFundingMillionJpy,
          ),
        );
        const fundingTies = exactTies.filter(
          (candidate) =>
            Math.abs(
              candidate.metrics.expectedCumulativeFundingMillionJpy -
                lowestFunding,
            ) <= EPSILON,
        );
        if (fundingTies.length !== 1) {
          throw new DecisionIndeterminateError(stateId, perspective);
        }
        selected = fundingTies[0];
      } else if (model.tieBreakRule?.rule === "action_priority") {
        const priority =
          model.tieBreakRule.actionPriorityByState[stateId] ?? [];
        selected = priority
          .map((actionId) =>
            exactTies.find(
              (candidate) => candidate.action.actionId === actionId,
            ),
          )
          .find((candidate) => candidate !== undefined);
        if (!selected) {
          throw new DecisionIndeterminateError(stateId, perspective);
        }
      } else {
        throw new DecisionIndeterminateError(stateId, perspective);
      }
    }
    if (!selected) throw new Error(`no validated action at state: ${stateId}`);
    selectedActionByState[stateId] = selected.action.actionId;
    controllerByState[stateId] = state.decisionController;
    decisions.set(stateId, {
      stateId,
      selectedActionId: selected.action.actionId,
      actions:
        policyKind === "fixed_baseline" || selectedPolicy
          ? [toActionEvaluation(selected.action, selected.metrics)]
          : candidates.map((candidate) =>
              toActionEvaluation(candidate.action, candidate.metrics),
            ),
      excludedActions: actions
        .filter((action) => !isActionExecutable(action))
        .map((action) => ({
          actionId: action.actionId,
          reason: actionExclusionReason(action) ?? "実行不可",
        })),
    });
    memo.set(stateId, selected.metrics);
    return selected.metrics;
  };

  const root = visit(model.initialStateId);
  return {
    policyKind,
    perspective,
    selectionObjective:
      policyKind === "fixed_baseline"
        ? null
        : model.states.find(
            (state) => state.stateId === model.initialStateId,
          )?.decisionController.objective ?? null,
    expectedNetValueMillionJpy: root.expectedNetValueMillionJpy,
    goalProbability: root.goalProbability,
    planDeadlineGoalProbability: root.planDeadlineGoalProbability,
    conditionalGoalValueMillionJpy:
      root.goalProbability > 0
        ? root.goalNetValueContributionMillionJpy / root.goalProbability
        : null,
    expectedCumulativeFundingMillionJpy:
      root.expectedCumulativeFundingMillionJpy,
    expectedFailureLossMillionJpy: root.expectedFailureLossMillionJpy,
    expectedExitValueMillionJpy: root.expectedExitValueMillionJpy,
    expectedTerminalValueMillionJpy: root.expectedTerminalValueMillionJpy,
    expectedCostMillionJpy: root.expectedCostMillionJpy,
    expectedBenefitMillionJpy: root.expectedBenefitMillionJpy,
    controllerByState,
    selectedActionByState,
    stateDecisions: [...decisions.values()].sort((left, right) =>
      left.stateId.localeCompare(right.stateId),
    ),
  };
}

export function evaluateBzm21DynamicPolicyModel(
  model: Bzm21DynamicPolicyModel,
): Bzm21DynamicPolicyEvaluation {
  const issues = validateBzm21DynamicPolicyModel(model);
  const errors = issues.filter((candidate) => candidate.severity === "error");
  const reachabilityIssues = errors.filter(
    (candidate) =>
      candidate.domain === "reachability" ||
      candidate.domain === "measurement",
  );
  const baselineReachability: Bzm21ReachabilityEvaluation =
    reachabilityIssues.length === 0
      ? (() => {
          const baseline = evaluateFixedReachability(model);
          return {
            status: "computed" as const,
            policyId: model.baselinePolicyId,
            goalProbability: baseline.goalProbability,
            planDeadlineGoalProbability:
              baseline.planDeadlineGoalProbability,
          };
        })()
      : {
          status: "not_computable",
          policyId: model.baselinePolicyId,
          issues: reachabilityIssues,
        };

  const controllerObjective = model.states.find(
    (state) => state.stateId === model.initialStateId,
  )?.decisionController.objective;
  const controllerBlockers = controllerObjective
    ? errors.filter(
        (candidate) =>
          candidate.perspective === null ||
          candidate.perspective === controllerObjective,
      )
    : errors;
  let controllerOptimal: Bzm21PolicyEvaluation | null = null;
  let controllerBaseline: Bzm21PolicyEvaluation | null = null;
  let controllerContractIssue: Bzm21ValidationIssue | null = null;
  let controllerIndeterminateIssue: Bzm21ValidationIssue | null =
    issues.find(
      (candidate) =>
        candidate.code === "decision_indeterminate_under_uncertainty",
    ) ?? null;
  if (
    controllerObjective &&
    controllerBlockers.length === 0 &&
    !controllerIndeterminateIssue
  ) {
    try {
      controllerOptimal = solvePerspective(
        model,
        controllerObjective,
        "optimized",
      );
      controllerBaseline = solvePerspective(
        model,
        controllerObjective,
        "fixed_baseline",
      );
      if (
        controllerOptimal.expectedNetValueMillionJpy -
          controllerBaseline.expectedNetValueMillionJpy <
        -EPSILON
      ) {
        controllerContractIssue = issue(
          "error",
          "valuation",
          "negative_controller_option_value",
          "perspectives.controller",
          "固定方針が候補集合にあるのに主体自身の柔軟性価値が負になったため、内部契約違反として価値計算を停止する。",
          controllerObjective,
        );
        issues.push(controllerContractIssue);
      }
    } catch (error) {
      if (error instanceof DecisionIndeterminateError) {
        controllerIndeterminateIssue = error.validationIssue;
      } else {
        throw error;
      }
    }
  }

  const perspectives = Object.fromEntries(
    BZM21_OBJECTIVES.map((perspective) => {
      const blockers = errors.filter(
        (candidate) =>
          candidate.perspective === null ||
          candidate.perspective === perspective,
      );
      if (
        blockers.length > 0 ||
        controllerBlockers.length > 0 ||
        controllerContractIssue
      ) {
        return [
          perspective,
          {
            status: "not_computable",
            perspective,
            issues: [
              ...new Set([
                ...blockers,
                ...controllerBlockers,
                ...(controllerContractIssue ? [controllerContractIssue] : []),
              ]),
            ],
          } satisfies Bzm21PerspectiveEvaluation,
        ];
      }
      if (controllerIndeterminateIssue || !controllerOptimal) {
        return [
          perspective,
          {
            status: "decision_indeterminate",
            perspective,
            issues: controllerIndeterminateIssue
              ? [controllerIndeterminateIssue]
              : [],
          } satisfies Bzm21PerspectiveEvaluation,
        ];
      }
      try {
        const baseline =
          perspective === controllerObjective && controllerBaseline
            ? controllerBaseline
            : solvePerspective(model, perspective, "fixed_baseline");
        const optimal =
          perspective === controllerObjective
            ? controllerOptimal
            : solvePerspective(
                model,
                perspective,
                "optimized",
                controllerOptimal.selectedActionByState,
              );
        const rawValueDifference =
          optimal.expectedNetValueMillionJpy -
          baseline.expectedNetValueMillionJpy;
        const valueDifference =
          perspective === controllerObjective &&
          Math.abs(rawValueDifference) <= EPSILON
            ? 0
            : rawValueDifference;
        return [
          perspective,
          {
            status: "computed",
            perspective,
            baseline,
            optimal,
            valueDifferenceFromBaselineMillionJpy: valueDifference,
            controllerOptionValueMillionJpy:
              perspective === controllerObjective
                ? valueDifference
                : null,
            goalProbabilityChange:
              optimal.goalProbability - baseline.goalProbability,
            planDeadlineGoalProbabilityChange:
              optimal.planDeadlineGoalProbability -
              baseline.planDeadlineGoalProbability,
          } satisfies Bzm21PerspectiveEvaluation,
        ];
      } catch (error) {
        if (error instanceof DecisionIndeterminateError) {
          return [
            perspective,
            {
              status: "decision_indeterminate",
              perspective,
              issues: [error.validationIssue],
            } satisfies Bzm21PerspectiveEvaluation,
          ];
        }
        throw error;
      }
    }),
  ) as Record<Bzm21Objective, Bzm21PerspectiveEvaluation>;

  const computedCount = BZM21_OBJECTIVES.filter(
    (perspective) => perspectives[perspective].status === "computed",
  ).length;
  return {
    status:
      computedCount === BZM21_OBJECTIVES.length
        ? "computed"
        : computedCount > 0
          ? "partial"
          : "not_computable",
    modelId: model.modelId,
    modelVersion: model.modelVersion,
    informationCutoff: model.informationCutoff,
    forwardValidationCount: model.forwardValidationCount,
    activeInterventionIds: (model.interventions ?? [])
      .filter((intervention) => intervention.enabled)
      .map((intervention) => intervention.interventionId),
    issues,
    baselineReachability,
    perspectives,
  };
}
