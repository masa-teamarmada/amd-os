"use client";

/**
 * FundingStatsCard — ダッシュボード上部の「AMD全体 累計資金調達額 / 累計助成金額」カード。
 *
 * 営業資料でアピールする数字 (まさ依頼 2026-06-17)。
 * 全PJの project_valuation_rounds.raised_yen 合計 と、採択/受給中/完了の project_grants.amount_yen 合計を出す。
 * 集計は /api/funding-stats (service_role で合計のみ算出、per-PJ cap table 内訳は返さない)。
 * 精度は入力済みデータ依存 = 過去ラウンド/助成金の backfill が進むほど正確になる (未入力分は含まれない)。
 */

import { useEffect, useState } from "react";

type Stats = {
  funding: { totalRaisedYen: number; roundCount: number; fundedPjCount: number };
  grants: { totalSecuredYen: number; securedCount: number; grantPjCount: number };
};

function yenOku(n: number) {
  if (n >= 1e8) return { v: (n / 1e8).toFixed(n >= 1e9 ? 0 : 2), unit: "億円" };
  if (n >= 1e4) return { v: Math.round(n / 1e4).toLocaleString(), unit: "万円" };
  return { v: n.toLocaleString(), unit: "円" };
}

export function FundingStatsCard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/funding-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live && j?.ok) setStats({ funding: j.funding, grants: j.grants }); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  if (!stats) return null;
  const raised = yenOku(stats.funding.totalRaisedYen);
  const grant = yenOku(stats.grants.totalSecuredYen);

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="border-b border-border px-3 py-2 text-[13px] font-semibold">📈 AMD全体 累計実績 (営業アピール)</div>
      <div className="grid grid-cols-2 divide-x divide-border">
        <Tile label="累計資金調達額" v={raised.v} unit={raised.unit}
          sub={`${stats.funding.fundedPjCount} PJ / ${stats.funding.roundCount} ラウンド`} accent="text-emerald-600" />
        <Tile label="累計獲得 助成金・補助金" v={grant.v} unit={grant.unit}
          sub={`${stats.grants.grantPjCount} PJ / ${stats.grants.securedCount} 件`} accent="text-sky-600" />
      </div>
      <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border">
        ※ OS に記録済みのラウンド/助成金の合計。過去案件の登録が進むほど正確になる。
      </div>
    </section>
  );
}

function Tile({ label, v, unit, sub, accent }: { label: string; v: string; unit: string; sub: string; accent: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={`text-2xl font-bold tabular-nums ${accent}`}>{v}</span>
        <span className="text-sm font-medium text-muted-foreground">{unit}</span>
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}
