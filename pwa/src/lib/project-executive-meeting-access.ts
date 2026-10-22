import "server-only";

import { memberSurfacePermission } from "@/lib/project-surface-permissions";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { resolveSharedWorkspaceAccess } from "@/lib/project-shared-workspace-access";
import { createAdminClient } from "@/lib/supabase/admin";

export type ExecutiveMeetingViewer = {
  projectId: string;
  kind: "member" | "workspace_account";
  id: string;
  displayName: string;
  isAdmin: boolean;
};

/** 既存の動向・会議の共有権限を一切参照しない、経営会議専用の入場判定。 */
export async function resolveExecutiveMeetingViewer(projectId: string): Promise<ExecutiveMeetingViewer | null> {
  const member = await getCurrentMemberAccess();
  let kind: ExecutiveMeetingViewer["kind"];
  let id: string;
  let displayName: string;
  let isAdmin = false;
  if (member) {
    if (!memberSurfacePermission(member, projectId, "cockpit") && !memberSurfacePermission(member, projectId, "workspace")) return null;
    kind = "member";
    id = member.memberId;
    displayName = member.displayName;
    isAdmin = member.isAdmin;
  } else {
    const workspace = await resolveSharedWorkspaceAccess(projectId);
    if (!workspace || workspace.principal !== "workspace_account") return null;
    kind = "workspace_account";
    id = workspace.accountId;
    displayName = workspace.displayName;
  }

  const db = createAdminClient();
  const attribute = kind === "member"
    ? await db.from("members").select("is_executive,status").eq("member_id", id).maybeSingle()
    : await db.from("workspace_user_accounts").select("is_executive,status").eq("id", id).maybeSingle();
  if (attribute.error || attribute.data?.status !== "active" || !attribute.data.is_executive) return null;
  let query = db.from("project_executive_members").select("id")
    .eq("project_id", projectId).eq("active", true);
  query = kind === "member" ? query.eq("member_id", id) : query.eq("workspace_account_id", id);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return { projectId, kind, id, displayName, isAdmin };
}
