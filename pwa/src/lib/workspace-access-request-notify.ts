import "server-only";

import { WebClient } from "@slack/web-api";
import type { ActionsBlockElement } from "@slack/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type RequestRow = {
  id: string;
  email_normalized: string;
  requested_path: string;
  target_kind: "institution" | "project" | "unspecified";
  workspace_slug: string | null;
  project_id: string | null;
  request_count: number;
  last_requested_at: string;
  status: string;
};

function targetLabel(request: RequestRow): string {
  if (request.target_kind === "institution" && request.workspace_slug) {
    return `研究機関ワークスペース「${request.workspace_slug}」`;
  }
  if (request.target_kind === "project" && request.project_id) {
    return `PJワークスペース「${request.project_id}」`;
  }
  return "対象未特定（管理画面で権限範囲の選択が必要）";
}

function shortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/xox[baprs]-[A-Za-z0-9-]+/g, "[伏せ字]").slice(0, 240);
}

/**
 * Sends one DM to Masa for a pending unknown-account request. The DB claim
 * enforces a 30-minute per-request cooldown and a global 20/hour budget.
 */
export async function notifyWorkspaceAccessRequest(
  db: SupabaseClient,
  requestId: string,
  adminOrigin: string,
): Promise<void> {
  const { data: claimed, error: claimError } = await db.rpc(
    "workspace_claim_access_request_notification",
    { p_request_id: requestId },
  );
  if (claimError || claimed !== true) return;

  const [{ data: request, error: requestError }, { data: masa, error: memberError }] = await Promise.all([
    db
      .from("workspace_access_requests")
      .select("id,email_normalized,requested_path,target_kind,workspace_slug,project_id,request_count,last_requested_at,status")
      .eq("id", requestId)
      .maybeSingle(),
    db
      .from("members")
      .select("member_id,slack_id,status")
      .eq("member_id", "ID001")
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const row = request as RequestRow | null;
  const token = process.env.SLACK_BOT_TOKEN;
  if (requestError || memberError || !row || !masa?.slack_id || !token) {
    const reason = requestError?.message || memberError?.message || (!token ? "SLACK_BOT_TOKEN missing" : "Masa Slack account missing");
    await db
      .from("workspace_access_requests")
      .update({ slack_notification_status: "failed", slack_notification_error: reason.slice(0, 240) })
      .eq("id", requestId);
    return;
  }

  const client = new WebClient(token);
  try {
    const opened = await client.conversations.open({ users: masa.slack_id });
    const channel = opened.channel?.id || masa.slack_id;
    const requestedAt = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(row.last_requested_at));
    const canApproveInSlack = row.target_kind === "institution" && Boolean(row.workspace_slug);
    const value = JSON.stringify({ requestId: row.id });
    const adminUrl = `${adminOrigin.replace(/\/$/, "")}/admin/access?request=${encodeURIComponent(row.id)}`;
    const text = `外部ワークスペースへのアクセス要求: ${row.email_normalized} / ${targetLabel(row)}`;
    const actions: ActionsBlockElement[] = [];
    if (canApproveInSlack) {
      actions.push({
        type: "button",
        action_id: "workspace_access_approve",
        text: { type: "plain_text", text: "閲覧を許可", emoji: true },
        style: "primary",
        value,
        confirm: {
          title: { type: "plain_text", text: "閲覧を許可する？" },
          text: { type: "mrkdwn", text: `*${row.email_normalized}* に ${targetLabel(row)} の閲覧権限を付けるよ。` },
          confirm: { type: "plain_text", text: "許可する" },
          deny: { type: "plain_text", text: "戻る" },
        },
      });
    }
    actions.push({
      type: "button",
      action_id: "workspace_access_reject",
      text: { type: "plain_text", text: "許可しない", emoji: true },
      style: "danger",
      value,
    });
    actions.push({
      type: "button",
      action_id: "workspace_access_open_admin",
      text: { type: "plain_text", text: "管理画面で確認", emoji: true },
      url: adminUrl,
      value,
    });

    const posted = await client.chat.postMessage({
      channel,
      text,
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: "*外部ワークスペースへのアクセス要求*" },
          fields: [
            { type: "mrkdwn", text: `*アカウント*\n${row.email_normalized}` },
            { type: "mrkdwn", text: `*希望先*\n${targetLabel(row)}` },
            { type: "mrkdwn", text: `*要求日時*\n${requestedAt}` },
            { type: "mrkdwn", text: `*試行回数*\n${row.request_count}回` },
          ],
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: "許可すると閲覧のみで登録。本人がもう一度ログイン操作するとログインリンクが届く。" },
          ],
        },
        { type: "actions", elements: actions },
      ],
    });

    await db
      .from("workspace_access_requests")
      .update({
        slack_notification_status: "sent",
        slack_notification_error: null,
        slack_channel_id: channel,
        slack_message_ts: posted.ts ?? null,
      })
      .eq("id", requestId);
  } catch (error) {
    await db
      .from("workspace_access_requests")
      .update({ slack_notification_status: "failed", slack_notification_error: shortError(error) })
      .eq("id", requestId);
  }
}
