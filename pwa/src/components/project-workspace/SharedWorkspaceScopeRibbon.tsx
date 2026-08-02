import Link from "next/link";

export function SharedWorkspaceScopeRibbon({
  projectName,
  roleLabel,
  principal,
  projectId,
}: {
  projectName: string;
  roleLabel: string;
  principal: "member" | "workspace_account";
  projectId: string;
}) {
  return (
    <div className="sticky top-0 z-40 border-b border-[#d6cebf] bg-[#fffdf7]/95 px-4 py-2.5 backdrop-blur sm:px-6 lg:px-8" role="banner">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
          <span className="rounded-full border border-[#c9bfd0] bg-[#f1edf3] px-2.5 py-1 text-[#5f4a66]">共有ワークスペース</span>
          <span className="text-[#24231f]">{projectName}</span>
          <span className="text-[#777166]">/ {roleLabel}</span>
          {principal === "workspace_account" && (
            <span className="rounded-full border border-[#e3c994] bg-[#fbf1dc] px-2.5 py-1 text-[#765022]">PJ管理情報は閲覧のみ</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/project/${encodeURIComponent(projectId)}/workspace/files`}
            className="min-h-11 rounded-md border border-[#d6cebf] px-3 py-2 text-[11px] font-semibold text-[#205f49] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
          >
            資料室
          </Link>
          {principal === "member" && (
            <Link
              href={`/project/${encodeURIComponent(projectId)}/cockpit`}
              className="min-h-11 rounded-md border border-[#38745d] px-3 py-2 text-[11px] font-semibold text-[#205f49] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
            >
              AMDコックピットへ戻る
            </Link>
          )}
          {principal === "workspace_account" && (
            <>
              <Link
                href="/workspaces"
                className="min-h-11 rounded-md border border-[#38745d] px-3 py-2 text-[11px] font-semibold text-[#205f49] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
              >
                ワークスペース一覧へ戻る
              </Link>
              <Link
                href="/auth/logout"
                className="min-h-11 rounded-md border border-[#c9bfd0] px-3 py-2 text-[11px] font-semibold text-[#5f4a66] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5f4a66]"
              >
                ログアウト
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
