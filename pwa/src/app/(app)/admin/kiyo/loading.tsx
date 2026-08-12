export default function AdminKiyoLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] animate-pulse" aria-label="きよを読み込み中">
      <div className="h-7 w-24 bg-muted" />
      <div className="mt-1 h-3 w-full max-w-xl bg-muted/70" />
      <div className="mb-3 mt-2 flex gap-4 border-b border-border pb-2">
        {[0, 1, 2].map((item) => <div key={item} className="h-4 w-20 bg-muted/60" />)}
      </div>
      <div className="space-y-2 border border-border bg-background p-3">
        <div className="h-5 w-40 bg-muted" />
        {[0, 1, 2].map((row) => <div key={row} className="h-12 border-t border-border bg-background" />)}
      </div>
    </div>
  );
}
