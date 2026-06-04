import type { Metadata } from "next";
import { AlertTriangle, History, ImageIcon, ListChecks, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { absolute: "Admin Company - AMD OS" } };

export default async function AdminCompanyPage() {
  const supabase = await createClient();
  const [profileRes, membersRes, historyRes, mediaRes] = await Promise.all([
    supabase
      .from("company_profile_entries")
      .select("entry_id,entry_key,title,visibility,status,source_kind,source_ref,notion_source_id,reviewed_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("member_profiles")
      .select("member_profile_id,member_id,display_name,public_title,internal_title,visibility,status,source_kind,source_ref,notion_source_id,photo_asset_id,reviewed_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(80),
    supabase
      .from("company_history_events")
      .select("event_id,occurred_on,title,event_type,project_id,importance,visibility,status,source_kind,source_ref,notion_source_id,reviewed_at,updated_at")
      .order("occurred_on", { ascending: false, nullsFirst: false })
      .limit(80),
    supabase
      .from("media_assets")
      .select("asset_id,title,asset_kind,captured_at,usage_permission,consent_status,visibility,status,source_kind,source_ref,notion_source_id,reviewed_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(80),
  ]);

  const profileRows = profileRes.data ?? [];
  const memberRows = membersRes.data ?? [];
  const historyRows = historyRes.data ?? [];
  const mediaRows = mediaRes.data ?? [];
  const schemaMissing = Boolean(profileRes.error || membersRes.error || historyRes.error || mediaRes.error);

  const allRows = [...profileRows, ...memberRows, ...historyRows, ...mediaRows];
  const needsReview = allRows.filter((row) => ["imported", "needs_review"].includes(String(row.status))).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Company Content</h1>
          <p className="text-sm text-muted-foreground">
            Notion member / history / media import review queue
          </p>
        </div>
        <span className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          admin only
        </span>
      </header>

      {schemaMissing && (
        <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">company content tables are not applied yet</p>
            <p className="mt-1">Apply the reviewed migration before running the Notion import. This page is intentionally empty until then.</p>
          </div>
        </div>
      )}

      <section className="grid gap-3 lg:grid-cols-5">
        <Metric icon={<ListChecks className="h-4 w-4" />} label="needs review" value={needsReview} tone="amber" />
        <Metric icon={<Users className="h-4 w-4" />} label="member profiles" value={memberRows.length} />
        <Metric icon={<History className="h-4 w-4" />} label="history events" value={historyRows.length} />
        <Metric icon={<ImageIcon className="h-4 w-4" />} label="media assets" value={mediaRows.length} />
        <Metric icon={<ListChecks className="h-4 w-4" />} label="profile entries" value={profileRows.length} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ReviewTable
          title="Team"
          rows={memberRows.map((row) => ({
            id: String(row.member_profile_id),
            primary: String(row.display_name),
            secondary: [row.public_title || row.internal_title, row.member_id].filter(Boolean).join(" / "),
            status: String(row.status),
            visibility: String(row.visibility),
            sourceKind: String(row.source_kind || ""),
            sourceRef: String(row.source_ref || row.notion_source_id || ""),
          }))}
        />
        <ReviewTable
          title="History"
          rows={historyRows.map((row) => ({
            id: String(row.event_id),
            primary: String(row.title),
            secondary: [row.occurred_on, row.event_type, row.project_id].filter(Boolean).join(" / "),
            status: String(row.status),
            visibility: String(row.visibility),
            sourceKind: String(row.source_kind || ""),
            sourceRef: String(row.source_ref || row.notion_source_id || ""),
          }))}
        />
        <ReviewTable
          title="Media"
          rows={mediaRows.map((row) => ({
            id: String(row.asset_id),
            primary: String(row.title),
            secondary: [row.asset_kind, row.captured_at, `usage:${row.usage_permission}`, `consent:${row.consent_status}`].filter(Boolean).join(" / "),
            status: String(row.status),
            visibility: String(row.visibility),
            sourceKind: String(row.source_kind || ""),
            sourceRef: String(row.source_ref || row.notion_source_id || ""),
          }))}
        />
        <ReviewTable
          title="Profile"
          rows={profileRows.map((row) => ({
            id: String(row.entry_id),
            primary: String(row.title),
            secondary: String(row.entry_key),
            status: String(row.status),
            visibility: String(row.visibility),
            sourceKind: String(row.source_kind || ""),
            sourceRef: String(row.source_ref || row.notion_source_id || ""),
          }))}
        />
      </section>
    </div>
  );
}

interface ReviewRow {
  id: string;
  primary: string;
  secondary: string;
  status: string;
  visibility: string;
  sourceKind: string;
  sourceRef: string;
}

function ReviewTable({ title, rows }: { title: string; rows: ReviewRow[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="rounded border border-border bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
          {rows.length}
        </span>
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">item</th>
              <th className="px-3 py-2 font-medium">gate</th>
              <th className="px-3 py-2 font-medium">source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/70 last:border-b-0">
                <td className="min-w-0 px-3 py-2">
                  <p className="truncate font-medium text-foreground">{row.primary}</p>
                  <p className="truncate text-xs text-muted-foreground">{row.secondary || "metadata pending"}</p>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <GateChip value={row.status} />
                    <GateChip value={row.visibility} />
                  </div>
                </td>
                <td className="max-w-[180px] px-3 py-2">
                  <p className="truncate text-xs text-muted-foreground">{row.sourceKind || "manual"}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">{row.sourceRef || "ref pending"}</p>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  no rows
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "default" | "amber";
}) {
  const cls = tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-border bg-card text-foreground";
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function GateChip({ value }: { value: string }) {
  const cls = value.includes("review") || value === "imported"
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : value.includes("approved")
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-border bg-muted/30 text-muted-foreground";
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{value}</span>;
}
