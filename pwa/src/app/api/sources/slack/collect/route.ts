import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectProjectSlackSources } from "@/lib/sources/slack-project-collect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
    const explicitWorkspaceKey = req.nextUrl.searchParams.get("workspace")?.trim() || "";
    const maxMessages = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get("maxMessages") || 120)));
    const includeBots = boolParam(req.nextUrl.searchParams.get("includeBots"), false);
    if (!projectId || !/^\d{6}$/.test(ym)) {
      return NextResponse.json({ ok: false, error: "projectId and ym=YYYYMM required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("project_id, project_name, slack_channel_id")
      .eq("project_id", projectId)
      .maybeSingle();
    if (projectError) return NextResponse.json({ ok: false, error: projectError.message }, { status: 500 });
    if (!project) return NextResponse.json({ ok: false, error: `project not found: ${projectId}` }, { status: 404 });

    const result = await collectProjectSlackSources(supabase, {
      projectId,
      projectName: project.project_name,
      fallbackChannelId: project.slack_channel_id,
      ym,
      save,
      maxMessages,
      includeBots,
      explicitChannelId,
      explicitWorkspaceKey,
    });

    if (result.note === "no slack channel configured") {
      return NextResponse.json({
        ok: true,
        project: { project_id: project.project_id, project_name: project.project_name },
        ym,
        channels: [],
        rows: [],
        savedCount: 0,
        note: result.note,
      });
    }

    const succeeded = result.channels.filter((channel) => !channel.skipped && !channel.error);
    if (!succeeded.length) {
      return NextResponse.json(
        { ok: false, error: "all slack channels failed", channels: result.channels },
        { status: 500 }
      );
    }
    if (result.saveError) {
      return NextResponse.json(
        { ok: false, error: result.saveError, channels: result.channels },
        { status: 500 }
      );
    }

    const primary = succeeded[0];
    return NextResponse.json({
      ok: true,
      project: { project_id: project.project_id, project_name: project.project_name },
      ym,
      // 後方互換: 単一チャンネル時代からのキー。内訳は channels を見る。
      channelId: primary.channelId,
      channelName: primary.channelName,
      messageCount: result.messageCount,
      threadReplyCount: result.threadReplyCount,
      savedCount: result.savedCount,
      channels: result.channels,
      rows: result.previews,
      includeBots,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[sources/slack/collect]", message, error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
