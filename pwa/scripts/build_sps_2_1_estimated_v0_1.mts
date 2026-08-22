import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BZM21_DYNAMIC_POLICY_SCHEMA,
  evaluateBzm21DynamicPolicyModel,
  validateBzm21DynamicPolicyModel,
  type Bzm21Action,
  type Bzm21CashFlowCategory,
  type Bzm21CashFlowEconomicNature,
  type Bzm21CashFlowEvent,
  type Bzm21DecisionState,
  type Bzm21DynamicPolicyEvaluation,
  type Bzm21DynamicPolicyModel,
  type Bzm21EvidenceRef,
  type Bzm21ObjectiveAmounts,
  type Bzm21Transition,
} from "../src/lib/bzm-2-1-dynamic-policy.ts";

type JsonRecord = Record<string, unknown>;

type SourceStatus =
  | "observed"
  | "partial"
  | "estimated"
  | "missing"
  | "not_applicable";

type ModelInputStatus = "observed" | "calculated" | "estimated";

type ParameterRow = {
  key: string;
  unit: string;
  sourceStatus: SourceStatus;
  observedValue: unknown;
  modelInputStatus: ModelInputStatus;
  modelValue: unknown;
  sourceRefs: string[];
  methodRef: string;
  note: string;
};

type ProjectSource = {
  project_id: string;
  source_cutoff?: string;
  identity?: JsonRecord;
  observed?: JsonRecord;
  compressed_inputs_for_estimated_v0_1?: JsonRecord;
  estimation_hints?: JsonRecord;
  source_refs?: unknown[];
  archive?: JsonRecord;
  archive_fingerprints?: JsonRecord;
  extraction_rates?: JsonRecord;
};

type SensitivityPoint = {
  scenarioId: "downside" | "point" | "upside";
  qMultiplier: number;
  terminalValueMultiplier: number;
  remainingCostMultiplier: number;
  monthlyDiscountRate: number;
  selectedActionId: string;
  expectedNetValueMillionJpy: number;
  goalProbability: number;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_COHORT_A = "/tmp/bzm21-extraction/cohort-a.json";
const DEFAULT_COHORT_B = "/tmp/bzm21-extraction/cohort-b.json";
const DEFAULT_OUTPUT = path.resolve(
  SCRIPT_DIR,
  "../../bzm/pilot/sps-2-1-estimated-v0-1.json",
);

const INFORMATION_CUTOFF = "2026-08-11T14:59:59Z";
const VALUATION_DATE = "2026-08-11";
const MODEL_VERSION = "bzm-2.1-estimated-v0.1";
const ESTIMATOR_VERSION = "sps-2.1-low-precision-estimator-v0.1";
const COMMON_EVALUATION_HORIZON_MONTHS = 60;
const COMMON_MONTHLY_DISCOUNT_RATE = 0.01;
const CAPITAL_INDEPENDENCE_UPLIFT = 10;
const FULL_SCOPE_COST_UPLIFT = 5;
const FAILURE_CLOSURE_RATE = 0.03;
const DEFAULT_MISSING_CASH_SHARE = 0.25;

const EXPECTED_PROJECT_IDS = [
  "p03",
  "p04",
  "p06",
  "p07",
  "p09",
  "p11",
  "p18",
  "p20",
  "p21",
  "p24",
  "p26",
  "p29",
] as const;

const STAGE_PRIORS = {
  ended: { alpha: 0.5, beta: 19.5, label: "終了済み経路" },
  under_consideration: {
    alpha: 1,
    beta: 19,
    label: "検討中・主体未確立",
  },
  pre_incorporation: {
    alpha: 1.5,
    beta: 13.5,
    label: "設立前",
  },
  operating_company: {
    alpha: 3.5,
    beta: 11.5,
    label: "設立済み会社",
  },
} as const;

const FUNDING_EVIDENCE_MULTIPLIERS = {
  ended: 0.2,
  cash_observed: 0.85,
  contracted_partial: 0.72,
  historical_funding: 0.62,
  conditional_program: 0.58,
  partial_only: 0.5,
  missing: 0.4,
} as const;

function parseArgs(argv: string[]) {
  const result = {
    cohortA: DEFAULT_COHORT_A,
    cohortB: DEFAULT_COHORT_B,
    output: DEFAULT_OUTPUT,
    check: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--cohort-a") result.cohortA = argv[++index];
    else if (argument === "--cohort-b") result.cohortB = argv[++index];
    else if (argument === "--output") result.output = argv[++index];
    else if (argument === "--check") result.check = true;
    else throw new Error(`unknown argument: ${argument}`);
  }
  return result;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function median(values: number[]): number {
  assert.ok(values.length > 0, "median requires at least one value");
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((candidate) => stableJson(candidate)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, candidate]) => `${JSON.stringify(key)}:${stableJson(candidate)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function amounts(company: number): Bzm21ObjectiveAmounts {
  // This is a company-only projection. BZSF has no investment leg and the
  // public layer has no registered fiscal/social conversion in this scenario.
  return { company: round(company), bzsf: 0, public: 0 };
}

function compactSourceRefs(project: ProjectSource): string[] {
  const refs = Array.isArray(project.source_refs) ? project.source_refs : [];
  return refs
    .flatMap((candidate) => {
      if (typeof candidate === "string") return [candidate];
      const source = record(candidate);
      const table = stringOrNull(source.table);
      const rowKey = stringOrNull(source.row_key);
      return table && rowKey ? [`${table}:${rowKey}`] : [];
    })
    .filter((candidate) => !candidate.includes("http"))
    .slice(0, 12);
}

function sourceStatus(value: unknown): SourceStatus {
  const normalized = String(value ?? "missing").toLowerCase();
  if (normalized === "observed" || normalized.startsWith("observed_")) {
    return "observed";
  }
  if (normalized === "not_applicable" || normalized.startsWith("not_applicable")) {
    return "not_applicable";
  }
  if (normalized === "missing" || normalized === "not_started") return "missing";
  if (normalized.includes("estimated")) return "estimated";
  return "partial";
}

function readiness(project: ProjectSource) {
  const compressed = record(project.compressed_inputs_for_estimated_v0_1);
  const compressedReadiness = record(record(compressed.readiness).value);
  const observedReadiness = record(record(project.observed).readiness);
  const source =
    numberOrNull(compressedReadiness.trl) !== null
      ? compressedReadiness
      : observedReadiness;
  const trl = numberOrNull(source.trl);
  const brl = numberOrNull(source.brl);
  const hrl = numberOrNull(source.hrl);
  assert.ok(trl !== null && brl !== null && hrl !== null, `${project.project_id}: readiness trio missing`);
  const trio = [trl, brl, hrl];
  const mean = trio.reduce((sum, value) => sum + value, 0) / trio.length / 9;
  const bottleneck = Math.min(...trio) / 9;
  const rawStatus = stringOrNull(record(compressed.readiness).status) ??
    stringOrNull(observedReadiness.status) ??
    "missing";
  return {
    trl,
    brl,
    hrl,
    mean: clamp(mean, 0, 1),
    bottleneck: clamp(bottleneck, 0, 1),
    sourceStatus: sourceStatus(rawStatus),
    rawStatus,
  };
}

function potential(project: ProjectSource) {
  const compressed = record(project.compressed_inputs_for_estimated_v0_1);
  const compressedPotential = record(compressed.potential);
  const observedPotential = record(record(project.observed).legacy_potential_vector);
  const compactValue = numberOrNull(compressedPotential.value);
  const scale = stringOrNull(compressedPotential.scale);
  if (compactValue !== null) {
    return {
      normalized: clamp(scale?.includes("0-10") ? compactValue / 10 : compactValue / 100, 0, 1),
      observedValue: compactValue,
      sourceStatus: sourceStatus(compressedPotential.status),
      sourceScale: scale ?? "legacy",
    };
  }
  const economic = numberOrNull(observedPotential.economic_index);
  assert.ok(economic !== null, `${project.project_id}: potential proxy missing`);
  return {
    normalized: clamp(economic / 100, 0, 1),
    observedValue: economic,
    sourceStatus: sourceStatus(observedPotential.status),
    sourceScale: "legacy economic index 0-100",
  };
}

function stageClass(project: ProjectSource): keyof typeof STAGE_PRIORS {
  const observedCompany = record(record(project.observed).company);
  const stage = stringOrNull(observedCompany.commercialization_stage);
  if (stage === "operating_company_ended") return "ended";
  if (stage === "under_consideration") return "under_consideration";
  if (stage === "pre_incorporation") return "pre_incorporation";
  if (stage === "operating_company") return "operating_company";
  const identity = record(project.identity);
  return stringOrNull(identity.founded_at)
    ? "operating_company"
    : "pre_incorporation";
}

function cashObservation(project: ProjectSource): {
  status: SourceStatus;
  balanceMillionJpy: number | null;
  sourceValue: unknown;
} {
  const compressed = record(project.compressed_inputs_for_estimated_v0_1);
  const compressedCash = record(compressed.cash);
  const observedFinancial = record(record(project.observed).financial);
  const nestedCash = record(observedFinancial.cash);
  const balanceYen =
    numberOrNull(compressedCash.balance_yen) ??
    numberOrNull(nestedCash.balance_yen) ??
    numberOrNull(observedFinancial.cash_observed_jpy);
  const rawStatus =
    compressedCash.status ?? nestedCash.status ?? observedFinancial.status ?? "missing";
  return {
    status: sourceStatus(rawStatus),
    balanceMillionJpy: balanceYen === null ? null : balanceYen / 1_000_000,
    sourceValue:
      balanceYen === null
        ? null
        : { balanceMillionJpy: round(balanceYen / 1_000_000), asOf: compressedCash.as_of ?? nestedCash.as_of ?? observedFinancial.cash_observed_date ?? null },
  };
}

function fundingFacts(project: ProjectSource) {
  const observedFunding = record(record(project.observed).funding);
  const compressedFunding = record(
    record(project.compressed_inputs_for_estimated_v0_1).funding,
  );
  const merged = { ...observedFunding, ...compressedFunding };
  const committedYen =
    numberOrNull(merged.committed_not_deposited_yen) ??
    numberOrNull(merged.committed_jpy);
  const closedYen = numberOrNull(merged.closed_or_deposited_yen);
  const activeAwardYen = numberOrNull(merged.active_grant_award_jpy);
  return {
    status: sourceStatus(merged.status),
    committedMillionJpy: committedYen === null ? null : committedYen / 1_000_000,
    closedHistoricalMillionJpy: closedYen === null ? null : closedYen / 1_000_000,
    activeAwardMillionJpy: activeAwardYen === null ? null : activeAwardYen / 1_000_000,
  };
}

function fundingEvidenceClass(project: ProjectSource, cash: ReturnType<typeof cashObservation>) {
  const stage = stageClass(project);
  const facts = fundingFacts(project);
  if (stage === "ended") return "ended" as const;
  if (cash.balanceMillionJpy !== null) return "cash_observed" as const;
  if (facts.committedMillionJpy !== null && facts.committedMillionJpy > 0) {
    return "contracted_partial" as const;
  }
  if (facts.closedHistoricalMillionJpy !== null && facts.closedHistoricalMillionJpy > 0) {
    return "historical_funding" as const;
  }
  if (facts.activeAwardMillionJpy !== null && facts.activeAwardMillionJpy > 0) {
    return "conditional_program" as const;
  }
  if (facts.status === "partial") return "partial_only" as const;
  return "missing" as const;
}

function observedCostFloorMillionJpy(project: ProjectSource): number | null {
  const hint = record(record(project.estimation_hints).remaining_cost_proxy);
  const note = stringOrNull(hint.rule) ?? "";
  const candidates: number[] = [];
  const knownAction = numberOrNull(hint.known_action_cost_yen);
  if (knownAction !== null) candidates.push(knownAction / 1_000_000);
  const low = numberOrNull(hint.low_jpy);
  if (low !== null && !note.includes("撤去")) candidates.push(low / 1_000_000);
  const ranges = Array.isArray(hint.known_ranges) ? hint.known_ranges : [];
  for (const candidate of ranges) {
    if (typeof candidate !== "string") continue;
    const match = candidate.match(/over\s+([0-9.]+)m\s+JPY/i);
    if (match) candidates.push(Number(match[1]));
  }
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

function observedPlanDeadlineMonths(project: ProjectSource): number | null {
  const compressedSchedule = record(
    record(project.compressed_inputs_for_estimated_v0_1).schedule,
  );
  const hDate = stringOrNull(compressedSchedule.H_v_date);
  if (!hDate) return null;
  const start = Date.parse(`${VALUATION_DATE}T00:00:00Z`);
  const end = Date.parse(`${hDate}T00:00:00Z`);
  if (!Number.isFinite(end) || end <= start) return null;
  return Math.min(
    COMMON_EVALUATION_HORIZON_MONTHS,
    Math.ceil((end - start) / (365.2425 / 12 * 24 * 60 * 60 * 1000)),
  );
}

function extractionObservationRate(project: ProjectSource): number | null {
  return numberOrNull(record(project.extraction_rates).observation_rate);
}

function evidence(ref: string, kind: Bzm21EvidenceRef["kind"] = "calculation"): Bzm21EvidenceRef {
  return { kind, ref, informationCutoff: INFORMATION_CUTOFF };
}

function cashFlowEvent(
  stateId: string,
  actionId: string,
  transitionId: string | null,
  includedIn: Bzm21CashFlowCategory,
  companyAmountMillionJpy: number,
  economicNature: Bzm21CashFlowEconomicNature,
  methodRef: string,
): Bzm21CashFlowEvent {
  const eventId = [stateId, actionId, transitionId ?? "action", includedIn].join(":");
  return {
    eventId,
    label: eventId,
    stateId,
    actionId,
    transitionId,
    timing: transitionId === null ? "action_start" : "action_end",
    includedIn,
    economicNature,
    objectiveAmountsMillionJpy: amounts(companyAmountMillionJpy),
    owner: "pj-company-scenario",
    counterparty: "estimated-economic-counterparty",
    scope: "company-only provisional projection",
    amountBasis: "nominal",
    taxTreatment: "not_applicable",
    evidence: evidence(methodRef),
  };
}

function transition(
  transitionId: string,
  probability: number,
  outcome: Bzm21Transition["terminalOutcome"],
  durationMonths: number,
  goalReached: boolean,
  terminalValueMillionJpy: number,
  failureLossMillionJpy: number,
  methodRef: string,
): Bzm21Transition {
  return {
    transitionId,
    label: transitionId,
    probability: round(probability),
    nextStateId: null,
    terminalOutcome: outcome,
    goalReachedAtMonths: goalReached ? durationMonths : null,
    slackLostAtMonths: goalReached ? null : durationMonths,
    cashFlowEventIds: [],
    transitionCashFlowMillionJpy: amounts(0),
    terminalValueMillionJpy: amounts(terminalValueMillionJpy),
    failureLossMillionJpy: amounts(failureLossMillionJpy),
    evidence: evidence(methodRef),
  };
}

function rebuildLedger(model: Bzm21DynamicPolicyModel): Bzm21DynamicPolicyModel {
  const events: Bzm21CashFlowEvent[] = [];
  for (const state of model.states) {
    for (const action of state.actions) {
      action.cashFlowEventIds = [];
      const immediateRows = [
        ["immediate_cost", action.immediateCostMillionJpy.company, "investing"],
        ["immediate_benefit", action.immediateBenefitMillionJpy.company, "operating"],
      ] as const;
      for (const [category, amount, nature] of immediateRows) {
        assert.ok(amount !== null);
        const event = cashFlowEvent(
          state.stateId,
          action.actionId,
          null,
          category,
          amount,
          nature,
          `calculation:${ESTIMATOR_VERSION}:cashflow-ledger`,
        );
        events.push(event);
        action.cashFlowEventIds.push(event.eventId);
      }
      for (const branch of action.transitions) {
        branch.cashFlowEventIds = [];
        const transitionRows = [
          ["transition_cash_flow", branch.transitionCashFlowMillionJpy.company, "operating"],
          ["terminal_value", branch.terminalValueMillionJpy.company, "operating"],
          ["failure_loss", branch.failureLossMillionJpy.company, "operating"],
        ] as const;
        for (const [category, amount, nature] of transitionRows) {
          assert.ok(amount !== null);
          const event = cashFlowEvent(
            state.stateId,
            action.actionId,
            branch.transitionId,
            category,
            amount,
            nature,
            `calculation:${ESTIMATOR_VERSION}:cashflow-ledger`,
          );
          events.push(event);
          branch.cashFlowEventIds.push(event.eventId);
        }
      }
    }
  }
  model.cashFlowEvents = events;
  return model;
}

function companyResult(evaluation: Bzm21DynamicPolicyEvaluation) {
  const result = evaluation.perspectives.company;
  assert.equal(result.status, "computed", JSON.stringify(result, null, 2));
  return result;
}

function buildModel(
  project: ProjectSource,
  point: {
    qPhysical: number;
    terminalValueMillionJpy: number;
    remainingCostMillionJpy: number;
    durationMonths: number;
    planDeadlineMonths: number;
    openingCashMillionJpy: number;
    observedCommittedMillionJpy: number;
    monthlyDiscountRate: number;
  },
): Bzm21DynamicPolicyModel {
  const stateId = "current-decision";
  const continueId = "continue-estimated-path";
  const abandonId = "abandon-now";
  const closureCost = round(point.remainingCostMillionJpy * FAILURE_CLOSURE_RATE);
  const financingGap = round(
    Math.max(0, point.remainingCostMillionJpy - point.openingCashMillionJpy),
  );
  const imputedFundingBeyondObserved = round(
    Math.max(0, financingGap - point.observedCommittedMillionJpy),
  );
  const financeEvidence = evidence(
    `calculation:${ESTIMATOR_VERSION}:funding-gap-scenario;observed-committed=${round(point.observedCommittedMillionJpy)};imputed=${imputedFundingBeyondObserved}`,
  );
  const requiredSchedule = [0, 0.5, 1].map((share, index) => {
    const weights = [0.4, 0.35, 0.25];
    const prior = weights
      .slice(0, index)
      .reduce((sum, weight) => sum + round(point.remainingCostMillionJpy * weight), 0);
    const amount =
      index < 2
        ? round(point.remainingCostMillionJpy * weights[index])
        : round(point.remainingCostMillionJpy - prior);
    return {
      scheduleId: `${continueId}:required:${index}`,
      atMonths: round(point.durationMonths * share),
      amountMillionJpy: amount,
      purpose: "estimated-full-path-cost",
      evidence: evidence(`calculation:${ESTIMATOR_VERSION}:required-funding-schedule`),
    };
  });
  const committedSchedule =
    financingGap > 0
      ? [
          {
            scheduleId: `${continueId}:committed:0`,
            atMonths: 0,
            amountMillionJpy: financingGap,
            permittedPurposes: ["estimated-full-path-cost"],
            evidence: financeEvidence,
          },
        ]
      : [];
  const continueAction: Bzm21Action = {
    actionId: continueId,
    bundleId: continueId,
    kind: "continue",
    componentKinds: ["continue"],
    customComponents:
      financingGap > 0 ? ["impute-financing-gap-scenario"] : [],
    sequence:
      financingGap > 0
        ? ["impute-financing-gap-scenario", "continue"]
        : ["continue"],
    sharedResourceRequirements: [],
    label: "推定資金経路を置いて続行",
    availability: "available",
    feasibility: {
      status: "confirmed",
      note: "低精度推定シナリオ内だけで実行可能と仮定。実行推薦ではない。",
      evidence: evidence(`calculation:${ESTIMATOR_VERSION}:provisional-action-availability`),
    },
    authority: {
      status: "confirmed",
      note: "会社controllerを置く暫定シナリオ。法定権限の実測ではない。",
      evidence: evidence(`calculation:${ESTIMATOR_VERSION}:company-controller-assumption`),
    },
    consents: [],
    financingFeasibility: {
      status: financingGap > 0 ? "secured" : "not_required",
      openingCashMillionJpy: round(point.openingCashMillionJpy),
      committedFundingMillionJpy: financingGap,
      requiredFundingSchedule: requiredSchedule,
      committedFundingSchedule: committedSchedule,
      note:
        financingGap > 0
          ? `推定シナリオ内で不足${financingGap}百万円を即時確保したと置く。契約済み資金という実測主張ではない。`
          : "推定残費用を判断時点現金で賄えるシナリオ。",
      evidence: financeEvidence,
    },
    durationMonths: point.durationMonths,
    immediateCostMillionJpy: amounts(point.remainingCostMillionJpy),
    immediateBenefitMillionJpy: amounts(0),
    requiredFundingMillionJpy: point.remainingCostMillionJpy,
    informationGain: [],
    cashFlowEventIds: [],
    transitions: [
      transition(
        "continue-capital-independent",
        point.qPhysical,
        "capital_independent",
        point.durationMonths,
        true,
        point.terminalValueMillionJpy,
        0,
        `calculation:${ESTIMATOR_VERSION}:stage-readiness-funding-prior`,
      ),
      transition(
        "continue-failed",
        1 - point.qPhysical,
        "failed",
        point.durationMonths,
        false,
        0,
        closureCost,
        `calculation:${ESTIMATOR_VERSION}:complement-and-closure-rate`,
      ),
    ],
    evidence: evidence(`calculation:${ESTIMATOR_VERSION}:continue-bundle`),
  };
  const abandonAction: Bzm21Action = {
    actionId: abandonId,
    bundleId: abandonId,
    kind: "abandon",
    componentKinds: ["abandon"],
    customComponents: [],
    sequence: ["abandon"],
    sharedResourceRequirements: [],
    label: "現在撤退",
    availability: "available",
    feasibility: {
      status: "confirmed",
      note: "撤退を共通比較行動として暫定的に有効化。契約制約は未測定。",
      evidence: evidence(`calculation:${ESTIMATOR_VERSION}:abandon-assumption`),
    },
    authority: {
      status: "confirmed",
      note: "会社controllerを置く暫定シナリオ。法定権限の実測ではない。",
      evidence: evidence(`calculation:${ESTIMATOR_VERSION}:company-controller-assumption`),
    },
    consents: [],
    financingFeasibility: {
      status: "not_required",
      openingCashMillionJpy: closureCost,
      committedFundingMillionJpy: 0,
      requiredFundingSchedule:
        closureCost > 0
          ? [
              {
                scheduleId: `${abandonId}:required:0`,
                atMonths: 0,
                amountMillionJpy: closureCost,
                purpose: "estimated-closure-cost",
                evidence: evidence(`calculation:${ESTIMATOR_VERSION}:closure-rate`),
              },
            ]
          : [],
      committedFundingSchedule: [],
      note: "撤退費用分の現金がある推定シナリオ。",
      evidence: evidence(`calculation:${ESTIMATOR_VERSION}:closure-funding-assumption`),
    },
    durationMonths: 0,
    immediateCostMillionJpy: amounts(closureCost),
    immediateBenefitMillionJpy: amounts(0),
    requiredFundingMillionJpy: closureCost,
    informationGain: [],
    cashFlowEventIds: [],
    transitions: [
      transition(
        "abandon-closed",
        1,
        "abandoned",
        0,
        false,
        0,
        0,
        `calculation:${ESTIMATOR_VERSION}:zero-recoverable-exit-assumption`,
      ),
    ],
    evidence: evidence(`calculation:${ESTIMATOR_VERSION}:abandon-bundle`),
  };
  const decisionState: Bzm21DecisionState = {
    stateId,
    label: "情報締切時点の単一暫定判断ノード",
    decisionOrder: 0,
    elapsedMonths: 0,
    currentState: {
      project_id: project.project_id,
      stage_class: stageClass(project),
      estimator_version: ESTIMATOR_VERSION,
      source_observation_rate: extractionObservationRate(project),
      provisional_projection_only: true,
    },
    beliefs: [],
    reachabilityHistory: {
      goal: {
        status: "not_reached",
        firstReachedAtMonths: null,
        evidence: evidence(`calculation:${ESTIMATOR_VERSION}:initial-goal-state`),
      },
      strategicSlack: {
        status: "available",
        firstLostAtMonths: null,
        evidence: evidence(`calculation:${ESTIMATOR_VERSION}:initial-slack-scenario`),
      },
    },
    decisionController: {
      controllerId: "pj-company-controller-estimated",
      kind: "company",
      objective: "company",
      evidence: evidence(`calculation:${ESTIMATOR_VERSION}:company-controller-assumption`),
    },
    sunkCostMillionJpy: null,
    remainingCostMillionJpy: point.remainingCostMillionJpy,
    remainingTimeMonths: point.durationMonths,
    availableInformation: compactSourceRefs(project),
    actions: [continueAction, abandonAction],
    evidence: evidence(`calculation:${ESTIMATOR_VERSION}:single-node-compression`),
  };
  const commonRuleEvidence = evidence(`calculation:${ESTIMATOR_VERSION}:common-rules`);
  const model: Bzm21DynamicPolicyModel = {
    schema: BZM21_DYNAMIC_POLICY_SCHEMA,
    modelId: `${project.project_id}:${MODEL_VERSION}`,
    modelVersion: MODEL_VERSION,
    dataMode: "project",
    currency: "JPY",
    valuationDate: VALUATION_DATE,
    informationCutoff: INFORMATION_CUTOFF,
    forwardValidationCount: 0,
    initialStateId: stateId,
    planDeadlineMonths: point.planDeadlineMonths,
    evaluationHorizonMonths: COMMON_EVALUATION_HORIZON_MONTHS,
    discountRatePerMonth: amounts(point.monthlyDiscountRate),
    valuationRuleByObjective: {
      company: {
        ruleId: "company-physical-probability-npv-v0.1",
        ruleRef: `calculation:${ESTIMATOR_VERSION}:company-physical-npv`,
        probabilityMeasure: "physical",
        discounting: "deterministic_rate",
        discountRateBasis: "nominal",
        taxBasis: "post_tax_inclusive",
        evidence: commonRuleEvidence,
      },
      bzsf: {
        ruleId: "bzsf-no-investment-leg-v0.1",
        ruleRef: `calculation:${ESTIMATOR_VERSION}:bzsf-not-applicable`,
        probabilityMeasure: "physical",
        discounting: "deterministic_rate",
        discountRateBasis: "nominal",
        taxBasis: "post_tax_inclusive",
        evidence: commonRuleEvidence,
      },
      public: {
        ruleId: "public-no-intervention-leg-v0.1",
        ruleRef: `calculation:${ESTIMATOR_VERSION}:public-not-applicable`,
        probabilityMeasure: "physical",
        discounting: "deterministic_rate",
        discountRateBasis: "nominal",
        taxBasis: "post_tax_inclusive",
        evidence: commonRuleEvidence,
      },
    } as Bzm21DynamicPolicyModel["valuationRuleByObjective"],
    decisionCriterionByObjective: {
      company: {
        criterion: "max_expected_net_value",
        nearTieToleranceMillionJpy: 0,
        evidence: commonRuleEvidence,
      },
      bzsf: {
        criterion: "max_expected_net_value",
        nearTieToleranceMillionJpy: 0,
        evidence: commonRuleEvidence,
      },
      public: {
        criterion: "max_expected_net_value",
        nearTieToleranceMillionJpy: 0,
        evidence: commonRuleEvidence,
      },
    },
    uncertaintyRule: {
      status: "stable",
      methodRef: `calculation:${ESTIMATOR_VERSION}:point-estimate-engine-run;external-stress-table-separate`,
      evidence: commonRuleEvidence,
    },
    tieBreakRule: {
      rule: "higher_goal_probability",
      actionPriorityByState: {},
      evidence: commonRuleEvidence,
    },
    publicValueRule: {
      fiscalRuleRef: `not-applicable:${ESTIMATOR_VERSION}:no-public-cashflow-leg`,
      socialMandateRef: `not-applicable:${ESTIMATOR_VERSION}:no-social-conversion`,
      socialConversionRuleRef: `not-applicable:${ESTIMATOR_VERSION}:no-social-conversion`,
      aggregationRuleRef: `not-applicable:${ESTIMATOR_VERSION}:explicit-zero-public-leg`,
      preregisteredAt: INFORMATION_CUTOFF,
      evidence: commonRuleEvidence,
    },
    baselinePolicyId: "fixed-continue-estimated-v0.1",
    baselinePolicy: { [stateId]: continueId },
    policyDefinitionRef: `calculation:${ESTIMATOR_VERSION}:fixed-continue-baseline`,
    cashFlowEvents: [],
    states: [decisionState],
    interventions: [],
  };
  return rebuildLedger(model);
}

function parameterRow(
  key: string,
  unit: string,
  source: SourceStatus,
  observedValue: unknown,
  inputStatus: ModelInputStatus,
  modelValue: unknown,
  refs: string[],
  methodRef: string,
  note: string,
): ParameterRow {
  return {
    key,
    unit,
    sourceStatus: source,
    observedValue,
    modelInputStatus: inputStatus,
    modelValue,
    sourceRefs: refs,
    methodRef,
    note,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [cohortAText, cohortBText] = await Promise.all([
    readFile(args.cohortA, "utf8"),
    readFile(args.cohortB, "utf8"),
  ]);
  const cohortA = JSON.parse(cohortAText) as JsonRecord;
  const cohortB = JSON.parse(cohortBText) as JsonRecord;
  const projects = [
    ...(Array.isArray(cohortA.projects) ? (cohortA.projects as ProjectSource[]) : []),
    ...(Array.isArray(cohortB.projects) ? (cohortB.projects as ProjectSource[]) : []),
  ].sort((left, right) => left.project_id.localeCompare(right.project_id));
  assert.deepEqual(
    projects.map((project) => project.project_id),
    [...EXPECTED_PROJECT_IDS].sort(),
    "exactly the 12 preregistered SPS projects must be present",
  );
  for (const project of projects) {
    assert.equal(
      project.source_cutoff ?? INFORMATION_CUTOFF,
      INFORMATION_CUTOFF,
      `${project.project_id}: source cutoff mismatch`,
    );
  }

  // Only priced rounds at or before the cutoff enter the pooled current-market
  // anchor. Future plan values for p20/p21 are deliberately excluded.
  const pricedRoundAnchorsMillionJpy = projects
    .flatMap((project) => {
      const hint = record(record(project.estimation_hints).terminal_value_proxy);
      const value = numberOrNull(hint.market_anchor_post_money_yen);
      const asOf = stringOrNull(hint.as_of);
      if (value === null || !asOf || Date.parse(asOf) > Date.parse(INFORMATION_CUTOFF)) {
        return [];
      }
      return [{ projectId: project.project_id, valueMillionJpy: value / 1_000_000, asOf }];
    });
  assert.ok(pricedRoundAnchorsMillionJpy.length >= 2, "at least two cutoff-eligible priced anchors required");
  const pooledCurrentMarketAnchorMillionJpy = median(
    pricedRoundAnchorsMillionJpy.map((candidate) => candidate.valueMillionJpy),
  );
  const observedPartialCostAnchorsMillionJpy = projects
    .map((project) => observedCostFloorMillionJpy(project))
    .filter((candidate): candidate is number => candidate !== null && candidate < 200);
  assert.ok(observedPartialCostAnchorsMillionJpy.length >= 2, "partial cost anchors required");
  const pooledPartialCostAnchorMillionJpy = median(observedPartialCostAnchorsMillionJpy);

  const projectResults = projects.map((project) => {
    const refs = compactSourceRefs(project);
    const r = readiness(project);
    const p = potential(project);
    const stage = stageClass(project);
    const stagePrior = STAGE_PRIORS[stage];
    const cash = cashObservation(project);
    const facts = fundingFacts(project);
    const fundingClass = fundingEvidenceClass(project, cash);
    const maturityPseudoObservation = Math.pow(r.bottleneck, 1.2);
    const stageReadinessQ =
      (stagePrior.alpha + 3 * maturityPseudoObservation) /
      (stagePrior.alpha + stagePrior.beta + 3);
    const qPhysical = round(
      clamp(
        stageReadinessQ * FUNDING_EVIDENCE_MULTIPLIERS[fundingClass],
        0.001,
        0.95,
      ),
    );
    const terminalValueMillionJpy = round(
      pooledCurrentMarketAnchorMillionJpy *
        CAPITAL_INDEPENDENCE_UPLIFT *
        (0.6 + 0.8 * p.normalized),
    );
    const commonRemainingCost =
      pooledPartialCostAnchorMillionJpy *
      FULL_SCOPE_COST_UPLIFT *
      (1 + 1.5 * (1 - r.mean));
    const observedCostFloor = observedCostFloorMillionJpy(project);
    const remainingCostMillionJpy = round(
      Math.max(commonRemainingCost, observedCostFloor ?? 0),
    );
    const durationMonths = Math.ceil(clamp(18 + 42 * (1 - r.mean), 12, 60));
    const planDeadlineObserved = observedPlanDeadlineMonths(project);
    const planDeadlineMonths =
      planDeadlineObserved ?? COMMON_EVALUATION_HORIZON_MONTHS;
    const openingCashMillionJpy = round(
      Math.min(
        remainingCostMillionJpy,
        cash.balanceMillionJpy ??
          remainingCostMillionJpy * DEFAULT_MISSING_CASH_SHARE,
      ),
    );
    const observedCommittedMillionJpy = round(
      Math.min(
        Math.max(0, remainingCostMillionJpy - openingCashMillionJpy),
        facts.committedMillionJpy ?? 0,
      ),
    );
    const point = {
      qPhysical,
      terminalValueMillionJpy,
      remainingCostMillionJpy,
      durationMonths,
      planDeadlineMonths,
      openingCashMillionJpy,
      observedCommittedMillionJpy,
      monthlyDiscountRate: COMMON_MONTHLY_DISCOUNT_RATE,
    };
    const model = buildModel(project, point);
    const validationIssues = validateBzm21DynamicPolicyModel(model);
    const errors = validationIssues.filter((issue) => issue.severity === "error");
    assert.equal(errors.length, 0, `${project.project_id}: ${JSON.stringify(errors, null, 2)}`);
    const evaluation = evaluateBzm21DynamicPolicyModel(model);
    assert.notEqual(evaluation.status, "not_computable", `${project.project_id}: engine did not compute`);
    const company = companyResult(evaluation);
    const sensitivityCases = [
      {
        scenarioId: "downside" as const,
        qMultiplier: 0.6,
        terminalValueMultiplier: 0.5,
        remainingCostMultiplier: 1.5,
        monthlyDiscountRate: 0.015,
      },
      {
        scenarioId: "point" as const,
        qMultiplier: 1,
        terminalValueMultiplier: 1,
        remainingCostMultiplier: 1,
        monthlyDiscountRate: COMMON_MONTHLY_DISCOUNT_RATE,
      },
      {
        scenarioId: "upside" as const,
        qMultiplier: 1.4,
        terminalValueMultiplier: 1.5,
        remainingCostMultiplier: 0.7,
        monthlyDiscountRate: 0.005,
      },
    ];
    const sensitivity: SensitivityPoint[] = sensitivityCases.map((scenario) => {
      const scenarioRemainingCost = round(
        remainingCostMillionJpy * scenario.remainingCostMultiplier,
      );
      const scenarioOpeningCash = round(
        Math.min(
          scenarioRemainingCost,
          cash.balanceMillionJpy ??
            scenarioRemainingCost * DEFAULT_MISSING_CASH_SHARE,
        ),
      );
      const scenarioModel = buildModel(project, {
        ...point,
        qPhysical: round(clamp(qPhysical * scenario.qMultiplier, 0.001, 0.95)),
        terminalValueMillionJpy: round(
          terminalValueMillionJpy * scenario.terminalValueMultiplier,
        ),
        remainingCostMillionJpy: scenarioRemainingCost,
        openingCashMillionJpy: scenarioOpeningCash,
        observedCommittedMillionJpy: Math.min(
          facts.committedMillionJpy ?? 0,
          Math.max(0, scenarioRemainingCost - scenarioOpeningCash),
        ),
        monthlyDiscountRate: scenario.monthlyDiscountRate,
      });
      const result = companyResult(evaluateBzm21DynamicPolicyModel(scenarioModel));
      return {
        ...scenario,
        selectedActionId: result.optimal.selectedActionByState["current-decision"],
        expectedNetValueMillionJpy: round(result.optimal.expectedNetValueMillionJpy),
        goalProbability: round(result.optimal.goalProbability),
      };
    });
    const parameters: ParameterRow[] = [
      parameterRow(
        "stage_class",
        "class",
        "observed",
        stage,
        "calculated",
        stage,
        refs,
        "RC-STAGE-01",
        "設立状態だけを共通4区分へ写像。AMD契約終了は会社終了へ変換しない。",
      ),
      parameterRow(
        "readiness_trl_brl_hrl",
        "0-9 vector",
        r.sourceStatus,
        { trl: r.trl, brl: r.brl, hrl: r.hrl, rawStatus: r.rawStatus },
        r.sourceStatus === "observed" ? "observed" : "estimated",
        { trl: r.trl, brl: r.brl, hrl: r.hrl },
        refs,
        "RC-Q-01",
        "legacy/XRL値は遷移確率ではなく、共通事前分布への成熟度pseudo-observationにだけ使う。",
      ),
      parameterRow(
        "legacy_economic_potential_proxy",
        "normalized 0-1",
        p.sourceStatus,
        { value: p.observedValue, scale: p.sourceScale },
        p.sourceStatus === "observed" ? "calculated" : "estimated",
        round(p.normalized),
        refs,
        "RC-TV-01",
        "旧potentialを円価値にせず、共通terminal anchorの相対幅にだけ使う。",
      ),
      parameterRow(
        "p_phys_continue_to_capital_independent",
        "probability",
        "missing",
        null,
        "estimated",
        qPhysical,
        refs,
        "RC-Q-01",
        `仮想標本stage Beta(${stagePrior.alpha},${stagePrior.beta})へbottleneck pseudo-weight 3を加え、資金根拠class=${fundingClass}の共通倍率を一度だけ掛けた。観測頻度で校正済みではない。`,
      ),
      parameterRow(
        "terminal_value_company",
        "million JPY",
        sourceStatus(record(record(project.estimation_hints).terminal_value_proxy).status),
        record(project.estimation_hints).terminal_value_proxy ?? null,
        "estimated",
        terminalValueMillionJpy,
        refs,
        "RC-TV-01",
        "cutoff以前のpriced-round 2件のpool中央値×資本自立uplift 10×共通potential幅。将来計画価値p20/p21はpoolから除外。",
      ),
      parameterRow(
        "remaining_cost_company",
        "million JPY",
        sourceStatus(record(record(project.estimation_hints).remaining_cost_proxy).status),
        record(project.estimation_hints).remaining_cost_proxy ?? null,
        "estimated",
        remainingCostMillionJpy,
        refs,
        "RC-COST-01",
        `partial action-cost pool中央値×full-scope uplift ${FULL_SCOPE_COST_UPLIFT}×未成熟度。明示的なPJ下限${observedCostFloor ?? "なし"}百万円が大きければ下限として採用。`,
      ),
      parameterRow(
        "remaining_time",
        "months",
        "missing",
        null,
        "estimated",
        durationMonths,
        refs,
        "RC-DURATION-01",
        "全PJ共通式 ceil(18 + 42×(1-readiness mean))。工程順序の実測ではない。",
      ),
      parameterRow(
        "opening_cash",
        "million JPY",
        cash.status,
        cash.sourceValue,
        cash.balanceMillionJpy === null ? "estimated" : "observed",
        openingCashMillionJpy,
        refs,
        "RC-CASH-01",
        cash.balanceMillionJpy === null
          ? `欠測時は推定残費用の${DEFAULT_MISSING_CASH_SHARE * 100}%をscenario cashとして置く。現在残高の主張ではない。`
          : "cutoff以前の部分観測を上限に使う。銀行照合済みとは限らない。",
      ),
      parameterRow(
        "imputed_financing_gap",
        "million JPY",
        facts.committedMillionJpy === null ? "missing" : "partial",
        facts.committedMillionJpy,
        "estimated",
        round(Math.max(0, remainingCostMillionJpy - openingCashMillionJpy)),
        refs,
        "RC-FUND-01",
        "エンジン実行用に不足額を判断時点で確保した条件付きscenario。契約済み・調達可能性の実測ではない。",
      ),
      parameterRow(
        "failure_closure_loss",
        "million JPY",
        "missing",
        null,
        "estimated",
        round(remainingCostMillionJpy * FAILURE_CLOSURE_RATE),
        refs,
        "RC-LOSS-01",
        `失敗時の追加閉鎖費用を共通${FAILURE_CLOSURE_RATE * 100}%と置く。投入済み残費用と二重計上しない。`,
      ),
      parameterRow(
        "abandon_recoverable_value",
        "million JPY",
        "missing",
        null,
        "estimated",
        0,
        refs,
        "RC-EXIT-01",
        "売却・転用・license権利の確認前は保守的推定0。観測された0ではない。",
      ),
      parameterRow(
        "plan_deadline",
        "months",
        planDeadlineObserved === null ? "missing" : "partial",
        planDeadlineObserved,
        planDeadlineObserved === null ? "estimated" : "calculated",
        planDeadlineMonths,
        refs,
        "RC-HORIZON-01",
        planDeadlineObserved === null
          ? "欠測時は共通経済地平60か月と同じ暫定期限。"
          : "cutoff以前の計画日から月数換算。",
      ),
      parameterRow(
        "economic_horizon",
        "months",
        "missing",
        null,
        "estimated",
        COMMON_EVALUATION_HORIZON_MONTHS,
        refs,
        "RC-HORIZON-01",
        "全12PJ共通60か月。",
      ),
      parameterRow(
        "discount_rate_per_month",
        "rate",
        "missing",
        null,
        "estimated",
        COMMON_MONTHLY_DISCOUNT_RATE,
        refs,
        "RC-DISCOUNT-01",
        "名目月1%。市場整合価格づけではなく、共通の暫定物理確率NPV規則。",
      ),
    ];
    const numericRows = parameters.filter(
      (row) =>
        typeof row.modelValue === "number" ||
        (row.modelValue && typeof row.modelValue === "object"),
    );
    const estimatedRows = numericRows.filter(
      (row) => row.modelInputStatus === "estimated",
    );
    const selectedActionId = company.optimal.selectedActionByState["current-decision"];
    const sourceExtractHashSha256 = sha256(stableJson(project));
    const inputHashSha256 = sha256(
      stableJson({
        projectId: project.project_id,
        sourceCutoff: project.source_cutoff ?? INFORMATION_CUTOFF,
        sourceExtractHashSha256,
        sourceRefs: refs,
        parameters,
        model,
      }),
    );
    return {
      projectId: project.project_id,
      sourceCohort: EXPECTED_PROJECT_IDS.indexOf(project.project_id as never) < 6 ? "A" : "B",
      sourceCutoff: project.source_cutoff ?? INFORMATION_CUTOFF,
      sourceRefs: refs,
      sourceObservationRate: extractionObservationRate(project),
      modelId: model.modelId,
      modelVersion: model.modelVersion,
      sourceExtractHashSha256,
      inputHashSha256,
      resultStatus: "estimated_v0.1_provisional",
      useGate: "shadow_display_only_allocation_prohibited",
      parameters,
      estimationRatio: round(estimatedRows.length / numericRows.length),
      model,
      validation: {
        errorCount: errors.length,
        warningCount: validationIssues.filter((issue) => issue.severity === "warning").length,
        issues: validationIssues,
      },
      outputs: {
        unit: "million JPY",
        selectedActionId,
        expectedFutureNetProjectValueMillionJpy: round(
          company.optimal.expectedNetValueMillionJpy,
        ),
        sps21EstimatedMillionJpy: round(
          company.optimal.expectedNetValueMillionJpy,
        ),
        qSelectedPolicy: round(company.optimal.goalProbability),
        qFixedContinueBaseline: round(company.baseline.goalProbability),
        baselineDifferenceMillionJpy: round(
          company.valueDifferenceFromBaselineMillionJpy,
        ),
        requiredFundingMillionJpy: round(
          company.optimal.expectedCumulativeFundingMillionJpy,
        ),
        expectedFailureLossMillionJpy: round(
          company.optimal.expectedFailureLossMillionJpy,
        ),
        conditionalGoalValueMillionJpy:
          company.optimal.conditionalGoalValueMillionJpy === null
            ? null
            : round(company.optimal.conditionalGoalValueMillionJpy),
        controllerOptionValueMillionJpy:
          company.controllerOptionValueMillionJpy === null
            ? null
            : round(company.controllerOptionValueMillionJpy),
        forwardValidationCount: 0,
      },
      sensitivity: {
        points: sensitivity,
        selectedActionSwitches:
          new Set(sensitivity.map((candidate) => candidate.selectedActionId)).size > 1,
        valueRangeMillionJpy: [
          Math.min(...sensitivity.map((candidate) => candidate.expectedNetValueMillionJpy)),
          Math.max(...sensitivity.map((candidate) => candidate.expectedNetValueMillionJpy)),
        ],
        note: "信頼区間ではない。q×0.6/1.4、terminal×0.5/1.5、cost×1.5/0.7、月次割引1.5%/0.5%の機械的stress。",
      },
      engineEvaluation: evaluation,
    };
  });

  const withoutHash = {
    schemaVersion: "sps-2.1-estimated-v0.1-output",
    estimatorVersion: ESTIMATOR_VERSION,
    modelVersion: MODEL_VERSION,
    informationCutoff: INFORMATION_CUTOFF,
    valuationDate: VALUATION_DATE,
    currency: "JPY",
    amountUnit: "million JPY",
    generatedAt: INFORMATION_CUTOFF,
    generatedAtPolicy:
      "fixed_to_information_cutoff_for_byte_reproducibility; not wall-clock generation time",
    inputFiles: {
      cohortA: { sourceId: "cohort-a.json", sha256: sha256(cohortAText) },
      cohortB: { sourceId: "cohort-b.json", sha256: sha256(cohortBText) },
    },
    resultBoundary: {
      status: "low_precision_estimated_v0.1_unvalidated",
      purpose: "全PJで数値を出し、抽出・モデル接続上の課題を可視化するshadow表示",
      notClaims: [
        "観測済みの会社価値",
        "校正済みの成功確率",
        "会社全体の時価総額",
        "BZSF投資価値",
        "公的社会価値",
        "資源配分または投資推薦",
      ],
      forwardValidationCount: 0,
      missingWasNotOverwritten: true,
      estimateLayerIsSeparate: true,
    },
    estimatorContract: {
      qRule: {
        ruleId: "RC-Q-01",
        formula:
          "q = ((stage_alpha + 3 * (min(TRL,BRL,HRL)/9)^1.2) / (stage_alpha + stage_beta + 3)) * funding_evidence_multiplier",
        stagePriors: STAGE_PRIORS,
        fundingEvidenceMultipliers: FUNDING_EVIDENCE_MULTIPLIERS,
        warning: "alpha/betaは共通の暫定事前分布であり、観測頻度で校正済みではない。",
      },
      terminalValueRule: {
        ruleId: "RC-TV-01",
        cutoffEligiblePricedRoundAnchorsMillionJpy: pricedRoundAnchorsMillionJpy,
        excludedFuturePlanAnchors: [
          { projectId: "p20", reason: "future unfrozen capital-plan valuation" },
          { projectId: "p21", reason: "future unfrozen Series-B plan valuation" },
        ],
        pooledCurrentMarketAnchorMillionJpy: round(pooledCurrentMarketAnchorMillionJpy),
        capitalIndependenceUplift: CAPITAL_INDEPENDENCE_UPLIFT,
        formula: "pooled_anchor * 10 * (0.6 + 0.8 * normalized_legacy_economic_potential)",
      },
      remainingCostRule: {
        ruleId: "RC-COST-01",
        partialCostAnchorsMillionJpy: observedPartialCostAnchorsMillionJpy,
        pooledPartialCostAnchorMillionJpy: round(pooledPartialCostAnchorMillionJpy),
        fullScopeUplift: FULL_SCOPE_COST_UPLIFT,
        formula:
          "max(project_evidence_floor, pooled_partial_cost_anchor * 5 * (1 + 1.5 * (1-readiness_mean)))",
      },
      durationRule: {
        ruleId: "RC-DURATION-01",
        formula: "ceil(clamp(18 + 42 * (1-readiness_mean), 12, 60))",
      },
      fundingRule: {
        ruleId: "RC-FUND-01",
        missingCashShareOfEstimatedCost: DEFAULT_MISSING_CASH_SHARE,
        scenario:
          "資金不足は判断時点に充足した条件付きscenarioとしてengine gateへ渡す。現在の契約済み資金を意味しない。",
      },
      valueRule: {
        monthlyNominalDiscountRate: COMMON_MONTHLY_DISCOUNT_RATE,
        economicHorizonMonths: COMMON_EVALUATION_HORIZON_MONTHS,
        companyOnly: true,
        financingCashFlowExcludedFromCompanyValue: true,
        bzsfAndPublicLegs: "explicit not_applicable zero in this company-only scenario",
      },
    },
    summary: {
      projectCount: projectResults.length,
      computedCompanyCount: projectResults.filter(
        (project) => project.engineEvaluation.perspectives.company.status === "computed",
      ).length,
      selectedContinueCount: projectResults.filter(
        (project) => project.outputs.selectedActionId === "continue-estimated-path",
      ).length,
      selectedAbandonCount: projectResults.filter(
        (project) => project.outputs.selectedActionId === "abandon-now",
      ).length,
      sensitivitySwitchCount: projectResults.filter(
        (project) => project.sensitivity.selectedActionSwitches,
      ).length,
      meanEstimationRatio: round(
        projectResults.reduce((sum, project) => sum + project.estimationRatio, 0) /
          projectResults.length,
      ),
    },
    projects: projectResults,
  };
  const output = {
    ...withoutHash,
    contentHashSha256: sha256(stableJson(withoutHash)),
  };
  const rendered = `${JSON.stringify(output, null, 2)}\n`;
  if (args.check) {
    const current = await readFile(args.output, "utf8");
    assert.equal(current, rendered, "generated artifact is stale");
  } else {
    await writeFile(args.output, rendered, "utf8");
  }
  console.log(
    JSON.stringify(
      {
        output: args.output,
        contentHashSha256: output.contentHashSha256,
        ...withoutHash.summary,
      },
      null,
      2,
    ),
  );
}

await main();
