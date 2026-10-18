import { LoaderCircle } from "lucide-react";

export default function DdLoading() {
  return <main className="flex min-h-[50vh] items-center justify-center gap-3 px-4 text-sm text-[#374151]" role="status" data-testid="dd-page-loading">
    <LoaderCircle className="h-6 w-6 shrink-0 animate-spin text-[#027FDC]" aria-hidden="true" />
    <span>DD資料を読み込み中…</span>
  </main>;
}
