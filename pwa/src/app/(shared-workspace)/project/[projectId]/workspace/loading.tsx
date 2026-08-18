export default function ProjectWorkspaceLoading() {
  return (
    <main className="amd-workspace-page-skin min-h-screen px-4 py-6 sm:px-6 lg:px-8" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-[1480px] space-y-5">
        <div className="h-8 w-64 animate-pulse rounded bg-[#dbeafe]" />
        <div className="h-44 animate-pulse rounded-xl border border-[#d2d2d7] bg-white" />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-xl border border-[#d2d2d7] bg-white" />
          <div className="h-72 animate-pulse rounded-xl border border-[#d2d2d7] bg-white" />
        </div>
        <p className="text-sm text-[#3c3c43]">ワークスペースを更新してるよ…</p>
      </div>
    </main>
  );
}
