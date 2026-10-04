import Link from "next/link";
import { ProjectSurfaceNav } from "@/components/nav/ProjectSurfaceNav";
import type { ReactNode } from "react";
import { DD_PACKAGE_STATUS_LABEL, type DdViewerAccess } from "@/lib/dd-package-core";
import { resolveSharedWorkspaceAccess } from "@/lib/project-shared-workspace-access";

// DD（投資家・金融機関向け）画面の共通の枠。社内のナビゲーション・PJ一覧・通知は出さない。
// 管理者プレビューのときだけ、上端に「投資家に見えるのは公開中の項目だけ」と、独立したDD管理画面・
// 正式版（PDF）の出力への導線を出す。

export async function DdViewerShell({
  access,
  children,
}: {
  access: DdViewerAccess;
  children: ReactNode;
}) {
  const homeHref = `/dd/${encodeURIComponent(access.slug)}`;
  const workspaceAccess = access.preview ? null : await resolveSharedWorkspaceAccess(access.projectId).catch(() => null);
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-white text-[#1d1d1f]">
      {access.preview && (
        <div className="border-b border-[#f3d9a4] bg-[#fff8e8] px-4 py-2 text-[12px] leading-5 text-[#7a4b00] sm:px-6" role="status">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
            <span>
              <strong className="font-semibold">管理者プレビュー</strong>
              ：投資家に見えるのは「公開中」の項目だけ（中身はワークスペースの最新）。パッケージの状態は「{DD_PACKAGE_STATUS_LABEL[access.packageStatus]}」。
            </span>
            <span className="flex flex-wrap gap-1.5">
              <Link
                href={`/dd/${encodeURIComponent(access.slug)}/print`}
                className="rounded border border-[#e7c27a] bg-white px-2 py-1 font-semibold text-[#7a4b00] hover:bg-[#fff3d6]"
              >
                PDFを出力
              </Link>
              <Link
                href={`/project/${encodeURIComponent(access.projectId)}/dd?tab=manage`}
                className="rounded border border-[#e7c27a] bg-white px-2 py-1 font-semibold text-[#7a4b00] hover:bg-[#fff3d6]"
              >
                DDの管理へ
              </Link>
            </span>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-[#e5e5e7] bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="rounded border border-[#bcdcf6] bg-[#eef6fd] px-2 py-0.5 text-[11px] font-semibold text-[#0267b2]">DD資料</span>
            <Link href={homeHref} className="truncate text-[14px] font-semibold text-[#1d1d1f] hover:text-[#027FDC]">
              {access.title}
            </Link>
          </div>
          <div className="flex items-center gap-3 text-[12px] text-[#6e6e73]">
            <span className="hidden max-w-[240px] truncate sm:inline">{access.email}</span>
            {access.principal === "workspace_account" && (
              <a href="/auth/logout" className="rounded border border-[#d2d2d7] px-2 py-1 text-[#1d1d1f] hover:bg-[#f5f5f7]">
                ログアウト
              </a>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] space-y-3 px-4 pb-16 pt-3 sm:px-6">
        <ProjectSurfaceNav projectId={access.projectId} current="dd" canCockpit={access.preview} canWorkspace={access.preview || Boolean(workspaceAccess)} ddHref={homeHref} />
        {children}
      </main>
    </div>
  );
}
