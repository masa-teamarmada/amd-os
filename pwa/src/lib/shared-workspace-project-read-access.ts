import "server-only";

import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { memberSurfacePermission } from "@/lib/project-surface-permissions";
import { resolveWorkspaceAccess } from "@/lib/workspace-access-resolver";

/**
 * 指定PJの共有コンテンツを読む内部・外部権限を毎requestで確認する。
 *
 * `/project/[projectId]/workspace` と同じ、DBで再確認した active な
 * project_access_memberships だけを根拠にする。内部はそのPJのコックピット/workspace権限、外部は明示PJ membershipを根拠にする。
 * 外部の機関所属やDD所属をここへ流用しない。
 */
export async function hasSharedWorkspaceProjectReadAccess(projectId: string): Promise<boolean> {
  const member = await getCurrentMemberAccess();
  if (member && (memberSurfacePermission(member, projectId, "workspace") || memberSurfacePermission(member, projectId, "cockpit"))) return true;
  const scope = await resolveWorkspaceAccess();
  return scope?.projects.some((project) => project.projectId === projectId) ?? false;
}
