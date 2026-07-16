import assert from "node:assert/strict";
import {
  buildCapTableSnapshots,
  capTableOriginWarning,
  capTableTieOut,
  computeNextRoundScenario,
  convertibleScenario,
  minimumPreMoneyForTarget,
  nextRoundSensitivity,
  type CompanyOverviewData,
  type ConvertibleInstrument,
} from "../src/lib/company-overview.ts";

const entry = (id: string, holderName: string, outstanding: number, diluted: number, holderType = "founder") => ({
  id, holder_type: holderType, holder_name: holderName, security_class: diluted > outstanding ? "新株予約権" : "普通株式",
  outstanding_delta: outstanding, diluted_delta: diluted, paid_in_yen_delta: 0,
});

const baseProfile = {
  id: "profile", project_id: "p-test", legal_status: "incorporated", legal_name: "テスト株式会社", legal_name_en: null,
  corporate_number: null, entity_type: "株式会社", incorporated_on: "2026-01-01", head_office: null, business_purpose: null,
  representative_name: null, capital_yen: 5_000_000, authorized_shares: 10_000, registered_issued_shares: 1_200,
  board_structure: null, has_board: false, has_auditor: false, fiscal_year_end_month: 12, public_notice_method: null,
  invoice_registration_number: null, source_ref: null, source_verified_on: null, notes: null,
};

// --- 1) 既存 fixture: confirmed/planned の切り分け、legacy 集計 ---

const data: CompanyOverviewData = {
  profile: { ...baseProfile },
  shareholders: [],
  rounds: [], meetings: [], actionItems: [], financialPeriods: [],
  transactions: [
    { id: "t1", project_id: "p-test", round_id: null, effective_on: "2026-01-01", transaction_type: "incorporation", description: "設立", status: "confirmed", source_ref: null, notes: null, project_equity_entries: [entry("e1", "創業者A", 1_000, 1_000)] },
    { id: "t2", project_id: "p-test", round_id: null, effective_on: "2026-02-01", transaction_type: "new_issue", description: "Seed増資", status: "confirmed", source_ref: null, notes: null, project_equity_entries: [entry("e2", "投資家B", 200, 200, "vc")] },
    { id: "t3", project_id: "p-test", round_id: null, effective_on: "2026-03-01", transaction_type: "transfer", description: "株式譲渡", status: "confirmed", source_ref: null, notes: null, project_equity_entries: [entry("e3a", "創業者A", -100, -100), entry("e3b", "AMD", 100, 100, "amd")] },
    { id: "t4", project_id: "p-test", round_id: null, effective_on: "2026-04-01", transaction_type: "stock_option_grant", description: "SO付与", status: "confirmed", source_ref: null, notes: null, project_equity_entries: [entry("e4", "SOプール", 0, 120, "employee")] },
    { id: "t5", project_id: "p-test", round_id: null, effective_on: "2026-05-01", transaction_type: "new_issue", description: "未確定増資", status: "planned", source_ref: null, notes: null, project_equity_entries: [entry("e5", "未確定投資家", 500, 500, "vc")] },
  ],
  convertibles: [{ id: "j1", holder_name: "J-KISS投資家", instrument_type: "J-KISS", issued_on: "2026-05-01", principal_yen: 10_000_000, valuation_cap_yen: 500_000_000, discount_rate: 0.2, conversion_trigger: null, maturity_on: null, estimated_conversion_price: 50_000, estimated_conversion_shares: 200, status: "outstanding", notes: null }],
};

const snapshots = buildCapTableSnapshots(data);
assert.equal(snapshots.length, 4, "planned event must not enter the legal cap table");
const latest = snapshots.at(-1)!;
assert.equal(latest.outstandingShares, 1_200);
assert.equal(latest.dilutedShares, 1_320);
assert.equal(latest.rows.find((row) => row.holderName === "創業者A")?.outstandingShares, 900);
assert.equal(latest.rows.find((row) => row.holderName === "AMD")?.outstandingShares, 100);
assert.equal(latest.rows.find((row) => row.holderName === "SOプール")?.outstandingShares, 0);
assert.equal(Number(latest.rows.find((row) => row.holderName === "SOプール")?.dilutedPct.toFixed(4)), 9.0909);
assert.equal(capTableOriginWarning(data, snapshots), false, "founding-first history should not warn");

const scenario = convertibleScenario(data);
assert.equal(scenario.estimatedShares, 200);
assert.equal(scenario.proFormaDilutedShares, 1_520);
assert.equal(capTableTieOut(data).state, "matched");

// --- 2)/3)/4)/5)/6) LST fixture: 30k 設立 / 15k Seed / 2.5k QST(SO) ---

const lstConvertibles: ConvertibleInstrument[] = [
  { id: "c1", holder_name: "コンバーチブル投資家", instrument_type: "J-KISS", issued_on: "2026-06-01", principal_yen: 20_000_000, valuation_cap_yen: 400_000_000, discount_rate: 0.2, conversion_trigger: null, maturity_on: null, estimated_conversion_price: 20_000, estimated_conversion_shares: 1_000, status: "outstanding", notes: null },
];

function makeLstData(convertibles: ConvertibleInstrument[]): CompanyOverviewData {
  return {
    profile: { ...baseProfile },
    shareholders: [],
    rounds: [], meetings: [], actionItems: [], financialPeriods: [],
    transactions: [
      { id: "l1", project_id: "p-test", round_id: null, effective_on: "2026-01-01", transaction_type: "incorporation", description: "設立", status: "confirmed", source_ref: null, notes: null, project_equity_entries: [entry("le1", "星野", 30_000, 30_000, "founder")] },
      { id: "l2", project_id: "p-test", round_id: null, effective_on: "2026-02-01", transaction_type: "new_issue", description: "Seed", status: "confirmed", source_ref: null, notes: null, project_equity_entries: [entry("le2", "Seed投資家", 15_000, 15_000, "vc")] },
      { id: "l3", project_id: "p-test", round_id: null, effective_on: "2026-03-01", transaction_type: "stock_option_grant", description: "QST", status: "confirmed", source_ref: null, notes: null, project_equity_entries: [entry("le3", "SOプール", 0, 2_500, "employee")] },
    ],
    convertibles,
  };
}

const lstData = makeLstData([]);
const lstSnapshots = buildCapTableSnapshots(lstData);
assert.equal(lstSnapshots.length, 3, "LST fixture should produce 30k/15k/2.5k snapshots");
assert.equal(lstSnapshots[0].dilutedDelta, 30_000);
assert.equal(lstSnapshots[1].dilutedDelta, 15_000);
assert.equal(lstSnapshots[2].dilutedDelta, 2_500);
const lstLatest = lstSnapshots.at(-1)!;
assert.equal(lstLatest.dilutedShares, 47_500);
assert.equal(
  Number(lstLatest.rows.find((row) => row.holderName === "星野")?.dilutedPct.toFixed(4)),
  63.1579,
);
assert.equal(capTableOriginWarning(lstData, lstSnapshots), false, "incorporation-first LST history should not warn");

// --- 3) opening_balance 起点は必ず警告する ---

const openingBalanceData: CompanyOverviewData = {
  profile: { ...baseProfile },
  shareholders: [],
  rounds: [], meetings: [], actionItems: [], financialPeriods: [],
  transactions: [
    { id: "o1", project_id: "p-test", round_id: null, effective_on: "2026-01-01", transaction_type: "opening_balance", description: "開始残高", status: "confirmed", source_ref: null, notes: null, project_equity_entries: [entry("oe1", "創業者A", 1_000, 1_000)] },
  ],
  convertibles: [],
};
const openingBalanceSnapshots = buildCapTableSnapshots(openingBalanceData);
assert.equal(capTableOriginWarning(openingBalanceData, openingBalanceSnapshots), true, "opening_balance origin must warn");

const legacyCurrentData: CompanyOverviewData = {
  profile: { ...baseProfile },
  shareholders: [{ id: "s1", holder_type: "founder", holder_name: "創業者A", share_class: "普通株式", shares: 1_000, ownership_pct: 100, invested_yen: 0, as_of_ym: "2026-01", is_current: true }],
  rounds: [], meetings: [], actionItems: [], financialPeriods: [],
  transactions: [],
  convertibles: [],
};
const legacyCurrentSnapshots = buildCapTableSnapshots(legacyCurrentData);
assert.equal(legacyCurrentSnapshots.length, 1);
assert.equal(legacyCurrentSnapshots[0].id, "legacy-current");
assert.equal(capTableOriginWarning(legacyCurrentData, legacyCurrentSnapshots), true, "legacy-current origin must warn");

// --- 4) 次回ラウンド試算: 星野 post = 50%、minimum pre もおよそ同じ額 ---

const roundInputBase = {
  preMoneyYen: 570_000_000,
  raiseYen: 150_000_000,
  targetPoolRate: 0,
  includeConvertibles: false,
  protectHolderName: "星野",
};
const roundResult = computeNextRoundScenario(lstLatest, [], roundInputBase);
assert.equal(roundResult.valid, true);
if (roundResult.valid) {
  const hoshinoRow = roundResult.rows.find((row) => row.holderName === "星野");
  assert.ok(hoshinoRow, "星野 row must exist");
  assert.ok(Math.abs((hoshinoRow!.afterPct) - 50) < 0.01, `expected ~50%, got ${hoshinoRow!.afterPct}`);
}

const minPre = minimumPreMoneyForTarget(lstLatest, [], roundInputBase, 50);
assert.equal(minPre.valid, true);
if (minPre.valid) {
  const relativeError = Math.abs(minPre.preMoneyYen! - 570_000_000) / 570_000_000;
  assert.ok(relativeError < 0.01, `expected minimum pre ~570,000,000, got ${minPre.preMoneyYen}`);
}

// --- 5) 追加SOプール込みで option pool 合計 / postFD = 目標比率 ---

const poolTargetInput = { ...roundInputBase, targetPoolRate: 0.10 };
const poolResult = computeNextRoundScenario(lstLatest, [], poolTargetInput);
assert.equal(poolResult.valid, true);
if (poolResult.valid) {
  const poolRatio = (poolResult.existingPoolShares + poolResult.additionalPoolShares) / poolResult.postFdShares;
  assert.ok(Math.abs(poolRatio - 0.10) < 0.0001, `expected pool ratio ~10%, got ${poolRatio}`);
}

// --- 6) convertible toggle OFF/ON: postFD の差が estimated shares 分だけ反映される ---

const convertibleOff = computeNextRoundScenario(lstLatest, lstConvertibles, { ...roundInputBase, includeConvertibles: false });
const convertibleOn = computeNextRoundScenario(lstLatest, lstConvertibles, { ...roundInputBase, includeConvertibles: true });
assert.equal(convertibleOff.valid, true);
assert.equal(convertibleOn.valid, true);
if (convertibleOff.valid && convertibleOn.valid) {
  assert.equal(convertibleOn.f0 - convertibleOff.f0, 1_000, "F0 should grow by estimated_conversion_shares when toggled on");
  const standaloneRow = convertibleOn.rows.find((row) => row.key === "holder:コンバーチブル投資家");
  assert.ok(standaloneRow?.isConvertible, "unmatched convertible holder should appear as its own standalone row");
  assert.equal(standaloneRow?.beforeShares, 0, "standalone convertible holder has no pre-round equity");
}

// convertible holder sharing a name with an existing shareholder must merge into that row.
const mergingConvertibles: ConvertibleInstrument[] = [
  { id: "c2", holder_name: "星野", instrument_type: "J-KISS", issued_on: "2026-06-01", principal_yen: 5_000_000, valuation_cap_yen: 400_000_000, discount_rate: 0.2, conversion_trigger: null, maturity_on: null, estimated_conversion_price: 20_000, estimated_conversion_shares: 250, status: "outstanding", notes: null },
];
const mergedScenario = computeNextRoundScenario(lstLatest, mergingConvertibles, { ...roundInputBase, includeConvertibles: true });
assert.equal(mergedScenario.valid, true);
if (mergedScenario.valid) {
  const hoshinoRows = mergedScenario.rows.filter((row) => row.holderName === "星野");
  assert.equal(hoshinoRows.length, 1, "matching convertible holder must merge into a single row");
  assert.equal(hoshinoRows[0].afterShares, 30_000 + 250);
}

// multiple outstanding instruments for the same non-shareholder must merge into a single standalone row.
const duplicateStandaloneConvertibles: ConvertibleInstrument[] = [
  { id: "c3a", holder_name: "コンバーチブル投資家", instrument_type: "J-KISS", issued_on: "2026-06-01", principal_yen: 10_000_000, valuation_cap_yen: 400_000_000, discount_rate: 0.2, conversion_trigger: null, maturity_on: null, estimated_conversion_price: 20_000, estimated_conversion_shares: 500, status: "outstanding", notes: null },
  { id: "c3b", holder_name: "コンバーチブル投資家", instrument_type: "J-KISS", issued_on: "2026-07-01", principal_yen: 6_000_000, valuation_cap_yen: 400_000_000, discount_rate: 0.2, conversion_trigger: null, maturity_on: null, estimated_conversion_price: 20_000, estimated_conversion_shares: 300, status: "outstanding", notes: null },
];
const duplicateStandaloneScenario = computeNextRoundScenario(lstLatest, duplicateStandaloneConvertibles, { ...roundInputBase, includeConvertibles: true });
assert.equal(duplicateStandaloneScenario.valid, true);
if (duplicateStandaloneScenario.valid) {
  const matchingRows = duplicateStandaloneScenario.rows.filter((row) => row.key === "holder:コンバーチブル投資家");
  assert.equal(matchingRows.length, 1, "duplicate standalone convertible holders must produce exactly one row/key");
  assert.equal(matchingRows[0].afterShares, 800, "duplicate standalone convertible shares must be summed");
  assert.equal(duplicateStandaloneScenario.f0, lstLatest.dilutedShares + 800, "F0 must include the summed convertible shares");
}

// --- 7) invalid 入力 ---

assert.equal(computeNextRoundScenario(lstLatest, [], { ...roundInputBase, raiseYen: -1 }).valid, false, "negative raise must be invalid");
assert.equal(computeNextRoundScenario(lstLatest, [], { ...roundInputBase, targetPoolRate: 0.6 }).valid, false, "rate above 0.5 must be invalid");
assert.equal(computeNextRoundScenario(lstLatest, [], { ...roundInputBase, raiseYen: 0 }).valid, true, "zero raise must still be valid");

const impossibleTarget = minimumPreMoneyForTarget(lstLatest, [], { ...roundInputBase, targetPoolRate: 0.1 }, 90);
assert.equal(impossibleTarget.valid, false, "unreachable target percentage must be invalid");

const unknownHolder = minimumPreMoneyForTarget(lstLatest, [], { ...roundInputBase, protectHolderName: "存在しない人" }, 50);
assert.equal(unknownHolder.valid, false, "unknown holder name must be invalid");

const sensitivity = nextRoundSensitivity(lstLatest, [], roundInputBase);
assert.equal(sensitivity.length, 5);
assert.ok(sensitivity.every((point) => point.result.valid));

console.log("company overview cap table: ok");
