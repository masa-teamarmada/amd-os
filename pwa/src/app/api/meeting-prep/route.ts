/**
 * POST /api/meeting-prep
 *
 * Upcoming meeting prep rows for PJ cockpit MTG summary.
 *
 * Stores "scheduled but not yet held" meetings in project_meeting_summaries
 * with source_kinds='upcoming'. This keeps the cockpit timeline unified:
 * upcoming prep -> held meeting summary -> dialogue meeting log.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0)
    .slice(0, 40);
}

function validYmd(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function validYm(value: unknown, meetingDate: string): string {
  if (typeof value === "string" && /^\d{6}$/.test(value)) return value;
  return meetingDate.slice(0, 4) + meetingDate.slice(5, 7);
}

function normalizeIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function fallbackMeetingId(projectId: string, meetingDate: string, title: string, calendarEventId: string | null): string {
  if (calendarEventId) return `upcoming:${calendarEventId}`;
  const titleHash = sha256(title).slice(0, 12);
  return `upcoming:${projectId}:${meetingDate.replace(/-/g, "")}:${titleHash}`;
}

async function authorize(req: NextRequest): Promise<{ ok: true; createdBy: string } | { ok: false; res: NextResponse }> {
  const auth = req.headers.get("authorization") || "";
  const workflowSecret = process.env.WORKFLOW_SECRET || process.env.CRON_SECRET || "";
  if (workflowSecret && auth === `Bearer ${workflowSecret}`) return { ok: true, createdBy: "workflow" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const { data: member } = await supabase
    .from("members")
    .select("code_name, is_admin")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (!member?.is_admin) {
    return { ok: false, res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true, createdBy: member.code_name || user.email };
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
    decided: Array.isArray(row.decided) ? row.decided : [],
    progress: Array.isArray(row.progress) ? row.progress : [],
    nextActions: Array.isArray(row.next_actions) ? row.next_actions : [],
    risks: Array.isArray(row.risks) ? row.risks : [],
    narrativeMd: row.narrative_md ?? null,
    generatedAt: row.generated_at,
    generatedByModel: row.generated_by_model ?? null,
    sourceKinds: row.source_kinds ?? null,
    prepStatus: row.prep_status ?? null,
    prepReadinessScore: row.prep_readiness_score ?? null,
    prepReadinessReasons: row.prep_readiness_reasons ?? null,
    prepDraftMd: row.prep_draft_md ?? null,
    prepDriveAssetId: row.prep_drive_asset_id ?? null,
    prepNotionPageId: row.prep_notion_page_id ?? null,
    prepWorkerSessionId: row.prep_worker_session_id ?? null,
    prepWorkerSessionUrl: row.prep_worker_session_url ?? null,
    prepWorkerStatus: row.prep_worker_status ?? null,
    prepWorkerSpawnedAt: row.prep_worker_spawned_at ?? null,
    prepWorkerReadyAt: row.prep_worker_ready_at ?? null,
    prepConciergeNudgedAt: row.prep_concierge_nudged_at ?? null,
  };
}

export async function POST(req: NextRequest) {
  const authz = await authorize(req);
  if (!authz.ok) return authz.res;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const projectId = String(body.project_id ?? "").trim();
  const meetingDate = validYmd(body.meeting_date);
  const title = String(body.title ?? "").trim();
  if (!projectId || !meetingDate || !title) {
    return NextResponse.json({ error: "project_id, meeting_date, title are required" }, { status: 400 });
  }

  const summaryShort = String(body.summary_short ?? "").trim();
  const decided = ensureStringArray(body.decided);
  const progress = ensureStringArray(body.progress);
  const nextActions = ensureStringArray(body.next_actions);
  const risks = ensureStringArray(body.risks);
  const narrativeMd = typeof body.narrative_md === "string" ? body.narrative_md.trim() : "";
  const calendarEventId = typeof body.calendar_event_id === "string" && body.calendar_event_id.trim()
    ? body.calendar_event_id.trim()
    : null;
  const meetingId = typeof body.meeting_id === "string" && body.meeting_id.trim()
    ? body.meeting_id.trim()
    : fallbackMeetingId(projectId, meetingDate, title, calendarEventId);
  const meetingStartAt = normalizeIso(body.meeting_start_at);
  const sourceUrl = typeof body.source_url === "string" && body.source_url.trim() ? body.source_url.trim() : null;
  const requestedPrepStatus = typeof body.prep_status === "string" && body.prep_status.trim()
    ? body.prep_status.trim()
    : null;
  const isTentative = body.is_tentative === true || requestedPrepStatus === "tentative" || !meetingStartAt;
  const prepStatus = requestedPrepStatus || (isTentative ? "tentative" : "draft");
  const sourceKinds = isTentative ? "upcoming_tentative" : "upcoming";
  const generatedByModel = typeof body.generated_by_model === "string" && body.generated_by_model.trim()
    ? body.generated_by_model.trim()
    : "codex-eimi";
  const ym = validYm(body.ym, meetingDate);
  const now = new Date().toISOString();
  const sourceHash = sha256(JSON.stringify({
    projectId,
    meetingDate,
    meetingStartAt,
    title,
    summaryShort,
    decided,
    progress,
    nextActions,
    risks,
    narrativeMd,
    sourceUrl,
    calendarEventId,
    prepStatus,
    sourceKinds,
  }));

  const row = {
    meeting_id: meetingId,
    project_id: projectId,
    ym,
    meeting_date: meetingDate,
    meeting_start_at: meetingStartAt,
    title: title.slice(0, 500),
    notion_url: null,
    notion_page_id: null,
    calendar_event_id: calendarEventId,
    source_url: sourceUrl,
    summary_short: summaryShort.slice(0, 2000),
    decided,
    progress,
    next_actions: nextActions,
    risks,
    narrative_md: narrativeMd || null,
    gmail_thread_ids: [],
    source_kinds: sourceKinds,
    source_hash: sourceHash,
    generated_by_model: generatedByModel,
    generated_at: now,
    prep_status: prepStatus,
    updated_at: now,
  };

  const admin = createAdminClient();

  // ended / frozen PJ の未来MTG prep (upcoming) は作らない (2026-06-03 まさ確定原則)。
  // upcoming = これから開催予定の prep なので、終了/凍結後の PJ に作るのは無意味。
  // frozen 判定は status='frozen' または freeze_from_ym <= 対象 ym。
  const { data: prepProj } = await admin
    .from("projects")
    .select("status, freeze_from_ym")
    .eq("project_id", projectId)
    .maybeSingle();
  const prepStatusProj = (prepProj as { status: string | null } | null)?.status ?? null;
  const prepFreezeFrom = (prepProj as { freeze_from_ym: string | null } | null)?.freeze_from_ym ?? null;
  const isInactive =
    prepStatusProj === "ended" ||
    prepStatusProj === "frozen" ||
    (!!prepFreezeFrom && ym >= prepFreezeFrom);
  if (isInactive) {
    return NextResponse.json({
      ok: false,
      skipped: true,
      reason: `skip:inactive-project-${prepStatusProj ?? "frozen"}`,
      message: "ended/frozen PJ の未来MTG prep は生成しません",
    });
  }

  const { data, error } = await admin
    .from("project_meeting_summaries")
    .upsert(row, { onConflict: "meeting_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, meeting: toClientMeeting(data as Record<string, unknown>), mode: "upserted", created_by: authz.createdBy });
}
