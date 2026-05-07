/**
 * Supabase Data Access Layer
 * GAS API (gas-api.ts) の代替。Supabaseから直接データを取得する。
 * RLSはservice_role経由（GAS書き込み）なので、PWAからはanon keyでread-only。
 * DEV_MODEではanon keyでRLSバイパス不要のためpublicアクセス。
 */

import { createClient } from "@supabase/supabase-js";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// PWAからの読み取り用クライアント（anon key）
// ビルド時（SSG）にはURL空でcreateClientが失敗するのでダミー値で初期化
const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder"
);

/** 認証付きブラウザクライアント（RLS書き込み用） */
function getAuthClient() {
  return createBrowserSupabase();
}

// ============================================================
// 型定義（GAS API互換）
// ============================================================

export interface DashProject {
  projectId: string;
  projectName: string;
  clientName: string;
  status: string;
  startYm?: string;
  endYm?: string;
}

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
    projectType?: string;
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
}

export interface RewardSummaryBreakdown {
  msKey: string;
  title: string;
  share: number; // 0.0–1.0
  earnedPt: number;
  msConsumedPt: number;
}

export interface RewardSummaryMember {
  memberId: string;
  memberName?: string; // 実名（codeName-onlyルールに反するためUIでは memberMap で変換）
  earnedPt: number;
  basePay: number;
  bonusPt: number;
  totalPay: number;
  cappedFrom?: number; // capped時のみ：本来の合計
  breakdown: RewardSummaryBreakdown[];
}

export interface RewardSummary {
  capped?: boolean;
  ptUnit?: number; // 1pt単価（円）
  members: RewardSummaryMember[];
  carryOverYen?: number;
  totalPaySum?: number;
  monthlyBudget65?: number;
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
  totalPoints: number;
  periodStartYm: string;
  periodEndYm: string;
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
  title: string;
  points: number;
  tag: "normal" | "routine" | "buffer";
  goalLevel: string;
  successCriteria: string;
  sortOrder: number;
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

  // FK制約のため、子テーブル（responsibility / sub_items）を先に削除
  const { data: existingMs } = await authClient
    .from("value_milestones")
    .select("milestone_id")
    .eq("plan_cycle_id", planCycleId);
  const existingIds = (existingMs || []).map((m) => m.milestone_id);
  if (existingIds.length > 0) {
    await authClient.from("milestone_responsibility").delete().in("milestone_id", existingIds);
    await authClient.from("milestone_sub_items").delete().in("milestone_id", existingIds);
  }

  // 既存のマイルストーンを削除してから再挿入
  await authClient
    .from("value_milestones")
    .delete()
    .eq("plan_cycle_id", planCycleId);

  if (milestones.length === 0) return true;

  const rows = milestones.map((ms, idx) => ({
    milestone_id: `MS-${planCycleId}-${idx + 1}`,
    plan_cycle_id: planCycleId,
    title: ms.title,
    points: ms.points,
    tag: ms.tag,
    goal_level: ms.goalLevel || null,
    is_active: true,
    success_criteria: ms.successCriteria || null,
    sort_order: ms.sortOrder,
  }));

  const { error } = await authClient
    .from("value_milestones")
    .insert(rows);

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

  if (rows.length === 0) return true;

  const { error } = await authClient
    .from("milestone_responsibility")
    .insert(rows);

  if (error) {
    console.error("upsertMilestoneResponsibilities:", error.message);
    return false;
  }
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

/**
 * Dashboard: プロジェクト一覧
 */
export async function fetchProjectsFromSupabase(): Promise<DashProject[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("project_id, project_name, client_name, status, start_ym, end_ym")
    .order("project_name");

  if (error) throw new Error(`projects: ${error.message}`);

  return (data || []).map((r) => ({
    projectId: r.project_id,
    projectName: r.project_name,
    clientName: r.client_name || "",
    status: r.status || "active",
    startYm: r.start_ym || "",
    endYm: r.end_ym || "",
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

  const out: Record<string, DashBillingStatus> = {};
  for (const bc of data || []) {
    out[bc.project_id] = {
      ym: bc.ym,
      status: bc.status || "",
      budgetYen: bc.budget_yen || 0,
      meetingDone: !!bc.meeting_start_at,
      reportDone: !!bc.report_fixed_at,
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
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("project_id", projectId).single(),
    supabase.from("billing_cycles").select("*").eq("project_id", projectId).order("ym", { ascending: false }),
    supabase.from("value_plan_cycles").select("*").eq("project_id", projectId).in("status", ["active", "confirmed", "fixed", "draft"]).order("period_start_ym", { ascending: false }),
    supabase.from("project_members").select("member_id").eq("project_id", projectId).eq("is_active", true),
    supabase.from("members").select("member_id, code_name"),
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
    budgetReportedAmount: bc.budget_yen || 0,
    msProgressSummaryJson: bc.ms_progress_summary_json,
    msProgressSummary: bc.ms_progress_summary_json,
    rewardSummaryJson: (bc.reward_summary_json as RewardSummary | null) || null,
  }));

  // PlanCycles — currentYmが含まれる期間を「現在」、それより前を「過去」
  const allPlanCycles: PlanCycle[] = (pcRes.data || []).map((pc) => ({
    planCycleId: pc.plan_cycle_id,
    projectId,
    status: pc.status,
    budgetYen: pc.budget_yen,
    totalPoints: pc.total_points,
    periodStartYm: pc.period_start_ym,
    periodEndYm: pc.period_end_ym,
  }));

  // 現在の期間: currentYmが start〜end に含まれるもの。該当なければnull（過去扱い）
  let planCycle: PlanCycle | null = allPlanCycles.find(
    (pc) => currentYm >= pc.periodStartYm && currentYm <= pc.periodEndYm
  ) ?? null;

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

  // Members (codeNames)
  const memberMap: Record<string, string> = {};
  for (const m of membersRes.data || []) {
    memberMap[m.member_id] = m.code_name || "PM";
  }
  const memberCodeNames = (pmRes.data || []).map(
    (pm) => memberMap[pm.member_id] || "PM"
  );

  // Nudges
  const nudgeRes = await supabase
    .from("tsukuyomi_nudge_queue")
    .select("*")
    .eq("project_id", projectId)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(10);

  const nudges: NudgeItem[] = (nudgeRes.data || []).map((n) => ({
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
      projectType: pj.project_type || "",
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
  };
}
