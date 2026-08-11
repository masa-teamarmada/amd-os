import "server-only";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  buildWorkspaceScopeSummary,
  type InstitutionMembershipRow,
  type ProjectMembershipRow,
  type WorkspaceAccountRow,
  type WorkspaceScopeSummary,
} from "@/lib/workspace-access-scope-core";
import { getWorkspaceAccessCandidateSession } from "@/lib/workspace-access-session";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase service role env vars are required");
  return createServiceClient(url, serviceKey);
}

/**
 * DB-revalidates the candidate cookie session on every call — never trusts the cookie
 * payload alone. Returns null when the session is missing, tampered, expired, or the
 * underlying account/membership no longer authorizes access (suspended, revoked, workspace
 * paused, etc). Callers must treat a null result as "not logged in" and fail closed.
 */
export async function resolveWorkspaceAccess(): Promise<WorkspaceScopeSummary | null> {
  const session = await getWorkspaceAccessCandidateSession();
  if (!session) return null;
  return resolveWorkspaceAccessForAccount(session.accountId, session.email);
}

export async function resolveWorkspaceAccessForAccount(
  accountId: string,
  normalizedEmail: string,
): Promise<WorkspaceScopeSummary | null> {
  const service = getServiceClient();

  const { data: account, error: accountError } = await service
    .from("workspace_user_accounts")
    .select("id,email_normalized,auth_user_id,status")
    .eq("id", accountId)
    .maybeSingle<WorkspaceAccountRow>();

  if (accountError) throw new Error(`workspace account access lookup: ${accountError.message}`);

  if (!account) return null;

  const { data: institutionMemberships, error: institutionMembershipError } = await service
    .from("institution_workspace_memberships")
    .select("role,status,workspace:institution_workspaces(slug,name,status)")
    .eq("user_account_id", accountId);

  if (institutionMembershipError) {
    throw new Error(`workspace institution membership lookup: ${institutionMembershipError.message}`);
  }

  const { data: projectMemberships, error: projectMembershipError } = await service
    .from("project_access_memberships")
    .select("project_id,role,status")
    .eq("user_account_id", accountId);

  if (projectMembershipError) {
    throw new Error(`workspace project membership lookup: ${projectMembershipError.message}`);
  }

  return buildWorkspaceScopeSummary(
    account,
    normalizedEmail,
    (institutionMemberships ?? []) as unknown as InstitutionMembershipRow[],
    (projectMemberships ?? []) as ProjectMembershipRow[],
  );
}
