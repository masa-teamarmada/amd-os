/**
 * GAS PWA API クライアント
 * GAS doGet の mode=pwaApi エンドポイントからデータを取得する
 */

const GAS_BASE_URL = process.env.NEXT_PUBLIC_GAS_WEBAPP_URL || "";
const GAS_API_KEY = process.env.NEXT_PUBLIC_GAS_API_KEY || "";

interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function gasApiFetch<T>(
  action: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(GAS_BASE_URL);
  url.searchParams.set("mode", "pwaApi");
  url.searchParams.set("key", GAS_API_KEY);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`GAS API error: ${res.status} ${res.statusText}`);
  }

  const json: ApiResponse<T> = await res.json();
  if (!json.ok) {
    throw new Error(json.error || "Unknown GAS API error");
  }

  return json.data as T;
}

// ============================================================
// 型定義（GAS APIの戻り値）
// ============================================================

export interface GasProject {
  projectId: string;
  projectName: string;
  clientName: string;
  status: string;
  healthStatus?: string;
  healthNote?: string;
  shortGoal?: string;
  freeePartnerId?: string;
}

export interface GasBillingStatus {
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

export interface GasMonthlySummary {
  ym: string;
  meetingDone: boolean;
  budgetDone: boolean;
  allocDone: boolean;
  reportDone: boolean;
  invoiceDone: boolean;
  paymentDone: boolean;
  billingAmount: number;
  invoiceYm: string;
  reportExcerpt: string;
  reportNeedsReview: boolean;
  msProgressSummary: {
    periodStartYm?: string;
    periodEndYm?: string;
    items: Array<{
      title: string;
      points: number;
      progressPct: number;
      tag: string;
      maxPt: number;
    }>;
  } | null;
}

export interface GasBillingCycleDetail {
  projectId: string;
  ym: string;
  status: string;
  budgetYen: number;
  meetingStartAt: string | null;
  reportFixedAt: string | null;
  invoiceSentAt: string | null;
  paymentConfirmedAt: string | null;
  budgetReportedAmount: number;
  msProgressSummaryJson?: string | null;
}

export interface GasMilestone {
  milestoneId: string;
  title: string;
  points: number;
  tag: string;
  goalLevel: string;
  successCriteria: string;
  sortOrder: number;
}

export interface GasPlanCycle {
  planCycleId: string;
  status: string;
  budgetYen: number;
  totalPoints: number;
  periodStartYm: string;
  periodEndYm: string;
}

export interface GasProgress {
  milestoneKey: string;
  ym: string;
  progressPct: number;
  consumedPt: number;
}

export interface GasReport {
  reportId: string;
  ym: string;
  status: string;
  draftContent: string;
  finalContent: string;
  generatedAt: string | null;
  fixedAt: string | null;
}

export interface GasCockpitData {
  project: { projectId: string; projectName: string; clientName: string; status: string };
  currentYm: string;
  billingCycles: GasBillingCycleDetail[];
  planCycle: GasPlanCycle | null;
  milestones: GasMilestone[];
  progress: GasProgress[];
  reports: GasReport[];
  members: string[];
}

export interface GasGoalHierarchy {
  ok: boolean;
  planCycle: {
    planCycleId: string;
    projectId: string;
    status: string;
    budgetYen: number;
    totalPoints: number;
    periodStartYm: string;
    periodEndYm: string;
  };
  milestones: {
    annual: Array<{
      milestoneId: string;
      title: string;
      points: number;
      tag: string;
      isActive: boolean;
      responsibilities: Array<{ codeName: string; share: number }>;
      subItems: Array<{
        subItemId: string;
        title: string;
        weight: number;
        status: string;
        targetYm: string;
      }>;
      successCriteria?: string[];
    }>;
  };
  pjMembers: Array<{ memberId: string; memberName: string }>;
}

// ============================================================
// API 呼び出し関数
// ============================================================

export async function fetchProjects() {
  return gasApiFetch<{
    ok: boolean;
    projects: GasProject[];
    isAdmin: boolean;
  }>("listProjects");
}

export async function fetchBillingStatus(ym: string) {
  return gasApiFetch<Record<string, GasBillingStatus>>("getBillingStatus", {
    ym,
  });
}

export async function fetchCockpitData(projectId: string) {
  return gasApiFetch<GasCockpitData>("cockpitData", { projectId });
}

export async function fetchGoalHierarchy(projectId: string) {
  return gasApiFetch<GasGoalHierarchy>("goalHierarchy", { projectId });
}

export async function fetchMonthDetail(projectId: string, ym: string) {
  return gasApiFetch<Record<string, unknown>>("monthDetail", {
    projectId,
    ym,
  });
}

export async function fetchRewardDashboard(projectId: string, ym: string) {
  return gasApiFetch<Record<string, unknown>>("rewardDashboard", {
    projectId,
    ym,
  });
}

export async function fetchTasks(projectId: string) {
  return gasApiFetch<{
    items: Array<{
      taskId: string;
      title: string;
      status: string;
      milestoneId?: string;
      description?: string;
      assignee?: string;
    }>;
  }>("tasks", { projectId });
}
