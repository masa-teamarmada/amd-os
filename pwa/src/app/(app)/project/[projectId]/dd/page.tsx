import { notFound, redirect } from "next/navigation";
import { getCurrentMemberAccess } from "@/lib/project-workspace";

export const dynamic = "force-dynamic";

// 旧・DDパッケージの管理画面。管理はコックピットとワークスペースの「DDパッケージ」タブへ移した
// （2026-09-30 まさ「ワークスペースに左メニューってなくない？」）。共有済みのURLはタブへ送る。
export default async function ProjectDdAdminPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const member = await getCurrentMemberAccess();
  if (!member?.isAdmin || member.scope !== "portfolio") notFound();
  redirect(`/project/${encodeURIComponent(projectId)}/cockpit?tab=dd`);
}
