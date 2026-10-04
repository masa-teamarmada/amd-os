import { notFound, redirect } from "next/navigation";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { getDdPackageSummary } from "@/lib/dd-package-summary";
import { DdProjectTab } from "@/components/dd/DdProjectTab";
import { ProjectSurfaceNav } from "@/components/nav/ProjectSurfaceNav";

export const dynamic = "force-dynamic";

// コックピット・ワークスペースと並列のDD入口。管理もDD領域の中だけで開く。
export default async function ProjectDdAdminPage({ params, searchParams }: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { projectId } = await params;
  const member = await getCurrentMemberAccess();
  if (!member?.isAdmin || member.scope !== "portfolio") notFound();
  const query = await searchParams;
  const pkg = await getDdPackageSummary(projectId);
  if (pkg && query.tab !== "manage") redirect(`/dd/${encodeURIComponent(pkg.slug)}`);
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3">
      <h1 className="text-lg font-bold">DDパッケージ</h1>
      <ProjectSurfaceNav projectId={projectId} current="dd" canCockpit canWorkspace />
      {pkg && <nav aria-label="DDの表示切り替え" className="flex flex-wrap gap-2 text-[12.5px]">
        <a href={`/dd/${encodeURIComponent(pkg.slug)}`} className="inline-flex min-h-11 items-center rounded-md border border-[#d2d2d7] px-3">掲載内容</a>
        <span aria-current="page" className="inline-flex min-h-11 items-center rounded-md border border-[#027FDC] bg-[#eef6fd] px-3 font-semibold text-[#0267b2]">管理</span>
      </nav>}
      <DdProjectTab projectId={projectId} />
    </div>
  );
}
