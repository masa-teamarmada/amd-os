"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import {
  CompanyContentShelf,
  type CompanyHistoryPreview,
  type CompanyMediaMentionPreview,
  type CompanyMemberPreview,
  type CompanyPhotoPreview,
} from "@/components/dashboard/CompanyContentShelf";
import {
  DashboardScoreOverview,
  type DashboardActionItem,
  type DashboardManagementScoreSnapshot,
} from "@/components/dashboard/DashboardScoreOverview";
import { MyPageContent } from "@/app/(app)/mypage/page";
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
import { InstitutionReadinessList } from "@/components/dashboard/InstitutionReadinessList";
import { fetchErsBundle, type ErsBundle } from "@/lib/ers-data";
import { ProactiveQueuePanel } from "@/components/proactive/ProactiveQueuePanel";
import { isInstitutionDashboardProject } from "@/lib/institution-projects";

function getCurrentYm() {
  const now = new Date();
  return String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, "0");
}

function isDashboardProjectListItem(project: DashProject) {
  return !isInstitutionDashboardProject(project);
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<DashProject[]>([]);
  const [billingStatus, setBillingStatus] = useState<Record<string, DashBillingStatus>>({});
  const [actionItems, setActionItems] = useState<DashboardActionItem[]>([]);
  const [scoreHistory, setScoreHistory] = useState<Record<string, number[]>>({});
  const [signalMetrics, setSignalMetrics] = useState<Record<string, { m: number; x: number; f: number }>>({});
  const [managementScore, setManagementScore] = useState<DashboardManagementScoreSnapshot | null>(null);
  const [managementHistory, setManagementHistory] = useState<DashboardManagementScoreSnapshot[]>([]);
  const [myProjectIds, setMyProjectIds] = useState<Set<string>>(new Set());
  const [ersBundle, setErsBundle] = useState<ErsBundle | null>(null);
  const [companyContent, setCompanyContent] = useState<CompanyContentPreview>({
    members: [],
    history: [],
    photos: DASHBOARD_PHOTO_PREVIEW,
    mediaMentions: [],
  });
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
      fetchMyProjectIds(supabase),
      fetchErsBundle(),
      fetchCompanyContentPreview(supabase),
    ]).then(([projRes, billRes, scoreRes, mgmtRes, myProjRes, ersRes, companyRes]) => {
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

      if (myProjRes.status === "fulfilled") {
        setMyProjectIds(myProjRes.value);
      }

      if (ersRes.status === "fulfilled") {
        setErsBundle(ersRes.value);
      }

      if (companyRes.status === "fulfilled") {
        setCompanyContent(companyRes.value);
      }

      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const projectLabels = useMemo(() => {
    return Object.fromEntries(
      projects.map((project) => [
        project.projectId,
        project.shortLabel || project.displayName || project.projectName || project.projectId,
      ])
    );
  }, [projects]);
  const dashboardProjects = useMemo(() => projects.filter(isDashboardProjectListItem), [projects]);

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
    <div className="p-4 max-w-[1700px] mx-auto">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(520px,640px)] gap-4">
        <main className="space-y-4 min-w-0">
          <ProactiveQueuePanel projectLabels={projectLabels} variant="dashboard" limit={3} />
          <DashboardScoreOverview
            managementScore={managementScore}
            managementHistory={managementHistory}
            actionItems={actionItems}
          />
          <DashboardGrid
            projects={dashboardProjects}
            billingStatus={billingStatus}
            scoreHistory={scoreHistory}
            signalMetrics={signalMetrics}
            myProjectIds={myProjectIds}
          />
          <InstitutionReadinessList bundle={ersBundle} />
        </main>
        {/* /mypage の中身そっくり embed (= まさ #71 v3 確定、MyPageContent を再利用) */}
        <aside className="hidden xl:block min-w-0 border-l border-border/50 pl-4">
          <Suspense fallback={<div className="text-sm text-muted-foreground py-8 text-center">マイページ読み込み中…</div>}>
            <MyPageContent embedded showMonthlyProjects={false} />
          </Suspense>
        </aside>
        <div className="xl:col-span-2">
          <CompanyContentShelf
            members={companyContent.members}
            history={companyContent.history}
            photos={companyContent.photos}
            mediaMentions={companyContent.mediaMentions}
          />
        </div>
      </div>
    </div>
  );
}

interface CompanyContentPreview {
  members: CompanyMemberPreview[];
  history: CompanyHistoryPreview[];
  photos: CompanyPhotoPreview[];
  mediaMentions: CompanyMediaMentionPreview[];
}

const DASHBOARD_PHOTO_PREVIEW: CompanyPhotoPreview[] = [
  {
    id: "member-profile",
    title: "Member profile",
    meta: "Notion member photos / consent required",
    status: "unknown",
    imageUrl: null,
    kind: "photo",
  },
  {
    id: "project-scenes",
    title: "Project scenes",
    meta: "PJ / event tags before public use",
    status: "unknown",
    imageUrl: null,
    kind: "photo",
  },
  {
    id: "company-assets",
    title: "Company assets",
    meta: "Logo / deck / gallery candidates",
    status: "internal_ok",
    imageUrl: null,
    kind: "photo",
  },
];

interface CompanyMediaAssetRow {
  asset_id: unknown;
  title: unknown;
  asset_kind: unknown;
  captured_at?: unknown;
  usage_permission: unknown;
  consent_status: unknown;
  status?: unknown;
  storage_path: unknown;
  thumbnail_path: unknown;
  tags?: unknown;
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

async function fetchCompanyContentPreview(supabase: ReturnType<typeof createClient>): Promise<CompanyContentPreview> {
  const [
    membersRes,
    projectMembersRes,
    memberProfilesRes,
    companyHistoryRes,
    mediaAssetsRes,
    mediaReviewRes,
    eventsRes,
    venturesRes,
    mediaMentionsRes,
  ] = await Promise.all([
    supabase
      .from("members")
      .select("member_id,code_name,member_name,role,status,is_officer,join_ym,last_login_at")
      .eq("status", "active")
      .order("is_officer", { ascending: false })
      .order("join_ym", { ascending: true, nullsFirst: false })
      .order("code_name", { ascending: true })
      .limit(24),
    supabase
      .from("project_members")
      .select("member_id,project_id")
      .eq("is_active", true),
    supabase
      .from("member_profiles")
      .select("member_profile_id,member_id,display_name,full_name,public_title,internal_title,notion_status,joined_on,effort,bio_short,join_context,origin_label,residence_label,off_time_note,favorite_food,bucket_list,mbti_tags,visibility,status,photo_asset_id,media_assets:photo_asset_id(asset_id,storage_path,thumbnail_path)")
      .in("visibility", ["internal", "public_candidate"])
      .in("status", ["approved_internal", "approved_public"])
      .order("display_name", { ascending: true })
      .limit(80),
    supabase
      .from("company_history_events")
      .select("event_id,project_id,occurred_on,title,event_type,importance,visibility,status")
      .in("visibility", ["internal", "public_candidate"])
      .in("status", ["approved_internal", "approved_public"])
      .order("occurred_on", { ascending: false, nullsFirst: false })
      .limit(500),
    supabase
      .from("media_assets")
      .select("asset_id,title,asset_kind,captured_at,usage_permission,consent_status,project_ids,member_ids,visibility,status,storage_bucket,storage_path,thumbnail_path")
      .in("visibility", ["internal", "public_candidate"])
      .in("status", ["approved_internal", "approved_public"])
      .in("usage_permission", ["internal_ok", "public_ok"])
      .in("consent_status", ["granted", "not_needed"])
      .order("captured_at", { ascending: false, nullsFirst: false })
      .limit(6),
    supabase
      .from("media_assets")
      .select("asset_id,title,asset_kind,captured_at,usage_permission,consent_status,member_ids,visibility,status,storage_bucket,storage_path,thumbnail_path,tags")
      .in("asset_kind", ["photo", "video"])
      .eq("source_ref", "notion:team-armada-photo-db")
      .eq("visibility", "admin_only")
      .eq("status", "needs_review")
      .order("captured_at", { ascending: false, nullsFirst: false })
      .order("storage_path", { ascending: false, nullsFirst: false })
      .limit(500),
    supabase
      .from("project_events")
      .select("id,project_id,occurred_on,kind,label")
      .order("occurred_on", { ascending: false })
      .limit(10),
    supabase
      .from("project_ventures")
      .select("project_id,display_name,short_label,founded_at,amd_support_started_at")
      .order("amd_support_started_at", { ascending: false, nullsFirst: false })
      .limit(10),
    supabase
      .from("project_media_mentions")
      .select("id,project_id,occurred_on,title,media_name,kind,source_url,projects(project_name)")
      .eq("dismissed", false)
      .order("occurred_on", { ascending: false })
      .limit(200),
  ]);

  const projectCounts = new Map<string, number>();
  for (const row of projectMembersRes.data ?? []) {
    const memberId = String(row.member_id ?? "");
    if (!memberId) continue;
    projectCounts.set(memberId, (projectCounts.get(memberId) ?? 0) + 1);
  }

  const memberRows = membersRes.data ?? [];
  const membersById = new Map(memberRows.map((row) => [String(row.member_id), row]));
  const membersFromProfiles: CompanyMemberPreview[] = (memberProfilesRes.data ?? []).map((row) => {
    const memberId = row.member_id ? String(row.member_id) : null;
    const member = memberId ? membersById.get(memberId) : null;
    const photoAsset = oneRelation(row.media_assets);
    return {
      memberId,
      codeName: String(member?.code_name || row.display_name || "unresolved"),
      displayName: String(row.display_name || member?.code_name || member?.member_name || "Unresolved member"),
      fullName: row.full_name ? String(row.full_name) : null,
      role: row.public_title || row.internal_title ? String(row.public_title || row.internal_title) : null,
      status: String(row.notion_status || row.status || "approved_internal"),
      projectCount: memberId ? projectCounts.get(memberId) ?? 0 : 0,
      joinedOn: row.joined_on ? String(row.joined_on) : null,
      effort: row.effort == null ? null : Number(row.effort),
      bio: row.bio_short ? String(row.bio_short) : null,
      joinContext: row.join_context ? String(row.join_context) : null,
      originLabel: row.origin_label ? String(row.origin_label) : null,
      residenceLabel: row.residence_label ? String(row.residence_label) : null,
      offTimeNote: row.off_time_note ? String(row.off_time_note) : null,
      favoriteFood: row.favorite_food ? String(row.favorite_food) : null,
      bucketList: row.bucket_list ? String(row.bucket_list) : null,
      mbtiTags: Array.isArray(row.mbti_tags) ? row.mbti_tags.map(String) : [],
      imageUrl: photoAsset?.thumbnail_path || photoAsset?.storage_path ? `/api/company-media/file/${photoAsset.asset_id}` : null,
      lastLoginAt: member?.last_login_at ? String(member.last_login_at) : null,
    };
  }).sort(compareMembersByLastLogin);

  const membersFallback: CompanyMemberPreview[] = memberRows.map((row) => ({
    memberId: String(row.member_id),
    codeName: String(row.code_name || row.member_id),
    displayName: String(row.code_name || row.member_name || row.member_id),
    fullName: row.member_name ? String(row.member_name) : null,
    role: row.role ? String(row.role) : null,
    status: String(row.status || "active"),
    projectCount: projectCounts.get(String(row.member_id)) ?? 0,
    joinedOn: row.join_ym ? String(row.join_ym) : null,
    effort: null,
    bio: null,
    joinContext: null,
    originLabel: null,
    residenceLabel: null,
    offTimeNote: null,
    favoriteFood: null,
    bucketList: null,
    mbtiTags: [],
    imageUrl: null,
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
  })).sort(compareMembersByLastLogin);

  const historyFromCompany: CompanyHistoryPreview[] = (companyHistoryRes.data ?? []).map((row) => ({
    id: String(row.event_id),
    projectId: row.project_id ? String(row.project_id) : null,
    occurredOn: row.occurred_on ? String(row.occurred_on) : null,
    title: String(row.title || "History event"),
    kind: row.event_type ? String(row.event_type) : null,
  }));

  const historyFromEvents: CompanyHistoryPreview[] = (eventsRes.data ?? []).map((row) => ({
    id: String(row.id),
    projectId: row.project_id ? String(row.project_id) : null,
    occurredOn: row.occurred_on ? String(row.occurred_on) : null,
    title: String(row.label || row.kind || "History event"),
    kind: row.kind ? String(row.kind) : null,
  }));

  const historyFallback: CompanyHistoryPreview[] = (venturesRes.data ?? [])
    .map((row) => ({
      id: `venture-${row.project_id}`,
      projectId: row.project_id ? String(row.project_id) : null,
      occurredOn: row.amd_support_started_at || row.founded_at ? String(row.amd_support_started_at || row.founded_at) : null,
      title: String(row.display_name || row.short_label || row.project_id || "Project"),
      kind: row.amd_support_started_at ? "support_started" : "venture",
    }))
    .filter((row) => row.occurredOn);

  const mediaMentions: CompanyMediaMentionPreview[] = (mediaMentionsRes.data ?? []).map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    projectName: String((row.projects as { project_name?: string } | null)?.project_name ?? row.project_id),
    occurredOn: String(row.occurred_on),
    title: String(row.title),
    mediaName: String(row.media_name),
    kind: String(row.kind),
    sourceUrl: row.source_url ? String(row.source_url) : null,
  }));

  const photosFromAssets = groupCompanyPhotos(mediaAssetsRes.data ?? [], "approved");
  const photosInReview = groupCompanyPhotos(mediaReviewRes.data ?? [], "review");

  return {
    members: membersFromProfiles.length > 0 ? membersFromProfiles : membersFallback,
    history: historyFromCompany.length > 0 ? historyFromCompany : (historyFromEvents.length > 0 ? historyFromEvents : historyFallback),
    photos: photosFromAssets.length > 0 ? photosFromAssets : (photosInReview.length > 0 ? photosInReview : DASHBOARD_PHOTO_PREVIEW),
    mediaMentions,
  };
}

function photoStatusFromPermission(permission: string): CompanyPhotoPreview["status"] {
  if (permission === "public_ok") return "public_ok";
  if (permission === "internal_ok") return "internal_ok";
  return "unknown";
}

function groupCompanyPhotos(rows: CompanyMediaAssetRow[], mode: "approved" | "review"): CompanyPhotoPreview[] {
  const groups = new Map<string, { rows: CompanyMediaAssetRow[]; title: string }>();
  for (const row of rows) {
    const key = parentKeyFromStorage(row) || String(row.asset_id);
    const current = groups.get(key) ?? { rows: [], title: photoGroupTitle(row) };
    current.rows.push(row);
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(([key, group]) => {
    const sortedRows = group.rows.slice().sort(compareMediaRowsByDate);
    const taggedCover = sortedRows.find((row) => hasTag(row.tags, "company_photo_group_cover"));
    const cover = taggedCover ?? sortedRows.find((row) => row.thumbnail_path || row.storage_path) ?? sortedRows[0];
    const hasVideo = group.rows.some((row) => String(row.asset_kind || "") === "video");
    const permission = String(cover?.usage_permission || "unknown");
    const consent = String(cover?.consent_status || "unknown");
    const occurredOn = maxDateString(group.rows.map((row) => row.captured_at));
    const assets = sortedRows.map((row) => ({
      assetId: String(row.asset_id),
      title: String(row.title || group.title),
      imageUrl: row.thumbnail_path || row.storage_path ? `/api/company-media/file/${row.asset_id}` : null,
      kind: String(row.asset_kind || "photo"),
      capturedAt: row.captured_at ? String(row.captured_at) : null,
      isCover: String(row.asset_id) === String(cover?.asset_id),
    }));
    return {
      id: `photo-group-${key}`,
      title: group.title,
      meta: mode === "approved"
        ? [hasVideo ? "includes video" : null, `consent:${consent}`].filter(Boolean).join(" / ")
        : ["needs_review", `usage:${permission}`, `consent:${consent}`].join(" / "),
      status: mode === "approved" ? photoStatusFromPermission(permission) : "unknown",
      imageUrl: cover && (cover.thumbnail_path || cover.storage_path) ? `/api/company-media/file/${cover.asset_id}` : null,
      kind: String(cover?.asset_kind || "photo"),
      itemCount: group.rows.length,
      occurredOn,
      coverAssetId: cover?.asset_id ? String(cover.asset_id) : null,
      assets,
    };
  }).sort((a, b) => compareNullableDateDesc(a.occurredOn, b.occurredOn) || a.title.localeCompare(b.title, "ja"));
}

function parentKeyFromStorage(row: CompanyMediaAssetRow) {
  const path = String(row.storage_path || row.thumbnail_path || "");
  const parts = path.split("/");
  return parts.length >= 3 ? parts[1] : null;
}

function photoGroupTitle(row: CompanyMediaAssetRow) {
  return String(row.title || "Photo review")
    .replace(/^(Photo|Video|Media) review: /, "")
    .replace(/ #\d+$/, "");
}

function compareMembersByLastLogin(a: CompanyMemberPreview, b: CompanyMemberPreview) {
  return compareNullableDateDesc(a.lastLoginAt, b.lastLoginAt) || a.codeName.localeCompare(b.codeName, "ja");
}

function compareMediaRowsByDate(a: CompanyMediaAssetRow, b: CompanyMediaAssetRow) {
  return compareNullableDateDesc(a.captured_at ? String(a.captured_at) : null, b.captured_at ? String(b.captured_at) : null)
    || String(a.title || "").localeCompare(String(b.title || ""), "ja");
}

function compareNullableDateDesc(a: string | null | undefined, b: string | null | undefined) {
  const at = a ? Date.parse(a) : NaN;
  const bt = b ? Date.parse(b) : NaN;
  const av = Number.isFinite(at) ? at : -Infinity;
  const bv = Number.isFinite(bt) ? bt : -Infinity;
  return bv - av;
}

function maxDateString(values: unknown[]) {
  let best: string | null = null;
  let bestTime = -Infinity;
  for (const value of values) {
    if (!value) continue;
    const text = String(value);
    const time = Date.parse(text);
    if (Number.isFinite(time) && time > bestTime) {
      best = text;
      bestTime = time;
    }
  }
  return best;
}

function hasTag(value: unknown, tag: string) {
  return Array.isArray(value) && value.map(String).includes(tag);
}

/** 自分が参画してる active PJ id Set (= ProjectStripe ソート優先用、軽量 fetch) */
async function fetchMyProjectIds(supabase: ReturnType<typeof createClient>): Promise<Set<string>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email?.toLowerCase() || "";
    if (!email) return new Set();
    const { data: member } = await supabase.from("members").select("member_id").eq("email", email).maybeSingle();
    if (!member?.member_id) return new Set();
    const { data: pmRows } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("member_id", member.member_id)
      .eq("is_active", true);
    return new Set((pmRows ?? []).map((r) => String(r.project_id)));
  } catch {
    return new Set();
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

function oneRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
