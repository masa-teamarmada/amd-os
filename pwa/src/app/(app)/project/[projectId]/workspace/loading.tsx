export default function ProjectWorkspaceLoading() {
  return (
    <main className="amd-desk-page-skin min-h-screen px-4 py-6 sm:px-6 lg:px-8" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-[1480px] space-y-5">
        <div className="h-8 w-64 animate-pulse rounded bg-[#e4ddd0]" />
        <div className="h-44 animate-pulse rounded-xl border border-[#e4ddd0] bg-[#f8f5ec]" />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-xl border border-[#e4ddd0] bg-[#f8f5ec]" />
          <div className="h-72 animate-pulse rounded-xl border border-[#e4ddd0] bg-[#f8f5ec]" />
        </div>
        <p className="text-sm text-[#69665d]">経営航路を読み込んでるよ…</p>
      </div>
    </main>
  );
}
