import { notFound } from "next/navigation";
import {
  resolveSharedWorkspaceAccess,
  PROJECT_MEMBERSHIP_ROLE_LABEL,
} from "@/lib/project-shared-workspace-access";
import { getProjectWorkspaceBundle } from "@/lib/project-workspace";
import { getExternalProjectWorkspaceBundle } from "@/lib/external-project-workspace";
import { SharedWorkspaceScopeRibbon } from "@/components/project-workspace/SharedWorkspaceScopeRibbon";
import { ProjectWorkspaceDashboard } from "@/components/project-workspace/ProjectWorkspaceDashboard";
import { ExternalProjectWorkspaceDashboard } from "@/components/project-workspace/ExternalProjectWorkspaceDashboard";

export default async function SharedWorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  // Never redirect-with-projectId here: an unauthorized caller must not be able to
  // distinguish "project doesn't exist" from "project exists but you can't see it".
  const access = await resolveSharedWorkspaceAccess(projectId);
  if (!access) notFound();

  // workspace_account principals never reach getProjectWorkspaceBundle (member/effort/evidence/
  // internal-management data) — they get the narrow, allowlisted external DTO + read-only view.
  if (access.principal === "workspace_account") {
    const bundle = await getExternalProjectWorkspaceBundle(projectId);
    if (!bundle) notFound();

    return (
      <>
        <SharedWorkspaceScopeRibbon
          projectName={bundle.project.projectName}
          roleLabel={PROJECT_MEMBERSHIP_ROLE_LABEL[access.role]}
          principal="workspace_account"
          projectId={projectId}
        />
        <ExternalProjectWorkspaceDashboard bundle={bundle} />
      </>
    );
  }

  const bundle = await getProjectWorkspaceBundle(projectId, access);
  if (!bundle) notFound();

  return (
    <>
      <SharedWorkspaceScopeRibbon
        projectName={bundle.project.projectName}
        roleLabel={access.isAdmin ? "AMD管理" : "PJメンバー"}
        principal="member"
        projectId={projectId}
      />
      <ProjectWorkspaceDashboard bundle={bundle} access={access} />
    </>
  );
}
