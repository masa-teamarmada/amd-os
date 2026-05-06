"use client";

/**
 * Cockpit 上部に表示する PJ Status セクション。
 *
 * - 表示: AMD スコア (折れ線、ダミー計算) と XRL (TRL/BRL/HRL 折れ線)
 * - 編集: AMD スコアグラフ上の events ドット tap → 編集 / 空白 tap → 新規追加
 * - データソース: `project_ventures` / `project_xrl_log` / `project_events`
 *
 * `project_ventures` に該当行がない PJ では何も表示しない (= SU 系でない PJ)。
 *
 * 単位ルール: SU は「PJ」と数える。「ventures」「社」表記は禁止。
 */

import { useEffect, useMemo, useState } from "react";
import {
  fetchVentureStatus,
  computeAmdScoreSeries,
  type VentureStatusBundle,
  type ProjectEventRow,
  type ProjectEventKind,
} from "@/lib/venture-status-data";
import { CockpitVentureStatusEditModal } from "./CockpitVentureStatusEditModal";

const LANE_LABELS: Record<string, string> = {
  gx_energy: "GX / エネルギー",
  gx_circular: "GX / サーキュラー",
  materials: "素材 / ナノマテリアル",
  life: "ライフ / 医療",
  robo: "ロボ / 農・モビリティ",
};

const LANE_COLORS: Record<string, string> = {
  gx_energy: "#16a34a",
  gx_circular: "#0891b2",
  materials: "#a16207",
  life: "#be185d",
  robo: "#7c3aed",
};

const OUTCOME_LABELS: Record<string, { emoji: string; label: string; color: string }> = {
  rocket: { emoji: "🚀", label: "離陸中", color: "#0ea5e9" },
  lifted: { emoji: "✈️", label: "離陸完了", color: "#16a34a" },
  deep_pivot: { emoji: "🔄", label: "後付けdeep化", color: "#8b5cf6" },
  burnout: { emoji: "🔥", label: "燃え尽き", color: "#ef4444" },
  ue_fail: { emoji: "💀", label: "UE失敗", color: "#6b7280" },
};

const KIND_LABELS: Record<ProjectEventKind, { label: string; color: string }> = {
  hire: { label: "採用", color: "#0ea5e9" },
  funding: { label: "資金調達", color: "#16a34a" },
  deal: { label: "事業契約", color: "#f59e0b" },
  governance: { label: "ガバナンス", color: "#8b5cf6" },
  note: { label: "メモ", color: "#94a3b8" },
  xrl_obs: { label: "XRL 観測", color: "#be185d" },
  amd_score_override: { label: "スコア手動", color: "#ef4444" },
};

const XRL_COLORS = { trl: "#0ea5e9", brl: "#f59e0b", hrl: "#16a34a" };

// ============================================================
// SVG geometry
// ============================================================
const SVG_W = 880;
const SVG_H = 220;
const ML = 48;
const MR = 24;
const MT = 24;
const MB = 32;
const PW = SVG_W - ML - MR;
const PH = SVG_H - MT - MB;

function dateToYearDecimal(iso: string): number {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return 2020;
  return Number(m[1]) + (Number(m[2]) - 1) / 12;
}

function yearDecimalToYm(yd: number): string {
  const y = Math.floor(yd);
  const m = Math.max(1, Math.min(12, Math.round((yd - y) * 12) + 1));
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

// ============================================================
// Component
// ============================================================

export function CockpitVentureStatus({ projectId }: { projectId: string }) {
  const [bundle, setBundle] = useState<VentureStatusBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState<ProjectEventRow | null>(null);
  const [creatingAt, setCreatingAt] = useState<string | null>(null); // YYYY-MM-DD

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchVentureStatus(projectId).then((b) => {
      if (!cancelled) {
        setBundle(b);
        setLoading(false);
      }
    });
    return () => {
      cancelled = false;
    };
  }, [projectId]);

  const reload = async () => {
    const b = await fetchVentureStatus(projectId);
    setBundle(b);
  };

  const venture = bundle?.venture;

  // 軸範囲 (founded ± 7 年を基本)
  const range = useMemo(() => {
    if (!venture) return { xMin: 2020, xMax: 2028 };
    const founded = venture.founded_at ? dateToYearDecimal(venture.founded_at) : new Date().getFullYear();
    const xrlYears = (bundle?.xrlLog ?? []).map((r) => dateToYearDecimal(r.observed_at));
    const eventYears = (bundle?.events ?? []).map((e) => dateToYearDecimal(e.occurred_on));
    const all = [founded, ...xrlYears, ...eventYears];
    const dataMin = all.length ? Math.min(...all) : founded;
    const dataMax = all.length ? Math.max(...all) : founded;
    const xMin = Math.floor(Math.min(founded - 5, dataMin - 0.5));
    const xMax = Math.ceil(Math.max(founded + 3, dataMax + 0.5, new Date().getFullYear() + 0.5));
    return { xMin, xMax };
  }, [venture, bundle]);

  const xOf = (yd: number) => ML + ((yd - range.xMin) / (range.xMax - range.xMin)) * PW;
  const xOfDate = (iso: string) => xOf(dateToYearDecimal(iso));
  const xToYearDecimal = (svgX: number) => range.xMin + ((svgX - ML) / PW) * (range.xMax - range.xMin);

  // AMD スコア時系列
  const scoreSeries = useMemo(() => (bundle ? computeAmdScoreSeries(bundle) : []), [bundle]);
  const yOfScore = (s: number) => MT + PH - ((s + 100) / 200) * PH;
  const scorePath = scoreSeries.length < 2
    ? ""
    : "M " + scoreSeries.map((p) => `${xOfDate(p.date).toFixed(1)},${yOfScore(p.score).toFixed(1)}`).join(" L ");

  // 現在のスコア (最新点)
  const latestScore = scoreSeries[scoreSeries.length - 1]?.score;

  // XRL 軸
  const yOfXrl = (v: number) => MT + PH - (v / 9) * PH;
  const buildXrlPath = (k: "trl" | "brl" | "hrl") => {
    const pts = (bundle?.xrlLog ?? [])
      .filter((r) => r[k] != null)
      .map((r) => ({ y: dateToYearDecimal(r.observed_at), v: r[k] as number }));
    if (pts.length < 2) return "";
    return "M " + pts.map((p) => `${xOf(p.y).toFixed(1)},${yOfXrl(p.v).toFixed(1)}`).join(" L ");
  };
  const trlPath = buildXrlPath("trl");
  const brlPath = buildXrlPath("brl");
  const hrlPath = buildXrlPath("hrl");

  // SVG 座標変換 (clientX → SVG)
  const svgCoord = (e: React.MouseEvent<SVGSVGElement, MouseEvent>): { x: number; y: number } => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = SVG_W / rect.width;
    const scaleY = SVG_H / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const onScoreChartClick = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!venture) return;
    if (editingEvent || creatingAt) return; // モーダル開いてる間は無効
    const { x } = svgCoord(e);
    if (x < ML || x > ML + PW) return;
    const yd = xToYearDecimal(x);
    setCreatingAt(yearDecimalToYm(yd));
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-[#e5e5e7] bg-white px-4 py-3 text-[12px] text-muted-foreground">
        Status 読み込み中…
      </div>
    );
  }

  if (!venture) return null; // SU 系でない PJ → 何も出さない

  const lane = LANE_LABELS[venture.lane] ?? venture.lane;
  const laneColor = LANE_COLORS[venture.lane] ?? "#888";
  const outcome = OUTCOME_LABELS[venture.outcome_pattern];
  const yearTicks = Array.from({ length: range.xMax - range.xMin + 1 }, (_, i) => range.xMin + i);

  return (
    <section className="rounded-xl border border-[#e5e5e7] bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#e5e5e7] flex flex-wrap items-center gap-2">
        <span className="text-lg">{outcome?.emoji}</span>
        <h2 className="text-[15px] font-bold">{venture.display_name}</h2>
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border"
          style={{ color: laneColor, borderColor: laneColor }}
        >
          {lane}
        </span>
        {outcome && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: outcome.color + "22", color: outcome.color }}
          >
            {outcome.label}
          </span>
        )}
        {venture.founded_at && (
          <span className="text-[11px] text-muted-foreground">設立 {venture.founded_at.slice(0, 7)}</span>
        )}
        {venture.origin_org && (
          <span className="text-[11px] text-muted-foreground">/ {venture.origin_org}</span>
        )}
        {venture.origin_pi && (
          <span className="text-[11px] text-muted-foreground">/ {venture.origin_pi}</span>
        )}
        <div className="flex-1" />
        {latestScore != null && (
          <span
            className="text-[11px] font-mono px-2 py-0.5 rounded-full border"
            style={{
              borderColor: latestScore >= 0 ? "#16a34a" : "#ef4444",
              color: latestScore >= 0 ? "#16a34a" : "#ef4444",
            }}
            title="AMD スコア (ダミー、Before Zero Theory v3.x で正本確定予定)"
          >
            AMD score: {latestScore.toFixed(0)}
          </span>
        )}
      </div>

      {venture.short_description && (
        <p className="px-4 pt-3 text-[12px] text-slate-700">{venture.short_description}</p>
      )}

      {/* Chart 1: AMD スコア */}
      <div className="px-2 pt-3">
        <div className="px-2 flex items-center justify-between">
          <h3 className="text-[12px] font-semibold">AMD スコア</h3>
          <span className="text-[10px] text-muted-foreground">
            グラフをタップでイベント追加 / ドットタップで編集 (※ ダミーロジック)
          </span>
        </div>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-auto block cursor-crosshair"
          style={{ minWidth: 600 }}
          onClick={onScoreChartClick}
        >
          {/* Y axis: -100 / 0 / 100 */}
          {[-100, -50, 0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={ML} y1={yOfScore(v)} x2={ML + PW} y2={yOfScore(v)} stroke={v === 0 ? "#cbd5e1" : "#f1f5f9"} />
              <text x={ML - 6} y={yOfScore(v) + 3} fontSize={9} fill="#94a3b8" textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          {/* X axis */}
          {yearTicks.map((yr) => (
            <g key={yr}>
              <line x1={xOf(yr)} y1={MT} x2={xOf(yr)} y2={MT + PH} stroke="#f8fafc" />
              <text x={xOf(yr)} y={MT + PH + 12} fontSize={9} fill="#94a3b8" textAnchor="middle">
                {yr}
              </text>
            </g>
          ))}
          {/* 設立日 marker */}
          {venture.founded_at && (
            <g>
              <line
                x1={xOfDate(venture.founded_at)}
                y1={MT}
                x2={xOfDate(venture.founded_at)}
                y2={MT + PH}
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                opacity={0.7}
              />
              <text x={xOfDate(venture.founded_at) + 4} y={MT + 12} fontSize={9} fill="#b45309">
                設立 {venture.founded_at.slice(0, 7)}
              </text>
            </g>
          )}
          {/* スコア折れ線 */}
          {scorePath && (
            <path d={scorePath} fill="none" stroke="#0f172a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          )}
          {/* events ドット */}
          {(bundle?.events ?? []).map((ev) => {
            const yd = dateToYearDecimal(ev.occurred_on);
            const found = scoreSeries.find((p) => p.date === ev.occurred_on);
            const score = found?.score ?? 0;
            const color = KIND_LABELS[ev.kind]?.color ?? "#0f172a";
            return (
              <g
                key={ev.id}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingEvent(ev);
                }}
              >
                <circle cx={xOf(yd)} cy={yOfScore(score)} r={6} fill={color} stroke="#fff" strokeWidth={1.5} />
                <title>{`${KIND_LABELS[ev.kind]?.label ?? ev.kind} / ${ev.occurred_on} / ${ev.label}`}</title>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Chart 2: XRL */}
      <div className="px-2 pt-2 pb-3">
        <div className="px-2 flex items-center justify-between">
          <h3 className="text-[12px] font-semibold">XRL 進捗 (TRL / BRL / HRL)</h3>
          <div className="flex items-center gap-3 text-[10px]">
            {(["trl", "brl", "hrl"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span style={{ color: XRL_COLORS[k] }}>—</span>
                <span className="uppercase font-mono">{k}</span>
              </span>
            ))}
          </div>
        </div>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto block" style={{ minWidth: 600 }}>
          {[1, 3, 5, 7, 9].map((lv) => (
            <g key={lv}>
              <line x1={ML} y1={yOfXrl(lv)} x2={ML + PW} y2={yOfXrl(lv)} stroke="#f1f5f9" />
              <text x={ML - 6} y={yOfXrl(lv) + 3} fontSize={9} fill="#94a3b8" textAnchor="end">
                {lv}
              </text>
            </g>
          ))}
          {yearTicks.map((yr) => (
            <g key={yr}>
              <line x1={xOf(yr)} y1={MT} x2={xOf(yr)} y2={MT + PH} stroke="#f8fafc" />
              <text x={xOf(yr)} y={MT + PH + 12} fontSize={9} fill="#94a3b8" textAnchor="middle">
                {yr}
              </text>
            </g>
          ))}
          {venture.founded_at && (
            <line
              x1={xOfDate(venture.founded_at)}
              y1={MT}
              x2={xOfDate(venture.founded_at)}
              y2={MT + PH}
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              opacity={0.6}
            />
          )}
          {trlPath && <path d={trlPath} fill="none" stroke={XRL_COLORS.trl} strokeWidth={2} />}
          {brlPath && <path d={brlPath} fill="none" stroke={XRL_COLORS.brl} strokeWidth={2} />}
          {hrlPath && <path d={hrlPath} fill="none" stroke={XRL_COLORS.hrl} strokeWidth={2} />}
          {(bundle?.xrlLog ?? []).map((r) => (
            <g key={r.id}>
              {r.trl != null && (
                <circle cx={xOfDate(r.observed_at)} cy={yOfXrl(r.trl)} r={4} fill={XRL_COLORS.trl} stroke="#fff" />
              )}
              {r.brl != null && (
                <circle cx={xOfDate(r.observed_at)} cy={yOfXrl(r.brl)} r={4} fill={XRL_COLORS.brl} stroke="#fff" />
              )}
              {r.hrl != null && (
                <circle cx={xOfDate(r.observed_at)} cy={yOfXrl(r.hrl)} r={4} fill={XRL_COLORS.hrl} stroke="#fff" />
              )}
            </g>
          ))}
        </svg>
      </div>

      {(editingEvent || creatingAt) && (
        <CockpitVentureStatusEditModal
          projectId={projectId}
          editing={editingEvent}
          initialDate={creatingAt}
          onClose={() => {
            setEditingEvent(null);
            setCreatingAt(null);
          }}
          onSaved={async () => {
            setEditingEvent(null);
            setCreatingAt(null);
            await reload();
          }}
        />
      )}
    </section>
  );
}
