export default function AdminKiyoLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] animate-pulse" aria-label="きよを読み込み中">
      <div className="h-7 w-24 rounded bg-muted" />
      <div className="mt-3 h-4 w-full max-w-xl rounded bg-muted/70" />
      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-16 rounded-lg border border-border bg-muted/30" />)}
      </div>
      <div className="mt-6 space-y-3 border border-border bg-background p-4">
        <div className="h-6 w-40 rounded bg-muted" />
        {[0, 1, 2].map((row) => <div key={row} className="h-16 border-t border-border bg-background" />)}
      </div>
    </div>
  );
}
