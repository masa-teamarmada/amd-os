export default function ProjectWeeklyControlLoading() {
  return (
    <main className="amd-desk-page-skin min-h-screen px-4 py-6 sm:px-6 lg:px-8" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-[1560px] space-y-5">
        <div className="h-8 w-64 animate-pulse rounded bg-[#e4ddd0]" />
        <div className="h-44 animate-pulse rounded-xl border border-[#e4ddd0] bg-[#f8f5ec]" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-64 animate-pulse rounded-xl border border-[#e4ddd0] bg-[#f8f5ec]" />
          <div className="h-64 animate-pulse rounded-xl border border-[#e4ddd0] bg-[#f8f5ec]" />
          <div className="h-64 animate-pulse rounded-xl border border-[#e4ddd0] bg-[#f8f5ec]" />
        </div>
        <p className="text-sm text-[#69665d]">週次管制を読み込んでるよ…</p>
      </div>
    </main>
  );
}
