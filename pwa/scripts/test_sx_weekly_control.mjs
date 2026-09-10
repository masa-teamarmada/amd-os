import assert from "node:assert/strict";
import {
  sxReorderIssueList,
  sxWeeklyIssueIsOverdue,
  sxWeeklyIssueIsStale,
  sxWeeklyIssueLastActivity,
  sxWeeklyIssueNeedsAttention,
  sxWeeklyIssueNextDueDate,
  sxWeeklyIssueNextMove,
  sxWeeklyIssueOrder,
  sxWeeklyIssueStage,
  sxWeeklyWeekRangeLabel,
} from "../src/lib/sx-weekly-control.ts";

function issue(overrides = {}) {
  return {
    id: "issue-1",
    slug: "issue-1",
    track: "technology_development",
    milestoneSlug: null,
    title: "再現性を確認する",
    background: null,
    knowledgeType: "hypothesis",
    status: "open",
    sortOrder: 0,
    hypothesis: "",
    evidenceFor: "",
    counterevidenceOrMissing: "",
    nextValidation: "",
    ownerLabel: "担当A",
    dueDate: "2026-07-31",
    decisionText: null,
    lastVerifiedAt: "2026-07-26",
    confidence: "unknown",
    sourceKind: "manual",
    sourceRef: null,
    relatedMilestoneSlugs: [],
    relatedPartnerSlugs: [],
    hypotheses: [],
    evidence: [],
    validationRuns: [],
    discussions: [],
    decisions: [],
    actionItems: [],
    ...overrides,
  };
}

const hypothesis = {
  id: "hyp-1",
  issueId: "issue-1",
  statement: "条件Aなら再現する",
  status: "open",
  ownerLabel: "担当A",
  dueDate: "2026-07-29",
  confidence: "medium",
  lastVerifiedAt: "2026-07-27",
  sourceKind: "manual",
  sourceRef: null,
};

assert.equal(sxWeeklyWeekRangeLabel("2026-07-27"), "7/27 — 8/2", "週範囲は実行環境のtimezoneに依存しない");
assert.equal(sxWeeklyWeekRangeLabel("日付未設定"), "日付未設定", "日付形式でなければ元の表示を維持する");

assert.equal(sxWeeklyIssueStage(issue()), "intake", "仮説なしの未解決論点は要整理");
assert.equal(sxWeeklyIssueNeedsAttention(issue(), "2026-07-27"), true, "仮説なしは要フォロー");

const validating = issue({
  hypotheses: [{ ...hypothesis, status: "validating" }],
  validationRuns: [{ id: "run-1", hypothesisId: "hyp-1", validationKind: "再現試験", plannedOn: "2026-07-27", dueDate: "2026-07-28", completedOn: null, status: "running", ownerLabel: "担当A", method: "3回試験", resultSummary: null, confidence: "medium", sourceKind: "manual", sourceRef: null }],
});
assert.equal(sxWeeklyIssueStage(validating), "validating", "実施中検証は検証中");
assert.equal(sxWeeklyIssueNextDueDate(validating), "2026-07-28", "親より早い子の期限を採用");

const decision = issue({ hypotheses: [{ ...hypothesis, status: "validated" }] });
assert.equal(sxWeeklyIssueStage(decision), "decision", "検証済み仮説は判断待ち");

const rejected = issue({ hypotheses: [{ ...hypothesis, status: "rejected" }] });
assert.equal(sxWeeklyIssueStage(rejected), "resolved", "全仮説棄却は完了列");
assert.equal(sxWeeklyIssueNeedsAttention(rejected, "2026-07-27"), false, "完了列に放置警報を残さない");

const decidedWithAction = issue({
  status: "closed",
  hypotheses: [{ ...hypothesis, status: "decided" }],
  actionItems: [{ id: "action-1", decisionId: "decision-1", title: "試験条件を共有", ownerLabel: "担当A", dueDate: "2026-07-30", completionCriteria: "共有済み", nextReviewOn: "2026-07-31", status: "open", completionNote: null, completedAt: null, lastVerifiedAt: "2026-07-27", sourceKind: "manual" }],
});
assert.equal(sxWeeklyIssueStage(decidedWithAction), "resolved", "判断後は決定列へ置く");
assert.equal(sxWeeklyIssueNeedsAttention(decidedWithAction, "2026-07-27"), true, "決定後の未完了行動は介入候補に残す");
assert.equal(sxWeeklyIssueNextMove(decidedWithAction, "2026-07-27")?.label, "試験条件を共有", "決定後の未完了行動を次の動きに出す");

const urgencySorted = issue({
  hypotheses: [{ ...hypothesis, status: "validating" }],
  validationRuns: [{ id: "run-2", hypothesisId: "hyp-1", validationKind: "顧客確認", plannedOn: "2026-07-27", dueDate: "2026-07-28", completedOn: null, status: "running", ownerLabel: "担当A", method: "顧客へ条件を確認", resultSummary: null, confidence: "medium", sourceKind: "manual", sourceRef: null }],
  decisions: [{ id: "decision-2", issueId: "issue-1", hypothesisId: null, title: "試験条件を決める", context: "", status: "open", rationale: "", decisionText: null, decidedBy: null, decidedOn: null, ownerLabel: "担当A", dueDate: "2026-07-29", isThisWeek: true, sortOrder: 0, confidence: "unknown", lastVerifiedAt: "2026-07-27", sourceKind: "manual", sourceRef: null, track: "technology_development", actionItems: [] }],
  actionItems: [{ id: "action-2", decisionId: "decision-2", title: "停止理由を解消", ownerLabel: "担当A", dueDate: "2026-08-01", completionCriteria: "再開可能", nextReviewOn: "2026-07-28", status: "blocked", completionNote: null, completedAt: null, lastVerifiedAt: "2026-07-27", sourceKind: "manual" }],
});
assert.equal(sxWeeklyIssueNextMove(urgencySorted, "2026-07-27")?.label, "停止理由を解消", "停止中の行動を期日が近い通常項目より優先する");

const childUpdated = issue({
  lastVerifiedAt: "2026-07-01",
  hypotheses: [{ ...hypothesis, lastVerifiedAt: "2026-07-27" }],
});
assert.equal(sxWeeklyIssueLastActivity(childUpdated), "2026-07-27", "子の更新日を親の鮮度へ反映");
assert.equal(sxWeeklyIssueIsStale(childUpdated, "2026-07-27"), false, "子更新済みを更新切れにしない");

const discussedRecently = issue({
  lastVerifiedAt: "2026-07-01",
  discussions: [{ id: "discussion-1", issueId: "issue-1", summary: "前提条件を整理", discussedOn: "2026-07-27", createdAt: "2026-07-27T01:00:00Z" }],
});
assert.equal(sxWeeklyIssueLastActivity(discussedRecently), "2026-07-27", "議論の追記を親の鮮度へ反映");
assert.equal(sxWeeklyIssueIsStale(discussedRecently, "2026-07-27"), false, "議論更新済みを更新切れにしない");

const missingActivity = issue({ lastVerifiedAt: "", hypotheses: [] });
assert.equal(sxWeeklyIssueIsStale(missingActivity, "2026-07-27"), true, "日付欠損は0日扱いしない");

const overdueChild = issue({
  dueDate: null,
  hypotheses: [{ ...hypothesis, dueDate: "2026-07-20" }],
});
assert.equal(sxWeeklyIssueIsOverdue(overdueChild, "2026-07-27"), true, "子の期限超過を拾う");
assert.equal(sxWeeklyIssueIsOverdue(issue({ status: "closed", dueDate: "2026-07-20" }), "2026-07-27"), false, "完了論点は期限超過にしない");

// --- 論点・仮説リストの手動並び替え (2026-09-10 まさ指示) ---------------------------------
const ordering = [
  issue({ id: "a", sortOrder: 0 }),
  issue({ id: "b", sortOrder: 10 }),
  issue({ id: "c", sortOrder: 20 }),
];

assert.deepEqual(
  sxWeeklyIssueOrder([ordering[2], ordering[0], ordering[1]], "2026-07-27").map((row) => row.id),
  ["a", "b", "c"],
  "手動の並び順が第一キー",
);
assert.deepEqual(
  sxWeeklyIssueOrder(
    [
      issue({ id: "new", sortOrder: -10, dueDate: null, hypotheses: [] }),
      ordering[0],
      ordering[1],
    ],
    "2026-07-27",
  ).map((row) => row.id),
  ["new", "a", "b"],
  "新しく足した論点 (sort_orderが最小) は一番上",
);
assert.deepEqual(
  sxWeeklyIssueOrder(
    [
      issue({ id: "fresh", sortOrder: 0, dueDate: "2026-08-31", lastVerifiedAt: "2026-07-27" }),
      issue({ id: "overdue", sortOrder: 0, dueDate: "2026-07-01", lastVerifiedAt: "2026-07-27" }),
    ],
    "2026-07-27",
  ).map((row) => row.id),
  ["overdue", "fresh"],
  "sort_orderが同値のときだけ自動の要フォロー順へ落ちる",
);

const movedDown = sxReorderIssueList(ordering, "a", { issueId: "c", place: "after" });
assert.deepEqual(movedDown.nextOrder.map((row) => row.id), ["b", "c", "a"], "下へ落とすと最後尾へ");
assert.deepEqual(
  movedDown.moved.map(({ issue: row, sortOrder }) => [row.id, sortOrder]),
  [["b", 0], ["c", 10], ["a", 20]],
  "動いた行だけを10刻みで振り直す",
);

const movedUp = sxReorderIssueList(ordering, "c", { issueId: "a", place: "before" });
assert.deepEqual(movedUp.nextOrder.map((row) => row.id), ["c", "a", "b"], "上へ落とすと先頭へ");

assert.equal(sxReorderIssueList(ordering, "a", { issueId: "a", place: "before" }), null, "自分自身へは落とせない");
assert.equal(sxReorderIssueList(ordering, "a", { issueId: "b", place: "before" }), null, "位置が変わらないなら保存に行かない");
assert.equal(sxReorderIssueList(ordering, "zzz", { issueId: "b", place: "after" }), null, "掴んだ論点が消えていたら保存に行かない");
assert.equal(sxReorderIssueList(ordering, "a", { issueId: "zzz", place: "after" }), null, "落とし先が消えていたら保存に行かない");

// 絞り込みで隠れている論点をまたいで落としても、隠れている行の相対順は壊れない。
const withHidden = [
  issue({ id: "visible-1", sortOrder: 0 }),
  issue({ id: "hidden", sortOrder: 10 }),
  issue({ id: "visible-2", sortOrder: 20 }),
];
assert.deepEqual(
  sxReorderIssueList(withHidden, "visible-2", { issueId: "visible-1", place: "before" }).nextOrder.map((row) => row.id),
  ["visible-2", "visible-1", "hidden"],
  "隠れている論点も含めた全体を振り直す",
);

console.log("sx weekly control tests passed");
