"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AllocationStatus = "confirmed" | "reported" | "not_set";

interface Member {
  memberId: string;
  codeName: string;
  email: string;
}

interface MyPageNotification {
  id: string;
  projectId: string;
  projectName: string;
  bizYm: string;
  stepId: string;
  stepLabel: string;
  status: string;
  deadline?: string | null;
}

interface MyPageMilestone {
  milestoneKey: string;
  title: string;
  maxPoints: number;
  tag: string;
  progressPct: number;
  monthlyProgressPct: number;
  monthlyNote?: string | null;
  monthlySource?: string | null;
  narrative?: string | null;
}

interface MyPageProject {
  projectId: string;
  projectName: string;
  allocation: number | null;
  allocationStatus: AllocationStatus;
  billingStatus: string;
  milestones: MyPageMilestone[];
  sectionMembers?: string | null;
  monthlyEstimatedRewardYen?: number | null;
  monthlyEarnedPt?: number | null;
  rewardEligible: boolean;
  rewardExcludedReasons: string[];
}

interface MyPageMonth {
  ym: string;
  isCurrent: boolean;
  projects: MyPageProject[];
}

interface MyPageData {
  member: Member;
  months: MyPageMonth[];
  notifications: MyPageNotification[];
}

interface RoutineStep {
  stepId: string;
  label: string;
  done: boolean;
  status: string;
  deadline?: string | null;
}

const supabase = createClient();

function getCurrentYm(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

function prevYm(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  return m === 1 ? `${y - 1}12` : `${y}${String(m - 1).padStart(2, "0")}`;
}

function nextYm(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  return m === 12 ? `${y + 1}01` : `${y}${String(m + 1).padStart(2, "0")}`;
}

function targetYms(monthsBack = 6): string[] {
  const out: string[] = [];
  let ym = getCurrentYm();
  for (let i = 0; i <= monthsBack; i += 1) {
    out.push(ym);
    ym = prevYm(ym);
  }
  return out;
}

function firstDay(ym: string) {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`;
}

function formatYm(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4))}月`;
}

function formatYen(amount: number | null | undefined) {
  if (amount == null) return "未確定";
  return `¥${Math.round(amount).toLocaleString()}`;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function tagLabel(tag: string) {
  if (tag === "routine") return "定常";
  if (tag === "buffer") return "バッファ";
  return "";
}

function allocationStatus(status?: string | null): AllocationStatus {
  if (status === "allocation_confirmed" || status === "budget_confirmed") return "confirmed";
  if (status === "reported") return "reported";
  return "not_set";
}

function extractMemberSection(text: string | null | undefined, codeName: string): string | null {
  if (!text || !codeName) return null;
  const lines = text.split("\n");
  let inSection = false;
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("##")) {
      if (inSection) break;
      if (trimmed.toLowerCase().includes(codeName.toLowerCase())) inSection = true;
    } else if (inSection) {
      result.push(line);
    }
  }
  const content = result.join("\n").trim();
  return content || null;
}

function deltaSummary(ms: MyPageMilestone) {
  const note = ms.monthlyNote?.trim();
  if (note) return note;
  if (ms.monthlyProgressPct <= 0.01) return "先月からの進捗差分はありません。";
  const deltaPt = (ms.monthlyProgressPct / 100) * ms.maxPoints;
  if ((ms.monthlySource || "").toLowerCase() === "tsukuyomi_estimate") {
    return `AI推定: 先月から +${Math.round(ms.monthlyProgressPct)}%（+${deltaPt.toFixed(1)}pt）進捗見込み。`;
  }
  return `先月から +${Math.round(ms.monthlyProgressPct)}%（+${deltaPt.toFixed(1)}pt）進捗しました。`;
}

function ymd(ym: string, day: number) {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(day).padStart(2, "0")}`;
}

function adjustBusinessDay(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return date.toISOString().slice(0, 10);
}

function recomputedStatus(done: boolean, deadline?: string | null, fallback = "future") {
  if (done) return "done";
  if (!deadline) return fallback;
  const today = new Date();
  const jst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const todayKey = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate());
  const target = Date.parse(`${deadline.slice(0, 10)}T00:00:00Z`);
  const daysLeft = Math.round((target - todayKey) / 86400000);
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 3) return "warn";
  return fallback;
}

function deadlineFor(stepId: string, ym: string, isCTB: boolean) {
  switch (stepId) {
    case "estimateSend":
      return adjustBusinessDay(ymd(prevYm(ym), 28));
    case "budget":
      return adjustBusinessDay(ymd(prevYm(ym), isCTB ? 28 : 25));
    case "meeting":
      return adjustBusinessDay(ymd(ym, 20));
    case "reportFix":
      return adjustBusinessDay(ymd(nextYm(ym), 3));
    case "reimburseConfirm":
      return adjustBusinessDay(ymd(nextYm(ym), 4));
    case "invoiceIssue":
      return adjustBusinessDay(isCTB ? ymd(ym, 28) : ymd(nextYm(ym), 8));
    case "invoiceSend":
      return adjustBusinessDay(isCTB ? ymd(ym, 28) : ymd(nextYm(ym), 9));
    default:
      return null;
  }
}

function buildRoutineSteps(cycle: Record<string, unknown> | undefined, ym: string, isCTB: boolean): RoutineStep[] {
  const estimateDone = !!cycle?.invoice_base_lines_json || !!cycle?.invoice_subject || !!cycle?.invoice_issued_at;
  const base = [
    ...(isCTB ? [{ stepId: "estimateSend", label: "見積書送付", done: estimateDone }] : []),
    { stepId: "budget", label: "請求額確定", done: !!cycle?.budget_confirmed_at || cycle?.status === "budget_confirmed" || cycle?.status === "allocation_confirmed" },
    { stepId: "meeting", label: "報告会日程調整", done: !!cycle?.meeting_event_id || !!cycle?.meeting_start_at },
    { stepId: "reportFix", label: "月次報告書FIX", done: !!cycle?.report_fixed_at },
    { stepId: "reimburseConfirm", label: "立替精算確認", done: cycle?.reimburse_confirm_done !== false },
    { stepId: "invoiceIssue", label: "請求書発行", done: !!cycle?.invoice_issued_at },
    { stepId: "invoiceSend", label: "請求書送付", done: !!cycle?.invoice_sent_at },
  ];
  return base.map((s) => {
    const deadline = deadlineFor(s.stepId, ym, isCTB);
    return { ...s, deadline, status: recomputedStatus(s.done, deadline) };
  });
}

function routineRescuedByAdmin(cycle: Record<string, unknown> | undefined): boolean {
  const status = String(cycle?.status || "").toLowerCase();
  return (
    status === "payment_confirmed" ||
    status === "reward_paid" ||
    status === "completed" ||
    !!cycle?.payment_confirmed_at ||
    !!cycle?.reward_paid_at
  );
}

function cycleWithReimburseStatus(
  cycle: Record<string, unknown> | undefined,
  projectId: string,
  ym: string,
  reimburseHasPending: Map<string, boolean>
): Record<string, unknown> | undefined {
  const reimburseDone = !reimburseHasPending.get(`${projectId}_${ym}`);
  return { ...(cycle || {}), reimburse_confirm_done: reimburseDone };
}

function overdueRoutineReasons(cycle: Record<string, unknown> | undefined, ym: string, isCTB: boolean): string[] {
  if (routineRescuedByAdmin(cycle)) return [];
  return buildRoutineSteps(cycle, ym, isCTB)
    .filter((step) => !step.done && step.status === "overdue")
    .map((step) => `${step.label}${step.deadline ? `（期限 ${formatDeadline(step.deadline)}）` : ""}`);
}

function rewardAmount(project: Pick<MyPageProject, "monthlyEstimatedRewardYen" | "allocation">): number {
  return project.monthlyEstimatedRewardYen ?? project.allocation ?? 0;
}

function payableRewardAmount(project: MyPageProject): number {
  return project.rewardEligible ? rewardAmount(project) : 0;
}

async function resolveLoggedInMember(): Promise<Member> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const email = userData.user?.email?.toLowerCase();
  if (!email) throw new Error("ログインしてください");

  let query = supabase
    .from("members")
    .select("member_id, code_name, email")
    .eq("email", email)
    .limit(1);

  let { data, error } = await query;
  if (!error && data && data.length > 0) {
    const row = data[0];
    return { memberId: row.member_id, codeName: row.code_name || row.member_id, email: row.email || email };
  }

  ({ data, error } = await supabase
    .from("members")
    .select("member_id, code_name, email")
    .ilike("email", email)
    .limit(1));

  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error(`${email} に紐づくメンバーが見つかりません`);
  return { memberId: row.member_id, codeName: row.code_name || row.member_id, email: row.email || email };
}

async function loadMyPageData(): Promise<MyPageData> {
  const member = await resolveLoggedInMember();
  const yms = targetYms(6);
  const progressYms = Array.from(new Set([...yms, ...yms.map(prevYm)]));

  const { data: pmRows, error: pmError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("member_id", member.memberId)
    .eq("is_active", true);
  if (pmError) throw pmError;
  const projectIds = Array.from(new Set((pmRows || []).map((r) => r.project_id).filter(Boolean)));

  if (projectIds.length === 0) {
    return { member, months: yms.map((ym) => ({ ym, isCurrent: ym === yms[0], projects: [] })), notifications: [] };
  }

  const [
    projectsRes,
    cyclesRes,
    plansRes,
    reportsRes,
    reimburseRes,
  ] = await Promise.all([
    supabase.from("projects").select("project_id, project_name, status, start_ym, end_ym, project_type").in("project_id", projectIds),
    supabase.from("billing_cycles").select("*").in("project_id", projectIds).in("ym", yms),
    supabase.from("value_plan_cycles").select("plan_cycle_id, project_id, status, total_points, period_start_ym, period_end_ym").in("project_id", projectIds).in("status", ["active", "confirmed", "fixed", "draft"]),
    supabase.from("monthly_reports").select("project_id, ym, section_members").in("project_id", projectIds).in("ym", yms),
    supabase.from("reimbursements").select("project_id, date, status").in("project_id", projectIds).gte("date", firstDay(yms[yms.length - 1])).lt("date", firstDay(nextYm(yms[0]))),
  ]);
  if (projectsRes.error) throw projectsRes.error;
  if (cyclesRes.error) throw cyclesRes.error;
  if (plansRes.error) throw plansRes.error;
  if (reportsRes.error) throw reportsRes.error;
  if (reimburseRes.error) throw reimburseRes.error;

  const projects = (projectsRes.data || []).filter((p) => (p.status || "").toLowerCase() !== "lost");
  const activeProjectIds = projects.map((p) => p.project_id);
  const planIds = (plansRes.data || []).map((p) => p.plan_cycle_id).filter(Boolean);

  const milestonesRes = planIds.length
    ? await supabase.from("value_milestones").select("plan_cycle_id, milestone_id, title, points, tag, is_active").in("plan_cycle_id", planIds).eq("is_active", true)
    : { data: [], error: null };
  if (milestonesRes.error) throw milestonesRes.error;
  const milestoneIds = (milestonesRes.data || []).map((m) => m.milestone_id).filter(Boolean);

  const [progressRes, msActivitiesRes] = await Promise.all([
    milestoneIds.length
      ? supabase.from("milestone_monthly_progress").select("milestone_key, ym, progress_pct, source, note").in("milestone_key", milestoneIds).in("ym", progressYms)
      : Promise.resolve({ data: [], error: null }),
    milestoneIds.length
      ? supabase.from("member_ms_activities").select("milestone_id, ym, narrative, learned_addendum").eq("member_id", member.memberId).in("milestone_id", milestoneIds).in("ym", yms)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (progressRes.error) throw progressRes.error;

  const projectMap = new Map(projects.map((p) => [p.project_id, p]));
  const cyclesByKey = new Map((cyclesRes.data || []).map((c) => [`${c.project_id}_${c.ym}`, c]));
  const reportsByKey = new Map((reportsRes.data || []).map((r) => [`${r.project_id}_${r.ym}`, r]));
  const reimburseHasPending = new Map<string, boolean>();
  for (const row of reimburseRes.data || []) {
    const date = row.date || "";
    const ym = date.length >= 7 ? `${date.slice(0, 4)}${date.slice(5, 7)}` : "";
    const status = (row.status || "").toLowerCase();
    if (ym && (status === "submitted" || status === "pmapproved")) {
      reimburseHasPending.set(`${row.project_id}_${ym}`, true);
    }
  }
  const plansByProject = new Map<string, typeof plansRes.data>();
  for (const plan of plansRes.data || []) {
    const list = plansByProject.get(plan.project_id) || [];
    list.push(plan);
    plansByProject.set(plan.project_id, list);
  }
  const milestonesByPlan = new Map<string, typeof milestonesRes.data>();
  for (const ms of milestonesRes.data || []) {
    const list = milestonesByPlan.get(ms.plan_cycle_id) || [];
    list.push(ms);
    milestonesByPlan.set(ms.plan_cycle_id, list);
  }
  const progressByKey = new Map((progressRes.data || []).map((p) => [`${p.milestone_key}_${p.ym}`, p]));
  const progressByMs = new Map<string, typeof progressRes.data>();
  for (const p of progressRes.data || []) {
    const list = progressByMs.get(p.milestone_key) || [];
    list.push(p);
    progressByMs.set(p.milestone_key, list);
  }
  const latestProgress = (milestoneId: string, ym: string) => {
    const rows = progressByMs.get(milestoneId) || [];
    return rows
      .filter((p) => p.ym <= ym)
      .sort((a, b) => b.ym.localeCompare(a.ym))[0] as Record<string, unknown> | undefined;
  };
  const activityByKey = new Map(
    ((msActivitiesRes as { data?: Array<{ milestone_id: string; ym: string; narrative?: string | null; learned_addendum?: string | null }> }).data || [])
      .map((a) => [`${a.milestone_id}_${a.ym}`, a])
  );

  const months: MyPageMonth[] = yms.map((ym) => {
    const projectsForMonth: MyPageProject[] = activeProjectIds
      .filter((pid) => {
        const p = projectMap.get(pid);
        if (!p) return false;
        if (p.start_ym && ym < p.start_ym) return false;
        if (p.end_ym && ym > p.end_ym) return false;
        return true;
      })
      .map((pid) => {
        const rawCycle = cyclesByKey.get(`${pid}_${ym}`) as Record<string, unknown> | undefined;
        const cycle = cycleWithReimburseStatus(rawCycle, pid, ym, reimburseHasPending);
        const allocJson = cycle?.member_allocations_json as Record<string, unknown> | undefined;
        const allocation = toNumber(allocJson?.[member.memberId]);
        const rewardSummary = cycle?.reward_summary_json as { members?: Array<Record<string, unknown>> } | undefined;
        const reward = rewardSummary?.members?.find((m) => m.memberId === member.memberId);
        const plans = plansByProject.get(pid) || [];
        const plan = plans.find((p) => ym >= p.period_start_ym && ym <= p.period_end_ym) || plans[0];
        const prev = prevYm(ym);
        const milestones: MyPageMilestone[] = [];

        for (const ms of plan ? milestonesByPlan.get(plan.plan_cycle_id) || [] : []) {
          const current = latestProgress(ms.milestone_id, ym) || progressByKey.get(`${ms.milestone_id}_${ym}`) as Record<string, unknown> | undefined;
          const previous = latestProgress(ms.milestone_id, prev) || progressByKey.get(`${ms.milestone_id}_${prev}`) as Record<string, unknown> | undefined;
          const curPct = toNumber(current?.progress_pct) || 0;
          const prevPct = toNumber(previous?.progress_pct) || 0;
          const monthlyPct = Math.max(0, curPct - prevPct);
          const activity = activityByKey.get(`${ms.milestone_id}_${ym}`) as { narrative?: string | null; learned_addendum?: string | null } | undefined;
          if (monthlyPct <= 0.01 && !activity?.narrative && !activity?.learned_addendum) continue;
          milestones.push({
            milestoneKey: ms.milestone_id,
            title: ms.title || ms.milestone_id,
            maxPoints: Number(ms.points) || 0,
            tag: ms.tag || "normal",
            progressPct: curPct,
            monthlyProgressPct: monthlyPct,
            monthlyNote: (current?.note as string | null) || null,
            monthlySource: (current?.source as string | null) || null,
            narrative: activity?.narrative || activity?.learned_addendum || null,
          });
        }

        const report = reportsByKey.get(`${pid}_${ym}`) as { section_members?: string | null } | undefined;
        const project = projectMap.get(pid);
        const isCTB = (project?.project_type || "").toLowerCase() === "ctb";
        const rewardExcludedReasons = overdueRoutineReasons(cycle, ym, isCTB);
        return {
          projectId: pid,
          projectName: project?.project_name || pid,
          allocation,
          allocationStatus: allocationStatus(cycle?.status as string | undefined),
          billingStatus: (cycle?.status as string | undefined) || "not_started",
          milestones: milestones.sort((a, b) => a.milestoneKey.localeCompare(b.milestoneKey)),
          sectionMembers: report?.section_members || null,
          monthlyEstimatedRewardYen: toNumber(reward?.totalPay) || null,
          monthlyEarnedPt: toNumber(reward?.earnedPt) || null,
          rewardEligible: rewardExcludedReasons.length === 0,
          rewardExcludedReasons,
        };
      })
      .sort((a, b) => rewardAmount(b) - rewardAmount(a));

    return { ym, isCurrent: ym === yms[0], projects: projectsForMonth };
  });

  const notificationYms = [yms[0], nextYm(yms[0])];
  const notifications: MyPageNotification[] = [];
  for (const pid of activeProjectIds) {
    const project = projectMap.get(pid);
    if (!project || (project.status || "").toLowerCase() !== "active") continue;
    const isCTB = (project.project_type || "").toLowerCase() === "ctb";
    for (const ym of notificationYms) {
      const rawCycle = cyclesByKey.get(`${pid}_${ym}`) as Record<string, unknown> | undefined;
      const cycle = cycleWithReimburseStatus(rawCycle, pid, ym, reimburseHasPending);
      const steps = buildRoutineSteps(cycle, ym, isCTB)
        .filter((s) => !s.done && ["current", "warn", "overdue"].includes(s.status));
      for (const step of steps) {
        notifications.push({
          id: `${pid}_${ym}_${step.stepId}`,
          projectId: pid,
          projectName: project.project_name || pid,
          bizYm: ym,
          stepId: step.stepId,
          stepLabel: step.label,
          status: step.status,
          deadline: step.deadline,
        });
      }
    }
  }
  notifications.sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.bizYm.localeCompare(b.bizYm));

  return { member, months, notifications: notifications.slice(0, 6) };
}

function statusRank(status: string) {
  if (status === "overdue") return 0;
  if (status === "warn") return 1;
  if (status === "current") return 2;
  return 9;
}

export default function MyPage() {
  const router = useRouter();
  const [data, setData] = useState<MyPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pageData = await loadMyPageData();
      setData(pageData);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const currentMonth = data?.months.find((m) => m.isCurrent);
  const currentTotal = useMemo(
    () => currentMonth?.projects.reduce((sum, p) => sum + payableRewardAmount(p), 0) || 0,
    [currentMonth]
  );
  const currentExcludedProjects = useMemo(
    () => currentMonth?.projects.filter((p) => !p.rewardEligible && rewardAmount(p) > 0) || [],
    [currentMonth]
  );

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">読み込み中...</div>;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f5f5f7] px-4">
        <div className="bg-white border border-[#e5e5e7] rounded-xl p-5 max-w-sm text-center space-y-3">
          <p className="text-sm text-[#1d1d1f]">{error || "データ取得に失敗しました"}</p>
          <button onClick={load} className="text-sm text-[#007aff] font-medium">再読み込み</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      <div className="bg-white border-b border-[#e5e5e7] px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#86868b] uppercase">My Page</p>
          <h1 className="text-[20px] font-semibold text-[#1d1d1f] mt-1">{data.member.codeName}</h1>
          <p className="text-[13px] text-[#86868b] mt-0.5">{data.member.email}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6 flex flex-col gap-5">
        <section className="bg-white rounded-2xl border border-[#e5e5e7] p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[13px] text-[#86868b]">{formatYm(currentMonth?.ym || getCurrentYm())}</p>
              <p className="text-[13px] text-[#3c3c43] mt-1">当月報酬合計</p>
            </div>
            <p className="text-[28px] font-bold tabular-nums text-[#1d1d1f]">{formatYen(currentTotal)}</p>
          </div>
          {(currentMonth?.projects.length || 0) > 0 && (
            <div className="mt-4 border-t border-[#e5e5e7] pt-3 space-y-1.5">
              {currentMonth?.projects.map((project) => {
                const amount = rewardAmount(project);
                if (amount <= 0) return null;
                return (
                  <div key={project.projectId} className="flex items-center gap-3 text-[12px]">
                    <span className={`min-w-0 flex-1 truncate ${project.rewardEligible ? "text-[#3c3c43]" : "text-red-600 line-through decoration-2"}`}>
                      {project.projectName}
                    </span>
                    <span className={`tabular-nums ${project.rewardEligible ? "text-[#1d1d1f] font-semibold" : "text-red-600 line-through decoration-2"}`}>
                      {formatYen(amount)}
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center gap-3 border-t border-dashed border-[#d1d1d6] pt-2 text-[13px] font-semibold">
                <span className="flex-1 text-[#1d1d1f]">合計</span>
                <span className="tabular-nums text-[#1d1d1f]">{formatYen(currentTotal)}</span>
              </div>
              {currentExcludedProjects.length > 0 && (
                <p className="text-[11px] leading-relaxed text-red-600">
                  期限超過の月次ルーティンがあるPJは当月報酬から除外中。adminのbilling cycleで完了ステータスになったものは救済済み。
                </p>
              )}
            </div>
          )}
        </section>

        <NotificationCard notifications={data.notifications} onOpen={(note) => {
          router.push(`/project/${note.projectId}/cockpit?ym=${note.bizYm}&step=${note.stepId}`);
        }} />

        {data.months.map((month) => {
          const isExpanded = month.isCurrent || expandedMonths.has(month.ym);
          const total = month.projects.reduce((sum, p) => sum + payableRewardAmount(p), 0);
          return (
            <section key={month.ym} className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setExpandedMonths((prev) => {
                    const next = new Set(prev);
                    if (next.has(month.ym)) next.delete(month.ym);
                    else next.add(month.ym);
                    return next;
                  });
                }}
                className="w-full flex items-center gap-2 text-left px-1"
              >
                <span className="text-[15px] font-semibold text-[#1d1d1f]">{formatYm(month.ym)}</span>
                {month.isCurrent && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#007aff]/10 text-[#007aff] font-semibold">当月</span>}
                <span className="ml-auto text-[14px] font-semibold tabular-nums text-[#1d1d1f]">{formatYen(total)}</span>
                <span className="text-[#86868b] text-[12px]">{isExpanded ? "▲" : "▼"}</span>
              </button>

              {isExpanded && (
                <div className="space-y-3">
                  {month.projects.length === 0 ? (
                    <div className="bg-white rounded-xl border border-[#e5e5e7] p-4 text-[13px] text-[#86868b]">参加PJなし</div>
                  ) : (
                    month.projects.map((project) => (
                      <ProjectCard key={`${month.ym}_${project.projectId}`} project={project} codeName={data.member.codeName} />
                    ))
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function NotificationCard({ notifications, onOpen }: { notifications: MyPageNotification[]; onOpen: (note: MyPageNotification) => void }) {
  return (
    <section className="bg-white rounded-2xl border border-[#e5e5e7] p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[15px]">🔔</span>
        <h2 className="text-[14px] font-semibold text-[#1d1d1f]">いまやること</h2>
      </div>
      {notifications.length === 0 ? (
        <p className="text-[13px] text-[#86868b]">今すぐ対応が必要なタスクはありません</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => onOpen(note)}
              className="w-full flex items-start gap-3 p-3 rounded-xl bg-[#f5f5f7] hover:bg-[#eeeeef] transition-colors text-left"
            >
              <StatusDot status={note.status} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#1d1d1f]">{note.stepLabel}</p>
                <p className="text-[12px] text-[#86868b] mt-0.5">{note.projectName} · {formatYm(note.bizYm)}</p>
                {note.deadline && <p className="text-[11px] text-[#86868b] mt-1">期限 {formatDeadline(note.deadline)}</p>}
              </div>
              <span className="text-[#aeaeb2] text-[13px] pt-1">›</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectCard({ project, codeName }: { project: MyPageProject; codeName: string }) {
  const activityText = extractMemberSection(project.sectionMembers, codeName);
  const baseReward = rewardAmount(project);
  return (
    <article className="bg-white rounded-2xl border border-[#e5e5e7] p-4 shadow-sm space-y-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f] truncate">{project.projectName}</h3>
          <StatusBadge status={project.allocationStatus} />
        </div>
        <div className="text-right shrink-0">
          <p className={`text-[18px] font-bold tabular-nums ${project.rewardEligible ? "text-[#1d1d1f]" : "text-red-600 line-through decoration-2"}`}>
            {formatYen(baseReward)}
          </p>
          <p className="text-[11px] text-[#86868b]">{project.billingStatus}</p>
        </div>
      </div>

      <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${project.rewardEligible ? "bg-[#eef0ff]" : "bg-red-50"}`}>
        <span className="text-[12px]">✨</span>
        <span className={`text-[12px] ${project.rewardEligible ? "text-[#5b6070]" : "text-red-700"}`}>
          {project.rewardEligible ? "今月想定" : "期限超過で除外中"}
        </span>
        <span className={`ml-auto text-[13px] font-semibold tabular-nums ${project.rewardEligible ? "text-[#4338ca]" : "text-red-700 line-through decoration-2"}`}>
          {project.monthlyEarnedPt ? `${project.monthlyEarnedPt.toFixed(1)}pt · ` : ""}
          {baseReward ? formatYen(baseReward) : "未計算"}
        </span>
      </div>

      {!project.rewardEligible && project.rewardExcludedReasons.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-[12px] font-semibold text-red-700">未完了タスクがあるため当月報酬から除外</p>
          <p className="text-[11px] text-red-700 mt-1 leading-relaxed">{project.rewardExcludedReasons.join("、")}</p>
        </div>
      )}

      {project.milestones.length > 0 && (
        <div className="border-t border-[#e5e5e7] pt-3 space-y-3">
          {project.milestones.map((ms) => (
            <MilestoneRow key={ms.milestoneKey} ms={ms} />
          ))}
        </div>
      )}

      {(activityText || project.milestones.some((m) => m.narrative)) && (
        <div className="border-t border-[#e5e5e7] pt-3">
          <p className="text-[12px] font-semibold text-[#86868b] mb-2">今月の活動</p>
          {activityText && <p className="text-[13px] text-[#3c3c43] whitespace-pre-wrap leading-relaxed">{activityText}</p>}
          {!activityText && (
            <div className="space-y-2">
              {project.milestones.filter((m) => m.narrative).map((m) => (
                <p key={m.milestoneKey} className="text-[13px] text-[#3c3c43] leading-relaxed">
                  <span className="font-semibold">{m.title}: </span>{m.narrative}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function MilestoneRow({ ms }: { ms: MyPageMilestone }) {
  const color = ms.progressPct >= 80 ? "bg-emerald-500" : ms.progressPct > 0 ? "bg-[#007aff]" : "bg-[#d1d1d6]";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <p className="text-[13px] font-medium text-[#1d1d1f] truncate">{ms.title}</p>
        {tagLabel(ms.tag) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f2f2f7] text-[#86868b]">{tagLabel(ms.tag)}</span>}
        <span className="ml-auto text-[11px] text-[#86868b] tabular-nums">{ms.maxPoints}pt</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 bg-[#f2f2f7] rounded-full flex-1 overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, ms.progressPct))}%` }} />
        </div>
        <span className="text-[11px] text-[#86868b] tabular-nums w-10 text-right">{Math.round(ms.progressPct)}%</span>
        {ms.monthlyProgressPct > 0 && (
          <span className={`text-[11px] tabular-nums ${ms.monthlySource === "tsukuyomi_estimate" ? "text-orange-600" : "text-emerald-600"}`}>
            +{ms.monthlyProgressPct.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-[11px] text-[#86868b] leading-relaxed">{deltaSummary(ms)}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: AllocationStatus }) {
  if (status === "confirmed") return <p className="text-[11px] text-emerald-600 mt-0.5">● 確定</p>;
  if (status === "reported") return <p className="text-[11px] text-orange-600 mt-0.5">● 申告中</p>;
  return <p className="text-[11px] text-[#86868b] mt-0.5">○ 未設定</p>;
}

function StatusDot({ status }: { status: string }) {
  const cls = status === "overdue"
    ? "bg-red-100 text-red-700"
    : status === "warn"
      ? "bg-orange-100 text-orange-700"
      : "bg-blue-100 text-blue-700";
  return (
    <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 text-[13px] font-bold ${cls}`}>
      {status === "overdue" || status === "warn" ? "!" : "•"}
    </span>
  );
}

function formatDeadline(s: string) {
  const parts = s.slice(0, 10).split("-");
  if (parts.length === 3) return `${Number(parts[1])}/${Number(parts[2])}`;
  return s;
}
