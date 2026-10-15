"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DD_STAMP_URL, DD_STAMP_WIDTH, DD_STAMP_HEIGHT } from "@/lib/dd-confidentiality-stamp";
import { ddNdaReturnPath } from "@/lib/dd-nda";

export function DdEntryGate({ slug, title, prompt, promptHash, version, returnTo }: { slug: string; title: string; prompt: string; promptHash: string; version: string; returnTo: string }) {
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [stale, setStale] = useState(false);
  async function confirm() {
    if (state === "saving") return;
    setState("saving");
    try {
      const response = await fetch(`/dd/${encodeURIComponent(slug)}/nda`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer: "yes", version, promptHash }) });
      if (!response.ok) { setStale(response.status === 409); throw new Error("dd_nda_confirmation_failed"); }
      // 新しいrequestで認可と保存済みの確認を再検証してから本文を受け取る。
      window.location.assign(ddNdaReturnPath(slug, returnTo));
    } catch { setState("error"); }
  }
  return <main className="min-h-screen bg-white px-4 py-6 text-[#1d1d1f]">
    <h1 className="text-lg font-semibold">{title}</h1>
    <p className="mt-2 text-sm text-[#6e6e73]">DDパッケージを開く前に、秘密保持契約の締結状況を確認してください。</p>
    <Dialog open disablePointerDismissal onOpenChange={(_open, details) => details.cancel()}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] max-w-lg gap-3 overflow-y-auto bg-white p-5 text-[#1d1d1f]">
        <Image src={DD_STAMP_URL} alt="CONFIDENTIAL — 秘密情報" width={DD_STAMP_WIDTH} height={DD_STAMP_HEIGHT} unoptimized loading="eager" className="h-auto w-40 max-w-full" />
        <DialogTitle className="text-base font-semibold leading-6">秘密保持契約の確認</DialogTitle>
        <DialogDescription className="text-[14px] leading-7 text-[#374151]">{prompt}</DialogDescription>
        <p className="text-xs leading-5 text-[#6e6e73]">この確認はユーザーごとに一度だけ行います。「はい」を選ぶと、回答したユーザーと日時が記録されます。</p>
        {state === "error" && <p role="alert" className="text-sm leading-6 text-[#b91c1c]">{stale ? "確認内容が更新されました。画面を再読み込みして、もう一度確認してください。" : "回答を保存できませんでした。もう一度お試しください。"}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-[#e5e5e7] pt-3">
          <Link href="/dd" className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#d2d2d7] bg-white px-4 text-sm">いいえ・戻る</Link>
          {stale ? <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-md bg-[#0267b2] px-4 text-sm font-semibold text-white">再読み込み</button>
            : <button type="button" disabled={state === "saving"} onClick={() => void confirm()} className="min-h-11 rounded-md bg-[#0267b2] px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0267b2] disabled:opacity-60">{state === "saving" ? "保存中…" : "はい"}</button>}
        </div>
      </DialogContent>
    </Dialog>
    <noscript>確認にはJavaScriptを有効にしてください。</noscript>
  </main>;
}
