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

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  fetchVentureStatus,
  computeCockpitAmdScoreSeries,
  confirmXrlObservation,
  type VentureStatusBundle,
  type ProjectVentureRow,
  type ProjectEventRow,
  type ProjectEventKind,
  type ProjectXrlRow,
} from "@/lib/venture-status-data";
import { fetchAmdScoreInputs, fetchActiveAlpha, type AmdScoreInputRow } from "@/lib/amd-score-data";
import {
  buildAaaScoreInputsFromSx,
  buildPrimaryScoreSnapshot,
  latestVisibleScorableScoreInput,
} from "@/lib/amd-score-derived";
import { AAA_PROJECT_ID, aaaVenture } from "@/lib/demo-aaa-data";
import { amdScoreDetailHref } from "@/lib/amd-score-routes";
import { createClient } from "@/lib/supabase/client";
import { ALPHA_DEFAULT, type AlphaWeights } from "@/lib/amd-score";
// PHASE_COLOR / PHASE_LABEL_JP / AmdScorePhase / classifyPhase は使用しない (検証データ蓄積後に復活検討、2026-05-09)
import { CockpitVentureStatusEditModal } from "../cockpit/CockpitVentureStatusEditModal";
import { CockpitVentureMetaEditModal } from "../cockpit/CockpitVentureMetaEditModal";
import { CockpitNarrativeModal } from "../cockpit/CockpitNarrativeModal";
import { CockpitMembersModal } from "../cockpit/CockpitMembersModal";
// 2026-05-11 まさ指摘 1 番: 旧 CockpitFoundingMembersModal を CockpitMembersModal に統合済、import 削除
import { CockpitPartnersModal } from "../cockpit/CockpitPartnersModal";
import { CockpitPlMonthlyModal } from "../cockpit/CockpitPlMonthlyModal";
import { CockpitDescriptionDetailModal } from "../cockpit/CockpitDescriptionDetailModal";
import { CockpitAmdScoreBreakdownModal } from "../cockpit/CockpitAmdScoreBreakdownModal";
import { CockpitXrlDetailModal } from "../cockpit/CockpitXrlDetailModal";

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
const SCORE_RANGE_FALLBACK_NOW = Date.UTC(2026, 4, 19);

function dateToYearDecimal(iso: string): number {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return 2020;
  return Number(m[1]) + (Number(m[2]) - 1) / 12;
}

// ============================================================
// Component
// ============================================================

type MetaFocus = "outcome" | "founded_at" | "origin_pi" | "origin_org" | "lane" | "name" | "description";

interface RoleMembers {
  pls: string[];
  pms: string[];
  closers: string[];
}

export function HudCockpitVentureStatus({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [bundle, setBundle] = useState<VentureStatusBundle | null>(null);
  const [amdInputs, setAmdInputs] = useState<AmdScoreInputRow[]>([]);
  const [alpha, setAlpha] = useState<AlphaWeights>(ALPHA_DEFAULT);
  const [roles, setRoles] = useState<RoleMembers>({ pls: [], pms: [], closers: [] });
  const [loading, setLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState<ProjectEventRow | null>(null);
  const [creatingAt, setCreatingAt] = useState<string | null>(null); // YYYY-MM-DD
  const [metaEditing, setMetaEditing] = useState<MetaFocus | null>(null);
  const [narrativeOpen, setNarrativeOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  // 2026-05-11 まさ指摘 1 番: foundingMembersOpen state を削除 (= CockpitMembersModal に統合)
  const [partnersOpen, setPartnersOpen] = useState(false);
  const [plOpen, setPlOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [scoreBreakdownOpen, setScoreBreakdownOpen] = useState(false);
  const [pendingXrl, setPendingXrl] = useState<ProjectXrlRow | null>(null);
  const [xrlDetailTarget, setXrlDetailTarget] = useState<{ row: ProjectXrlRow; axis: "TRL" | "BRL" | "GRL" | "SRL" | "HRL" } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    Promise.all([
      fetchActiveAlpha(),
      fetchVentureStatus(projectId === AAA_PROJECT_ID ? "p21" : projectId),
      fetchAmdScoreInputs(projectId === AAA_PROJECT_ID ? "p21" : projectId),
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
    ]).then(([alphaRes, b, inputs, roleData]) => {
      if (!cancelled) {
        setBundle(projectId === AAA_PROJECT_ID ? buildAaaVentureStatusBundle(b) : b);
        setAmdInputs(projectId === AAA_PROJECT_ID ? buildAaaScoreInputsFromSx(inputs, alphaRes.alpha) : inputs);
        setAlpha(alphaRes.alpha);
        setRoles(roleData);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const reload = async () => {
    const sourceProjectId = projectId === AAA_PROJECT_ID ? "p21" : projectId;
    const [b, inputs, alphaRes] = await Promise.all([
      fetchVentureStatus(sourceProjectId),
      fetchAmdScoreInputs(sourceProjectId),
      fetchActiveAlpha(),
    ]);
    setBundle(projectId === AAA_PROJECT_ID ? buildAaaVentureStatusBundle(b) : b);
    setAmdInputs(projectId === AAA_PROJECT_ID ? buildAaaScoreInputsFromSx(inputs, alphaRes.alpha) : inputs);
    setAlpha(alphaRes.alpha);
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
  // AMD スコア時系列 (Before Zero Theory v3.2 — 7 軸 Cobb-Douglas)
  const scoreSeries = useMemo(
    () => computeCockpitAmdScoreSeries(amdInputs, alpha),
    [amdInputs, alpha]
  );
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
  const scoreValues = scoreSeries.map((p) => Math.max(1, p.score));
  const scoreLogMin = scoreValues.length ? Math.max(0, Math.log10(Math.min(...scoreValues)) - 0.2) : 0;
  const scoreLogMax = scoreValues.length ? Math.min(5, Math.log10(Math.max(...scoreValues)) + 0.2) : 5;
  const scoreLogSpan = Math.max(0.3, scoreLogMax - scoreLogMin);
  const yOfScore = (s: number) => {
    const logV = Math.log10(Math.max(1, s));
    const ratio = Math.max(0, Math.min(1, (logV - scoreLogMin) / scoreLogSpan));
    return MT + PH - ratio * PH;
  };
  const xOfScore = (t: number) => ML + ((t - scoreRange.xMin) / Math.max(1, scoreRange.xMax - scoreRange.xMin)) * PW;
  const xOfScoreDate = (iso: string) => xOfScore(new Date(iso).getTime());
  const scorePath = scoreSeries.length < 2
    ? ""
    : "M " + scoreSeries.map((p) => `${xOfScoreDate(p.date).toFixed(1)},${yOfScore(p.score).toFixed(1)}`).join(" L ");
  const scoreGuides = [30, 100, 300, 1000, 3000, 10000, 30000, 100000].filter((g) => {
    const lg = Math.log10(g);
    return lg >= scoreLogMin && lg <= scoreLogMin + scoreLogSpan;
  });
  const scoreDateTicks = scoreSeries.map((p) => p.date);

  // 現在のスコア (最新点)
  const latestScore = scoreSeries[scoreSeries.length - 1]?.score;
  const latestInput = latestVisibleScorableScoreInput(amdInputs);
  const primarySnapshot = latestInput ? buildPrimaryScoreSnapshot(latestInput, alpha) : null;

  // XRL 軸 (5 軸: TRL/BRL/GRL/SRL/HRL)
  const yOfXrl = (v: number) => MT + PH - (v / 9) * PH;
  const buildXrlPath = (k: XrlAxisKey) => {
    const pts = (bundle?.xrlLog ?? [])
      .filter((r) => r[k] != null)
      .map((r) => ({ y: dateToYearDecimal(r.observed_at), v: r[k] as number }));
    if (pts.length < 2) return "";
    const dx = XRL_X_OFFSET[k];
    return "M " + pts.map((p) => `${(xOf(p.y) + dx).toFixed(1)},${yOfXrl(p.v).toFixed(1)}`).join(" L ");
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
    router.push(amdScoreDetailHref(projectId));
  };

  if (loading) {
    return (
      <div className="border border-cyan-300/35 bg-slate-950/88 px-4 py-3 text-[12px] font-bold text-cyan-100/70">
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
    <section className="relative overflow-hidden border border-cyan-300/35 bg-slate-950/88 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px)] bg-[length:100%_8px]" />
      {/* Header (各要素クリックで編集) */}
      <div className="relative flex flex-wrap items-center gap-2 border-b border-cyan-300/18 px-4 py-3">
        <button
          onClick={() => setMetaEditing("outcome")}
          className="text-lg hover:opacity-70"
          title="アウトカムを編集"
        >
          {outcome?.emoji}
        </button>
        <button
          onClick={() => setMetaEditing("name")}
          className="text-[15px] font-black text-white hover:underline decoration-dotted"
          title="PJ 名を編集"
        >
          {venture.display_name}
        </button>
        <button
          onClick={() => setMetaEditing("lane")}
          className="border px-1.5 py-0.5 font-mono text-[10px] hover:bg-cyan-300/8"
          style={{ color: laneColor, borderColor: laneColor }}
          title="レーンを編集"
        >
          {lane}
        </button>
        {outcome && (
          <button
            onClick={() => setMetaEditing("outcome")}
            className="px-1.5 py-0.5 font-mono text-[10px] hover:opacity-80"
            style={{ backgroundColor: outcome.color + "22", color: outcome.color }}
            title="アウトカムを編集"
          >
            {outcome.label}
          </button>
        )}
        <button
          onClick={() => setMetaEditing("founded_at")}
          className="text-[11px] text-cyan-100/62 hover:text-white hover:underline decoration-dotted"
          title="設立日を編集"
        >
          {venture.founded_at ? `設立 ${venture.founded_at.slice(0, 7)}` : "設立日未設定"}
        </button>
        <button
          onClick={() => setMetaEditing("origin_org")}
          className="text-[11px] text-cyan-100/62 hover:text-white hover:underline decoration-dotted"
          title="起源機関を編集"
        >
          / {venture.origin_org || "起源機関未設定"}
        </button>
        <button
          onClick={() => setMetaEditing("origin_pi")}
          className="text-[11px] text-cyan-100/62 hover:text-white hover:underline decoration-dotted"
          title="代表者 / PI を編集"
        >
          / {venture.origin_pi || "代表者未設定"}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setNarrativeOpen(true)}
          className="border border-cyan-300/24 bg-cyan-300/8 px-2 py-0.5 text-[11px] text-cyan-100 hover:bg-cyan-300/14"
          title="沿革を見る"
        >
          📜 沿革
        </button>
        <button
          onClick={() => setMembersOpen(true)}
          className="border border-cyan-300/24 bg-cyan-300/8 px-2 py-0.5 text-[11px] text-cyan-100 hover:bg-cyan-300/14"
          title="AMD 内部メンバー (project_members の share)"
        >
          👥 メンバー
        </button>
        {/* 2026-05-11 まさ指摘 1 番: 旧「関連メンバー」別ボタンを削除。
            LLM 抽出された関連メンバーは「👥 メンバー」モーダル内に統合表示 */}
        <button
          onClick={() => setPartnersOpen(true)}
          className="border border-cyan-300/24 bg-cyan-300/8 px-2 py-0.5 text-[11px] text-cyan-100 hover:bg-cyan-300/14"
          title="興味事業会社 (協業先 / 顧客候補)"
        >
          🤝 事業会社
        </button>
        <button
          onClick={() => setPlOpen(true)}
          className="border border-cyan-300/24 bg-cyan-300/8 px-2 py-0.5 text-[11px] text-cyan-100 hover:bg-cyan-300/14"
          title="月次試算表"
        >
          📊 試算表
        </button>
        {/* 2026-05-11 まさ指摘 3 番: 試算表の後に小さく書いてた「AMD: xxx ▾」タブを削除。
            代わりに「Chart 1: AMD スコア」グラフ内の現在地点プロットの上に大きいフォントで表示する。
            グラフ未評価の PJ には未評価リンクをそのままここに残す。 */}
        {latestScore == null && (
          <Link
            href={amdScoreDetailHref(projectId)}
            className="border border-dashed border-cyan-300/30 px-2 py-0.5 font-mono text-[11px] text-cyan-100/62 hover:bg-cyan-300/8"
            title="SPS primary 入力待ち。クリックで入力"
          >
            SPS: 入力待ち →
          </Link>
        )}
      </div>

      {/* PL / PM / クローザー / AMD 契約期間 / SU 設立年月日 (#15) */}
      {(roles.pls.length > 0 || roles.pms.length > 0 || roles.closers.length > 0 || venture.amd_support_started_at || venture.founded_at) && (
        <div className="relative flex flex-wrap gap-x-3 gap-y-0.5 px-4 pt-1 text-[10px] text-cyan-100/62">
          {roles.pls.length > 0 && (
            <span><b className="text-sky-200">PL</b> {roles.pls.join(", ")}</span>
          )}
          {roles.pms.length > 0 && (
            <span><b className="text-emerald-200">PM</b> {roles.pms.join(", ")}</span>
          )}
          {roles.closers.length > 0 && (
            <span><b className="text-amber-200">クローザー</b> {roles.closers.join(", ")}</span>
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
        className="relative block w-full px-4 pt-3 text-left text-[12px] text-cyan-50/78 hover:underline decoration-dotted"
        title="事業詳細を表示・編集 (つくよみがマージ)"
      >
        {venture.short_description || <span className="text-cyan-100/45">事業概要を入力…</span>}
        {venture.long_description && (
          <span className="ml-1 text-[10px] text-cyan-100/45">[詳細あり]</span>
        )}
      </button>

      {/* Chart 1: AMD スコア */}
      <div className="relative px-2 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-2">
          <h3 className="text-[12px] font-black uppercase tracking-[0.14em] text-cyan-100">
            Legacy AMD comparison
            <span className="ml-2 text-[9px] font-normal normal-case tracking-normal text-cyan-100/45">log scale / dynamic range</span>
          </h3>
          <div className="flex items-center gap-2 text-[10px]">
            {primarySnapshot && (
              <span className={`border px-2 py-0.5 font-black ${
                primarySnapshot.prs.status === "ready"
                  ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
                  : "border-amber-300/40 bg-amber-300/10 text-amber-100"
              }`}>
                {primarySnapshot.prs.status === "ready" && primarySnapshot.prs.score != null
                  ? `SPS ${primarySnapshot.prs.score < 1 ? primarySnapshot.prs.score.toFixed(2) : Math.round(primarySnapshot.prs.score).toLocaleString()}`
                  : `SPS missing: ${primarySnapshot.prs.missingAxes.join(" / ")}`}
              </span>
            )}
            <Link
              href={amdScoreDetailHref(projectId)}
              className="border border-cyan-300/30 bg-cyan-300/8 px-2 py-0.5 font-black text-cyan-100 hover:bg-cyan-300/14"
            >
              SPS DETAIL →
            </Link>
            <span className="text-cyan-100/45">
              · グラフクリックで詳細解析
            </span>
          </div>
        </div>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-auto block cursor-pointer"
          style={{ minWidth: 600 }}
          onClick={onScoreChartClick}
        >
          <defs>
            <filter id={`amd-score-glow-${projectId}`} x="-20%" y="-40%" width="140%" height="180%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id={`amd-score-fill-${projectId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.24" />
              <stop offset="72%" stopColor="#22d3ee" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#020817" stopOpacity="0" />
            </linearGradient>
          </defs>
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
              <text x={(left + right) / 2} y={MT + 10} fontSize={9} fill="#f9a8d4" textAnchor="middle" opacity={0.85}>
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
                stroke="rgba(103,232,249,0.14)"
                strokeDasharray="3 2"
              />
              <text x={ML - 6} y={yOfScore(v) + 3} fontSize={9} fill="rgba(186,230,253,0.62)" textAnchor="end">
                {v >= 1000 ? `${v / 1000}k` : v}
              </text>
            </g>
          ))}
          {/* X axis */}
          {scoreDateTicks.map((date) => (
            <g key={date}>
              <line x1={xOfScoreDate(date)} y1={MT} x2={xOfScoreDate(date)} y2={MT + PH} stroke="rgba(103,232,249,0.10)" />
              <text x={xOfScoreDate(date)} y={MT + PH + 12} fontSize={9} fill="rgba(186,230,253,0.58)" textAnchor="middle">
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
              <text x={xOfScoreDate(venture.founded_at) + 4} y={MT + 12} fontSize={9} fill="#fbbf24">
                設立 {venture.founded_at.slice(0, 7)}
              </text>
            </g>
          )}
          {/* スコア折れ線 */}
          {scorePath && (
            <>
              <path
                d={`${scorePath} L ${xOfScoreDate(scoreSeries[scoreSeries.length - 1].date).toFixed(1)},${MT + PH} L ${xOfScoreDate(scoreSeries[0].date).toFixed(1)},${MT + PH} Z`}
                fill={`url(#amd-score-fill-${projectId})`}
                opacity={0.9}
              />
              <path
                d={scorePath}
                fill="none"
                stroke="#67e8f9"
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#amd-score-glow-${projectId})`}
              />
              <path d={scorePath} fill="none" stroke="#f0f9ff" strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round" opacity={0.72} />
            </>
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
                <circle cx={xOfScore(new Date(ev.occurred_on).getTime())} cy={yOfScore(refScore)} r={14} fill={color} fillOpacity={0.78} stroke="#020817" strokeWidth={2} />
                <circle cx={xOfScore(new Date(ev.occurred_on).getTime())} cy={yOfScore(refScore)} r={18} fill="none" stroke="rgba(103,232,249,0.42)" strokeWidth={1} />
                <title>{`${KIND_LABELS[ev.kind]?.label ?? ev.kind} / ${ev.occurred_on} / ${ev.label}`}</title>
              </g>
            );
          })}
          {/* 2026-05-15: 最新 AMD スコアは直接 AMD Score 詳細へ送る。
              旧実装は XRL グラフ内に小さい pill (18px) で右端見切れ + そもそも別チャートにあった事故対応。
              位置を AMD グラフ右上に固定 (SVG viewBox 内座標)、フォント 32px、引き出し線で最新プロットと接続。 */}
          {(() => {
            const last = scoreSeries[scoreSeries.length - 1];
            if (!last) return null;
            const lx = xOfScoreDate(last.date);
            const ly = yOfScore(last.score);
            const label = last.score < 1 ? last.score.toFixed(2) : Math.round(last.score).toLocaleString();
            // pill: AMD グラフ SVG 右上の空きに固定。最大 6 桁 (= 100k IPO 級) + ▾ で十分なので幅 170px に縮小。
            const pillW = 170;
            const pillH = 52;
            const pillX = SVG_W - MR - pillW; // 880 - 24 - 170 = 686
            const pillY = MT + 4;             // 24 + 4 = 28
            const labelCenterX = pillX + pillW / 2;
            const labelY = pillY + pillH - 16; // baseline 調整
            return (
              <g
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(amdScoreDetailHref(projectId));
                }}
              >
                <title>クリックで cockpit のスコア詳細を開く</title>
                {/* 引き出し線: 最新プロット → pill 左辺中点 */}
                <line
                  x1={lx}
                  y1={ly}
                  x2={pillX}
                  y2={pillY + pillH / 2}
                  stroke="#67e8f9"
                  strokeWidth={1.2}
                  strokeDasharray="3 2"
                  opacity={0.55}
                />
                {/* 背景 pill */}
                <rect
                  x={pillX}
                  y={pillY}
                  rx={0}
                  ry={0}
                  width={pillW}
                  height={pillH}
                  fill="rgba(2,8,23,0.84)"
                  stroke="#67e8f9"
                  strokeWidth={1.5}
                  filter={`url(#amd-score-glow-${projectId})`}
                />
                <rect
                  x={pillX + 6}
                  y={pillY + 6}
                  width={pillW - 12}
                  height={pillH - 12}
                  fill="none"
                  stroke="rgba(103,232,249,0.28)"
                  strokeWidth={1}
                />
                {/* 数値: pill 中央寄せ */}
                <text
                  x={labelCenterX}
                  y={labelY}
                  fontSize={32}
                  fontWeight={800}
                  fontFamily="ui-monospace,SFMono-Regular,monospace"
                  fill="#ecfeff"
                  textAnchor="middle"
                >
                  {label}
                </text>
                <text
                  x={pillX + pillW - 10}
                  y={labelY - 18}
                  fontSize={11}
                  fill="#67e8f9"
                  textAnchor="end"
                >
                  →
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Chart 2: XRL */}
      <div className="px-2 pt-2 pb-3">
        <div className="px-2 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-[12px] font-semibold">XRL 進捗 (TRL / BRL / GRL / SRL / HRL)</h3>
          <div className="flex items-center gap-3 text-[10px]">
            {XRL_AXES.map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span style={{ color: XRL_COLORS[k] }}>—</span>
                <span className="uppercase font-mono">{k}</span>
              </span>
            ))}
            <span className="text-[10px] text-muted-foreground">
              XRL 自動判定 schedule は停止中。既存 / 手動提案ドットは採用・却下できる
            </span>
          </div>
        </div>

        {pendingXrl && (
          <div className="mx-2 mt-2 border border-cyan-300/30 bg-cyan-300/8 px-3 py-2 text-[12px] text-cyan-50">
            <div className="font-semibold text-cyan-100">
              LLM 提案:
              {XRL_AXES.map((k) => (
                <span key={k} className="ml-2">
                  {k.toUpperCase()} {pendingXrl[k] ?? "—"}
                </span>
              ))}
              {pendingXrl.bottleneck && <span className="ml-2 text-pink-200">ボトルネック: {pendingXrl.bottleneck}</span>}
            </div>
            {pendingXrl.milestone_label && (
              <div className="text-[11px] text-cyan-100/68 mt-0.5">「{pendingXrl.milestone_label}」</div>
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
                  const cx = xOfDate(r.observed_at) + XRL_X_OFFSET[k];
                  const cy = yOfXrl(v);
                  // 2026-05-12 まさ指示: 同位置 dot 重なり対策。
                  //   (a) 軸別 x offset で 5 並びに散らす
                  //   (b) 透明 hit area (r + 6) で clickable 範囲を拡大、見た目はそのまま
                  return (
                    <g key={`${r.id}-${k}`} style={{ cursor: "pointer" }} onClick={onClickAxis(upper)}>
                      <title>{`${upper} ${v} (${r.observed_at})${isProposal ? " — LLM 提案" : " — クリックで詳細"}`}</title>
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

      {scoreBreakdownOpen && (
        <CockpitAmdScoreBreakdownModal
          latestInput={latestInput}
          alpha={alpha}
          onClose={() => setScoreBreakdownOpen(false)}
          onOpenScoreDetail={() => router.push(amdScoreDetailHref(projectId))}
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

function buildAaaVentureStatusBundle(source: VentureStatusBundle): VentureStatusBundle {
  const venture: ProjectVentureRow = {
    project_id: AAA_PROJECT_ID,
    display_name: aaaVenture.display_name,
    short_label: aaaVenture.short_label,
    lane: aaaVenture.lane,
    founded_at: aaaVenture.founded_at,
    outcome_pattern: aaaVenture.outcome_pattern,
    origin_org: aaaVenture.origin_org,
    origin_pi: aaaVenture.origin_pi,
    amd_role: aaaVenture.amd_role,
    short_description: aaaVenture.short_description,
    long_description: null,
    amd_support_started_at: aaaVenture.amd_support_started_at,
    amd_support_ended_at: aaaVenture.amd_support_ended_at,
    is_public: aaaVenture.is_public,
    narrative_text: null,
    narrative_generated_at: null,
    narrative_invalidated_at: null,
  };
  return {
    venture,
    xrlLog: source.xrlLog.map((row) => ({
      ...row,
      id: `${AAA_PROJECT_ID}-${row.id}`,
      project_id: AAA_PROJECT_ID,
    })),
    events: source.events.map((event) => ({
      ...event,
      id: `${AAA_PROJECT_ID}-${event.id}`,
      project_id: AAA_PROJECT_ID,
    })),
  };
}
