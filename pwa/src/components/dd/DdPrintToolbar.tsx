"use client";

import Link from "next/link";
import { useState } from "react";

// 正式版（PDF）の出力の操作。押すと、サーバが「公開中の項目と、いまの元データの更新日時」を出力の記録に残してから、
// ブラウザの印刷画面を開く（印刷先で「PDFに保存」を選ぶ）。印刷には出ない。

export function DdPrintToolbar({ packageId, topHref }: { packageId: string; topHref: string }) {
  const [state, setState] = useState<"idle" | "recording" | "recorded" | "error">("idle");

  async function exportPdf() {
    setState("recording");
    try {
      const response = await fetch("/api/admin/dd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "record_export", packageId }),
      });
      const json = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (!response.ok || !json?.ok) throw new Error("record_failed");
      setState("recorded");
      window.print();
    } catch {
      setState("error");
    }
  }

  return (
    <div className="dd-print-toolbar sticky top-0 z-40 border-b border-[#e5e5e7] bg-white/95 px-4 py-2.5 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-[12.5px]">
        <div className="text-[#424245]">
          <strong className="font-semibold text-[#1d1d1f]">正式版（PDF）の出力</strong>
          ：公開中の項目を、いまの内容で1つの文書にまとめている。印刷画面で「PDFに保存」を選ぶ（A4横）。
          {state === "recorded" && <span className="ml-1 text-[#0267b2]">出力を記録した。</span>}
          {state === "error" && <span className="ml-1 text-[#b71c1c]">出力の記録に失敗した。画面を開き直してもう一度押す。</span>}
        </div>
        <div className="flex gap-2">
          <Link href={topHref} className="inline-flex min-h-9 items-center rounded-md border border-[#d2d2d7] px-3 hover:bg-[#f5f5f7]">
            DDトップへ戻る
          </Link>
          <button
            type="button"
            onClick={exportPdf}
            disabled={state === "recording"}
            className="inline-flex min-h-9 items-center rounded-md border border-[#027FDC] bg-[#027FDC] px-3 font-semibold text-white hover:bg-[#0267b2] disabled:opacity-60"
          >
            {state === "recording" ? "記録中…" : "PDFに保存（印刷）"}
          </button>
        </div>
      </div>
    </div>
  );
}
