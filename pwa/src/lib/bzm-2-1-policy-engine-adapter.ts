import { createHash } from "node:crypto";

import {
  BZM21_CASH_FLOW_CATEGORIES,
  BZM21_DYNAMIC_POLICY_SCHEMA,
  BZM21_EVIDENCE_KINDS,
  BZM21_OBJECTIVES,
  BZM21_TAX_TREATMENTS,
  validateBzm21DynamicPolicyModel,
  type Bzm21Action as EngineAction,
  type Bzm21ActionEvaluation as EngineActionEvaluation,
  type Bzm21BeliefState,
  type Bzm21CashFlowEvent as EngineCashFlowEvent,
  type Bzm21ConsentGate,
  type Bzm21DecisionController,
  type Bzm21DecisionGate,
  type Bzm21DecisionState as EngineDecisionState,
  type Bzm21DynamicPolicyEvaluation,
  type Bzm21DynamicPolicyModel,
  type Bzm21EvidenceKind,
  type Bzm21EvidenceRef,
  type Bzm21FinancingFeasibility,
  type Bzm21Intervention as EngineIntervention,
  type Bzm21InterventionEffect,
  type Bzm21Objective,
  type Bzm21ObjectiveAmounts,
  type Bzm21PolicyEvaluation as EnginePolicyEvaluation,
  type Bzm21ReachabilityHistory,
  type Bzm21TerminalOutcome,
  type Bzm21Transition as EngineTransition,
} from "./bzm-2-1-dynamic-policy.ts";
import {
  BZM21_COMPUTABLE_INPUT_STATUSES,
  BZM21_OBJECTIVE_KINDS,
  BZM21_REQUIRED_ACTION_INPUT_KEYS,
  BZM21_REQUIRED_REVISION_INPUT_KEYS,
  BZM21_REQUIRED_STATE_INPUT_KEYS,
  BZM21_REQUIRED_TRANSITION_INPUT_KEYS,
  bzm21RequiredActionInputValues,
  bzm21RequiredStateInputValues,
  bzm21RequiredTransitionInputValues,
  type Bzm21CashflowEvent,
  type Bzm21InputObservation,
  type Bzm21ModelRevision,
  type Bzm21PolicyModelLedger,
  type Bzm21PublicSocialBenefitComponent,
} from "./bzm-2-1-policy-model.ts";

type JsonObject = Record<string, unknown>;

export type Bzm21EngineAdapterResult =
  | {
      status: "ready";
      model: Bzm21DynamicPolicyModel;
      inputHash: string;
      warnings: string[];
    }
  | {
      status: "not_computable";
      model: null;
      diagnostics: string[];
    };

export type Bzm21PolicyEvaluationInsert = {
  revision_id: string;
  objective_kind: Bzm21Objective;
  policy_kind: "fixed_baseline" | "optimized";
  selection_objective: Bzm21Objective | null;
  evaluation_status: "computed" | "not_computable" | "decision_indeterminate";
  action_coverage_status: "complete" | "unknown";
  goal_probability: number | null;
  plan_deadline_goal_probability: number | null;
  conditional_goal_value: number | null;
  expected_net_value: number | null;
  value_difference_from_baseline: number | null;
  controller_option_value: number | null;
  value_unit: "million JPY" | null;
  expected_cumulative_funding_million_jpy: number | null;
  expected_failure_loss_million_jpy: number | null;
  expected_exit_value_million_jpy: number | null;
  expected_terminal_value_million_jpy: number | null;
  expected_cost_million_jpy: number | null;
  expected_benefit_million_jpy: number | null;
  public_aggregation_status: "not_applicable" | "not_computable" | "complete";
  public_fiscal_value_million_jpy: number | null;
  public_social_components_json: Bzm21PublicSocialBenefitComponent[];
  public_social_monetized_value_million_jpy: number | null;
  public_aggregated_value_million_jpy: number | null;
  public_aggregation_input_hash: string | null;
  controller_by_state_json: JsonObject;
  selected_action_by_state_json: Record<string, string>;
  state_decisions_json: unknown[];
  uncertainty_json: JsonObject;
  issues_json: unknown[];
  missing_inputs: string[];
  engine_version: string | null;
  input_hash: string | null;
  information_cutoff: string;
};

export type Bzm21ActionEvaluationInsert = {
  action_id: string;
  objective_kind: Bzm21Objective;
  selection_objective: Bzm21Objective | null;
  is_selected: boolean;
  exclusion_reason: string | null;
  evaluation_status: "computed" | "not_computable" | "decision_indeterminate";
  goal_probability: number | null;
  plan_deadline_goal_probability: number | null;
  conditional_goal_value: number | null;
  value_unit: "million JPY" | null;
  expected_cumulative_funding_million_jpy: number | null;
  expected_failure_loss_million_jpy: number | null;
  expected_exit_value_million_jpy: number | null;
  expected_terminal_value_million_jpy: number | null;
  expected_cost_million_jpy: number | null;
  expected_benefit_million_jpy: number | null;
  expected_net_value: number | null;
  public_aggregation_status: "not_applicable" | "not_computable" | "complete";
  public_fiscal_value_million_jpy: number | null;
  public_social_components_json: Bzm21PublicSocialBenefitComponent[];
  public_social_monetized_value_million_jpy: number | null;
  public_aggregated_value_million_jpy: number | null;
  public_aggregation_input_hash: string | null;
  uncertainty_json: JsonObject;
  issues_json: unknown[];
  missing_inputs: string[];
  engine_version: string | null;
  input_hash: string | null;
  information_cutoff: string;
};

export type Bzm21PublicValueDecomposition = {
  status: "not_computable" | "complete";
  fiscalValueMillionJpy: number | null;
  socialComponents: Bzm21PublicSocialBenefitComponent[];
  socialMonetizedValueMillionJpy: number | null;
  aggregatedValueMillionJpy: number | null;
  aggregationInputHash: string | null;
  issues: string[];
};

export type Bzm21SerializedDynamicPolicyRun = {
  policyEvaluations: Bzm21PolicyEvaluationInsert[];
  actionEvaluations: Bzm21ActionEvaluationInsert[];
};

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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
  const read = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value;
  const year = read("year");
  const month = read("month");
  const day = read("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function strings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : null;
}

function actionSequence(value: unknown): Array<string | string[]> | null {
  if (!Array.isArray(value)) return null;
  const result: Array<string | string[]> = [];
  for (const stage of value) {
    if (typeof stage === "string" && stage.trim() !== "") {
      result.push(stage);
      continue;
    }
    if (
      Array.isArray(stage) &&
      stage.length >= 2 &&
      stage.every((component) => typeof component === "string" && component.trim() !== "")
    ) {
      result.push(stage);
      continue;
    }
    return null;
  }
  return result;
}

function evidenceKind(value: unknown): value is Bzm21EvidenceKind {
  return (
    typeof value === "string" &&
    (BZM21_EVIDENCE_KINDS as readonly string[]).includes(value)
  );
}

function evidenceFromJson(value: unknown): Bzm21EvidenceRef | null {
  if (!isRecord(value)) return null;
  return evidenceKind(value.kind) &&
    typeof value.ref === "string" &&
    value.ref.trim() !== "" &&
    typeof value.informationCutoff === "string"
    ? {
        kind: value.kind,
        ref: value.ref,
        informationCutoff: value.informationCutoff,
      }
    : null;
}

function containsSyntheticEvidence(value: unknown, valueIsEvidence = false): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => containsSyntheticEvidence(entry));
  }
  if (!isRecord(value)) return false;
  if (valueIsEvidence && value.kind === "synthetic") return true;
  return Object.entries(value).some(([key, entry]) =>
    containsSyntheticEvidence(entry, key === "evidence"),
  );
}

function evidenceFromInput(input: Bzm21InputObservation | undefined) {
  if (
    !input ||
    !evidenceKind(input.evidenceKind) ||
    !input.evidenceRef ||
    ["missing", "not_started"].includes(input.valueStatus)
  ) {
    return null;
  }
  return {
    kind: input.evidenceKind,
    ref: input.evidenceRef,
    informationCutoff: input.informationCutoff,
  } satisfies Bzm21EvidenceRef;
}

function objectiveAmountsFromJson(value: unknown): Bzm21ObjectiveAmounts | null {
  if (!isRecord(value)) return null;
  const result = {} as Bzm21ObjectiveAmounts;
  for (const objective of BZM21_OBJECTIVES) {
    const amount = value[objective];
    if (amount !== null && !isFiniteNumber(amount)) return null;
    result[objective] = amount as number | null;
  }
  return result;
}

type Bzm21TaxBasis =
  | "pre_tax_plus_explicit_tax_payments"
  | "post_tax_inclusive"
  | "tax_exempt";

function taxBasisByObjective(value: unknown): Record<Bzm21Objective, Bzm21TaxBasis> | null {
  if (!isRecord(value)) return null;
  const result = {} as Record<Bzm21Objective, Bzm21TaxBasis>;
  for (const objective of BZM21_OBJECTIVES) {
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

function perspectiveAttribution(
  event: Bzm21CashflowEvent,
  objective: Bzm21Objective,
) {
  const entry = event.perspectiveAttribution[objective];
  if (!isRecord(entry) || typeof entry.included !== "boolean") return null;
  if (entry.included === false) {
    return entry.sign === null ? { included: false as const, sign: null } : null;
  }
  return entry.sign === 1 || entry.sign === -1
    ? { included: true as const, sign: entry.sign }
    : null;
}

export function mapBzm21CashflowEventToEngine(
  event: Bzm21CashflowEvent,
): { event: EngineCashFlowEvent | null; diagnostics: string[] } {
  const diagnostics: string[] = [];
  if (!(BZM21_CASH_FLOW_CATEGORIES as readonly string[]).includes(event.includedIn)) {
    return {
      event: null,
      diagnostics: [`${event.eventKey}: 価値計算外のCF区分`],
    };
  }
  if (!event.stateId || !event.actionId) {
    diagnostics.push(`${event.eventKey}: 状態IDまたは行動IDが欠測`);
  }
  const immediate = ["immediate_cost", "immediate_benefit"].includes(
    event.includedIn,
  );
  if (immediate ? event.transitionId !== null : !event.transitionId) {
    diagnostics.push(`${event.eventKey}: 集計区分と遷移IDが不一致`);
  }
  if (
    (immediate && event.timingKind !== "action_start") ||
    (!immediate && event.timingKind !== "action_end")
  ) {
    diagnostics.push(`${event.eventKey}: 集計区分と計上時点が不一致`);
  }
  const structuredNotApplicable =
    event.valueStatus === "not_applicable" &&
    event.modelAmountMillionJpy === null &&
    Boolean(event.note?.trim()) &&
    BZM21_OBJECTIVES.every(
      (objective) => perspectiveAttribution(event, objective)?.included === false,
    );
  if (event.nominalOrReal !== "nominal" && !structuredNotApplicable) {
    diagnostics.push(`${event.eventKey}: 最小計算契約は名目額のみ`);
  }
  if (!(BZM21_TAX_TREATMENTS as readonly string[]).includes(event.taxTreatment)) {
    diagnostics.push(`${event.eventKey}: 税区分が計算契約外`);
  }
  const eventCutoffDate = dateInJst(event.informationCutoff);
  if (event.currency === "JPY" && event.amount !== null) {
    const expected = event.amount / 1_000_000;
    if (
      event.modelAmountMillionJpy === null ||
      Math.abs(event.modelAmountMillionJpy - expected) >
        Math.max(1e-9, Math.abs(expected) * 1e-9)
    ) {
      diagnostics.push(`${event.eventKey}: 円原額とモデル額が不一致`);
    }
  }
  if (event.currency !== "JPY" && !structuredNotApplicable) {
    if (
      event.amount === null ||
      event.modelAmountMillionJpy === null ||
      event.conversionRateToJpy === null ||
      event.conversionRateToJpy <= 0 ||
      !event.conversionRateDate ||
      !event.conversionRateSourceRef ||
      !event.conversionRuleRef
    ) {
      diagnostics.push(`${event.eventKey}: 為替換算契約が未完了`);
    } else {
      const expected =
        (event.amount * event.conversionRateToJpy) / 1_000_000;
      if (
        Math.abs(event.modelAmountMillionJpy - expected) >
        Math.max(1e-9, Math.abs(expected) * 1e-9)
      ) {
        diagnostics.push(`${event.eventKey}: 為替換算後のモデル額が不一致`);
      }
      if (!eventCutoffDate || event.conversionRateDate > eventCutoffDate) {
        diagnostics.push(`${event.eventKey}: 為替換算日が事象の情報締切を超えている`);
      }
    }
  }
  if (event.evidenceKind === "none" || !event.evidenceRef) {
    diagnostics.push(`${event.eventKey}: 計算根拠が欠測`);
  }
  const evidence =
    evidenceKind(event.evidenceKind) && event.evidenceRef
      ? {
          kind: event.evidenceKind,
          ref: event.evidenceRef,
          informationCutoff: event.informationCutoff,
        }
      : null;
  const objectiveAmounts = {} as Bzm21ObjectiveAmounts;
  for (const objective of BZM21_OBJECTIVES) {
    const attribution = perspectiveAttribution(event, objective);
    if (!attribution) {
      diagnostics.push(`${event.eventKey}: ${objective}視点の帰属が不正`);
      objectiveAmounts[objective] = null;
      continue;
    }
    if (!attribution.included) {
      objectiveAmounts[objective] = 0;
      continue;
    }
    const requiredSign =
      event.includedIn === "immediate_benefit"
        ? 1
        : event.includedIn === "immediate_cost" ||
            event.includedIn === "failure_loss"
          ? -1
          : null;
    if (requiredSign !== null && attribution.sign !== requiredSign) {
      diagnostics.push(
        `${event.eventKey}: ${objective}視点の符号と集計区分が不一致`,
      );
      objectiveAmounts[objective] = null;
      continue;
    }
    if (objective === "public") {
      if (event.publicAggregationStatus !== "complete") {
        objectiveAmounts.public = null;
        continue;
      }
      if (
        event.publicFiscalAmountMillionJpy === null ||
        event.publicSocialConvertedAmountMillionJpy === null ||
        event.publicAggregatedAmountMillionJpy === null ||
        !event.publicAggregationInputHash ||
        !/^[0-9a-f]{64}$/.test(event.publicAggregationInputHash)
      ) {
        diagnostics.push(`${event.eventKey}: 公的価値の分離集約契約が未完了`);
        objectiveAmounts.public = null;
        continue;
      }
      const scalar = event.publicAggregatedAmountMillionJpy;
      if (scalar !== 0 && Math.sign(scalar) !== attribution.sign) {
        diagnostics.push(`${event.eventKey}: 公的集約額の符号と帰属が不一致`);
        objectiveAmounts.public = null;
        continue;
      }
      objectiveAmounts.public =
        event.includedIn === "immediate_cost" ||
        event.includedIn === "immediate_benefit" ||
        event.includedIn === "failure_loss"
          ? Math.abs(scalar)
          : scalar;
      continue;
    }
    if (event.modelAmountMillionJpy === null) {
      objectiveAmounts[objective] = null;
      continue;
    }
    objectiveAmounts[objective] =
      event.includedIn === "transition_cash_flow" ||
      event.includedIn === "terminal_value"
        ? event.modelAmountMillionJpy * attribution.sign
        : event.modelAmountMillionJpy;
  }
  if (diagnostics.length > 0 || !evidence || !event.stateId || !event.actionId) {
    return { event: null, diagnostics };
  }
  return {
    event: {
      eventId: event.cashflowEventId,
      label: event.label,
      stateId: event.stateId,
      actionId: event.actionId,
      transitionId: event.transitionId,
      timing: event.timingKind,
      includedIn: event.includedIn as EngineCashFlowEvent["includedIn"],
      economicNature: event.economicNature,
      objectiveAmountsMillionJpy: objectiveAmounts,
      owner: event.ownerRef,
      counterparty: event.counterpartyRef,
      scope: stableJson({
        scopeKey: event.scopeKey,
        nominalOrReal: event.nominalOrReal,
        priceBaseDate: event.priceBaseDate,
        taxTreatment: event.taxTreatment,
        taxSubjectRef: event.taxSubjectRef,
        semanticDuplicateReviewRef: event.semanticDuplicateReviewRef,
      }),
      amountBasis: "nominal",
      taxTreatment: event.taxTreatment as EngineCashFlowEvent["taxTreatment"],
      evidence,
    },
    diagnostics: [],
  };
}

function sumCashflowCategory(
  events: EngineCashFlowEvent[],
  eventIds: string[],
  category: EngineCashFlowEvent["includedIn"],
): Bzm21ObjectiveAmounts {
  const result: Bzm21ObjectiveAmounts = { company: 0, bzsf: 0, public: 0 };
  const byId = new Map(events.map((event) => [event.eventId, event]));
  for (const eventId of eventIds) {
    const event = byId.get(eventId);
    if (!event || event.includedIn !== category) continue;
    for (const objective of BZM21_OBJECTIVES) {
      const amount = event.objectiveAmountsMillionJpy[objective];
      result[objective] =
        result[objective] === null || amount === null
          ? null
          : result[objective] + amount;
    }
  }
  return result;
}

function objectiveAmountsCacheMatches(
  cache: unknown,
  derived: Bzm21ObjectiveAmounts,
) {
  if (!isRecord(cache)) return false;
  return BZM21_OBJECTIVES.every((objective) => {
    const raw = cache[objective];
    const expected = derived[objective];
    if (raw === null || expected === null) return raw === expected;
    return (
      isFiniteNumber(raw) &&
      Math.abs(raw - expected) <= Math.max(1e-9, Math.abs(expected) * 1e-9)
    );
  });
}

function gateFromJson(value: unknown): Bzm21DecisionGate | null {
  if (!isRecord(value)) return null;
  const evidence = evidenceFromJson(value.evidence);
  return ["confirmed", "blocked", "unknown", "not_required"].includes(
    String(value.status),
  ) && typeof value.note === "string" && evidence
    ? {
        status: value.status as Bzm21DecisionGate["status"],
        note: value.note,
        evidence,
      }
    : null;
}

function consentFromJson(value: unknown): Bzm21ConsentGate | null {
  if (!isRecord(value)) return null;
  const gate = gateFromJson(value);
  return gate &&
    typeof value.consentId === "string" &&
    typeof value.label === "string"
    ? { ...gate, consentId: value.consentId, label: value.label }
    : null;
}

function financingFromJson(value: unknown): Bzm21FinancingFeasibility | null {
  if (!isRecord(value)) return null;
  const evidence = evidenceFromJson(value.evidence);
  const amount = value.committedFundingMillionJpy;
  const openingCash = value.openingCashMillionJpy;
  const requiredSchedule = Array.isArray(value.requiredFundingSchedule)
    ? value.requiredFundingSchedule
    : null;
  const committedSchedule = Array.isArray(value.committedFundingSchedule)
    ? value.committedFundingSchedule
    : null;
  const mappedRequired = requiredSchedule?.flatMap((row) => {
    if (!isRecord(row)) return [];
    const rowEvidence = evidenceFromJson(row.evidence);
    return typeof row.scheduleId === "string" &&
      (row.atMonths === null || isFiniteNumber(row.atMonths)) &&
      (row.amountMillionJpy === null || isFiniteNumber(row.amountMillionJpy)) &&
      typeof row.purpose === "string" &&
      rowEvidence
      ? [{
          scheduleId: row.scheduleId,
          atMonths: row.atMonths as number | null,
          amountMillionJpy: row.amountMillionJpy as number | null,
          purpose: row.purpose,
          evidence: rowEvidence,
        }]
      : [];
  });
  const mappedCommitted = committedSchedule?.flatMap((row) => {
    if (!isRecord(row)) return [];
    const rowEvidence = evidenceFromJson(row.evidence);
    const purposes = strings(row.permittedPurposes);
    return typeof row.scheduleId === "string" &&
      (row.atMonths === null || isFiniteNumber(row.atMonths)) &&
      (row.amountMillionJpy === null || isFiniteNumber(row.amountMillionJpy)) &&
      purposes &&
      rowEvidence
      ? [{
          scheduleId: row.scheduleId,
          atMonths: row.atMonths as number | null,
          amountMillionJpy: row.amountMillionJpy as number | null,
          permittedPurposes: purposes,
          evidence: rowEvidence,
        }]
      : [];
  });
  return [
    "secured",
    "contracted",
    "not_required",
    "conditional",
    "uncontracted",
    "blocked",
    "unknown",
  ].includes(String(value.status)) &&
    (openingCash === null || isFiniteNumber(openingCash)) &&
    (amount === null || isFiniteNumber(amount)) &&
    requiredSchedule !== null &&
    committedSchedule !== null &&
    mappedRequired?.length === requiredSchedule.length &&
    mappedCommitted?.length === committedSchedule.length &&
    typeof value.note === "string" &&
    evidence
    ? {
        status: value.status as Bzm21FinancingFeasibility["status"],
        openingCashMillionJpy: openingCash as number | null,
        committedFundingMillionJpy: amount as number | null,
        requiredFundingSchedule: mappedRequired ?? [],
        committedFundingSchedule: mappedCommitted ?? [],
        note: value.note,
        evidence,
      }
    : null;
}

function beliefFromJson(value: unknown): Bzm21BeliefState | null {
  if (!isRecord(value) || !Array.isArray(value.possibleValues)) return null;
  const evidence = evidenceFromJson(value.evidence);
  const possibleValues = value.possibleValues.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.value !== "string") return [];
    return entry.probability === null || isFiniteNumber(entry.probability)
      ? [{ value: entry.value, probability: entry.probability as number | null }]
      : [];
  });
  return typeof value.beliefId === "string" &&
    typeof value.label === "string" &&
    possibleValues.length === value.possibleValues.length &&
    evidence
    ? { beliefId: value.beliefId, label: value.label, possibleValues, evidence }
    : null;
}

function sharedResourceFromJson(
  value: unknown,
): EngineAction["sharedResourceRequirements"][number] | null {
  if (!isRecord(value)) return null;
  const evidence = evidenceFromJson(value.evidence);
  return typeof value.resourceId === "string" &&
    (value.amount === null || isFiniteNumber(value.amount)) &&
    typeof value.unit === "string" &&
    evidence
    ? {
        resourceId: value.resourceId,
        amount: value.amount as number | null,
        unit: value.unit,
        evidence,
      }
    : null;
}

function controllerFromJson(value: unknown): Bzm21DecisionController | null {
  if (!isRecord(value)) return null;
  const evidence = evidenceFromJson(value.evidence);
  return typeof value.controllerId === "string" &&
    ["company", "bzsf", "public", "joint", "external"].includes(
      String(value.kind),
    ) &&
    (value.objective === null ||
      (typeof value.objective === "string" &&
        (BZM21_OBJECTIVES as readonly string[]).includes(value.objective))) &&
    evidence
    ? {
        controllerId: value.controllerId,
        kind: value.kind as Bzm21DecisionController["kind"],
        objective: value.objective as Bzm21Objective | null,
        evidence,
      }
    : null;
}

function reachabilityFromJson(value: unknown): Bzm21ReachabilityHistory | null {
  if (!isRecord(value) || !isRecord(value.goal) || !isRecord(value.strategicSlack)) {
    return null;
  }
  const goal = value.goal;
  const slack = value.strategicSlack;
  const goalEvidence = evidenceFromJson(goal.evidence);
  const slackEvidence = evidenceFromJson(slack.evidence);
  if (
    !["not_reached", "reached", "unknown"].includes(String(goal.status)) ||
    !["available", "lost", "unknown"].includes(String(slack.status)) ||
    !(goal.firstReachedAtMonths === null || isFiniteNumber(goal.firstReachedAtMonths)) ||
    !(slack.firstLostAtMonths === null || isFiniteNumber(slack.firstLostAtMonths)) ||
    !goalEvidence ||
    !slackEvidence
  ) {
    return null;
  }
  return {
    goal: {
      status: goal.status as Bzm21ReachabilityHistory["goal"]["status"],
      firstReachedAtMonths: goal.firstReachedAtMonths as number | null,
      evidence: goalEvidence,
    },
    strategicSlack: {
      status: slack.status as Bzm21ReachabilityHistory["strategicSlack"]["status"],
      firstLostAtMonths: slack.firstLostAtMonths as number | null,
      evidence: slackEvidence,
    },
  };
}

function currentStateFromJson(value: JsonObject) {
  return Object.values(value).every(
    (entry) =>
      entry === null ||
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean",
  )
    ? (value as EngineDecisionState["currentState"])
    : null;
}

function interventionEffectsFromJson(value: unknown): Bzm21InterventionEffect[] | null {
  if (!Array.isArray(value)) return null;
  const effects: Bzm21InterventionEffect[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.stateId !== "string" || typeof raw.actionId !== "string") {
      return null;
    }
    const effect: Bzm21InterventionEffect = {
      stateId: raw.stateId,
      actionId: raw.actionId,
    };
    if ("requiredFundingDeltaMillionJpy" in raw) {
      if (raw.requiredFundingDeltaMillionJpy !== null && !isFiniteNumber(raw.requiredFundingDeltaMillionJpy)) {
        return null;
      }
      effect.requiredFundingDeltaMillionJpy = raw.requiredFundingDeltaMillionJpy as number | null;
    }
    if ("committedFundingDeltaMillionJpy" in raw) {
      if (raw.committedFundingDeltaMillionJpy !== null && !isFiniteNumber(raw.committedFundingDeltaMillionJpy)) {
        return null;
      }
      effect.committedFundingDeltaMillionJpy = raw.committedFundingDeltaMillionJpy as number | null;
    }
    for (const [key, target] of [
      ["requiredFundingScheduleDeltas", "requiredFundingScheduleDeltas"],
      ["committedFundingScheduleDeltas", "committedFundingScheduleDeltas"],
    ] as const) {
      if (!(key in raw)) continue;
      const rows = raw[key];
      if (!Array.isArray(rows)) return null;
      const mapped = rows.flatMap((entry) =>
        isRecord(entry) &&
        typeof entry.scheduleId === "string" &&
        (entry.amountDeltaMillionJpy === null || isFiniteNumber(entry.amountDeltaMillionJpy))
          ? [{
              scheduleId: entry.scheduleId,
              amountDeltaMillionJpy: entry.amountDeltaMillionJpy as number | null,
            }]
          : [],
      );
      if (mapped.length !== rows.length) return null;
      effect[target] = mapped;
    }
    if ("cashFlowEventDeltas" in raw) {
      if (!Array.isArray(raw.cashFlowEventDeltas)) return null;
      // v0.1では金銭支援を単一CF事象と同じowner/税/時点/根拠契約なしに
      // 上書きできない。空配列以外は呼出側をnot_computableへ止める。
      if (raw.cashFlowEventDeltas.length > 0) return null;
      effect.cashFlowEventDeltas = raw.cashFlowEventDeltas.flatMap((entry) => {
        if (!isRecord(entry) || typeof entry.eventId !== "string") return [];
        const amounts = objectiveAmountsFromJson(entry.amountDeltaMillionJpy);
        return amounts
          ? [{ eventId: entry.eventId, amountDeltaMillionJpy: amounts }]
          : [];
      });
      if (effect.cashFlowEventDeltas.length !== raw.cashFlowEventDeltas.length) return null;
    }
    if ("transitions" in raw) {
      if (!Array.isArray(raw.transitions)) return null;
      effect.transitions = raw.transitions.flatMap((entry) => {
        if (!isRecord(entry) || typeof entry.transitionId !== "string") return [];
        if (
          entry.probabilityDelta !== undefined &&
          entry.probabilityDelta !== null &&
          !isFiniteNumber(entry.probabilityDelta)
        ) {
          return [];
        }
        return [{
          transitionId: entry.transitionId,
          ...(entry.probabilityDelta === undefined
            ? {}
            : { probabilityDelta: entry.probabilityDelta as number | null }),
        }];
      });
      if (effect.transitions.length !== raw.transitions.length) return null;
    }
    effects.push(effect);
  }
  return effects;
}

function findRevisionInput(
  ledger: Bzm21PolicyModelLedger,
  parameterKey: string,
) {
  return ledger.revisionInputs.find((input) => input.parameterKey === parameterKey);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeBzm21PublicAggregationInputHash(
  event: Bzm21CashflowEvent,
  revision: Bzm21ModelRevision,
) {
  return createHash("sha256")
    .update(
      stableJson({
        eventKey: event.eventKey,
        fiscalAmountMillionJpy: event.publicFiscalAmountMillionJpy,
        socialBenefitVector: event.publicSocialBenefitVector,
        socialConvertedAmountMillionJpy:
          event.publicSocialConvertedAmountMillionJpy,
        aggregatedAmountMillionJpy: event.publicAggregatedAmountMillionJpy,
        transferTreatment: event.publicTransferTreatment,
        transferDeduplicationRef: event.publicTransferDeduplicationRef,
        semanticDuplicateReviewRef: event.semanticDuplicateReviewRef,
        nominalOrReal: event.nominalOrReal,
        priceBaseDate: event.priceBaseDate,
        taxTreatment: event.taxTreatment,
        taxSubjectRef: event.taxSubjectRef,
        fiscalRuleRef: revision.publicFiscalRuleRef,
        socialMandateRef: revision.publicSocialMandateRef,
        socialConversionRuleRef: revision.publicSocialConversionRuleRef,
        aggregationRuleRef: revision.publicAggregationRuleRef,
      }),
    )
    .digest("hex");
}

export function computeBzm21PolicyLedgerInputHash(
  ledger: Bzm21PolicyModelLedger,
) {
  const revision = ledger.currentRevision;
  if (!revision) return null;
  const canonicalInput = (input: Bzm21InputObservation) => ({
    scopeKind: input.scopeKind,
    scopeKey: input.scopeKey,
    parameterKey: input.parameterKey,
    symbol: input.symbol,
    value: input.value,
    valueStatus: input.valueStatus,
    unit: input.unit,
    evidenceKind: input.evidenceKind,
    evidenceRef: input.evidenceRef,
    informationCutoff: input.informationCutoff,
    condition: input.condition,
    note: input.note,
  });
  const canonicalAction = (action: Bzm21PolicyModelLedger["states"][number]["actions"][number]) => ({
    actionId: action.actionId,
    stateId: action.stateId,
    actionKey: action.actionKey,
    bundleId: action.bundleId,
    actionType: action.actionType,
    componentTypes: action.componentTypes,
    customComponents: action.customComponents,
    sequence: action.sequence,
    sharedResources: action.sharedResources,
    label: action.label,
    actionOrder: action.actionOrder,
    availabilityStatus: action.availabilityStatus,
    availabilityReason: action.availabilityReason,
    feasibilityGate: action.feasibilityGate,
    authorityGate: action.authorityGate,
    consents: action.consents,
    financingFeasibility: action.financingFeasibility,
    durationMonths: action.durationMonths,
    immediateCostByObjective: action.immediateCostByObjective,
    immediateBenefitByObjective: action.immediateBenefitByObjective,
    requiredFundingMillionJpy: action.requiredFundingMillionJpy,
    cashflowEventKeys: [...action.cashflowEventKeys].sort(),
    informationGain: action.informationGain,
    evidence: action.evidence,
    inputs: action.inputs.map(canonicalInput).sort((a, b) =>
      a.parameterKey.localeCompare(b.parameterKey),
    ),
    transitions: action.transitions.map((transition) => ({
      transitionId: transition.transitionId,
      actionId: transition.actionId,
      transitionKey: transition.transitionKey,
      label: transition.label,
      nextStateId: transition.nextStateId,
      terminalOutcome: transition.terminalOutcome,
      probability: transition.probability,
      goalReachedAtMonths: transition.goalReachedAtMonths,
      slackLostAtMonths: transition.slackLostAtMonths,
      transitionCashFlowByObjective: transition.transitionCashFlowByObjective,
      terminalValueByObjective: transition.terminalValueByObjective,
      failureLossByObjective: transition.failureLossByObjective,
      cashflowEventKeys: [...transition.cashflowEventKeys].sort(),
      evidence: transition.evidence,
      transitionOrder: transition.transitionOrder,
      inputs: transition.inputs.map(canonicalInput).sort((a, b) =>
        a.parameterKey.localeCompare(b.parameterKey),
      ),
    })),
  });
  const canonicalRevision = { ...revision, createdAt: undefined };
  const payload = {
    projectId: ledger.projectId,
    revision: canonicalRevision,
    revisionInputs: ledger.revisionInputs
      .map(canonicalInput)
      .sort((a, b) => a.parameterKey.localeCompare(b.parameterKey)),
    states: ledger.states.map((state) => ({
      stateId: state.stateId,
      revisionId: state.revisionId,
      stateKey: state.stateKey,
      label: state.label,
      decisionOrder: state.decisionOrder,
      isInitial: state.isInitial,
      elapsedMonths: state.elapsedMonths,
      currentState: state.currentState,
      beliefs: state.beliefs,
      reachabilityHistory: state.reachabilityHistory,
      decisionController: state.decisionController,
      sunkCostMillionJpy: state.sunkCostMillionJpy,
      remainingCostMillionJpy: state.remainingCostMillionJpy,
      remainingTimeMonths: state.remainingTimeMonths,
      availableInformation: state.availableInformation,
      evidence: state.evidence,
      inputs: state.inputs.map(canonicalInput).sort((a, b) =>
        a.parameterKey.localeCompare(b.parameterKey),
      ),
      actions: state.actions.map(canonicalAction),
    })),
    interventions: ledger.interventions.map((intervention) => ({
      interventionId: intervention.interventionId,
      revisionId: intervention.revisionId,
      interventionKey: intervention.interventionKey,
      label: intervention.label,
      enabled: intervention.enabled,
      effects: intervention.effects,
      evidence: intervention.evidence,
      inputs: intervention.inputs.map(canonicalInput).sort((a, b) =>
        a.parameterKey.localeCompare(b.parameterKey),
      ),
    })),
    cashflowEvents: [...ledger.cashflowEvents]
      .sort((a, b) => a.eventKey.localeCompare(b.eventKey))
      .map((event) => ({ ...event, createdAt: undefined })),
  };
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}

function inputMatches(input: Bzm21InputObservation, expected: unknown) {
  return stableJson(input.value) === stableJson(expected);
}

function scopedInputDiagnostics(args: {
  scopeLabel: string;
  inputs: Bzm21InputObservation[];
  requiredKeys: readonly string[];
  expectedValues: Record<string, unknown>;
  revisionInformationCutoff: string;
}): string[] {
  const diagnostics: string[] = [];
  const inputRowsByKey = new Map<string, Bzm21InputObservation[]>();
  for (const input of args.inputs) {
    inputRowsByKey.set(input.parameterKey, [
      ...(inputRowsByKey.get(input.parameterKey) ?? []),
      input,
    ]);
  }
  const revisionCutoff = Date.parse(args.revisionInformationCutoff);
  for (const parameterKey of args.requiredKeys) {
    const matchingRows = inputRowsByKey.get(parameterKey) ?? [];
    const input = matchingRows[0];
    const inputLabel = `${args.scopeLabel}/${parameterKey}`;
    if (!input) {
      diagnostics.push(`${inputLabel}: scope必須入力行が未登録`);
      continue;
    }
    if (matchingRows.length !== 1) {
      diagnostics.push(`${inputLabel}: scope必須入力行が重複`);
    }
    if (
      !(BZM21_COMPUTABLE_INPUT_STATUSES as readonly string[]).includes(
        input.valueStatus,
      )
    ) {
      diagnostics.push(`${inputLabel}: scope必須入力が未完了`);
    }
    if (
      ![
        "calculation",
        "document",
        "record",
        "structured_hearing",
        "mixed",
      ].includes(input.evidenceKind) ||
      !input.evidenceRef?.trim()
    ) {
      diagnostics.push(`${inputLabel}: scope必須入力に根拠がない`);
    }
    const inputCutoff = Date.parse(input.informationCutoff);
    if (
      !Number.isFinite(inputCutoff) ||
      !Number.isFinite(revisionCutoff) ||
      inputCutoff > revisionCutoff
    ) {
      diagnostics.push(`${inputLabel}: scope必須入力が情報締切を超える`);
    }
    if (
      input.valueStatus === "conditional" &&
      Object.keys(input.condition).length === 0
    ) {
      diagnostics.push(`${inputLabel}: 条件付きscope入力に条件がない`);
    }
    if (!inputMatches(input, args.expectedValues[parameterKey])) {
      diagnostics.push(`${inputLabel}: 入力台帳と型付きフィールドが不一致`);
    }
  }
  return diagnostics;
}

export function buildBzm21DynamicPolicyModelFromLedger(
  ledger: Bzm21PolicyModelLedger,
): Bzm21EngineAdapterResult {
  const diagnostics = [...ledger.diagnostics];
  const revision = ledger.currentRevision;
  if (!revision) {
    return {
      status: "not_computable",
      model: null,
      diagnostics: ["BZM 2.1の評価版が未登録"],
    };
  }

  if (revision.dataMode === "project") {
    for (const input of ledger.revisionInputs) {
      if (input.evidenceKind === "synthetic") {
        diagnostics.push(`${input.parameterKey}: 実PJ版に合成入力を使用できない`);
      }
    }
    for (const event of ledger.cashflowEvents) {
      if (
        event.evidenceKind === "synthetic" ||
        containsSyntheticEvidence(event.publicSocialBenefitVector)
      ) {
        diagnostics.push(`${event.eventKey}: 実PJ版に合成CF根拠を使用できない`);
      }
    }
    for (const [label, value] of [
      ["価値規則", revision.valuationRuleByObjective],
      ["判断基準", revision.decisionCriterionByObjective],
      ["同率規則", revision.tieBreakRule],
      ["不確実性規則", revision.uncertaintyRule],
    ] as const) {
      if (containsSyntheticEvidence(value)) {
        diagnostics.push(`${label}: 実PJ版に合成根拠を使用できない`);
      }
    }
    for (const state of ledger.states) {
      if (
        containsSyntheticEvidence({ evidence: state.evidence }) ||
        containsSyntheticEvidence(state.beliefs) ||
        containsSyntheticEvidence(state.reachabilityHistory) ||
        containsSyntheticEvidence(state.decisionController)
      ) {
        diagnostics.push(`${state.stateKey}: 実PJ版に合成状態根拠を使用できない`);
      }
      for (const action of state.actions) {
        if (
          containsSyntheticEvidence({ evidence: action.evidence }) ||
          containsSyntheticEvidence(action.sharedResources) ||
          containsSyntheticEvidence(action.feasibilityGate) ||
          containsSyntheticEvidence(action.authorityGate) ||
          containsSyntheticEvidence(action.consents) ||
          containsSyntheticEvidence(action.financingFeasibility) ||
          action.transitions.some((transition) =>
            containsSyntheticEvidence({ evidence: transition.evidence }),
          )
        ) {
          diagnostics.push(`${action.actionKey}: 実PJ版に合成行動根拠を使用できない`);
        }
      }
    }
    for (const intervention of ledger.interventions) {
      if (containsSyntheticEvidence({ evidence: intervention.evidence })) {
        diagnostics.push(
          `${intervention.interventionKey}: 実PJ版に合成支援根拠を使用できない`,
        );
      }
    }
    for (const state of ledger.states) {
      diagnostics.push(
        ...scopedInputDiagnostics({
          scopeLabel: state.stateKey,
          inputs: state.inputs,
          requiredKeys: BZM21_REQUIRED_STATE_INPUT_KEYS,
          expectedValues: bzm21RequiredStateInputValues(state),
          revisionInformationCutoff: revision.informationCutoff,
        }),
      );
      for (const action of state.actions) {
        const actionPath = `${state.stateKey}/${action.actionKey}`;
        diagnostics.push(
          ...scopedInputDiagnostics({
            scopeLabel: actionPath,
            inputs: action.inputs,
            requiredKeys: BZM21_REQUIRED_ACTION_INPUT_KEYS,
            expectedValues: bzm21RequiredActionInputValues(action),
            revisionInformationCutoff: revision.informationCutoff,
          }),
        );
        for (const transition of action.transitions) {
          diagnostics.push(
            ...scopedInputDiagnostics({
              scopeLabel: `${actionPath}/${transition.transitionKey}`,
              inputs: transition.inputs,
              requiredKeys: BZM21_REQUIRED_TRANSITION_INPUT_KEYS,
              expectedValues: bzm21RequiredTransitionInputValues(transition),
              revisionInformationCutoff: revision.informationCutoff,
            }),
          );
        }
      }
    }
  }

  const engineEvents: EngineCashFlowEvent[] = [];
  const eventIdByKey = new Map<string, string>();
  const ledgerEventById = new Map(
    ledger.cashflowEvents.map((event) => [event.cashflowEventId, event]),
  );
  const transferGroups = new Map<string, Bzm21CashflowEvent[]>();
  for (const event of ledger.cashflowEvents) {
    const includedObjectives = BZM21_OBJECTIVES.filter(
      (objective) => perspectiveAttribution(event, objective)?.included === true,
    );
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
        diagnostics.push(`${event.eventKey}: 経済事象groupの視点脚が不正`);
      }
    } else {
      const signs = new Set(
        includedObjectives.map(
          (objective) => perspectiveAttribution(event, objective)?.sign,
        ),
      );
      if (event.perspectiveLeg !== null || signs.size > 1) {
        diagnostics.push(`${event.eventKey}: groupなしの反対符号または視点脚`);
      }
    }
  }
  for (const [groupKey, events] of transferGroups) {
    if (events.length < 2 || new Set(events.map((event) => event.perspectiveLeg)).size !== events.length) {
      diagnostics.push(`${groupKey}: 経済事象groupの視点脚が欠測または重複`);
    }
    const signatures = new Set(
      events.map((event) =>
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
        }),
      ),
    );
    if (signatures.size !== 1) {
      diagnostics.push(`${groupKey}: 経済事象groupの金額・時点・主体・根拠が不一致`);
    }
  }
  const semanticDuplicateGroups = new Map<string, Bzm21CashflowEvent[]>();
  for (const event of ledger.cashflowEvents) {
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
    if (
      reviewRefs.size !== 1 ||
      events.some((event) => !event.semanticDuplicateReviewRef?.trim())
    ) {
      diagnostics.push(
        `${events.map((event) => event.eventKey).join(", ")}: 意味的重複のレビュー参照が欠測`,
      );
    }
  }
  const taxBases = taxBasisByObjective(revision.valuationRuleByObjective);
  if (!taxBases) {
    diagnostics.push("3視点の価値規則に税基準が事前登録されていない");
  }
  for (const event of ledger.cashflowEvents) {
    if (!(BZM21_CASH_FLOW_CATEGORIES as readonly string[]).includes(event.includedIn)) {
      continue;
    }
    if (event.nominalOrReal !== "nominal" && event.valueStatus !== "not_applicable") {
      diagnostics.push(`${event.eventKey}: v0.1は実質額を名目額へ読み替えない`);
    }
    if (event.taxTreatment === "tax_payment") {
      if (!event.taxSubjectRef) {
        diagnostics.push(`${event.eventKey}: 税支払の税対象IDが欠測`);
      }
    }
    if (taxBases) {
      for (const objective of BZM21_OBJECTIVES) {
        const attribution = perspectiveAttribution(event, objective);
        if (!attribution?.included) continue;
        const compatibleTreatments =
          taxBases[objective] === "pre_tax_plus_explicit_tax_payments"
            ? ["pre_tax", "tax_payment", "tax_exempt", "not_applicable"]
            : taxBases[objective] === "post_tax_inclusive"
              ? ["post_tax", "tax_exempt", "not_applicable"]
              : ["tax_exempt", "not_applicable"];
        if (!compatibleTreatments.includes(event.taxTreatment)) {
          diagnostics.push(
            `${event.eventKey}: ${objective}視点の税基準と税区分が不一致`,
          );
        }
      }
    }
    if (event.publicAggregationStatus === "complete") {
      let socialSum = 0;
      let socialComplete = true;
      for (const component of event.publicSocialBenefitVector) {
        if (component.valueStatus === "not_applicable") continue;
        if (
          !["calculated", "observed", "conditional", "estimated"].includes(
            component.valueStatus,
          ) ||
          component.convertedAmountMillionJpy === null ||
          !component.conversionRuleRef
        ) {
          socialComplete = false;
          break;
        }
        socialSum += component.convertedAmountMillionJpy;
      }
      if (
        revision.publicAggregationRuleRef !==
          "bzm2.1:public=fiscal+social_converted:v0.1" ||
        !socialComplete ||
        event.publicFiscalAmountMillionJpy === null ||
        event.publicSocialConvertedAmountMillionJpy === null ||
        event.publicAggregatedAmountMillionJpy === null ||
        Math.abs(socialSum - event.publicSocialConvertedAmountMillionJpy) >
          Math.max(1e-9, Math.abs(socialSum) * 1e-9) ||
        Math.abs(
          event.publicFiscalAmountMillionJpy +
            event.publicSocialConvertedAmountMillionJpy -
            event.publicAggregatedAmountMillionJpy,
        ) > Math.max(1e-9, Math.abs(event.publicAggregatedAmountMillionJpy) * 1e-9)
      ) {
        diagnostics.push(`${event.eventKey}: 公的価値のv0.1加算規則が不整合`);
      }
      const expectedPublicHash = computeBzm21PublicAggregationInputHash(
        event,
        revision,
      );
      if (event.publicAggregationInputHash !== expectedPublicHash) {
        diagnostics.push(`${event.eventKey}: 公的価値の集約input hashが不一致`);
      }
    }
    const mapped = mapBzm21CashflowEventToEngine(event);
    diagnostics.push(...mapped.diagnostics);
    if (mapped.event) {
      engineEvents.push(mapped.event);
      eventIdByKey.set(event.eventKey, event.cashflowEventId);
    }
  }

  const stateById = new Map(ledger.states.map((state) => [state.stateId, state]));
  const engineStates: EngineDecisionState[] = [];
  for (const state of ledger.states) {
    const currentState = currentStateFromJson(state.currentState);
    const beliefs = state.beliefs.map(beliefFromJson);
    const history = reachabilityFromJson(state.reachabilityHistory);
    const controller = controllerFromJson(state.decisionController);
    const stateEvidence = evidenceFromJson(state.evidence);
    if (
      !currentState ||
      beliefs.some((belief) => belief === null) ||
      !history ||
      !controller ||
      !stateEvidence
    ) {
      diagnostics.push(`${state.stateKey}: 状態・信念・履歴・意思決定者・根拠の契約が未完了`);
      continue;
    }
    const engineActions: EngineAction[] = [];
    for (const action of state.actions) {
      const feasibility = gateFromJson(action.feasibilityGate);
      const authority = gateFromJson(action.authorityGate);
      const consents = action.consents.map(consentFromJson);
      const financing = financingFromJson(action.financingFeasibility);
      const sequence = actionSequence(action.sequence);
      const resources = action.sharedResources.map(sharedResourceFromJson);
      const informationGain = strings(action.informationGain);
      const actionEvidence = evidenceFromJson(action.evidence);
      const eventIds = action.cashflowEventKeys.flatMap((key) => {
        const eventId = eventIdByKey.get(key);
        return eventId ? [eventId] : [];
      });
      const actionCategories = new Set(
        eventIds.map((eventId) => ledgerEventById.get(eventId)?.includedIn),
      );
      for (const category of ["immediate_cost", "immediate_benefit"] as const) {
        if (!actionCategories.has(category)) {
          diagnostics.push(
            `${state.stateKey}/${action.actionKey}: ${category}の明示CF事象が欠測`,
          );
        }
      }
      for (const eventId of eventIds) {
        const event = ledgerEventById.get(eventId);
        if (
          !event ||
          event.timingMonths === null ||
          state.elapsedMonths === null ||
          Math.abs(event.timingMonths - state.elapsedMonths) > 1e-9
        ) {
          diagnostics.push(
            `${state.stateKey}/${action.actionKey}: 即時CFの計上月が状態時点と不一致`,
          );
        }
      }
      const derivedImmediateCost = sumCashflowCategory(
        engineEvents,
        eventIds,
        "immediate_cost",
      );
      const derivedImmediateBenefit = sumCashflowCategory(
        engineEvents,
        eventIds,
        "immediate_benefit",
      );
      if (
        !objectiveAmountsCacheMatches(
          action.immediateCostByObjective,
          derivedImmediateCost,
        ) ||
        !objectiveAmountsCacheMatches(
          action.immediateBenefitByObjective,
          derivedImmediateBenefit,
        )
      ) {
        diagnostics.push(
          `${state.stateKey}/${action.actionKey}: 行動CF派生値cacheが単一CF正本と不一致`,
        );
      }
      if (
        !feasibility ||
        !authority ||
        consents.some((consent) => consent === null) ||
        !financing ||
        !sequence ||
        resources.some((resource) => resource === null) ||
        !informationGain ||
        !actionEvidence ||
        eventIds.length !== action.cashflowEventKeys.length
      ) {
        diagnostics.push(`${state.stateKey}/${action.actionKey}: 行動束の実行契約が未完了`);
        continue;
      }
      const transitions: EngineTransition[] = [];
      for (const transition of action.transitions) {
        const transitionEvidence = evidenceFromJson(transition.evidence);
        const transitionEventIds = transition.cashflowEventKeys.flatMap((key) => {
          const eventId = eventIdByKey.get(key);
          return eventId ? [eventId] : [];
        });
        const transitionCategories = new Set(
          transitionEventIds.map(
            (eventId) => ledgerEventById.get(eventId)?.includedIn,
          ),
        );
        const requiredTransitionCategories: Array<
          "transition_cash_flow" | "terminal_value" | "failure_loss"
        > = ["transition_cash_flow"];
        if (transition.nextStateId === null) {
          requiredTransitionCategories.push("terminal_value", "failure_loss");
        }
        for (const category of requiredTransitionCategories) {
          if (!transitionCategories.has(category)) {
            diagnostics.push(
              `${state.stateKey}/${action.actionKey}/${transition.transitionKey}: ${category}の明示CF事象が欠測`,
            );
          }
        }
        const expectedTransitionMonth =
          state.elapsedMonths === null || action.durationMonths === null
            ? null
            : state.elapsedMonths + action.durationMonths;
        for (const eventId of transitionEventIds) {
          const event = ledgerEventById.get(eventId);
          if (
            !event ||
            event.timingMonths === null ||
            expectedTransitionMonth === null ||
            Math.abs(event.timingMonths - expectedTransitionMonth) > 1e-9
          ) {
            diagnostics.push(
              `${state.stateKey}/${action.actionKey}/${transition.transitionKey}: 遷移CFの計上月が行動終了時点と不一致`,
            );
          }
        }
        if (
          !transitionEvidence ||
          transitionEventIds.length !== transition.cashflowEventKeys.length ||
          (transition.terminalOutcome !== null &&
            ![
              "capital_independent",
              "licensed",
              "transferred",
              "abandoned",
              "liquidated",
              "failed",
              "unresolved",
            ].includes(transition.terminalOutcome))
        ) {
          diagnostics.push(`${state.stateKey}/${action.actionKey}/${transition.transitionKey}: 遷移契約が未完了`);
          continue;
        }
        const derivedTransitionCashFlow = sumCashflowCategory(
          engineEvents,
          transitionEventIds,
          "transition_cash_flow",
        );
        const derivedTerminalValue = sumCashflowCategory(
          engineEvents,
          transitionEventIds,
          "terminal_value",
        );
        const derivedFailureLoss = sumCashflowCategory(
          engineEvents,
          transitionEventIds,
          "failure_loss",
        );
        if (
          !objectiveAmountsCacheMatches(
            transition.transitionCashFlowByObjective,
            derivedTransitionCashFlow,
          ) ||
          !objectiveAmountsCacheMatches(
            transition.terminalValueByObjective,
            derivedTerminalValue,
          ) ||
          !objectiveAmountsCacheMatches(
            transition.failureLossByObjective,
            derivedFailureLoss,
          )
        ) {
          diagnostics.push(
            `${state.stateKey}/${action.actionKey}/${transition.transitionKey}: 遷移CF派生値cacheが単一CF正本と不一致`,
          );
        }
        transitions.push({
          transitionId: transition.transitionId,
          label: transition.label,
          probability: transition.probability,
          nextStateId: transition.nextStateId,
          terminalOutcome: transition.terminalOutcome as Bzm21TerminalOutcome | null,
          goalReachedAtMonths: transition.goalReachedAtMonths,
          slackLostAtMonths: transition.slackLostAtMonths,
          cashFlowEventIds: transitionEventIds,
          transitionCashFlowMillionJpy: derivedTransitionCashFlow,
          terminalValueMillionJpy: derivedTerminalValue,
          failureLossMillionJpy: derivedFailureLoss,
          evidence: transitionEvidence,
        });
      }
      if (transitions.length !== action.transitions.length) continue;
      engineActions.push({
        actionId: action.actionId,
        bundleId: action.bundleId,
        kind: action.actionType,
        componentKinds: action.componentTypes,
        customComponents: action.customComponents,
        sequence,
        sharedResourceRequirements: resources as EngineAction["sharedResourceRequirements"],
        label: action.label,
        availability: action.availabilityStatus,
        feasibility,
        authority,
        consents: consents as Bzm21ConsentGate[],
        financingFeasibility: financing,
        durationMonths: action.durationMonths,
        immediateCostMillionJpy: derivedImmediateCost,
        immediateBenefitMillionJpy: derivedImmediateBenefit,
        requiredFundingMillionJpy: action.requiredFundingMillionJpy,
        informationGain,
        cashFlowEventIds: eventIds,
        transitions,
        evidence: actionEvidence,
      });
    }
    if (engineActions.length !== state.actions.length) continue;
    engineStates.push({
      stateId: state.stateId,
      label: state.label,
      decisionOrder: state.decisionOrder,
      elapsedMonths: state.elapsedMonths,
      currentState,
      beliefs: beliefs as Bzm21BeliefState[],
      reachabilityHistory: history,
      decisionController: controller,
      sunkCostMillionJpy: state.sunkCostMillionJpy,
      remainingCostMillionJpy: state.remainingCostMillionJpy,
      remainingTimeMonths: state.remainingTimeMonths,
      availableInformation: state.availableInformation as string[],
      actions: engineActions,
      evidence: stateEvidence,
    });
  }
  if (engineStates.length !== ledger.states.length) {
    diagnostics.push("判断グラフを計算エンジンの型へ閉じられない");
  }

  const initialState = ledger.states.find(
    (state) => state.stateKey === revision.initialStateKey,
  );
  const discountRatePerMonth = objectiveAmountsFromJson(
    revision.discountRateByObjective,
  );
  const aggregationInput = findRevisionInput(ledger, "public_aggregation");
  const publicEvidence = evidenceFromInput(aggregationInput);
  const baselinePolicy: Record<string, string> = {};
  if (revision.baselinePolicy) {
    for (const [stateKeyOrId, actionKeyOrId] of Object.entries(
      revision.baselinePolicy,
    )) {
      if (typeof actionKeyOrId !== "string") {
        diagnostics.push("固定方針に文字列以外の行動IDがある");
        continue;
      }
      const state =
        stateById.get(stateKeyOrId) ??
        ledger.states.find((candidate) => candidate.stateKey === stateKeyOrId);
      const action = state?.actions.find(
        (candidate) =>
          candidate.actionId === actionKeyOrId ||
          candidate.actionKey === actionKeyOrId,
      );
      if (!state || !action) {
        diagnostics.push(`固定方針を状態・行動IDへ解決できない: ${stateKeyOrId}`);
      } else {
        baselinePolicy[state.stateId] = action.actionId;
      }
    }
  }

  const requiredInputByKey = new Map(
    ledger.revisionInputs.map((input) => [input.parameterKey, input]),
  );
  for (const parameterKey of BZM21_REQUIRED_REVISION_INPUT_KEYS) {
    const input = requiredInputByKey.get(parameterKey);
    if (!input) {
      diagnostics.push(`${parameterKey}: 必須入力行が未登録`);
      continue;
    }
    if (
      !["calculated", "observed", "conditional", "estimated"].includes(
        input.valueStatus,
      ) ||
      input.value === null ||
      input.evidenceKind === "none" ||
      !input.evidenceRef
    ) {
      diagnostics.push(`${parameterKey}: 必須入力の値または根拠が未完了`);
    }
    if (
      input.valueStatus === "conditional" &&
      Object.keys(input.condition).length === 0
    ) {
      diagnostics.push(`${parameterKey}: 条件付き入力の適用条件が欠測`);
    }
  }

  const discountRates = revision.discountRateByObjective;
  const valuationRules = revision.valuationRuleByObjective;
  const decisionCriteria = revision.decisionCriterionByObjective;
  const nearTieByObjective = isRecord(decisionCriteria)
    ? Object.fromEntries(
        BZM21_OBJECTIVES.map((objective) => {
          const criterion = decisionCriteria[objective];
          return [
            objective,
            isRecord(criterion)
              ? criterion.nearTieToleranceMillionJpy ?? null
              : null,
          ];
        }),
      )
    : null;
  const nearTieValues = nearTieByObjective
    ? Object.values(nearTieByObjective)
    : [];
  const commonNearTie =
    nearTieValues.length === 3 &&
    nearTieValues.every((value) => value === nearTieValues[0])
      ? nearTieValues[0]
      : nearTieByObjective;
  const expectedInputValues: Partial<
    Record<(typeof BZM21_REQUIRED_REVISION_INPUT_KEYS)[number], unknown>
  > = {
    valuation_date: revision.valuationDate,
    initial_state: revision.initialStateKey,
    plan_deadline: revision.planDeadlineMonths,
    evaluation_horizon: revision.evaluationHorizonMonths,
    reachability_history: initialState?.reachabilityHistory,
    decision_controller: initialState?.decisionController,
    controller_objective: initialState?.decisionController.objective,
    baseline_policy: revision.baselinePolicy,
    policy_definition_ref: revision.policyDefinitionRef,
    discount_rate_company: discountRates?.company,
    discount_rate_bzsf: discountRates?.bzsf,
    discount_rate_public: discountRates?.public,
    valuation_rule_company: valuationRules?.company,
    valuation_rule_bzsf: valuationRules?.bzsf,
    valuation_rule_public: valuationRules?.public,
    decision_criterion_company: decisionCriteria?.company,
    decision_criterion_bzsf: decisionCriteria?.bzsf,
    decision_criterion_public: decisionCriteria?.public,
    near_tie_tolerance: commonNearTie,
    tie_break_rule: revision.tieBreakRule,
    uncertainty_rule: revision.uncertaintyRule,
    public_fiscal_rule: revision.publicFiscalRuleRef,
    public_social_mandate: revision.publicSocialMandateRef,
    public_social_conversion: revision.publicSocialConversionRuleRef,
    public_aggregation: revision.publicAggregationRuleRef,
  };
  for (const [parameterKey, expected] of Object.entries(expectedInputValues)) {
    const input = requiredInputByKey.get(parameterKey);
    if (input && expected !== undefined && !inputMatches(input, expected)) {
      diagnostics.push(`${parameterKey}: 入力台帳と版キャッシュが不一致`);
    }
  }
  for (const parameterKey of ["action_coverage", "single_cashflow_ledger"] as const) {
    const input = requiredInputByKey.get(parameterKey);
    const status = isRecord(input?.value) ? input?.value.status : input?.value;
    if (status !== "complete") {
      diagnostics.push(`${parameterKey}: 被覆完了が明示されていない`);
    }
  }

  const engineInterventions: EngineIntervention[] = [];
  for (const intervention of ledger.interventions) {
    if (
      intervention.effects.some(
        (effect) =>
          isRecord(effect) &&
          Array.isArray(effect.cashFlowEventDeltas) &&
          effect.cashFlowEventDeltas.length > 0,
      )
    ) {
      diagnostics.push(
        `${intervention.interventionKey}: 金銭支援deltaは単一CF事象契約を迂回するためv0.1では計算停止`,
      );
    }
    const effects = interventionEffectsFromJson(intervention.effects);
    const evidence = evidenceFromJson(intervention.evidence);
    if (!effects || !evidence) {
      diagnostics.push(`${intervention.interventionKey}: 支援効果の契約が未完了`);
      continue;
    }
    engineInterventions.push({
      interventionId: intervention.interventionId,
      label: intervention.label,
      enabled: intervention.enabled,
      effects,
      evidence,
    });
  }

  if (
    !revision.valuationDate ||
    !initialState ||
    !discountRatePerMonth ||
    !revision.valuationRuleByObjective ||
    !revision.decisionCriterionByObjective ||
    !revision.uncertaintyRule ||
    !revision.tieBreakRule ||
    !revision.publicFiscalRuleRef ||
    !revision.publicSocialMandateRef ||
    !revision.publicSocialConversionRuleRef ||
    revision.publicAggregationRuleRef !==
      "bzm2.1:public=fiscal+social_converted:v0.1" ||
    !publicEvidence ||
    !revision.baselinePolicyId ||
    !revision.baselinePolicy ||
    !revision.policyDefinitionRef ||
    engineEvents.length === 0 ||
    engineStates.length === 0 ||
    engineInterventions.length !== ledger.interventions.length ||
    diagnostics.length > 0
  ) {
    return {
      status: "not_computable",
      model: null,
      diagnostics: Array.from(new Set([
        ...diagnostics,
        ...ledger.revisionInputs
          .filter((input) => ["missing", "not_started"].includes(input.valueStatus))
          .map((input) => `${input.parameterKey}: ${input.displayValue}`),
      ])),
    };
  }

  const model: Bzm21DynamicPolicyModel = {
    schema: BZM21_DYNAMIC_POLICY_SCHEMA,
    modelId: `${ledger.projectId}:${revision.revisionKey}`,
    modelVersion: revision.modelVersion,
    dataMode: revision.dataMode,
    currency: "JPY",
    valuationDate: revision.valuationDate,
    informationCutoff: revision.informationCutoff,
    forwardValidationCount: revision.forwardValidationCount,
    initialStateId: initialState.stateId,
    planDeadlineMonths: revision.planDeadlineMonths,
    evaluationHorizonMonths: revision.evaluationHorizonMonths,
    discountRatePerMonth,
    valuationRuleByObjective:
      revision.valuationRuleByObjective as Bzm21DynamicPolicyModel["valuationRuleByObjective"],
    decisionCriterionByObjective:
      revision.decisionCriterionByObjective as Bzm21DynamicPolicyModel["decisionCriterionByObjective"],
    uncertaintyRule:
      revision.uncertaintyRule as Bzm21DynamicPolicyModel["uncertaintyRule"],
    tieBreakRule: revision.tieBreakRule as Bzm21DynamicPolicyModel["tieBreakRule"],
    publicValueRule: {
      fiscalRuleRef: revision.publicFiscalRuleRef,
      socialMandateRef: revision.publicSocialMandateRef,
      socialConversionRuleRef: revision.publicSocialConversionRuleRef,
      aggregationRuleRef: revision.publicAggregationRuleRef,
      preregisteredAt: aggregationInput!.informationCutoff,
      evidence: publicEvidence,
    },
    baselinePolicyId: revision.baselinePolicyId,
    baselinePolicy,
    policyDefinitionRef: revision.policyDefinitionRef,
    cashFlowEvents: engineEvents,
    states: engineStates,
    interventions: engineInterventions,
  };
  const issues = validateBzm21DynamicPolicyModel(model);
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    return {
      status: "not_computable",
      model: null,
      diagnostics: errors.map((issue) => `${issue.path}: ${issue.message}`),
    };
  }
  return {
    status: "ready",
    model,
    inputHash: computeBzm21PolicyLedgerInputHash(ledger)!,
    warnings: issues.map((issue) => `${issue.path}: ${issue.message}`),
  };
}

function missingPaths(issues: Array<{ path: string }>) {
  return Array.from(new Set(issues.map((issue) => issue.path))).sort();
}

function completePublicDecomposition(
  decomposition: Bzm21PublicValueDecomposition | undefined,
  expectedNetValueMillionJpy: number,
  inputHash: string,
): decomposition is Bzm21PublicValueDecomposition & {
  status: "complete";
  fiscalValueMillionJpy: number;
  socialMonetizedValueMillionJpy: number;
  aggregatedValueMillionJpy: number;
  aggregationInputHash: string;
} {
  if (
    decomposition?.status !== "complete" ||
    decomposition.fiscalValueMillionJpy === null ||
    decomposition.socialMonetizedValueMillionJpy === null ||
    decomposition.aggregatedValueMillionJpy === null ||
    decomposition.aggregationInputHash !== inputHash ||
    !/^[0-9a-f]{64}$/.test(decomposition.aggregationInputHash) ||
    decomposition.issues.length > 0
  ) {
    return false;
  }
  let socialSum = 0;
  for (const component of decomposition.socialComponents) {
    if (component.valueStatus === "not_applicable") continue;
    if (
      !["calculated", "observed", "conditional", "estimated"].includes(
        component.valueStatus,
      ) ||
      component.convertedAmountMillionJpy === null ||
      !component.conversionRuleRef
    ) {
      return false;
    }
    socialSum += component.convertedAmountMillionJpy;
  }
  return (
    Math.abs(socialSum - decomposition.socialMonetizedValueMillionJpy) <=
      Math.max(1e-9, Math.abs(socialSum) * 1e-9) &&
    Math.abs(
      decomposition.fiscalValueMillionJpy +
        decomposition.socialMonetizedValueMillionJpy -
        decomposition.aggregatedValueMillionJpy,
    ) <= Math.max(1e-9, Math.abs(decomposition.aggregatedValueMillionJpy) * 1e-9) &&
    Math.abs(
      expectedNetValueMillionJpy - decomposition.aggregatedValueMillionJpy,
    ) <= Math.max(1e-9, Math.abs(expectedNetValueMillionJpy) * 1e-9)
  );
}

function publicColumns(
  objective: Bzm21Objective,
  decomposition?: Bzm21PublicValueDecomposition,
) {
  if (objective !== "public") {
    return {
      public_aggregation_status: "not_applicable" as const,
      public_fiscal_value_million_jpy: null,
      public_social_components_json: [] as Bzm21PublicSocialBenefitComponent[],
      public_social_monetized_value_million_jpy: null,
      public_aggregated_value_million_jpy: null,
      public_aggregation_input_hash: null,
    };
  }
  if (decomposition?.status === "complete") {
    return {
      public_aggregation_status: "complete" as const,
      public_fiscal_value_million_jpy: decomposition.fiscalValueMillionJpy,
      public_social_components_json: decomposition.socialComponents,
      public_social_monetized_value_million_jpy:
        decomposition.socialMonetizedValueMillionJpy,
      public_aggregated_value_million_jpy:
        decomposition.aggregatedValueMillionJpy,
      public_aggregation_input_hash: decomposition.aggregationInputHash,
    };
  }
  return {
    public_aggregation_status: "not_computable" as const,
    public_fiscal_value_million_jpy:
      decomposition?.fiscalValueMillionJpy ?? null,
    public_social_components_json: decomposition?.socialComponents ?? [],
    public_social_monetized_value_million_jpy:
      decomposition?.socialMonetizedValueMillionJpy ?? null,
    public_aggregated_value_million_jpy: null,
    public_aggregation_input_hash: null,
  };
}

function computedPolicyRow(
  revisionId: string,
  informationCutoff: string,
  engineVersion: string,
  inputHash: string,
  policy: EnginePolicyEvaluation,
  valueDifferenceFromBaseline: number,
  controllerOptionValue: number | null,
  publicDecomposition?: Bzm21PublicValueDecomposition,
): Bzm21PolicyEvaluationInsert {
  return {
    revision_id: revisionId,
    objective_kind: policy.perspective,
    policy_kind: policy.policyKind,
    selection_objective: policy.selectionObjective,
    evaluation_status: "computed",
    action_coverage_status: "complete",
    goal_probability: policy.goalProbability,
    plan_deadline_goal_probability: policy.planDeadlineGoalProbability,
    conditional_goal_value: policy.conditionalGoalValueMillionJpy,
    expected_net_value: policy.expectedNetValueMillionJpy,
    value_difference_from_baseline: valueDifferenceFromBaseline,
    controller_option_value: controllerOptionValue,
    value_unit: "million JPY",
    expected_cumulative_funding_million_jpy:
      policy.expectedCumulativeFundingMillionJpy,
    expected_failure_loss_million_jpy: policy.expectedFailureLossMillionJpy,
    expected_exit_value_million_jpy: policy.expectedExitValueMillionJpy,
    expected_terminal_value_million_jpy: policy.expectedTerminalValueMillionJpy,
    expected_cost_million_jpy: policy.expectedCostMillionJpy,
    expected_benefit_million_jpy: policy.expectedBenefitMillionJpy,
    ...publicColumns(policy.perspective, publicDecomposition),
    controller_by_state_json: policy.controllerByState,
    selected_action_by_state_json: policy.selectedActionByState,
    state_decisions_json: policy.stateDecisions,
    uncertainty_json: {},
    issues_json: [],
    missing_inputs: [],
    engine_version: engineVersion,
    input_hash: inputHash,
    information_cutoff: informationCutoff,
  };
}

function nonComputedPolicyRow(args: {
  revisionId: string;
  objective: Bzm21Objective;
  policyKind: "fixed_baseline" | "optimized";
  status: "not_computable" | "decision_indeterminate";
  selectionObjective: Bzm21Objective | null;
  informationCutoff: string;
  engineVersion: string;
  inputHash: string;
  issues: unknown[];
  missingInputs: string[];
  publicDecomposition?: Bzm21PublicValueDecomposition;
  structuralPolicy?: EnginePolicyEvaluation;
}): Bzm21PolicyEvaluationInsert {
  const structural = args.structuralPolicy;
  return {
    revision_id: args.revisionId,
    objective_kind: args.objective,
    policy_kind: args.policyKind,
    selection_objective: args.selectionObjective,
    evaluation_status: args.status,
    action_coverage_status: structural ? "complete" : "unknown",
    goal_probability: structural?.goalProbability ?? null,
    plan_deadline_goal_probability:
      structural?.planDeadlineGoalProbability ?? null,
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
    ...publicColumns(args.objective, args.publicDecomposition),
    controller_by_state_json: structural?.controllerByState ?? {},
    selected_action_by_state_json: structural?.selectedActionByState ?? {},
    state_decisions_json: structural?.stateDecisions ?? [],
    uncertainty_json: {},
    issues_json: args.issues,
    missing_inputs:
      args.missingInputs.length > 0 ? args.missingInputs : ["未確定入力"],
    engine_version: args.engineVersion,
    input_hash: args.inputHash,
    information_cutoff: args.informationCutoff,
  };
}

export function serializeBzm21DynamicPolicyEvaluation(args: {
  ledger: Bzm21PolicyModelLedger;
  evaluation: Bzm21DynamicPolicyEvaluation;
  engineVersion: string;
  publicPolicyDecompositionByPolicy?: Partial<
    Record<"fixed_baseline" | "optimized", Bzm21PublicValueDecomposition>
  >;
}): Bzm21PolicyEvaluationInsert[] {
  const revision = args.ledger.currentRevision;
  const inputHash = computeBzm21PolicyLedgerInputHash(args.ledger);
  if (!revision || !inputHash) {
    throw new Error("BZM 2.1評価の保存先版またはcanonical input hashがない");
  }
  if (
    revision.dataMode === "project" &&
    args.publicPolicyDecompositionByPolicy &&
    Object.keys(args.publicPolicyDecompositionByPolicy).length > 0
  ) {
    throw new Error("実PJ版ではcaller suppliedな公的価値分解を保存できない");
  }
  if (
    args.evaluation.modelId !== `${args.ledger.projectId}:${revision.revisionKey}` ||
    args.evaluation.modelVersion !== revision.modelVersion ||
    args.evaluation.informationCutoff !== revision.informationCutoff
  ) {
    throw new Error("BZM 2.1評価と保存先canonical modelが一致しない");
  }
  const evaluationCutoff = Date.parse(args.evaluation.informationCutoff);
  const revisionCutoff = Date.parse(revision.informationCutoff);
  if (
    !Number.isFinite(evaluationCutoff) ||
    !Number.isFinite(revisionCutoff) ||
    evaluationCutoff > revisionCutoff
  ) {
    throw new Error("BZM 2.1評価の情報締切が保存先の版締切を超えている");
  }
  const hasBzsfValueLeg = args.ledger.cashflowEvents.some((event) => {
    const attribution = event.perspectiveAttribution.bzsf;
    return isRecord(attribution) && attribution.included === true;
  });
  return BZM21_OBJECTIVE_KINDS.flatMap((objective) => {
    const perspective = args.evaluation.perspectives[objective];
    if (perspective.status === "computed") {
      if (
        objective === "bzsf" &&
        revision.dataMode === "project" &&
        !hasBzsfValueLeg
      ) {
        return (["fixed_baseline", "optimized"] as const).map((policyKind) =>
          nonComputedPolicyRow({
            revisionId: revision.revisionId,
            objective,
            policyKind,
            status: "not_computable",
            selectionObjective:
              policyKind === "optimized"
                ? perspective.optimal.selectionObjective
                : null,
            informationCutoff: args.evaluation.informationCutoff,
            engineVersion: args.engineVersion,
            inputHash,
            issues: [
              "BZSF取得証券・投資支出・分配waterfallのCF脚がないため投資価値を保存しない",
            ],
            missingInputs: ["bzsf_security_cashflow_legs"],
            structuralPolicy:
              policyKind === "fixed_baseline"
                ? perspective.baseline
                : perspective.optimal,
          }),
        );
      }
      if (objective === "public") {
        const baselineDecomposition =
          args.publicPolicyDecompositionByPolicy?.fixed_baseline;
        const optimizedDecomposition =
          args.publicPolicyDecompositionByPolicy?.optimized;
        if (
          revision.dataMode === "synthetic" &&
          completePublicDecomposition(
            baselineDecomposition,
            perspective.baseline.expectedNetValueMillionJpy,
            inputHash,
          ) &&
          completePublicDecomposition(
            optimizedDecomposition,
            perspective.optimal.expectedNetValueMillionJpy,
            inputHash,
          )
        ) {
          return [
            computedPolicyRow(
              revision.revisionId,
              args.evaluation.informationCutoff,
              args.engineVersion,
              inputHash,
              perspective.baseline,
              0,
              null,
              baselineDecomposition,
            ),
            computedPolicyRow(
              revision.revisionId,
              args.evaluation.informationCutoff,
              args.engineVersion,
              inputHash,
              perspective.optimal,
              perspective.valueDifferenceFromBaselineMillionJpy,
              perspective.controllerOptionValueMillionJpy,
              optimizedDecomposition,
            ),
          ];
        }
        return (["fixed_baseline", "optimized"] as const).map(
          (policyKind) =>
            nonComputedPolicyRow({
                revisionId: revision.revisionId,
              objective,
              policyKind,
              status: "not_computable",
              selectionObjective:
                policyKind === "optimized"
                  ? perspective.optimal.selectionObjective
                  : null,
              informationCutoff: args.evaluation.informationCutoff,
              engineVersion: args.engineVersion,
                inputHash,
              issues: [
                "v0.1 engineはCF経路の基金財政・社会便益を方針別に分解しないため保存停止",
              ],
              missingInputs: ["public_path_decomposition_engine"],
              publicDecomposition:
                args.publicPolicyDecompositionByPolicy?.[policyKind],
              structuralPolicy:
                policyKind === "fixed_baseline"
                  ? perspective.baseline
                  : perspective.optimal,
            }),
        );
      }
      return [
        computedPolicyRow(
          revision.revisionId,
          args.evaluation.informationCutoff,
          args.engineVersion,
          inputHash,
          perspective.baseline,
          0,
          null,
          undefined,
        ),
        computedPolicyRow(
          revision.revisionId,
          args.evaluation.informationCutoff,
          args.engineVersion,
          inputHash,
          perspective.optimal,
          perspective.valueDifferenceFromBaselineMillionJpy,
          perspective.controllerOptionValueMillionJpy,
          undefined,
        ),
      ];
    }
    const status = perspective.status;
    const missingInputs = missingPaths(perspective.issues);
    return (["fixed_baseline", "optimized"] as const).map((policyKind) =>
      nonComputedPolicyRow({
        revisionId: revision.revisionId,
        objective,
        policyKind,
        status,
        selectionObjective: null,
        informationCutoff: args.evaluation.informationCutoff,
        engineVersion: args.engineVersion,
        inputHash,
        issues: perspective.issues,
        missingInputs,
        publicDecomposition:
          args.publicPolicyDecompositionByPolicy?.[policyKind],
      }),
    );
  });
}

function computedActionRow(args: {
  action: EngineActionEvaluation;
  objective: Bzm21Objective;
  selectionObjective: Bzm21Objective | null;
  isSelected: boolean;
  informationCutoff: string;
  engineVersion: string;
  inputHash: string;
  publicDecomposition?: Bzm21PublicValueDecomposition;
}): Bzm21ActionEvaluationInsert {
  return {
    action_id: args.action.actionId,
    objective_kind: args.objective,
    selection_objective: args.selectionObjective,
    is_selected: args.isSelected,
    exclusion_reason: null,
    evaluation_status: "computed",
    goal_probability: args.action.goalProbability,
    plan_deadline_goal_probability: args.action.planDeadlineGoalProbability,
    conditional_goal_value: args.action.conditionalGoalValueMillionJpy,
    value_unit: "million JPY",
    expected_cumulative_funding_million_jpy:
      args.action.expectedCumulativeFundingMillionJpy,
    expected_failure_loss_million_jpy:
      args.action.expectedFailureLossMillionJpy,
    expected_exit_value_million_jpy: args.action.expectedExitValueMillionJpy,
    expected_terminal_value_million_jpy:
      args.action.expectedTerminalValueMillionJpy,
    expected_cost_million_jpy: args.action.expectedCostMillionJpy,
    expected_benefit_million_jpy: args.action.expectedBenefitMillionJpy,
    expected_net_value: args.action.expectedNetValueMillionJpy,
    ...publicColumns(args.objective, args.publicDecomposition),
    uncertainty_json: {},
    issues_json: [],
    missing_inputs: [],
    engine_version: args.engineVersion,
    input_hash: args.inputHash,
    information_cutoff: args.informationCutoff,
  };
}

function nonComputedActionRow(args: {
  actionId: string;
  objective: Bzm21Objective;
  selectionObjective: Bzm21Objective | null;
  isSelected: boolean;
  exclusionReason: string | null;
  status: "not_computable" | "decision_indeterminate";
  informationCutoff: string;
  engineVersion: string;
  inputHash: string;
  issues: unknown[];
  missingInputs: string[];
  publicDecomposition?: Bzm21PublicValueDecomposition;
  structuralAction?: EngineActionEvaluation;
}): Bzm21ActionEvaluationInsert {
  const structural = args.structuralAction;
  return {
    action_id: args.actionId,
    objective_kind: args.objective,
    selection_objective: args.selectionObjective,
    is_selected: args.isSelected,
    exclusion_reason: args.exclusionReason,
    evaluation_status: args.status,
    goal_probability: structural?.goalProbability ?? null,
    plan_deadline_goal_probability:
      structural?.planDeadlineGoalProbability ?? null,
    conditional_goal_value: null,
    value_unit: null,
    expected_cumulative_funding_million_jpy: null,
    expected_failure_loss_million_jpy: null,
    expected_exit_value_million_jpy: null,
    expected_terminal_value_million_jpy: null,
    expected_cost_million_jpy: null,
    expected_benefit_million_jpy: null,
    expected_net_value: null,
    ...publicColumns(args.objective, args.publicDecomposition),
    uncertainty_json: {},
    issues_json: args.issues,
    missing_inputs:
      args.missingInputs.length > 0 ? args.missingInputs : ["未確定入力"],
    engine_version: args.engineVersion,
    input_hash: args.inputHash,
    information_cutoff: args.informationCutoff,
  };
}

export function serializeBzm21DynamicPolicyRun(args: {
  ledger: Bzm21PolicyModelLedger;
  evaluation: Bzm21DynamicPolicyEvaluation;
  engineVersion: string;
  publicPolicyDecompositionByPolicy?: Partial<
    Record<"fixed_baseline" | "optimized", Bzm21PublicValueDecomposition>
  >;
  publicActionDecompositionByActionId?: Record<
    string,
    Bzm21PublicValueDecomposition
  >;
}): Bzm21SerializedDynamicPolicyRun {
  const revision = args.ledger.currentRevision;
  const inputHash = computeBzm21PolicyLedgerInputHash(args.ledger);
  if (!revision || !inputHash) {
    throw new Error("BZM 2.1行動評価の保存先版またはcanonical input hashがない");
  }
  if (
    revision.dataMode === "project" &&
    args.publicActionDecompositionByActionId &&
    Object.keys(args.publicActionDecompositionByActionId).length > 0
  ) {
    throw new Error("実PJ版ではcaller suppliedな公的行動価値分解を保存できない");
  }
  const policyEvaluations = serializeBzm21DynamicPolicyEvaluation(args);
  const evaluationCutoff = Date.parse(args.evaluation.informationCutoff);
  const revisionCutoff = Date.parse(revision.informationCutoff);
  if (
    !Number.isFinite(evaluationCutoff) ||
    !Number.isFinite(revisionCutoff) ||
    evaluationCutoff > revisionCutoff
  ) {
    throw new Error("BZM 2.1行動評価の情報締切が保存先の版締切を超えている");
  }

  const actionIds = new Set(
    args.ledger.states.flatMap((state) =>
      state.actions.map((action) => action.actionId),
    ),
  );
  let selectionObjective: Bzm21Objective | null = null;
  const selectedActionIds = new Set<string>();
  const physicalMetricsByAction = new Map<string, EngineActionEvaluation>();
  for (const objective of BZM21_OBJECTIVES) {
    const perspective = args.evaluation.perspectives[objective];
    if (perspective.status !== "computed") continue;
    selectionObjective ??= perspective.optimal.selectionObjective;
    for (const decision of perspective.optimal.stateDecisions) {
      selectedActionIds.add(decision.selectedActionId);
      decision.actions.forEach((action) => {
        actionIds.add(action.actionId);
        physicalMetricsByAction.set(action.actionId, action);
      });
      decision.excludedActions.forEach((action) => actionIds.add(action.actionId));
    }
  }

  const actionEvaluations = BZM21_OBJECTIVES.flatMap((objective) => {
    const perspective = args.evaluation.perspectives[objective];
    const metricsByAction = new Map<string, EngineActionEvaluation>();
    const exclusionReasonByAction = new Map<string, string>();
    if (perspective.status === "computed") {
      for (const decision of perspective.optimal.stateDecisions) {
        decision.actions.forEach((action) =>
          metricsByAction.set(action.actionId, action),
        );
        decision.excludedActions.forEach((action) =>
          exclusionReasonByAction.set(action.actionId, action.reason),
        );
      }
    }
    return [...actionIds].map((actionId) => {
      const metric = metricsByAction.get(actionId);
      const structuralMetric = metric ?? physicalMetricsByAction.get(actionId);
      const publicDecomposition =
        args.publicActionDecompositionByActionId?.[actionId];
      const hasBzsfValueLeg = args.ledger.cashflowEvents.some((event) => {
        const attribution = event.perspectiveAttribution.bzsf;
        return isRecord(attribution) && attribution.included === true;
      });
      if (
        metric &&
        (objective !== "bzsf" ||
          revision.dataMode === "synthetic" ||
          hasBzsfValueLeg) &&
        (objective !== "public" ||
          (revision.dataMode === "synthetic" &&
            completePublicDecomposition(
              publicDecomposition,
              metric.expectedNetValueMillionJpy,
              inputHash,
            )))
      ) {
        return computedActionRow({
          action: metric,
          objective,
          selectionObjective,
          isSelected: selectedActionIds.has(actionId),
          informationCutoff: args.evaluation.informationCutoff,
          engineVersion: args.engineVersion,
          inputHash,
          publicDecomposition,
        });
      }
      const perspectiveIssues =
        perspective.status === "computed" ? [] : perspective.issues;
      const missingInputs =
        objective === "bzsf" && structuralMetric && !hasBzsfValueLeg
          ? ["bzsf_security_cashflow_legs"]
          : objective === "public" && structuralMetric
          ? ["public_path_decomposition_engine"]
          : perspectiveIssues.length > 0
            ? missingPaths(perspectiveIssues)
            : ["action_evaluation"];
      return nonComputedActionRow({
        actionId,
        objective,
        selectionObjective,
        isSelected: selectedActionIds.has(actionId),
        exclusionReason: exclusionReasonByAction.get(actionId) ?? null,
        status:
          perspective.status === "decision_indeterminate"
            ? "decision_indeterminate"
            : "not_computable",
        informationCutoff: args.evaluation.informationCutoff,
        engineVersion: args.engineVersion,
        inputHash,
        issues:
          objective === "bzsf" && structuralMetric && !hasBzsfValueLeg
            ? ["BZSF取得証券・投資支出・分配waterfallのCF脚がないため投資価値を保存しない"]
            : objective === "public" && structuralMetric
            ? ["v0.1 engineは公的価値をCF経路別に分解しないため保存停止"]
            : perspectiveIssues,
        missingInputs,
        publicDecomposition,
        structuralAction:
          objective === "public" ||
          (objective === "bzsf" && !hasBzsfValueLeg)
            ? structuralMetric
            : undefined,
      });
    });
  });

  return { policyEvaluations, actionEvaluations };
}
