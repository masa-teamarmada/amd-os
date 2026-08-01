import assert from "node:assert/strict";
import {
  applySxInterventionPillarQuota,
  sxEcdClassifySlip,
  deriveSxCriticalPathRail,
  deriveSxInterventionQueue,
  deriveSxStateMap,
  deriveSxUnifiedTimeline,
  deriveSxUpcomingQueue,
  deriveSxVerdictSummary,
  sxVerdictDisplayLabel,
  sxEcdFormatDueDate,
  sxEcdIsDueDateOverdue,
} from "../src/lib/sx-executive-control-deck.ts";

function milestone(overrides = {}) {
  return {
    id: "m-1",
    slug: "m-1",
    title: "テストゲート",
    gate: "ゲートA",
    status: "on_track",
    isBlocked: false,
    isOverdue: false,
    isStale: false,
    plannedEnd: "2026-08-01",
    forecastEnd: "2026-08-01",
    deltaDays: 0,
    dateCertainty: "confirmed",
    ownerLabel: "担当A",
    confidence: "high",
    criticality: "critical",
    ...overrides,
  };
}

function issue(overrides = {}) {
  return {
    id: "i-1",
    slug: "i-1",
    title: "論点A",
    status: "open",
    ownerLabel: "担当A",
    dueDate: null,
    relatedMilestoneSlugs: [],
    validationRuns: [],
    decisions: [],
    ...overrides,
  };
}

// 1. DAG invalid -> explicit 依存関係不正, never invents a path.
{
  const rail = deriveSxCriticalPathRail(
    { dagValid: false, criticalPathSlugs: ["a", "b"] },
    [milestone({ slug: "a" }), milestone({ slug: "b" })],
  );
  assert.equal(rail.valid, false);
  assert.equal(rail.reason, "依存関係不正");
  assert.deepEqual(rail.nodes, []);
}

// 1b. DAG valid but no critical path registered -> explicit 重要経路未登録.
{
  const rail = deriveSxCriticalPathRail(
    { dagValid: true, criticalPathSlugs: [] },
    [milestone()],
  );
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
  const rail = deriveSxCriticalPathRail(
    { dagValid: true, criticalPathSlugs: ["a", "b", "c", "d"] },
    milestones,
  );
  assert.equal(rail.valid, true);
  assert.deepEqual(
    rail.nodes.map((node) => node.state),
    ["complete", "complete", "current", "future"],
  );
  assert.equal(rail.currentIndex, 2);
  assert.equal(rail.nodes[2].isCurrent, true);
  assert.equal(rail.nodes[0].isCurrent, false);
}

// 2b. All milestones complete -> no current node, all complete.
{
  const milestones = [
    milestone({ id: "1", slug: "a", status: "completed" }),
    milestone({ id: "2", slug: "b", status: "completed" }),
  ];
  const rail = deriveSxCriticalPathRail(
    { dagValid: true, criticalPathSlugs: ["a", "b"] },
    milestones,
  );
  assert.deepEqual(
    rail.nodes.map((node) => node.state),
    ["complete", "complete"],
  );
  assert.equal(rail.currentIndex, 2);
}

// 2c. Missing milestone for a critical-path slug -> unassessed node, not invented.
{
  const milestones = [milestone({ id: "1", slug: "a", status: "completed" })];
  const rail = deriveSxCriticalPathRail(
    { dagValid: true, criticalPathSlugs: ["a", "missing-slug"] },
    milestones,
  );
  assert.equal(rail.nodes[1].state, "unassessed");
  assert.equal(rail.nodes[1].milestoneId, null);
  assert.equal(rail.nodes[1].title, "missing-slug");
}

// 2d. False-green states: overdue/blocked/unassessed/attention never render as current/future(green).
{
  const milestones = [
    milestone({ id: "1", slug: "a", status: "on_track", isOverdue: true }),
    milestone({ id: "2", slug: "b", status: "blocked", isBlocked: true }),
    milestone({
      id: "3",
      slug: "c",
      status: "unassessed",
      confidence: "unknown",
    }),
    milestone({ id: "4", slug: "d", status: "attention" }),
    milestone({ id: "5", slug: "e", status: "on_track", isStale: true }),
  ];
  const rail = deriveSxCriticalPathRail(
    { dagValid: true, criticalPathSlugs: ["a", "b", "c", "d", "e"] },
    milestones,
  );
  assert.deepEqual(
    rail.nodes.map((node) => node.state),
    ["overdue", "blocked", "unassessed", "attention", "unassessed"],
  );
  assert.ok(
    !rail.nodes.some(
      (node) => node.state === "current" || node.state === "future",
    ),
  );
}

// 2e. Node dates keep 予定(plannedEnd) and 予測(forecastEnd) distinct, plus delta.
{
  const milestones = [
    milestone({
      id: "1",
      slug: "a",
      plannedEnd: "2026-08-01",
      forecastEnd: "2026-08-10",
      deltaDays: 9,
    }),
  ];
  const rail = deriveSxCriticalPathRail(
    { dagValid: true, criticalPathSlugs: ["a"] },
    milestones,
  );
  assert.equal(rail.nodes[0].plannedEnd, "2026-08-01");
  assert.equal(rail.nodes[0].forecastEnd, "2026-08-10");
  assert.equal(rail.nodes[0].deltaDays, 9);
}

// 2f. Visible window: at most previous completed + current + next up to 3, plus final endpoint,
// with a leading "+N完了" marker and trailing "…N" marker when the final isn't already inside the window.
{
  const milestones = ["a", "b", "c", "d", "e", "f", "g", "h"].map(
    (slug, index) =>
      milestone({
        id: slug,
        slug,
        status: index <= 2 ? "completed" : "on_track",
      }),
  );
  const rail = deriveSxCriticalPathRail(
    {
      dagValid: true,
      criticalPathSlugs: ["a", "b", "c", "d", "e", "f", "g", "h"],
    },
    milestones,
  );
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
  const milestones = Array.from({ length: 10 }, (_, index) =>
    milestone({
      id: `s${index}`,
      slug: `s${index}`,
      status: "on_track",
      title: `G${index}`,
    }),
  );
  const rail = deriveSxCriticalPathRail(
    { dagValid: true, criticalPathSlugs: milestones.map((m) => m.slug) },
    milestones,
  );
  const visibleSlugs = rail.visibleNodes.map((node) => node.slug);
  assert.equal(visibleSlugs[visibleSlugs.length - 1], "s9"); // final always appended
  assert.ok(rail.trailingMarker && rail.trailingMarker.count > 0);
}

// 3. Stable blocker priority in the intervention queue: critical-path blocked outranks overdue,
// which outranks owner-unconfirmed. Ties broken by due date then label.
{
  const criticalMilestones = [
    milestone({
      id: "blocked-1",
      slug: "blocked-1",
      isBlocked: true,
      plannedEnd: "2026-08-10",
      title: "Bゲート停止",
      gate: "B",
    }),
    milestone({
      id: "overdue-1",
      slug: "overdue-1",
      isOverdue: true,
      plannedEnd: "2026-07-01",
      title: "Aゲート遅延",
      gate: "A",
    }),
    milestone({
      id: "owner-missing",
      slug: "owner-missing",
      ownerLabel: "未確認",
      plannedEnd: "2026-09-01",
      title: "担当未確認ゲート",
      gate: "C",
    }),
  ];
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["blocked-1", "overdue-1", "owner-missing"],
    milestones: criticalMilestones,
    partnerWorkItems: [],
    partners: [],
    issues: [],
  });
  assert.deepEqual(
    queue.rows.map((row) => row.kind),
    ["critical_blocked", "critical_overdue", "owner_unconfirmed"],
  );
  assert.equal(queue.rows[0].target, "Bゲート停止");
}

// 3b. Stable tie-break: same priority, sorted by due date then label.
{
  const criticalMilestones = [
    milestone({
      id: "z",
      slug: "z",
      isBlocked: true,
      plannedEnd: "2026-08-01",
      title: "Zゲート",
    }),
    milestone({
      id: "a",
      slug: "a",
      isBlocked: true,
      plannedEnd: "2026-08-01",
      title: "Aゲート",
    }),
  ];
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["z", "a"],
    milestones: criticalMilestones,
    partnerWorkItems: [],
    partners: [],
    issues: [],
  });
  assert.deepEqual(
    queue.rows.map((row) => row.target),
    ["Aゲート", "Zゲート"],
  );
}

// 4. No unknown => on-schedule claim: an unassessed critical milestone with a KNOWN owner never
// silently disappears, and never collapses into owner_unconfirmed just because it's unassessed —
// the owner is preserved and the kind is the distinct "gate_unassessed".
{
  const criticalMilestones = [
    milestone({
      id: "u",
      slug: "u",
      status: "unassessed",
      confidence: "unknown",
      plannedEnd: null,
      forecastEnd: "2026-09-10",
      ownerLabel: "担当B",
      dateCertainty: "provisional",
      title: "未評価ゲート",
    }),
  ];
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
  const criticalMilestones = [
    milestone({
      id: "s",
      slug: "s",
      status: "on_track",
      confidence: "high",
      isStale: true,
      ownerLabel: "担当C",
      title: "鮮度切れゲート",
    }),
  ];
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
  const criticalMilestones = [
    milestone({
      id: "o",
      slug: "o",
      status: "unassessed",
      isStale: true,
      ownerLabel: "未確認",
      title: "担当不明ゲート",
    }),
  ];
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
  const criticalMilestones = [
    milestone({
      id: "internal",
      slug: "internal",
      isBlocked: true,
      ownerLabel: "",
      title: "内部停止ゲート",
    }),
  ];
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
  const criticalMilestones = [
    milestone({
      id: "gate-1",
      slug: "gate-1",
      plannedEnd: "2026-08-01",
      forecastEnd: "2026-08-05",
      gate: "TRL4",
      dateCertainty: "provisional",
    }),
  ];
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["gate-1"],
    milestones: criticalMilestones,
    technicalTests: [
      {
        id: "t-1",
        milestoneId: "gate-1",
        testName: "耐久試験",
        status: "failed",
        ownerLabel: "研究者A",
      },
      {
        id: "t-2",
        milestoneId: "gate-1",
        testName: "評価未着手試験",
        status: "unassessed",
        ownerLabel: "研究者B",
      },
    ],
    partnerWorkItems: [],
    partners: [],
    issues: [],
  });
  const blockedTest = queue.rows.find(
    (row) => row.kind === "technical_test_blocked",
  );
  assert.ok(blockedTest);
  assert.equal(blockedTest.target, "耐久試験");
  assert.equal(blockedTest.ballOwner, "研究者A");
  assert.equal(blockedTest.dueDate, "2026-08-05");
  assert.equal(blockedTest.dueContextLabel, "親ゲート期限");
  assert.equal(blockedTest.milestoneId, "gate-1");
  assert.equal(blockedTest.priority, 1);
  // Parent gate's dateCertainty must be carried through to the test row (previously dropped).
  assert.equal(blockedTest.dateCertainty, "provisional");
  const unassessedTest = queue.rows.find(
    (row) => row.kind === "technical_test_unassessed",
  );
  assert.ok(unassessedTest);
  assert.ok(unassessedTest.priority > blockedTest.priority);
  assert.equal(unassessedTest.dateCertainty, "provisional");
}

// 5c. Validation runs derived individually from critical-linked issues: exact method/owner/due/gate/issueId.
{
  const criticalMilestones = [
    milestone({ id: "gate-2", slug: "gate-2", gate: "TRL5" }),
  ];
  const linkedIssue = issue({
    id: "issue-1",
    relatedMilestoneSlugs: ["gate-2"],
    validationRuns: [
      {
        id: "v-1",
        method: "耐熱サイクル試験",
        status: "blocked",
        dueDate: "2026-07-10",
        ownerLabel: "研究者C",
      },
    ],
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
  const criticalMilestones = [
    milestone({ id: "gate-3", slug: "gate-3", gate: "TRL6" }),
  ];
  const linkedIssue = issue({
    id: "issue-2",
    title: "論点B",
    ownerLabel: "論点担当",
    dueDate: "2026-12-01",
    relatedMilestoneSlugs: ["gate-3"],
    decisions: [
      {
        id: "d-1",
        issueId: "issue-2",
        actionItems: [
          {
            id: "a-1",
            title: "追加サンプル調達",
            status: "blocked",
            dueDate: "2026-07-05",
            ownerLabel: "調達担当",
          },
        ],
      },
    ],
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
  const criticalMilestones = [
    milestone({ id: "m-sx-side", slug: "m-sx-side" }),
  ];
  const partner = {
    id: "p2",
    slug: "p2",
    name: "パートナーP2",
    currentBallSide: "sx",
    currentBallOwner: "担当B",
    relatedMilestoneSlugs: ["m-sx-side"],
    nextCommitment: null,
    dueDate: null,
  };
  const workItem = {
    id: "wi-2",
    partnerId: "p2",
    side: "sx",
    title: "社内確認待ち",
    ownerLabel: "社内担当D",
    status: "blocked",
    dueDate: "2026-07-20",
    relatedMilestoneId: "m-sx-side",
  };
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
  const criticalMilestones = [
    milestone({ id: "m-partner", slug: "m-partner", title: "相手先ゲート" }),
  ];
  const partner = {
    id: "partner-1",
    slug: "partner-1",
    name: "パートナーX",
    currentBallSide: "partner",
    currentBallOwner: "まさ",
    relatedMilestoneSlugs: ["m-partner"],
    nextCommitment: null,
    dueDate: null,
  };
  const workItem = {
    id: "wi-1",
    partnerId: "partner-1",
    side: "partner",
    title: "先方レビューを待つ",
    ownerLabel: "まさ",
    status: "waiting",
    dueDate: "2026-07-20",
    relatedMilestoneId: "m-partner",
  };
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
  assert.equal(row.ballOwner, "山地"); // まさ normalized to real name on the external-visible surface
  assert.ok(row.target.includes("パートナーX"));
  assert.equal(row.entityId, "partner-1");
}

// 6c. Critical-linked partner fallback: no relatedMilestoneId on any work item, but partner's
// relatedMilestoneSlugs intersect the critical path, ball is partner-side, active nextCommitment.
{
  const criticalMilestones = [
    milestone({ id: "m-fallback", slug: "m-fallback", gate: "TRL7" }),
  ];
  const partner = {
    id: "partner-2",
    slug: "partner-2",
    name: "フォールバック先",
    currentBallSide: "partner",
    currentBallOwner: "先方担当",
    relatedMilestoneSlugs: ["m-fallback"],
    nextCommitment: "サンプル納品",
    dueDate: "2026-07-10",
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
  const criticalMilestones = [
    milestone({ id: "gate-u", slug: "gate-u", gate: "TRL8" }),
  ];
  const linkedIssue = issue({
    id: "issue-u",
    relatedMilestoneSlugs: ["gate-u"],
  });
  const upcoming = deriveSxUpcomingQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["gate-u"],
    milestones: criticalMilestones,
    actions: [
      {
        id: "a-overdue",
        title: "遅延アクション",
        ownerLabel: "担当X",
        dueDate: "2026-07-01",
        status: "open",
        issueId: "issue-u",
      },
      {
        id: "a-soon",
        title: "近日アクション",
        ownerLabel: "担当Y",
        dueDate: "2026-07-28",
        status: "open",
        issueId: null,
      },
      {
        id: "a-unset",
        title: "期限未設定アクション",
        ownerLabel: "担当Z",
        dueDate: null,
        status: "open",
        issueId: null,
      },
    ],
    decisions: [],
    validationRuns: [],
    issues: [linkedIssue],
    maxRows: 3,
  });
  assert.deepEqual(
    upcoming.rows.map((row) => row.window),
    ["overdue", "within_7", "unset"],
  );
  assert.equal(upcoming.rows[0].label, "遅延アクション");
  assert.equal(upcoming.rows[0].criticalLinked, true);
  assert.equal(upcoming.rows[0].gate, "TRL8");
}

// 7b. Upcoming queue dedupes against items already shown in the intervention queue via excludeKeys.
{
  const criticalMilestones = [milestone({ id: "gate-d", slug: "gate-d" })];
  const linkedIssue = issue({
    id: "issue-d",
    relatedMilestoneSlugs: ["gate-d"],
    decisions: [
      {
        id: "d-2",
        issueId: "issue-d",
        actionItems: [
          {
            id: "a-dup",
            title: "重複アクション",
            status: "blocked",
            dueDate: "2026-07-01",
            ownerLabel: "担当W",
          },
        ],
      },
    ],
  });
  const interventionQueue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["gate-d"],
    milestones: criticalMilestones,
    partnerWorkItems: [],
    partners: [],
    issues: [linkedIssue],
  });
  const excludeKeys = new Set(
    interventionQueue.rows
      .filter((r) => r.kind === "action_item")
      .map((r) => r.key),
  );
  assert.ok(excludeKeys.has("action-a-dup"));
  const upcoming = deriveSxUpcomingQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["gate-d"],
    milestones: criticalMilestones,
    actions: [
      {
        id: "a-dup",
        title: "重複アクション",
        ownerLabel: "担当W",
        dueDate: "2026-07-01",
        status: "open",
        issueId: "issue-d",
      },
    ],
    decisions: [],
    validationRuns: [],
    issues: [linkedIssue],
    excludeKeys,
  });
  assert.equal(
    upcoming.rows.some((row) => row.dedupeKey === "action-a-dup"),
    false,
  );
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
  const milestones = [
    milestone({
      id: "p1",
      slug: "p1",
      status: "on_track",
      dateCertainty: "provisional",
      plannedEnd: "2026-09-01",
      forecastEnd: "2026-09-01",
    }),
  ];
  const rail = deriveSxCriticalPathRail(
    { dagValid: true, criticalPathSlugs: ["p1"] },
    milestones,
  );
  assert.equal(rail.nodes[0].state, "attention");
  assert.notEqual(rail.nodes[0].state, "current");
  assert.notEqual(rail.nodes[0].state, "future");
}

// 9b. Provisional false-green (case B): non-completed node missing both planned and forecast dates
// never resolves to current/future(green) — it must render gray "unassessed".
{
  const milestones = [
    milestone({
      id: "p2",
      slug: "p2",
      status: "on_track",
      dateCertainty: "confirmed",
      plannedEnd: null,
      forecastEnd: null,
    }),
  ];
  const rail = deriveSxCriticalPathRail(
    { dagValid: true, criticalPathSlugs: ["p2"] },
    milestones,
  );
  assert.equal(rail.nodes[0].state, "unassessed");
  assert.notEqual(rail.nodes[0].state, "current");
  assert.notEqual(rail.nodes[0].state, "future");
}

// 10. Completed partner work item is excluded from the queue and never suppresses the fallback via
// directlyLinkedPartnerIds — only an active, qualifying work item may suppress it.
{
  const criticalMilestones = [
    milestone({ id: "m-completed", slug: "m-completed", gate: "TRL9" }),
  ];
  const partner = {
    id: "partner-3",
    slug: "partner-3",
    name: "完了済み相手先",
    currentBallSide: "partner",
    currentBallOwner: "先方担当2",
    relatedMilestoneSlugs: ["m-completed"],
    nextCommitment: "追加検体の送付",
    dueDate: "2026-07-01",
  };
  const completedWorkItem = {
    id: "wi-completed",
    partnerId: "partner-3",
    side: "partner",
    title: "旧レビュー",
    ownerLabel: "先方担当2",
    status: "completed",
    dueDate: "2026-06-01",
    relatedMilestoneId: "m-completed",
  };
  const queue = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["m-completed"],
    milestones: criticalMilestones,
    partnerWorkItems: [completedWorkItem],
    partners: [partner],
    issues: [],
  });
  assert.equal(
    queue.rows.some((row) => row.kind === "partner_work_item"),
    false,
    "completed work item must never surface as an intervention",
  );
  const fallback = queue.rows.find((row) => row.kind === "partner_fallback");
  assert.ok(
    fallback,
    "a completed work item must not suppress the partner fallback",
  );
  assert.ok(fallback.target.includes("完了済み相手先"));
}

// 11. SMBC-shaped case: side=sx, owner=石原先生, no relatedMilestoneId on the work item, partner
// linked to a funding-critical milestone via relatedMilestoneSlugs, nextCommitment contains a
// handoff phrase ("まさへ引き継ぎ"). The sx-side fallback must surface with owner 石原先生, and the
// displayed target must be real-name-normalized (owner) / nominalized (next-action clause).
{
  const criticalMilestones = [
    milestone({ id: "m-smbc", slug: "m-smbc", gate: "資金調達" }),
  ];
  const partner = {
    id: "partner-smbc",
    slug: "smbc",
    name: "SMBC",
    currentBallSide: "sx",
    currentBallOwner: "石原先生",
    relatedMilestoneSlugs: ["m-smbc"],
    nextCommitment: "口座開設資料を整理し、まさへ引き継ぎ",
    dueDate: "2026-08-01",
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
  assert.ok(
    row.target.includes("山地"),
    "まさ must be normalized to the real name on this external-visible surface",
  );
  assert.ok(
    !row.target.includes("まさへ"),
    "the raw code-name phrase must not leak through unnormalized",
  );
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
  const criticalMilestones = [
    milestone({ id: "m-precision", slug: "m-precision" }),
  ];
  const partner = {
    id: "partner-precision",
    slug: "partner-precision",
    name: "精度先",
    currentBallSide: "partner",
    currentBallOwner: "先方担当3",
    relatedMilestoneSlugs: ["m-precision"],
    nextCommitment: "見積を確認する",
    dueDate: "2026-08-01",
    dueDatePrecision: "month",
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
  assert.equal(
    sxEcdIsDueDateOverdue("2026-07-01", "month", "2026-07-24"),
    false,
  );
  // A month-precision due date whose month has already fully passed IS overdue.
  assert.equal(
    sxEcdIsDueDateOverdue("2026-06-01", "month", "2026-07-24"),
    true,
  );
  // Future month is not overdue.
  assert.equal(
    sxEcdIsDueDateOverdue("2026-08-01", "month", "2026-07-24"),
    false,
  );

  // "unknown" precision and null dates are never overdue.
  assert.equal(
    sxEcdIsDueDateOverdue("2026-01-01", "unknown", "2026-07-24"),
    false,
  );
  assert.equal(sxEcdIsDueDateOverdue(null, "day", "2026-07-24"), false);
  assert.equal(sxEcdIsDueDateOverdue(null, undefined, "2026-07-24"), false);

  // No precision supplied at all falls back to plain day-comparison (older caller shape).
  assert.equal(
    sxEcdIsDueDateOverdue("2026-07-23", undefined, "2026-07-24"),
    true,
  );
}

// 15. Partner work item / partner fallback qualification uses precision-aware overdue, not raw
// string comparison: a month-precision due date placeholder within the current month must not
// make an otherwise non-blocked/non-waiting work item qualify as an intervention.
{
  const criticalMilestones = [milestone({ id: "m-month", slug: "m-month" })];
  const sameMonthItem = {
    id: "wi-same-month",
    partnerId: "partner-month",
    side: "partner",
    title: "見積提示",
    ownerLabel: "先方担当",
    status: "open",
    dueDate: "2026-07-01",
    dueDatePrecision: "month",
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
  assert.equal(
    queueSameMonth.rows.some((r) => r.kind === "partner_work_item"),
    false,
  );

  const priorMonthItem = {
    ...sameMonthItem,
    id: "wi-prior-month",
    dueDate: "2026-06-01",
  };
  const queuePriorMonth = deriveSxInterventionQueue({
    today: "2026-07-24",
    criticalPathSlugs: ["m-month"],
    milestones: criticalMilestones,
    partnerWorkItems: [priorMonthItem],
    partners: [],
    issues: [],
  });
  const priorRow = queuePriorMonth.rows.find(
    (r) => r.kind === "partner_work_item",
  );
  assert.ok(priorRow);
}

// 20. State map (経営状況図): flags attach only to the exact visible node whose milestoneId the
// row carries; unresolvable rows go to `unattached`; owner/stale/unassessed rows become state
// marks on the node (never third-party flags); rank numbers are shared with the top list.
{
  const milestones = [
    milestone({
      id: "m1",
      slug: "a",
      status: "on_track",
      isBlocked: true,
      track: "technology_development",
      plannedEnd: "2026-09-30",
      forecastEnd: "2026-10-16",
      deltaDays: 16,
    }),
    milestone({
      id: "m2",
      slug: "b",
      status: "on_track",
      ownerLabel: "未確認",
      plannedEnd: "2026-12-18",
      forecastEnd: "2027-01-15",
      deltaDays: 28,
      track: "business_development",
    }),
    milestone({
      id: "m3",
      slug: "c",
      status: "on_track",
      plannedEnd: "2027-03-31",
      forecastEnd: "2027-03-31",
      deltaDays: 0,
      track: "organizational_building",
    }),
  ];
  const rail = deriveSxCriticalPathRail(
    { dagValid: true, criticalPathSlugs: ["a", "b", "c"] },
    milestones,
  );
  assert.equal(rail.nodes[0].track, "technology_development");

  const queue = deriveSxInterventionQueue({
    today: "2026-07-25",
    criticalPathSlugs: ["a", "b", "c"],
    milestones,
    partnerWorkItems: [
      {
        id: "wi1",
        partnerId: "p1",
        side: "partner",
        title: "試作納品",
        ownerLabel: "先方担当",
        status: "waiting",
        dueDate: "2026-08-01",
        dueDatePrecision: "month",
        relatedMilestoneId: "m1",
      },
    ],
    partners: [
      {
        id: "p9",
        slug: "p9",
        name: "機関X",
        currentBallSide: "partner",
        currentBallOwner: "相手担当",
        relatedMilestoneSlugs: ["zz-not-critical-but-unmatched"],
        nextCommitment: null,
        dueDate: null,
      },
    ],
    issues: [],
    maxRows: 200,
  });

  const map = deriveSxStateMap({
    rail,
    interventionRows: queue.rows,
    totalCount: queue.totalCount,
    topCount: 3,
  });
  assert.equal(map.valid, true);
  assert.equal(map.nodes.length, 3);

  // Blocked critical milestone m1 -> flag on node a; partner work item also on node a.
  const nodeA = map.nodes[0];
  assert.ok(nodeA.flags.some((flag) => flag.kind === "critical_blocked"));
  assert.ok(nodeA.flags.some((flag) => flag.kind === "partner_work_item"));
  // Node a is blocked -> current node is still first incomplete (a itself).
  assert.equal(map.todayIndex, 0);

  // Owner-unconfirmed on m2 -> state mark on node b, never a flag.
  const nodeB = map.nodes[1];
  assert.equal(nodeB.flags.length, 0);
  assert.ok(nodeB.stateMarks.some((mark) => mark.kind === "owner_unconfirmed"));

  // Gap days are forecast-date proportional: a(10/16) -> b(1/15) = 91 days, b -> c(3/31) = 75 days.
  assert.equal(map.nodes[0].gapDaysFromPrev, null);
  assert.equal(map.nodes[1].gapDaysFromPrev, 91);
  assert.equal(map.nodes[2].gapDaysFromPrev, 75);

  // Ranks: shared numbering between top list and attached blockers/marks.
  assert.equal(map.top.length, Math.min(3, queue.rows.length));
  map.top.forEach((row, index) => assert.equal(row.rank, index + 1));
  const rankedOnMap = [
    ...map.nodes.flatMap((entry) => [...entry.flags, ...entry.stateMarks]),
    ...map.unattached,
  ].filter((row) => row.rank != null);
  for (const top of map.top) {
    assert.ok(
      rankedOnMap.some((row) => row.key === top.key && row.rank === top.rank),
    );
  }
}

// 20b. Rows whose milestoneId doesn't resolve to a visible node land in unattached — never
// guessed onto a node. Invalid rail keeps every row in unattached with top ranks intact.
{
  const milestones = [
    milestone({ id: "m1", slug: "a", status: "on_track", isBlocked: true }),
  ];
  const rail = deriveSxCriticalPathRail(
    { dagValid: true, criticalPathSlugs: ["a"] },
    milestones,
  );
  const orphanRow = {
    key: "issue-orphan",
    priority: 5,
    kind: "issue_stalled",
    target: "孤立論点",
    ballSide: "担当",
    ballOwner: "担当A",
    dueDate: "2026-07-01",
    dueContextLabel: null,
    gate: "",
    anchor: "#sx-issue-orphan",
    entityType: "issue",
    entityId: "orphan",
    milestoneId: null,
  };
  const map = deriveSxStateMap({
    rail,
    interventionRows: [orphanRow],
    totalCount: 1,
    topCount: 3,
  });
  assert.equal(map.nodes[0].flags.length, 0);
  assert.equal(map.unattached.length, 1);
  assert.equal(map.unattached[0].rank, 1);

  const invalidRail = deriveSxCriticalPathRail(
    { dagValid: false, criticalPathSlugs: ["a"] },
    milestones,
  );
  const invalidMap = deriveSxStateMap({
    rail: invalidRail,
    interventionRows: [orphanRow],
    totalCount: 1,
  });
  assert.equal(invalidMap.valid, false);
  assert.equal(invalidMap.reason, "依存関係不正");
  assert.equal(invalidMap.unattached.length, 1);
  assert.equal(invalidMap.top.length, 1);
}

// 20c. State-class rows never appear as flags anywhere (flag/state classification is by kind).
{
  const milestones = [
    milestone({
      id: "m1",
      slug: "a",
      status: "unassessed",
      confidence: "unknown",
      ownerLabel: "未確認",
      plannedEnd: null,
      forecastEnd: null,
      deltaDays: null,
    }),
  ];
  const rail = deriveSxCriticalPathRail(
    { dagValid: true, criticalPathSlugs: ["a"] },
    milestones,
  );
  const queue = deriveSxInterventionQueue({
    today: "2026-07-25",
    criticalPathSlugs: ["a"],
    milestones,
    partnerWorkItems: [],
    partners: [],
    issues: [],
    maxRows: 200,
  });
  const map = deriveSxStateMap({
    rail,
    interventionRows: queue.rows,
    totalCount: queue.totalCount,
  });
  assert.equal(map.nodes[0].flags.length, 0);
  assert.ok(map.nodes[0].stateMarks.length > 0);
  for (const mark of map.nodes[0].stateMarks)
    assert.equal(mark.blockerClass, "state");
}

// 21. 判定バー: 業務判定は重要経路から（停止>期限超過>遅延見込み>オンスケ/判定不能）、運用は
// 判定キーの表示語。STEP2は金額が無ければ「未確認」。未評価だけの経路をオンスケにしない。
{
  const tracks = [
    {
      key: "business_development",
      shortLabel: "事業",
      deltaDays: 7,
      dateCertainty: "provisional",
    },
    {
      key: "funding",
      shortLabel: "資金",
      deltaDays: 35,
      dateCertainty: "provisional",
    },
  ];
  const milestones = [
    milestone({
      id: "m1",
      slug: "a",
      status: "unassessed",
      confidence: "unknown",
      deltaDays: 16,
      dateCertainty: "provisional",
      plannedEnd: "2026-09-30",
      forecastEnd: "2026-10-16",
    }),
    milestone({
      id: "m2",
      slug: "b",
      status: "unassessed",
      confidence: "unknown",
      deltaDays: 28,
      dateCertainty: "provisional",
      plannedEnd: "2026-12-18",
      forecastEnd: "2027-01-15",
    }),
  ];
  const summary = deriveSxVerdictSummary({
    today: "2026-07-25",
    judgment: {
      key: "unassessed",
      dagValid: true,
      completenessPct: 51,
      criticalUnknownCount: 21,
      blockedCount: 0,
    },
    criticalPathSlugs: ["a", "b"],
    milestones,
    tracks,
    objectiveTargetDate: "2027-03-31",
    funding: { requiredAmount: null, securedAmount: null },
  });
  // 仮日程どうしの差なので「遅れ」とは言い切らず、実際の遅れ（期限超過0件）を主語にする。
  assert.equal(summary.business.label, "実際の遅れなし");
  assert.equal(summary.business.tone, "unknown");
  assert.equal(summary.business.provisional, true);
  assert.equal(summary.business.detail, "仮置きの見込みは予定より最大28日遅れ");
  assert.equal(summary.operations.verdictLabel, "判定不能");
  assert.equal(summary.step2.known, false);
  assert.equal(summary.step2.label, "未確認");
  assert.equal(summary.countdown.days, 249);

  // 停止が最優先
  const blockedSummary = deriveSxVerdictSummary({
    today: "2026-07-25",
    judgment: {
      key: "crisis",
      dagValid: true,
      completenessPct: 51,
      criticalUnknownCount: 21,
      blockedCount: 1,
    },
    criticalPathSlugs: ["a"],
    milestones: [
      milestone({ id: "m1", slug: "a", isBlocked: true, deltaDays: 16 }),
    ],
    tracks,
    objectiveTargetDate: null,
    funding: null,
  });
  assert.equal(blockedSummary.business.label, "停止 1件");
  assert.equal(blockedSummary.business.tone, "bad");

  // 全て未評価・差分なし → オンスケにしない
  const unassessedSummary = deriveSxVerdictSummary({
    today: "2026-07-25",
    judgment: {
      key: "unassessed",
      dagValid: true,
      completenessPct: 10,
      criticalUnknownCount: 5,
      blockedCount: 0,
    },
    criticalPathSlugs: ["a"],
    milestones: [
      milestone({
        id: "m1",
        slug: "a",
        status: "unassessed",
        confidence: "unknown",
        deltaDays: 0,
        dateCertainty: "provisional",
      }),
    ],
    tracks: [],
    objectiveTargetDate: null,
    funding: null,
  });
  assert.notEqual(unassessedSummary.business.label, "オンスケ");
}

// 22. 統合タイムライン: 柱レーンへ日付順で配置、重要経路の接続点は経路順、今日と設立判断の位置、
// 日付なし・完了はレーンへ描かず件数へ。laneOrderに無いtrackも落とさない。
{
  const milestones = [
    milestone({
      id: "m1",
      slug: "biz-1",
      track: "business_development",
      plannedStart: "2026-07-20",
      plannedEnd: "2026-08-07",
      forecastEnd: "2026-08-14",
      deltaDays: 7,
    }),
    milestone({
      id: "m2",
      slug: "tech-1",
      track: "technology_development",
      plannedStart: "2026-07-20",
      plannedEnd: "2026-09-30",
      forecastEnd: "2026-10-16",
      deltaDays: 16,
    }),
    milestone({
      id: "m3",
      slug: "tech-2",
      track: "technology_development",
      plannedStart: "2026-09-01",
      plannedEnd: "2026-12-18",
      forecastEnd: "2027-01-15",
      deltaDays: 28,
    }),
    milestone({
      id: "m4",
      slug: "org-1",
      track: "organizational_building",
      plannedStart: "2027-02-01",
      plannedEnd: "2027-03-31",
      forecastEnd: "2027-03-31",
      deltaDays: 0,
    }),
    milestone({
      id: "m5",
      slug: "fund-1",
      track: "funding",
      plannedStart: "2026-08-03",
      plannedEnd: "2026-11-27",
      forecastEnd: "2026-12-18",
      deltaDays: 21,
    }),
    milestone({
      id: "m6",
      slug: "undated",
      track: "funding",
      plannedEnd: null,
      forecastEnd: null,
    }),
    milestone({
      id: "m7",
      slug: "done",
      track: "funding",
      status: "completed",
      plannedEnd: "2026-07-01",
      forecastEnd: "2026-07-01",
    }),
    milestone({
      id: "m8",
      slug: "orphan-track",
      track: "mystery",
      plannedEnd: "2026-10-01",
      forecastEnd: "2026-10-01",
      deltaDays: 0,
    }),
  ];
  const tracks = [
    {
      key: "business_development",
      label: "事業開発",
      shortLabel: "事業",
      accent: "#315f7d",
      deltaDays: 7,
      dateCertainty: "provisional",
      maxIssue: "",
    },
    {
      key: "technology_development",
      label: "技術開発",
      shortLabel: "技術",
      accent: "#38745d",
      deltaDays: 16,
      dateCertainty: "provisional",
      maxIssue: "",
    },
    {
      key: "organizational_building",
      label: "体制構築",
      shortLabel: "体制",
      accent: "#76637b",
      deltaDays: 28,
      dateCertainty: "provisional",
      maxIssue: "",
    },
    {
      key: "funding",
      label: "資金調達",
      shortLabel: "資金",
      accent: "#bf7b2c",
      deltaDays: 35,
      dateCertainty: "provisional",
      maxIssue: "",
    },
  ];
  const timeline = deriveSxUnifiedTimeline({
    today: "2026-07-25",
    milestones,
    criticalPathSlugs: ["tech-1", "tech-2", "org-1"],
    dagValid: true,
    tracks,
    objectiveTargetDate: "2027-03-31",
    interventionRows: [
      {
        key: "r1",
        priority: 3,
        kind: "partner_work_item",
        target: "納品受入",
        ballSide: "相手側",
        ballOwner: "先方担当",
        dueDate: "2026-08-31",
        dueDatePrecision: "month",
        dueContextLabel: null,
        gate: "",
        anchor: "#sx-partner-x",
        entityType: "partner",
        entityId: "x",
        milestoneId: "m2",
      },
      {
        key: "r2",
        priority: 6,
        kind: "owner_unconfirmed",
        target: "担当確定",
        ballSide: "担当",
        ballOwner: "未確認",
        dueDate: null,
        dueContextLabel: null,
        gate: "",
        anchor: "management-plan",
        entityType: "milestone",
        entityId: "m3",
        milestoneId: "m3",
      },
    ],
    pinCount: 5,
  });
  assert.equal(timeline.valid, true);
  // 完了と日付なしはレーンに出ず、件数として残る
  assert.equal(timeline.undatedCount, 1);
  assert.equal(timeline.completedCount, 1);
  // レーン順は 事業→技術→体制→資金 + 未知トラックの末尾レーン
  assert.deepEqual(
    timeline.lanes.map((lane) => lane.key),
    [
      "business_development",
      "technology_development",
      "organizational_building",
      "funding",
      "unknown",
    ],
  );
  assert.equal(timeline.lanes[4].rows.length, 1);
  // 重要経路の接続点は経路順で3点、pctは単調増加
  assert.deepEqual(
    timeline.criticalPoints.map((point) => point.slug),
    ["tech-1", "tech-2", "org-1"],
  );
  const pcts = timeline.criticalPoints.map((point) => point.pct);
  assert.ok(pcts[0] < pcts[1] && pcts[1] < pcts[2]);
  // 今日は設立判断より左
  assert.ok(timeline.todayPct < (timeline.objectivePct ?? 0));
  // 現在地 = 重要経路の最初の未完了
  const techLane = timeline.lanes[1];
  assert.equal(techLane.rows[0].isCurrent, true);
  assert.equal(techLane.rows[0].isCritical, true);
  // ピン: 期日を持つ行だけ、rankは介入リストの順、相手側はpartner側
  assert.equal(timeline.pins.length, 1);
  assert.equal(timeline.pins[0].rank, 1);
  assert.equal(timeline.pins[0].side, "partner");
  assert.ok(timeline.pins[0].duePct > 0 && timeline.pins[0].duePct < 100);
  // 月目盛は域内で単調
  assert.ok(timeline.months.length >= 9);
  for (let i = 1; i < timeline.months.length; i += 1)
    assert.ok(timeline.months[i].pct > timeline.months[i - 1].pct);
}

// 22b. dagValid=false / 日付付きゼロは描かず理由へ閉じる
{
  const invalid = deriveSxUnifiedTimeline({
    today: "2026-07-25",
    milestones: [],
    criticalPathSlugs: [],
    dagValid: false,
    tracks: [],
    objectiveTargetDate: null,
    interventionRows: [],
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.reason, "依存関係不正");
  const empty = deriveSxUnifiedTimeline({
    today: "2026-07-25",
    milestones: [milestone({ plannedEnd: null, forecastEnd: null })],
    criticalPathSlugs: [],
    dagValid: true,
    tracks: [],
    objectiveTargetDate: null,
    interventionRows: [],
  });
  assert.equal(empty.valid, false);
  assert.equal(empty.reason, "日程付きマイルストーン未登録");
}

// 22c. 週次管制のplanned_onlyは予測日を範囲・並び・表示値に使わない。
{
  const timeline = deriveSxUnifiedTimeline({
    today: "2026-07-25",
    milestones: [
      milestone({
        id: "planned",
        slug: "planned",
        track: "funding",
        plannedEnd: "2026-08-10",
        forecastEnd: "2027-02-10",
        deltaDays: 184,
      }),
      milestone({
        id: "forecast-only",
        slug: "forecast-only",
        track: "funding",
        plannedEnd: null,
        forecastEnd: "2026-08-01",
        deltaDays: null,
      }),
    ],
    criticalPathSlugs: ["planned"],
    dagValid: true,
    tracks: [
      {
        key: "funding",
        label: "資金調達",
        shortLabel: "資金",
        accent: "#bf7b2c",
        deltaDays: null,
        dateCertainty: null,
        maxIssue: "",
      },
    ],
    objectiveTargetDate: null,
    interventionRows: [],
    dateMode: "planned_only",
  });
  assert.equal(timeline.valid, true);
  assert.equal(
    timeline.undatedCount,
    1,
    "forecast-only milestones should stay undated in planned-only mode",
  );
  const row = timeline.lanes.find((lane) => lane.key === "funding")?.rows[0];
  assert.equal(row?.forecastEnd, null);
  assert.equal(row?.forecastPct, null);
  assert.equal(row?.deltaDays, null);
  assert.equal(
    timeline.domainEnd < "2027-01-01",
    true,
    "a late forecast must not stretch the weekly-control range",
  );
}

// 23. 柱ゲート行: 重要経路外の現在ゲートの担当未確認/評価未完がキューへ入り、trackを持つ。
// 重要経路上のゲートはpillarGatesから重複しない。
{
  const milestones = [
    milestone({
      id: "m1",
      slug: "crit",
      status: "unassessed",
      confidence: "unknown",
      ownerLabel: "未確認",
    }),
    milestone({
      id: "m2",
      slug: "fund-gate",
      status: "unassessed",
      confidence: "unknown",
      ownerLabel: "未確認",
      plannedEnd: "2026-12-25",
      forecastEnd: "2027-01-29",
      deltaDays: 35,
    }),
  ];
  const queue = deriveSxInterventionQueue({
    today: "2026-07-25",
    criticalPathSlugs: ["crit"],
    milestones,
    partnerWorkItems: [],
    partners: [],
    issues: [],
    pillarGates: [
      { trackKey: "funding", trackLabel: "資金", milestoneId: "m2" },
      {
        trackKey: "technology_development",
        trackLabel: "技術",
        milestoneId: "m1",
      },
    ],
    maxRows: 200,
  });
  const fundingRow = queue.rows.find((row) => row.track === "funding");
  assert.ok(fundingRow);
  assert.ok(fundingRow.target.startsWith("【資金】"));
  // criticalのm1はpillarGates経由で二重にならない（critical側の1行だけ）
  assert.equal(queue.rows.filter((row) => row.milestoneId === "m1").length, 1);
}

// 24. クォータ: top内に必須trackが無ければ後方から繰り上げ、候補ゼロなら行を発明せず注記。
{
  const mk = (key, track, priority) => ({
    key,
    priority,
    kind: "owner_unconfirmed",
    target: key,
    ballSide: "担当",
    ballOwner: "未確認",
    dueDate: null,
    dueContextLabel: null,
    gate: "",
    anchor: "management-plan",
    entityType: "milestone",
    entityId: key,
    milestoneId: key,
    track,
  });
  const rows = [
    mk("a", "technology_development", 1),
    mk("b", "technology_development", 2),
    mk("c", "funding", 6),
  ];
  const applied = applySxInterventionPillarQuota({
    rows,
    topCount: 2,
    requiredTrack: "funding",
    requiredTrackLabel: "資金",
  });
  assert.equal(applied.quotaApplied, true);
  assert.deepEqual(
    applied.top.map((row) => row.key),
    ["a", "c"],
  );

  const noCandidate = applySxInterventionPillarQuota({
    rows: [mk("a", "technology_development", 1)],
    topCount: 2,
    requiredTrack: "funding",
    requiredTrackLabel: "資金",
  });
  assert.equal(noCandidate.quotaApplied, false);
  assert.equal(noCandidate.quotaNote, "資金の介入候補は台帳未登録");

  const alreadyIn = applySxInterventionPillarQuota({
    rows,
    topCount: 3,
    requiredTrack: "funding",
    requiredTrackLabel: "資金",
  });
  assert.equal(alreadyIn.quotaApplied, false);
  assert.equal(alreadyIn.quotaNote, null);
}

// 25. slip分類: 仮置きの予測差を「遅延」と呼ばない。期限超過 > 確認済み遅延 > 仮置き予測差。
{
  const base = {
    status: "unassessed",
    plannedEnd: "2026-08-07",
    forecastEnd: "2026-08-14",
    deltaDays: 7,
    dateCertainty: "provisional",
    isOverdue: false,
    forecastChangeReason: "初期Seed。予測日は仮置きで、変更理由は未確認",
  };
  // 初期Seedの仮置き差 = provisional_slip（今日より未来、実測の遅れではない）
  assert.equal(sxEcdClassifySlip(base, "2026-07-25"), "provisional_slip");
  // 見直し理由が実質的に入っていれば confirmed_slip
  assert.equal(
    sxEcdClassifySlip(
      { ...base, forecastChangeReason: "候補先の回答遅れで2週間後ろ倒し" },
      "2026-07-25",
    ),
    "confirmed_slip",
  );
  // 日付が確定扱いなら理由が定型でも confirmed_slip
  assert.equal(
    sxEcdClassifySlip({ ...base, dateCertainty: "confirmed" }, "2026-07-25"),
    "confirmed_slip",
  );
  // 予定日を過ぎていれば overdue（差分の種類より優先）
  assert.equal(sxEcdClassifySlip(base, "2026-08-20"), "overdue");
  assert.equal(
    sxEcdClassifySlip({ ...base, isOverdue: true }, "2026-07-25"),
    "overdue",
  );
  // 差がない/完了は none
  assert.equal(
    sxEcdClassifySlip({ ...base, deltaDays: 0 }, "2026-07-25"),
    "none",
  );
  assert.equal(
    sxEcdClassifySlip({ ...base, status: "completed" }, "2026-08-20"),
    "none",
  );
  // 理由が空でも仮置き扱い（勝手に「根拠あり」へ格上げしない）
  assert.equal(
    sxEcdClassifySlip({ ...base, forecastChangeReason: null }, "2026-07-25"),
    "provisional_slip",
  );
}

// 25b. 判定バー: 仮置き差だけなら「遅延見込み」と言わず、期限超過0件を明示して中立トーン。
{
  const seeded = milestone({
    id: "m1",
    slug: "a",
    status: "unassessed",
    confidence: "unknown",
    plannedEnd: "2026-08-07",
    forecastEnd: "2026-08-14",
    deltaDays: 7,
    dateCertainty: "provisional",
    forecastChangeReason: "初期Seed。予測日は仮置きで、変更理由は未確認",
  });
  const provisionalOnly = deriveSxVerdictSummary({
    today: "2026-07-25",
    judgment: {
      key: "unassessed",
      dagValid: true,
      completenessPct: 51,
      criticalUnknownCount: 21,
      blockedCount: 0,
    },
    criticalPathSlugs: ["a"],
    milestones: [seeded],
    tracks: [],
    objectiveTargetDate: null,
    funding: null,
  });
  assert.equal(provisionalOnly.business.label, "実際の遅れなし");
  assert.equal(provisionalOnly.business.tone, "unknown");
  assert.equal(
    provisionalOnly.business.detail,
    "仮置きの見込みは予定より最大7日遅れ",
  );
  assert.equal(provisionalOnly.business.provisional, true);

  // 根拠のある見直しは従来どおり「遅延見込み」でamber
  const confirmed = deriveSxVerdictSummary({
    today: "2026-07-25",
    judgment: {
      key: "attention",
      dagValid: true,
      completenessPct: 80,
      criticalUnknownCount: 1,
      blockedCount: 0,
    },
    criticalPathSlugs: ["a"],
    milestones: [
      milestone({
        id: "m1",
        slug: "a",
        status: "attention",
        confidence: "high",
        plannedEnd: "2026-08-07",
        forecastEnd: "2026-08-21",
        deltaDays: 14,
        dateCertainty: "confirmed",
        forecastChangeReason: "候補先の回答遅れ",
      }),
    ],
    tracks: [],
    objectiveTargetDate: null,
    funding: null,
  });
  assert.equal(confirmed.business.label, "予定より最大14日遅れ見込み");
  assert.equal(confirmed.business.tone, "warn");
  assert.equal(confirmed.business.provisional, false);
}

// 25c. タイムライン行/レーンへslipKindが載り、レーンは最も重い状態を採る。
{
  const rows = [
    milestone({
      id: "m1",
      slug: "a",
      track: "funding",
      plannedStart: "2026-07-01",
      plannedEnd: "2026-08-07",
      forecastEnd: "2026-08-14",
      deltaDays: 7,
      dateCertainty: "provisional",
      forecastChangeReason: "初期Seed。予測日は仮置きで、変更理由は未確認",
    }),
    milestone({
      id: "m2",
      slug: "b",
      track: "funding",
      plannedStart: "2026-07-01",
      plannedEnd: "2026-07-10",
      forecastEnd: "2026-07-20",
      deltaDays: 10,
      dateCertainty: "confirmed",
      forecastChangeReason: "実測遅れ",
    }),
  ];
  const timeline = deriveSxUnifiedTimeline({
    today: "2026-07-25",
    milestones: rows,
    criticalPathSlugs: [],
    dagValid: true,
    tracks: [
      {
        key: "funding",
        label: "資金調達",
        shortLabel: "資金",
        accent: "#bf7b2c",
        deltaDays: 10,
        dateCertainty: "confirmed",
        maxIssue: "",
      },
    ],
    objectiveTargetDate: null,
    interventionRows: [],
  });
  const lane = timeline.lanes.find((entry) => entry.key === "funding");
  assert.ok(lane);
  assert.deepEqual(lane.rows.map((row) => row.slipKind).sort(), [
    "overdue",
    "provisional_slip",
  ]);
  // 予定日を過ぎたm2がoverdueなので、レーンはoverdue
  assert.equal(lane.slipKind, "overdue");
}

console.log("test_sx_executive_control_deck.mjs: all assertions passed");
