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
      .select("member_profile_id,member_id,display_name,public_title,internal_title,notion_status,joined_on,bio_short,expertise_tags,visibility,status")
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
      .select("asset_id,title,asset_kind,usage_permission,consent_status,member_ids,visibility,status,storage_bucket,storage_path,thumbnail_path")
      .in("asset_kind", ["photo", "video"])
      .eq("visibility", "admin_only")
      .eq("status", "needs_review")
      .order("title", { ascending: true })
      .limit(500),
  ]);

  const profiles = profileRes.data ?? [];
  const members = membersRes.data ?? [];
  const history = historyRes.data ?? [];
  const media = mediaRes.data ?? [];
  const mediaReview = mediaReviewRes.data ?? [];
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
        <Metric icon={<ImageIcon className="h-4 w-4" />} label="photo review" value={mediaReview.length} />
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
              {media.map((asset) => (
                <article key={asset.asset_id} className="overflow-hidden rounded-md border border-border bg-card">
                  <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-muted">
                    {asset.storage_path ? (
                      <img src={`/api/company-media/file/${asset.asset_id}`} alt="" className="h-full w-full object-cover" loading="lazy" />
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
                      {[asset.captured_at, asset.asset_kind, `consent:${asset.consent_status}`].filter(Boolean).join(" / ")}
                    </p>
                  </div>
                </article>
              ))}
              {mediaReview.map((asset) => (
                <article key={asset.asset_id} className="overflow-hidden rounded-md border border-amber-200 bg-amber-50/50">
                  <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-amber-100/60">
                    {asset.storage_path ? (
                      <img src={`/api/company-media/file/${asset.asset_id}`} alt="" className="h-full w-full object-cover" loading="lazy" />
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
                      {["needs_review", `usage:${asset.usage_permission}`, `consent:${asset.consent_status}`].filter(Boolean).join(" / ")}
                    </p>
                  </div>
                </article>
              ))}
              {media.length === 0 && mediaReview.length === 0 && <EmptyState text="reviewed media はまだありません" />}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Team">
            <div className="grid gap-3 md:grid-cols-2">
              {members.map((member) => (
                <article key={member.member_profile_id} className="rounded-md border border-border bg-card p-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-sky-50 text-sm font-semibold text-sky-800">
                      {initials(String(member.display_name))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold">{member.display_name}</h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.public_title || member.internal_title || "role tbd"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {[member.notion_status, member.joined_on ? `joined ${String(member.joined_on)}` : null].filter(Boolean).join(" / ")}
                      </p>
                    </div>
                    <StatusChip status={String(member.status)} />
                  </div>
                  {member.bio_short && (
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{member.bio_short}</p>
                  )}
                  {Array.isArray(member.expertise_tags) && member.expertise_tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {member.expertise_tags.slice(0, 4).map((tag: string) => (
                        <span key={tag} className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
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
