"use client";

/**
 * CockpitGrants — PJ cockpit の「助成金・補助金」セクション。
 *
 * 各PJが今どの助成金/補助金/委託費 (NEDO/SBIR/JST/文科省/自治体 等) を受けているかを表示する
 * (まさ依頼 2026-06-17)。cap table と違い機密度が低く、ログイン済みメンバーに見せる。
 * AMD全体の累計獲得額はダッシュボード側 (営業アピール) に出す。
 * API: /api/grants (read=requireAuth, write=admin)。設計: pwa/design/governance_action_items.md
 */

import { useEffect, useState } from "react";
import Link from "next/link";

type Grant = {
  id: string; grant_name: string; agency: string | null; grant_type: string | null;
  amount_yen: number | null; disbursed_yen: number | null; status: string;
  is_current: boolean | null; adopted_date: string | null; period_start_ym: string | null; period_end_ym: string | null; notes: string | null;
};

const STATUS_LABEL: Record<string, { txt: string; cls: string }> = {
  applied:   { txt: "申請中",   cls: "border-border bg-muted/40 text-muted-foreground" },
  adopted:   { txt: "採択",     cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  active:    { txt: "受給中",   cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  completed: { txt: "完了",     cls: "border-sky-200 bg-sky-50 text-sky-700" },
  rejected:  { txt: "不採択",   cls: "border-rose-200 bg-rose-50 text-rose-700" },
  withdrawn: { txt: "取下げ",   cls: "border-border bg-muted/40 text-muted-foreground" },
};

function yen(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}億円`;
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}万円`;
  return `${n.toLocaleString()}円`;
}

export function CockpitGrants({ projectId }: { projectId: string }) {
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetch(`/api/grants?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live && j?.ok) setGrants(j.grants); })
      .catch(() => {})
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [projectId]);

  if (projectId === "p00") return null;

  const list = grants ?? [];
  // アピール対象 (採択/受給中/完了) の累計額をこのPJ分だけ出す
  const securedTotal = list
    .filter((g) => ["adopted", "active", "completed"].includes(g.status))
    .reduce((s, g) => s + (g.amount_yen || 0), 0);
  const isEmpty = !loading && list.length === 0;

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-[13px] font-semibold">💰 助成金・補助金</h2>
        {securedTotal > 0 && (
          <span className="rounded border border-emerald-100 bg-emerald-50/70 px-2 py-0.5 text-[10px] text-emerald-800">
            獲得累計 <span className="font-semibold">{yen(securedTotal)}</span>
          </span>
        )}
        <Link
          href={`/admin/governance?projectId=${encodeURIComponent(projectId)}`}
          className="ml-auto text-[10px] rounded px-1.5 py-0.5 border border-border bg-background text-muted-foreground hover:bg-muted hover:underline"
        >編集</Link>
      </div>

      {loading && <div className="px-3 py-3 text-[11px] text-muted-foreground">読み込み中…</div>}
      {isEmpty && (
        <div className="px-3 py-3 text-[11px] text-muted-foreground">
          助成金・補助金の記録なし。<Link href={`/admin/governance?projectId=${encodeURIComponent(projectId)}`} className="underline">編集から追加</Link>
        </div>
      )}

      {!loading && !isEmpty && (
        <div className="divide-y divide-border text-[11px]">
          {list.map((g) => {
            const st = STATUS_LABEL[g.status] || { txt: g.status, cls: "border-border bg-muted/40 text-muted-foreground" };
            const period = [g.period_start_ym, g.period_end_ym].filter(Boolean).join("〜");
            return (
              <div key={g.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] ${st.cls}`}>{st.txt}</span>
                <span className="font-medium">{g.grant_name}</span>
                {g.agency && <span className="text-muted-foreground">{g.agency}</span>}
                {g.grant_type && <span className="rounded border border-border bg-muted/30 px-1 py-0 text-[9px] text-muted-foreground">{g.grant_type}</span>}
                {g.amount_yen != null && <span className="tabular-nums">{yen(g.amount_yen)}</span>}
                {period && <span className="text-[10px] text-muted-foreground">{period}</span>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
