/**
 * POST /api/meeting-calendar/upsert-plan
 *
 * Dry-run only planner for MTG card -> Google Calendar upsert.
 * Calendar access and any eventual write stay outside this route. The L2-6
 * automation passes short existing Calendar event metadata, and this route
 * returns idempotent payloads, duplicate matches, and review gates.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildMeetingCalendarUpsertPlans,
  type ExistingCalendarEvent,
  type MeetingCalendarSource,
} from "@/lib/meeting-calendar-upsert-plan";

type MeetingSummaryRow = {
  meeting_id: string;
  project_id: string;
  meeting_date: string;
  meeting_start_at: string | null;
  title: string;
  calendar_event_id: string | null;
  source_url: string | null;
  notion_url: string | null;
  source_kinds: string | null;
  summary_short: string | null;
  narrative_md: string | null;
  next_actions: unknown;
};

async function authorize(req: NextRequest): Promise<{ ok: true; createdBy: string } | { ok: false; res: NextResponse }> {
  const auth = req.headers.get("authorization") || "";
  const workflowSecret = process.env.WORKFLOW_SECRET || process.env.CRON_SECRET || "";
  if (workflowSecret && auth === `Bearer ${workflowSecret}`) return { ok: true, createdBy: "workflow" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };

  const { data: member } = await supabase
    .from("members")
    .select("code_name, is_admin")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (!member?.is_admin) return { ok: false, res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { ok: true, createdBy: member.code_name || user.email };
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean).slice(0, 20);
}

function rowToSource(row: MeetingSummaryRow): MeetingCalendarSource {
  return {
    meeting_id: row.meeting_id,
    project_id: row.project_id,
    meeting_date: row.meeting_date,
    meeting_start_at: row.meeting_start_at,
    title: row.title,
    calendar_event_id: row.calendar_event_id,
    source_url: row.source_url,
    notion_url: row.notion_url,
    source_kinds: row.source_kinds,
    summary_short: row.summary_short,
    narrative_md: row.narrative_md,
    homework_items: stringArray(row.next_actions),
    date_confidence: row.meeting_start_at ? "high" : "medium",
  };
}

function normalizeSource(value: unknown): MeetingCalendarSource | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const meetingId = String(rec.meeting_id ?? rec.meetingId ?? "").trim();
  const projectId = String(rec.project_id ?? rec.projectId ?? "").trim();
  const title = String(rec.title ?? "").trim();
  const meetingDate = String(rec.meeting_date ?? rec.meetingDate ?? "").trim();
  if (!meetingId || !projectId || !title || !meetingDate) return null;
  return {
    meeting_id: meetingId,
    project_id: projectId,
    title,
    meeting_date: meetingDate,
    meeting_start_at: typeof rec.meeting_start_at === "string" ? rec.meeting_start_at : typeof rec.meetingStartAt === "string" ? rec.meetingStartAt : null,
    meeting_end_at: typeof rec.meeting_end_at === "string" ? rec.meeting_end_at : typeof rec.meetingEndAt === "string" ? rec.meetingEndAt : null,
    calendar_event_id: typeof rec.calendar_event_id === "string" ? rec.calendar_event_id : typeof rec.calendarEventId === "string" ? rec.calendarEventId : null,
    source_url: typeof rec.source_url === "string" ? rec.source_url : typeof rec.sourceUrl === "string" ? rec.sourceUrl : null,
    notion_url: typeof rec.notion_url === "string" ? rec.notion_url : typeof rec.notionUrl === "string" ? rec.notionUrl : null,
    source_kinds: typeof rec.source_kinds === "string" ? rec.source_kinds : typeof rec.sourceKinds === "string" ? rec.sourceKinds : null,
    summary_short: typeof rec.summary_short === "string" ? rec.summary_short : typeof rec.summaryShort === "string" ? rec.summaryShort : null,
    narrative_md: typeof rec.narrative_md === "string" ? rec.narrative_md : typeof rec.narrativeMd === "string" ? rec.narrativeMd : null,
    location: typeof rec.location === "string" ? rec.location : null,
    modality: typeof rec.modality === "string" ? rec.modality : null,
    attendee_emails: stringArray(rec.attendee_emails ?? rec.attendeeEmails),
    carry_items: stringArray(rec.carry_items ?? rec.carryItems),
    homework_items: stringArray(rec.homework_items ?? rec.homeworkItems),
    reply_required: rec.reply_required === true || rec.replyRequired === true,
    invite_attendees: rec.invite_attendees === true || rec.inviteAttendees === true,
    date_confidence: typeof rec.date_confidence === "string" ? rec.date_confidence : typeof rec.dateConfidence === "string" ? rec.dateConfidence : null,
  };
}

export async function POST(req: NextRequest) {
  const authz = await authorize(req);
  if (!authz.ok) return authz.res;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const requestedWrite = body.dry_run === false || body.execute === true;
  if (requestedWrite) {
    return NextResponse.json({
      ok: false,
      error: "calendar_write_disabled",
      message: "This endpoint is dry-run only. Do not write Calendar events from PWA without a reviewed write bundle.",
    }, { status: 409 });
  }

  const directSources = Array.isArray(body.meetings)
    ? body.meetings.map(normalizeSource).filter((item): item is MeetingCalendarSource => item !== null)
    : [];
  const meetingIds = Array.isArray(body.meeting_ids)
    ? [...new Set(body.meeting_ids.map((value) => String(value).trim()).filter(Boolean))]
    : [];

  let dbSources: MeetingCalendarSource[] = [];
  if (meetingIds.length > 0) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("project_meeting_summaries")
      .select("meeting_id,project_id,meeting_date,meeting_start_at,title,calendar_event_id,source_url,notion_url,source_kinds,summary_short,narrative_md,next_actions")
      .in("meeting_id", meetingIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    dbSources = ((data ?? []) as MeetingSummaryRow[]).map(rowToSource);
  }

  const sources = [...dbSources, ...directSources];
  if (sources.length === 0) {
    return NextResponse.json({ error: "meeting_ids or meetings required" }, { status: 400 });
  }

  const existingEvents = Array.isArray(body.existing_events)
    ? (body.existing_events as ExistingCalendarEvent[])
    : [];
  const plans = buildMeetingCalendarUpsertPlans(sources, existingEvents);
  const summary = plans.reduce((acc, plan) => {
    acc[plan.action] = (acc[plan.action] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({
    ok: true,
    dry_run: true,
    write_enabled: false,
    created_by: authz.createdBy,
    summary,
    plans,
  });
}
