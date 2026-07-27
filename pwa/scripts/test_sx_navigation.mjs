import assert from "node:assert/strict";
import {
  buildNavConstraintFlags,
  buildNavCriticalPath,
  buildNavDependencyEdges,
  buildNavMilestoneNode,
  buildNavPartnerJourney,
  buildNavPendingDecisions,
  buildNavRecentChanges,
  buildNavTimelineScale,
  buildSxNavigationViewModel,
  navHeadline,
  navJudgmentFromKey,
} from "../src/lib/sx-navigation.ts";

function milestone(overrides = {}) {
  return {
    id: "m-1", slug: "m-1", track: "technology_development", objectiveId: "obj-1", outcomeId: "out-1",
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

function sxManagementBundle(overrides = {}) {
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

// navJudgmentFromKey
assert.equal(navJudgmentFromKey("on_track").label, "予定内");
assert.equal(navJudgmentFromKey("attention").label, "要介入");
assert.equal(navJudgmentFromKey("crisis").label, "要介入");
assert.equal(navJudgmentFromKey("unassessed").label, "判定不能");

// navHeadline
{
  const milestones = [
    milestone({ slug: "gate-1", title: "ゲート1", status: "completed" }),
    milestone({ slug: "gate-2", title: "ゲート2", status: "attention" }),
  ];
  const headline = navHeadline({
    objective: { title: "会社設立", targetDate: "2027-03-31", dateCertainty: "confirmed" },
    judgmentKey: "attention",
    judgmentReasons: ["7日以内の期限 1件"],
    nextDeadline: "2026-08-01",
    milestones,
    criticalPathSlugs: ["gate-1", "gate-2"],
    dagValid: true,
    decisions: [{ status: "open" }, { status: "decided" }],
  });
  assert.equal(headline.judgmentLabel, "要介入");
  assert.equal(headline.finalGateLabel, "会社設立");
  assert.equal(headline.finalGateDate, "2027-03-31");
  assert.match(headline.bottleneckLabel, /ゲート2/, "完了済みのgate-1をスキップして最初の未完了節点を最大ボトルネックにする");
  assert.equal(headline.bottleneckMilestoneSlug, "gate-2");
  assert.equal(headline.pendingDecisionCount, 1);

  const dagBroken = navHeadline({
    objective: null,
    judgmentKey: "unassessed",
    judgmentReasons: [],
    nextDeadline: null,
    milestones,
    criticalPathSlugs: [],
    dagValid: false,
    decisions: [],
  });
  assert.equal(dagBroken.finalGateLabel, "最終ゲート未設定", "objectiveが無ければ捏造せず未設定と明示する");
  assert.match(dagBroken.bottleneckLabel, /循環/, "DAG不成立は循環と明示し数値を出さない");
}

// navHeadline: 判定不能でも予測遅延だけは見落とさない
{
  const allUnassessed = [
    milestone({ slug: "ms-1", title: "MS1", status: "unassessed", plannedEnd: "2026-08-01", forecastEnd: "2026-09-05", deltaDays: 35 }),
    milestone({ slug: "ms-2", title: "MS2", status: "unassessed", plannedEnd: "2026-08-10", forecastEnd: "2026-08-10", deltaDays: 0 }),
  ];
  const headline = navHeadline({
    objective: null,
    judgmentKey: "unassessed",
    judgmentReasons: ["重要な未確認 2件"],
    nextDeadline: null,
    milestones: allUnassessed,
    criticalPathSlugs: [],
    dagValid: true,
    decisions: [],
  });
  assert.equal(headline.judgmentLabel, "判定不能");
  assert.equal(headline.forecastSlipCount, 1, "全件判定不能でも予測遅延は別軸でカウントする");
  assert.equal(headline.maxForecastSlipDays, 35);
  assert.equal(headline.maxForecastSlipTitle, "MS1");
  assert.match(headline.forecastSlipLabel, /\+35日/);

  const noSlip = navHeadline({
    objective: null, judgmentKey: "unassessed", judgmentReasons: [], nextDeadline: null,
    milestones: [milestone({ deltaDays: 0 })], criticalPathSlugs: [], dagValid: true, decisions: [],
  });
  assert.equal(noSlip.forecastSlipLabel, "予測遅延なし（比較1件）");
  assert.equal(noSlip.forecastSlipCount, 0);

  const notComparable = navHeadline({
    objective: null, judgmentKey: "unassessed", judgmentReasons: [], nextDeadline: null,
    milestones: [milestone({ plannedEnd: null, forecastEnd: null, deltaDays: null })], criticalPathSlugs: [], dagValid: true, decisions: [],
  });
  assert.equal(notComparable.forecastComparableCount, 0);
  assert.equal(notComparable.forecastSlipLabel, "予測差分未算定", "比較できる日付が無い時に『遅延なし』と断定しない");
}

// buildNavTimelineScale
{
  const noDates = buildNavTimelineScale([milestone({ plannedStart: null, plannedEnd: null, forecastEnd: null, actualEnd: null })], "2026-07-27");
  assert.equal(noDates.hasDates, false, "日付が1件もなければ未評価扱いにする");
  assert.equal(noDates.pct("2026-07-27"), null);

  const withDates = buildNavTimelineScale([milestone()], "2026-07-27");
  assert.equal(withDates.hasDates, true);
  assert.ok(withDates.pct("2026-07-01") >= 0 && withDates.pct("2026-08-01") <= 100);
  assert.ok(withDates.pct("2026-07-01") < withDates.pct("2026-08-01"), "時系列順にpctが増加する");
  assert.ok(withDates.todayPct != null);
}

// buildNavMilestoneNode: 基準計画・完了帯・予測延伸・前倒しを別レイヤーで持つ
{
  const scale = buildNavTimelineScale([milestone({ forecastEnd: "2026-09-05" })], "2026-07-27");
  const criticalSet = new Set(["m-1"]);

  const inProgress = buildNavMilestoneNode(milestone({ progressPct: 40, forecastEnd: "2026-08-01", deltaDays: 0 }), scale, criticalSet);
  assert.equal(inProgress.isCritical, true);
  assert.ok(inProgress.baselineSegment);
  assert.ok(inProgress.completeSegment);
  assert.ok(inProgress.completeSegment.endPct < inProgress.baselineSegment.endPct, "進捗40%なら完了帯は計画枠の途中で止まる");
  assert.equal(inProgress.slipSegment, null, "予測=計画なら延伸レイヤーは出さない");

  const slipped = buildNavMilestoneNode(milestone({ plannedEnd: "2026-08-01", forecastEnd: "2026-09-05", deltaDays: 35 }), scale, criticalSet);
  assert.ok(slipped.baselineSegment, "延伸があっても基準計画の枠自体は残す");
  assert.ok(slipped.slipSegment, "計画超過分は別レイヤーで持つ");
  assert.ok(slipped.slipSegment.startPct >= slipped.baselineSegment.endPct - 0.001, "延伸は基準計画の終端から始まる");
  assert.equal(slipped.deltaDays, 35);
  assert.equal(slipped.pulledInDays, null);

  const pulledIn = buildNavMilestoneNode(milestone({ plannedEnd: "2026-08-01", forecastEnd: "2026-07-20", deltaDays: -12 }), scale, criticalSet);
  assert.equal(pulledIn.slipSegment, null, "前倒しは延伸レイヤーに混ぜない");
  assert.equal(pulledIn.pulledInDays, 12, "前倒し日数を区別して持つ");

  const undated = buildNavMilestoneNode(milestone({ plannedStart: null, forecastEnd: null, plannedEnd: null }), scale, criticalSet);
  assert.equal(undated.hasDates, false);
  assert.equal(undated.baselineSegment, null, "日付未設定を線で捏造しない");
}

// buildNavDependencyEdges
{
  const edges = buildNavDependencyEdges(
    [
      { id: "d-1", predecessorSlug: "a", successorSlug: "b", predecessorMilestoneId: "", successorMilestoneId: "", dependencyType: "finish_to_start", required: true, lagDays: 0, note: null },
      { id: "d-2", predecessorSlug: "b", successorSlug: "c", predecessorMilestoneId: "", successorMilestoneId: "", dependencyType: "finish_to_start", required: true, lagDays: 0, note: null },
    ],
    ["a", "b"],
  );
  assert.equal(edges.find((edge) => edge.id === "d-1").isCriticalEdge, true);
  assert.equal(edges.find((edge) => edge.id === "d-2").isCriticalEdge, false, "重要経路の連続節点でない辺は強調しない");
}

// buildNavCriticalPath
{
  const milestones = [
    milestone({ slug: "a", title: "A", forecastEnd: "2026-07-10", plannedEnd: "2026-07-10", status: "completed" }),
    milestone({ slug: "b", title: "B", plannedStart: "2026-07-15", forecastEnd: "2026-08-01", plannedEnd: "2026-08-01", status: "attention", reasonCodes: ["owner_missing"], statusReason: "owner_missing" }),
    milestone({ slug: "c", title: "C", plannedStart: null, forecastEnd: null, plannedEnd: null, status: "unassessed" }),
  ];
  const deps = [
    { id: "d1", predecessorSlug: "a", successorSlug: "b", predecessorMilestoneId: "", successorMilestoneId: "", dependencyType: "finish_to_start", required: true, lagDays: 0, note: null },
  ];
  const steps = buildNavCriticalPath(milestones, ["a", "b", "c"], deps, true);
  assert.equal(steps.length, 3);
  assert.equal(steps[0].bufferDays, 5, "A終了(7/10)からB開始(7/15)までの接続余白を計算する");
  assert.equal(steps[0].isNextBottleneck, false, "完了済み節点は次のボトルネックにしない");
  assert.equal(steps[1].isNextBottleneck, true, "最初の未完了節点をボトルネックにする");
  assert.match(steps[1].delayReason, /担当未確認|理由/, "内部の英語reason codeを画面へ露出しない");
  assert.equal(steps[2].bufferLabel, "最終節点");
  assert.equal(steps[1].bufferDays, null, "次節点(C)の日付が無ければ余裕を捏造しない");
  assert.equal(steps[1].bufferLabel, "接続余白未算定");

  const brokenDag = buildNavCriticalPath(milestones, ["a", "b"], deps, false);
  assert.equal(brokenDag.length, 0, "DAG不成立ならクリティカルパスは空で返し呼び出し側が明示する");
}

// buildNavPartnerJourney
{
  const journey = buildNavPartnerJourney(
    partner({
      workItems: [
        { id: "w-1", partnerId: "p-1", side: "sx", itemKind: "task", title: "見積提出", detail: null, ownerLabel: "担当A", status: "open", dueDate: "2026-08-05", dueDatePrecision: "day", completionCriteria: null, completedOn: null, completionEvidence: null, acceptedBy: null, acceptedOn: null, handoffTo: "先方", relatedMilestoneId: null, lastVerifiedAt: "2026-07-20", confidence: "medium", sourceKind: "current_truth", sourceRef: null, sortOrder: 0 },
        { id: "w-2", partnerId: "p-1", side: "sx", itemKind: "task", title: "初回打合せ", detail: null, ownerLabel: "担当A", status: "completed", dueDate: null, dueDatePrecision: "day", completionCriteria: null, completedOn: "2026-07-10", completionEvidence: null, acceptedBy: null, acceptedOn: null, handoffTo: null, relatedMilestoneId: null, lastVerifiedAt: "2026-07-10", confidence: "medium", sourceKind: "current_truth", sourceRef: null, sortOrder: 1 },
      ],
      interactions: [
        { id: "i-1", partnerId: "p-1", interactionKind: "meeting", occurredOn: "2026-07-10", occurredOnPrecision: "day", summary: "初回面談を実施", outcomeSummary: null, ballSideAfter: "sx", ballOwnerAfter: "担当A", actorSide: "shared", actorLabel: null, confidence: "medium", sourceKind: "current_truth", sourceRef: null, createdAt: "2026-07-10T00:00:00Z" },
        { id: "i-2", partnerId: "p-1", interactionKind: "email", occurredOn: "2026-07-22", occurredOnPrecision: "day", summary: "見積依頼を受領", outcomeSummary: null, ballSideAfter: "sx", ballOwnerAfter: "担当A", actorSide: "partner", actorLabel: "先方担当", confidence: "medium", sourceKind: "current_truth", sourceRef: null, createdAt: "2026-07-22T00:00:00Z" },
      ],
    }),
    "2026-07-27",
  );
  assert.equal(journey.completedSteps.length, 1, "完了済みはcommitment/workItemだけを数え、interactionsを混ぜない");
  assert.ok(journey.latestInteraction, "直近接点は完了済みと別枠で持つ");
  assert.equal(journey.latestInteraction.id, "i-2", "最新のinteractionを直近接点として選ぶ");
  assert.match(journey.nextHandoffLabel, /見積提出/);
  assert.equal(journey.nextHandoffDueDate, "2026-08-05");
  assert.equal(journey.atDeadlineStateLabel, "本契約締結");
  assert.match(journey.currentStateLabel, /実行中/, "現在状態にrelationship stageを含める");
  assert.equal(journey.agreementStateLabel, "一部合意", "合意状態はDB値をそのまま表示し捏造しない");

  const noHandoff = buildNavPartnerJourney(partner({ nextCommitment: "未確認", dueDate: null, targetState: null }), "2026-07-27");
  assert.equal(noHandoff.nextHandoffLabel, "次の受け渡し未確認", "根拠がなければ次の一手を捏造しない");
  assert.equal(noHandoff.atDeadlineStateLabel, "目標状態未設定");
  assert.equal(noHandoff.latestInteraction, null, "interactionsが無ければ直近接点はnullのまま");

  const monthPrecisionPast = buildNavPartnerJourney(partner({ dueDate: "2026-06-01", dueDatePrecision: "month" }), "2026-07-27");
  assert.equal(monthPrecisionPast.isOverdue, false, "月精度の期限は日精度の期限超過集計に混ぜない");

  const alreadyAgreed = buildNavPartnerJourney(partner({ dueDate: "2026-06-01", agreementState: "agreed" }), "2026-07-27");
  assert.equal(alreadyAgreed.isOverdue, false, "合意済みの関係先を期限超過として再警告しない");
}

// buildNavPartnerJourney: 役割グルーピング（正式分類の捏造禁止）
{
  const structured = buildNavPartnerJourney(
    partner({ roles: [{ id: "r-1", partnerId: "p-1", roleKind: "customer", relationshipState: "in_progress", roleLabel: null, isPrimary: true, sortOrder: 0 }] }),
    "2026-07-27",
  );
  assert.equal(structured.groupKind, "structured_role");
  assert.match(structured.groupLabel, /顧客/);

  const pocByLabel = buildNavPartnerJourney(partner({ roles: [], roleLabel: "PoC候補（未接触）" }), "2026-07-27");
  assert.equal(pocByLabel.groupKind, "display_label_poc");
  assert.match(pocByLabel.groupLabel, /表示ラベル由来/, "正式分類ではなく表示ラベル由来であることを明示する");

  const unclassified = buildNavPartnerJourney(partner({ roles: [], roleLabel: "未分類の相手先" }), "2026-07-27");
  assert.equal(unclassified.groupKind, "unclassified");
  assert.equal(unclassified.groupLabel, "役割未分類", "根拠が無い分類を捏造しない");
}

// buildNavConstraintFlags
{
  const empty = buildNavConstraintFlags({ capacity: [], organizationRoles: [], fundingSnapshots: [], technicalTests: [] });
  assert.ok(empty.every((flag) => flag.severity === "unknown"), "データが無い制約は未確認のまま、順位付けせず全件unknownで返す");

  const withShortfall = buildNavConstraintFlags({
    capacity: [{ id: "c-1", track: "technology_development", milestoneId: null, roleLabel: "研究員", requiredPeople: 3, confirmedPeople: 1, availableHoursWeek: null, plannedHoursWeek: null, measurementDate: "2026-07-01", sourceLabel: "", confidence: "medium" }],
    organizationRoles: [{ id: "r-1", roleSlug: "coo", roleName: "COO", required: true, candidate: null, commitment: null, authority: "", vacancy: true, joinCondition: "", dueDate: null, status: "candidate", ownerLabel: "担当A", lastVerifiedAt: "2026-07-01", confidence: "low" }],
    fundingSnapshots: [{ id: "f-1", snapshotDate: "2026-07-01", requiredAmount: 1000, securedAmount: 400, unconfirmedAmount: null, useSummary: "", burnPerMonth: null, runwayMonths: 2, probability: null, cashCondition: "", sourceLabel: "", confidence: "medium" }],
    technicalTests: [{ id: "t-1", milestoneId: null, outcomeId: null, testSlug: "t1", testName: "耐圧試験", testCondition: "", target: null, actual: null, unit: "", repetition: null, sample: null, trlCriterion: "", evidence: null, status: "failed", measuredOn: null, ownerLabel: "担当A", confidence: "medium", sourceKind: "current_truth" }],
  });
  assert.equal(withShortfall.find((flag) => flag.key === "capacity-c-1").severity, "watch");
  assert.equal(withShortfall.find((flag) => flag.key === "role-r-1").severity, "watch");
  assert.equal(withShortfall.find((flag) => flag.key === "funding-runway").severity, "watch");
  assert.equal(withShortfall.find((flag) => flag.key === "technical-summary").severity, "watch");
}

// buildNavPendingDecisions: 画面へ渡すのは最小フィールドだけ
{
  const decisions = buildNavPendingDecisions([
    { id: "d-1", slug: "decision-d-1", issueId: null, hypothesisId: null, title: "価格方針を決める", context: "内部交渉メモ...", status: "open", rationale: "非公開の根拠...", decisionText: null, decidedBy: null, decidedOn: null, ownerLabel: "担当A", dueDate: "2026-08-01", isThisWeek: true, sortOrder: 0, confidence: "medium", lastVerifiedAt: "2026-07-20", sourceKind: "current_truth", sourceRef: "gmail:secret-thread-id", track: "business_development", actionItems: [] },
    { id: "d-2", slug: "decision-d-2", issueId: null, hypothesisId: null, title: "決定済み", context: "", status: "decided", rationale: "", decisionText: null, decidedBy: null, decidedOn: null, ownerLabel: "担当B", dueDate: null, isThisWeek: false, sortOrder: 1, confidence: "unknown", lastVerifiedAt: "2026-07-20", sourceKind: "current_truth", sourceRef: null, track: "funding", actionItems: [] },
  ]);
  assert.equal(decisions.length, 1, "openだけを判断待ちとして返す");
  const keys = Object.keys(decisions[0]).sort();
  assert.deepEqual(keys, ["dueDate", "id", "isThisWeek", "ownerLabel", "title"].sort(), "context/rationale/sourceRefなど非公開情報になり得るフィールドを含めない");
}

// buildSxNavigationViewModel: RSC境界へ渡す最小・serializableなmodel
{
  const model = buildSxNavigationViewModel({
    project: { projectId: "p21", projectName: "SolvioraX" },
    sxManagement: sxManagementBundle({
      milestones: [milestone()],
      partners: [partner()],
    }),
  });
  assert.equal(model.projectId, "p21");
  assert.equal(model.projectName, "SolvioraX");
  assert.equal(model.hasData, true);
  assert.equal(typeof model.timelineScale.pct, "undefined", "timelineScaleは関数を持たないserializable版にする");
  assert.ok(Array.isArray(model.timelineScale.axisTicks));
  assert.ok(Array.isArray(model.nodes));
  assert.ok(Array.isArray(model.partners));

  const json = JSON.stringify(model);
  assert.ok(json.length > 0, "modelはJSON.stringifyできる = RSCへ渡せるserializableな形");
  assert.ok(!json.includes("sourceRef"), "sourceRefキー自体をmodelへ含めない");
  assert.ok(!json.includes("changedBy"), "直近変化の更新者はこの画面へ送らない");
}

console.log("test_sx_navigation.mjs: all assertions passed");
