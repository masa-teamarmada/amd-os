"use client";

import Link from "next/link";
import { useState } from "react";

export function PreviewBanner({ surface }: { surface: "cockpit" | "workspace" }) {
  const [resetting, setResetting] = useState(false);

  async function reset() {
    setResetting(true);
    try {
      const response = await fetch("/api/project-executive-meeting/preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-preview" }),
      });
      if (!response.ok) throw new Error("初期化できない");
      window.location.reload();
    } catch {
      setResetting(false);
    }
  }

  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-950" role="note">
    <strong>ローカル試用</strong>
    <span>架空データ。操作はこの画面内の試用で、実データには反映されない。</span>
    <nav className="flex gap-3" aria-label="表示場所の切替">
      <Link aria-current={surface === "cockpit" ? "page" : undefined} className="underline aria-[current=page]:font-bold" href="/preview-executive-meeting/cockpit">コックピット</Link>
      <Link aria-current={surface === "workspace" ? "page" : undefined} className="underline aria-[current=page]:font-bold" href="/preview-executive-meeting/workspace#executive-meeting">ワークスペース</Link>
    </nav>
    <button type="button" disabled={resetting} onClick={() => void reset()} className="ml-auto rounded border border-amber-400 px-2 py-1 hover:bg-amber-100 disabled:opacity-50">試用データを初期化</button>
  </div>;
}
