import "server-only";

import { resolveWorkspaceAccess } from "@/lib/workspace-access-resolver";

/**
 * ワークスペースアカウントが、指定PJの共有タブを読む権限を持つか。
 *
 * `/project/[projectId]/workspace` と同じ、DBで再確認した active な
 * project_access_memberships だけを根拠にする。AMDメンバーのコックピット権限を
 * ここへ流用しないので、共有タブ用のAPIが社内の全PJ公開経路にならない。
 */
export async function hasSharedWorkspaceProjectReadAccess(projectId: string): Promise<boolean> {
  const scope = await resolveWorkspaceAccess();
  return scope?.projects.some((project) => project.projectId === projectId) ?? false;
}
