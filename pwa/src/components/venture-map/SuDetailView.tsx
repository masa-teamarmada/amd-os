"use client";

import Link from "next/link";
import type { VentureRow, XrlLogRow, MacroIndexRow } from "@/lib/venture-map-data";

// =====================================================================
// 静的定義
// =====================================================================

const LANE_LABELS: Record<string, string> = {
  gx_energy:   "GX / エネルギー",
  gx_circular: "GX / サーキュラー",
  materials:   "素材 / ナノマテリアル",
  life:        "ライフ / 医療",
  robo:        "ロボ / 農・モビリティ",
};

const LANE_COLORS: Record<string, string> = {
  gx_energy:   "#16a34a",
  gx_circular: "#0891b2",
  materials:   "#a16207",
  life:        "#be185d",
  robo:        "#7c3aed",
};

const OUTCOME_LABELS: Record<string, { emoji: string; label: string; color: string }> = {
  rocket:     { emoji: "🚀", label: "離陸中",                 color: "#0ea5e9" },
  lifted:     { emoji: "✈️", label: "離陸完了",               color: "#16a34a" },
  deep_pivot: { emoji: "🔄", label: "後付けdeep化",           color: "#8b5cf6" },
  burnout:    { emoji: "🔥", label: "燃え尽き (XRL不足)",     color: "#ef4444" },
  ue_fail:    { emoji: "💀", label: "UE失敗",                 color: "#6b7280" },
};

const XRL_COLORS = {
  trl: "#0ea5e9",
  brl: "#f59e0b",
  hrl: "#16a34a",
};

// =====================================================================
// SVG スケール
// =====================================================================

const SVG_W = 900;
const SVG_H = 320;
const ML = 56;
const MR = 160;
const MT = 40;
const MB = 44;
const PW = SVG_W - ML - MR;
const PH = SVG_H - MT - MB;

function xOf(year: number, xMin: number, xMax: number) {
  return ML + ((year - xMin) / (xMax - xMin)) * PW;
}
function yOf(v: number) {
  return MT + PH - (v / 9) * PH;
}
function yOfMacro(v: number) {
  return MT + PH - v * PH;
}
function isoToYear(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return 2020;
  return Number(m[1]) + (Number(m[2]) - 1) / 12;
}

// =====================================================================
// Component
// =====================================================================

interface Props {
  venture: VentureRow;
  xrlLog: XrlLogRow[];
  macroLog: MacroIndexRow[];
}

export function SuDetailView({ venture, xrlLog, macroLog }: Props) {
  const laneColor = LANE_COLORS[venture.lane] || "#888";
  const outcome = OUTCOME_LABELS[venture.outcome_pattern];

  // X軸範囲
  const foundedYear = venture.founded_at ? isoToYear(venture.founded_at) : new Date().getFullYear();
  const xMin = Math.max(2009, Math.floor(foundedYear) - 2);
  const xMax = xMin + Math.max(8, Math.ceil(foundedYear) - xMin + 6);

  // XRL series (ポイント → 線)
  const trlPoints = xrlLog.filter((r) => r.trl != null).map((r) => ({
    year: isoToYear(r.observed_at),
    v: r.trl!,
    label: r.milestone_label,
    bottleneck: r.bottleneck,
  }));
  const brlPoints = xrlLog.filter((r) => r.brl != null).map((r) => ({
    year: isoToYear(r.observed_at),
    v: r.brl!,
    label: r.milestone_label,
    bottleneck: r.bottleneck,
  }));
  const hrlPoints = xrlLog.filter((r) => r.hrl != null).map((r) => ({
    year: isoToYear(r.observed_at),
    v: r.hrl!,
    label: r.milestone_label,
    bottleneck: r.bottleneck,
  }));

  // マクロ指数を月→年decimal
  const macroPoints = macroLog
    .map((r) => ({ year: isoToYear(r.observed_at), v: r.index_value }))
    .sort((a, b) => a.year - b.year);

  const makePath = (pts: { year: number; v: number }[], yFn: (v: number) => number) =>
    pts.length < 2
      ? ""
      : "M " + pts.map((p) => `${xOf(p.year, xMin, xMax).toFixed(1)},${yFn(p.v).toFixed(1)}`).join(" L ");

  const trlPath    = makePath(trlPoints, yOf);
  const brlPath    = makePath(brlPoints, yOf);
  const hrlPath    = makePath(hrlPoints, yOf);
  const macroPath  = makePath(macroPoints, yOfMacro);

  // ボトルネック判定（最後のログから）
  const latestXrl = [...xrlLog].sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];

  // XRL グリッド Y ラベル (1-9)
  const yGridLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div className="space-y-5">

      {/* ヘッダー */}
      <div className="rounded-xl border border-border bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{outcome?.emoji}</span>
              <h1 className="text-xl font-bold">{venture.project_name}</h1>
              <span
                className="text-[11px] font-mono px-2 py-0.5 rounded-full border"
                style={{ color: laneColor, borderColor: laneColor }}
              >
                {LANE_LABELS[venture.lane]}
              </span>
              <span
                className="text-[11px] font-mono px-2 py-0.5 rounded-full"
                style={{ backgroundColor: outcome?.color + "22", color: outcome?.color }}
              >
                {outcome?.label}
              </span>
            </div>
            <div className="mt-2 text-[13px] text-muted-foreground space-x-3">
              {venture.origin_org && <span>{venture.origin_org}</span>}
              {venture.origin_pi && <span>/ {venture.origin_pi}</span>}
              {venture.founded_at && <span>/ 設立 {venture.founded_at.slice(0, 7)}</span>}
              <span>/ {venture.status}</span>
            </div>
            {venture.short_description && (
              <p className="mt-2 text-[13px] text-slate-700">{venture.short_description}</p>
            )}
          </div>
          <Link
            href="/venture-map"
            className="text-[12px] text-muted-foreground hover:underline whitespace-nowrap"
          >
            ← Venture Map に戻る
          </Link>
        </div>
      </div>

      {/* XRL × マクロ指数チャート */}
      <div className="rounded-xl border border-border bg-white">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">XRL 進捗 × マクロ指数 (領域: {LANE_LABELS[venture.lane]})</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              左軸=XRLレベル (1-9) / 右軸=マクロ指数 (0-1)。
              ボトルネックとなるレイヤが設立タイミングの適否を決める。
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            {(["trl", "brl", "hrl"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span style={{ color: XRL_COLORS[k] }}>—</span>
                <span className="uppercase font-mono">{k}</span>
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span style={{ color: laneColor }}>- -</span>
              <span>マクロ指数</span>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto px-2 py-2">
          {xrlLog.length === 0 ? (
            <p className="text-[12px] text-muted-foreground px-4 py-6">XRLデータがありません</p>
          ) : (
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto block" style={{ minWidth: 700 }}>

              {/* グリッド X */}
              {Array.from({ length: Math.ceil(xMax - xMin) + 1 }, (_, i) => xMin + i).map((yr) => (
                <g key={yr}>
                  <line x1={xOf(yr, xMin, xMax)} y1={MT} x2={xOf(yr, xMin, xMax)} y2={MT + PH} stroke="#f1f5f9" />
                  <text x={xOf(yr, xMin, xMax)} y={MT + PH + 14} fontSize={10} fill="#64748b" textAnchor="middle">
                    {yr}
                  </text>
                </g>
              ))}

              {/* グリッド Y (XRL 1-9) */}
              {yGridLevels.map((lv) => (
                <g key={lv}>
                  <line x1={ML} y1={yOf(lv)} x2={ML + PW} y2={yOf(lv)} stroke="#f1f5f9" />
                  <text x={ML - 6} y={yOf(lv) + 3} fontSize={9} fill="#94a3b8" textAnchor="end">{lv}</text>
                </g>
              ))}

              {/* 右Y軸ラベル (マクロ指数 0/0.5/1) */}
              {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                <text key={v} x={ML + PW + 6} y={yOfMacro(v) + 3} fontSize={9} fill="#94a3b8">{v.toFixed(2)}</text>
              ))}
              <text x={ML - 32} y={MT - 8} fontSize={9} fill="#475569">XRLレベル</text>
              <text x={ML + PW + 6} y={MT - 8} fontSize={9} fill="#475569">マクロ指数</text>

              {/* 設立タイミング (founded_at がある PJ のみ) */}
              {venture.founded_at && (
                <>
                  <line
                    x1={xOf(foundedYear, xMin, xMax)} y1={MT}
                    x2={xOf(foundedYear, xMin, xMax)} y2={MT + PH}
                    stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" opacity={0.7}
                  />
                  <text
                    x={xOf(foundedYear, xMin, xMax) + 4} y={MT + 12}
                    fontSize={9} fill="#b45309"
                  >
                    設立 {venture.founded_at.slice(0, 7)}
                  </text>
                </>
              )}

              {/* マクロ指数 破線 */}
              {macroPath && (
                <path d={macroPath} stroke={laneColor} strokeWidth={1.8} fill="none" strokeDasharray="5 3" opacity={0.5} />
              )}

              {/* TRL / BRL / HRL 折れ線 */}
              {trlPath && <path d={trlPath} stroke={XRL_COLORS.trl} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
              {brlPath && <path d={brlPath} stroke={XRL_COLORS.brl} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
              {hrlPath && <path d={hrlPath} stroke={XRL_COLORS.hrl} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />}

              {/* TRL ポイント + マイルストーン */}
              {trlPoints.map((p, i) => (
                <g key={i}>
                  <circle cx={xOf(p.year, xMin, xMax)} cy={yOf(p.v)} r={5} fill={XRL_COLORS.trl} stroke="#fff" strokeWidth={1.5} />
                  {p.bottleneck === "TRL" && (
                    <circle cx={xOf(p.year, xMin, xMax)} cy={yOf(p.v)} r={9} fill="none" stroke={XRL_COLORS.trl} strokeWidth={1.2} opacity={0.4} />
                  )}
                </g>
              ))}
              {brlPoints.map((p, i) => (
                <g key={i}>
                  <circle cx={xOf(p.year, xMin, xMax)} cy={yOf(p.v)} r={5} fill={XRL_COLORS.brl} stroke="#fff" strokeWidth={1.5} />
                  {p.bottleneck === "BRL" && (
                    <circle cx={xOf(p.year, xMin, xMax)} cy={yOf(p.v)} r={9} fill="none" stroke={XRL_COLORS.brl} strokeWidth={1.2} opacity={0.4} />
                  )}
                </g>
              ))}
              {hrlPoints.map((p, i) => (
                <g key={i}>
                  <circle cx={xOf(p.year, xMin, xMax)} cy={yOf(p.v)} r={5} fill={XRL_COLORS.hrl} stroke="#fff" strokeWidth={1.5} />
                  {p.bottleneck === "HRL" && (
                    <circle cx={xOf(p.year, xMin, xMax)} cy={yOf(p.v)} r={9} fill="none" stroke={XRL_COLORS.hrl} strokeWidth={1.2} opacity={0.4} />
                  )}
                </g>
              ))}

            </svg>
          )}
        </div>
      </div>

      {/* マイルストーン一覧 */}
      {xrlLog.length > 0 && (
        <div className="rounded-xl border border-border bg-white">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">マイルストーン年表</h2>
          </div>
          <div className="px-4 py-2">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-1.5 font-medium">観測日</th>
                  <th className="py-1.5 font-medium text-center">TRL</th>
                  <th className="py-1.5 font-medium text-center">BRL</th>
                  <th className="py-1.5 font-medium text-center">HRL</th>
                  <th className="py-1.5 font-medium">ボトルネック</th>
                  <th className="py-1.5 font-medium">内容</th>
                </tr>
              </thead>
              <tbody>
                {xrlLog.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-1.5 font-mono text-muted-foreground">{r.observed_at}</td>
                    <td className="py-1.5 text-center font-mono" style={{ color: XRL_COLORS.trl }}>{r.trl ?? "—"}</td>
                    <td className="py-1.5 text-center font-mono" style={{ color: XRL_COLORS.brl }}>{r.brl ?? "—"}</td>
                    <td className="py-1.5 text-center font-mono" style={{ color: XRL_COLORS.hrl }}>{r.hrl ?? "—"}</td>
                    <td className="py-1.5">
                      {r.bottleneck ? (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                          style={{
                            backgroundColor: (XRL_COLORS as Record<string, string>)[r.bottleneck.toLowerCase()] + "22",
                            color: (XRL_COLORS as Record<string, string>)[r.bottleneck.toLowerCase()] || "#888",
                          }}
                        >
                          {r.bottleneck}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-1.5 text-muted-foreground">{r.milestone_label ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {latestXrl && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                最終観測: {latestXrl.observed_at} /
                TRL {latestXrl.trl ?? "—"} · BRL {latestXrl.brl ?? "—"} · HRL {latestXrl.hrl ?? "—"}
                {latestXrl.bottleneck && (
                  <span> / ボトルネック: <strong>{latestXrl.bottleneck}</strong></span>
                )}
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
