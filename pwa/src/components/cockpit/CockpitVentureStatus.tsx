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

import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchVentureStatus,
  confirmXrlObservation,
  type VentureStatusBundle,
  type ProjectEventRow,
  type ProjectEventKind,
  type ProjectXrlRow,
} from "@/lib/venture-status-data";
import type { AmdScoreInputRow } from "@/lib/amd-score-data";
import { createClient } from "@/lib/supabase/client";
import { ALPHA_DEFAULT, type AlphaWeights } from "@/lib/amd-score";
import {
  buildPrimaryScoreSnapshot,
  computePrsScoreSeries,
  latestVisibleScorableScoreInput,
} from "@/lib/amd-score-derived";
// PHASE_COLOR / PHASE_LABEL_JP / AmdScorePhase / classifyPhase は使用しない (検証データ蓄積後に復活検討、2026-05-09)
import { CockpitVentureStatusEditModal } from "./CockpitVentureStatusEditModal";
import { CockpitVentureMetaEditModal } from "./CockpitVentureMetaEditModal";
import { CockpitNarrativeModal } from "./CockpitNarrativeModal";
import { CockpitMembersModal } from "./CockpitMembersModal";
// 2026-05-11 まさ指摘 1 番: 旧 CockpitFoundingMembersModal を CockpitMembersModal に統合済、import 削除
import { CockpitPartnersModal } from "./CockpitPartnersModal";
import { CockpitDescriptionDetailModal } from "./CockpitDescriptionDetailModal";
import { CockpitAmdScoreBreakdownModal } from "./CockpitAmdScoreBreakdownModal";
import { CockpitXrlDetailModal } from "./CockpitXrlDetailModal";
import { loadCurrentSpsAssessment } from "@/lib/current-sps-client";
import type { CurrentSpsProjectAssessment } from "@/lib/current-sps-model";

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
  zombie:     { emoji: "🧟", label: "ゾンビ化", color: "#a855f7" },
  smb:        { emoji: "🏪", label: "中小企業化", color: "#0d9488" },
  burnout:    { emoji: "🔥", label: "燃え尽き", color: "#ef4444" },
  ue_fail:    { emoji: "💀", label: "UE失敗", color: "#6b7280" },
};

const KIND_LABELS: Record<ProjectEventKind, { label: string; color: string }> = {
  hire: { label: "人事", color: "#0ea5e9" },
  funding: { label: "資金調達", color: "#16a34a" },
  deal: { label: "事業契約", color: "#f59e0b" },
  tech_progress: { label: "技術進捗", color: "#06b6d4" },
  governance: { label: "ガバナンス", color: "#8b5cf6" },
  note: { label: "メモ", color: "#94a3b8" },
  xrl_obs: { label: "XRL 観測", color: "#be185d" },
  amd_score_override: { label: "スコア手動", color: "#ef4444" },
};

const XRL_COLORS = {
  trl: "#0ea5e9",
  brl: "#f59e0b",
  grl: "#475569",
  srl: "#9333ea",
  hrl: "#16a34a",
} as const;
type XrlAxisKey = keyof typeof XRL_COLORS;
const XRL_AXES: XrlAxisKey[] = ["trl", "brl", "grl", "srl", "hrl"];

// 同一観測日で 5 軸が同じ値を取ると dot が完全に重なってクリック不能になる対策 (まさ 2026-05-12)。
// 軸ごとに x 方向 ±12px のオフセットを与えて 5 並びに散らす。path も同じ offset で描く。
const XRL_X_OFFSET: Record<XrlAxisKey, number> = {
  trl: -12,
  brl: -6,
  grl: 0,
  srl: 6,
  hrl: 12,
};

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
const SCORE_RANGE_FALLBACK_NOW = Date.UTC(2026, 5, 6);

function dateToYearDecimal(iso: string): number {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return 2020;
  return Number(m[1]) + (Number(m[2]) - 1) / 12;
}

function formatRoundedNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString();
}

// ============================================================
// Component
// ============================================================

type MetaFocus = "outcome" | "founded_at" | "origin_pi" | "origin_org" | "lane" | "description";

interface RoleMembers {
  pls: string[];
  pms: string[];
  closers: string[];
}

export function CockpitVentureStatus({
  projectId,
  projectName,
  onOpenScoreDetail,
  compact = false,
}: {
  projectId: string;
  projectName: string;
  onOpenScoreDetail: () => void;
  compact?: boolean;
}) {
  const [bundle, setBundle] = useState<VentureStatusBundle | null>(null);
  const [amdInputs, setAmdInputs] = useState<AmdScoreInputRow[]>([]);
  const [alpha, setAlpha] = useState<AlphaWeights>(ALPHA_DEFAULT);
  const [currentSps, setCurrentSps] = useState<CurrentSpsProjectAssessment | null>(null);
  const [roles, setRoles] = useState<RoleMembers>({ pls: [], pms: [], closers: [] });
  const [loading, setLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState<ProjectEventRow | null>(null);
  const [creatingAt, setCreatingAt] = useState<string | null>(null); // YYYY-MM-DD
  const [metaEditing, setMetaEditing] = useState<MetaFocus | null>(null);
  const [narrativeOpen, setNarrativeOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  // 2026-05-11 まさ指摘 1 番: foundingMembersOpen state を削除 (= CockpitMembersModal に統合)
  const [partnersOpen, setPartnersOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [scoreBreakdownOpen, setScoreBreakdownOpen] = useState(false);
  const [pendingXrl, setPendingXrl] = useState<ProjectXrlRow | null>(null);
  const [xrlDetailTarget, setXrlDetailTarget] = useState<{ row: ProjectXrlRow; axis: "TRL" | "BRL" | "GRL" | "SRL" | "HRL" } | null>(null);
  const xrlPlotRef = useRef<HTMLDivElement>(null);
  const [xrlPlotSize, setXrlPlotSize] = useState({ width: SVG_W, height: SVG_H });
  const legacyScoreHistoryOpen = false;

  useEffect(() => {
    const plot = xrlPlotRef.current;
    if (!plot || typeof ResizeObserver === "undefined") return;
    const updateSize = () => {
      const rect = plot.getBoundingClientRect();
      const width = Math.max(600, Math.round(rect.width));
      const height = Math.max(SVG_H, Math.round(rect.height));
      setXrlPlotSize((current) => current.width === width && current.height === height ? current : { width, height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(plot);
    return () => observer.disconnect();
  }, [loading, projectId]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    Promise.all([
      fetchVentureStatus(projectId),
      loadCurrentSpsAssessment(projectId),
      // PL/PM/クローザー の codeName を取得 (#15)
      (async () => {
        const { data: pm } = await supabase
          .from("project_members")
          .select("member_id, is_pm, is_closer, is_pl")
          .eq("project_id", projectId)
          .eq("is_active", true);
        const ids = (pm ?? []).map((r) => r.member_id);
        if (ids.length === 0) return { pls: [], pms: [], closers: [] } as RoleMembers;
        const { data: ms } = await supabase
          .from("members")
          .select("member_id, code_name")
          .in("member_id", ids);
        const nameMap = Object.fromEntries((ms ?? []).map((m) => [m.member_id, m.code_name || m.member_id]));
        const out: RoleMembers = { pls: [], pms: [], closers: [] };
        for (const r of pm ?? []) {
          const name = nameMap[r.member_id] || r.member_id;
          if (r.is_pl) out.pls.push(name);
          if (r.is_pm) out.pms.push(name);
          if (r.is_closer) out.closers.push(name);
        }
        return out;
      })(),
    ]).then(([b, assessment, roleData]) => {
      if (!cancelled) {
        setBundle(b);
        setAmdInputs([]);
        setAlpha(ALPHA_DEFAULT);
        setCurrentSps(assessment);
        setRoles(roleData);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const reload = async () => {
    const [b, assessment] = await Promise.all([
      fetchVentureStatus(projectId),
      loadCurrentSpsAssessment(projectId, { force: true }),
    ]);
    setBundle(b);
    setAmdInputs([]);
    setAlpha(ALPHA_DEFAULT);
    setCurrentSps(assessment);
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

  // SPS primary 時系列
  // まさ #20-2nd (2026-05-24):
  //  - chart 表示期間は元通り (過去 + 未来 計算可能な全範囲)
  //  - 折れ線は 「today <= 過去 = 実線」「today > 未来 = 破線」 に分割
  //  - 大きい数値 pill と P/R/S カードは「現在 = 過去の最新」値を表示
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  // 全期間 (過去 + 未来) — chart axis range / 未来予測の破線用
  const fullComputedSeries = useMemo(
    () => computePrsScoreSeries(amdInputs, alpha),
    [amdInputs, alpha]
  );
  // 過去のみ (= today 以下) — 実線 + 現在値 (pill) + P/R/S カード用
  const pastComputedSeries = useMemo(
    () => fullComputedSeries.filter((p) => p.evaluated_at.slice(0, 10) <= todayIso),
    [fullComputedSeries, todayIso]
  );
  // 全期間 series (= chart axis 用、リニア range も全期間で取る)
  const scoreSeries = useMemo(
    () => fullComputedSeries.map((p) => ({ date: p.evaluated_at, score: p.score })),
    [fullComputedSeries]
  );
  const pastSeries = useMemo(
    () => pastComputedSeries.map((p) => ({ date: p.evaluated_at, score: p.score })),
    [pastComputedSeries]
  );
  // 未来予測 series (= 破線用)。過去最終点を含めて連続させるため先頭に挿入。
  const futureSeries = useMemo(() => {
    const future = fullComputedSeries
      .filter((p) => p.evaluated_at.slice(0, 10) > todayIso)
      .map((p) => ({ date: p.evaluated_at, score: p.score }));
    const lastPast = pastSeries[pastSeries.length - 1];
    return lastPast ? [lastPast, ...future] : future;
  }, [fullComputedSeries, pastSeries, todayIso]);
  const latestPrimaryPoint = pastComputedSeries[pastComputedSeries.length - 1] ?? null;
  const latestComponents = latestPrimaryPoint?.prs.components ?? null;
  // cockpit のスコア詳細と同じ軸思想: X は score series の評価日、Y は実データ範囲にフィット。
  const scoreRange = useMemo(() => {
    const now = SCORE_RANGE_FALLBACK_NOW;
    if (!scoreSeries.length) return { xMin: now - 30 * 86400000, xMax: now + 30 * 86400000 };
    const xs = scoreSeries.map((p) => new Date(p.date).getTime());
    const xMin = Math.min(...xs);
    const xMaxRaw = Math.max(...xs);
    const xSpan = Math.max(1, xMaxRaw - xMin);
    return { xMin, xMax: xMaxRaw + xSpan * 0.05 };
  }, [scoreSeries]);
  // まさ判断 (2026-05-22 #5): AMD スコア折れ線はリニア軸に統一する。
  const scoreValues = scoreSeries.map((p) => Math.max(0, p.score));
  const scoreRawMin = scoreValues.length ? Math.min(...scoreValues) : 0;
  const scoreRawMax = scoreValues.length ? Math.max(...scoreValues) : 100;
  const scorePad = Math.max(1, (scoreRawMax - scoreRawMin) * 0.08);
  const scoreYMin = Math.max(0, scoreRawMin - scorePad);
  const scoreYMax = scoreRawMax + scorePad;
  const scoreYSpan = Math.max(1, scoreYMax - scoreYMin);
  const yOfScore = (s: number) => {
    const ratio = Math.max(0, Math.min(1, (s - scoreYMin) / scoreYSpan));
    return MT + PH - ratio * PH;
  };
  const xOfScore = (t: number) => ML + ((t - scoreRange.xMin) / Math.max(1, scoreRange.xMax - scoreRange.xMin)) * PW;
  const xOfScoreDate = (iso: string) => xOfScore(new Date(iso).getTime());
  // まさ #20-2nd: 過去 = 実線, 未来 = 破線 で 2 path に分割
  const buildPath = (pts: Array<{ date: string; score: number }>) =>
    pts.length < 2 ? "" : "M " + pts.map((p) => `${xOfScoreDate(p.date).toFixed(1)},${yOfScore(p.score).toFixed(1)}`).join(" L ");
  const pastScorePath = buildPath(pastSeries);
  const futureScorePath = buildPath(futureSeries);
  // リニア軸用のガイドライン: 範囲を 5 等分する位の素直な値で。
  const scoreGuides = (() => {
    const niceSteps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
    const target = scoreYSpan / 4;
    const step = niceSteps.find((s) => s >= target) ?? niceSteps[niceSteps.length - 1];
    const guides: number[] = [];
    const start = Math.ceil(scoreYMin / step) * step;
    for (let g = start; g <= scoreYMax; g += step) {
      if (guides.length >= 8) break;
      guides.push(g);
    }
    return guides;
  })();
  const scoreDateTicks = scoreSeries.map((p) => p.date);

  // 現在のスコア (= 過去最新点 = today までで一番新しい input)
  const latestScore = latestPrimaryPoint?.score ?? null;
  const latestInput = latestVisibleScorableScoreInput(amdInputs);
  const primarySnapshot = latestInput
    ? buildPrimaryScoreSnapshot(latestInput, alpha, { P: null, R_net: null }, amdInputs)
    : null;

  // XRL は右ペインの実寸を座標系にする。固定比率SVGを拡大せず、円と線の形を保ったまま縦高を使い切る。
  const xrlWidth = xrlPlotSize.width;
  const xrlHeight = xrlPlotSize.height;
  const xrlPlotWidth = Math.max(1, xrlWidth - ML - MR);
  const xrlPlotHeight = Math.max(1, xrlHeight - MT - MB);
  const xOfXrl = (yd: number) => ML + ((yd - range.xMin) / (range.xMax - range.xMin)) * xrlPlotWidth;
  const xOfXrlDate = (iso: string) => xOfXrl(dateToYearDecimal(iso));
  const yOfXrl = (v: number) => MT + ((9 - Math.max(1, Math.min(9, v))) / 8) * xrlPlotHeight;
  const buildXrlPath = (k: XrlAxisKey) => {
    const pts = (bundle?.xrlLog ?? [])
      .filter((r) => r[k] != null)
      .map((r) => ({ y: dateToYearDecimal(r.observed_at), v: r[k] as number }));
    if (pts.length < 2) return "";
    const dx = XRL_X_OFFSET[k];
    return "M " + pts.map((p) => `${(xOfXrl(p.y) + dx).toFixed(1)},${yOfXrl(p.v).toFixed(1)}`).join(" L ");
  };
  const xrlPaths: Record<XrlAxisKey, string> = {
    trl: buildXrlPath("trl"),
    brl: buildXrlPath("brl"),
    grl: buildXrlPath("grl"),
    srl: buildXrlPath("srl"),
    hrl: buildXrlPath("hrl"),
  };

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
    const t = scoreRange.xMin + ((x - ML) / PW) * (scoreRange.xMax - scoreRange.xMin);
    setCreatingAt(new Date(t).toISOString().slice(0, 10));
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
    <section className="rounded-xl border border-[#e5e5e7] bg-white" data-density={compact ? "compact-score-hero" : undefined}>
      {/* Header (各要素クリックで編集) */}
      <div className={`border-b border-[#e5e5e7] flex flex-wrap items-center gap-2 ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
        <button
          onClick={() => setMetaEditing("outcome")}
          className="text-lg hover:opacity-70"
          title="アウトカムを編集"
        >
          {outcome?.emoji}
        </button>
        <button
          type="button"
          className="text-[15px] font-bold"
        >
          {projectName}
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
          title="沿革を見る"
        >
          📜 沿革
        </button>
        <button
          onClick={() => setMembersOpen(true)}
          className="text-[11px] px-2 py-0.5 rounded-full border border-[#e5e5e7] hover:bg-[#fafafa]"
          title="AMD 内部メンバー (project_members の share)"
        >
          👥 メンバー
        </button>
        {/* 2026-05-11 まさ指摘 1 番: 旧「関連メンバー」別ボタンを削除。
            LLM 抽出された関連メンバーは「👥 メンバー」モーダル内に統合表示 */}
        <button
          onClick={() => setPartnersOpen(true)}
          className="text-[11px] px-2 py-0.5 rounded-full border border-[#e5e5e7] hover:bg-[#fafafa]"
          title="興味事業会社 (協業先 / 顧客候補)"
        >
          🤝 事業会社
        </button>
        {/* 2026-05-11 まさ指摘 3 番: 小さく書いてた「AMD: xxx ▾」タブを削除。
            代わりに「Chart 1: AMD スコア」グラフ内の現在地点プロットの上に大きいフォントで表示する。
            グラフ未評価の PJ には未評価リンクをそのままここに残す。 */}
        {currentSps?.status !== "assessed" && (
          <button
            type="button"
            onClick={onOpenScoreDetail}
            className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-dashed border-slate-300 text-muted-foreground hover:bg-slate-50"
            title="現行SPSの凍結評価が未登録"
          >
            最新版未評価 →
          </button>
        )}
      </div>

      {/* PL / PM / クローザー / AMD 契約期間 / SU 設立年月日 (#15) */}
      {(roles.pls.length > 0 || roles.pms.length > 0 || roles.closers.length > 0 || venture.amd_support_started_at || venture.founded_at) && (
        <div className={`${compact ? "px-3 pt-0.5" : "px-4 pt-1"} flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground`}>
          {roles.pls.length > 0 && (
            <span><b className="text-blue-700">PL</b> {roles.pls.join(", ")}</span>
          )}
          {roles.pms.length > 0 && (
            <span><b className="text-emerald-700">PM</b> {roles.pms.join(", ")}</span>
          )}
          {roles.closers.length > 0 && (
            <span><b className="text-orange-700">クローザー</b> {roles.closers.join(", ")}</span>
          )}
          {venture.founded_at && (
            <span><b>SU 設立</b> {venture.founded_at.slice(0, 7)}</span>
          )}
          {venture.amd_support_started_at && (
            <span>
              <b>AMD 参画</b> {venture.amd_support_started_at.slice(0, 7)}
              〜{venture.amd_support_ended_at?.slice(0, 7) || "参画中"}
            </span>
          )}
        </div>
      )}

      <button
        onClick={() => setDescOpen(true)}
        className={`block w-full text-left text-[12px] text-slate-700 hover:underline decoration-dotted ${compact ? "px-3 pt-1" : "px-4 pt-3"}`}
        title="事業詳細を表示・編集 (つくよみがマージ)"
      >
        {venture.short_description || <span className="text-muted-foreground">事業概要を入力…</span>}
        {venture.long_description && (
          <span className="ml-1 text-[10px] text-muted-foreground">[詳細あり]</span>
        )}
      </button>

      {/* 現行SPS｜産業創出価値のカードは 2026-08-28 まさ依頼で「スコア詳細」タブの最上段へ移した
          (`CockpitAmdScoreDetailTab`)。ここでは未評価バッジの判定にだけ使う。 */}

      {/* BZM 2.2 の J/P/Q/S は 2026-08-28 まさ指摘でこの上段から外した。
          2026-08-27「古いモデルの試算結果は、混乱の元になるのですべて削除してほしい」で
          スコア詳細タブから外したのと同じもので、上段にだけ残っていた。
          コンポーネントと `?view=summary` の単体画面は残すが、コックピットからは出さない。
          上段に残すのはXRL進捗だけ。 */}
      <div data-testid="cockpit-xrl-overview" className={`mx-2 overflow-hidden border border-[#7898a5] bg-white ${compact ? "mt-1" : "mt-2"}`}>
      <div className={`h-full min-h-0 min-w-0 ${legacyScoreHistoryOpen ? "flex flex-col gap-2 xl:flex-row" : "flex"}`}>
      {legacyScoreHistoryOpen ? (
      <>
      {/* Chart 1: SPS history */}
      <div className="flex-1 min-w-0 overflow-x-auto px-2 pt-3">
        <div className="px-2 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-[12px] font-semibold">
            SPS履歴（旧モデル）
            <span className="ml-2 text-[9px] text-muted-foreground font-normal">linear scale / dynamic range</span>
          </h3>
          <div className="flex items-center gap-2 text-[10px]">
            {primarySnapshot && (
              <span className={`rounded-full px-2 py-0.5 font-semibold ${
                primarySnapshot.prs.status === "ready"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}>
                {primarySnapshot.prs.status === "ready" && primarySnapshot.prs.score != null
                  ? `SPS ${formatRoundedNumber(primarySnapshot.prs.score)}`
                  : `SPS missing: ${primarySnapshot.prs.missingAxes.join(" / ")}`}
              </span>
            )}
            {primarySnapshot?.legacy.score != null && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                legacy AMD {formatRoundedNumber(primarySnapshot.legacy.score)}
              </span>
            )}
            <button
              type="button"
              onClick={onOpenScoreDetail}
              className="text-cyan-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2"
            >
              スコア詳細 →
            </button>
            <span className="text-muted-foreground">
              · グラフをタップでイベント追加 / ドットタップで編集
            </span>
          </div>
        </div>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="block h-auto w-full min-w-[600px] cursor-crosshair xl:min-w-0"
          onClick={onScoreChartClick}
        >
          {/* AMD 参画期間の背景帯 (started_at - ended_at もしくは present) */}
          {venture.amd_support_started_at && (() => {
            const x1 = xOfScoreDate(venture.amd_support_started_at);
            const endIso = venture.amd_support_ended_at ?? new Date().toISOString().slice(0, 10);
            const x2 = xOfScoreDate(endIso);
            const left = Math.max(ML, Math.min(x1, x2));
            const right = Math.min(ML + PW, Math.max(x1, x2));
            if (right <= left) return null;
            return (
              <g>
                <rect
                  x={left}
                  y={MT}
                  width={right - left}
                  height={PH}
                  fill="#ec4899"
                  fillOpacity={0.07}
                />
                <line x1={x1} y1={MT} x2={x1} y2={MT + PH} stroke="#ec4899" strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
                {venture.amd_support_ended_at && (
                  <line x1={x2} y1={MT} x2={x2} y2={MT + PH} stroke="#ec4899" strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
                )}
                <text x={(left + right) / 2} y={MT + 10} fontSize={9} fill="#be185d" textAnchor="middle" opacity={0.85}>
                  AMD 参画期間
                </text>
              </g>
            );
          })()}
          {/* Y axis: score detail と同じく実データ範囲内の guide のみ表示 */}
          {scoreGuides.map((v) => (
            <g key={v}>
              <line
                x1={ML}
                y1={yOfScore(v)}
                x2={ML + PW}
                y2={yOfScore(v)}
                stroke="#f1f5f9"
                strokeDasharray="3 2"
              />
              <text x={ML - 6} y={yOfScore(v) + 3} fontSize={9} fill="#94a3b8" textAnchor="end">{formatRoundedNumber(v)}</text>
            </g>
          ))}
          {/* X axis */}
          {scoreDateTicks.map((date) => (
            <g key={date}>
              <line x1={xOfScoreDate(date)} y1={MT} x2={xOfScoreDate(date)} y2={MT + PH} stroke="#f8fafc" />
              <text x={xOfScoreDate(date)} y={MT + PH + 12} fontSize={9} fill="#94a3b8" textAnchor="middle">
                {date.slice(0, 7)}
              </text>
            </g>
          ))}
          {/* 設立日 marker */}
          {venture.founded_at && (
            <g>
              <line
                x1={xOfScoreDate(venture.founded_at)}
                y1={MT}
                x2={xOfScoreDate(venture.founded_at)}
                y2={MT + PH}
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                opacity={0.7}
              />
              <text x={xOfScoreDate(venture.founded_at) + 4} y={MT + 12} fontSize={9} fill="#b45309">
                設立 {venture.founded_at.slice(0, 7)}
              </text>
            </g>
          )}
          {/* スコア折れ線 */}
          {/* 過去 (今日まで) = 実線、未来 (今日以降) = 破線 (まさ #20-2nd 2026-05-24) */}
          {pastScorePath && (
            <path d={pastScorePath} fill="none" stroke="#0f766e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          )}
          {futureScorePath && (
            <path d={futureScorePath} fill="none" stroke="#0f766e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 4" opacity={0.75} />
          )}
          {/* events ドット (annotation) — score 曲線上の最近点に置く */}
          {(bundle?.events ?? []).map((ev) => {
            // event 時点以前の score 系列の最終点
            const before = scoreSeries.filter((p) => p.date <= ev.occurred_on);
            const after = scoreSeries.filter((p) => p.date > ev.occurred_on);
            const refScore = before[before.length - 1]?.score ?? after[0]?.score ?? 1;
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
                <circle cx={xOfScore(new Date(ev.occurred_on).getTime())} cy={yOfScore(refScore)} r={14} fill={color} stroke="#fff" strokeWidth={2} />
                <title>{`${KIND_LABELS[ev.kind]?.label ?? ev.kind} / ${ev.occurred_on} / ${ev.label}`}</title>
              </g>
            );
          })}
          {/* 未来予測 (= 破線) の各点に予測値を小さく添える (まさ #30 2026-05-24)。
              futureSeries[0] は pastSeries の最終点が重複しているのでスキップ。 */}
          {futureSeries.slice(1).map((p, i) => {
            const x = xOfScoreDate(p.date);
            const y = yOfScore(p.score);
            const text = formatRoundedNumber(p.score);
            return (
              <g key={`future-label-${p.date}-${i}`}>
                <text
                  x={x}
                  y={y - 8}
                  fontSize={10}
                  fontFamily="ui-monospace,SFMono-Regular,monospace"
                  fill="#475569"
                  textAnchor="middle"
                  opacity={0.85}
                >
                  {text}
                </text>
              </g>
            );
          })}
          {/* 未来予測のクリック hit area。破線 path だけだと狭すぎるので、各未来点に透明 circle を重ねる。 */}
          {futureSeries.slice(1).map((p, i) => {
            const x = xOfScoreDate(p.date);
            const y = yOfScore(p.score);
            return (
              <g
                key={`future-hit-${p.date}-${i}`}
                style={{ cursor: "crosshair" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setCreatingAt(p.date.slice(0, 10));
                }}
              >
                <circle
                  data-future-score-hit="true"
                  data-future-score-date={p.date.slice(0, 10)}
                  cx={x}
                  cy={y}
                  r={20}
                  fill="#fff"
                  fillOpacity={0.001}
                  pointerEvents="all"
                />
                <circle cx={x} cy={y} r={3.5} fill="#0f766e" opacity={0.45} pointerEvents="none" />
                <title>{`未来予測 ${p.date.slice(0, 10)} / クリックでイベント追加`}</title>
              </g>
            );
          })}
          {/* 現在スコア pill (まさ #30 2026-05-24): 現在プロット (= 過去最終点) の近くに移動。
              旧実装は SVG 右上固定 + 赤破線の引き出し線で、引き出し線が未来予測破線と並走して
              「破線 2 本問題」が出ていた (= 引き出し線は #20-3rd で削除済)。今回 pill そのものを
              プロット隣接位置に移動し、引き出し線が要らない構造に。 */}
          {(() => {
            const last = pastSeries[pastSeries.length - 1];
            if (!last) return null;
            const label = formatRoundedNumber(last.score);
            // pill サイズ縮小 (現状 170x52 → 110x36)。プロット隣接なので大きすぎると未来予測線を隠す。
            const pillW = 110;
            const pillH = 36;
            const lx = xOfScoreDate(last.date);
            const ly = yOfScore(last.score);
            // 配置: プロット上方向 (= 未来予測線と被らないように上に置く)。右端越えしないよう clamp。
            const desiredX = lx - pillW / 2;
            const pillX = Math.max(ML, Math.min(SVG_W - MR - pillW, desiredX));
            const desiredY = ly - pillH - 10;
            const pillY = Math.max(MT + 2, Math.min(SVG_H - MB - pillH, desiredY));
            const labelCenterX = pillX + pillW / 2;
            const labelY = pillY + pillH - 11; // baseline 調整
            return (
              <g
                style={{ cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); setScoreBreakdownOpen(true); }}
              >
                <title>クリックで SPS / legacy 比較を開く</title>
                {/* 背景 pill */}
                <rect
                  x={pillX}
                  y={pillY}
                  rx={10}
                  ry={10}
                  width={pillW}
                  height={pillH}
                  fill="rgba(236,253,245,0.95)"
                  stroke="#059669"
                  strokeWidth={1.5}
                />
                {/* 数値: pill 中央寄せ */}
                <text
                  x={labelCenterX}
                  y={labelY}
                  fontSize={22}
                  fontWeight={800}
                  fontFamily="ui-monospace,SFMono-Regular,monospace"
                  fill="#047857"
                  textAnchor="middle"
                >
                  {label}
                </text>
                <text
                  x={pillX + pillW - 6}
                  y={labelY - 14}
                  fontSize={9}
                  fill="#047857"
                  textAnchor="end"
                >
                  ▾
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* 旧SPS M/P/R/S 値カード — 履歴編集の補助表示。
            現在 (今日以前) の SPS (M·P·R·S) primary components:
              M = macrotrend (マクロ追い風、σ_SU。2026-07-16 S から分離)
              P = potential input
              R = readiness reach
              S = survival (自走力 = FRL × R_net)
            xl breakpoint 以上は縦 stack、xl 未満は横並びで Chart 間 row として配置。 */}
      <aside className="xl:w-[140px] xl:py-3 xl:px-2 flex xl:flex-col flex-row flex-wrap gap-2 justify-around xl:justify-start border-t xl:border-t-0 xl:border-l xl:border-r border-[#e5e5e7] px-2 py-2">
        {latestComponents && primarySnapshot ? (
          <>
            <PrsCard axis="M" label="MACROTREND" value={latestComponents.macro} color="#0e7490" />
            <PrsCard axis="P" label="POTENTIAL" value={primarySnapshot.prs.axisValues.P} color="#0f766e" />
            <PrsCard axis="R" label="REACH" value={latestComponents.reach} color="#0369a1" />
            <PrsCard axis="S" label="SURVIVAL 自走力" value={latestComponents.survival} color="#7c3aed" />
          </>
        ) : (
          <span className="text-[10px] text-[#86868b]">SPS primary 入力待ち</span>
        )}
      </aside>
      </>
      ) : null}

      {/* Chart 2: XRL */}
      <div data-testid="cockpit-xrl-panel" className={`flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-auto px-2 pb-1 pt-1.5 ${legacyScoreHistoryOpen ? "border-t border-[#7898a5] xl:border-l xl:border-t-0" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-1">
          <h3 className="text-[12px] font-semibold">XRL 進捗 (TRL / BRL / GRL / SRL / HRL)</h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px]">
            {XRL_AXES.map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span style={{ color: XRL_COLORS[k] }}>—</span>
                <span className="uppercase font-mono">{k}</span>
              </span>
            ))}
          </div>
        </div>

        {pendingXrl && (
          <div className="mx-1 mt-1.5 border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px]">
            <div className="font-semibold text-blue-900">
              自動提案:
              {XRL_AXES.map((k) => (
                <span key={k} className="ml-2">
                  {k.toUpperCase()} {pendingXrl[k] ?? "—"}
                </span>
              ))}
              {pendingXrl.bottleneck && <span className="ml-2 text-blue-700">ボトルネック: {pendingXrl.bottleneck}</span>}
            </div>
            {pendingXrl.milestone_label && (
              <div className="text-[11px] text-slate-700 mt-0.5">「{pendingXrl.milestone_label}」</div>
            )}
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => onConfirmProposal(pendingXrl.id, "confirm")}
                className="min-h-11 bg-blue-600 px-3 text-[11px] text-white hover:bg-blue-700"
              >
                ✓ 採用
              </button>
              <button
                onClick={() => onConfirmProposal(pendingXrl.id, "reject")}
                className="min-h-11 border border-blue-200 px-3 text-[11px] text-blue-700 hover:bg-blue-100"
              >
                ✕ 却下
              </button>
            </div>
          </div>
        )}
        <div ref={xrlPlotRef} data-testid="cockpit-xrl-plot" className="min-h-[220px] flex-1 min-w-[600px] xl:min-w-0">
        <svg
          viewBox={`0 0 ${xrlWidth} ${xrlHeight}`}
          width={xrlWidth}
          height={xrlHeight}
          className="block h-full w-full"
        >
          {[1, 3, 5, 7, 9].map((lv) => (
            <g key={lv}>
              <line x1={ML} y1={yOfXrl(lv)} x2={ML + xrlPlotWidth} y2={yOfXrl(lv)} stroke="#f1f5f9" />
              <text x={ML - 6} y={yOfXrl(lv) + 3} fontSize={9} fill="#94a3b8" textAnchor="end">
                {lv}
              </text>
            </g>
          ))}
          {yearTicks.map((yr) => (
            <g key={yr}>
              <line x1={xOfXrl(yr)} y1={MT} x2={xOfXrl(yr)} y2={MT + xrlPlotHeight} stroke="#f8fafc" />
              <text x={xOfXrl(yr)} y={MT + xrlPlotHeight + 12} fontSize={9} fill="#94a3b8" textAnchor="middle">
                {yr}
              </text>
            </g>
          ))}
          {venture.founded_at && (
            <line
              x1={xOfXrlDate(venture.founded_at)}
              y1={MT}
              x2={xOfXrlDate(venture.founded_at)}
              y2={MT + xrlPlotHeight}
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              opacity={0.6}
            />
          )}
          {XRL_AXES.map((k) => (
            xrlPaths[k] && <path key={`p-${k}`} d={xrlPaths[k]} fill="none" stroke={XRL_COLORS[k]} strokeWidth={2} />
          ))}
          {(bundle?.xrlLog ?? []).map((r) => {
            const isProposal = r.source === "llm_proposal";
            const opacity = isProposal ? 0.55 : 1;
            const strokeDasharray = isProposal ? "3 3" : undefined;
            const baseR = isProposal ? 13 : 10;
            const onClickAxis = (axis: "TRL" | "BRL" | "GRL" | "SRL" | "HRL") => () => {
              if (isProposal) {
                setPendingXrl(r);
              } else {
                setXrlDetailTarget({ row: r, axis });
              }
            };
            return (
              <g key={r.id}>
                {XRL_AXES.map((k) => {
                  const v = r[k];
                  if (v == null) return null;
                  const upper = k.toUpperCase() as "TRL" | "BRL" | "GRL" | "SRL" | "HRL";
                  const cx = xOfXrlDate(r.observed_at) + XRL_X_OFFSET[k];
                  const cy = yOfXrl(v);
                  // 2026-05-12 まさ指示: 同位置 dot 重なり対策。
                  //   (a) 軸別 x offset で 5 並びに散らす
                  //   (b) 透明 hit area (r + 6) で clickable 範囲を拡大、見た目はそのまま
                  return (
                    <g key={`${r.id}-${k}`} style={{ cursor: "pointer" }} onClick={onClickAxis(upper)}>
                      <title>{`${upper} ${v} (${r.observed_at})${isProposal ? " — 自動提案" : " — クリックで詳細"}`}</title>
                      {/* 透明 hit area */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={baseR + 6}
                        fill="transparent"
                        pointerEvents="all"
                      />
                      {/* 見た目 dot */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={baseR}
                        fill={XRL_COLORS[k]}
                        stroke={isProposal ? XRL_COLORS[k] : "#fff"}
                        strokeWidth={isProposal ? 1.8 : 2}
                        strokeDasharray={strokeDasharray}
                        fillOpacity={opacity}
                        pointerEvents="none"
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
        </div>
      </div>
      </div>
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
          projectName={projectName}
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
          displayName={projectName}
          onClose={() => setNarrativeOpen(false)}
        />
      )}

      {membersOpen && (
        <CockpitMembersModal projectId={projectId} onClose={() => setMembersOpen(false)} />
      )}

      {partnersOpen && (
        <CockpitPartnersModal projectId={projectId} onClose={() => setPartnersOpen(false)} />
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

      {scoreBreakdownOpen && (
        <CockpitAmdScoreBreakdownModal
          latestInput={latestInput}
          alpha={alpha}
          onClose={() => setScoreBreakdownOpen(false)}
          onOpenScoreDetail={onOpenScoreDetail}
        />
      )}

      {xrlDetailTarget && (
        <CockpitXrlDetailModal
          projectId={projectId}
          row={xrlDetailTarget.row}
          axis={xrlDetailTarget.axis}
          onClose={() => setXrlDetailTarget(null)}
          onUpdated={async () => {
            setXrlDetailTarget(null);
            await reload();
          }}
        />
      )}
    </section>
  );
}

/**
 * PrsCard — SPS primary の M / P / R / S 値カード。
 * Chart 1 (SPS) と Chart 2 (XRL 折れ線) の間に縦 stack (xl 以上) で並ぶ。
 */
function PrsCard({ axis, label, value, color }: { axis: string; label: string; value: number | null; color: string }) {
  const display = formatRoundedNumber(value);
  return (
    <div className="flex flex-col gap-1 px-2.5 py-1.5 rounded-md bg-[#fafafa] border border-[#e5e5e7] min-w-[88px]">
      <div className="flex items-baseline gap-1">
        <span className="text-[16px] font-bold leading-none" style={{ color }}>{axis}</span>
        <span className="text-[8px] text-[#86868b] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-[18px] font-bold tabular-nums leading-none" style={{ color }}>{display}</div>
      <div className="text-[8px] font-mono uppercase tracking-wider text-[#86868b]">SPS component</div>
    </div>
  );
}
