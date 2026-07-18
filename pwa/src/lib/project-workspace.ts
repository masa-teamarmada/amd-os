import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getProjectWorkspaceSession } from "@/lib/project-workspace-session";
import { getSxManagementBundle, type SxManagementBundle } from "@/lib/sx-management";
import {
  EFFORT_CATEGORIES,
  type EffortCategory,
  type OsAccessScope,
  type ProjectNavItem,
} from "@/lib/project-workspace-types";

export type { EffortCategory, OsAccessScope, ProjectNavItem } from "@/lib/project-workspace-types";
export type { SxManagementBundle } from "@/lib/sx-management";

export type CurrentMemberAccess = {
  memberId: string;
  codeName: string;
  email: string;
  isAdmin: boolean;
  scope: OsAccessScope;
  calendarStatus: string;
  projects: ProjectNavItem[];
};

export type ProjectWorkspaceBundle = {
  project: {
    projectId: string;
    projectName: string;
    clientName: string | null;
    status: string;
  };
  currentWeekStart: string;
  currentMonth: string;
  memberCount: number;
  evidenceCount: number;
  effort: {
    plannedHours: number;
    actualHours: number;
    categories: Record<EffortCategory, number>;
    hasEntries: boolean;
    links: Array<{
      track: string | null;
      milestoneId: string | null;
      milestoneTitle: string | null;
      deliverableLabel: string | null;
      plannedHours: number;
      actualHours: number;
    }>;
  };
  members: Array<{
    memberId: string;
    codeName: string;
    roleLabel: string | null;
    isLead: boolean;
    evidenceCount: number;
    lastActivityAt: string | null;
    plannedHours: number;
    actualHours: number;
    categories: Record<EffortCategory, number>;
  }>;
  milestones: Array<{
    milestoneId: string;
    title: string;
    progressPct: number;
    progressYm: string | null;
    targetYm: string | null;
  }>;
  evidenceByMonth: Array<{ ym: string; count: number }>;
  evidenceBySource: Array<{ source: string; count: number }>;
  weeklyTrend: Array<{ weekStart: string; plannedHours: number; actualHours: number }>;
  sxManagement: SxManagementBundle;
};

export const getCurrentMemberAccess = cache(async (): Promise<CurrentMemberAccess | null> => {
  const db = createAdminClient();
  const projectSession = await getProjectWorkspaceSession();
  let authenticatedEmail: string | null = null;
  let projectSessionMemberId: string | null = null;

  if (projectSession) {
    authenticatedEmail = projectSession.email;
    projectSessionMemberId = projectSession.memberId;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authenticatedEmail = user?.email?.toLowerCase() || null;
  }
  if (!authenticatedEmail) return null;

  const { data: member, error: memberError } = await db
    .from("members")
    .select("member_id,code_name,email,is_admin,status,os_access_scope,google_calendar_status")
    .ilike("email", authenticatedEmail)
    .maybeSingle();

  if (memberError) throw new Error(`members access lookup: ${memberError.message}`);
  if (!member || member.status !== "active") return null;
  if (projectSessionMemberId && (
    member.member_id !== projectSessionMemberId
    || member.os_access_scope !== "project"
  )) return null;

  const { data: membershipRows, error: membershipError } = await db
    .from("project_members")
    .select("project_id")
    .eq("member_id", member.member_id)
    .eq("is_active", true);
  if (membershipError) throw new Error(`project membership lookup: ${membershipError.message}`);

  const projectIds = Array.from(
    new Set((membershipRows ?? []).map((row) => String(row.project_id)).filter(Boolean)),
  );
  let projects: ProjectNavItem[] = [];
  if (projectIds.length > 0) {
    const { data: projectRows, error: projectError } = await db
      .from("projects")
      .select("project_id,project_name")
      .in("project_id", projectIds)
      .order("project_name");
    if (projectError) throw new Error(`project navigation lookup: ${projectError.message}`);
    projects = (projectRows ?? []).map((row) => ({
      projectId: String(row.project_id),
      projectName: String(row.project_name),
    }));
  }

  return {
    memberId: String(member.member_id),
    codeName: String(member.code_name),
    email: String(member.email).toLowerCase(),
    isAdmin: Boolean(member.is_admin),
    scope: member.os_access_scope === "project" ? "project" : "portfolio",
    calendarStatus: String(member.google_calendar_status || "missing"),
    projects,
  };
});

export function memberHome(access: CurrentMemberAccess) {
  if (access.scope === "portfolio") return "/dashboard";
  if (access.projects.length === 1) {
    return `/project/${encodeURIComponent(access.projects[0].projectId)}/workspace`;
  }
  return "/my-projects";
}

export function canAccessWorkspaceProject(access: CurrentMemberAccess, projectId: string) {
  return access.scope === "portfolio" || access.isAdmin || access.projects.some((project) => project.projectId === projectId);
}

export function projectScopedPathAllowed(access: CurrentMemberAccess, pathname: string) {
  if (access.scope !== "project") return true;
  if (pathname === "/my-projects") return true;
  const match = pathname.match(/^\/project\/([^/]+)\/workspace\/?$/);
  if (!match) return false;
  return access.projects.some((project) => project.projectId === decodeURIComponent(match[1]));
}

function emptyCategories(): Record<EffortCategory, number> {
  return { basic: 0, applied: 0, development: 0, su: 0, coordination: 0 };
}

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

function addHours(target: Record<EffortCategory, number>, category: unknown, value: unknown) {
  const key = String(category) as EffortCategory;
  if (!EFFORT_CATEGORIES.some((item) => item.key === key)) return;
  const hours = Number(value || 0);
  if (Number.isFinite(hours)) target[key] = roundHours(target[key] + hours);
}

function jstDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

export function currentJstWeekStart(now = new Date()) {
  const { year, month, day } = jstDateParts(now);
  const localDate = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday);
  return localDate.toISOString().slice(0, 10);
}

function currentJstYm(now = new Date()) {
  const { year, month } = jstDateParts(now);
  return `${year}${String(month).padStart(2, "0")}`;
}

function recentMonthKeys(count: number, now = new Date()) {
  const { year, month } = jstDateParts(now);
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }).reverse();
}

function recentWeekStarts(count: number, now = new Date()) {
  const current = new Date(`${currentJstWeekStart(now)}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(current);
    date.setUTCDate(current.getUTCDate() - (count - offset - 1) * 7);
    return date.toISOString().slice(0, 10);
  });
}

export async function getProjectWorkspaceBundle(
  projectId: string,
  access: CurrentMemberAccess,
): Promise<ProjectWorkspaceBundle | null> {
  if (!canAccessWorkspaceProject(access, projectId)) return null;

  const db = createAdminClient();
  const now = new Date();
  const currentWeekStart = currentJstWeekStart(now);
  const currentMonth = currentJstYm(now);
  const months = recentMonthKeys(6, now);
  const weeks = recentWeekStarts(8, now);

  const [{ data: project, error: projectError }, { data: membershipRows, error: memberError }, { data: activityRows, error: activityError }, { data: effortRows, error: effortError }, { data: planCycleRows, error: planError }] = await Promise.all([
    db.from("projects").select("project_id,project_name,client_name,status").eq("project_id", projectId).maybeSingle(),
    db.from("project_members").select("member_id,role_label,is_pm,is_pl,is_closer").eq("project_id", projectId).eq("is_active", true),
    db.from("member_activities").select("member_id,ym,source,item_date").eq("project_id", projectId).gte("ym", months[0]).limit(5000),
    db.from("project_weekly_effort_entries").select("member_id,week_start,work_category,planned_hours,actual_hours,management_track,management_milestone_id,deliverable_label").eq("project_id", projectId).gte("week_start", weeks[0]).limit(5000),
    db.from("value_plan_cycles").select("plan_cycle_id,status,period_start_ym,period_end_ym").eq("project_id", projectId).order("created_at", { ascending: false }).limit(20),
  ]);

  if (projectError) throw new Error(`project workspace project: ${projectError.message}`);
  if (!project) return null;
  if (memberError) throw new Error(`project workspace members: ${memberError.message}`);
  if (activityError) throw new Error(`project workspace activities: ${activityError.message}`);
  if (effortError) throw new Error(`project workspace effort: ${effortError.message}`);
  if (planError) throw new Error(`project workspace plan: ${planError.message}`);

  const sxManagement = await getSxManagementBundle(
    projectId,
    access.scope === "portfolio" || access.isAdmin,
  );

  const memberIds = Array.from(new Set((membershipRows ?? []).map((row) => String(row.member_id))));
  let memberNameRows: Array<{ member_id: string; code_name: string }> = [];
  if (memberIds.length > 0) {
    const { data, error } = await db.from("members").select("member_id,code_name").in("member_id", memberIds);
    if (error) throw new Error(`project workspace member labels: ${error.message}`);
    memberNameRows = (data ?? []).map((row) => ({ member_id: String(row.member_id), code_name: String(row.code_name) }));
  }
  const memberNames = new Map(memberNameRows.map((row) => [row.member_id, row.code_name]));

  const currentEffortRows = (effortRows ?? []).filter((row) => String(row.week_start) === currentWeekStart);
  const totalCategories = emptyCategories();
  let totalPlanned = 0;
  let totalActual = 0;
  const effortLinkMap = new Map<string, { track: string | null; milestoneId: string | null; deliverableLabel: string | null; plannedHours: number; actualHours: number }>();
  for (const row of currentEffortRows) {
    totalPlanned += Number(row.planned_hours || 0);
    totalActual += Number(row.actual_hours || 0);
    addHours(totalCategories, row.work_category, row.actual_hours);
    const track = row.management_track ? String(row.management_track) : null;
    const milestoneId = row.management_milestone_id ? String(row.management_milestone_id) : null;
    const deliverableLabel = row.deliverable_label ? String(row.deliverable_label) : null;
    const linkKey = `${track || "未接続"}:${milestoneId || ""}:${deliverableLabel || ""}`;
    const existing = effortLinkMap.get(linkKey) || { track, milestoneId, deliverableLabel, plannedHours: 0, actualHours: 0 };
    existing.plannedHours = roundHours(existing.plannedHours + Number(row.planned_hours || 0));
    existing.actualHours = roundHours(existing.actualHours + Number(row.actual_hours || 0));
    effortLinkMap.set(linkKey, existing);
  }

  const members = (membershipRows ?? []).map((membership) => {
    const memberId = String(membership.member_id);
    const memberEffortRows = currentEffortRows.filter((row) => String(row.member_id) === memberId);
    const memberActivityRows = (activityRows ?? []).filter((row) => String(row.member_id || "") === memberId);
    const categories = emptyCategories();
    let plannedHours = 0;
    let actualHours = 0;
    for (const row of memberEffortRows) {
      plannedHours += Number(row.planned_hours || 0);
      actualHours += Number(row.actual_hours || 0);
      addHours(categories, row.work_category, row.actual_hours);
    }
    const lastActivityAt = memberActivityRows
      .map((row) => (row.item_date ? String(row.item_date) : null))
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
    return {
      memberId,
      codeName: memberNames.get(memberId) || memberId,
      roleLabel: membership.role_label ? String(membership.role_label) : null,
      isLead: Boolean(membership.is_pm || membership.is_pl || membership.is_closer),
      evidenceCount: memberActivityRows.length,
      lastActivityAt,
      plannedHours: roundHours(plannedHours),
      actualHours: roundHours(actualHours),
      categories,
    };
  }).sort((a, b) => Number(b.isLead) - Number(a.isLead) || a.codeName.localeCompare(b.codeName, "ja"));

  const currentPlan = (planCycleRows ?? []).find((row) => row.status === "active") ?? (planCycleRows ?? [])[0] ?? null;
  let milestones: ProjectWorkspaceBundle["milestones"] = [];
  if (currentPlan?.plan_cycle_id) {
    const { data: milestoneRows, error: milestoneError } = await db
      .from("value_milestones")
      .select("milestone_id,title,target_ym,sort_order,is_active")
      .eq("plan_cycle_id", currentPlan.plan_cycle_id)
      .eq("is_active", true)
      .order("sort_order")
      .limit(40);
    if (milestoneError) throw new Error(`project workspace milestones: ${milestoneError.message}`);
    const milestoneIds = (milestoneRows ?? []).map((row) => String(row.milestone_id));
    let progressRows: Array<{ milestone_key: string; ym: string; progress_pct: number }> = [];
    if (milestoneIds.length > 0) {
      const { data, error } = await db
        .from("milestone_monthly_progress")
        .select("milestone_key,ym,progress_pct")
        .in("milestone_key", milestoneIds)
        .order("ym", { ascending: false });
      if (error) throw new Error(`project workspace progress: ${error.message}`);
      progressRows = (data ?? []).map((row) => ({
        milestone_key: String(row.milestone_key),
        ym: String(row.ym),
        progress_pct: Number(row.progress_pct || 0),
      }));
    }
    milestones = (milestoneRows ?? []).slice(0, 8).map((row) => {
      const progress = progressRows.find((item) => item.milestone_key === String(row.milestone_id));
      return {
        milestoneId: String(row.milestone_id),
        title: String(row.title),
        progressPct: Math.max(0, Math.min(100, Number(progress?.progress_pct || 0))),
        progressYm: progress?.ym ?? null,
        targetYm: row.target_ym ? String(row.target_ym) : null,
      };
    });
  }

  const evidenceByMonth = months.map((ym) => ({
    ym,
    count: (activityRows ?? []).filter((row) => String(row.ym) === ym).length,
  }));
  const sourceCounts = new Map<string, number>();
  for (const row of activityRows ?? []) {
    const source = String(row.source || "unknown");
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
  }
  const evidenceBySource = Array.from(sourceCounts, ([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
  const weeklyTrend = weeks.map((weekStart) => {
    const rows = (effortRows ?? []).filter((row) => String(row.week_start) === weekStart);
    return {
      weekStart,
      plannedHours: roundHours(rows.reduce((sum, row) => sum + Number(row.planned_hours || 0), 0)),
      actualHours: roundHours(rows.reduce((sum, row) => sum + Number(row.actual_hours || 0), 0)),
    };
  });

  return {
    project: {
      projectId: String(project.project_id),
      projectName: String(project.project_name),
      clientName: project.client_name ? String(project.client_name) : null,
      status: String(project.status),
    },
    currentWeekStart,
    currentMonth,
    memberCount: members.length,
    evidenceCount: (activityRows ?? []).length,
    effort: {
      plannedHours: roundHours(totalPlanned),
      actualHours: roundHours(totalActual),
      categories: totalCategories,
      hasEntries: currentEffortRows.length > 0,
      links: Array.from(effortLinkMap.values()).map((link) => {
        const milestone = link.milestoneId ? sxManagement.milestones.find((item) => item.id === link.milestoneId) : null;
        return {
          ...link,
          milestoneTitle: milestone?.title || null,
          deliverableLabel: link.deliverableLabel || milestone?.nextDeliverable || null,
        };
      }),
    },
    members,
    milestones,
    evidenceByMonth,
    evidenceBySource,
    weeklyTrend,
    sxManagement,
  };
}
