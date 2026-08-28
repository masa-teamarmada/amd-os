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
  /** 対応した管理者の member_id。open のあいだは null */
  resolvedBy: string | null;
  /** 管理者が書いた対応メモ。メンバー側の合意画面にも出す */
  resolutionNote: string | null;
}

/**
 * 予定額が前回合意から変わった理由を、OSが自分で組み立てた説明。
 *
 * 予定額はMS消化pt・繰越・支払枠から自動計算されるので、変わるたびに人間へ
 * 理由を書かせると、書ける人がいないまま支払が止まる (2026-08-28)。
 * 要因を数値で示せたものは `explained: true` にして、管理側の理由入力なしで合意できるようにする。
 */
export interface ExpectedRewardChangeExplanation {
  projectId: string;
  projectName: string;
  beforeYen: number | null;
  afterYen: number | null;
  /** 一行の見出し。メンバー画面のPJ名の下に出す */
  headline: string;
  /** 内訳。メンバーがそのまま読む文 */
  details: string[];
  /** 要因を特定できたか。false のときだけ管理側の理由入力を必須にする */
  explained: boolean;
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
  /** 今回の予定額変更に対し、現在snapshotの理由がまだ無いPJ。OSが要因を説明できたPJは含めない。 */
  missingAmountChangeReasonProjectIds: string[];
  /** 予定額が変わった理由のOS自動説明。`explained` が true のPJは管理側の理由入力なしで合意できる。 */
  expectedRewardChangeExplanations: ExpectedRewardChangeExplanation[];
}

export interface MonthlyAgreementAmountChangeReasonRequirement {
  projectId: string;
  projectName: string;
  expectedRewardYen: number | null;
  reason: string | null;
  /** OSが変わった理由を説明できたか。true なら管理側の理由入力なしで本人が合意できる */
  autoExplained: boolean;
  /** OSが組み立てた説明。管理側が補足を書くときの材料にもなる */
  autoExplanationDetails: string[];
}

export interface AdminMonthlyWorkAgreementRow {
  member: MonthlyWorkAgreementMember;
  status: MonthlyAgreementStatus;
  currentHash: string;
  latestAgreement: MonthlyWorkAgreementRecord | null;
  revisionRequestCount: number;
  latestRevisionRequestAt: string | null;
  /**
   * メンバーが出した修正要望そのもの。open を先頭にした新しい順。
   * 件数だけ返していると、管理者は本文を読めず open を閉じられないので支払ゲートを解除できない
   * (2026-08-28: 支払通知書が発行できない原因調査で判明)。
   */
  revisionRequests: MonthlyWorkAgreementRevisionRequest[];
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
