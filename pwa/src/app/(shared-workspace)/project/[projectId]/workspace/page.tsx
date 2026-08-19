import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSharedWorkspaceAccess } from "@/lib/project-shared-workspace-access";
import { getProjectWorkspaceBundle } from "@/lib/project-workspace";
import { SharedWorkspaceScopeRibbon } from "@/components/project-workspace/SharedWorkspaceScopeRibbon";
import { SxWeeklyControlDashboard } from "@/components/project-workspace/SxWeeklyControlDashboard";
import { externalWorkspaceRoleCapabilityLabel } from "@/lib/workspace-capabilities";

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

  if (access.principal === "workspace_account") {
    const db = createAdminClient();
    const { data: project, error } = await db
      .from("projects")
      .select("project_name")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error || !project) notFound();

    const projectName = String(project.project_name);
    const roleLabel = externalWorkspaceRoleCapabilityLabel(access.role);
    const canAddDocuments = access.role !== "readonly";

    return (
      <main className="amd-workspace-page-skin min-h-screen">
        <SharedWorkspaceScopeRibbon
          projectName={projectName}
          roleLabel={roleLabel}
          principal="workspace_account"
          projectId={projectId}
        />
        <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="border-b border-[#d2d2d7] pb-6">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#5f5f66]">SOLVIORAX 共有資料</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#1d1d1f] sm:text-3xl">{projectName}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#4b4b52]">
              ここでは、SXで共有する資料を確認できるよ。PJの内部管理情報は表示しない。
            </p>
          </div>

          <div className="mt-8 border border-[#b9d3df] bg-[#f4fbfd] p-5 sm:p-6">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-[#256278]">資料室</p>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[#1d1d1f]">共有資料をひとつの場所で</h2>
            <p className="mt-2 max-w-xl text-sm leading-7 text-[#4b4b52]">
              {canAddDocuments
                ? "資料の閲覧に加えて、ファイル・フォルダ・オンライン資料を追加できる。"
                : "共有済みの資料を閲覧できる。資料の追加は管理担当へ連絡してね。"}
            </p>
            <Link
              href={`/project/${encodeURIComponent(projectId)}/workspace/files`}
              className="mt-5 inline-flex min-h-11 items-center border border-[#155e75] bg-[#155e75] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0f4c61] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155e75]"
            >
              資料室を開く
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const bundle = await getProjectWorkspaceBundle(projectId, access);
  if (!bundle) notFound();

  return <SxWeeklyControlDashboard bundle={bundle} access={access} />;
}
