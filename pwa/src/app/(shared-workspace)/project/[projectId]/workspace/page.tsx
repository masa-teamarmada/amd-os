import { notFound } from "next/navigation";
import { resolveSharedWorkspaceAccess } from "@/lib/project-shared-workspace-access";
import { getProjectWorkspaceBundle } from "@/lib/project-workspace";
import { SharedWorkspaceScopeRibbon } from "@/components/project-workspace/SharedWorkspaceScopeRibbon";
import { PageHistoryToolbar } from "@/components/nav/PageHistoryToolbar";
import { SxWeeklyControlDashboard } from "@/components/project-workspace/SxWeeklyControlDashboard";
import { externalWorkspaceRoleCapabilityLabel } from "@/lib/workspace-capabilities";
import { resolveDdViewerScope } from "@/lib/dd-access";

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

  // 両方の権限は独立に検証する。DD入口の照会を本文取得の後へ直列に積まない。
  const [bundle, ddScope] = await Promise.all([
    getProjectWorkspaceBundle(projectId, access),
    access.principal === "workspace_account" ? resolveDdViewerScope().catch(() => null) : Promise.resolve(null),
  ]);
  if (!bundle) notFound();
  const ddPackage = ddScope?.packages.find((pkg) => pkg.projectId === projectId);

  return (
    <>
      <PageHistoryToolbar />
      {access.principal === "workspace_account" && (
        <SharedWorkspaceScopeRibbon
          projectName={bundle.project.projectName}
          roleLabel={externalWorkspaceRoleCapabilityLabel(access.role)}
          principal="workspace_account"
          projectId={projectId}
        />
      )}
      <SxWeeklyControlDashboard bundle={bundle} access={access} ddHref={ddPackage ? `/dd/${encodeURIComponent(ddPackage.slug)}` : undefined} />
    </>
  );
}
