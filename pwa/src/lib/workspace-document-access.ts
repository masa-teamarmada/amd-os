import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { resolveSharedWorkspaceAccess } from "@/lib/project-shared-workspace-access";
import { resolveWorkspaceAccess } from "@/lib/workspace-access-resolver";
import type { WorkspaceDocumentScopeKind } from "@/lib/workspace-documents-core";
import {
  hasWorkspaceCapability,
  workspaceCapabilities,
  type WorkspaceCapability,
} from "@/lib/workspace-capabilities";

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
  capabilities: ReadonlySet<WorkspaceCapability>;
};

export async function resolveProjectDocumentAccess(projectId: string): Promise<WorkspaceDocumentAccess | null> {
  const access = await resolveSharedWorkspaceAccess(projectId);
  if (!access) return null;

  if (access.principal === "workspace_account") {
    const capabilities = workspaceCapabilities({
      principal: "workspace_account",
      scopeKind: "project",
      role: access.role,
    });
    return {
      principal: "workspace_account",
      scopeKind: "project",
      scopeId: projectId,
      workspaceId: null,
      projectId,
      role: access.role,
      canReadInternal: hasWorkspaceCapability(capabilities, "document.view_internal"),
      canUpload: hasWorkspaceCapability(capabilities, "document.upload"),
      canManage: hasWorkspaceCapability(capabilities, "document.manage"),
      accountId: access.accountId,
      memberId: null,
      email: access.email,
      capabilities,
    };
  }

  const directProjectMember = access.projects.some((project) => project.projectId === projectId);
  const capabilities = workspaceCapabilities({
    principal: "internal_member",
    scopeKind: "project",
    role: access.isAdmin ? "admin" : directProjectMember ? "project_member" : "portfolio_member",
  });
  return {
    principal: "internal_member",
    scopeKind: "project",
    scopeId: projectId,
    workspaceId: null,
    projectId,
    role: access.isAdmin ? "AMD管理" : directProjectMember ? "PJメンバー" : "AMD閲覧",
    canReadInternal: hasWorkspaceCapability(capabilities, "document.view_internal"),
    canUpload: hasWorkspaceCapability(capabilities, "document.upload"),
    canManage: hasWorkspaceCapability(capabilities, "document.manage"),
    accountId: null,
    memberId: access.memberId,
    email: access.email,
    capabilities,
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
    const capabilities = workspaceCapabilities({
      principal: "internal_member",
      scopeKind: "institution",
      role: "admin",
    });
    return {
      principal: "internal_member",
      scopeKind: "institution",
      scopeId: slug,
      workspaceId: String(workspace.id),
      projectId: null,
      role: "AMD管理",
      canReadInternal: hasWorkspaceCapability(capabilities, "document.view_internal"),
      canUpload: hasWorkspaceCapability(capabilities, "document.upload"),
      canManage: hasWorkspaceCapability(capabilities, "document.manage"),
      accountId: null,
      memberId: internal.memberId,
      email: internal.email,
      capabilities,
    };
  }

  const scope = await resolveWorkspaceAccess();
  if (!scope) return null;
  const membership = scope.institutionWorkspaces.find((item) => item.slug === slug);
  if (!membership) return null;

  const capabilities = workspaceCapabilities({
    principal: "workspace_account",
    scopeKind: "institution",
    role: membership.role,
  });

  return {
    principal: "workspace_account",
    scopeKind: "institution",
    scopeId: slug,
    workspaceId: String(workspace.id),
    projectId: null,
    role: membership.role,
    canReadInternal: hasWorkspaceCapability(capabilities, "document.view_internal"),
    canUpload: hasWorkspaceCapability(capabilities, "document.upload"),
    canManage: hasWorkspaceCapability(capabilities, "document.manage"),
    accountId: scope.accountId,
    memberId: null,
    email: scope.email,
    capabilities,
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
