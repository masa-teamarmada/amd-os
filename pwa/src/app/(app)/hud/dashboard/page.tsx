"use client";

import { useEffect, useState } from "react";
import { HudControlCenterDashboard, type HudActionItem, type HudManagementScoreSnapshot } from "@/components/hud/HudControlCenterDashboard";
import { fetchActiveAlpha, fetchAllAmdScoreInputs } from "@/lib/amd-score-data";
import {
  buildAaaScoreInputsFromSx,
  computeAmdScoreSeries,
  scoreInputToSignalMetrics,
  latestVisibleScorableScoreInput,
} from "@/lib/amd-score-derived";
import { AAA_PROJECT_ID } from "@/lib/demo-aaa-data";
import { createClient } from "@/lib/supabase/client";
import {
  fetchBillingStatusFromSupabase,
  fetchProjectsFromSupabase,
  type DashBillingStatus,
  type DashProject,
} from "@/lib/supabase-data";

type HudUser = {
  codeName: string;
  memberId: string | null;
  email: string | null;
};

function getCurrentYm() {
  const now = new Date();
  return String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, "0");
}

export default function HudDashboardPage() {
  const [projects, setProjects] = useState<DashProject[]>([]);
  const [billingStatus, setBillingStatus] = useState<Record<string, DashBillingStatus>>({});
  const [hudUser, setHudUser] = useState<HudUser>({ codeName: "ONLINE", memberId: null, email: null });
  const [actionItems, setActionItems] = useState<HudActionItem[]>([]);
  const [scoreHistory, setScoreHistory] = useState<Record<string, number[]>>({});
  const [signalMetrics, setSignalMetrics] = useState<Record<string, { m: number; x: number; f: number }>>({});
  const [managementScore, setManagementScore] = useState<HudManagementScoreSnapshot | null>(null);
  const [managementHistory, setManagementHistory] = useState<HudManagementScoreSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.allSettled([
      fetchProjectsFromSupabase(),
      fetchBillingStatusFromSupabase(getCurrentYm()),
      supabase.auth.getUser().then(async ({ data }) => {
        const email = data.user?.email ?? null;
        if (!email) return { codeName: "ONLINE", memberId: null, email };
        const { data: member } = await supabase
          .from("members")
          .select("member_id, code_name, email")
          .eq("email", email)
          .maybeSingle();
        return {
          codeName: member?.code_name || data.user?.user_metadata?.name || email.split("@")[0] || "ONLINE",
          memberId: member?.member_id ?? null,
          email,
        };
      }),
      Promise.all([fetchAllAmdScoreInputs(), fetchActiveAlpha()]).then(([inputs, activeAlpha]) => {
        const grouped: Record<string, typeof inputs> = {};
        for (const row of inputs) {
          (grouped[row.project_id] ||= []).push(row);
        }
        if (grouped.p21?.length) {
          grouped[AAA_PROJECT_ID] = buildAaaScoreInputsFromSx(grouped.p21, activeAlpha.alpha);
        }
        const history = Object.fromEntries(
          Object.entries(grouped).map(([projectId, rows]) => [
            projectId,
            computeAmdScoreSeries(visibleScoreInputs(rows), activeAlpha.alpha).map((p) => p.score),
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
      }),
      fetchManagementScoreHistory(supabase),
    ]).then(([projRes, billRes, userRes, scoreRes, managementRes]) => {
      if (projRes.status === "fulfilled") setProjects(projRes.value);
      if (billRes.status === "fulfilled") setBillingStatus(billRes.value);
      if (userRes.status === "fulfilled") setHudUser(userRes.value);
      if (scoreRes.status === "fulfilled") {
        setScoreHistory(scoreRes.value.history);
        setSignalMetrics(scoreRes.value.metrics);
      }
      if (managementRes?.status === "fulfilled") {
        setManagementHistory(managementRes.value);
        setManagementScore(managementRes.value[managementRes.value.length - 1] ?? null);
      }
      if (projRes.status === "fulfilled" && billRes.status === "fulfilled") {
        setActionItems(buildMonthlyRoutineActions(projRes.value, billRes.value));
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="grid h-[calc(100vh-6.25rem)] place-items-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-9 w-9 rounded-full border-2 border-cyan-300 border-t-transparent animate-spin shadow-[0_0_18px_rgba(34,211,238,.5)]" />
          <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-cyan-100/75">Loading HUD client</p>
        </div>
      </div>
    );
  }

  return <HudControlCenterDashboard projects={projects} billingStatus={billingStatus} user={hudUser} actionItems={actionItems} scoreHistory={scoreHistory} signalMetrics={signalMetrics} managementScore={managementScore} managementHistory={managementHistory} />;
}

async function fetchManagementScoreHistory(supabase: ReturnType<typeof createClient>): Promise<HudManagementScoreSnapshot[]> {
  const { data, error } = await supabase
    .from("amd_management_score_snapshots")
    .select("ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score,confidence")
    .order("ym", { ascending: true })
    .order("updated_at", { ascending: true });

  if (error || !data) return [];
  const latestByYm = new Map<string, HudManagementScoreSnapshot>();
  for (const row of data) {
    latestByYm.set(row.ym ?? "", normalizeManagementScore(row));
  }
  return Array.from(latestByYm.values()).filter((row) => row.ym);
}

function visibleScoreInputs(rows: Awaited<ReturnType<typeof fetchAllAmdScoreInputs>>) {
  const today = new Date().toISOString().slice(0, 10);
  return rows.filter((row) => row.evaluated_at.slice(0, 10) <= today);
}

function normalizeManagementScore(data: {
  ym: string | null;
  total_score: number | string | null;
  initiative_score: number | string | null;
  finance_score: number | string | null;
  retention_score: number | string | null;
  pipeline_score: number | string | null;
  direction_score: number | string | null;
  confidence: number | string | null;
}): HudManagementScoreSnapshot {
  return {
    ym: data.ym ?? null,
    total_score: data.total_score == null ? null : Number(data.total_score),
    initiative_score: data.initiative_score == null ? null : Number(data.initiative_score),
    finance_score: data.finance_score == null ? null : Number(data.finance_score),
    retention_score: data.retention_score == null ? null : Number(data.retention_score),
    pipeline_score: data.pipeline_score == null ? null : Number(data.pipeline_score),
    direction_score: data.direction_score == null ? null : Number(data.direction_score),
    confidence: data.confidence == null ? null : Number(data.confidence),
  };
}

function buildMonthlyRoutineActions(projects: DashProject[], billingStatus: Record<string, DashBillingStatus>): HudActionItem[] {
  const byProject = new Map(projects.map((p) => [p.projectId, p]));
  const items: HudActionItem[] = [];
  for (const [projectId, cycle] of Object.entries(billingStatus)) {
    const project = byProject.get(projectId);
    const base = {
      meta: `${projectId} / PENDING`,
      periodLabel: monthLabel(cycle.ym),
      projectInitials: project ? projectInitials(project.shortLabel || project.projectName, project.projectId) : initialsFromProjectId(projectId),
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
