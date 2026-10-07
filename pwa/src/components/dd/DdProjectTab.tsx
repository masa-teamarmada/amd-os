"use client";

import { useCallback, useEffect, useState } from "react";
import { DdAdminPanel } from "@/components/dd/DdAdminPanel";
import type { DdAdminState } from "@/lib/dd-package-server";
import type { DdSourceCandidate } from "@/lib/dd-sources";

// 独立したDD領域の管理画面（AMD admin 限定）。
// 2026-10-04: DD管理は独立したDD領域の中から開く。
// 中身（掲載項目・公開の切り替え・閲覧権限・記録）は可変系なので、開くたびと操作のたびに読み直す（キャッシュしない）。

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "none" }
  | { status: "ready"; state: DdAdminState; candidates: DdSourceCandidate[] };

export function DdProjectTab({ projectId, endpoint, contentOnly = false }: { projectId: string; endpoint?: string; contentOnly?: boolean }) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  const reload = useCallback(async () => {
    try {
      const response = await fetch(endpoint ?? `/api/admin/dd?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; state?: DdAdminState | null; candidates?: DdSourceCandidate[]; error?: string }
        | null;
      if (!response.ok || !json?.ok) throw new Error(json?.error ?? "load_failed");
      if (!json.state) {
        setLoad({ status: "none" });
        return;
      }
      setLoad({ status: "ready", state: json.state, candidates: json.candidates ?? [] });
    } catch {
      setLoad({ status: "error", message: "DDパッケージを読み込めなかった。画面を開き直す。" });
    }
  }, [projectId, endpoint]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (load.status === "loading") {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-7 w-72 animate-pulse rounded bg-[#f0f0f2]" />
        <div className="h-16 animate-pulse rounded-lg bg-[#f5f5f7]" />
        <div className="h-64 animate-pulse rounded-lg bg-[#f5f5f7]" />
      </div>
    );
  }
  if (load.status === "error") {
    return <p role="alert" className="rounded-md border border-[#f5c2c2] bg-[#fff5f5] px-3 py-2 text-[12.5px] text-[#b71c1c]">{load.message}</p>;
  }
  if (load.status === "none") {
    return <p className="text-[12.5px] text-[#6e6e73]">このPJにはDDパッケージがまだない。</p>;
  }
  return <DdAdminPanel endpoint={endpoint} contentOnly={contentOnly} state={load.state} candidates={load.candidates} onChanged={() => void reload()} />;
}
