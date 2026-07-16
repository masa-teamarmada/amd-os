import assert from "node:assert/strict";
import {
  buildCapTableSnapshots,
  capTableTieOut,
  convertibleScenario,
  type CompanyOverviewData,
} from "../src/lib/company-overview.ts";

const entry = (id: string, holderName: string, outstanding: number, diluted: number, holderType = "founder") => ({
  id, holder_type: holderType, holder_name: holderName, security_class: diluted > outstanding ? "新株予約権" : "普通株式",
  outstanding_delta: outstanding, diluted_delta: diluted, paid_in_yen_delta: 0,
});

const data: CompanyOverviewData = {
  profile: {
    id: "profile", project_id: "p-test", legal_status: "incorporated", legal_name: "テスト株式会社", legal_name_en: null,
    corporate_number: null, entity_type: "株式会社", incorporated_on: "2026-01-01", head_office: null, business_purpose: null,
    representative_name: null, capital_yen: 5_000_000, authorized_shares: 10_000, registered_issued_shares: 1_200,
    board_structure: null, has_board: false, has_auditor: false, fiscal_year_end_month: 12, public_notice_method: null,
    invoice_registration_number: null, source_ref: null, source_verified_on: null, notes: null,
  },
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

const scenario = convertibleScenario(data);
assert.equal(scenario.estimatedShares, 200);
assert.equal(scenario.proFormaDilutedShares, 1_520);
assert.equal(capTableTieOut(data).state, "matched");

console.log("company overview cap table: ok");
