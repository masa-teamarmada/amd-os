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
    <div data-testid={`cockpit-bzm22-metric-${symbol.toLowerCase()}`} className="min-w-0 border-b border-slate-200 px-3 py-1.5 last:border-b-0">
      <div className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-baseline gap-x-1.5">
        <span className="text-[20px] font-black leading-none text-[#173f51]">{symbol}</span>
        <span className="text-[10px] font-semibold leading-4 text-slate-600">{metric.title}</span>
        <span className="text-right font-mono text-[15px] font-bold tabular-nums text-[#173f51]">{formatMetric(value.base, kind)}</span>
        <div className="col-start-2 col-span-2 mt-0.5 overflow-x-auto whitespace-nowrap text-[9px] leading-4 text-[#376274]"><Tex tex={metric.formula} /></div>
        <p className="col-start-2 col-span-2 text-[8px] leading-3 text-slate-500">{metric.description}</p>
      </div>
    </div>
  );
}

export function Bzm22CockpitSummary({
  projectId,
  onOpenScoreDetail,
  compact = false,
  embedded = false,
}: {
  projectId: string;
  onOpenScoreDetail: () => void;
  compact?: boolean;
  embedded?: boolean;
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
      <section data-testid="cockpit-bzm22-primary" className={embedded ? "h-full min-h-48 bg-[#f6f8f8] px-3 py-2" : `mx-2 border border-[#7898a5] bg-[#f6f8f8] px-3 py-2 ${compact ? "mt-1" : "mt-3"}`}>
        <div className="text-[12px] font-bold text-[#173f51]">BZM 2.2</div>
        <div className="mt-1 text-[10px] text-slate-500">
          {state.status === "loading" ? "評価日時点の4指標を読み込み中…" : "このPJのBZM 2.2試算は準備中。"}
        </div>
      </section>
    );
  }

  const { pilot } = state;

  return (
    <section data-testid="cockpit-bzm22-primary" data-layout={embedded ? "value-rail" : "standalone"} className={embedded ? "h-full min-w-0 overflow-hidden bg-white" : `mx-2 overflow-hidden border border-[#7898a5] bg-white ${compact ? "mt-1" : "mt-3"}`}>
      <div className="flex min-h-11 items-center justify-between gap-2 border-b border-[#7898a5] bg-[#162f3a] px-3 text-white">
        <div>
          <span className="text-[12px] font-bold">BZM 2.2</span>
        </div>
        <button type="button" onClick={onOpenScoreDetail} className="inline-flex min-h-11 items-center text-[9px] font-semibold text-cyan-100 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100">
          103パラメータと計算 →
        </button>
      </div>
      <div data-testid="cockpit-bzm22-value-rail" className="grid">
        <Metric symbol="J" value={pilot.summary.jValueMillionJpy} kind="money" />
        <Metric symbol="P" value={pilot.summary.conditionalSuccessValueMillionJpy} kind="money" />
        <Metric symbol="Q" value={pilot.summary.qGateProductProxy} kind="rate" />
        <Metric symbol="S" value={pilot.summary.qStressProxy} kind="rate" />
      </div>
      <div className="border-t border-[#b9cbd1] bg-[#edf3f5] px-3 py-1 text-[7px] leading-3 text-[#365865]">
        <span className="font-semibold"><Tex tex={BZM22_FIXED_POLICY.formula} /></span> = 評価中の進め方。CF=月次収支、TV=到達後価値、RV=停止時価値、p=条件通過値。
      </div>
    </section>
  );
}
