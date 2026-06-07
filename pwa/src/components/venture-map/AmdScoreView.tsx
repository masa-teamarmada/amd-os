"use client";

/**
 * AMD Score 個別 PJ ビュー — Before Zero Theory v3.2 の 3 大要素 (M × X × F) を可視化。
 *
 * 構成 (2026-05-09 改修):
 *   - ScoreHeroCard: 大きな score 数値 (log scale バー)、律速軸ラベル
 *   - BalanceBar: 3 要素 M/X/F の max 達成率を水平バーで
 *   - FormulaPanel: 全体式 + 3 要素式 + 律速の経済学的根拠 (引用つき)
 *   - Factor3Breakdown: 3 要素カード (M/X/F)、各軸クリックで Tsukuyomi 起動
 *   - TimeSeriesChart: 経時 line chart (log scale)
 *   - FrlAlqPanel: FRL 6 因子の表示 + radar、各軸クリックで Tsukuyomi 起動
 *
 * 値編集はすべて Tsukuyomi 経由。α 編集は別ページ (/venture-map/amd-score/retrofit)。
 *
 * 仕様: pwa/design/amd_score.md
 */

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Tex } from "@/components/venture-map/Tex";
import {
  AXIS_COLOR,
  AXIS_LABEL_JP,
  // PHASE_COLOR / PHASE_LABEL_JP は使用しない (検証データ蓄積後に復活検討、2026-05-09)
  type AlphaWeights,
  type AmdScoreAxis,
  type AmdScoreResult,
} from "@/lib/amd-score";
import {
  fetchActiveAlpha,
  fetchAmdScoreInputs,
  toAmdScoreInputUpsert,
  type AmdScoreInputRow,
  upsertAmdScoreInput,
} from "@/lib/amd-score-data";
import {
  breakdownFromResult,
  buildPrimaryScoreSnapshot,
  buildAaaScoreInputsFromSx,
  computeAmdScoreSeries,
  computePrsScoreSeries,
  latestVisibleScorableScoreInput,
  resolveFrl,
} from "@/lib/amd-score-derived";
import type { VentureRow, XrlLogRow } from "@/lib/venture-map-data";
import type { AtlasMacroSignals } from "@/lib/atlas-macro-signals";
import type { TripleHelixComputed } from "@/lib/triple-helix-observations";
import { TripleHelixMatrix } from "@/components/venture-map/TripleHelixMatrix";
import { AmdScoreFormulaPanel } from "@/components/venture-map/AmdScoreFormulaPanel";
import { XrlChecklistPanel } from "@/components/venture-map/XrlChecklistPanel";

interface Props {
  venture: VentureRow;
  inputs: AmdScoreInputRow[];     // 古い順
  initialAlpha: AlphaWeights;
  /** 最新の XRL 観測 (source_note を XRL 各軸の根拠 fallback として使う) */
  latestXrlLog?: XrlLogRow | null;
  /** Atlas のマクロシグナル (μ_I / μ_G の根拠 fallback として domain で分類済) */
  atlasMacroSignals?: AtlasMacroSignals | null;
  /** Triple Helix 観測モデル C 行列 + 観測値 + μ 計算結果 (M カードで表示) */
  tripleHelix?: TripleHelixComputed | null;
  /** cockpit tab など、ページ chrome なしで中身だけ埋め込む表示 */
  embedded?: boolean;
}

/**
 * project_xrl_log.source_note は JSON 文字列で {"trl_reason": ..., "brl_reason": ..., "hrl_reason": ...} の形。
 * 軸ごとの reason を取り出すヘルパ。grl_reason / srl_reason は通常含まれない。
 */
function extractXrlReason(sourceNote: string | null, axis: AmdScoreAxis): string | null {
  if (!sourceNote) return null;
  try {
    const parsed = JSON.parse(sourceNote) as Record<string, unknown>;
    const key = `${axis.toLowerCase()}_reason`;
    const v = parsed[key];
    return typeof v === "string" && v.length > 0 ? v : null;
  } catch {
    // source_note が JSON でない (フリーテキスト) の場合はそのまま返す
    return sourceNote;
  }
}

const FALLBACK_NOTE = "根拠となる情報がないため仮置き";

interface EditableInput {
  evaluated_at: string;           // ISO date 'YYYY-MM-DD'
  mu_A: number;
  mu_I: number;
  mu_G: number;
  trl: number | null;
  brl: number;
  grl: number;
  srl: number;
  hrl: number;
  frl: number;
  // FRL ALQ 内訳 (Walumbwa 2008)
  alq_self_awareness: number | null;
  alq_relational_transparency: number | null;
  alq_balanced_processing: number | null;
  alq_internalized_moral: number | null;
  // FRL 6 因子拡張: Grit (Duckworth 2007) + Resilience (Markman 2005)
  frl_grit: number | null;
  frl_resilience: number | null;
  alq_auto_derive_frl: boolean;   // true なら 6 因子の重み付き平均を frl に自動反映 (UI のみ、DB には保存しない)
  frl_notes: string;
  // 各軸の評価根拠 (2026-05-09 追加)
  mu_notes_a: string;
  mu_notes_i: string;
  mu_notes_g: string;
  xrl_notes_trl: string;
  xrl_notes_brl: string;
  xrl_notes_grl: string;
  xrl_notes_srl: string;
  xrl_notes_hrl: string;
  shallow_tech_mode: boolean;
  notes: string;
}

function rowToEditable(r: AmdScoreInputRow): EditableInput {
  const hasAlqOrExtension =
    r.alq_self_awareness != null ||
    r.alq_relational_transparency != null ||
    r.alq_balanced_processing != null ||
    r.alq_internalized_moral != null ||
    r.frl_grit != null ||
    r.frl_resilience != null;
  return {
    evaluated_at: r.evaluated_at.slice(0, 10),
    mu_A: r.mu_A ?? 0,
    mu_I: r.mu_I ?? 0,
    mu_G: r.mu_G ?? 0,
    trl: r.shallow_tech_mode ? null : (r.trl ?? 0),
    brl: r.brl ?? 0,
    grl: r.grl ?? 0,
    srl: r.srl ?? 0,
    hrl: r.hrl ?? 0,
    frl: r.frl ?? 0,
    alq_self_awareness: r.alq_self_awareness,
    alq_relational_transparency: r.alq_relational_transparency,
    alq_balanced_processing: r.alq_balanced_processing,
    alq_internalized_moral: r.alq_internalized_moral,
    frl_grit: r.frl_grit,
    frl_resilience: r.frl_resilience,
    alq_auto_derive_frl: hasAlqOrExtension,    // 6 因子のいずれかが入っているなら自動算出 ON
    frl_notes: r.frl_notes ?? "",
    mu_notes_a: r.mu_notes?.a ?? "",
    mu_notes_i: r.mu_notes?.i ?? "",
    mu_notes_g: r.mu_notes?.g ?? "",
    xrl_notes_trl: r.xrl_notes?.trl ?? "",
    xrl_notes_brl: r.xrl_notes?.brl ?? "",
    xrl_notes_grl: r.xrl_notes?.grl ?? "",
    xrl_notes_srl: r.xrl_notes?.srl ?? "",
    xrl_notes_hrl: r.xrl_notes?.hrl ?? "",
    shallow_tech_mode: r.shallow_tech_mode,
    notes: r.notes ?? "",
  };
}

function emptyEditable(): EditableInput {
  return {
    evaluated_at: new Date().toISOString().slice(0, 10),
    mu_A: 0, mu_I: 0, mu_G: 0, trl: 0, brl: 0, grl: 0, srl: 0, hrl: 0, frl: 0,
    alq_self_awareness: null, alq_relational_transparency: null,
    alq_balanced_processing: null, alq_internalized_moral: null,
    frl_grit: null, frl_resilience: null,
    alq_auto_derive_frl: false,
    frl_notes: "",
    mu_notes_a: "", mu_notes_i: "", mu_notes_g: "",
    xrl_notes_trl: "", xrl_notes_brl: "", xrl_notes_grl: "", xrl_notes_srl: "", xrl_notes_hrl: "",
    shallow_tech_mode: false,
    notes: "",
  };
}

function formatRoundedDisplay(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString();
}

/**
 * 6 因子拡張 FRL 推定値 (0-9)。
 *
 * FRL = 0.6 · ALQ_4_avg + 0.2 · Grit + 0.2 · Resilience  (theory/amd_score.md §3.F.5)
 *
 * 各因子は null なら除外し、有効因子の重み合計で再正規化。全部 null なら null。
 *
 * - ALQ 4 次元 (Walumbwa 2008): authenticity 操作化、合計 4 次元の平均
 * - Grit (Duckworth 2007): 長期目標への passion + perseverance
 * - Resilience (Markman 2005): 失敗・拒絶への耐性、タフさ
 */
export function deriveFrl(e: Pick<EditableInput, "alq_self_awareness" | "alq_relational_transparency" | "alq_balanced_processing" | "alq_internalized_moral" | "frl_grit" | "frl_resilience">): number | null {
  const alqVals = [
    e.alq_self_awareness,
    e.alq_relational_transparency,
    e.alq_balanced_processing,
    e.alq_internalized_moral,
  ].filter((v): v is number => typeof v === "number");
  const alqAvg = alqVals.length > 0 ? alqVals.reduce((s, v) => s + v, 0) / alqVals.length : null;

  // 重み付け (theory §3.F.5)
  type Component = { value: number; weight: number };
  const comps: Component[] = [];
  if (alqAvg != null) comps.push({ value: alqAvg, weight: 0.6 });
  if (typeof e.frl_grit === "number") comps.push({ value: e.frl_grit, weight: 0.2 });
  if (typeof e.frl_resilience === "number") comps.push({ value: e.frl_resilience, weight: 0.2 });
  if (comps.length === 0) return null;

  const wSum = comps.reduce((s, c) => s + c.weight, 0);
  const vSum = comps.reduce((s, c) => s + c.value * c.weight, 0);
  return vSum / wSum;     // 重みを再正規化
}

/** Backward compatibility: 旧名で deriveFrl を再 export (新規コードは deriveFrl を使う) */
export const deriveFrlFromAlq = deriveFrl;

/**
 * AMD Score 詳細ページ — 表示 + Tsukuyomi 連携。
 *
 * 旧来の InputEditor (スライダー + textarea) と AlphaSidebar (α 編集) は削除。
 * 値の修正は Tsukuyomi 経由 (各軸クリック → drawer 起動 + prefill)、α 編集は別ページ
 * (/venture-map/amd-score/retrofit) で全 PJ シミュレーション付きで行う方針 (まさ判断 2026-05-09)。
 *
 * 値の表示には `editable` を読む (旧 state を読むだけにし、setEditable はしない)。
 */
export function AmdScoreView({
  venture,
  inputs,
  initialAlpha,
  latestXrlLog = null,
  atlasMacroSignals = null,
  tripleHelix = null,
  embedded = false,
}: Props) {
  const [alpha, setAlpha] = useState(initialAlpha);
  const [scoreInputs, setScoreInputs] = useState(inputs);
  const [prsSaveState, setPrsSaveState] = useState<"idle" | "saving" | "done" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { alpha: activeAlpha } = await fetchActiveAlpha();
      if (cancelled) return;
      setAlpha(activeAlpha);
      if (venture.project_id === "p99") {
        const sxInputs = await fetchAmdScoreInputs("p21");
        if (!cancelled) setScoreInputs(buildAaaScoreInputsFromSx(sxInputs, activeAlpha));
      } else {
        const latestInputs = await fetchAmdScoreInputs(venture.project_id);
        if (!cancelled) setScoreInputs(latestInputs);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialAlpha, inputs, venture.project_id]);

  // 「最新」は今日以前かつスコア算定可能な評価で最新を選ぶ。
  // スコアと M/X/F 表示が別行を参照すると、未解析に見えるため同じ行へ固定する。
  const latest = latestVisibleScorableScoreInput(scoreInputs);
  // editable は表示用に latest から固定 (setEditable しない、Tsukuyomi が DB を更新したら window reload で反映)
  const editable: EditableInput = latest ? rowToEditable(latest) : emptyEditable();
  const effectiveFrl = latest ? resolveFrl(latest) : editable.frl;

  // ---- 経時データ ----
  const series = useMemo(() => {
    return computeAmdScoreSeries(scoreInputs, alpha);
  }, [scoreInputs, alpha]);
  const prsSeries = useMemo(() => {
    return computePrsScoreSeries(scoreInputs, alpha);
  }, [scoreInputs, alpha]);
  const latestPoint = series.find((point) => point.id === latest?.id) ?? series[series.length - 1] ?? null;
  const result = latestPoint?.result;
  const latestBreakdown = result ? breakdownFromResult(result) : null;
  const primarySnapshot = useMemo(
    () => (latest ? buildPrimaryScoreSnapshot(latest, alpha, { P: null, R_net: null }, scoreInputs) : null),
    [latest, alpha, scoreInputs]
  );
  const latestPrsPoint = prsSeries.find((point) => point.id === latest?.id) ?? prsSeries[prsSeries.length - 1] ?? null;

  async function savePrsInputs(prsPotentialDraft: string, prsRNetDraft: string) {
    if (!latest) return;
    setPrsSaveState("saving");
    const prsPotential = parseNullablePrsValue(prsPotentialDraft);
    const prsRNet = parseNullablePrsValue(prsRNetDraft);
    const saved = await upsertAmdScoreInput(
      toAmdScoreInputUpsert(latest, {
        prs_potential: prsPotential,
        prs_r_net: prsRNet,
      })
    );
    if (!saved) {
      setPrsSaveState("error");
      return;
    }
    setScoreInputs((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
    setPrsSaveState("done");
  }

  if (embedded && primarySnapshot && result && latestBreakdown) {
    return (
      <div className="text-slate-900">
        <div className="w-full space-y-4">
          <PrimaryPrsHeroCard
            key={`${latest?.id ?? "no-row"}:${latest?.prs_potential ?? "null"}:${latest?.prs_r_net ?? "null"}:embedded`}
            venture={venture}
            primary={primarySnapshot}
            onSave={savePrsInputs}
            saveState={prsSaveState}
          />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <PrimaryPrsTimeSeriesChart
              series={prsSeries}
              latestEvaluatedAt={editable.evaluated_at}
              latestPoint={latestPrsPoint}
              missingAxes={primarySnapshot.prs.missingAxes}
              amdSupport={{
                startedAt: venture.amd_support_started_at ?? null,
                endedAt: venture.amd_support_ended_at ?? null,
              }}
            />
            <PrimaryPrsBreakdownPanel primary={primarySnapshot} venture={venture} />
          </div>
          <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <summary className="cursor-pointer list-none px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
              Legacy AMD comparison
            </summary>
            <div className="grid gap-4 border-t border-slate-200 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <TimeSeriesChart
                series={series}
                latest={editable.evaluated_at}
                latestScore={result.score}
                latestBreakdown={latestBreakdown}
                amdSupport={{
                  startedAt: venture.amd_support_started_at ?? null,
                  endedAt: venture.amd_support_ended_at ?? null,
                }}
              />
              <BalanceBar result={result} alpha={alpha} />
            </div>
          </details>
        </div>
      </div>
    );
  }

  if (!result || !latestBreakdown) {
    return (
      <div className={`${embedded ? "grid min-h-[240px] place-items-center rounded-xl border border-slate-200 bg-slate-950 px-5 text-center text-cyan-50" : "grid min-h-screen place-items-center bg-slate-950 px-5 text-center text-cyan-50"}`}>
        <div className="border border-cyan-300/30 bg-cyan-300/8 p-5 font-mono text-sm font-black uppercase tracking-[0.12em]">
          NO AMD SCORE DATA
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "text-slate-900" : "min-h-screen bg-slate-50 px-4 py-6 text-slate-900"}>
      <div className={embedded ? "w-full" : "mx-auto w-full max-w-[1240px]"}>
      {!embedded && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <Link href="/venture-map/amd-score" className="text-xs font-semibold tracking-wide text-slate-600 hover:text-slate-900">← スコア一覧</Link>
          <Link
            href={venture.project_id === "p99" ? `/hud/project/${venture.project_id}/cockpit` : `/project/${venture.project_id}/cockpit`}
            className="text-xs font-semibold tracking-wide text-slate-500 hover:text-slate-900"
          >
            ↩ コックピット
          </Link>
          <h1 className="ml-2 text-2xl font-bold tracking-tight text-slate-900">{venture.display_name}</h1>
          <span className="text-xs font-semibold tracking-wide text-slate-500">PRS primary / legacy AMD</span>
          <Link
            href="/venture-map/amd-score/retrofit"
            className="ml-auto rounded-md border border-pink-200 bg-pink-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-pink-700 hover:bg-pink-100"
          >
            legacy α / review →
          </Link>
        </div>
      )}

      <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-medium leading-relaxed text-amber-800">
        値の修正は <strong>Tsukuyomi 経由</strong>。各軸の値や根拠をクリックすると、その軸についてつくよみに話しかけられる
        (例: 「論文 N 件しかないから μ_A は 5 にして」など)。スライダーぽちぽち入力 UI は廃止 (まさ判断 2026-05-09)。
      </div>

      <div className="flex flex-col gap-4">
        {primarySnapshot && (
          <PrimaryPrsHeroCard
            key={`${latest?.id ?? "no-row"}:${latest?.prs_potential ?? "null"}:${latest?.prs_r_net ?? "null"}`}
            venture={venture}
            primary={primarySnapshot}
            onSave={savePrsInputs}
            saveState={prsSaveState}
          />
        )}
        <div className="rounded-xl border border-slate-200 bg-slate-950 px-4 py-3 text-[11px] leading-relaxed text-cyan-50 shadow-sm">
          <div className="font-mono text-[11px] font-black uppercase tracking-[0.14em] text-cyan-200">LEGACY AMD COMPARISON</div>
          <div className="mt-1 text-cyan-50/78">
            下の M × X × F / FRL / XRL / 経時グラフは legacy AMD を comparison と evidence 用に残したもの。主表示は上の PRS で、ここを primary として読まない。
          </div>
        </div>
        {/* 順序: スコア → 経時 → 3 要素のバランス → 数式 → 3 要素詳細 → FRL レーダー
            (まさ 2026-05-12: 「経時グラフはスコアと 3 要素のバランスの間に置く」指示。
             AmdScoreView 初版 09dce20 から TimeSeriesChart は Factor3Breakdown の下にあったが、
             UX 的には大スコアの直後に経時を見せて流れを掴ませる方が自然。) */}
        <ScoreHeroCard result={result} venture={venture} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <TimeSeriesChart
            series={series}
            latest={editable.evaluated_at}
            latestScore={result.score}
            latestBreakdown={latestBreakdown}
            amdSupport={{
              startedAt: venture.amd_support_started_at ?? null,
              endedAt: venture.amd_support_ended_at ?? null,
            }}
          />
          <BalanceBar result={result} alpha={alpha} />
        </div>
        <AmdScoreFormulaPanel alpha={alpha} />
        <Factor3Breakdown
          result={result}
          alpha={alpha}
          editable={editable}
          ventureName={venture.display_name}
          latestXrlLog={latestXrlLog}
          atlasMacroSignals={atlasMacroSignals}
          tripleHelix={tripleHelix}
        />
        <FrlAlqPanel editable={editable} effectiveFrl={effectiveFrl} ventureName={venture.display_name} />
        <XrlChecklistPanel
          projectId={venture.project_id}
          latestInput={latest}
          onSaved={() => window.location.reload()}
        />
      </div>
      </div>
    </div>
  );
}

// ============================================================
// Score Hero Card
// ============================================================
function ScoreHeroCard({
  result,
  venture,
}: {
  result: AmdScoreResult;
  venture: VentureRow;
}) {
  // bar 範囲 = log10(1000) 〜 log10(50,000) (まさ判断 2026-05-10):
  //   PJ 化済が 1k 前後、卒業が 50k 前後なので、その帯を見える化
  //   < 1,000 は 0%、> 50,000 は 100% で clip
  const norm = (() => {
    const lo = Math.log10(1000);
    const hi = Math.log10(50000);
    const v = Math.log10(Math.max(1, result.score));
    return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  })();
  const scoreColor = "#0f172a";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Legacy AMD</div>
          <div className="font-mono text-5xl font-bold leading-none" style={{ color: scoreColor }}>
            {formatRoundedDisplay(result.score)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500">
            律速: <span className="font-mono font-semibold text-slate-800">{AXIS_LABEL_JP[result.bottleneck]}</span>
          </div>
          {result.shallowTechMode && (
            <div className="text-[10px] text-amber-700 mt-1">Shallow Tech モード</div>
          )}
        </div>
      </div>

      {/* log scale バー (1k-50k focus、< 1k と > 50k は飽和) */}
      <div className="relative h-2 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${norm * 100}%`, backgroundColor: "#0ea5e9", transition: "width 200ms" }}
        />
        {/* 設立 GO 閾値 (3,500) のマーカー */}
        {(() => {
          const lo = Math.log10(1000);
          const hi = Math.log10(50000);
          const goPct = ((Math.log10(3500) - lo) / (hi - lo)) * 100;
          return (
            <div
              className="absolute top-[-2px] h-3 w-px bg-pink-500"
              style={{ left: `${goPct}%` }}
              title="設立 GO 閾値 = 3,500"
            />
          );
        })()}
      </div>
      <div className="relative mt-1 text-[9px] text-slate-500 font-mono h-3">
        <span className="absolute" style={{ left: "0%" }}>1k</span>
        <span className="absolute" style={{ left: `${((Math.log10(3500) - Math.log10(1000)) / (Math.log10(50000) - Math.log10(1000))) * 100}%`, transform: "translateX(-50%)" }}>3.5k</span>
        <span className="absolute" style={{ left: `${((Math.log10(15000) - Math.log10(1000)) / (Math.log10(50000) - Math.log10(1000))) * 100}%`, transform: "translateX(-50%)" }}>15k</span>
        <span className="absolute right-0">50k</span>
      </div>

      <div className="mt-3 text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
        <span>K = {result.K.toFixed(4)}</span>
        <span className="text-slate-300">|</span>
        <span>Σα = {result.alphaSum.toFixed(2)}</span>
        <span className="text-slate-300">|</span>
        <span>σ_SU = {result.sigma_SU.toFixed(2)}</span>
        <span className="text-slate-300">|</span>
        <span>lane: <span className="font-mono">{venture.lane}</span></span>
      </div>
    </div>
  );
}

// ============================================================
// Balance Bar — 3 要素 (M × X × F) のバランスを max に対する達成率で可視化
// ============================================================
//
// 各要素の max は「全軸 9 (= IPO 級) のときの値」と定義:
//   M_max = 10^α_σ          (≈ 19.95 default)
//   X_max = 10^Σα_X         (≈ 1585 default、5 軸の積)
//   F_max = 10^α_F          (≈ 31.62 default)
// M は外部環境の合成寄与なので、理論上の「最大値」を置かない。
// UI 上のバー幅は raw contribution を読むための表示スケールであり、
// M/X/F の数値自体は AmdScore 詳細ページと同じ実データをそのまま出す。
//
function BalanceBar({
  result,
  alpha,
}: {
  result: AmdScoreResult;
  alpha: AlphaWeights;
}) {
  const M = result.contributions.sigma_SU ?? 1;
  let X = 1;
  for (const a of ["TRL", "BRL", "GRL", "SRL", "HRL"] as AmdScoreAxis[]) {
    if (a === "TRL" && result.shallowTechMode) continue;
    X *= result.contributions[a] ?? 1;
  }
  const F = result.contributions.FRL ?? 1;
  const xrlAxes: AmdScoreAxis[] = ["TRL", "BRL", "GRL", "SRL", "HRL"];
  const Xalpha = xrlAxes
    .filter((a) => !(a === "TRL" && result.shallowTechMode))
    .reduce((s, a) => s + alpha[a], 0);
  const Xmax = Math.pow(10, Xalpha);
  const Fmax = Math.pow(10, alpha.FRL);
  const Mscale = Math.max(20, Math.ceil((M * 1.25) / 5) * 5);

  return (
      <div className="relative h-full min-h-[278px] overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="relative mb-3 flex items-start justify-between gap-2 border-b border-slate-200 pb-2">
        <div>
          <div className="text-[13px] font-bold uppercase tracking-wide text-slate-900">Legacy M / X / F バランス</div>
          <div className="mt-1 text-[10px] font-medium text-slate-500">comparison only (M は理論最大なし)</div>
        </div>
        <div className="rounded-md border border-pink-200 bg-pink-50 px-2 py-1 text-right font-mono text-[10px] font-semibold text-pink-700">
          LIVE
        </div>
      </div>
      <div className="relative flex flex-col gap-2">
        <BalanceBarRow
          label="M (Macrotrend)"
          axis="M"
          value={M}
          scale={Mscale}
          scaleLabel="RAW"
          color={AXIS_COLOR.sigma_SU}
          bottleneck={result.bottleneck === "sigma_SU"}
        />
        <BalanceBarRow
          label="X (XRL)"
          axis="X"
          value={X}
          scale={Xmax}
          scaleLabel="MAX"
          color={AXIS_COLOR.TRL}
          bottleneck={(["TRL", "BRL", "GRL", "SRL", "HRL"] as AmdScoreAxis[]).includes(result.bottleneck)}
        />
        <BalanceBarRow
          label="F (FRL)"
          axis="F"
          value={F}
          scale={Fmax}
          scaleLabel="MAX"
          color={AXIS_COLOR.FRL}
          bottleneck={result.bottleneck === "FRL"}
        />
      </div>
    </div>
  );
}

function BalanceBarRow({
  label,
  axis,
  value,
  scale,
  scaleLabel,
  color,
  bottleneck,
}: {
  label: string;
  axis: "M" | "X" | "F";
  value: number;
  scale: number;
  scaleLabel: "RAW" | "MAX";
  color: string;
  bottleneck: boolean;
}) {
  const pct = Math.min(1, value / Math.max(scale, 1));
  const percent = Math.round(pct * 100);
  const displayValue = formatRoundedDisplay(value);
  const displayScale = formatRoundedDisplay(scale);
  return (
    <div className={`relative rounded-lg border px-3 py-2 ${bottleneck ? "border-pink-300 bg-pink-50/40" : "border-slate-200 bg-slate-50"}`}>
      <div className="grid grid-cols-[44px_1fr_70px] items-center gap-3">
        <div
          className="grid h-[40px] place-items-center rounded-md border bg-white font-mono text-[22px] font-bold leading-none"
          style={{ borderColor: color, color }}
        >
          <span>{axis}</span>
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="truncate text-[11px] font-semibold tracking-wide text-slate-700">
              {label}
            </div>
            {bottleneck && <div className="text-[9px] font-bold uppercase tracking-wider text-pink-600">律速</div>}
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${pct * 100}%`, backgroundColor: color }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[9px] font-medium text-slate-500">
            <span>0</span>
            <span>{scaleLabel === "MAX" ? `/${displayScale}` : "raw"}</span>
          </div>
        </div>
        <div className="text-right font-mono">
          <div className="text-[20px] font-bold leading-none" style={{ color }}>
            {percent}%
          </div>
          <div className="mt-1 text-[9px] font-medium text-slate-500">
            {displayValue}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FormulaPanel は別ファイル化 (AmdScoreFormulaPanel.tsx) して retrofit ページと共有。
// 旧実装は紫枠の M 式が古かった (Triple Helix 観測モデルの μ_x = Σ c_xp ỹ_p / Σ c_xp と
// ỹ_p min-max が抜けてた) ためまさが指摘 (2026-05-10 夜)。AmdScoreFormulaPanel.tsx で 4 段に拡張。
// ============================================================

// 削除済 stub (本来 ../AmdScoreFormulaPanel.tsx を使う)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _DeletedFormulaPanel({ alpha }: { alpha: AlphaWeights }) {
  void alpha;
  return (
    <div className="text-[11px] text-slate-700 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 leading-relaxed flex flex-col gap-3">
      <div>
        Before Zero Theory v3.2 — <strong>Macrotrend M</strong> × <strong>XRL X</strong> ×{" "}
        <strong>FRL F</strong> の 3 大要素を Cobb-Douglas で統合。
        <br />
        マクロトレンドの流れがあって、会社の XRL が整っていて、それを FRL 高い CEO が牽引する。
      </div>
      <div className="bg-white rounded px-3 py-2 overflow-x-auto">
        <div className="text-[10px] text-muted-foreground mb-1">
          全体式 (S = AMD Score、k は IPO 級への校正定数)
        </div>
        <Tex display tex={String.raw`S \;=\; k \cdot M \cdot X \cdot F`} />
        <div className="text-[9px] text-muted-foreground mt-1">
          根拠: Cobb &amp; Douglas (1928). &quot;A theory of production.&quot;{" "}
          <em>American Economic Review</em>, 18(1), 139-165. — 多因子統合の経済学標準。各 α は弾力性 (= X が 1% 増えたとき S が何 % 増えるか) を表す。
        </div>
      </div>
      <div className="bg-white rounded px-3 py-2 overflow-x-auto">
        <div className="text-[10px] text-muted-foreground mb-1">
          ① M = Macrotrend (外部環境 / Triple Helix: 学術 μ_A × 産業 μ_I × 政府 μ_G)
        </div>
        <Tex
          display
          tex={String.raw`M \;=\; (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}, \quad \sigma_{\mathrm{SU}} \;=\; \sqrt[3]{(\mu_A+1)(\mu_I+1)(\mu_G+1)} - 1`}
        />
        <div className="text-[9px] text-muted-foreground mt-1">
          根拠: Etzkowitz &amp; Leydesdorff (2000). &quot;The dynamics of innovation: from National Systems and Mode 2 to a Triple Helix of university–industry–government relations.&quot;{" "}
          <em>Research Policy</em>, 29(2), 109-123. — Triple Helix 状態空間モデル。
        </div>
      </div>
      <div className="bg-white rounded px-3 py-2 overflow-x-auto">
        <div className="text-[10px] text-muted-foreground mb-1">
          ② X = XRL (会社に帰属する 5 軸 readiness、内閣府 SIP 互換)
        </div>
        <Tex
          display
          tex={String.raw`X \;=\; \prod_{x \in \{\mathrm{TRL},\, \mathrm{BRL},\, \mathrm{GRL},\, \mathrm{SRL},\, \mathrm{HRL}\}} (x+1)^{\alpha_x}`}
        />
        <div className="text-[9px] text-muted-foreground mt-1 space-y-0.5">
          <div>
            根拠 (TRL): Mankins, J. C. (1995). &quot;Technology readiness levels.&quot;{" "}
            <em>NASA White Paper</em>. — 9 段階の技術成熟度の起源。
          </div>
          <div>
            根拠 (5 XRL 並列): 内閣府 SIP サーキュラーエコノミーシステム構築 公募要領 (令和 5 年, Ver 1.1). — TRL/BRL/GRL/SRL/HRL を**並列の評価軸**と規定。
          </div>
          <div>
            根拠 (SRL): EU Horizon Europe Multi-RL framework. — 社会受容性 9 段階。
          </div>
        </div>
      </div>
      <div className="bg-white rounded px-3 py-2 overflow-x-auto">
        <div className="text-[10px] text-muted-foreground mb-1">
          ③ F = FRL (CEO / founder readiness、6 因子 = ALQ 4 + Grit + Resilience)
        </div>
        <Tex display tex={String.raw`F \;=\; (\mathrm{FRL}+1)^{\alpha_F}, \quad \mathrm{FRL} \;=\; 0.6 \cdot \overline{\mathrm{ALQ}_4} + 0.2 \cdot \mathrm{Grit} + 0.2 \cdot \mathrm{Resilience}`} />
        <div className="text-[9px] text-muted-foreground mt-1 space-y-0.5">
          <div>
            根拠 (Founder Quality 重要性): Bernstein, Korteweg &amp; Laws (2017). &quot;Attracting early-stage investors.&quot;{" "}
            <em>Journal of Finance</em>, 72(2), 509-538. — AngelList RCT で Founder Quality が VC 意思決定の最大要因と実証 → α_F=1.5 の根拠。
          </div>
          <div>
            根拠 (ALQ 4 次元 = オーセンティシティ): Walumbwa, Avolio, Gardner, Wernsing &amp; Peterson (2008). &quot;Authentic leadership: Development and validation of a theory-based measure.&quot;{" "}
            <em>Journal of Management</em>, 34(1), 89-126.
          </div>
          <div>
            根拠 (Grit = 集中力): Duckworth, Peterson, Matthews &amp; Kelly (2007). &quot;Grit: Perseverance and passion for long-term goals.&quot;{" "}
            <em>Journal of Personality and Social Psychology</em>, 92(6), 1087-1101.
          </div>
          <div>
            根拠 (Resilience = タフさ): Markman, Baron &amp; Balkin (2005). &quot;Are perseverance and self-efficacy costless?&quot;{" "}
            <em>Journal of Organizational Behavior</em>, 26(1), 1-19.
          </div>
          <div>
            根拠 (Founder Network 効果): Hsu, D. H. (2007). &quot;Experienced entrepreneurial founders, organizational capital, and venture capital funding.&quot;{" "}
            <em>Research Policy</em>, 36(5), 722-741.
          </div>
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground space-y-1">
        <div>
          重み (default): α_F=<span className="font-mono">1.5</span> &gt;
          α_σ=<span className="font-mono">1.3</span> &gt;
          α_HRL=<span className="font-mono">1.1</span> &gt;
          α_TRL=<span className="font-mono">1.0</span> &gt;
          α_BRL=<span className="font-mono">0.6</span> &gt;
          α_GRL=<span className="font-mono">0.3</span> &gt;
          α_SRL=<span className="font-mono">0.2</span>
        </div>
        <div>
          k = <span className="font-mono">100,000 / 10^Σα</span> で全軸 9 (= IPO 級) を 100,000
          に校正 · Shallow Tech モード (TRL=null) では TRL を X から除外して k を再校正。
        </div>
      </div>

      {/* 律速 (rate-limiting) の経済学的根拠 */}
      <div className="text-[10.5px] text-slate-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 leading-relaxed flex flex-col gap-1 mt-1">
        <div className="text-[11px] font-semibold">律速 (rate-limiting) の定義</div>
        <div>
          「1 段階上げたとき S が最も大きく増える軸」を律速とする。Cobb-Douglas の偏微分から:
        </div>
        <div className="bg-white rounded px-2 py-1 overflow-x-auto">
          <Tex
            display
            tex={String.raw`\frac{\partial S}{\partial X_i} \;=\; \frac{\alpha_i \cdot S}{X_i + 1} \quad\Rightarrow\quad \text{bottleneck} \;=\; \arg\max_i \frac{\alpha_i}{X_i + 1}`}
          />
        </div>
        <div>
          重み α が大きいのに値 X が低い軸 = 限界収益 (marginal contribution) が最大の軸 = 経営アクションで最初に手当てすべき軸。
        </div>
        <div className="text-[9px] text-muted-foreground">
          根拠: Cobb, C. W. &amp; Douglas, P. H. (1928). &quot;A theory of production.&quot;{" "}
          <em>American Economic Review</em>, 18(1), 139-165.
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Factor3Breakdown — 3 要素 (M × X × F) の内訳カード
// ============================================================
//   モーダルと同じレイアウトを詳細ページにも提供。各軸の評価根拠 (notes) を subtitle で表示。
//   モーダルと違って editable 経由でリアルタイム更新される (右側パネルで notes を編集すると
//   即座にここで見える)。
function Factor3Breakdown({
  result,
  alpha,
  editable,
  ventureName,
  latestXrlLog,
  atlasMacroSignals: _atlasMacroSignals,
  tripleHelix,
}: {
  result: AmdScoreResult;
  alpha: AlphaWeights;
  editable: EditableInput;
  ventureName: string;
  latestXrlLog: XrlLogRow | null;
  atlasMacroSignals: AtlasMacroSignals | null;
  tripleHelix: TripleHelixComputed | null;
}) {
  // _atlasMacroSignals は M カード新設計 (TripleHelixMatrix) で内部 fetch するため未使用。
  // Cockpit モーダル等で再利用する可能性があり Props には残す。
  void _atlasMacroSignals;

  const fmt = (n: number, digits = 2) =>
    n < 1 ? n.toFixed(digits) : n < 100 ? n.toFixed(2) : Math.round(n).toLocaleString();

  // ① M = (σ_SU+1)^α_σ
  const mContribution = result.contributions.sigma_SU ?? 1;
  const M = mContribution;

  // ② X = ∏(x+1)^α_x  (Shallow Tech では TRL を除外)
  const xrlAxes: AmdScoreAxis[] = ["TRL", "BRL", "GRL", "SRL", "HRL"];
  let X = 1;
  for (const a of xrlAxes) {
    if (a === "TRL" && result.shallowTechMode) continue;
    X *= result.contributions[a] ?? 1;
  }

  // ③ F = (FRL+1)^α_F
  const F = result.contributions.FRL ?? 1;

  return (
    <div className="flex flex-col gap-3">
      <DetailFactorCard
        label="M"
        ja="Macrotrend"
        sub="外部環境 / Triple Helix 観測モデル"
        value={M}
        color={AXIS_COLOR.sigma_SU}
        formula={<Tex tex={String.raw`M = (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}`} />}
        bottleneck={result.bottleneck === "sigma_SU"}
      >
        {/* Triple Helix 観測モデル: 6 観測量 × 3 隠れ状態 (μ_A/I/G) の C 行列を表示。
            mu_notes は MuChip 直下に表示し、クリックで Tsukuyomi prefill (2026-05-27 改修)。 */}
        <TripleHelixMatrix
          helix={tripleHelix}
          alphaSigma={alpha.sigma_SU}
          muNotes={{
            a: editable.mu_notes_a || null,
            i: editable.mu_notes_i || null,
            g: editable.mu_notes_g || null,
          }}
          onMuClick={(axis) => {
            const labelMap = { A: "μ_A (学術)", I: "μ_I (産業)", G: "μ_G (政府)" } as const;
            const valueMap = { A: editable.mu_A, I: editable.mu_I, G: editable.mu_G } as const;
            const noteMap = { A: editable.mu_notes_a, I: editable.mu_notes_i, G: editable.mu_notes_g } as const;
            openTsukuyomiPrefill(ventureName, labelMap[axis], fmt(valueMap[axis], 1), noteMap[axis] || null);
          }}
        />
      </DetailFactorCard>

      <DetailFactorCard
        label="X"
        ja="XRL"
        sub="会社に帰属する 5 軸 readiness"
        value={X}
        color={AXIS_COLOR.TRL}
        formula={<Tex tex={String.raw`X = \prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}} (x+1)^{\alpha_x}`} />}
      >
        {xrlAxes.map((axis) => {
          if (axis === "TRL" && result.shallowTechMode) return null;
          const rawValue =
            axis === "TRL"
              ? editable.trl ?? 0
              : axis === "BRL"
                ? editable.brl
                : axis === "GRL"
                  ? editable.grl
                  : axis === "SRL"
                    ? editable.srl
                    : editable.hrl;
          const contribution = result.contributions[axis] ?? 1;
          const noteKey =
            axis === "TRL"
              ? editable.xrl_notes_trl
              : axis === "BRL"
                ? editable.xrl_notes_brl
                : axis === "GRL"
                  ? editable.xrl_notes_grl
                  : axis === "SRL"
                    ? editable.xrl_notes_srl
                    : editable.xrl_notes_hrl;
          // 根拠フォールバック: amd_score_inputs.xrl_notes → project_xrl_log.source_note の {axis}_reason → 仮置き
          const xrlLogReason = extractXrlReason(latestXrlLog?.source_note ?? null, axis);
          const subtitleSource: "input" | "xrl_log" | "fallback" = noteKey
            ? "input"
            : xrlLogReason
              ? "xrl_log"
              : "fallback";
          const subtitleText =
            subtitleSource === "input"
              ? noteKey!
              : subtitleSource === "xrl_log"
                ? `(XRL 観測 ${latestXrlLog?.observed_at ?? ""} より) ${xrlLogReason}`
                : FALLBACK_NOTE;
          return (
            <DetailFactorRow
              key={axis}
              name={`${axis} = ${Math.round(rawValue)}`}
              value={
                <>
                  <Tex tex={String.raw`(${Math.round(rawValue)}+1)^{${alpha[axis].toFixed(2)}}`} />
                  <span className="ml-1 font-mono">= {fmt(contribution)}</span>
                </>
              }
              note={`α = ${alpha[axis].toFixed(2)}`}
              dotColor={AXIS_COLOR[axis]}
              bottleneck={result.bottleneck === axis}
              subtitle={subtitleText}
              subtitleIsFallback={subtitleSource === "fallback"}
              onClick={() => openTsukuyomiPrefill(ventureName, axis, String(Math.round(rawValue)), noteKey || xrlLogReason)}
            />
          );
        })}
        <DetailFactorRow
          name={<><span className="font-mono">= X = </span><Tex tex={String.raw`\prod_{x} (x+1)^{\alpha_x}`} /></>}
          value={fmt(X)}
          total
        />
      </DetailFactorCard>

      <DetailFactorCard
        label="F"
        ja="FRL"
        sub="個人に帰属 / ALQ + Grit + Resilience"
        value={F}
        color={AXIS_COLOR.FRL}
        formula={<Tex tex={String.raw`F = (\mathrm{FRL}+1)^{\alpha_F}`} />}
        bottleneck={result.bottleneck === "FRL"}
      >
        <DetailFactorRow
          name={`FRL = ${fmt(editable.frl, 1)}`}
          value={fmt(editable.frl, 1)}
          subtitle={editable.frl_notes || FALLBACK_NOTE}
          subtitleIsFallback={!editable.frl_notes}
          onClick={() => openTsukuyomiPrefill(ventureName, "FRL", fmt(editable.frl, 1), editable.frl_notes || null)}
        />
        <DetailFactorRow
          name={<><span className="font-mono">= F = </span><Tex tex={String.raw`(\mathrm{FRL}+1)^{\alpha_F}`} /></>}
          value={fmt(F)}
          note={<>α_F = {alpha.FRL.toFixed(2)} (最大重み)</>}
          total
        />
      </DetailFactorCard>
    </div>
  );
}

function DetailFactorCard({
  label,
  ja,
  sub,
  value,
  color,
  formula,
  bottleneck = false,
  children,
}: {
  label: string;
  ja: string;
  sub: string;
  value: number;
  color: string;
  formula: ReactNode; // string も可、Tex も可
  bottleneck?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="border p-4 shadow-[0_0_28px_rgba(34,211,238,0.12),inset_0_0_28px_rgba(34,211,238,0.06)]"
      style={{
        borderColor: bottleneck ? "rgba(244,114,182,0.62)" : "rgba(103,232,249,0.32)",
        backgroundColor: bottleneck ? "rgba(80, 7, 36, 0.34)" : "rgba(2, 8, 23, 0.80)",
      }}
    >
      <div className="flex items-baseline justify-between mb-1">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-mono font-bold" style={{ color }}>
            {label}
          </span>
          <span className="text-[13px] font-semibold">{ja}</span>
          {bottleneck && <span className="text-[10px] font-black text-pink-200">BOTTLENECK</span>}
        </div>
        <span className="text-2xl font-mono font-bold" style={{ color }}>
          {value < 1 ? value.toFixed(2) : value < 100 ? value.toFixed(2) : Math.round(value).toLocaleString()}
        </span>
      </div>
      <div className="text-[10.5px] text-muted-foreground mb-2">
        {sub} · <span className="font-mono">{formula}</span>
      </div>{/* formula は ReactNode (string or <Tex/>) を受ける */}
      <table className="w-full text-[11px]">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function DetailFactorRow({
  name,
  value,
  note,
  dotColor,
  highlight = false,
  total = false,
  bottleneck = false,
  subtitle,
  subtitleIsFallback = false,
  onClick,
}: {
  name: ReactNode; // string も可、<Tex /> も可
  value: ReactNode;
  note?: ReactNode;
  dotColor?: string;
  highlight?: boolean;
  total?: boolean;
  bottleneck?: boolean;
  subtitle?: string;
  /** subtitle が「根拠仮置き」のフォールバックの場合は薄めて表示する */
  subtitleIsFallback?: boolean;
  /** クリック可能にして Tsukuyomi 起動などの handler を実行。指定すると行が hover で背景色変化。 */
  onClick?: () => void;
}) {
  const bg = bottleneck
    ? "rgba(244, 114, 182, 0.12)"
    : highlight
      ? "rgba(103, 232, 249, 0.08)"
      : total
        ? "rgba(52, 211, 153, 0.10)"
        : undefined;
  const fontWeight = total ? 600 : 400;
  const isClickable = !!onClick;
  return (
    <tr
      className={`border-b border-cyan-300/14${isClickable ? " hover:bg-cyan-300/8 cursor-pointer" : ""}`}
      style={{ backgroundColor: bg, fontWeight }}
      onClick={onClick}
      title={isClickable ? "クリックでつくよみに修正を依頼" : undefined}
    >
      <td className="py-1 align-top">
        <div>
          {dotColor && <span style={{ color: dotColor }}>● </span>}
          {name}
          {bottleneck && <span className="ml-1 text-[9px] text-red-600">律速</span>}
          {isClickable && <span className="ml-1 text-[9px] text-cyan-600">💬</span>}
        </div>
        {subtitle && (
          <div
            className={`text-[9.5px] italic font-normal mt-0.5 leading-snug ${subtitleIsFallback ? "text-slate-400" : "text-muted-foreground"}`}
          >
            {subtitle}
          </div>
        )}
      </td>
      <td className="text-right font-mono py-1 align-top">{value}</td>
      <td className="text-right text-[10px] text-muted-foreground py-1 pl-2 whitespace-nowrap align-top">
        {note ?? ""}
      </td>
    </tr>
  );
}

// ============================================================
// Time Series Chart
// ============================================================
function PrimaryPrsBreakdownPanel({
  primary,
  venture,
}: {
  primary: ReturnType<typeof buildPrimaryScoreSnapshot>;
  venture: VentureRow;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">PRS breakdown</div>
      <div className="mt-3 space-y-2 text-[12px] text-slate-700">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2">
          <span className="font-semibold">P potential</span>
          <span className="font-mono text-slate-900">{formatRoundedDisplay(primary.prs.axisValues.P)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-sky-50 px-3 py-2">
          <span className="font-semibold">R reach</span>
          <span className="font-mono text-slate-900">{formatRoundedDisplay(primary.prs.components?.reach ?? null)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-violet-50 px-3 py-2">
          <span className="font-semibold">S survival</span>
          <span className="font-mono text-slate-900">{formatRoundedDisplay(primary.prs.components?.survival ?? null)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2">
          <span className="font-semibold">R_net</span>
          <span className="font-mono text-slate-900">{formatRoundedDisplay(primary.prs.axisValues.R_net)}</span>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
        <div className="font-semibold text-slate-900">Legacy AMD comparison</div>
        <div className="mt-1 font-mono text-lg text-slate-900">{formatRoundedDisplay(primary.legacy.score)}</div>
        <div className="mt-1">lane: <span className="font-mono">{venture.lane}</span></div>
      </div>
    </div>
  );
}

function PrimaryPrsTimeSeriesChart({
  series,
  latestEvaluatedAt,
  latestPoint,
  missingAxes,
  amdSupport,
}: {
  series: Array<{
    id: string;
    evaluated_at: string;
    score: number;
    prs: {
      components: { potential: number; reach: number; survival: number } | null;
      axisValues: { P: number | null; R_net: number | null };
    };
  }>;
  latestEvaluatedAt: string;
  latestPoint: {
    id: string;
    evaluated_at: string;
    score: number;
    prs: {
      components: { potential: number; reach: number; survival: number } | null;
      axisValues: { P: number | null; R_net: number | null };
    };
  } | null;
  missingAxes: string[];
  amdSupport: { startedAt: string | null; endedAt: string | null };
}) {
  const [active, setActive] = useState<{
    id: string;
    evaluated_at: string;
    score: number;
    potential: number | null;
    reach: number | null;
    survival: number | null;
    rNet: number | null;
    px: number;
    py: number;
  } | null>(null);
  const W = 640;
  const H = 178;
  const ML = 46;
  const MR = 14;
  const MT = 14;
  const MB = 30;
  const PW = W - ML - MR;
  const PH = H - MT - MB;
  const allPoints = series.map((point) => ({
    id: point.id,
    evaluated_at: point.evaluated_at,
    score: point.score,
    potential: point.prs.axisValues.P,
    reach: point.prs.components?.reach ?? null,
    survival: point.prs.components?.survival ?? null,
    rNet: point.prs.axisValues.R_net,
    kind: point.evaluated_at === latestEvaluatedAt ? "current" as const : "saved" as const,
  }));

  if (allPoints.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">PRS history</div>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          PRS primary は {missingAxes.join(" / ") || "P / R_net"} 入力待ち。score を出さずに止めてる。
        </div>
      </div>
    );
  }

  const ts = allPoints.map((p) => new Date(p.evaluated_at).getTime());
  const xMin = Math.min(...ts);
  const xMaxRaw = Math.max(...ts);
  const xRange = Math.max(1, xMaxRaw - xMin);
  const xMax = xMaxRaw + xRange * 0.05;
  const scoreValues = allPoints.map((p) => Math.max(1, p.score));
  const dataMin = Math.min(...scoreValues);
  const dataMax = Math.max(...scoreValues);
  const yMin = Math.max(0, Math.log10(dataMin) - 0.2);
  const yMax = Math.min(Math.log10(100_000), Math.log10(dataMax) + 0.2);
  const ySpan = Math.max(0.3, yMax - yMin);
  const yOf = (v: number) => MT + PH - (Math.max(yMin, Math.log10(Math.max(1, v))) - yMin) / ySpan * PH;
  const xOf = (t: number) => ML + ((t - xMin) / Math.max(1, xMax - xMin)) * PW;
  const path = allPoints
    .map((point, index) => {
      const x = xOf(new Date(point.evaluated_at).getTime());
      const y = yOf(point.score);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const guides = [30, 100, 300, 1000, 3000, 10000, 30000, 100000].filter((guide) => {
    const log = Math.log10(guide);
    return log >= yMin && log <= yMax;
  });

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 border-b border-slate-200 pb-2 text-[11px] text-slate-600">
        <span className="font-bold tracking-wide text-slate-900">PRS primary history</span>
        <span className="text-[10px] text-slate-400">クリックで詳細</span>
        {active && (
          <button
            type="button"
            onClick={() => setActive(null)}
            className="ml-auto rounded-md border border-slate-300 px-2 py-0.5 text-[9px] text-slate-600 hover:bg-slate-50"
          >
            閉じる
          </button>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="relative w-full h-auto">
        {amdSupport.startedAt && (() => {
          const x1 = xOf(new Date(amdSupport.startedAt).getTime());
          const endIso = amdSupport.endedAt ?? new Date().toISOString().slice(0, 10);
          const x2 = xOf(new Date(endIso).getTime());
          const left = Math.max(ML, Math.min(x1, x2));
          const right = Math.min(W - MR, Math.max(x1, x2));
          if (right <= left) return null;
          return (
            <g>
              <rect x={left} y={MT} width={right - left} height={PH} fill="#ec4899" fillOpacity={0.085} />
              <line x1={x1} y1={MT} x2={x1} y2={MT + PH} stroke="#ec4899" strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
              {amdSupport.endedAt && (
                <line x1={x2} y1={MT} x2={x2} y2={MT + PH} stroke="#ec4899" strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
              )}
            </g>
          );
        })()}
        {guides.map((guide) => (
          <g key={guide}>
            <line x1={ML} x2={W - MR} y1={yOf(guide)} y2={yOf(guide)} stroke="rgba(16,185,129,0.18)" strokeDasharray="2 2" strokeWidth={0.5} />
            <text x={ML - 6} y={yOf(guide)} fontSize={7.5} textAnchor="end" dominantBaseline="middle" fill="rgba(71,85,105,0.72)">
              {formatRoundedDisplay(guide)}
            </text>
          </g>
        ))}
        <line x1={ML} y1={MT + PH} x2={W - MR} y2={MT + PH} stroke="rgba(148,163,184,0.45)" strokeWidth={0.6} />
        <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="rgba(148,163,184,0.45)" strokeWidth={0.6} />
        <path d={path} fill="none" stroke="#059669" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        {allPoints.map((point, index) => {
          const cx = xOf(new Date(point.evaluated_at).getTime());
          const cy = yOf(point.score);
          const isActive = active?.id === point.id;
          return (
            <g key={`${point.id}:${index}`}>
              <circle
                cx={cx}
                cy={cy}
                r={10}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onClick={() => setActive({ ...point, px: cx, py: cy })}
              />
              <circle
                cx={cx}
                cy={cy}
                r={isActive ? 6 : (point.kind === "current" ? 5 : 3.5)}
                fill={point.kind === "current" ? "#10b981" : "#34d399"}
                stroke={isActive ? "#ecfdf5" : "#064e3b"}
                strokeWidth={isActive ? 2 : 1}
                style={{ cursor: "pointer", transition: "r 100ms" }}
                onClick={() => setActive({ ...point, px: cx, py: cy })}
              />
            </g>
          );
        })}
        {allPoints.map((point, index) => (
          <text
            key={`${point.id}:x`}
            x={xOf(new Date(point.evaluated_at).getTime())}
            y={H - 10}
            fontSize={7.2}
            textAnchor="middle"
            fill="rgba(71,85,105,0.72)"
            transform={allPoints.length > 5 ? `rotate(-30 ${xOf(new Date(point.evaluated_at).getTime())},${H - 10})` : undefined}
          >
            {allPoints.length > 12 && index % 2 === 1 ? "" : point.evaluated_at}
          </text>
        ))}
      </svg>
      {latestPoint && (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-900">
          現在の主表示: <span className="font-mono font-semibold">{formatRoundedDisplay(latestPoint.score)}</span>
        </div>
      )}
      {active && <PrimaryPrsScorePopup point={active} chartW={W} chartH={H} onClose={() => setActive(null)} />}
    </div>
  );
}

function PrimaryPrsScorePopup({
  point,
  chartW,
  chartH,
  onClose,
}: {
  point: {
    id: string;
    evaluated_at: string;
    score: number;
    potential: number | null;
    reach: number | null;
    survival: number | null;
    rNet: number | null;
    px: number;
    py: number;
  };
  chartW: number;
  chartH: number;
  onClose: () => void;
}) {
  const leftPct = (point.px / chartW) * 100;
  const topPct = (point.py / chartH) * 100;
  const flipRight = leftPct > 65;
  const flipBottom = topPct > 55;
  return (
    <div
      className="absolute z-10 min-w-[220px] rounded-lg border border-slate-300 bg-white p-3 text-[11px] text-slate-800 shadow-lg"
      style={{
        left: flipRight ? "auto" : `calc(${leftPct}% + 12px)`,
        right: flipRight ? `calc(${100 - leftPct}% + 12px)` : "auto",
        top: flipBottom ? "auto" : `calc(${topPct}% + 12px)`,
        bottom: flipBottom ? `calc(${100 - topPct}% + 12px)` : "auto",
      }}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-mono text-[10px] text-slate-500">{point.evaluated_at}</span>
        <button type="button" onClick={onClose} className="text-[10px] text-slate-500 hover:text-slate-900" aria-label="閉じる">×</button>
      </div>
      <div className="text-[10px] text-slate-500">PRS primary</div>
      <div className="font-mono text-2xl font-bold leading-none text-slate-900">{formatRoundedDisplay(point.score)}</div>
      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-200 pt-2">
        <div>
          <div className="text-[9px] text-emerald-700">P</div>
          <div className="font-mono font-semibold text-slate-900">{formatRoundedDisplay(point.potential)}</div>
        </div>
        <div>
          <div className="text-[9px] text-amber-700">R_net</div>
          <div className="font-mono font-semibold text-slate-900">{formatRoundedDisplay(point.rNet)}</div>
        </div>
        <div>
          <div className="text-[9px] text-sky-700">R</div>
          <div className="font-mono font-semibold text-slate-900">{formatRoundedDisplay(point.reach)}</div>
        </div>
        <div>
          <div className="text-[9px] text-violet-700">S</div>
          <div className="font-mono font-semibold text-slate-900">{formatRoundedDisplay(point.survival)}</div>
        </div>
      </div>
    </div>
  );
}

interface ScoreBreakdown {
  M: number;
  X: number;
  F: number;
  sigma_su: number;
  K: number;
  bottleneck: AmdScoreAxis | "sigma_SU";
}

function TimeSeriesChart({
  series,
  latest,
  latestScore,
  latestBreakdown,
  amdSupport,
}: {
  series: { id: string; evaluated_at: string; score: number; breakdown: ScoreBreakdown }[];
  latest: string;
  latestScore: number;
  latestBreakdown: ScoreBreakdown;
  amdSupport: { startedAt: string | null; endedAt: string | null };
}) {
  const [active, setActive] = useState<{
    id: string;
    evaluated_at: string;
    score: number;
    breakdown: ScoreBreakdown;
    px: number;
    py: number;
  } | null>(null);
  const W = 640;
  const H = 178;
  const ML = 46;
  const MR = 14;
  const MT = 14;
  const MB = 30;
  const PW = W - ML - MR;
  const PH = H - MT - MB;

  // x 軸: 評価日 (一意)
  const allPoints = [
    ...series.map((p) => ({ ...p, kind: "saved" as const })),
    { id: "current", evaluated_at: latest, score: latestScore, breakdown: latestBreakdown, kind: "current" as const },
  ].sort((a, b) => a.evaluated_at.localeCompare(b.evaluated_at));

  if (allPoints.length === 0) {
    return (
      <div className="border border-cyan-300/24 bg-slate-950/80 p-3 text-[11px] text-cyan-100/62">
        経時データなし
      </div>
    );
  }

  const ts = allPoints.map((p) => new Date(p.evaluated_at).getTime());
  const xMin = Math.min(...ts);
  const xMaxRaw = Math.max(...ts);
  const xRange = Math.max(1, xMaxRaw - xMin);
  const xMax = xMaxRaw + xRange * 0.05;

  // y 軸: log scale。range は **プロットのある範囲だけ** にズーム (まさ 2026-05-12 指示)。
  // 旧固定 1-100k だと PJ 化前後の PJ で「ほぼ変化なし」に見えてしまう問題。
  // padding は log10 で上下 ±0.2 (= 約 ±60%) で見やすさ確保、1 を下限・100k を上限。
  const scoreValues = allPoints.map((p) => Math.max(1, p.score));
  const dataMin = Math.min(...scoreValues);
  const dataMax = Math.max(...scoreValues);
  const yMin = Math.max(0, Math.log10(dataMin) - 0.2);
  const yMax = Math.min(Math.log10(100_000), Math.log10(dataMax) + 0.2);
  // データが 1 点しかない or min==max のときに range=0 で divide-by-zero しないように
  const ySpan = Math.max(0.3, yMax - yMin);
  const yOf = (v: number) => MT + PH - (Math.max(yMin, Math.log10(Math.max(1, v))) - yMin) / ySpan * PH;
  const xOf = (t: number) => ML + ((t - xMin) / Math.max(1, xMax - xMin)) * PW;

  const path = allPoints
    .map((p, i) => {
      const x = xOf(new Date(p.evaluated_at).getTime());
      const y = yOf(p.score);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // phase guides は動的 y 範囲内に入るものだけ表示 (= 旧固定 1-100k 範囲ガイドが range 外で潰れる対策)
  const phaseGuides = [30, 100, 300, 1000, 3000, 10000, 30000, 100000].filter((g) => {
    const lg = Math.log10(g);
    return lg >= yMin && lg <= yMax;
  });

  return (
    <div className="relative h-full min-h-[278px] overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="relative mb-2 flex items-center gap-2 border-b border-slate-200 pb-2 text-[11px] text-slate-600">
        <span className="font-bold tracking-wide text-slate-900">Legacy AMD 経時比較</span>
        <span className="text-[10px] text-slate-400">クリックで詳細</span>
        {active && (
          <button
            type="button"
            onClick={() => setActive(null)}
            className="ml-auto rounded-md border border-slate-300 px-2 py-0.5 text-[9px] text-slate-600 hover:bg-slate-50"
          >
            閉じる
          </button>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="relative w-full h-auto">
        <defs>
          <filter id="amd-score-detail-glow" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="amd-score-detail-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.26" />
            <stop offset="72%" stopColor="#22d3ee" stopOpacity="0.035" />
            <stop offset="100%" stopColor="#020817" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* AMD 支援期間の背景帯 */}
        {amdSupport.startedAt && (() => {
          const x1 = xOf(new Date(amdSupport.startedAt).getTime());
          const endIso = amdSupport.endedAt ?? new Date().toISOString().slice(0, 10);
          const x2 = xOf(new Date(endIso).getTime());
          const left = Math.max(ML, Math.min(x1, x2));
          const right = Math.min(W - MR, Math.max(x1, x2));
          if (right <= left) return null;
          return (
            <g>
              <rect x={left} y={MT} width={right - left} height={PH} fill="#ec4899" fillOpacity={0.085} />
              <line x1={x1} y1={MT} x2={x1} y2={MT + PH} stroke="#ec4899" strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
              {amdSupport.endedAt && (
                <line x1={x2} y1={MT} x2={x2} y2={MT + PH} stroke="#ec4899" strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
              )}
              <text x={(left + right) / 2} y={MT + 9} fontSize={7.5} fill="#f9a8d4" textAnchor="middle" opacity={0.85}>
                AMD 支援期間
              </text>
            </g>
          );
        })()}
        {/* phase guide lines */}
        {phaseGuides.map((g) => (
          <g key={g}>
            <line x1={ML} x2={W - MR} y1={yOf(g)} y2={yOf(g)} stroke="rgba(103,232,249,0.22)" strokeDasharray="2 2" strokeWidth={0.5} />
            <text x={ML - 6} y={yOf(g)} fontSize={7.5} textAnchor="end" dominantBaseline="middle" fill="rgba(186,230,253,0.64)">
              {formatRoundedDisplay(g)}
            </text>
          </g>
        ))}
        <line x1={ML} y1={MT + PH} x2={W - MR} y2={MT + PH} stroke="rgba(103,232,249,0.36)" strokeWidth={0.6} />
        <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="rgba(103,232,249,0.36)" strokeWidth={0.6} />

        <path d={`${path} L ${xOf(new Date(allPoints[allPoints.length - 1].evaluated_at).getTime()).toFixed(1)},${MT + PH} L ${xOf(new Date(allPoints[0].evaluated_at).getTime()).toFixed(1)},${MT + PH} Z`} fill="url(#amd-score-detail-fill)" />
        <path d={path} fill="none" stroke="#67e8f9" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" filter="url(#amd-score-detail-glow)" />
        <path d={path} fill="none" stroke="#f0f9ff" strokeWidth={0.55} strokeLinecap="round" strokeLinejoin="round" opacity={0.68} />
        {allPoints.map((p) => {
          const cx = xOf(new Date(p.evaluated_at).getTime());
          const cy = yOf(p.score);
          const isActive = active?.id === p.id;
          return (
            <g key={p.id}>
              {/* 透明 hit area (= clickable 範囲を広げる) */}
              <circle
                cx={cx}
                cy={cy}
                r={10}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onClick={() => setActive({ id: p.id, evaluated_at: p.evaluated_at, score: p.score, breakdown: p.breakdown, px: cx, py: cy })}
              />
              <circle
                cx={cx}
                cy={cy}
                r={isActive ? 6 : (p.kind === "current" ? 5 : 3.5)}
                fill={p.kind === "current" ? "#f472b6" : "#67e8f9"}
                stroke={isActive ? "#ecfeff" : "#020817"}
                strokeWidth={isActive ? 2 : 1}
                style={{ cursor: "pointer", transition: "r 100ms" }}
                onClick={() => setActive({ id: p.id, evaluated_at: p.evaluated_at, score: p.score, breakdown: p.breakdown, px: cx, py: cy })}
              />
            </g>
          );
        })}
        {/* x labels */}
        {allPoints.map((p, i) => (
          <text
            key={p.id + ":x"}
            x={xOf(new Date(p.evaluated_at).getTime())}
            y={H - 10}
            fontSize={7.2}
            textAnchor="middle"
            fill="rgba(186,230,253,0.62)"
            transform={
              allPoints.length > 5
                ? `rotate(-30 ${xOf(new Date(p.evaluated_at).getTime())},${H - 10})`
                : undefined
            }
          >
            {allPoints.length > 12 && i % 2 === 1 ? "" : p.evaluated_at}
          </text>
        ))}
      </svg>
      {active && (
        <ScorePopup
          point={active}
          chartW={W}
          chartH={H}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

function ScorePopup({
  point,
  chartW,
  chartH,
  onClose,
}: {
  point: {
    id: string;
    evaluated_at: string;
    score: number;
    breakdown: ScoreBreakdown;
    px: number;
    py: number;
  };
  chartW: number;
  chartH: number;
  onClose: () => void;
}) {
  // SVG 内座標 (px, py) → 親 div 内 % 座標に変換
  const leftPct = (point.px / chartW) * 100;
  const topPct = (point.py / chartH) * 100;
  // 右端だと右にはみ出るので flip
  const flipRight = leftPct > 65;
  const flipBottom = topPct > 55;
  return (
    <div
      className="absolute z-10 min-w-[220px] rounded-lg border border-slate-300 bg-white p-3 text-[11px] text-slate-800 shadow-lg"
      style={{
        left: flipRight ? "auto" : `calc(${leftPct}% + 12px)`,
        right: flipRight ? `calc(${100 - leftPct}% + 12px)` : "auto",
        top: flipBottom ? "auto" : `calc(${topPct}% + 12px)`,
        bottom: flipBottom ? `calc(${100 - topPct}% + 12px)` : "auto",
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[10px] text-slate-500">{point.evaluated_at}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] text-slate-500 hover:text-slate-900"
          aria-label="閉じる"
        >
          ×
        </button>
      </div>
      <div className="text-[10px] text-slate-500">Legacy AMD S</div>
      <div className="font-mono text-2xl font-bold text-slate-900 leading-none">
        {formatRoundedDisplay(point.score)}
      </div>
      <div className="text-[9px] text-slate-500 mt-0.5">
        律速: {AXIS_LABEL_JP[point.breakdown.bottleneck]}
      </div>
      <div className="border-t border-slate-200 mt-2 pt-2 grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-[9px] text-emerald-700">M (Macrotrend)</div>
          <div className="font-mono font-semibold text-slate-900">{formatRoundedDisplay(point.breakdown.M)}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-amber-700">X (XRL)</div>
          <div className="font-mono font-semibold text-slate-900">{formatRoundedDisplay(point.breakdown.X)}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-pink-700">F (FRL)</div>
          <div className="font-mono font-semibold text-slate-900">{formatRoundedDisplay(point.breakdown.F)}</div>
        </div>
      </div>
      <div className="text-[9px] text-slate-500 mt-2 leading-tight">
        S = k · M · X · F<br />
        k = {formatRoundedDisplay(point.breakdown.K)}, σ_SU = {formatRoundedDisplay(point.breakdown.sigma_su)}
      </div>
    </div>
  );
}

function PrimaryPrsHeroCard({
  venture,
  primary,
  onSave,
  saveState,
}: {
  venture: VentureRow;
  primary: ReturnType<typeof buildPrimaryScoreSnapshot>;
  onSave: (prsPotentialDraft: string, prsRNetDraft: string) => void;
  saveState: "idle" | "saving" | "done" | "error";
}) {
  const [prsPotentialDraft, setPrsPotentialDraft] = useState(
    primary.prs.axisValues.P != null ? String(primary.prs.axisValues.P) : ""
  );
  const [prsRNetDraft, setPrsRNetDraft] = useState(
    primary.prs.axisValues.R_net != null ? String(primary.prs.axisValues.R_net) : ""
  );
  const fmt = (value: number | null) => formatRoundedDisplay(value);
  const ready = primary.prs.status === "ready" && primary.prs.score != null;
  const missingText = primary.prs.missingAxes.length > 0 ? primary.prs.missingAxes.join(" / ") : "P / R_net";
  const potentialValue = primary.prs.axisValues.P;
  const rNetValue = primary.prs.axisValues.R_net;
  return (
    <section className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">PRS Primary</div>
          <div className="mt-1 text-4xl font-mono font-bold leading-none text-slate-950">
            {ready ? fmt(primary.prs.score) : "INPUT NEEDED"}
          </div>
          <div className="mt-2 text-[11px] text-slate-600">
            {ready
              ? "score = k × P × R × S を主表示。legacy AMD/MXF は比較用。"
              : `主モデルは PRS だけど、${missingText} が未入力なので score を出さず review 待ちで止めてる。`}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right text-[11px] text-slate-600">
          <div className="font-semibold text-slate-900">Legacy AMD comparison</div>
          <div className="mt-1 font-mono text-lg text-slate-900">{fmt(primary.legacy.score)}</div>
          <div className="mt-1">lane: <span className="font-mono">{venture.lane}</span></div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-slate-200 bg-emerald-50/40 px-4 py-3 text-[11px] leading-relaxed text-slate-700">
          <div className="font-semibold text-slate-900">Primary inputs</div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold">P Potential</span>
                <span className="font-mono text-slate-500">{prsPotentialDraft || "—"}</span>
              </div>
              <input
                type="number"
                min={0}
                max={9}
                step={0.5}
                value={prsPotentialDraft}
                onChange={(event) => setPrsPotentialDraft(event.target.value)}
                placeholder="0-9"
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="block">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold">R_net</span>
                <span className="font-mono text-slate-500">{prsRNetDraft || "—"}</span>
              </div>
              <input
                type="number"
                min={0}
                max={9}
                step={0.5}
                value={prsRNetDraft}
                onChange={(event) => setPrsRNetDraft(event.target.value)}
                placeholder="0-9"
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </label>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">
            最新の `amd_score_inputs` 行に保存する。NULL は 0 じゃなく review pending として扱う。
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSave(prsPotentialDraft, prsRNetDraft)}
              disabled={saveState === "saving"}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              {saveState === "saving" ? "保存中…" : "PRS 入力を保存"}
            </button>
            {saveState === "done" && <span className="text-[10px] text-emerald-700">保存済み。主表示を PRS で再計算したよ。</span>}
            {saveState === "error" && <span className="text-[10px] text-rose-700">保存に失敗した。認証か RLS を確認して。</span>}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-700">
          <div className="font-semibold text-slate-900">Primary breakdown</div>
          <div className="mt-2 space-y-1">
            <div>P = <span className="font-mono">{fmt(potentialValue)}</span></div>
            <div>R = <span className="font-mono">{primary.prs.components ? fmt(primary.prs.components.reach) : "—"}</span></div>
            <div>S = <span className="font-mono">{primary.prs.components ? fmt(primary.prs.components.survival) : "—"}</span></div>
            <div>R_net = <span className="font-mono">{fmt(rNetValue)}</span></div>
          </div>
          <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-500">
            legacy AMD = <span className="font-mono text-slate-800">{fmt(primary.legacy.score)}</span>
            {" · "}σ_SU = <span className="font-mono text-slate-800">{primary.legacy.sigma_SU.toFixed(2)}</span>
            {" · "}律速 = <span className="font-mono text-slate-800">{AXIS_LABEL_JP[primary.legacy.bottleneck]}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function parseNullablePrsValue(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

// ============================================================
// FRL Panel — Walumbwa et al. (2008) ALQ 4 次元 + Grit + Resilience + 自由備考
// ============================================================
const ALQ_AXES = [
  { key: "alq_self_awareness" as const, label: "自己認識", desc: "Self-awareness — 自分の強み・弱み・価値観の理解度" },
  { key: "alq_relational_transparency" as const, label: "関係透明性", desc: "Relational transparency — 本音と建前の一致、誠実性" },
  { key: "alq_balanced_processing" as const, label: "均衡的処理", desc: "Balanced processing — 反対意見も含めた客観評価" },
  { key: "alq_internalized_moral" as const, label: "道徳観", desc: "Internalized moral perspective — 倫理基準への一貫性" },
];

// まさ要望 2026-05-11: radar も 6 軸 (ALQ 4 + Grit + Resilience) で描く。
// 半径方向に向かう順に並べる: ALQ 4 軸を上半分に、起業特化 2 軸を下半分に。
const FRL_RADAR_AXES = [
  { key: "alq_self_awareness" as const,            label: "自己認識" },
  { key: "alq_relational_transparency" as const,   label: "関係透明性" },
  { key: "alq_balanced_processing" as const,       label: "均衡的処理" },
  { key: "alq_internalized_moral" as const,        label: "道徳観" },
  { key: "frl_grit" as const,                      label: "Grit 集中力" },
  { key: "frl_resilience" as const,                label: "Resilience タフさ" },
];

function FrlAlqPanel({
  editable,
  effectiveFrl,
  ventureName,
}: {
  editable: EditableInput;
  effectiveFrl: number;
  ventureName: string;
}) {
  const W = 320;
  const H = 300;
  const cx = W / 2;
  const cy = H / 2;
  const R = 90;
  // 6 軸 radar (= ALQ 4 + Grit + Resilience)
  const N = FRL_RADAR_AXES.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;

  // 2026-05-11 まさ指摘 4 番: 旧コードは null → 0 fallback で radar に「0.0」プロットしていた。
  // 結果として grit / resilience 未入力で「0 のように見える」誤認 (まさ「他4つは値あるのにこの2つだけ0」)。
  // null の場合はその軸の点を中心 (= 「未入力」) ではなく、value=null を残してプロットから除外する。
  const points = FRL_RADAR_AXES.map((a, i) => {
    const raw = editable[a.key] as number | null;
    const hasValue = typeof raw === "number" && !Number.isNaN(raw);
    const v = hasValue ? (raw as number) : 0;
    const r = (Math.max(0, Math.min(9, v)) / 9) * R;
    return {
      ...a,
      value: hasValue ? (raw as number) : null,
      hasValue,
      x: cx + r * Math.cos(angle(i)),
      y: cy + r * Math.sin(angle(i)),
    };
  });
  const grid = [0.25, 0.5, 0.75, 1.0];
  const derived = deriveFrl(editable);

  return (
    <div className="border border-[#e5e5e7] rounded-xl p-4 bg-white">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-[12px] font-semibold">FRL — Founder Readiness Level (6 因子)</div>
          <div className="text-[10px] text-muted-foreground">
            ALQ 4 次元 (Walumbwa 2008) + Grit (Duckworth 2007) + Resilience (Markman 2005)。
            自動算出モード: <span className="font-mono">FRL = 0.6·ALQ_avg + 0.2·Grit + 0.2·Resilience</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground">現在の FRL</div>
          <div className="text-2xl font-mono font-bold text-red-600">{effectiveFrl.toFixed(1)}</div>
          {editable.alq_auto_derive_frl && derived != null && (
            <div className="text-[9px] text-muted-foreground">6 因子推定: {derived.toFixed(1)}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3 mt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {grid.map((g, gi) => (
            <polygon
              key={gi}
              points={FRL_RADAR_AXES.map((_, i) => {
                const x = cx + g * R * Math.cos(angle(i));
                const y = cy + g * R * Math.sin(angle(i));
                return `${x},${y}`;
              }).join(" ")}
              fill="none"
              stroke="#e5e5e7"
              strokeWidth={0.5}
            />
          ))}
          {FRL_RADAR_AXES.map((a, i) => {
            const x = cx + R * Math.cos(angle(i));
            const y = cy + R * Math.sin(angle(i));
            // 起業特化 2 軸 (Grit / Resilience) はラベルを少し離して描画 (= ALQ と視覚的に区別)
            const isExt = a.key === "frl_grit" || a.key === "frl_resilience";
            return (
              <g key={a.key}>
                <line x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e5e7" strokeWidth={0.5} />
                <text
                  x={cx + (R + 22) * Math.cos(angle(i))}
                  y={cy + (R + 22) * Math.sin(angle(i))}
                  fontSize={9.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isExt ? "#b45309" : "#475569"}
                  fontWeight={isExt ? 600 : 400}
                >
                  {a.label}
                </text>
              </g>
            );
          })}
          <polygon
            points={points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="rgba(220,38,38,0.18)"
            stroke="#dc2626"
            strokeWidth={1.5}
          />
          {points.map((p) => (
            <circle key={p.key} cx={p.x} cy={p.y} r={4} fill="#dc2626" />
          ))}
        </svg>

        <div className="flex flex-col gap-2">
          {ALQ_AXES.map((a) => (
            <FrlAxisRow
              key={a.key}
              ventureName={ventureName}
              label={a.label}
              fieldName={a.label}
              value={(editable[a.key] as number | null) ?? null}
              desc={a.desc}
            />
          ))}
          <div className="border-t border-slate-200 pt-2 mt-2">
            <div className="text-[10.5px] font-semibold text-slate-700">追加因子 (起業特化、ALQ には含まれない)</div>
            <div className="text-[9px] text-muted-foreground italic mt-0.5">
              ALQ はオーセンティシティ特化。起業重要因子の Grit / Resilience を別軸で追加。
            </div>
          </div>
          <FrlAxisRow
            ventureName={ventureName}
            label="Grit (集中力)"
            fieldName="Grit (集中力)"
            value={editable.frl_grit}
            desc="Duckworth et al. (2007) — 長期目標への passion + perseverance"
          />
          <FrlAxisRow
            ventureName={ventureName}
            label="Resilience (タフさ)"
            fieldName="Resilience (タフさ)"
            value={editable.frl_resilience}
            desc="Markman et al. (2005) — VC 拒絶等の失敗からの回復力"
          />
          {/* 2026-05-11 まさ指摘 5 番: 「FRL (合計)」表示を削除。
              現在の FRL は右上に大きく表示してるので冗長 + 「合計」というラベルが計算式と矛盾していた。 */}
          <FactorClickable
            label="FRL 自由備考"
            ventureName={ventureName}
            fieldName="FRL 自由備考"
            value={editable.frl_notes || "（未入力）"}
            currentNote={editable.frl_notes || null}
          />
        </div>
      </div>

      <details className="mt-3 text-[10px] text-muted-foreground">
        <summary className="cursor-pointer text-slate-700">⚠ FRL の学術定義 — 6 因子で何をカバーし、何が残るか</summary>
        <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-[10.5px] leading-relaxed">
          本実装は <strong>ALQ 4 次元 (Walumbwa 2008) + Grit (Duckworth 2007) + Resilience (Markman 2005)</strong> の 6 因子。
          まさ実務直感「<em>オーセンティシティ + 集中力 + タフさ</em>」を学術ベースで操作化:
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            <li><strong>オーセンティシティ</strong> → ALQ 4 次元で既にカバー (Relational transparency = 「裏表がない」, Self-awareness = 「明確に自分を分かってる」)</li>
            <li><strong>集中力</strong> → Grit 因子 (Duckworth 2007) で別軸として追加。長期目標への passion + perseverance</li>
            <li><strong>タフさ</strong> → Resilience 因子 (Markman 2005) で別軸として追加。VC 拒絶等の失敗からの回復力</li>
          </ul>
          <p className="mt-2">それでも以下は本実装でも未カバー、運用で補う:</p>
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            <li><strong>外部評価データ</strong>: 投資家・顧客・取締役からの 360° フィードバック (自己申告には <em>self-bias</em> が乗る)</li>
            <li><strong>Founder Quality (Bernstein et al. 2017 JF)</strong>: チーム全体のクオリティ (CEO 単体ではない)、教育背景、過去 SU 経験</li>
            <li><strong>Founder Experience (Hsu 2007 RP)</strong>: 過去の起業経験、過去の VC 調達実績、過去の M&A/IPO 実績</li>
            <li><strong>Founder Network 効果 (Hsu 2007)</strong>: 魅力的な CEO は他軸 (技術/人材/資金) を引き上げる間接効果。FRL × 他軸の交差項として表現すべき</li>
            <li><strong>動的観測</strong>: 危機対応・ピボット時の意思決定スピード、ストレス下での倫理判断 (静的 questionnaire では取れない)</li>
          </ul>
          <p className="mt-2">
            上記の未カバー項目は <em>FRL 自由備考</em> 欄で補う運用。学術論文化する時は 360° フィードバックとアウトカム指標
            (調達額・ピボット成功率) との相関分析が必要。
          </p>
        </div>
      </details>
    </div>
  );
}


// ============================================================
// FRL 6 因子の各行 — 値表示 + クリックで Tsukuyomi 起動
// ============================================================
function FrlAxisRow({
  ventureName,
  label,
  fieldName,
  value,
  desc,
  highlight = false,
}: {
  ventureName: string;
  label: string;
  fieldName: string;
  value: number | null;
  desc: string;
  highlight?: boolean;
}) {
  // 2026-05-11 まさ指摘 4 番: 旧コードは value=null を 0 に fallback して「0.0」と表示し、
  // バー幅も 0 で「他 4 つは値あるのに 2 つだけ 0」と誤認させる事故 (grit / resilience は
  // LLM 抽出 cron がまだ無く、手動入力前なら null が正しい状態)。null は「—」表示 + バー無し。
  const hasValue = typeof value === "number" && !Number.isNaN(value);
  const v = hasValue ? (value as number) : 0;
  return (
    <button
      type="button"
      onClick={() => openTsukuyomiPrefill(ventureName, fieldName, hasValue ? v.toFixed(1) : "未入力", null)}
      className="text-left grid grid-cols-[110px_1fr_44px] gap-x-2 items-center hover:bg-slate-50 rounded px-1 py-0.5"
      title={`クリックでつくよみに「${fieldName} を見直したい」と話す`}
    >
      <label
        className="text-[11px] cursor-pointer"
        style={highlight ? { color: "#dc2626", fontWeight: 600 } : undefined}
      >
        {label}
      </label>
      <div className="h-1.5 bg-slate-100 rounded relative overflow-hidden">
        {hasValue && (
          <div
            className="h-full rounded"
            style={{
              width: `${(v / 9) * 100}%`,
              backgroundColor: highlight ? "#dc2626" : "#94a3b8",
            }}
          />
        )}
      </div>
      <span className="font-mono text-[11px] text-right" style={!hasValue ? { color: "#94a3b8" } : undefined}>
        {hasValue ? v.toFixed(1) : "—"}
      </span>
      <div className="col-span-3 text-[9px] text-muted-foreground ml-[114px] -mt-0.5">{desc}</div>
    </button>
  );
}

/** 自由テキスト clickable 行 (FRL 自由備考など)。空のときはフォールバック表示で薄く。 */
function FactorClickable({
  label,
  ventureName,
  fieldName,
  value,
  currentNote,
}: {
  label: string;
  ventureName: string;
  fieldName: string;
  value: string;
  currentNote: string | null;
}) {
  const isFallback = !currentNote;
  const displayValue = currentNote && currentNote.length > 0 ? value : FALLBACK_NOTE;
  return (
    <button
      type="button"
      onClick={() => openTsukuyomiPrefill(ventureName, fieldName, "(自由記述)", currentNote)}
      className="text-left mt-1 px-2 py-1 rounded border border-dashed border-slate-200 hover:bg-slate-50"
      title={`クリックでつくよみに「${fieldName} を見直したい」と話す`}
    >
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-[11px] italic ${isFallback ? "text-slate-400" : "text-slate-700"}`}>{displayValue}</div>
    </button>
  );
}

/**
 * Tsukuyomi drawer を起動 + prefill メッセージを送り込む。
 * window event を使うので、Mascot/Drawer がページに常駐している必要がある (global layout で常駐済)。
 *
 * 使用例:
 *   <button onClick={() => openTsukuyomiPrefill("CX", "μ_A (学術)", "7.0", "現在の根拠テキスト")}>
 */
export function openTsukuyomiPrefill(
  ventureName: string,
  fieldName: string,
  currentValue: string,
  currentNote: string | null
) {
  const noteLine =
    currentNote && currentNote.length > 0
      ? `現在の根拠: ${currentNote}`
      : "現在の根拠: （未入力）";
  const message =
    `PJ ${ventureName} の ${fieldName} = ${currentValue} の評価を見直したい。\n` +
    `${noteLine}\n` +
    `\n` +
    `（私のコメント: 例「論文 N 件しかないから 5 にして」「もう少し根拠を詳しく」など）`;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("tsukuyomi:open", { detail: { message } }));
  }
}
