export const BZM21_OBJECTIVE_KINDS = ["company", "bzsf", "public"] as const;
export type Bzm21ObjectiveKind = (typeof BZM21_OBJECTIVE_KINDS)[number];

export const BZM21_POLICY_KINDS = ["fixed_baseline", "optimized"] as const;
export type Bzm21PolicyKind = (typeof BZM21_POLICY_KINDS)[number];

export const BZM21_ACTION_TYPES = [
  "continue",
  "wait",
  "retry",
  "pivot",
  "scale_down",
  "scale_up",
  "license",
  "abandon",
] as const;
export type Bzm21ActionType = (typeof BZM21_ACTION_TYPES)[number];

export const BZM21_EVALUATION_STATUSES = [
  "not_computable",
  "partial",
  "computed",
  "decision_indeterminate",
] as const;
export type Bzm21EvaluationStatus =
  (typeof BZM21_EVALUATION_STATUSES)[number];

export const BZM21_ACTION_COVERAGE_STATUSES = [
  "complete",
  "partial_action_set",
  "unknown",
] as const;
export type Bzm21ActionCoverageStatus =
  (typeof BZM21_ACTION_COVERAGE_STATUSES)[number];

export const BZM21_INPUT_SCOPE_KINDS = [
  "revision",
  "objective",
  "state",
  "action",
  "transition",
  "intervention",
] as const;
export type Bzm21InputScopeKind = (typeof BZM21_INPUT_SCOPE_KINDS)[number];

export const BZM21_REQUIRED_REVISION_INPUT_KEYS = [
  "valuation_date",
  "initial_state",
  "plan_deadline",
  "evaluation_horizon",
  "reachability_history",
  "decision_controller",
  "controller_objective",
  "baseline_policy",
  "policy_definition_ref",
  "action_coverage",
  "discount_rate_company",
  "discount_rate_bzsf",
  "discount_rate_public",
  "valuation_rule_company",
  "valuation_rule_bzsf",
  "valuation_rule_public",
  "decision_criterion_company",
  "decision_criterion_bzsf",
  "decision_criterion_public",
  "near_tie_tolerance",
  "tie_break_rule",
  "uncertainty_rule",
  "public_fiscal_rule",
  "public_social_mandate",
  "public_social_conversion",
  "public_aggregation",
  "single_cashflow_ledger",
] as const;

export const BZM21_CASHFLOW_INCLUDED_IN_KINDS = [
  "immediate_cost",
  "immediate_benefit",
  "transition_cash_flow",
  "terminal_value",
  "failure_loss",
  "funding_constraint_only",
  "sunk_cost_report_only",
  "excluded",
] as const;
export type Bzm21CashflowIncludedIn =
  (typeof BZM21_CASHFLOW_INCLUDED_IN_KINDS)[number];

type JsonObject = Record<string, unknown>;

export type Bzm21PublicSocialBenefitComponent = {
  componentKey: string;
  label: string;
  unit: string;
  quantity: number | null;
  valueStatus: string;
  conversionRuleRef: string | null;
  convertedAmountMillionJpy: number | null;
  transferTreatment:
    | "resource_effect"
    | "externality"
    | "distributional"
    | "not_applicable";
  evidence: JsonObject;
  condition: JsonObject;
};

export type Bzm21ModelRevision = {
  revisionId: string;
  projectId: string;
  revisionKey: string;
  revisionOrder: number;
  theoryVersion: string;
  modelVersion: string;
  dataMode: "project" | "synthetic";
  currency: "JPY";
  valuationDate: string | null;
  initialStateKey: string | null;
  planDeadlineMonths: number | null;
  evaluationHorizonMonths: number | null;
  discountRateByObjective: JsonObject | null;
  valuationRuleByObjective: JsonObject | null;
  decisionCriterionByObjective: JsonObject | null;
  tieBreakRule: JsonObject | null;
  uncertaintyRule: JsonObject | null;
  publicFiscalRuleRef: string | null;
  publicSocialMandateRef: string | null;
  publicSocialConversionRuleRef: string | null;
  publicAggregationRuleRef: string | null;
  baselinePolicyId: string | null;
  baselinePolicy: JsonObject | null;
  policyDefinitionRef: string | null;
  measurementStatus: string;
  informationCutoff: string;
  forwardValidationCount: number;
  revisionReason: string;
  sourceRef: string;
  createdAt: string;
};

export type Bzm21InputObservation = {
  observationId: string;
  revisionId: string;
  scopeKind: Bzm21InputScopeKind;
  scopeKey: string;
  parameterKey: string;
  symbol: string;
  label: string;
  value: unknown | null;
  displayValue: string;
  valueStatus: string;
  unit: string | null;
  evidenceKind: string;
  evidenceRef: string | null;
  informationCutoff: string;
  condition: JsonObject;
  note: string | null;
  sortOrder: number;
  createdAt: string;
};

export type Bzm21Transition = {
  transitionId: string;
  actionId: string;
  transitionKey: string;
  label: string;
  nextStateId: string | null;
  terminalOutcome: string | null;
  probability: number | null;
  goalReachedAtMonths: number | null;
  slackLostAtMonths: number | null;
  transitionCashFlowByObjective: JsonObject;
  terminalValueByObjective: JsonObject;
  failureLossByObjective: JsonObject;
  cashflowEventKeys: string[];
  evidence: JsonObject;
  transitionOrder: number;
  createdAt: string;
  inputs: Bzm21InputObservation[];
};

export type Bzm21ActionEvaluation = {
  actionEvaluationId: string;
  actionId: string;
  objectiveKind: Bzm21ObjectiveKind;
  selectionObjective: Bzm21ObjectiveKind | null;
  isSelected: boolean;
  exclusionReason: string | null;
  evaluationStatus: Bzm21EvaluationStatus;
  goalProbability: number | null;
  planDeadlineGoalProbability: number | null;
  conditionalGoalValue: number | null;
  valueUnit: string | null;
  expectedCumulativeFundingMillionJpy: number | null;
  expectedFailureLossMillionJpy: number | null;
  expectedExitValueMillionJpy: number | null;
  expectedTerminalValueMillionJpy: number | null;
  expectedCostMillionJpy: number | null;
  expectedBenefitMillionJpy: number | null;
  expectedNetValue: number | null;
  publicAggregationStatus: "not_applicable" | "not_computable" | "complete";
  publicFiscalValueMillionJpy: number | null;
  publicSocialComponents: Bzm21PublicSocialBenefitComponent[];
  publicSocialMonetizedValueMillionJpy: number | null;
  publicAggregatedValueMillionJpy: number | null;
  publicAggregationInputHash: string | null;
  uncertainty: JsonObject;
  issues: unknown[];
  missingInputs: string[];
  engineVersion: string | null;
  inputHash: string | null;
  informationCutoff: string;
  createdAt: string;
};

export type Bzm21Action = {
  actionId: string;
  stateId: string;
  actionKey: string;
  bundleId: string;
  actionType: Bzm21ActionType;
  componentTypes: Bzm21ActionType[];
  customComponents: string[];
  sequence: unknown[];
  sharedResources: unknown[];
  label: string;
  actionOrder: number;
  availabilityStatus: "available" | "unavailable" | "unknown";
  availabilityReason: string | null;
  feasibilityGate: JsonObject;
  authorityGate: JsonObject;
  consents: unknown[];
  financingFeasibility: JsonObject;
  durationMonths: number | null;
  immediateCostByObjective: JsonObject;
  immediateBenefitByObjective: JsonObject;
  requiredFundingMillionJpy: number | null;
  cashflowEventKeys: string[];
  informationGain: unknown[];
  evidence: JsonObject;
  createdAt: string;
  inputs: Bzm21InputObservation[];
  transitions: Bzm21Transition[];
  evaluations: Bzm21ActionEvaluation[];
};

export type Bzm21DecisionState = {
  stateId: string;
  revisionId: string;
  stateKey: string;
  label: string;
  decisionOrder: number;
  isInitial: boolean;
  elapsedMonths: number | null;
  currentState: JsonObject;
  beliefs: unknown[];
  reachabilityHistory: JsonObject;
  decisionController: JsonObject;
  sunkCostMillionJpy: number | null;
  remainingCostMillionJpy: number | null;
  remainingTimeMonths: number | null;
  availableInformation: unknown[];
  evidence: JsonObject;
  createdAt: string;
  inputs: Bzm21InputObservation[];
  actions: Bzm21Action[];
};

export type Bzm21Intervention = {
  interventionId: string;
  revisionId: string;
  interventionKey: string;
  label: string;
  enabled: boolean;
  effects: unknown[];
  evidence: JsonObject;
  createdAt: string;
  inputs: Bzm21InputObservation[];
};

export type Bzm21CashflowEvent = {
  cashflowEventId: string;
  revisionId: string;
  stateId: string | null;
  actionId: string | null;
  transitionId: string | null;
  eventKey: string;
  economicEventGroupKey: string | null;
  perspectiveLeg: Bzm21ObjectiveKind | null;
  label: string;
  ownerKind: string;
  ownerRef: string;
  counterpartyKind: string;
  counterpartyRef: string;
  scopeKind: "revision" | "state" | "action" | "transition" | "terminal";
  scopeKey: string;
  timingKind: "action_start" | "action_end";
  timingMonths: number | null;
  amount: number | null;
  currency: string;
  modelAmountMillionJpy: number | null;
  conversionRuleRef: string | null;
  conversionRateToJpy: number | null;
  conversionRateDate: string | null;
  conversionRateSourceRef: string | null;
  valueStatus: string;
  nominalOrReal: "nominal" | "real" | "not_applicable" | "unknown";
  priceBaseDate: string | null;
  taxTreatment: string;
  taxSubjectRef: string | null;
  evidenceKind: string;
  evidenceRef: string | null;
  informationCutoff: string;
  includedIn: Bzm21CashflowIncludedIn;
  perspectiveAttribution: JsonObject;
  publicAggregationStatus: "not_applicable" | "not_computable" | "complete";
  publicFiscalAmountMillionJpy: number | null;
  publicSocialBenefitVector: Bzm21PublicSocialBenefitComponent[];
  publicSocialConvertedAmountMillionJpy: number | null;
  publicAggregatedAmountMillionJpy: number | null;
  publicAggregationInputHash: string | null;
  publicTransferTreatment:
    | "not_applicable"
    | "not_transfer"
    | "fiscal_transfer_excluded_from_social"
    | "real_resource_effect"
    | "externality";
  publicTransferDeduplicationRef: string | null;
  semanticDuplicateReviewRef: string | null;
  condition: JsonObject;
  note: string | null;
  createdAt: string;
};

export type Bzm21PolicyEvaluation = {
  policyEvaluationId: string;
  revisionId: string;
  revisionKey: string;
  revisionOrder: number;
  objectiveKind: Bzm21ObjectiveKind;
  policyKind: Bzm21PolicyKind;
  selectionObjective: Bzm21ObjectiveKind | null;
  evaluationStatus: Bzm21EvaluationStatus;
  actionCoverageStatus: Bzm21ActionCoverageStatus;
  goalProbability: number | null;
  planDeadlineGoalProbability: number | null;
  conditionalGoalValue: number | null;
  expectedNetValue: number | null;
  valueDifferenceFromBaseline: number | null;
  controllerOptionValue: number | null;
  valueUnit: string | null;
  expectedCumulativeFundingMillionJpy: number | null;
  expectedFailureLossMillionJpy: number | null;
  expectedExitValueMillionJpy: number | null;
  expectedTerminalValueMillionJpy: number | null;
  expectedCostMillionJpy: number | null;
  expectedBenefitMillionJpy: number | null;
  publicAggregationStatus: "not_applicable" | "not_computable" | "complete";
  publicFiscalValueMillionJpy: number | null;
  publicSocialComponents: Bzm21PublicSocialBenefitComponent[];
  publicSocialMonetizedValueMillionJpy: number | null;
  publicAggregatedValueMillionJpy: number | null;
  publicAggregationInputHash: string | null;
  controllerByState: JsonObject;
  selectedActionByState: Record<string, string>;
  stateDecisions: unknown[];
  uncertainty: JsonObject;
  issues: unknown[];
  missingInputs: string[];
  engineVersion: string | null;
  inputHash: string | null;
  informationCutoff: string;
  createdAt: string;
};

export type Bzm21PolicyView = {
  objectiveKind: Bzm21ObjectiveKind;
  policyKind: Bzm21PolicyKind;
  current: Bzm21PolicyEvaluation | null;
  history: Bzm21PolicyEvaluation[];
};

export type Bzm21PolicyModelLedger = {
  projectId: string;
  storageState: "ready" | "unavailable" | "invalid";
  storageMessage: string | null;
  currentRevision: Bzm21ModelRevision | null;
  revisions: Bzm21ModelRevision[];
  revisionInputs: Bzm21InputObservation[];
  inputHistory: Bzm21InputObservation[];
  states: Bzm21DecisionState[];
  interventions: Bzm21Intervention[];
  cashflowEvents: Bzm21CashflowEvent[];
  cashflowEventHistory: Bzm21CashflowEvent[];
  policyViews: Bzm21PolicyView[];
  diagnostics: string[];
};

export type Bzm21ModelRevisionRow = {
  revision_id: string;
  project_id: string;
  revision_key: string;
  revision_order: number;
  theory_version: string;
  model_version: string;
  data_mode: string;
  currency: string;
  valuation_date: string | null;
  initial_state_key: string | null;
  plan_deadline_months: number | string | null;
  evaluation_horizon_months: number | string | null;
  discount_rate_by_objective_json: unknown | null;
  valuation_rule_by_objective_json: unknown | null;
  decision_criterion_by_objective_json: unknown | null;
  tie_break_rule_json: unknown | null;
  uncertainty_rule_json: unknown | null;
  public_fiscal_rule_ref: string | null;
  public_social_mandate_ref: string | null;
  public_social_conversion_rule_ref: string | null;
  public_aggregation_rule_ref: string | null;
  baseline_policy_id: string | null;
  baseline_policy_json: unknown | null;
  policy_definition_ref: string | null;
  measurement_status: string;
  information_cutoff: string;
  forward_validation_count: number;
  revision_reason: string;
  source_ref: string;
  created_at: string;
};

export type Bzm21DecisionStateRow = {
  state_id: string;
  revision_id: string;
  state_key: string;
  label: string;
  decision_order: number;
  is_initial: boolean;
  elapsed_months: number | string | null;
  current_state_json: unknown;
  beliefs_json: unknown;
  reachability_history_json: unknown;
  decision_controller_json: unknown;
  sunk_cost_million_jpy: number | string | null;
  remaining_cost_million_jpy: number | string | null;
  remaining_time_months: number | string | null;
  available_information_json: unknown;
  evidence_json: unknown;
  created_at: string;
};

export type Bzm21ActionRow = {
  action_id: string;
  state_id: string;
  action_key: string;
  bundle_id: string;
  action_type: string;
  component_types: string[];
  custom_components: string[];
  sequence_json: unknown;
  shared_resources_json: unknown;
  label: string;
  action_order: number;
  availability_status: string;
  availability_reason: string | null;
  feasibility_gate_json: unknown;
  authority_gate_json: unknown;
  consents_json: unknown;
  financing_feasibility_json: unknown;
  duration_months: number | string | null;
  immediate_cost_by_objective_json: unknown;
  immediate_benefit_by_objective_json: unknown;
  required_funding_million_jpy: number | string | null;
  cashflow_event_keys: string[];
  information_gain_json: unknown;
  evidence_json: unknown;
  created_at: string;
};

export type Bzm21TransitionRow = {
  transition_id: string;
  action_id: string;
  transition_key: string;
  label: string;
  next_state_id: string | null;
  terminal_outcome: string | null;
  probability: number | string | null;
  goal_reached_at_months: number | string | null;
  slack_lost_at_months: number | string | null;
  transition_cash_flow_by_objective_json: unknown;
  terminal_value_by_objective_json: unknown;
  failure_loss_by_objective_json: unknown;
  cashflow_event_keys: string[];
  evidence_json: unknown;
  transition_order: number;
  created_at: string;
};

export type Bzm21InterventionRow = {
  intervention_id: string;
  revision_id: string;
  intervention_key: string;
  label: string;
  enabled: boolean;
  effects_json: unknown;
  evidence_json: unknown;
  created_at: string;
};

export type Bzm21CashflowEventRow = {
  cashflow_event_id: string;
  revision_id: string;
  state_id: string | null;
  action_id: string | null;
  transition_id: string | null;
  event_key: string;
  economic_event_group_key: string | null;
  perspective_leg: string | null;
  label: string;
  owner_kind: string;
  owner_ref: string;
  counterparty_kind: string;
  counterparty_ref: string;
  scope_kind: string;
  scope_key: string;
  timing_kind: string;
  timing_months: number | string | null;
  amount: number | string | null;
  currency: string;
  model_amount_million_jpy: number | string | null;
  conversion_rule_ref: string | null;
  conversion_rate_to_jpy: number | string | null;
  conversion_rate_date: string | null;
  conversion_rate_source_ref: string | null;
  value_status: string;
  nominal_or_real: string;
  price_base_date: string | null;
  tax_treatment: string;
  tax_subject_ref: string | null;
  evidence_kind: string;
  evidence_ref: string | null;
  information_cutoff: string;
  included_in: string;
  perspective_attribution_json: unknown;
  public_aggregation_status: string;
  public_fiscal_amount_million_jpy: number | string | null;
  public_social_benefit_vector_json: unknown;
  public_social_converted_amount_million_jpy: number | string | null;
  public_aggregated_amount_million_jpy: number | string | null;
  public_aggregation_input_hash: string | null;
  public_transfer_treatment: string;
  public_transfer_deduplication_ref: string | null;
  semantic_duplicate_review_ref: string | null;
  condition_json: unknown;
  note: string | null;
  created_at: string;
};

export type Bzm21InputObservationRow = {
  observation_id: string;
  revision_id: string;
  scope_kind: string;
  scope_key: string;
  parameter_key: string;
  symbol: string;
  label: string;
  value_json: unknown | null;
  display_value: string;
  value_status: string;
  unit: string | null;
  evidence_kind: string;
  evidence_ref: string | null;
  information_cutoff: string;
  condition_json: unknown;
  note: string | null;
  sort_order: number;
  created_at: string;
};

export type Bzm21ActionEvaluationRow = {
  action_evaluation_id: string;
  action_id: string;
  objective_kind: string;
  selection_objective: string | null;
  is_selected: boolean;
  exclusion_reason: string | null;
  evaluation_status: string;
  goal_probability: number | string | null;
  plan_deadline_goal_probability: number | string | null;
  conditional_goal_value: number | string | null;
  value_unit: string | null;
  expected_cumulative_funding_million_jpy: number | string | null;
  expected_failure_loss_million_jpy: number | string | null;
  expected_exit_value_million_jpy: number | string | null;
  expected_terminal_value_million_jpy: number | string | null;
  expected_cost_million_jpy: number | string | null;
  expected_benefit_million_jpy: number | string | null;
  expected_net_value: number | string | null;
  public_aggregation_status: string;
  public_fiscal_value_million_jpy: number | string | null;
  public_social_components_json: unknown;
  public_social_monetized_value_million_jpy: number | string | null;
  public_aggregated_value_million_jpy: number | string | null;
  public_aggregation_input_hash: string | null;
  uncertainty_json: unknown;
  issues_json: unknown;
  missing_inputs: string[];
  engine_version: string | null;
  input_hash: string | null;
  information_cutoff: string;
  created_at: string;
};

export type Bzm21PolicyEvaluationRow = {
  policy_evaluation_id: string;
  revision_id: string;
  objective_kind: string;
  policy_kind: string;
  selection_objective: string | null;
  evaluation_status: string;
  action_coverage_status: string;
  goal_probability: number | string | null;
  plan_deadline_goal_probability: number | string | null;
  conditional_goal_value: number | string | null;
  expected_net_value: number | string | null;
  value_difference_from_baseline: number | string | null;
  controller_option_value: number | string | null;
  value_unit: string | null;
  expected_cumulative_funding_million_jpy: number | string | null;
  expected_failure_loss_million_jpy: number | string | null;
  expected_exit_value_million_jpy: number | string | null;
  expected_terminal_value_million_jpy: number | string | null;
  expected_cost_million_jpy: number | string | null;
  expected_benefit_million_jpy: number | string | null;
  public_aggregation_status: string;
  public_fiscal_value_million_jpy: number | string | null;
  public_social_components_json: unknown;
  public_social_monetized_value_million_jpy: number | string | null;
  public_aggregated_value_million_jpy: number | string | null;
  public_aggregation_input_hash: string | null;
  controller_by_state_json: unknown;
  selected_action_by_state_json: unknown;
  state_decisions_json: unknown;
  uncertainty_json: unknown;
  issues_json: unknown;
  missing_inputs: string[];
  engine_version: string | null;
  input_hash: string | null;
  information_cutoff: string;
  created_at: string;
};

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecordOrNull(value: unknown | null): JsonObject | null {
  return isRecord(value) ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

const PUBLIC_AGGREGATION_STATUSES = [
  "not_applicable",
  "not_computable",
  "complete",
] as const;

const PUBLIC_TRANSFER_TREATMENTS = [
  "not_applicable",
  "not_transfer",
  "fiscal_transfer_excluded_from_social",
  "real_resource_effect",
  "externality",
] as const;

const PUBLIC_SOCIAL_TRANSFER_TREATMENTS = [
  "resource_effect",
  "externality",
  "distributional",
  "not_applicable",
] as const;

function finiteOrNull(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function mapPublicSocialBenefitComponents(
  value: unknown,
): Bzm21PublicSocialBenefitComponent[] | null {
  if (!Array.isArray(value)) return null;
  const components: Bzm21PublicSocialBenefitComponent[] = [];
  for (const raw of value) {
    if (
      !isRecord(raw) ||
      typeof raw.componentKey !== "string" ||
      raw.componentKey.trim() === "" ||
      typeof raw.label !== "string" ||
      raw.label.trim() === "" ||
      typeof raw.unit !== "string" ||
      raw.unit.trim() === "" ||
      !(raw.quantity === null || typeof raw.quantity === "number") ||
      typeof raw.valueStatus !== "string" ||
      !(raw.conversionRuleRef === null ||
        typeof raw.conversionRuleRef === "string") ||
      !(raw.convertedAmountMillionJpy === null ||
        typeof raw.convertedAmountMillionJpy === "number") ||
      !isOneOf(
        PUBLIC_SOCIAL_TRANSFER_TREATMENTS,
        String(raw.transferTreatment),
      ) ||
      !isRecord(raw.evidence) ||
      !isRecord(raw.condition)
    ) {
      return null;
    }
    components.push({
      componentKey: raw.componentKey,
      label: raw.label,
      unit: raw.unit,
      quantity: raw.quantity,
      valueStatus: raw.valueStatus,
      conversionRuleRef: raw.conversionRuleRef,
      convertedAmountMillionJpy: raw.convertedAmountMillionJpy,
      transferTreatment:
        raw.transferTreatment as Bzm21PublicSocialBenefitComponent["transferTreatment"],
      evidence: raw.evidence,
      condition: raw.condition,
    });
  }
  if (new Set(components.map((component) => component.componentKey)).size !== components.length) {
    return null;
  }
  return components;
}

function publicSocialComponentSum(
  components: Bzm21PublicSocialBenefitComponent[],
): number | null {
  let total = 0;
  for (const component of components) {
    if (component.valueStatus === "not_applicable") continue;
    if (component.convertedAmountMillionJpy === null) return null;
    total += component.convertedAmountMillionJpy;
  }
  return total;
}

type Bzm21TaxBasis =
  | "pre_tax_plus_explicit_tax_payments"
  | "post_tax_inclusive"
  | "tax_exempt";

function readTaxBasisByObjective(
  value: JsonObject | null,
): Record<Bzm21ObjectiveKind, Bzm21TaxBasis> | null {
  if (!value) return null;
  const result = {} as Record<Bzm21ObjectiveKind, Bzm21TaxBasis>;
  for (const objective of BZM21_OBJECTIVE_KINDS) {
    const rule = value[objective];
    if (!isRecord(rule)) return null;
    const basis = rule.taxBasis;
    if (
      basis !== "pre_tax_plus_explicit_tax_payments" &&
      basis !== "post_tax_inclusive" &&
      basis !== "tax_exempt"
    ) {
      return null;
    }
    result[objective] = basis;
  }
  return result;
}

function cashflowObjectiveAmount(
  event: Bzm21CashflowEvent,
  objective: Bzm21ObjectiveKind,
): number | null {
  const rawAttribution = event.perspectiveAttribution[objective];
  if (!isRecord(rawAttribution) || typeof rawAttribution.included !== "boolean") {
    return null;
  }
  if (!rawAttribution.included) return 0;
  const sign = rawAttribution.sign;
  if (sign !== -1 && sign !== 1) return null;
  const rawAmount =
    objective === "public"
      ? event.publicAggregationStatus === "complete"
        ? event.publicAggregatedAmountMillionJpy
        : null
      : event.modelAmountMillionJpy;
  if (rawAmount === null) return null;
  if (
    event.includedIn === "immediate_cost" ||
    event.includedIn === "immediate_benefit" ||
    event.includedIn === "failure_loss"
  ) {
    return Math.abs(rawAmount);
  }
  return objective === "public" ? rawAmount : rawAmount * sign;
}

function sumCashflowCacheCategory(
  events: Bzm21CashflowEvent[],
  eventKeys: string[],
  category: Bzm21CashflowIncludedIn,
): Record<Bzm21ObjectiveKind, number | null> {
  const byKey = new Map(events.map((event) => [event.eventKey, event]));
  const result: Record<Bzm21ObjectiveKind, number | null> = {
    company: 0,
    bzsf: 0,
    public: 0,
  };
  for (const eventKey of eventKeys) {
    const event = byKey.get(eventKey);
    if (!event || event.includedIn !== category) continue;
    for (const objective of BZM21_OBJECTIVE_KINDS) {
      const amount = cashflowObjectiveAmount(event, objective);
      result[objective] =
        result[objective] === null || amount === null
          ? null
          : result[objective] + amount;
    }
  }
  return result;
}

function objectiveCacheMatches(
  rawCache: JsonObject,
  derived: Record<Bzm21ObjectiveKind, number | null>,
): boolean {
  return BZM21_OBJECTIVE_KINDS.every((objective) => {
    const raw = rawCache[objective];
    const expected = derived[objective];
    if (raw === null || expected === null) return raw === expected;
    return (
      typeof raw === "number" &&
      Math.abs(raw - expected) <= Math.max(1e-9, Math.abs(expected) * 1e-9)
    );
  });
}

function dateInJst(value: string): string | null {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  const part = (type: "year" | "month" | "day") =>
    parts.find((entry) => entry.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function evidenceCutoffDiagnostics(
  value: unknown,
  revisionCutoff: string,
  context: string,
  valueIsEvidence = false,
  disallowSynthetic = false,
): string[] {
  const diagnostics: string[] = [];
  const revisionTime = Date.parse(revisionCutoff);
  const visit = (candidate: unknown, path: string, isEvidence: boolean) => {
    if (Array.isArray(candidate)) {
      candidate.forEach((entry, index) => visit(entry, `${path}[${index}]`, false));
      return;
    }
    if (!isRecord(candidate)) {
      if (isEvidence) diagnostics.push(`${context}${path}: 根拠契約が欠測`);
      return;
    }
    if (isEvidence) {
      const cutoff = candidate.informationCutoff;
      const cutoffTime = typeof cutoff === "string" ? Date.parse(cutoff) : NaN;
      if (!Number.isFinite(cutoffTime)) {
        diagnostics.push(`${context}${path}: 根拠の情報締切が欠測または不正`);
      } else if (!Number.isFinite(revisionTime) || cutoffTime > revisionTime) {
        diagnostics.push(`${context}${path}: 根拠が版の情報締切を超えている`);
      }
      if (disallowSynthetic && candidate.kind === "synthetic") {
        diagnostics.push(`${context}${path}: 実PJ版に合成根拠を使用できない`);
      }
    }
    for (const [key, entry] of Object.entries(candidate)) {
      if (key === "evidence") {
        visit(entry, `${path}.${key}`, true);
      } else if (key !== "informationCutoff") {
        visit(entry, `${path}.${key}`, false);
      }
    }
  };
  visit(value, "", valueIsEvidence);
  return diagnostics;
}

function isOneOf<const T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return (values as readonly string[]).includes(value);
}

function mapRevision(row: Bzm21ModelRevisionRow): Bzm21ModelRevision | null {
  if (
    (row.data_mode !== "project" && row.data_mode !== "synthetic") ||
    row.currency !== "JPY"
  ) {
    return null;
  }
  return {
    revisionId: row.revision_id,
    projectId: row.project_id,
    revisionKey: row.revision_key,
    revisionOrder: row.revision_order,
    theoryVersion: row.theory_version,
    modelVersion: row.model_version,
    dataMode: row.data_mode,
    currency: "JPY",
    valuationDate: row.valuation_date,
    initialStateKey: row.initial_state_key,
    planDeadlineMonths: finiteOrNull(row.plan_deadline_months),
    evaluationHorizonMonths: finiteOrNull(row.evaluation_horizon_months),
    discountRateByObjective: asRecordOrNull(row.discount_rate_by_objective_json),
    valuationRuleByObjective: asRecordOrNull(row.valuation_rule_by_objective_json),
    decisionCriterionByObjective: asRecordOrNull(
      row.decision_criterion_by_objective_json,
    ),
    tieBreakRule: asRecordOrNull(row.tie_break_rule_json),
    uncertaintyRule: asRecordOrNull(row.uncertainty_rule_json),
    publicFiscalRuleRef: row.public_fiscal_rule_ref,
    publicSocialMandateRef: row.public_social_mandate_ref,
    publicSocialConversionRuleRef: row.public_social_conversion_rule_ref,
    publicAggregationRuleRef: row.public_aggregation_rule_ref,
    baselinePolicyId: row.baseline_policy_id,
    baselinePolicy: asRecordOrNull(row.baseline_policy_json),
    policyDefinitionRef: row.policy_definition_ref,
    measurementStatus: row.measurement_status,
    informationCutoff: row.information_cutoff,
    forwardValidationCount: row.forward_validation_count,
    revisionReason: row.revision_reason,
    sourceRef: row.source_ref,
    createdAt: row.created_at,
  };
}

function mapInput(row: Bzm21InputObservationRow): Bzm21InputObservation | null {
  if (!isOneOf(BZM21_INPUT_SCOPE_KINDS, row.scope_kind)) return null;
  return {
    observationId: row.observation_id,
    revisionId: row.revision_id,
    scopeKind: row.scope_kind,
    scopeKey: row.scope_key,
    parameterKey: row.parameter_key,
    symbol: row.symbol,
    label: row.label,
    value: row.value_json,
    displayValue: row.display_value,
    valueStatus: row.value_status,
    unit: row.unit,
    evidenceKind: row.evidence_kind,
    evidenceRef: row.evidence_ref,
    informationCutoff: row.information_cutoff,
    condition: isRecord(row.condition_json) ? row.condition_json : {},
    note: row.note,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function hasValidCashflowAttribution(value: unknown): value is JsonObject {
  if (!isRecord(value)) return false;
  return BZM21_OBJECTIVE_KINDS.every((objective) => {
    const entry = value[objective];
    if (!isRecord(entry) || typeof entry.included !== "boolean") return false;
    if (typeof entry.attribution !== "string" || entry.attribution.trim() === "") {
      return false;
    }
    return entry.included
      ? entry.sign === -1 || entry.sign === 1
      : entry.sign === null;
  });
}

function hasValidReachabilityHistory(value: JsonObject): boolean {
  const goal = value.goal;
  const slack = value.strategicSlack;
  if (!isRecord(goal) || !isRecord(slack)) return false;
  const validGoalStatus = ["not_reached", "reached", "unknown"].includes(
    String(goal.status),
  );
  const validSlackStatus = ["available", "lost", "unknown"].includes(
    String(slack.status),
  );
  const goalMonthValid =
    goal.status === "reached"
      ? typeof goal.firstReachedAtMonths === "number" &&
        goal.firstReachedAtMonths >= 0
      : goal.firstReachedAtMonths === null;
  const slackMonthValid =
    slack.status === "lost"
      ? typeof slack.firstLostAtMonths === "number" &&
        slack.firstLostAtMonths >= 0
      : slack.firstLostAtMonths === null;
  return (
    validGoalStatus &&
    validSlackStatus &&
    goalMonthValid &&
    slackMonthValid &&
    isRecord(goal.evidence) &&
    isRecord(slack.evidence)
  );
}

function mapCashflowEvent(
  row: Bzm21CashflowEventRow,
): Bzm21CashflowEvent | null {
  const publicSocialBenefitVector = mapPublicSocialBenefitComponents(
    row.public_social_benefit_vector_json,
  );
  if (
    !["revision", "state", "action", "transition", "terminal"].includes(
      row.scope_kind,
    ) ||
    (row.perspective_leg !== null &&
      !isOneOf(BZM21_OBJECTIVE_KINDS, row.perspective_leg)) ||
    !["action_start", "action_end"].includes(row.timing_kind) ||
    !isOneOf(BZM21_CASHFLOW_INCLUDED_IN_KINDS, row.included_in) ||
    !["nominal", "real", "not_applicable", "unknown"].includes(
      row.nominal_or_real,
    ) ||
    !hasValidCashflowAttribution(row.perspective_attribution_json) ||
    !isRecord(row.condition_json) ||
    !isOneOf(PUBLIC_AGGREGATION_STATUSES, row.public_aggregation_status) ||
    !isOneOf(PUBLIC_TRANSFER_TREATMENTS, row.public_transfer_treatment) ||
    !publicSocialBenefitVector
  ) {
    return null;
  }
  return {
    cashflowEventId: row.cashflow_event_id,
    revisionId: row.revision_id,
    stateId: row.state_id,
    actionId: row.action_id,
    transitionId: row.transition_id,
    eventKey: row.event_key,
    economicEventGroupKey: row.economic_event_group_key,
    perspectiveLeg: row.perspective_leg,
    label: row.label,
    ownerKind: row.owner_kind,
    ownerRef: row.owner_ref,
    counterpartyKind: row.counterparty_kind,
    counterpartyRef: row.counterparty_ref,
    scopeKind: row.scope_kind as Bzm21CashflowEvent["scopeKind"],
    scopeKey: row.scope_key,
    timingKind: row.timing_kind as Bzm21CashflowEvent["timingKind"],
    timingMonths: finiteOrNull(row.timing_months),
    amount: finiteOrNull(row.amount),
    currency: row.currency,
    modelAmountMillionJpy: finiteOrNull(row.model_amount_million_jpy),
    conversionRuleRef: row.conversion_rule_ref,
    conversionRateToJpy: finiteOrNull(row.conversion_rate_to_jpy),
    conversionRateDate: row.conversion_rate_date,
    conversionRateSourceRef: row.conversion_rate_source_ref,
    valueStatus: row.value_status,
    nominalOrReal: row.nominal_or_real as Bzm21CashflowEvent["nominalOrReal"],
    priceBaseDate: row.price_base_date,
    taxTreatment: row.tax_treatment,
    taxSubjectRef: row.tax_subject_ref,
    evidenceKind: row.evidence_kind,
    evidenceRef: row.evidence_ref,
    informationCutoff: row.information_cutoff,
    includedIn: row.included_in,
    perspectiveAttribution: row.perspective_attribution_json,
    publicAggregationStatus: row.public_aggregation_status,
    publicFiscalAmountMillionJpy: finiteOrNull(
      row.public_fiscal_amount_million_jpy,
    ),
    publicSocialBenefitVector,
    publicSocialConvertedAmountMillionJpy: finiteOrNull(
      row.public_social_converted_amount_million_jpy,
    ),
    publicAggregatedAmountMillionJpy: finiteOrNull(
      row.public_aggregated_amount_million_jpy,
    ),
    publicAggregationInputHash: row.public_aggregation_input_hash,
    publicTransferTreatment: row.public_transfer_treatment,
    publicTransferDeduplicationRef: row.public_transfer_deduplication_ref,
    semanticDuplicateReviewRef: row.semantic_duplicate_review_ref,
    condition: row.condition_json,
    note: row.note,
    createdAt: row.created_at,
  };
}

function mapActionEvaluation(
  row: Bzm21ActionEvaluationRow,
): Bzm21ActionEvaluation | null {
  const publicSocialComponents = mapPublicSocialBenefitComponents(
    row.public_social_components_json,
  );
  if (
    !isOneOf(BZM21_OBJECTIVE_KINDS, row.objective_kind) ||
    (row.selection_objective !== null &&
      !isOneOf(BZM21_OBJECTIVE_KINDS, row.selection_objective)) ||
    (row.is_selected && row.selection_objective === null) ||
    !isOneOf(BZM21_EVALUATION_STATUSES, row.evaluation_status) ||
    !isOneOf(PUBLIC_AGGREGATION_STATUSES, row.public_aggregation_status) ||
    !publicSocialComponents
  ) {
    return null;
  }
  return {
    actionEvaluationId: row.action_evaluation_id,
    actionId: row.action_id,
    objectiveKind: row.objective_kind,
    selectionObjective: row.selection_objective,
    isSelected: row.is_selected,
    exclusionReason: row.exclusion_reason,
    evaluationStatus: row.evaluation_status,
    goalProbability: finiteOrNull(row.goal_probability),
    planDeadlineGoalProbability: finiteOrNull(
      row.plan_deadline_goal_probability,
    ),
    conditionalGoalValue: finiteOrNull(row.conditional_goal_value),
    valueUnit: row.value_unit,
    expectedCumulativeFundingMillionJpy: finiteOrNull(
      row.expected_cumulative_funding_million_jpy,
    ),
    expectedFailureLossMillionJpy: finiteOrNull(
      row.expected_failure_loss_million_jpy,
    ),
    expectedExitValueMillionJpy: finiteOrNull(
      row.expected_exit_value_million_jpy,
    ),
    expectedTerminalValueMillionJpy: finiteOrNull(
      row.expected_terminal_value_million_jpy,
    ),
    expectedCostMillionJpy: finiteOrNull(row.expected_cost_million_jpy),
    expectedBenefitMillionJpy: finiteOrNull(row.expected_benefit_million_jpy),
    expectedNetValue: finiteOrNull(row.expected_net_value),
    publicAggregationStatus: row.public_aggregation_status,
    publicFiscalValueMillionJpy: finiteOrNull(
      row.public_fiscal_value_million_jpy,
    ),
    publicSocialComponents,
    publicSocialMonetizedValueMillionJpy: finiteOrNull(
      row.public_social_monetized_value_million_jpy,
    ),
    publicAggregatedValueMillionJpy: finiteOrNull(
      row.public_aggregated_value_million_jpy,
    ),
    publicAggregationInputHash: row.public_aggregation_input_hash,
    uncertainty: isRecord(row.uncertainty_json) ? row.uncertainty_json : {},
    issues: asArray(row.issues_json),
    missingInputs: row.missing_inputs,
    engineVersion: row.engine_version,
    inputHash: row.input_hash,
    informationCutoff: row.information_cutoff,
    createdAt: row.created_at,
  };
}

function mapPolicyEvaluation(
  row: Bzm21PolicyEvaluationRow,
  revision: Bzm21ModelRevision,
): Bzm21PolicyEvaluation | null {
  const valueDifferenceFromBaseline = finiteOrNull(
    row.value_difference_from_baseline,
  );
  const controllerOptionValue = finiteOrNull(row.controller_option_value);
  const publicSocialComponents = mapPublicSocialBenefitComponents(
    row.public_social_components_json,
  );
  if (
    !isOneOf(BZM21_OBJECTIVE_KINDS, row.objective_kind) ||
    !isOneOf(BZM21_POLICY_KINDS, row.policy_kind) ||
    (row.selection_objective !== null &&
      !isOneOf(BZM21_OBJECTIVE_KINDS, row.selection_objective)) ||
    !isOneOf(BZM21_EVALUATION_STATUSES, row.evaluation_status) ||
    !isOneOf(BZM21_ACTION_COVERAGE_STATUSES, row.action_coverage_status) ||
    !isRecord(row.selected_action_by_state_json) ||
    !isOneOf(PUBLIC_AGGREGATION_STATUSES, row.public_aggregation_status) ||
    !publicSocialComponents ||
    (row.policy_kind === "fixed_baseline" && row.selection_objective !== null) ||
    (row.policy_kind === "fixed_baseline" &&
      ((valueDifferenceFromBaseline !== null && valueDifferenceFromBaseline !== 0) ||
        controllerOptionValue !== null)) ||
    (row.policy_kind === "optimized" &&
      (row.evaluation_status === "computed" || row.evaluation_status === "partial") &&
      row.selection_objective === null) ||
    (controllerOptionValue !== null && controllerOptionValue < 0) ||
    (row.policy_kind === "optimized" &&
      row.selection_objective !== null &&
      row.objective_kind !== row.selection_objective &&
      controllerOptionValue !== null) ||
    (row.policy_kind === "optimized" &&
      row.selection_objective !== null &&
      row.objective_kind === row.selection_objective &&
      controllerOptionValue !== null &&
      valueDifferenceFromBaseline !== null &&
      controllerOptionValue !== valueDifferenceFromBaseline)
  ) {
    return null;
  }
  const selectedActionByState = Object.fromEntries(
    Object.entries(row.selected_action_by_state_json).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  return {
    policyEvaluationId: row.policy_evaluation_id,
    revisionId: row.revision_id,
    revisionKey: revision.revisionKey,
    revisionOrder: revision.revisionOrder,
    objectiveKind: row.objective_kind,
    policyKind: row.policy_kind,
    selectionObjective: row.selection_objective,
    evaluationStatus: row.evaluation_status,
    actionCoverageStatus: row.action_coverage_status,
    goalProbability: finiteOrNull(row.goal_probability),
    planDeadlineGoalProbability: finiteOrNull(
      row.plan_deadline_goal_probability,
    ),
    conditionalGoalValue: finiteOrNull(row.conditional_goal_value),
    expectedNetValue: finiteOrNull(row.expected_net_value),
    valueDifferenceFromBaseline,
    controllerOptionValue,
    valueUnit: row.value_unit,
    expectedCumulativeFundingMillionJpy: finiteOrNull(
      row.expected_cumulative_funding_million_jpy,
    ),
    expectedFailureLossMillionJpy: finiteOrNull(
      row.expected_failure_loss_million_jpy,
    ),
    expectedExitValueMillionJpy: finiteOrNull(
      row.expected_exit_value_million_jpy,
    ),
    expectedTerminalValueMillionJpy: finiteOrNull(
      row.expected_terminal_value_million_jpy,
    ),
    expectedCostMillionJpy: finiteOrNull(row.expected_cost_million_jpy),
    expectedBenefitMillionJpy: finiteOrNull(row.expected_benefit_million_jpy),
    publicAggregationStatus: row.public_aggregation_status,
    publicFiscalValueMillionJpy: finiteOrNull(
      row.public_fiscal_value_million_jpy,
    ),
    publicSocialComponents,
    publicSocialMonetizedValueMillionJpy: finiteOrNull(
      row.public_social_monetized_value_million_jpy,
    ),
    publicAggregatedValueMillionJpy: finiteOrNull(
      row.public_aggregated_value_million_jpy,
    ),
    publicAggregationInputHash: row.public_aggregation_input_hash,
    controllerByState: isRecord(row.controller_by_state_json)
      ? row.controller_by_state_json
      : {},
    selectedActionByState,
    stateDecisions: asArray(row.state_decisions_json),
    uncertainty: isRecord(row.uncertainty_json) ? row.uncertainty_json : {},
    issues: asArray(row.issues_json),
    missingInputs: row.missing_inputs,
    engineVersion: row.engine_version,
    inputHash: row.input_hash,
    informationCutoff: row.information_cutoff,
    createdAt: row.created_at,
  };
}

function compareRevisionOrder(
  a: { revisionOrder: number },
  b: { revisionOrder: number },
) {
  return a.revisionOrder - b.revisionOrder;
}

function compareInput(a: Bzm21InputObservation, b: Bzm21InputObservation) {
  return a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt);
}

export function buildBzm21PolicyModelLedger(args: {
  projectId: string;
  revisionRows?: Bzm21ModelRevisionRow[];
  stateRows?: Bzm21DecisionStateRow[];
  actionRows?: Bzm21ActionRow[];
  transitionRows?: Bzm21TransitionRow[];
  interventionRows?: Bzm21InterventionRow[];
  cashflowEventRows?: Bzm21CashflowEventRow[];
  inputRows?: Bzm21InputObservationRow[];
  actionEvaluationRows?: Bzm21ActionEvaluationRow[];
  policyEvaluationRows?: Bzm21PolicyEvaluationRow[];
  expectedInputHash?: string | null;
  expectedPublicAggregationHashes?: Record<string, string>;
  storageState?: Bzm21PolicyModelLedger["storageState"];
  storageMessage?: string | null;
}): Bzm21PolicyModelLedger {
  const diagnostics: string[] = [];
  const rawRevisionRows = (args.revisionRows ?? []).filter(
    (row) => row.project_id === args.projectId,
  );
  const revisions = rawRevisionRows
    .map(mapRevision)
    .filter((revision): revision is Bzm21ModelRevision => revision !== null)
    .sort(compareRevisionOrder);
  if (revisions.length !== rawRevisionRows.length) {
    diagnostics.push("版台帳に未知のdata_modeまたは通貨がある");
  }
  const revisionById = new Map(
    revisions.map((revision) => [revision.revisionId, revision]),
  );
  const currentRevision =
    revisions.filter((revision) => revision.dataMode === "project").at(-1) ??
    revisions.at(-1) ??
    null;
  if (currentRevision?.dataMode === "synthetic") {
    diagnostics.push("合成テスト版は実PJの現在値として表示できない");
  }
  for (const revision of revisions) {
    const cutoffDate = dateInJst(revision.informationCutoff);
    if (
      revision.valuationDate &&
      (!cutoffDate || revision.valuationDate > cutoffDate)
    ) {
      diagnostics.push(`評価日が版の情報締切を超えている: ${revision.revisionKey}`);
    }
    for (const [label, value] of [
      ["価値規則", revision.valuationRuleByObjective],
      ["判断基準", revision.decisionCriterionByObjective],
      ["同率規則", revision.tieBreakRule],
      ["不確実性規則", revision.uncertaintyRule],
    ] as const) {
      diagnostics.push(
        ...evidenceCutoffDiagnostics(
          value,
          revision.informationCutoff,
          `${revision.revisionKey}/${label}`,
          false,
          revision.dataMode === "project",
        ),
      );
    }
  }

  const inputs = (args.inputRows ?? [])
    .map(mapInput)
    .filter((input): input is Bzm21InputObservation => input !== null)
    .sort(compareInput);
  if (inputs.length !== (args.inputRows ?? []).length) {
    diagnostics.push("入力台帳に未知のscope_kindがある");
  }
  for (const input of inputs) {
    const revision = revisionById.get(input.revisionId);
    const inputCutoff = Date.parse(input.informationCutoff);
    if (
      !revision ||
      !Number.isFinite(inputCutoff) ||
      inputCutoff > Date.parse(revision.informationCutoff)
    ) {
      diagnostics.push(`入力が版の情報締切を超えている: ${input.parameterKey}`);
    }
    if (revision?.dataMode === "project" && input.evidenceKind === "synthetic") {
      diagnostics.push(`実PJ版の入力に合成根拠を使用: ${input.parameterKey}`);
    }
  }
  const inputByScope = new Map<string, Bzm21InputObservation[]>();
  for (const input of inputs) {
    const key = `${input.revisionId}:${input.scopeKind}:${input.scopeKey}`;
    inputByScope.set(key, [...(inputByScope.get(key) ?? []), input]);
  }

  const cashflowEventHistory = (args.cashflowEventRows ?? [])
    .map(mapCashflowEvent)
    .filter((event): event is Bzm21CashflowEvent => event !== null)
    .sort(
      (a, b) =>
        (a.timingMonths ?? Number.POSITIVE_INFINITY) -
          (b.timingMonths ?? Number.POSITIVE_INFINITY) ||
        a.createdAt.localeCompare(b.createdAt),
    );
  if (cashflowEventHistory.length !== (args.cashflowEventRows ?? []).length) {
    diagnostics.push("単一CF台帳に未知の区分または不正な視点帰属がある");
  }
  const cashflowEvents = cashflowEventHistory.filter(
    (event) => event.revisionId === currentRevision?.revisionId,
  );
  for (const event of cashflowEventHistory) {
    const revision = revisionById.get(event.revisionId);
    const eventCutoff = Date.parse(event.informationCutoff);
    const eventCutoffDate = dateInJst(event.informationCutoff);
    if (
      !revision ||
      !Number.isFinite(eventCutoff) ||
      eventCutoff > Date.parse(revision.informationCutoff)
    ) {
      diagnostics.push(`単一CF台帳が版の情報締切を超えている: ${event.eventKey}`);
    }
    if (revision?.dataMode === "project" && event.evidenceKind === "synthetic") {
      diagnostics.push(`実PJ版のCF事象に合成根拠を使用: ${event.eventKey}`);
    }
    if (
      event.currency !== "JPY" &&
      (!event.conversionRateDate ||
        !eventCutoffDate ||
        event.conversionRateDate > eventCutoffDate)
    ) {
      diagnostics.push(`為替換算日がCF事象の情報締切を超えている: ${event.eventKey}`);
    }
    if (revision) {
      diagnostics.push(
        ...evidenceCutoffDiagnostics(
          event.publicSocialBenefitVector,
          revision.informationCutoff,
          `${event.eventKey}/社会便益`,
          false,
          revision.dataMode === "project",
        ),
      );
    }
    if (event.publicAggregationStatus === "complete") {
      const socialSum = publicSocialComponentSum(event.publicSocialBenefitVector);
      const publicAttribution = event.perspectiveAttribution.public;
      const publicSign = isRecord(publicAttribution)
        ? publicAttribution.sign
        : null;
      if (
        !revision ||
        revision.publicAggregationRuleRef !==
          "bzm2.1:public=fiscal+social_converted:v0.1" ||
        socialSum === null ||
        event.publicFiscalAmountMillionJpy === null ||
        event.publicSocialConvertedAmountMillionJpy === null ||
        event.publicAggregatedAmountMillionJpy === null ||
        !event.publicAggregationInputHash ||
        !/^[0-9a-f]{64}$/.test(event.publicAggregationInputHash) ||
        (event.publicAggregatedAmountMillionJpy !== 0 &&
          Math.sign(event.publicAggregatedAmountMillionJpy ?? 0) !== publicSign) ||
        !args.expectedPublicAggregationHashes ||
        args.expectedPublicAggregationHashes[event.cashflowEventId] !==
          event.publicAggregationInputHash ||
        Math.abs(socialSum - event.publicSocialConvertedAmountMillionJpy) >
          Math.max(1e-9, Math.abs(socialSum) * 1e-9) ||
        Math.abs(
          event.publicFiscalAmountMillionJpy +
            event.publicSocialConvertedAmountMillionJpy -
            event.publicAggregatedAmountMillionJpy,
        ) > Math.max(1e-9, Math.abs(event.publicAggregatedAmountMillionJpy) * 1e-9)
      ) {
        diagnostics.push(`公的価値の分離集約cacheが不整合: ${event.eventKey}`);
      }
    }
    if (event.taxTreatment === "tax_payment" && !event.taxSubjectRef) {
      diagnostics.push(`税支払の税対象IDが欠測: ${event.eventKey}`);
    }
  }
  const transferGroups = new Map<string, Bzm21CashflowEvent[]>();
  for (const event of cashflowEvents) {
    const includedObjectives = BZM21_OBJECTIVE_KINDS.filter((objective) => {
      const attribution = event.perspectiveAttribution[objective];
      return isRecord(attribution) && attribution.included === true;
    });
    if (event.economicEventGroupKey) {
      transferGroups.set(event.economicEventGroupKey, [
        ...(transferGroups.get(event.economicEventGroupKey) ?? []),
        event,
      ]);
      if (
        !event.perspectiveLeg ||
        includedObjectives.length !== 1 ||
        includedObjectives[0] !== event.perspectiveLeg
      ) {
        diagnostics.push(`経済事象groupの視点脚が不正: ${event.eventKey}`);
      }
    } else {
      if (event.perspectiveLeg !== null) {
        diagnostics.push(`groupなしCF事象に視点脚がある: ${event.eventKey}`);
      }
      const signs = new Set(
        includedObjectives.map((objective) => {
          const attribution = event.perspectiveAttribution[objective];
          return isRecord(attribution) ? attribution.sign : null;
        }),
      );
      if (signs.size > 1) {
        diagnostics.push(`反対符号の視点をgroupなし1行へ混在: ${event.eventKey}`);
      }
    }
  }
  for (const [groupKey, events] of transferGroups) {
    if (events.length < 2) {
      diagnostics.push(`経済事象groupの反対脚が欠測: ${groupKey}`);
      continue;
    }
    const legs = events.map((event) => event.perspectiveLeg);
    if (new Set(legs).size !== legs.length) {
      diagnostics.push(`経済事象groupで同じ視点脚が重複: ${groupKey}`);
    }
    const signature = (event: Bzm21CashflowEvent) =>
      stableJson({
        stateId: event.stateId,
        actionId: event.actionId,
        transitionId: event.transitionId,
        scopeKind: event.scopeKind,
        scopeKey: event.scopeKey,
        timingKind: event.timingKind,
        timingMonths: event.timingMonths,
        amount: event.amount,
        currency: event.currency,
        modelAmountMillionJpy: event.modelAmountMillionJpy,
        conversionRuleRef: event.conversionRuleRef,
        conversionRateToJpy: event.conversionRateToJpy,
        conversionRateDate: event.conversionRateDate,
        conversionRateSourceRef: event.conversionRateSourceRef,
        ownerKind: event.ownerKind,
        ownerRef: event.ownerRef,
        counterpartyKind: event.counterpartyKind,
        counterpartyRef: event.counterpartyRef,
        nominalOrReal: event.nominalOrReal,
        priceBaseDate: event.priceBaseDate,
        taxTreatment: event.taxTreatment,
        taxSubjectRef: event.taxSubjectRef,
        evidenceKind: event.evidenceKind,
        evidenceRef: event.evidenceRef,
        informationCutoff: event.informationCutoff,
        condition: event.condition,
      });
    const signatures = new Set(events.map(signature));
    if (signatures.size !== 1) {
      diagnostics.push(`経済事象groupの金額・時点・主体・根拠が不一致: ${groupKey}`);
    }
  }
  const semanticDuplicateGroups = new Map<string, Bzm21CashflowEvent[]>();
  for (const event of cashflowEvents) {
    const fingerprint = stableJson({
      stateId: event.stateId,
      actionId: event.actionId,
      transitionId: event.transitionId,
      economicEventGroupKey: event.economicEventGroupKey,
      perspectiveLeg: event.perspectiveLeg,
      scopeKind: event.scopeKind,
      scopeKey: event.scopeKey,
      timingKind: event.timingKind,
      timingMonths: event.timingMonths,
      amount: event.amount,
      currency: event.currency,
      modelAmountMillionJpy: event.modelAmountMillionJpy,
      conversionRuleRef: event.conversionRuleRef,
      conversionRateToJpy: event.conversionRateToJpy,
      conversionRateDate: event.conversionRateDate,
      conversionRateSourceRef: event.conversionRateSourceRef,
      ownerKind: event.ownerKind,
      ownerRef: event.ownerRef,
      counterpartyKind: event.counterpartyKind,
      counterpartyRef: event.counterpartyRef,
      nominalOrReal: event.nominalOrReal,
      priceBaseDate: event.priceBaseDate,
      taxTreatment: event.taxTreatment,
      taxSubjectRef: event.taxSubjectRef,
      evidenceKind: event.evidenceKind,
      evidenceRef: event.evidenceRef,
      informationCutoff: event.informationCutoff,
      includedIn: event.includedIn,
      perspectiveAttribution: event.perspectiveAttribution,
      publicAggregationStatus: event.publicAggregationStatus,
      publicFiscalAmountMillionJpy: event.publicFiscalAmountMillionJpy,
      publicSocialBenefitVector: event.publicSocialBenefitVector,
      publicSocialConvertedAmountMillionJpy:
        event.publicSocialConvertedAmountMillionJpy,
      publicAggregatedAmountMillionJpy: event.publicAggregatedAmountMillionJpy,
      publicTransferTreatment: event.publicTransferTreatment,
      publicTransferDeduplicationRef: event.publicTransferDeduplicationRef,
      condition: event.condition,
    });
    semanticDuplicateGroups.set(fingerprint, [
      ...(semanticDuplicateGroups.get(fingerprint) ?? []),
      event,
    ]);
  }
  for (const events of semanticDuplicateGroups.values()) {
    if (events.length < 2) continue;
    const reviewRefs = new Set(
      events
        .map((event) => event.semanticDuplicateReviewRef?.trim() ?? "")
        .filter(Boolean),
    );
    if (reviewRefs.size !== 1 || events.some((event) => !event.semanticDuplicateReviewRef?.trim())) {
      diagnostics.push(
        `意味的に同一のCF事象が重複し、重複レビュー参照が閉じていない: ${events
          .map((event) => event.eventKey)
          .join(", ")}`,
      );
    }
  }

  const actionEvaluations = (args.actionEvaluationRows ?? [])
    .map(mapActionEvaluation)
    .filter((value): value is Bzm21ActionEvaluation => value !== null);
  if (actionEvaluations.length !== (args.actionEvaluationRows ?? []).length) {
    diagnostics.push("行動評価に未知の目的または評価状態がある");
  }
  const rawStateRevisionById = new Map(
    (args.stateRows ?? []).map((row) => [row.state_id, row.revision_id]),
  );
  const rawActionRevisionById = new Map(
    (args.actionRows ?? []).map((row) => [
      row.action_id,
      rawStateRevisionById.get(row.state_id) ?? null,
    ]),
  );
  for (const evaluation of actionEvaluations) {
    const revisionId = rawActionRevisionById.get(evaluation.actionId);
    const revision = revisionId ? revisionById.get(revisionId) : null;
    const evaluationCutoff = Date.parse(evaluation.informationCutoff);
    if (
      !revision ||
      !Number.isFinite(evaluationCutoff) ||
      evaluationCutoff > Date.parse(revision.informationCutoff)
    ) {
      diagnostics.push(`行動評価が版の情報締切を超えている: ${evaluation.actionId}`);
    }
    if (
      evaluation.goalProbability !== null &&
      evaluation.planDeadlineGoalProbability !== null &&
      evaluation.planDeadlineGoalProbability > evaluation.goalProbability
    ) {
      diagnostics.push(`行動評価で計画期限内qが経済期限内qを超えている: ${evaluation.actionId}`);
    }
    if (
      evaluation.evaluationStatus === "computed" &&
      ((evaluation.goalProbability === 0 && evaluation.conditionalGoalValue !== null) ||
        ((evaluation.goalProbability ?? 0) > 0 &&
          evaluation.conditionalGoalValue === null))
    ) {
      diagnostics.push(`行動評価の条件付き価値と到達見込みが不整合: ${evaluation.actionId}`);
    }
    if (revision) {
      diagnostics.push(
        ...evidenceCutoffDiagnostics(
          evaluation.publicSocialComponents,
          revision.informationCutoff,
          `${evaluation.actionId}/公的社会便益`,
          false,
          revision.dataMode === "project",
        ),
      );
    }
    const publicSocialSum = publicSocialComponentSum(
      evaluation.publicSocialComponents,
    );
    const validPublicEvaluation =
      evaluation.objectiveKind !== "public"
        ? evaluation.publicAggregationStatus === "not_applicable" &&
          evaluation.publicFiscalValueMillionJpy === null &&
          evaluation.publicSocialComponents.length === 0 &&
          evaluation.publicSocialMonetizedValueMillionJpy === null &&
          evaluation.publicAggregatedValueMillionJpy === null &&
          evaluation.publicAggregationInputHash === null
        : evaluation.evaluationStatus !== "computed"
          ? evaluation.publicAggregationStatus === "not_computable" &&
            evaluation.publicAggregatedValueMillionJpy === null &&
            evaluation.publicAggregationInputHash === null
          : evaluation.publicAggregationStatus === "complete" &&
            revision?.dataMode === "synthetic" &&
            revision?.publicAggregationRuleRef ===
              "bzm2.1:public=fiscal+social_converted:v0.1" &&
            publicSocialSum !== null &&
            evaluation.publicFiscalValueMillionJpy !== null &&
            evaluation.publicSocialMonetizedValueMillionJpy !== null &&
            evaluation.publicAggregatedValueMillionJpy !== null &&
            evaluation.expectedNetValue !== null &&
            Boolean(
              evaluation.publicAggregationInputHash?.match(/^[0-9a-f]{64}$/),
            ) &&
            Math.abs(
              publicSocialSum -
                evaluation.publicSocialMonetizedValueMillionJpy,
            ) <= Math.max(1e-9, Math.abs(publicSocialSum) * 1e-9) &&
            Math.abs(
              evaluation.publicFiscalValueMillionJpy +
                evaluation.publicSocialMonetizedValueMillionJpy -
                evaluation.publicAggregatedValueMillionJpy,
            ) <=
              Math.max(
                1e-9,
                Math.abs(evaluation.publicAggregatedValueMillionJpy) * 1e-9,
              ) &&
            Math.abs(
              evaluation.expectedNetValue -
                evaluation.publicAggregatedValueMillionJpy,
            ) <= Math.max(1e-9, Math.abs(evaluation.expectedNetValue) * 1e-9);
    if (!validPublicEvaluation) {
      diagnostics.push(`行動評価の公的価値分離が不整合: ${evaluation.actionId}`);
    }
  }
  const actionEvaluationsByAction = new Map<string, Bzm21ActionEvaluation[]>();
  for (const evaluation of actionEvaluations) {
    actionEvaluationsByAction.set(evaluation.actionId, [
      ...(actionEvaluationsByAction.get(evaluation.actionId) ?? []),
      evaluation,
    ]);
  }

  const transitionByAction = new Map<string, Bzm21Transition[]>();
  for (const row of args.transitionRows ?? []) {
    const transition: Bzm21Transition = {
      transitionId: row.transition_id,
      actionId: row.action_id,
      transitionKey: row.transition_key,
      label: row.label,
      nextStateId: row.next_state_id,
      terminalOutcome: row.terminal_outcome,
      probability: finiteOrNull(row.probability),
      goalReachedAtMonths: finiteOrNull(row.goal_reached_at_months),
      slackLostAtMonths: finiteOrNull(row.slack_lost_at_months),
      transitionCashFlowByObjective: isRecord(
        row.transition_cash_flow_by_objective_json,
      )
        ? row.transition_cash_flow_by_objective_json
        : {},
      terminalValueByObjective: isRecord(row.terminal_value_by_objective_json)
        ? row.terminal_value_by_objective_json
        : {},
      failureLossByObjective: isRecord(row.failure_loss_by_objective_json)
        ? row.failure_loss_by_objective_json
        : {},
      cashflowEventKeys: row.cashflow_event_keys,
      evidence: isRecord(row.evidence_json) ? row.evidence_json : {},
      transitionOrder: row.transition_order,
      createdAt: row.created_at,
      inputs: [],
    };
    transitionByAction.set(row.action_id, [
      ...(transitionByAction.get(row.action_id) ?? []),
      transition,
    ]);
  }

  const actionsByState = new Map<string, Bzm21Action[]>();
  for (const row of args.actionRows ?? []) {
    if (
      !isOneOf(BZM21_ACTION_TYPES, row.action_type) ||
      !row.component_types.every((kind) => isOneOf(BZM21_ACTION_TYPES, kind)) ||
      !row.component_types.includes(row.action_type) ||
      (row.availability_status !== "available" &&
        row.availability_status !== "unavailable" &&
        row.availability_status !== "unknown")
    ) {
      diagnostics.push(`未知または不完全な行動束: ${row.action_key}`);
      continue;
    }
    const action: Bzm21Action = {
      actionId: row.action_id,
      stateId: row.state_id,
      actionKey: row.action_key,
      bundleId: row.bundle_id,
      actionType: row.action_type,
      componentTypes: row.component_types as Bzm21ActionType[],
      customComponents: row.custom_components,
      sequence: asArray(row.sequence_json),
      sharedResources: asArray(row.shared_resources_json),
      label: row.label,
      actionOrder: row.action_order,
      availabilityStatus: row.availability_status,
      availabilityReason: row.availability_reason,
      feasibilityGate: isRecord(row.feasibility_gate_json)
        ? row.feasibility_gate_json
        : {},
      authorityGate: isRecord(row.authority_gate_json)
        ? row.authority_gate_json
        : {},
      consents: asArray(row.consents_json),
      financingFeasibility: isRecord(row.financing_feasibility_json)
        ? row.financing_feasibility_json
        : {},
      durationMonths: finiteOrNull(row.duration_months),
      immediateCostByObjective: isRecord(row.immediate_cost_by_objective_json)
        ? row.immediate_cost_by_objective_json
        : {},
      immediateBenefitByObjective: isRecord(
        row.immediate_benefit_by_objective_json,
      )
        ? row.immediate_benefit_by_objective_json
        : {},
      requiredFundingMillionJpy: finiteOrNull(row.required_funding_million_jpy),
      cashflowEventKeys: row.cashflow_event_keys,
      informationGain: asArray(row.information_gain_json),
      evidence: isRecord(row.evidence_json) ? row.evidence_json : {},
      createdAt: row.created_at,
      inputs: [],
      transitions: (transitionByAction.get(row.action_id) ?? []).sort(
        (a, b) => a.transitionOrder - b.transitionOrder,
      ),
      evaluations: actionEvaluationsByAction.get(row.action_id) ?? [],
    };
    actionsByState.set(row.state_id, [
      ...(actionsByState.get(row.state_id) ?? []),
      action,
    ]);
  }

  const states = (args.stateRows ?? [])
    .filter((row) => row.revision_id === currentRevision?.revisionId)
    .map((row): Bzm21DecisionState => ({
      stateId: row.state_id,
      revisionId: row.revision_id,
      stateKey: row.state_key,
      label: row.label,
      decisionOrder: row.decision_order,
      isInitial: row.is_initial,
      elapsedMonths: finiteOrNull(row.elapsed_months),
      currentState: isRecord(row.current_state_json) ? row.current_state_json : {},
      beliefs: asArray(row.beliefs_json),
      reachabilityHistory: isRecord(row.reachability_history_json)
        ? row.reachability_history_json
        : {},
      decisionController: isRecord(row.decision_controller_json)
        ? row.decision_controller_json
        : {},
      sunkCostMillionJpy: finiteOrNull(row.sunk_cost_million_jpy),
      remainingCostMillionJpy: finiteOrNull(row.remaining_cost_million_jpy),
      remainingTimeMonths: finiteOrNull(row.remaining_time_months),
      availableInformation: asArray(row.available_information_json),
      evidence: isRecord(row.evidence_json) ? row.evidence_json : {},
      createdAt: row.created_at,
      inputs:
        inputByScope.get(`${row.revision_id}:state:${row.state_key}`) ?? [],
      actions: (actionsByState.get(row.state_id) ?? []).sort(
        (a, b) => a.actionOrder - b.actionOrder,
      ),
    }))
    .sort((a, b) => a.decisionOrder - b.decisionOrder);

  const stateById = new Map(states.map((state) => [state.stateId, state]));
  const actionById = new Map(
    states.flatMap((state) => state.actions.map((action) => [action.actionId, action] as const)),
  );
  const transitionById = new Map(
    states.flatMap((state) =>
      state.actions.flatMap((action) =>
        action.transitions.map(
          (transition) => [transition.transitionId, transition] as const,
        ),
      ),
    ),
  );
  for (const event of cashflowEvents) {
    const state = event.stateId ? stateById.get(event.stateId) : null;
    const action = event.actionId ? actionById.get(event.actionId) : null;
    const transition = event.transitionId
      ? transitionById.get(event.transitionId)
      : null;
    const computationEvent = [
      "immediate_cost",
      "immediate_benefit",
      "transition_cash_flow",
      "terminal_value",
      "failure_loss",
    ].includes(event.includedIn);
    if (
      (computationEvent && (!state || !action)) ||
      (state && state.revisionId !== event.revisionId) ||
      (action && action.stateId !== event.stateId) ||
      (event.transitionId &&
        (!transition || transition.actionId !== event.actionId))
    ) {
      diagnostics.push(`CF eventの親子または版が不一致: ${event.eventKey}`);
    }
  }
  const cashflowByEventKey = new Map(
    cashflowEvents.map((event) => [event.eventKey, event]),
  );
  const cashflowReferenceCount = new Map<string, number>();
  const controllerSignatures = new Set<string>();
  for (const state of states) {
    const revision = revisionById.get(state.revisionId);
    if (revision) {
      const graphEvidenceValues: Array<[string, unknown, boolean]> = [
        ["状態根拠", state.evidence, true],
        ["信念", state.beliefs, false],
        ["到達履歴", state.reachabilityHistory, false],
        ["意思決定者", state.decisionController, false],
      ];
      for (const [label, value, direct] of graphEvidenceValues) {
        diagnostics.push(
          ...evidenceCutoffDiagnostics(
            value,
            revision.informationCutoff,
            `${state.stateKey}/${label}`,
            direct,
            revision.dataMode === "project",
          ),
        );
      }
    }
    if (!hasValidReachabilityHistory(state.reachabilityHistory)) {
      diagnostics.push(`到達・余力喪失の履歴が不完全: ${state.stateKey}`);
    }
    const controller = state.decisionController;
    const controllerId = controller.controllerId;
    const controllerKind = controller.kind;
    const controllerObjective = controller.objective;
    if (
      typeof controllerId !== "string" ||
      controllerId.trim() === "" ||
      typeof controllerKind !== "string" ||
      !["company", "bzsf", "public", "joint", "external"].includes(
        controllerKind,
      ) ||
      (controllerObjective !== null &&
        (typeof controllerObjective !== "string" ||
          !isOneOf(BZM21_OBJECTIVE_KINDS, controllerObjective))) ||
      !isRecord(controller.evidence)
    ) {
      diagnostics.push(`意思決定者の契約が不完全: ${state.stateKey}`);
    } else {
      controllerSignatures.add(
        `${controllerId}:${controllerKind}:${controllerObjective ?? "null"}`,
      );
    }
    for (const action of state.actions) {
      const actionPath = `${state.stateKey}/${action.actionKey}`;
      if (revision) {
        const actionEvidenceValues: Array<[string, unknown, boolean]> = [
          ["行動根拠", action.evidence, true],
          ["共有資源", action.sharedResources, false],
          ["実行可能性", action.feasibilityGate, false],
          ["権限", action.authorityGate, false],
          ["同意", action.consents, false],
          ["資金実行可能性", action.financingFeasibility, false],
        ];
        for (const [label, value, direct] of actionEvidenceValues) {
          diagnostics.push(
            ...evidenceCutoffDiagnostics(
              value,
              revision.informationCutoff,
              `${actionPath}/${label}`,
              direct,
              revision.dataMode === "project",
            ),
          );
        }
      }
      if (new Set(action.cashflowEventKeys).size !== action.cashflowEventKeys.length) {
        diagnostics.push(`同じ行動内でCF eventを重複参照: ${actionPath}`);
      }
      for (const eventKey of action.cashflowEventKeys) {
        const event = cashflowByEventKey.get(eventKey);
        if (!event) {
          diagnostics.push(`行動が存在しないCF eventを参照: ${actionPath}/${eventKey}`);
          continue;
        }
        if (
          !["immediate_cost", "immediate_benefit"].includes(event.includedIn)
        ) {
          diagnostics.push(`行動とCF eventの集計区分が不一致: ${actionPath}/${eventKey}`);
        }
        if (
          event.stateId !== state.stateId ||
          event.actionId !== action.actionId ||
          event.transitionId !== null ||
          event.scopeKind !== "action" ||
          event.scopeKey !== actionPath ||
          event.timingKind !== "action_start"
        ) {
          diagnostics.push(`行動とCF eventのscopeが不一致: ${actionPath}/${eventKey}`);
        }
        cashflowReferenceCount.set(
          eventKey,
          (cashflowReferenceCount.get(eventKey) ?? 0) + 1,
        );
      }
      action.inputs =
        inputByScope.get(`${state.revisionId}:action:${actionPath}`) ?? [];
      for (const transition of action.transitions) {
        if (revision) {
          diagnostics.push(
            ...evidenceCutoffDiagnostics(
              transition.evidence,
              revision.informationCutoff,
              `${actionPath}/${transition.transitionKey}/遷移根拠`,
              true,
              revision.dataMode === "project",
            ),
          );
        }
        if (
          new Set(transition.cashflowEventKeys).size !==
          transition.cashflowEventKeys.length
        ) {
          diagnostics.push(`同じ遷移内でCF eventを重複参照: ${transition.transitionKey}`);
        }
        for (const eventKey of transition.cashflowEventKeys) {
          const event = cashflowByEventKey.get(eventKey);
          if (!event) {
            diagnostics.push(
              `遷移が存在しないCF eventを参照: ${transition.transitionKey}/${eventKey}`,
            );
            continue;
          }
          if (
            ![
              "transition_cash_flow",
              "terminal_value",
              "failure_loss",
            ].includes(event.includedIn)
          ) {
            diagnostics.push(
              `遷移とCF eventの集計区分が不一致: ${transition.transitionKey}/${eventKey}`,
            );
          }
          const transitionPath = `${actionPath}/${transition.transitionKey}`;
          if (
            event.stateId !== state.stateId ||
            event.actionId !== action.actionId ||
            event.transitionId !== transition.transitionId ||
            event.scopeKind !== "transition" ||
            event.scopeKey !== transitionPath ||
            event.timingKind !== "action_end"
          ) {
            diagnostics.push(
              `遷移とCF eventのscopeが不一致: ${transition.transitionKey}/${eventKey}`,
            );
          }
          cashflowReferenceCount.set(
            eventKey,
            (cashflowReferenceCount.get(eventKey) ?? 0) + 1,
          );
        }
        transition.inputs =
          inputByScope.get(
            `${state.revisionId}:transition:${actionPath}/${transition.transitionKey}`,
          ) ?? [];
        if (transition.nextStateId && !stateById.has(transition.nextStateId)) {
          diagnostics.push(`遷移先が同じ版に存在しない: ${transition.transitionKey}`);
        }
      }
    }
  }
  for (const event of cashflowEvents) {
    const referenceCount = cashflowReferenceCount.get(event.eventKey) ?? 0;
    if (
      [
        "immediate_cost",
        "immediate_benefit",
        "transition_cash_flow",
        "terminal_value",
        "failure_loss",
      ].includes(event.includedIn) &&
      referenceCount === 0
    ) {
      diagnostics.push(`計算対象のCF eventが未参照: ${event.eventKey}`);
    }
    if (referenceCount > 1) {
      diagnostics.push(`同じCF eventを複数箇所で参照: ${event.eventKey}`);
    }
  }
  if (controllerSignatures.size > 1) {
    diagnostics.push("同じ版の途中で意思決定者または選択目的が変わっている");
  }

  const interventions = (args.interventionRows ?? [])
    .filter((row) => row.revision_id === currentRevision?.revisionId)
    .map((row): Bzm21Intervention => ({
      interventionId: row.intervention_id,
      revisionId: row.revision_id,
      interventionKey: row.intervention_key,
      label: row.label,
      enabled: row.enabled,
      effects: asArray(row.effects_json),
      evidence: isRecord(row.evidence_json) ? row.evidence_json : {},
      createdAt: row.created_at,
      inputs:
        inputByScope.get(
          `${row.revision_id}:intervention:${row.intervention_key}`,
        ) ?? [],
    }));
  for (const intervention of interventions) {
    const revision = revisionById.get(intervention.revisionId);
    if (revision) {
      diagnostics.push(
        ...evidenceCutoffDiagnostics(
          intervention.evidence,
          revision.informationCutoff,
          `${intervention.interventionKey}/支援根拠`,
          true,
          revision.dataMode === "project",
        ),
      );
    }
  }

  const policyEvaluations = (args.policyEvaluationRows ?? [])
    .map((row) => {
      const revision = revisionById.get(row.revision_id);
      return revision ? mapPolicyEvaluation(row, revision) : null;
    })
    .filter((value): value is Bzm21PolicyEvaluation => value !== null)
    .sort(compareRevisionOrder);
  if (policyEvaluations.length !== (args.policyEvaluationRows ?? []).length) {
    diagnostics.push("方針評価に未知の版・目的・方針・評価状態がある");
  }
  for (const evaluation of policyEvaluations) {
    const revision = revisionById.get(evaluation.revisionId);
    const evaluationCutoff = Date.parse(evaluation.informationCutoff);
    if (
      !revision ||
      !Number.isFinite(evaluationCutoff) ||
      evaluationCutoff > Date.parse(revision.informationCutoff)
    ) {
      diagnostics.push(
        `方針評価が版の情報締切を超えている: ${evaluation.revisionKey}/${evaluation.objectiveKind}/${evaluation.policyKind}`,
      );
    }
    if (!revision) continue;
    diagnostics.push(
      ...evidenceCutoffDiagnostics(
        evaluation.publicSocialComponents,
        revision.informationCutoff,
        `${evaluation.revisionKey}/${evaluation.objectiveKind}/${evaluation.policyKind}/公的社会便益`,
        false,
        revision.dataMode === "project",
      ),
    );
    const publicSocialSum = publicSocialComponentSum(
      evaluation.publicSocialComponents,
    );
    const validPublicEvaluation =
      evaluation.objectiveKind !== "public"
        ? evaluation.publicAggregationStatus === "not_applicable" &&
          evaluation.publicFiscalValueMillionJpy === null &&
          evaluation.publicSocialComponents.length === 0 &&
          evaluation.publicSocialMonetizedValueMillionJpy === null &&
          evaluation.publicAggregatedValueMillionJpy === null &&
          evaluation.publicAggregationInputHash === null
        : evaluation.evaluationStatus !== "computed"
          ? evaluation.publicAggregationStatus === "not_computable" &&
            evaluation.publicAggregatedValueMillionJpy === null &&
            evaluation.publicAggregationInputHash === null
          : evaluation.publicAggregationStatus === "complete" &&
            revision.dataMode === "synthetic" &&
            revision.publicAggregationRuleRef ===
              "bzm2.1:public=fiscal+social_converted:v0.1" &&
            publicSocialSum !== null &&
            evaluation.publicFiscalValueMillionJpy !== null &&
            evaluation.publicSocialMonetizedValueMillionJpy !== null &&
            evaluation.publicAggregatedValueMillionJpy !== null &&
            evaluation.expectedNetValue !== null &&
            Boolean(
              evaluation.publicAggregationInputHash?.match(/^[0-9a-f]{64}$/),
            ) &&
            Math.abs(
              publicSocialSum -
                evaluation.publicSocialMonetizedValueMillionJpy,
            ) <= Math.max(1e-9, Math.abs(publicSocialSum) * 1e-9) &&
            Math.abs(
              evaluation.publicFiscalValueMillionJpy +
                evaluation.publicSocialMonetizedValueMillionJpy -
                evaluation.publicAggregatedValueMillionJpy,
            ) <=
              Math.max(
                1e-9,
                Math.abs(evaluation.publicAggregatedValueMillionJpy) * 1e-9,
              ) &&
            Math.abs(
              evaluation.expectedNetValue -
                evaluation.publicAggregatedValueMillionJpy,
            ) <= Math.max(1e-9, Math.abs(evaluation.expectedNetValue) * 1e-9);
    if (!validPublicEvaluation) {
      diagnostics.push(
        `方針評価の公的価値分離が不整合: ${evaluation.revisionKey}/${evaluation.objectiveKind}/${evaluation.policyKind}`,
      );
    }
    if (
      evaluation.goalProbability !== null &&
      evaluation.planDeadlineGoalProbability !== null &&
      evaluation.planDeadlineGoalProbability > evaluation.goalProbability
    ) {
      diagnostics.push(
        `方針評価で計画期限内qが経済期限内qを超えている: ${evaluation.revisionKey}/${evaluation.objectiveKind}/${evaluation.policyKind}`,
      );
    }
    if (
      evaluation.evaluationStatus === "computed" &&
      ((evaluation.goalProbability === 0 && evaluation.conditionalGoalValue !== null) ||
        ((evaluation.goalProbability ?? 0) > 0 &&
          evaluation.conditionalGoalValue === null))
    ) {
      diagnostics.push(
        `方針評価の条件付き価値と到達見込みが不整合: ${evaluation.revisionKey}/${evaluation.objectiveKind}/${evaluation.policyKind}`,
      );
    }
    for (const [stateId, actionId] of Object.entries(
      evaluation.selectedActionByState,
    )) {
      const state = stateById.get(stateId);
      const action = actionById.get(actionId);
      const feasibilityStatus = action?.feasibilityGate.status;
      const authorityStatus = action?.authorityGate.status;
      const financingStatus = action?.financingFeasibility.status;
      const consentsExecutable = action?.consents.every(
        (consent) =>
          isRecord(consent) &&
          ["confirmed", "not_required"].includes(String(consent.status)),
      );
      if (
        !state ||
        !action ||
        action.stateId !== state.stateId ||
        action.availabilityStatus !== "available" ||
        !["confirmed", "not_required"].includes(String(feasibilityStatus)) ||
        !["confirmed", "not_required"].includes(String(authorityStatus)) ||
        !["secured", "contracted", "not_required"].includes(
          String(financingStatus),
        ) ||
        !consentsExecutable
      ) {
        diagnostics.push(
          `方針の選択行動がcurrent graphの実行可能な親子へ閉じない: ${evaluation.revisionKey}/${stateId}/${actionId}`,
        );
      }
    }
    for (const [stateId, controller] of Object.entries(
      evaluation.controllerByState,
    )) {
      const state = stateById.get(stateId);
      if (!state || stableJson(controller) !== stableJson(state.decisionController)) {
        diagnostics.push(
          `方針の意思決定者cacheがcurrent graphと不一致: ${evaluation.revisionKey}/${stateId}`,
        );
      }
    }
    for (const rawDecision of evaluation.stateDecisions) {
      if (!isRecord(rawDecision)) {
        diagnostics.push(`方針の状態判断cacheが不正: ${evaluation.revisionKey}`);
        continue;
      }
      const stateId = rawDecision.stateId;
      const selectedActionId = rawDecision.selectedActionId;
      const state = typeof stateId === "string" ? stateById.get(stateId) : null;
      const selectedAction =
        typeof selectedActionId === "string"
          ? actionById.get(selectedActionId)
          : null;
      const actionIds = [
        ...asArray(rawDecision.actions).flatMap((entry) =>
          isRecord(entry) && typeof entry.actionId === "string"
            ? [entry.actionId]
            : [],
        ),
        ...asArray(rawDecision.excludedActions).flatMap((entry) =>
          isRecord(entry) && typeof entry.actionId === "string"
            ? [entry.actionId]
            : [],
        ),
      ];
      if (
        !state ||
        !selectedAction ||
        selectedAction.stateId !== state.stateId ||
        evaluation.selectedActionByState[state.stateId] !== selectedAction.actionId ||
        actionIds.some((actionId) => actionById.get(actionId)?.stateId !== state.stateId)
      ) {
        diagnostics.push(
          `方針の状態判断cacheがcurrent graphへ閉じない: ${evaluation.revisionKey}/${String(stateId)}`,
        );
      }
    }
  }
  if (
    policyEvaluations.some(
      (evaluation) => evaluation.evaluationStatus === "computed",
    ) &&
    cashflowEvents.length === 0
  ) {
    diagnostics.push("計算済み方針に単一CF event正本がない");
  }
  for (const revision of revisions) {
    for (const policyKind of BZM21_POLICY_KINDS) {
      const views = policyEvaluations.filter(
        (evaluation) =>
          evaluation.revisionId === revision.revisionId &&
          evaluation.policyKind === policyKind,
      );
      const actionSignatures = new Set(
        views
          .filter(
            (evaluation) =>
              Object.keys(evaluation.selectedActionByState).length > 0,
          )
          .map((evaluation) =>
            JSON.stringify(
              Object.entries(evaluation.selectedActionByState).sort(([a], [b]) =>
                a.localeCompare(b),
              ),
            ),
          ),
      );
      const selectionObjectives = new Set(
        views
          .map((evaluation) => evaluation.selectionObjective)
          .filter(
            (objective): objective is Bzm21ObjectiveKind => objective !== null,
          ),
      );
      const goalProbabilities = new Set(
        views
          .map((evaluation) => evaluation.goalProbability)
          .filter((value): value is number => value !== null)
          .map((value) => value.toPrecision(12)),
      );
      const planProbabilities = new Set(
        views
          .map((evaluation) => evaluation.planDeadlineGoalProbability)
          .filter((value): value is number => value !== null)
          .map((value) => value.toPrecision(12)),
      );
      if (actionSignatures.size > 1) {
        diagnostics.push(
          `${revision.revisionKey}/${policyKind}: 評価視点ごとに別の方針が保存されている`,
        );
      }
      if (selectionObjectives.size > 1) {
        diagnostics.push(
          `${revision.revisionKey}/${policyKind}: 方針の選択目的が視点間で一致しない`,
        );
      }
      if (goalProbabilities.size > 1 || planProbabilities.size > 1) {
        diagnostics.push(
          `${revision.revisionKey}/${policyKind}: 同じ方針なのに到達見込みが評価視点で異なる`,
        );
      }
    }
  }
  if (currentRevision) {
    const optimizedSelectedActions = new Set(
      policyEvaluations
        .filter(
          (evaluation) =>
            evaluation.revisionId === currentRevision.revisionId &&
            evaluation.policyKind === "optimized",
        )
        .flatMap((evaluation) => Object.values(evaluation.selectedActionByState)),
    );
    for (const action of states.flatMap((state) => state.actions)) {
      const views = actionEvaluations.filter(
        (evaluation) => evaluation.actionId === action.actionId,
      );
      if (
        views.some((evaluation) =>
          ["computed", "partial"].includes(evaluation.evaluationStatus),
        ) &&
        views.length !== BZM21_OBJECTIVE_KINDS.length
      ) {
        diagnostics.push(`候補行動の3視点評価が揃っていない: ${action.actionKey}`);
      }
      const selectionObjectives = new Set(
        views.map((evaluation) => evaluation.selectionObjective ?? "null"),
      );
      const selectedFlags = new Set(views.map((evaluation) => evaluation.isSelected));
      const goalProbabilities = new Set(
        views
          .map((evaluation) => evaluation.goalProbability)
          .filter((value): value is number => value !== null)
          .map((value) => value.toPrecision(12)),
      );
      const planProbabilities = new Set(
        views
          .map((evaluation) => evaluation.planDeadlineGoalProbability)
          .filter((value): value is number => value !== null)
          .map((value) => value.toPrecision(12)),
      );
      if (
        selectionObjectives.size > 1 ||
        selectedFlags.size > 1 ||
        goalProbabilities.size > 1 ||
        planProbabilities.size > 1
      ) {
        diagnostics.push(`候補行動の方針・到達見込みが3視点で不一致: ${action.actionKey}`);
      }
      if (
        views.length > 0 &&
        views[0].isSelected !== optimizedSelectedActions.has(action.actionId)
      ) {
        diagnostics.push(`候補行動の選択フラグとoptimized方針が不一致: ${action.actionKey}`);
      }
    }
  }

  const policyViews: Bzm21PolicyView[] = BZM21_OBJECTIVE_KINDS.flatMap(
    (objectiveKind) =>
      BZM21_POLICY_KINDS.map((policyKind) => {
        const history = policyEvaluations.filter(
          (evaluation) =>
            evaluation.objectiveKind === objectiveKind &&
            evaluation.policyKind === policyKind,
        );
        const current = currentRevision
          ? history.find(
              (evaluation) => evaluation.revisionId === currentRevision.revisionId,
            ) ?? null
          : null;
        return { objectiveKind, policyKind, current, history };
      }),
  );

  const revisionInputs = currentRevision
    ? inputByScope.get(`${currentRevision.revisionId}:revision:revision`) ?? []
    : [];
  const currentActionEvaluations = currentRevision
    ? actionEvaluations.filter((evaluation) => {
        const revisionId = rawActionRevisionById.get(evaluation.actionId);
        return revisionId === currentRevision.revisionId;
      })
    : [];
  const hasCurrentPersistedCalculation =
    policyEvaluations.some(
      (evaluation) =>
        evaluation.revisionId === currentRevision?.revisionId &&
        (["computed", "partial"].includes(evaluation.evaluationStatus) ||
          evaluation.goalProbability !== null ||
          evaluation.inputHash !== null),
    ) ||
    currentActionEvaluations.some(
      (evaluation) =>
        ["computed", "partial"].includes(evaluation.evaluationStatus) ||
        evaluation.goalProbability !== null ||
        evaluation.inputHash !== null,
    );
  if (currentRevision && hasCurrentPersistedCalculation) {
    const currentPolicyEvaluations = policyEvaluations.filter(
      (evaluation) => evaluation.revisionId === currentRevision.revisionId,
    );
    const runCutoffs = new Set([
      ...currentPolicyEvaluations.map((evaluation) => evaluation.informationCutoff),
      ...currentActionEvaluations.map((evaluation) => evaluation.informationCutoff),
    ]);
    const runInputHashes = new Set(
      [
        ...currentPolicyEvaluations.map((evaluation) => evaluation.inputHash),
        ...currentActionEvaluations.map((evaluation) => evaluation.inputHash),
      ].filter((value): value is string => Boolean(value)),
    );
    const runEngineVersions = new Set(
      [
        ...currentPolicyEvaluations.map((evaluation) => evaluation.engineVersion),
        ...currentActionEvaluations.map((evaluation) => evaluation.engineVersion),
      ].filter((value): value is string => Boolean(value)),
    );
    if (
      runCutoffs.size > 1 ||
      runInputHashes.size > 1 ||
      runEngineVersions.size > 1
    ) {
      diagnostics.push("保存済み方針・候補行動評価が同じrun/hash/締切に揃っていない");
    }
    if (
      !args.expectedInputHash ||
      runInputHashes.size !== 1 ||
      !runInputHashes.has(args.expectedInputHash)
    ) {
      diagnostics.push("保存済み評価のinput hashがcurrent canonical入力と不一致");
    }
    const taxBases = readTaxBasisByObjective(
      currentRevision.valuationRuleByObjective,
    );
    if (!taxBases) {
      diagnostics.push("保存済み評価の3視点価値規則に税基準がない");
    }
    for (const event of cashflowEvents) {
      if (
        event.nominalOrReal !== "nominal" &&
        event.valueStatus !== "not_applicable"
      ) {
        diagnostics.push(`保存済み評価が実質額を名目額として使用: ${event.eventKey}`);
      }
      if (!taxBases) continue;
      for (const objective of BZM21_OBJECTIVE_KINDS) {
        const rawAttribution = event.perspectiveAttribution[objective];
        if (!isRecord(rawAttribution) || rawAttribution.included !== true) continue;
        const compatibleTreatments =
          taxBases[objective] === "pre_tax_plus_explicit_tax_payments"
            ? ["pre_tax", "tax_payment", "tax_exempt", "not_applicable"]
            : taxBases[objective] === "post_tax_inclusive"
              ? ["post_tax", "tax_exempt", "not_applicable"]
              : ["tax_exempt", "not_applicable"];
        if (!compatibleTreatments.includes(event.taxTreatment)) {
          diagnostics.push(
            `保存済み評価の税基準とCF税区分が不一致: ${event.eventKey}/${objective}`,
          );
        }
      }
    }
    for (const state of states) {
      for (const action of state.actions) {
        const derivedImmediateCost = sumCashflowCacheCategory(
          cashflowEvents,
          action.cashflowEventKeys,
          "immediate_cost",
        );
        const derivedImmediateBenefit = sumCashflowCacheCategory(
          cashflowEvents,
          action.cashflowEventKeys,
          "immediate_benefit",
        );
        if (
          !objectiveCacheMatches(
            action.immediateCostByObjective,
            derivedImmediateCost,
          ) ||
          !objectiveCacheMatches(
            action.immediateBenefitByObjective,
            derivedImmediateBenefit,
          )
        ) {
          diagnostics.push(`行動のCF派生値cacheが正本と不一致: ${action.actionKey}`);
        }
        for (const transition of action.transitions) {
          const cachePairs: Array<[
            JsonObject,
            Bzm21CashflowIncludedIn,
            string,
          ]> = [
            [
              transition.transitionCashFlowByObjective,
              "transition_cash_flow",
              "遷移CF",
            ],
            [transition.terminalValueByObjective, "terminal_value", "終端価値"],
            [transition.failureLossByObjective, "failure_loss", "失敗損失"],
          ];
          for (const [cache, category, label] of cachePairs) {
            const derived = sumCashflowCacheCategory(
              cashflowEvents,
              transition.cashflowEventKeys,
              category,
            );
            if (!objectiveCacheMatches(cache, derived)) {
              diagnostics.push(
                `遷移の${label}派生値cacheが正本と不一致: ${transition.transitionKey}`,
              );
            }
          }
        }
      }
    }
    const requiredInputByKey = new Map(
      revisionInputs.map((input) => [input.parameterKey, input]),
    );
    for (const parameterKey of BZM21_REQUIRED_REVISION_INPUT_KEYS) {
      const input = requiredInputByKey.get(parameterKey);
      if (!input) {
        diagnostics.push(`${parameterKey}: 保存済み評価に必須入力行がない`);
        continue;
      }
      if (
        !["calculated", "observed", "conditional", "estimated"].includes(
          input.valueStatus,
        ) ||
        input.value === null ||
        input.evidenceKind === "none" ||
        !input.evidenceRef ||
        (input.valueStatus === "conditional" &&
          Object.keys(input.condition).length === 0)
      ) {
        diagnostics.push(`${parameterKey}: 保存済み評価の必須入力または根拠が未完了`);
      }
    }

    const initialState = states.find(
      (state) => state.stateKey === currentRevision.initialStateKey,
    );
    const decisionCriteria = currentRevision.decisionCriterionByObjective;
    const nearTieValues = isRecord(decisionCriteria)
      ? BZM21_OBJECTIVE_KINDS.map((objective) => {
          const rule = decisionCriteria[objective];
          return isRecord(rule) ? rule.nearTieToleranceMillionJpy ?? null : null;
        })
      : [];
    const commonNearTie =
      nearTieValues.length === 3 &&
      nearTieValues.every((value) => stableJson(value) === stableJson(nearTieValues[0]))
        ? nearTieValues[0]
        : isRecord(decisionCriteria)
          ? Object.fromEntries(
              BZM21_OBJECTIVE_KINDS.map((objective, index) => [
                objective,
                nearTieValues[index],
              ]),
            )
          : null;
    const expectedInputValues: Partial<
      Record<(typeof BZM21_REQUIRED_REVISION_INPUT_KEYS)[number], unknown>
    > = {
      valuation_date: currentRevision.valuationDate,
      initial_state: currentRevision.initialStateKey,
      plan_deadline: currentRevision.planDeadlineMonths,
      evaluation_horizon: currentRevision.evaluationHorizonMonths,
      reachability_history: initialState?.reachabilityHistory,
      decision_controller: initialState?.decisionController,
      controller_objective: initialState?.decisionController.objective,
      baseline_policy: currentRevision.baselinePolicy,
      policy_definition_ref: currentRevision.policyDefinitionRef,
      discount_rate_company: currentRevision.discountRateByObjective?.company,
      discount_rate_bzsf: currentRevision.discountRateByObjective?.bzsf,
      discount_rate_public: currentRevision.discountRateByObjective?.public,
      valuation_rule_company: currentRevision.valuationRuleByObjective?.company,
      valuation_rule_bzsf: currentRevision.valuationRuleByObjective?.bzsf,
      valuation_rule_public: currentRevision.valuationRuleByObjective?.public,
      decision_criterion_company:
        currentRevision.decisionCriterionByObjective?.company,
      decision_criterion_bzsf:
        currentRevision.decisionCriterionByObjective?.bzsf,
      decision_criterion_public:
        currentRevision.decisionCriterionByObjective?.public,
      near_tie_tolerance: commonNearTie,
      tie_break_rule: currentRevision.tieBreakRule,
      uncertainty_rule: currentRevision.uncertaintyRule,
      public_fiscal_rule: currentRevision.publicFiscalRuleRef,
      public_social_mandate: currentRevision.publicSocialMandateRef,
      public_social_conversion: currentRevision.publicSocialConversionRuleRef,
      public_aggregation: currentRevision.publicAggregationRuleRef,
    };
    for (const [parameterKey, expectedValue] of Object.entries(
      expectedInputValues,
    )) {
      const input = requiredInputByKey.get(parameterKey);
      if (
        input &&
        expectedValue !== undefined &&
        stableJson(input.value) !== stableJson(expectedValue)
      ) {
        diagnostics.push(`${parameterKey}: 入力台帳と版キャッシュが不一致`);
      }
    }
    for (const parameterKey of [
      "action_coverage",
      "single_cashflow_ledger",
    ] as const) {
      const input = requiredInputByKey.get(parameterKey);
      const status = isRecord(input?.value) ? input.value.status : input?.value;
      if (status !== "complete") {
        diagnostics.push(`${parameterKey}: 保存済み評価に必要な被覆完了がない`);
      }
    }
  }
  const requestedState = args.storageState ?? "ready";
  const storageState =
    requestedState === "unavailable"
      ? "unavailable"
      : diagnostics.length > 0
        ? "invalid"
        : "ready";
  const suppressEvaluations = storageState !== "ready";
  const safeStates = suppressEvaluations
    ? states.map((state) => ({
        ...state,
        actions: state.actions.map((action) => ({
          ...action,
          evaluations: [],
        })),
      }))
    : states;
  const safePolicyViews = suppressEvaluations
    ? policyViews.map((view) => ({ ...view, current: null }))
    : policyViews;

  return {
    projectId: args.projectId,
    storageState,
    storageMessage:
      args.storageMessage ??
      (storageState === "invalid"
        ? currentRevision?.dataMode === "synthetic"
          ? "合成テスト版は実PJ値ではないため、方針・行動の評価数値を表示していない。"
          : "BZM 2.1台帳に構造不整合があるため、方針・行動の評価数値を停止して再計算を待っている。"
        : null),
    currentRevision,
    revisions,
    revisionInputs,
    inputHistory: inputs,
    states: safeStates,
    interventions,
    cashflowEvents,
    cashflowEventHistory,
    policyViews: safePolicyViews,
    diagnostics,
  };
}
