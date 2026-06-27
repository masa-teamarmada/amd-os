"use client";

import { useMemo, useState } from "react";
import type {
  LaneId,
  LaneWeightRow,
  MacroIndexRow,
  OutcomePattern,
  PaperRow,
  SnapshotData,
  VentureRow,
} from "@/lib/venture-map-data";
import { Tex } from "./Tex";

// =====================================================================
// 静的定義（DBに持たない / 持つ予定もない or 別データソース予定）
// =====================================================================

const LANES: { id: LaneId; label: string; color: string }[] = [
  { id: "gx_energy",   label: "GX / エネルギー",       color: "#16a34a" },
  { id: "gx_circular", label: "GX / サーキュラー",     color: "#0891b2" },
  { id: "materials",   label: "素材 / ナノマテリアル", color: "#a16207" },
  { id: "life",        label: "ライフ / 医療",         color: "#be185d" },
  { id: "robo",        label: "ロボ / 農・モビリティ", color: "#7c3aed" },
];

const PATTERNS: Record<OutcomePattern, { color: string; emoji: string; label: string }> = {
  rocket:     { color: "#0ea5e9", emoji: "🚀", label: "離陸中" },
  lifted:     { color: "#16a34a", emoji: "✈️", label: "離陸完了 (AMD関与継続)" },
  deep_pivot: { color: "#8b5cf6", emoji: "🔄", label: "後付けdeep化" },
  burnout:    { color: "#ef4444", emoji: "🔥", label: "燃え尽き (XRL不足)" },
  ue_fail:    { color: "#6b7280", emoji: "💀", label: "UE失敗" },
};

// =====================================================================
// マクロ指数 / 論文数の年次推移 (Phase 4/5 で macro_index_log/papers_log に置換)
// =====================================================================

interface YearPoint {
  y: number;
  macro: number;
  papers: number;
}

const SERIES: Record<LaneId, YearPoint[]> = {
  gx_energy: [
    { y: 2010, macro: 0.10, papers: 0.20 },
    { y: 2012, macro: 0.12, papers: 0.25 },
    { y: 2014, macro: 0.18, papers: 0.30 },
    { y: 2016, macro: 0.25, papers: 0.38 },
    { y: 2018, macro: 0.28, papers: 0.45 },
    { y: 2020, macro: 0.42, papers: 0.55 },
    { y: 2022, macro: 0.58, papers: 0.62 },
    { y: 2023, macro: 0.66, papers: 0.66 },
    { y: 2024, macro: 0.74, papers: 0.71 },
    { y: 2025, macro: 0.80, papers: 0.74 },
    { y: 2026, macro: 0.84, papers: 0.78 },
  ],
  gx_circular: [
    { y: 2010, macro: 0.05, papers: 0.10 },
    { y: 2012, macro: 0.07, papers: 0.13 },
    { y: 2014, macro: 0.10, papers: 0.18 },
    { y: 2016, macro: 0.13, papers: 0.25 },
    { y: 2018, macro: 0.20, papers: 0.32 },
    { y: 2020, macro: 0.28, papers: 0.42 },
    { y: 2022, macro: 0.45, papers: 0.55 },
    { y: 2023, macro: 0.62, papers: 0.62 },
    { y: 2024, macro: 0.78, papers: 0.66 },
    { y: 2025, macro: 0.86, papers: 0.70 },
    { y: 2026, macro: 0.92, papers: 0.72 },
  ],
  materials: [
    { y: 2010, macro: 0.18, papers: 0.40 },
    { y: 2012, macro: 0.20, papers: 0.45 },
    { y: 2014, macro: 0.22, papers: 0.50 },
    { y: 2016, macro: 0.20, papers: 0.55 },
    { y: 2018, macro: 0.18, papers: 0.58 },
    { y: 2020, macro: 0.20, papers: 0.60 },
    { y: 2022, macro: 0.25, papers: 0.62 },
    { y: 2023, macro: 0.30, papers: 0.65 },
    { y: 2024, macro: 0.40, papers: 0.66 },
    { y: 2025, macro: 0.48, papers: 0.68 },
    { y: 2026, macro: 0.55, papers: 0.70 },
  ],
  life: [
    { y: 2010, macro: 0.30, papers: 0.50 },
    { y: 2012, macro: 0.32, papers: 0.52 },
    { y: 2014, macro: 0.34, papers: 0.55 },
    { y: 2016, macro: 0.36, papers: 0.58 },
    { y: 2018, macro: 0.40, papers: 0.62 },
    { y: 2020, macro: 0.48, papers: 0.66 },
    { y: 2022, macro: 0.55, papers: 0.70 },
    { y: 2023, macro: 0.58, papers: 0.74 },
    { y: 2024, macro: 0.62, papers: 0.76 },
    { y: 2025, macro: 0.66, papers: 0.78 },
    { y: 2026, macro: 0.70, papers: 0.80 },
  ],
  robo: [
    { y: 2010, macro: 0.15, papers: 0.20 },
    { y: 2012, macro: 0.18, papers: 0.22 },
    { y: 2014, macro: 0.20, papers: 0.25 },
    { y: 2016, macro: 0.25, papers: 0.30 },
    { y: 2018, macro: 0.30, papers: 0.35 },
    { y: 2020, macro: 0.40, papers: 0.40 },
    { y: 2022, macro: 0.50, papers: 0.45 },
    { y: 2023, macro: 0.55, papers: 0.48 },
    { y: 2024, macro: 0.60, papers: 0.50 },
    { y: 2025, macro: 0.66, papers: 0.52 },
    { y: 2026, macro: 0.70, papers: 0.54 },
  ],
};

// =====================================================================
// 政策イベント (将来 atlas_signals から policy 抽出に置換)
// =====================================================================

interface PolicyEvent {
  year: number;
  label: string;
  scope: "all" | LaneId[];
}

const POLICY_EVENTS: PolicyEvent[] = [
  { year: 2014, label: "ZEH/ZEB政策本格化", scope: ["materials", "gx_energy"] },
  { year: 2016, label: "パリ協定発効", scope: "all" },
  { year: 2020.83, label: "菅CN宣言", scope: "all" },
  { year: 2022.7, label: "GX実行会議", scope: "all" },
  { year: 2023.5, label: "GX推進法", scope: "all" },
  { year: 2024, label: "EU CBAM段階導入", scope: ["materials", "gx_circular"] },
  { year: 2025, label: "AMED 認知症重点", scope: ["life"] },
  { year: 2026, label: "GX-ETS本格化", scope: "all" },
];

// =====================================================================
// View B 用: 現時点指標 (Phase 3 で集計に置換)
// =====================================================================

function compositeScore(r: SnapshotData) {
  // 旧重み (0.4 macro + 0.2 papers + 0.2 policy + 0.1 invest + 0.1 seeds) から
  // seeds を削除し、その 0.1 を invest に再配分 (合計 1.0 維持)
  return 0.4 * r.macro + 0.2 * r.papers + 0.2 * r.policy + 0.2 * r.invest;
}

// =====================================================================
// 描画スケール (View A)
// =====================================================================

const X_MIN = 2010;
const X_MAX = 2027;
const NOW = 2026.34;

const SVG_W = 1480;
const SVG_H = 540;
const M_LEFT = 60;
const M_RIGHT = 220;
const M_TOP = 100;
const M_BOTTOM = 50;
const PLOT_W = SVG_W - M_LEFT - M_RIGHT;
const PLOT_H = SVG_H - M_TOP - M_BOTTOM;

function xOf(year: number) {
  return M_LEFT + ((year - X_MIN) / (X_MAX - X_MIN)) * PLOT_W;
}

function yOfMacro(value: number) {
  return M_TOP + PLOT_H - value * PLOT_H;
}

function dateToYearDecimal(iso: string): number {
  // 'YYYY-MM-DD' → year + (month-1)/12 + day/365 程度（簡易）
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 2020;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return y + (mo - 1) / 12;
}

// =====================================================================
// View
// =====================================================================

interface Props {
  ventures: VentureRow[];
  laneWeights: Partial<Record<LaneId, LaneWeightRow>>;
  macroLog: MacroIndexRow[];
  papersLog: PaperRow[];
  snapshot: SnapshotData[];
  lastLearnedAt?: string;
}

// macro_index_log を年単位に集約してSERIESに上書き、papers_log を年単位で正規化してSERIES.papersに上書き
function buildSeries(
  baseSeries: Record<LaneId, YearPoint[]>,
  macroLog: MacroIndexRow[],
  papersLog: PaperRow[]
): Record<LaneId, YearPoint[]> {
  const merged: Record<LaneId, YearPoint[]> = JSON.parse(JSON.stringify(baseSeries));

  // マクロ指数: lane × year で平均
  const macroByLaneYear = new Map<string, number[]>();
  for (const r of macroLog) {
    const year = Number(r.observed_at.slice(0, 4));
    const key = `${r.lane}_${year}`;
    if (!macroByLaneYear.has(key)) macroByLaneYear.set(key, []);
    macroByLaneYear.get(key)!.push(r.index_value);
  }
  const macroAvg = new Map<string, number>();
  for (const [k, vs] of macroByLaneYear) {
    macroAvg.set(k, vs.reduce((a, b) => a + b, 0) / vs.length);
  }

  // 論文数: lane で max を取って正規化
  const papersByLaneYear = new Map<string, number>();
  const maxByLane = new Map<LaneId, number>();
  for (const r of papersLog) {
    const year = Number(r.observed_at.slice(0, 4));
    const key = `${r.lane}_${year}`;
    papersByLaneYear.set(key, (papersByLaneYear.get(key) || 0) + r.paper_count);
    maxByLane.set(r.lane, Math.max(maxByLane.get(r.lane) || 0, r.paper_count));
  }

  // baseSeries の各 lane × point を上書き
  for (const lane of Object.keys(merged) as LaneId[]) {
    for (const p of merged[lane]) {
      const year = Math.floor(p.y);
      const macroKey = `${lane}_${year}`;
      const papersKey = `${lane}_${year}`;
      if (macroAvg.has(macroKey)) {
        p.macro = macroAvg.get(macroKey)!;
      }
      const max = maxByLane.get(lane) || 1;
      if (papersByLaneYear.has(papersKey) && max > 0) {
        p.papers = Math.min(1, papersByLaneYear.get(papersKey)! / max);
      }
    }
  }

  return merged;
}

export function VentureMapView({ ventures, laneWeights, macroLog, papersLog, snapshot, lastLearnedAt }: Props) {
  const [hoveredVenture, setHoveredVenture] = useState<VentureRow | null>(null);
  const [highlightLane, setHighlightLane] = useState<LaneId | null>(null);

  const series = useMemo(() => buildSeries(SERIES, macroLog, papersLog), [macroLog, papersLog]);

  const sortedSnapshot = useMemo(
    () => [...snapshot].sort((a, b) => compositeScore(b) - compositeScore(a)),
    [snapshot]
  );

  const lastLearnedDisp = lastLearnedAt
    ? new Date(lastLearnedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
    : "未学習";

  return (
    <div className="space-y-6">

      {/* View A */}
      <section className="rounded-xl border border-border bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">View A — マクロトレンド時系列マップ</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              縦軸=マクロ指数(実線) / 論文数(破線)、ピン=各SUの設立タイミング、点滅=予兆シーズ
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            {LANES.map((l) => (
              <button
                key={l.id}
                className={`px-2 py-0.5 rounded-md border ${
                  highlightLane === l.id ? "border-foreground" : "border-border"
                } hover:border-foreground transition`}
                style={{ color: l.color }}
                onMouseEnter={() => setHighlightLane(l.id)}
                onMouseLeave={() => setHighlightLane(null)}
                onClick={() => setHighlightLane(highlightLane === l.id ? null : l.id)}
              >
                ●&nbsp;{l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto block" style={{ minWidth: 1100 }}>
            {/* グリッド */}
            <g>
              {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                <g key={v}>
                  <line x1={M_LEFT} y1={yOfMacro(v)} x2={M_LEFT + PLOT_W} y2={yOfMacro(v)} stroke="#f1f5f9" />
                  <text x={M_LEFT - 6} y={yOfMacro(v) + 3} fontSize={9} fill="#94a3b8" textAnchor="end">
                    {v.toFixed(2)}
                  </text>
                  <text x={M_LEFT + PLOT_W + 6} y={yOfMacro(v) + 3} fontSize={9} fill="#94a3b8">
                    {(v * 100).toFixed(0)}
                  </text>
                </g>
              ))}
              <text x={M_LEFT - 30} y={M_TOP - 6} fontSize={9} fill="#475569">マクロ指数</text>
              <text x={M_LEFT + PLOT_W + 6} y={M_TOP - 6} fontSize={9} fill="#475569">論文数 (相対)</text>
            </g>

            {/* X軸 */}
            <g>
              {Array.from({ length: 18 }, (_, i) => 2010 + i).map((year) => (
                <g key={year}>
                  <line x1={xOf(year)} y1={M_TOP} x2={xOf(year)} y2={M_TOP + PLOT_H} stroke="#f8fafc" />
                  <text x={xOf(year)} y={M_TOP + PLOT_H + 14} fontSize={10} fill="#64748b" textAnchor="middle">
                    {year}
                  </text>
                </g>
              ))}
            </g>

            {/* 政策イベント */}
            {POLICY_EVENTS.map((ev, i) => {
              const isAll = ev.scope === "all";
              return (
                <g key={i}>
                  <line
                    x1={xOf(ev.year)}
                    y1={M_TOP}
                    x2={xOf(ev.year)}
                    y2={M_TOP + PLOT_H}
                    stroke={isAll ? "#f59e0b" : "#a3a3a3"}
                    strokeWidth={isAll ? 1.4 : 1}
                    strokeDasharray="3 3"
                    opacity={0.5}
                  />
                  <text
                    x={xOf(ev.year) + 3}
                    y={M_TOP - 60 + (i % 4) * 14}
                    fontSize={9}
                    fill={isAll ? "#b45309" : "#525252"}
                  >
                    {ev.label}
                  </text>
                </g>
              );
            })}

            {/* レーン折れ線 */}
            {LANES.map((lane) => {
              const data = series[lane.id];
              const dimmed = highlightLane && highlightLane !== lane.id;
              const opacity = dimmed ? 0.15 : 1;
              const macroPath = `M ${data.map((p) => `${xOf(p.y)},${yOfMacro(p.macro)}`).join(" L ")}`;
              const papersPath = `M ${data.map((p) => `${xOf(p.y)},${yOfMacro(p.papers)}`).join(" L ")}`;
              return (
                <g key={lane.id} opacity={opacity}>
                  <path d={papersPath} stroke={lane.color} strokeWidth={1.4} fill="none" strokeDasharray="4 3" opacity={0.5} />
                  <path d={macroPath} stroke={lane.color} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              );
            })}

            {/* SU プロット (DB から、founded_at がある PJ のみ) */}
            {ventures.filter((v) => v.founded_at).map((v) => {
              const founded = dateToYearDecimal(v.founded_at!);
              const data = series[v.lane];
              const sorted = [...data].sort((a, b) => a.y - b.y);
              let macro = sorted[0].macro;
              for (let i = 0; i < sorted.length - 1; i++) {
                if (sorted[i].y <= founded && founded <= sorted[i + 1].y) {
                  const t = (founded - sorted[i].y) / (sorted[i + 1].y - sorted[i].y);
                  macro = sorted[i].macro + t * (sorted[i + 1].macro - sorted[i].macro);
                  break;
                }
              }
              if (founded > sorted[sorted.length - 1].y) macro = sorted[sorted.length - 1].macro;

              const dimmed = highlightLane && highlightLane !== v.lane;
              const color = PATTERNS[v.outcome_pattern]?.color || "#888";
              return (
                <a key={v.project_id} href={`/venture-map/su/${v.project_id}`}>
                  <g
                    opacity={dimmed ? 0.2 : 1}
                    onMouseEnter={() => setHoveredVenture(v)}
                    onMouseLeave={() => setHoveredVenture(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <circle cx={xOf(founded)} cy={yOfMacro(macro)} r={6.5} fill={color} stroke="#fff" strokeWidth={1.5} />
                    <text x={xOf(founded) + 10} y={yOfMacro(macro) - 6} fontSize={11} fontWeight={700} fill={color}>
                      {v.project_name || v.project_id.toUpperCase()}
                    </text>
                  </g>
                </a>
              );
            })}

            {/* NOW */}
            <line x1={xOf(NOW)} y1={M_TOP} x2={xOf(NOW)} y2={M_TOP + PLOT_H} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="4 2" opacity={0.7} />
            <text x={xOf(NOW) + 4} y={M_TOP + PLOT_H + 30} fontSize={10} fill="#dc2626" fontWeight={600}>NOW</text>
          </svg>
        </div>

        {/* ホバー詳細 */}
        <div className="border-t border-border px-4 py-2 text-[12px] min-h-[44px]">
          {hoveredVenture ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-base">{PATTERNS[hoveredVenture.outcome_pattern]?.emoji}</span>
              <span className="font-semibold">{hoveredVenture.project_label}</span>
              <span className="text-muted-foreground">／ {LANES.find(l => l.id === hoveredVenture.lane)?.label}</span>
              <span className="text-muted-foreground">／ {hoveredVenture.founded_at}</span>
              {hoveredVenture.origin_org && (
                <span className="text-muted-foreground">／ {hoveredVenture.origin_org}{hoveredVenture.origin_pi ? ` ${hoveredVenture.origin_pi}` : ""}</span>
              )}
              {hoveredVenture.short_description && (
                <span className="text-muted-foreground">／ {hoveredVenture.short_description}</span>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">9社のピンにマウスを乗せて詳細表示。論文線がマクロ線より上にある領域 = 研究先行＝シーズ仕込み期。</p>
          )}
        </div>
      </section>

      {/* View B */}
      <section className="rounded-xl border border-border bg-white">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">View B — 現時点スナップショット (どこに立てるべきか)</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            5領域 × 5指標 / 総合温度 = 0.4·マクロ + 0.2·論文 + 0.2·政策 + 0.1·投資 + 0.1·シーズ
          </p>
        </div>
        <div className="px-4 py-3">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-1.5 font-medium">領域</th>
                <th className="py-1.5 font-medium">マクロ指数</th>
                <th className="py-1.5 font-medium">論文数</th>
                <th className="py-1.5 font-medium">政策密度</th>
                <th className="py-1.5 font-medium">投資密度</th>
                <th className="py-1.5 font-medium">総合温度</th>
                <th className="py-1.5 font-medium">判定</th>
              </tr>
            </thead>
            <tbody>
              {sortedSnapshot.map((r, idx) => {
                const lane = LANES.find((l) => l.id === r.lane)!;
                const score = compositeScore(r);
                const isTop = idx === 0;
                const paperLead = r.papers - r.macro > 0.15;
                const policyLead = r.macro - r.papers > 0.15;
                return (
                  <tr key={r.lane} className={`border-b border-border ${isTop ? "bg-amber-50" : ""}`}>
                    <td className="py-2">
                      <span style={{ color: lane.color }}>●</span>&nbsp;
                      <span className="font-medium">{lane.label}</span>
                    </td>
                    <Cell v={r.macro} />
                    <Cell v={r.papers} />
                    <Cell v={r.policy} />
                    <Cell v={r.invest} />
                    <td className="py-2 font-bold">
                      {(score * 100).toFixed(0)}{isTop && " 🔥"}
                    </td>
                    <td className="py-2 text-[11px]">
                      {paperLead && <span className="text-purple-700">研究先行 / シーズ仕込み期</span>}
                      {policyLead && <span className="text-orange-700">政策先行 / 研究集中要</span>}
                      {!paperLead && !policyLead && <span className="text-muted-foreground">バランス</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* View C */}
      <section className="rounded-xl border border-border bg-white">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">View C — モデル定式 (AMD のマクロ判断モデル)</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              重み α/β/γ/δ/λ/η は領域ごとに異なる。直近データを足して LLM で常時再学習する設計。
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground">最終再学習: {lastLearnedDisp}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-x divide-border">
          {/* 数式 (KaTeX) */}
          <div className="px-4 py-4 text-[13px] leading-relaxed text-slate-800 space-y-4">
            <div>
              <p className="mb-1.5 text-muted-foreground text-[11px]">
                1 マクロトレンド指数 <span className="text-[10px]">— 政策の累積効果を指数減衰でモデル化</span>
              </p>
              <Tex
                display
                tex={String.raw`M_i(t) = \alpha_i \int_{t-\tau}^{t} P_i(s)\, e^{-\lambda_i (t-s)}\, ds \;+\; \beta_i\, B_i(t) \;+\; \gamma_i\, V_i(t) \;+\; \delta_i\, R_i(t)`}
              />
            </div>

            <div>
              <p className="mb-1.5 text-muted-foreground text-[11px]">
                2 事業化適温度 <span className="text-[10px]">— 競合密度は冪指数で効く</span>
              </p>
              <Tex
                display
                tex={String.raw`T_i(t) = M_i(t) \cdot S_i^{\,\kappa} \cdot \bigl(1 - C_i(t)\bigr)^{\eta_i}`}
              />
            </div>

            <div>
              <p className="mb-1.5 text-muted-foreground text-[11px]">
                3 論文-政策乖離 <span className="text-[10px]">— 一次微分で先行度、二次微分で変曲点を検出</span>
              </p>
              <Tex
                display
                tex={String.raw`D_i(t) = \frac{dN_i}{dt} - \frac{dM_i}{dt}, \qquad D_i'(t) = \frac{d^2 N_i}{dt^2} - \frac{d^2 M_i}{dt^2}`}
              />
              <p className="text-[11px] mt-1.5 space-y-0.5">
                <span className="block text-purple-700">D &gt; 0 : 研究先行 → シーズ仕込み期</span>
                <span className="block text-orange-700">D &lt; 0 : 政策先行 → 研究集中要請</span>
                <span className="block text-emerald-700">D&apos; が極大 : 領域転換点接近 → 投下シグナル</span>
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-muted-foreground text-[11px]">
                4 設立タイミングシグナル <span className="text-[10px]">— 波の積分平均 + 加速度ボーナス</span>
              </p>
              <Tex
                display
                tex={String.raw`\sigma_{\mathrm{SU}} = \frac{1}{\Delta t}\int_{t_0 - \Delta t}^{t_0} T_i(s)\, ds \;+\; \mu \cdot \left.\frac{d^2 M_i}{dt^2}\right|_{t_0}`}
              />
            </div>
          </div>

          {/* 重みベクトル表 (DBから) */}
          <div className="px-4 py-3 text-[12px]">
            <p className="text-muted-foreground text-[11px] mb-2 font-sans">
              領域別パラメータ（最新推定値・Supabase macro_lane_weights から取得）
            </p>
            <table className="w-full font-mono">
              <thead>
                <tr className="text-left text-[10px] text-muted-foreground">
                  <th className="py-1 font-medium">i</th>
                  <th className="py-1 font-medium">α</th>
                  <th className="py-1 font-medium">β</th>
                  <th className="py-1 font-medium">γ</th>
                  <th className="py-1 font-medium">δ</th>
                  <th className="py-1 font-medium">λ</th>
                  <th className="py-1 font-medium">η</th>
                </tr>
              </thead>
              <tbody>
                {LANES.map((lane) => {
                  const w = laneWeights[lane.id];
                  return (
                    <tr key={lane.id} className="border-t border-border">
                      <td className="py-1.5 font-sans">
                        <span style={{ color: lane.color }}>●</span>&nbsp;{lane.label}
                      </td>
                      <td className="py-1.5">{w ? Number(w.alpha).toFixed(2) : "—"}</td>
                      <td className="py-1.5">{w ? Number(w.beta).toFixed(2) : "—"}</td>
                      <td className="py-1.5">{w ? Number(w.gamma).toFixed(2) : "—"}</td>
                      <td className="py-1.5">{w ? Number(w.delta).toFixed(2) : "—"}</td>
                      <td className="py-1.5">{w?.lambda != null ? Number(w.lambda).toFixed(2) : "—"}</td>
                      <td className="py-1.5">{w?.eta != null ? Number(w.eta).toFixed(2) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-[10px] text-muted-foreground font-sans space-y-0.5">
              <span className="block">※ α/β/γ/δ = 入力チャネル重み、λ = 政策効果の減衰率、η = 競合密度の効き方</span>
              <span className="block">※ 領域 i ごとに異なる。Sonnet 4.7 が直近データから 24h ごとに再推定する設計（cron は Phase 6）</span>
              <span className="block">※ τ = 過去参照窓 (24ヶ月)、κ = 0.7、μ = 0.15 (グローバル定数として固定)</span>
            </p>
          </div>
        </div>
      </section>

      {/* デモ構成案 */}
      <section className="rounded-xl border border-border bg-amber-50/50 px-4 py-3 text-[12px]">
        <p className="font-semibold mb-2">Part3 デモ構成案 (暫定)</p>
        <ol className="list-decimal list-inside space-y-1 text-amber-900">
          <li>1 View A → &quot;マクロが定量化されてる、その波の頂点に AMD は SU を立ててきた&quot;</li>
          <li>2 ティエムにフォーカス → &quot;波が来る前に立てて燃え尽き / だから AMD OS を作った&quot;</li>
          <li>3 JC にフォーカス → &quot;後付けで deep化した珍しいケース&quot;</li>
          <li>4 View A の論文-マクロ乖離を強調 → &quot;素材レーンは研究先行＝シーズ仕込み期&quot;</li>
          <li>5 View B → &quot;今、最アツは GX サーキュラー / SX や LST がそこに立っている&quot;</li>
          <li>6 View C → &quot;ここまで定式化している DT スタジオは他にない&quot;</li>
          <li>7 &quot;この続きを実装するために、つくば地域ファンドが必要&quot;</li>
        </ol>
      </section>

    </div>
  );
}

function Cell({ v }: { v: number }) {
  const fillCount = Math.round(v * 5);
  return (
    <td className="py-2">
      <span className="inline-block tracking-tighter">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={i < fillCount ? "text-foreground" : "text-muted-foreground/30"}>█</span>
        ))}
      </span>
      <span className="ml-2 text-[10px] text-muted-foreground">{(v * 100).toFixed(0)}</span>
    </td>
  );
}
