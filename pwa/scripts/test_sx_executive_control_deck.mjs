import assert from "node:assert/strict";
import {
  deriveSxCriticalPathRail,
  deriveSxInterventionQueue,
  deriveSxUpcomingQueue,
  sxVerdictDisplayLabel,
  sxEcdFormatDueDate,
  sxEcdIsDueDateOverdue,
} from "../src/lib/sx-executive-control-deck.ts";

function milestone(overrides = {}) {
  return {
    id: "m-1", slug: "m-1", title: "テストゲート", gate: "ゲートA", status: "on_track",
    isBlocked: false, isOverdue: false, isStale: false,
    plannedEnd: "2026-08-01", forecastEnd: "2026-08-01", deltaDays: 0,
    dateCertainty: "confirmed", ownerLabel: "担当A", confidence: "high", criticality: "critical",
    ...overrides,
  };
}

function issue(overrides = {}) {
  return {
    id: "i-1", slug: "i-1", title: "論点A", status: "open", ownerLabel: "担当A", dueDate: null,
    relatedMilestoneSlugs: [], validationRuns: [], decisions: [],
    ...overrides,
  };
}

// 1. DAG invalid -> explicit 依存関係不正, never invents a path.
{
  const rail = deriveSxCriticalPathRail({ dagValid: false, criticalPathSlugs: ["a", "b"] }, [milestone({ slug: "a" }), milestone({ slug: "b" })]);
  assert.equal(rail.valid, false);
  assert.equal(rail.reason, "依存関係不正");
  assert.deepEqual(rail.nodes, []);
}

// 1b. DAG valid but no critical path registered -> explicit 重要経路未登録.
{
  const rail = deriveSxCriticalPathRail({ dagValid: true, criticalPathSlugs: [] }, [milestone()]);
  assert.equal(rail.valid, false);
  assert.equal(rail.reason, "重要経路未登録");
}

// 2. Ordered current-node selection: completed prefix, first incomplete = current, rest = future.
{
  const milestones = [
    milestone({ id: "1", slug: "a", status: "completed" }),
    milestone({ id: "2", slug: "b", status: "completed" }),
    milestone({ id: "3", slug: "c", status: "on_track" }),
    milestone({ id: "4", slug: "d", status: "on_track" }),
  ];
  const rail = deriveSxCriticalPathRail({ dagValid: true, criticalPathSlugs: ["a", "b", "c", "d"] }, milestones);
  assert.equal(rail.valid, true);
  assert.deepEqual(rail.nodes.map((node) => node.state), ["complete", "complete", "current", "future"]);
  assert.equal(rail.currentIndex, 2);
  assert.equal(rail.nodes[2].isCurrent, true);
  assert.equal(rail.nodes[0].isCurrent, false);
}

// 2b. All milestones complete -> no current node, all complete.
{
  const milestones = [milestone({ id: "1", slug: "a", status: "completed" }), milestone({ id: "2", slug: "b", status: "completed" })];
  const rail = deriveSxCriticalPathRail({ dagValid: true, criticalPathSlugs: ["a", "b"] }, milestones);
  assert.deepEqual(rail.nodes.map((node) => node.state), ["complete", "complete"]);
  assert.equal(rail.currentIndex, 2);
}

// 2c. Missing milestone for a critical-path slug -> unassessed node, not invented.
{
  const milestones = [milestone({ id: "1", slug: "a", status: "completed" })];
  const rail = deriveSxCriticalPathRail({ dagValid: true, criticalPathSlugs: ["a", "missing-slug"] }, milestones);
  assert.equal(rail.nodes[1].state, "unassessed");
  assert.equal(rail.nodes[1].milestoneId, null);
  assert.equal(rail.nodes[1].title, "missing-slug");
}

// 2d. False-green states: overdue/blocked/unassessed/attention never render as current/future(green).
{
  const milestones = [
    milestone({ id: "1", slug: "a", status: "on_track", isOverdue: true }),
    milestone({ id: "2", slug: "b", status: "blocked", isBlocked: true }),
    milestone({ id: "3", slug: "c", status: "unassessed", confidence: "unknown" }),
    milestone({ id: "4", slug: "d", status: "attention" }),
    milestone({ id: "5", slug: "e", status: "on_track", isStale: true }),
  ];
  const rail = deriveSxCriticalPathRail({ dagValid: true, criticalPathSlugs: ["a", "b", "c", "d", "e"] }, milestones);
  assert.deepEqual(rail.nodes.map((node) => node.state), ["overdue", "blocked", "unassessed", "attention", "unassessed"]);
  assert.ok(!rail.nodes.some((node) => node.state === "current" || node.state === "future"));
}

// 2e. Node dates keep 予定(plannedEnd) and 予測(forecastEnd) distinct, plus delta.
{
  const milestones = [milestone({ id: "1", slug: "a", plannedEnd: "2026-08-01", forecastEnd: "2026-08-10", deltaDays: 9 })];
  const rail = deriveSxCriticalPathRail({ dagValid: true, criticalPathSlugs: ["a"] }, milestones);
  assert.equal(rail.nodes[0].plannedEnd, "2026-08-01");
  assert.equal(rail.nodes[0].forecastEnd, "2026-08-10");
  assert.equal(rail.nodes[0].deltaDays, 9);
}

// 2f. Visible window: at most previous completed + current + next up to 3, plus final endpoint,
// with a leading "+N完了" marker and trailing "…N" marker when the final isn't already inside the window.
{
  const milestones = ["a", "b", "c", "d", "e", "f", "g", "h"].map((slug, index) =>
    milestone({ id: slug, slug, status: index <= 2 ? "completed" : "on_track" }),
  );
  const rail = deriveSxCriticalPathRail({ dagValid: true, criticalPathSlugs: ["a", "b", "c", "d", "e", "f", "g", "h"] }, milestones);
  // currentIndex = 3 (d). window = prev-completed(c) + current(d) + next 3 (e,f,g) = [2..6], and the
  // final endpoint (h) immediately follows the window here, so no trailing gap remains.
  assert.equal(rail.currentIndex, 3);
  assert.equal(rail.leadingMarker.count, 2); // a, b hidden before window
  assert.ok(rail.visibleNodes.some((node) => node.isCurrent));
  assert.equal(rail.visibleNodes[rail.visibleNodes.length - 1].slug, "h"); // final endpoint always visible
  assert.equal(rail.trailingMarker, null);
}

// 2g. Visible window with a real trailing gap: final endpoint sits well beyond current+next3, so a
// "…N" marker must appear and the final node must still be appended (never scrolled out of view).
{
  const milestones = Array.from({ length: 10 }, (_, index) => milestone({ id: `s${index}`, slug: `s${index}`, status: "on_track", title: `G${index}` }));
  const rail = deriveSxCriticalPathRail({ dagValid: true, criticalPathSlugs: milestones.map((m) => m.slug) }, milestones);
  const visibleSlugs = rail.visibleNodes.map((node) => node.slug);
  assert.equal(visibleSlugs[visibleSlugs.length - 1], "s9"); // final always appended
  assert.ok(rail.trailingMarker && rail.trailingMarker.count > 0);
}

// 3. Stable blocker priority in the intervention queue: critical-path blocked outranks overdue,
// which outranks owner-unconfirmed. Ties broken by due date then label.
{
  const criticalMilestones = [
    milestone({ id: "blocked-1", slug: "blocked-1", isBlocked: true, plannedEnd: "2026-08-10", title: "Bゲート停止", gate: "B" }),
    milestone({ id: "overdue-1", slug: "overdue-1", isOverdue: true, plannedEnd: "2026-07-01", title: "Aゲート遅延", gate: "A" }),
    milestone({ id: "owner-missing", slug: "owner-missing", ownerLabel: "未確認", plannedEnd: "2026-09-01", title: "担当未確認ゲート", gate: "C" }),
  ];
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["blocked-1", "overdue-1", "owner-missing"],
    milestones: criticalMilestones,
    partnerWorkItems: [],
    partners: [],
    issues: [],
  });
  assert.deepEqual(queue.rows.map((row) => row.kind), ["critical_blocked", "critical_overdue", "owner_unconfirmed"]);
  assert.equal(queue.rows[0].target, "Bゲート停止");
}

// 3b. Stable tie-break: same priority, sorted by due date then label.
{
  const criticalMilestones = [
    milestone({ id: "z", slug: "z", isBlocked: true, plannedEnd: "2026-08-01", title: "Zゲート" }),
    milestone({ id: "a", slug: "a", isBlocked: true, plannedEnd: "2026-08-01", title: "Aゲート" }),
  ];
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["z", "a"],
    milestones: criticalMilestones,
    partnerWorkItems: [],
    partners: [],
    issues: [],
  });
  assert.deepEqual(queue.rows.map((row) => row.target), ["Aゲート", "Zゲート"]);
}

// 4. No unknown => on-schedule claim: an unassessed critical milestone with a KNOWN owner never
// silently disappears, and never collapses into owner_unconfirmed just because it's unassessed —
// the owner is preserved and the kind is the distinct "gate_unassessed".
{
  const criticalMilestones = [milestone({ id: "u", slug: "u", status: "unassessed", confidence: "unknown", plannedEnd: null, forecastEnd: "2026-09-10", ownerLabel: "担当B", dateCertainty: "provisional", title: "未評価ゲート" })];
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["u"],
    milestones: criticalMilestones,
    partnerWorkItems: [],
    partners: [],
    issues: [],
  });
  assert.equal(queue.rows.length, 1);
  assert.equal(queue.rows[0].kind, "gate_unassessed");
  assert.equal(queue.rows[0].ballOwner, "担当B");
  assert.equal(queue.rows[0].dueDate, "2026-09-10");
  assert.equal(queue.rows[0].dueContextLabel, "予測期限");
  assert.equal(queue.rows[0].dateCertainty, "provisional");
}

// 4b. A stale (not unassessed, owner known) critical milestone gets the distinct "gate_stale" kind,
// keeping its known owner rather than falling back to "未確認".
{
  const criticalMilestones = [milestone({ id: "s", slug: "s", status: "on_track", confidence: "high", isStale: true, ownerLabel: "担当C", title: "鮮度切れゲート" })];
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["s"],
    milestones: criticalMilestones,
    partnerWorkItems: [],
    partners: [],
    issues: [],
  });
  assert.equal(queue.rows.length, 1);
  assert.equal(queue.rows[0].kind, "gate_stale");
  assert.equal(queue.rows[0].ballOwner, "担当C");
}

// 4c. Owner-missing still takes precedence over stale/unassessed and always resolves to
// owner_unconfirmed with the "未確認" ball owner.
{
  const criticalMilestones = [milestone({ id: "o", slug: "o", status: "unassessed", isStale: true, ownerLabel: "未確認", title: "担当不明ゲート" })];
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["o"],
    milestones: criticalMilestones,
    partnerWorkItems: [],
    partners: [],
    issues: [],
  });
  assert.equal(queue.rows.length, 1);
  assert.equal(queue.rows[0].kind, "owner_unconfirmed");
  assert.equal(queue.rows[0].ballOwner, "未確認");
}

// 5. Internal (milestone/issue) ball rows never hardcode "SX側" — column semantics = 担当, owner
// unavailable => "未確認".
{
  const criticalMilestones = [milestone({ id: "internal", slug: "internal", isBlocked: true, ownerLabel: "", title: "内部停止ゲート" })];
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["internal"],
    milestones: criticalMilestones,
    partnerWorkItems: [],
    partners: [],
    issues: [],
  });
  assert.equal(queue.rows[0].ballOwner, "未確認");
  assert.equal(queue.rows[0].ballSide, "担当");
  assert.notEqual(queue.rows[0].ballSide, "SX側");
}

// 5b. Technical test rows: blocked/failed top priority, exact testName/ownerLabel, due = parent gate
// forecast/planned with "親ゲート期限" context label, milestoneId carried.
{
  const criticalMilestones = [milestone({ id: "gate-1", slug: "gate-1", plannedEnd: "2026-08-01", forecastEnd: "2026-08-05", gate: "TRL4", dateCertainty: "provisional" })];
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["gate-1"],
    milestones: criticalMilestones,
    technicalTests: [
      { id: "t-1", milestoneId: "gate-1", testName: "耐久試験", status: "failed", ownerLabel: "研究者A" },
      { id: "t-2", milestoneId: "gate-1", testName: "評価未着手試験", status: "unassessed", ownerLabel: "研究者B" },
    ],
    partnerWorkItems: [],
    partners: [],
    issues: [],
  });
  const blockedTest = queue.rows.find((row) => row.kind === "technical_test_blocked");
  assert.ok(blockedTest);
  assert.equal(blockedTest.target, "耐久試験");
  assert.equal(blockedTest.ballOwner, "研究者A");
  assert.equal(blockedTest.dueDate, "2026-08-05");
  assert.equal(blockedTest.dueContextLabel, "親ゲート期限");
  assert.equal(blockedTest.milestoneId, "gate-1");
  assert.equal(blockedTest.priority, 1);
  // Parent gate's dateCertainty must be carried through to the test row (previously dropped).
  assert.equal(blockedTest.dateCertainty, "provisional");
  const unassessedTest = queue.rows.find((row) => row.kind === "technical_test_unassessed");
  assert.ok(unassessedTest);
  assert.ok(unassessedTest.priority > blockedTest.priority);
  assert.equal(unassessedTest.dateCertainty, "provisional");
}

// 5c. Validation runs derived individually from critical-linked issues: exact method/owner/due/gate/issueId.
{
  const criticalMilestones = [milestone({ id: "gate-2", slug: "gate-2", gate: "TRL5" })];
  const linkedIssue = issue({
    id: "issue-1", relatedMilestoneSlugs: ["gate-2"],
    validationRuns: [{ id: "v-1", method: "耐熱サイクル試験", status: "blocked", dueDate: "2026-07-10", ownerLabel: "研究者C" }],
  });
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["gate-2"],
    milestones: criticalMilestones,
    partnerWorkItems: [],
    partners: [],
    issues: [linkedIssue],
  });
  const row = queue.rows.find((r) => r.kind === "validation_run");
  assert.ok(row);
  assert.equal(row.target, "耐熱サイクル試験");
  assert.equal(row.ballOwner, "研究者C");
  assert.equal(row.dueDate, "2026-07-10");
  assert.equal(row.gate, "TRL5");
  assert.equal(row.entityType, "issue");
  assert.equal(row.entityId, "issue-1");
  assert.equal(row.anchor, "#sx-issue-issue-1");
}

// 5d. Action items derived individually via decision.issueId -> issue -> critical milestone: exact
// title/owner/due/gate/issueId, not collapsed to the issue's own title/owner/due.
{
  const criticalMilestones = [milestone({ id: "gate-3", slug: "gate-3", gate: "TRL6" })];
  const linkedIssue = issue({
    id: "issue-2", title: "論点B", ownerLabel: "論点担当", dueDate: "2026-12-01", relatedMilestoneSlugs: ["gate-3"],
    decisions: [{ id: "d-1", issueId: "issue-2", actionItems: [{ id: "a-1", title: "追加サンプル調達", status: "blocked", dueDate: "2026-07-05", ownerLabel: "調達担当" }] }],
  });
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["gate-3"],
    milestones: criticalMilestones,
    partnerWorkItems: [],
    partners: [],
    issues: [linkedIssue],
  });
  const row = queue.rows.find((r) => r.kind === "action_item");
  assert.ok(row);
  assert.equal(row.target, "追加サンプル調達");
  assert.equal(row.ballOwner, "調達担当");
  assert.equal(row.dueDate, "2026-07-05");
  assert.notEqual(row.target, "論点B");
  assert.notEqual(row.ballOwner, "論点担当");
}

// 6. Partner work item: `item.side` + `item.ownerLabel` are the primary ball source regardless of
// sx/partner/shared/unknown — SX-side work items ARE surfaced, not hidden.
{
  const criticalMilestones = [milestone({ id: "m-sx-side", slug: "m-sx-side" })];
  const partner = { id: "p2", slug: "p2", name: "パートナーP2", currentBallSide: "sx", currentBallOwner: "担当B", relatedMilestoneSlugs: ["m-sx-side"], nextCommitment: null, dueDate: null };
  const workItem = { id: "wi-2", partnerId: "p2", side: "sx", title: "社内確認待ち", ownerLabel: "社内担当D", status: "blocked", dueDate: "2026-07-20", relatedMilestoneId: "m-sx-side" };
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["m-sx-side"],
    milestones: criticalMilestones,
    partnerWorkItems: [workItem],
    partners: [partner],
    issues: [],
  });
  const row = queue.rows.find((r) => r.kind === "partner_work_item");
  assert.ok(row, "SX-side partner work item must be shown, not hidden");
  assert.equal(row.ballSide, "SX側");
  assert.equal(row.ballOwner, "社内担当D");
  assert.ok(row.target.includes("パートナーP2"));
  assert.ok(row.target.includes("社内確認待ち"));
  assert.equal(row.entityId, "p2");
  assert.equal(row.anchor, "#sx-partner-p2");
}

// 6b. Partner work item held on the partner side: exact partner.name + item title, real partnerId.
{
  const criticalMilestones = [milestone({ id: "m-partner", slug: "m-partner", title: "相手先ゲート" })];
  const partner = { id: "partner-1", slug: "partner-1", name: "パートナーX", currentBallSide: "partner", currentBallOwner: "まさ", relatedMilestoneSlugs: ["m-partner"], nextCommitment: null, dueDate: null };
  const workItem = { id: "wi-1", partnerId: "partner-1", side: "partner", title: "先方レビューを待つ", ownerLabel: "まさ", status: "waiting", dueDate: "2026-07-20", relatedMilestoneId: "m-partner" };
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["m-partner"],
    milestones: criticalMilestones,
    partnerWorkItems: [workItem],
    partners: [partner],
    issues: [],
  });
  const row = queue.rows.find((item) => item.kind === "partner_work_item");
  assert.ok(row, "expected a partner_work_item row");
  assert.equal(row.ballSide, "相手側");
  assert.equal(row.ballOwner, "山地正洋"); // まさ normalized to real name on the external-visible surface
  assert.ok(row.target.includes("パートナーX"));
  assert.equal(row.entityId, "partner-1");
}

// 6c. Critical-linked partner fallback: no relatedMilestoneId on any work item, but partner's
// relatedMilestoneSlugs intersect the critical path, ball is partner-side, active nextCommitment.
{
  const criticalMilestones = [milestone({ id: "m-fallback", slug: "m-fallback", gate: "TRL7" })];
  const partner = {
    id: "partner-2", slug: "partner-2", name: "フォールバック先", currentBallSide: "partner", currentBallOwner: "先方担当",
    relatedMilestoneSlugs: ["m-fallback"], nextCommitment: "サンプル納品", dueDate: "2026-07-10",
  };
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["m-fallback"],
    milestones: criticalMilestones,
    partnerWorkItems: [],
    partners: [partner],
    issues: [],
  });
  const row = queue.rows.find((r) => r.kind === "partner_fallback");
  assert.ok(row);
  assert.ok(row.target.includes("フォールバック先"));
  assert.equal(row.ballOwner, "先方担当");
  assert.equal(row.dueDate, "2026-07-10");
}

// 7. Upcoming-action queue: windows + sort (overdue first, then critical-linked, then blocked, due, label).
{
  const criticalMilestones = [milestone({ id: "gate-u", slug: "gate-u", gate: "TRL8" })];
  const linkedIssue = issue({ id: "issue-u", relatedMilestoneSlugs: ["gate-u"] });
  const upcoming = deriveSxUpcomingQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["gate-u"],
    milestones: criticalMilestones,
    actions: [
      { id: "a-overdue", title: "遅延アクション", ownerLabel: "担当X", dueDate: "2026-07-01", status: "open", issueId: "issue-u" },
      { id: "a-soon", title: "近日アクション", ownerLabel: "担当Y", dueDate: "2026-07-28", status: "open", issueId: null },
      { id: "a-unset", title: "期限未設定アクション", ownerLabel: "担当Z", dueDate: null, status: "open", issueId: null },
    ],
    decisions: [],
    validationRuns: [],
    issues: [linkedIssue],
    maxRows: 3,
  });
  assert.deepEqual(upcoming.rows.map((row) => row.window), ["overdue", "within_7", "unset"]);
  assert.equal(upcoming.rows[0].label, "遅延アクション");
  assert.equal(upcoming.rows[0].criticalLinked, true);
  assert.equal(upcoming.rows[0].gate, "TRL8");
}

// 7b. Upcoming queue dedupes against items already shown in the intervention queue via excludeKeys.
{
  const criticalMilestones = [milestone({ id: "gate-d", slug: "gate-d" })];
  const linkedIssue = issue({
    id: "issue-d", relatedMilestoneSlugs: ["gate-d"],
    decisions: [{ id: "d-2", issueId: "issue-d", actionItems: [{ id: "a-dup", title: "重複アクション", status: "blocked", dueDate: "2026-07-01", ownerLabel: "担当W" }] }],
  });
  const interventionQueue = deriveSxInterventionQueue({
    today: "2026-07-24", criticalPathSlugs: ["gate-d"], milestones: criticalMilestones,
    partnerWorkItems: [], partners: [], issues: [linkedIssue],
  });
  const excludeKeys = new Set(interventionQueue.rows.filter((r) => r.kind === "action_item").map((r) => r.key));
  assert.ok(excludeKeys.has("action-a-dup"));
  const upcoming = deriveSxUpcomingQueue({
    today: "2026-07-24", criticalPathSlugs: ["gate-d"], milestones: criticalMilestones,
    actions: [{ id: "a-dup", title: "重複アクション", ownerLabel: "担当W", dueDate: "2026-07-01", status: "open", issueId: "issue-d" }],
    decisions: [], validationRuns: [], issues: [linkedIssue], excludeKeys,
  });
  assert.equal(upcoming.rows.some((row) => row.dedupeKey === "action-a-dup"), false);
}

// 8. Verdict display mapping: exact オンスケ/要注意/危険/判定不能 text, unassessed never maps to green.
{
  assert.equal(sxVerdictDisplayLabel("on_track"), "オンスケ");
  assert.equal(sxVerdictDisplayLabel("attention"), "要注意");
  assert.equal(sxVerdictDisplayLabel("crisis"), "危険");
  assert.equal(sxVerdictDisplayLabel("unassessed"), "判定不能");
  assert.notEqual(sxVerdictDisplayLabel("unassessed"), "オンスケ");
}

// 9. Provisional false-green (case A): non-completed node with dateCertainty=provisional never
// resolves to current/future(green) — it must render amber "attention".
{
  const milestones = [milestone({ id: "p1", slug: "p1", status: "on_track", dateCertainty: "provisional", plannedEnd: "2026-09-01", forecastEnd: "2026-09-01" })];
  const rail = deriveSxCriticalPathRail({ dagValid: true, criticalPathSlugs: ["p1"] }, milestones);
  assert.equal(rail.nodes[0].state, "attention");
  assert.notEqual(rail.nodes[0].state, "current");
  assert.notEqual(rail.nodes[0].state, "future");
}

// 9b. Provisional false-green (case B): non-completed node missing both planned and forecast dates
// never resolves to current/future(green) — it must render gray "unassessed".
{
  const milestones = [milestone({ id: "p2", slug: "p2", status: "on_track", dateCertainty: "confirmed", plannedEnd: null, forecastEnd: null })];
  const rail = deriveSxCriticalPathRail({ dagValid: true, criticalPathSlugs: ["p2"] }, milestones);
  assert.equal(rail.nodes[0].state, "unassessed");
  assert.notEqual(rail.nodes[0].state, "current");
  assert.notEqual(rail.nodes[0].state, "future");
}

// 10. Completed partner work item is excluded from the queue and never suppresses the fallback via
// directlyLinkedPartnerIds — only an active, qualifying work item may suppress it.
{
  const criticalMilestones = [milestone({ id: "m-completed", slug: "m-completed", gate: "TRL9" })];
  const partner = {
    id: "partner-3", slug: "partner-3", name: "完了済み相手先", currentBallSide: "partner", currentBallOwner: "先方担当2",
    relatedMilestoneSlugs: ["m-completed"], nextCommitment: "追加検体の送付", dueDate: "2026-07-01",
  };
  const completedWorkItem = {
    id: "wi-completed", partnerId: "partner-3", side: "partner", title: "旧レビュー", ownerLabel: "先方担当2",
    status: "completed", dueDate: "2026-06-01", relatedMilestoneId: "m-completed",
  };
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["m-completed"],
    milestones: criticalMilestones,
    partnerWorkItems: [completedWorkItem],
    partners: [partner],
    issues: [],
  });
  assert.equal(queue.rows.some((row) => row.kind === "partner_work_item"), false, "completed work item must never surface as an intervention");
  const fallback = queue.rows.find((row) => row.kind === "partner_fallback");
  assert.ok(fallback, "a completed work item must not suppress the partner fallback");
  assert.ok(fallback.target.includes("完了済み相手先"));
}

// 11. SMBC-shaped case: side=sx, owner=石原先生, no relatedMilestoneId on the work item, partner
// linked to a funding-critical milestone via relatedMilestoneSlugs, nextCommitment contains a
// handoff phrase ("まさへ引き継ぎ"). The sx-side fallback must surface with owner 石原先生, and the
// displayed target must be real-name-normalized (owner) / nominalized (next-action clause).
{
  const criticalMilestones = [milestone({ id: "m-smbc", slug: "m-smbc", gate: "資金調達" })];
  const partner = {
    id: "partner-smbc", slug: "smbc", name: "SMBC", currentBallSide: "sx", currentBallOwner: "石原先生",
    relatedMilestoneSlugs: ["m-smbc"], nextCommitment: "口座開設資料を整理し、まさへ引き継ぎ", dueDate: "2026-08-01",
  };
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["m-smbc"],
    milestones: criticalMilestones,
    partnerWorkItems: [], // no relatedMilestoneId on any work item for this partner
    partners: [partner],
    issues: [],
  });
  const row = queue.rows.find((r) => r.kind === "partner_fallback");
  assert.ok(row, "sx-side ball must still produce a fallback intervention row");
  assert.equal(row.ballSide, "SX側");
  assert.equal(row.ballOwner, "石原先生");
  assert.ok(row.target.includes("SMBC"));
  assert.ok(row.target.includes("山地正洋"), "まさ must be normalized to the real name on this external-visible surface");
  assert.ok(!row.target.includes("まさへ"), "the raw code-name phrase must not leak through unnormalized");
}

// 12. Month-precision date formatting never fabricates a day; day-precision keeps the exact date;
// unknown-precision never fabricates a date at all.
{
  assert.equal(sxEcdFormatDueDate("2026-09-15", "day"), "2026/9/15");
  assert.equal(sxEcdFormatDueDate("2026-09-15", "month"), "2026年9月");
  assert.equal(sxEcdFormatDueDate("2026-09-15", "unknown"), "未確認");
  assert.equal(sxEcdFormatDueDate(null, "day"), "未確認");
  // No precision supplied at all (older caller) falls back to plain day-format, never fabricating.
  assert.equal(sxEcdFormatDueDate("2026-09-15"), "2026/9/15");
}

// 13. dueDatePrecision is carried through onto partner_work_item / partner_fallback rows so the
// component never renders a month-only seed value as if it were day-certain.
{
  const criticalMilestones = [milestone({ id: "m-precision", slug: "m-precision" })];
  const partner = {
    id: "partner-precision", slug: "partner-precision", name: "精度先", currentBallSide: "partner", currentBallOwner: "先方担当3",
    relatedMilestoneSlugs: ["m-precision"], nextCommitment: "見積を確認する", dueDate: "2026-08-01", dueDatePrecision: "month",
  };
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["m-precision"],
    milestones: criticalMilestones,
    partnerWorkItems: [],
    partners: [partner],
    issues: [],
  });
  const row = queue.rows.find((r) => r.kind === "partner_fallback");
  assert.ok(row);
  assert.equal(row.dueDatePrecision, "month");
}

// 14. sxEcdIsDueDateOverdue: precision-aware overdue check.
{
  // "day" precision: overdue iff the exact date is strictly before today.
  assert.equal(sxEcdIsDueDateOverdue("2026-07-23", "day", "2026-07-24"), true);
  assert.equal(sxEcdIsDueDateOverdue("2026-07-24", "day", "2026-07-24"), false);
  assert.equal(sxEcdIsDueDateOverdue("2026-07-25", "day", "2026-07-24"), false);

  // "month" precision: a day-1 placeholder within the current due month is NOT overdue.
  assert.equal(sxEcdIsDueDateOverdue("2026-07-01", "month", "2026-07-24"), false);
  // A month-precision due date whose month has already fully passed IS overdue.
  assert.equal(sxEcdIsDueDateOverdue("2026-06-01", "month", "2026-07-24"), true);
  // Future month is not overdue.
  assert.equal(sxEcdIsDueDateOverdue("2026-08-01", "month", "2026-07-24"), false);

  // "unknown" precision and null dates are never overdue.
  assert.equal(sxEcdIsDueDateOverdue("2026-01-01", "unknown", "2026-07-24"), false);
  assert.equal(sxEcdIsDueDateOverdue(null, "day", "2026-07-24"), false);
  assert.equal(sxEcdIsDueDateOverdue(null, undefined, "2026-07-24"), false);

  // No precision supplied at all falls back to plain day-comparison (older caller shape).
  assert.equal(sxEcdIsDueDateOverdue("2026-07-23", undefined, "2026-07-24"), true);
}

// 15. Partner work item / partner fallback qualification uses precision-aware overdue, not raw
// string comparison: a month-precision due date placeholder within the current month must not
// make an otherwise non-blocked/non-waiting work item qualify as an intervention.
{
  const criticalMilestones = [milestone({ id: "m-month", slug: "m-month" })];
  const sameMonthItem = {
    id: "wi-same-month", partnerId: "partner-month", side: "partner", title: "見積提示",
    ownerLabel: "先方担当", status: "open", dueDate: "2026-07-01", dueDatePrecision: "month",
    relatedMilestoneId: "m-month",
  };
  const queueSameMonth = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["m-month"],
    milestones: criticalMilestones,
    partnerWorkItems: [sameMonthItem],
    partners: [],
    issues: [],
  });
  assert.equal(queueSameMonth.rows.some((r) => r.kind === "partner_work_item"), false);

  const priorMonthItem = { ...sameMonthItem, id: "wi-prior-month", dueDate: "2026-06-01" };
  const queuePriorMonth = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["m-month"],
    milestones: criticalMilestones,
    partnerWorkItems: [priorMonthItem],
    partners: [],
    issues: [],
  });
  const priorRow = queuePriorMonth.rows.find((r) => r.kind === "partner_work_item");
  assert.ok(priorRow);
}

console.log("test_sx_executive_control_deck.mjs: all assertions passed");
