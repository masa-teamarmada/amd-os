import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  weeklySlackReportDeliveryDecision,
  weeklySlackReportEnabled,
  weeklySlackReportSettingKey,
  type WeeklySlackReportProject,
} from "@/lib/weekly-slack-report";

export const runtime = "nodejs";

type ProjectRow = WeeklySlackReportProject & {
  project_name: string;
};

type SourceCacheRow = {
  source: string | null;
  title: string | null;
  item_date: string | null;
  content_text: string | null;
};

type MeetingSummaryRow = {
  meeting_date: string | null;
  title: string | null;
  summary_short: string | null;
  decided: unknown;
  next_actions: unknown;
  risks: unknown;
};

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function readProjectDeliveryDecision(projectId: string) {
  const db = createAdminClient();
  const { data: project, error: projectError } = await db
    .from("projects")
    .select("project_id,project_name,slack_channel_id,slack_channel_not_required")
    .eq("project_id", projectId)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) return null;

  const { data: settings, error: settingsError } = await db
    .from("settings")
    .select("key,value")
    .eq("key", weeklySlackReportSettingKey(project.project_id));
  if (settingsError) throw settingsError;

  const typedProject = project as ProjectRow;
  return {
    project: typedProject,
    decision: weeklySlackReportDeliveryDecision(
      typedProject,
      weeklySlackReportEnabled(typedProject.project_id, settings ?? []),
    ),
  };
}

function startOfSevenDayWindow(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function shortText(value: unknown, maxLength: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function listText(value: unknown, maxLength: number): string {
  if (!Array.isArray(value)) return "";
  return shortText(value.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join(" / "), maxLength);
}

async function loadEvidenceBundle(project: ProjectRow) {
  const since = startOfSevenDayWindow();
  const db = createAdminClient();
  const [{ data: sourceRows, error: sourceError }, { data: meetingRows, error: meetingError }] = await Promise.all([
    db
      .from("source_cache")
      .select("source,title,item_date,content_text")
      .eq("project_id", project.project_id)
      .gte("item_date", since)
      .order("item_date", { ascending: false })
      .limit(60),
    db
      .from("project_meeting_summaries")
      .select("meeting_date,title,summary_short,decided,next_actions,risks")
      .eq("project_id", project.project_id)
      .gte("meeting_date", since.slice(0, 10))
      .order("meeting_date", { ascending: false })
      .limit(20),
  ]);
  if (sourceError) throw sourceError;
  if (meetingError) throw meetingError;

  const sourceEvidence = ((sourceRows ?? []) as SourceCacheRow[]).map((row) => ({
    kind: row.source ?? "source_cache",
    date: row.item_date,
    title: shortText(row.title, 240),
    text: shortText(row.content_text, 1_200),
  }));
  const meetingEvidence = ((meetingRows ?? []) as MeetingSummaryRow[]).map((row) => ({
    kind: "meeting",
    date: row.meeting_date,
    title: shortText(row.title, 240),
    summary: shortText(row.summary_short, 1_200),
    decided: listText(row.decided, 800),
    nextActions: listText(row.next_actions, 800),
    risks: listText(row.risks, 800),
  }));
  return {
    windowStart: since,
    windowEnd: new Date().toISOString(),
    project: { projectId: project.project_id, projectName: project.project_name },
    evidence: [...sourceEvidence, ...meetingEvidence],
  };
}

/**
 * LLM実行前に、現在週次レポートを許可しているPJだけを取り出す。
 * 宛先チャンネルは返さず、投稿時も projectId を受けてPWAが再読する。
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const requestedProjectId = request.nextUrl.searchParams.get("projectId")?.trim();
    if (requestedProjectId) {
      const target = await readProjectDeliveryDecision(requestedProjectId);
      if (!target) {
        return NextResponse.json({ ok: false, error: "project not found" }, { status: 404 });
      }
      if (!target.decision.allowed) {
        return NextResponse.json({ ok: true, projectId: requestedProjectId, allowed: false, skipped: target.decision.reason });
      }
      const bundle = await loadEvidenceBundle(target.project);
      return NextResponse.json({ ok: true, allowed: true, ...bundle });
    }

    const db = createAdminClient();
    const [{ data: projects, error: projectsError }, { data: settings, error: settingsError }] = await Promise.all([
      db
        .from("projects")
        .select("project_id,project_name,slack_channel_id,slack_channel_not_required")
        .not("slack_channel_id", "is", null)
        .eq("slack_channel_not_required", false)
        .order("project_name"),
      db
        .from("settings")
        .select("key,value")
        .like("key", "weekly_slack_report.%.enabled"),
    ]);
    if (projectsError) throw projectsError;
    if (settingsError) throw settingsError;

    const targets = ((projects ?? []) as ProjectRow[])
      .filter((project) => weeklySlackReportDeliveryDecision(
        project,
        weeklySlackReportEnabled(project.project_id, settings ?? []),
      ).allowed)
      .map((project) => ({ projectId: project.project_id, projectName: project.project_name }));

    return NextResponse.json({ ok: true, targets });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "target lookup failed" }, { status: 500 });
  }
}

/**
 * LLMが作った本文を渡す唯一の外部送信口。
 * 生成後でも設定が停止されていれば、ここで必ず送信を止める。
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { projectId?: unknown; text?: unknown; dryRun?: unknown };
  try {
    body = await request.json() as { projectId?: unknown; text?: unknown; dryRun?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!projectId || !text) {
    return NextResponse.json({ ok: false, error: "projectId and text are required" }, { status: 400 });
  }
  if (text.length > 40_000) {
    return NextResponse.json({ ok: false, error: "text is too long" }, { status: 400 });
  }
  if (body.dryRun !== undefined && typeof body.dryRun !== "boolean") {
    return NextResponse.json({ ok: false, error: "dryRun must be boolean" }, { status: 400 });
  }

  try {
    const target = await readProjectDeliveryDecision(projectId);
    if (!target) {
      return NextResponse.json({ ok: false, error: "project not found" }, { status: 404 });
    }
    if (!target.decision.allowed) {
      return NextResponse.json({ ok: true, projectId, sent: false, skipped: target.decision.reason });
    }
    if (body.dryRun) {
      return NextResponse.json({ ok: true, projectId, sent: false, dryRun: true });
    }

    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      return NextResponse.json({ ok: false, error: "SLACK_BOT_TOKEN not configured" }, { status: 503 });
    }
    const result = await new WebClient(token).chat.postMessage({
      channel: target.project.slack_channel_id!.trim(),
      text,
    });
    return NextResponse.json({ ok: true, projectId, sent: true, messageTs: result.ts ?? null });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Slack delivery failed" }, { status: 502 });
  }
}
