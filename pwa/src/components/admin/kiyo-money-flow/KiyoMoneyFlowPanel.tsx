"use client";

/**
 * きよ「00 お金の流れ」タブ本体。manual/6-11-kiyo-money-flow-spec.md が正本。
 *
 * 【キャッシュ分類】可変系 (freeeの同期で当日中に増える) だが更新頻度は日単位。
 * サーバ側 (/api/admin/kiyo/money-flow) がプロセス内 TTL 5分で持つのでここは素の fetch でよい。
 * scripts/reference_data_cache_baseline.json に理由付きで登録済み。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { KiyoMoneyFlowPeriodKind, KiyoMoneyFlowResult } from "@/lib/finance/kiyo-money-flow-types";
import { KiyoMoneyFlowSankey } from "./KiyoMoneyFlowSankey";
import {
  KiyoMoneyFlowRevenueCard,
  KiyoMoneyFlowCostCard,
  KiyoMoneyFlowCashCard,
  KiyoMoneyFlowMonthlyTable,
} from "./KiyoMoneyFlowSteps";
import { formatYmLabel } from "./format";

function recentMonths(count: number): string[] {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function KiyoMoneyFlowPanel() {
  const months = useMemo(() => recentMonths(6), []);
  const [period, setPeriod] = useState<KiyoMoneyFlowPeriodKind>("month");
  const [selectedYm, setSelectedYm] = useState<string>(months[0]);
  const [data, setData] = useState<KiyoMoneyFlowResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const query = period === "month" ? `period=month&ym=${selectedYm}` : `period=${period}`;
        const res = await fetch(`/api/admin/kiyo/money-flow?${query}`);
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
  }, [period, selectedYm]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectCost = useCallback((key: string) => {
    if (key === "__profit__") return;
    toggle(`cost-${key}`);
    const el = document.getElementById(`mf-row-cost-${key}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [toggle]);

  const tabClass = (active: boolean) =>
    cn("min-h-8 px-2.5 text-xs font-medium", active ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:bg-muted/50");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="月を選ぶ" className="flex overflow-hidden rounded-none border border-border">
          {months.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={period === "month" && selectedYm === m}
              onClick={() => {
                setPeriod("month");
                setSelectedYm(m);
              }}
              className={tabClass(period === "month" && selectedYm === m)}
            >
              {formatYmLabel(m)}
            </button>
          ))}
        </div>
        <div role="tablist" aria-label="期間をまとめる" className="flex overflow-hidden rounded-none border border-border">
          <button type="button" role="tab" aria-selected={period === "season"} onClick={() => setPeriod("season")} className={tabClass(period === "season")}>
            今シーズン
          </button>
          <button type="button" role="tab" aria-selected={period === "all"} onClick={() => setPeriod("all")} className={tabClass(period === "all")}>
            ぜんぶ
          </button>
        </div>
        {data ? <span className="text-[11px] text-muted-foreground">{data.range.label}</span> : null}
      </div>

      {error ? (
        <div className="rounded-none border border-red-400/60 bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</div>
      ) : null}

      {loading || !data ? (
        <>
          <div className="h-[220px] w-full animate-pulse rounded-none bg-muted/40" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-[180px] rounded-none border border-border bg-muted/20" />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="min-w-0 overflow-x-auto rounded-none border border-border bg-background p-2 xl:shrink-0">
              <KiyoMoneyFlowSankey
                revenueByPartner={data.pl.revenueByPartner}
                costGroups={data.pl.costGroups}
                profitYen={data.pl.profitYen}
                onSelectCost={selectCost}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <KiyoMoneyFlowCashCard
                inflowYen={data.cash.inflowYen}
                outflowYen={data.cash.outflowYen}
                netYen={data.cash.netYen}
                balanceYen={data.cash.balanceYen}
                balanceYm={data.cash.balanceYm}
                profitYen={data.pl.profitYen}
                complete={data.cash.complete}
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
            <KiyoMoneyFlowRevenueCard
              revenueByPartner={data.pl.revenueByPartner}
              revenueTotalYen={data.pl.revenueTotalYen}
              otherIncomeYen={data.pl.otherIncomeYen}
            />
            <KiyoMoneyFlowCostCard costGroups={data.pl.costGroups} costTotalYen={data.pl.costTotalYen} expanded={expanded} onToggle={toggle} />
          </div>

          <KiyoMoneyFlowMonthlyTable monthly={data.monthly} />
        </>
      )}
    </div>
  );
}
