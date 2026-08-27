"use client";
// ⚠️ pwa/src/components/admin/kiyo-money-flow/ からのコピー。正本は pwa 側。
// これは「見せ方」だけの部品で、金額の計算は一切していない（数字は本体のAPIが返した値）。
// なのでズレても金額事故にはならないが、図の見た目が本体と食い違う。
// 本体側を直したらここも同じ内容にする。独自の見た目をここで足さないこと。


/**
 * きよ「00 お金の流れ」タブ本体。manual/6-11-kiyo-money-flow-spec.md が正本。
 *
 * 【キャッシュ分類】このデータは可変系 (入金確認・支払記録で当日中に増える) だが
 * 更新頻度は日単位。サーバ側 (/api/kiyo/money-flow) がプロセス内 TTL 5分で
 * 持つのでここは素の fetch でよい。参照系の3層キャッシュ (reference-data-cache.ts) は使わない
 * — scripts/reference_data_cache_baseline.json に理由付きで登録済み。
 */
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { KiyoMoneyFlowPeriod, KiyoMoneyFlowResult } from "@/lib/finance/kiyo-money-flow-types";
import { KiyoMoneyFlowSankey } from "./KiyoMoneyFlowSankey";
import { KiyoMoneyFlowInflowCard, KiyoMoneyFlowWalletCard, KiyoMoneyFlowOutflowCard } from "./KiyoMoneyFlowSteps";

const PERIODS: Array<{ id: KiyoMoneyFlowPeriod; label: string }> = [
  { id: "month", label: "今月" },
  { id: "season", label: "今シーズン" },
  { id: "all", label: "ぜんぶ" },
];

function SankeySkeleton() {
  return <div className="h-[220px] w-full animate-pulse rounded-none bg-muted/40" />;
}

function StepsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="h-[180px] rounded-none border border-border bg-muted/20 p-3" />
      ))}
    </div>
  );
}

export function KiyoMoneyFlowPanel() {
  const [period, setPeriod] = useState<KiyoMoneyFlowPeriod>("season");
  const [data, setData] = useState<KiyoMoneyFlowResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/kiyo/money-flow?period=${period}`);
        const body = await res.json();
        if (!res.ok || !body.ok) throw new Error(body.error ?? "取得に失敗しました");
        if (!cancelled) setData(body as KiyoMoneyFlowResult);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "取得に失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [period]);

  useEffect(() => {
    if (!pendingScrollId) return;
    function scrollToPending() {
      const el = document.getElementById(`mf-row-${pendingScrollId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      setPendingScrollId(null);
    }
    scrollToPending();
  }, [pendingScrollId, expanded]);

  const expandAndScrollTo = useCallback((id: string) => {
    setExpanded((prev) => new Set(prev).add(id));
    setPendingScrollId(id);
  }, []);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="期間切替" className="flex overflow-hidden rounded-none border border-border">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "min-h-9 px-3 text-xs font-medium",
                period === p.id ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:bg-muted/50",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {data?.range.seasonSource === "fallback_month" ? (
          <span className="text-[11px] text-amber-600 dark:text-amber-400">今シーズンの計画が見つからず今月で代用中</span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-none border border-red-400/60 bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</div>
      ) : null}

      {loading || !data ? (
        <>
          <SankeySkeleton />
          <StepsSkeleton />
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="min-w-0 overflow-x-auto rounded-none border border-border bg-background p-2 xl:shrink-0">
              <KiyoMoneyFlowSankey
                inflowProjects={data.inflow.byProject}
                outflowCategories={data.outflow.categories}
                walletBalanceYen={data.wallet.balanceYen}
                onSelectProject={(id) => expandAndScrollTo(`in-${id}`)}
                onSelectCategory={(key) => expandAndScrollTo(`out-${key}`)}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <KiyoMoneyFlowWalletCard
                walletBalanceYen={data.wallet.balanceYen}
                walletBalanceYm={data.wallet.balanceYm}
                inflowTotalYen={data.inflow.totalYen}
                outflowTotalYen={data.outflow.totalYen}
                netChangeYen={data.wallet.netChangeYen}
                loanRemainingYen={data.wallet.loanRemainingYen}
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">{data.summaryText}</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{data.note}</p>
              {data.warnings.map((warning, i) => (
                <p key={i} className="text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
                  {warning}
                </p>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <KiyoMoneyFlowInflowCard inflowProjects={data.inflow.byProject} expanded={expanded} onToggle={toggle} />
            <KiyoMoneyFlowOutflowCard outflowCategories={data.outflow.categories} expanded={expanded} onToggle={toggle} />
          </div>
        </>
      )}
    </div>
  );
}
