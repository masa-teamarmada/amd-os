import { notFound, redirect } from "next/navigation";
import { ProjectWorkspaceDashboard } from "@/components/project-workspace/ProjectWorkspaceDashboard";
import {
  getCurrentMemberAccess,
  getProjectWorkspaceBundle,
} from "@/lib/project-workspace";

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const access = await getCurrentMemberAccess();
  if (!access) redirect(`/auth/login?next=${encodeURIComponent(`/project/${projectId}/workspace`)}`);

  const bundle = await getProjectWorkspaceBundle(projectId, access);
  if (!bundle) notFound();

  return <ProjectWorkspaceDashboard bundle={bundle} access={access} />;
}
