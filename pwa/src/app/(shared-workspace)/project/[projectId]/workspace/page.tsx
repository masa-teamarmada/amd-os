import { notFound } from "next/navigation";
import { resolveSharedWorkspaceAccess } from "@/lib/project-shared-workspace-access";
import { externalWorkspaceRoleCapabilityLabel } from "@/lib/workspace-capabilities";
import { getProjectWorkspaceBundle } from "@/lib/project-workspace";
import { getExternalProjectWorkspacePublication } from "@/lib/external-project-workspace";
import {
  getSharedProjectControlForMember,
  publicationViewerLens,
} from "@/lib/shared-project-control-server";
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
    const publication = await getExternalProjectWorkspacePublication({
      accountId: access.accountId,
      projectId,
    });
    if (!publication) notFound();

    const lens = publicationViewerLens(publication, "参加組織");
    const projectName = publication.state === "published"
      ? publication.snapshot.projectName
      : "共有PJ";

    return (
      <>
        <SharedWorkspaceScopeRibbon
          projectName={projectName}
          roleLabel={externalWorkspaceRoleCapabilityLabel(access.role)}
          principal="workspace_account"
          projectId={projectId}
        />
        <ExternalProjectWorkspaceDashboard
          projectId={projectId}
          publication={publication}
          lens={lens}
        />
      </>
    );
  }

  const bundle = await getProjectWorkspaceBundle(projectId, access);
  if (!bundle) notFound();

  const publication = await getSharedProjectControlForMember({
    memberId: access.memberId,
    projectId,
  }) ?? {
    state: "unpublished" as const,
    projectId,
    viewerPartyIds: [],
  };
  const lens = publicationViewerLens(publication, "AMD");

  return (
    <>
      <SharedWorkspaceScopeRibbon
        projectName={bundle.project.projectName}
        roleLabel={access.isAdmin ? "AMD管理" : "PJメンバー"}
        principal="member"
        projectId={projectId}
      />
      <ProjectWorkspaceDashboard
        bundle={bundle}
        access={access}
        sharedControl={{ publication, lens }}
      />
    </>
  );
}
