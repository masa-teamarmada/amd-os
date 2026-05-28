/**
 * POST /api/meeting-summary/manual-update
 *
 * Manual corrections for project_meeting_summaries display fields.
 * Keep source_hash untouched so the extractor still treats the current
 * source bundle as already processed unless the real source changes.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : String(v ?? "").trim()))
    .filter(Boolean)
    .slice(0, 80);
}

function nullableText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function isRichNarrative(value: unknown): boolean {
  return typeof value === "string" && value.trim().length >= 300;
}

function isBulletDominant(value: string): boolean {
  const lines = value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 4) return false;
  const bulletLines = lines.filter((line) => /^(-|\*|・|•|\d+[\.)])\s+/.test(line)).length;
  return bulletLines / lines.length >= 0.7;
}

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

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const meetingId = requiredText(body.meeting_id, 300);
  const title = requiredText(body.title, 500);
  if (!meetingId || !title) {
    return NextResponse.json({ ok: false, error: "meeting_id and title are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("project_meeting_summaries")
    .select("meeting_id,narrative_md")
    .eq("meeting_id", meetingId)
    .maybeSingle();
  if (existingError) {
    return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ ok: false, error: "meeting not found" }, { status: 404 });
  }

  const existingNarrative = typeof existing.narrative_md === "string" ? existing.narrative_md : "";
  const requestedNarrative = nullableText(body.narrative_md, 50000);
  const allowClearNarrative = body.allow_clear_narrative === true;
  const preservesExistingNarrative =
    isRichNarrative(existingNarrative) &&
    !allowClearNarrative &&
    (
      !requestedNarrative ||
      (isBulletDominant(requestedNarrative) && requestedNarrative.trim().length <= existingNarrative.trim().length)
    );

  const update = {
    title,
    summary_short: requiredText(body.summary_short, 2000),
    decided: ensureStringArray(body.decided),
    progress: ensureStringArray(body.progress),
    next_actions: ensureStringArray(body.next_actions),
    risks: ensureStringArray(body.risks),
    narrative_md: preservesExistingNarrative ? existingNarrative : requestedNarrative,
    generated_by_model: "manual-edit",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("project_meeting_summaries")
    .update(update)
    .eq("meeting_id", meetingId)
    .select()
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ ok: false, error: error.message }, { status });
  }

  return NextResponse.json({
    ok: true,
    meeting: toClientMeeting(data as Record<string, unknown>),
    updated_by: auth.user.email,
    narrative_preserved: preservesExistingNarrative,
  });
}
