"use client";

/**
 * CockpitManagementScoreHero — p00 (= AMD 会社全体) cockpit の Hero。
 *
 * SU 系 PJ で表示する CockpitVentureStatus (AMD Score 折れ線 + XRL 折れ線) の代わりに、
 * 会社全体スコープでは AMD Management Score の時系列折れ線 + 最新値カードを Above the fold に置く。
 * データソース: amd_management_score_snapshots
 *
 * 仕様 (#3 まさ確定 2026-05-23):
 * - 横軸 = ym (時間軸)、縦軸 = 0-100
 * - total_score を太線、5 軸 (initiative / finance / retention / pipeline / direction) を細線で重ねる
 * - 右側に最新月の各軸の数値カード
 * - 詳細は /management-score へのリンクで誘導
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// supabase-data.ts と同じ anon client パターン (= RLS は anon read を許可している前提)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const sb = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

interface Snapshot {
  ym: string;
  total_score: number | null;
  initiative_score: number | null;
  finance_score: number | null;
  retention_score: number | null;
  pipeline_score: number | null;
  direction_score: number | null;
}

type AxisKey =
  | "initiative_score"
  | "finance_score"
  | "retention_score"
  | "pipeline_score"
  | "direction_score";

const AXIS_META: Array<{ key: AxisKey; label: string; color: string }> = [
  { key: "initiative_score", label: "先手力", color: "#0284c7" },   // sky
  { key: "finance_score", label: "財務", color: "#059669" },        // emerald
  { key: "retention_score", label: "既存継続", color: "#d97706" },   // amber
  { key: "pipeline_score", label: "新規獲得", color: "#7c3aed" },    // violet
  { key: "direction_score", label: "戦略接近", color: "#dc2626" },   // rose
];

// SVG レイアウト
const SVG_W = 880;
const SVG_H = 320;
const ML = 36;
const MR = 24;
const MT = 24;
const MB = 28;
const PW = SVG_W - ML - MR;
const PH = SVG_H - MT - MB;

function ymToDate(ym: string): number {
  if (!ym || ym.length < 6) return 0;
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  return new Date(y, m - 1, 1).getTime();
}

function formatYmShort(ym: string): string {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(2, 4)}/${ym.slice(4, 6)}`;
}

function clamp01_100(n: number | null | undefined): number | null {
  if (n == null || isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function scoreTone(v: number | null): string {
  if (v == null) return "text-[#86868b]";
  if (v >= 70) return "text-emerald-600";
  if (v >= 50) return "text-amber-600";
  return "text-rose-600";
}

export function CockpitManagementScoreHero() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await sb
        .from("amd_management_score_snapshots")
        .select("ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score")
        .order("ym", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("CockpitManagementScoreHero load:", error.message);
        setSnapshots([]);
      } else {
        setSnapshots((data || []) as Snapshot[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const { xOf, yOf, paths, ticks, latest } = useMemo(() => {
    if (snapshots.length === 0) {
      return { xOf: () => 0, yOf: () => 0, paths: {} as Record<string, string>, ticks: [] as string[], latest: null as Snapshot | null };
    }
    const xs = snapshots.map((s) => ymToDate(s.ym));
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const xSpan = Math.max(1, xMax - xMin);
    const xOf = (t: number) => ML + ((t - xMin) / xSpan) * PW;
    const yOf = (v: number) => MT + (1 - v / 100) * PH;
    const buildPath = (key: AxisKey | "total_score"): string => {
      const pts: string[] = [];
      for (const s of snapshots) {
        const raw = key === "total_score" ? s.total_score : s[key];
        const v = clamp01_100(raw);
        if (v == null) continue;
        pts.push(`${xOf(ymToDate(s.ym))},${yOf(v)}`);
      }
      return pts.length > 0 ? `M ${pts.join(" L ")}` : "";
    };
    const paths: Record<string, string> = { total: buildPath("total_score") };
    for (const a of AXIS_META) paths[a.key] = buildPath(a.key);
    const latest = snapshots[snapshots.length - 1] || null;
    return { xOf, yOf, paths, ticks: snapshots.map((s) => s.ym), latest };
  }, [snapshots]);

  if (loading) {
    return (
      <section className="rounded-xl border border-[#e5e5e7] bg-white px-4 py-6 text-[12px] text-[#86868b]">
        AMD Management Score を読み込み中...
      </section>
    );
  }

  if (snapshots.length === 0) {
    return (
      <section className="rounded-xl border border-[#e5e5e7] bg-white px-4 py-6 text-[12px] text-[#86868b]">
        AMD Management Score の snapshot がまだありません。
        <Link href="/management-score" className="ml-2 text-[#007aff] hover:underline">/management-score</Link>
        で初回 snapshot を生成してください。
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#e5e5e7] bg-white">
      <div className="px-4 py-3 border-b border-[#e5e5e7] flex flex-wrap items-center gap-2">
        <h2 className="text-[14px] font-semibold">AMD Management Score</h2>
        <span className="text-[10px] text-muted-foreground">
          会社全体の経営状況スコア (先手力 / 財務耐久 / 既存PJ継続 / 新規獲得 / 戦略接近)
        </span>
        <div className="flex-1" />
        <Link
          href="/management-score"
          className="text-[11px] text-[#007aff] hover:underline"
        >
          詳細 →
        </Link>
      </div>

      <div className="flex flex-col xl:flex-row gap-2">
        {/* 左: time series 折れ線 (total + 5 軸) */}
        <div className="flex-1 min-w-0 px-2 pt-3">
          <div className="px-2 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-[12px] font-semibold">
              スコア推移
              <span className="ml-2 text-[9px] text-muted-foreground font-normal">linear scale 0-100</span>
            </h3>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1">
                <span style={{ color: "#0f172a" }} className="font-bold">━</span>
                <span>Total</span>
              </span>
              {AXIS_META.map((a) => (
                <span key={a.key} className="flex items-center gap-1">
                  <span style={{ color: a.color }}>—</span>
                  <span>{a.label}</span>
                </span>
              ))}
            </div>
          </div>
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full h-auto block"
            style={{ minWidth: 600 }}
          >
            {/* Y axis guides at 0, 25, 50, 75, 100 */}
            {[0, 25, 50, 75, 100].map((v) => (
              <g key={v}>
                <line
                  x1={ML}
                  y1={yOf(v)}
                  x2={ML + PW}
                  y2={yOf(v)}
                  stroke={v === 50 ? "#e2e8f0" : "#f1f5f9"}
                  strokeDasharray={v === 50 ? "0" : "3 2"}
                />
                <text x={ML - 6} y={yOf(v) + 3} fontSize={9} fill="#94a3b8" textAnchor="end">
                  {v}
                </text>
              </g>
            ))}
            {/* X axis ticks */}
            {ticks.map((ym) => (
              <g key={ym}>
                <line x1={xOf(ymToDate(ym))} y1={MT} x2={xOf(ymToDate(ym))} y2={MT + PH} stroke="#f8fafc" />
                <text x={xOf(ymToDate(ym))} y={MT + PH + 14} fontSize={9} fill="#94a3b8" textAnchor="middle">
                  {formatYmShort(ym)}
                </text>
              </g>
            ))}
            {/* 5 軸 線 (薄め) */}
            {AXIS_META.map((a) => (
              <g key={a.key}>
                {paths[a.key] && (
                  <path d={paths[a.key]} fill="none" stroke={a.color} strokeWidth={1.5} strokeOpacity={0.85} />
                )}
                {snapshots.map((s) => {
                  const v = clamp01_100(s[a.key]);
                  if (v == null) return null;
                  return (
                    <circle key={`${a.key}-${s.ym}`} cx={xOf(ymToDate(s.ym))} cy={yOf(v)} r={3} fill={a.color} fillOpacity={0.85} />
                  );
                })}
              </g>
            ))}
            {/* Total 線 (太く目立たせる) */}
            {paths.total && (
              <path d={paths.total} fill="none" stroke="#0f172a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            )}
            {snapshots.map((s) => {
              const v = clamp01_100(s.total_score);
              if (v == null) return null;
              return (
                <g key={`total-${s.ym}`}>
                  <circle cx={xOf(ymToDate(s.ym))} cy={yOf(v)} r={5} fill="#0f172a" stroke="#fff" strokeWidth={1.5} />
                  <title>{`${s.ym} Total ${Math.round(v)}`}</title>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 右: 最新月の各軸の数値カード */}
        <aside className="xl:w-[280px] px-3 py-3 border-t xl:border-t-0 xl:border-l border-[#e5e5e7]">
          <div className="text-[11px] text-[#86868b] mb-2">
            最新 ({latest ? formatYmShort(latest.ym) : "-"})
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className={`text-[36px] font-bold tabular-nums ${scoreTone(latest?.total_score ?? null)}`}>
              {latest?.total_score != null ? Math.round(latest.total_score) : "-"}
            </span>
            <span className="text-[12px] text-[#86868b]">/ 100 Total</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {AXIS_META.map((a) => {
              const v = latest ? clamp01_100(latest[a.key]) : null;
              return (
                <div key={a.key} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                  <span className="text-[11px] text-[#3c3c43] flex-1">{a.label}</span>
                  <span className={`text-[12px] font-semibold tabular-nums ${scoreTone(v)}`}>
                    {v != null ? Math.round(v) : "-"}
                  </span>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}
