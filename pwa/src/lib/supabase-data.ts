/**
 * Supabase Data Access Layer
 * GAS API (gas-api.ts) の代替。Supabaseから直接データを取得する。
 * RLSはservice_role経由（GAS書き込み）なので、PWAからはanon keyでread-only。
 * DEV_MODEではanon keyでRLSバイパス不要のためpublicアクセス。
 */

import { createClient } from "@supabase/supabase-js";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { contractBackedClientAmount, yenNumber } from "@/lib/contract-money";
import type { ProjectContractTerms } from "@/lib/project-contract-terms";
import {
  allocateSeasonBufferByYm,
  buildExtraRevenueByYm,
  parseSeasonBufferTotal,
} from "@/lib/finance/season-finance";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// PWAからの読み取り用クライアント（anon key）
// ビルド時（SSG）にはURL空でcreateClientが失敗するのでダミー値で初期化
const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "amd-os-pwa-readonly-supabase-data",
    },
  }
);

/** 認証付きブラウザクライアント（RLS書き込み用） */
function getAuthClient() {
  return createBrowserSupabase();
}

async function syncRewardsForPlanCycle(planCycleId: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch("/api/rewards/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planCycleId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      console.warn("[reward-summary] plan cycle sync failed:", data?.error || res.statusText);
    }
  } catch (error) {
    console.warn("[reward-summary] plan cycle sync failed:", error);
  }
}

// ============================================================
// 型定義（GAS API互換）
// ============================================================

export interface DashProject {
  projectId: string;
  projectName: string;
  displayName?: string;
  shortLabel?: string;
  roleLine?: string;
  clientName: string;
  status: string;
  projectCategory?: string;
  startYm?: string;
  endYm?: string;
}

/** 左ナビのボードから各PJコックピットへ入るための軽量な一覧。 */
export type ActiveProjectNavItem = {
  projectId: string;
  projectName: string;
};

export interface DashBillingStatus {
  ym: string;
  status: string;
  budgetYen: number;
  meetingDone: boolean;
  reportDone: boolean;
  budgetDone: boolean;
  allocationDone: boolean;
  invoiceDone: boolean;
  paymentDone: boolean;
  billingAmount: number;
  invoiceYm: string;
}

export interface PlanCycleBundle {
  planCycle: PlanCycle;
  milestones: Milestone[];
  progress: MilestoneProgress[];
  subItems: SubItem[];
  responsibilities: MilestoneResponsibility[];
  msActivities: MemberMsActivity[];
  memberActivities: MemberActivity[];
}

export interface CockpitData {
  project: {
    projectId: string;
	    projectName: string;
	    clientName: string;
	    status: string;
	    projectCategory?: string;
    projectType?: string;
    feeType?: string | null;
    feeAmount?: number | null;
    startYm?: string | null;
    endYm?: string | null;
    paymentDueRule?: string | null;
    paymentDueDay?: number | null;
    contractTerms?: ProjectContractTerms | null;
    freezeFromYm?: string | null;
    restartExpectedYm?: string | null;
  };
  currentYm: string;
  billingCycles: BillingCycleDetail[];
  planCycle: PlanCycle | null;
  milestones: Milestone[];
  progress: MilestoneProgress[];
  reports: ReportSummary[];
  members: string[];
  nudges: NudgeItem[];
  tasks: TaskItem[];
  subItems: SubItem[];
  responsibilities: MilestoneResponsibility[];
  memberMap: Record<string, string>; // memberId → codeName
  pastPlanCycles: PlanCycleBundle[];
  msActivities: MemberMsActivity[];
  memberActivities: MemberActivity[];
  strategySignals: ProjectStrategySignal[];
  msChangeHistory: MilestoneChangeHistory[];
  seasonFinance: CockpitSeasonFinance | null;
}

export interface RewardSummaryBreakdown {
  msKey: string;
  title: string;
  share: number; // 0.0–1.0
  earnedPt: number;
  msConsumedPt: number;
  pool?: "regular" | "cap_extra";
  ptUnit?: number;
  payYen?: number;
}

export interface RewardSummaryMember {
  memberId: string;
  memberName?: string; // 実名（codeName-onlyルールに反するためUIでは memberMap で変換）
  earnedPt: number;
  basePay: number;
  bonusPt: number;
  totalPay: number;
  cappedFrom?: number; // capped時のみ：本来の合計
  carryInYen?: number;
  deferredYen?: number;
  grossDueYen?: number;
  stockYen?: number;
  regularEarnedPt?: number;
  extraEarnedPt?: number;
  regularBasePay?: number;
  extraBasePay?: number;
  regularPaidYen?: number;
  extraPaidYen?: number;
  regularGrossDueYen?: number;
  extraGrossDueYen?: number;
  regularStockYen?: number;
  extraStockYen?: number;
  companyReserveYen?: number;
  regularCompanyReserveYen?: number;
  extraCompanyReserveYen?: number;
  officerReserveYen?: number;
  companyReserveUnfundedYen?: number;
  payoutExcluded?: boolean;
  breakdown: RewardSummaryBreakdown[];
}

export interface RewardSummary {
  capped?: boolean;
  ptUnit?: number; // 1pt単価（円）
  members: RewardSummaryMember[];
  carryOverYen?: number;
  carryInYen?: number;
  capBudgetYen?: number;
  effectiveCapBudgetYen?: number;
  totalGrossDueYen?: number;
  totalPaySum?: number;
  monthlyBudget65?: number;
  regularPtUnit?: number;
  extraPtUnit?: number;
  regularCapBudgetYen?: number;
  extraCapBudgetYen?: number;
  effectiveRegularCapBudgetYen?: number;
  effectiveExtraCapBudgetYen?: number;
  regularCapCarryInYen?: number;
  extraCapCarryInYen?: number;
  regularUnusedCapCarryOutYen?: number;
  extraUnusedCapCarryOutYen?: number;
  regularFinalCapTopUpYen?: number;
  extraFinalCapTopUpYen?: number;
  finalCapTopUpYen?: number;
  regularTotalGrossDueYen?: number;
  extraTotalGrossDueYen?: number;
  regularCarryOverYen?: number;
  extraCarryOverYen?: number;
  companyReserveYen?: number;
  regularCompanyReserveYen?: number;
  extraCompanyReserveYen?: number;
  officerReserveYen?: number;
  companyReserveUnfundedYen?: number;
  externalPayoutCapYen?: number;
}

export interface CockpitSeasonFinanceMonth {
  ym: string;
  clientPaymentYen: number;
  bufferYen: number;
  pjBudgetYen: number;
  memberPayoutYen: number;
  companyReserveYen: number;
  unpaidStockYen: number;
  cashBalanceYen: number;
  rewardObligationYen: number;
  remainingAfterObligationYen: number;
  cycleStatus: string;
}

export interface CockpitSeasonFinance {
  planCycleId: string;
  periodStartYm: string;
  periodEndYm: string;
  status: "balanced" | "shortage" | "over_budget" | "source_overrun";
  totals: Omit<CockpitSeasonFinanceMonth, "ym" | "cycleStatus"> & {
    finalUnpaidStockYen: number;
    finalRemainingYen: number;
    sourceBudgetYen: number;
    sourceBudgetOverrunYen: number;
  };
  months: CockpitSeasonFinanceMonth[];
}

export interface BillingCycleDetail {
  projectId: string;
  ym: string;
  status: string;
  budgetYen: number;
  meetingStartAt: string | null;
  meetingEventId?: string | null;
  reportFixedAt: string | null;
  budgetConfirmedAt?: string | null;
  invoiceIssuedAt?: string | null;
  invoiceSentAt: string | null;
  payoutNoticeUploadedAt?: string | null;
  reimburseConfirmDone?: boolean;
  paymentConfirmedAt: string | null;
  rewardPaidAt?: string | null;
  invoiceYm?: string | null;
  invoiceBaseLinesJson?: string | null;
  invoiceSubject?: string | null;
  budgetReportedAmount: number;
  msProgressSummaryJson: unknown | null;
  rewardSummaryJson: RewardSummary | null;
}

export interface PlanCycle {
  planCycleId: string;
  projectId: string;
  status: string;
  budgetYen: number;
  extraDesignBudgetYen?: number;
  totalPoints: number;
  periodStartYm: string;
  periodEndYm: string;
  bufferBreakdownJson?: unknown | null;
}

export interface Milestone {
  milestoneId: string;
  planCycleId: string;
  title: string;
  points: number;
  tag: string;
  goalLevel: string;
  isActive: boolean;
  successCriteria: string;
  sortOrder: number;
  periodStartYm?: string | null;
  targetYm?: string | null;
}

export interface MilestoneProgress {
  milestoneKey: string;
  ym: string;
  progressPct: number;
  consumedPt: number;
  source: string;
  note?: string | null;
  confirmedAt: string | null;
}

export interface MemberMsActivity {
  memberId: string;
  milestoneId: string;
  ym: string;
  narrative?: string | null;
  learnedAddendum?: string | null;
  generatedAt?: string | null;
}

export interface ReportSummary {
  reportId: string;
  projectId: string;
  ym: string;
  status: string;
  draftExcerpt: string;
  finalExcerpt: string;
  hasDraft: boolean;
  hasFinal: boolean;
  generatedAt: string | null;
  fixedAt: string | null;
}

export interface NudgeItem {
  message: string;
  status: string;
  level: string;
  postedAt: string | null;
}

function isLegacyMonthlyRoutineNudge(message: string) {
  return /月次報告書|報告会|立替精算|請求額|請求書|見積|月次ルーティン|monthly routine|予算を確定|予算が確定/i.test(message);
}

export interface TaskItem {
  taskId: string;
  title: string;
  status: string;
  assignee: string;
  priority: string;
  description?: string;
  milestoneId?: string;
}

export interface SubItem {
  subItemId: string;
  milestoneId: string;
  title: string;
  weight: number;
  status: string;
  assignee: string;
}

export interface MilestoneResponsibility {
  milestoneId: string;
  memberId: string;
  share: number;
  /** role: 担当 / レビュー / サポート / 統括 */
  role?: string;
  taskDescription?: string;
}

export interface MilestoneChangeField {
  field: string;
  label: string;
  beforeValue: string | number | boolean | null;
  afterValue: string | number | boolean | null;
}

export interface MilestoneResponsibilityChange {
  memberId: string;
  role: string;
  beforeShare: number | null;
  afterShare: number | null;
  beforeTaskDescription: string | null;
  afterTaskDescription: string | null;
}

export interface MilestoneChangeItem {
  kind: "added" | "removed" | "updated";
  milestoneId: string;
  title: string;
  fields: MilestoneChangeField[];
  responsibilities: MilestoneResponsibilityChange[];
}

export interface MilestoneChangeHistory {
  id: string;
  projectId: string;
  planCycleId: string;
  revisionId: string;
  changedAt: string;
  changedByEmail: string | null;
  rewardPreviewStatus: "safe" | "warning" | "blocked" | "not_checked";
  changedMilestoneCount: number;
  addedMilestoneCount: number;
  removedMilestoneCount: number;
  updatedMilestoneCount: number;
  protectedCycleCount: number;
  offsetCount: number;
  positiveOffsetYen: number;
  negativeOffsetYen: number;
  changeItems: MilestoneChangeItem[];
}

/** member_activities の1件 */
export interface MemberActivity {
  id: string;
  memberId: string;
  projectId: string;
  ym: string;
  source: string;
  sourceItemId: string;
  milestoneId?: string | null;
  title?: string | null;
  contentPreview?: string | null;
  itemDate?: string | null;
  rawMetadata?: Record<string, unknown> | null;
  extractedAt: string;
}

export interface ProjectStrategySignal {
  signalId: string;
  projectId: string;
  ym: string | null;
  signalDate: string | null;
  signalType: string;
  polarity?: string | null;
  title: string;
  summary: string;
  scoreImpactSummary?: string | null;
  scoreImpactDelta?: Record<string, unknown> | null;
  impactLevel: string;
  decisionState: string;
  status: string;
  sourceRefs: unknown[];
  sourceHash: string;
  confidence: number;
  createdAt: string;
  confirmedAt: string | null;
}

// ============================================================
// 書き込み関数（PWAからSupabaseに直接書き込み — DEV_MODE用）
// ============================================================

/**
 * サブアイテムの完了ステータスをトグル
 */
export async function toggleSubItemStatus(subItemId: string, newStatus: "done" | "open"): Promise<boolean> {
  const { error } = await supabase
    .from("milestone_sub_items")
    .update({ status: newStatus })
    .eq("sub_item_id", subItemId);
  if (error) {
    console.error("toggleSubItemStatus:", error.message);
    return false;
  }
  return true;
}

/**
 * タスクのステータスを変更
 */
export async function updateTaskStatus(taskId: string, newStatus: string): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("task_id", taskId);
  if (error) {
    console.error("updateTaskStatus:", error.message);
    return false;
  }
  return true;
}

// ============================================================
// 次の期間のPlanCycle操作
// ============================================================

/**
 * 指定プロジェクトの次のPlanCycle（periodStartYm > currentPeriodEndYm）を取得
 */
export async function fetchPlanCycleById(
  planCycleId: string
): Promise<PlanCycle | null> {
  const { data, error } = await supabase
    .from("value_plan_cycles")
    .select("*")
    .eq("plan_cycle_id", planCycleId)
    .single();

  if (error) {
    console.error("fetchPlanCycleById:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    planCycleId: data.plan_cycle_id,
    projectId: data.project_id,
    status: data.status,
    budgetYen: data.budget_yen,
    totalPoints: data.total_points,
    periodStartYm: data.period_start_ym,
    periodEndYm: data.period_end_ym,
  };
}

export async function fetchNextPlanCycle(
  projectId: string,
  afterYm: string
): Promise<PlanCycle | null> {
  const { data, error } = await supabase
    .from("value_plan_cycles")
    .select("*")
    .eq("project_id", projectId)
    .gt("period_start_ym", afterYm)
    .order("period_start_ym")
    .limit(1);

  if (error) {
    console.error("fetchNextPlanCycle:", error.message);
    return null;
  }
  if (!data || data.length === 0) return null;

  const r = data[0];
  return {
    planCycleId: r.plan_cycle_id,
    projectId: r.project_id,
    status: r.status,
    budgetYen: r.budget_yen,
    totalPoints: r.total_points,
    periodStartYm: r.period_start_ym,
    periodEndYm: r.period_end_ym,
  };
}

export interface NextPlanCycleInput {
  projectId: string;
  periodStartYm: string;
  periodEndYm: string;
  budgetYen: number;
  totalPoints: number;
}

export interface NextMilestoneInput {
  milestoneId?: string;
  title: string;
  points: number;
  tag: "normal" | "routine" | "buffer";
  goalLevel: string;
  successCriteria: string;
  sortOrder: number;
  periodStartYm?: string | null;
  targetYm?: string | null;
}

/**
 * 次のPlanCycleを作成またはupsertし、plan_cycle_idを返す
 */
export async function upsertNextPlanCycle(
  input: NextPlanCycleInput,
  existingPlanCycleId?: string,
  status: "draft" | "active" = "draft"
): Promise<string | null> {
  const planCycleId = existingPlanCycleId || `PC-${input.projectId}-${input.periodStartYm}`;
  const row = {
    plan_cycle_id: planCycleId,
    project_id: input.projectId,
    period_start_ym: input.periodStartYm,
    period_end_ym: input.periodEndYm,
    budget_yen: input.budgetYen,
    total_points: input.totalPoints,
    status,
  };

  const authClient = getAuthClient();
  const { error } = await authClient
    .from("value_plan_cycles")
    .upsert(row, { onConflict: "plan_cycle_id" });

  if (error) {
    console.error("upsertNextPlanCycle:", error.message);
    return null;
  }
  return planCycleId;
}

/**
 * 次のPlanCycleのマイルストーンを一括upsert
 */
export async function upsertNextMilestones(
  planCycleId: string,
  milestones: NextMilestoneInput[]
): Promise<boolean> {
  const authClient = getAuthClient();

  const { data: existingMs } = await authClient
    .from("value_milestones")
    .select("milestone_id")
    .eq("plan_cycle_id", planCycleId);
  const existingIds = (existingMs || []).map((m) => m.milestone_id);

  if (milestones.length === 0) return true;

  const rows = milestones.map((ms, idx) => ({
    milestone_id: ms.milestoneId || `MS-${planCycleId}-${idx + 1}`,
    plan_cycle_id: planCycleId,
    title: ms.title,
    points: ms.points,
    tag: ms.tag,
    goal_level: ms.goalLevel || null,
    is_active: true,
    success_criteria: ms.successCriteria || null,
    sort_order: ms.sortOrder,
    period_start_ym: ms.periodStartYm || null,
    target_ym: ms.targetYm || null,
  }));
  const nextIds = rows.map((r) => r.milestone_id);

  // 編集モーダルでは既存のMS IDを維持する。削除されたMSだけ子テーブルごと消す。
  const removedIds = existingIds.filter((id) => !nextIds.includes(id));
  if (removedIds.length > 0) {
    await authClient.from("milestone_responsibility").delete().in("milestone_id", removedIds);
    await authClient.from("milestone_sub_items").delete().in("milestone_id", removedIds);
    await authClient.from("value_milestones").delete().in("milestone_id", removedIds);
  }

  const { error } = await authClient
    .from("value_milestones")
    .upsert(rows, { onConflict: "milestone_id" });

  if (error) {
    console.error("upsertNextMilestones:", error.message);
    return false;
  }
  return true;
}

/**
 * 次のPlanCycleのMSを取得
 */
export async function fetchMilestonesForPlanCycle(
  planCycleId: string
): Promise<Milestone[]> {
  const { data, error } = await supabase
    .from("value_milestones")
    .select("*")
    .eq("plan_cycle_id", planCycleId)
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    console.error("fetchMilestonesForPlanCycle:", error.message);
    return [];
  }

  return (data || []).map((ms) => ({
    milestoneId: ms.milestone_id,
    planCycleId: ms.plan_cycle_id,
    title: ms.title,
    points: ms.points,
    tag: ms.tag || "normal",
    goalLevel: ms.goal_level || "",
    isActive: ms.is_active,
    successCriteria: ms.success_criteria || "",
    sortOrder: ms.sort_order,
    periodStartYm: ms.period_start_ym || null,
    targetYm: ms.target_ym || null,
  }));
}

/**
 * MSの責任割合（コミットメント）を一括upsert
 * share は 0〜1 の小数（例: 0.3 = 30%）
 */
export async function upsertMilestoneResponsibilities(
  planCycleId: string,
  responsibilities: { milestoneId: string; memberId: string; share: number; role?: string; taskDescription?: string }[]
): Promise<boolean> {
  const authClient = getAuthClient();

  // 当該planCycleのMS一覧を取得してから、そのMSに紐づくresponsibilityを削除
  const { data: msData } = await authClient
    .from("value_milestones")
    .select("milestone_id")
    .eq("plan_cycle_id", planCycleId);
  const msIds = (msData || []).map((m) => m.milestone_id);
  if (msIds.length > 0) {
    await authClient
      .from("milestone_responsibility")
      .delete()
      .in("milestone_id", msIds);
  }

  const rows = responsibilities
    .filter((r) => r.share > 0)
    .map((r) => ({
      milestone_id: r.milestoneId,
      member_id: r.memberId,
      share: r.share,
      role: r.role || "担当",
      task_description: r.taskDescription || null,
    }));

  if (rows.length === 0) {
    await syncRewardsForPlanCycle(planCycleId);
    return true;
  }

  const { error } = await authClient
    .from("milestone_responsibility")
    .insert(rows);

  if (error) {
    console.error("upsertMilestoneResponsibilities:", error.message);
    return false;
  }
  await syncRewardsForPlanCycle(planCycleId);
  return true;
}

/**
 * PlanCycleのresponsibility（コミットメント割合）を取得
 */
export async function fetchResponsibilitiesForPlanCycle(
  planCycleId: string
): Promise<MilestoneResponsibility[]> {
  // まずMS一覧を取得
  const { data: msData } = await supabase
    .from("value_milestones")
    .select("milestone_id")
    .eq("plan_cycle_id", planCycleId);
  const msIds = (msData || []).map((m) => m.milestone_id);
  if (msIds.length === 0) return [];

  const { data, error } = await supabase
    .from("milestone_responsibility")
    .select("*")
    .in("milestone_id", msIds);

  if (error) {
    console.error("fetchResponsibilitiesForPlanCycle:", error.message);
    return [];
  }

  return (data || []).map((r) => ({
    milestoneId: r.milestone_id,
    memberId: r.member_id,
    share: Number(r.share) || 0,
    role: r.role || "担当",
    taskDescription: r.task_description || null,
  }));
}

// ============================================================
// Atlas — マクロ判断ナレッジベース
// ============================================================

export interface AtlasNode {
  id: string;
  type: "topic" | "signal" | "decision" | "project" | "technology" | "material" | "market";
  title: string;
  summary: string | null;
  metadata: Record<string, unknown>;
  importance: "high" | "medium" | "low";
  status: "active" | "archived" | "spawned";
  tags: string[];
  last_updated: string;
  created_at: string;
}

export interface AtlasObservation {
  id: string;
  node_id: string;
  observed_at: string;
  content: string;
  source_url: string | null;
  source_type: "news" | "report" | "data" | "manual" | null;
}

export interface AtlasDecision {
  id: string;
  topic_id: string | null;
  decided_at: string;
  action: "起業" | "スタジオ" | "支援" | "スルー" | "保留";
  rationale: string | null;
  outcome_eval_at: string | null;
  outcome: string | null;
  created_at: string;
}

/** トピック一覧を importance 順で取得（status=active のみ） */
export async function fetchAtlasTopics(): Promise<AtlasNode[]> {
  const { data, error } = await supabase
    .from("atlas_nodes")
    .select("*")
    .eq("type", "topic")
    .eq("status", "active")
    .order("importance", { ascending: false })
    .order("last_updated", { ascending: false });

  if (error) {
    console.error("fetchAtlasTopics:", error.message);
    return [];
  }
  return (data || []) as AtlasNode[];
}

/** ノード1件を取得 */
export async function fetchAtlasNode(id: string): Promise<AtlasNode | null> {
  const { data, error } = await supabase
    .from("atlas_nodes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("fetchAtlasNode:", error.message);
    return null;
  }
  return data as AtlasNode;
}

/** ノードへの観測（タイムライン）を取得（新しい順） */
export async function fetchAtlasObservations(nodeId: string): Promise<AtlasObservation[]> {
  const { data, error } = await supabase
    .from("atlas_observations")
    .select("*")
    .eq("node_id", nodeId)
    .order("observed_at", { ascending: false });

  if (error) {
    console.error("fetchAtlasObservations:", error.message);
    return [];
  }
  return (data || []) as AtlasObservation[];
}

/** 判断ログを取得（新しい順） */
export async function fetchAtlasDecisions(): Promise<AtlasDecision[]> {
  const { data, error } = await supabase
    .from("atlas_decisions")
    .select("*")
    .order("decided_at", { ascending: false });

  if (error) {
    console.error("fetchAtlasDecisions:", error.message);
    return [];
  }
  return (data || []) as AtlasDecision[];
}

/** 特定topicに紐づく判断ログを取得 */
export async function fetchAtlasDecisionsByTopic(topicId: string): Promise<AtlasDecision[]> {
  const { data, error } = await supabase
    .from("atlas_decisions")
    .select("*")
    .eq("topic_id", topicId)
    .order("decided_at", { ascending: false });

  if (error) {
    console.error("fetchAtlasDecisionsByTopic:", error.message);
    return [];
  }
  return (data || []) as AtlasDecision[];
}

/** 判断ログを新規作成 */
export async function addAtlasDecision(input: {
  topicId: string | null;
  action: AtlasDecision["action"];
  rationale?: string;
  decidedAt?: string;
  outcomeEvalAt?: string;
}): Promise<string | null> {
  const authClient = getAuthClient();
  const { data, error } = await authClient
    .from("atlas_decisions")
    .insert({
      topic_id: input.topicId,
      action: input.action,
      rationale: input.rationale || null,
      decided_at: input.decidedAt || new Date().toISOString(),
      outcome_eval_at: input.outcomeEvalAt || null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("addAtlasDecision:", error?.message);
    return null;
  }
  return data.id as string;
}

/** 判断ログを更新（outcomeの追記など） */
export async function updateAtlasDecision(
  id: string,
  patch: {
    action?: AtlasDecision["action"];
    rationale?: string | null;
    outcomeEvalAt?: string | null;
    outcome?: string | null;
  }
): Promise<boolean> {
  const authClient = getAuthClient();
  const update: Record<string, unknown> = {};
  if (patch.action !== undefined) update.action = patch.action;
  if (patch.rationale !== undefined) update.rationale = patch.rationale;
  if (patch.outcomeEvalAt !== undefined) update.outcome_eval_at = patch.outcomeEvalAt;
  if (patch.outcome !== undefined) update.outcome = patch.outcome;
  const { error } = await authClient.from("atlas_decisions").update(update).eq("id", id);
  if (error) {
    console.error("updateAtlasDecision:", error.message);
    return false;
  }
  return true;
}

export interface AtlasSignal {
  id: string;
  title: string;
  content: string;
  source_url: string | null;
  source_type: "news" | "report" | "data" | "manual" | "policy" | null;
  domain: string | null;
  suggested_tags: string[];
  importance: "high" | "medium" | "low";
  status: "inbox" | "accepted" | "held" | "rejected";
  target_node_id: string | null;
  story_id: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  created_at: string;
  metadata?: AtlasSignalMetadata | null;
}

/** policy シグナル等の構造化メタデータ。non-policy では null/undefined */
export interface AtlasSignalMetadata {
  ministry?: string;
  ministry_code?: string;
  doc_type?: string;
  announced_at?: string;
  raw_url?: string;
  pdf_url?: string;
  filter_relevance?: "high" | "medium";
  [key: string]: unknown;
}

export interface AtlasStory {
  id: string;
  title: string;
  summary: string | null;
  status: "ongoing" | "concluded" | "dormant";
  importance: "high" | "medium" | "low";
  tags: string[];
  primary_domain: string | null;
  started_at: string;
  last_updated_at: string;
  signal_count: number;
  created_at: string;
}

/** ストーリー一覧（最終更新降順） */
export async function fetchAtlasStories(opts?: {
  status?: AtlasStory["status"];
  limit?: number;
}): Promise<AtlasStory[]> {
  let q = supabase
    .from("atlas_stories")
    .select("*")
    .order("last_updated_at", { ascending: false })
    .limit(opts?.limit ?? 200);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) {
    console.error("fetchAtlasStories:", error.message);
    return [];
  }
  return (data || []) as AtlasStory[];
}

/** ストーリー統合履歴（学習プロンプト用、新しい順） */
export async function fetchRecentStoryMerges(limit = 20): Promise<
  Array<{
    id: string;
    merged_from_title: string;
    merged_from_summary: string | null;
    merged_to_id: string | null;
    merged_to_title: string;
    reason: string | null;
    created_at: string;
  }>
> {
  const { data, error } = await supabase
    .from("atlas_story_merges")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("fetchRecentStoryMerges:", error.message);
    return [];
  }
  return data || [];
}

/** ストーリー統合: from → to に signals を移し、from を削除する */
export async function mergeStoriesByApi(
  fromId: string,
  toId: string,
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/atlas/merge-stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromId, to: toId, reason }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ============================================================
// Atlas: Themes & Divergences (世界×日本ズレマップ)
// ============================================================

export interface AtlasTheme {
  id: string;
  name: string;
  description: string | null;
  primary_domain: string | null;
  tag_keywords: string[];
}

export interface AtlasDivergenceSignalRef {
  title: string;
  url: string | null;
  date?: string;
  ministry?: string | null;
}

export interface AtlasDivergence {
  id: string;
  theme_id: string;
  global_summary: string | null;
  japan_summary: string | null;
  divergence_message: string | null;
  divergence_score: number;
  global_intensity: number;
  japan_intensity: number;
  global_signal_count: number;
  japan_signal_count: number;
  signal_breakdown: {
    global?: AtlasDivergenceSignalRef[];
    japan?: AtlasDivergenceSignalRef[];
  } | null;
  generated_at: string;
}

export interface AtlasDivergenceWithTheme extends AtlasDivergence {
  theme: AtlasTheme;
}

/** divergence + テーマ情報を join して取得（divergence_score 降順） */
export async function fetchAtlasDivergences(): Promise<AtlasDivergenceWithTheme[]> {
  const [divRes, themeRes] = await Promise.all([
    supabase
      .from("atlas_divergences")
      .select("*")
      .order("divergence_score", { ascending: false }),
    supabase
      .from("atlas_themes")
      .select("id, name, description, primary_domain, tag_keywords")
      .eq("status", "active"),
  ]);
  if (divRes.error) {
    console.error("fetchAtlasDivergences:", divRes.error.message);
    return [];
  }
  const themesById = new Map<string, AtlasTheme>();
  for (const t of themeRes.data || []) {
    themesById.set(t.id as string, {
      id: t.id as string,
      name: t.name as string,
      description: (t.description as string | null) || null,
      primary_domain: (t.primary_domain as string | null) || null,
      tag_keywords: (t.tag_keywords as string[]) || [],
    });
  }
  return ((divRes.data || []) as AtlasDivergence[])
    .map((d) => {
      const theme = themesById.get(d.theme_id);
      if (!theme) return null;
      return { ...d, theme };
    })
    .filter((x): x is AtlasDivergenceWithTheme => x !== null);
}

/** シグナルを別ストーリーに移植 / 切り離し / 新ストーリー化 */
export async function moveSignal(
  signalId: string,
  action: "detach" | "moveToExisting" | "createNew",
  options?: {
    targetStoryId?: string;
    newStoryTitle?: string;
    newStorySummary?: string;
    useLlmProposal?: boolean;
  }
): Promise<{ ok: boolean; newStoryId?: string | null; error?: string }> {
  try {
    const res = await fetch("/api/atlas/move-signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signalId, action, ...(options || {}) }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error || `HTTP ${res.status}` };
    }
    return { ok: true, newStoryId: json.newStoryId };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** ストーリーに属するシグナル一覧（古い順 = 時系列） */
export async function fetchSignalsByStory(storyId: string): Promise<AtlasSignal[]> {
  const { data, error } = await supabase
    .from("atlas_signals")
    .select("*")
    .eq("story_id", storyId)
    .order("submitted_at", { ascending: true });
  if (error) {
    console.error("fetchSignalsByStory:", error.message);
    return [];
  }
  return (data || []) as AtlasSignal[];
}

/** Inbox: status=inbox のシグナル一覧（投入日時の降順） */
export async function fetchAtlasSignals(
  statusFilter: AtlasSignal["status"] = "inbox"
): Promise<AtlasSignal[]> {
  const { data, error } = await supabase
    .from("atlas_signals")
    .select("*")
    .eq("status", statusFilter)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("fetchAtlasSignals:", error.message);
    return [];
  }
  return (data || []) as AtlasSignal[];
}

/** Inbox件数（バッジ用） */
export async function fetchAtlasInboxCount(): Promise<number> {
  const { count, error } = await supabase
    .from("atlas_signals")
    .select("*", { count: "exact", head: true })
    .eq("status", "inbox");
  if (error) return 0;
  return count ?? 0;
}

/** えいみがシグナルを投入 */
export async function addAtlasSignal(signal: {
  title: string;
  content: string;
  source_url?: string;
  source_type?: AtlasSignal["source_type"];
  domain?: string;
  suggested_tags?: string[];
  importance?: AtlasSignal["importance"];
}): Promise<boolean> {
  const authClient = getAuthClient();
  const { error } = await authClient.from("atlas_signals").insert({
    title: signal.title,
    content: signal.content,
    source_url: signal.source_url || null,
    source_type: signal.source_type || "news",
    domain: signal.domain || null,
    suggested_tags: signal.suggested_tags || [],
    importance: signal.importance || "medium",
    status: "inbox",
  });
  if (error) {
    console.error("addAtlasSignal:", error.message);
    return false;
  }
  return true;
}

/** まさがシグナルを審査（Accept / Hold / Reject） */
export async function reviewAtlasSignal(
  signalId: string,
  action: "accepted" | "held" | "rejected",
  targetNodeId?: string
): Promise<boolean> {
  const authClient = getAuthClient();
  const { error } = await authClient
    .from("atlas_signals")
    .update({
      status: action,
      target_node_id: targetNodeId || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", signalId);
  if (error) {
    console.error("reviewAtlasSignal:", error.message);
    return false;
  }
  return true;
}

/** Accept: シグナルをobservationとしてtopicに追記 */
export async function acceptSignalToTopic(
  signalId: string,
  nodeId: string,
  signal: Pick<AtlasSignal, "content" | "source_url" | "source_type">
): Promise<boolean> {
  const authClient = getAuthClient();
  // 1. observationを追加
  const { error: obsErr } = await authClient.from("atlas_observations").insert({
    node_id: nodeId,
    content: signal.content,
    source_url: signal.source_url || null,
    source_type: signal.source_type || "news",
  });
  if (obsErr) {
    console.error("acceptSignalToTopic (obs):", obsErr.message);
    return false;
  }
  // 2. topic の last_updated を更新
  await authClient
    .from("atlas_nodes")
    .update({ last_updated: new Date().toISOString() })
    .eq("id", nodeId);
  // 3. signal を accepted にマーク
  return reviewAtlasSignal(signalId, "accepted", nodeId);
}

/** Inbox の全件を一括 accepted にする */
export async function acceptAllInboxSignals(): Promise<{ ok: boolean; count: number }> {
  const authClient = getAuthClient();
  const { data, error } = await authClient
    .from("atlas_signals")
    .update({ status: "accepted", reviewed_at: new Date().toISOString() })
    .eq("status", "inbox")
    .select("id");
  if (error) {
    console.error("acceptAllInboxSignals:", error.message);
    return { ok: false, count: 0 };
  }
  return { ok: true, count: data?.length || 0 };
}

/** Accept: 新規トピックを作成しつつシグナルをobservationとして紐付ける */
export async function acceptSignalToNewTopic(
  signalId: string,
  newTopic: {
    title: string;
    summary?: string;
    importance: AtlasNode["importance"];
    tags: string[];
  },
  signal: Pick<AtlasSignal, "content" | "source_url" | "source_type">
): Promise<string | null> {
  const authClient = getAuthClient();
  const { data: nodeData, error: nodeErr } = await authClient
    .from("atlas_nodes")
    .insert({
      type: "topic",
      title: newTopic.title,
      summary: newTopic.summary || null,
      importance: newTopic.importance,
      status: "active",
      tags: newTopic.tags,
    })
    .select("id")
    .single();
  if (nodeErr || !nodeData) {
    console.error("acceptSignalToNewTopic (node):", nodeErr?.message);
    return null;
  }
  const nodeId = nodeData.id as string;
  const { error: obsErr } = await authClient.from("atlas_observations").insert({
    node_id: nodeId,
    content: signal.content,
    source_url: signal.source_url || null,
    source_type: signal.source_type || "news",
  });
  if (obsErr) {
    console.error("acceptSignalToNewTopic (obs):", obsErr.message);
  }
  await reviewAtlasSignal(signalId, "accepted", nodeId);
  return nodeId;
}

/** トピックにobservationを追加（認証済みユーザー） */
export async function addAtlasObservation(
  nodeId: string,
  content: string,
  sourceUrl?: string,
  sourceType?: AtlasObservation["source_type"]
): Promise<boolean> {
  const authClient = getAuthClient();
  const { error } = await authClient.from("atlas_observations").insert({
    node_id: nodeId,
    content,
    source_url: sourceUrl || null,
    source_type: sourceType || "manual",
  });
  if (error) {
    console.error("addAtlasObservation:", error.message);
    return false;
  }
  return true;
}

// ============================================================
// Atlas Reports — 生成済みレポート
// ============================================================

export interface AtlasReport {
  id: string;
  type: "daily" | "weekly" | "monthly" | "instant";
  title: string;
  period_start: string | null;
  period_end: string | null;
  signal_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  signals_json: AtlasSignal[];
  macro_summary: string | null;
  created_at: string;
}

export async function fetchAtlasReports(
  type?: AtlasReport["type"],
  limit = 20
): Promise<AtlasReport[]> {
  let q = supabase
    .from("atlas_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (type) q = q.eq("type", type);
  const { data, error } = await q;
  if (error) {
    console.error("fetchAtlasReports:", error.message);
    return [];
  }
  return (data || []) as AtlasReport[];
}

export interface AtlasEdge {
  id: string;
  from_node: string;
  to_node: string;
  relation_type: string;
  strength: number | null;
  note: string | null;
  created_at: string;
}

/** グラフビュー用: 全ノード + 全エッジを取得（topic と decision のみ。signalはinbox管理） */
export async function fetchAtlasGraph(): Promise<{
  nodes: AtlasNode[];
  edges: AtlasEdge[];
}> {
  const [nodesRes, edgesRes] = await Promise.all([
    supabase
      .from("atlas_nodes")
      .select("*")
      .neq("status", "archived")
      .order("last_updated", { ascending: false }),
    supabase.from("atlas_edges").select("*"),
  ]);

  if (nodesRes.error) console.error("fetchAtlasGraph nodes:", nodesRes.error.message);
  if (edgesRes.error) console.error("fetchAtlasGraph edges:", edgesRes.error.message);

  return {
    nodes: (nodesRes.data || []) as AtlasNode[],
    edges: (edgesRes.data || []) as AtlasEdge[],
  };
}

export async function fetchAtlasReport(id: string): Promise<AtlasReport | null> {
  const { data, error } = await supabase
    .from("atlas_reports")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as AtlasReport;
}

/**
 * プロジェクトのアクティブメンバー一覧（codeName付き）を取得
 */
export async function fetchProjectMembers(
  projectId: string
): Promise<{ memberId: string; codeName: string }[]> {
  const { data: pmData } = await supabase
    .from("project_members")
    .select("member_id")
    .eq("project_id", projectId)
    .eq("is_active", true);
  if (!pmData || pmData.length === 0) return [];

  const memberIds = pmData.map((pm) => pm.member_id);
  const { data: mData } = await supabase
    .from("members")
    .select("member_id, code_name")
    .in("member_id", memberIds);

  return (mData || []).map((m) => ({
    memberId: m.member_id,
    codeName: m.code_name,
  }));
}

// ============================================================
// Member Activities（マイページ: 今月の活動）
// ============================================================

/**
 * 指定メンバーの今月（ym）の活動ログを取得（PJ別にまとめて返す）
 */
export async function fetchMemberActivities(
  memberId: string,
  ym: string,
  projectId?: string
): Promise<MemberActivity[]> {
  let query = supabase
    .from("member_activities")
    .select("*")
    .eq("member_id", memberId)
    .eq("ym", ym)
    .order("item_date", { ascending: false, nullsFirst: false });

  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error) {
    console.error("fetchMemberActivities:", error.message);
    return [];
  }
  return (data || []).map((r) => ({
    id: r.id,
    memberId: r.member_id,
    projectId: r.project_id,
    ym: r.ym,
    source: r.source,
    sourceItemId: r.source_item_id,
    milestoneId: r.milestone_id || null,
    title: r.title || null,
    contentPreview: r.content_preview || null,
    itemDate: r.item_date || null,
    rawMetadata: r.raw_metadata || null,
    extractedAt: r.extracted_at,
  }));
}

/**
 * member_activities を一括 upsert（service_role 用 — cron API から呼ぶ）
 */
export async function upsertMemberActivities(
  activities: Omit<MemberActivity, "id" | "extractedAt">[]
): Promise<boolean> {
  const authClient = getAuthClient();
  const rows = activities.map((a) => ({
    member_id: a.memberId,
    project_id: a.projectId,
    ym: a.ym,
    source: a.source,
    source_item_id: a.sourceItemId,
    milestone_id: a.milestoneId || null,
    title: a.title || null,
    content_preview: a.contentPreview || null,
    item_date: a.itemDate || null,
    raw_metadata: a.rawMetadata || null,
  }));

  const { error } = await authClient
    .from("member_activities")
    .upsert(rows, { onConflict: "member_id,project_id,source,source_item_id" });

  if (error) {
    console.error("upsertMemberActivities:", error.message);
    return false;
  }
  return true;
}

/**
 * 特定PJ×ymの member_activities を一括削除して再挿入（inferred source）
 */
export async function replaceInferredActivities(
  projectId: string,
  ym: string,
  activities: Omit<MemberActivity, "id" | "extractedAt">[]
): Promise<boolean> {
  const authClient = getAuthClient();

  // 既存の inferred レコードを削除
  await authClient
    .from("member_activities")
    .delete()
    .eq("project_id", projectId)
    .eq("ym", ym)
    .eq("source", "inferred");

  if (activities.length === 0) return true;

  const rows = activities.map((a) => ({
    member_id: a.memberId,
    project_id: a.projectId,
    ym: a.ym,
    source: "inferred",
    source_item_id: a.sourceItemId,
    milestone_id: a.milestoneId || null,
    title: a.title || null,
    content_preview: a.contentPreview || null,
    item_date: a.itemDate || null,
    raw_metadata: a.rawMetadata || null,
  }));

  const { error } = await authClient.from("member_activities").insert(rows);
  if (error) {
    console.error("replaceInferredActivities:", error.message);
    return false;
  }
  return true;
}

// ============================================================
// Source Cache（MTGサマリ等）
// ============================================================

export interface SourceCacheItem {
  cacheId: string;
  projectId: string;
  ym: string;
  source: string;
  itemId: string;
  title: string;
  itemDate: string | null;
  contentText: string;
  charCount: number;
  metadataJson: Record<string, unknown> | null;
  collectedAt: string | null;
}

/**
 * source_cache: プロジェクト×ソース種別でフィルタ取得
 */
export async function fetchSourceCache(
  projectId: string,
  source?: string,
  ym?: string,
  limit = 50
): Promise<SourceCacheItem[]> {
  let query = supabase
    .from("source_cache")
    .select("*")
    .eq("project_id", projectId)
    .order("item_date", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (source) query = query.eq("source", source);
  if (ym) query = query.eq("ym", ym);

  const { data, error } = await query;
  if (error) {
    console.error("fetchSourceCache:", error.message);
    return [];
  }

  return (data || []).map((r) => ({
    cacheId: r.cache_id,
    projectId: r.project_id,
    ym: r.ym || "",
    source: r.source,
    itemId: r.item_id,
    title: r.title,
    itemDate: r.item_date,
    contentText: r.content_text || "",
    charCount: r.char_count || 0,
    metadataJson: r.metadata_json,
    collectedAt: r.collected_at,
  }));
}

// ============================================================
// Project Meeting Summaries (各回 MTG サマリ)
// 仕様: pwa/design/meeting_summaries.md
// ============================================================

export interface ProjectMeetingSummary {
  meetingId: string;
  projectId: string;
  ym: string;
  meetingDate: string;            // "YYYY-MM-DD"
  meetingStartAt: string | null;
  title: string;
  notionUrl: string | null;
  sourceUrl: string | null;       // Slack permalink / Drive Doc / Calendar event URL 等 (migration 052)
  calendarEventId: string | null;
  summaryShort: string;
  decided: string[];
  progress: string[];
  nextActions: string[];
  risks: string[];
  narrativeMd: string | null;     // 初見でも読める Markdown 議事録 / dialogue narrative / 予定MTGブリーフ
  generatedAt: string;
  generatedByModel: string | null;
  sourceKinds: string | null;     // 'notion' | 'gmail' | 'slack' | 'drive' | 'calendar' | 'dialogue' | 'upcoming' | 'upcoming_tentative' | 'none'
  prepStatus?: string | null;     // upcoming row の準備状態。tentative は日程未確定として調整中 block に出す。
  // MTG Prep セッション (= H-1 内 Phase P、migration 150 + 151)
  // 仕様: pwa/spec/3-3-meeting-flow-current-spec.md「H-1 MTG Prep セッション自動立ち上げ」節
  // 2026-06-22 再設計: 既存 H-1 内 Phase P で codex exec subprocess spawn / codex 一本化 / URL列廃止
  prepReadinessScore?: number | null;     // 0-100. 80↑=緑 / 50-79=黄 / <50=赤
  prepReadinessReasons?: Record<string, unknown> | null;
  prepDraftMd?: string | null;            // 着地点 / 背景 / 想定質問 / 持参物 Markdown draft
  prepDriveAssetId?: string | null;       // _prep/ フォルダ配下の資料 draft Drive file ID
  prepNotionPageId?: string | null;       // アジェンダ草案入りの Notion 議事録ページ ID
  prepWorkerSessionId?: string | null;    // codex SESSION_ID。まさが codex desktop で SESSION_ID から該当 session を開く
  prepCalendarEventId?: string | null;    // ＋ prep 枠 (まさカレンダー) の Calendar event ID。ドラッグ追従用
  prepWorkerStatus?: string | null;       // 'preparing' | 'ready' | 'failed'
  prepWorkerSpawnedAt?: string | null;
  prepWorkerReadyAt?: string | null;
  prepConciergeNudgedAt?: string | null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : String(x ?? ""))).filter((s) => s.length > 0);
}

function normalizeMeetingTitleForDedupe(title: string): string {
  return title
    .normalize("NFKC")
    .replace(/\s*@?\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?\s*\d{1,2}:\d{2}(?:\s*\(?[A-Z]{2,5}\)?)?/gi, "")
    .replace(/\s*@?\d{4}年\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2}(?:\s*\(?[A-Z]{2,5}\)?)?/gi, "")
    .replace(/\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:[^\s]+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isWeakManualMeetingDuplicate(item: ProjectMeetingSummary): boolean {
  const model = item.generatedByModel || "";
  return item.meetingId.startsWith("notion:") &&
    !item.narrativeMd?.trim() &&
    (!item.sourceKinds || model.startsWith("manual:codex") || model.startsWith("codex_manual"));
}

function meetingSummaryQualityScore(item: ProjectMeetingSummary): number {
  let score = 0;
  const narrativeLen = item.narrativeMd?.trim().length || 0;
  if (narrativeLen >= 300) score += 100;
  else if (narrativeLen > 0) score += 50;
  if (item.sourceKinds && item.sourceKinds !== "none") score += 20;
  if (item.calendarEventId) score += 10;
  if (!item.meetingId.startsWith("notion:")) score += 5;
  return score;
}

function dedupeWeakMeetingSummaries(items: ProjectMeetingSummary[]): ProjectMeetingSummary[] {
  const out: ProjectMeetingSummary[] = [];
  const indexByKey = new Map<string, number>();
  for (const item of items) {
    const normalizedTitle = normalizeMeetingTitleForDedupe(item.title);
    const key = `${item.projectId}|${item.meetingDate}|${normalizedTitle}`;
    const existingIndex = indexByKey.get(key);
    if (existingIndex == null) {
      indexByKey.set(key, out.length);
      out.push(item);
      continue;
    }

    const existing = out[existingIndex];
    if (isWeakManualMeetingDuplicate(item) || isWeakManualMeetingDuplicate(existing)) {
      const winner = meetingSummaryQualityScore(item) > meetingSummaryQualityScore(existing) ? item : existing;
      out[existingIndex] = winner;
      continue;
    }

    out.push(item);
  }
  return out;
}

/**
 * project_meeting_summaries: PJ × MTG サマリを meeting_date DESC で取得
 * - sinceDate: "YYYY-MM-DD" 以降のみ (省略で全期間)
 */
export async function fetchProjectMeetingSummaries(
  projectId: string,
  opts?: { sinceDate?: string; limit?: number }
): Promise<ProjectMeetingSummary[]> {
  let query = supabase
    .from("project_meeting_summaries")
    .select("*")
    .eq("project_id", projectId)
    .order("meeting_date", { ascending: false });

  if (opts?.sinceDate) query = query.gte("meeting_date", opts.sinceDate);
  if (opts?.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) {
    console.error("fetchProjectMeetingSummaries:", error.message);
    return [];
  }

  const rows = (data || []).map((r) => ({
    meetingId: r.meeting_id,
    projectId: r.project_id,
    ym: r.ym || "",
    meetingDate: r.meeting_date,
    meetingStartAt: r.meeting_start_at,
    title: r.title || "",
    notionUrl: r.notion_url,
    sourceUrl: r.source_url ?? null,
    calendarEventId: r.calendar_event_id,
    summaryShort: r.summary_short || "",
    decided: asStringArray(r.decided),
    progress: asStringArray(r.progress),
    nextActions: asStringArray(r.next_actions),
    risks: asStringArray(r.risks),
    narrativeMd: r.narrative_md ?? null,
    generatedAt: r.generated_at,
    generatedByModel: r.generated_by_model,
    sourceKinds: r.source_kinds ?? null,
    prepStatus: r.prep_status ?? null,
    prepReadinessScore: r.prep_readiness_score ?? null,
    prepReadinessReasons: r.prep_readiness_reasons ?? null,
    prepDraftMd: r.prep_draft_md ?? null,
    prepDriveAssetId: r.prep_drive_asset_id ?? null,
    prepNotionPageId: r.prep_notion_page_id ?? null,
    prepWorkerSessionId: r.prep_worker_session_id ?? null,
    prepCalendarEventId: r.prep_calendar_event_id ?? null,
    prepWorkerStatus: r.prep_worker_status ?? null,
    prepWorkerSpawnedAt: r.prep_worker_spawned_at ?? null,
    prepWorkerReadyAt: r.prep_worker_ready_at ?? null,
    prepConciergeNudgedAt: r.prep_concierge_nudged_at ?? null,
  }));
  return dedupeWeakMeetingSummaries(rows);
}

// ============================================================
// データ取得関数
// ============================================================

function getCurrentYm(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

function nextYmString(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
  return m === 12 ? `${y + 1}01` : `${y}${String(m + 1).padStart(2, "0")}`;
}

function ymRangeInclusive(startYm: string, endYm: string): string[] {
  if (!/^\d{6}$/.test(startYm) || !/^\d{6}$/.test(endYm) || startYm > endYm) return [];
  const out: string[] = [];
  let cursor = startYm;
  for (let guard = 0; guard < 240 && cursor <= endYm; guard += 1) {
    out.push(cursor);
    cursor = nextYmString(cursor);
  }
  return out;
}

function rewardNumber(value: unknown): number {
  return Math.max(0, yenNumber(value));
}

function sumRewardMemberField(summary: RewardSummary | null | undefined, fields: Array<keyof RewardSummaryMember>): number {
  return (summary?.members || []).reduce((sum, member) => {
    const value = fields.map((field) => member[field]).find((candidate) => candidate != null);
    return sum + rewardNumber(value);
  }, 0);
}

function rewardSummaryNumber(
  summary: RewardSummary | null | undefined,
  field: keyof RewardSummary,
  fallbackFields: Array<keyof RewardSummaryMember> = []
): number {
  const value = summary?.[field];
  if (value != null) return rewardNumber(value);
  return sumRewardMemberField(summary, fallbackFields);
}

function rewardMemberStockYen(member: RewardSummaryMember): number {
  return rewardNumber(member.stockYen ?? member.deferredYen);
}

function rewardMemberIsCompanyReserve(member: RewardSummaryMember): boolean {
  return member.payoutExcluded === true || rewardNumber(member.companyReserveYen ?? member.officerReserveYen) > 0;
}

function rewardSummaryExternalUnpaidStock(summary: RewardSummary | null | undefined): number {
  return (summary?.members || []).reduce((sum, member) => {
    if (rewardMemberIsCompanyReserve(member)) return sum;
    return sum + rewardMemberStockYen(member);
  }, 0);
}

function rewardSummaryCompanyReserveWithPending(summary: RewardSummary | null | undefined): number {
  const funded = rewardSummaryNumber(summary, "companyReserveYen", ["companyReserveYen", "officerReserveYen"]);
  const pending = (summary?.members || []).reduce((sum, member) => {
    if (!rewardMemberIsCompanyReserve(member)) return sum;
    return sum + rewardMemberStockYen(member);
  }, 0);
  return funded + pending;
}

function buildCockpitSeasonFinance({
  planCycle,
  projectRow,
  billingRows,
}: {
  planCycle: PlanCycle | null;
  projectRow: Record<string, unknown>;
  billingRows: Array<Record<string, unknown>>;
}): CockpitSeasonFinance | null {
  if (!planCycle) return null;
  const months = ymRangeInclusive(planCycle.periodStartYm, planCycle.periodEndYm);
  if (months.length === 0) return null;

  const projectForContract = {
    fee_type: typeof projectRow.fee_type === "string" ? projectRow.fee_type : null,
    fee_amount: typeof projectRow.fee_amount === "number" || typeof projectRow.fee_amount === "string" ? projectRow.fee_amount : null,
    start_ym: typeof projectRow.start_ym === "string" ? projectRow.start_ym : null,
    end_ym: typeof projectRow.end_ym === "string" ? projectRow.end_ym : null,
    contract_terms_json: projectRow.contract_terms_json,
  };
  const rowByYm = new Map(billingRows.map((row) => [String(row.ym || ""), row]));
  const projectId = planCycle.projectId || String(projectRow.project_id || "");
  const extraRevenueByYm = buildExtraRevenueByYm(
    billingRows.map((row) => ({
      project_id: String(row.project_id || projectId),
      ym: row.ym as string | number | null | undefined,
      extra_revenue_json: Array.isArray(row.extra_revenue_json) ? row.extra_revenue_json : null,
    })),
    { projectId, minYm: planCycle.periodStartYm, maxYm: planCycle.periodEndYm },
  );
  const regularClientAmountByYm = new Map<string, number>();
  for (const ym of months) {
    const row = rowByYm.get(ym);
    regularClientAmountByYm.set(
      ym,
      contractBackedClientAmount({
        ym,
        project: projectForContract,
        reportedAmount: row?.budget_reported_amount as number | string | null | undefined,
        cycleStatus: String(row?.status || ""),
        hasInvoiceEvidence: Boolean(row?.invoice_sent_at || row?.invoice_issued_at || row?.payment_confirmed_at),
      }),
    );
  }
  const seasonBufferByYm = allocateSeasonBufferByYm({
    months,
    totalBufferYen: parseSeasonBufferTotal(planCycle.bufferBreakdownJson),
    regularClientAmountByYm,
  });
  const financeMonths: CockpitSeasonFinanceMonth[] = months.map((ym) => {
    const row = rowByYm.get(ym);
    const summary = (row?.reward_summary_json && typeof row.reward_summary_json === "object"
      ? row.reward_summary_json
      : null) as RewardSummary | null;
    const cycleStatus = String(row?.status || "");
    const regularClientPaymentYen = regularClientAmountByYm.get(ym) ?? 0;
    const clientPaymentYen = regularClientPaymentYen + (extraRevenueByYm.get(ym) ?? 0);
    const bufferYen = seasonBufferByYm.get(ym) ?? rewardNumber(row?.budget_buffer_amount);
    const regularBudgetYen = rewardNumber(row?.budget_yen);
    const extraBudgetYen = row?.extra_budget_yen == null ? 0 : rewardNumber(row.extra_budget_yen);
    const pjBudgetYen = regularBudgetYen + extraBudgetYen;
    const memberPayoutYen = rewardSummaryNumber(summary, "totalPaySum", ["totalPay"]);
    const companyReserveYen = rewardSummaryCompanyReserveWithPending(summary);
    const unpaidStockYen = rewardSummaryExternalUnpaidStock(summary);
    const cashBalanceYen = clientPaymentYen - bufferYen - memberPayoutYen;
    const rewardObligationYen = memberPayoutYen + companyReserveYen + unpaidStockYen;
    const remainingAfterObligationYen = pjBudgetYen - rewardObligationYen;
    return {
      ym,
      clientPaymentYen,
      bufferYen,
      pjBudgetYen,
      memberPayoutYen,
      companyReserveYen,
      unpaidStockYen,
      cashBalanceYen,
      rewardObligationYen,
      remainingAfterObligationYen,
      cycleStatus,
    };
  });

  const totalsBase = financeMonths.reduce(
    (acc, month) => ({
      clientPaymentYen: acc.clientPaymentYen + month.clientPaymentYen,
      bufferYen: acc.bufferYen + month.bufferYen,
      pjBudgetYen: acc.pjBudgetYen + month.pjBudgetYen,
      memberPayoutYen: acc.memberPayoutYen + month.memberPayoutYen,
      companyReserveYen: acc.companyReserveYen + month.companyReserveYen,
      cashBalanceYen: acc.cashBalanceYen + month.cashBalanceYen,
    }),
    { clientPaymentYen: 0, bufferYen: 0, pjBudgetYen: 0, memberPayoutYen: 0, companyReserveYen: 0, cashBalanceYen: 0 }
  );
  const finalMonth = financeMonths[financeMonths.length - 1] ?? null;
  const finalUnpaidStockYen = finalMonth?.unpaidStockYen ?? 0;
  const rewardObligationYen = totalsBase.memberPayoutYen + totalsBase.companyReserveYen + finalUnpaidStockYen;
  const finalRemainingYen = totalsBase.pjBudgetYen - rewardObligationYen;
  const sourceBudgetYen = Math.max(0, Math.round((totalsBase.clientPaymentYen - totalsBase.bufferYen) * 0.65));
  const sourceBudgetOverrunYen = Math.max(0, totalsBase.pjBudgetYen - sourceBudgetYen);
  const status: CockpitSeasonFinance["status"] =
    finalUnpaidStockYen > 0
      ? "shortage"
      : finalRemainingYen < 0
        ? "over_budget"
        : sourceBudgetOverrunYen > 0
          ? "source_overrun"
          : "balanced";

  return {
    planCycleId: planCycle.planCycleId,
    periodStartYm: planCycle.periodStartYm,
    periodEndYm: planCycle.periodEndYm,
    status,
    totals: {
      ...totalsBase,
      unpaidStockYen: finalUnpaidStockYen,
      rewardObligationYen,
      remainingAfterObligationYen: finalRemainingYen,
      finalUnpaidStockYen,
      finalRemainingYen,
      sourceBudgetYen,
      sourceBudgetOverrunYen,
    },
    months: financeMonths,
  };
}

function normalizeDashboardProjectName(projectId: string, displayName: string) {
  if (projectId === "p24" || displayName.includes("チャレナジー")) return "Challenergy";
  return displayName;
}

/**
 * Dashboard: プロジェクト一覧
 */
export async function fetchProjectsFromSupabase(): Promise<DashProject[]> {
  const { data, error } = await supabase
    .from("projects")
	    .select("project_id, project_name, client_name, status, project_category, start_ym, end_ym")
    .order("project_name");

  if (error) throw new Error(`projects: ${error.message}`);

  const projectIds = (data || []).map((r) => r.project_id);
  const { data: ventureRows } = projectIds.length
    ? await supabase
      .from("project_ventures")
      .select("project_id, short_label")
      .in("project_id", projectIds)
    : { data: [] };
  const ventureMap = new Map(
    (ventureRows || []).map((r) => [
      r.project_id,
      { shortLabel: r.short_label || "" },
    ])
  );
  const { data: projectMemberRows } = projectIds.length
    ? await supabase
      .from("project_members")
      .select("project_id, member_id, is_pl, is_pm, is_closer")
      .in("project_id", projectIds)
      .eq("is_active", true)
    : { data: [] };
  const memberIds = Array.from(new Set((projectMemberRows || []).map((r) => r.member_id).filter(Boolean)));
  const { data: memberRows } = memberIds.length
    ? await supabase
      .from("members")
      .select("member_id, code_name")
      .in("member_id", memberIds)
    : { data: [] };
  const memberMap = new Map((memberRows || []).map((r) => [r.member_id, r.code_name || r.member_id]));
  const roleLineMap = new Map<string, string>();
  for (const projectId of projectIds) {
    const rows = (projectMemberRows || []).filter((r) => r.project_id === projectId);
    const names = (predicate: (row: typeof rows[number]) => boolean) =>
      rows
        .filter(predicate)
        .map((r) => memberMap.get(r.member_id) || r.member_id)
        .filter(Boolean)
        .join("/");
    roleLineMap.set(
      projectId,
      `PL ${names((r) => Boolean(r.is_pl)) || "--"} / PM ${names((r) => Boolean(r.is_pm)) || "--"} / Closer ${names((r) => Boolean(r.is_closer)) || "--"}`
    );
  }

  return (data || []).map((r) => ({
    projectId: r.project_id,
    projectName: r.project_name,
    displayName: normalizeDashboardProjectName(r.project_id, r.project_name),
    shortLabel: ventureMap.get(r.project_id)?.shortLabel || r.project_name,
    roleLine: roleLineMap.get(r.project_id) || "PL -- / PM -- / Closer --",
    clientName: r.client_name || "",
    // 2026-05-11 まさ指摘 8 番: 旧コードは r.status || "active" だったため、
    // status='frozen' でも空文字 fallback ロジックの記憶混乱で dashboard で active 表示される
    // 事故あり (まさ「停止中にしても dashboard で active のまま」)。空文字 fallback に変更
    // して、unknown は dashboard 側で「その他」セクションに振り分ける。
	    status: r.status || "",
	    projectCategory: r.project_category || "dtsu",
	    startYm: r.start_ym || "",
    endYm: r.end_ym || "",
  }));
}

/**
 * 左ナビ「ボード」のフライアウト用。
 * Dashboard本体の集計・担当者取得を伴わず、現在アクティブなPJだけを読む。
 */
export async function fetchActiveProjectsForNav(): Promise<ActiveProjectNavItem[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("project_id, project_name")
    .eq("status", "active")
    .order("project_name", { ascending: true });

  if (error) throw new Error(`active projects for nav: ${error.message}`);

  return (data ?? [])
    .filter((project) => project.project_id && project.project_name)
    .map((project) => ({
      projectId: project.project_id,
      projectName: project.project_name,
    }));
}

/**
 * Dashboard: 請求ステータス（指定月のBillingCycle）
 */
export async function fetchBillingStatusFromSupabase(
  ym: string
): Promise<Record<string, DashBillingStatus>> {
  const { data, error } = await supabase
    .from("billing_cycles")
    .select("*")
    .eq("ym", ym);

  if (error) throw new Error(`billing_cycles: ${error.message}`);

  const reportRes = await supabase
    .from("monthly_reports")
    .select("project_id, status, fixed_at, final_content")
    .eq("ym", ym);

  if (reportRes.error) throw new Error(`monthly_reports: ${reportRes.error.message}`);

  const reportDoneProjects = new Set(
    (reportRes.data || [])
      .filter((r) => Boolean(r.fixed_at) || (r.status || "").toLowerCase() === "fixed" || Boolean(r.final_content))
      .map((r) => r.project_id)
  );

  const out: Record<string, DashBillingStatus> = {};
  for (const bc of data || []) {
    out[bc.project_id] = {
      ym: bc.ym,
      status: bc.status || "",
      budgetYen: bc.budget_yen || 0,
      meetingDone: !!bc.meeting_start_at,
      reportDone: !!bc.report_fixed_at || reportDoneProjects.has(bc.project_id),
      budgetDone: false, // billing_cyclesに直接のフラグはない
      allocationDone: false,
      invoiceDone: !!bc.invoice_sent_at,
      paymentDone: !!bc.payment_confirmed_at,
      billingAmount: bc.budget_yen || 0,
      invoiceYm: bc.ym,
    };
  }
  return out;
}

/**
 * Cockpit: 1プロジェクトの全データ
 */
function asMilestoneChangeItems(value: unknown): MilestoneChangeItem[] {
  return Array.isArray(value) ? (value as MilestoneChangeItem[]) : [];
}

function asRewardPreviewStatus(value: unknown): MilestoneChangeHistory["rewardPreviewStatus"] {
  if (value === "safe" || value === "warning" || value === "blocked" || value === "not_checked") return value;
  return "not_checked";
}

export async function fetchCockpitFromSupabase(
  projectId: string
): Promise<CockpitData> {
  const currentYm = getCurrentYm();

  // 並列でクエリ
  const [
    projRes,
    bcRes,
    pcRes,
    pmRes,
    membersRes,
    strategySignalsRes,
    msChangeHistoryRes,
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("project_id", projectId).single(),
    supabase.from("billing_cycles").select("*").eq("project_id", projectId).order("ym", { ascending: false }),
    supabase.from("value_plan_cycles").select("*").eq("project_id", projectId).in("status", ["active", "confirmed", "fixed", "draft"]).order("period_start_ym", { ascending: false }),
    supabase.from("project_members").select("member_id").eq("project_id", projectId).eq("is_active", true),
    supabase.from("members").select("member_id, code_name"),
    supabase
      .from("project_strategy_signals")
      .select("*")
      .eq("project_id", projectId)
      .in("status", ["candidate", "confirmed"])
      .order("signal_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("milestone_change_events")
      .select("*")
      .eq("project_id", projectId)
      .order("changed_at", { ascending: false })
      .limit(12),
  ]);

  if (projRes.error) throw new Error(`project: ${projRes.error.message}`);
  const pj = projRes.data;

  const allYms = (bcRes.data || []).map((bc) => bc.ym).filter(Boolean).sort();
  const firstYm = allYms[allYms.length - 1] || currentYm;
  const lastYm = allYms[0] || currentYm;
  const reimburseRes = await supabase
    .from("reimbursements")
    .select("date, status")
    .eq("project_id", projectId)
    .gte("date", `${firstYm.slice(0, 4)}-${firstYm.slice(4, 6)}-01`)
    .lt("date", `${nextYmString(lastYm).slice(0, 4)}-${nextYmString(lastYm).slice(4, 6)}-01`);
  const reimburseHasPending: Record<string, boolean> = {};
  for (const row of reimburseRes.data || []) {
    const date = row.date || "";
    const ym = date.length >= 7 ? `${date.slice(0, 4)}${date.slice(5, 7)}` : "";
    const status = (row.status || "").toLowerCase();
    if (ym && (status === "submitted" || status === "pmapproved")) {
      reimburseHasPending[ym] = true;
    }
  }

  // BillingCycles
  const billingCycles: BillingCycleDetail[] = (bcRes.data || []).map((bc) => ({
    projectId,
    ym: bc.ym,
    status: bc.status || "",
    budgetYen: bc.budget_yen || 0,
    meetingStartAt: bc.meeting_start_at,
    meetingEventId: bc.meeting_event_id || null,
    reportFixedAt: bc.report_fixed_at,
    budgetConfirmedAt: bc.budget_confirmed_at || null,
    invoiceIssuedAt: bc.invoice_issued_at || null,
    invoiceSentAt: bc.invoice_sent_at,
    payoutNoticeUploadedAt: bc.payout_notice_uploaded_at || null,
    reimburseConfirmDone: !reimburseHasPending[bc.ym],
    paymentConfirmedAt: bc.payment_confirmed_at,
    rewardPaidAt: bc.reward_paid_at || null,
    invoiceYm: bc.invoice_ym || null,
    invoiceBaseLinesJson: bc.invoice_base_lines_json || null,
    invoiceSubject: bc.invoice_subject || null,
    budgetReportedAmount: bc.budget_reported_amount || 0,
    msProgressSummaryJson: bc.ms_progress_summary_json,
    msProgressSummary: bc.ms_progress_summary_json,
    rewardSummaryJson: (bc.reward_summary_json as RewardSummary | null) || null,
  }));

  // PlanCycles — currentYmが含まれる期間を「現在」、それより前を「過去」
  const billingRows = bcRes.data || [];
  const allPlanCycles: PlanCycle[] = (pcRes.data || []).map((pc) => {
    const extraDesignBudgetYen = billingRows
      .filter((bc) => bc.ym >= pc.period_start_ym && bc.ym <= pc.period_end_ym)
      .reduce((sum, bc) => {
        const raw = bc.extra_budget_yen;
        if (raw === null || raw === undefined || raw === "") return sum;
        const value = typeof raw === "number" ? raw : Number(raw);
        return sum + (Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0);
      }, 0);
    return {
      planCycleId: pc.plan_cycle_id,
      projectId,
      status: pc.status,
      budgetYen: pc.budget_yen,
      extraDesignBudgetYen,
      totalPoints: pc.total_points,
      periodStartYm: pc.period_start_ym,
      periodEndYm: pc.period_end_ym,
      bufferBreakdownJson: pc.buffer_breakdown_json ?? null,
    };
  });

  // 現在の期間: currentYmが start〜end に含まれるもの。
  // 該当がない場合は、次に始まるcycleをトップ表示に使う。
  // 例: 5月中に6-9月のMSを先に設定した場合、コックピットで設定済みMSを確認できるようにする。
  const planCycle: PlanCycle | null = allPlanCycles.find(
    (pc) => currentYm >= pc.periodStartYm && currentYm <= pc.periodEndYm
  ) ?? allPlanCycles
    .filter((pc) => currentYm < pc.periodStartYm)
    .sort((a, b) => a.periodStartYm.localeCompare(b.periodStartYm))[0]
    ?? null;

  const pastPlanCycleRaws = allPlanCycles.filter((pc) => pc.planCycleId !== planCycle?.planCycleId);

  // Helper: PlanCycle1件分のMS/Progress/SubItems/Responsibilityを取得
  async function fetchBundleForCycle(pc: PlanCycle): Promise<{
    milestones: Milestone[]; progress: MilestoneProgress[];
    subItems: SubItem[]; responsibilities: MilestoneResponsibility[];
    msActivities: MemberMsActivity[]; memberActivities: MemberActivity[];
  }> {
    const [msRes, progRes] = await Promise.all([
      supabase.from("value_milestones").select("*")
        .eq("plan_cycle_id", pc.planCycleId).eq("is_active", true).order("sort_order"),
      supabase.from("milestone_monthly_progress").select("*"),
    ]);

    const ms: Milestone[] = (msRes.data || []).map((m) => ({
      milestoneId: m.milestone_id, planCycleId: m.plan_cycle_id,
      title: m.title, points: m.points, tag: m.tag || "normal",
      goalLevel: m.goal_level || "", isActive: m.is_active,
      successCriteria: m.success_criteria || "", sortOrder: m.sort_order,
      periodStartYm: m.period_start_ym || null,
      targetYm: m.target_ym || null,
    }));

    const msIds = new Set(ms.map((m) => m.milestoneId));
    const prog: MilestoneProgress[] = (progRes.data || [])
      .filter((p) => msIds.has(p.milestone_key))
      .map((p) => ({
        milestoneKey: p.milestone_key, ym: p.ym,
        progressPct: Number(p.progress_pct), consumedPt: Number(p.consumed_pt),
        source: p.source || "", note: p.note || null, confirmedAt: p.confirmed_at,
      }));

    const msIdArr = Array.from(msIds);
    let subs: SubItem[] = [];
    let resps: MilestoneResponsibility[] = [];
    let msActivities: MemberMsActivity[] = [];
    let memberActivities: MemberActivity[] = [];
    if (msIdArr.length > 0) {
      const [subRes, respRes, activityRes, memberActivityRes] = await Promise.all([
        supabase.from("milestone_sub_items").select("*").in("milestone_id", msIdArr),
        supabase.from("milestone_responsibility").select("*").in("milestone_id", msIdArr),
        supabase.from("member_ms_activities")
          .select("member_id, milestone_id, ym, narrative, learned_addendum, generated_at")
          .in("milestone_id", msIdArr),
        supabase.from("member_activities")
          .select("*")
          .eq("project_id", projectId)
          .in("milestone_id", msIdArr),
      ]);
      subs = (subRes.data || []).map((s) => ({
        subItemId: s.sub_item_id, milestoneId: s.milestone_id,
        title: s.title, weight: Number(s.weight) || 1,
        status: s.status || "open", assignee: s.assignee || "",
      }));
      resps = (respRes.data || []).map((r) => ({
        milestoneId: r.milestone_id, memberId: r.member_id,
        share: Number(r.share) || 0,
        role: r.role || "担当",
        taskDescription: r.task_description || null,
      }));
      msActivities = (activityRes.data || []).map((a) => ({
        memberId: a.member_id,
        milestoneId: a.milestone_id,
        ym: a.ym,
        narrative: a.narrative || null,
        learnedAddendum: a.learned_addendum || null,
        generatedAt: a.generated_at || null,
      }));
      memberActivities = (memberActivityRes.data || []).map((r) => ({
        id: r.id,
        memberId: r.member_id,
        projectId: r.project_id,
        ym: r.ym,
        source: r.source,
        sourceItemId: r.source_item_id,
        milestoneId: r.milestone_id || null,
        title: r.title || null,
        contentPreview: r.content_preview || null,
        itemDate: r.item_date || null,
        rawMetadata: r.raw_metadata || null,
        extractedAt: r.extracted_at,
      }));
    }
    return { milestones: ms, progress: prog, subItems: subs, responsibilities: resps, msActivities, memberActivities };
  }

  // 現在のPlanCycleのデータ取得
  let milestones: Milestone[] = [];
  let progress: MilestoneProgress[] = [];
  let subItems: SubItem[] = [];
  let responsibilities: MilestoneResponsibility[] = [];
  let msActivities: MemberMsActivity[] = [];
  let memberActivities: MemberActivity[] = [];

  if (planCycle) {
    const bundle = await fetchBundleForCycle(planCycle);
    milestones = bundle.milestones;
    progress = bundle.progress;
    subItems = bundle.subItems;
    responsibilities = bundle.responsibilities;
    msActivities = bundle.msActivities;
    memberActivities = bundle.memberActivities;
  }

  // 過去のPlanCycleのデータ取得（並列）
  const pastPlanCycles: PlanCycleBundle[] = await Promise.all(
    pastPlanCycleRaws.map(async (pc) => {
      const bundle = await fetchBundleForCycle(pc);
      return { planCycle: pc, ...bundle };
    })
  );

  // Reports
  const rpRes = await supabase
    .from("monthly_reports")
    .select("*")
    .eq("project_id", projectId);

  const reports: ReportSummary[] = (rpRes.data || []).map((r) => ({
    reportId: r.report_id,
    projectId,
    ym: r.ym,
    status: r.status || "",
    draftExcerpt: r.draft_content || "",
    finalExcerpt: r.final_content || "",
    hasDraft: !!(r.draft_content),
    hasFinal: !!(r.final_content),
    generatedAt: r.generated_at,
    fixedAt: r.fixed_at,
  }));

  const reportFixedAtByYm = new Map(
    reports
      .map((r) => {
        if (r.fixedAt) return [r.ym, r.fixedAt] as const;
        if (r.status.toLowerCase() === "fixed" || r.hasFinal) return [r.ym, r.generatedAt || "fixed"] as const;
        return null;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry))
  );
  for (const bc of billingCycles) {
    if (!bc.reportFixedAt) {
      bc.reportFixedAt = reportFixedAtByYm.get(bc.ym) || null;
    }
  }

  // Members (codeNames)
  const memberMap: Record<string, string> = {};
  for (const m of membersRes.data || []) {
    memberMap[m.member_id] = m.code_name || "PM";
  }
  const memberCodeNames = (pmRes.data || []).map(
    (pm) => memberMap[pm.member_id] || "PM"
  );

  const strategySignals: ProjectStrategySignal[] = (strategySignalsRes.data || []).map((row) => ({
    signalId: row.signal_id,
    projectId: row.project_id,
    ym: row.ym || null,
    signalDate: row.signal_date || null,
    signalType: row.signal_type || "business_progress",
    polarity: row.polarity || null,
    title: row.title || "",
    summary: row.summary || "",
    scoreImpactSummary: row.score_impact_summary || null,
    scoreImpactDelta: row.score_impact_delta_json && typeof row.score_impact_delta_json === "object"
      ? row.score_impact_delta_json as Record<string, unknown>
      : null,
    impactLevel: row.impact_level || "medium",
    decisionState: row.decision_state || "observed",
    status: row.status || "candidate",
    sourceRefs: Array.isArray(row.source_refs_json) ? row.source_refs_json : [],
    sourceHash: row.source_hash || "",
    confidence: Number(row.confidence) || 0,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at || null,
  }));
  if (msChangeHistoryRes.error) {
    console.warn("fetchCockpitFromSupabase milestone_change_events:", msChangeHistoryRes.error.message);
  }
  const msChangeHistory: MilestoneChangeHistory[] = (msChangeHistoryRes.data || []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    planCycleId: row.plan_cycle_id,
    revisionId: row.revision_id,
    changedAt: row.changed_at,
    changedByEmail: row.changed_by_email || null,
    rewardPreviewStatus: asRewardPreviewStatus(row.reward_preview_status),
    changedMilestoneCount: Number(row.changed_milestone_count) || 0,
    addedMilestoneCount: Number(row.added_milestone_count) || 0,
    removedMilestoneCount: Number(row.removed_milestone_count) || 0,
    updatedMilestoneCount: Number(row.updated_milestone_count) || 0,
    protectedCycleCount: Number(row.protected_cycle_count) || 0,
    offsetCount: Number(row.offset_count) || 0,
    positiveOffsetYen: Number(row.positive_offset_yen) || 0,
    negativeOffsetYen: Number(row.negative_offset_yen) || 0,
    changeItems: asMilestoneChangeItems(row.change_items_json),
  }));
  const seasonFinance = buildCockpitSeasonFinance({
    planCycle,
    projectRow: pj as Record<string, unknown>,
    billingRows: (bcRes.data || []) as Array<Record<string, unknown>>,
  });

  // Nudges
  const nudgeRes = await supabase
    .from("tsukuyomi_nudge_queue")
    .select("*")
    .eq("project_id", projectId)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(10);

  const nudges: NudgeItem[] = (nudgeRes.data || [])
    .filter((n) => !isLegacyMonthlyRoutineNudge(String(n.message || "")))
    .map((n) => ({
      message: n.message,
      status: n.status || "ready",
      level: "info", // nudge_queueにlevelカラムがないのでデフォルト
      postedAt: n.posted_at,
    }));

  // Tasks
  const taskRes = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId);

  const tasks: TaskItem[] = (taskRes.data || []).map((t) => ({
    taskId: t.task_id,
    title: t.title,
    status: t.status || "todo",
    assignee: t.assignee || "",
    priority: t.priority || "",
    description: t.description || "",
  }));

  return {
    project: {
      projectId: pj.project_id,
      projectName: pj.project_name,
      clientName: pj.client_name || "",
	      status: pj.status || "",
	      projectCategory: pj.project_category || "dtsu",
      projectType: pj.project_type || "",
      feeType: pj.fee_type || null,
      feeAmount: pj.fee_amount != null ? Number(pj.fee_amount) : null,
      startYm: pj.start_ym || null,
      endYm: pj.end_ym || null,
      paymentDueRule: pj.payment_due_rule || null,
      paymentDueDay: pj.payment_due_day != null ? Number(pj.payment_due_day) : null,
      contractTerms: pj.contract_terms_json && typeof pj.contract_terms_json === "object"
        ? pj.contract_terms_json as ProjectContractTerms
        : null,
      freezeFromYm: pj.freeze_from_ym || null,
      restartExpectedYm: pj.restart_expected_ym || null,
    },
    currentYm,
    billingCycles,
    planCycle,
    milestones,
    progress,
    reports,
    members: memberCodeNames,
    nudges,
    tasks,
    subItems,
    responsibilities,
    memberMap,
    pastPlanCycles,
    msActivities,
    memberActivities,
    strategySignals,
    msChangeHistory,
    seasonFinance,
  };
}
