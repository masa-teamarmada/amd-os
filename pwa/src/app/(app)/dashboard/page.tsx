"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import {
  DashboardScoreOverview,
  type DashboardActionItem,
  type DashboardManagementScoreSnapshot,
  type DashboardProjectSignal,
} from "@/components/dashboard/DashboardScoreOverview";
import { createClient } from "@/lib/supabase/client";
import {
  fetchProjectsFromSupabase,
  fetchBillingStatusFromSupabase,
  type DashProject,
  type DashBillingStatus,
} from "@/lib/supabase-data";
import {
  fetchAllAmdScoreInputs,
  fetchActiveAlpha,
} from "@/lib/amd-score-data";
import {
  buildAaaScoreInputsFromSx,
  computeAmdScoreSeries,
  scoreInputToSignalMetrics,
  latestVisibleScorableScoreInput,
} from "@/lib/amd-score-derived";
import { AAA_PROJECT_ID } from "@/lib/demo-aaa-data";

function getCurrentYm() {
  const now = new Date();
  return String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, "0");
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<DashProject[]>([]);
  const [billingStatus, setBillingStatus] = useState<Record<string, DashBillingStatus>>({});
  const [actionItems, setActionItems] = useState<DashboardActionItem[]>([]);
  const [projectSignals, setProjectSignals] = useState<DashboardProjectSignal[]>([]);
  const [managementScore, setManagementScore] = useState<DashboardManagementScoreSnapshot | null>(null);
  const [managementHistory, setManagementHistory] = useState<DashboardManagementScoreSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.allSettled([
      fetchProjectsFromSupabase(),
      fetchBillingStatusFromSupabase(getCurrentYm()),
      Promise.all([fetchAllAmdScoreInputs(), fetchActiveAlpha()]).then(([inputs, activeAlpha]) => {
        const grouped: Record<string, typeof inputs> = {};
        for (const row of inputs) {
          (grouped[row.project_id] ||= []).push(row);
        }
        if (grouped.p21?.length) {
          grouped[AAA_PROJECT_ID] = buildAaaScoreInputsFromSx(grouped.p21, activeAlpha.alpha);
        }
        const history: Record<string, number[]> = {};
        const metrics: Record<string, { m: number; x: number; f: number }> = {};
        for (const [projectId, rows] of Object.entries(grouped)) {
          history[projectId] = computeAmdScoreSeries(visibleScoreInputs(rows), activeAlpha.alpha).map((p) => p.score);
          const latest = latestVisibleScorableScoreInput(rows);
          if (latest) {
            const m = scoreInputToSignalMetrics(latest, activeAlpha.alpha);
            if (m) metrics[projectId] = m;
          }
        }
        return { history, metrics };
      }),
      fetchManagementScoreHistory(supabase),
    ]).then(([projRes, billRes, scoreRes, mgmtRes]) => {
      const projects = projRes.status === "fulfilled" ? projRes.value : [];
      const billing = billRes.status === "fulfilled" ? billRes.value : {};
      setProjects(projects);
      setBillingStatus(billing);

      if (projRes.status === "fulfilled" && billRes.status === "fulfilled") {
        setActionItems(buildMonthlyRoutineActions(projects, billing));
      }

      if (scoreRes.status === "fulfilled") {
        const signals: DashboardProjectSignal[] = projects
          .filter((p) => p.status === "active")
          .map((p) => {
            const hist = scoreRes.value.history[p.projectId] || [];
            const m = scoreRes.value.metrics[p.projectId];
            return {
              projectId: p.projectId,
              projectName: p.projectName,
              shortLabel: p.shortLabel ?? null,
              scoreHistory: hist,
              m: m?.m ?? null,
              x: m?.x ?? null,
              f: m?.f ?? null,
            };
          });
        setProjectSignals(signals);
      }

      if (mgmtRes.status === "fulfilled") {
        setManagementHistory(mgmtRes.value);
        setManagementScore(mgmtRes.value[mgmtRes.value.length - 1] ?? null);
      }

      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-2.75rem)]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <NotificationsBanner />
      <DashboardScoreOverview
        managementScore={managementScore}
        managementHistory={managementHistory}
        actionItems={actionItems}
        projectSignals={projectSignals}
      />
      <DashboardGrid projects={projects} billingStatus={billingStatus} />
    </div>
  );
}

// 通知センターへの導線バナー (= ダッシュボード先頭に常設)
function NotificationsBanner() {
  const [canView, setCanView] = useState<boolean | null>(null);
  const [unread, setUnread] = useState<number | null>(null);
  const [recentTitles, setRecentTitles] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const email = user?.email?.toLowerCase() || "";
        if (!email) {
          setCanView(false);
          return;
        }
        const { data: member } = await supabase
          .from("members")
          .select("is_admin")
          .eq("email", email)
          .maybeSingle();
        if (!member?.is_admin) {
          setCanView(false);
          return;
        }
        setCanView(true);
        const [l2Res, mtgRes, recentL2Res] = await Promise.all([
          supabase
            .from("l2_notifications")
            .select("notification_id", { count: "exact", head: true })
            .is("read_at", null),
          supabase
            .from("meeting_notifications")
            .select("meeting_id", { count: "exact", head: true })
            .is("read_at", null),
          supabase
            .from("l2_notifications")
            .select("title")
            .order("created_at", { ascending: false })
            .limit(3),
        ]);
        setUnread((l2Res.count ?? 0) + (mtgRes.count ?? 0));
        setRecentTitles(((recentL2Res.data ?? []) as { title: string }[]).map((r) => r.title));
      } catch {
        setCanView(false);
        setUnread(0);
      }
    };
    load();
  }, []);

  if (!canView) return null;

  return (
    <Link
      href="/notifications"
      className="block border rounded-lg p-3 hover:bg-muted/50 transition-colors bg-card"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">📬</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">
            通知センター
            {unread !== null && unread > 0 && (
              <span className="ml-2 inline-flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5">
                {unread > 99 ? "99+" : `${unread} 未読`}
              </span>
            )}
            {unread === 0 && <span className="ml-2 text-xs text-muted-foreground">(未読なし)</span>}
          </div>
          {recentTitles.length > 0 && (
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              直近: {recentTitles.slice(0, 2).join(" / ")}
              {recentTitles.length > 2 && " ..."}
            </div>
          )}
        </div>
        <span className="text-muted-foreground text-sm">→</span>
      </div>
    </Link>
  );
}

async function fetchManagementScoreHistory(supabase: ReturnType<typeof createClient>): Promise<DashboardManagementScoreSnapshot[]> {
  const { data, error } = await supabase
    .from("amd_management_score_snapshots")
    .select("ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score,confidence")
    .order("ym", { ascending: true })
    .order("updated_at", { ascending: true });
  if (error || !data) return [];
  const latestByYm = new Map<string, DashboardManagementScoreSnapshot>();
  for (const row of data) {
    latestByYm.set(row.ym ?? "", {
      ym: row.ym ?? null,
      total_score: row.total_score == null ? null : Number(row.total_score),
      initiative_score: row.initiative_score == null ? null : Number(row.initiative_score),
      finance_score: row.finance_score == null ? null : Number(row.finance_score),
      retention_score: row.retention_score == null ? null : Number(row.retention_score),
      pipeline_score: row.pipeline_score == null ? null : Number(row.pipeline_score),
      direction_score: row.direction_score == null ? null : Number(row.direction_score),
      confidence: row.confidence == null ? null : Number(row.confidence),
    });
  }
  return Array.from(latestByYm.values()).filter((row) => row.ym);
}

function visibleScoreInputs(rows: Awaited<ReturnType<typeof fetchAllAmdScoreInputs>>) {
  const today = new Date().toISOString().slice(0, 10);
  return rows.filter((row) => row.evaluated_at.slice(0, 10) <= today);
}

function buildMonthlyRoutineActions(projects: DashProject[], billingStatus: Record<string, DashBillingStatus>): DashboardActionItem[] {
  const byProject = new Map(projects.map((p) => [p.projectId, p]));
  const items: DashboardActionItem[] = [];
  for (const [projectId, cycle] of Object.entries(billingStatus)) {
    const project = byProject.get(projectId);
    const base = {
      meta: `${projectId} / PENDING`,
      periodLabel: monthLabel(cycle.ym),
      projectInitials: project ? projectInitials(project.shortLabel || project.projectName, project.projectId) : initialsFromProjectId(projectId),
      projectId,
    };
    if (!cycle.budgetDone) items.push({ ...base, title: "請求額確定", tone: "amber" });
    if (!cycle.meetingDone) items.push({ ...base, title: "報告会日程調整", tone: "cyan" });
    if (!cycle.reportDone) items.push({ ...base, title: "月次報告書FIX", tone: "amber" });
    if (!cycle.invoiceDone) items.push({ ...base, title: "請求書送付", tone: "amber" });
    if (!cycle.paymentDone && cycle.invoiceDone) items.push({ ...base, title: "入金確認", tone: "red" });
  }
  return items.slice(0, 5);
}

function monthLabel(ym?: string | null) {
  if (!ym || ym.length < 6) return currentMonthLabel();
  return `${ym.slice(0, 4)}.${ym.slice(4, 6)}`;
}

function currentMonthLabel() {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function initialsFromProjectId(projectId?: string | null) {
  if (!projectId) return "AM";
  return projectId.replace(/^p/i, "P").slice(0, 3).toUpperCase();
}

function projectInitials(projectName: string, projectId: string) {
  const ascii = projectName.match(/[A-Za-z0-9]+/g)?.join(" ") ?? "";
  if (ascii.trim() && !ascii.includes(" ") && ascii.trim().length <= 5) return ascii.trim().toUpperCase();
  if (ascii.trim()) return ascii.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return initialsFromProjectId(projectId);
}
