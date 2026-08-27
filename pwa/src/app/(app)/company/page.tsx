import type { Metadata } from "next";
import { History, ImageIcon, ShieldCheck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { absolute: "Company - AMD OS" } };

export default async function CompanyPage() {
  const supabase = await createClient();
  const [profileRes, membersRes, historyRes, mediaRes, mediaReviewRes] = await Promise.all([
    supabase
      .from("company_profile_entries")
      .select("entry_id,entry_key,title,body_md,visibility,status,reviewed_at")
      .in("visibility", ["internal", "public_candidate"])
      .in("status", ["approved_internal", "approved_public"])
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("member_profiles")
      .select("member_profile_id,member_id,display_name,full_name,public_title,internal_title,notion_status,joined_on,effort,bio_short,bio_long,expertise_tags,mbti_tags,origin_label,residence_label,join_context,off_time_note,favorite_food,bucket_list,photo_asset_id,media_assets:photo_asset_id(asset_id,storage_path,thumbnail_path),visibility,status")
      .in("visibility", ["internal", "public_candidate"])
      .in("status", ["approved_internal", "approved_public"])
      .order("display_name", { ascending: true })
      .limit(48),
    supabase
      .from("company_history_events")
      .select("event_id,occurred_on,title,summary,event_type,project_id,importance,visibility,status")
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
      .limit(24),
    supabase
      .from("media_assets")
      .select("asset_id,title,asset_kind,captured_at,usage_permission,consent_status,member_ids,visibility,status,storage_bucket,storage_path,thumbnail_path,tags")
      .in("asset_kind", ["photo", "video"])
      // 取り込み経路は Notion 写真DB と共有Drive の2本。片方だけを見ると新しい写真が消える。
      .in("source_ref", ["notion:team-armada-photo-db", "drive:armada-company-photo"])
      .eq("visibility", "admin_only")
      .eq("status", "needs_review")
      .order("captured_at", { ascending: false, nullsFirst: false })
      .order("storage_path", { ascending: false, nullsFirst: false })
      .limit(500),
  ]);

  const profiles = profileRes.data ?? [];
  const members = membersRes.data ?? [];
  const history = historyRes.data ?? [];
  const media = mediaRes.data ?? [];
  const mediaReview = mediaReviewRes.data ?? [];
  const mediaGroups = groupMediaAssets(media, "approved");
  const mediaReviewGroups = groupMediaAssets(mediaReview, "review");
  const schemaMissing = Boolean(profileRes.error || membersRes.error || historyRes.error || mediaRes.error || mediaReviewRes.error);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Company
          </p>
          <h1 className="text-2xl font-semibold text-foreground">Team ARMADA content</h1>
        </div>
        <span className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          internal read-only
        </span>
      </header>

      {schemaMissing && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          company content tables are not applied yet. This page will populate after the Notion import lands in approved rows.
        </div>
      )}

      <section className="grid gap-3 lg:grid-cols-4">
        <Metric icon={<Users className="h-4 w-4" />} label="team profiles" value={members.length} />
        <Metric icon={<History className="h-4 w-4" />} label="history events" value={history.length} />
        <Metric icon={<ImageIcon className="h-4 w-4" />} label="photo review" value={mediaReviewGroups.length} />
        <Metric icon={<ShieldCheck className="h-4 w-4" />} label="visibility gate" value="on" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <Panel title="Profile">
            <div className="space-y-3">
              {profiles.map((entry) => (
                <article key={entry.entry_id} className="rounded-md border border-border bg-card p-3">
                  <div className="flex items-start gap-2">
                    <h2 className="min-w-0 flex-1 text-sm font-semibold text-foreground">{entry.title}</h2>
                    <StatusChip status={String(entry.status)} />
                  </div>
                  {entry.body_md && (
                    <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {entry.body_md}
                    </p>
                  )}
                </article>
              ))}
              {profiles.length === 0 && <EmptyState text="approved company profile はまだありません" />}
            </div>
          </Panel>

          <Panel title="Media">
            <div className="grid gap-3 sm:grid-cols-2">
              {mediaGroups.map((asset) => (
                <article key={asset.asset_id} className="overflow-hidden rounded-md border border-border bg-card">
                  <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-muted">
                    {asset.imageUrl ? (
                      <MediaPreview src={asset.imageUrl} kind="photo" objectPosition={asset.coverPosition} />
                    ) : (
                      <ImageIcon className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="flex items-center gap-2">
                      <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{asset.title}</h3>
                      <PermissionChip permission={String(asset.usage_permission)} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[`${asset.itemCount} items`, asset.captured_at, asset.asset_kind, `consent:${asset.consent_status}`].filter(Boolean).join(" / ")}
                    </p>
                  </div>
                </article>
              ))}
              {mediaReviewGroups.map((asset) => (
                <article key={asset.asset_id} className="overflow-hidden rounded-md border border-amber-200 bg-amber-50/50">
                  <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-amber-100/60">
                    {asset.imageUrl ? (
                      <MediaPreview src={asset.imageUrl} kind="photo" objectPosition={asset.coverPosition} />
                    ) : (
                      <ImageIcon className="h-7 w-7 text-amber-700/70" />
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="flex items-center gap-2">
                      <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{asset.title}</h3>
                      <PermissionChip permission="review" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[`${asset.itemCount} items`, "needs_review", `usage:${asset.usage_permission}`, `consent:${asset.consent_status}`].filter(Boolean).join(" / ")}
                    </p>
                  </div>
                </article>
              ))}
              {mediaGroups.length === 0 && mediaReviewGroups.length === 0 && <EmptyState text="reviewed media はまだありません" />}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Team">
            <div className="grid gap-3 md:grid-cols-2">
              {members.map((member) => {
                const photoAsset = oneRelation(member.media_assets);
                return (
                <article key={member.member_profile_id} className="rounded-md border border-border bg-card p-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-sky-50 text-sm font-semibold text-sky-800">
                      {photoAsset?.storage_path || photoAsset?.thumbnail_path ? (
                        <img src={`/api/company-media/file/${photoAsset.asset_id}`} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        initials(String(member.display_name))
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold">{member.display_name}</h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {[member.full_name, member.public_title || member.internal_title].filter(Boolean).join(" / ") || "role tbd"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {[member.notion_status, member.joined_on ? `joined ${String(member.joined_on)}` : null, member.effort != null ? `effort ${Number(member.effort) * 100}%` : null].filter(Boolean).join(" / ")}
                      </p>
                    </div>
                    <StatusChip status={String(member.status)} />
                  </div>
                  {member.bio_short && (
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{member.bio_short}</p>
                  )}
                  <div className="mt-3 space-y-1 text-xs leading-5 text-muted-foreground">
                    {member.join_context && <p><b className="text-foreground">参画</b> {member.join_context}</p>}
                    {(member.origin_label || member.residence_label) && <p><b className="text-foreground">拠点</b> {[member.origin_label, member.residence_label].filter(Boolean).join(" / ")}</p>}
                    {member.off_time_note && <p><b className="text-foreground">オフ</b> {member.off_time_note}</p>}
                    {member.favorite_food && <p><b className="text-foreground">好きな食べ物</b> {member.favorite_food}</p>}
                    {member.bucket_list && <p><b className="text-foreground">バケットリスト</b> {member.bucket_list}</p>}
                  </div>
                  {Array.isArray(member.expertise_tags) && member.expertise_tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {[...member.expertise_tags, ...(Array.isArray(member.mbti_tags) ? member.mbti_tags : [])].slice(0, 6).map((tag: string) => (
                        <span key={tag} className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
                );
              })}
              {members.length === 0 && <EmptyState text="approved member profiles はまだありません" />}
            </div>
          </Panel>

          <Panel title="History">
            <div className="space-y-2">
              {history.map((event) => (
                <article key={event.event_id} className="rounded-md border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {event.occurred_on ? String(event.occurred_on).replaceAll("-", ".") : "date tbd"}
                    </span>
                    <span className="rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {event.event_type}
                    </span>
                    {event.project_id && (
                      <span className="rounded border border-border bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {event.project_id}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-sm font-semibold">{event.title}</h3>
                  {event.summary && <p className="mt-1 line-clamp-3 text-sm leading-6 text-muted-foreground">{event.summary}</p>}
                </article>
              ))}
              {history.length === 0 && <EmptyState text="approved history events はまだありません" />}
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const cls = status === "approved_public"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-sky-200 bg-sky-50 text-sky-700";
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{status}</span>;
}

function PermissionChip({ permission }: { permission: string }) {
  const cls = permission === "public_ok"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-sky-200 bg-sky-50 text-sky-700";
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{permission}</span>;
}

interface CompanyMediaGroup {
  asset_id: string;
  title: string;
  asset_kind: string;
  captured_at: string | null;
  usage_permission: string;
  consent_status: string;
  imageUrl: string | null;
  itemCount: number;
  coverPosition: string;
}

function groupMediaAssets(rows: any[], mode: "approved" | "review"): CompanyMediaGroup[] {
  const groups = new Map<string, any[]>();
  for (const row of rows) {
    const key = parentKeyFromStorage(row) || String(row.asset_id);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return Array.from(groups.entries()).map(([key, groupRows]) => {
    const sortedRows = groupRows.slice().sort(compareMediaRowsByDate);
    const taggedCover = sortedRows.find((row) => Array.isArray(row.tags) && row.tags.map(String).includes("company_photo_group_cover"));
    const cover = taggedCover ?? sortedRows.find((row) => row.thumbnail_path || row.storage_path) ?? sortedRows[0];
    const hasVideo = groupRows.some((row) => String(row.asset_kind || "") === "video");
    return {
      asset_id: `media-group-${key}`,
      title: photoGroupTitle(cover),
      asset_kind: hasVideo ? "photo / video" : String(cover.asset_kind || "photo"),
      captured_at: maxDateString(groupRows.map((row) => row.captured_at)),
      usage_permission: String(cover.usage_permission || (mode === "review" ? "review" : "unknown")),
      consent_status: String(cover.consent_status || "unknown"),
      imageUrl: cover && (cover.thumbnail_path || cover.storage_path) ? `/api/company-media/file/${cover.asset_id}` : null,
      itemCount: groupRows.length,
      coverPosition: coverPositionFromTags(cover.tags),
    };
  }).sort((a, b) => compareNullableDateDesc(a.captured_at, b.captured_at) || a.title.localeCompare(b.title, "ja"));
}

function parentKeyFromStorage(row: any) {
  const storagePath = String(row.storage_path || row.thumbnail_path || "");
  const parts = storagePath.split("/");
  return parts.length >= 3 ? parts[1] : null;
}

function photoGroupTitle(row: any) {
  return String(row.title || "Photo review")
    .replace(/^(Photo|Video|Media) review: /, "")
    .replace(/ #\d+$/, "");
}

function compareMediaRowsByDate(a: any, b: any) {
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

function coverPositionFromTags(value: unknown) {
  if (!Array.isArray(value)) return "center";
  const tag = value.map(String).find((item) => item.startsWith("company_photo_cover_position:"));
  return tag?.split(":")[1] || "center";
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

const POSITION_CSS: Record<string, string> = {
  "top-left": "left top",
  top: "center top",
  "top-right": "right top",
  left: "left center",
  center: "center center",
  right: "right center",
  "bottom-left": "left bottom",
  bottom: "center bottom",
  "bottom-right": "right bottom",
};

function MediaPreview({ src, kind, objectPosition }: { src: string; kind: string; objectPosition?: string }) {
  const style = { objectPosition: POSITION_CSS[objectPosition || "center"] || "center center" };
  if (kind === "video") {
    return (
      <video
        src={src}
        className="h-full w-full object-cover"
        style={style}
        muted
        playsInline
        preload="metadata"
      />
    );
  }
  return <img src={src} alt="" className="h-full w-full object-cover" style={style} loading="lazy" />;
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "TA";
}

function oneRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
