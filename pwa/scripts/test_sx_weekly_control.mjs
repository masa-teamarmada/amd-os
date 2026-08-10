import assert from "node:assert/strict";
import {
  sxWeeklyIssueIsOverdue,
  sxWeeklyIssueIsStale,
  sxWeeklyIssueLastActivity,
  sxWeeklyIssueNeedsAttention,
  sxWeeklyIssueNextDueDate,
  sxWeeklyIssueNextMove,
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

console.log("sx weekly control tests passed");
