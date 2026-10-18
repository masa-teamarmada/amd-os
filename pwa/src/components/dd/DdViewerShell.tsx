import { DdConfidentialityNotice } from "./DdConfidentialityNotice";
import { ProjectPageTitle } from "@/components/nav/PageTitleSetter";
import { ddPageLabel } from "@/lib/dd-pages";
import Link from "next/link";
import { ProjectSpaceLayout } from "@/components/nav/ProjectSpaceLayout";
import { DdNavigation } from "./DdNavigation";
import type { DdPageKey } from "@/lib/dd-pages";
import { ProjectSurfaceNav } from "@/components/nav/ProjectSurfaceNav";
import { PageHistoryToolbar } from "@/components/nav/PageHistoryToolbar";
import { NavigationProgressIndicator } from "@/components/nav/NavigationProgressIndicator";
import type { ReactNode } from "react";
import type { DdViewerAccess } from "@/lib/dd-package-core";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { memberSurfacePermission } from "@/lib/project-surface-permissions";
import { hasDdCapability } from "@/lib/dd-package-core";
import { resolveSharedWorkspaceAccess } from "@/lib/project-shared-workspace-access";
import { BUILD_VERSION } from "@/lib/build-info";
import { DdNavigationFeedback } from "./DdNavigationFeedback";

// 見出し・領域選択・分類・ページ・本文。閲覧画面に管理専用の帯を足さない。
export async function DdViewerShell({ access, projectName, pageKey, children, reportNavigation, legacy=false,reportPageLabel }: { access: DdViewerAccess; projectName: string; pageKey: DdPageKey; children: ReactNode;reportNavigation?:ReactNode;legacy?:boolean;reportPageLabel?:string }) {
  const homeHref = `/dd/${encodeURIComponent(access.slug)}${reportNavigation ? '?chapter=source-index' : ''}`;
  const member = await getCurrentMemberAccess();
  const canCockpit = member ? !!memberSurfacePermission(member,access.projectId,"cockpit") : false;
  const workspaceAccess = access.preview ? null : await resolveSharedWorkspaceAccess(access.projectId).catch(() => null);
  return (
    <div className="min-h-screen w-full bg-white text-[#1d1d1f]">
      <ProjectPageTitle projectName={projectName} surface="DD" pageLabel={reportPageLabel??ddPageLabel(pageKey)} />
      <main className="mx-auto max-w-[1600px] space-y-2 px-4 pb-16">
        <div>
        <PageHistoryToolbar compact leading={<NavigationProgressIndicator />} title={<h1 className="min-w-0 flex-1 truncate px-1 text-base font-bold" title={projectName}>{projectName}</h1>} actions={
          <div className="flex shrink-0 gap-2 text-[12px] text-[#6e6e73]">
            {access.principal === "internal_admin" && <Link href={`/project/${encodeURIComponent(access.projectId)}/dd?tab=manage`} className="inline-flex min-h-11 items-center rounded-md border border-[#d2d2d7] px-2 hover:bg-[#f5f5f7] sm:min-h-7">設定</Link>}
            {hasDdCapability(access,"dd.edit") && access.principal !== "internal_admin" && <Link href={`/dd/${encodeURIComponent(access.slug)}/edit`} className="inline-flex min-h-11 items-center rounded-md border border-[#d2d2d7] px-3 sm:min-h-9">掲載項目を編集</Link>}
            {access.principal === "workspace_account" && <a href="/auth/logout" className="inline-flex min-h-11 items-center rounded-md border border-[#d2d2d7] px-3 hover:bg-[#f5f5f7] sm:min-h-9">ログアウト</a>}
          </div>
        } />
        <p className="font-mono text-[10px] leading-4 text-[#6e6e73] print:hidden" aria-label={`AMD OS バージョン ${BUILD_VERSION}`}>AMD OS {BUILD_VERSION}</p>
        </div>
        <div className="sticky top-0 z-40 print:static"><DdConfidentialityNotice overlay slug={access.slug} /></div>
        <ProjectSpaceLayout compact navigation={<>
        <ProjectSurfaceNav projectId={access.projectId} current="dd" canCockpit={canCockpit} canWorkspace={access.preview || Boolean(workspaceAccess)} ddHref={homeHref} />
        {reportNavigation??<DdNavigation slug={access.slug} pageKey={pageKey} legacy={legacy} />}
        </>}>
        <DdNavigationFeedback>{children}</DdNavigationFeedback>
        </ProjectSpaceLayout>
      </main>
    </div>
  );
}
