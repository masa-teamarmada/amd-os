import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  collectSlackSourceRows,
  type SlackSourceCacheRow,
  type SlackSourcePreview,
} from "@/lib/sources/slack-source-cache";
import {
  DEFAULT_SLACK_WORKSPACE_KEY,
  normalizeWorkspaceKey,
  slackEnvNameForWorkspace,
  slackTokenForWorkspace,
} from "@/lib/slack/workspace-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSERT_CHUNK = 400;

type CollectTarget = {
  workspaceKey: string;
  channelId: string;
  channelName: string | null;
};

type ChannelResult = {
  workspaceKey: string;
  channelId: string;
  channelName: string | null;
  messageCount?: number;
  threadReplyCount?: number;
  skipped?: string;
  error?: string;
};

function checkCronAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  return !!cronSecret && authHeader === `Bearer ${cronSecret}`;
}

function boolParam(value: string | null, fallback = false) {
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

/**
 * 取り込み対象チャンネルの決定。
 * 1. channelId 明示指定があればそれだけ
 * 2. project_slack_sources の enabled 行 (複数チャンネル・複数ワークスペース)
 * 3. どちらも無ければ projects.slack_channel_id を armada の1件として扱う
 */
async function resolveTargets(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
  explicitChannelId: string,
  explicitWorkspaceKey: string,
  fallbackChannelId: string | null
): Promise<CollectTarget[]> {
  if (explicitChannelId) {
    return [{
      workspaceKey: normalizeWorkspaceKey(explicitWorkspaceKey),
      channelId: explicitChannelId,
      channelName: null,
    }];
  }

  const { data, error } = await supabase
    .from("project_slack_sources")
    .select("workspace_key, channel_id, channel_name")
    .eq("project_id", projectId)
    .eq("enabled", true)
    .order("workspace_key", { ascending: true })
    .order("channel_id", { ascending: true });
  if (error) throw new Error(error.message);

  const configured = (data || [])
    .map((row) => ({
      workspaceKey: normalizeWorkspaceKey(row.workspace_key as string | null),
      channelId: String(row.channel_id || "").trim(),
      channelName: (row.channel_name as string | null) || null,
    }))
    .filter((target) => target.channelId);
  if (configured.length) return configured;

  const fallback = String(fallbackChannelId || "").trim();
  return fallback
    ? [{ workspaceKey: DEFAULT_SLACK_WORKSPACE_KEY, channelId: fallback, channelName: null }]
    : [];
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

    const targets = await resolveTargets(
      supabase,
      projectId,
      explicitChannelId,
      explicitWorkspaceKey,
      project.slack_channel_id
    );
    if (!targets.length) {
      return NextResponse.json({
        ok: true,
        project: { project_id: project.project_id, project_name: project.project_name },
        ym,
        channels: [],
        rows: [],
        savedCount: 0,
        note: "no slack channel configured",
      });
    }

    const allRows: SlackSourceCacheRow[] = [];
    const allPreviews: SlackSourcePreview[] = [];
    const channels: ChannelResult[] = [];
    let messageCount = 0;
    let threadReplyCount = 0;

    for (const target of targets) {
      const token = slackTokenForWorkspace(target.workspaceKey);
      if (!token) {
        channels.push({
          workspaceKey: target.workspaceKey,
          channelId: target.channelId,
          channelName: target.channelName,
          skipped: `${slackEnvNameForWorkspace(target.workspaceKey)} is missing`,
        });
        continue;
      }
      try {
        const collected = await collectSlackSourceRows({
          token,
          projectId,
          projectName: project.project_name,
          ym,
          channelId: target.channelId,
          channelName: target.channelName,
          maxMessages,
          includeBots,
        });
        allRows.push(...collected.rows);
        allPreviews.push(...collected.previews);
        messageCount += collected.messageCount;
        threadReplyCount += collected.threadReplyCount;
        channels.push({
          workspaceKey: target.workspaceKey,
          channelId: target.channelId,
          channelName: collected.channelName,
          messageCount: collected.messageCount,
          threadReplyCount: collected.threadReplyCount,
        });
      } catch (channelError) {
        const message = channelError instanceof Error ? channelError.message : String(channelError);
        console.error("[sources/slack/collect] channel failed", target.workspaceKey, target.channelId, message);
        channels.push({
          workspaceKey: target.workspaceKey,
          channelId: target.channelId,
          channelName: target.channelName,
          error: message,
        });
      }
    }

    const succeeded = channels.filter((channel) => !channel.skipped && !channel.error);
    if (!succeeded.length) {
      return NextResponse.json(
        { ok: false, error: "all slack channels failed", channels },
        { status: 500 }
      );
    }

    let savedCount = 0;
    if (save && allRows.length) {
      for (let i = 0; i < allRows.length; i += UPSERT_CHUNK) {
        const chunk = allRows.slice(i, i + UPSERT_CHUNK);
        const { error } = await supabase
          .from("source_cache")
          .upsert(chunk, { onConflict: "project_id,source,item_id" });
        if (error) return NextResponse.json({ ok: false, error: error.message, channels }, { status: 500 });
        savedCount += chunk.length;
      }
    }

    const primary = succeeded[0];
    return NextResponse.json({
      ok: true,
      project: { project_id: project.project_id, project_name: project.project_name },
      ym,
      // 後方互換: 単一チャンネル時代からのキー。内訳は channels を見る。
      channelId: primary.channelId,
      channelName: primary.channelName,
      messageCount,
      threadReplyCount,
      savedCount,
      channels,
      rows: allPreviews,
      includeBots,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[sources/slack/collect]", message, error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
