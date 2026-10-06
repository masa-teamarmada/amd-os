/** ページ部品を読み込む間も、本文の枠を保つ。 */
export function ProjectPageLoading() {
  return <section role="status" aria-live="polite" aria-busy="true" className="min-h-40 space-y-3 rounded-xl border border-[#d2d2d7] bg-white p-4">
    <p className="text-sm text-[#6e6e73]">ページを読み込み中…</p>
    <div className="h-5 w-2/3 animate-pulse rounded bg-[#f5f5f7]" />
    <div className="h-16 animate-pulse rounded bg-[#f5f5f7]" />
  </section>;
}
