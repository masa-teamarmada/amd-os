import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// workspace_access_audit_logs.detail must never contain raw email-body content, URLs,
// tokens/signatures/secrets, or an email address for an account that isn't registered
// (see 212_workspace_access_foundation.sql COMMENT ON COLUMN ...detail). Callers pass only
// small, already-safe metadata through `detail`.
export type WorkspaceAuditEvent = {
  eventType:
    | "email_start_requested"
    | "email_start_sent"
    | "callback_login_success"
    | "callback_login_denied"
    | "logout"
    // Admin mutations from /api/admin/workspace-access. `detail` carries only the
    // decision metadata (action / role / status), never the request body or a URL.
    | "admin_account_upsert"
    | "admin_institution_membership_mutation"
    | "admin_project_membership_mutation"
    // 資料室。detailにはdocument id / entry kind / visibility / actionだけを入れ、
    // file name・folder path・外部URL・署名tokenは記録しない。
    | "workspace_document_created"
    | "workspace_document_upload_completed"
    | "workspace_document_opened"
    | "workspace_document_mutated";
  userAccountId?: string | null;
  /** Only set this when the account is already a known, registered account. */
  email?: string | null;
  workspaceId?: string | null;
  projectId?: string | null;
  detail?: Record<string, string | number | boolean | null>;
};

export async function recordWorkspaceAuditEvent(
  service: SupabaseClient,
  event: WorkspaceAuditEvent,
): Promise<void> {
  const { error } = await service.from("workspace_access_audit_logs").insert({
    event_type: event.eventType,
    user_account_id: event.userAccountId ?? null,
    email: event.email ?? null,
    workspace_id: event.workspaceId ?? null,
    project_id: event.projectId ?? null,
    detail: event.detail ?? {},
  });
  if (error) {
    console.error("[workspace-access-audit] failed to insert audit log:", error.message);
    throw new Error("workspace_audit_insert_failed");
  }
}
