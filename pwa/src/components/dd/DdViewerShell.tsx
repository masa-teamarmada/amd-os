import Link from "next/link";
import { ProjectSpaceLayout } from "@/components/nav/ProjectSpaceLayout";
import { DdNavigation } from "./DdNavigation";
import type { DdPageKey } from "@/lib/dd-pages";
import { ProjectSurfaceNav } from "@/components/nav/ProjectSurfaceNav";
import { PageHistoryToolbar } from "@/components/nav/PageHistoryToolbar";
import type { ReactNode } from "react";
import type { DdViewerAccess } from "@/lib/dd-package-core";
import { resolveSharedWorkspaceAccess } from "@/lib/project-shared-workspace-access";

// 見出し・領域選択・分類・ページ・本文。閲覧画面に管理専用の帯を足さない。
export async function DdViewerShell({ access, projectName, pageKey, children }: { access: DdViewerAccess; projectName: string; pageKey: DdPageKey; children: ReactNode }) {
  const homeHref = `/dd/${encodeURIComponent(access.slug)}`;
  const workspaceAccess = access.preview ? null : await resolveSharedWorkspaceAccess(access.projectId).catch(() => null);
  return (
    <div className="min-h-screen w-full bg-white text-[#1d1d1f]">
      <PageHistoryToolbar />
      <main className="mx-auto max-w-[1600px] space-y-3 px-4 pb-16 pt-3">
        <header className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-bold">{projectName}</h1>
          <div className="flex gap-3 text-[12px] text-[#6e6e73]">
            {access.principal === "internal_admin" && <Link href={`/project/${encodeURIComponent(access.projectId)}/dd?tab=manage`} className="inline-flex min-h-11 items-center rounded-md border border-[#d2d2d7] px-3 hover:bg-[#f5f5f7] sm:min-h-9">設定</Link>}
            {access.principal === "workspace_account" && <a href="/auth/logout" className="inline-flex min-h-11 items-center rounded-md border border-[#d2d2d7] px-3 hover:bg-[#f5f5f7] sm:min-h-9">ログアウト</a>}
          </div>
        </header>
        <ProjectSpaceLayout navigation={<>
        <ProjectSurfaceNav projectId={access.projectId} current="dd" canCockpit={access.preview} canWorkspace={access.preview || Boolean(workspaceAccess)} ddHref={homeHref} />
        <DdNavigation slug={access.slug} pageKey={pageKey} />
        </>}>
        {children}
        </ProjectSpaceLayout>
      </main>
    </div>
  );
}
