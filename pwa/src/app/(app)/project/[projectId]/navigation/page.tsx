import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SxNavigationDashboard } from "@/components/project-navigation/SxNavigationDashboard";
import { buildSxNavigationViewModel } from "@/lib/sx-navigation-v2";
import {
  getCurrentMemberAccess,
  getProjectWorkspaceBundle,
} from "@/lib/project-workspace";

export const metadata: Metadata = {
  title: { absolute: "PJ管制ダッシュボード - AMD OS" },
};

export default async function ProjectNavigationPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const nextPath = `/project/${projectId}/navigation`;
  const access = await getCurrentMemberAccess();
  if (!access) redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);

  const bundle = await getProjectWorkspaceBundle(projectId, access);
  if (!bundle) notFound();
  // 汎用データで成立条件ナビゲーションが成立しないPJ(= 台帳が空)は安全側でnotFoundにする。
  // p21固有のハードコードはしない — sxManagementのデータ有無だけを基準にする。
  if (!bundle.sxManagement.hasData) notFound();

  // ProjectWorkspaceBundle / CurrentMemberAccess 全体をClient Componentへ渡さない。
  // sourceRef・メンバー名簿・工数・raw本文などRSC payloadに不要な情報を直列化しないよう、
  // ここで画面専用の最小 view model だけを組み立てて渡す。
  const model = buildSxNavigationViewModel({
    project: { projectId: bundle.project.projectId, projectName: bundle.project.projectName },
    sxManagement: bundle.sxManagement,
  });

  return <SxNavigationDashboard model={model} />;
}
