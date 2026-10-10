import "server-only";

import { redirect } from "next/navigation";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { getWorkspaceAccessCandidateSession } from "@/lib/workspace-access-session";
import { sanitizeNextPath } from "@/lib/workspace-next-path";

/** Authentication only: never reads package existence or substitutes for DD grant validation. */
export async function requireDdPageSession(next: string): Promise<void> {
  const [member, session] = await Promise.all([
    getCurrentMemberAccess(),
    getWorkspaceAccessCandidateSession(),
  ]);
  if (!member && !session) {
    const query = new URLSearchParams({ next: sanitizeNextPath(next) });
    redirect(`/auth/login?${query}`);
  }
}
