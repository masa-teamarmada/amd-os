import "server-only";

import { memberSurfacePermission } from "@/lib/project-surface-permissions";
import type { ProjectNavItem } from "@/lib/project-workspace-types";
import {
  getCurrentMemberAccess,
  type CurrentMemberAccess,
} from "@/lib/project-workspace";
import { resolveWorkspaceAccess } from "@/lib/workspace-access-resolver";

// Access shape for the *shared* workspace page/bundle only. Internal/legacy member routes
// that write effort/management must keep using `CurrentMemberAccess` + `getCurrentMemberAccess`
// directly — never this union. The sole dedicated disclosure writer is contract-list PATCH
// (2026-10-06 Masa instruction; spec5-17): it revalidates this project, manager role,
// origin and target, and writes only dd_visible plus audit fields. No effort/management writes.

export type InternalMemberViewerAccess = CurrentMemberAccess & {
  principal: "member";
  canEditEffort: boolean;
  canCockpit: boolean;
  canManage: boolean;
};

export type ExternalProjectViewerAccess = {
  principal: "workspace_account";
  memberId: null;
  displayName: string;
  accountId: string;
  email: string;
  role: "manager" | "contributor" | "readonly";
  scope: "project";
  isAdmin: false;
  canEditEffort: false;
  canManage: false;
  projects: ProjectNavItem[];
};

export type SharedWorkspaceAccess =
  InternalMemberViewerAccess | ExternalProjectViewerAccess;

/**
 * Resolves access for the shared `/project/[projectId]/workspace` page only.
 * Order: (1) legacy/internal `getCurrentMemberAccess` — unchanged behavior for existing
 * members; (2) `resolveWorkspaceAccess` — DB-revalidated workspace_account session, which
 * only grants this project when an ACTIVE `project_access_memberships` row names it exactly
 * (institution membership alone is never enough — see workspace-access-scope-core.ts).
 * Returns null on any failure; callers must render a generic not-found, never leak
 * project/tenant existence to an unauthorized caller.
 */
export async function resolveSharedWorkspaceAccess(
  projectId: string,
): Promise<SharedWorkspaceAccess | null> {
  const memberAccess = await getCurrentMemberAccess();
  if (memberAccess) {
    const permission = memberSurfacePermission(memberAccess, projectId, "workspace");
    const allowed = !!permission;
    if (!allowed) return null;
    return {
      ...memberAccess,
      projects: memberAccess.projects.some(p => p.projectId === projectId) ? memberAccess.projects : [...memberAccess.projects, {projectId, projectName: projectId}],
      principal: "member",
      canCockpit: !!memberSurfacePermission(memberAccess, projectId, "cockpit"),
      canEditEffort: memberAccess.isAdmin || memberAccess.scope === "portfolio" || memberAccess.projects.some(p => p.projectId === projectId),
      canManage: memberAccess.isAdmin || memberAccess.scope === "portfolio" || memberAccess.surfaceGrants?.some(g => g.project_id === projectId && g.surface === "workspace" && g.permission === "edit") === true,
    };
  }

  const scopeSummary = await resolveWorkspaceAccess();
  if (!scopeSummary) return null;

  const membership = scopeSummary.projects.find(
    (project) => project.projectId === projectId,
  );
  if (!membership) return null;

  return {
    principal: "workspace_account",
    memberId: null,
    displayName: scopeSummary.email,
    accountId: scopeSummary.accountId,
    email: scopeSummary.email,
    role: membership.role,
    scope: "project",
    isAdmin: false,
    canEditEffort: false,
    canManage: false,
    projects: [
      { projectId: membership.projectId, projectName: membership.projectId },
    ],
  };
}
