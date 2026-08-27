export type MonthlyAgreementStatus = "pending" | "agreed" | "needs_reagreement" | "not_required";

export interface MonthlyWorkAgreementMember {
  memberId: string;
  codeName: string;
  email?: string | null;
  isAdmin?: boolean;
  excludeFromPayoutNotice?: boolean;
}

export interface MonthlyWorkAgreementMilestone {
  milestoneId: string;
  title: string;
  points: number;
  plannedShare: number | null;
  role: string | null;
  taskDescription: string | null;
  progressPct: number | null;
  monthlyProgressPct: number | null;
  expectedRewardYen: number | null;
  earnedPt: number | null;
  conditions: string[];
  state: "ready" | "review_required";
}

export interface MonthlyWorkAgreementPayoutScheduleEntry {
  sourceYm: string;
  paymentYm: string;
  status: string | null;
  basePayYen: number;
  carryInYen: number;
  grossDueYen: number;
  totalPayYen: number;
  totalPayTaxIncludedYen: number;
  stockYen: number;
  isCurrentYm: boolean;
  isProtected: boolean;
  isActualPaid: boolean;
  amountSource: "actual_paid" | "unverified_paid" | "payout_snapshot" | "protected_reward_cache" | "reward_cache";
}

export interface MonthlyAgreementAmountChangeReason {
  id: string;
  ym: string;
  memberId: string;
  projectId: string;
  agreementSnapshotHash: string;
  reason: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export interface MonthlyWorkAgreementRevisionRequest {
  id: string;
  ym: string;
  memberId: string;
  projectId: string | null;
  requestType: string;
  body: string;
  status: string;
  snapshotHash: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface MonthlyWorkAgreementProject {
  projectId: string;
  projectName: string;
  projectStatus: string;
  roleLabel: string | null;
  isPm: boolean;
  isPl: boolean;
  billingStatus: string | null;
  allocationStatus: string;
  /** 合意する額 = この稼働月として実際に払う額 (過去の未払いの返済分を含む、支払枠を通した後) */
  expectedRewardYen: number | null;
  /** うち当月のMS消化から発生する分。内訳表示用 */
  currentMonthAccrualYen: number | null;
  payoutYen: number | null;
  currentCyclePayoutYen: number | null;
  paymentYm: string | null;
  stockYen: number | null;
  grossDueYen: number | null;
  carryInYen: number | null;
  earnedPt: number | null;
  conditionState: "ready" | "review_required";
  conditions: string[];
  reviewReasons: string[];
  milestones: MonthlyWorkAgreementMilestone[];
  payoutSchedule: MonthlyWorkAgreementPayoutScheduleEntry[];
  routineExpectations: string[];
}

export interface MonthlyWorkAgreementSnapshot {
  schemaVersion: "monthly_work_agreement.v1" | "monthly_work_agreement.v2";
  ym: string;
  member: MonthlyWorkAgreementMember;
  projects: MonthlyWorkAgreementProject[];
  totals: {
    expectedRewardYen: number;
    currentMonthAccrualYen: number;
    carryInYen: number;
    stockYen: number;
    paidActualYen?: number;
    unverifiedPaidYen?: number;
    futurePayoutYen?: number;
    projectCount: number;
    reviewRequiredCount: number;
  };
}

export interface MonthlyWorkAgreementRecord {
  id: string;
  ym: string;
  memberId: string;
  status: string;
  agreedAt: string | null;
  agreedBy: string | null;
  snapshotHash: string;
  currentHash: string | null;
  invalidatedAt?: string | null;
  invalidationReason?: string | null;
  /** Raw snapshot_json as stored — shape depends on schemaVersion at agreement time, may be v1/legacy/unknown. */
  snapshotJson?: unknown;
}

export interface MonthlyAgreementChangeItem {
  label: string;
  before: string;
  after: string;
}

export interface MonthlyAgreementChangeGroup {
  projectId: string;
  projectName: string;
  changes: MonthlyAgreementChangeItem[];
}

export interface MonthlyAgreementSnapshotDiff {
  comparable: boolean;
  count: number;
  groups: MonthlyAgreementChangeGroup[];
  note: string | null;
}

export interface MonthlyWorkAgreementBundle {
  ym: string;
  member: MonthlyWorkAgreementMember;
  snapshot: MonthlyWorkAgreementSnapshot;
  currentHash: string;
  status: MonthlyAgreementStatus;
  latestAgreement: MonthlyWorkAgreementRecord | null;
  revisionRequests: MonthlyWorkAgreementRevisionRequest[];
  tableReady: boolean;
  /** 本人が修正要望を送れる状態か。金額変更理由の確認待ちは妨げない。 */
  canRequestRevision: boolean;
  canAgree: boolean;
  exclusionReason?: string | null;
  /** Diff of current snapshot vs. the last agreed snapshot; only meaningful when status === "needs_reagreement". */
  changeSummary: MonthlyAgreementSnapshotDiff | null;
  /** Admin-authored amount-change reasons for this member's projects, scoped to the current snapshot hash. */
  amountChangeReasons: MonthlyAgreementAmountChangeReason[];
  /** 今回の予定額変更で、理由の記録が必要なPJ。 */
  amountChangeReasonRequiredProjectIds: string[];
  /** 今回の予定額変更に対し、現在snapshotの理由がまだ無いPJ。 */
  missingAmountChangeReasonProjectIds: string[];
}

export interface MonthlyAgreementAmountChangeReasonRequirement {
  projectId: string;
  projectName: string;
  expectedRewardYen: number | null;
  reason: string | null;
}

export interface AdminMonthlyWorkAgreementRow {
  member: MonthlyWorkAgreementMember;
  status: MonthlyAgreementStatus;
  currentHash: string;
  latestAgreement: MonthlyWorkAgreementRecord | null;
  revisionRequestCount: number;
  latestRevisionRequestAt: string | null;
  projectCount: number;
  reviewRequiredCount: number;
  /** 合意額 = この稼働月として払う額 (過去の未払いの返済分を含む) */
  expectedRewardYen: number;
  /** うち当月のMS消化から発生する分 */
  currentMonthAccrualYen: number;
  payoutYen: number;
  /** 支払通知書へ合算する立替精算 (実費・税込)。報酬とは別原資 */
  reimbursementYen: number;
  stockYen: number;
  grossDueYen: number;
  carryInYen: number;
  projectNames: string[];
  amountChangeReasonRequirements: MonthlyAgreementAmountChangeReasonRequirement[];
}

export interface AdminMonthlyWorkAgreementResponse {
  ym: string;
  tableReady: boolean;
  totals: {
    members: number;
    agreed: number;
    pending: number;
    needsReagreement: number;
    reviewRequired: number;
    revisionRequests: number;
    expectedRewardYen: number;
    currentMonthAccrualYen: number;
    payoutYen: number;
    reimbursementYen: number;
    stockYen: number;
  };
  rows: AdminMonthlyWorkAgreementRow[];
}
