"use client";

import { useEffect, useState } from "react";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import {
  DashboardScoreOverview,
  type DashboardActionItem,
  type DashboardManagementScoreSnapshot,
  type DashboardNotificationsSummary,
} from "@/components/dashboard/DashboardScoreOverview";
import { MyPageSummaryPanel, type MyPageSummary } from "@/components/dashboard/MyPageSummaryPanel";
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
  const [scoreHistory, setScoreHistory] = useState<Record<string, number[]>>({});
  const [signalMetrics, setSignalMetrics] = useState<Record<string, { m: number; x: number; f: number }>>({});
  const [managementScore, setManagementScore] = useState<DashboardManagementScoreSnapshot | null>(null);
  const [managementHistory, setManagementHistory] = useState<DashboardManagementScoreSnapshot[]>([]);
  const [notifications, setNotifications] = useState<DashboardNotificationsSummary | null>(null);
  const [mypage, setMypage] = useState<MyPageSummary | null>(null);
  const [myProjectIds, setMyProjectIds] = useState<Set<string>>(new Set());
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
      fetchNotificationsSummary(supabase),
      fetchMyPageSummary(supabase),
    ]).then(([projRes, billRes, scoreRes, mgmtRes, notiRes, mypageRes]) => {
      const projectsValue = projRes.status === "fulfilled" ? projRes.value : [];
      const billingValue = billRes.status === "fulfilled" ? billRes.value : {};
      setProjects(projectsValue);
      setBillingStatus(billingValue);

      if (projRes.status === "fulfilled" && billRes.status === "fulfilled") {
        setActionItems(buildMonthlyRoutineActions(projectsValue, billingValue));
      }

      if (scoreRes.status === "fulfilled") {
        setScoreHistory(scoreRes.value.history);
        setSignalMetrics(scoreRes.value.metrics);
      }

      if (mgmtRes.status === "fulfilled") {
        setManagementHistory(mgmtRes.value);
        setManagementScore(mgmtRes.value[mgmtRes.value.length - 1] ?? null);
      }

      if (notiRes.status === "fulfilled") {
        setNotifications(notiRes.value);
      }

      if (mypageRes.status === "fulfilled" && mypageRes.value) {
        setMypage(mypageRes.value);
        setMyProjectIds(new Set(mypageRes.value.myProjects.map((p) => p.projectId)));
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
    <div className="p-4 max-w-[1600px] mx-auto">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        <main className="space-y-4 min-w-0">
          <DashboardScoreOverview
            notifications={notifications}
            managementScore={managementScore}
            managementHistory={managementHistory}
            actionItems={actionItems}
          />
          <DashboardGrid
            projects={projects}
            billingStatus={billingStatus}
            scoreHistory={scoreHistory}
            signalMetrics={signalMetrics}
            myProjectIds={myProjectIds}
          />
        </main>
        <div className="hidden xl:block">
          <MyPageSummaryPanel summary={mypage} />
        </div>
      </div>
    </div>
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

async function fetchNotificationsSummary(supabase: ReturnType<typeof createClient>): Promise<DashboardNotificationsSummary> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email?.toLowerCase() || "";
    if (!email) return { canView: false, unread: 0, recentTitles: [] };
    const { data: member } = await supabase.from("members").select("is_admin").eq("email", email).maybeSingle();
    if (!member?.is_admin) return { canView: false, unread: 0, recentTitles: [] };
    const [l2Res, mtgRes, recentL2Res] = await Promise.all([
      supabase.from("l2_notifications").select("notification_id", { count: "exact", head: true }).is("read_at", null),
      supabase.from("meeting_notifications").select("meeting_id", { count: "exact", head: true }).is("read_at", null),
      supabase.from("l2_notifications").select("title").order("created_at", { ascending: false }).limit(3),
    ]);
    return {
      canView: true,
      unread: (l2Res.count ?? 0) + (mtgRes.count ?? 0),
      recentTitles: ((recentL2Res.data ?? []) as { title: string }[]).map((r) => r.title),
    };
  } catch {
    return { canView: false, unread: 0, recentTitles: [] };
  }
}

async function fetchMyPageSummary(supabase: ReturnType<typeof createClient>): Promise<MyPageSummary | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email?.toLowerCase() || "";
    if (!email) return null;
    const { data: member } = await supabase
      .from("members")
      .select("member_id, code_name")
      .eq("email", email)
      .maybeSingle();
    if (!member?.member_id) return null;

    // 自分が参画してる active な PJ
    const { data: pmRows } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("member_id", member.member_id)
      .eq("is_active", true);
    const myProjectIds = (pmRows ?? []).map((r) => String(r.project_id));
    let myProjects: Array<{ projectId: string; projectName: string; status: string }> = [];
    if (myProjectIds.length > 0) {
      const { data: projRows } = await supabase
        .from("projects")
        .select("project_id, project_name, status")
        .in("project_id", myProjectIds);
      myProjects = (projRows ?? []).map((p) => ({
        projectId: String(p.project_id),
        projectName: String(p.project_name),
        status: String(p.status),
      }));
    }

    // 公式役割分担数
    const { count: respCount } = await supabase
      .from("milestone_responsibility")
      .select("id", { count: "exact", head: true })
      .eq("member_id", member.member_id)
      .gt("share", 0);

    // 直近 7 日活動
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: actRows } = await supabase
      .from("member_activities")
      .select("project_id, title, item_date, extracted_at")
      .eq("member_id", member.member_id)
      .gte("extracted_at", since7)
      .order("extracted_at", { ascending: false })
      .limit(8);
    const recentActivities = (actRows ?? []).map((r) => ({
      projectId: String(r.project_id ?? ""),
      title: String(r.title ?? ""),
      itemDate: (r.item_date as string | null) ?? null,
    }));

    // 自分宛通知 (= 当面 admin 通知 unread 数を流用、後で個別通知化したいなら別途設計)
    const { count: unreadCount } = await supabase
      .from("l2_notifications")
      .select("notification_id", { count: "exact", head: true })
      .is("read_at", null);

    return {
      codeName: String(member.code_name || "?"),
      memberId: String(member.member_id),
      myProjects,
      responsibilityCount: respCount ?? 0,
      recentActivities,
      unreadNotifications: unreadCount ?? 0,
    };
  } catch {
    return null;
  }
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
