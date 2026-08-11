import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluateBzm21DynamicPolicyModel,
  type Bzm21DynamicPolicyModel,
} from "../src/lib/bzm-2-1-dynamic-policy.ts";
import {
  buildBzm21DynamicPolicyModelFromLedger,
  computeBzm21PolicyLedgerInputHash,
  serializeBzm21DynamicPolicyRun,
  type Bzm21ActionEvaluationInsert,
  type Bzm21PolicyEvaluationInsert,
} from "../src/lib/bzm-2-1-policy-engine-adapter.ts";
import {
  BZM21_REQUIRED_ACTION_INPUT_KEYS,
  BZM21_REQUIRED_REVISION_INPUT_KEYS,
  BZM21_REQUIRED_STATE_INPUT_KEYS,
  BZM21_REQUIRED_TRANSITION_INPUT_KEYS,
  buildBzm21PolicyModelLedger,
  bzm21RequiredActionInputValues,
  bzm21RequiredStateInputValues,
  bzm21RequiredTransitionInputValues,
  type Bzm21ActionRow,
  type Bzm21CashflowEventRow,
  type Bzm21DecisionStateRow,
  type Bzm21InputObservationRow,
  type Bzm21ModelRevisionRow,
  type Bzm21TransitionRow,
} from "../src/lib/bzm-2-1-policy-model.ts";

type JsonObject = Record<string, unknown>;
type ArtifactProject = {
  projectId: string;
  estimationRatio: number;
  sensitivity: {
    points: Array<{
      scenarioId: string;
      selectedActionId: string;
      expectedNetValueMillionJpy: number;
      goalProbability: number;
      [key: string]: unknown;
    }>;
    selectedActionSwitches: boolean;
    valueRangeMillionJpy: [number, number];
    note: string;
  };
  outputs: {
    selectedActionId: string;
    expectedFutureNetProjectValueMillionJpy: number;
    qSelectedPolicy: number;
  };
  model: Bzm21DynamicPolicyModel;
};
type Artifact = {
  contentHashSha256: string;
  estimatorVersion: string;
  informationCutoff: string;
  projects: ArtifactProject[];
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ARTIFACT = path.resolve(
  SCRIPT_DIR,
  "../bzm/pilot/sps-2-1-estimated-v0-1.json",
);
const DEFAULT_OUTPUT = path.resolve(
  SCRIPT_DIR,
  "migrations/263_sps_2_1_estimated_v0_1.sql",
);
const REVISION_KEY = "sps-2-1-estimated-v0-1";
const SNAPSHOT_KEY = "pre-sps-2-1-estimated-v0-1";
const CREATED_AT = "2026-08-11T14:59:59Z";
const ENGINE_VERSION = "bzm-2.1-dynamic-policy-v0.1";
const TARGET_PROJECTS = [
  "p03", "p04", "p06", "p07", "p09", "p11",
  "p18", "p20", "p21", "p24", "p26", "p29",
] as const;

function parseArgs(argv: string[]) {
  const result = { artifact: DEFAULT_ARTIFACT, output: DEFAULT_OUTPUT, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--artifact") result.artifact = argv[++index];
    else if (value === "--output") result.output = argv[++index];
    else if (value === "--check") result.check = true;
    else throw new Error(`unknown argument: ${value}`);
  }
  return result;
}

function deterministicUuid(key: string): string {
  const hex = createHash("sha256").update(key).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlNullableString(value: string | null | undefined): string {
  return value == null ? "NULL" : sqlString(value);
}

function sqlNumber(value: number | null | undefined): string {
  assert.ok(value == null || Number.isFinite(value), "non-finite SQL number");
  return value == null ? "NULL" : String(value);
}

function sqlBoolean(value: boolean): string {
  return value ? "TRUE" : "FALSE";
}

function sqlJson(value: unknown): string {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function sqlTextArray(values: string[]): string {
  return values.length === 0
    ? "ARRAY[]::text[]"
    : `ARRAY[${values.map(sqlString).join(", ")}]::text[]`;
}

function sqlInsert(table: string, columns: string[], rows: string[][]): string {
  assert.ok(rows.length > 0, `${table}: empty insert`);
  return `INSERT INTO public.${table} (\n  ${columns.join(", ")}\n) VALUES\n${rows
    .map((row) => `  (${row.join(", ")})`)
    .join(",\n")};`;
}

function displayValue(value: unknown): string {
  const rendered = typeof value === "string" ? value : stableJson(value);
  return rendered.length <= 800 ? rendered : `${rendered.slice(0, 797)}...`;
}

function inputRow(args: {
  revisionId: string;
  scopeKind: "revision" | "state" | "action" | "transition";
  scopeKey: string;
  parameterKey: string;
  value: unknown;
  sortOrder: number;
  projectId: string;
  valueStatus?: "estimated" | "calculated";
  evidenceRef?: string;
  condition?: JsonObject;
  note?: string;
}): Bzm21InputObservationRow {
  return {
    observation_id: deterministicUuid(
      `sps21:${args.projectId}:input:${args.scopeKind}:${args.scopeKey}:${args.parameterKey}`,
    ),
    revision_id: args.revisionId,
    scope_kind: args.scopeKind,
    scope_key: args.scopeKey,
    parameter_key: args.parameterKey,
    symbol: args.parameterKey,
    label: args.parameterKey,
    value_json: args.value,
    display_value: displayValue(args.value),
    value_status: args.valueStatus ?? "estimated",
    unit: null,
    evidence_kind: "calculation",
    evidence_ref: args.evidenceRef ?? "calculation:sps-2.1-low-precision-estimator-v0.1:canonical-seed",
    information_cutoff: CREATED_AT,
    condition_json: args.condition ?? {
      scenario: REVISION_KEY,
      allocationProhibited: true,
      forwardValidationCount: 0,
    },
    note: args.note ?? "生データ欠測を共通規則で補った暫定値。観測値ではなく資源配分に使用しない",
    sort_order: args.sortOrder,
    created_at: CREATED_AT,
  };
}

function revisionExpectedValues(
  revision: Bzm21ModelRevisionRow,
  initialState: Bzm21DecisionStateRow,
  actionCount: number,
  cashflowCount: number,
): Record<(typeof BZM21_REQUIRED_REVISION_INPUT_KEYS)[number], unknown> {
  const criteria = revision.decision_criterion_by_objective_json as JsonObject;
  const companyCriterion = criteria.company as JsonObject;
  const bzsfCriterion = criteria.bzsf as JsonObject;
  const publicCriterion = criteria.public as JsonObject;
  const tieValues = [
    companyCriterion.nearTieToleranceMillionJpy,
    bzsfCriterion.nearTieToleranceMillionJpy,
    publicCriterion.nearTieToleranceMillionJpy,
  ];
  const commonTie = tieValues.every((value) => stableJson(value) === stableJson(tieValues[0]))
    ? tieValues[0]
    : { company: tieValues[0], bzsf: tieValues[1], public: tieValues[2] };
  const discounts = revision.discount_rate_by_objective_json as JsonObject;
  const valuationRules = revision.valuation_rule_by_objective_json as JsonObject;
  return {
    valuation_date: revision.valuation_date,
    initial_state: revision.initial_state_key,
    plan_deadline: revision.plan_deadline_months,
    evaluation_horizon: revision.evaluation_horizon_months,
    reachability_history: initialState.reachability_history_json,
    decision_controller: initialState.decision_controller_json,
    controller_objective: (initialState.decision_controller_json as JsonObject).objective,
    baseline_policy: revision.baseline_policy_json,
    policy_definition_ref: revision.policy_definition_ref,
    action_coverage: { status: "complete", actionCount },
    discount_rate_company: discounts.company,
    discount_rate_bzsf: discounts.bzsf,
    discount_rate_public: discounts.public,
    valuation_rule_company: valuationRules.company,
    valuation_rule_bzsf: valuationRules.bzsf,
    valuation_rule_public: valuationRules.public,
    decision_criterion_company: criteria.company,
    decision_criterion_bzsf: criteria.bzsf,
    decision_criterion_public: criteria.public,
    near_tie_tolerance: commonTie,
    tie_break_rule: revision.tie_break_rule_json,
    uncertainty_rule: revision.uncertainty_rule_json,
    public_fiscal_rule: revision.public_fiscal_rule_ref,
    public_social_mandate: revision.public_social_mandate_ref,
    public_social_conversion: revision.public_social_conversion_rule_ref,
    public_aggregation: revision.public_aggregation_rule_ref,
    single_cashflow_ledger: { status: "complete", eventCount: cashflowCount },
  };
}

function buildProjectRows(
  project: ArtifactProject,
  artifactMeta: Pick<Artifact, "contentHashSha256" | "estimatorVersion">,
) {
  const model = project.model;
  assert.equal(model.dataMode, "project", `${project.projectId}: dataMode`);
  assert.equal(model.informationCutoff, CREATED_AT, `${project.projectId}: cutoff`);
  assert.equal(model.states.length, 1, `${project.projectId}: one-state compression`);
  assert.ok(model.publicValueRule, `${project.projectId}: public value rule`);
  const publicValueRule = model.publicValueRule;
  const sourceState = model.states[0];
  const revisionId = deterministicUuid(`sps21:${project.projectId}:revision:${REVISION_KEY}`);
  const stateIds = new Map(
    model.states.map((state) => [state.stateId, deterministicUuid(`sps21:${project.projectId}:state:${state.stateId}`)]),
  );
  const actionIds = new Map(
    model.states.flatMap((state) => state.actions.map((action) => [
      action.actionId,
      deterministicUuid(`sps21:${project.projectId}:action:${state.stateId}:${action.actionId}`),
    ] as const)),
  );
  const transitionIds = new Map(
    model.states.flatMap((state) => state.actions.flatMap((action) => action.transitions.map((transition) => [
      transition.transitionId,
      deterministicUuid(`sps21:${project.projectId}:transition:${state.stateId}:${action.actionId}:${transition.transitionId}`),
    ] as const))),
  );

  const revisionRow: Bzm21ModelRevisionRow = {
    revision_id: revisionId,
    project_id: project.projectId,
    revision_key: REVISION_KEY,
    revision_order: 2,
    theory_version: "theory-fixed v2.1 / estimated-v0.1",
    model_version: model.modelVersion,
    data_mode: "project",
    currency: "JPY",
    valuation_date: model.valuationDate,
    initial_state_key: model.initialStateId,
    plan_deadline_months: model.planDeadlineMonths,
    evaluation_horizon_months: model.evaluationHorizonMonths,
    discount_rate_by_objective_json: model.discountRatePerMonth,
    valuation_rule_by_objective_json: model.valuationRuleByObjective,
    decision_criterion_by_objective_json: model.decisionCriterionByObjective,
    tie_break_rule_json: model.tieBreakRule,
    uncertainty_rule_json: model.uncertaintyRule,
    public_fiscal_rule_ref: publicValueRule.fiscalRuleRef,
    public_social_mandate_ref: publicValueRule.socialMandateRef,
    public_social_conversion_rule_ref: publicValueRule.socialConversionRuleRef,
    public_aggregation_rule_ref: "bzm2.1:public=fiscal+social_converted:v0.1",
    baseline_policy_id: model.baselinePolicyId,
    baseline_policy_json: model.baselinePolicy,
    policy_definition_ref: model.policyDefinitionRef,
    measurement_status: "evaluated_hypothesis",
    information_cutoff: model.informationCutoff,
    forward_validation_count: 0,
    revision_reason: "12PJ共通の低精度推定v0.1。欠測は共通決定規則で補完し、観測と混同せず資源配分を禁止",
    source_ref: "pwa/bzm/pilot/sps-2-1-estimated-v0-1.json",
    created_at: CREATED_AT,
  };

  const stateRows: Bzm21DecisionStateRow[] = model.states.map((state, stateIndex) => ({
    state_id: stateIds.get(state.stateId)!,
    revision_id: revisionId,
    state_key: state.stateId,
    label: state.label,
    decision_order: state.decisionOrder,
    is_initial: state.stateId === model.initialStateId,
    elapsed_months: state.elapsedMonths,
    current_state_json: state.currentState,
    beliefs_json: state.beliefs,
    reachability_history_json: state.reachabilityHistory,
    decision_controller_json: state.decisionController,
    sunk_cost_million_jpy: state.sunkCostMillionJpy,
    remaining_cost_million_jpy: state.remainingCostMillionJpy,
    remaining_time_months: state.remainingTimeMonths,
    available_information_json: state.availableInformation,
    evidence_json: state.evidence,
    created_at: CREATED_AT,
  }));

  const actionRows: Bzm21ActionRow[] = model.states.flatMap((state) =>
    state.actions.map((action, actionIndex) => ({
      action_id: actionIds.get(action.actionId)!,
      state_id: stateIds.get(state.stateId)!,
      action_key: action.actionId,
      bundle_id: action.bundleId,
      action_type: action.kind,
      component_types: action.componentKinds,
      custom_components: action.customComponents,
      sequence_json: action.sequence,
      shared_resources_json: action.sharedResourceRequirements,
      label: action.label,
      action_order: actionIndex,
      availability_status: action.availability,
      availability_reason: action.availability === "available" ? null : "推定版で未確認",
      feasibility_gate_json: action.feasibility,
      authority_gate_json: action.authority,
      consents_json: action.consents,
      financing_feasibility_json: action.financingFeasibility,
      duration_months: action.durationMonths,
      immediate_cost_by_objective_json: action.immediateCostMillionJpy,
      immediate_benefit_by_objective_json: action.immediateBenefitMillionJpy,
      required_funding_million_jpy: action.requiredFundingMillionJpy,
      cashflow_event_keys: action.cashFlowEventIds,
      information_gain_json: action.informationGain,
      evidence_json: action.evidence,
      created_at: CREATED_AT,
    })),
  );

  const transitionRows: Bzm21TransitionRow[] = model.states.flatMap((state) =>
    state.actions.flatMap((action) => action.transitions.map((transition, transitionIndex) => ({
      transition_id: transitionIds.get(transition.transitionId)!,
      action_id: actionIds.get(action.actionId)!,
      transition_key: transition.transitionId,
      label: transition.label,
      next_state_id: transition.nextStateId ? stateIds.get(transition.nextStateId)! : null,
      terminal_outcome: transition.terminalOutcome,
      probability: transition.probability,
      goal_reached_at_months: transition.goalReachedAtMonths,
      slack_lost_at_months: transition.slackLostAtMonths,
      transition_cash_flow_by_objective_json: transition.transitionCashFlowMillionJpy,
      terminal_value_by_objective_json: transition.terminalValueMillionJpy,
      failure_loss_by_objective_json: transition.failureLossMillionJpy,
      cashflow_event_keys: transition.cashFlowEventIds,
      evidence_json: transition.evidence,
      transition_order: transitionIndex,
      created_at: CREATED_AT,
    }))),
  );

  const actionByNaturalId = new Map(
    model.states.flatMap((state) => state.actions.map((action) => [action.actionId, { state, action }] as const)),
  );
  const transitionByNaturalId = new Map(
    model.states.flatMap((state) => state.actions.flatMap((action) => action.transitions.map((transition) => [
      transition.transitionId,
      { state, action, transition },
    ] as const))),
  );
  const cashflowRows: Bzm21CashflowEventRow[] = model.cashFlowEvents.map((event) => {
    const actionContext = event.actionId ? actionByNaturalId.get(event.actionId) : undefined;
    const transitionContext = event.transitionId ? transitionByNaturalId.get(event.transitionId) : undefined;
    assert.ok(actionContext, `${project.projectId}/${event.eventId}: action context`);
    if (event.transitionId) assert.ok(transitionContext, `${project.projectId}/${event.eventId}: transition context`);
    const companyAmount = event.objectiveAmountsMillionJpy.company;
    assert.ok(typeof companyAmount === "number", `${project.projectId}/${event.eventId}: company amount`);
    assert.ok(actionContext.state.elapsedMonths !== null, `${project.projectId}/${event.eventId}: elapsed months`);
    assert.ok(actionContext.action.durationMonths !== null, `${project.projectId}/${event.eventId}: duration months`);
    const sign = event.includedIn === "immediate_cost" || event.includedIn === "failure_loss" ? -1 : 1;
    const actionPath = `${actionContext.state.stateId}/${actionContext.action.actionId}`;
    const scopeKey = transitionContext
      ? `${actionPath}/${transitionContext.transition.transitionId}`
      : actionPath;
    return {
      cashflow_event_id: deterministicUuid(`sps21:${project.projectId}:cashflow:${event.eventId}`),
      revision_id: revisionId,
      state_id: stateIds.get(event.stateId)!,
      action_id: actionIds.get(event.actionId!)!,
      transition_id: event.transitionId ? transitionIds.get(event.transitionId)! : null,
      event_key: event.eventId,
      economic_nature: event.economicNature,
      economic_event_group_key: null,
      perspective_leg: null,
      label: event.label,
      owner_kind: "company",
      owner_ref: `${project.projectId}:company-scenario`,
      counterparty_kind: "other",
      counterparty_ref: "estimated-economic-counterparty",
      scope_kind: transitionContext ? "transition" : "action",
      scope_key: scopeKey,
      timing_kind: event.timing,
      timing_months: event.timing === "action_start"
        ? actionContext.state.elapsedMonths
        : actionContext.state.elapsedMonths + actionContext.action.durationMonths,
      amount: companyAmount * 1_000_000,
      currency: "JPY",
      model_amount_million_jpy: companyAmount,
      conversion_rule_ref: null,
      conversion_rate_to_jpy: null,
      conversion_rate_date: null,
      conversion_rate_source_ref: null,
      value_status: "estimated",
      nominal_or_real: "nominal",
      price_base_date: null,
      tax_treatment: event.taxTreatment,
      tax_subject_ref: null,
      evidence_kind: event.evidence.kind,
      evidence_ref: event.evidence.ref,
      information_cutoff: event.evidence.informationCutoff,
      included_in: event.includedIn,
      perspective_attribution_json: {
        company: { included: true, sign, attribution: "company incremental PJ cashflow" },
        bzsf: { included: false, sign: null, attribution: "security and waterfall legs not measured" },
        public: { included: false, sign: null, attribution: "public fiscal and social legs not measured" },
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
      condition_json: { scenario: REVISION_KEY, allocationProhibited: true },
      note: "低精度推定v0.1の名目・税効果込みシナリオ額。観測値ではない",
      created_at: CREATED_AT,
    };
  });

  const preliminaryLedger = buildBzm21PolicyModelLedger({
    projectId: project.projectId,
    revisionRows: [revisionRow],
    stateRows,
    actionRows,
    transitionRows,
    cashflowEventRows: cashflowRows,
  });
  assert.ok(preliminaryLedger.currentRevision, `${project.projectId}: preliminary revision`);
  assert.equal(preliminaryLedger.states.length, 1, `${project.projectId}: preliminary state`);

  const inputRows: Bzm21InputObservationRow[] = [];
  const initialStateRow = stateRows.find((state) => state.is_initial)!;
  const revisionValues = revisionExpectedValues(
    revisionRow,
    initialStateRow,
    actionRows.length,
    cashflowRows.length,
  );
  BZM21_REQUIRED_REVISION_INPUT_KEYS.forEach((parameterKey, index) => {
    inputRows.push(inputRow({
      revisionId,
      scopeKind: "revision",
      scopeKey: "revision",
      parameterKey,
      value: revisionValues[parameterKey],
      sortOrder: (index + 1) * 10,
      projectId: project.projectId,
    }));
  });
  const artifactEvidenceRef = `calculation:artifact-sha256=${artifactMeta.contentHashSha256};estimator=${artifactMeta.estimatorVersion}`;
  inputRows.push(inputRow({
    revisionId,
    scopeKind: "revision",
    scopeKey: "revision",
    parameterKey: "estimation_ratio_numeric_parameters",
    value: project.estimationRatio,
    sortOrder: 280,
    projectId: project.projectId,
    valueStatus: "calculated",
    evidenceRef: artifactEvidenceRef,
    condition: {
      denominator: "numeric estimator parameters",
      excludes: ["categorical identity", "not_applicable outputs"],
      allocationProhibited: true,
    },
    note: "推定値を使った数値パラメータ比率。精度・信頼度・観測率ではない",
  }));
  inputRows.push(inputRow({
    revisionId,
    scopeKind: "revision",
    scopeKey: "revision",
    parameterKey: "sensitivity_action_switch",
    value: project.sensitivity,
    sortOrder: 290,
    projectId: project.projectId,
    valueStatus: "calculated",
    evidenceRef: artifactEvidenceRef,
    condition: {
      stressTable: "downside/point/upside mechanical stress",
      confidenceInterval: false,
      allocationProhibited: true,
    },
    note: "機械的stressで選択行動が変わるか。信頼区間・校正済み予測ではない",
  }));
  for (const state of preliminaryLedger.states) {
    const stateValues = bzm21RequiredStateInputValues(state);
    BZM21_REQUIRED_STATE_INPUT_KEYS.forEach((parameterKey, index) => {
      inputRows.push(inputRow({
        revisionId,
        scopeKind: "state",
        scopeKey: state.stateKey,
        parameterKey,
        value: stateValues[parameterKey],
        sortOrder: (index + 1) * 10,
        projectId: project.projectId,
      }));
    });
    for (const action of state.actions) {
      const actionPath = `${state.stateKey}/${action.actionKey}`;
      const actionValues = bzm21RequiredActionInputValues(action);
      BZM21_REQUIRED_ACTION_INPUT_KEYS.forEach((parameterKey, index) => {
        inputRows.push(inputRow({
          revisionId,
          scopeKind: "action",
          scopeKey: actionPath,
          parameterKey,
          value: actionValues[parameterKey],
          sortOrder: (index + 1) * 10,
          projectId: project.projectId,
        }));
      });
      for (const transition of action.transitions) {
        const transitionPath = `${actionPath}/${transition.transitionKey}`;
        const transitionValues = bzm21RequiredTransitionInputValues(transition);
        BZM21_REQUIRED_TRANSITION_INPUT_KEYS.forEach((parameterKey, index) => {
          inputRows.push(inputRow({
            revisionId,
            scopeKind: "transition",
            scopeKey: transitionPath,
            parameterKey,
            value: transitionValues[parameterKey],
            sortOrder: (index + 1) * 10,
            projectId: project.projectId,
          }));
        });
      }
    }
  }
  assert.equal(inputRows.length, 74, `${project.projectId}: 27 required revision + 2 display + 8+22+15 scoped inputs`);

  const ledger = buildBzm21PolicyModelLedger({
    projectId: project.projectId,
    revisionRows: [revisionRow],
    stateRows,
    actionRows,
    transitionRows,
    cashflowEventRows: cashflowRows,
    inputRows,
  });
  const adapted = buildBzm21DynamicPolicyModelFromLedger(ledger);
  if (adapted.status !== "ready") {
    throw new Error(`${project.projectId}: ${adapted.diagnostics.join(" | ")}`);
  }
  assert.ok(adapted.model, `${project.projectId}: adapted model`);
  const evaluation = evaluateBzm21DynamicPolicyModel(adapted.model);
  const serialized = serializeBzm21DynamicPolicyRun({
    ledger,
    evaluation,
    engineVersion: ENGINE_VERSION,
  });
  const companyActionEvaluationById = new Map(
    serialized.actionEvaluations
      .filter((row) => row.objective_kind === "company")
      .map((row) => [row.action_id, row] as const),
  );
  const actionEvaluationRows = serialized.actionEvaluations.map((row) => {
    if (row.objective_kind === "company") return row;
    const physicalReference = companyActionEvaluationById.get(row.action_id);
    assert.ok(
      physicalReference &&
        physicalReference.goal_probability !== null &&
        physicalReference.plan_deadline_goal_probability !== null,
      `${project.projectId}/${row.action_id}: company physical q`,
    );
    return {
      ...row,
      goal_probability: physicalReference.goal_probability,
      plan_deadline_goal_probability:
        physicalReference.plan_deadline_goal_probability,
    };
  });
  const inputHash = computeBzm21PolicyLedgerInputHash(ledger);
  assert.match(inputHash ?? "", /^[0-9a-f]{64}$/, `${project.projectId}: canonical hash`);
  assert.equal(serialized.policyEvaluations.length, 6, `${project.projectId}: policy rows`);
  assert.equal(actionEvaluationRows.length, 6, `${project.projectId}: action rows`);
  assert.ok(
    actionEvaluationRows.every(
      (row) =>
        row.goal_probability !== null &&
        row.plan_deadline_goal_probability !== null,
    ),
    `${project.projectId}: every perspective retains each candidate action q`,
  );
  const optimizedCompany = serialized.policyEvaluations.find(
    (row) => row.objective_kind === "company" && row.policy_kind === "optimized",
  );
  assert.equal(optimizedCompany?.evaluation_status, "computed", `${project.projectId}: company computed`);
  assert.ok(
    Math.abs((optimizedCompany?.expected_net_value ?? Infinity) - project.outputs.expectedFutureNetProjectValueMillionJpy) < 0.000001,
    `${project.projectId}: artifact value roundtrip`,
  );
  assert.ok(
    Math.abs((optimizedCompany?.goal_probability ?? Infinity) - project.outputs.qSelectedPolicy) < 0.000001,
    `${project.projectId}: artifact q roundtrip`,
  );
  for (const objective of ["bzsf", "public"] as const) {
    const rows = serialized.policyEvaluations.filter((row) => row.objective_kind === objective);
    assert.equal(rows.length, 2, `${project.projectId}: ${objective} policy rows`);
    assert.ok(rows.every((row) => row.evaluation_status === "not_computable"));
    assert.ok(rows.every((row) => row.goal_probability !== null));
    assert.ok(rows.every((row) => Object.keys(row.selected_action_by_state_json).length > 0));
  }
  return {
    revisionRow,
    stateRows,
    actionRows,
    transitionRows,
    cashflowRows,
    inputRows,
    policyRows: serialized.policyEvaluations,
    actionEvaluationRows,
    inputHash: inputHash!,
    expectedValue: project.outputs.expectedFutureNetProjectValueMillionJpy,
    expectedQ: project.outputs.qSelectedPolicy,
    expectedSelectedActionId: actionIds.get(project.outputs.selectedActionId)!,
  };
}

function revisionSql(rows: ReturnType<typeof buildProjectRows>[]) {
  const columns = [
    "revision_id", "project_id", "revision_key", "revision_order", "theory_version", "model_version",
    "data_mode", "currency", "valuation_date", "initial_state_key", "plan_deadline_months",
    "evaluation_horizon_months", "discount_rate_by_objective_json", "valuation_rule_by_objective_json",
    "decision_criterion_by_objective_json", "tie_break_rule_json", "uncertainty_rule_json",
    "public_fiscal_rule_ref", "public_social_mandate_ref", "public_social_conversion_rule_ref",
    "public_aggregation_rule_ref", "baseline_policy_id", "baseline_policy_json", "policy_definition_ref",
    "measurement_status", "information_cutoff", "forward_validation_count", "revision_reason", "source_ref", "created_at",
  ];
  return sqlInsert("bzm_2_1_model_revisions", columns, rows.map(({ revisionRow: r }) => [
    sqlString(r.revision_id), sqlString(r.project_id), sqlString(r.revision_key), sqlNumber(r.revision_order),
    sqlString(r.theory_version), sqlString(r.model_version), sqlString(r.data_mode), sqlString(r.currency),
    sqlNullableString(r.valuation_date), sqlNullableString(r.initial_state_key), sqlNumber(Number(r.plan_deadline_months)),
    sqlNumber(Number(r.evaluation_horizon_months)), sqlJson(r.discount_rate_by_objective_json),
    sqlJson(r.valuation_rule_by_objective_json), sqlJson(r.decision_criterion_by_objective_json),
    sqlJson(r.tie_break_rule_json), sqlJson(r.uncertainty_rule_json), sqlNullableString(r.public_fiscal_rule_ref),
    sqlNullableString(r.public_social_mandate_ref), sqlNullableString(r.public_social_conversion_rule_ref),
    sqlNullableString(r.public_aggregation_rule_ref), sqlNullableString(r.baseline_policy_id), sqlJson(r.baseline_policy_json),
    sqlNullableString(r.policy_definition_ref), sqlString(r.measurement_status), sqlString(r.information_cutoff),
    sqlNumber(r.forward_validation_count), sqlString(r.revision_reason), sqlString(r.source_ref), sqlString(r.created_at),
  ]));
}

function stateSql(rows: ReturnType<typeof buildProjectRows>[]) {
  const stateRows = rows.flatMap((row) => row.stateRows);
  return sqlInsert("bzm_2_1_decision_states", [
    "state_id", "revision_id", "state_key", "label", "decision_order", "is_initial", "elapsed_months",
    "current_state_json", "beliefs_json", "reachability_history_json", "decision_controller_json",
    "sunk_cost_million_jpy", "remaining_cost_million_jpy", "remaining_time_months",
    "available_information_json", "evidence_json", "created_at",
  ], stateRows.map((r) => [
    sqlString(r.state_id), sqlString(r.revision_id), sqlString(r.state_key), sqlString(r.label),
    sqlNumber(r.decision_order), sqlBoolean(r.is_initial), sqlNumber(r.elapsed_months == null ? null : Number(r.elapsed_months)),
    sqlJson(r.current_state_json), sqlJson(r.beliefs_json), sqlJson(r.reachability_history_json),
    sqlJson(r.decision_controller_json), sqlNumber(r.sunk_cost_million_jpy == null ? null : Number(r.sunk_cost_million_jpy)),
    sqlNumber(r.remaining_cost_million_jpy == null ? null : Number(r.remaining_cost_million_jpy)),
    sqlNumber(r.remaining_time_months == null ? null : Number(r.remaining_time_months)),
    sqlJson(r.available_information_json), sqlJson(r.evidence_json), sqlString(r.created_at),
  ]));
}

function actionSql(rows: ReturnType<typeof buildProjectRows>[]) {
  const actionRows = rows.flatMap((row) => row.actionRows);
  return sqlInsert("bzm_2_1_actions", [
    "action_id", "state_id", "action_key", "bundle_id", "action_type", "component_types", "custom_components",
    "sequence_json", "shared_resources_json", "label", "action_order", "availability_status", "availability_reason",
    "feasibility_gate_json", "authority_gate_json", "consents_json", "financing_feasibility_json", "duration_months",
    "immediate_cost_by_objective_json", "immediate_benefit_by_objective_json", "required_funding_million_jpy",
    "cashflow_event_keys", "information_gain_json", "evidence_json", "created_at",
  ], actionRows.map((r) => [
    sqlString(r.action_id), sqlString(r.state_id), sqlString(r.action_key), sqlString(r.bundle_id), sqlString(r.action_type),
    sqlTextArray(r.component_types), sqlTextArray(r.custom_components), sqlJson(r.sequence_json),
    sqlJson(r.shared_resources_json), sqlString(r.label), sqlNumber(r.action_order), sqlString(r.availability_status),
    sqlNullableString(r.availability_reason), sqlJson(r.feasibility_gate_json), sqlJson(r.authority_gate_json),
    sqlJson(r.consents_json), sqlJson(r.financing_feasibility_json),
    sqlNumber(r.duration_months == null ? null : Number(r.duration_months)), sqlJson(r.immediate_cost_by_objective_json),
    sqlJson(r.immediate_benefit_by_objective_json),
    sqlNumber(r.required_funding_million_jpy == null ? null : Number(r.required_funding_million_jpy)),
    sqlTextArray(r.cashflow_event_keys), sqlJson(r.information_gain_json), sqlJson(r.evidence_json), sqlString(r.created_at),
  ]));
}

function transitionSql(rows: ReturnType<typeof buildProjectRows>[]) {
  const transitionRows = rows.flatMap((row) => row.transitionRows);
  return sqlInsert("bzm_2_1_transitions", [
    "transition_id", "action_id", "transition_key", "label", "next_state_id", "terminal_outcome", "probability",
    "goal_reached_at_months", "slack_lost_at_months", "transition_cash_flow_by_objective_json",
    "terminal_value_by_objective_json", "failure_loss_by_objective_json", "cashflow_event_keys", "evidence_json",
    "transition_order", "created_at",
  ], transitionRows.map((r) => [
    sqlString(r.transition_id), sqlString(r.action_id), sqlString(r.transition_key), sqlString(r.label),
    sqlNullableString(r.next_state_id), sqlNullableString(r.terminal_outcome),
    sqlNumber(r.probability == null ? null : Number(r.probability)),
    sqlNumber(r.goal_reached_at_months == null ? null : Number(r.goal_reached_at_months)),
    sqlNumber(r.slack_lost_at_months == null ? null : Number(r.slack_lost_at_months)),
    sqlJson(r.transition_cash_flow_by_objective_json), sqlJson(r.terminal_value_by_objective_json),
    sqlJson(r.failure_loss_by_objective_json), sqlTextArray(r.cashflow_event_keys), sqlJson(r.evidence_json),
    sqlNumber(r.transition_order), sqlString(r.created_at),
  ]));
}

function inputSql(rows: ReturnType<typeof buildProjectRows>[]) {
  const inputRows = rows.flatMap((row) => row.inputRows);
  return sqlInsert("bzm_2_1_input_observations", [
    "observation_id", "revision_id", "scope_kind", "scope_key", "parameter_key", "symbol", "label", "value_json",
    "display_value", "value_status", "unit", "evidence_kind", "evidence_ref", "information_cutoff",
    "condition_json", "note", "sort_order", "created_at",
  ], inputRows.map((r) => [
    sqlString(r.observation_id), sqlString(r.revision_id), sqlString(r.scope_kind), sqlString(r.scope_key),
    sqlString(r.parameter_key), sqlString(r.symbol), sqlString(r.label), sqlJson(r.value_json),
    sqlString(r.display_value), sqlString(r.value_status), sqlNullableString(r.unit), sqlString(r.evidence_kind),
    sqlNullableString(r.evidence_ref), sqlString(r.information_cutoff), sqlJson(r.condition_json),
    sqlNullableString(r.note), sqlNumber(r.sort_order), sqlString(r.created_at),
  ]));
}

function cashflowSql(rows: ReturnType<typeof buildProjectRows>[]) {
  const cashflowRows = rows.flatMap((row) => row.cashflowRows);
  return sqlInsert("bzm_2_1_cashflow_events", [
    "cashflow_event_id", "revision_id", "state_id", "action_id", "transition_id", "event_key", "economic_nature",
    "economic_event_group_key", "perspective_leg", "label", "owner_kind", "owner_ref", "counterparty_kind",
    "counterparty_ref", "scope_kind", "scope_key", "timing_kind", "timing_months", "amount", "currency",
    "model_amount_million_jpy", "conversion_rule_ref", "conversion_rate_to_jpy", "conversion_rate_date",
    "conversion_rate_source_ref", "value_status", "nominal_or_real", "price_base_date", "tax_treatment",
    "tax_subject_ref", "evidence_kind", "evidence_ref", "information_cutoff", "included_in",
    "perspective_attribution_json", "public_aggregation_status", "public_fiscal_amount_million_jpy",
    "public_social_benefit_vector_json", "public_social_converted_amount_million_jpy",
    "public_aggregated_amount_million_jpy", "public_aggregation_input_hash", "public_transfer_treatment",
    "public_transfer_deduplication_ref", "semantic_duplicate_review_ref", "condition_json", "note", "created_at",
  ], cashflowRows.map((r) => [
    sqlString(r.cashflow_event_id), sqlString(r.revision_id), sqlNullableString(r.state_id), sqlNullableString(r.action_id),
    sqlNullableString(r.transition_id), sqlString(r.event_key), sqlString(r.economic_nature),
    sqlNullableString(r.economic_event_group_key), sqlNullableString(r.perspective_leg), sqlString(r.label),
    sqlString(r.owner_kind), sqlString(r.owner_ref), sqlString(r.counterparty_kind), sqlString(r.counterparty_ref),
    sqlString(r.scope_kind), sqlString(r.scope_key), sqlString(r.timing_kind),
    sqlNumber(r.timing_months == null ? null : Number(r.timing_months)), sqlNumber(r.amount == null ? null : Number(r.amount)),
    sqlString(r.currency), sqlNumber(r.model_amount_million_jpy == null ? null : Number(r.model_amount_million_jpy)),
    sqlNullableString(r.conversion_rule_ref), sqlNumber(r.conversion_rate_to_jpy == null ? null : Number(r.conversion_rate_to_jpy)),
    sqlNullableString(r.conversion_rate_date), sqlNullableString(r.conversion_rate_source_ref), sqlString(r.value_status),
    sqlString(r.nominal_or_real), sqlNullableString(r.price_base_date), sqlString(r.tax_treatment),
    sqlNullableString(r.tax_subject_ref), sqlString(r.evidence_kind), sqlNullableString(r.evidence_ref),
    sqlString(r.information_cutoff), sqlString(r.included_in), sqlJson(r.perspective_attribution_json),
    sqlString(r.public_aggregation_status),
    sqlNumber(r.public_fiscal_amount_million_jpy == null ? null : Number(r.public_fiscal_amount_million_jpy)),
    sqlJson(r.public_social_benefit_vector_json),
    sqlNumber(r.public_social_converted_amount_million_jpy == null ? null : Number(r.public_social_converted_amount_million_jpy)),
    sqlNumber(r.public_aggregated_amount_million_jpy == null ? null : Number(r.public_aggregated_amount_million_jpy)),
    sqlNullableString(r.public_aggregation_input_hash), sqlString(r.public_transfer_treatment),
    sqlNullableString(r.public_transfer_deduplication_ref), sqlNullableString(r.semantic_duplicate_review_ref),
    sqlJson(r.condition_json), sqlNullableString(r.note), sqlString(r.created_at),
  ]));
}

function policySql(rows: ReturnType<typeof buildProjectRows>[]) {
  const policyRows = rows.flatMap((row) => row.policyRows.map((policy) => ({
    ...policy,
    policy_evaluation_id: deterministicUuid(
      `sps21:${row.revisionRow.project_id}:policy:${policy.objective_kind}:${policy.policy_kind}`,
    ),
  })));
  return sqlInsert("bzm_2_1_policy_evaluations", [
    "policy_evaluation_id", "revision_id", "objective_kind", "policy_kind", "selection_objective", "evaluation_status",
    "action_coverage_status", "goal_probability", "plan_deadline_goal_probability", "conditional_goal_value",
    "expected_net_value", "value_difference_from_baseline", "controller_option_value", "value_unit",
    "expected_cumulative_funding_million_jpy", "expected_failure_loss_million_jpy", "expected_exit_value_million_jpy",
    "expected_terminal_value_million_jpy", "expected_cost_million_jpy", "expected_benefit_million_jpy",
    "public_aggregation_status", "public_fiscal_value_million_jpy", "public_social_components_json",
    "public_social_monetized_value_million_jpy", "public_aggregated_value_million_jpy", "public_aggregation_input_hash",
    "controller_by_state_json", "selected_action_by_state_json", "state_decisions_json", "uncertainty_json", "issues_json",
    "missing_inputs", "engine_version", "input_hash", "information_cutoff", "created_at",
  ], policyRows.map((r) => [
    sqlString(r.policy_evaluation_id), sqlString(r.revision_id), sqlString(r.objective_kind), sqlString(r.policy_kind),
    sqlNullableString(r.selection_objective), sqlString(r.evaluation_status), sqlString(r.action_coverage_status),
    sqlNumber(r.goal_probability), sqlNumber(r.plan_deadline_goal_probability), sqlNumber(r.conditional_goal_value),
    sqlNumber(r.expected_net_value), sqlNumber(r.value_difference_from_baseline), sqlNumber(r.controller_option_value),
    sqlNullableString(r.value_unit), sqlNumber(r.expected_cumulative_funding_million_jpy),
    sqlNumber(r.expected_failure_loss_million_jpy), sqlNumber(r.expected_exit_value_million_jpy),
    sqlNumber(r.expected_terminal_value_million_jpy), sqlNumber(r.expected_cost_million_jpy),
    sqlNumber(r.expected_benefit_million_jpy), sqlString(r.public_aggregation_status),
    sqlNumber(r.public_fiscal_value_million_jpy), sqlJson(r.public_social_components_json),
    sqlNumber(r.public_social_monetized_value_million_jpy), sqlNumber(r.public_aggregated_value_million_jpy),
    sqlNullableString(r.public_aggregation_input_hash), sqlJson(r.controller_by_state_json),
    sqlJson(r.selected_action_by_state_json), sqlJson(r.state_decisions_json), sqlJson(r.uncertainty_json),
    sqlJson(r.issues_json), sqlTextArray(r.missing_inputs), sqlNullableString(r.engine_version),
    sqlNullableString(r.input_hash), sqlString(r.information_cutoff), sqlString(CREATED_AT),
  ]));
}

function actionEvaluationSql(rows: ReturnType<typeof buildProjectRows>[]) {
  const actionRows = rows.flatMap((row) => row.actionEvaluationRows.map((evaluation) => ({
    ...evaluation,
    action_evaluation_id: deterministicUuid(
      `sps21:${row.revisionRow.project_id}:action-eval:${evaluation.action_id}:${evaluation.objective_kind}`,
    ),
  })));
  return sqlInsert("bzm_2_1_action_evaluations", [
    "action_evaluation_id", "action_id", "objective_kind", "selection_objective", "is_selected", "exclusion_reason",
    "evaluation_status", "goal_probability", "plan_deadline_goal_probability", "conditional_goal_value", "value_unit",
    "expected_cumulative_funding_million_jpy", "expected_failure_loss_million_jpy", "expected_exit_value_million_jpy",
    "expected_terminal_value_million_jpy", "expected_cost_million_jpy", "expected_benefit_million_jpy", "expected_net_value",
    "public_aggregation_status", "public_fiscal_value_million_jpy", "public_social_components_json",
    "public_social_monetized_value_million_jpy", "public_aggregated_value_million_jpy", "public_aggregation_input_hash",
    "uncertainty_json", "issues_json", "missing_inputs", "engine_version", "input_hash", "information_cutoff", "created_at",
  ], actionRows.map((r) => [
    sqlString(r.action_evaluation_id), sqlString(r.action_id), sqlString(r.objective_kind),
    sqlNullableString(r.selection_objective), sqlBoolean(r.is_selected), sqlNullableString(r.exclusion_reason),
    sqlString(r.evaluation_status), sqlNumber(r.goal_probability), sqlNumber(r.plan_deadline_goal_probability),
    sqlNumber(r.conditional_goal_value), sqlNullableString(r.value_unit),
    sqlNumber(r.expected_cumulative_funding_million_jpy), sqlNumber(r.expected_failure_loss_million_jpy),
    sqlNumber(r.expected_exit_value_million_jpy), sqlNumber(r.expected_terminal_value_million_jpy),
    sqlNumber(r.expected_cost_million_jpy), sqlNumber(r.expected_benefit_million_jpy), sqlNumber(r.expected_net_value),
    sqlString(r.public_aggregation_status), sqlNumber(r.public_fiscal_value_million_jpy),
    sqlJson(r.public_social_components_json), sqlNumber(r.public_social_monetized_value_million_jpy),
    sqlNumber(r.public_aggregated_value_million_jpy), sqlNullableString(r.public_aggregation_input_hash),
    sqlJson(r.uncertainty_json), sqlJson(r.issues_json), sqlTextArray(r.missing_inputs),
    sqlNullableString(r.engine_version), sqlNullableString(r.input_hash), sqlString(r.information_cutoff), sqlString(CREATED_AT),
  ]));
}

function preflightSql() {
  const targetList = TARGET_PROJECTS.map(sqlString).join(", ");
  return `DO $$
DECLARE
  invalid_archive_count integer;
  ready_registry_count integer;
  existing_seed_count integer;
BEGIN
  SELECT count(*) INTO invalid_archive_count
  FROM public.sps_legacy_archives AS archives
  WHERE archives.project_id IN (${targetList})
    AND archives.snapshot_key = ${sqlString(SNAPSHOT_KEY)}
    AND (
      archives.payload_hash <> encode(extensions.digest(archives.payload_json::text, 'sha256'), 'hex')
      OR (archives.source_counts_json ->> 'amd_score_inputs')::integer <> jsonb_array_length(archives.payload_json -> 'amd_score_inputs')
      OR (archives.source_counts_json ->> 'amd_score_revisions')::integer <> jsonb_array_length(archives.payload_json -> 'amd_score_revisions')
      OR (archives.source_counts_json ->> 'amd_score_alpha_proposals')::integer <> jsonb_array_length(archives.payload_json -> 'amd_score_alpha_proposals')
      OR (archives.source_counts_json ->> 'bzm_2_model_revisions')::integer <> jsonb_array_length(archives.payload_json -> 'bzm_2_model_revisions')
      OR (archives.source_counts_json ->> 'bzm_2_parameter_observations')::integer <> jsonb_array_length(archives.payload_json -> 'bzm_2_parameter_observations')
      OR (archives.source_counts_json ->> 'amd_score_alpha')::integer <> jsonb_array_length(archives.payload_json -> 'amd_score_alpha')
    );

  IF (SELECT count(*) FROM public.sps_legacy_archives WHERE project_id IN (${targetList}) AND snapshot_key = ${sqlString(SNAPSHOT_KEY)}) <> 12
    OR invalid_archive_count <> 0 THEN
    RAISE EXCEPTION 'SPS 2.1 seed blocked: 12 legacy archives are not complete and hash/count valid';
  END IF;

  SELECT count(*) INTO ready_registry_count
  FROM public.sps_primary_model_registry AS registry
  JOIN public.sps_legacy_archives AS archives
    ON archives.project_id = registry.project_id
   AND archives.archive_id = registry.legacy_archive_id
  WHERE registry.project_id IN (${targetList})
    AND registry.primary_model = 'legacy_sps'
    AND registry.switch_status = 'preparing'
    AND registry.active_bzm_2_1_revision_id IS NULL
    AND archives.snapshot_key = ${sqlString(SNAPSHOT_KEY)};
  IF ready_registry_count <> 12 THEN
    RAISE EXCEPTION 'SPS 2.1 seed blocked: registry is not uniformly preparing for 12 projects';
  END IF;

  SELECT count(*) INTO existing_seed_count
  FROM public.bzm_2_1_model_revisions
  WHERE project_id IN (${targetList}) AND revision_key = ${sqlString(REVISION_KEY)};
  IF existing_seed_count <> 0 THEN
    RAISE EXCEPTION 'SPS 2.1 seed blocked: estimated v0.1 revision already exists';
  END IF;
END;
$$;`;
}

function postflightSql(rows: ReturnType<typeof buildProjectRows>[]) {
  const targetList = TARGET_PROJECTS.map(sqlString).join(", ");
  const hashManifest = Object.fromEntries(rows.map((row) => [row.revisionRow.project_id, row.inputHash]));
  const outputManifest = Object.fromEntries(rows.map((row) => [row.revisionRow.project_id, {
    expectedValue: row.expectedValue,
    expectedQ: row.expectedQ,
    selectedActionId: row.expectedSelectedActionId,
  }]));
  return `DO $$
DECLARE
  valid_graph_count integer;
  valid_input_count integer;
  valid_evaluation_count integer;
  valid_hash_count integer;
  expected_hashes jsonb := ${sqlJson(hashManifest)};
  expected_outputs jsonb := ${sqlJson(outputManifest)};
BEGIN
  SELECT count(*) INTO valid_graph_count
  FROM public.bzm_2_1_model_revisions AS revisions
  WHERE revisions.project_id IN (${targetList})
    AND revisions.revision_key = ${sqlString(REVISION_KEY)}
    AND revisions.revision_order = 2
    AND revisions.data_mode = 'project'
    AND revisions.measurement_status = 'evaluated_hypothesis'
    AND revisions.forward_validation_count = 0
    AND (SELECT count(*) FROM public.bzm_2_1_decision_states s WHERE s.revision_id = revisions.revision_id) = 1
    AND (SELECT count(*) FROM public.bzm_2_1_actions a JOIN public.bzm_2_1_decision_states s ON s.state_id = a.state_id WHERE s.revision_id = revisions.revision_id) = 2
    AND (SELECT count(*) FROM public.bzm_2_1_transitions t JOIN public.bzm_2_1_actions a ON a.action_id = t.action_id JOIN public.bzm_2_1_decision_states s ON s.state_id = a.state_id WHERE s.revision_id = revisions.revision_id) = 3
    AND (SELECT count(*) FROM public.bzm_2_1_cashflow_events cf WHERE cf.revision_id = revisions.revision_id) = 13;
  IF valid_graph_count <> 12 THEN
    RAISE EXCEPTION 'SPS 2.1 seed blocked: graph/cashflow contract is incomplete';
  END IF;

  SELECT count(*) INTO valid_input_count
  FROM public.bzm_2_1_model_revisions AS revisions
  WHERE revisions.project_id IN (${targetList})
    AND revisions.revision_key = ${sqlString(REVISION_KEY)}
    AND (SELECT count(*) FROM public.bzm_2_1_input_observations i WHERE i.revision_id = revisions.revision_id) = 74
    AND (SELECT count(*) FROM public.bzm_2_1_input_observations i WHERE i.revision_id = revisions.revision_id AND i.scope_kind = 'revision') = 29
    AND (SELECT count(*) FROM public.bzm_2_1_input_observations i WHERE i.revision_id = revisions.revision_id AND i.scope_kind = 'revision' AND i.parameter_key = 'estimation_ratio_numeric_parameters' AND i.value_status = 'calculated') = 1
    AND (SELECT count(*) FROM public.bzm_2_1_input_observations i WHERE i.revision_id = revisions.revision_id AND i.scope_kind = 'revision' AND i.parameter_key = 'sensitivity_action_switch' AND i.value_status = 'calculated') = 1
    AND (SELECT count(*) FROM public.bzm_2_1_input_observations i WHERE i.revision_id = revisions.revision_id AND i.scope_kind = 'state') = 8
    AND (SELECT count(*) FROM public.bzm_2_1_input_observations i WHERE i.revision_id = revisions.revision_id AND i.scope_kind = 'action') = 22
    AND (SELECT count(*) FROM public.bzm_2_1_input_observations i WHERE i.revision_id = revisions.revision_id AND i.scope_kind = 'transition') = 15
    AND (SELECT count(*) FROM public.bzm_2_1_decision_states s WHERE s.revision_id = revisions.revision_id AND (SELECT count(*) FROM public.bzm_2_1_input_observations i WHERE i.revision_id = revisions.revision_id AND i.scope_kind = 'state' AND i.scope_key = s.state_key) = 8) = 1
    AND (SELECT count(*) FROM public.bzm_2_1_actions a JOIN public.bzm_2_1_decision_states s ON s.state_id = a.state_id WHERE s.revision_id = revisions.revision_id AND (SELECT count(*) FROM public.bzm_2_1_input_observations i WHERE i.revision_id = revisions.revision_id AND i.scope_kind = 'action' AND i.scope_key = s.state_key || '/' || a.action_key) = 11) = 2
    AND (SELECT count(*) FROM public.bzm_2_1_transitions t JOIN public.bzm_2_1_actions a ON a.action_id = t.action_id JOIN public.bzm_2_1_decision_states s ON s.state_id = a.state_id WHERE s.revision_id = revisions.revision_id AND (SELECT count(*) FROM public.bzm_2_1_input_observations i WHERE i.revision_id = revisions.revision_id AND i.scope_kind = 'transition' AND i.scope_key = s.state_key || '/' || a.action_key || '/' || t.transition_key) = 5) = 3;
  IF valid_input_count <> 12 THEN
    RAISE EXCEPTION 'SPS 2.1 seed blocked: required 27/8/11/5 input coverage is incomplete';
  END IF;

  SELECT count(*) INTO valid_evaluation_count
  FROM public.bzm_2_1_model_revisions AS revisions
  JOIN public.bzm_2_1_policy_evaluations AS company
    ON company.revision_id = revisions.revision_id
   AND company.objective_kind = 'company'
   AND company.policy_kind = 'optimized'
  WHERE revisions.project_id IN (${targetList})
    AND revisions.revision_key = ${sqlString(REVISION_KEY)}
    AND company.evaluation_status = 'computed'
    AND company.value_unit = 'million JPY'
    AND abs(company.expected_net_value - (expected_outputs -> revisions.project_id ->> 'expectedValue')::double precision) <= 0.000001
    AND abs(company.goal_probability - (expected_outputs -> revisions.project_id ->> 'expectedQ')::double precision) <= 0.000001
    AND company.selected_action_by_state_json ->> (
      SELECT states.state_id::text FROM public.bzm_2_1_decision_states states
      WHERE states.revision_id = revisions.revision_id AND states.is_initial
    ) = expected_outputs -> revisions.project_id ->> 'selectedActionId'
    AND (SELECT count(*) FROM public.bzm_2_1_policy_evaluations p WHERE p.revision_id = revisions.revision_id) = 6
    AND (SELECT count(*) FROM public.bzm_2_1_policy_evaluations p WHERE p.revision_id = revisions.revision_id AND p.objective_kind IN ('bzsf', 'public') AND p.evaluation_status = 'not_computable' AND p.expected_net_value IS NULL AND p.goal_probability IS NOT NULL AND p.selected_action_by_state_json <> '{}'::jsonb) = 4
    AND (SELECT count(*) FROM public.bzm_2_1_action_evaluations ae JOIN public.bzm_2_1_actions a ON a.action_id = ae.action_id JOIN public.bzm_2_1_decision_states s ON s.state_id = a.state_id WHERE s.revision_id = revisions.revision_id) = 6
    AND (SELECT count(*) FROM public.bzm_2_1_action_evaluations ae JOIN public.bzm_2_1_actions a ON a.action_id = ae.action_id JOIN public.bzm_2_1_decision_states s ON s.state_id = a.state_id WHERE s.revision_id = revisions.revision_id AND ae.objective_kind = 'company' AND ae.evaluation_status = 'computed') = 2
    AND (SELECT count(*) FROM public.bzm_2_1_action_evaluations ae JOIN public.bzm_2_1_actions a ON a.action_id = ae.action_id JOIN public.bzm_2_1_decision_states s ON s.state_id = a.state_id WHERE s.revision_id = revisions.revision_id AND ae.objective_kind IN ('bzsf', 'public') AND ae.evaluation_status = 'not_computable' AND ae.expected_net_value IS NULL AND ae.goal_probability IS NOT NULL) = 4;
  IF valid_evaluation_count <> 12 THEN
    RAISE EXCEPTION 'SPS 2.1 seed blocked: company/BZSF/public evaluation contract is incomplete';
  END IF;

  SELECT count(*) INTO valid_hash_count
  FROM public.bzm_2_1_model_revisions AS revisions
  WHERE revisions.project_id IN (${targetList})
    AND revisions.revision_key = ${sqlString(REVISION_KEY)}
    AND (SELECT count(*) FROM public.bzm_2_1_policy_evaluations p WHERE p.revision_id = revisions.revision_id AND p.input_hash = expected_hashes ->> revisions.project_id) = 6
    AND (SELECT count(*) FROM public.bzm_2_1_action_evaluations ae JOIN public.bzm_2_1_actions a ON a.action_id = ae.action_id JOIN public.bzm_2_1_decision_states s ON s.state_id = a.state_id WHERE s.revision_id = revisions.revision_id AND ae.input_hash = expected_hashes ->> revisions.project_id) = 6;
  IF valid_hash_count <> 12 THEN
    RAISE EXCEPTION 'SPS 2.1 seed blocked: canonical input hash mismatch';
  END IF;
END;
$$;

UPDATE public.sps_primary_model_registry AS registry
SET
  primary_model = 'sps_2_1',
  switch_status = 'active',
  active_bzm_2_1_revision_id = revisions.revision_id,
  switched_at = statement_timestamp(),
  switched_by = 'えいみ / SPS 2.1 estimated-v0.1 canonical seed',
  rollback_note = '12PJを単一transactionでlegacy_spsへ戻し、理由・実行者・時刻を別途記録する。旧表とarchiveは不変',
  updated_at = statement_timestamp()
FROM public.bzm_2_1_model_revisions AS revisions
WHERE revisions.project_id = registry.project_id
  AND revisions.revision_key = ${sqlString(REVISION_KEY)}
  AND registry.project_id IN (${targetList});

DO $$
DECLARE
  active_count integer;
  state_count integer;
BEGIN
  SELECT count(*) INTO active_count
  FROM public.sps_primary_model_registry AS registry
  JOIN public.bzm_2_1_model_revisions AS revisions
    ON revisions.project_id = registry.project_id
   AND revisions.revision_id = registry.active_bzm_2_1_revision_id
  WHERE registry.project_id IN (${targetList})
    AND registry.primary_model = 'sps_2_1'
    AND registry.switch_status = 'active'
    AND registry.switched_at IS NOT NULL
    AND revisions.revision_key = ${sqlString(REVISION_KEY)};
  SELECT count(DISTINCT (primary_model, switch_status)) INTO state_count
  FROM public.sps_primary_model_registry
  WHERE project_id IN (${targetList});
  IF active_count <> 12 OR state_count <> 1 THEN
    RAISE EXCEPTION 'SPS 2.1 primary switch was not atomic for all 12 projects';
  END IF;
END;
$$;`;
}

function buildMigration(artifact: Artifact, rows: ReturnType<typeof buildProjectRows>[]) {
  const generatedPayloadHash = createHash("sha256")
    .update(stableJson(rows.map((row) => ({
      projectId: row.revisionRow.project_id,
      revisionId: row.revisionRow.revision_id,
      inputHash: row.inputHash,
      expectedValue: row.expectedValue,
      expectedQ: row.expectedQ,
    }))))
    .digest("hex");
  return `-- 263_sps_2_1_estimated_v0_1.sql
-- Generated by pwa/scripts/generate_sps_2_1_estimated_seed.mts.
-- Artifact content hash: ${artifact.contentHashSha256}
-- Generated seed manifest hash: ${generatedPayloadHash}
--
-- 旧SPS/BZM 2.0表は更新・削除しない。262で作成済みの復元用archiveを
-- hash/count検査してから、12PJの低精度推定を追記し、最後の単一UPDATEで
-- primary registryをSPS 2.1へ切り替える。

BEGIN;

${preflightSql()}

${revisionSql(rows)}

${stateSql(rows)}

${actionSql(rows)}

${transitionSql(rows)}

${inputSql(rows)}

${cashflowSql(rows)}

${actionEvaluationSql(rows)}

${policySql(rows)}

${postflightSql(rows)}

COMMIT;
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const artifact = JSON.parse(await readFile(args.artifact, "utf8")) as Artifact;
  assert.deepEqual(
    artifact.projects.map((project) => project.projectId),
    [...TARGET_PROJECTS],
    "artifact project order/scope",
  );
  assert.equal(artifact.informationCutoff, CREATED_AT, "artifact cutoff");
  const rows = artifact.projects.map((project) => buildProjectRows(project, artifact));
  const migration = buildMigration(artifact, rows);
  const migrationHash = createHash("sha256").update(migration).digest("hex");
  if (args.check) {
    const current = await readFile(args.output, "utf8");
    assert.equal(current, migration, "generated migration is stale");
  } else {
    await writeFile(args.output, migration, "utf8");
  }
  process.stdout.write(JSON.stringify({
    status: args.check ? "verified" : "generated",
    output: args.output,
    projects: rows.length,
    revisionInputsPerProject: BZM21_REQUIRED_REVISION_INPUT_KEYS.length,
    optionalRevisionInputsPerProject: 2,
    stateInputsPerState: BZM21_REQUIRED_STATE_INPUT_KEYS.length,
    actionInputsPerAction: BZM21_REQUIRED_ACTION_INPUT_KEYS.length,
    transitionInputsPerTransition: BZM21_REQUIRED_TRANSITION_INPUT_KEYS.length,
    rowsPerProject: {
      states: 1,
      actions: 2,
      transitions: 3,
      cashflows: 13,
      inputs: 74,
      actionEvaluations: 6,
      policyEvaluations: 6,
    },
    perspectiveIndependentActionQRowsPerProject: 6,
    canonicalInputHashes: Object.fromEntries(rows.map((row) => [row.revisionRow.project_id, row.inputHash])),
    migrationSha256: migrationHash,
  }, null, 2) + "\n");
}

await main();
