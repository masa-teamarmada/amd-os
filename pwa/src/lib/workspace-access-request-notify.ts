import "server-only";
import { resolveWorkspaceAccessRequestTarget } from "./workspace-access-request-target-server";

import { WebClient } from "@slack/web-api";
import { workspaceAccessRequestCard } from "./workspace-access-request-card";
import { loadAccessRequestScopeChoices } from "./workspace-access-request-scopes-server";
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
  return "行き先未指定（下で閲覧させる場所を選択）";
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
    const target = await resolveWorkspaceAccessRequestTarget(db, row.requested_path);
    if (row.target_kind === "unspecified") {
      row.target_kind = target.targetKind;
      row.workspace_slug = target.workspaceSlug;
      row.project_id = target.projectId;
    }
    let scopeLabel = targetLabel(row);
    if (row.target_kind === "project" && row.project_id) {
      const { data: project } = await db.from("projects").select("project_name").eq("project_id", row.project_id).maybeSingle();
      if (project?.project_name) scopeLabel = `${project.project_name} ワークスペース（閲覧のみ）`;
    } else if (row.target_kind === "institution" && row.workspace_slug) {
      const { data: workspace } = await db.from("institution_workspaces").select("name").eq("slug", row.workspace_slug).maybeSingle();
      if (workspace?.name) scopeLabel = `${workspace.name} ワークスペース（閲覧のみ）`;
    }
    const adminUrl = `${adminOrigin.replace(/\/$/, "")}/admin/access?request=${encodeURIComponent(row.id)}`;
    const choices = row.target_kind === "unspecified" ? await loadAccessRequestScopeChoices(db) : undefined;
    const card = workspaceAccessRequestCard({ requestId: row.id, email: row.email_normalized, scopeLabel, requestedAt, count: row.request_count, adminUrl, choices });
    const posted = await client.chat.postMessage({ channel, ...card });

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
