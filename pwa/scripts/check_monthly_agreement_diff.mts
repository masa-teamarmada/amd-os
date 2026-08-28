#!/usr/bin/env node
/**
 * monthly-work-agreement-diff.ts (needs_reagreement 変更点diff) 回帰テスト
 *
 * 検証項目:
 *   1. previous が null → comparable:false + フォールバックnote、count:0
 *   2. previous が v1(旧形式)/schemaVersion不明 → comparable:false + フォールバックnote
 *   3. v2 同士で expectedRewardYen / roleLabel が変わった → 対応するchangeが1件ずつ出る
 *   4. milestone 追加・削除・pt/割合/役割/作業内容変更がそれぞれ検出される
 *   5. project 追加・削除が検出される
 *   6. 完全に同一の snapshot → comparable:true, count:0, groups:[]
 *
 * 実行: node --experimental-strip-types scripts/check_monthly_agreement_diff.mts
 */
import assert from "node:assert/strict";
import {
  diffMonthlyAgreementSnapshots,
  diffMonthlyAgreementTerms,
  explainExpectedRewardChanges,
  projectIdsWithExpectedRewardChange,
} from "../src/lib/monthly-work-agreement-diff.ts";
import type {
  MonthlyWorkAgreementMilestone,
  MonthlyWorkAgreementPayoutScheduleEntry,
  MonthlyWorkAgreementProject,
  MonthlyWorkAgreementSnapshot,
} from "../src/lib/monthly-work-agreement-types.ts";

function milestone(overrides: Partial<MonthlyWorkAgreementMilestone> = {}): MonthlyWorkAgreementMilestone {
  return {
    milestoneId: "ms1",
    title: "テストMS",
    points: 10,
    plannedShare: 0.5,
    role: "実装",
    taskDescription: "実装作業",
    progressPct: 50,
    monthlyProgressPct: 50,
    expectedRewardYen: 100000,
    earnedPt: 5,
    conditions: [],
    state: "ready",
    ...overrides,
  };
}

function payoutEntry(
  overrides: Partial<MonthlyWorkAgreementPayoutScheduleEntry> = {},
): MonthlyWorkAgreementPayoutScheduleEntry {
  return {
    sourceYm: "202607",
    paymentYm: "202608",
    status: "scheduled",
    basePayYen: 100000,
    carryInYen: 0,
    grossDueYen: 100000,
    totalPayYen: 100000,
    totalPayTaxIncludedYen: 110000,
    stockYen: 0,
    isCurrentYm: true,
    isProtected: false,
    isActualPaid: false,
    amountSource: "reward_cache",
    ...overrides,
  };
}

function project(overrides: Partial<MonthlyWorkAgreementProject> = {}): MonthlyWorkAgreementProject {
  return {
    projectId: "p1",
    projectName: "テストPJ",
    projectStatus: "active",
    roleLabel: "PM",
    isPm: true,
    isPl: false,
    billingStatus: null,
    allocationStatus: "active",
    expectedRewardYen: 100000,
    currentMonthAccrualYen: 100000,
    payoutYen: null,
    currentCyclePayoutYen: null,
    paymentYm: null,
    stockYen: null,
    grossDueYen: null,
    carryInYen: null,
    earnedPt: null,
    conditionState: "ready",
    conditions: [],
    reviewReasons: [],
    milestones: [milestone()],
    payoutSchedule: [payoutEntry()],
    routineExpectations: [],
    memberAllocations: [],
    allocationTotals: { memberCount: 0, earnedPt: 0, accrualYen: 0, payYen: 0 },
    ...overrides,
  };
}

function snapshot(projects: MonthlyWorkAgreementProject[]): MonthlyWorkAgreementSnapshot {
  return {
    schemaVersion: "monthly_work_agreement.v2",
    ym: "202607",
    member: { memberId: "M001", codeName: "テスト" },
    projects,
    totals: {
      expectedRewardYen: projects.reduce((sum, p) => sum + (p.expectedRewardYen ?? 0), 0),
      currentMonthAccrualYen: projects.reduce((sum, p) => sum + (p.currentMonthAccrualYen ?? 0), 0),
      carryInYen: 0,
      stockYen: 0,
      paidActualYen: 0,
      unverifiedPaidYen: 0,
      futurePayoutYen: 0,
      projectCount: projects.length,
      reviewRequiredCount: 0,
    },
  };
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectLabel(
  prev: MonthlyWorkAgreementSnapshot,
  cur: MonthlyWorkAgreementSnapshot,
  labelSubstring: string,
  caseLabel: string,
) {
  const result = diffMonthlyAgreementSnapshots(prev, cur);
  assert.equal(result.comparable, true, `${caseLabel}: comparable`);
  const allLabels = result.groups.flatMap((g) => g.changes.map((c) => c.label));
  assert.ok(
    allLabels.some((l) => l.includes(labelSubstring)),
    `${caseLabel}: expected label containing "${labelSubstring}", got [${allLabels.join(", ")}]`,
  );
}

// 1. previous が null
{
  const result = diffMonthlyAgreementSnapshots(null, snapshot([project()]));
  assert.equal(result.comparable, false);
  assert.equal(result.count, 0);
  assert.deepEqual(result.groups, []);
  assert.ok(result.note && result.note.includes("見つからない"));
}

// 2. previous が v1/旧形式・不明形式
{
  const legacy = { schemaVersion: "monthly_work_agreement.v1", ym: "202606", projects: [] };
  const result = diffMonthlyAgreementSnapshots(legacy, snapshot([project()]));
  assert.equal(result.comparable, false);
  assert.equal(result.count, 0);
  assert.ok(result.note && result.note.includes("古い"));

  const unknown = { foo: "bar" };
  const result2 = diffMonthlyAgreementSnapshots(unknown, snapshot([project()]));
  assert.equal(result2.comparable, false);
  assert.ok(result2.note);
}

// 3. expectedRewardYen / roleLabel 変更
{
  const prev = snapshot([project({ expectedRewardYen: 100000, roleLabel: "PM" })]);
  const cur = snapshot([project({ expectedRewardYen: 150000, roleLabel: "PL" })]);
  const result = diffMonthlyAgreementSnapshots(prev, cur);
  assert.equal(result.comparable, true);
  const projectGroup = result.groups.find((g) => g.projectId === "p1");
  assert.ok(projectGroup);
  const labels = projectGroup!.changes.map((c) => c.label);
  assert.ok(labels.includes("もらえる予定額"));
  assert.ok(labels.includes("役割"));
  const rewardChange = projectGroup!.changes.find((c) => c.label === "もらえる予定額");
  assert.equal(rewardChange?.before, "¥100,000");
  assert.equal(rewardChange?.after, "¥150,000");
  assert.deepEqual(projectIdsWithExpectedRewardChange(prev, cur), ["p1"]);
}

// 3b. 理由必須PJは予定額が変わったPJだけ。比較不能な旧snapshotでは保守的に全PJを対象にする。
{
  const prev = snapshot([
    project({ projectId: "p1", expectedRewardYen: 100000 }),
    project({ projectId: "p2", expectedRewardYen: 80000 }),
  ]);
  const cur = snapshot([
    project({ projectId: "p1", expectedRewardYen: 100000 }),
    project({ projectId: "p2", expectedRewardYen: 90000 }),
  ]);
  assert.deepEqual(projectIdsWithExpectedRewardChange(prev, cur), ["p2"]);
  assert.deepEqual(projectIdsWithExpectedRewardChange(null, cur), ["p1", "p2"]);
  assert.deepEqual(
    projectIdsWithExpectedRewardChange(snapshot([project({ projectId: "p1" }), project({ projectId: "p3" })]), snapshot([project({ projectId: "p1" })])),
    ["p3"],
  );
}

// 4. milestone 追加/削除/変更
{
  const prev = snapshot([
    project({
      milestones: [
        milestone({ milestoneId: "ms1", title: "MS1", expectedRewardYen: 50000, plannedShare: 0.5, role: "実装", taskDescription: "A" }),
        milestone({ milestoneId: "ms2", title: "MS2" }),
      ],
    }),
  ]);
  const cur = snapshot([
    project({
      milestones: [
        milestone({ milestoneId: "ms1", title: "MS1", expectedRewardYen: 80000, plannedShare: 0.8, role: "設計", taskDescription: "B" }),
        milestone({ milestoneId: "ms3", title: "MS3" }),
      ],
    }),
  ]);
  const result = diffMonthlyAgreementSnapshots(prev, cur);
  assert.equal(result.comparable, true);
  const changes = result.groups[0].changes;
  const labels = changes.map((c) => c.label);
  assert.ok(labels.some((l) => l.includes("MS1") && l.includes("予定額")));
  assert.ok(labels.some((l) => l.includes("MS1") && l.includes("担当割合")));
  assert.ok(labels.some((l) => l.includes("MS1") && l.includes("役割")));
  assert.ok(labels.some((l) => l.includes("MS1") && l.includes("作業内容")));
  assert.ok(labels.some((l) => l.includes("MS2")));
  assert.ok(labels.some((l) => l.includes("MS3")));
}

// 5. project 追加/削除
{
  const prev = snapshot([project({ projectId: "p1", projectName: "PJ1" })]);
  const cur = snapshot([
    project({ projectId: "p1", projectName: "PJ1" }),
    project({ projectId: "p2", projectName: "PJ2" }),
  ]);
  const result = diffMonthlyAgreementSnapshots(prev, cur);
  assert.equal(result.comparable, true);
  const p2Group = result.groups.find((g) => g.projectId === "p2");
  assert.ok(p2Group);
  assert.equal(p2Group?.changes[0]?.label, "対象プロジェクト");
  assert.equal(p2Group?.changes[0]?.after, "対象");
}

// 6. 完全同一 → count:0, groups:[], note:null (UIがhash不一致fallbackを担う)
{
  const snap = snapshot([project()]);
  const result = diffMonthlyAgreementSnapshots(snap, snapshot([project()]));
  assert.equal(result.comparable, true);
  assert.equal(result.count, 0);
  assert.deepEqual(result.groups, []);
  assert.equal(result.note, null);
}

// 7. table-driven mutation coverage: snapshot/member/totals フィールド全件
{
  const cases: Array<{ caseLabel: string; label: string; mutate: (s: MonthlyWorkAgreementSnapshot) => void }> = [
    { caseLabel: "ym", label: "対象月", mutate: (s) => { s.ym = "202608"; } },
    { caseLabel: "member.memberId", label: "メンバーID", mutate: (s) => { s.member.memberId = "M999"; } },
    { caseLabel: "member.codeName", label: "コードネーム", mutate: (s) => { s.member.codeName = "別名"; } },
    { caseLabel: "member.email", label: "メールアドレス", mutate: (s) => { s.member.email = "new@example.com"; } },
    { caseLabel: "member.isAdmin", label: "管理者権限", mutate: (s) => { s.member.isAdmin = true; } },
    {
      caseLabel: "member.excludeFromPayoutNotice",
      label: "支払通知の対象外設定",
      mutate: (s) => { s.member.excludeFromPayoutNotice = true; },
    },
    { caseLabel: "totals.expectedRewardYen", label: "もらえる予定額 (合計)", mutate: (s) => { s.totals.expectedRewardYen = 999999; } },
    { caseLabel: "totals.stockYen", label: "ストック (合計)", mutate: (s) => { s.totals.stockYen = 5000; } },
    { caseLabel: "totals.paidActualYen", label: "実支払済 (合計)", mutate: (s) => { s.totals.paidActualYen = 5000; } },
    { caseLabel: "totals.unverifiedPaidYen", label: "未確認支払 (合計)", mutate: (s) => { s.totals.unverifiedPaidYen = 5000; } },
    { caseLabel: "totals.futurePayoutYen", label: "将来支払予定 (合計)", mutate: (s) => { s.totals.futurePayoutYen = 5000; } },
    { caseLabel: "totals.projectCount", label: "プロジェクト数", mutate: (s) => { s.totals.projectCount = 99; } },
    { caseLabel: "totals.reviewRequiredCount", label: "要確認件数", mutate: (s) => { s.totals.reviewRequiredCount = 3; } },
  ];

  for (const { caseLabel, label, mutate } of cases) {
    const prev = snapshot([project()]);
    const cur = deepClone(prev);
    mutate(cur);
    expectLabel(prev, cur, label, caseLabel);
  }
}

// 8. table-driven mutation coverage: project フィールド全件
{
  const cases: Array<{ caseLabel: string; label: string; mutate: (p: MonthlyWorkAgreementProject) => void }> = [
    { caseLabel: "projectName", label: "プロジェクト名", mutate: (p) => { p.projectName = "別PJ"; } },
    { caseLabel: "projectStatus", label: "プロジェクトステータス", mutate: (p) => { p.projectStatus = "closed"; } },
    { caseLabel: "roleLabel", label: "役割", mutate: (p) => { p.roleLabel = "メンバー"; } },
    { caseLabel: "isPm", label: "PM担当", mutate: (p) => { p.isPm = false; } },
    { caseLabel: "isPl", label: "PL担当", mutate: (p) => { p.isPl = true; } },
    { caseLabel: "billingStatus", label: "請求ステータス", mutate: (p) => { p.billingStatus = "invoiced"; } },
    { caseLabel: "allocationStatus", label: "アロケーションステータス", mutate: (p) => { p.allocationStatus = "closed"; } },
    { caseLabel: "expectedRewardYen", label: "もらえる予定額", mutate: (p) => { p.expectedRewardYen = 200000; } },
    { caseLabel: "payoutYen", label: "支払額", mutate: (p) => { p.payoutYen = 30000; } },
    { caseLabel: "currentCyclePayoutYen", label: "当サイクル支払額", mutate: (p) => { p.currentCyclePayoutYen = 30000; } },
    { caseLabel: "paymentYm", label: "支払月", mutate: (p) => { p.paymentYm = "202609"; } },
    { caseLabel: "stockYen", label: "ストック額", mutate: (p) => { p.stockYen = 1000; } },
    { caseLabel: "grossDueYen", label: "支払確定前総額", mutate: (p) => { p.grossDueYen = 1000; } },
    { caseLabel: "carryInYen", label: "繰越額", mutate: (p) => { p.carryInYen = 1000; } },
    { caseLabel: "earnedPt", label: "獲得pt", mutate: (p) => { p.earnedPt = 42; } },
    { caseLabel: "conditionState", label: "確認状態", mutate: (p) => { p.conditionState = "review_required"; } },
    { caseLabel: "conditions", label: "条件", mutate: (p) => { p.conditions = ["条件A"]; } },
    { caseLabel: "reviewReasons", label: "要確認理由", mutate: (p) => { p.reviewReasons = ["理由A"]; } },
    { caseLabel: "routineExpectations", label: "ルーティン期待値", mutate: (p) => { p.routineExpectations = ["期待値A"]; } },
  ];

  for (const { caseLabel, label, mutate } of cases) {
    const prev = snapshot([project()]);
    const cur = deepClone(prev);
    mutate(cur.projects[0]);
    expectLabel(prev, cur, label, caseLabel);
  }
}

// 9. table-driven mutation coverage: milestone フィールド全件
{
  const cases: Array<{ caseLabel: string; label: string; mutate: (m: MonthlyWorkAgreementMilestone) => void }> = [
    { caseLabel: "milestone.title", label: "の名称", mutate: (m) => { m.title = "別MS"; } },
    { caseLabel: "milestone.points", label: "のポイント", mutate: (m) => { m.points = 99; } },
    { caseLabel: "milestone.plannedShare", label: "の担当割合", mutate: (m) => { m.plannedShare = 0.9; } },
    { caseLabel: "milestone.role", label: "の役割", mutate: (m) => { m.role = "レビュー"; } },
    { caseLabel: "milestone.taskDescription", label: "の作業内容", mutate: (m) => { m.taskDescription = "別作業"; } },
    { caseLabel: "milestone.progressPct", label: "の進捗率", mutate: (m) => { m.progressPct = 80; } },
    { caseLabel: "milestone.monthlyProgressPct", label: "の当月進捗率", mutate: (m) => { m.monthlyProgressPct = 80; } },
    { caseLabel: "milestone.expectedRewardYen", label: "の予定額", mutate: (m) => { m.expectedRewardYen = 60000; } },
    { caseLabel: "milestone.earnedPt", label: "の獲得pt", mutate: (m) => { m.earnedPt = 9; } },
    { caseLabel: "milestone.conditions", label: "の条件", mutate: (m) => { m.conditions = ["MS条件"]; } },
    { caseLabel: "milestone.state", label: "の状態", mutate: (m) => { m.state = "review_required"; } },
  ];

  for (const { caseLabel, label, mutate } of cases) {
    const prev = snapshot([project()]);
    const cur = deepClone(prev);
    mutate(cur.projects[0].milestones[0]);
    expectLabel(prev, cur, label, caseLabel);
  }
}

// 10. table-driven mutation coverage: payoutSchedule フィールド全件
{
  const cases: Array<{
    caseLabel: string;
    label: string;
    mutate: (e: MonthlyWorkAgreementPayoutScheduleEntry) => void;
  }> = [
    { caseLabel: "payout.paymentYm", label: "の支払月", mutate: (e) => { e.paymentYm = "202610"; } },
    { caseLabel: "payout.status", label: "のステータス", mutate: (e) => { e.status = "paid"; } },
    { caseLabel: "payout.basePayYen", label: "の基本支払額", mutate: (e) => { e.basePayYen = 200000; } },
    { caseLabel: "payout.carryInYen", label: "の繰越額", mutate: (e) => { e.carryInYen = 1000; } },
    { caseLabel: "payout.grossDueYen", label: "の支払確定前総額", mutate: (e) => { e.grossDueYen = 200000; } },
    { caseLabel: "payout.totalPayYen", label: "の支払総額", mutate: (e) => { e.totalPayYen = 200000; } },
    {
      caseLabel: "payout.totalPayTaxIncludedYen",
      label: "の税込支払総額",
      mutate: (e) => { e.totalPayTaxIncludedYen = 220000; },
    },
    { caseLabel: "payout.stockYen", label: "のストック額", mutate: (e) => { e.stockYen = 5000; } },
    { caseLabel: "payout.isCurrentYm", label: "の当月フラグ", mutate: (e) => { e.isCurrentYm = false; } },
    { caseLabel: "payout.isProtected", label: "の保護フラグ", mutate: (e) => { e.isProtected = true; } },
    { caseLabel: "payout.isActualPaid", label: "の実支払済フラグ", mutate: (e) => { e.isActualPaid = true; } },
    { caseLabel: "payout.amountSource", label: "の金額根拠", mutate: (e) => { e.amountSource = "actual_paid"; } },
  ];

  for (const { caseLabel, label, mutate } of cases) {
    const prev = snapshot([project()]);
    const cur = deepClone(prev);
    mutate(cur.projects[0].payoutSchedule[0]);
    expectLabel(prev, cur, label, caseLabel);
  }

  // 追加/削除
  {
    const prev = snapshot([project({ payoutSchedule: [] })]);
    const cur = snapshot([project({ payoutSchedule: [payoutEntry({ sourceYm: "202607" })] })]);
    const result = diffMonthlyAgreementSnapshots(prev, cur);
    const labels = result.groups.flatMap((g) => g.changes.map((c) => c.label));
    assert.ok(labels.some((l) => l.includes("支払予定") && l.includes("202607")));
  }
}

// 11. malformed nested v2 (member/totals欠落、projects内部が壊れている) → comparable:false
{
  const malformedNoMember = {
    schemaVersion: "monthly_work_agreement.v2",
    ym: "202607",
    projects: [],
    totals: { expectedRewardYen: 0, stockYen: 0, projectCount: 0, reviewRequiredCount: 0 },
  };
  const result = diffMonthlyAgreementSnapshots(malformedNoMember, snapshot([project()]));
  assert.equal(result.comparable, false);

  const malformedProjectsNotArray = {
    schemaVersion: "monthly_work_agreement.v2",
    ym: "202607",
    member: { memberId: "M001", codeName: "テスト" },
    projects: "not-an-array",
    totals: { expectedRewardYen: 0, stockYen: 0, projectCount: 0, reviewRequiredCount: 0 },
  };
  const result2 = diffMonthlyAgreementSnapshots(malformedProjectsNotArray, snapshot([project()]));
  assert.equal(result2.comparable, false);

  const malformedMilestoneShape = {
    schemaVersion: "monthly_work_agreement.v2",
    ym: "202607",
    member: { memberId: "M001", codeName: "テスト" },
    projects: [
      {
        projectId: "p1",
        projectName: "テストPJ",
        milestones: [{ milestoneId: "ms1" }],
        payoutSchedule: [],
      },
    ],
    totals: { expectedRewardYen: 0, stockYen: 0, projectCount: 1, reviewRequiredCount: 0 },
  };
  const result3 = diffMonthlyAgreementSnapshots(malformedMilestoneShape, snapshot([project()]));
  assert.equal(result3.comparable, false);
}

// 12. malformed scalar v2 project field (number where string expected) → no throw, textOrUnset stringifies safely
{
  const malformedScalarField = {
    schemaVersion: "monthly_work_agreement.v2",
    ym: "202607",
    member: { memberId: "M001", codeName: "テスト" },
    projects: [
      {
        projectId: "p1",
        projectName: "テストPJ",
        roleLabel: 12345,
        milestones: [],
        payoutSchedule: [],
      },
    ],
    totals: { expectedRewardYen: 0, stockYen: 0, projectCount: 1, reviewRequiredCount: 0 },
  };
  assert.doesNotThrow(() => {
    diffMonthlyAgreementSnapshots(malformedScalarField, snapshot([project({ roleLabel: "PM" })]));
  }, "malformed scalar field must not throw");
}

// 13. billingStatus/allocationStatus 変更 → 生の技術値ではなく日本語ラベルが before/after に出る
{
  const prev = snapshot([project({ billingStatus: "budget_confirmed", allocationStatus: "confirmed" })]);
  const cur = snapshot([project({ billingStatus: "invoice_sent", allocationStatus: "reported" })]);
  const result = diffMonthlyAgreementSnapshots(prev, cur);
  assert.equal(result.comparable, true);
  const changes = result.groups[0].changes;
  const billingChange = changes.find((c) => c.label === "請求ステータス");
  assert.equal(billingChange?.before, "予算確認済み");
  assert.equal(billingChange?.after, "請求書送付済み");
  const allocationChange = changes.find((c) => c.label === "アロケーションステータス");
  assert.equal(allocationChange?.before, "確定済み");
  assert.equal(allocationChange?.after, "報告済み");
}

console.log("monthly-work-agreement-diff regression: ok");

// ---------------------------------------------------------------------------
// explainExpectedRewardChanges: 予定額が変わった理由をOSが説明できるか
//
// 予定額はMS消化pt・繰越・支払枠から自動計算されるので、変わるたびに人間へ理由を
// 書かせると誰も書けないまま合意が止まり、支払通知書も出せなくなる (2026-08-28)。
// 要因を数値で示せたものは explained:true にして、管理側の理由入力なしで合意させる。
// ---------------------------------------------------------------------------

// 14. 合意額の定義変更 (currentMonthAccrualYen が後から入った) を、OSが説明できる
{
  const prev = snapshot([project({ expectedRewardYen: 20985, currentMonthAccrualYen: null })]);
  const cur = snapshot([project({ expectedRewardYen: 8190, currentMonthAccrualYen: 25526 })]);
  const explanations = explainExpectedRewardChanges(prev, cur);
  assert.equal(explanations.length, 1, "予定額が変わったPJの説明が1件出る");
  assert.equal(explanations[0].explained, true, "定義変更はOSが説明できる (人間の理由入力を要求しない)");
  assert.ok(
    explanations[0].details.some((detail) => detail.includes("合意する金額の意味が変わりました")),
    "定義が変わったことを本文で説明する",
  );
}

// 15. 支払枠に収まらない分は「翌月以降へ」と説明する
{
  const prev = snapshot([project({ expectedRewardYen: 30000, currentMonthAccrualYen: 30000 })]);
  const cur = snapshot([project({ expectedRewardYen: 8190, currentMonthAccrualYen: 25526 })]);
  const explanations = explainExpectedRewardChanges(prev, cur);
  assert.equal(explanations[0].explained, true);
  assert.ok(
    explanations[0].details.some((detail) => detail.includes("翌月以降")),
    "支払枠で今月払えない分の行き先を説明する",
  );
}

// 16. 過去の未払いを返済して増えた月は、増えた理由を内訳で説明する
{
  const prev = snapshot([project({ expectedRewardYen: 8100, currentMonthAccrualYen: 8100 })]);
  const cur = snapshot([project({ expectedRewardYen: 23205, currentMonthAccrualYen: 8100 })]);
  const explanations = explainExpectedRewardChanges(prev, cur);
  assert.equal(explanations[0].explained, true);
  assert.ok(
    explanations[0].details.some((detail) => detail.includes("過去の未払いからの返済")),
    "増額分が過去の未払いの返済であることを説明する",
  );
}

// 17. 前回 snapshot が比較不能なときだけ、人間の理由入力へ倒す
{
  const cur = snapshot([project({ expectedRewardYen: 8190, currentMonthAccrualYen: 25526 })]);
  const explanations = explainExpectedRewardChanges(null, cur);
  assert.equal(explanations.length, 1);
  assert.equal(explanations[0].explained, false, "比較基準が無いときはOSが説明できない扱いにする");
}

// 18. 予定額が変わっていない月は説明を出さない
{
  const prev = snapshot([project({ expectedRewardYen: 8190, currentMonthAccrualYen: 25526 })]);
  const cur = snapshot([project({ expectedRewardYen: 8190, currentMonthAccrualYen: 25526, roleLabel: "PM" })]);
  assert.equal(explainExpectedRewardChanges(prev, cur).length, 0);
}

console.log("expected-reward change explanation: ok");

// ---------------------------------------------------------------------------
// diffMonthlyAgreementTerms: メンバーへ見せるのは合意の対象だけ
//
// snapshot 全体を比べると内部の状態が動くたびに変更点が積み上がり (実測で1人71件)、
// 担当も受け取る額も変わっていないのに再合意を求めることになる。
// まさ確定 2026-08-28「支払額が変わってないなら、わざわざ変更があったことを
// メンバーに伝えるのは、ただ混乱を招くだけだから止めたほうがいい」。
// ---------------------------------------------------------------------------

// 19. 請求ステータス・進捗率・繰越額・pt残が動いただけでは、変更点を出さない
{
  const prev = snapshot([
    project({ billingStatus: "budget_confirmed", allocationStatus: "reported", stockYen: 0, carryInYen: 0, earnedPt: 1 }),
  ]);
  const cur = snapshot([
    project({ billingStatus: "payment_confirmed", allocationStatus: "confirmed", stockYen: 50000, carryInYen: 10000, earnedPt: 9 }),
  ]);
  const result = diffMonthlyAgreementTerms(prev, cur);
  assert.equal(result.comparable, true);
  assert.equal(result.count, 0, "内部の状態が動いただけでメンバーへ変更点を出さない");
}

// 20. 今月受け取る額が変わったら出す
{
  const prev = snapshot([project({ payoutSchedule: [payoutEntry({ totalPayYen: 100000 })] })]);
  const cur = snapshot([project({ payoutSchedule: [payoutEntry({ totalPayYen: 80000 })] })]);
  const result = diffMonthlyAgreementTerms(prev, cur);
  assert.equal(result.count, 1);
  assert.equal(result.groups[0].changes[0].label, "今月受け取る額");
}

// 21. 合意額の定義変更 (expectedRewardYen の意味が変わっただけ) では変更点を出さない
//     受け取る額は payoutSchedule の当月分で比べるので、定義変更の前後をまたいでも一致する
{
  const prev = snapshot([
    project({ expectedRewardYen: 118448, currentMonthAccrualYen: null, payoutSchedule: [payoutEntry({ totalPayYen: 0 })] }),
  ]);
  const cur = snapshot([
    project({ expectedRewardYen: 0, currentMonthAccrualYen: 118448, payoutSchedule: [payoutEntry({ totalPayYen: 0 })] }),
  ]);
  assert.equal(diffMonthlyAgreementTerms(prev, cur).count, 0, "定義が変わっただけで再合意を求めない");
}

// 22. 表示に出ない担当割合の差 (15.3846% → 15%) は変更点にしない
{
  const prev = snapshot([project({ milestones: [milestone({ plannedShare: 0.153846 })] })]);
  const cur = snapshot([project({ milestones: [milestone({ plannedShare: 0.15 })] })]);
  assert.equal(diffMonthlyAgreementTerms(prev, cur).count, 0, "「15% → 15%」を変更点として出さない");
}

// 23. 担当内容が変わったら出す
{
  const prev = snapshot([project({ milestones: [milestone({ taskDescription: "実装" })] })]);
  const cur = snapshot([project({ milestones: [milestone({ taskDescription: "設計と実装" })] })]);
  const result = diffMonthlyAgreementTerms(prev, cur);
  assert.equal(result.count, 1);
  assert.ok(result.groups[0].changes[0].label.includes("作業内容"));
}

// 24. 支払対象外メンバーには「翌月以降お支払いします」と書かない
{
  const prev = snapshot([project({ expectedRewardYen: 30000, currentMonthAccrualYen: null })]);
  const cur = snapshot([project({ expectedRewardYen: 0, currentMonthAccrualYen: 118448, stockYen: 600300 })]);
  cur.member = { ...cur.member, excludeFromPayoutNotice: true };
  const explanations = explainExpectedRewardChanges(prev, cur);
  const joined = explanations[0].details.join("\n");
  assert.ok(joined.includes("現金ではお支払いしません"), "支払対象外であることを書く");
  assert.ok(!joined.includes("翌月以降の支払枠で順にお支払いします"), "払わない額に払う約束を付けない");
  assert.ok(joined.includes("あなたへの未払いではありません"), "未払い債務ではないと書く");
}

console.log("agreement terms diff: ok");
