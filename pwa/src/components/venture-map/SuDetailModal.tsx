"use client";

import { useEffect, useState } from "react";
import { HudFrame } from "./HudFrame";
import type { VentureRow, XrlLogRow } from "@/lib/venture-map-data";

const RL_KEYS = ["trl", "brl", "hrl", "grl", "srl"] as const;
type RlKey = (typeof RL_KEYS)[number];

const RL_COLORS: Record<RlKey, string> = {
  trl: "#22d3ee",
  brl: "#fb923c",
  hrl: "#34d399",
  grl: "#a78bfa",
  srl: "#f472b6",
};

interface Props {
  venture: VentureRow;
  xrl: XrlLogRow[];
  onClose: () => void;
}

const PAD = { top: 32, right: 28, bottom: 36, left: 44 };

export function SuDetailModal({ venture, xrl, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // viewBox のサイズ (chart 描画域)
  const W = 760;
  const H = 380;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // 時間範囲
  const points = xrl.filter((r) => r.observed_at);
  const ts = points.map((r) => +new Date(r.observed_at));
  const tMin = ts.length ? Math.min(...ts) : Date.now();
  const tMax = ts.length ? Math.max(...ts) : Date.now() + 3.15e10;
  const tSpan = tMax - tMin || 1;

  const xOf = (iso: string) =>
    PAD.left + ((+new Date(iso) - tMin) / tSpan) * innerW;
  // 累積を 0..1 で正規化、Z は上が 0 になる SVG 座標系
  const yOf = (norm: number) => PAD.top + (1 - norm) * innerH;

  // 各観測点の累積を計算
  const cumNorm = points.map((r) => {
    const vals = RL_KEYS.map((k) => Math.min(5, Math.max(0, r[k] || 0)));
    const cums: number[] = [];
    let cum = 0;
    for (const v of vals) {
      cum += v;
      cums.push(cum / 25);
    }
    return cums;
  });

  // 5 レイヤーの path を作る
  const layerPaths = RL_KEYS.map((key, layerIdx) => {
    if (points.length < 2) return { key, d: "" };
    const upper = points.map((r, k) => `${xOf(r.observed_at)},${yOf(cumNorm[k][layerIdx])}`);
    const lower = points.map((r, k) => {
      const lowerNorm = layerIdx === 0 ? 0 : cumNorm[k][layerIdx - 1];
      return `${xOf(r.observed_at)},${yOf(lowerNorm)}`;
    }).reverse();
    const d = `M ${upper.join(" L ")} L ${lower.join(" L ")} Z`;
    return { key, d };
  });

  // milestone events
  const events = points.filter((r) => r.milestone_label);

  // x 軸目盛り (年単位)
  const yearMin = new Date(tMin).getFullYear();
  const yearMax = new Date(tMax).getFullYear();
  const yearTicks: number[] = [];
  for (let y = yearMin; y <= yearMax; y++) yearTicks.push(y);

  return (
    <>
      {/* CSS keyframes */}
      <style>{`
        @keyframes scanLine {
          0%   { transform: translateY(-110%); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(110%); opacity: 0; }
        }
        @keyframes hudPulse {
          0%, 100% { opacity: 0.85; }
          50%      { opacity: 0.3; }
        }
        @keyframes glitchIn {
          0%   { opacity: 0; transform: translate(2px, -1px); filter: blur(2px); }
          25%  { opacity: 1; transform: translate(-1px, 2px); filter: blur(0); }
          50%  { transform: translate(1px, 0); }
          75%  { transform: translate(-1px, 0); }
          100% { transform: translate(0, 0); }
        }
        @keyframes ventureModalFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          animation: "ventureModalFade 0.18s ease-out",
        }}
      />

      {/* modal container */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 101,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            width: "min(880px, 92vw)",
            maxHeight: "88vh",
            position: "relative",
            transform: mounted ? "scale(1)" : "scale(0.92)",
            opacity: mounted ? 1 : 0,
            clipPath: mounted
              ? "polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)"
              : "polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%, 50% 50%, 50% 50%)",
            transition:
              "transform 0.32s cubic-bezier(0.16,1,0.3,1), opacity 0.28s ease-out, clip-path 0.4s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <HudFrame variant="modal" padding={0}>
            {/* scan line */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                pointerEvents: "none",
                zIndex: 2,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  height: 28,
                  background:
                    "linear-gradient(180deg, transparent 0%, rgba(34,211,238,0.22) 50%, transparent 100%)",
                  borderTop: "1px solid rgba(34,211,238,0.6)",
                  borderBottom: "1px solid rgba(34,211,238,0.4)",
                  animation: "scanLine 1.4s cubic-bezier(0.5,0,0.5,1) 1",
                }}
              />
            </div>

            {/* header */}
            <div
              style={{
                padding: "14px 22px 10px",
                borderBottom: "1px solid rgba(10,14,21,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                animation: "glitchIn 0.4s ease-out",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    letterSpacing: "0.18em",
                    color: "#64748b",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  ▶▶▶ SU DETAIL // X-Z PROFILE
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontWeight: 800,
                    color: "#0a0e15",
                    letterSpacing: "0.04em",
                  }}
                >
                  {venture.display_name}
                  <span
                    style={{
                      marginLeft: 10,
                      fontSize: 11,
                      color: "#64748b",
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}
                  >
                    [{venture.short_label || venture.id}]
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    color: "#475569",
                    marginTop: 2,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  LANE {venture.lane} · STATUS {venture.status} · OUTCOME {venture.outcome_pattern}
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 34,
                  height: 34,
                  border: "1px solid #0a0e15",
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#0a0e15",
                  clipPath:
                    "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* body: SVG X-Z chart */}
            <div
              style={{
                padding: "18px 22px 22px",
                animation: "glitchIn 0.5s ease-out 0.05s backwards",
              }}
            >
              <svg
                viewBox={`0 0 ${W} ${H}`}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  background:
                    "linear-gradient(180deg, rgba(236,254,255,0.4) 0%, rgba(245,243,255,0.4) 100%)",
                }}
              >
                {/* glow filter */}
                <defs>
                  <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* grid lines */}
                <g stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2,3">
                  {[0, 0.25, 0.5, 0.75, 1].map((n) => (
                    <line
                      key={n}
                      x1={PAD.left}
                      y1={yOf(n)}
                      x2={W - PAD.right}
                      y2={yOf(n)}
                    />
                  ))}
                </g>

                {/* y axis ticks */}
                <g
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontSize="9"
                  fill="#64748b"
                  textAnchor="end"
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((n) => (
                    <text key={n} x={PAD.left - 6} y={yOf(n) + 3}>
                      {n.toFixed(2)}
                    </text>
                  ))}
                </g>

                {/* x axis ticks (years) */}
                <g
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontSize="9"
                  fill="#64748b"
                  textAnchor="middle"
                >
                  {yearTicks.map((y) => {
                    const iso = `${y}-01-01`;
                    const x = xOf(iso);
                    if (x < PAD.left - 5 || x > W - PAD.right + 5) return null;
                    return (
                      <g key={y}>
                        <line
                          x1={x}
                          y1={H - PAD.bottom}
                          x2={x}
                          y2={H - PAD.bottom + 4}
                          stroke="#94a3b8"
                          strokeWidth="0.6"
                        />
                        <text x={x} y={H - PAD.bottom + 16}>
                          {y}
                        </text>
                      </g>
                    );
                  })}
                </g>

                {/* axis labels */}
                <text
                  x={W - PAD.right}
                  y={H - 8}
                  textAnchor="end"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontSize="9"
                  fontWeight="700"
                  fill="#0a0e15"
                  letterSpacing="0.1em"
                >
                  [ T ▸ ]
                </text>
                <text
                  x={6}
                  y={PAD.top - 10}
                  textAnchor="start"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontSize="9"
                  fontWeight="700"
                  fill="#0a0e15"
                  letterSpacing="0.1em"
                >
                  [ SCORE ▴ ]
                </text>

                {/* stacked area layers (with glow) */}
                <g filter="url(#neonGlow)">
                  {layerPaths.map((p) =>
                    p.d ? (
                      <path
                        key={p.key}
                        d={p.d}
                        fill={RL_COLORS[p.key]}
                        opacity={0.55}
                      />
                    ) : null,
                  )}
                </g>

                {/* top edge line for sharpness */}
                {points.length >= 2 && (
                  <polyline
                    points={points
                      .map(
                        (r, k) =>
                          `${xOf(r.observed_at)},${yOf(cumNorm[k][4])}`,
                      )
                      .join(" ")}
                    fill="none"
                    stroke="#0a0e15"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                )}

                {/* milestones */}
                <g>
                  {events.map((r, idx) => {
                    const x = xOf(r.observed_at);
                    const idxInPoints = points.findIndex((p) => p.id === r.id);
                    const norm = idxInPoints >= 0 ? cumNorm[idxInPoints][4] : 0;
                    const y = yOf(norm);
                    return (
                      <g key={r.id}>
                        <circle
                          cx={x}
                          cy={y}
                          r={5}
                          fill="#fbbf24"
                          stroke="#92400e"
                          strokeWidth="1"
                        />
                        <line
                          x1={x}
                          y1={y - 6}
                          x2={x}
                          y2={PAD.top + idx * 12}
                          stroke="#92400e"
                          strokeWidth="0.5"
                          strokeDasharray="2,2"
                        />
                        <text
                          x={x + 4}
                          y={PAD.top + idx * 12 + 4}
                          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                          fontSize="9"
                          fill="#92400e"
                          fontWeight="600"
                        >
                          ◆ {r.milestone_label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* layer legend */}
              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 10,
                  color: "#0a0e15",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 700,
                }}
              >
                {RL_KEYS.map((k) => {
                  const last = points[points.length - 1];
                  const v = last ? last[k] || 0 : 0;
                  return (
                    <span
                      key={k}
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 14,
                          height: 10,
                          background: RL_COLORS[k],
                          opacity: 0.7,
                          border: `1px solid ${RL_COLORS[k]}`,
                          boxShadow: `0 0 8px ${RL_COLORS[k]}88`,
                        }}
                      />
                      {k.toUpperCase()}
                      <span style={{ color: "#64748b" }}>
                        : {v}/5
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          </HudFrame>
        </div>
      </div>
    </>
  );
}
