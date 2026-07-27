import { notFound, redirect } from "next/navigation";
import { SxWeeklyControlDashboard } from "@/components/project-workspace/SxWeeklyControlDashboard";
import {
  getCurrentMemberAccess,
  getProjectWorkspaceBundle,
} from "@/lib/project-workspace";

export default async function ProjectWeeklyControlPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const nextPath = `/project/${projectId}/weekly-control`;
  const access = await getCurrentMemberAccess();
  if (!access) redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);

  const bundle = await getProjectWorkspaceBundle(projectId, access);
  if (!bundle) notFound();

  return <SxWeeklyControlDashboard bundle={bundle} access={access} />;
}
