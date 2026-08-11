import "server-only";

import {
  getSharedProjectControlForWorkspaceAccount,
} from "@/lib/shared-project-control-server";

/**
 * External viewers never read the mutable internal project tables.
 * The DB function performs the exact account + project + party + grant checks and returns
 * either the latest sealed publication, an explicit unpublished state, or null when denied.
 */
export function getExternalProjectWorkspacePublication(input: {
  accountId: string;
  projectId: string;
}) {
  return getSharedProjectControlForWorkspaceAccount(input);
}
