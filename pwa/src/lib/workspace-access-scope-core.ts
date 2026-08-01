// Pure reducer that turns raw DB rows into a safe scope summary for an external
// workspace user. No DB/network access here — kept separate so the revocation
// rules can be unit tested without Supabase (see scripts/check_workspace_access_scope.mts).
//
// Rules encoded here (do not weaken without updating design/institution_seed_project_model.md):
//   - the account itself must be status='active' (never 'invited'/'suspended') to resolve a live session
//   - an institution workspace only counts if BOTH the membership AND the workspace are active
//   - institution membership alone never grants project "workspace" (rich) access —
//     only an explicit project_access_memberships row does that
//   - project_access_memberships only counts when status='active'
//   - if, after filtering, the account has zero active institution workspaces AND zero
//     active projects, resolve to null (no usable scope) instead of an empty-but-truthy summary

export type WorkspaceAccountRow = {
  id: string;
  email_normalized: string;
  auth_user_id: string | null;
  status: "invited" | "active" | "suspended";
};

export type InstitutionMembershipRow = {
  role: "owner" | "member" | "readonly";
  status: "invited" | "active" | "suspended" | "revoked";
  workspace: {
    slug: string;
    name: string;
    status: "active" | "paused";
  } | null;
};

export type ProjectMembershipRow = {
  project_id: string;
  role: "manager" | "contributor" | "readonly";
  status: "invited" | "active" | "suspended" | "revoked";
};

export type WorkspaceScopeSummary = {
  accountId: string;
  email: string;
  institutionWorkspaces: Array<{ slug: string; name: string; role: "owner" | "member" | "readonly" }>;
  projects: Array<{ projectId: string; role: "manager" | "contributor" | "readonly" }>;
};

/**
 * Returns null when the account/session must be treated as invalid — caller should
 * fail closed (clear the cookie, redirect to login) rather than render a partial scope.
 */
export function buildWorkspaceScopeSummary(
  account: WorkspaceAccountRow | null,
  sessionEmail: string,
  institutionMemberships: InstitutionMembershipRow[],
  projectMemberships: ProjectMembershipRow[],
): WorkspaceScopeSummary | null {
  if (!account) return null;
  if (account.status !== "active") return null;
  if (!account.auth_user_id) return null;
  if (account.email_normalized !== sessionEmail) return null;

  const institutionWorkspaces = institutionMemberships
    .filter((m) => m.status === "active" && m.workspace && m.workspace.status === "active")
    .map((m) => ({ slug: m.workspace!.slug, name: m.workspace!.name, role: m.role }));

  const projects = projectMemberships
    .filter((m) => m.status === "active")
    .map((m) => ({ projectId: m.project_id, role: m.role }));

  if (institutionWorkspaces.length === 0 && projects.length === 0) return null;

  return {
    accountId: account.id,
    email: account.email_normalized,
    institutionWorkspaces,
    projects,
  };
}

/** True when the account has at least one non-revoked membership of either kind (used by email-start / callback gating). */
export function hasAnyUsableMembership(
  institutionMemberships: Array<{ status: string }>,
  projectMemberships: Array<{ status: string }>,
): boolean {
  const usable = (status: string) => status === "invited" || status === "active";
  return institutionMemberships.some((m) => usable(m.status)) || projectMemberships.some((m) => usable(m.status));
}
