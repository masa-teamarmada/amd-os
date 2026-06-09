/**
 * POST /api/task-calendar/schedule-plan
 *
 * Dry-run only planner for AMD task -> + Calendar work blocks.
 * H-1 automation reads Calendar busy windows via Google Calendar MCP, passes
 * compact busy metadata here, then writes the returned per-calendar events
 * outside PWA only after the write gate allows it.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildTaskCalendarSchedulePlans,
  type TaskCalendarBusyWindow,
  type TaskCalendarExistingEvent,
  type TaskCalendarSource,
} from "@/lib/task-calendar-schedule-plan";

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

function normalizeTask(value: unknown): TaskCalendarSource | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const taskId = String(rec.task_id ?? rec.taskId ?? "").trim();
  const projectId = String(rec.project_id ?? rec.projectId ?? "").trim();
  const title = String(rec.title ?? "").trim();
  if (!taskId || !projectId || !title) return null;
  return {
    task_id: taskId,
    project_id: projectId,
    project_code: typeof rec.project_code === "string" ? rec.project_code : typeof rec.projectCode === "string" ? rec.projectCode : null,
    title,
    description: typeof rec.description === "string" ? rec.description : null,
    owner_member_id: typeof rec.owner_member_id === "string" ? rec.owner_member_id : typeof rec.ownerMemberId === "string" ? rec.ownerMemberId : null,
    owner_code_name: typeof rec.owner_code_name === "string" ? rec.owner_code_name : typeof rec.ownerCodeName === "string" ? rec.ownerCodeName : null,
    owner_calendar_id: typeof rec.owner_calendar_id === "string" ? rec.owner_calendar_id : typeof rec.ownerCalendarId === "string" ? rec.ownerCalendarId : null,
    owner_slack_user_id: typeof rec.owner_slack_user_id === "string" ? rec.owner_slack_user_id : typeof rec.ownerSlackUserId === "string" ? rec.ownerSlackUserId : null,
    manager_calendar_id: typeof rec.manager_calendar_id === "string" ? rec.manager_calendar_id : typeof rec.managerCalendarId === "string" ? rec.managerCalendarId : null,
    manager_slack_user_id: typeof rec.manager_slack_user_id === "string" ? rec.manager_slack_user_id : typeof rec.managerSlackUserId === "string" ? rec.managerSlackUserId : null,
    due_at: typeof rec.due_at === "string" ? rec.due_at : typeof rec.dueAt === "string" ? rec.dueAt : null,
    earliest_start: typeof rec.earliest_start === "string" ? rec.earliest_start : typeof rec.earliestStart === "string" ? rec.earliestStart : null,
    latest_end: typeof rec.latest_end === "string" ? rec.latest_end : typeof rec.latestEnd === "string" ? rec.latestEnd : null,
    estimated_minutes: typeof rec.estimated_minutes === "number" ? rec.estimated_minutes : typeof rec.estimatedMinutes === "number" ? rec.estimatedMinutes : null,
    priority: typeof rec.priority === "string" ? rec.priority : null,
    source_kind: typeof rec.source_kind === "string" ? rec.source_kind : typeof rec.sourceKind === "string" ? rec.sourceKind : null,
    source_id: typeof rec.source_id === "string" ? rec.source_id : typeof rec.sourceId === "string" ? rec.sourceId : null,
    source_url: typeof rec.source_url === "string" ? rec.source_url : typeof rec.sourceUrl === "string" ? rec.sourceUrl : null,
    source_confidence: typeof rec.source_confidence === "number" ? rec.source_confidence : typeof rec.sourceConfidence === "number" ? rec.sourceConfidence : null,
    source_excerpt: typeof rec.source_excerpt === "string" ? rec.source_excerpt : typeof rec.sourceExcerpt === "string" ? rec.sourceExcerpt : null,
    personal_boundary_risk: typeof rec.personal_boundary_risk === "boolean" ? rec.personal_boundary_risk : typeof rec.personalBoundaryRisk === "boolean" ? rec.personalBoundaryRisk : null,
    external_reply_required: typeof rec.external_reply_required === "boolean" ? rec.external_reply_required : typeof rec.externalReplyRequired === "boolean" ? rec.externalReplyRequired : null,
  };
}

function normalizeBusy(value: unknown): TaskCalendarBusyWindow | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const calendarId = String(rec.calendar_id ?? rec.calendarId ?? "").trim();
  const start = String(rec.start ?? "").trim();
  const end = String(rec.end ?? "").trim();
  if (!calendarId || !start || !end) return null;
  return { calendar_id: calendarId, start, end };
}

function normalizeExistingEvent(value: unknown): TaskCalendarExistingEvent | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const id = String(rec.id ?? rec.event_id ?? rec.eventId ?? "").trim();
  if (!id) return null;
  const rawExtendedProperties = rec.extendedProperties;
  const extendedProperties = rawExtendedProperties && typeof rawExtendedProperties === "object"
    ? rawExtendedProperties as TaskCalendarExistingEvent["extendedProperties"]
    : null;
  return {
    id,
    calendar_id: typeof rec.calendar_id === "string" ? rec.calendar_id : typeof rec.calendarId === "string" ? rec.calendarId : null,
    summary: typeof rec.summary === "string" ? rec.summary : null,
    title: typeof rec.title === "string" ? rec.title : null,
    start: typeof rec.start === "string" ? rec.start : null,
    end: typeof rec.end === "string" ? rec.end : null,
    description: typeof rec.description === "string" ? rec.description : null,
    extendedProperties,
  };
}

export async function POST(req: NextRequest) {
  const authz = await authorize(req);
  if (!authz.ok) return authz.res;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.dry_run === false || body.execute === true) {
    return NextResponse.json({
      ok: false,
      error: "calendar_write_disabled",
      message: "This endpoint is dry-run only. H-1 must write Calendar events through the Calendar connector after the write gate.",
    }, { status: 409 });
  }

  const tasks = Array.isArray(body.tasks)
    ? body.tasks.map(normalizeTask).filter((task): task is TaskCalendarSource => task !== null)
    : [];
  if (tasks.length === 0) return NextResponse.json({ error: "tasks array required" }, { status: 400 });

  const busyWindows = Array.isArray(body.busy_windows)
    ? body.busy_windows.map(normalizeBusy).filter((busy): busy is TaskCalendarBusyWindow => busy !== null)
    : [];
  const existingEvents = Array.isArray(body.existing_task_events)
    ? body.existing_task_events.map(normalizeExistingEvent).filter((event): event is TaskCalendarExistingEvent => event !== null)
    : [];
  const now = typeof body.now === "string" ? new Date(body.now) : new Date();
  const plans = buildTaskCalendarSchedulePlans(tasks, busyWindows, existingEvents, Number.isNaN(now.getTime()) ? new Date() : now);

  return NextResponse.json({
    ok: true,
    dry_run: true,
    write_enabled: false,
    created_by: authz.createdBy,
    summary: plans.reduce((acc, plan) => {
      acc[plan.action] = (acc[plan.action] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    plans,
  });
}
