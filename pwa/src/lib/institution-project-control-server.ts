import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveWorkspaceAccess } from "@/lib/workspace-access-resolver";
import {
  parseSharedProjectControlPublication,
  sharedProjectControlError,
  type SharedProjectControlError,
  type SharedProjectPublishedControl,
  type SharedProjectUnpublishedControl,
} from "@/lib/shared-project-control";

export type InstitutionProjectControlResult = {
  workspace: { slug: string; name: string; role: "owner" | "member" | "readonly" };
  project: { id: string; name: string; role: "manager" | "contributor" | "readonly" };
  control: SharedProjectPublishedControl | SharedProjectUnpublishedControl | SharedProjectControlError;
};

/**
 * Resolves the institution-project lens through both legacy session scope and the
 * publication kernel. Institution membership alone is never enough; the caller must
 * also hold the exact project membership, and the DB RPC then revalidates the active
 * principal / organization membership / party / grant chain.
 */
export async function getInstitutionProjectControl(
  slug: string,
  projectId: string,
): Promise<InstitutionProjectControlResult | null> {
  const scope = await resolveWorkspaceAccess();
  if (!scope) return null;

  const workspace = scope.institutionWorkspaces.find((candidate) => candidate.slug === slug);
  const projectMembership = scope.projects.find((candidate) => candidate.projectId === projectId);
  if (!workspace || !projectMembership) return null;

  const db = createAdminClient();
  const [{ data: rawPublication, error: publicationError }, { data: projectRow, error: projectError }] =
    await Promise.all([
      db.rpc("project_read_published_revision_for_workspace_account", {
        p_workspace_user_account_id: scope.accountId,
        p_project_id: projectId,
      }),
      db.from("projects").select("project_id,project_name").eq("project_id", projectId).maybeSingle(),
    ]);

  if (projectError || !projectRow) return null;
  if (publicationError) {
    console.error("[institution-project-control] publication reader failed:", publicationError.message);
    return {
      workspace,
      project: { id: projectId, name: projectRow.project_name, role: projectMembership.role },
      control: sharedProjectControlError(new Error("共有版の取得に失敗しました")),
    };
  }

  const parsed = parseSharedProjectControlPublication(rawPublication);
  if (parsed.state === "unauthorized") return null;
  if (parsed.state === "invalid") {
    console.error("[institution-project-control] invalid publication payload:", parsed.reason);
    return {
      workspace,
      project: { id: projectId, name: projectRow.project_name, role: projectMembership.role },
      control: sharedProjectControlError(new Error("共有版を安全に読み取れませんでした")),
    };
  }

  return {
    workspace,
    project: {
      id: projectId,
      name: parsed.state === "published" ? parsed.summary.projectName : projectRow.project_name,
      role: projectMembership.role,
    },
    control: parsed,
  };
}
