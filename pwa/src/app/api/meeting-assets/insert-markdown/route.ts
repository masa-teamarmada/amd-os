import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

const ASSETS_START = "<!-- meeting-assets:start -->";
const ASSETS_END = "<!-- meeting-assets:end -->";

function requiredText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : String(x ?? ""))).filter(Boolean);
}

function toClientMeeting(row: Record<string, unknown>) {
  return {
    meetingId: row.meeting_id,
    projectId: row.project_id,
    ym: row.ym || "",
    meetingDate: row.meeting_date,
    meetingStartAt: row.meeting_start_at ?? null,
    title: row.title || "",
    notionUrl: row.notion_url ?? null,
    sourceUrl: row.source_url ?? null,
    calendarEventId: row.calendar_event_id ?? null,
    summaryShort: row.summary_short || "",
    decided: asStringArray(row.decided),
    progress: asStringArray(row.progress),
    nextActions: asStringArray(row.next_actions),
    risks: asStringArray(row.risks),
    narrativeMd: row.narrative_md ?? null,
    generatedAt: row.generated_at,
    generatedByModel: row.generated_by_model ?? null,
    sourceKinds: row.source_kinds ?? null,
    prepStatus: row.prep_status ?? null,
  };
}

function escapeMarkdown(value: string): string {
  return value.replace(/[[\]\\]/g, "\\$&").replace(/\n+/g, " ").trim();
}

function buildAssetsSection(assets: Array<Record<string, unknown>>): string {
  const lines: string[] = [ASSETS_START, "", "## 添付資料", ""];
  for (const asset of assets) {
    const assetId = String(asset.asset_id || "");
    const fileName = String(asset.file_name || "meeting asset");
    const caption = String(asset.caption || "").trim();
    const label = escapeMarkdown(caption || fileName);
    const url = `/api/meeting-assets/file/${assetId}`;
    const mediaType = String(asset.media_type || "");
    if (mediaType.startsWith("image/")) {
      lines.push(`![${label}](${url})`);
      if (caption) lines.push(`_${escapeMarkdown(caption)}_`);
      lines.push("");
    } else {
      const note = caption ? ` — ${caption}` : "";
      lines.push(`- [${escapeMarkdown(fileName)}](${url})${escapeMarkdown(note)}`);
    }
  }
  lines.push(ASSETS_END);
  return lines.join("\n");
}

function upsertAssetsSection(existing: string, section: string): string {
  const start = existing.indexOf(ASSETS_START);
  const end = existing.indexOf(ASSETS_END);
  if (start >= 0 && end > start) {
    return `${existing.slice(0, start).trimEnd()}\n\n${section}\n\n${existing.slice(end + ASSETS_END.length).trimStart()}`.trim();
  }
  return `${existing.trimEnd()}\n\n${section}`.trim();
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const meetingId = requiredText(body.meeting_id, 300);
  if (!meetingId) {
    return NextResponse.json({ ok: false, error: "meeting_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: meeting, error: meetingError } = await admin
    .from("project_meeting_summaries")
    .select("*")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  if (meetingError) {
    return NextResponse.json({ ok: false, error: meetingError.message }, { status: 500 });
  }
  if (!meeting) {
    return NextResponse.json({ ok: false, error: "meeting not found" }, { status: 404 });
  }

  const { data: assets, error: assetsError } = await admin
    .from("meeting_assets")
    .select("asset_id,file_name,media_type,caption,sort_order,created_at")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (assetsError) {
    return NextResponse.json({ ok: false, error: assetsError.message }, { status: 500 });
  }
  if (!assets || assets.length === 0) {
    return NextResponse.json({ ok: false, error: "assets not found" }, { status: 404 });
  }

  const base = String(meeting.narrative_md || meeting.summary_short || "");
  const section = buildAssetsSection(assets as Array<Record<string, unknown>>);
  const narrativeMd = upsertAssetsSection(base, section);

  const { data: updated, error: updateError } = await admin
    .from("project_meeting_summaries")
    .update({
      narrative_md: narrativeMd,
      generated_by_model: "manual-asset-insert",
      updated_at: new Date().toISOString(),
    })
    .eq("meeting_id", meetingId)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    meeting: toClientMeeting(updated as Record<string, unknown>),
    updated_by: auth.user.email,
  });
}
