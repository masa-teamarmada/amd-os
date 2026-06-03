/**
 * GET /api/hud/dashboard
 *
 * `/hud/dashboard` (HudControlCenterDashboard) と同じ集計を server 側で行い JSON で返す。
 * iOS アプリの HUD コックピットがこの endpoint を叩いて、PWA と同一の数値を表示する。
 *
 * - projects / billingStatus / scoreHistory / signalMetrics: 既存 lib の anon read + 純粋計算関数を再利用
 * - managementScore / managementHistory: amd_management_score_snapshots を service_role で read
 * - 認証: Supabase JWT (Authorization: Bearer <access_token>) を検証。CRON_SECRET も許可。
 *
 * 注: AAA (架空デモ PJ) は含めない（実機デモで実 PJ のみ見せるため）。
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchActiveAlpha, fetchAllAmdScoreInputs, type AmdScoreInputRow } from "@/lib/amd-score-data";
import {
  computeAmdScoreSeries,
  latestVisibleScorableScoreInput,
  scoreInputToSignalMetrics,
  type AmdSignalMetrics,
} from "@/lib/amd-score-derived";
import {
  fetchBillingStatusFromSupabase,
  fetchProjectsFromSupabase,
  type DashBillingStatus,
  type DashProject,
} from "@/lib/supabase-data";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ManagementSnapshot = {
  ym: string | null;
  total_score: number | null;
  initiative_score: number | null;
  finance_score: number | null;
  retention_score: number | null;
  pipeline_score: number | null;
  direction_score: number | null;
  confidence: number | null;
};

type ActionItem = {
  title: string;
  meta: string;
  periodLabel: string;
  projectInitials: string;
  tone: "cyan" | "amber" | "red";
};

function getCurrentYm(): string {
  const now = new Date();
  return String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, "0");
}

export async function GET(req: NextRequest) {
  // --- auth: Bearer JWT (any logged-in member) or CRON_SECRET ---
  const auth = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  const admin = createAdminClient();
  let authed = Boolean(cronSecret) && auth === `Bearer ${cronSecret}`;
  if (!authed && auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    if (token) {
      const { data } = await admin.auth.getUser(token);
      authed = Boolean(data.user);
    }
  }
  if (!authed) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const ym = getCurrentYm();
    const [projects, billingStatus, scoreBundle, managementHistory] = await Promise.all([
      fetchProjectsFromSupabase(),
      fetchBillingStatusFromSupabase(ym),
      buildScoreData(),
      fetchManagementHistory(admin),
    ]);
    const actionItems = buildMonthlyRoutineActions(projects, billingStatus);

    return NextResponse.json({
      ok: true,
      ym,
      projects,
      billingStatus,
      scoreHistory: scoreBundle.history,
      signalMetrics: scoreBundle.metrics,
      managementScore: managementHistory[managementHistory.length - 1] ?? null,
      managementHistory,
      actionItems,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

// ---- score history + M/X/F signal metrics (実 PJ のみ) ----
async function buildScoreData(): Promise<{
  history: Record<string, number[]>;
  metrics: Record<string, AmdSignalMetrics>;
}> {
  const [inputs, activeAlpha] = await Promise.all([fetchAllAmdScoreInputs(), fetchActiveAlpha()]);
  const grouped: Record<string, AmdScoreInputRow[]> = {};
  for (const row of inputs) {
    (grouped[row.project_id] ||= []).push(row);
  }
  const today = new Date().toISOString().slice(0, 10);
  const visible = (rows: AmdScoreInputRow[]) => rows.filter((r) => r.evaluated_at.slice(0, 10) <= today);

  const history = Object.fromEntries(
    Object.entries(grouped).map(([projectId, rows]) => [
      projectId,
      computeAmdScoreSeries(visible(rows), activeAlpha.alpha).map((p) => p.score),
    ])
  );
  const metrics = Object.fromEntries(
    Object.entries(grouped).flatMap(([projectId, rows]) => {
      const latest = latestVisibleScorableScoreInput(rows);
      if (!latest) return [];
      const metric = scoreInputToSignalMetrics(latest, activeAlpha.alpha);
      return metric ? [[projectId, metric]] : [];
    })
  );
  return { history, metrics };
}

// ---- AMD Management Score snapshots ----
async function fetchManagementHistory(
  admin: ReturnType<typeof createAdminClient>
): Promise<ManagementSnapshot[]> {
  const { data, error } = await admin
    .from("amd_management_score_snapshots")
    .select("ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score,confidence,updated_at")
    .order("ym", { ascending: true })
    .order("updated_at", { ascending: true });
  if (error || !data) return [];
  const latestByYm = new Map<string, ManagementSnapshot>();
  for (const row of data) {
    latestByYm.set(String(row.ym ?? ""), normalizeManagement(row));
  }
  return Array.from(latestByYm.values()).filter((r) => r.ym);
}

function normalizeManagement(row: Record<string, unknown>): ManagementSnapshot {
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    ym: (row.ym as string) ?? null,
    total_score: num(row.total_score),
    initiative_score: num(row.initiative_score),
    finance_score: num(row.finance_score),
    retention_score: num(row.retention_score),
    pipeline_score: num(row.pipeline_score),
    direction_score: num(row.direction_score),
    confidence: num(row.confidence),
  };
}

// ---- Next Action Queue (page.tsx buildMonthlyRoutineActions と同一) ----
function buildMonthlyRoutineActions(
  projects: DashProject[],
  billingStatus: Record<string, DashBillingStatus>
): ActionItem[] {
  const byProject = new Map(projects.map((p) => [p.projectId, p]));
  const items: ActionItem[] = [];
  for (const [projectId, cycle] of Object.entries(billingStatus)) {
    const project = byProject.get(projectId);
    const base = {
      meta: `${projectId} / PENDING`,
      periodLabel: monthLabel(cycle.ym),
      projectInitials: project
        ? projectInitials(project.shortLabel || project.projectName, project.projectId)
        : initialsFromProjectId(projectId),
    };
    if (!cycle.budgetDone) items.push({ ...base, title: "請求額確定", tone: "amber" });
    if (!cycle.meetingDone) items.push({ ...base, title: "報告会日程調整", tone: "cyan" });
    if (!cycle.reportDone) items.push({ ...base, title: "月次報告書FIX", tone: "amber" });
    if (!cycle.invoiceDone) items.push({ ...base, title: "請求書送付", tone: "amber" });
    if (!cycle.paymentDone && cycle.invoiceDone) items.push({ ...base, title: "入金確認", tone: "red" });
  }
  return items.slice(0, 5);
}

function monthLabel(ym?: string | null): string {
  if (!ym || ym.length < 6) {
    const now = new Date();
    return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${ym.slice(0, 4)}.${ym.slice(4, 6)}`;
}

function initialsFromProjectId(projectId?: string | null): string {
  if (!projectId) return "AM";
  return projectId.replace(/^p/i, "P").slice(0, 3).toUpperCase();
}

function projectInitials(projectName: string, projectId: string): string {
  const ascii = projectName.match(/[A-Za-z0-9]+/g)?.join(" ") ?? "";
  if (ascii.trim() && !ascii.includes(" ") && ascii.trim().length <= 5) return ascii.trim().toUpperCase();
  if (ascii.trim()) return ascii.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return initialsFromProjectId(projectId);
}
