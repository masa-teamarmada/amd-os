import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
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
  displayName: string;
  email: string;
  isAdmin: boolean;
  scope: OsAccessScope;
  calendarStatus: string;
  projects: ProjectNavItem[];
};

// Minimal structural shape needed by canAccessWorkspaceProject/getProjectWorkspaceBundle.
// CurrentMemberAccess and the external SharedWorkspaceAccess union (defined in
// project-shared-workspace-access.ts, which imports FROM this file) are both structurally
// compatible with this — kept here, not imported, to avoid a circular import.
export type WorkspaceProjectAccess = {
  scope: OsAccessScope;
  isAdmin: boolean;
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
    calendarHours: number;
    enteredHours: number;
    tallyDevelopmentHours: number;
    tallyMeetingHours: number;
    tallyTotalHours: number;
    tallySyncedAt: string | null;
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
    displayName: string;
    roleLabel: string | null;
    isLead: boolean;
    evidenceCount: number;
    lastActivityAt: string | null;
    plannedHours: number;
    actualHours: number;
    calendarHours: number;
    enteredHours: number;
    categories: Record<EffortCategory, number>;
  }>;
  milestones: Array<{
    milestoneId: string;
    title: string;
    progressPct: number;
    progressYm: string | null;
    targetYm: string | null;
    progressSource: string | null;
    progressConfirmedAt: string | null;
    progressRecordedAt: string | null;
  }>;
  themes: Array<{
    themeKey: string;
    label: string;
    shortLabel: string;
    accent: string;
    sortOrder: number;
    /** 契約上の価値マイルストーン(9件)。まさの現行UIが依存する既存フィールド、意味・進捗は不変。 */
    milestones: Array<{
      milestoneId: string;
      title: string;
      progressPct: number;
      progressYm: string | null;
      targetYm: string | null;
      progressSource: string | null;
      progressConfirmedAt: string | null;
      progressRecordedAt: string | null;
    }>;
    /** テーマの目的/現状/次の焦点。project_theme_profiles(authenticated限定)。未登録ならnull。 */
    profile: {
      purposeMd: string | null;
      currentStateMd: string | null;
      nextFocusNote: string | null;
      updatedAt: string;
      version: number;
    } | null;
    /** 運用マイルストーン(track一致、契約上の価値MSとは別枠)。sxManagement.milestonesの部分集合。 */
    operationalMilestoneIds: string[];
    /** 運用タスク(track一致、または運用MS配下)。sxManagement.tasksの部分集合。 */
    taskIds: string[];
    /** 課題(track一致)。sxManagement.issuesの部分集合。 */
    issueIds: string[];
    /** テーマへ紐付けたMTG(project_theme_meetings経由)。既存project_meeting_summariesそのもの。
     * linkId/linkVersionはproject_theme_meetings側の行(紐付け解除のexpected_version用)。
     * meetingUpdatedAtはproject_meeting_summaries.updated_at(この表に独自versionは無く、
     * 会議編集の楽観排他はこのタイムスタンプをexpected_updated_atとして送り返す)。 */
    meetings: Array<{
      meetingId: string;
      title: string;
      meetingDate: string;
      prepDraftMd: string | null;
      prepStatus: string | null;
      summaryShort: string;
      meetingUpdatedAt: string;
      linkId: string;
      linkVersion: number;
    }>;
    /** テーマへ紐付けた書類(project_theme_documents経由)。安全なDTOのみ(storage_path/external_urlは含まない)。
     * linkId/linkVersionはproject_theme_documents側の行(紐付け解除のexpected_version用)。 */
    documents: Array<{
      documentId: string;
      displayName: string;
      entryKind: string;
      mimeType: string;
      linkId: string;
      linkVersion: number;
    }>;
    /** ファイル未着手の予定成果物。project_theme_deliverables。 */
    deliverables: Array<{
      id: string;
      title: string;
      descriptionMd: string | null;
      ownerMemberId: string | null;
      dueOn: string | null;
      status: string;
      linkedDocumentId: string | null;
      version: number;
    }>;
    /** MTG/書類 <-> 課題/タスク/決定/マイルストーンの型付き関連。project_theme_work_links。 */
    workLinks: Array<{
      id: string;
      fromKind: string;
      fromId: string;
      toKind: string;
      toId: string;
      relation: string;
      version: number;
    }>;
  }>;
  /** PJの全MTG(62件相当)。既存レコードピッカー用。project_meeting_summariesそのもの、本文は含まない。 */
  allMeetings: Array<{ meetingId: string; title: string; meetingDate: string }>;
  evidenceByMonth: Array<{ ym: string; count: number }>;
  evidenceBySource: Array<{ source: string; count: number; lastObservedAt: string | null; scope: "member" | "project" }>;
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
    .select("member_id,code_name,member_name,email,is_admin,status,os_access_scope,google_calendar_status")
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
    displayName: String(member.member_name || member.code_name || "氏名未登録"),
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

export function canAccessWorkspaceProject(access: WorkspaceProjectAccess, projectId: string) {
  return access.scope === "portfolio" || access.isAdmin || access.projects.some((project) => project.projectId === projectId);
}

export function projectScopedPathAllowed(access: CurrentMemberAccess, pathname: string) {
  if (access.scope !== "project") return true;
  if (pathname === "/my-projects") return true;
  const match = pathname.match(/^\/project\/([^/]+)\/(?:workspace(?:\/files)?|weekly-control|navigation)\/?$/);
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

const getWorkspaceIdentityCached = unstable_cache(
  async (projectId: string) => {
    const db = createAdminClient();
    const [{ data: project, error: projectError }, { data: membershipRows, error: memberError }] =
      await Promise.all([
        db.from("projects").select("project_id,project_name,client_name,status").eq("project_id", projectId).maybeSingle(),
        db.from("project_members").select("member_id,role_label,is_pm,is_pl,is_closer").eq("project_id", projectId).eq("is_active", true),
      ]);
    if (projectError) throw new Error(`project workspace project: ${projectError.message}`);
    if (memberError) throw new Error(`project workspace members: ${memberError.message}`);
    if (!project) return null;

    const memberIds = Array.from(new Set((membershipRows ?? []).map((row) => String(row.member_id))));
    let memberNames: Array<{ member_id: string; member_name: string | null }> = [];
    if (memberIds.length > 0) {
      const { data, error } = await db.from("members").select("member_id,member_name").in("member_id", memberIds);
      if (error) throw new Error(`project workspace member labels: ${error.message}`);
      memberNames = (data ?? []).map((row) => ({
        member_id: String(row.member_id),
        member_name: row.member_name ? String(row.member_name) : null,
      }));
    }
    return { project, membershipRows: membershipRows ?? [], memberNames };
  },
  ["project-workspace-identity-v1"],
  // Project labels and active membership change far less often than gantt or
  // weekly-control data. A short shared cache removes three round trips on
  // repeat reloads while access itself is still checked fresh before this call.
  { revalidate: 60 },
);

// PostgREST's actual configured max_rows is 1000 — a query's own .limit(N>1000) does not raise
// that ceiling, it silently returns at most 1000 rows anyway. .limit(5000) on a theme-bridge/
// meeting-history query is therefore not "a generous bound", it is a truncation that never
// surfaces as an error (root review, UI completion phase). This loops real .range() pages with a
// caller-supplied stable order until a short page proves there is no more data, so complete
// history (all MTGs/documents/links, not just the newest ~1000) is always returned.
async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

export async function getProjectWorkspaceBundle(
  projectId: string,
  access: WorkspaceProjectAccess,
): Promise<ProjectWorkspaceBundle | null> {
  if (!canAccessWorkspaceProject(access, projectId)) return null;

  const db = createAdminClient();
  const now = new Date();
  const currentWeekStart = currentJstWeekStart(now);
  const currentMonth = currentJstYm(now);
  const months = recentMonthKeys(6, now);
  const weeks = recentWeekStarts(8, now);
  const sixMonthStartIso = `${months[0].slice(0, 4)}-${months[0].slice(4, 6)}-01T00:00:00+09:00`;

  // Management used to start only after all six workspace summary queries had
  // completed. It is the largest projection on this route, so that serialized
  // waterfall made a reload pay both costs. Start it in the same fan-out and
  // make the response wait only for the slowest branch.
  const canManage = access.scope === "portfolio" || access.isAdmin;
  const [
    identity,
    { data: activityRows, error: activityError },
    { data: effortRows, error: effortError },
    { data: tallyRows, error: tallyError },
    { data: planCycleRows, error: planError },
    { data: sourceCacheRows, error: sourceCacheError },
    { data: trackRows, error: trackError },
    { data: vmRows, error: vmError },
    sxManagement,
    themeProfileRows,
    themeMeetingRows,
    themeDocumentRows,
    themeDeliverableRows,
    themeWorkLinkRows,
    meetingRows,
  ] = await Promise.all([
    getWorkspaceIdentityCached(projectId),
    db.from("member_activities").select("member_id,ym,source,item_date,raw_metadata").eq("project_id", projectId).gte("ym", months[0]).limit(5000),
    db.from("project_weekly_effort_entries").select("member_id,week_start,work_category,planned_hours,actual_hours,source_kind,management_track,management_milestone_id,deliverable_label").eq("project_id", projectId).gte("week_start", weeks[0]).limit(5000),
    db.from("tally_weekly_effort_entries").select("week_start,development_hours,meeting_hours,synced_at").eq("project_id", projectId).eq("member_id", "ID001").gte("week_start", weeks[0]).limit(100),
    db.from("value_plan_cycles").select("plan_cycle_id,status,period_start_ym,period_end_ym").eq("project_id", projectId).order("created_at", { ascending: false }).limit(20),
    db.from("source_cache").select("source,item_id,item_date").eq("project_id", projectId).gte("item_date", sixMonthStartIso).in("source", ["slack", "drive"]).limit(5000),
    db.from("project_management_tracks").select("track_key,label,short_label,accent,sort_order").eq("project_id", projectId).order("sort_order"),
    db.from("project_management_track_value_milestones").select("milestone_id,track_key,sort_order").eq("project_id", projectId).order("sort_order").limit(40),
    getSxManagementBundle(projectId, canManage),
    // テーマ作業ハブ(migration 20260831120000)。低頻度参照ではなく編集対象の可変系データなので、
    // sxManagementと同じ都度取得のfan-outへ乗せる(参照系キャッシュの対象外)。
    // Real range-loop pagination (fetchAllRows), not a raw .limit(): PostgREST's own configured
    // max_rows is 1000, so a bare .limit(5000) silently truncates at 1000 with no error signal at
    // all — root review (UI completion phase) caught this. A secondary `id`/`track_key` tiebreaker
    // is added to every order() so ties within one page cannot appear twice or be silently
    // dropped across a page boundary just because two rows share the same primary sort value (a
    // due_on-only order, for example, is not unique enough on its own for range pagination). This
    // is ordinary bounded-list paging, not a database snapshot: a row inserted or deleted by a
    // concurrent write while this loop is mid-flight can still shift which page an unrelated row
    // lands on, the same as any other non-snapshotted paged read — that is an accepted, normal
    // limitation here, not something this stable order claims to solve.
    fetchAllRows((from, to) =>
      db.from("project_theme_profiles").select("track_key,purpose_md,current_state_md,next_focus_note,updated_at,version").eq("project_id", projectId).is("deleted_at", null).order("track_key", { ascending: true }).range(from, to),
    ),
    fetchAllRows((from, to) =>
      db.from("project_theme_meetings").select("id,track_key,meeting_id,version").eq("project_id", projectId).is("deleted_at", null).order("id", { ascending: true }).range(from, to),
    ),
    fetchAllRows((from, to) =>
      db.from("project_theme_documents").select("id,track_key,document_id,version").eq("project_id", projectId).is("deleted_at", null).order("id", { ascending: true }).range(from, to),
    ),
    fetchAllRows((from, to) =>
      db.from("project_theme_deliverables").select("id,track_key,title,description_md,owner_member_id,due_on,status,linked_document_id,version").eq("project_id", projectId).is("deleted_at", null).order("due_on", { ascending: true, nullsFirst: false }).order("id", { ascending: true }).range(from, to),
    ),
    fetchAllRows((from, to) =>
      db.from("project_theme_work_links").select("id,track_key,from_kind,from_id,to_kind,to_id,relation,version").eq("project_id", projectId).is("deleted_at", null).order("id", { ascending: true }).range(from, to),
    ),
    // 全MTG(既存レコードピッカー用 + テーマ紐付けの解決先)。本文(narrative_md/decided等)は
    // 含めない。root review: "meetingRows limit500 can hide linked older MTGs" — a 500/5000 bound
    // of any size is the same bug in a different disguise, so this is a real range loop too, with
    // meeting_id as the tiebreaker under meeting_date (dates repeat across meetings).
    fetchAllRows((from, to) =>
      db.from("project_meeting_summaries").select("meeting_id,title,meeting_date,prep_draft_md,prep_status,summary_short,updated_at").eq("project_id", projectId).order("meeting_date", { ascending: false }).order("meeting_id", { ascending: true }).range(from, to),
    ),
  ]);

  if (!identity) return null;
  if (activityError) throw new Error(`project workspace activities: ${activityError.message}`);
  if (effortError) throw new Error(`project workspace effort: ${effortError.message}`);
  if (tallyError) throw new Error(`project workspace tally effort: ${tallyError.message}`);
  if (planError) throw new Error(`project workspace plan: ${planError.message}`);
  if (sourceCacheError) throw new Error(`project workspace source cache: ${sourceCacheError.message}`);
  if (trackError) throw new Error(`project workspace tracks: ${trackError.message}`);
  if (vmError) throw new Error(`project workspace track milestones: ${vmError.message}`);

  const meetingById = new Map(
    (meetingRows ?? []).map((row) => [String(row.meeting_id), {
      meetingId: String(row.meeting_id),
      title: String(row.title),
      meetingDate: String(row.meeting_date),
      prepDraftMd: row.prep_draft_md ? String(row.prep_draft_md) : null,
      prepStatus: row.prep_status ? String(row.prep_status) : null,
      summaryShort: String(row.summary_short || ""),
      meetingUpdatedAt: String(row.updated_at),
    }]),
  );
  const linkedDocumentIds = Array.from(new Set((themeDocumentRows ?? []).map((row) => String(row.document_id))));
  let documentById = new Map<string, { documentId: string; displayName: string; entryKind: string; mimeType: string }>();
  if (linkedDocumentIds.length > 0) {
    // Deliberately hand-picked safe columns only (no storage_path/external_url) — this mirrors
    // publicWorkspaceDocument()'s allowlist in workspace-documents-server.ts without importing a
    // route-facing helper into a server-only data-assembly module (workspace-document-access.ts
    // imports getCurrentMemberAccess FROM this file, so importing it back here would be
    // circular). project_id + upload_status='active' are NOT optional here even though the
    // composite FK already guarantees the (project_id, document_id) pair was valid at link time —
    // a document later archived (or, in theory, a stale cross-PJ id) must not silently keep
    // rendering as a usable, current document. Associating a document with a theme is also not a
    // sharing grant: visibility/scope_kind on the row itself are untouched here.
    const { data: docRows, error: docError } = await db
      .from("workspace_documents")
      .select("document_id,display_name,entry_kind,mime_type")
      .eq("project_id", projectId)
      .eq("upload_status", "active")
      .in("document_id", linkedDocumentIds);
    if (docError) throw new Error(`project workspace theme documents lookup: ${docError.message}`);
    documentById = new Map((docRows ?? []).map((row) => [String(row.document_id), {
      documentId: String(row.document_id),
      displayName: String(row.display_name),
      entryKind: String(row.entry_kind),
      mimeType: String(row.mime_type),
    }]));
  }

  const { project, membershipRows, memberNames: memberNameRows } = identity;
  const memberDisplayNames = new Map(
    memberNameRows.map((row) => [row.member_id, row.member_name || "氏名未登録"]),
  );

  const currentEffortRows = (effortRows ?? []).filter((row) => String(row.week_start) === currentWeekStart);
  const totalCategories = emptyCategories();
  let totalPlanned = 0;
  let totalActual = 0;
  let totalCalendarHours = 0;
  let totalEnteredHours = 0;
  const currentTallyRows = (tallyRows ?? []).filter((row) => String(row.week_start) === currentWeekStart);
  const tallyDevelopmentHours = currentTallyRows.reduce((sum, row) => sum + Number(row.development_hours || 0), 0);
  const tallyMeetingHours = currentTallyRows.reduce((sum, row) => sum + Number(row.meeting_hours || 0), 0);
  const tallySyncedAt = currentTallyRows.map((row) => row.synced_at ? String(row.synced_at) : null).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const effortLinkMap = new Map<string, { track: string | null; milestoneId: string | null; deliverableLabel: string | null; plannedHours: number; actualHours: number }>();
  for (const row of currentEffortRows) {
    totalPlanned += Number(row.planned_hours || 0);
    totalActual += Number(row.actual_hours || 0);
    if (String(row.source_kind || "") === "inferred") {
      totalCalendarHours += Number(row.actual_hours || 0);
    } else {
      totalEnteredHours += Number(row.actual_hours || 0);
    }
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
    let calendarHours = 0;
    let enteredHours = 0;
    for (const row of memberEffortRows) {
      plannedHours += Number(row.planned_hours || 0);
      actualHours += Number(row.actual_hours || 0);
      if (String(row.source_kind || "") === "inferred") {
        calendarHours += Number(row.actual_hours || 0);
      } else {
        enteredHours += Number(row.actual_hours || 0);
      }
      addHours(categories, row.work_category, row.actual_hours);
    }
    const lastActivityAt = memberActivityRows
      .map((row) => (row.item_date ? String(row.item_date) : null))
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
    return {
      memberId,
      displayName: memberDisplayNames.get(memberId) || "氏名未登録",
      roleLabel: membership.role_label ? String(membership.role_label) : null,
      isLead: Boolean(membership.is_pm || membership.is_pl || membership.is_closer),
      evidenceCount: memberActivityRows.length,
      lastActivityAt,
      plannedHours: roundHours(plannedHours),
      actualHours: roundHours(actualHours),
      calendarHours: roundHours(calendarHours),
      enteredHours: roundHours(enteredHours),
      categories,
    };
  }).sort((a, b) => Number(b.isLead) - Number(a.isLead) || a.displayName.localeCompare(b.displayName, "ja"));

  const currentPlan = (planCycleRows ?? []).find((row) => row.status === "active") ?? (planCycleRows ?? [])[0] ?? null;
  let milestones: ProjectWorkspaceBundle["milestones"] = [];
  const financialMilestonesByTrack = new Map<string, ProjectWorkspaceBundle["milestones"]>();

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
    let progressRows: Array<{ milestone_key: string; ym: string; progress_pct: number; source: string | null; confirmed_at: string | null; created_at: string | null }> = [];
    if (milestoneIds.length > 0) {
      const { data, error } = await db
        .from("milestone_monthly_progress")
        .select("milestone_key,ym,progress_pct,source,confirmed_at,created_at")
        .in("milestone_key", milestoneIds)
        .order("ym", { ascending: false });
      if (error) throw new Error(`project workspace progress: ${error.message}`);
      progressRows = (data ?? []).map((row) => ({
        milestone_key: String(row.milestone_key),
        ym: String(row.ym),
        progress_pct: Number(row.progress_pct || 0),
        source: row.source ? String(row.source) : null,
        confirmed_at: row.confirmed_at ? String(row.confirmed_at) : null,
        created_at: row.created_at ? String(row.created_at) : null,
      }));
    }

    milestones = (milestoneRows ?? []).map((row) => {
      const progress = progressRows.find((item) => item.milestone_key === String(row.milestone_id));
      return {
        milestoneId: String(row.milestone_id),
        title: String(row.title),
        progressPct: Math.max(0, Math.min(100, Number(progress?.progress_pct || 0))),
        progressYm: progress?.ym ?? null,
        targetYm: row.target_ym ? String(row.target_ym) : null,
        progressSource: progress?.source ?? null,
        progressConfirmedAt: progress?.confirmed_at ?? null,
        progressRecordedAt: progress?.created_at ?? null,
      };
    });

    const milestoneById = new Map(milestones.map((m) => [m.milestoneId, m]));
    for (const vm of vmRows ?? []) {
      const trackKey = vm.track_key ? String(vm.track_key) : null;
      const milestone = trackKey ? milestoneById.get(String(vm.milestone_id)) : undefined;
      if (!trackKey || !milestone) continue;
      const list = financialMilestonesByTrack.get(trackKey) ?? [];
      list.push(milestone);
      financialMilestonesByTrack.set(trackKey, list);
    }
  }

  // テーマ本体は project_management_tracks が正 — 価値計画が無い/未確定でも(brief「A valid
  // empty theme must appear」)、常に4テーマ(またはPJごとの定義済みテーマ)を組み立てる。
  const operationalMilestoneIdsByTrack = new Map<string, string[]>();
  for (const m of sxManagement.milestones) {
    const list = operationalMilestoneIdsByTrack.get(m.track) ?? [];
    list.push(m.id);
    operationalMilestoneIdsByTrack.set(m.track, list);
  }
  const taskIdsByTrack = new Map<string, string[]>();
  const milestoneTrackById = new Map(sxManagement.milestones.map((m) => [m.id, m.track]));
  for (const t of sxManagement.tasks) {
    const trackKey = t.track ?? (t.milestoneId ? milestoneTrackById.get(t.milestoneId) : null) ?? null;
    if (!trackKey) continue;
    const list = taskIdsByTrack.get(trackKey) ?? [];
    list.push(t.id);
    taskIdsByTrack.set(trackKey, list);
  }
  const issueIdsByTrack = new Map<string, string[]>();
  for (const issue of sxManagement.issues) {
    const list = issueIdsByTrack.get(issue.track) ?? [];
    list.push(issue.id);
    issueIdsByTrack.set(issue.track, list);
  }
  const profileByTrack = new Map(
    (themeProfileRows ?? []).map((row) => [String(row.track_key), {
      purposeMd: row.purpose_md ? String(row.purpose_md) : null,
      currentStateMd: row.current_state_md ? String(row.current_state_md) : null,
      nextFocusNote: row.next_focus_note ? String(row.next_focus_note) : null,
      updatedAt: String(row.updated_at),
      version: Number(row.version || 1),
    }]),
  );
  // meeting/document -> theme membership, both directions. meetingThemesByMeetingId feeds the
  // work-links cross-theme rendering fix below (a meeting/document can legitimately belong to
  // more than one theme; a work_link touching it must be visible in all of them, not only the
  // one the link row happened to be created under).
  const meetingThemesByMeetingId = new Map<string, Set<string>>();
  const meetingsByTrack = new Map<string, ProjectWorkspaceBundle["themes"][number]["meetings"]>();
  for (const row of themeMeetingRows ?? []) {
    const trackKey = String(row.track_key);
    const meetingId = String(row.meeting_id);
    const meeting = meetingById.get(meetingId);
    if (!meeting) continue;
    const list = meetingsByTrack.get(trackKey) ?? [];
    list.push({
      ...meeting,
      linkId: String(row.id),
      linkVersion: Number(row.version || 1),
    });
    meetingsByTrack.set(trackKey, list);
    const themeSet = meetingThemesByMeetingId.get(meetingId) ?? new Set<string>();
    themeSet.add(trackKey);
    meetingThemesByMeetingId.set(meetingId, themeSet);
  }
  const documentThemesByDocumentId = new Map<string, Set<string>>();
  const documentsByTrack = new Map<string, ProjectWorkspaceBundle["themes"][number]["documents"]>();
  for (const row of themeDocumentRows ?? []) {
    const trackKey = String(row.track_key);
    const documentId = String(row.document_id);
    const doc = documentById.get(documentId);
    if (!doc) continue;
    const list = documentsByTrack.get(trackKey) ?? [];
    list.push({
      ...doc,
      linkId: String(row.id),
      linkVersion: Number(row.version || 1),
    });
    documentsByTrack.set(trackKey, list);
    const themeSet = documentThemesByDocumentId.get(documentId) ?? new Set<string>();
    themeSet.add(trackKey);
    documentThemesByDocumentId.set(documentId, themeSet);
  }
  const deliverablesByTrack = new Map<string, ProjectWorkspaceBundle["themes"][number]["deliverables"]>();
  for (const row of themeDeliverableRows ?? []) {
    const trackKey = String(row.track_key);
    const list = deliverablesByTrack.get(trackKey) ?? [];
    list.push({
      id: String(row.id),
      title: String(row.title),
      descriptionMd: row.description_md ? String(row.description_md) : null,
      ownerMemberId: row.owner_member_id ? String(row.owner_member_id) : null,
      dueOn: row.due_on ? String(row.due_on) : null,
      status: String(row.status),
      linkedDocumentId: row.linked_document_id ? String(row.linked_document_id) : null,
      version: Number(row.version || 1),
    });
    deliverablesByTrack.set(trackKey, list);
  }
  // project_theme_work_links' natural UNIQUE deliberately excludes track_key (project-theme-hub.ts
  // createWorkLink's doc comment): a link is a canonical fact about its two endpoints, not a
  // per-theme record, so the SAME link must render under every theme either endpoint actually
  // belongs to — not only the track_key the row happened to be created under. issue/task/
  // milestone/decision each have (at most) one owning track; meeting/document can legitimately
  // belong to several (their own theme-bridge tables, above); deliverable belongs to exactly the
  // theme it was created under.
  const decisionTrackById = new Map(sxManagement.decisions.map((d) => [d.id, d.track]));
  const deliverableTrackById = new Map((themeDeliverableRows ?? []).map((row) => [String(row.id), String(row.track_key)]));
  function themesForEndpoint(kind: string, id: string): Set<string> {
    switch (kind) {
      case "meeting": return meetingThemesByMeetingId.get(id) ?? new Set();
      case "document": return documentThemesByDocumentId.get(id) ?? new Set();
      case "issue": { const t = issueIdsByTrack; for (const [track, ids] of t) if (ids.includes(id)) return new Set([track]); return new Set(); }
      case "task": { const t = taskIdsByTrack; for (const [track, ids] of t) if (ids.includes(id)) return new Set([track]); return new Set(); }
      case "milestone": { const t = operationalMilestoneIdsByTrack; for (const [track, ids] of t) if (ids.includes(id)) return new Set([track]); return new Set(); }
      case "decision": { const track = decisionTrackById.get(id); return track ? new Set([track]) : new Set(); }
      case "deliverable": { const track = deliverableTrackById.get(id); return track ? new Set([track]) : new Set(); }
      default: return new Set();
    }
  }
  const workLinksByTrack = new Map<string, ProjectWorkspaceBundle["themes"][number]["workLinks"]>();
  for (const row of themeWorkLinkRows ?? []) {
    const entry = {
      id: String(row.id),
      fromKind: String(row.from_kind),
      fromId: String(row.from_id),
      toKind: String(row.to_kind),
      toId: String(row.to_id),
      relation: String(row.relation),
      version: Number(row.version || 1),
    };
    const memberTracks = new Set([
      ...themesForEndpoint(entry.fromKind, entry.fromId),
      ...themesForEndpoint(entry.toKind, entry.toId),
    ]);
    // Neither endpoint resolved to a known theme (e.g. a decision with no linked issue) — fall
    // back to the row's own provenance track_key so the link is not silently dropped entirely.
    if (memberTracks.size === 0) memberTracks.add(String(row.track_key));
    for (const trackKey of memberTracks) {
      const list = workLinksByTrack.get(trackKey) ?? [];
      list.push(entry);
      workLinksByTrack.set(trackKey, list);
    }
  }

  const themes: ProjectWorkspaceBundle["themes"] = (trackRows ?? [])
    .map((track) => {
      const trackKey = String(track.track_key);
      return {
        themeKey: trackKey,
        label: String(track.label || ""),
        shortLabel: String(track.short_label || ""),
        accent: String(track.accent || ""),
        sortOrder: Number(track.sort_order || 0),
        milestones: financialMilestonesByTrack.get(trackKey) ?? [],
        profile: profileByTrack.get(trackKey) ?? null,
        operationalMilestoneIds: operationalMilestoneIdsByTrack.get(trackKey) ?? [],
        taskIds: taskIdsByTrack.get(trackKey) ?? [],
        issueIds: issueIdsByTrack.get(trackKey) ?? [],
        meetings: meetingsByTrack.get(trackKey) ?? [],
        documents: documentsByTrack.get(trackKey) ?? [],
        deliverables: deliverablesByTrack.get(trackKey) ?? [],
        workLinks: workLinksByTrack.get(trackKey) ?? [],
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const allMeetings: ProjectWorkspaceBundle["allMeetings"] = Array.from(meetingById.values())
    .map((m) => ({ meetingId: m.meetingId, title: m.title, meetingDate: m.meetingDate }))
    .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));

  const evidenceByMonth = months.map((ym) => ({
    ym,
    count: (activityRows ?? []).filter((row) => String(row.ym) === ym).length,
  }));
  const MEMBER_EVIDENCE_SOURCE_KINDS = new Set(["gmail", "calendar", "meeting_summary", "notion"]);
  const memberEvidenceIdsBySource = new Map<string, Set<string>>();
  const memberLastObservedBySource = new Map<string, string>();
  for (const row of activityRows ?? []) {
    const refs = (row as { raw_metadata?: { evidence_refs?: Array<{ source_kind?: string | null; evidence_id?: string | null }> | null } | null }).raw_metadata?.evidence_refs ?? [];
    const itemDate = row.item_date ? String(row.item_date) : null;
    for (const ref of refs) {
      const sourceKind = ref?.source_kind ? String(ref.source_kind) : "";
      if (!MEMBER_EVIDENCE_SOURCE_KINDS.has(sourceKind)) continue;
      const evidenceId = ref?.evidence_id ? String(ref.evidence_id) : null;
      if (!evidenceId) continue;
      const idSet = memberEvidenceIdsBySource.get(sourceKind) ?? new Set<string>();
      idSet.add(evidenceId);
      memberEvidenceIdsBySource.set(sourceKind, idSet);
      if (itemDate) {
        const currentLast = memberLastObservedBySource.get(sourceKind);
        if (!currentLast || itemDate > currentLast) {
          memberLastObservedBySource.set(sourceKind, itemDate);
        }
      }
    }
  }

  const PROJECT_EVIDENCE_SOURCES = new Set(["slack", "drive"]);
  const projectEvidenceIdsBySource = new Map<string, Set<string>>();
  const projectLastObservedBySource = new Map<string, string>();
  for (const row of sourceCacheRows ?? []) {
    const source = row.source ? String(row.source) : "";
    if (!PROJECT_EVIDENCE_SOURCES.has(source)) continue;
    const itemId = row.item_id ? String(row.item_id) : null;
    if (!itemId) continue;
    const idSet = projectEvidenceIdsBySource.get(source) ?? new Set<string>();
    idSet.add(itemId);
    projectEvidenceIdsBySource.set(source, idSet);
    const itemDate = row.item_date ? String(row.item_date) : null;
    if (itemDate) {
      const currentLast = projectLastObservedBySource.get(source);
      if (!currentLast || itemDate > currentLast) {
        projectLastObservedBySource.set(source, itemDate);
      }
    }
  }

  const evidenceBySource: ProjectWorkspaceBundle["evidenceBySource"] = [
    ...Array.from(memberEvidenceIdsBySource, ([source, ids]) => ({
      source,
      count: ids.size,
      lastObservedAt: memberLastObservedBySource.get(source) ?? null,
      scope: "member" as const,
    })),
    ...Array.from(projectEvidenceIdsBySource, ([source, ids]) => ({
      source,
      count: ids.size,
      lastObservedAt: projectLastObservedBySource.get(source) ?? null,
      scope: "project" as const,
    })),
  ].sort((a, b) => b.count - a.count);
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
      calendarHours: roundHours(totalCalendarHours),
      enteredHours: roundHours(totalEnteredHours),
      tallyDevelopmentHours: roundHours(tallyDevelopmentHours),
      tallyMeetingHours: roundHours(tallyMeetingHours),
      tallyTotalHours: roundHours(tallyDevelopmentHours + tallyMeetingHours),
      tallySyncedAt,
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
    themes,
    allMeetings,
    evidenceByMonth,
    evidenceBySource,
    weeklyTrend,
    sxManagement,
  };
}
