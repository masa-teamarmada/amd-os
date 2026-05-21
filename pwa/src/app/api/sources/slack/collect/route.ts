import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectSlackSourceRows } from "@/lib/sources/slack-source-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkCronAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  return !!cronSecret && authHeader === `Bearer ${cronSecret}`;
}

function boolParam(value: string | null, fallback = false) {
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export async function GET(req: NextRequest) {
  try {
    if (!checkCronAuth(req)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const projectId = req.nextUrl.searchParams.get("projectId")?.trim() || "";
    const ym = req.nextUrl.searchParams.get("ym")?.trim() || "";
    const save = req.nextUrl.searchParams.get("save") !== "0";
    const explicitChannelId = req.nextUrl.searchParams.get("channelId")?.trim() || "";
    const maxMessages = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get("maxMessages") || 120)));
    const includeBots = boolParam(req.nextUrl.searchParams.get("includeBots"), false);
    if (!projectId || !/^\d{6}$/.test(ym)) {
      return NextResponse.json({ ok: false, error: "projectId and ym=YYYYMM required" }, { status: 400 });
    }

    const token = process.env.SLACK_BOT_TOKEN || "";
    if (!token) {
      return NextResponse.json({ ok: false, error: "SLACK_BOT_TOKEN is missing" }, { status: 500 });
    }

    const supabase = createAdminClient();
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("project_id, project_name, slack_channel_id")
      .eq("project_id", projectId)
      .maybeSingle();
    if (projectError) return NextResponse.json({ ok: false, error: projectError.message }, { status: 500 });
    if (!project) return NextResponse.json({ ok: false, error: `project not found: ${projectId}` }, { status: 404 });

    const channelId = explicitChannelId || project.slack_channel_id || "";
    if (!channelId) {
      return NextResponse.json({ ok: true, project, ym, rows: [], savedCount: 0, note: "slack_channel_id empty" });
    }

    const collected = await collectSlackSourceRows({
      token,
      projectId,
      projectName: project.project_name,
      ym,
      channelId,
      maxMessages,
      includeBots,
    });

    let savedCount = 0;
    if (save && collected.rows.length) {
      const { error } = await supabase
        .from("source_cache")
        .upsert(collected.rows, { onConflict: "project_id,source,item_id" });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      savedCount = collected.rows.length;
    }

    return NextResponse.json({
      ok: true,
      project: { project_id: project.project_id, project_name: project.project_name },
      ym,
      channelId,
      channelName: collected.channelName,
      messageCount: collected.messageCount,
      threadReplyCount: collected.threadReplyCount,
      savedCount,
      rows: collected.previews,
      includeBots,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[sources/slack/collect]", message, error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
