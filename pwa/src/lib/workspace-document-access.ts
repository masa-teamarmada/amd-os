import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { resolveSharedWorkspaceAccess } from "@/lib/project-shared-workspace-access";
import { resolveWorkspaceAccess } from "@/lib/workspace-access-resolver";
import type { WorkspaceDocumentScopeKind } from "@/lib/workspace-documents-core";

export type WorkspaceDocumentAccess = {
  principal: "internal_member" | "workspace_account";
  scopeKind: WorkspaceDocumentScopeKind;
  scopeId: string;
  workspaceId: string | null;
  projectId: string | null;
  role: string;
  canReadInternal: boolean;
  canUpload: boolean;
  canManage: boolean;
  accountId: string | null;
  memberId: string | null;
  email: string;
};

export async function resolveProjectDocumentAccess(projectId: string): Promise<WorkspaceDocumentAccess | null> {
  const access = await resolveSharedWorkspaceAccess(projectId);
  if (!access) return null;

  if (access.principal === "workspace_account") {
    return {
      principal: "workspace_account",
      scopeKind: "project",
      scopeId: projectId,
      workspaceId: null,
      projectId,
      role: access.role,
      canReadInternal: false,
      canUpload: access.role === "manager" || access.role === "contributor",
      canManage: access.role === "manager",
      accountId: access.accountId,
      memberId: null,
      email: access.email,
    };
  }

  const directProjectMember = access.projects.some((project) => project.projectId === projectId);
  return {
    principal: "internal_member",
    scopeKind: "project",
    scopeId: projectId,
    workspaceId: null,
    projectId,
    role: access.isAdmin ? "AMD管理" : directProjectMember ? "PJメンバー" : "AMD閲覧",
    canReadInternal: true,
    canUpload: access.isAdmin || directProjectMember,
    canManage: access.isAdmin || directProjectMember,
    accountId: null,
    memberId: access.memberId,
    email: access.email,
  };
}

export async function resolveInstitutionDocumentAccess(slug: string): Promise<WorkspaceDocumentAccess | null> {
  const internal = await getCurrentMemberAccess();
  const db = createAdminClient();
  const { data: workspace, error: workspaceError } = await db
    .from("institution_workspaces")
    .select("id,slug,status")
    .eq("slug", slug)
    .maybeSingle();
  if (workspaceError) throw new Error(`institution document workspace lookup: ${workspaceError.message}`);
  if (!workspace || workspace.status !== "active") return null;

  if (internal?.isAdmin) {
    return {
      principal: "internal_member",
      scopeKind: "institution",
      scopeId: slug,
      workspaceId: String(workspace.id),
      projectId: null,
      role: "AMD管理",
      canReadInternal: true,
      canUpload: true,
      canManage: true,
      accountId: null,
      memberId: internal.memberId,
      email: internal.email,
    };
  }

  const scope = await resolveWorkspaceAccess();
  if (!scope) return null;
  const membership = scope.institutionWorkspaces.find((item) => item.slug === slug);
  if (!membership) return null;

  return {
    principal: "workspace_account",
    scopeKind: "institution",
    scopeId: slug,
    workspaceId: String(workspace.id),
    projectId: null,
    role: membership.role,
    canReadInternal: false,
    canUpload: membership.role === "owner" || membership.role === "member",
    canManage: membership.role === "owner",
    accountId: scope.accountId,
    memberId: null,
    email: scope.email,
  };
}

export async function resolveWorkspaceDocumentAccess(
  scopeKind: WorkspaceDocumentScopeKind,
  scopeId: string,
): Promise<WorkspaceDocumentAccess | null> {
  return scopeKind === "project"
    ? resolveProjectDocumentAccess(scopeId)
    : resolveInstitutionDocumentAccess(scopeId);
}
