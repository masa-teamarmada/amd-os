/**
 * PJ単位のSlack取り込み。
 *
 * 取り込み対象は `project_slack_sources` (project_id × workspace_key × channel_id) を正とし、
 * 行が無いPJは従来どおり `projects.slack_channel_id` を armada の1件として扱う。
 * チャンネルごとに workspace_key でトークンを切り替えるので、1つのPJが
 * 複数ワークスペースの部屋を持てる (SX = team ARMADA + SolvioraX)。
 *
 * 手動の `/api/sources/slack/collect` と daily の `/api/cron/slack-source-sync` が
 * 同じ経路を通るように、収集本体はここに置く。
 */
import type { createAdminClient } from "@/lib/supabase/admin";
import {
  collectSlackSourceRows,
  type SlackSourceCacheRow,
  type SlackSourcePreview,
} from "./slack-source-cache";
import {
  DEFAULT_SLACK_WORKSPACE_KEY,
  normalizeWorkspaceKey,
  slackEnvNameForWorkspace,
  slackTokenForWorkspace,
} from "@/lib/slack/workspace-token";

type AdminClient = ReturnType<typeof createAdminClient>;

const UPSERT_CHUNK = 400;

export type SlackCollectTarget = {
  workspaceKey: string;
  channelId: string;
  channelName: string | null;
};

export type SlackChannelResult = {
  workspaceKey: string;
  channelId: string;
  channelName: string | null;
  messageCount?: number;
  threadReplyCount?: number;
  skipped?: string;
  error?: string;
};

export type SlackProjectCollectResult = {
  projectId: string;
  projectName: string | null;
  ym: string;
  channels: SlackChannelResult[];
  previews: SlackSourcePreview[];
  messageCount: number;
  threadReplyCount: number;
  savedCount: number;
  saveError?: string;
  note?: string;
};

/**
 * 1. channelId 明示指定があればそれだけ
 * 2. project_slack_sources の enabled 行
 * 3. どちらも無ければ projects.slack_channel_id を armada の1件として扱う
 */
export async function resolveSlackTargets(
  supabase: AdminClient,
  projectId: string,
  explicitChannelId: string,
  explicitWorkspaceKey: string,
  fallbackChannelId: string | null
): Promise<SlackCollectTarget[]> {
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

export async function collectProjectSlackSources(
  supabase: AdminClient,
  options: {
    projectId: string;
    projectName: string | null;
    fallbackChannelId: string | null;
    ym: string;
    save: boolean;
    maxMessages: number;
    includeBots: boolean;
    explicitChannelId?: string;
    explicitWorkspaceKey?: string;
  }
): Promise<SlackProjectCollectResult> {
  const targets = await resolveSlackTargets(
    supabase,
    options.projectId,
    options.explicitChannelId || "",
    options.explicitWorkspaceKey || "",
    options.fallbackChannelId
  );

  const base: SlackProjectCollectResult = {
    projectId: options.projectId,
    projectName: options.projectName,
    ym: options.ym,
    channels: [],
    previews: [],
    messageCount: 0,
    threadReplyCount: 0,
    savedCount: 0,
  };
  if (!targets.length) return { ...base, note: "no slack channel configured" };

  const rows: SlackSourceCacheRow[] = [];
  for (const target of targets) {
    const token = slackTokenForWorkspace(target.workspaceKey);
    if (!token) {
      base.channels.push({
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
        projectId: options.projectId,
        projectName: options.projectName,
        ym: options.ym,
        channelId: target.channelId,
        channelName: target.channelName,
        maxMessages: options.maxMessages,
        includeBots: options.includeBots,
      });
      rows.push(...collected.rows);
      base.previews.push(...collected.previews);
      base.messageCount += collected.messageCount;
      base.threadReplyCount += collected.threadReplyCount;
      base.channels.push({
        workspaceKey: target.workspaceKey,
        channelId: target.channelId,
        channelName: collected.channelName,
        messageCount: collected.messageCount,
        threadReplyCount: collected.threadReplyCount,
      });
    } catch (channelError) {
      const message = channelError instanceof Error ? channelError.message : String(channelError);
      console.error("[slack-project-collect]", options.projectId, target.channelId, message);
      base.channels.push({
        workspaceKey: target.workspaceKey,
        channelId: target.channelId,
        channelName: target.channelName,
        error: message,
      });
    }
  }

  if (options.save && rows.length) {
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK);
      const { error } = await supabase
        .from("source_cache")
        .upsert(chunk, { onConflict: "project_id,source,item_id" });
      if (error) {
        base.saveError = error.message;
        break;
      }
      base.savedCount += chunk.length;
    }
  }

  return base;
}

/** enabled な取り込み対象を持つPJ。行が無いPJは対象にしない。 */
export async function listSlackSourceProjects(supabase: AdminClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("project_slack_sources")
    .select("project_id")
    .eq("enabled", true);
  if (error) throw new Error(error.message);
  const ids = new Set<string>();
  for (const row of data || []) {
    const id = String(row.project_id || "").trim();
    if (id) ids.add(id);
  }
  return Array.from(ids).sort();
}
