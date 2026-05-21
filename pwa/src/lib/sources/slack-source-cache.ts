import { createHash } from "crypto";
import { WebClient } from "@slack/web-api";

type SlackFile = {
  id?: string;
  name?: string;
  title?: string;
  mimetype?: string;
  permalink?: string;
};

type SlackReaction = {
  name?: string;
  count?: number;
};

type SlackApiMessage = {
  type?: string;
  subtype?: string;
  ts?: string;
  user?: string;
  username?: string;
  bot_id?: string;
  app_id?: string;
  text?: string;
  thread_ts?: string;
  reply_count?: number | string;
  files?: SlackFile[];
  reactions?: SlackReaction[];
};

export type SlackSourceCacheRow = {
  cache_id: string;
  project_id: string;
  ym: string;
  source: "slack";
  item_id: string;
  title: string;
  item_date: string;
  content_text: string;
  char_count: number;
  metadata_json: Record<string, unknown>;
  collected_at: string;
};

export type SlackSourcePreview = {
  item_id: string;
  title: string;
  item_date: string;
  user: string | null;
  permalink: string | null;
  text_preview: string;
  reply_count: number;
};

export type SlackSourceCollectOptions = {
  token: string;
  projectId: string;
  projectName?: string | null;
  ym: string;
  channelId: string;
  channelName?: string | null;
  maxMessages?: number;
  includeBots?: boolean;
  includeReplies?: boolean;
};

export type SlackSourceCollectResult = {
  ok: true;
  projectId: string;
  ym: string;
  channelId: string;
  channelName: string;
  messageCount: number;
  threadReplyCount: number;
  rows: SlackSourceCacheRow[];
  previews: SlackSourcePreview[];
};

export function ymBounds(ym: string) {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return {
    start,
    end,
    oldest: String(Math.floor(start.getTime() / 1000)),
    latest: String(Math.floor(end.getTime() / 1000)),
  };
}

function slackTsToDate(ts: string | undefined) {
  const seconds = Number.parseFloat(String(ts || "0"));
  if (!Number.isFinite(seconds) || seconds <= 0) return new Date(0);
  return new Date(seconds * 1000);
}

function isWithin(date: Date, start: Date, end: Date) {
  return date >= start && date < end;
}

function normalizeSlackText(value: string | null | undefined) {
  return String(value || "")
    .replace(/<@([A-Z0-9]+)>/g, "@$1")
    .replace(/<#([A-Z0-9]+)\|([^>]+)>/g, "#$2")
    .replace(/<([^>|]+)\|([^>]+)>/g, "$2 ($1)")
    .replace(/<([^>]+)>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function compact(value: string | null | undefined, max = 700) {
  return normalizeSlackText(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function isBotMessage(message: SlackApiMessage) {
  return !!(
    message.subtype === "bot_message" ||
    message.bot_id ||
    message.app_id ||
    message.user === "USLACKBOT"
  );
}

function sender(message: SlackApiMessage) {
  return message.user || message.username || message.bot_id || null;
}

function replyCount(message: SlackApiMessage) {
  return Number(message.reply_count || 0) || 0;
}

function stableHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function fileLine(files: SlackFile[] | undefined) {
  const names = (files || [])
    .map((file) => file.title || file.name || file.id || "")
    .filter(Boolean);
  return names.length ? `Files: ${names.join(", ")}` : "";
}

async function getChannelName(client: WebClient, channelId: string, fallback?: string | null) {
  if (fallback) return fallback;
  try {
    const res = await client.conversations.info({ channel: channelId });
    const channel = res.channel as { name?: string } | undefined;
    return channel?.name || channelId;
  } catch {
    return channelId;
  }
}

async function getPermalink(client: WebClient, channelId: string, ts: string) {
  try {
    const res = await client.chat.getPermalink({ channel: channelId, message_ts: ts });
    return typeof res.permalink === "string" ? res.permalink : null;
  } catch {
    return null;
  }
}

function threadExcerpt(replies: SlackApiMessage[]) {
  const lines = replies
    .filter((reply) => reply.ts)
    .slice(0, 4)
    .map((reply) => {
      const at = slackTsToDate(reply.ts).toISOString();
      return `- ${at} ${sender(reply) || "unknown"}: ${compact(reply.text, 260)}`;
    })
    .filter((line) => line.trim().length > 0);
  return lines.join("\n").slice(0, 1200);
}

function buildContent(input: {
  message: SlackApiMessage;
  projectName?: string | null;
  channelName: string;
  channelId: string;
  permalink: string | null;
  threadReplies: SlackApiMessage[];
}) {
  const { message, projectName, channelName, channelId } = input;
  const at = slackTsToDate(message.ts).toISOString();
  const replies = threadExcerpt(input.threadReplies);
  return [
    projectName ? `PJ: ${projectName}` : "",
    `Slack: #${channelName} (${channelId})`,
    `日時: ${at}`,
    sender(message) ? `投稿者: ${sender(message)}` : "",
    input.permalink ? `Permalink: ${input.permalink}` : "",
    message.thread_ts ? `Thread: ${message.thread_ts}` : "",
    `Reply count: ${replyCount(message)}`,
    fileLine(message.files),
    "",
    `Snippet: ${compact(message.text, 700)}`,
    replies ? "\nThread replies excerpt:" : "",
    replies,
    "",
    "Slack全文はL2や通知へ保存しない。必要な正本情報は短いsnippet/hash/source refから抽出する。",
  ].filter(Boolean).join("\n");
}

function canKeepMessage(message: SlackApiMessage, start: Date, end: Date, includeBots: boolean) {
  if (!message.ts) return false;
  if (!includeBots && isBotMessage(message)) return false;
  if (!String(message.text || "").trim() && !(message.files || []).length) return false;
  return isWithin(slackTsToDate(message.ts), start, end);
}

export async function collectSlackSourceRows(
  options: SlackSourceCollectOptions
): Promise<SlackSourceCollectResult> {
  if (!options.token) throw new Error("SLACK_BOT_TOKEN is required");
  if (!options.projectId || !/^\d{6}$/.test(options.ym) || !options.channelId) {
    throw new Error("projectId, ym=YYYYMM, channelId are required");
  }

  const client = new WebClient(options.token);
  const { start, end, oldest, latest } = ymBounds(options.ym);
  const maxMessages = Math.min(500, Math.max(1, Number(options.maxMessages || 120)));
  const includeBots = options.includeBots === true;
  const includeReplies = options.includeReplies !== false;
  const channelName = await getChannelName(client, options.channelId, options.channelName);
  const byTs = new Map<string, SlackApiMessage>();
  const threadReplies = new Map<string, SlackApiMessage[]>();
  let cursor: string | undefined;
  let page = 0;

  while (page < 10 && byTs.size < maxMessages) {
    const res = await client.conversations.history({
      channel: options.channelId,
      oldest,
      latest,
      limit: 200,
      cursor,
    });
    const messages = ((res.messages || []) as SlackApiMessage[])
      .filter((message) => canKeepMessage(message, start, end, includeBots));
    for (const message of messages) {
      if (!message.ts) continue;
      byTs.set(message.ts, message);
      if (byTs.size >= maxMessages) break;
    }
    cursor = res.response_metadata?.next_cursor || undefined;
    page += 1;
    if (!res.has_more || !cursor) break;
  }

  if (includeReplies) {
    const roots = Array.from(byTs.values())
      .filter((message) => message.ts && (!message.thread_ts || message.thread_ts === message.ts) && replyCount(message) > 0)
      .slice(0, 50);
    for (const root of roots) {
      if (!root.ts || byTs.size >= maxMessages) break;
      try {
        const res = await client.conversations.replies({
          channel: options.channelId,
          ts: root.ts,
          limit: 100,
        });
        const replies = ((res.messages || []) as SlackApiMessage[])
          .slice(1)
          .filter((message) => canKeepMessage(message, start, end, includeBots));
        threadReplies.set(root.ts, replies);
        for (const reply of replies) {
          if (!reply.ts || byTs.size >= maxMessages) continue;
          byTs.set(reply.ts, reply);
        }
      } catch {
        threadReplies.set(root.ts, []);
      }
    }
  }

  const collectedAt = new Date().toISOString();
  const messages = Array.from(byTs.values())
    .filter((message) => message.ts)
    .sort((a, b) => Number.parseFloat(String(a.ts)) - Number.parseFloat(String(b.ts)))
    .slice(0, maxMessages);

  const rows: SlackSourceCacheRow[] = [];
  const previews: SlackSourcePreview[] = [];
  for (const message of messages) {
    const ts = String(message.ts);
    const at = slackTsToDate(ts).toISOString();
    const url = await getPermalink(client, options.channelId, ts);
    const replies = threadReplies.get(ts) || [];
    const content = buildContent({
      message,
      projectName: options.projectName,
      channelName,
      channelId: options.channelId,
      permalink: url,
      threadReplies: replies,
    });
    const text = normalizeSlackText(message.text);
    const itemId = `${options.channelId}:${ts}`;
    const preview = compact(message.text, 300) || fileLine(message.files) || "(file only)";
    const title = `Slack #${channelName} ${at.slice(0, 10)} ${sender(message) || "unknown"}`;
    rows.push({
      cache_id: `slack-api-${options.projectId}-${options.channelId}-${ts.replace(".", "_")}`,
      project_id: options.projectId,
      ym: options.ym,
      source: "slack",
      item_id: itemId,
      title,
      item_date: at,
      content_text: content,
      char_count: content.length,
      metadata_json: {
        channel_id: options.channelId,
        channel_name: channelName,
        slack_ts: ts,
        thread_ts: message.thread_ts || null,
        reply_count: replyCount(message),
        user: sender(message),
        is_bot: isBotMessage(message),
        permalink: url,
        source_url: url,
        text_preview: preview,
        text_sha256: text ? stableHash(text) : "",
        files: (message.files || []).map((file) => ({
          id: file.id || null,
          name: file.name || file.title || null,
          mimetype: file.mimetype || null,
          permalink: file.permalink || null,
        })),
        reactions: message.reactions || [],
      },
      collected_at: collectedAt,
    });
    previews.push({
      item_id: itemId,
      title,
      item_date: at,
      user: sender(message),
      permalink: url,
      text_preview: preview,
      reply_count: replyCount(message),
    });
  }

  const threadReplyCount = Array.from(threadReplies.values()).reduce((sum, replies) => sum + replies.length, 0);
  return {
    ok: true,
    projectId: options.projectId,
    ym: options.ym,
    channelId: options.channelId,
    channelName,
    messageCount: rows.length,
    threadReplyCount,
    rows,
    previews,
  };
}
