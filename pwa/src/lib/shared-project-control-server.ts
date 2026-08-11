import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseSharedProjectControlPublication,
  type SharedProjectControlPublication,
  type ViewerLens,
} from "@/lib/shared-project-control";

type RpcName =
  | "project_read_published_revision_for_member"
  | "project_read_published_revision_for_workspace_account";

async function readPublication(
  rpcName: RpcName,
  args: Record<string, string>,
): Promise<SharedProjectControlPublication> {
  const db = createAdminClient();
  const { data, error } = await db.rpc(rpcName, args);
  if (error) throw new Error(`shared project publication read failed: ${error.message}`);
  return parseSharedProjectControlPublication(data);
}

export function getSharedProjectControlForMember(input: {
  memberId: string;
  projectId: string;
}) {
  return readPublication("project_read_published_revision_for_member", {
    p_member_id: input.memberId,
    p_project_id: input.projectId,
  });
}

export function getSharedProjectControlForWorkspaceAccount(input: {
  accountId: string;
  projectId: string;
}) {
  return readPublication("project_read_published_revision_for_workspace_account", {
    p_workspace_user_account_id: input.accountId,
    p_project_id: input.projectId,
  });
}

export function publicationViewerLens(
  publication: Exclude<SharedProjectControlPublication, null>,
  fallbackLabel: string,
): ViewerLens {
  if (publication.state === "unpublished") {
    return {
      partyIds: publication.viewerPartyIds,
      label: fallbackLabel,
      kind: "unknown",
    };
  }

  const matchingParties = publication.snapshot.parties.filter((party) =>
    publication.viewerPartyIds.includes(party.partyId),
  );
  const kinds = new Set(matchingParties.map((party) => party.kind));
  const kind = kinds.size === 1
    ? matchingParties[0]?.kind === "amd"
      ? "studio"
      : matchingParties[0]?.kind ?? "unknown"
    : "unknown";

  return {
    partyIds: publication.viewerPartyIds,
    label: matchingParties.map((party) => party.displayLabel).join(" × ") || fallbackLabel,
    kind,
  };
}
