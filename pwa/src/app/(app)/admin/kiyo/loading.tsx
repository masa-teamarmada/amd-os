export default function AdminKiyoLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse" aria-label="きよ月次経理を読み込み中">
      <div className="h-7 w-48 rounded bg-muted" />
      <div className="mt-3 h-4 w-full max-w-xl rounded bg-muted/70" />
      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <div className="h-11 bg-muted/40" />
        {[0, 1, 2, 3].map((row) => <div key={row} className="h-20 border-t border-border bg-background" />)}
      </div>
    </div>
  );
}
