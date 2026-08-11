import assert from "node:assert/strict";
import { buildSxNavigationViewModel, NAV_PARTNER_STAGE_ORDER } from "../src/lib/sx-navigation-v2.ts";

function milestone(overrides = {}) {
  return {
    id: `m-${overrides.slug || "1"}`, slug: "m-1", track: "technology_development", objectiveId: "obj-1", outcomeId: "out-1",
    title: "リアクター仕様確定", gate: "仕様確定ゲート", status: "on_track", manualStatus: "on_track", derivedStatus: "on_track",
    statusReason: "必要項目を確認済み", reasonCodes: [],
    plannedStart: "2026-07-01", plannedEnd: "2026-08-01", forecastEnd: "2026-08-01", actualEnd: null,
    deltaDays: 0, progressPct: 0, dateCertainty: "confirmed", ownerMemberId: null, ownerLabel: "担当A",
    nextDeliverable: "仕様書", maxIssue: "論点なし", completionCriteria: "レビュー完了", completionEvidence: null,
    criticality: "high", baselinePlanVersion: "v1", forecastChangeReason: null, statusSource: "derived",
    statusOverrideReason: null, statusOverrideExpiresOn: null, statusOverrideApprovedBy: null,
    lastVerifiedAt: "2026-07-27", confidence: "high", sourceKind: "current_truth", sourceRef: null,
    dependencySlugs: [], predecessorIds: [], successorIds: [], relatedIssueSlugs: [], relatedPartnerSlugs: [],
    linkedKpiIds: [], isStale: false, isOverdue: false, isBlocked: false,
    ...overrides,
  };
}

function issue(overrides = {}) {
  return {
    id: `i-${overrides.slug || "1"}`, slug: "issue-1", track: "technology_development", milestoneSlug: "m-1",
    title: "論点1", knowledgeType: "hypothesis", status: "open", hypothesis: "", evidenceFor: "", counterevidenceOrMissing: "",
    nextValidation: "", ownerLabel: "担当A", dueDate: null, decisionText: null, lastVerifiedAt: "2026-07-27",
    confidence: "medium", sourceKind: "current_truth", sourceRef: "internal:secret", relatedMilestoneSlugs: [], relatedPartnerSlugs: [],
    hypotheses: [], evidence: [], validationRuns: [], decisions: [], actionItems: [],
    ...overrides,
  };
}

function technicalTest(overrides = {}) {
  return {
    id: `t-${overrides.testSlug || "1"}`, milestoneId: "m-m-1", outcomeId: "out-1", testSlug: "tech-recovery-test",
    testName: "回収の確認", testCondition: "", target: null, actual: null, unit: "%", repetition: null, sample: null,
    trlCriterion: "", evidence: null, status: "planned", measuredOn: null, ownerLabel: "担当A", confidence: "low",
    sourceKind: "current_truth",
    ...overrides,
  };
}

function partner(overrides = {}) {
  return {
    id: "p-1", slug: "partner-1", track: "business_development", tracks: [], name: "テスト先",
    roleLabel: "共同開発先", relationshipStage: "executing", agreementState: "partial", agreedScope: "",
    unagreedScope: "", lastContactDate: "2026-07-20", nextCommitment: "次回打合せ", dueDate: "2026-08-10",
    ownerLabel: "担当A", currentBallSide: "sx", currentBallOwner: "担当A", nextBallOwner: null,
    targetState: "本契約締結", dueDatePrecision: "day", lastVerifiedAt: "2026-07-20", confidence: "medium",
    sourceKind: "current_truth", sourceRef: null, relatedMilestoneSlugs: [], relatedIssueSlugs: [],
    commitments: [], interactions: [], roles: [], workItems: [], deferredLowPriority: false,
    ...overrides,
  };
}

function bundle(overrides = {}) {
  return {
    asOf: "2026-07-27", horizonMonths: [], objective: null,
    outcomes: [], kpis: [], dependencies: [],
    dag: { valid: true, cycles: [], criticalPath: [], blockedMilestoneIds: [], waitingMilestoneIds: [] },
    judgment: {
      key: "unassessed", label: "未評価", reasons: [], decisionQueue: [], nextDeadline: null, lastVerifiedAt: null,
      completenessPct: 0, staleCount: 0, overdueCount: 0, criticalUnknownCount: 0, blockedCount: 0,
      provisionalDateCount: 0, dagValid: true, criticalPathSlugs: [],
    },
    tracks: [], milestones: [], issues: [], hypotheses: [], evidence: [], validationRuns: [],
    decisions: [], actions: [], partners: [], partnerCommitments: [], partnerInteractions: [],
    partnerRoles: [], partnerWorkItems: [], technicalTests: [], fundingSnapshots: [],
    organizationRoles: [], raci: [], capacity: [], history: [], fieldAudit: [],
    canManage: false, hasData: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. 行階層: 重要経路グループ + 4本柱グループ → ゲート → 開発テーマ/技術試験・論点
// ---------------------------------------------------------------------------
{
  const gate1 = milestone({ slug: "gate-1", id: "m-gate-1", title: "ゲート1", status: "completed" });
  const gate2 = milestone({ slug: "gate-2", id: "m-gate-2", title: "ゲート2", status: "attention" });
  const model = buildSxNavigationViewModel({
    project: { projectId: "p21", projectName: "テストPJ" },
    sxManagement: bundle({
      milestones: [gate1, gate2],
      judgment: { key: "attention", label: "注意", reasons: [], decisionQueue: [], nextDeadline: null, lastVerifiedAt: null, completenessPct: 0, staleCount: 0, overdueCount: 0, criticalUnknownCount: 0, blockedCount: 0, provisionalDateCount: 0, dagValid: true, criticalPathSlugs: ["gate-1", "gate-2"] },
    }),
  });

  const criticalGroup = model.rows.find((row) => row.kind === "critical_group");
  assert.ok(criticalGroup, "重要経路グループが最上段に存在する");
  assert.equal(criticalGroup.parentId, null);
  assert.equal(criticalGroup.depth, 0);

  const critGate2 = model.rows.find((row) => row.id === "crit-milestone:gate-2");
  assert.ok(critGate2, "重要経路配下にゲートが複製表示される");
  assert.equal(critGate2.parentId, "critical");
  assert.equal(critGate2.isCritical, true, "重要経路配下の行は必ずisCritical=trueになる");

  const pillarGroups = model.rows.filter((row) => row.kind === "pillar_group");
  assert.equal(pillarGroups.length, 4, "4本柱グループが常に存在する");

  const pillarGate2 = model.rows.find((row) => row.id.endsWith("/milestone:gate-2") && row.kind === "milestone");
  assert.ok(pillarGate2, "4本柱グループ配下にもゲートが表示される");
  assert.equal(pillarGate2.depth, 1);
  assert.equal(pillarGate2.isCritical, true, "重要経路に含まれるゲートは柱側でもisCritical=trueになる");
}

// ---------------------------------------------------------------------------
// 2. タスクバーは1行1本 — 積み重ねレイヤーを持たない
// ---------------------------------------------------------------------------
{
  const slipped = milestone({ slug: "gate-slip", id: "m-slip", plannedEnd: "2026-08-01", forecastEnd: "2026-09-05" });
  const model = buildSxNavigationViewModel({
    project: { projectId: "p21", projectName: "テストPJ" },
    sxManagement: bundle({ milestones: [slipped] }),
  });
  const row = model.rows.find((r) => r.id.endsWith("/milestone:gate-slip"));
  assert.ok(row.bar, "日程がある行は単一barを持つ");
  const barKeys = Object.keys(row.bar).sort();
  assert.deepEqual(barKeys, ["delayDays", "delaySegment", "endPct", "plannedEndTickPct", "progressMarkerPct", "pulledInDays", "startPct"].sort(), "NavBarは1行1本ぶんのフィールドしか持たない（複数バーの積み重ねを表現するフィールドが無い）");
  assert.ok(row.bar.delaySegment, "予測が計画を超過した分は末尾のdelaySegmentとして同じバー内に表現する");
  assert.equal(row.bar.delaySegment.startPct, row.bar.plannedEndTickPct, "遅延セグメントは計画終了ティックから始まる");
}

// ---------------------------------------------------------------------------
// 3. 依存線 = 重要経路の連続ペアだけの直角コネクタ
// ---------------------------------------------------------------------------
{
  const model = buildSxNavigationViewModel({
    project: { projectId: "p21", projectName: "テストPJ" },
    sxManagement: bundle({
      milestones: [
        milestone({ slug: "a", id: "m-a" }),
        milestone({ slug: "b", id: "m-b" }),
        milestone({ slug: "c", id: "m-c" }),
      ],
      judgment: { key: "on_track", label: "順調", reasons: [], decisionQueue: [], nextDeadline: null, lastVerifiedAt: null, completenessPct: 0, staleCount: 0, overdueCount: 0, criticalUnknownCount: 0, blockedCount: 0, provisionalDateCount: 0, dagValid: true, criticalPathSlugs: ["a", "b", "c"] },
    }),
  });
  assert.equal(model.edges.length, 2, "重要経路3節点なら連続ペア2本だけを辺として持つ");
  assert.deepEqual(model.edges.map((e) => [e.fromSlug, e.toSlug]), [["a", "b"], ["b", "c"]]);
  // NavDependencyEdge自体は始点・終点slugのみを持ち、曲線制御点などBezier用のフィールドは含まない
  // （画面側でH→V→Hの直角pathを組み立てる = 呼び出し側にBezier曲線を書かせる余地がない）
  const edgeKeys = Object.keys(model.edges[0]).sort();
  assert.deepEqual(edgeKeys, ["fromSlug", "id", "order", "toSlug"].sort());

  const dagBroken = buildSxNavigationViewModel({
    project: { projectId: "p21", projectName: "テストPJ" },
    sxManagement: bundle({
      milestones: [milestone({ slug: "a", id: "m-a" }), milestone({ slug: "b", id: "m-b" })],
      judgment: { key: "unassessed", label: "未評価", reasons: [], decisionQueue: [], nextDeadline: null, lastVerifiedAt: null, completenessPct: 0, staleCount: 0, overdueCount: 0, criticalUnknownCount: 0, blockedCount: 0, provisionalDateCount: 0, dagValid: false, criticalPathSlugs: ["a", "b"] },
    }),
  });
  assert.equal(dagBroken.edges.length, 0, "DAG不成立なら辺を1本も出さない");
  assert.equal(dagBroken.rows.find((r) => r.kind === "critical_group").dateUnsetLabel, "DAG不成立");
}

// ---------------------------------------------------------------------------
// 4. Dy current-truth境界 — 吸着可能性が見えた段階までしか合格/実施済みにしない
// ---------------------------------------------------------------------------
{
  const parentTest = technicalTest({ testSlug: "tech-recovery-test", id: "t-parent", milestoneId: "m-m-1", status: "running" });
  const dyScreening = technicalTest({ testSlug: "tech-recovery-dy-adsorption-screening", id: "t-dy-1", milestoneId: "m-m-1", status: "running", testName: "吸着可能性の速報確認（Dy）" });
  const dyRealEffluent = technicalTest({ testSlug: "tech-recovery-dy-real-effluent", id: "t-dy-2", milestoneId: "m-m-1", status: "planned", testName: "実排液共存系での選択性（Dy）" });
  const dyAcid = technicalTest({ testSlug: "tech-recovery-dy-acid-desorption", id: "t-dy-3", milestoneId: "m-m-1", status: "planned", testName: "酸脱離による回収（Dy）" });
  const dyCycle = technicalTest({ testSlug: "tech-recovery-dy-cycle-durability", id: "t-dy-4", milestoneId: "m-m-1", status: "planned", testName: "1/3/5サイクル耐久性（Dy）" });
  const model = buildSxNavigationViewModel({
    project: { projectId: "p21", projectName: "テストPJ" },
    sxManagement: bundle({
      milestones: [milestone({ slug: "m-1", id: "m-m-1" })],
      technicalTests: [parentTest, dyScreening, dyRealEffluent, dyAcid, dyCycle],
    }),
  });

  const parentRowId = model.rows.find((r) => r.kind === "technical_test" && r.label === "回収の確認")?.id;
  assert.ok(parentRowId, "回収の確認テストが親テーマ行として表示される");
  const dyChildren = model.rows.filter((r) => r.parentId === parentRowId);
  assert.equal(dyChildren.length, 4, "Dy検証4段階が回収テーマ配下に子として並ぶ");
  assert.deepEqual(dyChildren.map((r) => r.label), ["吸着可能性の速報確認（Dy）", "実排液共存系での選択性（Dy）", "酸脱離による回収（Dy）", "1/3/5サイクル耐久性（Dy）"], "吸着→実排液→酸脱離→サイクルの順で並ぶ");

  const screeningDetail = model.details[`test:${dyScreening.testSlug}`];
  assert.equal(screeningDetail.status, "running", "吸着可能性の速報確認はrunning(未完了)のまま — 合格と捏造しない");
  const realEffluentDetail = model.details[`test:${dyRealEffluent.testSlug}`];
  assert.equal(realEffluentDetail.status, "planned", "実排液共存系は計画段階のまま");
  const cycleDetail = model.details[`test:${dyCycle.testSlug}`];
  assert.equal(cycleDetail.status, "planned", "サイクル耐久性は計画段階のまま — 実施済みや合格と捏造しない");
}

// ---------------------------------------------------------------------------
// 5. 論点 → 仮説 → 根拠・反証 → 検証 → 判断 → アクション の view model
// ---------------------------------------------------------------------------
{
  const targetIssue = issue({
    slug: "issue-chain", id: "i-chain",
    hypotheses: [{ id: "h-1", issueId: "i-chain", statement: "仮説A", status: "open", ownerLabel: "担当A", dueDate: null, confidence: "medium", lastVerifiedAt: "2026-07-27", sourceKind: "current_truth", sourceRef: null }],
    evidence: [{ id: "e-1", issueId: "i-chain", hypothesisId: "h-1", kind: "supporting", summary: "根拠A", observedOn: "2026-07-10", sourceLabel: "非公開出典", confidence: "medium", lastVerifiedAt: "2026-07-27" }],
    validationRuns: [{ id: "v-1", hypothesisId: "h-1", validationKind: "検証A", plannedOn: null, dueDate: null, completedOn: null, status: "running", ownerLabel: "担当A", method: "方法A", resultSummary: null, confidence: "low", sourceKind: "current_truth", sourceRef: null }],
    decisions: [{ id: "d-1", issueId: "i-chain", hypothesisId: null, title: "決定A", context: "", status: "open", rationale: "", decisionText: null, decidedBy: null, decidedOn: null, ownerLabel: "担当A", dueDate: null, isThisWeek: false, sortOrder: 0, confidence: "unknown", lastVerifiedAt: "2026-07-27", sourceKind: "current_truth", sourceRef: null, track: "technology_development", actionItems: [{ id: "act-1", decisionId: "d-1", title: "アクションA", ownerLabel: "担当A", dueDate: null, completionCriteria: "", nextReviewOn: null, status: "open", completionNote: null, completedAt: null, lastVerifiedAt: "2026-07-27", sourceKind: "current_truth" }] }],
  });
  const model = buildSxNavigationViewModel({
    project: { projectId: "p21", projectName: "テストPJ" },
    sxManagement: bundle({ milestones: [milestone({ slug: "m-1", id: "m-m-1" })], issues: [targetIssue] }),
  });
  const detail = model.details["issue:issue-chain"];
  assert.ok(detail, "論点詳細がdetailsに登録される");
  assert.equal(detail.hypotheses.length, 1);
  assert.equal(detail.evidence.length, 1);
  assert.equal(detail.validations.length, 1);
  assert.equal(detail.decisions.length, 1);
  assert.equal(detail.decisions[0].actionItems.length, 1, "判断配下のアクションまで連鎖して持つ");
  const json = JSON.stringify(detail);
  assert.ok(!json.includes("sourceRef"), "sourceRefキーは論点詳細へ含めない");
}

// ---------------------------------------------------------------------------
// 6. 関係先比較レーン: 共通7段階ステージ軸上の一行比較
// ---------------------------------------------------------------------------
{
  const active = partner({ slug: "active-1", relationshipStage: "condition_alignment" });
  const onHold = partner({ slug: "hold-1", id: "p-2", relationshipStage: "on_hold" });
  const model = buildSxNavigationViewModel({
    project: { projectId: "p21", projectName: "テストPJ" },
    sxManagement: bundle({ partners: [active, onHold] }),
  });
  const activeRow = model.partners.find((p) => p.slug === "active-1");
  assert.equal(activeRow.stageIndex, NAV_PARTNER_STAGE_ORDER.indexOf("condition_alignment") + 1, "関係段階のindexは共通7段階軸上の位置(1-7)");
  assert.equal(activeRow.stageLabel, "条件整理");

  const holdRow = model.partners.find((p) => p.slug === "hold-1");
  assert.equal(holdRow.stageIndex, null, "保留はステージ比較軸から外し、成果達成率と混同しない");
  assert.equal(holdRow.isOnHold, true);
}

// ---------------------------------------------------------------------------
// 7. 未着手は未評価ではなく中立トーンで表示する
// ---------------------------------------------------------------------------
{
  const notStarted = milestone({
    slug: "gate-not-started",
    id: "m-gate-not-started",
    status: "not_started",
    manualStatus: "not_started",
    derivedStatus: "not_started",
  });
  const model = buildSxNavigationViewModel({
    project: { projectId: "p21", projectName: "テストPJ" },
    sxManagement: bundle({ milestones: [notStarted] }),
  });
  const row = model.rows.find((item) => item.id.endsWith("/milestone:gate-not-started"));
  assert.ok(row, "未着手のマイルストーン行が表示される");
  assert.equal(row.tone, "neutral", "未着手を未評価のunknownトーンへ落とさない");
}

// ---------------------------------------------------------------------------
// 8. マニホールド履歴: issueに紐づくevidence(observation)がmilestone配下の履歴イベント行になる
// ---------------------------------------------------------------------------
{
  const reactorMilestone = milestone({ slug: "tech-reactor-recheck", id: "m-reactor" });
  const reactorIssue = issue({ slug: "reactor-configuration", id: "i-reactor", milestoneSlug: "tech-reactor-recheck" });
  const model = buildSxNavigationViewModel({
    project: { projectId: "p21", projectName: "テストPJ" },
    sxManagement: bundle({
      milestones: [reactorMilestone],
      issues: [reactorIssue],
      evidence: [{ id: "ev-manifold", issueId: "i-reactor", hypothesisId: null, kind: "observation", summary: "6/24確認: マニホールド型を現行ラインから除外", observedOn: "2026-06-24", sourceLabel: "SX現状", confidence: "high", lastVerifiedAt: "2026-06-24" }],
    }),
  });
  const historyRow = model.rows.find((r) => r.kind === "history_event");
  assert.ok(historyRow, "マニホールド除外はmilestone配下の履歴イベント行として表示される");
  assert.match(historyRow.label, /マニホールド型/);
  assert.match(historyRow.label, /確認/, "停止日を断定せず『確認』の語を残す");
}

console.log("test_sx_navigation.mjs: all assertions passed");
