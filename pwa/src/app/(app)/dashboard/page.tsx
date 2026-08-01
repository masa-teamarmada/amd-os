"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import type {
  CompanyHistoryPreview,
  CompanyImageCrop,
  CompanyMediaMentionPreview,
  CompanyMemberPreview,
  CompanyPhotoPreview,
} from "@/components/dashboard/CompanyContentShelf";
import {
  DashboardScoreOverview,
  type DashboardManagementScoreSnapshot,
} from "@/components/dashboard/DashboardScoreOverview";
import type { DashboardPrimarySnapshot } from "@/components/dashboard/DashboardGrid";
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
  buildPrimaryScoreSnapshot,
  buildAaaScoreInputsFromSx,
  isScoreInputScorable,
  latestVisibleScorableScoreInput,
} from "@/lib/amd-score-derived";
import { AAA_PROJECT_ID } from "@/lib/demo-aaa-data";
import { ActionItemsPanel } from "@/components/governance/ActionItemsPanel";
import { FundingStatsCard } from "@/components/dashboard/FundingStatsCard";
import { ProactiveTodoBadge } from "@/components/proactive-todo/ProactiveTodoBadge";
import { ExtractionStatusCard } from "@/components/dashboard/ExtractionStatusCard";
import { FreeeConnectionStatusCard } from "@/components/dashboard/FreeeConnectionStatusCard";

const MyPageContent = dynamic(
  () => import("@/app/(app)/mypage/page").then((mod) => mod.MyPageContent),
  {
    ssr: false,
    loading: () => (
      <div className="text-sm text-muted-foreground py-8 text-center">マイページ読み込み中…</div>
    ),
  },
);

const CompanyContentShelf = dynamic(
  () => import("@/components/dashboard/CompanyContentShelf").then((mod) => mod.CompanyContentShelf),
  {
    ssr: false,
    loading: () => (
      <div className="text-sm text-muted-foreground py-8 text-center">会社コンテンツ読み込み中…</div>
    ),
  },
);

function getCurrentYm() {
  const now = new Date();
  return String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, "0");
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<DashProject[]>([]);
  const [billingStatus, setBillingStatus] = useState<Record<string, DashBillingStatus>>({});
  const [scoreHistory, setScoreHistory] = useState<Record<string, number[]>>({});
  const [primarySnapshots, setPrimarySnapshots] = useState<Record<string, DashboardPrimarySnapshot>>({});
  const [managementScore, setManagementScore] = useState<DashboardManagementScoreSnapshot | null>(null);
  const [managementHistory, setManagementHistory] = useState<DashboardManagementScoreSnapshot[]>([]);
  const [myProjectIds, setMyProjectIds] = useState<Set<string>>(new Set());
  const [projectLoadFailed, setProjectLoadFailed] = useState(false);
  const [companyContent, setCompanyContent] = useState<CompanyContentPreview | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const companyAnchorRef = useRef<HTMLDivElement | null>(null);
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
        const primary: Record<string, DashboardPrimarySnapshot> = {};
        for (const [projectId, rows] of Object.entries(grouped)) {
          const visibleRows = visibleScoreInputs(rows);
          history[projectId] = visibleRows
            .filter(isScoreInputScorable)
            .flatMap((row) => {
              const snapshot = buildPrimaryScoreSnapshot(row, activeAlpha.alpha, { P: null, R_net: null }, visibleRows);
              return snapshot.prs.status === "ready" && snapshot.prs.score != null ? [snapshot.prs.score] : [];
            });
          const latest = latestVisibleScorableScoreInput(rows);
          if (latest) {
            const latestSnapshot = buildPrimaryScoreSnapshot(latest, activeAlpha.alpha, { P: null, R_net: null }, visibleRows);
            primary[projectId] = {
              score: latestSnapshot.prs.status === "ready" ? latestSnapshot.prs.score : null,
              status: latestSnapshot.prs.status,
              missingAxes: latestSnapshot.prs.status === "ready" ? [] : latestSnapshot.prs.missingAxes,
              legacyScore: latestSnapshot.legacy.score,
              components: {
                macro: latestSnapshot.prs.components?.macro ?? null,
                potential: latestSnapshot.prs.axisValues.P,
                reach: latestSnapshot.prs.components?.reach ?? null,
                survival: latestSnapshot.prs.components?.survival ?? null,
              },
            };
          }
        }
        return { history, primary };
      }),
      fetchManagementScoreHistory(supabase),
      fetchMyProjectIds(supabase),
    ]).then(([projRes, billRes, scoreRes, mgmtRes, myProjRes]) => {
      const projectsValue = projRes.status === "fulfilled" ? projRes.value : [];
      const billingValue = billRes.status === "fulfilled" ? billRes.value : {};
      setProjects(projectsValue);
      setProjectLoadFailed(projRes.status === "rejected");
      setBillingStatus(billingValue);

      if (scoreRes.status === "fulfilled") {
        setScoreHistory(scoreRes.value.history);
        setPrimarySnapshots(scoreRes.value.primary);
      }

      if (mgmtRes.status === "fulfilled") {
        setManagementHistory(mgmtRes.value);
        setManagementScore(mgmtRes.value[mgmtRes.value.length - 1] ?? null);
      }

      if (myProjRes.status === "fulfilled") {
        setMyProjectIds(myProjRes.value);
      }

      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const node = companyAnchorRef.current;
    if (!node || companyContent || companyLoading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setCompanyLoading(true);
        fetchCompanyContentPreview(createClient())
          .then((value) => setCompanyContent(value))
          .catch(() => setCompanyContent({ members: [], history: [], photos: DASHBOARD_PHOTO_PREVIEW, mediaMentions: [] }))
          .finally(() => setCompanyLoading(false));
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, companyContent, companyLoading]);

  const projectLabels = useMemo(() => {
    return Object.fromEntries(
      projects.map((project) => [
        project.projectId,
        project.projectName || project.projectId,
      ])
    );
  }, [projects]);
  const dashboardProjects = useMemo(
    () => projects.filter((project) => project.projectId !== "p00"),
    [projects],
  );

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
    <div className="amd-desk-page-skin p-3 sm:p-4">
      <div className="max-w-[1700px] mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(520px,640px)] gap-4">
          <main className="space-y-4 min-w-0">
            <ProactiveTodoBadge />
            {projectLoadFailed ? (
              <section className="dashboard-desk-section border-amber-300 bg-amber-50/80 px-4 py-5 text-sm text-amber-950">
                <p className="font-semibold">PJ台帳を読み込めなかった</p>
                <p className="mt-1 text-amber-900">認証状態を更新するため、ページを再読み込みしてね。</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-3 min-h-11 rounded-[7px] border border-amber-400 bg-white px-4 font-semibold hover:bg-amber-100"
                >
                  再読み込み
                </button>
              </section>
            ) : (
              <DashboardGrid
                projects={dashboardProjects}
                billingStatus={billingStatus}
                scoreHistory={scoreHistory}
                primarySnapshots={primarySnapshots}
                myProjectIds={myProjectIds}
              />
            )}
            <ActionItemsPanel projectLabels={projectLabels} variant="dashboard" limit={5} />
            <DashboardScoreOverview
              managementScore={managementScore}
              managementHistory={managementHistory}
              actionItems={[]}
            />
            <FundingStatsCard />
            <ExtractionStatusCard />
            <FreeeConnectionStatusCard />
          </main>
          {/* /mypage の中身そっくり embed (= まさ #71 v3 確定、MyPageContent を再利用) */}
          <aside className="hidden xl:block min-w-0 border-l border-border/50 pl-4">
            <MyPageContent embedded showMonthlyProjects={false} />
          </aside>
          <div id="company-content" ref={companyAnchorRef} className="xl:col-span-2">
            {companyContent ? (
              <CompanyContentShelf
                members={companyContent.members}
                history={companyContent.history}
                photos={companyContent.photos}
                mediaMentions={companyContent.mediaMentions}
              />
            ) : (
              <div className="text-sm text-muted-foreground py-8 text-center">会社コンテンツ読み込み中…</div>
            )}
          </div>
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
      .select("member_profile_id,member_id,display_name,full_name,public_title,internal_title,notion_status,joined_on,effort,bio_short,join_context,origin_label,residence_label,off_time_note,favorite_food,bucket_list,mbti_tags,visibility,status,photo_asset_id,media_assets:photo_asset_id(asset_id,storage_path,thumbnail_path,tags)")
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
      .select("project_id,founded_at,amd_support_started_at,projects(project_name,client_name)")
      .order("amd_support_started_at", { ascending: false, nullsFirst: false })
      .limit(10),
    supabase
      .from("project_media_mentions")
      .select("id,project_id,occurred_on,title,media_name,kind,source_url,projects(project_name)")
      .eq("dismissed", false)
      .eq("verified", true)
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
  const membersFromProfiles: CompanyMemberPreview[] = (memberProfilesRes.data ?? []).flatMap((row) => {
    const memberId = row.member_id ? String(row.member_id) : null;
    const member = memberId ? membersById.get(memberId) : null;
    if (!member || String(member.status || "") !== "active") return [];
    const photoAsset = Array.isArray(row.media_assets) ? row.media_assets[0] ?? null : row.media_assets ?? null;
    return [{
      memberProfileId: row.member_profile_id ? String(row.member_profile_id) : null,
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
      photoAssetId: photoAsset?.asset_id ? String(photoAsset.asset_id) : null,
      photoCrop: cropFromTags(photoAsset?.tags) ?? DEFAULT_IMAGE_CROP,
      lastLoginAt: member?.last_login_at ? String(member.last_login_at) : null,
    }];
  }).sort(compareMembersByLastLogin);

  const membersFallback: CompanyMemberPreview[] = memberRows.map((row) => ({
    memberProfileId: null,
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
    photoAssetId: null,
    photoCrop: DEFAULT_IMAGE_CROP,
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
    .map((row) => {
      const projects = row.projects as
        | { project_name?: string | null; client_name?: string | null }
        | { project_name?: string | null; client_name?: string | null }[]
        | null;
      const project = Array.isArray(projects) ? projects[0] ?? null : projects ?? null;
      const projectId = row.project_id ? String(row.project_id) : null;
      const title = project?.project_name || project?.client_name || projectId || "Venture";
      return {
        id: `venture-${row.project_id}`,
        projectId,
        occurredOn: row.amd_support_started_at || row.founded_at ? String(row.amd_support_started_at || row.founded_at) : null,
        title,
        kind: row.amd_support_started_at ? "support_started" : "venture",
      };
    })
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
    const coverPosition = coverPositionFromTags(cover?.tags);
    const coverCrop = cropFromTags(cover?.tags) ?? cropFromCoverPosition(coverPosition);
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
      coverPosition: coverPositionFromTags(row.tags),
      crop: cropFromTags(row.tags) ?? cropFromCoverPosition(coverPositionFromTags(row.tags)),
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
      coverPosition,
      crop: coverCrop,
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

const DEFAULT_IMAGE_CROP: CompanyImageCrop = { x: 0, y: 0, zoom: 1 };

function cropFromTags(value: unknown): CompanyImageCrop | null {
  if (!Array.isArray(value)) return null;
  const tag = value.map(String).find((item) => item.startsWith("company_media_crop:"));
  if (!tag) return null;
  const [x, y, zoom] = tag.replace("company_media_crop:", "").split(",").map(Number);
  if (![x, y, zoom].every(Number.isFinite)) return null;
  return {
    x: clampNumber(x, -100, 100, DEFAULT_IMAGE_CROP.x),
    y: clampNumber(y, -100, 100, DEFAULT_IMAGE_CROP.y),
    zoom: clampNumber(zoom, 1, 4, DEFAULT_IMAGE_CROP.zoom),
  };
}

function cropFromCoverPosition(value: string): CompanyImageCrop {
  const map: Record<string, CompanyImageCrop> = {
    "top-left": { x: -35, y: -35, zoom: 1 },
    top: { x: 0, y: -35, zoom: 1 },
    "top-right": { x: 35, y: -35, zoom: 1 },
    left: { x: -35, y: 0, zoom: 1 },
    center: DEFAULT_IMAGE_CROP,
    right: { x: 35, y: 0, zoom: 1 },
    "bottom-left": { x: -35, y: 35, zoom: 1 },
    bottom: { x: 0, y: 35, zoom: 1 },
    "bottom-right": { x: 35, y: 35, zoom: 1 },
  };
  return map[value] ?? DEFAULT_IMAGE_CROP;
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function coverPositionFromTags(value: unknown) {
  if (!Array.isArray(value)) return "center";
  const tag = value.map(String).find((item) => item.startsWith("company_photo_cover_position:"));
  return tag?.split(":")[1] || "center";
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
