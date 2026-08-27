"use client";

import Link from "next/link";
import { Suspense, type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LinkedMemberText } from "@/components/members/LinkedMemberText";
import { createClient } from "@/lib/supabase/client";
import type { MemberWeeklyTask, WeeklyTaskCandidate } from "@/lib/mypage/member-weekly-tasks";

type AllocationStatus = "confirmed" | "reported" | "not_set";

interface Member {
  memberId: string;
  codeName: string;
  email: string;
  isAdmin: boolean;
  isOfficer: boolean;
  excludeFromPayoutNotice: boolean;
  rewardAmountHidden: boolean;
  payoutNoticeNote: string | null;
}

interface MyPageWeeklyActivity {
  id: string;
  projectId: string;
  projectName: string;
  source: string;
  title: string;
  contentPreview: string;
  itemDate: string | null;
  sourceKinds: string[];
  sourceUrl?: string | null;
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
  monthlyPayoutYen?: number | null;
  monthlyCompanyReserveYen?: number | null;
  rewardEligible: boolean;
  rewardExcludedReasons: string[];
}

interface MyPageMonth {
  ym: string;
  isCurrent: boolean;
  projects: MyPageProject[];
}

interface MyPageData {
  viewer: Member;
  member: Member;
  months: MyPageMonth[];
  weeklyActivities: MyPageWeeklyActivity[];
  weekStart: string;
  weekEnd: string;
}

interface MonthlyAgreementMiniBundle {
  ym: string;
  status: "pending" | "agreed" | "needs_reagreement" | "not_required";
  tableReady: boolean;
  currentHash: string;
  latestAgreement: { agreedAt: string | null; snapshotHash: string } | null;
  exclusionReason?: string | null;
  snapshot: {
    totals: {
      expectedRewardYen: number;
      projectCount: number;
      reviewRequiredCount: number;
    };
  };
}

const supabase = createClient();
const REWARD_AMOUNT_PLACEHOLDER = "ー";
const NO_COMPENSATION_MEMBER_IDS = new Set(["ID006", "ID029"]);

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

function targetYms(monthsBack = 6): string[] {
  const out: string[] = [];
  let ym = getCurrentYm();
  for (let i = 0; i <= monthsBack; i += 1) {
    out.push(ym);
    ym = prevYm(ym);
  }
  return out;
}

function formatYm(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4))}月`;
}

function formatYen(amount: number | null | undefined) {
  if (amount == null) return "未確定";
  return `¥${Math.round(amount).toLocaleString()}`;
}

function formatRewardYen(amount: number | null | undefined, hidden: boolean) {
  return hidden ? REWARD_AMOUNT_PLACEHOLDER : formatYen(amount);
}

function shouldHideRewardAmount(memberId: string, codeName: string, isOfficer: boolean, excludeFromPayoutNotice?: boolean | null) {
  return !isOfficer && (
    Boolean(excludeFromPayoutNotice) ||
    NO_COMPENSATION_MEMBER_IDS.has(memberId) ||
    ["りり", "あき"].includes(codeName.trim())
  );
}

function toMember(
  row: {
    member_id: string;
    code_name?: string | null;
    email?: string | null;
    is_admin?: boolean | null;
    is_officer?: boolean | null;
    exclude_from_payout_notice?: boolean | null;
  },
  fallbackEmail = ""
): Member {
  const memberId = row.member_id;
  const codeName = row.code_name || row.member_id;
  const isOfficer = Boolean(row.is_officer);
  const excludeFromPayoutNotice = Boolean(row.exclude_from_payout_notice);
  return {
    memberId,
    codeName,
    email: row.email || fallbackEmail,
    isAdmin: !!row.is_admin,
    isOfficer,
    excludeFromPayoutNotice,
    rewardAmountHidden: shouldHideRewardAmount(memberId, codeName, isOfficer, excludeFromPayoutNotice),
    payoutNoticeNote: isOfficer && excludeFromPayoutNotice ? "（役員のため支払対象外）" : null,
  };
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

function isProjectFrozenForYm(project: { status?: string | null; freeze_from_ym?: string | null }, ym: string): boolean {
  if ((project.status || "").toLowerCase() === "frozen") return true;
  return !!project.freeze_from_ym && ym >= project.freeze_from_ym;
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

function dateFromJstKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 9 * 60 * 60 * 1000);
}

function dateKeyJST(date: Date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

function currentWeekBoundsJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const daysFromMonday = (jst.getUTCDay() + 6) % 7;
  const startJst = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()));
  startJst.setUTCDate(startJst.getUTCDate() - daysFromMonday);
  const start = new Date(startJst.getTime() - 9 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 7 * 86400000);
  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startKey: dateKeyJST(start),
    endKey: dateKeyJST(new Date(end.getTime() - 86400000)),
  };
}

function formatDateJa(keyOrIso: string | null | undefined) {
  if (!keyOrIso) return "";
  const key = /^\d{4}-\d{2}-\d{2}$/.test(keyOrIso)
    ? keyOrIso
    : dateKeyJST(new Date(keyOrIso));
  const date = dateFromJstKey(key);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))} (${weekdays[jst.getUTCDay()]})`;
}

function sourceKindLabel(source: string | null | undefined) {
  if (source === "gmail") return "Gmail";
  if (source === "calendar") return "Calendar";
  if (source === "gmail_message") return "Gmail";
  if (source === "gmeet") return "Calendar";
  if (source === "meeting_summary") return "議事録";
  if (source === "source_cache") return "社内記録";
  return "活動根拠";
}

/** source_fusion は束ね方の内部名。表示は各根拠の実際の種類だけにする。 */
function activitySourceKinds(meta: Record<string, unknown>, fallbackSource: string) {
  const fusedKinds = Array.isArray(meta.source_kinds)
    ? meta.source_kinds.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    : [];
  const sourceKinds = [...new Set(fusedKinds.filter((value) => value !== "source_fusion"))];
  if (sourceKinds.length > 0) return sourceKinds;

  const rawSourceKind = typeof meta.source_kind === "string" ? meta.source_kind : fallbackSource;
  if (rawSourceKind === "source_cache" && typeof meta.source_subkind === "string") return [meta.source_subkind];
  return rawSourceKind && rawSourceKind !== "source_fusion" ? [rawSourceKind] : [];
}

function SourceKindBadges({ sourceKinds }: { sourceKinds: string[] }) {
  const visibleKinds = sourceKinds.length > 0 ? sourceKinds : ["activity_evidence"];
  return (
    <span className="flex shrink-0 flex-wrap items-center gap-1">
      {visibleKinds.map((sourceKind) => (
        <span key={sourceKind} className="rounded-full bg-[#007aff]/10 px-2 py-0.5 text-[10px] font-semibold text-[#007aff]">
          {sourceKindLabel(sourceKind)}
        </span>
      ))}
    </span>
  );
}

function plainPreview(value: string | null | undefined, max = 110) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function displayableWeeklyActivity(row: {
  source: string;
  title: string | null;
  content_preview: string | null;
  raw_metadata: Record<string, unknown> | null;
}) {
  const meta = row.raw_metadata || {};
  const rawSourceKind = typeof meta.source_kind === "string" ? meta.source_kind : row.source;
  const sourceSubkind = typeof meta.source_subkind === "string" ? meta.source_subkind : "";
  if (rawSourceKind === "gmail" && sourceSubkind !== "sent" && sourceSubkind !== "draft") return false;
  return true;
}

function weeklyActivityText(row: {
  source: string;
  title: string | null;
  content_preview: string | null;
  raw_metadata: Record<string, unknown> | null;
}) {
  const meta = row.raw_metadata || {};
  const rawSourceKind = typeof meta.source_kind === "string" ? meta.source_kind : row.source;
  const sourceKind = rawSourceKind === "source_cache" && typeof meta.source_subkind === "string"
    ? meta.source_subkind
    : rawSourceKind;
  const sourceSubkind = typeof meta.source_subkind === "string" ? meta.source_subkind : "";
  const rawTitle = row.title || "今週の活動";
  const title = rawTitle.replace(/^(メール|予定|gmail|calendar):\s*/i, "").replace(/^Re:\s*/i, "");
  if (rawSourceKind === "source_cache" && sourceKind.startsWith("gmail")) {
    return {
      title: rawTitle,
      contentPreview: plainPreview(row.content_preview),
    };
  }
  if (sourceKind === "gmail") {
    const action = sourceSubkind === "draft" ? "返信ドラフトを作成" : "メールを送信";
    return {
      title: `${action}: ${title}`,
      contentPreview: plainPreview(row.content_preview) || "メール本文ではなく、送信/下書きという行動だけを活動として表示しています。",
    };
  }
  if (sourceKind === "calendar") {
    const action = sourceSubkind === "organizer" ? "予定を主催" : "予定に参加";
    const cleanedTitle = title.replace(/^(予定を主催|予定に参加):\s*/i, "");
    return {
      title: `${action}: ${cleanedTitle}`,
      contentPreview: plainPreview(row.content_preview),
    };
  }
  if (sourceKind === "meeting_summary") {
    return {
      title,
      contentPreview: plainPreview(row.content_preview),
    };
  }
  return {
    title: rawTitle,
    contentPreview: plainPreview(row.content_preview),
  };
}

function rewardAmount(project: Pick<MyPageProject, "monthlyEstimatedRewardYen" | "allocation">): number | null {
  return project.monthlyEstimatedRewardYen ?? project.allocation ?? null;
}

function payableRewardAmount(project: MyPageProject): number {
  return project.rewardEligible ? rewardAmount(project) ?? 0 : 0;
}

async function resolveLoggedInMember(): Promise<Member> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const email = userData.user?.email?.toLowerCase();
  if (!email) throw new Error("ログインしてください");

  const query = supabase
    .from("members")
    .select("member_id, code_name, email, is_admin, is_officer, exclude_from_payout_notice")
    .eq("email", email)
    .limit(1);

  let { data, error } = await query;
  if (!error && data && data.length > 0) {
    return toMember(data[0], email);
  }

  ({ data, error } = await supabase
    .from("members")
    .select("member_id, code_name, email, is_admin, is_officer, exclude_from_payout_notice")
    .ilike("email", email)
    .limit(1));

  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error(`${email} に紐づくメンバーが見つかりません`);
  return toMember(row, email);
}

async function resolvePageMember(viewer: Member, requestedMemberId?: string | null): Promise<Member> {
  const memberId = requestedMemberId?.trim();
  if (!memberId || memberId === viewer.memberId) return viewer;
  if (!viewer.isAdmin) throw new Error("他メンバーのマイページ表示はadminだけに限定しています");

  const { data, error } = await supabase
    .from("members")
    .select("member_id, code_name, email, is_admin, is_officer, exclude_from_payout_notice")
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`${memberId} に紐づくメンバーが見つかりません`);
  return toMember(data);
}

async function loadMyPageData(requestedMemberId?: string | null): Promise<MyPageData> {
  const viewer = await resolveLoggedInMember();
  const member = await resolvePageMember(viewer, requestedMemberId);
  const yms = targetYms(6);
  const progressYms = Array.from(new Set([...yms, ...yms.map(prevYm)]));
  const week = currentWeekBoundsJST();
  const firstVisibleWeekStart = new Date(week.start.getTime() - 14 * 86400000).toISOString();

  const [pmRes, weeklyRes] = await Promise.all([
    supabase
      .from("project_members")
      .select("project_id, is_pm, is_pl")
      .eq("member_id", member.memberId)
      .eq("is_active", true),
    supabase
      .from("member_activities")
      .select("id, project_id, source, title, content_preview, item_date, raw_metadata")
      .eq("member_id", member.memberId)
      .eq("source", "member_weekly")
      .gte("item_date", firstVisibleWeekStart)
      .lt("item_date", week.endIso)
      .order("item_date", { ascending: false, nullsFirst: false })
      .limit(60),
  ]);
  const pmRows = pmRes.data;
  const pmError = pmRes.error;
  if (pmError) throw pmError;
  if (weeklyRes.error) throw weeklyRes.error;
  const memberProjectIds = Array.from(new Set((pmRows || []).map((r: { project_id: string | null }) => r.project_id).filter(Boolean)));
  const weeklyProjectIds = Array.from(new Set((weeklyRes.data || []).map((r: { project_id: string | null }) => r.project_id).filter(Boolean)));
  const projectIds = Array.from(new Set([...memberProjectIds, ...weeklyProjectIds]));

  if (projectIds.length === 0) {
    return {
      viewer,
      member,
      months: yms.map((ym) => ({ ym, isCurrent: ym === yms[0], projects: [] })),
      weeklyActivities: [],
      weekStart: week.startKey,
      weekEnd: week.endKey,
    };
  }

  const [
    projectsRes,
    cyclesRes,
    plansRes,
    reportsRes,
  ] = await Promise.all([
    supabase.from("projects").select("project_id, project_name, status, start_ym, end_ym, freeze_from_ym, project_type, project_category").in("project_id", projectIds),
    supabase.from("billing_cycles").select("*").in("project_id", projectIds).in("ym", yms),
    supabase.from("value_plan_cycles").select("plan_cycle_id, project_id, status, total_points, period_start_ym, period_end_ym").in("project_id", projectIds).in("status", ["active", "confirmed", "fixed", "draft"]),
    supabase.from("monthly_reports").select("project_id, ym, section_members").in("project_id", projectIds).in("ym", yms),
  ]);
  if (projectsRes.error) throw projectsRes.error;
  if (cyclesRes.error) throw cyclesRes.error;
  if (plansRes.error) throw plansRes.error;
  if (reportsRes.error) throw reportsRes.error;

  const projects = (projectsRes.data || []).filter((p) => (p.status || "").toLowerCase() !== "lost");
  const activeProjectIds = projects
    .map((p) => p.project_id)
    .filter((pid) => memberProjectIds.includes(pid));
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
  const weeklyActivities: MyPageWeeklyActivity[] = (weeklyRes.data || [])
    .filter((row: {
      source: string;
      title: string | null;
      content_preview: string | null;
      raw_metadata: Record<string, unknown> | null;
    }) => displayableWeeklyActivity(row))
    .map((row: {
    id: string;
    project_id: string;
    source: string;
    title: string | null;
    content_preview: string | null;
    item_date: string | null;
    raw_metadata: Record<string, unknown> | null;
  }) => {
    const meta = row.raw_metadata || {};
    const sourceUrl = typeof meta.source_url === "string" ? meta.source_url : null;
    const display = weeklyActivityText(row);
    return {
      id: row.id,
      projectId: row.project_id,
      projectName: projectMap.get(row.project_id)?.project_name || row.project_id,
      source: row.source,
      sourceKinds: activitySourceKinds(meta, row.source),
      sourceUrl,
      title: display.title,
      contentPreview: display.contentPreview,
      itemDate: row.item_date,
    };
  });
  const cyclesByKey = new Map((cyclesRes.data || []).map((c) => [`${c.project_id}_${c.ym}`, c]));
  const reportsByKey = new Map((reportsRes.data || []).map((r) => [`${r.project_id}_${r.ym}`, r]));
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
        if (isProjectFrozenForYm(p, ym)) return false;
        if (p.start_ym && ym < p.start_ym) return false;
        if (p.end_ym && ym > p.end_ym) return false;
        return true;
      })
      .map((pid) => {
        const rawCycle = cyclesByKey.get(`${pid}_${ym}`) as Record<string, unknown> | undefined;
        const cycle = rawCycle;
        const allocJson = cycle?.member_allocations_json as Record<string, unknown> | undefined;
        const allocation = toNumber(allocJson?.[member.memberId]);
        const rewardSummary = cycle?.reward_summary_json as { members?: Array<Record<string, unknown>> } | undefined;
        const reward = rewardSummary?.members?.find((m) => (m.memberId ?? m.member_id) === member.memberId);
        const payoutYen = toNumber(reward?.totalPay ?? reward?.total_pay);
        const companyReserveYen = toNumber(
          reward?.companyReserveYen ??
          reward?.company_reserve_yen ??
          reward?.officerReserveYen ??
          reward?.officer_reserve_yen
        );
        const basePayYen = toNumber(reward?.basePay ?? reward?.base_pay);
        const grossDueYen = toNumber(reward?.grossDueYen ?? reward?.gross_due_yen);
        const displayRewardYen = member.isOfficer
          ? companyReserveYen ?? basePayYen ?? grossDueYen ?? payoutYen
          : payoutYen;
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
        const rewardExcludedReasons: string[] = [];
        return {
          projectId: pid,
          projectName: project?.project_name || pid,
          allocation,
          allocationStatus: allocationStatus(cycle?.status as string | undefined),
          billingStatus: (cycle?.status as string | undefined) || "not_started",
          milestones: milestones.sort((a, b) => a.milestoneKey.localeCompare(b.milestoneKey)),
          sectionMembers: report?.section_members || null,
          monthlyEstimatedRewardYen: displayRewardYen,
          monthlyEarnedPt: toNumber(reward?.earnedPt ?? reward?.earned_pt),
          monthlyPayoutYen: payoutYen,
          monthlyCompanyReserveYen: companyReserveYen,
          rewardEligible: rewardExcludedReasons.length === 0,
          rewardExcludedReasons,
        };
      })
      .sort((a, b) => (rewardAmount(b) ?? 0) - (rewardAmount(a) ?? 0));

    return { ym, isCurrent: ym === yms[0], projects: projectsForMonth };
  });

  return {
    viewer,
    member,
    months,
    weeklyActivities,
    weekStart: week.startKey,
    weekEnd: week.endKey,
  };
}

function MyPageLoading() {
  return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">読み込み中...</div>;
}

export default function MyPage() {
  return (
    <Suspense fallback={<MyPageLoading />}>
      <MyPageContent />
    </Suspense>
  );
}

// 2026-05-25 #71 v3: dashboard 右側で `<MyPageContent />` を再利用するため export 化。
// mypage page.tsx 自体の Suspense 構造は変えない。
export function MyPageContent({
  embedded = false,
  showMonthlyProjects = true,
}: {
  embedded?: boolean;
  showMonthlyProjects?: boolean;
} = {}) {
  const searchParams = useSearchParams();
  const requestedMemberId = searchParams.get("memberId");
  const [data, setData] = useState<MyPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pageData = await loadMyPageData(requestedMemberId);
      setData(pageData);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [requestedMemberId]);

  useEffect(() => {
    load();
  }, [load]);

  const currentMonth = data?.months.find((m) => m.isCurrent);
  const rewardAmountHidden = !!data?.member.rewardAmountHidden;
  const currentTotal = useMemo(
    () => currentMonth?.projects.reduce((sum, p) => sum + payableRewardAmount(p), 0) || 0,
    [currentMonth]
  );
  const payoutNoticeNote = data?.member.payoutNoticeNote ?? null;
  // embedded (= /dashboard 右カラム) では min-h-screen だと埋込枠が画面いっぱいに伸びるため、
  // 読み込み中・エラー時は短い min-height に留める (2026-08-02 まさ追加監査反映)。
  if (loading) {
    if (embedded) {
      return (
        <div className="grid min-h-[160px] place-items-center text-sm text-muted-foreground">読み込み中...</div>
      );
    }
    return <MyPageLoading />;
  }

  if (error || !data) {
    return (
      <div className={`grid place-items-center bg-[#f5f5f7] px-4 ${embedded ? "min-h-[160px]" : "min-h-screen"}`}>
        <div className="bg-white border border-[#e5e5e7] rounded-xl p-5 max-w-sm text-center space-y-3">
          <p className="text-sm text-[#1d1d1f]">{error || "データ取得に失敗しました"}</p>
          <button onClick={load} className="text-sm text-[#007aff] font-medium">再読み込み</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${embedded ? "bg-[#f5f5f7] pb-4" : "min-h-screen bg-[#f5f5f7] pb-16"}`}>
      <div className="bg-white border-b border-[#e5e5e7] px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#86868b] uppercase">My Page</p>
          <h1 className="text-[20px] font-semibold text-[#1d1d1f] mt-1">{data.member.codeName}</h1>
          <p className="text-[13px] text-[#86868b] mt-0.5">{data.member.email}</p>
        </div>
      </div>

      <div className={`${embedded ? "px-3 mt-4" : "max-w-4xl mx-auto px-4 mt-6"} flex flex-col gap-5`}>
        {/* ホーム右カラム (embedded) では報酬と月初合意を畳んでおき、
            常に見えている一等地を「今週やったこと / 来週やること」に譲る。
            /mypage 単体では従来どおり開いたまま出す。 */}
        <CollapsibleOnHome collapsed={embedded} label="今月の報酬・業務合意">
        <section className="bg-white rounded-2xl border border-[#e5e5e7] p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[13px] text-[#86868b]">{formatYm(currentMonth?.ym || getCurrentYm())}</p>
              <p className="text-[13px] text-[#3c3c43] mt-1">当月報酬合計</p>
              {payoutNoticeNote && <p className="text-[11px] text-amber-700 mt-1">{payoutNoticeNote}</p>}
            </div>
            <p className="text-[28px] font-bold tabular-nums text-[#1d1d1f]">{formatRewardYen(currentTotal, rewardAmountHidden)}</p>
          </div>
          {(currentMonth?.projects.length || 0) > 0 && (
            <div className="mt-4 border-t border-[#e5e5e7] pt-3 space-y-1.5">
              {currentMonth?.projects.map((project) => {
                const amount = rewardAmount(project);
                if (amount == null || amount <= 0) return null;
                return (
                  <div key={project.projectId} className="flex items-center gap-3 text-[12px]">
                    <span className={`min-w-0 flex-1 truncate ${project.rewardEligible ? "text-[#3c3c43]" : "text-red-600 line-through decoration-2"}`}>
                      {project.projectName}
                    </span>
                    <span className={`tabular-nums ${project.rewardEligible ? "text-[#1d1d1f] font-semibold" : "text-red-600 line-through decoration-2"}`}>
                      {formatRewardYen(amount, rewardAmountHidden)}
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center gap-3 border-t border-dashed border-[#d1d1d6] pt-2 text-[13px] font-semibold">
                <span className="flex-1 text-[#1d1d1f]">合計</span>
                <span className="tabular-nums text-[#1d1d1f]">{formatRewardYen(currentTotal, rewardAmountHidden)}</span>
              </div>
            </div>
          )}
        </section>

        <MonthlyAgreementCard memberId={data.member.memberId} />
        </CollapsibleOnHome>

        <WeeklyTaskPlanner
          activities={data.weeklyActivities}
          weekStart={data.weekStart}
          weekEnd={data.weekEnd}
          memberId={data.member.memberId}
          editable={data.viewer.memberId === data.member.memberId}
          onRefreshed={() => {
            void load();
          }}
        />

        {showMonthlyProjects && data.months.map((month) => {
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
                <span className="ml-auto text-[14px] font-semibold tabular-nums text-[#1d1d1f]">{formatRewardYen(total, rewardAmountHidden)}</span>
                <span className="text-[#86868b] text-[12px]">{isExpanded ? "▲" : "▼"}</span>
              </button>

              {isExpanded && (
                <div className="space-y-3">
                  {month.projects.length === 0 ? (
                    <div className="bg-white rounded-xl border border-[#e5e5e7] p-4 text-[13px] text-[#86868b]">参加PJなし</div>
                  ) : (
                    month.projects.map((project) => (
                      <ProjectCard
                        key={`${month.ym}_${project.projectId}`}
                        project={project}
                        codeName={data.member.codeName}
                        rewardAmountHidden={rewardAmountHidden}
                        payoutNoticeNote={payoutNoticeNote}
                      />
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

/**
 * ホーム右カラムに埋め込むときだけ、中身を折り畳みに包む。
 * /mypage を単体で開いたときは何も包まずそのまま出す。
 */
function CollapsibleOnHome({ collapsed, label, children }: { collapsed: boolean; label: string; children: ReactNode }) {
  if (!collapsed) return <>{children}</>;
  return (
    <details className="group rounded-2xl border border-[#e5e5e7] bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13px] font-semibold text-[#1d1d1f] [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{label}</span>
        <span className="text-[11px] font-normal text-[#86868b] group-open:hidden">開く</span>
        <span className="hidden text-[11px] font-normal text-[#86868b] group-open:inline">閉じる</span>
      </summary>
      <div className="flex flex-col gap-5 border-t border-[#e5e5e7] px-4 py-4">{children}</div>
    </details>
  );
}

function MonthlyAgreementCard({ memberId }: { memberId: string }) {
  const [bundle, setBundle] = useState<MonthlyAgreementMiniBundle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const params = new URLSearchParams({ memberId });
        const res = await fetch(`/api/monthly-work-agreement?${params.toString()}`, { cache: "no-store" });
        const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; bundle?: MonthlyAgreementMiniBundle };
        if (!cancelled && res.ok && payload.ok !== false && payload.bundle) {
          setBundle(payload.bundle);
        }
      } catch {
        // /mypage の主表示はブロックしない
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  if (loading) {
    return (
      <section className="bg-white rounded-2xl border border-[#e5e5e7] p-4 shadow-sm">
        <p className="text-[13px] text-[#86868b]">月初合意を確認中...</p>
      </section>
    );
  }
  if (!bundle) return null;

  const statusText =
    bundle.status === "agreed"
      ? "合意済み"
      : bundle.status === "needs_reagreement"
        ? "条件更新あり"
        : bundle.status === "not_required"
          ? "対象外"
          : "未合意";
  const statusClass =
    bundle.status === "agreed"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : bundle.status === "needs_reagreement"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : bundle.status === "not_required"
          ? "bg-zinc-50 text-zinc-600 border-zinc-200"
          : "bg-sky-50 text-sky-800 border-sky-200";
  const isNotRequired = bundle.status === "not_required";
  return (
    <section className="bg-white rounded-2xl border border-[#e5e5e7] p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-semibold text-[#1d1d1f]">今月の遂行内容・予定報酬</h2>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}>{statusText}</span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[#86868b]">
            {isNotRequired
              ? bundle.snapshot.totals.projectCount > 0
                ? `${formatYm(bundle.ym)} / 確認用 ${bundle.snapshot.totals.projectCount} PJ / 予定 ${formatYen(bundle.snapshot.totals.expectedRewardYen)}`
                : `${formatYm(bundle.ym)} / 月初合意は不要`
              : `${formatYm(bundle.ym)} / ${bundle.snapshot.totals.projectCount} PJ / 予定 ${formatYen(bundle.snapshot.totals.expectedRewardYen)}`}
          </p>
          {bundle.status === "needs_reagreement" && (
            <p className="mt-1 text-[11px] text-amber-700">前回合意後に snapshot hash が変わっています。</p>
          )}
          {isNotRequired && (
            <p className="mt-1 text-[11px] text-zinc-500">{bundle.exclusionReason || "支払通知対象外メンバーのため、月初合意は不要です。"}</p>
          )}
        </div>
        <Link
          href={`/monthly-agreement?ym=${encodeURIComponent(bundle.ym)}&memberId=${encodeURIComponent(memberId)}`}
          className={`inline-flex shrink-0 items-center justify-center rounded-full px-4 py-2 text-[12px] font-semibold ${
            isNotRequired ? "border border-[#d2d2d7] text-[#424245]" : "bg-[#1d1d1f] text-white"
          }`}
        >
          {isNotRequired ? "詳細を見る" : "確認する"}
        </Link>
      </div>
    </section>
  );
}

function shiftWeekStart(weekStart: string, offset: number) {
  const date = dateFromJstKey(weekStart);
  date.setUTCDate(date.getUTCDate() + offset * 7);
  return dateKeyJST(date);
}

function weekEndFromStart(weekStart: string) {
  const date = dateFromJstKey(weekStart);
  date.setUTCDate(date.getUTCDate() + 6);
  return dateKeyJST(date);
}

function isActivityInWeek(activity: MyPageWeeklyActivity, weekStart: string) {
  if (!activity.itemDate) return false;
  const date = dateKeyJST(new Date(activity.itemDate));
  return date >= weekStart && date < shiftWeekStart(weekStart, 1);
}

function WeeklyTaskPlanner({
  activities,
  weekStart,
  weekEnd,
  memberId,
  editable,
  onRefreshed,
}: {
  activities: MyPageWeeklyActivity[];
  weekStart: string;
  weekEnd: string;
  memberId: string;
  editable: boolean;
  onRefreshed?: () => void;
}) {
  const nextWeekStart = useMemo(() => shiftWeekStart(weekStart, 1), [weekStart]);
  const previousWeekStart = useMemo(() => shiftWeekStart(weekStart, -1), [weekStart]);
  const twoWeeksAgoStart = useMemo(() => shiftWeekStart(weekStart, -2), [weekStart]);
  const weekStarts = useMemo(() => [nextWeekStart, weekStart, previousWeekStart, twoWeeksAgoStart], [nextWeekStart, previousWeekStart, twoWeeksAgoStart, weekStart]);
  const [tasks, setTasks] = useState<MemberWeeklyTask[]>([]);
  const [suggestions, setSuggestions] = useState<WeeklyTaskCandidate[]>([]);
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(() => new Set());
  const pendingTaskIdsRef = useRef<Set<string>>(new Set());
  const pendingCandidateKeysRef = useRef<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      if (editable) {
        const rollover = await fetch("/api/mypage/weekly-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rollover", weekStart }),
        });
        if (!rollover.ok) {
          const payload = (await rollover.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error || "未完了タスクの繰越に失敗しました");
        }
      }
      const params = new URLSearchParams({ memberId, weekStart: weekStarts.join(",") });
      const response = await fetch(`/api/mypage/weekly-tasks?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; tasks?: MemberWeeklyTask[]; suggestions?: WeeklyTaskCandidate[]; error?: string };
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "週次タスクを読み込めませんでした");
      const serverTasks = payload.tasks || [];
      setTasks((previous) => {
        const pendingTasks = previous.filter((task) => pendingTaskIdsRef.current.has(task.id));
        const pendingTaskIds = new Set(pendingTasks.map((task) => task.id));
        return [...serverTasks.filter((task) => !pendingTaskIds.has(task.id)), ...pendingTasks];
      });
      setSuggestions((payload.suggestions || []).filter((candidate) => !pendingCandidateKeysRef.current.has(candidate.candidateKey)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "週次タスクを読み込めませんでした");
    } finally {
      setLoading(false);
    }
  }, [editable, memberId, weekStart, weekStarts]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const writeTask = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/mypage/weekly-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; task?: MemberWeeklyTask; error?: string };
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "保存に失敗しました");
    return payload;
  };

  const startTaskRequest = (taskId: string) => {
    setPendingTaskIds((previous) => {
      const next = new Set(previous).add(taskId);
      pendingTaskIdsRef.current = next;
      return next;
    });
  };

  const finishTaskRequest = (taskId: string) => {
    setPendingTaskIds((previous) => {
      const next = new Set(previous);
      next.delete(taskId);
      pendingTaskIdsRef.current = next;
      return next;
    });
  };

  const addNextWeekTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;
    const taskId = `local:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const optimisticTask: MemberWeeklyTask = {
      id: taskId,
      memberId,
      projectId: null,
      weekStart: nextWeekStart,
      title,
      status: "open",
      completedAt: null,
      carriedFromTaskId: null,
      candidateKey: null,
      source: "manual",
    };
    setMessage(null);
    setNewTaskTitle("");
    setTasks((previous) => [...previous, optimisticTask]);
    startTaskRequest(taskId);
    void writeTask({ action: "create", weekStart: nextWeekStart, title })
      .then((payload) => {
        if (!payload.task) throw new Error("保存結果が不正です");
        setTasks((previous) => previous.map((task) => task.id === taskId ? payload.task! : task));
      })
      .catch((error) => {
        setTasks((previous) => previous.filter((task) => task.id !== taskId));
        setMessage(error instanceof Error ? error.message : "保存に失敗しました");
      })
      .finally(() => finishTaskRequest(taskId));
  };

  const setTaskStatus = (task: MemberWeeklyTask, status: "open" | "completed") => {
    if (!editable || task.status === status || pendingTaskIds.has(task.id)) return;
    const optimisticTask: MemberWeeklyTask = {
      ...task,
      status,
      completedAt: status === "completed" ? new Date().toISOString() : null,
    };
    setMessage(null);
    setTasks((previous) => previous.map((item) => item.id === task.id ? optimisticTask : item));
    startTaskRequest(task.id);
    void writeTask({ action: "set-status", taskId: task.id, status })
      .then((payload) => {
        if (!payload.task) throw new Error("保存結果が不正です");
        setTasks((previous) => previous.map((item) => item.id === task.id ? payload.task! : item));
      })
      .catch((error) => {
        setTasks((previous) => previous.map((item) => item.id === task.id ? task : item));
        setMessage(error instanceof Error ? error.message : "保存に失敗しました");
      })
      .finally(() => finishTaskRequest(task.id));
  };

  const acceptSuggestion = (candidate: WeeklyTaskCandidate) => {
    if (!editable) return;
    const taskId = `local:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const optimisticTask: MemberWeeklyTask = {
      id: taskId,
      memberId,
      projectId: candidate.projectId,
      weekStart: nextWeekStart,
      title: candidate.title,
      status: "open",
      completedAt: null,
      carriedFromTaskId: null,
      candidateKey: candidate.candidateKey,
      source: "action_item",
    };
    setMessage(null);
    setSuggestions((previous) => previous.filter((item) => item.candidateKey !== candidate.candidateKey));
    setTasks((previous) => [...previous, optimisticTask]);
    pendingCandidateKeysRef.current = new Set(pendingCandidateKeysRef.current).add(candidate.candidateKey);
    startTaskRequest(taskId);
    void writeTask({ action: "accept-candidate", weekStart: nextWeekStart, candidateKey: candidate.candidateKey })
      .then((payload) => {
        if (!payload.task) throw new Error("保存結果が不正です");
        setTasks((previous) => previous.map((task) => task.id === taskId ? payload.task! : task));
      })
      .catch((error) => {
        setTasks((previous) => previous.filter((task) => task.id !== taskId));
        setSuggestions((previous) => [candidate, ...previous]);
        setMessage(error instanceof Error ? error.message : "候補の追加に失敗しました");
      })
      .finally(() => {
        pendingCandidateKeysRef.current = new Set(pendingCandidateKeysRef.current);
        pendingCandidateKeysRef.current.delete(candidate.candidateKey);
        finishTaskRequest(taskId);
      });
  };

  const tasksFor = (targetWeekStart: string) =>
    tasks
      .filter((task) => task.weekStart === targetWeekStart)
      .sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed"));
  const activityFor = (targetWeekStart: string) => activities.filter((activity) => isActivityInWeek(activity, targetWeekStart));

  return (
    <>
      <section className="bg-white rounded-2xl border border-[#e5e5e7] p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#86868b]">Next Week</p>
            <h2 className="mt-0.5 text-[14px] font-semibold text-[#1d1d1f]">来週やること</h2>
          </div>
          <span className="pt-0.5 text-[11px] text-[#86868b] whitespace-nowrap">
            {formatDateJa(nextWeekStart)} - {formatDateJa(weekEndFromStart(nextWeekStart))}
          </span>
        </div>
        {message && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">{message}</p>}
        <WeeklyTaskRows tasks={tasksFor(nextWeekStart)} editable={editable} pendingTaskIds={pendingTaskIds} onStatusChange={setTaskStatus} emptyText="来週の予定はまだありません。" />
        {editable && (
          <div className="mt-3 border-t border-[#e5e5e7] pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[12px] font-semibold text-[#424245]">自動候補</p>
              <span className="text-[11px] text-[#86868b]">本人担当・確定済みの要対応</span>
            </div>
            {suggestions.length === 0 ? (
              <p className="mt-2 text-[12px] text-[#86868b]">来週期限の候補はありません。</p>
            ) : (
              <div className="mt-2 divide-y divide-[#e5e5e7] rounded-xl border border-[#e5e5e7] bg-[#fbfbfd]">
                {suggestions.map((candidate) => (
                  <div key={candidate.candidateKey} className="flex min-h-11 items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[#1d1d1f]">{candidate.title}</p>
                      <p className="mt-0.5 text-[11px] text-[#86868b]">{candidate.sourceLabel} · 期限 {formatDateJa(candidate.dueAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => acceptSuggestion(candidate)}
                      className="shrink-0 rounded-lg border border-[#007aff]/40 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#007aff] hover:bg-[#007aff]/10"
                    >
                      確認して追加
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {editable && (
          <form onSubmit={addNextWeekTask} className="mt-3 flex items-center gap-2 border-t border-[#e5e5e7] pt-3">
            <label className="sr-only" htmlFor="next-week-task">来週のタスク</label>
            <input
              id="next-week-task"
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              maxLength={240}
              placeholder="来週やることを追加"
              className="min-w-0 flex-1 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3 py-2 text-[13px] text-[#1d1d1f] placeholder:text-[#86868b] focus:border-[#007aff] focus:bg-white focus:outline-none"
            />
            <button type="submit" disabled={!newTaskTitle.trim()} className="min-h-10 shrink-0 rounded-xl bg-[#1d1d1f] px-3 text-[12px] font-semibold text-white disabled:opacity-45">
              追加
            </button>
          </form>
        )}
        {!editable && <p className="mt-3 text-[11px] text-[#86868b]">他メンバーの週次タスクは閲覧専用です。</p>}
      </section>

      <WeeklyActivitiesCard
        activities={activityFor(weekStart)}
        weekStart={weekStart}
        weekEnd={weekEnd}
        manualTasks={tasksFor(weekStart)}
        editable={editable}
        taskLoading={loading}
        pendingTaskIds={pendingTaskIds}
        onTaskStatusChange={setTaskStatus}
        onRefreshed={onRefreshed}
      />

      <details className="group rounded-2xl border border-[#e5e5e7] bg-white shadow-sm">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13px] font-semibold text-[#1d1d1f] [&::-webkit-details-marker]:hidden">
          <span className="text-[#86868b] transition-transform group-open:rotate-90">›</span>
          前週・前々週を表示
          <span className="ml-auto text-[11px] font-normal text-[#86868b]">未完了も履歴に残ります</span>
        </summary>
        <div className="space-y-4 border-t border-[#e5e5e7] px-4 py-3">
          {[previousWeekStart, twoWeeksAgoStart].map((pastWeekStart) => (
            <PastWeekSection key={pastWeekStart} weekStart={pastWeekStart} tasks={tasksFor(pastWeekStart)} activities={activityFor(pastWeekStart)} editable={editable} pendingTaskIds={pendingTaskIds} onStatusChange={setTaskStatus} />
          ))}
        </div>
      </details>
    </>
  );
}

function WeeklyTaskRows({
  tasks,
  editable,
  pendingTaskIds = new Set(),
  onStatusChange,
  emptyText,
}: {
  tasks: MemberWeeklyTask[];
  editable: boolean;
  pendingTaskIds?: ReadonlySet<string>;
  onStatusChange: (task: MemberWeeklyTask, status: "open" | "completed") => void;
  emptyText: string;
}) {
  if (tasks.length === 0) return <p className="mt-3 rounded-xl bg-[#f5f5f7] px-3 py-3 text-[13px] text-[#86868b]">{emptyText}</p>;
  return (
    <div className="mt-3 divide-y divide-[#e5e5e7] rounded-xl border border-[#e5e5e7] bg-[#fbfbfd]">
      {tasks.map((task) => {
        const complete = task.status === "completed";
        return (
          <label key={task.id} className={`flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 ${editable ? "hover:bg-white" : "cursor-default"}`}>
            <input
              type="checkbox"
              checked={complete}
              disabled={!editable || pendingTaskIds.has(task.id)}
              onChange={(event) => onStatusChange(task, event.target.checked ? "completed" : "open")}
              className="size-4 shrink-0 accent-[#007aff] disabled:cursor-not-allowed"
              aria-label={`${task.title}を${complete ? "未完了に戻す" : "完了にする"}`}
            />
            <span className={`min-w-0 flex-1 text-[13px] leading-snug ${complete ? "text-[#86868b] line-through" : "font-medium text-[#1d1d1f]"}`}>{task.title}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{complete ? "完了" : "未完了"}</span>
          </label>
        );
      })}
    </div>
  );
}

function PastWeekSection({
  weekStart,
  tasks,
  activities,
  editable,
  pendingTaskIds,
  onStatusChange,
}: {
  weekStart: string;
  tasks: MemberWeeklyTask[];
  activities: MyPageWeeklyActivity[];
  editable: boolean;
  pendingTaskIds: ReadonlySet<string>;
  onStatusChange: (task: MemberWeeklyTask, status: "open" | "completed") => void;
}) {
  const weekEnd = weekEndFromStart(weekStart);
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-[#1d1d1f]">{formatDateJa(weekStart)} - {formatDateJa(weekEnd)}</h3>
        <span className="text-[11px] text-[#86868b]">{tasks.filter((task) => task.status === "open").length}件未完了</span>
      </div>
      <WeeklyTaskRows tasks={tasks} editable={editable} pendingTaskIds={pendingTaskIds} onStatusChange={onStatusChange} emptyText="手動タスクはありません。" />
      <ActivityEvidenceRows activities={activities} emptyText="抽出済みの活動はありません。" compact />
    </section>
  );
}

function ActivityEvidenceRows({ activities, emptyText, compact = false }: { activities: MyPageWeeklyActivity[]; emptyText: string; compact?: boolean }) {
  if (activities.length === 0) return <p className="mt-2 text-[11px] text-[#86868b]">{emptyText}</p>;
  return (
    <div className={`mt-2 ${compact ? "space-y-1" : "space-y-2"}`}>
      {activities.slice(0, compact ? 6 : 8).map((activity) => (
        <div key={activity.id} className={compact ? "rounded-lg bg-[#f5f5f7] px-2.5 py-2" : "rounded-xl border border-[#e5e5e7] bg-[#fbfbfd] px-3 py-2.5"}>
          <div className="flex items-center gap-2">
            <SourceKindBadges sourceKinds={activity.sourceKinds} />
            <span className="min-w-0 truncate text-[11px] text-[#86868b]">{activity.projectName}</span>
            {activity.itemDate && <span className="ml-auto text-[10px] text-[#86868b] whitespace-nowrap">{formatDateJa(activity.itemDate)}</span>}
          </div>
          <p className="mt-1 text-[12px] font-medium leading-snug text-[#1d1d1f]"><LinkedMemberText text={activity.title} /></p>
        </div>
      ))}
      {activities.length > (compact ? 6 : 8) && <p className="px-1 text-[11px] text-[#86868b]">ほか {activities.length - (compact ? 6 : 8)} 件</p>}
    </div>
  );
}

function WeeklyActivitiesCard({
  activities,
  weekStart,
  weekEnd,
  manualTasks = [],
  editable = false,
  taskLoading = false,
  pendingTaskIds,
  onTaskStatusChange,
  onRefreshed,
}: {
  activities: MyPageWeeklyActivity[];
  weekStart: string;
  weekEnd: string;
  manualTasks?: MemberWeeklyTask[];
  editable?: boolean;
  taskLoading?: boolean;
  pendingTaskIds?: ReadonlySet<string>;
  onTaskStatusChange?: (task: MemberWeeklyTask, status: "open" | "completed") => void;
  onRefreshed?: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = await fetch("/api/mypage/weekly-activities/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || payload.ok === false) {
        const message = typeof payload.error === "string" ? payload.error : `抽出に失敗 (${res.status})`;
        setRefreshMessage({ tone: "error", text: message });
        return;
      }
      const saved =
        (typeof payload.sourceCacheEvidence === "number" ? payload.sourceCacheEvidence : 0) +
        (typeof payload.gmailEvidence === "number" ? payload.gmailEvidence : 0) +
        (typeof payload.calendarEvidence === "number" ? payload.calendarEvidence : 0);
      setRefreshMessage({
        tone: "success",
        text: `抽出完了 (Gmail/Calendar/source合計 ${saved} 件)`,
      });
      onRefreshed?.();
    } catch (err) {
      setRefreshMessage({ tone: "error", text: err instanceof Error ? err.message : "抽出エラー" });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-[#e5e5e7] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#86868b]">This Week</p>
          <h2 className="text-[14px] font-semibold text-[#1d1d1f] mt-0.5">今週やったこと</h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          {editable && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#007aff]/40 bg-[#007aff]/10 px-3 py-1 text-[11px] font-semibold text-[#007aff] hover:bg-[#007aff]/20 disabled:opacity-60"
              title="Gmail / Calendar / source_cache から今週分を即時再抽出"
            >
              {refreshing ? "抽出中..." : "⚡ いますぐ抽出"}
            </button>
          )}
          <span className="text-[11px] text-[#86868b] whitespace-nowrap">
            {formatDateJa(weekStart)} - {formatDateJa(weekEnd)}
          </span>
        </div>
      </div>

      {refreshMessage && (
        <div
          className={`mb-3 rounded-xl px-3 py-2 text-[12px] ${
            refreshMessage.tone === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {refreshMessage.text}
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-semibold text-[#424245]">今週のタスク</p>
          {taskLoading && <span className="text-[11px] text-[#86868b]">読み込み中...</span>}
        </div>
        <WeeklyTaskRows
          tasks={manualTasks}
          editable={editable}
          pendingTaskIds={pendingTaskIds}
          onStatusChange={onTaskStatusChange || (() => {})}
          emptyText="今週の手動タスクはありません。"
        />
      </div>

      <div className="border-t border-[#e5e5e7] pt-3">
        <p className="text-[12px] font-semibold text-[#424245]">自動抽出の活動</p>
        {activities.length === 0 ? (
          <div className="mt-3 rounded-xl bg-[#f5f5f7] px-3 py-3">
            <p className="text-[13px] text-[#86868b]">
              今週分のGmail/Calendar由来の活動はまだありません。週次抽出が走るとここに表示されます。
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {activities.slice(0, 8).map((activity) => (
              <div key={activity.id} className="rounded-xl border border-[#e5e5e7] bg-[#fbfbfd] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <SourceKindBadges sourceKinds={activity.sourceKinds} />
                  <span className="min-w-0 truncate text-[12px] text-[#86868b]">{activity.projectName}</span>
                  {activity.itemDate && (
                    <span className="ml-auto text-[11px] text-[#86868b] whitespace-nowrap">
                      {formatDateJa(activity.itemDate)}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[13px] font-semibold leading-snug text-[#1d1d1f]">
                  <LinkedMemberText text={activity.title} />
                </p>
                {activity.contentPreview && (
                  <p className="mt-1 text-[12px] leading-relaxed text-[#3c3c43] line-clamp-2">
                    <LinkedMemberText text={activity.contentPreview} />
                  </p>
                )}
              </div>
            ))}
            {activities.length > 8 && (
              <p className="text-[11px] text-[#86868b] px-1">ほか {activities.length - 8} 件</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ProjectCard({
  project,
  codeName,
  rewardAmountHidden,
  payoutNoticeNote,
}: {
  project: MyPageProject;
  codeName: string;
  rewardAmountHidden: boolean;
  payoutNoticeNote: string | null;
}) {
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
            {formatRewardYen(baseReward, rewardAmountHidden)}
          </p>
          <p className="text-[11px] text-[#86868b]">{project.billingStatus}</p>
          {payoutNoticeNote && <p className="text-[10px] text-amber-700">{payoutNoticeNote}</p>}
        </div>
      </div>

      <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${project.rewardEligible ? "bg-[#eef0ff]" : "bg-red-50"}`}>
        <span className="text-[12px]">✨</span>
        <span className={`text-[12px] ${project.rewardEligible ? "text-[#5b6070]" : "text-red-700"}`}>
          {project.rewardEligible ? "今月想定" : "確認保留中"}
        </span>
        <span className={`ml-auto text-[13px] font-semibold tabular-nums ${project.rewardEligible ? "text-[#4338ca]" : "text-red-700 line-through decoration-2"}`}>
          {rewardAmountHidden ? REWARD_AMOUNT_PLACEHOLDER : (
            <>
              {project.monthlyEarnedPt ? `${project.monthlyEarnedPt.toFixed(1)}pt · ` : ""}
              {baseReward != null ? formatYen(baseReward) : "未計算"}
            </>
          )}
        </span>
      </div>

      {!project.rewardEligible && project.rewardExcludedReasons.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-[12px] font-semibold text-red-700">admin確認により一時保留</p>
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
          {activityText && (
            <p className="text-[13px] text-[#3c3c43] whitespace-pre-wrap leading-relaxed">
              <LinkedMemberText text={activityText} />
            </p>
          )}
          {!activityText && (
            <div className="space-y-2">
              {project.milestones.filter((m) => m.narrative).map((m) => (
                <p key={m.milestoneKey} className="text-[13px] text-[#3c3c43] leading-relaxed">
                  <span className="font-semibold">{m.title}: </span>
                  <LinkedMemberText text={m.narrative} />
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
      <p className="text-[11px] text-[#86868b] leading-relaxed">
        <LinkedMemberText text={deltaSummary(ms)} />
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: AllocationStatus }) {
  if (status === "confirmed") return <p className="text-[11px] text-emerald-600 mt-0.5">● 確定</p>;
  if (status === "reported") return <p className="text-[11px] text-orange-600 mt-0.5">● 承認待ち</p>;
  return <p className="text-[11px] text-[#86868b] mt-0.5">○ 未設定</p>;
}
