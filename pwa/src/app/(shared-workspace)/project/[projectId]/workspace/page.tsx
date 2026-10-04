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

  const bundle = await getProjectWorkspaceBundle(projectId, access);
  if (!bundle) notFound();

  // PJ所属とDD付与は独立に確認する。両方を持つ人だけ並列の入口を出す。
  const ddScope = access.principal === "workspace_account" ? await resolveDdViewerScope().catch(() => null) : null;
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
