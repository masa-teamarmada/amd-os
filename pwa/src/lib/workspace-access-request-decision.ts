import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceAccessRequestDecision = "approved" | "rejected";
export type WorkspaceAccessRequestDecisionSource = "slack" | "admin_page";

export type WorkspaceAccessRequestDecisionResult = {
  requestId: string;
  status: WorkspaceAccessRequestDecision;
  alreadyDecided: boolean;
  email: string;
  workspaceName?: string;
  workspaceSlug?: string;
  accountId?: string;
  membershipId?: string;
};

export async function decideWorkspaceAccessRequest(
  db: SupabaseClient,
  input: {
    requestId: string;
    decision: WorkspaceAccessRequestDecision;
    actorMemberId: string;
    source: WorkspaceAccessRequestDecisionSource;
  },
): Promise<WorkspaceAccessRequestDecisionResult> {
  const { data, error } = await db.rpc("workspace_decide_access_request", {
    p_request_id: input.requestId,
    p_decision: input.decision,
    p_actor_member_id: input.actorMemberId,
    p_decision_source: input.source,
  });

  if (error) throw new Error(error.message);
  const result = data as WorkspaceAccessRequestDecisionResult | null;
  if (!result?.requestId || !result.status) throw new Error("access request decision returned no result");
  return result;
}
