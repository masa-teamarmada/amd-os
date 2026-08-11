import { notFound } from "next/navigation";
import { resolveSharedWorkspaceAccess } from "@/lib/project-shared-workspace-access";
import { getProjectWorkspaceBundle } from "@/lib/project-workspace";
import { SxWeeklyControlDashboard } from "@/components/project-workspace/SxWeeklyControlDashboard";

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

  // 役割別の正式面が未完成な外部accountへ、内部画面や簡易代替画面を出さない。
  // 共同PJ / 研究機関の外部レンズは、承認済みpublicationと現行PJ画面の品質契約を
  // 両方満たしてから、この分岐とは別の明示的なsurfaceとして接続する。
  if (access.principal === "workspace_account") notFound();

  const bundle = await getProjectWorkspaceBundle(projectId, access);
  if (!bundle) notFound();

  return <SxWeeklyControlDashboard bundle={bundle} access={access} />;
}
