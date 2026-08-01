export default function WorkspacesLoading() {
  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#faf8f2] px-4 py-10 sm:px-6" aria-busy="true" aria-live="polite">
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <div className="h-6 w-48 animate-pulse rounded bg-[#e4ddcd]" />
        <div className="h-40 animate-pulse rounded-lg border border-[#e4ddcd] bg-white" />
        <div className="h-40 animate-pulse rounded-lg border border-[#e4ddcd] bg-white" />
        <p className="text-sm text-[#5c584d]">読み込んでるよ…</p>
      </div>
    </main>
  );
}
