"use client";

/**
 * 沿革モーダル: events / xrl / 概要を Gemini が時系列の物語にする。
 * - キャッシュ valid なら即表示
 * - invalid (events 編集後など) or なし → 自動再生成
 * - 「再生成」ボタンで強制再生成
 */

import { useEffect, useState } from "react";
import { generateNarrative } from "@/lib/venture-status-data";

interface Props {
  projectId: string;
  displayName: string;
  onClose: () => void;
}

export function CockpitNarrativeModal({ projectId, displayName, onClose }: Props) {
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (force: boolean) => {
    setLoading(true);
    setError(null);
    const r = await generateNarrative(projectId, { force });
    setLoading(false);
    if (!r) {
      setError("沿革の生成に失敗しました");
      return;
    }
    setText(r.text);
    setCached(r.cached);
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[640px] max-w-[92vw] max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#e5e5e7] flex items-center justify-between">
          <h3 className="text-sm font-semibold">{displayName} の沿革</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => load(true)}
              disabled={loading}
              className="text-[11px] text-blue-600 hover:underline disabled:opacity-40 disabled:no-underline"
            >
              ✨ 再生成
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
              ✕
            </button>
          </div>
        </div>
        <div className="px-4 py-4">
          {loading ? (
            <p className="text-[12px] text-muted-foreground">Gemini が沿革を組み立てています…</p>
          ) : error ? (
            <p className="text-[12px] text-red-600">{error}</p>
          ) : (
            <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-800">{text}</div>
          )}
          {!loading && !error && (
            <p className="mt-3 text-[10px] text-muted-foreground">
              {cached ? "キャッシュ表示。イベント追加・編集で次回再生成されます。" : "今この瞬間に Gemini が生成しました。"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
