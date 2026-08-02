import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveInstitutionDocumentAccess,
  resolveProjectDocumentAccess,
  type WorkspaceDocumentAccess,
} from "@/lib/workspace-document-access";

export const WORKSPACE_DOCUMENT_FIELDS = [
  "document_id",
  "scope_kind",
  "institution_workspace_id",
  "project_id",
  "entry_kind",
  "visibility",
  "folder_path",
  "display_name",
  "storage_bucket",
  "storage_path",
  "external_url",
  "mime_type",
  "file_size_bytes",
  "upload_status",
  "source_kind",
  "created_by_account_id",
  "created_by_member_id",
  "created_at",
  "updated_at",
].join(",");

export type WorkspaceDocumentRow = {
  document_id: string;
  scope_kind: "institution" | "project";
  institution_workspace_id: string | null;
  project_id: string | null;
  entry_kind: "file" | "link" | "folder";
  visibility: "amd_internal" | "workspace_shared";
  folder_path: string;
  display_name: string;
  storage_bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
  mime_type: string;
  file_size_bytes: number;
  upload_status: "pending" | "active" | "failed" | "archived";
  source_kind: string;
  created_by_account_id: string | null;
  created_by_member_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function resolveDocumentRowAccess(
  db: SupabaseClient,
  row: WorkspaceDocumentRow,
): Promise<WorkspaceDocumentAccess | null> {
  if (row.scope_kind === "project" && row.project_id) {
    return resolveProjectDocumentAccess(row.project_id);
  }
  if (row.scope_kind !== "institution" || !row.institution_workspace_id) return null;

  const { data: workspace, error } = await db
    .from("institution_workspaces")
    .select("slug")
    .eq("id", row.institution_workspace_id)
    .maybeSingle();
  if (error) throw new Error(`workspace document institution lookup: ${error.message}`);
  return workspace?.slug ? resolveInstitutionDocumentAccess(String(workspace.slug)) : null;
}

export function workspaceDocumentOwnerInsert(access: WorkspaceDocumentAccess) {
  return access.scopeKind === "project"
    ? {
        scope_kind: "project" as const,
        project_id: access.projectId,
        institution_workspace_id: null,
      }
    : {
        scope_kind: "institution" as const,
        institution_workspace_id: access.workspaceId,
        project_id: null,
      };
}

export async function workspaceDocumentDestinationStatus(
  db: SupabaseClient,
  access: WorkspaceDocumentAccess,
  folderPath: string,
  visibility: "amd_internal" | "workspace_shared",
): Promise<"ok" | "missing_folder" | "internal_parent"> {
  if (!folderPath) return "ok";

  let query = db
    .from("workspace_documents")
    .select("folder_path,display_name,visibility")
    .eq("scope_kind", access.scopeKind)
    .eq("entry_kind", "folder")
    .eq("upload_status", "active")
    .limit(3000);
  query = access.scopeKind === "project"
    ? query.eq("project_id", access.projectId)
    : query.eq("institution_workspace_id", access.workspaceId);
  const { data, error } = await query;
  if (error) throw new Error(`workspace document folder lookup: ${error.message}`);

  const folders = new Map((data ?? []).map((row) => {
    const fullPath = row.folder_path ? `${row.folder_path}/${row.display_name}` : row.display_name;
    return [fullPath, row.visibility] as const;
  }));
  const segments = folderPath.split("/");
  const ancestors = segments.map((_, index) => segments.slice(0, index + 1).join("/"));
  if (ancestors.some((path) => !folders.has(path))) return "missing_folder";
  if (visibility === "workspace_shared" && ancestors.some((path) => folders.get(path) === "amd_internal")) {
    return "internal_parent";
  }
  return "ok";
}

export async function workspaceDocumentFolderHasSharedDescendants(
  db: SupabaseClient,
  row: WorkspaceDocumentRow,
): Promise<boolean> {
  if (row.entry_kind !== "folder") return false;
  const fullPath = row.folder_path ? `${row.folder_path}/${row.display_name}` : row.display_name;
  let query = db
    .from("workspace_documents")
    .select("folder_path")
    .eq("scope_kind", row.scope_kind)
    .eq("visibility", "workspace_shared")
    .eq("upload_status", "active")
    .limit(3000);
  query = row.scope_kind === "project"
    ? query.eq("project_id", row.project_id)
    : query.eq("institution_workspace_id", row.institution_workspace_id);
  const { data, error } = await query;
  if (error) throw new Error(`workspace document descendant lookup: ${error.message}`);
  return (data ?? []).some((candidate) => (
    candidate.folder_path === fullPath || candidate.folder_path.startsWith(`${fullPath}/`)
  ));
}

export function publicWorkspaceDocument(row: WorkspaceDocumentRow) {
  return {
    documentId: row.document_id,
    entryKind: row.entry_kind,
    visibility: row.visibility,
    folderPath: row.folder_path,
    displayName: row.display_name,
    mimeType: row.mime_type,
    fileSizeBytes: Number(row.file_size_bytes || 0),
    sourceKind: row.source_kind,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
