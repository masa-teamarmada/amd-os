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
  confirmXrlObservation,
  type VentureStatusBundle,
  type ProjectEventRow,
  type ProjectEventKind,
  type ProjectXrlRow,
} from "@/lib/venture-status-data";
import { CockpitVentureStatusEditModal } from "./CockpitVentureStatusEditModal";
import { CockpitVentureMetaEditModal } from "./CockpitVentureMetaEditModal";
import { CockpitNarrativeModal } from "./CockpitNarrativeModal";
import { CockpitMembersModal } from "./CockpitMembersModal";
import { CockpitPartnersModal } from "./CockpitPartnersModal";
import { CockpitPlMonthlyModal } from "./CockpitPlMonthlyModal";
import { CockpitDescriptionDetailModal } from "./CockpitDescriptionDetailModal";
import { CockpitAmdScoreBreakdownModal } from "./CockpitAmdScoreBreakdownModal";

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
  // 設立前 (Before 0)
  tbd:        { emoji: "🌱", label: "未確定 (Before 0)", color: "#6366f1" },
  planning:   { emoji: "🛠",  label: "計画中 (Before 0)", color: "#0891b2" },
  stalled:    { emoji: "⏸",  label: "停滞 (Before 0)",   color: "#94a3b8" },
  // 設立後 (After 0)
  rocket:     { emoji: "🚀", label: "離陸中", color: "#0ea5e9" },
  lifted:     { emoji: "✈️", label: "離陸完了", color: "#16a34a" },
  deep_pivot: { emoji: "🔄", label: "後付けdeep化", color: "#8b5cf6" },
  burnout:    { emoji: "🔥", label: "燃え尽き", color: "#ef4444" },
  ue_fail:    { emoji: "💀", label: "UE失敗", color: "#6b7280" },
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

type MetaFocus = "outcome" | "founded_at" | "origin_pi" | "origin_org" | "lane" | "name" | "description";

export function CockpitVentureStatus({ projectId }: { projectId: string }) {
  const [bundle, setBundle] = useState<VentureStatusBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState<ProjectEventRow | null>(null);
  const [creatingAt, setCreatingAt] = useState<string | null>(null); // YYYY-MM-DD
  const [metaEditing, setMetaEditing] = useState<MetaFocus | null>(null);
  const [narrativeOpen, setNarrativeOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [partnersOpen, setPartnersOpen] = useState(false);
  const [plOpen, setPlOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [scoreBreakdownOpen, setScoreBreakdownOpen] = useState(false);
  const [pendingXrl, setPendingXrl] = useState<ProjectXrlRow | null>(null);

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

  const onConfirmProposal = async (id: string, action: "confirm" | "reject") => {
    const ok = await confirmXrlObservation(id, action);
    if (ok) {
      setPendingXrl(null);
      await reload();
    }
  };

  const venture = bundle?.venture;

  // 軸範囲: 観測されたデータの実 min/max にフィット
  // (founded_at / xrl observations / events / today を全部集めて min-max + 余白 0.5 年)
  const range = useMemo(() => {
    const today = new Date().getFullYear() + (new Date().getMonth() + 0.5) / 12;
    const ys: number[] = [];
    if (venture?.founded_at) ys.push(dateToYearDecimal(venture.founded_at));
    for (const r of bundle?.xrlLog ?? []) ys.push(dateToYearDecimal(r.observed_at));
    for (const e of bundle?.events ?? []) ys.push(dateToYearDecimal(e.occurred_on));
    ys.push(today);
    if (ys.length === 0) return { xMin: today - 1, xMax: today + 1 };
    const dataMin = Math.min(...ys);
    const dataMax = Math.max(...ys);
    const span = Math.max(0.8, dataMax - dataMin);
    const pad = Math.max(0.3, span * 0.06);
    return { xMin: dataMin - pad, xMax: dataMax + pad };
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
  // 整数年の tick (xMin/xMax は実数なので floor/ceil で囲む)
  const tickYearStart = Math.ceil(range.xMin);
  const tickYearEnd = Math.floor(range.xMax);
  const yearTicks = Array.from({ length: Math.max(0, tickYearEnd - tickYearStart + 1) }, (_, i) => tickYearStart + i);

  return (
    <section className="rounded-xl border border-[#e5e5e7] bg-white">
      {/* Header (各要素クリックで編集) */}
      <div className="px-4 py-3 border-b border-[#e5e5e7] flex flex-wrap items-center gap-2">
        <button
          onClick={() => setMetaEditing("outcome")}
          className="text-lg hover:opacity-70"
          title="アウトカムを編集"
        >
          {outcome?.emoji}
        </button>
        <button
          onClick={() => setMetaEditing("name")}
          className="text-[15px] font-bold hover:underline decoration-dotted"
          title="PJ 名を編集"
        >
          {venture.display_name}
        </button>
        <button
          onClick={() => setMetaEditing("lane")}
          className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border hover:bg-[#fafafa]"
          style={{ color: laneColor, borderColor: laneColor }}
          title="レーンを編集"
        >
          {lane}
        </button>
        {outcome && (
          <button
            onClick={() => setMetaEditing("outcome")}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-full hover:opacity-80"
            style={{ backgroundColor: outcome.color + "22", color: outcome.color }}
            title="アウトカムを編集"
          >
            {outcome.label}
          </button>
        )}
        <button
          onClick={() => setMetaEditing("founded_at")}
          className="text-[11px] text-muted-foreground hover:text-foreground hover:underline decoration-dotted"
          title="設立日を編集"
        >
          {venture.founded_at ? `設立 ${venture.founded_at.slice(0, 7)}` : "設立日未設定"}
        </button>
        <button
          onClick={() => setMetaEditing("origin_org")}
          className="text-[11px] text-muted-foreground hover:text-foreground hover:underline decoration-dotted"
          title="起源機関を編集"
        >
          / {venture.origin_org || "起源機関未設定"}
        </button>
        <button
          onClick={() => setMetaEditing("origin_pi")}
          className="text-[11px] text-muted-foreground hover:text-foreground hover:underline decoration-dotted"
          title="代表者 / PI を編集"
        >
          / {venture.origin_pi || "代表者未設定"}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setNarrativeOpen(true)}
          className="text-[11px] px-2 py-0.5 rounded-full border border-[#e5e5e7] hover:bg-[#fafafa]"
          title="毎朝 03:00 cron で生成した沿革を見る"
        >
          📜 沿革
        </button>
        <button
          onClick={() => setMembersOpen(true)}
          className="text-[11px] px-2 py-0.5 rounded-full border border-[#e5e5e7] hover:bg-[#fafafa]"
          title="関連メンバー (HRL 評価のベース)"
        >
          👥 メンバー
        </button>
        <button
          onClick={() => setPartnersOpen(true)}
          className="text-[11px] px-2 py-0.5 rounded-full border border-[#e5e5e7] hover:bg-[#fafafa]"
          title="興味事業会社 (協業先 / 顧客候補)"
        >
          🤝 事業会社
        </button>
        <button
          onClick={() => setPlOpen(true)}
          className="text-[11px] px-2 py-0.5 rounded-full border border-[#e5e5e7] hover:bg-[#fafafa]"
          title="月次試算表"
        >
          📊 試算表
        </button>
        {latestScore != null && (
          <button
            onClick={() => setScoreBreakdownOpen(true)}
            className="text-[11px] font-mono px-2 py-0.5 rounded-full border hover:bg-[#fafafa]"
            style={{
              borderColor: latestScore >= 0 ? "#16a34a" : "#ef4444",
              color: latestScore >= 0 ? "#16a34a" : "#ef4444",
            }}
            title="クリックで計算式と内訳を表示"
          >
            AMD score: {latestScore.toFixed(0)} ▾
          </button>
        )}
      </div>

      <button
        onClick={() => setDescOpen(true)}
        className="block w-full text-left px-4 pt-3 text-[12px] text-slate-700 hover:underline decoration-dotted"
        title="事業詳細を表示・編集 (つくよみがマージ)"
      >
        {venture.short_description || <span className="text-muted-foreground">事業概要を入力…</span>}
        {venture.long_description && (
          <span className="ml-1 text-[10px] text-muted-foreground">[詳細あり]</span>
        )}
      </button>

      {/* Chart 1: AMD スコア */}
      <div className="px-2 pt-3">
        <div className="px-2 flex items-center justify-between">
          <h3 className="text-[12px] font-semibold">AMD スコア</h3>
          <span className="text-[10px] text-muted-foreground">
            グラフをタップでイベント追加 / ドットタップで編集 (※ AMD スコア計算式は Before Zero Theory v3.x 確定待ち、現状ダミー)
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
        <div className="px-2 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-[12px] font-semibold">XRL 進捗 (TRL / BRL / HRL)</h3>
          <div className="flex items-center gap-3 text-[10px]">
            {(["trl", "brl", "hrl"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span style={{ color: XRL_COLORS[k] }}>—</span>
                <span className="uppercase font-mono">{k}</span>
              </span>
            ))}
            <span className="text-[10px] text-muted-foreground">
              毎朝 03:15 (JST) に差分があれば LLM が自動判定 → 提案ドットを採用 / 却下できる
            </span>
          </div>
        </div>

        {pendingXrl && (
          <div className="mx-2 mt-2 px-3 py-2 rounded-md border border-blue-200 bg-blue-50 text-[12px]">
            <div className="font-semibold text-blue-900">
              LLM 提案: TRL {pendingXrl.trl ?? "—"} / BRL {pendingXrl.brl ?? "—"} / HRL {pendingXrl.hrl ?? "—"}
              {pendingXrl.bottleneck && <span className="ml-2 text-blue-700">ボトルネック: {pendingXrl.bottleneck}</span>}
            </div>
            {pendingXrl.milestone_label && (
              <div className="text-[11px] text-slate-700 mt-0.5">「{pendingXrl.milestone_label}」</div>
            )}
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => onConfirmProposal(pendingXrl.id, "confirm")}
                className="text-[11px] px-2 py-0.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                ✓ 採用
              </button>
              <button
                onClick={() => onConfirmProposal(pendingXrl.id, "reject")}
                className="text-[11px] px-2 py-0.5 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                ✕ 却下
              </button>
            </div>
          </div>
        )}
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
          {(bundle?.xrlLog ?? []).map((r) => {
            const isProposal = r.source === "llm_proposal";
            const onClickDot = isProposal
              ? () => setPendingXrl(r)
              : undefined;
            const cursor = isProposal ? "pointer" : "default";
            const opacity = isProposal ? 0.55 : 1;
            const strokeDasharray = isProposal ? "2 2" : undefined;
            return (
              <g key={r.id} style={{ cursor }} onClick={onClickDot}>
                {r.trl != null && (
                  <circle
                    cx={xOfDate(r.observed_at)}
                    cy={yOfXrl(r.trl)}
                    r={isProposal ? 5 : 4}
                    fill={XRL_COLORS.trl}
                    stroke={isProposal ? XRL_COLORS.trl : "#fff"}
                    strokeWidth={isProposal ? 1.4 : 1}
                    strokeDasharray={strokeDasharray}
                    fillOpacity={opacity}
                  />
                )}
                {r.brl != null && (
                  <circle
                    cx={xOfDate(r.observed_at)}
                    cy={yOfXrl(r.brl)}
                    r={isProposal ? 5 : 4}
                    fill={XRL_COLORS.brl}
                    stroke={isProposal ? XRL_COLORS.brl : "#fff"}
                    strokeWidth={isProposal ? 1.4 : 1}
                    strokeDasharray={strokeDasharray}
                    fillOpacity={opacity}
                  />
                )}
                {r.hrl != null && (
                  <circle
                    cx={xOfDate(r.observed_at)}
                    cy={yOfXrl(r.hrl)}
                    r={isProposal ? 5 : 4}
                    fill={XRL_COLORS.hrl}
                    stroke={isProposal ? XRL_COLORS.hrl : "#fff"}
                    strokeWidth={isProposal ? 1.4 : 1}
                    strokeDasharray={strokeDasharray}
                    fillOpacity={opacity}
                  />
                )}
                <title>
                  {`${r.observed_at} / TRL ${r.trl ?? "—"} BRL ${r.brl ?? "—"} HRL ${r.hrl ?? "—"}${
                    r.bottleneck ? ` / bottleneck ${r.bottleneck}` : ""
                  }${isProposal ? " (LLM 提案 ・ 採用 / 却下を判断)" : ""}`}
                </title>
              </g>
            );
          })}
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

      {metaEditing && venture && (
        <CockpitVentureMetaEditModal
          venture={venture}
          focus={metaEditing}
          onClose={() => setMetaEditing(null)}
          onSaved={async () => {
            setMetaEditing(null);
            await reload();
          }}
        />
      )}

      {narrativeOpen && venture && (
        <CockpitNarrativeModal
          projectId={projectId}
          displayName={venture.display_name}
          onClose={() => setNarrativeOpen(false)}
        />
      )}

      {membersOpen && (
        <CockpitMembersModal projectId={projectId} onClose={() => setMembersOpen(false)} />
      )}

      {partnersOpen && (
        <CockpitPartnersModal projectId={projectId} onClose={() => setPartnersOpen(false)} />
      )}

      {plOpen && (
        <CockpitPlMonthlyModal projectId={projectId} onClose={() => setPlOpen(false)} />
      )}

      {descOpen && venture && (
        <CockpitDescriptionDetailModal
          projectId={projectId}
          shortDescription={venture.short_description}
          longDescription={venture.long_description}
          onClose={() => setDescOpen(false)}
          onSaved={async () => {
            await reload();
          }}
        />
      )}

      {scoreBreakdownOpen && bundle && (
        <CockpitAmdScoreBreakdownModal
          bundle={bundle}
          onClose={() => setScoreBreakdownOpen(false)}
        />
      )}
    </section>
  );
}
