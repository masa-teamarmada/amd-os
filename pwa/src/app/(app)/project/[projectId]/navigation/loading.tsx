export default function ProjectNavigationLoading() {
  return (
    <main className="min-h-screen bg-[#eef1f0] px-4 py-6 sm:px-6 lg:px-8" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-[1560px] space-y-5">
        <div className="h-16 animate-pulse rounded border border-[#ccd5d0] bg-white" />
        <div className="h-28 animate-pulse rounded border border-[#ccd5d0] bg-white" />
        <div className="h-72 animate-pulse rounded border border-[#ccd5d0] bg-white" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-48 animate-pulse rounded border border-[#ccd5d0] bg-white" />
          <div className="h-48 animate-pulse rounded border border-[#ccd5d0] bg-white" />
        </div>
        <p className="text-sm text-[#57645f]">PJ管制ダッシュボードを読み込んでるよ…</p>
      </div>
    </main>
  );
}
