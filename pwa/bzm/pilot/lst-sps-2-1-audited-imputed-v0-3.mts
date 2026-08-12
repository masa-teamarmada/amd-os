import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(DIR, "lst-sps-2-1-audited-imputed-v0-3.json");
const V02_MTS = path.join(DIR, "lst-sps-2-1-os-imputed-v0-2.mts");
const V02_JSON = path.join(DIR, "lst-sps-2-1-os-imputed-v0-2.json");
const CHECK_ONLY = process.argv.includes("--check");
const VALUATION_DATE = "2026-08-12";
const INFORMATION_CUTOFF = "2026-08-12T23:59:59+09:00";
const MONTHS = 56;

type ScenarioId = "low" | "central" | "high";
type MonthlyRow = {
  monthIndex: number;
  month: string;
  economicCashFlow: number;
  financingInflows: number;
  debtPrincipal: number;
  interestExpense: number;
  netCashFlow: number;
  endingCash: number;
  legacyPayableSettlement?: number;
  financingDetail: {
    knownJkiss: number;
    imputedBridge: number;
    imputedLargeRound: number;
  };
  [key: string]: unknown;
};
type GateTrace = {
  monthIndex: number;
  key: string;
  probability: number;
  survivalBefore: number;
  survivalAfter: number;
};
type ActionResult = {
  action: string;
  currentAvailability: string;
  selected: boolean;
  goalProbability: number;
  expectedNetValueMillionJpy: number;
  expectedPathCashFlowPresentMillionJpy: number;
  expectedSuccessValuePresentMillionJpy: number;
  expectedFailureExitPresentMillionJpy: number;
  expectedExitValueMillionJpy: number;
  gateTrace: GateTrace[] | null;
  monthlyCashFlow: MonthlyRow[];
  [key: string]: unknown;
};
type V02Scenario = {
  scenarioId: ScenarioId;
  label: string;
  inputs: {
    annualDiscountRate: number;
    minimumCash: number;
    [key: string]: unknown;
  };
  actions: ActionResult[];
  [key: string]: unknown;
};
type V02Artifact = {
  schema: string;
  valuationDate: string;
  informationCutoff: string;
  calculationHash: string;
  scenarios: V02Scenario[];
  [key: string]: unknown;
};
type ScenarioAssumption = {
  id: ScenarioId;
  auditedCashAt20260331: number;
  postBalanceSheetOperatingSpend: number;
  postBalanceSheetCapex: number;
  accountsPayableSettlement: number;
  postBalanceSheetJkissCash: number;
  postBalanceSheetJfcCash: number;
  postBalanceSheetNewGrantCash: number;
  grantAdvanceRecognitionNonCash: number;
  restrictedCashAt20260331: number;
  minimumCash: number;
  requiredBridgeBeforeValuation: number;
  openingUnrestrictedCashAtValuation: number;
  grantAdvanceLiabilityAtValuation: number;
  grantAdvanceRecognitionMonths: number;
  grantRefundFractionOnExit: number;
  noncurrentAssetRecoveryFraction: number;
  closureCost: number;
};

const round = (value: number, digits = 6) => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};
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
const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

const REPORT = {
  title: "別紙1.事業報告・計算書類等.pdf",
  company: "LiSTie株式会社",
  fiscalPeriod: { from: "2025-04-01", to: "2026-03-31" },
  auditReportDate: "2026-05-28",
  firstAvailableOnDriveAt: "2026-06-16T04:55:26.604Z",
  retrievedAt: "2026-08-12T06:22:27Z",
  physicalCopyCount: 3,
  logicalDocumentCount: 1,
  uniqueBinaryHashCount: 1,
  binarySha256:
    "f1a32af990a8b03e717334acc39a532c3f574b77ed5305a70fb76f2310ff3c0e",
  sizeBytes: 357_246,
  pageCount: null,
  pageCountStatus: "unknown_not_used_in_calculation",
  sourceLocatorStatus:
    "page numbers were unavailable through the connector; exact account labels and document-level binary hash are retained",
  physicalCopies: [
    {
      sourceRef: "drive:file:1JiZiAJZZbgyh_v7tQXMxwoDw958y1L2S",
      availableAt: "2026-06-16T04:57:13.863Z",
      parentLabel: "260624_第3回定時株主総会",
    },
    {
      sourceRef: "drive:file:1FrcSAzaSNY_52BtRSm_8DDiMOsz89sKU",
      availableAt: "2026-06-16T04:55:37.440Z",
      parentLabel: "260710_第3回定時株主総会",
    },
    {
      sourceRef: "drive:file:1LRrtVP0vJD6crOE0obEC1Rn32pPFiVF7",
      availableAt: "2026-06-16T04:55:26.604Z",
      parentLabel: "260616_取締役会書面決議",
    },
  ],
  deduplicationRule:
    "three physical copies have the same byte size and SHA-256, so they count as one logical observation and never triple the evidence weight",
} as const;

const AUDITED = {
  unit: "million_JPY",
  balanceSheetAt: "2026-03-31",
  cashAndDeposits: 46.08,
  currentAssets: 83.021,
  totalAssets: 375.475,
  noncurrentAssets: 292.454,
  shortTermBorrowing: 83,
  accountsPayable: 15.851,
  currentGrantAdvanceLiability: 8.001,
  longTermDepositsReceivedLiability: 563.677,
  totalGrantAdvanceLiability: 571.678,
  totalLiabilities: 671.11,
  netAssets: -295.634,
  annualSales: 0.45,
  operatingLoss: 348.873,
  recurringLoss: 350.846,
  netLoss: 351.426,
  sellingGeneralAndAdministrativeExpense: 349.323,
  researchAndDevelopmentExpenseIncludedInSga: 302.089,
  capex: 121.912,
  accumulatedDepreciation: 45.422,
  jkissRaisedDuringFiscalYear: 110,
  employees: 15,
  grantCeilings: { sbir: 1_500, nedo: 300, sushiTech: 200 },
  derivedMonthly: {
    operatingExpense: round(349.323 / 12),
    researchAndDevelopment: round(302.089 / 12),
    nonResearchOperatingExpense: round((349.323 - 302.089) / 12),
    capex: round(121.912 / 12),
    operatingAndCapexNetOfSales: round((349.323 - 0.45 + 121.912) / 12),
  },
  accountingBoundaries: [
    "research and development expense is included in SG&A and is never added a second time",
    "long-term deposits received is a liability, not cash, revenue, salvage value or company value",
    "J-KISS 110 and short-term borrowing 83 are fiscal-year facts and are not added again after the balance-sheet date without transaction-level proof",
    "grant ceilings are not grant cash receipts and are not added directly to q or value",
  ],
  observationClasses: {
    auditedFinancialStatement: [
      "cashAndDeposits",
      "currentAssets",
      "totalAssets",
      "noncurrentAssets",
      "shortTermBorrowing",
      "accountsPayable",
      "currentGrantAdvanceLiability",
      "longTermDepositsReceivedLiability",
      "totalLiabilities",
      "netAssets",
      "annualSales",
      "operatingLoss",
      "recurringLoss",
      "netLoss",
      "sellingGeneralAndAdministrativeExpense",
      "researchAndDevelopmentExpenseIncludedInSga",
    ],
    auditedDocumentObservation: [
      "capex",
      "accumulatedDepreciation",
      "jkissRaisedDuringFiscalYear",
      "employees",
      "grantCeilings",
    ],
  },
} as const;

const ASSUMPTIONS: Record<ScenarioId, ScenarioAssumption> = {
  low: {
    id: "low",
    auditedCashAt20260331: 46.08,
    postBalanceSheetOperatingSpend: 153.7,
    postBalanceSheetCapex: 55.88,
    accountsPayableSettlement: 15.851,
    postBalanceSheetJkissCash: 0,
    postBalanceSheetJfcCash: 0,
    postBalanceSheetNewGrantCash: 0,
    grantAdvanceRecognitionNonCash: 80,
    restrictedCashAt20260331: 40,
    minimumCash: 30,
    requiredBridgeBeforeValuation: 209.351,
    openingUnrestrictedCashAtValuation: 30,
    grantAdvanceLiabilityAtValuation: 491.678,
    grantAdvanceRecognitionMonths: 36,
    grantRefundFractionOnExit: 1,
    noncurrentAssetRecoveryFraction: 0.05,
    closureCost: 90,
  },
  central: {
    id: "central",
    auditedCashAt20260331: 46.08,
    postBalanceSheetOperatingSpend: 128.09,
    postBalanceSheetCapex: 33.53,
    accountsPayableSettlement: 12,
    postBalanceSheetJkissCash: 20,
    postBalanceSheetJfcCash: 0,
    postBalanceSheetNewGrantCash: 0,
    grantAdvanceRecognitionNonCash: 140,
    restrictedCashAt20260331: 20,
    minimumCash: 30,
    requiredBridgeBeforeValuation: 137.54,
    openingUnrestrictedCashAtValuation: 30,
    grantAdvanceLiabilityAtValuation: 431.678,
    grantAdvanceRecognitionMonths: 24,
    grantRefundFractionOnExit: 0.5,
    noncurrentAssetRecoveryFraction: 0.25,
    closureCost: 45,
  },
  high: {
    id: "high",
    auditedCashAt20260331: 46.08,
    postBalanceSheetOperatingSpend: 108.87,
    postBalanceSheetCapex: 15.65,
    accountsPayableSettlement: 8,
    postBalanceSheetJkissCash: 40,
    postBalanceSheetJfcCash: 0,
    postBalanceSheetNewGrantCash: 0,
    grantAdvanceRecognitionNonCash: 220,
    restrictedCashAt20260331: 5,
    minimumCash: 30,
    requiredBridgeBeforeValuation: 76.44,
    openingUnrestrictedCashAtValuation: 30,
    grantAdvanceLiabilityAtValuation: 351.678,
    grantAdvanceRecognitionMonths: 12,
    grantRefundFractionOnExit: 0.1,
    noncurrentAssetRecoveryFraction: 0.5,
    closureCost: 20,
  },
};

function preBridgeCash(assumption: ScenarioAssumption): number {
  return round(
    assumption.auditedCashAt20260331 +
      assumption.postBalanceSheetJkissCash +
      assumption.postBalanceSheetJfcCash +
      assumption.postBalanceSheetNewGrantCash -
      assumption.postBalanceSheetOperatingSpend -
      assumption.postBalanceSheetCapex -
      assumption.accountsPayableSettlement,
  );
}

function restrictedCashRollForward(assumption: ScenarioAssumption) {
  const imputedEligibleResearchSpend =
    assumption.postBalanceSheetOperatingSpend *
    (AUDITED.researchAndDevelopmentExpenseIncludedInSga /
      AUDITED.sellingGeneralAndAdministrativeExpense);
  const restrictedCashUsedForEligibleSpend = Math.min(
    assumption.restrictedCashAt20260331 +
      assumption.postBalanceSheetNewGrantCash,
    imputedEligibleResearchSpend,
  );
  return {
    restrictedCashAt20260331: assumption.restrictedCashAt20260331,
    postBalanceSheetNewGrantCash: assumption.postBalanceSheetNewGrantCash,
    imputedEligibleResearchSpend: round(imputedEligibleResearchSpend),
    restrictedCashUsedForEligibleSpend: round(
      restrictedCashUsedForEligibleSpend,
    ),
    restrictedCashAtValuation: round(
      Math.max(
        0,
        assumption.restrictedCashAt20260331 +
          assumption.postBalanceSheetNewGrantCash -
          restrictedCashUsedForEligibleSpend,
      ),
    ),
  };
}

function remainingGrantAdvanceLiability(
  assumption: ScenarioAssumption,
  monthIndex: number,
): number {
  return round(
    assumption.grantAdvanceLiabilityAtValuation *
      Math.max(
        0,
        1 - Math.max(0, monthIndex + 1) / assumption.grantAdvanceRecognitionMonths,
      ),
  );
}

function exitSettlementAt(assumption: ScenarioAssumption, monthIndex: number) {
  const remainingAdvance =
    monthIndex < 0
      ? assumption.grantAdvanceLiabilityAtValuation
      : remainingGrantAdvanceLiability(assumption, monthIndex);
  const assetRecovery =
    AUDITED.noncurrentAssets * assumption.noncurrentAssetRecoveryFraction;
  const estimatedGrantRefund =
    remainingAdvance * assumption.grantRefundFractionOnExit;
  return {
    monthIndex,
    auditedNoncurrentAssetBookValue: AUDITED.noncurrentAssets,
    assetRecoveryFraction: assumption.noncurrentAssetRecoveryFraction,
    estimatedAssetRecovery: round(assetRecovery),
    closureCost: assumption.closureCost,
    remainingGrantAdvanceLiability: round(remainingAdvance),
    grantRefundFraction: assumption.grantRefundFractionOnExit,
    estimatedGrantRefund: round(estimatedGrantRefund),
    netExitSettlement: round(
      assetRecovery - assumption.closureCost - estimatedGrantRefund,
    ),
  };
}

function rebuildLiquidity(rows: MonthlyRow[], assumption: ScenarioAssumption) {
  assert.equal(rows.length, MONTHS);
  const remainingAccountsPayable = round(
    Math.max(0, AUDITED.accountsPayable - assumption.accountsPayableSettlement),
  );
  const baseNetCashFlows = rows.map(
    (row, index) =>
      row.economicCashFlow -
      row.interestExpense -
      row.debtPrincipal -
      (index === 0 ? remainingAccountsPayable : 0),
  );
  let cashWithoutFunding = assumption.openingUnrestrictedCashAtValuation;
  let minimumWithoutFunding = cashWithoutFunding;
  let firstNegativeMonth: string | null = null;
  let firstMinimumBufferBreachMonth: string | null = null;
  for (let index = 0; index < MONTHS; index += 1) {
    cashWithoutFunding += baseNetCashFlows[index];
    minimumWithoutFunding = Math.min(minimumWithoutFunding, cashWithoutFunding);
    if (cashWithoutFunding < 0 && firstNegativeMonth === null) {
      firstNegativeMonth = rows[index].month;
    }
    if (
      cashWithoutFunding < assumption.minimumCash &&
      firstMinimumBufferBreachMonth === null
    ) {
      firstMinimumBufferBreachMonth = rows[index].month;
    }
  }

  let cashToLargeRound = assumption.openingUnrestrictedCashAtValuation;
  let minimumBeforeLargeRound = cashToLargeRound;
  for (let index = 0; index < 8; index += 1) {
    cashToLargeRound += baseNetCashFlows[index];
    minimumBeforeLargeRound = Math.min(minimumBeforeLargeRound, cashToLargeRound);
  }
  const bridgeFunding = round(
    Math.max(0, assumption.minimumCash - minimumBeforeLargeRound),
  );
  let cashAfterBridge = assumption.openingUnrestrictedCashAtValuation;
  let minimumAfterLargeRound = Number.POSITIVE_INFINITY;
  for (let index = 0; index < MONTHS; index += 1) {
    cashAfterBridge += baseNetCashFlows[index] + (index === 0 ? bridgeFunding : 0);
    if (index >= 8) {
      minimumAfterLargeRound = Math.min(minimumAfterLargeRound, cashAfterBridge);
    }
  }
  const largeRoundFunding = round(
    Math.max(0, assumption.minimumCash - minimumAfterLargeRound),
  );

  let cash = assumption.openingUnrestrictedCashAtValuation;
  const rebuiltRows = rows.map((row, index) => {
    const financingInflows =
      (index === 0 ? bridgeFunding : 0) +
      (index === 8 ? largeRoundFunding : 0);
    const netCashFlow = baseNetCashFlows[index] + financingInflows;
    cash += netCashFlow;
    const grantAdvanceLiabilityOpening =
      index === 0
        ? assumption.grantAdvanceLiabilityAtValuation
        : remainingGrantAdvanceLiability(assumption, index - 1);
    const grantAdvanceLiabilityClosing = remainingGrantAdvanceLiability(
      assumption,
      index,
    );
    return {
      ...row,
      financingInflows: round(financingInflows),
      financingDetail: {
        knownJkiss: 0,
        imputedBridge: index === 0 ? bridgeFunding : 0,
        imputedLargeRound: index === 8 ? largeRoundFunding : 0,
      },
      netCashFlow: round(netCashFlow),
      endingCash: round(cash),
      legacyPayableSettlement: index === 0 ? remainingAccountsPayable : 0,
      grantAdvanceLiabilityOpening: round(grantAdvanceLiabilityOpening),
      imputedGrantAdvanceRecognitionNonCash: round(
        grantAdvanceLiabilityOpening - grantAdvanceLiabilityClosing,
      ),
      grantAdvanceLiabilityClosing: round(grantAdvanceLiabilityClosing),
      grantAdvanceRecognitionCashTreatment:
        "noncash memo only; unmapped v0.2 future grant receipts are excluded from economic cash flow and liquidity",
    };
  });
  return {
    rows: rebuiltRows,
    firstNegativeMonthWithoutNewFunding: firstNegativeMonth,
    firstMinimumBufferBreachMonthWithoutNewFunding:
      firstMinimumBufferBreachMonth,
    minimumCashWithoutNewFunding: round(minimumWithoutFunding),
    bridgeFundingRequired: bridgeFunding,
    largeRoundFundingRequired: largeRoundFunding,
    totalAdditionalFundingRequired: round(bridgeFunding + largeRoundFunding),
  };
}

function rebuildAbandonLiquidity(
  rows: MonthlyRow[],
  assumption: ScenarioAssumption,
  immediateExitValue: number,
) {
  let cash = assumption.openingUnrestrictedCashAtValuation;
  const remainingAccountsPayable = round(
    Math.max(0, AUDITED.accountsPayable - assumption.accountsPayableSettlement),
  );
  return rows.map((row, index) => {
    const economicCashFlow = index === 0 ? immediateExitValue : 0;
    const legacyPayableSettlement = index === 0 ? remainingAccountsPayable : 0;
    cash += economicCashFlow - legacyPayableSettlement;
    return {
      ...row,
      economicCashFlow: round(economicCashFlow),
      financingInflows: 0,
      financingDetail: {
        knownJkiss: 0,
        imputedBridge: 0,
        imputedLargeRound: 0,
      },
      debtPrincipal: 0,
      interestExpense: 0,
      netCashFlow: round(economicCashFlow - legacyPayableSettlement),
      endingCash: round(cash),
      legacyPayableSettlement,
      grantAdvanceLiabilityOpening:
        index === 0 ? assumption.grantAdvanceLiabilityAtValuation : 0,
      estimatedGrantRefundOnImmediateExit:
        index === 0
          ? round(
              assumption.grantAdvanceLiabilityAtValuation *
                assumption.grantRefundFractionOnExit,
            )
          : 0,
      grantAdvanceLiabilityClosing: 0,
    };
  });
}

function expectedFailureExitPresent(
  action: ActionResult,
  assumption: ScenarioAssumption,
  annualDiscountRate: number,
) {
  if (!Array.isArray(action.gateTrace) || action.gateTrace.length === 0) {
    return {
      value: action.expectedFailureExitPresentMillionJpy,
      events: [],
      status: "not_recalculated_no_gate_trace",
    };
  }
  const monthlyRate = (1 + annualDiscountRate) ** (1 / 12) - 1;
  const events = action.gateTrace.map((gate) => {
    const failureProbability = gate.survivalBefore * (1 - gate.probability);
    const settlement = exitSettlementAt(assumption, gate.monthIndex);
    const presentContribution =
      (failureProbability * settlement.netExitSettlement) /
      (1 + monthlyRate) ** (gate.monthIndex + 1);
    return {
      gate: gate.key,
      failureProbability: round(failureProbability),
      ...settlement,
      presentContribution: round(presentContribution),
    };
  });
  return {
    value: round(
      events.reduce((sum, event) => sum + event.presentContribution, 0),
    ),
    events,
    status: "recalculated_from_first_failure_gate",
  };
}

function removeUnmappedFutureGrantCash(rows: MonthlyRow[]): MonthlyRow[] {
  return rows.map((row) => {
    const legacyGrantReceipts =
      typeof row.grantReceipts === "number" ? row.grantReceipts : 0;
    return {
      ...row,
      grantReceipts: 0,
      excludedLegacyGrantReceipts: round(legacyGrantReceipts),
      grantReceiptMappingStatus:
        "excluded_as_potentially_overlapping_with_balance-sheet grant advances; no incremental program-level cash is assumed in v0.3",
      economicCashFlow: round(row.economicCashFlow - legacyGrantReceipts),
    };
  });
}

function expectedPathCashFlowPresent(
  rows: MonthlyRow[],
  gateTrace: GateTrace[] | null,
  annualDiscountRate: number,
): number {
  if (!Array.isArray(gateTrace)) {
    return round(
      rows.reduce(
        (sum, row) =>
          sum +
          row.economicCashFlow /
            (1 + annualDiscountRate) ** ((row.monthIndex + 1) / 12),
        0,
      ),
    );
  }
  const monthlyRate = (1 + annualDiscountRate) ** (1 / 12) - 1;
  let survival = 1;
  let present = 0;
  for (const row of rows) {
    for (const gate of gateTrace.filter(
      (candidate) => candidate.monthIndex === row.monthIndex,
    )) {
      survival *= gate.probability;
    }
    present +=
      (survival * row.economicCashFlow) /
      (1 + monthlyRate) ** (row.monthIndex + 1);
  }
  return round(present);
}

async function main() {
  const [v02Source, v02ScriptSource] = await Promise.all([
    readFile(V02_JSON, "utf8"),
    readFile(V02_MTS),
  ]);
  const v02 = JSON.parse(v02Source) as V02Artifact;
  const v02DiskHashes = {
    scriptSha256: sha256(v02ScriptSource),
    artifactSha256: sha256(v02Source),
    calculationHash: v02.calculationHash,
  };
  assert.deepEqual(v02DiskHashes, {
    scriptSha256:
      "bfaac130b5a39f5de4df9e9c2f995f95da52e855fdae4c64a662bf53938f326a",
    artifactSha256:
      "b5e179cf72f486c7101ef4e54be5f39b9270ba9360faab15586993348a972a1d",
    calculationHash:
      "d66a061f2228c5d14cddf0e9149c890c940ffab7a8db41c01e1a81f58945e062",
  });
  assert.equal(v02.scenarios.length, 3);
  for (const assumption of Object.values(ASSUMPTIONS)) {
    assert.ok(
      Math.abs(
        preBridgeCash(assumption) + assumption.requiredBridgeBeforeValuation -
          assumption.openingUnrestrictedCashAtValuation,
      ) < 0.001,
    );
    assert.ok(assumption.restrictedCashAt20260331 <= AUDITED.cashAndDeposits);
    assert.equal(
      round(
        AUDITED.totalGrantAdvanceLiability -
          assumption.grantAdvanceRecognitionNonCash,
      ),
      assumption.grantAdvanceLiabilityAtValuation,
    );
    assert.equal(restrictedCashRollForward(assumption).restrictedCashAtValuation, 0);
  }

  const scenarios = v02.scenarios.map((v02Scenario) => {
    const assumption = ASSUMPTIONS[v02Scenario.scenarioId];
    const immediateSettlement = exitSettlementAt(assumption, -1);
    const actions = v02Scenario.actions.map((action) => {
      const cashFlowWithoutUnmappedGrant = removeUnmappedFutureGrantCash(
        action.monthlyCashFlow,
      );
      if (action.action === "abandon") {
        const monthlyCashFlow = rebuildAbandonLiquidity(
          cashFlowWithoutUnmappedGrant,
          assumption,
          immediateSettlement.netExitSettlement,
        );
        return {
          ...action,
          selected: false,
          goalProbability: 0,
          expectedNetValueMillionJpy: immediateSettlement.netExitSettlement,
          rawPathCalculationExpectedNetValueMillionJpy:
            immediateSettlement.netExitSettlement,
          expectedPathCashFlowPresentMillionJpy:
            immediateSettlement.netExitSettlement,
          expectedSuccessValuePresentMillionJpy: 0,
          expectedFailureExitPresentMillionJpy: 0,
          expectedExitValueMillionJpy: immediateSettlement.netExitSettlement,
          auditedExitSettlement: immediateSettlement,
          monthlyCashFlow,
          firstCashCliffWithoutImputedFunding:
            monthlyCashFlow[0].endingCash < 0 ? monthlyCashFlow[0].month : null,
          firstMinimumBufferBreachMonthWithoutImputedFunding:
            monthlyCashFlow[0].endingCash < assumption.minimumCash
              ? monthlyCashFlow[0].month
              : null,
          bridgeFundingRequiredMillionJpy: 0,
          largeRoundRequiredMillionJpy: 0,
          totalAdditionalFundingRequiredMillionJpy: 0,
          closureLiquidityShortfallMillionJpy: round(
            Math.max(0, -monthlyCashFlow[0].endingCash),
          ),
        };
      }
      const failureExit = expectedFailureExitPresent(
        action,
        assumption,
        v02Scenario.inputs.annualDiscountRate,
      );
      const pathCashFlowPresent = expectedPathCashFlowPresent(
        cashFlowWithoutUnmappedGrant,
        action.gateTrace,
        v02Scenario.inputs.annualDiscountRate,
      );
      const expectedNetValue = round(
        pathCashFlowPresent +
          action.expectedSuccessValuePresentMillionJpy +
          failureExit.value,
      );
      const liquidity = rebuildLiquidity(cashFlowWithoutUnmappedGrant, assumption);
      return {
        ...action,
        selected: false,
        expectedNetValueMillionJpy: expectedNetValue,
        rawPathCalculationExpectedNetValueMillionJpy: expectedNetValue,
        expectedPathCashFlowPresentMillionJpy: pathCashFlowPresent,
        expectedFailureExitPresentMillionJpy: failureExit.value,
        expectedExitValueMillionJpy: failureExit.value,
        expectedExitValueDefinition:
          "discounted first-failure exit contribution after audited asset-book-value recovery and imputed grant-advance refund",
        auditedFailureExitEvents: failureExit.events,
        auditedFailureExitStatus: failureExit.status,
        monthlyCashFlow: liquidity.rows,
        firstCashCliffWithoutImputedFunding:
          liquidity.firstNegativeMonthWithoutNewFunding,
        firstMinimumBufferBreachMonthWithoutImputedFunding:
          liquidity.firstMinimumBufferBreachMonthWithoutNewFunding,
        minimumCashWithoutImputedFundingMillionJpy:
          liquidity.minimumCashWithoutNewFunding,
        bridgeFundingRequiredMillionJpy: liquidity.bridgeFundingRequired,
        largeRoundRequiredMillionJpy: liquidity.largeRoundFundingRequired,
        totalAdditionalFundingRequiredMillionJpy:
          liquidity.totalAdditionalFundingRequired,
      };
    });
    const availableActions = actions.filter(
      (action) => action.currentAvailability === "available",
    );
    assert.deepEqual(
      availableActions.map((action) => action.action).sort(),
      ["abandon", "continue"],
    );
    const selected = [...availableActions].sort(
      (left, right) =>
        right.expectedNetValueMillionJpy - left.expectedNetValueMillionJpy ||
        left.action.localeCompare(right.action),
    )[0];
    selected.selected = true;
    const continuation = actions.find((action) => action.action === "continue")!;
    const abandon = actions.find((action) => action.action === "abandon")!;
    return {
      scenarioId: v02Scenario.scenarioId,
      label: v02Scenario.label,
      auditedRollForward: {
        balanceSheetCashAt20260331: assumption.auditedCashAt20260331,
        postBalanceSheetOperatingSpend: assumption.postBalanceSheetOperatingSpend,
        postBalanceSheetCapex: assumption.postBalanceSheetCapex,
        accountsPayableSettlement: assumption.accountsPayableSettlement,
        remainingAccountsPayableAtValuation: round(
          AUDITED.accountsPayable - assumption.accountsPayableSettlement,
        ),
        postBalanceSheetJkissCash: assumption.postBalanceSheetJkissCash,
        postBalanceSheetJfcCash: assumption.postBalanceSheetJfcCash,
        postBalanceSheetNewGrantCash: assumption.postBalanceSheetNewGrantCash,
        grantAdvanceRecognitionNonCash:
          assumption.grantAdvanceRecognitionNonCash,
        restrictedCash: restrictedCashRollForward(assumption),
        preBridgeCashAtValuation: preBridgeCash(assumption),
        requiredBridgeBeforeValuation:
          assumption.requiredBridgeBeforeValuation,
        openingUnrestrictedCashAtValuation:
          assumption.openingUnrestrictedCashAtValuation,
        grantAdvanceLiabilityAtValuation:
          assumption.grantAdvanceLiabilityAtValuation,
        shortTermBorrowingTreatment:
          "assumed to overlap with the existing v0.2 JFC debt schedule; no second cash receipt or principal leg is added",
        rollForwardStatus: "fully_imputed_from_audited_2026_03_31_anchor",
      },
      exitAssumptions: {
        grantAdvanceRecognitionMonths:
          assumption.grantAdvanceRecognitionMonths,
        grantRefundFractionOnExit: assumption.grantRefundFractionOnExit,
        noncurrentAssetRecoveryFraction:
          assumption.noncurrentAssetRecoveryFraction,
        closureCost: assumption.closureCost,
      },
      inputs: {
        ...v02Scenario.inputs,
        openingCash: assumption.openingUnrestrictedCashAtValuation,
        minimumCash: assumption.minimumCash,
      },
      selectedAction: selected.action,
      sps21MillionJpy: selected.expectedNetValueMillionJpy,
      q: selected.goalProbability,
      selectedActionFundingRequiredMillionJpy:
        selected.totalAdditionalFundingRequiredMillionJpy,
      continueCounterfactualGoalProbability: continuation.goalProbability,
      continueCounterfactualValueMillionJpy:
        continuation.expectedNetValueMillionJpy,
      continueCounterfactualFundingRequiredMillionJpy:
        continuation.totalAdditionalFundingRequiredMillionJpy,
      abandonValueMillionJpy: abandon.expectedNetValueMillionJpy,
      actionValueGapMillionJpy: round(
        Math.abs(
          continuation.expectedNetValueMillionJpy -
            abandon.expectedNetValueMillionJpy,
        ),
      ),
      actions,
    };
  });

  for (const scenario of scenarios) {
    assert.equal(scenario.actions.length, 8);
    assert.equal(scenario.actions.filter((action) => action.selected).length, 1);
    for (const action of scenario.actions) {
      assert.equal(action.monthlyCashFlow.length, MONTHS);
      let priorCash = scenario.auditedRollForward.openingUnrestrictedCashAtValuation;
      for (const row of action.monthlyCashFlow) {
        assert.ok(
          Math.abs(
            row.netCashFlow -
              (row.economicCashFlow +
                row.financingInflows -
                row.interestExpense -
                row.debtPrincipal -
                (row.legacyPayableSettlement ?? 0)),
          ) < 0.00001,
        );
        assert.ok(
          Math.abs(row.endingCash - (priorCash + row.netCashFlow)) < 0.00002,
        );
        priorCash = row.endingCash;
      }
      if (action.action !== "abandon") {
        assert.ok(
          Math.abs(
            action.expectedNetValueMillionJpy -
              (action.expectedPathCashFlowPresentMillionJpy +
                action.expectedSuccessValuePresentMillionJpy +
                action.expectedFailureExitPresentMillionJpy),
          ) < 0.00001,
        );
      }
    }
  }

  const central = scenarios.find((scenario) => scenario.scenarioId === "central")!;
  const decisionStatus =
    new Set(scenarios.map((scenario) => scenario.selectedAction)).size > 1 ||
    central.actionValueGapMillionJpy < 100
      ? "decision_indeterminate_across_imputation_scenarios"
      : "forced_point_estimate_stable_within_registered_scenarios";

  const outputWithoutHash = {
    schema: "bzm-2.1-lst-audited-os-imputed-v0.3",
    modelStatus: "hypothesis_fully_imputed_not_calibrated",
    projectName: "LST",
    valuationDate: VALUATION_DATE,
    informationCutoff: INFORMATION_CUTOFF,
    currencyUnit: "million_JPY",
    valueDefinition:
      "company-held project expected future net value under the selected currently available action; financing receipts are excluded from economic value",
    warning:
      "The FY2026 accounts are audited observations. The 2026-04-01 to 2026-08-12 roll-forward, grant settlement, monthly future plan, transition probabilities, DCF and exit recovery remain explicit low-confidence imputations. This is a forced diagnostic value, not an investment recommendation.",
    forwardValidationCount: 0,
    priorVersionSnapshot: {
      schema: v02.schema,
      valuationDate: v02.valuationDate,
      informationCutoff: v02.informationCutoff,
      ...v02DiskHashes,
      status: "preserved_unchanged_not_overwritten",
    },
    auditedSource: REPORT,
    auditedObservations: AUDITED,
    excludedFalsePositiveSources: [
      {
        title: "試算表.xlsx",
        physicalCopyCount: 2,
        status: "excluded_wrong_entity",
        reason:
          "LiSTie appears only as a counterparty in another entity's trial balance; filename-only search is insufficient",
      },
    ],
    decisionReadout: {
      status: decisionStatus,
      forcedCentralSelectedAction: central.selectedAction,
      forcedCentralSps21MillionJpy: central.sps21MillionJpy,
      forcedCentralQ: central.q,
      centralContinueCounterfactualValueMillionJpy:
        central.continueCounterfactualValueMillionJpy,
      centralContinueCounterfactualQ:
        central.continueCounterfactualGoalProbability,
      centralAbandonValueMillionJpy: central.abandonValueMillionJpy,
      centralActionValueGapMillionJpy: central.actionValueGapMillionJpy,
      explanation:
        "A point estimate is emitted because the user explicitly requested full imputation. Different registered scenarios choose different actions or the central action gap is smaller than the imputation error, so the point argmax is not an operational recommendation.",
    },
    calculationRules: {
      auditedAnchor:
        "the FY2026 report replaces cash, historical expense, R&D, capex, balance-sheet debt and grant-advance liability proxies",
      rollForward:
        "2026-03-31 cash is rolled to 2026-08-12 with explicit operating spend, capex, payables, post-balance-sheet financing and grant-release assumptions; balance-sheet J-KISS and debt are not re-added",
      grantAdvance:
        "current and long-term grant advances remain liabilities; recognition is noncash, unmapped v0.2 future grant receipts are excluded, and the unrecognized portion can create an exit refund",
      liquidity:
        "bridge funding at month 0 and a large round at month 8 keep month-end cash above the scenario minimum; all financing is excluded from economic value",
      value:
        "v0.2 future gross operating/DCF/q paths are held fixed to isolate the audited-account revision; all unmapped future grant receipts are removed and first-failure exit contributions are recalculated from audited noncurrent assets and grant-refund assumptions",
      actionSelection:
        "only continue and abandon are currently available; six other action types remain future-conditional or unavailable",
    },
    parameterProvenance: [
      {
        parameters: [
          "cashAndDeposits",
          "currentAssets",
          "noncurrentAssets",
          "shortTermBorrowing",
          "accountsPayable",
          "longTermDepositsReceivedLiability",
          "sales",
          "operatingExpense",
          "R&D",
        ],
        status: "audited_observed",
        source: REPORT.title,
      },
      {
        parameters: [
          "capex",
          "accumulated depreciation",
          "J-KISS raised during FY2026",
          "employees",
          "grant ceilings",
        ],
        status: "audited_document_observed",
        source:
          "business report and notes in the same hashed audited document package; not all are face financial-statement accounts",
      },
      {
        parameters: [
          "2026-04-01..2026-08-12 operating spend",
          "capex",
          "payable settlement",
          "new J-KISS",
          "new grant cash",
          "noncash grant advance recognition",
          "restricted cash",
          "opening unrestricted cash",
        ],
        status: "estimated_from_audited_anchor",
        source:
          "FY2026 accounts plus OS financing and runway records; exact bank/freee roll-forward is not yet available",
      },
      {
        parameters: [
          "grant advance recognition months",
          "grant refund fraction",
          "asset recovery fraction",
          "closure cost",
        ],
        status: "estimated",
        source:
          "scenario assumptions pending program-level grant settlement and asset-register evidence",
      },
      {
        parameters: [
          "future revenue",
          "future cost",
          "future capex",
          "grant receipts",
          "transition probabilities",
          "discount rate",
          "terminal value",
        ],
        status: "carried_forward_imputed_v0.2",
        source:
          "v0.2 OS-only monthly model, intentionally held constant to isolate the audited-account effect",
      },
    ],
    highestUncertaintyDrivers: [
      "program-level outstanding grant advance, eligible-cost recognition, cash availability and refund/clawback terms",
      "transaction-level bank/freee roll-forward from 2026-03-31 through 2026-08-12, including J-KISS and JFC deduplication",
      "future revenue ramp, margin, discount rate and terminal continuing value",
      "large-round amount, latest receipt month and execution probability",
      "Kawasaki and second-unit company-borne capex, payment dates and subsidy coverage",
      "asset-specific recovery value and contract/grant close-out cost",
    ],
    scenarios,
  };
  const output = {
    ...outputWithoutHash,
    calculationHash: sha256(stableJson(outputWithoutHash)),
  };
  const serializedOutput = `${JSON.stringify(output, null, 2)}\n`;
  if (CHECK_ONLY) {
    assert.equal(await readFile(OUTPUT, "utf8"), serializedOutput);
  } else {
    await writeFile(OUTPUT, serializedOutput, "utf8");
  }
  console.log(
    JSON.stringify(
      {
        mode: CHECK_ONLY ? "check" : "write",
        output: OUTPUT,
        results: scenarios.map((scenario) => ({
          scenario: scenario.scenarioId,
          selectedAction: scenario.selectedAction,
          q: scenario.q,
          sps21MillionJpy: scenario.sps21MillionJpy,
          continueQ: scenario.continueCounterfactualGoalProbability,
          continueValueMillionJpy:
            scenario.continueCounterfactualValueMillionJpy,
          abandonValueMillionJpy: scenario.abandonValueMillionJpy,
          continueFundingRequiredMillionJpy:
            scenario.continueCounterfactualFundingRequiredMillionJpy,
        })),
        decisionStatus,
        calculationHash: output.calculationHash,
      },
      null,
      2,
    ),
  );
}

await main();
