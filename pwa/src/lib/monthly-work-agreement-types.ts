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
  expectedRewardYen: number | null;
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
  canAgree: boolean;
  exclusionReason?: string | null;
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
  expectedRewardYen: number;
  payoutYen: number;
  stockYen: number;
  grossDueYen: number;
  carryInYen: number;
  projectNames: string[];
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
    payoutYen: number;
    stockYen: number;
  };
  rows: AdminMonthlyWorkAgreementRow[];
}
