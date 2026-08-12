export default function InstitutionProjectLoading() {
  return (
    <div className="min-h-screen bg-[#faf8f2] text-[#27251f]">
      <div className="h-[62px] border-b border-[#e4ddcd] bg-[#faf8f2]" />
      <main className="mx-auto w-[min(1180px,calc(100%-32px))] py-8" aria-busy="true" aria-label="共有版を読み込み中">
        <div className="border border-[#d8d0bf] border-t-4 border-t-[#493d8b] bg-white/80 p-7">
          <div className="h-3 w-24 animate-pulse bg-[#ddd8ea]" />
          <div className="mt-4 h-9 w-72 max-w-full animate-pulse bg-[#e8e3d8]" />
          <div className="mt-8 grid gap-px bg-[#e4ddcd] md:grid-cols-3">
            {[0, 1, 2].map((index) => <div key={index} className="h-32 animate-pulse bg-[#faf8f2]" />)}
          </div>
        </div>
      </main>
    </div>
  );
}
