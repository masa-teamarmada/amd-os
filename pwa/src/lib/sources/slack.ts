/**
 * Slack 生データ抽出 — bot token (xoxb-...) で search.messages を叩く。
 * env: SLACK_BOT_TOKEN
 *
 * 必要な OAuth scopes (Bot Token):
 *   search:read, channels:history, channels:read, groups:history, groups:read
 */

import { WebClient } from "@slack/web-api";

export interface SlackHit {
  channel: string;          // "#p11_bwe" 等
  user: string | null;
  ts: string;               // unix ts (秒)
  text: string;
  permalink: string | null;
}

export async function fetchSlackContext(query: string, limit = 30): Promise<SlackHit[]> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn("[slack] SLACK_BOT_TOKEN not set — skipping");
    return [];
  }
  const client = new WebClient(token);
  try {
    const r = await client.search.messages({ query, count: Math.min(limit, 100), sort: "timestamp", sort_dir: "desc" });
    const matches = r.messages?.matches ?? [];
    return matches.map((m) => ({
      channel: (m.channel as { name?: string } | undefined)?.name ?? "(?)",
      user: m.user ?? null,
      ts: m.ts ?? "",
      text: m.text ?? "",
      permalink: m.permalink ?? null,
    }));
  } catch (e) {
    console.error("[slack] search failed:", e);
    return [];
  }
}

/** 複数 channel から最近のメッセージを横断取得 (#p11_bwe 等の主要 channel)。
 *  channelNamePatterns で部分一致検索 */
export async function fetchSlackChannelHistory(
  channelNamePatterns: string[],
  perChannel = 50
): Promise<SlackHit[]> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return [];
  const client = new WebClient(token);
  const out: SlackHit[] = [];
  try {
    const allChannels = await client.conversations.list({ types: "public_channel,private_channel", limit: 1000 });
    const matched = (allChannels.channels ?? []).filter((c) =>
      channelNamePatterns.some((p) => (c.name ?? "").includes(p))
    );
    for (const ch of matched) {
      try {
        const hist = await client.conversations.history({ channel: ch.id!, limit: perChannel });
        for (const m of hist.messages ?? []) {
          if (!m.text) continue;
          out.push({
            channel: ch.name ?? "(?)",
            user: m.user ?? null,
            ts: m.ts ?? "",
            text: m.text,
            permalink: null,
          });
        }
      } catch (e) {
        console.warn(`[slack] channel ${ch.name} history failed:`, e);
      }
    }
  } catch (e) {
    console.error("[slack] conversations.list failed:", e);
  }
  return out;
}
