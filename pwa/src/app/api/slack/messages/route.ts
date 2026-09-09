/**
 * コックピット「Slack」タブの読み取り。
 *
 * 毎朝の取り込み (`/api/cron/slack-source-sync`) が `source_cache(source='slack')` へ
 * 貯めた会話を、そのまま読める形で返す。SolvioraX のようなフリープランの
 * ワークスペースは90日で履歴が消えるので、ここがその後の唯一の読み場所になる。
 *
 * 本文は `metadata_json.text_full` (取り込み時に保存した全文) を正とし、
 * 旧データのように無い場合だけ `text_preview` へ落ちる。
 *
 * 日次更新の読み取り専用データなので spec/5-10-reference-data-caching-current-spec.md の参照系として扱う。
 * 画面は必ず src/lib/slack/slack-messages-client.ts 経由で読む
 * (guard: scripts/check_reference_data_cache_contract.mjs)。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  SlackMessageItem,
  SlackMessageReply,
  SlackMessagesResult,
} from "@/lib/slack/slack-messages-types";

export const runtime = "nodejs";

const CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=600";
const PAGE_SIZE = 1000;
const MAX_MESSAGES = 3000;

type CacheRow = {
  item_id: string;
  item_date: string | null;
  content_text: string | null;
  collected_at: string | null;
  metadata_json: Record<string, unknown> | null;
};

/** PostgREST の1レスポンス上限を跨いでも取りこぼさないためのページ読み。 */
async function fetchAllRows<T>(
  label: string,
  buildQuery: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  hardLimit = MAX_MESSAGES,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label} lookup failed: ${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, truncated: false };
    if (rows.length >= hardLimit) return { rows: rows.slice(0, hardLimit), truncated: true };
  }
}

function str(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v || null;
}

function jstYm(now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** permalink のドメインからワークスペースを見分ける。取れない場合は空文字。 */
function workspaceLabelFromPermalink(permalink: string | null): string {
  if (!permalink) return "";
  const match = /^https?:\/\/([^./]+)\.slack\.com/i.exec(permalink);
  return match ? match[1] : "";
}

export async function GET(req: NextRequest) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId")?.trim() || "";
  if (!projectId) {
    return NextResponse.json(
      { ok: false, error: "projectId required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const supabase = createAdminClient();

    // 取り込み済みの月 (セレクタ用)
    const { rows: ymRows } = await fetchAllRows<{ ym: string }>(
      "slack months",
      (from, to) =>
        supabase
          .from("source_cache")
          .select("ym")
          .eq("project_id", projectId)
          .eq("source", "slack")
          .order("ym", { ascending: false })
          .range(from, to),
      20000,
    );
    const months = Array.from(new Set(ymRows.map((row) => String(row.ym || "")).filter(Boolean)))
      .sort()
      .reverse();

    const requestedYm = url.searchParams.get("ym")?.trim() || "";
    const ym = /^\d{6}$/.test(requestedYm) ? requestedYm : months[0] || jstYm();

    const { rows, truncated } = await fetchAllRows<CacheRow>(
      "slack messages",
      (from, to) =>
        supabase
          .from("source_cache")
          .select("item_id,item_date,content_text,collected_at,metadata_json")
          .eq("project_id", projectId)
          .eq("source", "slack")
          .eq("ym", ym)
          .order("item_date", { ascending: false, nullsFirst: false })
          .range(from, to),
    );

    // 発言者IDをメンバー名へ。社外の人はIDのまま残す。
    const userIds = new Set<string>();
    for (const row of rows) {
      const meta = row.metadata_json || {};
      const user = str(meta.user);
      if (user) userIds.add(user);
      for (const reply of (meta.thread_replies as Array<Record<string, unknown>>) || []) {
        const replyUser = str(reply?.user);
        if (replyUser) userIds.add(replyUser);
      }
    }
    const nameBySlackId = new Map<string, string>();
    if (userIds.size) {
      const { data: members } = await supabase
        .from("members")
        .select("slack_id, code_name")
        .in("slack_id", Array.from(userIds));
      for (const member of members || []) {
        const slackId = str(member.slack_id);
        const codeName = str(member.code_name);
        if (slackId && codeName) nameBySlackId.set(slackId, codeName);
      }
    }

    const channelCounts = new Map<string, { channelId: string; channelName: string; workspaceLabel: string; count: number }>();
    let lastCollectedAt: string | null = null;

    const messages: SlackMessageItem[] = rows.map((row) => {
      const meta = row.metadata_json || {};
      const permalink = str(meta.permalink) || str(meta.source_url);
      const channelId = str(meta.channel_id) || row.item_id.split(":")[0] || "";
      const channelName = str(meta.channel_name) || channelId;
      const workspaceLabel = workspaceLabelFromPermalink(permalink);
      const user = str(meta.user);
      const collectedAt = str(row.collected_at);
      if (collectedAt && (!lastCollectedAt || collectedAt > lastCollectedAt)) lastCollectedAt = collectedAt;

      const bucket = channelCounts.get(channelId) || { channelId, channelName, workspaceLabel, count: 0 };
      bucket.count += 1;
      if (!bucket.workspaceLabel && workspaceLabel) bucket.workspaceLabel = workspaceLabel;
      channelCounts.set(channelId, bucket);

      const replies: SlackMessageReply[] = ((meta.thread_replies as Array<Record<string, unknown>>) || [])
        .map((reply) => {
          const replyUser = str(reply?.user);
          return {
            ts: String(reply?.ts ?? ""),
            user: replyUser,
            userName: (replyUser ? nameBySlackId.get(replyUser) : null) ?? str(reply?.user_name),
            isBot: reply?.is_bot === true,
            text: String(reply?.text ?? ""),
          };
        })
        .filter((reply) => reply.ts);

      return {
        itemId: row.item_id,
        channelId,
        channelName,
        workspaceLabel,
        ts: str(meta.slack_ts) || row.item_id.split(":")[1] || "",
        threadTs: str(meta.thread_ts),
        at: row.item_date || "",
        user,
        userName: (user ? nameBySlackId.get(user) : null) ?? str(meta.user_name),
        isBot: meta.is_bot === true,
        // 全文。旧データは取り込み直すまで抜粋しか無いのでそこへ落ちる。
        text: String(meta.text_full ?? meta.text_preview ?? "").trim(),
        permalink,
        replyCount: Number(meta.reply_count || 0) || 0,
        replies,
        files: ((meta.files as Array<Record<string, unknown>>) || []).map((file) => ({
          name: str(file?.name),
          permalink: str(file?.permalink),
          mimetype: str(file?.mimetype),
        })),
      };
    });

    const data: SlackMessagesResult = {
      projectId,
      ym,
      months,
      channels: Array.from(channelCounts.values()).sort((a, b) => b.count - a.count),
      messages,
      lastCollectedAt,
      truncated,
    };

    return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (cause) {
    console.error("[slack messages GET]", cause);
    return NextResponse.json(
      { ok: false, error: cause instanceof Error ? cause.message : "slack messages lookup failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
