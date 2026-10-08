"use client";

import { useState } from "react";
import { DD_CONFIDENTIALITY_LABEL, DD_CONFIDENTIALITY_NOTICE, DD_CONFIDENTIALITY_VERSION } from "@/lib/dd-confidentiality";

/** 閲覧本文と資料出力の両方に同じ秘密指定を使う。確認は契約同意とは別。 */
export function DdConfidentialityNotice({ slug, canConfirm = false }: { slug?: string; canConfirm?: boolean }) {
  const [state, setState] = useState<"idle" | "saving" | "confirmed" | "error">("idle");
  async function confirm() {
    setState("saving");
    try {
      const response = await fetch(`/dd/${encodeURIComponent(slug!)}/confidentiality`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noticeVersion: DD_CONFIDENTIALITY_VERSION }),
      });
      if (!response.ok) throw new Error("confirmation_failed");
      setState("confirmed");
    } catch { setState("error"); }
  }
  return <section aria-label="秘密情報の指定" data-dd-confidentiality={DD_CONFIDENTIALITY_VERSION} className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-2 border-y border-[#cbd5e1] bg-[#f1f5f9] px-3 py-2 text-[#334155] print:break-inside-avoid">
    <strong className="shrink-0 text-sm leading-6">{DD_CONFIDENTIALITY_LABEL}</strong>
    <p className="min-w-0 flex-1 basis-64 text-xs leading-6">{DD_CONFIDENTIALITY_NOTICE}</p>
    {canConfirm && slug && <div className="print:hidden">
      <button type="button" onClick={() => void confirm()} disabled={state === "saving" || state === "confirmed"} className="inline-flex min-h-11 items-center rounded-md border border-[#94a3b8] bg-white px-3 text-xs font-medium hover:bg-[#e2e8f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0267b2] disabled:opacity-60 sm:min-h-9">{state === "saving" ? "記録中…" : state === "confirmed" ? "秘密指定を確認済み" : "秘密指定を確認した"}</button>
      {state === "error" && <p role="alert" className="mt-1 text-xs text-[#b71c1c]">確認を保存できなかった。もう一度操作する。</p>}
    </div>}
  </section>;
}
