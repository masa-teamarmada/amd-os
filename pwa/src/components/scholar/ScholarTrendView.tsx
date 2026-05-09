"use client";

import { useMemo, useState } from "react";
import type { ScholarPaperRow } from "@/app/(app)/scholar/page";

const LANES = ["gx_energy", "gx_circular", "materials", "life", "robo"] as const;
type Lane = (typeof LANES)[number];

const LANE_LABEL: Record<Lane, string> = {
  gx_energy: "GX エネルギー",
  gx_circular: "GX サーキュラー",
  materials: "マテリアル",
  life: "ライフ",
  robo: "ロボ",
};

const LANE_COLOR: Record<Lane, string> = {
  gx_energy: "#10b981", // emerald
  gx_circular: "#14b8a6", // teal
  materials: "#f59e0b", // amber
  life: "#ec4899", // rose
  robo: "#0ea5e9", // sky
};

interface QuarterBucket {
  quarter: string; // "2025-Q3"
  observed_at: string; // YYYY-MM-DD
}

function dateToQuarter(observedAt: string): string {
  const [yy, mm] = observedAt.split("-");
  const month = parseInt(mm, 10);
  const q = Math.floor((month - 1) / 3) + 1;
  return `${yy}-Q${q}`;
}

export function ScholarTrendView({ rows }: { rows: ScholarPaperRow[] }) {
  const [hoveredLane, setHoveredLane] = useState<Lane | null>(null);

  // quarter ごとに各 lane の値を整理
  const data = useMemo(() => {
    const byQuarter = new Map<string, { quarter: string; observed_at: string; counts: Partial<Record<Lane, number>> }>();
    for (const r of rows) {
      const quarter = dateToQuarter(r.observed_at);
      if (!byQuarter.has(quarter)) {
        byQuarter.set(quarter, { quarter, observed_at: r.observed_at, counts: {} });
      }
      byQuarter.get(quarter)!.counts[r.lane as Lane] = r.paper_count;
    }
    return Array.from(byQuarter.values()).sort((a, b) => a.observed_at.localeCompare(b.observed_at));
  }, [rows]);

  if (data.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-amber-300 bg-amber-50/40 p-6 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        <strong>papers_log が空です。</strong>
        <p className="mt-2 text-xs">
          初回 cron が走るまで待つか、以下を実行して手動キックしてください:
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-amber-100 p-2 text-[11px] dark:bg-amber-900/40">
          {`SECRET=$(grep '^CRON_SECRET=' /Users/masa/projects/AMD/amd-os/pwa/.env.local | sed 's/^CRON_SECRET=//' | tr -d '"')
curl -sL --max-time 300 -H "Authorization: Bearer $SECRET" \\
  https://amd-os-pwa.vercel.app/api/cron/papers-quarterly-ingest`}
        </pre>
      </div>
    );
  }

  // 全 lane の値で y 軸 max 計算
  const yMax = Math.max(
    ...data.flatMap((d) => LANES.map((l) => d.counts[l] ?? 0)),
    1
  );

  // 前年同期比 (直近 Q vs 4 Q 前)
  const yoyByLane = useMemo(() => {
    const out: Record<Lane, { current: number; yearAgo: number; pct: number | null }> = {} as Record<
      Lane,
      { current: number; yearAgo: number; pct: number | null }
    >;
    for (const lane of LANES) {
      const values = data.map((d) => d.counts[lane] ?? null).filter((v): v is number => v != null);
      const current = values.at(-1) ?? 0;
      const yearAgo = values.length > 4 ? values.at(-5) ?? 0 : 0;
      const pct = yearAgo > 0 ? ((current - yearAgo) / yearAgo) * 100 : null;
      out[lane] = { current, yearAgo, pct };
    }
    return out;
  }, [data]);

  return (
    <div className="space-y-6">
      {/* === 前年同期比カード × 5 lane === */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {LANES.map((lane) => {
          const yoy = yoyByLane[lane];
          const pct = yoy.pct;
          return (
            <button
              type="button"
              key={lane}
              onMouseEnter={() => setHoveredLane(lane)}
              onMouseLeave={() => setHoveredLane(null)}
              className={`rounded-md border bg-white p-2.5 text-left transition-colors hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 ${
                hoveredLane === lane ? "border-slate-900 dark:border-slate-100" : "border-slate-200 dark:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: LANE_COLOR[lane] }}
                />
                <span className="text-xs font-medium text-slate-900 dark:text-slate-100">{LANE_LABEL[lane]}</span>
              </div>
              <div className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                {yoy.current.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">本/直近 Q</div>
              {pct != null && (
                <div
                  className={`mt-1 text-xs font-mono tabular-nums ${
                    pct > 5
                      ? "text-emerald-600 dark:text-emerald-400"
                      : pct < -5
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  前年同期比 {pct > 0 ? "+" : ""}
                  {pct.toFixed(1)}%
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* === Line chart === */}
      <TrendChart data={data} yMax={yMax} hoveredLane={hoveredLane} />

      {/* === Quarterly table === */}
      <QuarterlyTable data={data} />
    </div>
  );
}

// =====================================================================
// Line chart (SVG)
// =====================================================================

function TrendChart({
  data,
  yMax,
  hoveredLane,
}: {
  data: { quarter: string; observed_at: string; counts: Partial<Record<Lane, number>> }[];
  yMax: number;
  hoveredLane: Lane | null;
}) {
  const W = 800;
  const H = 280;
  const padL = 60;
  const padR = 20;
  const padT = 20;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xStep = data.length > 1 ? innerW / (data.length - 1) : 0;
  const yScale = (v: number) => padT + innerH - (v / yMax) * innerH;

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        観測値 y_N (lane × quarter, 本/Q)
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 320 }}>
        {/* grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <g key={p}>
            <line
              x1={padL}
              x2={W - padR}
              y1={padT + innerH * (1 - p)}
              y2={padT + innerH * (1 - p)}
              stroke="#e2e8f0"
              strokeDasharray="2 4"
            />
            <text
              x={padL - 6}
              y={padT + innerH * (1 - p) + 4}
              textAnchor="end"
              fontSize="10"
              fill="#64748b"
              className="font-mono tabular-nums"
            >
              {Math.round(yMax * p).toLocaleString()}
            </text>
          </g>
        ))}

        {/* x labels (every 4 quarter) */}
        {data.map((d, i) => {
          if (i % 4 !== 0 && i !== data.length - 1) return null;
          const x = padL + xStep * i;
          return (
            <text key={d.quarter} x={x} y={H - padB + 16} textAnchor="middle" fontSize="10" fill="#64748b">
              {d.quarter}
            </text>
          );
        })}

        {/* lines */}
        {LANES.map((lane) => {
          const points = data
            .map((d, i) => {
              const v = d.counts[lane];
              if (v == null) return null;
              return `${padL + xStep * i},${yScale(v)}`;
            })
            .filter((p): p is string => p != null)
            .join(" ");
          const isHover = hoveredLane === null || hoveredLane === lane;
          return (
            <polyline
              key={lane}
              points={points}
              fill="none"
              stroke={LANE_COLOR[lane]}
              strokeWidth={isHover ? 2 : 1}
              opacity={isHover ? 1 : 0.25}
            />
          );
        })}

        {/* points */}
        {LANES.map((lane) => {
          const isHover = hoveredLane === null || hoveredLane === lane;
          return data.map((d, i) => {
            const v = d.counts[lane];
            if (v == null) return null;
            return (
              <circle
                key={`${lane}-${d.quarter}`}
                cx={padL + xStep * i}
                cy={yScale(v)}
                r={2}
                fill={LANE_COLOR[lane]}
                opacity={isHover ? 1 : 0.25}
              >
                <title>{`${LANE_LABEL[lane]} ${d.quarter}: ${v.toLocaleString()} 本`}</title>
              </circle>
            );
          });
        })}
      </svg>
    </div>
  );
}

// =====================================================================
// Quarterly table
// =====================================================================

function QuarterlyTable({
  data,
}: {
  data: { quarter: string; observed_at: string; counts: Partial<Record<Lane, number>> }[];
}) {
  const recent = data.slice(-8); // 直近 8 quarter
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 dark:bg-slate-900/60">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Lane</th>
            {recent.map((d) => (
              <th
                key={d.quarter}
                className="px-3 py-2 text-right font-mono text-[11px] font-medium text-slate-500 tabular-nums dark:text-slate-400"
              >
                {d.quarter}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LANES.map((lane) => (
            <tr key={lane} className="border-t border-slate-200 dark:border-slate-800">
              <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                <span
                  className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ backgroundColor: LANE_COLOR[lane] }}
                />
                {LANE_LABEL[lane]}
              </td>
              {recent.map((d) => {
                const v = d.counts[lane];
                return (
                  <td
                    key={`${lane}-${d.quarter}`}
                    className="px-3 py-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300"
                  >
                    {v != null ? v.toLocaleString() : <span className="text-slate-400">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
