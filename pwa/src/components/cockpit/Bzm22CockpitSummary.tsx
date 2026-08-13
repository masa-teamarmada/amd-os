"use client";

import { useEffect, useState } from "react";
import { Tex } from "@/components/venture-map/Tex";
import {
  BZM22_FIXED_POLICY,
  BZM22_TOP_METRICS,
  formatMillionJpy,
  type Bzm22PilotSummary,
  type Bzm22PilotSummaryApiPayload,
  type Bzm22Scenario,
} from "@/lib/bzm-2-2-pilot-ui";

function formatMetric(value: number | null, kind: "money" | "rate") {
  if (value == null || !Number.isFinite(value)) return "—";
  if (kind === "money") return formatMillionJpy(value);
  return `${Math.round(value * 100)}%`;
}

function Metric({
  symbol,
  value,
  kind,
}: {
  symbol: keyof typeof BZM22_TOP_METRICS;
  value: Bzm22Scenario<number | null>;
  kind: "money" | "rate";
}) {
  const metric = BZM22_TOP_METRICS[symbol];
  return (
    <div className="min-w-0 border-l border-slate-200 px-3 first:border-l-0">
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-black text-[#173f51]">{symbol}</span>
        <span className="text-[10px] font-semibold text-slate-600">{metric.title}</span>
      </div>
      <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#173f51]">{formatMetric(value.base, kind)}</div>
      <div className="mt-1 overflow-x-auto whitespace-nowrap text-[10px] text-[#376274]"><Tex tex={metric.formula} /></div>
      <div className="mt-1 text-[8px] font-semibold text-amber-800">暫定・未校正</div>
      <p className="mt-1 text-[9px] leading-4 text-slate-500">{metric.description}</p>
    </div>
  );
}

export function Bzm22CockpitSummary({
  projectId,
  onOpenScoreDetail,
}: {
  projectId: string;
  onOpenScoreDetail: () => void;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; pilot: Bzm22PilotSummary }
    | { status: "unavailable" }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/project/${encodeURIComponent(projectId)}/bzm-2-2-pilot?view=summary`, {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => response.ok ? response.json() as Promise<Bzm22PilotSummaryApiPayload> : null)
      .then((payload) => {
        if (!cancelled) setState(payload?.pilot ? { status: "ready", pilot: payload.pilot } : { status: "unavailable" });
      })
      .catch(() => { if (!cancelled) setState({ status: "unavailable" }); });
    return () => { cancelled = true; };
  }, [projectId]);

  if (state.status !== "ready") {
    return (
      <section data-testid="cockpit-bzm22-primary" className="mx-2 mt-3 border border-[#7898a5] bg-[#f6f8f8] px-3 py-3">
        <div className="text-[12px] font-bold text-[#173f51]">BZM 2.2</div>
        <div className="mt-1 text-[10px] text-slate-500">
          {state.status === "loading" ? "評価日時点の4指標を読み込み中…" : "このPJのBZM 2.2試算は準備中。"}
        </div>
      </section>
    );
  }

  const { pilot } = state;

  return (
    <section data-testid="cockpit-bzm22-primary" className="mx-2 mt-3 overflow-hidden border border-[#7898a5] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#7898a5] bg-[#162f3a] px-3 py-2 text-white">
        <div>
          <span className="text-[12px] font-bold">BZM 2.2</span>
          <span className="ml-2 text-[9px] text-slate-300">現在方針の影試算 · 未検証</span>
        </div>
        <button type="button" onClick={onOpenScoreDetail} className="text-[10px] font-semibold text-cyan-100 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100">
          103パラメータと計算を見る →
        </button>
      </div>
      <div className="grid gap-y-3 py-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric symbol="J" value={pilot.summary.jValueMillionJpy} kind="money" />
        <Metric symbol="P" value={pilot.summary.conditionalSuccessValueMillionJpy} kind="money" />
        <Metric symbol="Q" value={pilot.summary.qGateProductProxy} kind="rate" />
        <Metric symbol="S" value={pilot.summary.qStressProxy} kind="rate" />
      </div>
      <div className="border-t border-[#b9cbd1] bg-[#edf3f5] px-3 py-1.5 text-[8px] leading-4 text-[#365865]">
        <span className="font-semibold"><Tex tex={BZM22_FIXED_POLICY.formula} /></span> = 登録済み固定方針（shadow・最適化なし）。CF=月ごとの収支、TV=目標到達後の将来価値、RV=途中で止まった時の残存価値、p=各条件の通過値。Q/Sは未校正の比較用指数で、Sは戦略余力全体ではない。
      </div>
    </section>
  );
}
