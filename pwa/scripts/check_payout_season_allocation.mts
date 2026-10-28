import assert from "node:assert/strict";
import { applyPayoutSnapshotsToCycles, buildSeasonAllocation, buildSeasonPayoutView } from "../src/lib/payout-season-allocation.ts";
import { buildPayoutSeasonPlan, type SeasonBilling } from "../src/lib/payout-season-plan.ts";
import { applyLegacyPayoutAmountOverridesToCycles } from "../src/lib/payout-amount-overrides.ts";

const plan = { project_id: "fixture", plan_cycle_id: "season", status: "active", period_start_ym: "202606", period_end_ym: "202607", budget_yen: 650 };
const months = ["202606", "202607"];
const profiles = [
  ...["a", "b", "c", "d"].map((member_id) => ({ member_id, code_name: member_id, is_officer: member_id === "a", exclude_from_payout_notice: false })),
  ...["internal-a", "internal-b"].map((member_id) => ({ member_id, code_name: member_id, exclude_from_payout_notice: true })),
];
const cycles: SeasonBilling[] = months.map((ym, index) => ({
  project_id: "fixture", ym, invoice_ym: null, status: "allocation_confirmed", extra_budget_yen: index ? 150 : 0,
  // Client receipt protection without reward_paid_at must never make this month disappear.
  payment_confirmed_at: "2026-07-01T00:00:00Z", reward_paid_at: null,
  reward_summary_json: { companyReserveYen: 75, members: [
    ...["a", "b", "c", "d"].map((memberId, i) => ({ memberId, totalPay: (i + 1) * 10, stockYen: memberId === "a" ? (index ? 7 : 999) : 0 })),
    { memberId: "internal-a", totalPay: 0, companyReserveYen: 50, payoutExcluded: true, stockYen: index ? 5 : 999, companyReserveUnfundedYen: index ? 5 : 999 },
    { memberId: "internal-b", totalPay: 0, companyReserveYen: 25, payoutExcluded: true, stockYen: 0 },
  ] },
}));
const original = JSON.stringify(cycles);
const snapshots = [{ project_id: "fixture", ym: "202606", member_id: "a", total_pay: 100 }];
const overlaid = applyPayoutSnapshotsToCycles(cycles, snapshots);
const actual = buildSeasonAllocation(plan, overlaid, profiles, months);
assert.equal(JSON.stringify(cycles), original, "表示用の照合で保護済み計算cache・stockを更新しない");
assert.equal(actual.members.length, 6, "振込4人と内部配賦2人の全員を表示する");
assert.equal(actual.cashYen, 290, "入金済み・報酬支払済みマーカー未設定の月も、保存済み支払額100円を採用する");
assert.equal(actual.internalYen, 150, "内部配賦を落として予算内に見せない");
assert.equal(actual.closingUnfundedYen, 12, "期末の外部未払7円と内部未充当5円を1回だけ計上する");
assert.equal(actual.externalUnpaidYen, 7);
assert.equal(actual.internalUnfundedYen, 5);
assert.equal(actual.cashCommittedYen, 297, "支払額は現金290円と外部未払7円。社内未充当は加えない");
assert.equal(actual.cashBudgetRemainingYen, 503);
assert.equal(actual.paymentStatus, "within_budget");
assert.equal(actual.committedYen, 452);
assert.equal(actual.budgetYen, 800, "登録された本契約と別財布の報酬原資だけを足す");
assert.equal(actual.remainingYen, 348);
assert.equal(actual.status, "within_budget");
assert.equal(actual.members.reduce((sum, m) => sum + m.totalYen, 0), actual.committedYen);
const payable = buildSeasonPayoutView(actual);
assert.equal(payable.members.length, 4, "支払額の表には振込対象者だけを表示する");
assert.equal(payable.budgetYen, 645, "既存の社内割当150円と未充当5円を確保した支払用原資");
assert.equal(payable.totalYen, 297);
assert.equal(payable.remainingYen, 348, "表示を簡潔にしても既存の割当を追加支払へ開放しない");
const matrix = buildPayoutSeasonPlan({ paymentYm: "202607", projects: [{ project_id: "fixture", project_name: "検証", status: "active", payment_due_rule: "next_month_end", payment_due_day: null }], plans: [plan], cycles: overlaid, members: profiles, extraRevenueRows: [] });
assert.equal(matrix.projects[0].totals.regularPay, actual.cashYen, "月別表と年間表の振込対象額が一致する。is_officerだけで除外しない");
assert.deepEqual(matrix.projects[0].memberPayments[0].cells["202607"].sourceYms, ["202606"], "7月振込の理由は6月稼働分へ進む");
assert.equal(buildSeasonAllocation({ ...plan, budget_yen: 100 }, overlaid, profiles, months).remainingYen, -202);
assert.equal(buildSeasonAllocation({ ...plan, budget_yen: 100 }, overlaid, profiles, months).status, "overallocated");
assert.equal(buildSeasonAllocation({ ...plan, budget_yen: 100 }, overlaid, profiles, months).paymentStatus, "over_budget", "外部支払そのものの原資超過を検出する");
assert.equal(buildSeasonAllocation({ ...plan, budget_yen: 140 }, overlaid, profiles, months).cashBudgetRemainingYen, -7, "振込が原資内でも外部未払を含めて超過を検出する");
assert.equal(buildSeasonAllocation({ ...plan, budget_yen: null }, overlaid, profiles, months).status, "unknown", "予算未設定を0円や赤字なしにしない");
assert.equal(buildSeasonAllocation(plan, overlaid.slice(1), profiles, months).remainingYen, null, "欠損月を0円で埋めない");
assert.equal(buildSeasonAllocation(plan, overlaid, profiles.slice(1), months).remainingYen, null, "メンバー不明の配分で赤字なしにしない");
assert.equal(buildSeasonAllocation(plan, applyPayoutSnapshotsToCycles(cycles, [{ ...snapshots[0], total_pay: null }]), profiles, months).remainingYen, null, "保存額の欠損を0円へ変換しない");
const missingInternal = structuredClone(cycles);
delete (missingInternal[0].reward_summary_json as { members: Array<Record<string, unknown>> }).members[4].companyReserveYen;
assert.equal(buildSeasonAllocation(plan, missingInternal, profiles, months).status, "unknown", "内部配賦の保存額欠損を0円扱いしない");
const poolMismatch = structuredClone(cycles);
(poolMismatch[0].reward_summary_json as { members: Array<Record<string, unknown>> }).members[0].extraPaidYen = 5;
assert.equal(buildSeasonAllocation(plan, applyPayoutSnapshotsToCycles(poolMismatch, snapshots), profiles, months).status, "unknown", "保存実績の原資内訳が不明なら、別財布報酬を本契約へ振り替えて赤字なしにしない");

const legacy = applyLegacyPayoutAmountOverridesToCycles(overlaid, [{ id: 1, project_id: "fixture", source_ym: "202606", member_id: "a", action: "set", amount_yen: 120, reason: "原本による帰属訂正", authorized_by: "masa", created_at: "2026-10-27T00:00:00Z" }]);
assert.equal(buildSeasonAllocation(plan, legacy, profiles, months).cashYen, 310, "帰属訂正の監査イベントを表示用保存額に適用する");
assert.equal(JSON.stringify(cycles), original);
// Two people share one 20pt MS; a separate 2pt MS exceeds the 20pt source.
// Early unused budget carries into the final month, where the remaining shortfall is visible.
const causePlan = { ...plan, budget_yen: 2000 };
const causeProfiles = ["lead", "partner", "admin"].map((member_id) => ({ member_id, code_name: member_id, exclude_from_payout_notice: true }));
const causeCycles: SeasonBilling[] = months.map((ym, index) => ({ project_id: "fixture", ym, invoice_ym: null, status: "allocation_confirmed", budget_yen: index ? 800 : 1200, extra_budget_yen: 0,
  reward_summary_json: { companyReserveYen: index ? 900 : 1100, members: [
    { memberId: "lead", basePay: 600, totalPay: 0, companyReserveYen: index ? 500 : 600, stockYen: index ? 100 : 0, breakdown: [{ msKey: "shared", title: "本業", pool: "regular", msConsumedPt: 10, earnedPt: 6, payYen: 600 }] },
    { memberId: "partner", basePay: 400, totalPay: 0, companyReserveYen: 400, stockYen: 0, breakdown: [{ msKey: "shared", title: "本業", pool: "regular", msConsumedPt: 10, earnedPt: 4, payYen: 400 }] },
    { memberId: "admin", basePay: 100, totalPay: 0, companyReserveYen: index ? 0 : 100, stockYen: index ? 100 : 0, breakdown: [{ msKey: "paperwork", title: "事務", pool: "regular", earnedPt: 1, payYen: 100 }] },
  ] },
}));
const cause = buildSeasonAllocation(causePlan, causeCycles, causeProfiles, months);
assert.equal(cause.remainingYen, -200);
assert.equal(cause.status, "overallocated", "非現金の社内配分超過は配分設計の状態");
assert.equal(cause.paymentStatus, "within_budget", "社内配分しかないPJを現金支払の原資超過にしない");
assert.equal(cause.cashCommittedYen, 0);
assert.equal(cause.externalUnpaidYen, 0);
assert.equal(cause.internalUnfundedYen, 200);
assert.equal(cause.internalYen, 2000, "支払判定の区別によって社内の割当を削らない");
assert.equal(cause.committedYen, 2200);
assert.equal(buildSeasonPayoutView(cause).members.length, 0);
assert.equal(buildSeasonPayoutView(cause).budgetYen, 0);
assert.equal(buildSeasonPayoutView(cause).remainingYen, 0, "非現金だけの配分超過を支払不足と表示しない");
assert.equal(buildSeasonPayoutView(buildSeasonAllocation(plan, overlaid.slice(1), profiles, months)).budgetYen, null, "未計算の原資を推測しない");
assert.equal(cause.evidence.regularPointBasis, 20);
assert.equal(cause.evidence.regularAllocatedPt, 22);
assert.equal(cause.evidence.milestones.find(m => m.msKey === "shared")?.earnedPt, 20, "担当者が複数でもMS消化ptを二重計上しない");
assert.equal(cause.evidence.milestones.find(m => m.msKey === "paperwork")?.earnedYen, 200);
assert.equal(cause.evidence.unexplainedYen, 0, "MS発生額から配分計への説明が一致する");
assert.equal(cause.evidence.msDifferenceYen, 0);
assert.deepEqual(cause.evidence.monthly.map(m => m.cumulativeRemainingYen), [100, -200], "不足が現れる稼働月と、早い月の余力を表示する");
assert.equal(cause.evidence.monthly[1].members.reduce((sum, m) => sum + m.closingUnfundedYen!, 0), 200);
console.log("年間報酬予算: 支払原資超過と非現金配分超過の分離・全員配分・期末残高・帰属訂正の照合に合格");
