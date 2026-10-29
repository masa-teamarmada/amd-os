import assert from "node:assert/strict";
import { deliverAgreementNotice, planAgreementNotices, type AgreementNotice, type AgreementNoticeLedger, type AgreementNoticeState } from "../src/lib/monthly-agreement-handoff.ts";
import { agreementNoticeScopeAllows, queueAndScheduleAgreementHandoff } from "../src/lib/monthly-agreement-handoff-server.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MonthlyWorkAgreementBundle, MonthlyWorkAgreementProject } from "../src/lib/monthly-work-agreement-types.ts";

const project = (projectId: string, amount: number): MonthlyWorkAgreementProject => ({
  projectId, projectName: projectId === "p19" ? "ZMP" : "別PJ", projectStatus: "active", roleLabel: null,
  isPm: false, isPl: false, billingStatus: null, allocationStatus: "active", expectedRewardYen: amount,
  currentMonthAccrualYen: amount, payoutYen: amount, currentCyclePayoutYen: amount, paymentYm: "202611",
  stockYen: 0, grossDueYen: amount, carryInYen: 0, earnedPt: 1, conditionState: "ready", conditions: [],
  reviewReasons: [], milestones: [], payoutSchedule: [], routineExpectations: [], seasonStartYm: "202601",
  seasonEndYm: "202612", memberAllocations: [], allocationTotals: { memberCount: 1, earnedPt: 1, accrualYen: amount, payYen: amount },
});

const bundle = {
  ym: "202610", member: { memberId: "ID026", codeName: "しん" },
  snapshot: { schemaVersion: "monthly_work_agreement.v2", ym: "202610", member: { memberId: "ID026", codeName: "しん" },
    projects: [project("p19", 55200), project("p20", 10000)], totals: { expectedRewardYen: 65200, currentMonthAccrualYen: 65200,
      carryInYen: 0, stockYen: 0, projectCount: 2, reviewRequiredCount: 0 } },
  projectAgreements: [
    { projectId: "p19", projectName: "ZMP", status: "needs_reagreement", agreedAt: null, agreedBy: null,
      agreedSnapshotHash: null, currentHash: "now", fromLegacyMemberAgreement: false, canAgree: true, blockedReason: null, changeSummary: null },
    { projectId: "p20", projectName: "別PJ", status: "agreed", agreedAt: null, agreedBy: null,
      agreedSnapshotHash: "old", currentHash: "old", fromLegacyMemberAgreement: false, canAgree: true, blockedReason: null, changeSummary: null },
  ],
  revisionRequests: [], tableReady: true, amountChangeReasons: [{ id: "reason", ym: "202610", memberId: "ID026", projectId: "p19", agreementSnapshotHash: "now",
    reason: "水素35,700円とOkuDoor19,500円を今回一度だけ。", createdBy: "ID001", createdAt: "", updatedBy: null, updatedAt: "" }],
  expectedRewardChangeExplanations: [{ projectId: "p19", projectName: "ZMP", beforeYen: 35700, afterYen: 55200,
    headline: "追加", details: ["19,500円追加"], explained: true }],
  currentHash: "now", status: "needs_reagreement", projectScopedAgreement: true, latestAgreement: null,
  canRequestRevision: true, canAgree: true, changeSummary: null, amountChangeReasonRequiredProjectIds: [], missingAmountChangeReasonProjectIds: [],
} as MonthlyWorkAgreementBundle;

const admins = ["ID001", "ID002"];
const originalSwitch = process.env.AMIE_MONTHLY_AGREEMENT_NOTIFICATIONS_ENABLED;
const originalScope = process.env.AMIE_MONTHLY_AGREEMENT_NOTIFICATIONS_SCOPE;
delete process.env.AMIE_MONTHLY_AGREEMENT_NOTIFICATIONS_ENABLED;
const held = await queueAndScheduleAgreementHandoff(new Proxy({}, { get() { throw new Error("held mode must not read DB"); } }) as SupabaseClient,
  { ym: "202610", memberId: "ID026", kind: "reagreement_requested", projectIds: ["p19"] },
  () => { throw new Error("held mode must not schedule"); });
assert.deepEqual(held, { state: "held", count: 0 });
if (originalSwitch !== undefined) process.env.AMIE_MONTHLY_AGREEMENT_NOTIFICATIONS_ENABLED = originalSwitch;
process.env.AMIE_MONTHLY_AGREEMENT_NOTIFICATIONS_ENABLED = "1";
delete process.env.AMIE_MONTHLY_AGREEMENT_NOTIFICATIONS_SCOPE;
assert.equal(agreementNoticeScopeAllows({ kind: "agreement_completed", ym: "202610", memberId: "ID004", projectId: "p19" }), false);
process.env.AMIE_MONTHLY_AGREEMENT_NOTIFICATIONS_SCOPE = "agreement_completed:202610:ID004:p19:ID001,agreement_completed:202610:ID004:p19:ID002";
assert.equal(agreementNoticeScopeAllows({ kind: "agreement_completed", ym: "202610", memberId: "ID004", projectId: "p19" }), true);
assert.equal(agreementNoticeScopeAllows({ kind: "agreement_completed", ym: "202610", memberId: "ID004", projectId: "p19", recipientMemberId: "ID001" }), true);
assert.equal(agreementNoticeScopeAllows({ kind: "agreement_completed", ym: "202610", memberId: "ID004", projectId: "p19", recipientMemberId: "ID002" }), true);
assert.equal(agreementNoticeScopeAllows({ kind: "agreement_completed", ym: "202610", memberId: "ID004", projectId: "p19", recipientMemberId: "ID003" }), false);
assert.equal(agreementNoticeScopeAllows({ kind: "reagreement_requested", ym: "202610", memberId: "ID004", projectId: "p19" }), false);
assert.equal(agreementNoticeScopeAllows({ kind: "agreement_completed", ym: "202610", memberId: "ID026", projectId: "p19" }), false);
assert.equal(agreementNoticeScopeAllows({ kind: "agreement_completed", ym: "202611", memberId: "ID004", projectId: "p19" }), false);
assert.deepEqual(await queueAndScheduleAgreementHandoff(new Proxy({}, { get() { throw new Error("out-of-scope event must not read DB"); } }) as SupabaseClient,
  { ym: "202610", memberId: "ID026", kind: "agreement_completed", projectIds: ["p19"] },
  () => { throw new Error("out-of-scope event must not schedule"); }), { state: "held", count: 0 });
if (originalSwitch === undefined) delete process.env.AMIE_MONTHLY_AGREEMENT_NOTIFICATIONS_ENABLED;
else process.env.AMIE_MONTHLY_AGREEMENT_NOTIFICATIONS_ENABLED = originalSwitch;
if (originalScope === undefined) delete process.env.AMIE_MONTHLY_AGREEMENT_NOTIFICATIONS_SCOPE;
else process.env.AMIE_MONTHLY_AGREEMENT_NOTIFICATIONS_SCOPE = originalScope;
const requests = planAgreementNotices(bundle, "reagreement_requested", admins, ["p19"]);
assert.equal(requests.length, 1);
assert.equal(requests[0].recipientMemberId, "ID026");
assert.match(requests[0].text, /35,700円 → 55,200円/);
assert.match(requests[0].text, /差額\+19,500円/);
assert.match(requests[0].text, /今回一度だけ/);
assert.match(requests[0].text, /2026年11月/);
assert.ok(!requests[0].text.includes("別PJ"));
assert.deepEqual(planAgreementNotices({ ...bundle, snapshot: { ...bundle.snapshot, projects: [...bundle.snapshot.projects].reverse() } }, "reagreement_requested", admins, ["p19"]).map(j => j.id), requests.map(j => j.id));
assert.equal(planAgreementNotices({ ...bundle, revisionRequests: [{ id: "r1", ym: "202610", memberId: "ID026", projectId: "p19", requestType: "reward", body: "変更希望", status: "open", snapshotHash: "", createdAt: "", resolvedAt: null, resolvedBy: null, resolutionNote: null }] }, "reagreement_requested", admins, ["p19"]).length, 0);
const openRequestBundle = { ...bundle, revisionRequests: [{ id: "r1", ym: "202610", memberId: "ID026", projectId: "p19", requestType: "reward", body: "担当割合を確認したい", status: "open", snapshotHash: "", createdAt: "", resolvedAt: null, resolvedBy: null, resolutionNote: null }] } as MonthlyWorkAgreementBundle;
const inbound = planAgreementNotices(openRequestBundle, "revision_requested", admins, undefined, ["r1"]);
assert.equal(inbound.length, 2);
assert.deepEqual(inbound.map(j => j.recipientMemberId), admins);
assert.match(inbound[0].text, /担当割合を確認したい/);
assert.equal(planAgreementNotices({ ...openRequestBundle, revisionRequests: openRequestBundle.revisionRequests.map(r => ({ ...r, status: "resolved" })) }, "revision_requested", admins).length, 0);
const agreed = { ...bundle, projectAgreements: bundle.projectAgreements.map(a => a.projectId === "p19" ? { ...a, status: "agreed" as const } : a) } as MonthlyWorkAgreementBundle;
const completions = planAgreementNotices(agreed, "agreement_completed", admins, ["p19"]);
assert.equal(completions.length, 2);
assert.deepEqual(completions.map(j => j.recipientMemberId), admins);
assert.match(completions[0].text, /55,200円/);
assert.match(completions[0].text, /入金状況と発行条件を確認/);
assert.ok(!completions[0].text.includes("振込を実行"));
const kouAgreed = { ...agreed, member: { memberId: "ID004", codeName: "こう" }, snapshot: { ...agreed.snapshot,
  member: { memberId: "ID004", codeName: "こう" }, projects: [project("p19", 19500)] } } as MonthlyWorkAgreementBundle;
const kouCompletions = planAgreementNotices(kouAgreed, "agreement_completed", admins, ["p19"]);
assert.deepEqual(kouCompletions.map(j => j.recipientMemberId), admins);
assert.equal(kouCompletions.length, 2);
assert.match(kouCompletions[0].text, /こうの合意が完了/);
assert.match(kouCompletions[0].text, /19,500円/);

const states = new Map<string, AgreementNoticeState>();
let claims = 0;
const ledger: AgreementNoticeLedger = {
  async claim(job) { claims++; const state = states.get(job.id); if (state) return state; states.set(job.id, "sending"); return "claimed"; },
  async finish(job, state) { states.set(job.id, state); },
};
let sends = 0;
const send = async (_job: AgreementNotice) => { sends++; return { ok: true, channel: "C1", messageTs: "1.0" }; };
assert.equal((await deliverAgreementNotice(requests[0], { enabled: false, ledger, send })).state, "held");
assert.equal(claims, 0); assert.equal(sends, 0);
assert.equal((await deliverAgreementNotice(requests[0], { enabled: true, ledger, send })).state, "sent");
assert.equal((await deliverAgreementNotice(requests[0], { enabled: true, ledger, send })).state, "sent");
assert.equal(sends, 1);
const ambiguous = await deliverAgreementNotice(completions[0], { enabled: true, ledger, send: async () => { throw new Error("timeout after post"); } });
assert.equal(ambiguous.state, "uncertain");
assert.equal((await deliverAgreementNotice(completions[0], { enabled: true, ledger, send })).state, "uncertain");
assert.equal(sends, 1);
console.log("monthly agreement handoff: request, re-agreement, completion, hold, idempotency, ambiguous delivery OK");
