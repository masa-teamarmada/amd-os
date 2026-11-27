import assert from "node:assert/strict";
import { applyPayoutSnapshotsToCycles, buildSeasonAllocation } from "../src/lib/payout-season-allocation.ts";
import {
  applyLegacyPayoutAmountOverridesToCycles,
  applyPayoutAmountOverridesToCycles,
  latestLegacyPayoutOverrideEvents,
  type ConfirmedPayoutAmountEventRow,
  type PayoutAmountOverrideEventRow,
} from "../src/lib/payout-amount-overrides.ts";

const events: PayoutAmountOverrideEventRow[] = [
  {
    id: 1,
    event_key: "p19-202606-ID004-set-1",
    project_id: "p19",
    source_ym: "202606",
    member_id: "ID004",
    action: "set",
    amount_yen: 0,
    reason: "ポイント制移行前の事前合意額",
    authorized_by: "masa",
    created_at: "2026-07-28T00:00:00.000Z",
  },
  {
    id: 2,
    event_key: "p19-202606-ID009-set-1",
    project_id: "p19",
    source_ym: "202606",
    member_id: "ID009",
    action: "set",
    amount_yen: 40_000,
    reason: "ポイント制移行前の事前合意額",
    authorized_by: "masa",
    created_at: "2026-07-28T00:00:01.000Z",
  },
  {
    id: 3,
    event_key: "p19-202606-ID009-clear-1",
    project_id: "p19",
    source_ym: "202606",
    member_id: "ID009",
    action: "clear",
    amount_yen: null,
    reason: "テスト用に固定額を解除するイベント",
    authorized_by: "masa",
    created_at: "2026-07-28T00:00:02.000Z",
  },
  {
    id: 4,
    event_key: "p19-202607-ID004-set-ignored",
    project_id: "p19",
    source_ym: "202607",
    member_id: "ID004",
    action: "set",
    amount_yen: 99_999,
    reason: "ポイント制移行後なので適用しない",
    authorized_by: "masa",
    created_at: "2026-07-28T00:00:03.000Z",
  },
];

const latest = latestLegacyPayoutOverrideEvents(events);
assert.equal(latest.get("p19:202606:ID004")?.action, "set");
assert.equal(latest.get("p19:202606:ID009")?.action, "clear");
assert.equal(latest.has("p19:202607:ID004"), false);

const originalCycle = {
  project_id: "p19",
  ym: "202606",
  reward_summary_json: {
    totalPaySum: 49_140,
    meta: { source: "supabase_reward_summary" },
    members: [
      { memberId: "ID004", memberName: "こう", totalPay: 12_480, regularPaidYen: 12_480, stockYen: 0 },
      { memberId: "ID009", memberName: "あび", totalPay: 36_660, regularPaidYen: 36_660, stockYen: 66_600 },
    ],
  },
};
const result = applyLegacyPayoutAmountOverridesToCycles([originalCycle], events);
const summary = result[0].reward_summary_json as Record<string, unknown>;
const members = summary.members as Array<Record<string, unknown>>;
const kou = members.find((member) => member.memberId === "ID004");
const abi = members.find((member) => member.memberId === "ID009");

assert.notEqual(result[0], originalCycle);
assert.equal((originalCycle.reward_summary_json.members[0] as Record<string, unknown>).totalPay, 12_480);
assert.equal(kou?.totalPay, 0);
assert.equal(kou?.regularPaidYen, 0);
assert.equal((kou?.payoutAmountOverride as Record<string, unknown>).calculatedTotalPayYen, 12_480);
assert.equal(abi?.totalPay, 36_660, "latest clear event must leave the calculated amount intact");
assert.equal(summary.totalPaySum, 36_660);
assert.deepEqual(summary.meta, {
  source: "supabase_reward_summary",
  payoutAmountOverridesApplied: 1,
  payoutAmountOverrideScope: "payout_notice_only",
});

const missingMemberEvent: PayoutAmountOverrideEventRow = {
  id: 5,
  event_key: "p19-202606-ID026-set-1",
  project_id: "p19",
  source_ym: "202606",
  member_id: "ID026",
  action: "set",
  amount_yen: 55_000,
  reason: "ポイント制移行前の事前合意額",
  authorized_by: "masa",
  created_at: "2026-07-28T00:00:04.000Z",
};
const withMissingMember = applyLegacyPayoutAmountOverridesToCycles([originalCycle], [missingMemberEvent]);
const addedMembers = (withMissingMember[0].reward_summary_json as { members: Array<Record<string, unknown>> }).members;
assert.equal(addedMembers.find((member) => member.memberId === "ID026")?.totalPay, 55_000);

const octoberCycle = {
  project_id: "p19",
  ym: "202610",
  reward_summary_json: {
    totalPaySum: 576_000,
    externalRegularPayoutCapYen: 176_000,
    externalExtraPayoutCapYen: 400_000,
    members: [
      { memberId: "ID009", totalPay: 264_000, regularPaidYen: 64_000, extraPaidYen: 200_000, stockYen: 0 },
      { memberId: "ID008", totalPay: 237_300, regularPaidYen: 37_300, extraPaidYen: 200_000, stockYen: 0 },
      { memberId: "ID004", totalPay: 19_500, regularPaidYen: 19_500, extraPaidYen: 0, stockYen: 0 },
      { memberId: "ID026", totalPay: 55_200, regularPaidYen: 55_200, extraPaidYen: 0, stockYen: 0 },
    ],
  },
};
const confirmed: ConfirmedPayoutAmountEventRow[] = [
  { id: 1, event_key: "abi", project_id: "p19", source_ym: "202610", payment_ym: "202611", member_id: "ID009", action: "set", amount_yen: 40_200, reason: "前回支払額で確定", authorized_by: "masa", created_at: "2026-11-27T00:00:00Z" },
  { id: 2, event_key: "ume", project_id: "p19", source_ym: "202610", payment_ym: "202611", member_id: "ID008", action: "set", amount_yen: 0, reason: "稼働なし", authorized_by: "masa", created_at: "2026-11-27T00:00:01Z" },
];
const confirmedCycle = applyPayoutAmountOverridesToCycles([octoberCycle], [], confirmed)[0];
const confirmedSummary = confirmedCycle.reward_summary_json as Record<string, unknown>;
const confirmedMembers = confirmedSummary.members as Array<Record<string, unknown>>;
assert.equal(confirmedMembers.find((member) => member.memberId === "ID009")?.totalPay, 40_200);
assert.equal(confirmedMembers.find((member) => member.memberId === "ID008")?.totalPay, 0);
assert.equal(confirmedMembers.find((member) => member.memberId === "ID004")?.totalPay, 19_500);
assert.equal(confirmedMembers.find((member) => member.memberId === "ID026")?.totalPay, 55_200);
assert.equal(confirmedSummary.externalRegularPayoutCapYen, 114_900);
assert.equal(confirmedSummary.externalExtraPayoutCapYen, 0);
assert.equal((octoberCycle.reward_summary_json.members[0] as Record<string, unknown>).totalPay, 264_000, "報酬計算の正本は書き換えない");
assert.equal((confirmedMembers[0].payoutAmountOverride as Record<string, unknown>).kind, "confirmed_payment_amount");

const seasonCycle = { ...octoberCycle, invoice_ym: null, status: "allocation_confirmed", budget_yen: 300_000, extra_budget_yen: 400_000 };
const saved = applyPayoutSnapshotsToCycles([seasonCycle], [
  { project_id: "p19", ym: "202610", member_id: "ID009", total_pay: 40_200 },
  { project_id: "p19", ym: "202610", member_id: "ID008", total_pay: 0 },
]);
const savedConfirmed = applyPayoutAmountOverridesToCycles(saved, [], confirmed);
const savedMembers = (savedConfirmed[0].reward_summary_json as { members: Array<Record<string, unknown>> }).members;
assert.equal(savedMembers.find((member) => member.memberId === "ID009")?.payoutSnapshotSplitUnknown, false, "保存額が明示確定額と一致すれば別財布内訳の未確認を解消する");
assert.equal(savedMembers.find((member) => member.memberId === "ID008")?.payoutSnapshotSplitUnknown, false);
const allocation = buildSeasonAllocation(
  { project_id: "p19", plan_cycle_id: "season", status: "active", period_start_ym: "202610", period_end_ym: "202610", budget_yen: 300_000 },
  savedConfirmed,
  ["ID009", "ID008", "ID004", "ID026"].map((member_id) => ({ member_id, code_name: member_id, exclude_from_payout_notice: false })),
  ["202610"],
);
assert.equal(allocation.status, "within_budget", "保存明細と確定額が一致する月をシーズン表で未計算にしない");
assert.equal(allocation.cashYen, 114_900);

const mismatched = applyPayoutAmountOverridesToCycles(applyPayoutSnapshotsToCycles([seasonCycle], [
  { project_id: "p19", ym: "202610", member_id: "ID009", total_pay: 50_000 },
]), [], confirmed)[0];
assert.equal((mismatched.reward_summary_json as { members: Array<Record<string, unknown>> }).members[0].payoutSnapshotSplitUnknown, true, "保存額と確定額が食い違うときは未確認を残す");

console.log("payout amount override tests passed");
