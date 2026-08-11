import assert from "node:assert/strict";
import {
  BZM21_ACTION_KINDS,
  BZM21_DYNAMIC_POLICY_SCHEMA,
  evaluateBzm21DynamicPolicyModel,
  validateBzm21DynamicPolicyModel,
  type Bzm21Action,
  type Bzm21CashFlowCategory,
  type Bzm21CashFlowEvent,
  type Bzm21DecisionState,
  type Bzm21DynamicPolicyModel,
  type Bzm21EvidenceRef,
  type Bzm21ObjectiveAmounts,
  type Bzm21Transition,
} from "../src/lib/bzm-2-1-dynamic-policy.ts";

const INFORMATION_CUTOFF = "2026-08-11T00:00:00+09:00";

const SYNTHETIC_EVIDENCE: Bzm21EvidenceRef = {
  kind: "synthetic",
  ref: "synthetic:bzm-2.1-contract-test",
  informationCutoff: INFORMATION_CUTOFF,
};

function amounts(
  company: number | null,
  bzsf = company,
  publicValue = company,
): Bzm21ObjectiveAmounts {
  return { company, bzsf, public: publicValue };
}

function syntheticCashFlowEvent(
  stateId: string,
  actionId: string,
  transitionId: string | null,
  includedIn: Bzm21CashFlowCategory,
  objectiveAmountsMillionJpy: Bzm21ObjectiveAmounts,
): Bzm21CashFlowEvent {
  const eventId = [
    stateId,
    actionId,
    transitionId ?? "action",
    includedIn,
  ].join(":");
  return {
    eventId,
    label: eventId,
    stateId,
    actionId,
    transitionId,
    timing: transitionId === null ? "action_start" : "action_end",
    includedIn,
    objectiveAmountsMillionJpy: { ...objectiveAmountsMillionJpy },
    owner: "synthetic-owner",
    counterparty: "synthetic-counterparty",
    scope: "synthetic-contract-test",
    amountBasis: "nominal",
    taxTreatment: "not_applicable",
    evidence: SYNTHETIC_EVIDENCE,
  };
}

function rebuildCashFlowLedger(
  model: Bzm21DynamicPolicyModel,
): Bzm21DynamicPolicyModel {
  const events: Bzm21CashFlowEvent[] = [];
  for (const decisionState of model.states) {
    for (const candidateAction of decisionState.actions) {
      candidateAction.cashFlowEventIds = [];
      for (const [category, values] of [
        ["immediate_cost", candidateAction.immediateCostMillionJpy],
        ["immediate_benefit", candidateAction.immediateBenefitMillionJpy],
      ] as const) {
        const event = syntheticCashFlowEvent(
          decisionState.stateId,
          candidateAction.actionId,
          null,
          category,
          values,
        );
        events.push(event);
        candidateAction.cashFlowEventIds.push(event.eventId);
      }
      for (const candidateTransition of candidateAction.transitions) {
        candidateTransition.cashFlowEventIds = [];
        const categories: Array<
          readonly [Bzm21CashFlowCategory, Bzm21ObjectiveAmounts]
        > = [
          [
            "transition_cash_flow",
            candidateTransition.transitionCashFlowMillionJpy,
          ],
        ];
        if (candidateTransition.nextStateId === null) {
          categories.push(
            ["terminal_value", candidateTransition.terminalValueMillionJpy],
            ["failure_loss", candidateTransition.failureLossMillionJpy],
          );
        }
        for (const [category, values] of categories) {
          const event = syntheticCashFlowEvent(
            decisionState.stateId,
            candidateAction.actionId,
            candidateTransition.transitionId,
            category,
            values,
          );
          events.push(event);
          candidateTransition.cashFlowEventIds.push(event.eventId);
        }
      }
    }
  }
  model.cashFlowEvents = events;
  return model;
}

function transition(
  overrides: Partial<Bzm21Transition> &
    Pick<Bzm21Transition, "transitionId" | "probability">,
): Bzm21Transition {
  return {
    label: overrides.transitionId,
    nextStateId: null,
    terminalOutcome: "failed",
    goalReachedAtMonths: null,
    slackLostAtMonths: null,
    cashFlowEventIds: [],
    transitionCashFlowMillionJpy: amounts(0),
    terminalValueMillionJpy: amounts(0),
    failureLossMillionJpy: amounts(0),
    evidence: SYNTHETIC_EVIDENCE,
    ...overrides,
  };
}

function action(
  overrides: Partial<Bzm21Action> &
    Pick<Bzm21Action, "actionId" | "kind" | "transitions">,
): Bzm21Action {
  const requiredFunding = overrides.requiredFundingMillionJpy ?? 0;
  return {
    bundleId: overrides.actionId,
    label: overrides.actionId,
    componentKinds: [overrides.kind],
    customComponents: [],
    sequence: [overrides.kind],
    sharedResourceRequirements: [],
    availability: "available",
    feasibility: {
      status: "confirmed",
      note: "synthetic executable action",
      evidence: SYNTHETIC_EVIDENCE,
    },
    authority: {
      status: "confirmed",
      note: "synthetic controller has authority",
      evidence: SYNTHETIC_EVIDENCE,
    },
    consents: [],
    financingFeasibility: {
      status: requiredFunding > 0 ? "secured" : "not_required",
      committedFundingMillionJpy: requiredFunding,
      note:
        requiredFunding > 0
          ? "synthetic funding secured"
          : "synthetic action requires no funding",
      evidence: SYNTHETIC_EVIDENCE,
    },
    durationMonths: 0,
    immediateCostMillionJpy: amounts(0),
    immediateBenefitMillionJpy: amounts(0),
    requiredFundingMillionJpy: 0,
    informationGain: [],
    cashFlowEventIds: [],
    evidence: SYNTHETIC_EVIDENCE,
    ...overrides,
  };
}

function state(
  overrides: Partial<Bzm21DecisionState> &
    Pick<Bzm21DecisionState, "stateId" | "decisionOrder" | "actions">,
): Bzm21DecisionState {
  return {
    label: overrides.stateId,
    elapsedMonths: 0,
    currentState: { synthetic_state: overrides.stateId },
    beliefs: [],
    reachabilityHistory: {
      goal: {
        status: "not_reached",
        firstReachedAtMonths: null,
        evidence: SYNTHETIC_EVIDENCE,
      },
      strategicSlack: {
        status: "available",
        firstLostAtMonths: null,
        evidence: SYNTHETIC_EVIDENCE,
      },
    },
    decisionController: {
      controllerId: "synthetic-company-board",
      kind: "company",
      objective: "company",
      evidence: SYNTHETIC_EVIDENCE,
    },
    sunkCostMillionJpy: 0,
    remainingCostMillionJpy: 0,
    remainingTimeMonths: 0,
    availableInformation: [],
    evidence: SYNTHETIC_EVIDENCE,
    ...overrides,
  };
}

function commonDecisionRules() {
  return {
    planDeadlineMonths: 12,
    evaluationHorizonMonths: 12,
    valuationRuleByObjective: {
      company: {
        ruleId: "synthetic-company-npv",
        ruleRef: "synthetic:company-npv",
        probabilityMeasure: "physical" as const,
        discounting: "deterministic_rate" as const,
        discountRateBasis: "nominal" as const,
        evidence: SYNTHETIC_EVIDENCE,
      },
      bzsf: {
        ruleId: "synthetic-bzsf-npv",
        ruleRef: "synthetic:bzsf-npv",
        probabilityMeasure: "physical" as const,
        discounting: "deterministic_rate" as const,
        discountRateBasis: "nominal" as const,
        evidence: SYNTHETIC_EVIDENCE,
      },
      public: {
        ruleId: "synthetic-public-npv",
        ruleRef: "synthetic:public-npv",
        probabilityMeasure: "physical" as const,
        discounting: "deterministic_rate" as const,
        discountRateBasis: "nominal" as const,
        evidence: SYNTHETIC_EVIDENCE,
      },
    },
    decisionCriterionByObjective: {
      company: {
        criterion: "max_expected_net_value" as const,
        nearTieToleranceMillionJpy: 0,
        evidence: SYNTHETIC_EVIDENCE,
      },
      bzsf: {
        criterion: "max_expected_net_value" as const,
        nearTieToleranceMillionJpy: 0,
        evidence: SYNTHETIC_EVIDENCE,
      },
      public: {
        criterion: "max_expected_net_value" as const,
        nearTieToleranceMillionJpy: 0,
        evidence: SYNTHETIC_EVIDENCE,
      },
    },
    uncertaintyRule: {
      status: "stable" as const,
      methodRef: "synthetic:complete-enumeration",
      evidence: SYNTHETIC_EVIDENCE,
    },
    tieBreakRule: {
      rule: "higher_goal_probability" as const,
      actionPriorityByState: {},
      evidence: SYNTHETIC_EVIDENCE,
    },
    publicValueRule: {
      fiscalRuleRef: "synthetic:public-fiscal",
      socialMandateRef: "synthetic:public-mandate",
      socialConversionRuleRef: "synthetic:public-social-conversion",
      aggregationRuleRef: "synthetic:public-aggregation",
      preregisteredAt: INFORMATION_CUTOFF,
      evidence: SYNTHETIC_EVIDENCE,
    },
  };
}

function baseModel(): Bzm21DynamicPolicyModel {
  const model: Bzm21DynamicPolicyModel = {
    schema: BZM21_DYNAMIC_POLICY_SCHEMA,
    modelId: "synthetic-single-node",
    modelVersion: "v0.1",
    dataMode: "synthetic",
    currency: "JPY",
    valuationDate: "2026-08-11",
    informationCutoff: INFORMATION_CUTOFF,
    forwardValidationCount: 0,
    initialStateId: "decision",
    ...commonDecisionRules(),
    discountRatePerMonth: amounts(0),
    baselinePolicyId: "fixed-current-plan",
    baselinePolicy: { decision: "continue" },
    policyDefinitionRef: "synthetic:fixed-current-plan",
    cashFlowEvents: [],
    states: [
      state({
        stateId: "decision",
        decisionOrder: 0,
        currentState: {
          technical_gate: "unresolved",
          funding_gate: "open",
        },
        remainingCostMillionJpy: 40,
        remainingTimeMonths: 12,
        availableInformation: ["synthetic prior"],
        actions: [
          action({
            actionId: "continue",
            kind: "continue",
            label: "開発を続ける",
            durationMonths: 12,
            immediateCostMillionJpy: amounts(40, 30, 10),
            requiredFundingMillionJpy: 40,
            transitions: [
              transition({
                transitionId: "continue-success",
                probability: 0.4,
                terminalOutcome: "capital_independent",
                goalReachedAtMonths: 12,
                terminalValueMillionJpy: amounts(100, 45, 200),
              }),
              transition({
                transitionId: "continue-failure",
                probability: 0.6,
                terminalOutcome: "failed",
                slackLostAtMonths: 12,
                failureLossMillionJpy: amounts(10, 30, 20),
              }),
            ],
          }),
          action({
            actionId: "license",
            kind: "license",
            label: "第三者へライセンスする",
            immediateCostMillionJpy: amounts(2),
            transitions: [
              transition({
                transitionId: "license-close",
                probability: 1,
                terminalOutcome: "licensed",
                terminalValueMillionJpy: amounts(20, 5, 30),
              }),
            ],
          }),
          action({
            actionId: "abandon",
            kind: "abandon",
            label: "撤退する",
            transitions: [
              transition({
                transitionId: "abandon-close",
                probability: 1,
                terminalOutcome: "abandoned",
                terminalValueMillionJpy: amounts(8, 0, 3),
              }),
            ],
          }),
        ],
      }),
    ],
  };
  return rebuildCashFlowLedger(model);
}

function getComputedPerspective(
  model: Bzm21DynamicPolicyModel,
  perspective: "company" | "bzsf" | "public",
) {
  const result = evaluateBzm21DynamicPolicyModel(model);
  const perspectiveResult = result.perspectives[perspective];
  assert.equal(
    perspectiveResult.status,
    "computed",
    JSON.stringify(perspectiveResult, null, 2),
  );
  return perspectiveResult;
}

assert.deepEqual(BZM21_ACTION_KINDS, [
  "continue",
  "wait",
  "retry",
  "pivot",
  "scale_down",
  "scale_up",
  "license",
  "abandon",
]);

// The fixed plan remains a baseline. The registered controller optimizes one
// objective, then the same selected policy is evaluated from all three views.
const base = baseModel();
const baseResult = evaluateBzm21DynamicPolicyModel(base);
assert.equal(baseResult.status, "computed");
assert.equal(baseResult.forwardValidationCount, 0);
assert.deepEqual(baseResult.activeInterventionIds, []);
assert.deepEqual(baseResult.baselineReachability, {
  status: "computed",
  policyId: "fixed-current-plan",
  goalProbability: 0.4,
  planDeadlineGoalProbability: 0.4,
});

const companyBase = getComputedPerspective(base, "company");
assert.equal(companyBase.baseline.goalProbability, 0.4);
assert.equal(companyBase.baseline.planDeadlineGoalProbability, 0.4);
assert.equal(companyBase.baseline.expectedNetValueMillionJpy, -6);
assert.equal(companyBase.optimal.selectedActionByState.decision, "license");
assert.equal(companyBase.optimal.goalProbability, 0);
assert.equal(companyBase.optimal.expectedNetValueMillionJpy, 18);
assert.equal(companyBase.valueDifferenceFromBaselineMillionJpy, 24);
assert.equal(companyBase.controllerOptionValueMillionJpy, 24);
assert.equal(companyBase.optimal.expectedExitValueMillionJpy, 20);
const companyContinue = companyBase.optimal.stateDecisions[0].actions.find(
  (candidate) => candidate.actionId === "continue",
);
assert.ok(companyContinue);
assert.equal(companyContinue.goalProbability, 0.4);
// E[net value | G] includes the same ledger's 40 cost and 100 success value.
assert.equal(companyContinue.conditionalGoalValueMillionJpy, 60);
assert.equal(companyContinue.expectedCumulativeFundingMillionJpy, 40);
assert.equal(companyContinue.expectedFailureLossMillionJpy, 6);

const publicBase = getComputedPerspective(base, "public");
assert.equal(publicBase.optimal.selectionObjective, "company");
assert.equal(publicBase.optimal.selectedActionByState.decision, "license");
assert.equal(publicBase.optimal.goalProbability, 0);
assert.equal(publicBase.optimal.expectedNetValueMillionJpy, 28);
assert.equal(publicBase.valueDifferenceFromBaselineMillionJpy, -30);
assert.equal(publicBase.controllerOptionValueMillionJpy, null);
const bzsfBase = getComputedPerspective(base, "bzsf");
assert.equal(bzsfBase.optimal.selectedActionByState.decision, "license");
assert.equal(bzsfBase.optimal.goalProbability, 0);

const publicControlled = structuredClone(base);
publicControlled.modelId = "synthetic-public-controller";
publicControlled.states[0].decisionController = {
  controllerId: "synthetic-public-funder",
  kind: "public",
  objective: "public",
  evidence: SYNTHETIC_EVIDENCE,
};
const publicControlledResult = getComputedPerspective(
  publicControlled,
  "public",
);
assert.equal(publicControlledResult.optimal.selectionObjective, "public");
assert.equal(
  publicControlledResult.optimal.selectedActionByState.decision,
  "continue",
);
assert.equal(publicControlledResult.optimal.goalProbability, 0.4);
assert.equal(publicControlledResult.optimal.expectedNetValueMillionJpy, 58);

// A higher success-state company value changes the company-optimal action and,
// through that policy choice, changes q. q itself was never directly edited.
const higherSuccessValue = structuredClone(base);
higherSuccessValue.modelId = "synthetic-higher-success-value";
const successTransition = higherSuccessValue.states[0].actions[0].transitions[0];
successTransition.terminalValueMillionJpy.company = 200;
rebuildCashFlowLedger(higherSuccessValue);
const higherSuccessCompany = getComputedPerspective(
  higherSuccessValue,
  "company",
);
assert.equal(
  higherSuccessCompany.optimal.selectedActionByState.decision,
  "continue",
);
assert.equal(higherSuccessCompany.optimal.goalProbability, 0.4);
assert.equal(higherSuccessCompany.optimal.expectedNetValueMillionJpy, 34);
// T4: under the complete fixed policy, changing only terminal value changes V
// but leaves the physical first-passage probability unchanged.
assert.equal(higherSuccessCompany.baseline.expectedNetValueMillionJpy, 34);
assert.equal(higherSuccessCompany.baseline.goalProbability, 0.4);
assert.notEqual(
  higherSuccessCompany.baseline.expectedNetValueMillionJpy,
  companyBase.baseline.expectedNetValueMillionJpy,
);

// Cost is not hidden inside a discount rate. Raising the path cost can reverse
// the decision and therefore lower endogenous q again.
const higherCost = structuredClone(higherSuccessValue);
higherCost.modelId = "synthetic-higher-cost";
higherCost.states[0].actions[0].immediateCostMillionJpy.company = 80;
rebuildCashFlowLedger(higherCost);
const higherCostCompany = getComputedPerspective(higherCost, "company");
assert.equal(higherCostCompany.optimal.selectedActionByState.decision, "license");
assert.equal(higherCostCompany.optimal.goalProbability, 0);

// A measured abandonment value can dominate both continuation and licensing.
const higherAbandonmentValue = structuredClone(base);
higherAbandonmentValue.modelId = "synthetic-higher-abandonment-value";
const abandonTransition = higherAbandonmentValue.states[0].actions
  .find((candidate) => candidate.actionId === "abandon")
  ?.transitions.find((candidate) => candidate.transitionId === "abandon-close");
assert.ok(abandonTransition);
abandonTransition.terminalValueMillionJpy.company = 50;
rebuildCashFlowLedger(higherAbandonmentValue);
const higherAbandonmentCompany = getComputedPerspective(
  higherAbandonmentValue,
  "company",
);
assert.equal(
  higherAbandonmentCompany.optimal.selectedActionByState.decision,
  "abandon",
);
assert.equal(higherAbandonmentCompany.optimal.expectedExitValueMillionJpy, 50);
assert.equal(higherAbandonmentCompany.optimal.goalProbability, 0);

// A subsidy changes the action's cost/funding boundary. It does not add to q.
// The same support has a public cost, so company and public policies can split.
const supported = structuredClone(base);
supported.modelId = "synthetic-supported";
supported.interventions = [
  {
    interventionId: "cost-share",
    label: "開発費の費用補助",
    enabled: true,
    evidence: SYNTHETIC_EVIDENCE,
    effects: [
      {
        stateId: "decision",
        actionId: "continue",
        cashFlowEventDeltas: [
          {
            eventId: "decision:continue:action:immediate_cost",
            amountDeltaMillionJpy: { company: -30, public: 35 },
          },
        ],
        requiredFundingDeltaMillionJpy: -30,
      },
    ],
  },
];
const supportedResult = evaluateBzm21DynamicPolicyModel(supported);
assert.deepEqual(supportedResult.activeInterventionIds, ["cost-share"]);
const supportedCompany = supportedResult.perspectives.company;
assert.equal(supportedCompany.status, "computed");
assert.equal(supportedCompany.optimal.selectedActionByState.decision, "continue");
assert.equal(supportedCompany.optimal.goalProbability, 0.4);
assert.equal(
  supportedCompany.optimal.expectedCumulativeFundingMillionJpy,
  10,
);
const supportedPublic = supportedResult.perspectives.public;
assert.equal(supportedPublic.status, "computed");
assert.equal(supportedPublic.optimal.selectedActionByState.decision, "continue");
assert.equal(supportedPublic.optimal.goalProbability, 0.4);

const supportedPublicControlled = structuredClone(supported);
supportedPublicControlled.modelId = "synthetic-supported-public-controller";
supportedPublicControlled.states[0].decisionController = {
  controllerId: "synthetic-public-funder",
  kind: "public",
  objective: "public",
  evidence: SYNTHETIC_EVIDENCE,
};
const supportedPublicChoice = getComputedPerspective(
  supportedPublicControlled,
  "public",
);
assert.equal(
  supportedPublicChoice.optimal.selectedActionByState.decision,
  "license",
);
assert.equal(supportedPublicChoice.optimal.goalProbability, 0);

function waitModel(waitCost: number): Bzm21DynamicPolicyModel {
  const makeContinuationState = (
    stateId: "good-signal" | "bad-signal",
    successProbability: number,
    continuationCost: number,
  ) =>
    state({
      stateId,
      decisionOrder: 1,
      elapsedMonths: 2,
      remainingCostMillionJpy: continuationCost,
      remainingTimeMonths: 10,
      currentState: { signal: stateId },
      availableInformation: ["signal observed after wait"],
      actions: [
        action({
          actionId: "continue-after-signal",
          kind: "continue",
          durationMonths: 10,
          immediateCostMillionJpy: amounts(continuationCost),
          requiredFundingMillionJpy: continuationCost,
          transitions: [
            transition({
              transitionId: `${stateId}-success`,
              probability: successProbability,
              terminalOutcome: "capital_independent",
              goalReachedAtMonths: 12,
              terminalValueMillionJpy: amounts(150),
            }),
            transition({
              transitionId: `${stateId}-failure`,
              probability: 1 - successProbability,
              terminalOutcome: "failed",
              slackLostAtMonths: 12,
              failureLossMillionJpy: amounts(10),
            }),
          ],
        }),
        action({
          actionId: "abandon-after-signal",
          kind: "abandon",
          transitions: [
            transition({
              transitionId: `${stateId}-abandon`,
              probability: 1,
              terminalOutcome: "abandoned",
              terminalValueMillionJpy: amounts(5),
            }),
          ],
        }),
      ],
    });

  const model: Bzm21DynamicPolicyModel = {
    schema: BZM21_DYNAMIC_POLICY_SCHEMA,
    modelId: `synthetic-wait-cost-${waitCost}`,
    modelVersion: "v0.1",
    dataMode: "synthetic",
    currency: "JPY",
    valuationDate: "2026-08-11",
    informationCutoff: INFORMATION_CUTOFF,
    forwardValidationCount: 0,
    initialStateId: "before-signal",
    ...commonDecisionRules(),
    discountRatePerMonth: amounts(0),
    baselinePolicyId: "continue-now-policy",
    baselinePolicy: {
      "before-signal": "continue-now",
      "good-signal": "continue-after-signal",
      "bad-signal": "abandon-after-signal",
    },
    policyDefinitionRef: "synthetic:continue-now-policy",
    cashFlowEvents: [],
    states: [
      state({
        stateId: "before-signal",
        decisionOrder: 0,
        remainingCostMillionJpy: 30,
        remainingTimeMonths: 12,
        currentState: { signal: "not_yet_observed" },
        actions: [
          action({
            actionId: "continue-now",
            kind: "continue",
            durationMonths: 12,
            immediateCostMillionJpy: amounts(30),
            requiredFundingMillionJpy: 30,
            transitions: [
              transition({
                transitionId: "now-success",
                probability: 0.3,
                terminalOutcome: "capital_independent",
                goalReachedAtMonths: 12,
                terminalValueMillionJpy: amounts(150),
              }),
              transition({
                transitionId: "now-failure",
                probability: 0.7,
                terminalOutcome: "failed",
                slackLostAtMonths: 12,
                failureLossMillionJpy: amounts(10),
              }),
            ],
          }),
          action({
            actionId: "wait-for-signal",
            kind: "wait",
            durationMonths: 2,
            immediateCostMillionJpy: amounts(waitCost),
            requiredFundingMillionJpy: waitCost,
            informationGain: ["observe development signal"],
            transitions: [
              transition({
                transitionId: "signal-good",
                probability: 0.5,
                nextStateId: "good-signal",
                terminalOutcome: null,
              }),
              transition({
                transitionId: "signal-bad",
                probability: 0.5,
                nextStateId: "bad-signal",
                terminalOutcome: null,
              }),
            ],
          }),
          action({
            actionId: "abandon-now",
            kind: "abandon",
            transitions: [
              transition({
                transitionId: "now-abandon",
                probability: 1,
                terminalOutcome: "abandoned",
                terminalValueMillionJpy: amounts(5),
              }),
            ],
          }),
        ],
      }),
      makeContinuationState("good-signal", 0.8, 20),
      makeContinuationState("bad-signal", 0.1, 40),
    ],
  };
  return rebuildCashFlowLedger(model);
}

// WAIT has value only when information value exceeds cash/time opportunity cost.
const cheapWaitCompany = getComputedPerspective(waitModel(3), "company");
assert.equal(
  cheapWaitCompany.optimal.selectedActionByState["before-signal"],
  "wait-for-signal",
);
assert.equal(cheapWaitCompany.optimal.goalProbability, 0.4);
assert.equal(cheapWaitCompany.baseline.goalProbability, 0.3);

const expensiveWaitCompany = getComputedPerspective(waitModel(50), "company");
assert.equal(
  expensiveWaitCompany.optimal.selectedActionByState["before-signal"],
  "continue-now",
);
assert.equal(expensiveWaitCompany.optimal.goalProbability, 0.3);

// q follows first passage to G, not the final label. A path that reaches G and
// is later licensed still counts as reached; the plan deadline and H_econ stay
// separate.
const reachedThenLicensed = structuredClone(base);
reachedThenLicensed.modelId = "synthetic-reached-then-licensed";
reachedThenLicensed.planDeadlineMonths = 4;
reachedThenLicensed.baselinePolicy.decision = "license";
const reachedLicenseAction = reachedThenLicensed.states[0].actions.find(
  (candidate) => candidate.actionId === "license",
)!;
reachedLicenseAction.durationMonths = 6;
reachedLicenseAction.transitions[0].goalReachedAtMonths = 6;
const reachedThenLicensedResult = evaluateBzm21DynamicPolicyModel(
  reachedThenLicensed,
);
assert.deepEqual(reachedThenLicensedResult.baselineReachability, {
  status: "computed",
  policyId: "fixed-current-plan",
  goalProbability: 1,
  planDeadlineGoalProbability: 0,
});

const goalAfterSlackLoss = structuredClone(base);
goalAfterSlackLoss.modelId = "synthetic-goal-after-slack-loss";
goalAfterSlackLoss.states[0].actions[0].transitions[0].slackLostAtMonths = 11;
const goalAfterSlackResult = evaluateBzm21DynamicPolicyModel(goalAfterSlackLoss);
assert.deepEqual(goalAfterSlackResult.baselineReachability, {
  status: "computed",
  policyId: "fixed-current-plan",
  goalProbability: 0,
  planDeadlineGoalProbability: 0,
});

// Sunk expenditure is shown as history but is not charged a second time in a
// forward decision. Changing it alone must not change value or policy.
const highSunkCost = structuredClone(base);
highSunkCost.modelId = "synthetic-high-sunk-cost";
highSunkCost.states[0].sunkCostMillionJpy = 9_999;
const highSunkCompany = getComputedPerspective(highSunkCost, "company");
assert.equal(
  highSunkCompany.optimal.expectedNetValueMillionJpy,
  companyBase.optimal.expectedNetValueMillionJpy,
);
assert.equal(
  highSunkCompany.optimal.selectedActionByState.decision,
  companyBase.optimal.selectedActionByState.decision,
);

// An unknown action cannot be silently dropped before claiming optimality. The
// fixed baseline q remains computable because that policy does not use it.
const unknownLicenseAvailability = structuredClone(base);
unknownLicenseAvailability.modelId = "synthetic-unknown-action";
unknownLicenseAvailability.states[0].actions.find(
  (candidate) => candidate.actionId === "license",
)!.availability = "unknown";
const unknownActionResult = evaluateBzm21DynamicPolicyModel(
  unknownLicenseAvailability,
);
assert.equal(unknownActionResult.baselineReachability.status, "computed");
assert.equal(unknownActionResult.perspectives.company.status, "not_computable");
assert.ok(
  unknownActionResult.issues.some(
    (candidate) => candidate.code === "uncertain_action_admissibility",
  ),
);

// A plan that relies on uncontracted financing is not an executable baseline.
const uncontractedBaseline = structuredClone(base);
uncontractedBaseline.modelId = "synthetic-uncontracted-baseline";
uncontractedBaseline.states[0].actions[0].financingFeasibility = {
  status: "uncontracted",
  committedFundingMillionJpy: 0,
  note: "synthetic financing has not been contracted",
  evidence: SYNTHETIC_EVIDENCE,
};
const uncontractedResult = evaluateBzm21DynamicPolicyModel(
  uncontractedBaseline,
);
assert.equal(uncontractedResult.baselineReachability.status, "not_computable");
assert.ok(
  uncontractedResult.issues.some(
    (candidate) => candidate.code === "baseline_policy_not_executable",
  ),
);

// Public optimization needs an ex-ante fiscal rule, legal/social mandate,
// conversion rule, and aggregation rule. Company/BZSF calculations survive if
// only this public scalarization contract is missing.
const missingPublicRule = structuredClone(base);
missingPublicRule.modelId = "synthetic-missing-public-rule";
missingPublicRule.publicValueRule = null;
const missingPublicResult = evaluateBzm21DynamicPolicyModel(missingPublicRule);
assert.equal(missingPublicResult.status, "partial");
assert.equal(missingPublicResult.perspectives.company.status, "computed");
assert.equal(missingPublicResult.perspectives.bzsf.status, "computed");
assert.equal(missingPublicResult.perspectives.public.status, "not_computable");

// An incomplete fixed policy makes baseline value and option gain unavailable.
const incompleteBaseline = waitModel(3);
incompleteBaseline.modelId = "synthetic-incomplete-baseline";
delete incompleteBaseline.baselinePolicy["good-signal"];
const incompleteBaselineResult = evaluateBzm21DynamicPolicyModel(
  incompleteBaseline,
);
assert.equal(
  incompleteBaselineResult.baselineReachability.status,
  "not_computable",
);
assert.equal(incompleteBaselineResult.perspectives.company.status, "not_computable");

// A pre-registered tie rule must actually resolve a near tie with different q.
// If equal-value/equal-funding actions remain, the decision is indeterminate.
const unresolvedTie = structuredClone(base);
unresolvedTie.modelId = "synthetic-unresolved-tie";
unresolvedTie.states[0].actions[0].transitions[0].terminalValueMillionJpy.company =
  160;
rebuildCashFlowLedger(unresolvedTie);
const tieLicense = unresolvedTie.states[0].actions.find(
  (candidate) => candidate.actionId === "license",
)!;
tieLicense.requiredFundingMillionJpy = 40;
tieLicense.financingFeasibility = {
  status: "secured",
  committedFundingMillionJpy: 40,
  note: "synthetic funding secured",
  evidence: SYNTHETIC_EVIDENCE,
};
unresolvedTie.tieBreakRule = {
  rule: "lower_required_funding",
  actionPriorityByState: {},
  evidence: SYNTHETIC_EVIDENCE,
};
const unresolvedTieResult = evaluateBzm21DynamicPolicyModel(unresolvedTie);
assert.equal(
  unresolvedTieResult.perspectives.company.status,
  "decision_indeterminate",
);

const uncertaintySwitches = structuredClone(base);
uncertaintySwitches.modelId = "synthetic-uncertainty-switches";
assert.ok(uncertaintySwitches.uncertaintyRule);
uncertaintySwitches.uncertaintyRule.status = "decision_switches";
const uncertaintySwitchResult = evaluateBzm21DynamicPolicyModel(
  uncertaintySwitches,
);
assert.equal(
  uncertaintySwitchResult.perspectives.company.status,
  "decision_indeterminate",
);

// Primitive action kinds are components of a feasible bundle. Financing and
// negotiation can be explicit custom components and intermediate states.
const bundled = structuredClone(base);
bundled.modelId = "synthetic-bundled-action";
const bundledContinue = bundled.states[0].actions[0];
bundledContinue.bundleId = "continue-with-financing";
bundledContinue.componentKinds = ["continue"];
bundledContinue.customComponents = ["seek_financing", "negotiate_terms"];
bundledContinue.sequence = [
  "seek_financing",
  "negotiate_terms",
  "continue",
];
assert.equal(evaluateBzm21DynamicPolicyModel(bundled).status, "computed");

const invalidBelief = structuredClone(base);
invalidBelief.modelId = "synthetic-invalid-belief";
invalidBelief.states[0].beliefs = [
  {
    beliefId: "latent-demand",
    label: "潜在需要",
    possibleValues: [
      { value: "high", probability: 0.7 },
      { value: "low", probability: 0.4 },
    ],
    evidence: SYNTHETIC_EVIDENCE,
  },
];
assert.ok(
  validateBzm21DynamicPolicyModel(invalidBelief).some(
    (candidate) => candidate.code === "belief_probabilities_not_closed",
  ),
);

// Every required action kind is executable, while a real PJ may omit kinds that
// do not exist. This fixture deliberately exposes all eight in one state.
const allKinds = baseModel();
allKinds.modelId = "synthetic-all-action-kinds";
allKinds.states[0].actions = BZM21_ACTION_KINDS.map((kind, index) => {
  const terminal = (suffix: string, probability: number) =>
    transition({
      transitionId: `${kind}-${suffix}`,
      probability,
      terminalOutcome:
        kind === "continue"
          ? "capital_independent"
          : kind === "wait" && suffix === "signal-a"
            ? "licensed"
            : "abandoned",
      goalReachedAtMonths: kind === "continue" ? 0 : null,
      terminalValueMillionJpy: amounts(index),
    });
  return action({
    actionId: `${index}-${kind}`,
    kind,
    durationMonths: kind === "wait" ? 1 : 0,
    immediateCostMillionJpy: amounts(kind === "wait" ? 1 : 0),
    informationGain: kind === "wait" ? ["synthetic wait signal"] : [],
    transitions:
      kind === "wait"
        ? [terminal("signal-a", 0.5), terminal("signal-b", 0.5)]
        : [terminal("terminal", 1)],
  });
});
allKinds.baselinePolicy.decision = "0-continue";
rebuildCashFlowLedger(allKinds);
const allKindsCompany = getComputedPerspective(allKinds, "company");
assert.equal(allKindsCompany.optimal.stateDecisions[0].actions.length, 8);

// Missing evidence remains missing. It does not silently become zero and it
// blocks only the affected objective when reachability inputs are still known.
const missingBzsfCost = structuredClone(base);
missingBzsfCost.modelId = "synthetic-missing-bzsf-cost";
missingBzsfCost.states[0].actions[0].immediateCostMillionJpy.bzsf = null;
rebuildCashFlowLedger(missingBzsfCost);
const missingBzsfResult = evaluateBzm21DynamicPolicyModel(missingBzsfCost);
assert.equal(missingBzsfResult.status, "partial");
assert.equal(missingBzsfResult.baselineReachability.status, "computed");
assert.equal(missingBzsfResult.perspectives.company.status, "computed");
assert.equal(missingBzsfResult.perspectives.bzsf.status, "not_computable");
assert.ok(
  missingBzsfResult.issues.some(
    (candidate) =>
      candidate.code === "missing_objective_value" &&
      candidate.perspective === "bzsf",
  ),
);

// A missing transition probability blocks reachability itself.
const missingProbability = structuredClone(base);
missingProbability.modelId = "synthetic-missing-probability";
missingProbability.states[0].actions[0].transitions[0].probability = null;
const missingProbabilityResult = evaluateBzm21DynamicPolicyModel(
  missingProbability,
);
assert.equal(missingProbabilityResult.status, "not_computable");
assert.equal(
  missingProbabilityResult.baselineReachability.status,
  "not_computable",
);

// T1: array order is not a model input. Reordering actions and branches leaves
// the fixed and selected policy outputs unchanged.
const reordered = structuredClone(base);
reordered.modelId = "synthetic-reordered-arrays";
reordered.states[0].actions.reverse();
for (const candidateAction of reordered.states[0].actions) {
  candidateAction.transitions.reverse();
}
const reorderedCompany = getComputedPerspective(reordered, "company");
assert.equal(
  reorderedCompany.optimal.selectedActionByState.decision,
  companyBase.optimal.selectedActionByState.decision,
);
assert.equal(
  reorderedCompany.optimal.expectedNetValueMillionJpy,
  companyBase.optimal.expectedNetValueMillionJpy,
);
assert.equal(
  reorderedCompany.baseline.expectedNetValueMillionJpy,
  companyBase.baseline.expectedNetValueMillionJpy,
);
assert.equal(
  reorderedCompany.baseline.goalProbability,
  companyBase.baseline.goalProbability,
);

// T5: adding a costless optional action while retaining every old action cannot
// reduce the controller's maximized value.
const expandedActionSet = structuredClone(base);
expandedActionSet.modelId = "synthetic-costless-option-expansion";
expandedActionSet.states[0].actions.push(
  action({
    actionId: "costless-unused-option",
    kind: "pivot",
    transitions: [
      transition({
        transitionId: "costless-unused-option-close",
        probability: 1,
        terminalOutcome: "abandoned",
      }),
    ],
  }),
);
rebuildCashFlowLedger(expandedActionSet);
const expandedCompany = getComputedPerspective(expandedActionSet, "company");
assert.ok(
  expandedCompany.optimal.expectedNetValueMillionJpy >=
    companyBase.optimal.expectedNetValueMillionJpy,
);
assert.equal(
  expandedCompany.optimal.selectedActionByState.decision,
  companyBase.optimal.selectedActionByState.decision,
);

// T3: a complete frozen policy reproduces the frozen BZM 2.0 plan-q interface.
// 0.0415 is only the already-frozen SX output; no missing SX input is invented.
const frozenSxBaseline = structuredClone(base);
frozenSxBaseline.modelId = "synthetic-frozen-sx-q-plan-interface";
frozenSxBaseline.states[0].actions[0].transitions[0].probability = 0.0415;
frozenSxBaseline.states[0].actions[0].transitions[1].probability = 0.9585;
const frozenSxResult = evaluateBzm21DynamicPolicyModel(frozenSxBaseline);
assert.equal(frozenSxResult.baselineReachability.status, "computed");
if (frozenSxResult.baselineReachability.status === "computed") {
  assert.ok(
    Math.abs(
      frozenSxResult.baselineReachability.planDeadlineGoalProbability -
        0.0415,
    ) < 1e-12,
  );
}

// T9: a deterministic zero-time node split is economically invariant. The
// initial state also represents T_C=T_Y=+infinity and must recurse, not stop.
const splitEquivalent = baseModel();
splitEquivalent.modelId = "synthetic-node-split-equivalent";
splitEquivalent.states = [
  state({
    stateId: "split-start",
    decisionOrder: 0,
    actions: [
      action({
        actionId: "pay-and-proceed",
        kind: "continue",
        immediateCostMillionJpy: amounts(20, 15, 5),
        requiredFundingMillionJpy: 40,
        transitions: [
          transition({
            transitionId: "deterministic-split",
            probability: 1,
            nextStateId: "split-finish",
            terminalOutcome: null,
          }),
        ],
      }),
    ],
  }),
  state({
    stateId: "split-finish",
    decisionOrder: 1,
    elapsedMonths: 0,
    actions: [
      action({
        actionId: "resolve",
        kind: "continue",
        durationMonths: 12,
        immediateCostMillionJpy: amounts(20, 15, 5),
        transitions: [
          transition({
            transitionId: "split-success",
            probability: 0.4,
            terminalOutcome: "capital_independent",
            goalReachedAtMonths: 12,
            terminalValueMillionJpy: amounts(100, 45, 200),
          }),
          transition({
            transitionId: "split-failure",
            probability: 0.6,
            terminalOutcome: "failed",
            slackLostAtMonths: 12,
            failureLossMillionJpy: amounts(10, 30, 20),
          }),
        ],
      }),
    ],
  }),
];
splitEquivalent.initialStateId = "split-start";
splitEquivalent.baselinePolicyId = "split-fixed-policy";
splitEquivalent.baselinePolicy = {
  "split-start": "pay-and-proceed",
  "split-finish": "resolve",
};
splitEquivalent.policyDefinitionRef = "synthetic:split-fixed-policy";
rebuildCashFlowLedger(splitEquivalent);
const splitCompany = getComputedPerspective(splitEquivalent, "company");
assert.equal(splitCompany.baseline.expectedNetValueMillionJpy, -6);
assert.equal(splitCompany.baseline.goalProbability, 0.4);
assert.equal(splitCompany.baseline.conditionalGoalValueMillionJpy, 60);
assert.equal(
  splitCompany.baseline.expectedNetValueMillionJpy,
  companyBase.baseline.expectedNetValueMillionJpy,
);
assert.equal(
  splitCompany.baseline.goalProbability,
  companyBase.baseline.goalProbability,
);

// T14: continue/abandon reduction agrees with the hand calculation:
// continue = -40 + 0.4*100 - 0.6*10 = -6; abandon = 8.
const hsuReduction = baseModel();
hsuReduction.modelId = "synthetic-hsu-continue-abandon-reduction";
hsuReduction.states[0].actions = hsuReduction.states[0].actions.filter(
  (candidate) => ["continue", "abandon"].includes(candidate.actionId),
);
rebuildCashFlowLedger(hsuReduction);
const hsuCompany = getComputedPerspective(hsuReduction, "company");
assert.equal(hsuCompany.optimal.selectedActionByState.decision, "abandon");
const hsuActions = hsuCompany.optimal.stateDecisions[0].actions;
assert.equal(
  hsuActions.find((candidate) => candidate.actionId === "continue")
    ?.expectedNetValueMillionJpy,
  -6,
);
assert.equal(
  hsuActions.find((candidate) => candidate.actionId === "abandon")
    ?.expectedNetValueMillionJpy,
  8,
);

// First-passage history is part of the state. Reaching G before the current
// decision survives a later licence/M&A exit; prior slack loss stops q.
const alreadyReached = baseModel();
alreadyReached.modelId = "synthetic-goal-already-reached";
alreadyReached.planDeadlineMonths = 4;
alreadyReached.states[0].elapsedMonths = 6;
alreadyReached.states[0].actions = alreadyReached.states[0].actions.filter(
  (candidate) => candidate.actionId === "license",
);
alreadyReached.states[0].reachabilityHistory.goal = {
  status: "reached",
  firstReachedAtMonths: 6,
  evidence: SYNTHETIC_EVIDENCE,
};
alreadyReached.baselinePolicy = { decision: "license" };
rebuildCashFlowLedger(alreadyReached);
const alreadyReachedResult = evaluateBzm21DynamicPolicyModel(alreadyReached);
assert.deepEqual(alreadyReachedResult.baselineReachability, {
  status: "computed",
  policyId: "fixed-current-plan",
  goalProbability: 1,
  planDeadlineGoalProbability: 0,
});

const alreadyLostSlack = baseModel();
alreadyLostSlack.modelId = "synthetic-slack-already-lost";
alreadyLostSlack.states[0].elapsedMonths = 3;
alreadyLostSlack.states[0].actions = alreadyLostSlack.states[0].actions.filter(
  (candidate) => candidate.actionId === "abandon",
);
alreadyLostSlack.states[0].reachabilityHistory.strategicSlack = {
  status: "lost",
  firstLostAtMonths: 3,
  evidence: SYNTHETIC_EVIDENCE,
};
alreadyLostSlack.baselinePolicy = { decision: "abandon" };
rebuildCashFlowLedger(alreadyLostSlack);
const alreadyLostResult = evaluateBzm21DynamicPolicyModel(alreadyLostSlack);
assert.equal(alreadyLostResult.baselineReachability.status, "computed");
if (alreadyLostResult.baselineReachability.status === "computed") {
  assert.equal(alreadyLostResult.baselineReachability.goalProbability, 0);
}

const equalGoalAndSlack = structuredClone(alreadyReached);
equalGoalAndSlack.modelId = "synthetic-equal-goal-and-slack";
equalGoalAndSlack.planDeadlineMonths = 12;
equalGoalAndSlack.states[0].elapsedMonths = 2;
equalGoalAndSlack.states[0].reachabilityHistory.goal.firstReachedAtMonths = 2;
equalGoalAndSlack.states[0].reachabilityHistory.strategicSlack = {
  status: "lost",
  firstLostAtMonths: 2,
  evidence: SYNTHETIC_EVIDENCE,
};
const equalHistoryResult = evaluateBzm21DynamicPolicyModel(equalGoalAndSlack);
assert.equal(equalHistoryResult.baselineReachability.status, "computed");
if (equalHistoryResult.baselineReachability.status === "computed") {
  assert.equal(equalHistoryResult.baselineReachability.goalProbability, 0);
}

// Missing funding blocks the fixed plan's reachability, not only its value.
const missingBaselineFunding = structuredClone(base);
missingBaselineFunding.modelId = "synthetic-missing-baseline-funding";
missingBaselineFunding.states[0].actions[0].requiredFundingMillionJpy = null;
const missingFundingResult = evaluateBzm21DynamicPolicyModel(
  missingBaselineFunding,
);
assert.equal(missingFundingResult.baselineReachability.status, "not_computable");
assert.ok(
  missingFundingResult.issues.some(
    (candidate) => candidate.code === "baseline_policy_not_executable",
  ),
);

// A higher-q tie rule that leaves two same-q near-ties cannot fall through to
// action ID order and select the lower-value action.
const sameQTie = structuredClone(base);
sameQTie.modelId = "synthetic-same-q-unresolved-tie";
sameQTie.decisionCriterionByObjective.company.nearTieToleranceMillionJpy = 1;
sameQTie.states[0].actions
  .find((candidate) => candidate.actionId === "license")!
  .transitions[0].terminalValueMillionJpy.company = 20.5;
sameQTie.states[0].actions
  .find((candidate) => candidate.actionId === "abandon")!
  .transitions[0].terminalValueMillionJpy.company = 18;
rebuildCashFlowLedger(sameQTie);
assert.equal(
  evaluateBzm21DynamicPolicyModel(sameQTie).perspectives.company.status,
  "decision_indeterminate",
);

// A strict best fixed-policy action keeps controller option value nonnegative.
// Expanding tolerance must not let a slightly lower-value, higher-q action
// replace it; that near tie is reported as indeterminate instead.
const strictBaselineBest = structuredClone(base);
strictBaselineBest.modelId = "synthetic-strict-baseline-best";
strictBaselineBest.baselinePolicy.decision = "license";
strictBaselineBest.states[0].actions[0].transitions[0]
  .terminalValueMillionJpy.company = 158.75;
rebuildCashFlowLedger(strictBaselineBest);
const strictBaselineCompany = getComputedPerspective(
  strictBaselineBest,
  "company",
);
assert.equal(
  strictBaselineCompany.optimal.selectedActionByState.decision,
  "license",
);
assert.equal(strictBaselineCompany.controllerOptionValueMillionJpy, 0);

const nonEqualHigherQNearTie = structuredClone(strictBaselineBest);
nonEqualHigherQNearTie.modelId = "synthetic-non-equal-higher-q-near-tie";
nonEqualHigherQNearTie.decisionCriterionByObjective.company.nearTieToleranceMillionJpy =
  1;
assert.equal(
  evaluateBzm21DynamicPolicyModel(nonEqualHigherQNearTie).perspectives.company
    .status,
  "decision_indeterminate",
);

const invalidBundle = structuredClone(base);
invalidBundle.modelId = "synthetic-invalid-bundle-sequence";
invalidBundle.states[0].actions[1].sequence = ["license", "ghost-step"];
assert.ok(
  validateBzm21DynamicPolicyModel(invalidBundle).some(
    (candidate) => candidate.code === "invalid_action_bundle",
  ),
);

const incompleteWait = waitModel(0);
incompleteWait.modelId = "synthetic-incomplete-wait";
incompleteWait.states[0].actions.find(
  (candidate) => candidate.actionId === "wait-for-signal",
)!.informationGain = [];
assert.ok(
  validateBzm21DynamicPolicyModel(incompleteWait).some(
    (candidate) => candidate.code === "incomplete_wait_contract",
  ),
);

// The same ledger event cannot be charged as both immediate and transition CF.
const duplicateCashFlowRef = structuredClone(base);
duplicateCashFlowRef.modelId = "synthetic-duplicate-cashflow-ref";
duplicateCashFlowRef.states[0].actions[0].transitions[1].cashFlowEventIds.push(
  duplicateCashFlowRef.states[0].actions[0].cashFlowEventIds[0],
);
assert.ok(
  validateBzm21DynamicPolicyModel(duplicateCashFlowRef).some(
    (candidate) => candidate.code === "cashflow_event_reference_count",
  ),
);

// Every zero is explicit evidence. Removing a category event cannot fall back
// to the reducer's numeric identity of zero.
const missingExplicitActionZero = structuredClone(base);
missingExplicitActionZero.modelId = "synthetic-missing-explicit-action-zero";
const missingActionEventId =
  "decision:continue:action:immediate_benefit";
missingExplicitActionZero.states[0].actions[0].cashFlowEventIds =
  missingExplicitActionZero.states[0].actions[0].cashFlowEventIds.filter(
    (eventId) => eventId !== missingActionEventId,
  );
missingExplicitActionZero.cashFlowEvents =
  missingExplicitActionZero.cashFlowEvents.filter(
    (event) => event.eventId !== missingActionEventId,
  );
assert.ok(
  validateBzm21DynamicPolicyModel(missingExplicitActionZero).some(
    (candidate) => candidate.code === "missing_explicit_cashflow_category",
  ),
);

const missingExplicitTerminalZero = structuredClone(base);
missingExplicitTerminalZero.modelId =
  "synthetic-missing-explicit-terminal-zero";
const missingTerminalEventId =
  "decision:license:license-close:failure_loss";
const licenseClose = missingExplicitTerminalZero.states[0].actions.find(
  (candidate) => candidate.actionId === "license",
)!.transitions[0];
licenseClose.cashFlowEventIds = licenseClose.cashFlowEventIds.filter(
  (eventId) => eventId !== missingTerminalEventId,
);
missingExplicitTerminalZero.cashFlowEvents =
  missingExplicitTerminalZero.cashFlowEvents.filter(
    (event) => event.eventId !== missingTerminalEventId,
  );
assert.ok(
  validateBzm21DynamicPolicyModel(missingExplicitTerminalZero).some(
    (candidate) => candidate.code === "missing_explicit_cashflow_category",
  ),
);

// Aggregate monetary fields are caches, never an independent second source.
const mismatchedCashFlowCache = structuredClone(base);
mismatchedCashFlowCache.modelId = "synthetic-cashflow-cache-mismatch";
mismatchedCashFlowCache.states[0].actions[0].immediateCostMillionJpy.company =
  41;
assert.ok(
  validateBzm21DynamicPolicyModel(mismatchedCashFlowCache).some(
    (candidate) => candidate.code === "cashflow_cache_mismatch",
  ),
);

const unsupportedPricingMeasure = structuredClone(base);
unsupportedPricingMeasure.modelId = "synthetic-unsupported-pricing-measure";
(
  unsupportedPricingMeasure.valuationRuleByObjective.company as {
    probabilityMeasure: string;
  }
).probabilityMeasure = "risk_neutral";
assert.equal(
  evaluateBzm21DynamicPolicyModel(unsupportedPricingMeasure).perspectives
    .company.status,
  "not_computable",
);

const missingCounterparty = structuredClone(base);
missingCounterparty.modelId = "synthetic-missing-counterparty";
missingCounterparty.cashFlowEvents[0].counterparty = "";
assert.ok(
  validateBzm21DynamicPolicyModel(missingCounterparty).some(
    (candidate) => candidate.code === "invalid_cashflow_event",
  ),
);

const looseTimestamp = structuredClone(base);
looseTimestamp.modelId = "synthetic-loose-timestamp";
looseTimestamp.informationCutoff = "2026-08-11";
assert.ok(
  validateBzm21DynamicPolicyModel(looseTimestamp).some(
    (candidate) => candidate.code === "invalid_information_cutoff",
  ),
);

// Finite but unsafe magnitudes stop as validation issues instead of overflowing
// Bellman arithmetic and throwing an uncaught runtime exception.
const unsafeMagnitude = structuredClone(base);
unsafeMagnitude.modelId = "synthetic-unsafe-magnitude";
unsafeMagnitude.states[0].actions[0].immediateBenefitMillionJpy.company = 1e308;
rebuildCashFlowLedger(unsafeMagnitude);
assert.equal(
  evaluateBzm21DynamicPolicyModel(unsafeMagnitude).status,
  "not_computable",
);

const duplicateInterventionIds = structuredClone(base);
duplicateInterventionIds.modelId = "synthetic-duplicate-intervention-ids";
duplicateInterventionIds.interventions = [
  {
    interventionId: "duplicate-support",
    label: "synthetic support A",
    enabled: false,
    effects: [],
    evidence: SYNTHETIC_EVIDENCE,
  },
  {
    interventionId: "duplicate-support",
    label: "synthetic support B",
    enabled: false,
    effects: [],
    evidence: SYNTHETIC_EVIDENCE,
  },
];
assert.ok(
  validateBzm21DynamicPolicyModel(duplicateInterventionIds).some(
    (candidate) =>
      candidate.code === "duplicate_or_missing_intervention_id",
  ),
);

const duplicateTransitionDeltas = structuredClone(base);
duplicateTransitionDeltas.modelId = "synthetic-duplicate-transition-deltas";
duplicateTransitionDeltas.interventions = [
  {
    interventionId: "probability-support-a",
    label: "synthetic probability support A",
    enabled: true,
    evidence: SYNTHETIC_EVIDENCE,
    effects: [
      {
        stateId: "decision",
        actionId: "continue",
        transitions: [
          { transitionId: "continue-success", probabilityDelta: 0.01 },
          { transitionId: "continue-failure", probabilityDelta: -0.01 },
        ],
      },
    ],
  },
  {
    interventionId: "probability-support-b",
    label: "synthetic probability support B",
    enabled: true,
    evidence: SYNTHETIC_EVIDENCE,
    effects: [
      {
        stateId: "decision",
        actionId: "continue",
        transitions: [
          { transitionId: "continue-success", probabilityDelta: -0.01 },
          { transitionId: "continue-failure", probabilityDelta: 0.01 },
        ],
      },
    ],
  },
];
assert.ok(
  validateBzm21DynamicPolicyModel(duplicateTransitionDeltas).some(
    (candidate) => candidate.code === "duplicate_enabled_transition_delta",
  ),
);

// WAIT is checked again after enabled intervention deltas. Removing its only
// controller-side waiting cost invalidates the effective action.
const interventionBreaksWait = waitModel(3);
interventionBreaksWait.modelId = "synthetic-intervention-breaks-wait";
interventionBreaksWait.interventions = [
  {
    interventionId: "remove-wait-cost",
    label: "synthetic removal of wait cost",
    enabled: true,
    evidence: SYNTHETIC_EVIDENCE,
    effects: [
      {
        stateId: "before-signal",
        actionId: "wait-for-signal",
        cashFlowEventDeltas: [
          {
            eventId:
              "before-signal:wait-for-signal:action:immediate_cost",
            amountDeltaMillionJpy: { company: -3 },
          },
        ],
      },
    ],
  },
];
assert.ok(
  validateBzm21DynamicPolicyModel(interventionBreaksWait).some(
    (candidate) => candidate.code === "invalid_effective_wait_contract",
  ),
);

// Floating closure inside EPSILON cannot leak q above one.
const floatingProbabilityClosure = structuredClone(base);
floatingProbabilityClosure.modelId = "synthetic-floating-probability-clamp";
floatingProbabilityClosure.states[0].actions = [
  floatingProbabilityClosure.states[0].actions[0],
];
floatingProbabilityClosure.states[0].actions[0].transitions[0].probability =
  0.6;
floatingProbabilityClosure.states[0].actions[0].transitions[1].probability =
  0.4000000005;
floatingProbabilityClosure.states[0].actions[0].transitions[1].terminalOutcome =
  "capital_independent";
floatingProbabilityClosure.states[0].actions[0].transitions[1].goalReachedAtMonths =
  12;
floatingProbabilityClosure.states[0].actions[0].transitions[1].slackLostAtMonths =
  null;
floatingProbabilityClosure.states[0].actions[0].transitions[1]
  .failureLossMillionJpy = amounts(0);
rebuildCashFlowLedger(floatingProbabilityClosure);
const floatingProbabilityResult = evaluateBzm21DynamicPolicyModel(
  floatingProbabilityClosure,
);
assert.equal(floatingProbabilityResult.baselineReachability.status, "computed");
if (floatingProbabilityResult.baselineReachability.status === "computed") {
  assert.equal(floatingProbabilityResult.baselineReachability.goalProbability, 1);
  assert.equal(
    floatingProbabilityResult.baselineReachability
      .planDeadlineGoalProbability,
    1,
  );
}

assert.ok(
  companyBase.controllerOptionValueMillionJpy !== null &&
    companyBase.controllerOptionValueMillionJpy >= 0,
);

// The decision-order invariant rejects cycles and infinite retry loops. Retry
// must be represented as a new, later decision state in this finite-horizon v0.1.
const invalidCycle = waitModel(3);
invalidCycle.modelId = "synthetic-invalid-cycle";
invalidCycle.states.find((candidate) => candidate.stateId === "good-signal")!
  .decisionOrder = 0;
assert.ok(
  validateBzm21DynamicPolicyModel(invalidCycle).some(
    (candidate) => candidate.code === "non_forward_transition",
  ),
);

console.log(
  "BZM 2.1 dynamic policy tests passed: fixed baseline, three objectives, endogenous q, value/cost/salvage/support/WAIT sensitivity, missingness, finite horizon",
);
