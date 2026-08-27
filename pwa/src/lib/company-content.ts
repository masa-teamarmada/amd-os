/**
 * ホーム下段「会社の記録」(メンバー / 沿革 / メディア掲載 / 写真) のサーバ側データ層。
 *
 * 【なぜサーバへ移したか】
 * 元はホームの client component がブラウザから9本のクエリを直接投げていた。
 * 参照系 (メンバー名簿・沿革・メディア掲載・写真台帳。どれも日〜週単位でしか変わらない) を
 * 画面を開くたびに読み直す作りで、下までスクロールしても「会社コンテンツ読み込み中…」が
 * 残ることがあった。規範は pwa/spec/5-10-reference-data-caching-current-spec.md。
 *
 * このファイルは server-only。API route (/api/dashboard/company-content) からだけ呼ぶ。
 * 画面は src/lib/company-content-client.ts (reference-data-cache 経由) を通す。
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CompanyContentPreview,
  CompanyHistoryPreview,
  CompanyImageCrop,
  CompanyMediaMentionPreview,
  CompanyMemberPreview,
  CompanyPhotoPreview,
} from "@/types/company-content";

/** 参照系の既定TTL。名簿・沿革・写真台帳の更新頻度 (日〜週単位) に対して十分短い。 */
const SNAPSHOT_TTL_MS = 5 * 60 * 1000;

/**
 * 写真カードの母集団に入れる取り込み経路。
 * メンバー顔写真 (`notion:team-armada-member-list:photo-present` など) はメンバー列で使うので入れない。
 */
const PHOTO_GROUP_SOURCE_REFS = [
  "notion:team-armada-photo-db",
  "drive:armada-company-photo",
];

let snapshot: { value: CompanyContentPreview; storedAt: number } | null = null;
let inflight: Promise<CompanyContentPreview> | null = null;

/** TTL 内はメモリから返し、同時アクセスは1回のロードへ束ねる (single-flight)。 */
export async function getCompanyContentPreview(
  client: SupabaseClient,
  options?: { force?: boolean },
): Promise<CompanyContentPreview> {
  if (!options?.force && snapshot && Date.now() - snapshot.storedAt < SNAPSHOT_TTL_MS) {
    return snapshot.value;
  }
  if (!options?.force && inflight) return inflight;

  const request = loadCompanyContentPreview(client)
    .then((value) => {
      snapshot = { value, storedAt: Date.now() };
      return value;
    })
    .finally(() => {
      if (inflight === request) inflight = null;
    });
  inflight = request;
  return request;
}

/** 写真の取り込み・承認・トリミングを書き換えた直後に呼ぶ。 */
export function invalidateCompanyContentCache(): void {
  snapshot = null;
}

/** キャッシュの鮮度 (ms)。未取得なら null。 */
export function companyContentCacheAgeMs(): number | null {
  return snapshot ? Date.now() - snapshot.storedAt : null;
}

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

async function loadCompanyContentPreview(supabase: SupabaseClient): Promise<CompanyContentPreview> {
  const [
    membersRes,
    projectMembersRes,
    memberProfilesRes,
    companyHistoryRes,
    mediaApprovedRes,
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
      .select("asset_id,title,asset_kind,captured_at,usage_permission,consent_status,storage_path,thumbnail_path,tags")
      .in("asset_kind", ["photo", "video"])
      .in("source_ref", PHOTO_GROUP_SOURCE_REFS)
      .in("visibility", ["internal", "public_candidate"])
      .in("status", ["approved_internal", "approved_public"])
      .in("usage_permission", ["internal_ok", "public_ok"])
      .in("consent_status", ["granted", "not_needed"])
      .order("captured_at", { ascending: false, nullsFirst: false })
      .limit(500),
    supabase
      .from("media_assets")
      .select("asset_id,title,asset_kind,captured_at,usage_permission,consent_status,storage_path,thumbnail_path,tags")
      .in("asset_kind", ["photo", "video"])
      .in("source_ref", PHOTO_GROUP_SOURCE_REFS)
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

  // 承認済みと未レビューは排他条件なので、両方をまとめて撮影日の新しい順に並べる。
  // 片方が空でももう片方が消えない (承認が1件でも付いた瞬間に未レビュー分が全部消える旧挙動の修正)。
  const photos = [
    ...groupCompanyPhotos((mediaApprovedRes.data ?? []) as CompanyMediaAssetRow[], "approved"),
    ...groupCompanyPhotos((mediaReviewRes.data ?? []) as CompanyMediaAssetRow[], "review"),
  ].sort((a, b) => compareNullableDateDesc(a.occurredOn, b.occurredOn) || a.title.localeCompare(b.title, "ja"));

  return {
    members: membersFromProfiles.length > 0 ? membersFromProfiles : membersFallback,
    history: historyFromCompany.length > 0 ? historyFromCompany : (historyFromEvents.length > 0 ? historyFromEvents : historyFallback),
    photos,
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
        ? [hasVideo ? "動画あり" : null, consent === "granted" ? "本人同意あり" : null].filter(Boolean).join(" / ")
        : "未確認",
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
  });
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
