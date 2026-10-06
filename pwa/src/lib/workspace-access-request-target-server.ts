import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { workspaceAccessRequestTarget, type WorkspaceAccessRequestTarget } from "./workspace-access-request-core";

/** A document owner identifies the requested workspace; this never grants access. */
export async function resolveWorkspaceAccessRequestTarget(
  db: SupabaseClient,
  nextPath: string,
): Promise<WorkspaceAccessRequestTarget> {
  const target = workspaceAccessRequestTarget(nextPath);
  if (target.targetKind !== "unspecified") return target;
  const match = nextPath.match(/^\/api\/workspace-documents\/([0-9a-f-]{36})\/(?:render|download)(?:[/?#]|$)/i)
    ?? nextPath.match(/^\/workspace-document\/([0-9a-f-]{36})(?:[/?#]|$)/i);
  if (!match) return target;
  const { data, error } = await db.from("workspace_documents")
    .select("scope_kind,project_id,institution_workspace_id")
    .eq("document_id", match[1]).eq("upload_status", "active").eq("visibility", "workspace_shared")
    .maybeSingle();
  if (error) throw new Error(`access request document target lookup: ${error.message}`);
  if (data?.scope_kind === "project" && data.project_id) {
    return { ...target, targetKind: "project", projectId: data.project_id };
  }
  if (data?.scope_kind === "institution" && data.institution_workspace_id) {
    const { data: workspace, error: workspaceError } = await db.from("institution_workspaces")
      .select("slug").eq("id", data.institution_workspace_id).eq("status", "active").maybeSingle();
    if (workspaceError) throw new Error(`access request workspace target lookup: ${workspaceError.message}`);
    if (workspace?.slug) return { ...target, targetKind: "institution", workspaceSlug: workspace.slug };
  }
  return target;
}
