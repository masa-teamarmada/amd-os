"use client";

/**
 * ActionItemsPanel — 全PJ横断「要対応 (期日順)」面。dashboard と /notifications に置く。
 *
 * 起点: JOYCLE 臨時株主総会 招集通知 (要対応・期日つき) が OS に埋もれていた事故。
 * 5生データ抽出 + 手動の inbound 義務を期日順に出し、「埋もれさせない」を担保する。
 * 設計: pwa/design/governance_action_items.md
 */

import { useEffect, useState, useCallback } from "react";

type ActionItem = {
  action_id: string; project_id: string | null; scope: string | null; category: string | null;
  title: string; summary: string | null; due_at: string | null; status: string; priority: string | null;
  action_url: string | null; daysLeft: number | null;
};

const CAT_LABEL: Record<string, string> = {
  governance: "ガバナンス", legal: "法務", finance: "財務", contract: "契約", hr: "人事", tax: "税務", admin: "総務", other: "その他",
};

function chip(a: ActionItem) {
  if (a.status === "responded" || a.status === "done") return { txt: "対応済", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  const d = a.daysLeft;
  if (d == null) return { txt: "期日なし", cls: "border-border bg-muted/40 text-muted-foreground" };
  if (d < 0) return { txt: `期限超過 ${-d}日`, cls: "border-rose-300 bg-rose-100 text-rose-800" };
  if (d <= 3) return { txt: `あと${d}日`, cls: "border-rose-200 bg-rose-50 text-rose-700" };
  if (d <= 7) return { txt: `あと${d}日`, cls: "border-amber-200 bg-amber-50 text-amber-800" };
  return { txt: `あと${d}日`, cls: "border-border bg-muted/40 text-muted-foreground" };
}

export function ActionItemsPanel({
  projectLabels = {},
  variant = "dashboard",
  limit,
}: {
  projectLabels?: Record<string, string>;
  variant?: "dashboard" | "notifications";
  limit?: number;
}) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/action-items")
      .then(async (r) => { if (r.status === 401 || r.status === 403) { setHidden(true); return null; } return r.json(); })
      .then((j) => { if (j?.ok) setItems(j.items as ActionItem[]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const markDone = async (id: string) => {
    setItems((prev) => prev.map((x) => (x.action_id === id ? { ...x, status: "responded" } : x)));
    await fetch("/api/action-items", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action_id: id, status: "responded" }),
    }).catch(() => {});
    load();
  };

  if (hidden) return null;

  const shown = limit ? items.slice(0, limit) : items;

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-[13px] font-semibold">📌 要対応（期日順）</h2>
        {items.length > 0 && (
          <span className="ml-auto rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{items.length} 件</span>
        )}
      </div>

      {loading && <div className="px-3 py-3 text-[11px] text-muted-foreground">読み込み中…</div>}
      {!loading && items.length === 0 && <div className="px-3 py-3 text-[11px] text-muted-foreground">対応待ちの案件はありません。</div>}

      {!loading && shown.length > 0 && (
        <div className="divide-y divide-border text-[11px]">
          {shown.map((a) => {
            const c = chip(a);
            const pjLabel = a.project_id ? projectLabels[a.project_id] || a.project_id : a.scope === "personal" ? "個人" : "全社";
            return (
              <div key={a.action_id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] ${c.cls}`}>{c.txt}</span>
                <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">{pjLabel}</span>
                {a.category && <span className="text-[10px] text-muted-foreground">{CAT_LABEL[a.category] || a.category}</span>}
                {a.action_url ? (
                  <a href={a.action_url} target="_blank" rel="noopener noreferrer" className="font-medium underline decoration-dotted">{a.title}</a>
                ) : (
                  <span className="font-medium">{a.title}</span>
                )}
                {a.status !== "responded" && a.status !== "done" && (
                  <button
                    onClick={() => markDone(a.action_id)}
                    className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >対応済にする</button>
                )}
              </div>
            );
          })}
          {limit && items.length > limit && (
            <div className="px-3 py-1.5 text-[10px] text-muted-foreground">他 {items.length - limit} 件</div>
          )}
        </div>
      )}
    </section>
  );
}
