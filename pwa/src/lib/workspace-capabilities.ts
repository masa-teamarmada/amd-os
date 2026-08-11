export type WorkspaceCapability =
  | "workspace.view"
  | "document.view_shared"
  | "document.view_internal"
  | "document.upload"
  | "document.manage"
  | "membership.manage"
  | "project.manage_shared"
  | "organization.confirm_sovereign";

export type ExternalWorkspaceRole =
  | "owner"
  | "member"
  | "manager"
  | "contributor"
  | "readonly";

const EXTERNAL_ROLE_CAPABILITY_LABEL: Record<ExternalWorkspaceRole, string> = {
  owner: "資料管理・機関閲覧",
  member: "資料追加・機関閲覧",
  manager: "資料管理・PJ閲覧",
  contributor: "資料追加・PJ閲覧",
  readonly: "閲覧のみ",
};

export function externalWorkspaceRoleCapabilityLabel(role: ExternalWorkspaceRole): string {
  return EXTERNAL_ROLE_CAPABILITY_LABEL[role];
}

export type WorkspaceCapabilityContext =
  | {
      principal: "workspace_account";
      scopeKind: "institution";
      role: "owner" | "member" | "readonly";
    }
  | {
      principal: "workspace_account";
      scopeKind: "project";
      role: "manager" | "contributor" | "readonly";
    }
  | {
      principal: "internal_member";
      scopeKind: "institution" | "project";
      role: "admin" | "project_member" | "portfolio_member";
    };

const SHARED_VIEW: readonly WorkspaceCapability[] = ["workspace.view", "document.view_shared"];

/**
 * Role labels are only bundles. Authorization checks consume explicit capabilities.
 * Capabilities that do not exist in the current product remain absent instead of being
 * inferred from a powerful-sounding role name such as manager or owner.
 */
export function workspaceCapabilities(context: WorkspaceCapabilityContext): ReadonlySet<WorkspaceCapability> {
  const capabilities = new Set<WorkspaceCapability>(SHARED_VIEW);

  if (context.principal === "workspace_account") {
    if (context.role !== "readonly") capabilities.add("document.upload");
    if (context.scopeKind === "institution" && context.role === "owner") {
      capabilities.add("document.manage");
    }
    if (context.scopeKind === "project" && context.role === "manager") {
      capabilities.add("document.manage");
    }

    // External role labels currently do not grant membership management, shared project
    // mutation, or sovereign-fact confirmation. Those require an organization model first.
    return capabilities;
  }

  capabilities.add("document.view_internal");
  if (context.role === "admin") {
    capabilities.add("document.upload");
    capabilities.add("document.manage");
    capabilities.add("membership.manage");
    capabilities.add("project.manage_shared");
    return capabilities;
  }

  if (context.scopeKind === "project" && context.role === "project_member") {
    capabilities.add("document.upload");
    capabilities.add("document.manage");
    capabilities.add("project.manage_shared");
  }

  return capabilities;
}

export function hasWorkspaceCapability(
  capabilities: ReadonlySet<WorkspaceCapability>,
  capability: WorkspaceCapability,
): boolean {
  return capabilities.has(capability);
}
