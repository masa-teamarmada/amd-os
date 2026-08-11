import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BZM21_ACTION_TYPES,
  BZM21_CASHFLOW_INCLUDED_IN_KINDS,
  BZM21_OBJECTIVE_KINDS,
  BZM21_POLICY_KINDS,
  BZM21_REQUIRED_REVISION_INPUT_KEYS,
  buildBzm21PolicyModelLedger,
  type Bzm21ActionEvaluationRow,
  type Bzm21ActionRow,
  type Bzm21CashflowEventRow,
  type Bzm21DecisionStateRow,
  type Bzm21InputObservationRow,
  type Bzm21InterventionRow,
  type Bzm21ModelRevisionRow,
  type Bzm21PolicyEvaluationRow,
  type Bzm21TransitionRow,
} from "../src/lib/bzm-2-1-policy-model.ts";
import {
  buildBzm21DynamicPolicyModelFromLedger,
  computeBzm21PolicyLedgerInputHash,
  computeBzm21PublicAggregationInputHash,
  mapBzm21CashflowEventToEngine,
  serializeBzm21DynamicPolicyRun,
} from "../src/lib/bzm-2-1-policy-engine-adapter.ts";
import type {
  Bzm21ActionEvaluation as EngineActionEvaluation,
  Bzm21DynamicPolicyEvaluation,
  Bzm21PolicyEvaluation as EnginePolicyEvaluation,
} from "../src/lib/bzm-2-1-dynamic-policy.ts";

const TARGET_PROJECTS = [
  "p03", "p04", "p06", "p07", "p09", "p11",
  "p18", "p20", "p21", "p24", "p26", "p29",
] as const;

const migrationSql = readFileSync(
  new URL("./migrations/260_bzm_2_1_dynamic_policy_model.sql", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts?: Record<string, string> };
const apiRouteSource = readFileSync(
  new URL("../src/app/api/project/[projectId]/amd-score-detail/route.ts", import.meta.url),
  "utf8",
);
const scoreDetailSource = readFileSync(
  new URL("../src/components/cockpit/CockpitAmdScoreDetailTab.tsx", import.meta.url),
  "utf8",
);
const observatorySource = readFileSync(
  new URL("../src/components/cockpit/Bzm21DynamicPolicyObservatory.tsx", import.meta.url),
  "utf8",
);
const engineAdapterSource = readFileSync(
  new URL("../src/lib/bzm-2-1-policy-engine-adapter.ts", import.meta.url),
  "utf8",
);

function revision(
  overrides: Partial<Bzm21ModelRevisionRow> &
    Pick<Bzm21ModelRevisionRow, "revision_id" | "revision_key" | "revision_order">,
): Bzm21ModelRevisionRow {
  return {
    project_id: "p21",
    theory_version: "theory-open v2.1",
    model_version: "bzm-2.1-dynamic-policy-v0.1",
    data_mode: "project",
    currency: "JPY",
    valuation_date: null,
    initial_state_key: null,
    plan_deadline_months: null,
    evaluation_horizon_months: null,
    discount_rate_by_objective_json: null,
    valuation_rule_by_objective_json: null,
    decision_criterion_by_objective_json: null,
    tie_break_rule_json: null,
    uncertainty_rule_json: null,
    public_fiscal_rule_ref: null,
    public_social_mandate_ref: null,
    public_social_conversion_rule_ref: null,
    public_aggregation_rule_ref: null,
    baseline_policy_id: null,
    baseline_policy_json: null,
    policy_definition_ref: null,
    measurement_status: "incomplete",
    information_cutoff: "2026-08-11T00:00:00Z",
    forward_validation_count: 0,
    revision_reason: "test",
    source_ref: "test",
    created_at: "2026-08-11T00:00:00Z",
    ...overrides,
  };
}

const revisionRows = [
  revision({
    revision_id: "r1",
    revision_key: "bzm21-v0.1",
    revision_order: 1,
    information_cutoff: "2026-08-10T00:00:00Z",
    created_at: "2026-08-10T00:00:00Z",
  }),
  revision({
    revision_id: "r2",
    revision_key: "bzm21-v0.2",
    revision_order: 2,
    valuation_date: "2026-08-11",
    initial_state_key: "start",
    plan_deadline_months: 24,
    evaluation_horizon_months: 60,
    discount_rate_by_objective_json: {
      company: 0.01,
      bzsf: 0.015,
      public: 0.005,
    },
    valuation_rule_by_objective_json: {
      company: { rule_id: "company-pj-npv", taxBasis: "post_tax_inclusive" },
      bzsf: { rule_id: "fund-cashflow", taxBasis: "post_tax_inclusive" },
      public: { rule_id: "fiscal-social-preregistered", taxBasis: "post_tax_inclusive" },
    },
    decision_criterion_by_objective_json: {
      company: { criterion: "max_expected_net_value" },
      bzsf: { criterion: "max_expected_net_value" },
      public: { criterion: "max_expected_net_value" },
    },
    uncertainty_rule_json: { rule: "decision_indeterminate_on_rank_reversal" },
    public_fiscal_rule_ref: "fiscal-ref",
    public_social_mandate_ref: "mandate-ref",
    public_social_conversion_rule_ref: "conversion-ref",
    public_aggregation_rule_ref: "aggregation-ref",
    baseline_policy_id: "plan-v1",
    baseline_policy_json: { start: "continue-and-finance" },
    policy_definition_ref: "plan.pdf",
    measurement_status: "evaluated_hypothesis",
  }),
];

function state(
  overrides: Partial<Bzm21DecisionStateRow> &
    Pick<Bzm21DecisionStateRow, "state_id" | "revision_id" | "state_key">,
): Bzm21DecisionStateRow {
  return {
    label: overrides.state_key,
    decision_order: 1,
    is_initial: false,
    elapsed_months: null,
    current_state_json: {},
    beliefs_json: [],
    reachability_history_json: {
      goal: {
        status: "not_reached",
        firstReachedAtMonths: null,
        evidence: {
          kind: "document",
          ref: "goal-test.pdf",
          informationCutoff: "2026-08-11T00:00:00Z",
        },
      },
      strategicSlack: {
        status: "available",
        firstLostAtMonths: null,
        evidence: {
          kind: "record",
          ref: "cash-test.csv",
          informationCutoff: "2026-08-11T00:00:00Z",
        },
      },
    },
    decision_controller_json: {
      controllerId: "board",
      kind: "company",
      objective: "company",
      evidence: {
        kind: "document",
        ref: "governance.pdf",
        informationCutoff: "2026-08-11T00:00:00Z",
      },
    },
    sunk_cost_million_jpy: null,
    remaining_cost_million_jpy: null,
    remaining_time_months: null,
    available_information_json: [],
    evidence_json: {
      kind: "document",
      ref: "plan.pdf",
      informationCutoff: "2026-08-11T00:00:00Z",
    },
    created_at: "2026-08-11T00:00:00Z",
    ...overrides,
  };
}

const stateRows = [
  state({ state_id: "s-old", revision_id: "r1", state_key: "start", is_initial: true }),
  state({
    state_id: "s1",
    revision_id: "r2",
    state_key: "start",
    is_initial: true,
    elapsed_months: 0,
    remaining_cost_million_jpy: null,
    remaining_time_months: null,
  }),
  state({
    state_id: "s2",
    revision_id: "r2",
    state_key: "offer-received",
    decision_order: 2,
    elapsed_months: 3,
  }),
];

const actionRows: Bzm21ActionRow[] = [
  {
    action_id: "a1",
    state_id: "s1",
    action_key: "continue-and-finance",
    bundle_id: "bundle-continue-finance",
    action_type: "continue",
    component_types: ["continue"],
    custom_components: ["seek_financing"],
    sequence_json: ["continue", "seek_financing"],
    shared_resources_json: [{ resource_id: "cash", amount: null, unit: "million JPY" }],
    label: "開発続行と資金調達",
    action_order: 1,
    availability_status: "available",
    availability_reason: null,
    feasibility_gate_json: { status: "confirmed" },
    authority_gate_json: { status: "confirmed" },
    consents_json: [{ consent_id: "board", status: "confirmed" }],
    financing_feasibility_json: { status: "unknown" },
    duration_months: 3,
    immediate_cost_by_objective_json: { company: 20, bzsf: 0, public: 0 },
    immediate_benefit_by_objective_json: { company: 0, bzsf: 0, public: 0 },
    required_funding_million_jpy: null,
    cashflow_event_keys: ["development-payment"],
    information_gain_json: ["investor offer"],
    evidence_json: {
      kind: "document",
      ref: "plan.pdf",
      informationCutoff: "2026-08-11T00:00:00Z",
    },
    created_at: "2026-08-11T00:00:00Z",
  },
  {
    action_id: "a2",
    state_id: "s1",
    action_key: "license-negotiation",
    bundle_id: "bundle-license-negotiation",
    action_type: "license",
    component_types: ["license"],
    custom_components: ["open_negotiation"],
    sequence_json: ["open_negotiation"],
    shared_resources_json: [],
    label: "ライセンス交渉開始",
    action_order: 2,
    availability_status: "unknown",
    availability_reason: "相手方と権利条件が未確認",
    feasibility_gate_json: { status: "unknown" },
    authority_gate_json: { status: "unknown" },
    consents_json: [{ consent_id: "university", status: "unknown" }],
    financing_feasibility_json: { status: "not_required" },
    duration_months: null,
    immediate_cost_by_objective_json: { company: null, bzsf: null, public: null },
    immediate_benefit_by_objective_json: { company: null, bzsf: null, public: null },
    required_funding_million_jpy: null,
    cashflow_event_keys: [],
    information_gain_json: [],
    evidence_json: {
      kind: "record",
      ref: "diligence-open",
      informationCutoff: "2026-08-11T00:00:00Z",
    },
    created_at: "2026-08-11T00:00:00Z",
  },
];

const transitionRows: Bzm21TransitionRow[] = [
  {
    transition_id: "t1",
    action_id: "a1",
    transition_key: "offer-arrives",
    label: "条件提示を受ける",
    next_state_id: "s2",
    terminal_outcome: null,
    probability: 0.6,
    goal_reached_at_months: null,
    slack_lost_at_months: null,
    transition_cash_flow_by_objective_json: { company: 0, bzsf: 0, public: 0 },
    terminal_value_by_objective_json: { company: 0, bzsf: 0, public: 0 },
    failure_loss_by_objective_json: { company: 0, bzsf: 0, public: 0 },
    cashflow_event_keys: [],
    evidence_json: {
      kind: "calculation",
      ref: "transition-model-v1",
      informationCutoff: "2026-08-11T00:00:00Z",
    },
    transition_order: 1,
    created_at: "2026-08-11T00:00:00Z",
  },
  {
    transition_id: "t2",
    action_id: "a1",
    transition_key: "slack-lost",
    label: "余力を失う",
    next_state_id: null,
    terminal_outcome: "failed",
    probability: 0.4,
    goal_reached_at_months: null,
    slack_lost_at_months: 3,
    transition_cash_flow_by_objective_json: { company: 0, bzsf: 0, public: 0 },
    terminal_value_by_objective_json: { company: 0, bzsf: 0, public: 0 },
    failure_loss_by_objective_json: { company: 20, bzsf: 0, public: 0 },
    cashflow_event_keys: ["slack-loss-closure"],
    evidence_json: {
      kind: "calculation",
      ref: "transition-model-v1",
      informationCutoff: "2026-08-11T00:00:00Z",
    },
    transition_order: 2,
    created_at: "2026-08-11T00:00:00Z",
  },
];

const interventionRows: Bzm21InterventionRow[] = [
  {
    intervention_id: "z1",
    revision_id: "r2",
    intervention_key: "matching-grant",
    label: "費用補助",
    enabled: false,
    effects_json: [{ state_id: "s1", action_id: "a1", immediate_cost_delta: -5 }],
    evidence_json: {
      kind: "document",
      ref: "support-rule.pdf",
      informationCutoff: "2026-08-11T00:00:00Z",
    },
    created_at: "2026-08-11T00:00:00Z",
  },
];

const cashflowEventRows: Bzm21CashflowEventRow[] = [
  {
    cashflow_event_id: "cf-row-1",
    revision_id: "r2",
    state_id: "s1",
    action_id: "a1",
    transition_id: null,
    event_key: "development-payment",
    economic_nature: "operating",
    economic_event_group_key: null,
    perspective_leg: null,
    label: "開発委託費の支払",
    owner_kind: "supplier",
    owner_ref: "supplier-a",
    counterparty_kind: "company",
    counterparty_ref: "company-p21",
    scope_kind: "action",
    scope_key: "start/continue-and-finance",
    timing_kind: "action_start",
    timing_months: 0,
    amount: 20_000_000,
    currency: "JPY",
    model_amount_million_jpy: 20,
    conversion_rule_ref: null,
    conversion_rate_to_jpy: null,
    conversion_rate_date: null,
    conversion_rate_source_ref: null,
    value_status: "observed",
    nominal_or_real: "nominal",
    price_base_date: null,
    tax_treatment: "post_tax",
    tax_subject_ref: "company-p21",
    evidence_kind: "document",
    evidence_ref: "contract.pdf",
    information_cutoff: "2026-08-11T00:00:00Z",
    included_in: "immediate_cost",
    perspective_attribution_json: {
      company: { included: true, sign: -1, attribution: "pj_operating_cf" },
      bzsf: { included: false, sign: null, attribution: "not_fund_cashflow" },
      public: { included: false, sign: null, attribution: "not_public_cashflow" },
    },
    public_aggregation_status: "not_applicable",
    public_fiscal_amount_million_jpy: null,
    public_social_benefit_vector_json: [],
    public_social_converted_amount_million_jpy: null,
    public_aggregated_amount_million_jpy: null,
    public_aggregation_input_hash: null,
    public_transfer_treatment: "not_applicable",
    public_transfer_deduplication_ref: null,
    semantic_duplicate_review_ref: null,
    condition_json: {},
    note: null,
    created_at: "2026-08-11T00:00:00Z",
  },
  {
    cashflow_event_id: "cf-row-2",
    revision_id: "r2",
    state_id: "s1",
    action_id: "a1",
    transition_id: "t2",
    event_key: "slack-loss-closure",
    economic_nature: "operating",
    economic_event_group_key: null,
    perspective_leg: null,
    label: "余力喪失時の閉鎖損失",
    owner_kind: "supplier",
    owner_ref: "closure-vendor",
    counterparty_kind: "company",
    counterparty_ref: "company-p21",
    scope_kind: "transition",
    scope_key: "start/continue-and-finance/slack-lost",
    timing_kind: "action_end",
    timing_months: 3,
    amount: 20_000_000,
    currency: "JPY",
    model_amount_million_jpy: 20,
    conversion_rule_ref: null,
    conversion_rate_to_jpy: null,
    conversion_rate_date: null,
    conversion_rate_source_ref: null,
    value_status: "observed",
    nominal_or_real: "nominal",
    price_base_date: null,
    tax_treatment: "post_tax",
    tax_subject_ref: "company-p21",
    evidence_kind: "document",
    evidence_ref: "closure-estimate.pdf",
    information_cutoff: "2026-08-11T00:00:00Z",
    included_in: "failure_loss",
    perspective_attribution_json: {
      company: { included: true, sign: -1, attribution: "failure_loss" },
      bzsf: { included: false, sign: null, attribution: "not_fund_cashflow" },
      public: { included: false, sign: null, attribution: "not_public_cashflow" },
    },
    public_aggregation_status: "not_applicable",
    public_fiscal_amount_million_jpy: null,
    public_social_benefit_vector_json: [],
    public_social_converted_amount_million_jpy: null,
    public_aggregated_amount_million_jpy: null,
    public_aggregation_input_hash: null,
    public_transfer_treatment: "not_applicable",
    public_transfer_deduplication_ref: null,
    semantic_duplicate_review_ref: null,
    condition_json: {},
    note: null,
    created_at: "2026-08-11T00:00:00Z",
  },
];

const inputRows: Bzm21InputObservationRow[] = [
  {
    observation_id: "i1",
    revision_id: "r2",
    scope_kind: "action",
    scope_key: "start/continue-and-finance",
    parameter_key: "required_funding",
    symbol: "F_req",
    label: "必要資金",
    value_json: null,
    display_value: "欠測（0ではない）",
    value_status: "missing",
    unit: "million JPY",
    evidence_kind: "none",
    evidence_ref: null,
    information_cutoff: "2026-08-11T00:00:00Z",
    condition_json: {},
    note: "推定しない",
    sort_order: 1,
    created_at: "2026-08-11T00:00:00Z",
  },
];

const actionEvaluationRows: Bzm21ActionEvaluationRow[] = [
  {
    action_evaluation_id: "ae1",
    action_id: "a1",
    objective_kind: "company",
    selection_objective: null,
    is_selected: false,
    exclusion_reason: null,
    evaluation_status: "not_computable",
    goal_probability: null,
    plan_deadline_goal_probability: null,
    conditional_goal_value: null,
    value_unit: null,
    expected_cumulative_funding_million_jpy: null,
    expected_failure_loss_million_jpy: null,
    expected_exit_value_million_jpy: null,
    expected_terminal_value_million_jpy: null,
    expected_cost_million_jpy: null,
    expected_benefit_million_jpy: null,
    expected_net_value: null,
    public_aggregation_status: "not_applicable",
    public_fiscal_value_million_jpy: null,
    public_social_components_json: [],
    public_social_monetized_value_million_jpy: null,
    public_aggregated_value_million_jpy: null,
    public_aggregation_input_hash: null,
    uncertainty_json: {},
    issues_json: [{ code: "missing_funding" }],
    missing_inputs: ["required_funding"],
    engine_version: null,
    input_hash: null,
    information_cutoff: "2026-08-11T00:00:00Z",
    created_at: "2026-08-11T00:00:00Z",
  },
];

function policyEvaluation(
  overrides: Partial<Bzm21PolicyEvaluationRow> &
    Pick<
      Bzm21PolicyEvaluationRow,
      "policy_evaluation_id" | "revision_id" | "objective_kind" | "policy_kind"
    >,
): Bzm21PolicyEvaluationRow {
  return {
    evaluation_status: "computed",
    action_coverage_status: "complete",
    selection_objective: overrides.policy_kind === "optimized" ? "company" : null,
    goal_probability: 0.4,
    plan_deadline_goal_probability: 0.3,
    conditional_goal_value: 250,
    expected_net_value: 100,
    value_difference_from_baseline:
      overrides.policy_kind === "optimized" ? 60 : 0,
    controller_option_value:
      overrides.policy_kind === "optimized" ? 60 : null,
    value_unit: "million JPY",
    expected_cumulative_funding_million_jpy: 20,
    expected_failure_loss_million_jpy: 5,
    expected_exit_value_million_jpy: 10,
    expected_terminal_value_million_jpy: 130,
    expected_cost_million_jpy: 30,
    expected_benefit_million_jpy: 0,
    public_aggregation_status:
      overrides.objective_kind === "public"
        ? "not_computable"
        : "not_applicable",
    public_fiscal_value_million_jpy: null,
    public_social_components_json: [],
    public_social_monetized_value_million_jpy: null,
    public_aggregated_value_million_jpy: null,
    public_aggregation_input_hash: null,
    controller_by_state_json: {
      s1: stateRows[1].decision_controller_json,
    },
    selected_action_by_state_json: { s1: "a1" },
    state_decisions_json: [],
    uncertainty_json: {},
    issues_json: [],
    missing_inputs: [],
    engine_version: "bzm-2.1-dynamic-policy-v0.1",
    input_hash: "0".repeat(64),
    information_cutoff: "2026-08-11T00:00:00Z",
    created_at: "2026-08-11T00:00:00Z",
    ...overrides,
  };
}

const policyEvaluationRows: Bzm21PolicyEvaluationRow[] = [
  policyEvaluation({
    policy_evaluation_id: "pe-old",
    revision_id: "r1",
    objective_kind: "company",
    policy_kind: "fixed_baseline",
    goal_probability: 0.2,
    plan_deadline_goal_probability: 0.1,
    expected_net_value: 40,
    information_cutoff: "2026-08-10T00:00:00Z",
    created_at: "2026-08-10T00:00:00Z",
  }),
  policyEvaluation({
    policy_evaluation_id: "pe-fixed",
    revision_id: "r2",
    objective_kind: "company",
    policy_kind: "fixed_baseline",
  }),
  policyEvaluation({
    policy_evaluation_id: "pe-opt",
    revision_id: "r2",
    objective_kind: "company",
    policy_kind: "optimized",
    goal_probability: 0.7,
    plan_deadline_goal_probability: 0.6,
    expected_net_value: 160,
  }),
  policyEvaluation({
    policy_evaluation_id: "pe-bzsf",
    revision_id: "r2",
    objective_kind: "bzsf",
    policy_kind: "fixed_baseline",
    evaluation_status: "not_computable",
    action_coverage_status: "unknown",
    goal_probability: null,
    plan_deadline_goal_probability: null,
    conditional_goal_value: null,
    expected_net_value: null,
    value_difference_from_baseline: null,
    controller_option_value: null,
    value_unit: null,
    expected_cumulative_funding_million_jpy: null,
    expected_failure_loss_million_jpy: null,
    expected_exit_value_million_jpy: null,
    expected_terminal_value_million_jpy: null,
    expected_cost_million_jpy: null,
    expected_benefit_million_jpy: null,
    controller_by_state_json: {},
    selected_action_by_state_json: {},
    issues_json: [{ code: "missing_ownership_terms" }],
    missing_inputs: ["ownership_terms"],
    engine_version: null,
    input_hash: null,
  }),
  policyEvaluation({
    policy_evaluation_id: "pe-public-indeterminate",
    revision_id: "r2",
    objective_kind: "public",
    policy_kind: "optimized",
    evaluation_status: "decision_indeterminate",
    action_coverage_status: "complete",
    goal_probability: null,
    plan_deadline_goal_probability: null,
    conditional_goal_value: null,
    expected_net_value: null,
    value_difference_from_baseline: null,
    controller_option_value: null,
    value_unit: null,
    expected_cumulative_funding_million_jpy: null,
    expected_failure_loss_million_jpy: null,
    expected_exit_value_million_jpy: null,
    expected_terminal_value_million_jpy: null,
    expected_cost_million_jpy: null,
    expected_benefit_million_jpy: null,
    controller_by_state_json: {},
    selected_action_by_state_json: {},
    uncertainty_json: { rank_reversal: true },
    issues_json: [{ code: "rank_reversal_under_uncertainty" }],
    missing_inputs: [],
    engine_version: null,
    input_hash: null,
  }),
];

const ledger = buildBzm21PolicyModelLedger({
  projectId: "p21",
  revisionRows,
  stateRows,
  actionRows,
  transitionRows,
  interventionRows,
  cashflowEventRows,
  inputRows,
  actionEvaluationRows,
});

assert.equal(ledger.storageState, "ready");
assert.equal(ledger.currentRevision?.revisionId, "r2");
assert.equal(ledger.currentRevision?.evaluationHorizonMonths, 60);
assert.equal(ledger.currentRevision?.publicFiscalRuleRef, "fiscal-ref");
assert.equal(ledger.cashflowEvents.length, 2);
assert.equal(ledger.cashflowEvents[0]?.includedIn, "immediate_cost");
assert.equal(
  (ledger.states[0]?.reachabilityHistory.goal as { status?: string })?.status,
  "not_reached",
);
assert.equal(
  ledger.policyViews.find(
    (view) => view.objectiveKind === "company" && view.policyKind === "optimized",
  )?.current,
  null,
);
assert.equal(ledger.currentRevision?.publicSocialMandateRef, "mandate-ref");
assert.equal(ledger.currentRevision?.publicSocialConversionRuleRef, "conversion-ref");
assert.equal(ledger.currentRevision?.publicAggregationRuleRef, "aggregation-ref");
assert.equal(ledger.states.length, 2, "only the current revision graph is shown");
assert.equal(ledger.states[0].actions[0].customComponents[0], "seek_financing");
assert.equal(ledger.states[0].actions[1].availabilityStatus, "unknown");
assert.equal(ledger.states[0].actions[0].transitions[0].nextStateId, "s2");
assert.equal(ledger.states[0].actions[0].transitions[1].slackLostAtMonths, 3);
assert.equal(ledger.states[0].actions[0].evaluations[0].goalProbability, null);
assert.equal(ledger.states[0].actions[0].inputs[0].value, null);
assert.equal(ledger.interventions.length, 1);
assert.equal(ledger.policyViews.length, 6);

const mappedCostEvent = mapBzm21CashflowEventToEngine(ledger.cashflowEvents[0]);
assert.deepEqual(mappedCostEvent.diagnostics, []);
assert.equal(mappedCostEvent.event?.eventId, "cf-row-1");
assert.equal(mappedCostEvent.event?.timing, "action_start");
assert.deepEqual(mappedCostEvent.event?.objectiveAmountsMillionJpy, {
  company: 20,
  bzsf: 0,
  public: 0,
});
const wrongSignEvent = mapBzm21CashflowEventToEngine({
  ...ledger.cashflowEvents[0],
  perspectiveAttribution: {
    ...ledger.cashflowEvents[0].perspectiveAttribution,
    company: { included: true, sign: 1, attribution: "wrong_cost_sign" },
  },
});
assert.equal(wrongSignEvent.event, null);
assert.ok(
  wrongSignEvent.diagnostics.some((diagnostic) =>
    diagnostic.includes("符号と集計区分が不一致"),
  ),
);
const incompleteEngineInput = buildBzm21DynamicPolicyModelFromLedger(ledger);
assert.equal(incompleteEngineInput.status, "not_computable");
assert.equal(incompleteEngineInput.model, null);
assert.ok(
  incompleteEngineInput.diagnostics.some((diagnostic) =>
    diagnostic.includes("immediate_benefitの明示CF事象が欠測"),
  ),
);
const explicitNotApplicableEvent = mapBzm21CashflowEventToEngine({
  ...ledger.cashflowEvents[0],
  cashflowEventId: "cf-explicit-na",
  eventKey: "no-immediate-benefit",
  label: "即時便益なし",
  includedIn: "immediate_benefit",
  amount: null,
  modelAmountMillionJpy: null,
  valueStatus: "not_applicable",
  nominalOrReal: "not_applicable",
  taxTreatment: "not_applicable",
  perspectiveAttribution: {
    company: { included: false, sign: null, attribution: "not_applicable" },
    bzsf: { included: false, sign: null, attribution: "not_applicable" },
    public: { included: false, sign: null, attribution: "not_applicable" },
  },
  note: "この行動開始時に即時便益は発生しない",
});
assert.deepEqual(explicitNotApplicableEvent.diagnostics, []);
assert.deepEqual(explicitNotApplicableEvent.event?.objectiveAmountsMillionJpy, {
  company: 0,
  bzsf: 0,
  public: 0,
});

const engineController = {
  controllerId: "board",
  kind: "company" as const,
  objective: "company" as const,
  evidence: {
    kind: "document" as const,
    ref: "governance.pdf",
    informationCutoff: "2026-08-11T00:00:00Z",
  },
};
const actionMetric = (
  actionId: string,
  goalProbability: number,
  expectedNetValueMillionJpy: number,
): EngineActionEvaluation => ({
  actionId,
  actionKind: "continue",
  actionLabel: "開発続行と資金調達",
  expectedNetValueMillionJpy,
  goalProbability,
  planDeadlineGoalProbability: Math.max(0, goalProbability - 0.1),
  conditionalGoalValueMillionJpy: goalProbability > 0 ? 250 : null,
  expectedCumulativeFundingMillionJpy: 20,
  expectedFailureLossMillionJpy: 5,
  expectedExitValueMillionJpy: -2,
  expectedTerminalValueMillionJpy: 130,
  expectedCostMillionJpy: 30,
  expectedBenefitMillionJpy: 10,
});
const enginePolicy = (
  perspective: "company" | "bzsf" | "public",
  policyKind: "fixed_baseline" | "optimized",
  goalProbability: number,
  expectedNetValueMillionJpy: number,
): EnginePolicyEvaluation => {
  const metric = actionMetric("a1", goalProbability, expectedNetValueMillionJpy);
  return {
    policyKind,
    perspective,
    selectionObjective: policyKind === "optimized" ? "company" : null,
    expectedNetValueMillionJpy,
    goalProbability,
    planDeadlineGoalProbability: Math.max(0, goalProbability - 0.1),
    conditionalGoalValueMillionJpy: goalProbability > 0 ? 250 : null,
    expectedCumulativeFundingMillionJpy: 20,
    expectedFailureLossMillionJpy: 5,
    expectedExitValueMillionJpy: -2,
    expectedTerminalValueMillionJpy: 130,
    expectedCostMillionJpy: 30,
    expectedBenefitMillionJpy: 10,
    controllerByState: { s1: engineController },
    selectedActionByState: { s1: "a1" },
    stateDecisions: [
      {
        stateId: "s1",
        selectedActionId: "a1",
        actions: [metric],
        excludedActions: [{ actionId: "a2", reason: "契約条件が未確認" }],
      },
    ],
  };
};
const syntheticEngineEvaluation: Bzm21DynamicPolicyEvaluation = {
  status: "partial",
  modelId: "p21:bzm21-v0.2",
  modelVersion: "bzm-2.1-dynamic-policy-v0.1",
  informationCutoff: "2026-08-11T00:00:00Z",
  forwardValidationCount: 0,
  activeInterventionIds: [],
  issues: [],
  baselineReachability: {
    status: "computed",
    policyId: "plan-v1",
    goalProbability: 0.4,
    planDeadlineGoalProbability: 0.3,
  },
  perspectives: Object.fromEntries(
    BZM21_OBJECTIVE_KINDS.map((objective) => [
      objective,
      {
        status: "computed" as const,
        perspective: objective,
        baseline: enginePolicy(objective, "fixed_baseline", 0.4, 100),
        optimal: enginePolicy(objective, "optimized", 0.7, 160),
        valueDifferenceFromBaselineMillionJpy: 60,
        controllerOptionValueMillionJpy:
          objective === "company" ? 60 : null,
        goalProbabilityChange: 0.3,
        planDeadlineGoalProbabilityChange: 0.3,
      },
    ]),
  ) as Bzm21DynamicPolicyEvaluation["perspectives"],
};
const serializedProjectRun = serializeBzm21DynamicPolicyRun({
  ledger,
  evaluation: syntheticEngineEvaluation,
  engineVersion: "bzm-2.1-dynamic-policy-v0.1",
});
assert.equal(serializedProjectRun.policyEvaluations.length, 6);
assert.equal(serializedProjectRun.actionEvaluations.length, 6);
const publicOptimizedRow = serializedProjectRun.policyEvaluations.find(
  (row) => row.objective_kind === "public" && row.policy_kind === "optimized",
);
assert.equal(publicOptimizedRow?.evaluation_status, "not_computable");
assert.equal(publicOptimizedRow?.goal_probability, 0.7);
assert.deepEqual(publicOptimizedRow?.selected_action_by_state_json, { s1: "a1" });
assert.equal(publicOptimizedRow?.expected_net_value, null);
assert.deepEqual(publicOptimizedRow?.missing_inputs, [
  "public_path_decomposition_engine",
]);
const publicSelectedActionRow = serializedProjectRun.actionEvaluations.find(
  (row) => row.objective_kind === "public" && row.action_id === "a1",
);
assert.equal(publicSelectedActionRow?.evaluation_status, "not_computable");
assert.equal(publicSelectedActionRow?.goal_probability, 0.7);
assert.equal(publicSelectedActionRow?.is_selected, true);
assert.equal(publicSelectedActionRow?.expected_net_value, null);
assert.equal(
  new Set(
    serializedProjectRun.policyEvaluations.map((row) => row.input_hash),
  ).size,
  1,
);
assert.throws(
  () =>
    serializeBzm21DynamicPolicyRun({
      ledger,
      evaluation: syntheticEngineEvaluation,
      engineVersion: "bzm-2.1-dynamic-policy-v0.1",
      publicPolicyDecompositionByPolicy: {
        optimized: {
          status: "not_computable",
          fiscalValueMillionJpy: null,
          socialComponents: [],
          socialMonetizedValueMillionJpy: null,
          aggregatedValueMillionJpy: null,
          aggregationInputHash: null,
          issues: ["missing"],
        },
      },
    }),
  /実PJ版ではcaller suppliedな公的価値分解を保存できない/,
);

const additivePublicRevisionRows = revisionRows.map((row) =>
  row.revision_id === "r2"
    ? {
        ...row,
        public_aggregation_rule_ref:
          "bzm2.1:public=fiscal+social_converted:v0.1",
      }
    : row,
);
const additivePublicEventBase: Bzm21CashflowEventRow = {
  ...cashflowEventRows[1],
  cashflow_event_id: "cf-public-additive",
  event_key: "public-additive-value",
  label: "基金財政と社会便益の加算",
  amount: 60_000_000,
  model_amount_million_jpy: 60,
  included_in: "transition_cash_flow",
  perspective_attribution_json: {
    company: { included: false, sign: null, attribution: "not_company_cf" },
    bzsf: { included: false, sign: null, attribution: "not_bzsf_cf" },
    public: { included: true, sign: 1, attribution: "aggregated_public_value" },
  },
  public_aggregation_status: "complete",
  public_fiscal_amount_million_jpy: -20,
  public_social_benefit_vector_json: [
    {
      componentKey: "avoided-co2",
      label: "CO2削減便益",
      unit: "million JPY",
      quantity: 80,
      valueStatus: "calculated",
      conversionRuleRef: "conversion-ref",
      convertedAmountMillionJpy: 80,
      transferTreatment: "externality",
      evidence: {
        kind: "calculation",
        ref: "co2-conversion-v1",
        informationCutoff: "2026-08-11T00:00:00Z",
      },
      condition: {},
    },
  ],
  public_social_converted_amount_million_jpy: 80,
  public_aggregated_amount_million_jpy: 60,
  public_aggregation_input_hash: "0".repeat(64),
  public_transfer_treatment: "externality",
  public_transfer_deduplication_ref: "dedup:subsidy-vs-social-v1",
};
const additiveDraftLedger = buildBzm21PolicyModelLedger({
  projectId: "p21",
  revisionRows: additivePublicRevisionRows,
  stateRows,
  actionRows,
  transitionRows,
  cashflowEventRows: [additivePublicEventBase],
});
assert.ok(additiveDraftLedger.currentRevision);
assert.ok(additiveDraftLedger.cashflowEvents[0]);
const additivePublicHash = computeBzm21PublicAggregationInputHash(
  additiveDraftLedger.cashflowEvents[0],
  additiveDraftLedger.currentRevision!,
);
const additivePublicEventRow = {
  ...additivePublicEventBase,
  public_aggregation_input_hash: additivePublicHash,
};
const additivePublicLedger = buildBzm21PolicyModelLedger({
  projectId: "p21",
  revisionRows: additivePublicRevisionRows,
  stateRows,
  actionRows,
  transitionRows,
  cashflowEventRows: [additivePublicEventRow],
  expectedPublicAggregationHashes: {
    "cf-public-additive": additivePublicHash,
  },
});
assert.ok(
  additivePublicLedger.diagnostics.every(
    (diagnostic) => !diagnostic.includes("公的価値の分離集約cacheが不整合"),
  ),
  "a negative fiscal leg plus a larger positive social benefit must allow a positive aggregate",
);
const mappedAdditivePublicEvent = mapBzm21CashflowEventToEngine(
  additivePublicLedger.cashflowEvents[0],
);
assert.deepEqual(mappedAdditivePublicEvent.diagnostics, []);
assert.equal(
  mappedAdditivePublicEvent.event?.objectiveAmountsMillionJpy.public,
  60,
);
const badTimingLedger = buildBzm21PolicyModelLedger({
  projectId: "p21",
  revisionRows,
  stateRows,
  actionRows,
  transitionRows,
  interventionRows,
  cashflowEventRows: [
    { ...cashflowEventRows[0], timing_months: 1 },
    cashflowEventRows[1],
  ],
  inputRows,
});
const badTimingEngineInput = buildBzm21DynamicPolicyModelFromLedger(badTimingLedger);
assert.equal(badTimingEngineInput.status, "not_computable");
assert.ok(
  badTimingEngineInput.diagnostics.some((diagnostic) =>
    diagnostic.includes("即時CFの計上月が状態時点と不一致"),
  ),
);

const duplicateCashflowRows: Bzm21CashflowEventRow[] = [
  cashflowEventRows[0],
  {
    ...cashflowEventRows[0],
    cashflow_event_id: "cf-row-1-duplicate",
    event_key: "development-payment-duplicate",
  },
];
const duplicateCashflowLedger = buildBzm21PolicyModelLedger({
  projectId: "p21",
  revisionRows,
  stateRows,
  actionRows,
  transitionRows,
  cashflowEventRows: duplicateCashflowRows,
});
assert.equal(duplicateCashflowLedger.storageState, "invalid");
assert.ok(
  duplicateCashflowLedger.diagnostics.some((diagnostic) =>
    diagnostic.includes("意味的に同一のCF事象が重複"),
  ),
);
const reviewedDuplicateCashflowLedger = buildBzm21PolicyModelLedger({
  projectId: "p21",
  revisionRows,
  stateRows,
  actionRows,
  transitionRows,
  cashflowEventRows: duplicateCashflowRows.map((row) => ({
    ...row,
    semantic_duplicate_review_ref: "review:duplicate-development-payment-v1",
  })),
});
assert.ok(
  reviewedDuplicateCashflowLedger.diagnostics.every(
    (diagnostic) => !diagnostic.includes("意味的に同一のCF事象が重複"),
  ),
);

const view = (objectiveKind: string, policyKind: string) =>
  ledger.policyViews.find(
    (candidate) =>
      candidate.objectiveKind === objectiveKind && candidate.policyKind === policyKind,
  );
assert.equal(view("company", "fixed_baseline")?.current, null);
assert.equal(view("company", "fixed_baseline")?.history.length, 0);
assert.equal(view("company", "optimized")?.current, null);
assert.equal(view("bzsf", "fixed_baseline")?.current, null);
assert.equal(view("public", "fixed_baseline")?.current, null);
assert.equal(view("public", "optimized")?.current, null);

const invalidTransitionLedger = buildBzm21PolicyModelLedger({
  projectId: "p21",
  revisionRows,
  stateRows,
  actionRows,
  transitionRows: [{ ...transitionRows[0], next_state_id: "s-old" }],
  cashflowEventRows: [cashflowEventRows[0]],
});
assert.equal(invalidTransitionLedger.storageState, "invalid");
assert.ok(
  invalidTransitionLedger.diagnostics.some((diagnostic) =>
    /遷移先が同じ版に存在しない/.test(diagnostic),
  ),
);

const invalidCashflowParentLedger = buildBzm21PolicyModelLedger({
  projectId: "p21",
  revisionRows,
  stateRows,
  actionRows,
  transitionRows,
  cashflowEventRows: [
    { ...cashflowEventRows[0], state_id: "s2" },
    cashflowEventRows[1],
  ],
});
assert.equal(invalidCashflowParentLedger.storageState, "invalid");
assert.ok(
  invalidCashflowParentLedger.diagnostics.some((diagnostic) =>
    diagnostic.includes("CF eventの親子または版が不一致"),
  ),
);

const computedWithoutCashflowLedger = buildBzm21PolicyModelLedger({
  projectId: "p21",
  revisionRows,
  policyEvaluationRows,
});
assert.equal(computedWithoutCashflowLedger.storageState, "invalid");
assert.ok(
  computedWithoutCashflowLedger.diagnostics.includes(
    "計算済み方針に単一CF event正本がない",
  ),
);

const fakeComputedWithSparseInputsLedger = buildBzm21PolicyModelLedger({
  projectId: "p21",
  revisionRows,
  stateRows,
  actionRows,
  transitionRows,
  interventionRows,
  cashflowEventRows,
  inputRows,
  actionEvaluationRows,
  policyEvaluationRows,
  expectedInputHash: computeBzm21PolicyLedgerInputHash(ledger),
});
assert.equal(fakeComputedWithSparseInputsLedger.storageState, "invalid");
assert.ok(
  fakeComputedWithSparseInputsLedger.diagnostics.some((diagnostic) =>
    diagnostic.includes("valuation_date: 保存済み評価に必須入力行がない"),
  ),
);
assert.ok(
  fakeComputedWithSparseInputsLedger.policyViews.every(
    (policyView) => policyView.current === null,
  ),
  "invalid saved runs must never expose stale q or value rows",
);
assert.ok(
  fakeComputedWithSparseInputsLedger.diagnostics.includes(
    "保存済み評価のinput hashがcurrent canonical入力と不一致",
  ),
);

const futureInputLedger = buildBzm21PolicyModelLedger({
  projectId: "p21",
  revisionRows,
  inputRows: [
    {
      ...inputRows[0],
      information_cutoff: "2026-08-12T00:00:00Z",
    },
  ],
});
assert.equal(futureInputLedger.storageState, "invalid");
assert.ok(
  futureInputLedger.diagnostics.some((diagnostic) =>
    diagnostic.includes("入力が版の情報締切を超えている"),
  ),
);

const projectSyntheticEvidenceLedger = buildBzm21PolicyModelLedger({
  projectId: "p21",
  revisionRows,
  stateRows,
  actionRows: actionRows.map((row, index) =>
    index === 0
      ? {
          ...row,
          evidence_json: {
            kind: "synthetic",
            ref: "fixture-only",
            informationCutoff: "2026-08-11T00:00:00Z",
          },
        }
      : row,
  ),
  transitionRows,
});
assert.equal(projectSyntheticEvidenceLedger.storageState, "invalid");
assert.ok(
  projectSyntheticEvidenceLedger.diagnostics.some((diagnostic) =>
    diagnostic.includes("実PJ版に合成根拠を使用"),
  ),
);

const impossiblePlanQRows = policyEvaluationRows.map((row) =>
  row.revision_id === "r2" && row.objective_kind === "company"
    ? {
        ...row,
        goal_probability: 0.2,
        plan_deadline_goal_probability: 0.9,
      }
    : row,
);
const impossiblePlanQLedger = buildBzm21PolicyModelLedger({
  projectId: "p21",
  revisionRows,
  policyEvaluationRows: impossiblePlanQRows,
});
assert.equal(impossiblePlanQLedger.storageState, "invalid");
assert.ok(
  impossiblePlanQLedger.diagnostics.some((diagnostic) =>
    diagnostic.includes("計画期限内qが経済期限内qを超えている"),
  ),
);

assert.match(migrationSql, /^BEGIN;$/m);
assert.match(migrationSql, /^COMMIT;$/m);
for (const table of [
  "bzm_2_1_model_revisions",
  "bzm_2_1_decision_states",
  "bzm_2_1_actions",
  "bzm_2_1_transitions",
  "bzm_2_1_interventions",
  "bzm_2_1_input_observations",
  "bzm_2_1_cashflow_events",
  "bzm_2_1_action_evaluations",
  "bzm_2_1_policy_evaluations",
]) {
  assert.match(migrationSql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
}
assert.doesNotMatch(
  migrationSql,
  /(?:INSERT INTO|UPDATE|DELETE FROM) public\.bzm_2_(?:model_revisions|parameter_observations)\b/,
);
assert.match(migrationSql, /availability_status IN \('available', 'unavailable', 'unknown'\)/);
assert.match(migrationSql, /component_types\s+text\[\]/);
assert.match(migrationSql, /custom_components\s+text\[\]/);
assert.match(migrationSql, /shared_resources_json\s+jsonb/);
assert.match(migrationSql, /feasibility_gate_json\s+jsonb/);
assert.match(migrationSql, /authority_gate_json\s+jsonb/);
assert.match(migrationSql, /consents_json\s+jsonb/);
assert.match(migrationSql, /financing_feasibility_json\s+jsonb/);
assert.match(migrationSql, /goal_reached_at_months\s+double precision/);
assert.match(migrationSql, /slack_lost_at_months\s+double precision/);
assert.match(migrationSql, /transition_cash_flow_by_objective_json\s+jsonb/);
assert.match(migrationSql, /reachability_history_json\s+jsonb/);
assert.match(migrationSql, /'not_reached', 'reached', 'unknown'/);
assert.match(migrationSql, /'available', 'lost', 'unknown'/);
assert.match(migrationSql, /evaluation_horizon_months\s+double precision/);
assert.match(migrationSql, /valuation_rule_by_objective_json\s+jsonb/);
assert.match(migrationSql, /decision_criterion_by_objective_json\s+jsonb/);
assert.match(migrationSql, /tie_break_rule_json\s+jsonb/);
assert.match(migrationSql, /uncertainty_rule_json\s+jsonb/);
for (const publicField of [
  "public_fiscal_rule_ref",
  "public_social_mandate_ref",
  "public_social_conversion_rule_ref",
  "public_aggregation_rule_ref",
]) {
  assert.match(migrationSql, new RegExp(`${publicField}\\s+text`));
}
assert.match(migrationSql, /objective_kind IN \('company', 'bzsf', 'public'\)/);
assert.match(migrationSql, /policy_kind IN \('fixed_baseline', 'optimized'\)/);
assert.match(migrationSql, /selection_objective\s+text/);
assert.match(migrationSql, /policy_kind = 'fixed_baseline' AND selection_objective IS NULL/);
assert.match(migrationSql, /'controllerId', 'kind', 'objective', 'evidence'/);
assert.match(migrationSql, /'decision_indeterminate'/);
assert.match(migrationSql, /'partial_action_set'/);
assert.match(migrationSql, /goal_probability\s+double precision/);
assert.match(migrationSql, /plan_deadline_goal_probability\s+double precision/);
assert.match(migrationSql, /expected_net_value\s+double precision/);
assert.match(migrationSql, /value_difference_from_baseline\s+double precision/);
assert.match(migrationSql, /controller_option_value\s+double precision/);
assert.doesNotMatch(migrationSql, /\bnet_option_value\b/);
assert.match(migrationSql, /cashflow_event_keys\s+text\[\]/);
assert.match(migrationSql, /state_id\s+uuid REFERENCES public\.bzm_2_1_decision_states/);
assert.match(migrationSql, /action_id\s+uuid REFERENCES public\.bzm_2_1_actions/);
assert.match(migrationSql, /transition_id\s+uuid REFERENCES public\.bzm_2_1_transitions/);
assert.match(migrationSql, /timing_kind IN \('action_start', 'action_end'\)/);
assert.match(migrationSql, /bzm_2_1_validate_transition_revision/);
assert.match(migrationSql, /transition must stay inside one revision/);
assert.match(migrationSql, /bzm_2_1_validate_cashflow_parent_chain/);
assert.match(migrationSql, /CF action must belong to the event state/);
assert.match(migrationSql, /UNIQUE \(revision_id, event_key\)/);
assert.match(migrationSql, /included_in\s+text NOT NULL/);
for (const includedIn of BZM21_CASHFLOW_INCLUDED_IN_KINDS) {
  assert.match(migrationSql, new RegExp(`'${includedIn}'`));
}
assert.match(
  migrationSql,
  /value_status NOT IN \('missing', 'not_started', 'not_applicable'\)[\s\S]*?amount IS NOT NULL[\s\S]*?model_amount_million_jpy IS NOT NULL/,
  "measured CF rows must not pass a PostgreSQL CHECK through NULL",
);
assert.match(migrationSql, /model_amount_million_jpy - amount::double precision \/ 1000000\.0/);
assert.match(migrationSql, /conversion_rate_to_jpy\s+numeric/);
assert.match(migrationSql, /conversion_rate_date\s+date/);
assert.match(migrationSql, /conversion_rate_source_ref\s+text/);
assert.match(migrationSql, /value_status IN \('missing', 'not_started'\)[\s\S]*?OR evidence_kind <> 'none'/);
assert.match(migrationSql, /->> 'sign' IN \('-1', '1'\)/);
assert.match(
  migrationSql,
  /included_in = 'immediate_benefit'[\s\S]*?->> 'sign' = '1'/,
);
assert.match(
  migrationSql,
  /included_in IN \('immediate_cost', 'failure_loss'\)[\s\S]*?->> 'sign' = '-1'/,
);
for (const actionType of BZM21_ACTION_TYPES) {
  assert.match(migrationSql, new RegExp(`'${actionType}'`));
}
assert.deepEqual(BZM21_OBJECTIVE_KINDS, ["company", "bzsf", "public"]);
assert.deepEqual(BZM21_POLICY_KINDS, ["fixed_baseline", "optimized"]);
assert.deepEqual(BZM21_CASHFLOW_INCLUDED_IN_KINDS, [
  "immediate_cost",
  "immediate_benefit",
  "transition_cash_flow",
  "terminal_value",
  "failure_loss",
  "funding_constraint_only",
  "sunk_cost_report_only",
  "excluded",
]);

const projectScope = migrationSql.match(
  /WHERE projects\.project_id IN \(([\s\S]*?)\)\s*ON CONFLICT/,
)?.[1];
assert.ok(projectScope);
assert.deepEqual(
  [...projectScope.matchAll(/'(p\d{2})'/g)].map((match) => match[1]),
  TARGET_PROJECTS,
);
assert.doesNotMatch(
  migrationSql.match(
    /INSERT INTO public\.bzm_2_1_model_revisions[\s\S]*?ON CONFLICT \(project_id, revision_key\) DO NOTHING/,
  )?.[0] ?? "",
  /(?:goal_probability|expected_net_value|value_difference_from_baseline|controller_option_value|INSERT INTO public\.bzm_2_1_policy_evaluations)/,
  "initial revisions must not seed fabricated evaluation numbers",
);
const requiredInputSeed = migrationSql.match(
  /WITH required_inputs\([\s\S]*?ON CONFLICT \(revision_id, scope_kind, scope_key, parameter_key\) DO NOTHING;/,
)?.[0];
assert.ok(requiredInputSeed);
assert.equal(
  [...requiredInputSeed.matchAll(/^\s*\('[a-z_]+',/gm)].length,
  27,
  "all 12 PJ revisions must expose the same 27 required inputs",
);
assert.match(requiredInputSeed, /NULL,\s*'未着手（0ではない）',\s*'not_started'/);
assert.match(requiredInputSeed, /'none',\s*NULL/);
assert.match(migrationSql, /'2026-08-11T22:00:00\+09:00'::timestamptz/);
assert.doesNotMatch(migrationSql, /2026-08-11T23:59:59\+09:00/);

assert.equal(
  packageJson.scripts?.["test:bzm-2-1-policy-model"],
  "node --experimental-strip-types scripts/test_bzm_2_1_policy_model.mts",
);
assert.equal(
  packageJson.scripts?.["test:bzm-2-1-dynamic-policy"],
  "node --experimental-strip-types scripts/test_bzm_2_1_dynamic_policy.mts",
);
assert.match(apiRouteSource, /fetchBzm21PolicyModelLedger\(projectId\)/);
assert.match(apiRouteSource, /\bbzm21,\s*\n/);
assert.match(scoreDetailSource, /bzm21:\s*Bzm21PolicyModelLedger/);
assert.match(
  scoreDetailSource,
  /<Bzm21DynamicPolicyObservatory model=\{state\.payload\.bzm21\} \/>/,
);
assert.match(observatorySource, /BZM21_OBJECTIVE_KINDS\.flatMap/);
assert.match(observatorySource, /\["fixed_baseline", "optimized"\]/);
assert.match(observatorySource, /value === null \|\| value === undefined\) return "未計算"/);
assert.match(observatorySource, /到達時条件付き正味値/);
assert.ok(
  observatorySource.includes(String.raw`E[V_r^{\mathrm{net},\pi}\mid G]`),
);
for (const derivedMetric of [
  "expectedCumulativeFundingMillionJpy",
  "expectedFailureLossMillionJpy",
  "expectedExitValueMillionJpy",
  "expectedTerminalValueMillionJpy",
  "expectedCostMillionJpy",
  "expectedBenefitMillionJpy",
]) {
  assert.match(observatorySource, new RegExp(derivedMetric));
}
assert.doesNotMatch(observatorySource, /text-\[8px\]/);
assert.match(engineAdapterSource, /mapBzm21CashflowEventToEngine/);
assert.match(engineAdapterSource, /serializeBzm21DynamicPolicyEvaluation/);
assert.match(engineAdapterSource, /valueDifferenceFromBaselineMillionJpy/);
assert.match(engineAdapterSource, /controllerOptionValueMillionJpy/);

console.log("BZM 2.1 policy persistence contract: OK");
