import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildDagHealth,
  computeManagementJudgment,
  dateDistance,
  deriveMilestoneState,
  evaluateActionState,
  isKpiThresholdMet,
  isMissingOwner,
  selectCurrentMilestone,
  type DagHealth,
  type LogicDependency,
  type LogicKpi,
  type LogicMilestone,
  type MilestoneDerivedResult,
  type ManagementDerivedStatus,
} from "./project-management-logic";

export const SX_TRACKS = [
  { key: "business_development", label: "事業開発", shortLabel: "事業", accent: "#315f7d" },
  { key: "technology_development", label: "技術開発", shortLabel: "技術", accent: "#38745d" },
  { key: "funding", label: "資金調達", shortLabel: "資金", accent: "#bf7b2c" },
  { key: "organizational_building", label: "体制構築", shortLabel: "体制", accent: "#76637b" },
] as const;

export type SxTrackKey = (typeof SX_TRACKS)[number]["key"];
export type SxJudgmentKey = "on_track" | "attention" | "crisis" | "unassessed";
export type SxMilestoneStatus = ManagementDerivedStatus;
export type SxIssueKind = "fact" | "hypothesis" | "decision_needed" | "decision";
export type SxConfidence = "high" | "medium" | "low" | "unknown";
export type SxSourceKind = "current_truth" | "manual" | "imported";
export type SxPartnerStage =
  | "candidate"
  | "first_contact"
  | "information_exchange"
  | "hearing"
  | "meeting_coordination"
  | "technical_review"
  | "condition_alignment"
  | "sample_acquisition"
  | "validation_preparation"
  | "agreement_confirmation"
  | "executing"
  | "on_hold"
  | "declined";

/** 段階と独立した運用状態。停滞・待ち先の管制に使い、到達度とは混ぜない。 */
export type SxPartnerActivityState =
  | "active"
  | "waiting_partner"
  | "waiting_internal"
  | "stalled"
  | "on_hold"
  | "dropped"
  | "unknown";

/** PoC営業の候補区分。nullはPoC営業対象外の一般関係先。 */
export type SxPocCategory = "poc_candidate" | "tech_partner" | "sample_provider" | "sample_route";

/**
 * 攻める順番を決める判断2軸の値。nullは未評価で、推測で埋めない。
 * confidence(情報の確からしさ)とは別軸で、こちらは商談としての見込みを表す
 * (2026-08-06 まさ「PoC実施させてもらえる可能性」「顧客として有望かどうか」)。
 */
export type SxPocJudgment = "high" | "medium" | "low";

/**
 * 関係先リスト最左の評価カラムの値。S / A / B / ✕ の4値で、nullは未評価(「未」)。
 * 顧客として見込みがあるかを第一優先に、(1)ペインの高さ (2)単価の高い重金属が
 * 排出されているか で付ける。排液がもらえるかはこれより大幅に劣後する
 * (2026-08-06 まさ)。
 */
export type SxPocGrade = "s" | "a" | "b" | "x";

/** 次回面談の形式。null は未定。 */
export type SxMeetingMode = "onsite" | "online" | "hybrid" | "phone";

// 表示ラベルと選択肢の並びは client からも参照するため sx-partner-progress.ts に置く。
// このファイルは server-only なので、値を export するとクライアント側の import が壊れる。

export type SxObjective = {
  id: string;
  slug: string;
  title: string;
  definitionOfDone: string;
  targetDate: string | null;
  dateCertainty: "confirmed" | "provisional";
  status: "unassessed" | "active" | "completed" | "on_hold";
  lastVerifiedAt: string;
  confidence: SxConfidence;
  sourceKind: SxSourceKind;
  sourceRef: string | null;
};

export type SxOutcome = {
  id: string;
  objectiveId: string;
  slug: string;
  track: SxTrackKey;
  title: string;
  definitionOfDone: string;
  ownerLabel: string;
  status: "unassessed" | "active" | "completed" | "on_hold";
  lastVerifiedAt: string;
  confidence: SxConfidence;
};

export type SxKpi = {
  id: string;
  outcomeId: string;
  track: SxTrackKey;
  slug: string;
  title: string;
  metricKind: string;
  baseline: number | null;
  target: number | null;
  actual: number | null;
  unit: string;
  threshold: number | null;
  thresholdRule: "gte" | "lte" | "between";
  thresholdUpper: number | null;
  measurementDate: string | null;
  frequency: string;
  sourceLabel: string;
  confidence: SxConfidence;
  lastVerifiedAt: string;
  sourceKind: SxSourceKind;
  sourceRef: string | null;
  linkedMilestoneIds: string[];
};

export type SxDependency = {
  id: string;
  predecessorMilestoneId: string;
  successorMilestoneId: string;
  predecessorSlug: string;
  successorSlug: string;
  dependencyType: "finish_to_start" | "start_to_start" | "finish_to_finish";
  required: boolean;
  lagDays: number;
  note: string | null;
};

/** A manually drawn gantt dependency. This is intentionally separate from SxDependency:
 * SxDependency changes milestone gate/readiness logic, while this type connects the scheduled
 * finish of a task/MS to the scheduled start point of another task/MS. */
export type SxScheduleDependency = {
  id: string;
  predecessorType: "task" | "milestone";
  predecessorTaskId: string | null;
  predecessorMilestoneId: string | null;
  successorType: "task" | "milestone";
  successorTaskId: string | null;
  successorMilestoneId: string | null;
  dependencyType: "finish_to_start";
};

export type SxTimelineKind = "phase" | "milestone";

export type SxManagementMilestone = {
  id: string;
  slug: string;
  track: SxTrackKey;
  objectiveId: string;
  outcomeId: string;
  title: string;
  gate: string;
  /** phase = gantt bar (工程追加); milestone = gantt diamond (MSを置く). Rendering must read
   * this, not infer from slug — the two founding-prerequisite gates keep separate slug-specific
   * gate semantics (sx-gate-requirements.ts) on top of being timelineKind==="milestone". */
  timelineKind: SxTimelineKind;
  /** Optimistic-concurrency token (project_management_milestones.version, auto-incremented by
   * project_management_touch_updated_at). Send back as expected_version on PATCH. */
  version: number;
  status: SxMilestoneStatus;
  manualStatus: SxMilestoneStatus;
  derivedStatus: SxMilestoneStatus;
  statusReason: string;
  reasonCodes: string[];
  plannedStart: string | null;
  plannedEnd: string | null;
  forecastEnd: string | null;
  actualEnd: string | null;
  deltaDays: number | null;
  progressPct: number;
  dateCertainty: "confirmed" | "provisional";
  ownerMemberId: string | null;
  ownerLabel: string;
  nextDeliverable: string;
  maxIssue: string;
  completionCriteria: string;
  completionEvidence: string | null;
  criticality: "critical" | "high" | "medium" | "low";
  baselinePlanVersion: string;
  forecastChangeReason: string | null;
  statusSource: "derived" | "manual" | "override";
  statusOverrideReason: string | null;
  statusOverrideExpiresOn: string | null;
  statusOverrideApprovedBy: string | null;
  lastVerifiedAt: string;
  confidence: SxConfidence;
  sourceKind: SxSourceKind;
  sourceRef: string | null;
  dependencySlugs: string[];
  predecessorIds: string[];
  successorIds: string[];
  relatedIssueSlugs: string[];
  relatedPartnerSlugs: string[];
  linkedKpiIds: string[];
  isStale: boolean;
  isOverdue: boolean;
  isBlocked: boolean;
};

export type SxTask = {
  id: string;
  projectId: string;
  milestoneId: string;
  parentTaskId: string | null;
  track: SxTrackKey | null;
  title: string;
  description: string | null;
  status: "unassessed" | "on_track" | "attention" | "at_risk" | "blocked" | "completed";
  plannedStart: string | null;
  plannedEnd: string | null;
  forecastEnd: string | null;
  actualEnd: string | null;
  progressPct: number;
  dateCertainty: "confirmed" | "provisional";
  ownerMemberId: string | null;
  ownerLabel: string;
  /** The operational goal this task owns. Root tasks promoted from the legacy phase
   * container preserve the former milestone.gate here rather than flattening it into
   * description text. */
  goal: string | null;
  /** The next concrete deliverable for this task. */
  nextDeliverable: string | null;
  /** The current blockage for this task. */
  blocker: string | null;
  completionCriteria: string | null;
  forecastChangeReason: string | null;
  sortOrder: number;
  lastVerifiedAt: string;
  confidence: SxConfidence;
  sourceKind: SxSourceKind;
  sourceRef: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  /** Optimistic-concurrency token (project_management_tasks.version). Send back as
   * expected_version on PATCH. */
  version: number;
};

export type SxHypothesis = {
  id: string;
  issueId: string;
  statement: string;
  status: "open" | "validating" | "validated" | "rejected" | "decided" | "on_hold";
  ownerLabel: string;
  dueDate: string | null;
  confidence: SxConfidence;
  lastVerifiedAt: string;
  sourceKind: SxSourceKind;
  sourceRef: string | null;
};

export type SxEvidence = {
  id: string;
  issueId: string;
  hypothesisId: string | null;
  kind: "supporting" | "counter" | "missing" | "observation";
  summary: string;
  observedOn: string | null;
  sourceLabel: string;
  confidence: SxConfidence;
  lastVerifiedAt: string;
};

export type SxValidationRun = {
  id: string;
  hypothesisId: string;
  validationKind: string;
  plannedOn: string | null;
  dueDate: string | null;
  completedOn: string | null;
  status: "planned" | "running" | "completed" | "blocked" | "cancelled";
  ownerLabel: string;
  method: string;
  resultSummary: string | null;
  confidence: SxConfidence;
  sourceKind: SxSourceKind;
  sourceRef: string | null;
};

export type SxActionItem = {
  id: string;
  decisionId: string;
  title: string;
  ownerLabel: string;
  dueDate: string | null;
  completionCriteria: string;
  nextReviewOn: string | null;
  status: "open" | "in_progress" | "completed" | "blocked";
  completionNote: string | null;
  completedAt: string | null;
  lastVerifiedAt: string;
  sourceKind: SxSourceKind;
};

export type SxDecisionRecord = {
  id: string;
  issueId: string | null;
  hypothesisId: string | null;
  title: string;
  context: string;
  status: "open" | "decided" | "deferred";
  rationale: string;
  decisionText: string | null;
  decidedBy: string | null;
  decidedOn: string | null;
  ownerLabel: string;
  dueDate: string | null;
  isThisWeek: boolean;
  sortOrder: number;
  confidence: SxConfidence;
  lastVerifiedAt: string;
  sourceKind: SxSourceKind;
  sourceRef: string | null;
  track: SxTrackKey;
  actionItems: SxActionItem[];
};

export type SxManagementIssue = {
  id: string;
  slug: string;
  track: SxTrackKey;
  milestoneSlug: string | null;
  title: string;
  knowledgeType: SxIssueKind;
  status: "open" | "validating" | "decided" | "closed" | "on_hold";
  hypothesis: string;
  evidenceFor: string;
  counterevidenceOrMissing: string;
  nextValidation: string;
  ownerLabel: string;
  dueDate: string | null;
  decisionText: string | null;
  lastVerifiedAt: string;
  confidence: SxConfidence;
  sourceKind: SxSourceKind;
  sourceRef: string | null;
  relatedMilestoneSlugs: string[];
  relatedPartnerSlugs: string[];
  hypotheses: SxHypothesis[];
  evidence: SxEvidence[];
  validationRuns: SxValidationRun[];
  decisions: SxDecisionRecord[];
  actionItems: SxActionItem[];
};

export type SxPartnerTrack = {
  track: SxTrackKey;
  roleLabel: string;
  isPrimary: boolean;
};

export type SxBallSide = "sx" | "partner" | "shared" | "none" | "unknown";
export type SxDatePrecision = "day" | "month" | "unknown";
export type SxInteractionKind = "meeting" | "email" | "agreement" | "deliverable" | "handoff" | "status_update" | "note";
/** Which side of a two-lane ball control acted/holds something. No "none" — an interaction/work item always has an acting or holding side, even if unknown. */
export type SxActorSide = "sx" | "partner" | "shared" | "unknown";

export type SxPartnerInteraction = {
  id: string;
  partnerId: string;
  interactionKind: SxInteractionKind;
  occurredOn: string | null;
  occurredOnPrecision: SxDatePrecision;
  summary: string;
  outcomeSummary: string | null;
  ballSideAfter: SxBallSide;
  ballOwnerAfter: string | null;
  /** Who performed this interaction. Independent data from ballSideAfter — never derived from it. */
  actorSide: SxActorSide;
  actorLabel: string | null;
  confidence: SxConfidence;
  sourceKind: SxSourceKind;
  sourceRef: string | null;
  /** 議事録などの本文。共有リンクが失効しても内容が残るよう全文を保存する。 */
  detailMd: string | null;
  createdAt: string;
};

export type SxPartnerRoleKind =
  | "joint_development"
  | "contract_manufacturing"
  | "customer"
  | "shareholder_investor"
  | "government"
  | "media"
  | "financial_institution"
  | "university_research"
  | "support_organization"
  | "other"
  | "unclassified";

export type SxRelationshipState = "candidate" | "in_progress" | "established" | "on_hold" | "ended" | "unconfirmed";

export type SxPartnerRole = {
  id: string;
  partnerId: string;
  roleKind: SxPartnerRoleKind;
  relationshipState: SxRelationshipState;
  roleLabel: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

export type SxWorkItemKind = "task" | "question" | "deliverable" | "decision" | "approval" | "response";
export type SxWorkItemStatus = "open" | "in_progress" | "waiting" | "blocked" | "on_hold" | "completed" | "cancelled";

export type SxPartnerWorkItem = {
  id: string;
  partnerId: string;
  side: SxActorSide;
  itemKind: SxWorkItemKind;
  title: string;
  detail: string | null;
  ownerLabel: string | null;
  status: SxWorkItemStatus;
  dueDate: string | null;
  dueDatePrecision: SxDatePrecision;
  completionCriteria: string | null;
  completedOn: string | null;
  completionEvidence: string | null;
  acceptedBy: string | null;
  acceptedOn: string | null;
  handoffTo: string | null;
  relatedMilestoneId: string | null;
  lastVerifiedAt: string;
  confidence: SxConfidence;
  sourceKind: SxSourceKind;
  sourceRef: string | null;
  sortOrder: number;
};

export type SxSampleStatus = "intent" | "negotiating" | "agreed_pending" | "scheduled" | "received" | "analyzed" | "unknown";

/** 試料台帳（軽量版）。物理現物の状態追跡で、関係先関係と寿命が違うため独立レコード。 */
export type SxPartnerSample = {
  id: string;
  partnerId: string;
  label: string;
  status: SxSampleStatus;
  receivedOn: string | null;
  storageLocation: string | null;
  ownerLabel: string | null;
  notes: string | null;
  confidence: SxConfidence;
  sourceKind: SxSourceKind;
  sourceRef: string | null;
  sortOrder: number;
};

export type SxPartnerCommitment = {
  id: string;
  partnerId: string;
  title: string;
  commitmentText: string;
  commitmentKind: "counterparty_promise" | "sx_followup";
  status: "open" | "in_progress" | "completed" | "blocked" | "cancelled";
  promisedOn: string | null;
  dueDate: string | null;
  completedOn: string | null;
  ownerLabel: string;
  counterpartyOwner: string | null;
  sxOwner: string | null;
  evidence: string | null;
  nextReviewOn: string | null;
  lastVerifiedAt: string;
  confidence: SxConfidence;
  sourceKind: SxSourceKind;
  sourceRef: string | null;
};

export type SxManagementPartner = {
  id: string;
  slug: string;
  track: SxTrackKey;
  tracks: SxPartnerTrack[];
  name: string;
  introducerLabel: string | null;
  connectionContext: string | null;
  roleLabel: string;
  relationshipStage: SxPartnerStage;
  activityState: SxPartnerActivityState;
  pocCategory: SxPocCategory | null;
  /**
   * 顧客としての見込み評価。S/A/B/✕、null は未評価。
   * 合成せず人が直接付ける。軸はペインの高さと単価の高い重金属の有無で、
   * 排液がもらえるかは大幅に劣後する (2026-08-06 まさ)。
   */
  pocGrade: SxPocGrade | null;
  pocLikelihood: SxPocJudgment | null;
  customerValue: SxPocJudgment | null;
  valueNote: string | null;
  /** 排液プロファイル。単位も表記も企業ごとに揺れるため、議事録の表現のまま保持する。 */
  effluentComponents: string | null;
  effluentVolumeAnnual: string | null;
  effluentCostAnnual: string | null;
  /**
   * 次回面談の予定。next_commitment（次にやること）とは別で、
   * 訪問前日に見たい「いつ・現地かオンラインか・何を持っていくか」を持つ。
   * 時刻は「午後」のような未確定表現も入るためテキスト (2026-08-06 まさ)。
   */
  nextMeetingOn: string | null;
  nextMeetingTime: string | null;
  nextMeetingMode: SxMeetingMode | null;
  nextMeetingPlace: string | null;
  nextMeetingPrep: string | null;
  agreementState: "agreed" | "partial" | "unagreed";
  agreedScope: string;
  unagreedScope: string;
  lastContactDate: string | null;
  nextCommitment: string;
  dueDate: string | null;
  ownerLabel: string;
  currentBallSide: SxBallSide;
  currentBallOwner: string | null;
  nextBallOwner: string | null;
  targetState: string | null;
  dueDatePrecision: SxDatePrecision;
  lastVerifiedAt: string;
  confidence: SxConfidence;
  sourceKind: SxSourceKind;
  sourceRef: string | null;
  relatedMilestoneSlugs: string[];
  relatedIssueSlugs: string[];
  commitments: SxPartnerCommitment[];
  interactions: SxPartnerInteraction[];
  roles: SxPartnerRole[];
  workItems: SxPartnerWorkItem[];
  samples: SxPartnerSample[];
  /** True when this partner's primary role classification is on_hold. Drives the deferred/low-priority group; excluded from urgency counts, never removed from the ledger. */
  deferredLowPriority: boolean;
};

export type SxManagementDecision = SxDecisionRecord & { slug: string };

export type SxRaci = {
  id: string;
  milestoneId: string;
  stakeholderLabel: string;
  responsibilityRole: "R" | "A" | "C" | "I";
  ownerLabel: string;
  confirmed: boolean;
  lastVerifiedAt: string;
  confidence: SxConfidence;
};

export type SxCapacity = {
  id: string;
  track: SxTrackKey;
  milestoneId: string | null;
  roleLabel: string;
  requiredPeople: number;
  confirmedPeople: number;
  availableHoursWeek: number | null;
  plannedHoursWeek: number | null;
  measurementDate: string;
  sourceLabel: string;
  confidence: SxConfidence;
};

export type SxTechnicalTest = {
  id: string;
  milestoneId: string | null;
  outcomeId: string | null;
  testSlug: string;
  testName: string;
  testCondition: string;
  target: string | null;
  actual: string | null;
  unit: string;
  repetition: number | null;
  sample: string | null;
  trlCriterion: string;
  evidence: string | null;
  status: "unassessed" | "planned" | "running" | "passed" | "failed" | "blocked";
  measuredOn: string | null;
  ownerLabel: string;
  confidence: SxConfidence;
  sourceKind: SxSourceKind;
};

export type SxFundingSnapshot = {
  id: string;
  snapshotDate: string;
  requiredAmount: number | null;
  securedAmount: number | null;
  unconfirmedAmount: number | null;
  useSummary: string;
  burnPerMonth: number | null;
  runwayMonths: number | null;
  probability: number | null;
  cashCondition: string;
  sourceLabel: string;
  confidence: SxConfidence;
};

export type SxOrganizationRole = {
  id: string;
  roleSlug: string;
  roleName: string;
  required: boolean;
  candidate: string | null;
  commitment: string | null;
  authority: string;
  vacancy: boolean;
  joinCondition: string;
  dueDate: string | null;
  status: "unassessed" | "candidate" | "committed" | "filled" | "on_hold";
  ownerLabel: string;
  lastVerifiedAt: string;
  confidence: SxConfidence;
};

export type SxHistory = {
  id: string;
  entityType: string;
  entityId: string | null;
  updateKind: string;
  summary: string;
  changedBy: string;
  changedOn: string;
  fromStatus: string | null;
  toStatus: string | null;
};

export type SxFieldAudit = {
  id: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  source: string;
  version: number;
  verifiedBy: string;
  nextReviewOn: string | null;
  recordedAt: string;
};

export type SxTrackSummary = {
  key: SxTrackKey;
  label: string;
  shortLabel: string;
  accent: string;
  milestoneId: string | null;
  milestoneSlug: string | null;
  gate: string;
  status: SxMilestoneStatus;
  statusLabel: string;
  derivedStatus: SxMilestoneStatus;
  manualStatus: SxMilestoneStatus;
  plannedEnd: string | null;
  forecastEnd: string | null;
  deltaDays: number | null;
  dateCertainty: "confirmed" | "provisional" | null;
  progressPct: number;
  ownerLabel: string;
  nextDeliverable: string;
  maxIssue: string;
  lastVerifiedAt: string | null;
  confidence: SxConfidence;
  criticalUnknownCount: number;
  staleCount: number;
  gateReady: boolean;
  gateFailures: string[];
  reason: string;
};

export type SxJudgment = {
  key: SxJudgmentKey;
  label: "順調" | "注意" | "危機" | "未評価";
  reasons: string[];
  decisionQueue: SxManagementDecision[];
  nextDeadline: string | null;
  lastVerifiedAt: string | null;
  completenessPct: number;
  staleCount: number;
  overdueCount: number;
  criticalUnknownCount: number;
  blockedCount: number;
  provisionalDateCount: number;
  dagValid: boolean;
  criticalPathSlugs: string[];
};

export type SxManagementBundle = {
  asOf: string;
  horizonMonths: string[];
  objective: SxObjective | null;
  outcomes: SxOutcome[];
  kpis: SxKpi[];
  dependencies: SxDependency[];
  scheduleDependencies: SxScheduleDependency[];
  dag: DagHealth;
  judgment: SxJudgment;
  tracks: SxTrackSummary[];
  milestones: SxManagementMilestone[];
  tasks: SxTask[];
  issues: SxManagementIssue[];
  hypotheses: SxHypothesis[];
  evidence: SxEvidence[];
  validationRuns: SxValidationRun[];
  decisions: SxManagementDecision[];
  actions: SxActionItem[];
  partners: SxManagementPartner[];
  partnerCommitments: SxPartnerCommitment[];
  partnerInteractions: SxPartnerInteraction[];
  partnerRoles: SxPartnerRole[];
  partnerWorkItems: SxPartnerWorkItem[];
  technicalTests: SxTechnicalTest[];
  fundingSnapshots: SxFundingSnapshot[];
  organizationRoles: SxOrganizationRole[];
  raci: SxRaci[];
  capacity: SxCapacity[];
  history: SxHistory[];
  fieldAudit: SxFieldAudit[];
  canManage: boolean;
  hasData: boolean;
};

type RawRow = Record<string, unknown>;

const MILESTONE_STATUS_LABEL: Record<SxMilestoneStatus, string> = {
  unassessed: "未評価",
  on_track: "順調",
  attention: "注意",
  at_risk: "遅れ懸念",
  blocked: "停止",
  completed: "完了",
};

const PARTNER_STAGE_LABEL: Record<SxPartnerStage, string> = {
  candidate: "候補",
  first_contact: "初回接触",
  information_exchange: "情報交換",
  hearing: "ヒアリング",
  meeting_coordination: "面談調整",
  technical_review: "技術確認",
  condition_alignment: "条件整理",
  sample_acquisition: "試料調達",
  validation_preparation: "検証準備",
  agreement_confirmation: "合意確認",
  executing: "実行中",
  on_hold: "保留",
  declined: "見送り",
};

export function sxPartnerStageLabel(stage: SxPartnerStage) {
  return PARTNER_STAGE_LABEL[stage] || "未設定";
}

const PARTNER_ACTIVITY_STATE_LABEL: Record<SxPartnerActivityState, string> = {
  active: "対応中",
  waiting_partner: "先方待ち",
  waiting_internal: "社内待ち",
  stalled: "停滞",
  on_hold: "保留",
  dropped: "見送り",
  unknown: "状態未確認",
};

export function sxPartnerActivityStateLabel(state: SxPartnerActivityState) {
  return PARTNER_ACTIVITY_STATE_LABEL[state] || "状態未確認";
}

const POC_CATEGORY_LABEL: Record<SxPocCategory, string> = {
  poc_candidate: "PoC候補先",
  tech_partner: "技術協力先",
  sample_provider: "試料提供元",
  sample_route: "試料提供ルート",
};

export function sxPocCategoryLabel(category: SxPocCategory) {
  return POC_CATEGORY_LABEL[category] || "区分未確認";
}

const ROLE_KIND_LABEL: Record<SxPartnerRoleKind, string> = {
  joint_development: "共同開発",
  contract_manufacturing: "製造委託",
  customer: "顧客",
  shareholder_investor: "株主・投資",
  government: "自治体",
  media: "メディア",
  financial_institution: "金融機関",
  university_research: "大学・研究機関",
  support_organization: "支援機関",
  other: "その他",
  unclassified: "未分類",
};

export function sxPartnerRoleKindLabel(kind: SxPartnerRoleKind) {
  return ROLE_KIND_LABEL[kind] || "未分類";
}

const RELATIONSHIP_STATE_LABEL: Record<SxRelationshipState, string> = {
  candidate: "候補",
  in_progress: "進行中",
  established: "成立",
  on_hold: "保留",
  ended: "終了",
  unconfirmed: "未確認",
};

export function sxRelationshipStateLabel(state: SxRelationshipState) {
  return RELATIONSHIP_STATE_LABEL[state] || "未確認";
}

/** Combines role + state into a compound label like "共同開発先" / "共同開発候補先" for the common
 * candidate/in_progress/established cases. on_hold/ended/unconfirmed keep the bare role name — the
 * state itself is shown as a separate small badge, since a compound suffix reads unnaturally there. */
export function sxRoleDisplayLabel(roleKind: SxPartnerRoleKind, state: SxRelationshipState): string {
  const roleName = ROLE_KIND_LABEL[roleKind] || "未分類";
  if (roleKind === "unclassified") return "未分類";
  if (state === "candidate") return `${roleName}候補先`;
  if (state === "in_progress" || state === "established") return `${roleName}先`;
  return roleName;
}

const WORK_ITEM_KIND_LABEL: Record<SxWorkItemKind, string> = {
  task: "タスク",
  question: "質問",
  deliverable: "成果物",
  decision: "意思決定",
  approval: "承認",
  response: "回答",
};

export function sxWorkItemKindLabel(kind: SxWorkItemKind) {
  return WORK_ITEM_KIND_LABEL[kind] || "項目未確認";
}

const WORK_ITEM_STATUS_LABEL: Record<SxWorkItemStatus, string> = {
  open: "未着手",
  in_progress: "進行中",
  waiting: "待ち",
  blocked: "停止",
  on_hold: "保留",
  completed: "完了",
  cancelled: "取消",
};

export function sxWorkItemStatusLabel(status: SxWorkItemStatus) {
  return WORK_ITEM_STATUS_LABEL[status] || "未確認";
}

export function sxTrackLabel(track: SxTrackKey) {
  return SX_TRACKS.find((item) => item.key === track)?.label || track;
}

function stringValue(row: RawRow, key: string, fallback = "") {
  const value = row[key];
  return value == null ? fallback : String(value);
}

function nullableString(row: RawRow, key: string) {
  const value = row[key];
  return value == null || value === "" ? null : String(value);
}

function numberValue(row: RawRow, key: string, fallback = 0) {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : fallback;
}

function nullableNumber(row: RawRow, key: string) {
  const value = row[key];
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asTrack(value: unknown): SxTrackKey {
  return SX_TRACKS.some((item) => item.key === value) ? (value as SxTrackKey) : "business_development";
}

function asTimelineKind(value: unknown): SxTimelineKind {
  return value === "milestone" ? "milestone" : "phase";
}

function asStatus(value: unknown): SxMilestoneStatus {
  const values: SxMilestoneStatus[] = ["unassessed", "on_track", "attention", "at_risk", "blocked", "completed"];
  return values.includes(value as SxMilestoneStatus) ? (value as SxMilestoneStatus) : "unassessed";
}

function asConfidence(value: unknown): SxConfidence {
  return value === "high" || value === "medium" || value === "low" || value === "unknown" ? value : "unknown";
}

function asSourceKind(value: unknown): SxSourceKind {
  return value === "manual" || value === "imported" ? value : "current_truth";
}

function asIssueKind(value: unknown): SxIssueKind {
  return value === "fact" || value === "decision" || value === "decision_needed" ? value : "hypothesis";
}

function asPartnerStage(value: unknown): SxPartnerStage {
  const values = Object.keys(PARTNER_STAGE_LABEL) as SxPartnerStage[];
  return values.includes(value as SxPartnerStage) ? (value as SxPartnerStage) : "candidate";
}

function asAgreementState(value: unknown): SxManagementPartner["agreementState"] {
  return value === "agreed" || value === "partial" ? value : "unagreed";
}

function asBallSide(value: unknown): SxBallSide {
  const values: SxBallSide[] = ["sx", "partner", "shared", "none", "unknown"];
  return values.includes(value as SxBallSide) ? (value as SxBallSide) : "unknown";
}

function asDatePrecision(value: unknown): SxDatePrecision {
  const values: SxDatePrecision[] = ["day", "month", "unknown"];
  return values.includes(value as SxDatePrecision) ? (value as SxDatePrecision) : "unknown";
}

function asInteractionKind(value: unknown): SxInteractionKind {
  const values: SxInteractionKind[] = ["meeting", "email", "agreement", "deliverable", "handoff", "status_update", "note"];
  return values.includes(value as SxInteractionKind) ? (value as SxInteractionKind) : "note";
}

function asActorSide(value: unknown): SxActorSide {
  const values: SxActorSide[] = ["sx", "partner", "shared", "unknown"];
  return values.includes(value as SxActorSide) ? (value as SxActorSide) : "unknown";
}

function asPartnerRoleKind(value: unknown): SxPartnerRoleKind {
  const values: SxPartnerRoleKind[] = ["joint_development", "contract_manufacturing", "customer", "shareholder_investor", "government", "media", "financial_institution", "university_research", "support_organization", "other", "unclassified"];
  return values.includes(value as SxPartnerRoleKind) ? (value as SxPartnerRoleKind) : "unclassified";
}

function asRelationshipState(value: unknown): SxRelationshipState {
  const values: SxRelationshipState[] = ["candidate", "in_progress", "established", "on_hold", "ended", "unconfirmed"];
  return values.includes(value as SxRelationshipState) ? (value as SxRelationshipState) : "unconfirmed";
}

function asWorkItemKind(value: unknown): SxWorkItemKind {
  const values: SxWorkItemKind[] = ["task", "question", "deliverable", "decision", "approval", "response"];
  return values.includes(value as SxWorkItemKind) ? (value as SxWorkItemKind) : "task";
}

function asWorkItemStatus(value: unknown): SxWorkItemStatus {
  const values: SxWorkItemStatus[] = ["open", "in_progress", "waiting", "blocked", "on_hold", "completed", "cancelled"];
  return values.includes(value as SxWorkItemStatus) ? (value as SxWorkItemStatus) : "open";
}

function decisionStatus(value: unknown): SxManagementDecision["status"] {
  return value === "decided" || value === "deferred" ? value : "open";
}

function mapHypothesis(row: RawRow): SxHypothesis {
  return {
    id: stringValue(row, "id"), issueId: stringValue(row, "issue_id"), statement: stringValue(row, "statement"),
    status: (row.status as SxHypothesis["status"]) || "open", ownerLabel: stringValue(row, "owner_label", "担当未確認"),
    dueDate: nullableString(row, "due_date"), confidence: asConfidence(row.confidence), lastVerifiedAt: stringValue(row, "last_verified_at"),
    sourceKind: asSourceKind(row.source_kind), sourceRef: nullableString(row, "source_ref"),
  };
}

function mapEvidence(row: RawRow): SxEvidence {
  return {
    id: stringValue(row, "id"), issueId: stringValue(row, "issue_id"), hypothesisId: nullableString(row, "hypothesis_id"),
    kind: (row.evidence_kind as SxEvidence["kind"]) || "observation", summary: stringValue(row, "summary"), observedOn: nullableString(row, "observed_on"),
    sourceLabel: stringValue(row, "source_label", "根拠未確認"), confidence: asConfidence(row.confidence), lastVerifiedAt: stringValue(row, "last_verified_at"),
  };
}

function mapValidation(row: RawRow): SxValidationRun {
  return {
    id: stringValue(row, "id"), hypothesisId: stringValue(row, "hypothesis_id"), validationKind: stringValue(row, "validation_kind", "検証"),
    plannedOn: nullableString(row, "planned_on"), dueDate: nullableString(row, "due_date"), completedOn: nullableString(row, "completed_on"),
    status: (row.status as SxValidationRun["status"]) || "planned", ownerLabel: stringValue(row, "owner_label", "担当未確認"), method: stringValue(row, "method", "方法未確認"),
    resultSummary: nullableString(row, "result_summary"), confidence: asConfidence(row.confidence), sourceKind: asSourceKind(row.source_kind), sourceRef: nullableString(row, "source_ref"),
  };
}

function mapAction(row: RawRow): SxActionItem {
  return {
    id: stringValue(row, "id"), decisionId: stringValue(row, "decision_id"), title: stringValue(row, "title"), ownerLabel: stringValue(row, "owner_label", "担当未確認"),
    dueDate: nullableString(row, "due_date"), completionCriteria: stringValue(row, "completion_criteria", "完了条件未確認"), nextReviewOn: nullableString(row, "next_review_on"),
    status: (row.status as SxActionItem["status"]) || "open", completionNote: nullableString(row, "completion_note"), completedAt: nullableString(row, "completed_at"),
    lastVerifiedAt: stringValue(row, "last_verified_at"), sourceKind: asSourceKind(row.source_kind),
  };
}

function mapTask(row: RawRow): SxTask {
  return {
    id: stringValue(row, "id"), projectId: stringValue(row, "project_id"), milestoneId: stringValue(row, "milestone_id"),
    parentTaskId: nullableString(row, "parent_task_id"), track: SX_TRACKS.some((item) => item.key === row.track) ? (row.track as SxTrackKey) : null,
    title: stringValue(row, "title"), description: nullableString(row, "description"), status: asStatus(row.status),
    plannedStart: nullableString(row, "planned_start"), plannedEnd: nullableString(row, "planned_end"), forecastEnd: nullableString(row, "forecast_end"), actualEnd: nullableString(row, "actual_end"),
    progressPct: numberValue(row, "progress_pct"), dateCertainty: row.date_certainty === "confirmed" ? "confirmed" : "provisional",
    ownerMemberId: nullableString(row, "owner_member_id"), ownerLabel: stringValue(row, "owner_label", "担当未確認"),
    goal: nullableString(row, "goal"), nextDeliverable: nullableString(row, "next_deliverable"), blocker: nullableString(row, "blocker"),
    completionCriteria: nullableString(row, "completion_criteria"), forecastChangeReason: nullableString(row, "forecast_change_reason"), sortOrder: numberValue(row, "sort_order"),
    lastVerifiedAt: stringValue(row, "last_verified_at"), confidence: asConfidence(row.confidence), sourceKind: asSourceKind(row.source_kind), sourceRef: nullableString(row, "source_ref"),
    createdBy: nullableString(row, "created_by"), updatedBy: nullableString(row, "updated_by"), version: numberValue(row, "version", 1),
  };
}

function mapCommitment(row: RawRow): SxPartnerCommitment {
  return {
    id: stringValue(row, "id"), partnerId: stringValue(row, "partner_id"), title: stringValue(row, "title"), commitmentText: stringValue(row, "commitment_text"),
    commitmentKind: row.commitment_kind === "counterparty_promise" ? "counterparty_promise" : "sx_followup",
    status: (row.status as SxPartnerCommitment["status"]) || "open", promisedOn: nullableString(row, "promised_on"), dueDate: nullableString(row, "due_date"), completedOn: nullableString(row, "completed_on"),
    ownerLabel: stringValue(row, "owner_label", "担当未確認"), counterpartyOwner: nullableString(row, "counterparty_owner"), sxOwner: nullableString(row, "sx_owner"), evidence: nullableString(row, "evidence"), nextReviewOn: nullableString(row, "next_review_on"),
    lastVerifiedAt: stringValue(row, "last_verified_at"), confidence: asConfidence(row.confidence), sourceKind: asSourceKind(row.source_kind), sourceRef: nullableString(row, "source_ref"),
  };
}

function mapInteraction(row: RawRow): SxPartnerInteraction {
  return {
    id: stringValue(row, "id"), partnerId: stringValue(row, "partner_id"), interactionKind: asInteractionKind(row.interaction_kind),
    occurredOn: nullableString(row, "occurred_on"), occurredOnPrecision: asDatePrecision(row.occurred_on_precision),
    summary: stringValue(row, "summary"), outcomeSummary: nullableString(row, "outcome_summary"),
    ballSideAfter: asBallSide(row.ball_side_after), ballOwnerAfter: nullableString(row, "ball_owner_after"),
    actorSide: asActorSide(row.actor_side), actorLabel: nullableString(row, "actor_label"),
    confidence: asConfidence(row.confidence), sourceKind: asSourceKind(row.source_kind), sourceRef: nullableString(row, "source_ref"),
    detailMd: nullableString(row, "detail_md"),
    createdAt: stringValue(row, "created_at"),
  };
}

function mapPartnerRole(row: RawRow): SxPartnerRole {
  return {
    id: stringValue(row, "id"), partnerId: stringValue(row, "partner_id"), roleKind: asPartnerRoleKind(row.role_kind),
    relationshipState: asRelationshipState(row.relationship_state), roleLabel: nullableString(row, "role_label"),
    isPrimary: row.is_primary === true, sortOrder: numberValue(row, "sort_order"),
  };
}

function mapPartnerWorkItem(row: RawRow): SxPartnerWorkItem {
  return {
    id: stringValue(row, "id"), partnerId: stringValue(row, "partner_id"), side: asActorSide(row.side), itemKind: asWorkItemKind(row.item_kind),
    title: stringValue(row, "title"), detail: nullableString(row, "detail"), ownerLabel: nullableString(row, "owner_label"),
    status: asWorkItemStatus(row.status), dueDate: nullableString(row, "due_date"), dueDatePrecision: asDatePrecision(row.due_date_precision),
    completionCriteria: nullableString(row, "completion_criteria"), completedOn: nullableString(row, "completed_on"),
    completionEvidence: nullableString(row, "completion_evidence"), acceptedBy: nullableString(row, "accepted_by"), acceptedOn: nullableString(row, "accepted_on"),
    handoffTo: nullableString(row, "handoff_to"),
    relatedMilestoneId: nullableString(row, "related_milestone_id"), lastVerifiedAt: stringValue(row, "last_verified_at"),
    confidence: asConfidence(row.confidence), sourceKind: asSourceKind(row.source_kind), sourceRef: nullableString(row, "source_ref"),
    sortOrder: numberValue(row, "sort_order"),
  };
}

function asActivityState(value: unknown): SxPartnerActivityState {
  const values: SxPartnerActivityState[] = ["active", "waiting_partner", "waiting_internal", "stalled", "on_hold", "dropped", "unknown"];
  return values.includes(value as SxPartnerActivityState) ? (value as SxPartnerActivityState) : "unknown";
}

function asPocCategory(value: unknown): SxPocCategory | null {
  const values: SxPocCategory[] = ["poc_candidate", "tech_partner", "sample_provider", "sample_route"];
  return values.includes(value as SxPocCategory) ? (value as SxPocCategory) : null;
}

function asPocJudgment(value: unknown): SxPocJudgment | null {
  const values: SxPocJudgment[] = ["high", "medium", "low"];
  return values.includes(value as SxPocJudgment) ? (value as SxPocJudgment) : null;
}

function asPocGrade(value: unknown): SxPocGrade | null {
  const values: SxPocGrade[] = ["s", "a", "b", "x"];
  return values.includes(value as SxPocGrade) ? (value as SxPocGrade) : null;
}

function asMeetingMode(value: unknown): SxMeetingMode | null {
  const values: SxMeetingMode[] = ["onsite", "online", "hybrid", "phone"];
  return values.includes(value as SxMeetingMode) ? (value as SxMeetingMode) : null;
}

function asSampleStatus(value: unknown): SxSampleStatus {
  const values: SxSampleStatus[] = ["intent", "negotiating", "agreed_pending", "scheduled", "received", "analyzed", "unknown"];
  return values.includes(value as SxSampleStatus) ? (value as SxSampleStatus) : "unknown";
}

function mapPartnerSample(row: RawRow): SxPartnerSample {
  return {
    id: stringValue(row, "id"), partnerId: stringValue(row, "partner_id"), label: stringValue(row, "label"),
    status: asSampleStatus(row.status), receivedOn: nullableString(row, "received_on"), storageLocation: nullableString(row, "storage_location"),
    ownerLabel: nullableString(row, "owner_label"), notes: nullableString(row, "notes"),
    confidence: asConfidence(row.confidence), sourceKind: asSourceKind(row.source_kind), sourceRef: nullableString(row, "source_ref"),
    sortOrder: numberValue(row, "sort_order"),
  };
}

function mapKpi(row: RawRow): SxKpi {
  return {
    id: stringValue(row, "id"), outcomeId: stringValue(row, "outcome_id"), track: asTrack(row.track), slug: stringValue(row, "slug"), title: stringValue(row, "title"), metricKind: stringValue(row, "metric_kind"),
    baseline: nullableNumber(row, "baseline"), target: nullableNumber(row, "target"), actual: nullableNumber(row, "actual"), unit: stringValue(row, "unit"), threshold: nullableNumber(row, "threshold"), thresholdRule: row.threshold_rule === "lte" || row.threshold_rule === "between" ? row.threshold_rule : "gte", thresholdUpper: nullableNumber(row, "threshold_upper"), measurementDate: nullableString(row, "measurement_date"),
    frequency: stringValue(row, "frequency"), sourceLabel: stringValue(row, "source_label", "根拠未確認"), confidence: asConfidence(row.confidence), lastVerifiedAt: stringValue(row, "last_verified_at"), sourceKind: asSourceKind(row.source_kind), sourceRef: nullableString(row, "source_ref"), linkedMilestoneIds: [],
  };
}

function mapTechnicalTest(row: RawRow): SxTechnicalTest {
  return {
    id: stringValue(row, "id"), milestoneId: nullableString(row, "milestone_id"), outcomeId: nullableString(row, "outcome_id"), testSlug: stringValue(row, "test_slug"), testName: stringValue(row, "test_name"), testCondition: stringValue(row, "test_condition"),
    target: nullableString(row, "target"), actual: nullableString(row, "actual"), unit: stringValue(row, "unit"), repetition: nullableNumber(row, "repetition"), sample: nullableString(row, "sample"), trlCriterion: stringValue(row, "trl_criterion"), evidence: nullableString(row, "evidence"),
    status: (row.status as SxTechnicalTest["status"]) || "unassessed", measuredOn: nullableString(row, "measured_on"), ownerLabel: stringValue(row, "owner_label", "担当未確認"), confidence: asConfidence(row.confidence), sourceKind: asSourceKind(row.source_kind),
  };
}

function todayJst() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const HORIZON_MONTHS_MAX = 60;

function toYearMonth(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}

function horizonMonths(objective: SxObjective | null, milestones: SxManagementMilestone[], asOf: string): string[] {
  const candidates: string[] = [];
  for (const milestone of milestones) {
    for (const value of [milestone.plannedStart, milestone.plannedEnd, milestone.forecastEnd, milestone.actualEnd]) {
      const ym = toYearMonth(value);
      if (ym) candidates.push(ym);
    }
  }
  const objectiveYm = toYearMonth(objective?.targetDate);
  if (objectiveYm) candidates.push(objectiveYm);

  const asOfYm = toYearMonth(asOf) || asOf.slice(0, 7);
  if (!candidates.length) return [asOfYm];

  candidates.sort();
  const startYm = candidates[0];
  const endYm = candidates[candidates.length - 1];
  const [startYear, startMonth] = startYm.split("-").map(Number);
  const [endYear, endMonth] = endYm.split("-").map(Number);
  const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
  const length = Math.max(1, Math.min(totalMonths, HORIZON_MONTHS_MAX));

  return Array.from({ length }, (_, index) => {
    const date = new Date(Date.UTC(startYear, startMonth - 1 + index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function sortDate(a: string | null, b: string | null) {
  return (a || "9999-12-31").localeCompare(b || "9999-12-31");
}

function deltaDays(planned: string | null, forecast: string | null) {
  if (!planned || !forecast) return null;
  return dateDistance(planned, forecast);
}

function toLogicMilestone(row: RawRow): LogicMilestone {
  return {
    id: stringValue(row, "id"), slug: stringValue(row, "slug"), track: stringValue(row, "track"), status: asStatus(row.status), plannedStart: nullableString(row, "planned_start"), plannedEnd: nullableString(row, "planned_end"), forecastEnd: nullableString(row, "forecast_end"), actualEnd: nullableString(row, "actual_end"),
    dateCertainty: row.date_certainty === "confirmed" ? "confirmed" : "provisional", ownerLabel: stringValue(row, "owner_label", "担当未確認"), nextDeliverable: stringValue(row, "next_deliverable", "次の成果未確認"), maxIssue: stringValue(row, "max_issue", "最大論点未確認"), completionCriteria: stringValue(row, "completion_criteria", "完了条件未確認"), completionEvidence: nullableString(row, "completion_evidence"),
    criticality: (row.criticality as LogicMilestone["criticality"]) || "high", lastVerifiedAt: stringValue(row, "last_verified_at"), confidence: asConfidence(row.confidence),
  };
}

function makeMilestone(row: RawRow, derived: MilestoneDerivedResult, dependencyRows: SxDependency[], issueSlugs: string[], partnerSlugs: string[], linkedKpiIds: string[]): SxManagementMilestone {
  const plannedEnd = nullableString(row, "planned_end");
  const forecastEnd = nullableString(row, "forecast_end");
  return {
    id: stringValue(row, "id"), slug: stringValue(row, "slug"), track: asTrack(row.track), objectiveId: stringValue(row, "objective_id"), outcomeId: stringValue(row, "outcome_id"), title: stringValue(row, "title"), gate: stringValue(row, "gate"),
    timelineKind: asTimelineKind(row.timeline_kind), version: numberValue(row, "version", 1),
    status: derived.status, manualStatus: asStatus(row.status), derivedStatus: derived.status, statusReason: derived.reasonCodes.length ? derived.reasonCodes.join(" / ") : "必要項目を確認済み", reasonCodes: derived.reasonCodes,
    plannedStart: nullableString(row, "planned_start"), plannedEnd, forecastEnd, actualEnd: nullableString(row, "actual_end"), deltaDays: deltaDays(plannedEnd, forecastEnd), progressPct: Math.max(0, Math.min(100, numberValue(row, "progress_pct"))), dateCertainty: row.date_certainty === "confirmed" ? "confirmed" : "provisional", ownerMemberId: nullableString(row, "owner_member_id"), ownerLabel: stringValue(row, "owner_label", "担当未確認"), nextDeliverable: stringValue(row, "next_deliverable", "次の成果未確認"), maxIssue: stringValue(row, "max_issue", "最大論点未確認"), completionCriteria: stringValue(row, "completion_criteria", "完了条件未確認"), completionEvidence: nullableString(row, "completion_evidence"), criticality: (row.criticality as SxManagementMilestone["criticality"]) || "high", baselinePlanVersion: stringValue(row, "baseline_plan_version"), forecastChangeReason: nullableString(row, "forecast_change_reason"), statusSource: (row.status_source as SxManagementMilestone["statusSource"]) || "derived", statusOverrideReason: nullableString(row, "status_override_reason"), statusOverrideExpiresOn: nullableString(row, "status_override_expires_on"), statusOverrideApprovedBy: nullableString(row, "status_override_approved_by"), lastVerifiedAt: stringValue(row, "last_verified_at"), confidence: asConfidence(row.confidence), sourceKind: asSourceKind(row.source_kind), sourceRef: nullableString(row, "source_ref"),
    dependencySlugs: dependencyRows.map((dependency) => dependency.predecessorSlug === stringValue(row, "slug") ? dependency.successorSlug : dependency.predecessorSlug), predecessorIds: dependencyRows.filter((dependency) => dependency.successorMilestoneId === stringValue(row, "id")).map((dependency) => dependency.predecessorMilestoneId), successorIds: dependencyRows.filter((dependency) => dependency.predecessorMilestoneId === stringValue(row, "id")).map((dependency) => dependency.successorMilestoneId), relatedIssueSlugs: issueSlugs, relatedPartnerSlugs: partnerSlugs, linkedKpiIds, isStale: derived.stale, isOverdue: derived.overdue, isBlocked: derived.blocked,
  };
}

function makeTrackSummaries(milestones: SxManagementMilestone[], kpis: SxKpi[], today = todayJst()): SxTrackSummary[] {
  return SX_TRACKS.map((track) => {
    const trackMilestones = milestones.filter((item) => item.track === track.key);
    const milestone = selectCurrentMilestone(trackMilestones, today);
    const criticalUnknownCount = milestones.filter((item) => item.track === track.key && (item.status === "unassessed" || item.reasonCodes.includes("critical_unknown"))).length + kpis.filter((kpi) => kpi.track === track.key && (kpi.actual == null || kpi.confidence === "unknown")).length;
    const staleCount = milestones.filter((item) => item.track === track.key && item.isStale).length + kpis.filter((kpi) => kpi.track === track.key && dateDistance(kpi.lastVerifiedAt, todayJst()) > 14).length;
    const gateFailures = milestones.filter((item) => item.track === track.key && (item.criticality === "critical" || item.criticality === "high")).flatMap((item) => item.reasonCodes.map((code) => `${item.slug}:${code}`));
    return {
      key: track.key, label: track.label, shortLabel: track.shortLabel, accent: track.accent, milestoneId: milestone?.id || null, milestoneSlug: milestone?.slug || null, gate: milestone?.gate || "現在ゲート未確認", status: milestone?.status || "unassessed", statusLabel: MILESTONE_STATUS_LABEL[milestone?.status || "unassessed"], derivedStatus: milestone?.derivedStatus || "unassessed", manualStatus: milestone?.manualStatus || "unassessed", plannedEnd: milestone?.plannedEnd || null, forecastEnd: milestone?.forecastEnd || null, deltaDays: milestone?.deltaDays ?? null, dateCertainty: milestone?.dateCertainty || null, progressPct: milestone?.progressPct || 0, ownerLabel: milestone?.ownerLabel || "担当未確認", nextDeliverable: milestone?.nextDeliverable || "次の成果未確認", maxIssue: milestone?.maxIssue || "最大論点未確認", lastVerifiedAt: milestone?.lastVerifiedAt || null, confidence: milestone?.confidence || "unknown", criticalUnknownCount, staleCount, gateReady: Boolean(milestone) && gateFailures.length === 0, gateFailures, reason: milestone?.statusReason || "現在地未評価",
    };
  });
}

function displayIssueStatus(status: unknown): SxManagementIssue["status"] {
  if (status === "validating" || status === "closed" || status === "on_hold") return status;
  return "open";
}

export function computeSxJudgment(
  tracks: SxTrackSummary[],
  milestones: SxManagementMilestone[],
  decisions: SxManagementDecision[],
  today = todayJst(),
  extras?: { kpis?: SxKpi[]; actions?: SxActionItem[]; commitments?: SxPartnerCommitment[]; roles?: SxOrganizationRole[]; dag?: DagHealth; objectivePresent?: boolean; outcomesCount?: number },
): SxJudgment {
  const kpis = extras?.kpis || [];
  const actions = extras?.actions || [];
  const commitments = extras?.commitments || [];
  const activeCommitments = commitments.filter((item) => item.status === "open" || item.status === "in_progress" || item.status === "blocked");
  const roles = extras?.roles || [];
  const currentPhaseEnd = milestones.filter((milestone) => milestone.status !== "completed").map((milestone) => milestone.forecastEnd || milestone.plannedEnd).filter((value): value is string => Boolean(value)).sort()[0] || null;
  const currentPhaseRoles = roles.filter((role) => role.required && (!role.dueDate || !currentPhaseEnd || role.dueDate <= currentPhaseEnd));
  const roleChecks = currentPhaseRoles.map((role) => Boolean(role.dueDate) && !isMissingOwner(role.ownerLabel) && Boolean(role.candidate || role.commitment) && Boolean(role.authority) && role.status !== "on_hold" && role.confidence !== "unknown");
  const actionChecks = actions.map((action) => evaluateActionState({ ownerLabel: action.ownerLabel, dueDate: action.dueDate, completionCriteria: action.completionCriteria, nextReviewOn: action.nextReviewOn, status: action.status, completionAt: action.completedAt, completionEvidence: action.completionNote }, today).ready);
  const roleFailures = currentPhaseRoles.flatMap((role, index) => roleChecks[index] ? [] : [`role:${role.roleSlug}`]);
  const actionFailures = actions.flatMap((action, index) => actionChecks[index] ? [] : [`action:${action.id}`]);
  const gateFailures = [
    ...(extras?.objectivePresent ? [] : ["objective_missing"]),
    ...((extras?.outcomesCount || 0) === 4 ? [] : ["outcome_chain_incomplete"]),
    ...tracks.flatMap((track) => track.gateReady ? [] : track.gateFailures),
    ...roleFailures,
    ...actionFailures,
    ...(extras?.dag?.valid === false ? ["dag_cycle"] : []),
  ];
  const requiredChecks = [Boolean(extras?.objectivePresent), (extras?.outcomesCount || 0) === 4, ...tracks.flatMap((track) => [Boolean(track.gate && track.gate !== "現在ゲート未確認"), track.derivedStatus !== "unassessed", Boolean(track.plannedEnd), Boolean(track.forecastEnd), track.dateCertainty === "confirmed", !isMissingOwner(track.ownerLabel), Boolean(track.nextDeliverable && !track.nextDeliverable.includes("未確認")), Boolean(track.maxIssue && !track.maxIssue.includes("未確認")), Boolean(track.lastVerifiedAt), track.confidence !== "unknown"]), ...kpis.map((kpi) => kpi.target != null && kpi.actual != null && kpi.threshold != null && Boolean(kpi.measurementDate) && kpi.confidence !== "unknown" && isKpiThresholdMet(kpi)), ...roleChecks, ...actionChecks];
  const overdueMilestones = milestones.filter((item) => item.isOverdue);
  const overdueDecisions = decisions.filter((item) => item.status === "open" && Boolean(item.dueDate && item.dueDate < today));
  const overdueActions = actions.filter((item) => item.status !== "completed" && Boolean(item.dueDate && item.dueDate < today));
  const overdueCommitments = activeCommitments.filter((item) => Boolean(item.dueDate && item.dueDate < today));
  const overdueCount = overdueMilestones.length + overdueDecisions.length + overdueActions.length + overdueCommitments.length;
  const staleCount = milestones.filter((item) => item.isStale).length + tracks.filter((item) => item.staleCount > 0).length + kpis.filter((item) => dateDistance(item.lastVerifiedAt, today) > 14).length + currentPhaseRoles.filter((item) => dateDistance(item.lastVerifiedAt, today) > 14).length;
  const blockedCount = milestones.filter((item) => item.isBlocked).length + (extras?.dag?.valid === false ? 1 : 0);
  const criticalUnknownCount = tracks.reduce((sum, track) => sum + track.criticalUnknownCount, 0) + currentPhaseRoles.filter((role) => role.vacancy || role.confidence === "unknown" || !role.candidate).length;
  const dueSoon = [...milestones.filter((item) => item.status !== "completed").map((item) => item.forecastEnd || item.plannedEnd), ...decisions.filter((item) => item.status === "open").map((item) => item.dueDate), ...actions.filter((item) => item.status !== "completed").map((item) => item.dueDate), ...activeCommitments.map((item) => item.dueDate)].filter((value): value is string => Boolean(value && value >= today && value <= new Date(Date.parse(`${today}T00:00:00.000Z`) + 7 * 86400000).toISOString().slice(0, 10))).length;
  const decisionQueue = decisions.filter((item) => item.status === "open" && item.isThisWeek).sort((a, b) => sortDate(a.dueDate, b.dueDate) || a.sortOrder - b.sortOrder).slice(0, 3);
  const nextDeadline = [...milestones.filter((item) => item.status !== "completed").map((item) => item.forecastEnd || item.plannedEnd), ...decisionQueue.map((item) => item.dueDate), ...actions.filter((item) => item.status !== "completed").map((item) => item.dueDate), ...activeCommitments.map((item) => item.dueDate)].filter((value): value is string => Boolean(value)).sort()[0] || null;
  const verifiedDates = [...milestones.map((item) => item.lastVerifiedAt), ...kpis.map((item) => item.lastVerifiedAt), ...decisions.map((item) => item.lastVerifiedAt), ...roles.map((item) => item.lastVerifiedAt)].filter(Boolean).sort();
  const thresholdFailureCount = milestones.filter((item) => item.reasonCodes.includes("kpi_threshold_failed")).length;
  const logic = computeManagementJudgment({ tracks: tracks.map((track) => ({ key: track.key, milestone: null, derived: null, dueSoon: false, criticalUnknownCount: track.criticalUnknownCount, staleCount: track.staleCount, gateReady: track.gateReady, gateFailures: track.gateFailures })), requiredChecks, overdueCount, staleCount, blockedCount, criticalUnknownCount, dueSoonCount: dueSoon, atRiskCount: milestones.filter((item) => item.status === "attention" || item.status === "at_risk").length, thresholdFailureCount, gateFailures, decisionQueue: decisionQueue.map((item) => item.id), nextDeadline, lastVerifiedAt: verifiedDates[verifiedDates.length - 1] || null });
  const label: SxJudgment["label"] = logic.key === "on_track" ? "順調" : logic.key === "attention" ? "注意" : logic.key === "crisis" ? "危機" : "未評価";
  return { key: logic.key, label, reasons: logic.reasons, decisionQueue, nextDeadline, lastVerifiedAt: verifiedDates[verifiedDates.length - 1] || null, completenessPct: logic.completenessPct, staleCount, overdueCount, criticalUnknownCount, blockedCount, provisionalDateCount: milestones.filter((item) => item.dateCertainty === "provisional").length, dagValid: extras?.dag?.valid !== false, criticalPathSlugs: extras?.dag?.criticalPath.map((id) => milestones.find((item) => item.id === id)?.slug || id) || [] };
}

export async function getSxManagementBundle(projectId: string, canManage: boolean): Promise<SxManagementBundle> {
  const db = createAdminClient();
  const live = (table: string, select: string) => db.from(table).select(select).eq("project_id", projectId).is("deleted_at", null);
  const plain = (table: string, select: string) => db.from(table).select(select).eq("project_id", projectId);
  const results = await Promise.all([
    live("project_management_objectives", "id,project_id,slug,title,definition_of_done,target_date,date_certainty,status,last_verified_at,confidence,source_kind,source_ref").order("slug"),
    live("project_management_outcomes", "id,project_id,objective_id,slug,track,title,definition_of_done,owner_label,status,last_verified_at,confidence,source_kind,source_ref").order("track"),
    live("project_management_milestones", "id,project_id,objective_id,outcome_id,slug,track,title,gate,timeline_kind,version,status,planned_start,planned_end,forecast_end,actual_end,progress_pct,date_certainty,owner_member_id,owner_label,next_deliverable,max_issue,completion_criteria,completion_evidence,criticality,baseline_plan_version,forecast_change_reason,status_source,status_reason,status_override_reason,status_override_expires_on,status_override_approved_by,last_verified_at,confidence,source_kind,source_ref,sort_order").order("sort_order"),
    live("project_management_kpis", "id,project_id,outcome_id,track,slug,title,metric_kind,baseline,target,actual,unit,threshold,threshold_rule,threshold_upper,measurement_date,frequency,source_label,confidence,last_verified_at,source_kind,source_ref").order("track"),
    plain("project_management_milestone_kpis", "project_id,milestone_id,kpi_id"),
    live("project_management_tasks", "id,project_id,milestone_id,parent_task_id,track,title,description,status,planned_start,planned_end,forecast_end,actual_end,progress_pct,date_certainty,owner_member_id,owner_label,goal,next_deliverable,blocker,completion_criteria,forecast_change_reason,sort_order,last_verified_at,confidence,source_kind,source_ref,created_by,updated_by,version").order("sort_order"),
    live("project_management_milestone_dependencies", "id,project_id,predecessor_milestone_id,successor_milestone_id,dependency_type,required,lag_days,note").order("created_at"),
    live("project_management_schedule_dependencies", "id,project_id,predecessor_type,predecessor_task_id,predecessor_milestone_id,successor_type,successor_task_id,successor_milestone_id,dependency_type").order("created_at"),
    live("project_management_issues", "id,project_id,milestone_id,outcome_id,slug,track,title,knowledge_type,status,owner_label,due_date,last_verified_at,confidence,source_kind,source_ref,sort_order").order("sort_order"),
    live("project_management_hypotheses", "id,project_id,issue_id,statement,status,owner_label,due_date,confidence,last_verified_at,source_kind,source_ref").order("due_date"),
    live("project_management_evidence", "id,project_id,issue_id,hypothesis_id,evidence_kind,summary,observed_on,source_label,confidence,last_verified_at").order("observed_on"),
    live("project_management_validation_runs", "id,project_id,hypothesis_id,validation_kind,planned_on,due_date,completed_on,status,owner_label,method,result_summary,confidence,source_kind,source_ref").order("due_date"),
    live("project_management_decisions", "id,project_id,issue_id,hypothesis_id,title,context,decision_state,rationale,decision_text,decided_by,decided_on,owner_label,due_date,is_this_week,sort_order,confidence,last_verified_at,source_kind,source_ref").order("sort_order"),
    live("project_management_action_items", "id,project_id,decision_id,title,owner_label,due_date,completion_criteria,next_review_on,status,completion_note,completed_at,last_verified_at,source_kind,source_ref").order("due_date"),
    live("project_management_update_history", "id,project_id,entity_type,entity_id,update_kind,summary,changed_by,changed_on,from_status,to_status").order("changed_on", { ascending: false }).limit(40),
    live("project_management_partners", "id,project_id,slug,name,introducer_label,connection_context,role_label,primary_track,relationship_stage,activity_state,poc_category,poc_grade,poc_likelihood,customer_value,value_note,effluent_components,effluent_volume_annual,effluent_cost_annual,next_meeting_on,next_meeting_time,next_meeting_mode,next_meeting_place,next_meeting_prep,agreement_state,agreed_scope,unagreed_scope,last_contact_date,next_commitment,due_date,owner_label,current_ball_side,current_ball_owner,next_ball_owner,target_state,due_date_precision,last_verified_at,confidence,source_kind,source_ref,sort_order").order("sort_order"),
    plain("project_management_partner_tracks", "project_id,partner_id,track,role_label,is_primary"),
    live("project_management_partner_commitments", "id,project_id,partner_id,title,commitment_text,commitment_kind,status,promised_on,due_date,completed_on,owner_label,counterparty_owner,sx_owner,evidence,next_review_on,last_verified_at,confidence,source_kind,source_ref").order("due_date"),
    live("project_management_partner_interactions", "id,project_id,partner_id,interaction_kind,occurred_on,occurred_on_precision,summary,outcome_summary,ball_side_after,ball_owner_after,actor_side,actor_label,confidence,source_kind,source_ref,detail_md,created_at").order("created_at", { ascending: false }),
    live("project_management_partner_roles", "id,project_id,partner_id,role_kind,relationship_state,role_label,is_primary,sort_order").order("sort_order"),
    live("project_management_partner_work_items", "id,project_id,partner_id,side,item_kind,title,detail,owner_label,status,due_date,due_date_precision,completion_criteria,completed_on,completion_evidence,accepted_by,accepted_on,handoff_to,related_milestone_id,last_verified_at,confidence,source_kind,source_ref,sort_order").order("sort_order"),
    live("project_management_partner_samples", "id,project_id,partner_id,label,status,received_on,storage_location,owner_label,notes,confidence,source_kind,source_ref,sort_order").order("sort_order"),
    plain("project_management_milestone_issue_links", "project_id,milestone_id,issue_id"),
    plain("project_management_milestone_partner_links", "project_id,milestone_id,partner_id"),
    live("project_management_raci", "id,project_id,milestone_id,stakeholder_label,responsibility_role,owner_label,confirmed,last_verified_at,confidence").order("milestone_id"),
    live("project_management_capacity", "id,project_id,track,milestone_id,role_label,required_people,confirmed_people,available_hours_week,planned_hours_week,measurement_date,source_label,confidence").order("measurement_date", { ascending: false }),
    live("project_management_technical_tests", "id,project_id,milestone_id,outcome_id,test_slug,test_name,test_condition,target,actual,unit,repetition,sample,trl_criterion,evidence,status,measured_on,owner_label,confidence,source_kind,source_ref").order("test_slug"),
    live("project_management_funding_snapshots", "id,project_id,snapshot_date,required_amount,secured_amount,unconfirmed_amount,use_summary,burn_per_month,runway_months,probability,cash_condition,source_label,confidence,source_kind,source_ref").order("snapshot_date", { ascending: false }),
    live("project_management_organization_roles", "id,project_id,role_slug,role_name,required,candidate,commitment,authority,vacancy,join_condition,due_date,status,owner_label,last_verified_at,confidence,source_kind,source_ref").order("due_date"),
    plain("project_management_field_audit", "id,project_id,entity_type,entity_id,field_name,source,version,verified_by,next_review_on,recorded_at").order("recorded_at", { ascending: false }).limit(80),
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error) throw new Error(`SX management bundle: ${error.message}`);
  const rows = results.map((result) => (result.data || []) as unknown as RawRow[]);
  const [objectiveRows, outcomeRows, milestoneRows, kpiRows, milestoneKpiRows, taskRows, dependencyRows, scheduleDependencyRows, issueRows, hypothesisRows, evidenceRows, validationRows, decisionRows, actionRows, historyRows, partnerRows, partnerTrackRows, commitmentRows, interactionRows, partnerRoleRows, partnerWorkItemRows, partnerSampleRows, milestoneIssueRows, milestonePartnerRows, raciRows, capacityRows, technicalRows, fundingRows, roleRows, auditRows] = rows;

  const objectiveRow = objectiveRows[0];
  const objective: SxObjective | null = objectiveRow ? { id: stringValue(objectiveRow, "id"), slug: stringValue(objectiveRow, "slug"), title: stringValue(objectiveRow, "title"), definitionOfDone: stringValue(objectiveRow, "definition_of_done"), targetDate: nullableString(objectiveRow, "target_date"), dateCertainty: objectiveRow.date_certainty === "confirmed" ? "confirmed" : "provisional", status: (objectiveRow.status as SxObjective["status"]) || "unassessed", lastVerifiedAt: stringValue(objectiveRow, "last_verified_at"), confidence: asConfidence(objectiveRow.confidence), sourceKind: asSourceKind(objectiveRow.source_kind), sourceRef: nullableString(objectiveRow, "source_ref") } : null;
  const outcomes: SxOutcome[] = outcomeRows.map((row) => ({ id: stringValue(row, "id"), objectiveId: stringValue(row, "objective_id"), slug: stringValue(row, "slug"), track: asTrack(row.track), title: stringValue(row, "title"), definitionOfDone: stringValue(row, "definition_of_done"), ownerLabel: stringValue(row, "owner_label", "担当未確認"), status: (row.status as SxOutcome["status"]) || "unassessed", lastVerifiedAt: stringValue(row, "last_verified_at"), confidence: asConfidence(row.confidence) }));
  const kpis = kpiRows.map(mapKpi);
  const tasks: SxTask[] = taskRows.map(mapTask);
  const milestoneById = new Map(milestoneRows.map((row) => [stringValue(row, "id"), row]));
  const baseLogicMilestones = milestoneRows.map(toLogicMilestone);
  const logicById = new Map(baseLogicMilestones.map((milestone) => [milestone.id, milestone]));
  const logicDependencies: LogicDependency[] = dependencyRows.map((row) => ({ id: stringValue(row, "id"), predecessorMilestoneId: stringValue(row, "predecessor_milestone_id"), successorMilestoneId: stringValue(row, "successor_milestone_id"), required: row.required !== false, lagDays: numberValue(row, "lag_days") }));
  const today = todayJst();
  const dag = buildDagHealth(baseLogicMilestones, logicDependencies, today);
  const kpisByMilestone = new Map<string, SxKpi[]>();
  for (const link of milestoneKpiRows) {
    const kpi = kpis.find((item) => item.id === stringValue(link, "kpi_id"));
    if (!kpi) continue;
    kpi.linkedMilestoneIds.push(stringValue(link, "milestone_id"));
    kpisByMilestone.set(stringValue(link, "milestone_id"), [...(kpisByMilestone.get(stringValue(link, "milestone_id")) || []), kpi]);
  }
  const dependencyDtos: SxDependency[] = dependencyRows.map((row) => ({ id: stringValue(row, "id"), predecessorMilestoneId: stringValue(row, "predecessor_milestone_id"), successorMilestoneId: stringValue(row, "successor_milestone_id"), predecessorSlug: stringValue(milestoneById.get(stringValue(row, "predecessor_milestone_id")) || {}, "slug", "不明な前提"), successorSlug: stringValue(milestoneById.get(stringValue(row, "successor_milestone_id")) || {}, "slug", "不明な成果"), dependencyType: (row.dependency_type as SxDependency["dependencyType"]) || "finish_to_start", required: row.required !== false, lagDays: numberValue(row, "lag_days"), note: nullableString(row, "note") }));
  const scheduleDependencies: SxScheduleDependency[] = scheduleDependencyRows.map((row) => ({
    id: stringValue(row, "id"),
    predecessorType: row.predecessor_type === "milestone" ? "milestone" : "task",
    predecessorTaskId: nullableString(row, "predecessor_task_id"),
    predecessorMilestoneId: nullableString(row, "predecessor_milestone_id"),
    successorType: row.successor_type === "milestone" ? "milestone" : "task",
    successorTaskId: nullableString(row, "successor_task_id"),
    successorMilestoneId: nullableString(row, "successor_milestone_id"),
    dependencyType: "finish_to_start",
  }));
  const preliminaryDerived = new Map<string, MilestoneDerivedResult>();
  const technicalEvidenceByMilestone = new Set(technicalRows.filter((row) => nullableString(row, "actual") || nullableString(row, "evidence")).map((row) => nullableString(row, "milestone_id")).filter((value): value is string => Boolean(value)));
  for (const milestone of baseLogicMilestones) {
    const linkedKpis = (kpisByMilestone.get(milestone.id) || []) as unknown as LogicKpi[];
    const hasKpiEvidence = linkedKpis.some((kpi) => kpi.actual != null && Boolean(kpi.measurementDate));
    preliminaryDerived.set(milestone.id, deriveMilestoneState(
      milestone,
      linkedKpis,
      logicDependencies.filter((edge) => edge.successorMilestoneId === milestone.id).map((edge) => logicById.get(edge.predecessorMilestoneId)!).filter(Boolean),
      dag.valid,
      today,
      { blocked: dag.blockedMilestoneIds.includes(milestone.id), waiting: dag.waitingMilestoneIds.includes(milestone.id) },
      hasKpiEvidence || technicalEvidenceByMilestone.has(milestone.id),
    ));
  }
  const issueLinksByMilestone = new Map<string, string[]>();
  for (const link of milestoneIssueRows) issueLinksByMilestone.set(stringValue(link, "milestone_id"), [...(issueLinksByMilestone.get(stringValue(link, "milestone_id")) || []), stringValue(link, "issue_id")]);
  const partnerLinksByMilestone = new Map<string, string[]>();
  for (const link of milestonePartnerRows) partnerLinksByMilestone.set(stringValue(link, "milestone_id"), [...(partnerLinksByMilestone.get(stringValue(link, "milestone_id")) || []), stringValue(link, "partner_id")]);
  const issueById = new Map(issueRows.map((row) => [stringValue(row, "id"), row]));
  const partnerById = new Map(partnerRows.map((row) => [stringValue(row, "id"), row]));
  const hypotheses = hypothesisRows.map(mapHypothesis);
  const evidence = evidenceRows.map(mapEvidence);
  const validationRuns = validationRows.map(mapValidation);
  const actions = actionRows.map(mapAction);
  const rawDecisions = decisionRows.map((row) => ({ row, status: decisionStatus(row.decision_state) }));
  const decisions: SxManagementDecision[] = rawDecisions.map(({ row, status }) => {
    const issue = issueById.get(stringValue(row, "issue_id"));
    const track = issue ? asTrack(issue.track) : "organizational_building";
    const actionItems = actions.filter((action) => action.decisionId === stringValue(row, "id"));
    return { id: stringValue(row, "id"), slug: `decision-${stringValue(row, "id").slice(0, 8)}`, issueId: nullableString(row, "issue_id"), hypothesisId: nullableString(row, "hypothesis_id"), title: stringValue(row, "title"), context: stringValue(row, "context"), status, rationale: stringValue(row, "rationale"), decisionText: nullableString(row, "decision_text"), decidedBy: nullableString(row, "decided_by"), decidedOn: nullableString(row, "decided_on"), ownerLabel: stringValue(row, "owner_label", "担当未確認"), dueDate: nullableString(row, "due_date"), isThisWeek: row.is_this_week === true, sortOrder: numberValue(row, "sort_order"), confidence: asConfidence(row.confidence), lastVerifiedAt: stringValue(row, "last_verified_at"), sourceKind: asSourceKind(row.source_kind), sourceRef: nullableString(row, "source_ref"), track, actionItems };
  });
  const issues: SxManagementIssue[] = issueRows.map((row) => {
    const issueId = stringValue(row, "id");
    const issueHypotheses = hypotheses.filter((item) => item.issueId === issueId);
    const issueEvidence = evidence.filter((item) => item.issueId === issueId);
    const issueValidations = validationRuns.filter((item) => issueHypotheses.some((hypothesis) => hypothesis.id === item.hypothesisId));
    const issueDecisions = decisions.filter((decision) => decision.issueId === issueId || issueHypotheses.some((hypothesis) => hypothesis.id === decision.hypothesisId));
    const issueActions = issueDecisions.flatMap((decision) => decision.actionItems);
    const milestoneId = nullableString(row, "milestone_id");
    const milestone = milestoneId ? milestoneById.get(milestoneId) : undefined;
    return { id: issueId, slug: stringValue(row, "slug"), track: asTrack(row.track), milestoneSlug: milestone ? stringValue(milestone, "slug") : null, title: stringValue(row, "title"), knowledgeType: asIssueKind(row.knowledge_type), status: displayIssueStatus(row.status), hypothesis: issueHypotheses.map((item) => item.statement).join(" / ") || (asIssueKind(row.knowledge_type) === "fact" ? "事実として登録。根拠の履歴を確認" : "仮説未登録"), evidenceFor: issueEvidence.filter((item) => item.kind === "supporting" || item.kind === "observation").map((item) => item.summary).join(" / ") || "根拠未登録", counterevidenceOrMissing: issueEvidence.filter((item) => item.kind === "counter" || item.kind === "missing").map((item) => item.summary).join(" / ") || "反証・不足未登録", nextValidation: issueValidations.map((item) => `${item.method}${item.dueDate ? `（期限 ${item.dueDate}）` : ""}`).join(" / ") || "次の検証未登録", ownerLabel: stringValue(row, "owner_label", "担当未確認"), dueDate: nullableString(row, "due_date"), decisionText: issueDecisions.map((item) => item.decisionText).filter(Boolean).join(" / ") || null, lastVerifiedAt: stringValue(row, "last_verified_at"), confidence: asConfidence(row.confidence), sourceKind: asSourceKind(row.source_kind), sourceRef: nullableString(row, "source_ref"), relatedMilestoneSlugs: milestone ? [stringValue(milestone, "slug")] : [], relatedPartnerSlugs: milestoneId ? (partnerLinksByMilestone.get(milestoneId) || []).map((partnerId) => stringValue(partnerById.get(partnerId) || {}, "slug")).filter(Boolean) : [], hypotheses: issueHypotheses, evidence: issueEvidence, validationRuns: issueValidations, decisions: issueDecisions, actionItems: issueActions };
  });
  const commitments = commitmentRows.map(mapCommitment);
  const interactions = interactionRows.map(mapInteraction);
  const partnerTracksById = new Map<string, SxPartnerTrack[]>();
  for (const row of partnerTrackRows) partnerTracksById.set(stringValue(row, "partner_id"), [...(partnerTracksById.get(stringValue(row, "partner_id")) || []), { track: asTrack(row.track), roleLabel: stringValue(row, "role_label"), isPrimary: row.is_primary === true }]);
  const rolesByPartner = new Map<string, SxPartnerRole[]>();
  for (const row of partnerRoleRows) {
    const partnerId = stringValue(row, "partner_id");
    rolesByPartner.set(partnerId, [...(rolesByPartner.get(partnerId) || []), mapPartnerRole(row)]);
  }
  const workItemsByPartner = new Map<string, SxPartnerWorkItem[]>();
  for (const row of partnerWorkItemRows) {
    const partnerId = stringValue(row, "partner_id");
    workItemsByPartner.set(partnerId, [...(workItemsByPartner.get(partnerId) || []), mapPartnerWorkItem(row)]);
  }
  const samplesByPartner = new Map<string, SxPartnerSample[]>();
  for (const row of partnerSampleRows) {
    const partnerId = stringValue(row, "partner_id");
    samplesByPartner.set(partnerId, [...(samplesByPartner.get(partnerId) || []), mapPartnerSample(row)]);
  }
  const partners: SxManagementPartner[] = partnerRows.map((row) => {
    const partnerId = stringValue(row, "id");
    const partnerSlug = stringValue(row, "slug");
    const tracks = partnerTracksById.get(partnerId) || [{ track: asTrack(row.primary_track), roleLabel: stringValue(row, "role_label"), isPrimary: true }];
    const relatedMilestoneIds = milestonePartnerRows.filter((link) => stringValue(link, "partner_id") === partnerId).map((link) => stringValue(link, "milestone_id"));
    const relatedIssueIds = relatedMilestoneIds.flatMap((milestoneId) => issueLinksByMilestone.get(milestoneId) || []);
    const roles = (rolesByPartner.get(partnerId) || []).slice().sort((a, b) => (a.isPrimary === b.isPrimary ? a.sortOrder - b.sortOrder : a.isPrimary ? -1 : 1));
    const primaryRole = roles.find((role) => role.isPrimary) || null;
    const deferredLowPriority = primaryRole?.relationshipState === "on_hold";
    return {
      id: partnerId, slug: partnerSlug, track: tracks.find((item) => item.isPrimary)?.track || tracks[0].track, tracks,
      name: stringValue(row, "name"), introducerLabel: nullableString(row, "introducer_label"), connectionContext: nullableString(row, "connection_context"), roleLabel: stringValue(row, "role_label"), relationshipStage: asPartnerStage(row.relationship_stage), activityState: asActivityState(row.activity_state), pocCategory: asPocCategory(row.poc_category), pocGrade: asPocGrade(row.poc_grade), pocLikelihood: asPocJudgment(row.poc_likelihood), customerValue: asPocJudgment(row.customer_value), valueNote: nullableString(row, "value_note"), effluentComponents: nullableString(row, "effluent_components"), effluentVolumeAnnual: nullableString(row, "effluent_volume_annual"), effluentCostAnnual: nullableString(row, "effluent_cost_annual"), nextMeetingOn: nullableString(row, "next_meeting_on"), nextMeetingTime: nullableString(row, "next_meeting_time"), nextMeetingMode: asMeetingMode(row.next_meeting_mode), nextMeetingPlace: nullableString(row, "next_meeting_place"), nextMeetingPrep: nullableString(row, "next_meeting_prep"),
      agreementState: asAgreementState(row.agreement_state), agreedScope: stringValue(row, "agreed_scope"), unagreedScope: stringValue(row, "unagreed_scope"),
      lastContactDate: nullableString(row, "last_contact_date"), nextCommitment: stringValue(row, "next_commitment"), dueDate: nullableString(row, "due_date"),
      ownerLabel: stringValue(row, "owner_label", "担当未確認"), currentBallSide: asBallSide(row.current_ball_side), currentBallOwner: nullableString(row, "current_ball_owner"),
      nextBallOwner: nullableString(row, "next_ball_owner"), targetState: nullableString(row, "target_state"), dueDatePrecision: asDatePrecision(row.due_date_precision),
      lastVerifiedAt: stringValue(row, "last_verified_at"), confidence: asConfidence(row.confidence), sourceKind: asSourceKind(row.source_kind), sourceRef: nullableString(row, "source_ref"),
      relatedMilestoneSlugs: relatedMilestoneIds.map((id) => stringValue(milestoneById.get(id) || {}, "slug")).filter(Boolean),
      relatedIssueSlugs: relatedIssueIds.map((id) => stringValue(issueById.get(id) || {}, "slug")).filter(Boolean),
      commitments: commitments.filter((item) => item.partnerId === partnerId), interactions: interactions.filter((item) => item.partnerId === partnerId),
      roles, workItems: workItemsByPartner.get(partnerId) || [], samples: samplesByPartner.get(partnerId) || [], deferredLowPriority,
    };
  });
  const dependencyByMilestone = (id: string) => dependencyDtos.filter((dependency) => dependency.predecessorMilestoneId === id || dependency.successorMilestoneId === id);
  const milestones: SxManagementMilestone[] = baseLogicMilestones.map((logicMilestone) => {
    const row = milestoneById.get(logicMilestone.id)!;
    const derived = preliminaryDerived.get(logicMilestone.id)!;
    const issueSlugs = (issueLinksByMilestone.get(logicMilestone.id) || []).map((issueId) => stringValue(issueById.get(issueId) || {}, "slug")).filter(Boolean);
    const partnerSlugs = (partnerLinksByMilestone.get(logicMilestone.id) || []).map((partnerId) => stringValue(partnerById.get(partnerId) || {}, "slug")).filter(Boolean);
    return makeMilestone(row, derived, dependencyByMilestone(logicMilestone.id), issueSlugs, partnerSlugs, (kpisByMilestone.get(logicMilestone.id) || []).map((item) => item.id));
  });
  const raci: SxRaci[] = raciRows.map((row) => ({ id: stringValue(row, "id"), milestoneId: stringValue(row, "milestone_id"), stakeholderLabel: stringValue(row, "stakeholder_label"), responsibilityRole: (row.responsibility_role as SxRaci["responsibilityRole"]) || "I", ownerLabel: stringValue(row, "owner_label", "担当未確認"), confirmed: row.confirmed === true, lastVerifiedAt: stringValue(row, "last_verified_at"), confidence: asConfidence(row.confidence) }));
  const capacity: SxCapacity[] = capacityRows.map((row) => ({ id: stringValue(row, "id"), track: asTrack(row.track), milestoneId: nullableString(row, "milestone_id"), roleLabel: stringValue(row, "role_label"), requiredPeople: numberValue(row, "required_people"), confirmedPeople: numberValue(row, "confirmed_people"), availableHoursWeek: nullableNumber(row, "available_hours_week"), plannedHoursWeek: nullableNumber(row, "planned_hours_week"), measurementDate: stringValue(row, "measurement_date"), sourceLabel: stringValue(row, "source_label"), confidence: asConfidence(row.confidence) }));
  const technicalTests = technicalRows.map(mapTechnicalTest);
  const fundingSnapshots: SxFundingSnapshot[] = fundingRows.map((row) => ({ id: stringValue(row, "id"), snapshotDate: stringValue(row, "snapshot_date"), requiredAmount: nullableNumber(row, "required_amount"), securedAmount: nullableNumber(row, "secured_amount"), unconfirmedAmount: nullableNumber(row, "unconfirmed_amount"), useSummary: stringValue(row, "use_summary"), burnPerMonth: nullableNumber(row, "burn_per_month"), runwayMonths: nullableNumber(row, "runway_months"), probability: nullableNumber(row, "probability"), cashCondition: stringValue(row, "cash_condition"), sourceLabel: stringValue(row, "source_label"), confidence: asConfidence(row.confidence) }));
  const organizationRoles: SxOrganizationRole[] = roleRows.map((row) => ({ id: stringValue(row, "id"), roleSlug: stringValue(row, "role_slug"), roleName: stringValue(row, "role_name"), required: row.required !== false, candidate: nullableString(row, "candidate"), commitment: nullableString(row, "commitment"), authority: stringValue(row, "authority"), vacancy: row.vacancy !== false, joinCondition: stringValue(row, "join_condition"), dueDate: nullableString(row, "due_date"), status: (row.status as SxOrganizationRole["status"]) || "unassessed", ownerLabel: stringValue(row, "owner_label", "担当未確認"), lastVerifiedAt: stringValue(row, "last_verified_at"), confidence: asConfidence(row.confidence) }));
  const history: SxHistory[] = historyRows.map((row) => ({ id: stringValue(row, "id"), entityType: stringValue(row, "entity_type"), entityId: nullableString(row, "entity_id"), updateKind: stringValue(row, "update_kind"), summary: stringValue(row, "summary"), changedBy: stringValue(row, "changed_by"), changedOn: stringValue(row, "changed_on"), fromStatus: nullableString(row, "from_status"), toStatus: nullableString(row, "to_status") }));
  const fieldAudit: SxFieldAudit[] = auditRows.map((row) => ({ id: stringValue(row, "id"), entityType: stringValue(row, "entity_type"), entityId: stringValue(row, "entity_id"), fieldName: stringValue(row, "field_name"), source: stringValue(row, "source"), version: numberValue(row, "version", 1), verifiedBy: stringValue(row, "verified_by"), nextReviewOn: nullableString(row, "next_review_on"), recordedAt: stringValue(row, "recorded_at") }));
  const tracks = makeTrackSummaries(milestones, kpis, today);
  const priorityPartnerIds = new Set(partners.filter((partner) => !partner.deferredLowPriority).map((partner) => partner.id));
  const judgmentCommitments = commitments.filter((commitment) => priorityPartnerIds.has(commitment.partnerId));
  const judgment = computeSxJudgment(tracks, milestones, decisions, today, { kpis, actions, commitments: judgmentCommitments, roles: organizationRoles, dag, objectivePresent: Boolean(objective), outcomesCount: outcomes.length });
  const partnerRoles = partners.flatMap((partner) => partner.roles);
  const partnerWorkItems = partners.flatMap((partner) => partner.workItems);
  return { asOf: today, horizonMonths: horizonMonths(objective, milestones, today), objective, outcomes, kpis, dependencies: dependencyDtos, scheduleDependencies, dag, judgment, tracks, milestones, tasks, issues, hypotheses, evidence, validationRuns, decisions, actions, partners, partnerCommitments: commitments, partnerInteractions: interactions, partnerRoles, partnerWorkItems, technicalTests, fundingSnapshots, organizationRoles, raci, capacity, history, fieldAudit, canManage, hasData: Boolean(objective || outcomes.length || milestones.length || issues.length || partners.length || decisions.length) };
}
