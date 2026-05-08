"use client";

import { useEffect, useState } from "react";
import { fetchVcDetail } from "@/lib/vc-data";
import type { VcDetail } from "@/types/vc";
import { VcDetailBody } from "./VcDetailBody";

/**
 * VC リストの行クリックで開くオーバーレイ。背景クリックで閉じる。
 * vcId が null なら何も描画しない (アンマウント)。
 */
export function VcDetailModal({ vcId, onClose }: { vcId: string | null; onClose: () => void }) {
  const [data, setData] = useState<VcDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!vcId) {
      setData(null);
      setNotFound(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    fetchVcDetail(vcId)
      .then((d) => {
        if (!d) setNotFound(true);
        else setData(d);
      })
      .finally(() => setLoading(false));
  }, [vcId]);

  // ESC で閉じる
  useEffect(() => {
    if (!vcId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vcId, onClose]);

  // 背景スクロールロック
  useEffect(() => {
    if (!vcId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [vcId]);

  if (!vcId) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-xl max-w-[1400px] w-full my-4 p-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="閉じる"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground text-sm w-7 h-7 rounded hover:bg-accent flex items-center justify-center"
        >
          ✕
        </button>
        {loading && <div className="py-10 text-center text-sm text-muted-foreground">読み込み中…</div>}
        {notFound && <div className="py-10 text-center text-sm">VC が見つかりません</div>}
        {data && <VcDetailBody data={data} />}
      </div>
    </div>
  );
}
