"use client";

/**
 * 全 PJ 紹介資料作成モーダル
 *
 * 2026-05-12 まさ要望: ダッシュボードに「全PJ紹介資料作成」ボタン → モーダル → チェックボックスで
 * 複数 PJ 選択 → AMD_allPJ_introduction.html のフォーマットに従って 1 つの HTML として出力。
 *
 * 雛形は pwa/AMD_allPJ_introduction.html (= 488 行、4 PJ のエグゼクティブサマリーを資料化したもの)。
 * 各 PJ ごとに 1 ページ (= `.page` 要素) を生成して連結。データソースは Supabase の
 * project_ventures + project_knowledge + monthly_reports など。
 *
 * 出力: Blob → downloadURL → `<a download>` で .html ダウンロード。サーバー処理は
 * `/api/admin/pj-introduction-html` (= 後続実装) に LLM 集約を委譲、本モーダルはオプション選択だけ。
 */

import { useEffect, useMemo, useState } from "react";
import type { DashProject } from "@/lib/supabase-data";

interface Props {
  projects: DashProject[];
  onClose: () => void;
}

export function AllPjIntroductionModal({ projects, onClose }: Props) {
  // 初期 ON は active / sales のみ。ended/frozen/lost は OFF で「過去 PJ」扱い。
  const initialSelected = useMemo(() => {
    const out = new Set<string>();
    for (const p of projects) {
      if (p.status === "active" || p.status === "sales" || p.status === "draft") {
        out.add(p.projectId);
      }
    }
    return out;
  }, [projects]);

  const [selected, setSelected] = useState<Set<string>>(initialSelected);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "fetching" | "rendering" | "done">("idle");

  // status ごとにグルーピングして表示順を制御
  const grouped = useMemo(() => {
    const order = ["active", "sales", "draft", "frozen", "ended", "lost"];
    const out: Record<string, DashProject[]> = {};
    for (const p of projects) {
      const key = p.status || "unknown";
      if (!out[key]) out[key] = [];
      out[key].push(p);
    }
    return order
      .map((k) => ({ key: k, list: out[k] || [] }))
      .concat(
        Object.keys(out)
          .filter((k) => !order.includes(k))
          .map((k) => ({ key: k, list: out[k] }))
      )
      .filter((g) => g.list.length > 0);
  }, [projects]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(projects.map((p) => p.projectId)));
  const selectNone = () => setSelected(new Set());
  const selectActiveOnly = () => setSelected(initialSelected);

  const onGenerate = async () => {
    if (selected.size === 0) {
      setError("少なくとも 1 つの PJ を選択してください");
      return;
    }
    setError(null);
    setGenerating(true);
    setStep("fetching");
    try {
      const res = await fetch("/api/admin/pj-introduction-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_ids: Array.from(selected),
        }),
      });
      setStep("rendering");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${res.status}: ${text.slice(0, 300)}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `AMD_PJ_introduction_${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStep("done");
    } catch (e) {
      setError(String(e));
      setStep("idle");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-[720px] max-w-[94vw] max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-[#e5e5e7] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">📑 全 PJ 紹介資料作成</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              チェックを入れた PJ のエグゼクティブサマリーを 1 つの HTML として生成 (AMD_allPJ_introduction.html フォーマット)
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm" aria-label="閉じる">
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3 text-[11px]">
            <button onClick={selectAll} className="px-2 py-1 border border-[#e5e5e7] rounded hover:bg-slate-50">
              全選択
            </button>
            <button onClick={selectNone} className="px-2 py-1 border border-[#e5e5e7] rounded hover:bg-slate-50">
              全解除
            </button>
            <button onClick={selectActiveOnly} className="px-2 py-1 border border-[#e5e5e7] rounded hover:bg-slate-50">
              Active + Sales のみ
            </button>
            <span className="ml-auto text-muted-foreground">
              {selected.size} / {projects.length} 選択中
            </span>
          </div>

          <div className="space-y-3">
            {grouped.map((g) => (
              <section key={g.key}>
                <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                  {g.key} ({g.list.length})
                </h4>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {g.list.map((p) => (
                    <li key={p.projectId}>
                      <label className="flex items-center gap-2 cursor-pointer text-[12.5px] hover:bg-slate-50 rounded px-1 py-0.5">
                        <input
                          type="checkbox"
                          checked={selected.has(p.projectId)}
                          onChange={() => toggle(p.projectId)}
                          className="rounded border-[#cbd5e1]"
                        />
                        <span className="font-medium">{p.projectName}</span>
                        {p.clientName && (
                          <span className="text-[10px] text-muted-foreground truncate">— {p.clientName}</span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {error && (
            <div className="mt-3 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              エラー: {error}
            </div>
          )}

          {step !== "idle" && step !== "done" && (
            <div className="mt-3 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-3 py-2">
              {step === "fetching" && "選択 PJ の最新データを Supabase から集約しています…"}
              {step === "rendering" && "LLM でエグゼクティブサマリーを生成中… (1 PJ あたり 15-30 秒)"}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#e5e5e7] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="text-[12px] px-3 py-1.5 border border-[#e5e5e7] rounded hover:bg-slate-50"
          >
            キャンセル
          </button>
          <button
            onClick={onGenerate}
            disabled={generating || selected.size === 0}
            className="text-[12px] px-3 py-1.5 rounded bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50 font-medium"
          >
            {generating ? "生成中…" : `📥 ${selected.size} PJ の紹介資料 HTML を出力`}
          </button>
        </div>
      </div>
    </div>
  );
}
