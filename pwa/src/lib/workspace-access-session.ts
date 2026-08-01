import "server-only";

import { cookies } from "next/headers";
import {
  WORKSPACE_SESSION_COOKIE,
  WORKSPACE_SESSION_MAX_AGE,
  signWorkspaceSessionValue,
  verifyWorkspaceSessionValue,
  type WorkspaceSessionPayload,
} from "@/lib/workspace-access-session-core";

export { WORKSPACE_SESSION_COOKIE, WORKSPACE_SESSION_MAX_AGE };
export type { WorkspaceSessionPayload };

function sessionSecret() {
  const secret = process.env.WORKSPACE_SESSION_SECRET;
  if (!secret) throw new Error("WORKSPACE_SESSION_SECRET is required for workspace sessions");
  return secret;
}

export function createWorkspaceSessionCookieValue(accountId: string, email: string) {
  return signWorkspaceSessionValue({ accountId, email }, sessionSecret());
}

export function verifyWorkspaceSessionCookieValue(value: string | undefined | null) {
  return verifyWorkspaceSessionValue(value, sessionSecret());
}

/** Reads + verifies the cookie only. Callers that authorize access MUST still
 * DB-revalidate via resolveWorkspaceScopeSummary — this is not sufficient on its own. */
export async function getWorkspaceAccessCandidateSession(): Promise<WorkspaceSessionPayload | null> {
  const cookieStore = await cookies();
  return verifyWorkspaceSessionCookieValue(cookieStore.get(WORKSPACE_SESSION_COOKIE)?.value);
}
