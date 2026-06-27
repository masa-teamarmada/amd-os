/**
 * POST /api/task-calendar/register-tasks
 *
 * H-1 meeting flow turns meeting minutes / MTG next actions / Gmail TODO /
 * Slack TODO into canonical AMD OS tasks, then nudges only the task owner.
 * Calendar writes remain outside this route.
 */

import { WebClient } from "@slack/web-api";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildTaskOwnerSlackNudge,
  buildTaskRegistrationRow,
  normalizeTaskRegistrationSource,
  type NormalizedTaskRegistrationSource,
} from "@/lib/task-calendar-register";

export const runtime = "nodejs";

type ProjectInfo = {
  project_id: string;
  project_name: string | null;
};

type MemberInfo = {
  member_id: string;
  code_name: string | null;
  slack_id: string | null;
};

async function authorize(req: NextRequest): Promise<{ ok: true; actor: string } | { ok: false; res: NextResponse }> {
  const auth = req.headers.get("authorization") || "";
  const workflowSecret = process.env.WORKFLOW_SECRET || process.env.CRON_SECRET || "";
  if (workflowSecret && auth === `Bearer ${workflowSecret}`) return { ok: true, actor: "workflow:h1_meeting_flow" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };

  const { data: member } = await supabase
    .from("members")
    .select("code_name, is_admin")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (!member?.is_admin) return { ok: false, res: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  return { ok: true, actor: member.code_name || user.email };
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://amd-os-pwa.vercel.app").replace(/\/$/, "");
}

async function sendOwnerSlackNudge(slackUserId: string, text: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { sent: false, reason: "slack_token_missing", ts: null as string | null };
  const client = new WebClient(token);
  const res = await client.chat.postMessage({
    channel: slackUserId,
    text,
    unfurl_links: false,
    unfurl_media: false,
  });
  return { sent: Boolean(res.ok), reason: res.ok ? null : String(res.error || "slack_post_failed"), ts: res.ts ?? null };
}

export async function POST(req: NextRequest) {
  const authz = await authorize(req);
  if (!authz.ok) return authz.res;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const dryRun = body.dry_run === true;
  const sendSlack = body.send_slack === true;
  const renotifyExisting = body.renotify_existing === true;
  const sessionId = cleanText(body.agent_session_id, 160);
  const sessionUrl = cleanText(body.agent_session_url, 1000);
  const sessionLabel = cleanText(body.agent_session_label, 160);

  const sources = Array.isArray(body.tasks)
    ? body.tasks.map(normalizeTaskRegistrationSource).filter((task): task is NormalizedTaskRegistrationSource => task !== null)
    : [];
  if (sources.length === 0) {
    return NextResponse.json({ ok: false, error: "tasks array required" }, { status: 400 });
  }

  const db = createAdminClient();
  const projectIds = [...new Set(sources.map((source) => source.projectId))];
  const ownerIds = [...new Set(sources.map((source) => source.ownerMemberId).filter((id): id is string => Boolean(id)))];
  const taskIds = [...new Set(sources.map((source) => source.taskId))];

  const [projectsRes, membersRes, existingTasksRes] = await Promise.all([
    db.from("projects").select("project_id,project_name").in("project_id", projectIds),
    ownerIds.length
      ? db.from("members").select("member_id,code_name,slack_id").in("member_id", ownerIds)
      : Promise.resolve({ data: [], error: null }),
    db.from("tasks").select("task_id,status,active").in("task_id", taskIds),
  ]);

  const firstError = projectsRes.error || membersRes.error || existingTasksRes.error;
  if (firstError) return NextResponse.json({ ok: false, error: firstError.message }, { status: 500 });

  const projects = new Map((projectsRes.data ?? []).map((project) => [project.project_id, project as ProjectInfo]));
  const members = new Map((membersRes.data ?? []).map((member) => [member.member_id, member as MemberInfo]));
  const existingTasks = new Map((existingTasksRes.data ?? []).map((task) => [String(task.task_id), task]));
  const nowIso = new Date().toISOString();
  const results = [];

  for (const source of sources) {
    const project = projects.get(source.projectId);
    const member = source.ownerMemberId ? members.get(source.ownerMemberId) : null;
    const ownerSlackId = source.ownerSlackUserId || member?.slack_id || null;
    const existing = existingTasks.get(source.taskId);
    const reasons: string[] = [];

    if (!project) reasons.push("project_not_found");
    if (!source.ownerMemberId) reasons.push("missing_owner_member_id");
    if (!ownerSlackId) reasons.push("missing_owner_slack_id");

    const row = buildTaskRegistrationRow({
      source,
      assigneeCodeName: member?.code_name ?? null,
      actor: authz.actor,
      nowIso,
      sessionId,
      sessionUrl,
      sessionLabel,
    });

    let action: "created" | "already_exists" | "skipped" = "skipped";
    let task = existing ?? null;
    let taskError: string | null = null;

    if (!project) {
      action = "skipped";
    } else if (existing) {
      action = "already_exists";
    } else if (dryRun) {
      action = "created";
    } else {
      const { data, error } = await db.from("tasks").insert(row).select("*").single();
      if (error) {
        action = "skipped";
        taskError = error.message;
      } else {
        action = "created";
        task = data;
      }
    }

    let slack: {
      planned: boolean;
      sent: boolean;
      skipped: boolean;
      reason: string | null;
      slack_user_id: string | null;
      ts: string | null;
    } = {
      planned: Boolean(ownerSlackId),
      sent: false,
      skipped: true,
      reason: ownerSlackId ? "send_slack_false" : "missing_owner_slack_id",
      slack_user_id: ownerSlackId,
      ts: null as string | null,
    };
    const shouldNudge = Boolean(ownerSlackId)
      && sendSlack
      && !dryRun
      && (action === "created" || (action === "already_exists" && renotifyExisting));

    if (shouldNudge && ownerSlackId) {
      const text = buildTaskOwnerSlackNudge({
        source,
        appUrl: appUrl(),
        taskId: source.taskId,
        projectName: project?.project_name ?? null,
      });
      const sent = await sendOwnerSlackNudge(ownerSlackId, text).catch((err: unknown) => ({
        sent: false,
        reason: err instanceof Error ? err.message : "slack_post_failed",
        ts: null,
      }));
      slack = {
        planned: true,
        sent: sent.sent,
        skipped: !sent.sent,
        reason: sent.reason || null,
        slack_user_id: ownerSlackId,
        ts: sent.ts,
      };
    }

    results.push({
      task_id: source.taskId,
      project_id: source.projectId,
      title: source.title,
      action,
      dry_run: dryRun,
      task_error: taskError,
      existing: Boolean(existing),
      task_created: action === "created" && !dryRun && !taskError,
      task: task ? { task_id: task.task_id, status: task.status, active: task.active } : dryRun ? row : null,
      slack,
      warnings: reasons,
      source_key: source.sourceKey,
    });
  }

  return NextResponse.json({
    ok: true,
    dry_run: dryRun,
    send_slack: sendSlack,
    summary: results.reduce((acc, result) => {
      acc[result.action] = (acc[result.action] ?? 0) + 1;
      if (result.slack.sent) acc.slack_sent = (acc.slack_sent ?? 0) + 1;
      if (result.slack.planned && !result.slack.sent) acc.slack_pending_or_skipped = (acc.slack_pending_or_skipped ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    results,
  });
}
