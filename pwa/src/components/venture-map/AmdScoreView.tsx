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
import { useMemo, useState, type ReactNode } from "react";
import { Tex } from "@/components/venture-map/Tex";
import {
  AXIS_COLOR,
  AXIS_LABEL_JP,
  // PHASE_COLOR / PHASE_LABEL_JP は使用しない (検証データ蓄積後に復活検討、2026-05-09)
  calculateAmdScore,
  logScaleNormalize,
  type AlphaWeights,
  type AmdScoreAxis,
} from "@/lib/amd-score";
import type { AmdScoreInputRow } from "@/lib/amd-score-data";
import type { VentureRow, XrlLogRow } from "@/lib/venture-map-data";
import type { AtlasMacroSignals } from "@/lib/atlas-macro-signals";
import type { TripleHelixComputed } from "@/lib/triple-helix-observations";
import { TripleHelixMatrix } from "@/components/venture-map/TripleHelixMatrix";
import { AmdScoreFormulaPanel } from "@/components/venture-map/AmdScoreFormulaPanel";

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
}: Props) {
  // α は表示のみ (編集は retrofit ページへ移設)
  const alpha = initialAlpha;
  // 「最新」は今日以前の評価で最新を選ぶ (未来 retrofit 予想値を表示しないため)
  const today = new Date().toISOString().slice(0, 10);
  const latest = (() => {
    for (let i = inputs.length - 1; i >= 0; i--) {
      if (inputs[i].evaluated_at.slice(0, 10) <= today) return inputs[i];
    }
    return null;
  })();
  // editable は表示用に latest から固定 (setEditable しない、Tsukuyomi が DB を更新したら window reload で反映)
  const editable: EditableInput = latest ? rowToEditable(latest) : emptyEditable();
  const effectiveFrl = editable.alq_auto_derive_frl
    ? deriveFrl(editable) ?? editable.frl
    : editable.frl;

  const result = useMemo(() => {
    return calculateAmdScore(
      {
        mu_A: editable.mu_A,
        mu_I: editable.mu_I,
        mu_G: editable.mu_G,
        TRL: editable.shallow_tech_mode ? null : editable.trl ?? 0,
        BRL: editable.brl,
        GRL: editable.grl,
        SRL: editable.srl,
        HRL: editable.hrl,
        FRL: effectiveFrl,
      },
      alpha
    );
  }, [editable, alpha, effectiveFrl]);

  // ---- 経時データ ----
  const series = useMemo(() => {
    return inputs
      .filter((r) => r.mu_A != null && r.mu_I != null && r.mu_G != null)
      .map((r) => {
        const calc = calculateAmdScore(
          {
            mu_A: r.mu_A ?? 0,
            mu_I: r.mu_I ?? 0,
            mu_G: r.mu_G ?? 0,
            TRL: r.shallow_tech_mode ? null : r.trl ?? 0,
            BRL: r.brl ?? 0,
            GRL: r.grl ?? 0,
            SRL: r.srl ?? 0,
            HRL: r.hrl ?? 0,
            FRL: r.frl ?? 0,
          },
          alpha
        );
        // 各プロットの M / X / F 内訳 (popup 用)
        const xrlAxes: AmdScoreAxis[] = ["TRL", "BRL", "GRL", "SRL", "HRL"];
        const M = calc.contributions.sigma_SU ?? 1;
        let X = 1;
        for (const a of xrlAxes) {
          if (a === "TRL" && calc.shallowTechMode) continue;
          X *= calc.contributions[a] ?? 1;
        }
        const F = calc.contributions.FRL ?? 1;
        return {
          id: r.id,
          evaluated_at: r.evaluated_at.slice(0, 10),
          score: calc.score,
          breakdown: { M, X, F, sigma_su: calc.sigma_SU, K: calc.K, bottleneck: calc.bottleneck },
        };
      });
  }, [inputs, alpha]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6">
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <Link href="/venture-map/amd-score" className="text-xs text-cyan-700 hover:underline">← AMD Score 一覧</Link>
        <Link
          href={`/project/${venture.project_id}/cockpit`}
          className="text-xs text-cyan-700 hover:underline"
        >
          ↩ {venture.display_name} のコックピットに戻る
        </Link>
        <h1 className="text-xl font-semibold ml-2">{venture.display_name}</h1>
        <span className="text-xs text-muted-foreground">AMD Score</span>
        <Link
          href="/venture-map/amd-score/retrofit"
          className="ml-auto text-[11px] px-3 py-1 rounded bg-slate-900 text-white hover:bg-slate-800"
        >
          α 重みを retrofit で調整 →
        </Link>
      </div>

      <div className="text-[10.5px] text-slate-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4 leading-relaxed">
        💬 値の修正は <strong>Tsukuyomi 経由</strong>。各軸の値や根拠をクリックすると、その軸についてつくよみに話しかけられる
        (例: 「論文 N 件しかないから μ_A は 5 にして」など)。スライダーぽちぽち入力 UI は廃止 (まさ判断 2026-05-09)。
      </div>

      <div className="flex flex-col gap-4">
        <ScoreHeroCard result={result} venture={venture} />
        <BalanceBar result={result} alpha={alpha} />
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
        <TimeSeriesChart
          series={series}
          latest={editable.evaluated_at}
          latestScore={result.score}
          latestBreakdown={(() => {
            const xrlAxes: AmdScoreAxis[] = ["TRL", "BRL", "GRL", "SRL", "HRL"];
            const Mc = result.contributions.sigma_SU ?? 1;
            let Xc = 1;
            for (const a of xrlAxes) {
              if (a === "TRL" && result.shallowTechMode) continue;
              Xc *= result.contributions[a] ?? 1;
            }
            const Fc = result.contributions.FRL ?? 1;
            return { M: Mc, X: Xc, F: Fc, sigma_su: result.sigma_SU, K: result.K, bottleneck: result.bottleneck };
          })()}
          amdSupport={{
            startedAt: venture.amd_support_started_at ?? null,
            endedAt: venture.amd_support_ended_at ?? null,
          }}
        />
        <FrlAlqPanel editable={editable} effectiveFrl={effectiveFrl} ventureName={venture.display_name} />
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
  result: ReturnType<typeof calculateAmdScore>;
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
  // フェーズタブは検証データ蓄積後に復活検討のため非表示 (2026-05-09)。
  // スコア数値・bar は中立色 (slate-900) で固定表示。
  const scoreColor = "#0f172a";
  return (
    <div className="border border-[#e5e5e7] rounded-xl p-5 bg-white">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <div>
          <div className="text-[11px] text-muted-foreground">AMD Score</div>
          <div className="text-4xl font-mono font-bold" style={{ color: scoreColor }}>
            {result.score < 1 ? result.score.toFixed(2) : Math.round(result.score).toLocaleString()}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground">
            律速: <span className="font-mono">{AXIS_LABEL_JP[result.bottleneck]}</span>
          </div>
          {result.shallowTechMode && (
            <div className="text-[10px] text-amber-700 mt-1">Shallow Tech モード</div>
          )}
        </div>
      </div>

      {/* log scale バー (1k-50k focus、< 1k と > 50k は飽和) */}
      <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full"
          style={{ width: `${norm * 100}%`, backgroundColor: scoreColor, transition: "width 200ms" }}
        />
        {/* 設立 GO 閾値 (3,500) のマーカー */}
        {(() => {
          const lo = Math.log10(1000);
          const hi = Math.log10(50000);
          const goPct = ((Math.log10(3500) - lo) / (hi - lo)) * 100;
          return (
            <div
              className="absolute top-[-2px] h-3 w-px bg-amber-500"
              style={{ left: `${goPct}%` }}
              title="設立 GO 閾値 = 3,500"
            />
          );
        })()}
      </div>
      <div className="relative mt-1 text-[9px] text-muted-foreground font-mono h-3">
        <span className="absolute" style={{ left: "0%" }}>1k</span>
        <span className="absolute" style={{ left: `${((Math.log10(3500) - Math.log10(1000)) / (Math.log10(50000) - Math.log10(1000))) * 100}%`, transform: "translateX(-50%)" }}>3.5k</span>
        <span className="absolute" style={{ left: `${((Math.log10(15000) - Math.log10(1000)) / (Math.log10(50000) - Math.log10(1000))) * 100}%`, transform: "translateX(-50%)" }}>15k</span>
        <span className="absolute right-0">50k</span>
      </div>

      <div className="mt-3 text-[11px] text-muted-foreground flex flex-wrap items-center gap-2">
        <span>K = {result.K.toFixed(4)}</span>
        <span className="text-slate-400">|</span>
        <span>Σα = {result.alphaSum.toFixed(2)}</span>
        <span className="text-slate-400">|</span>
        <span>σ_SU = {result.sigma_SU.toFixed(2)}</span>
        <span className="text-slate-400">|</span>
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
// 軸値は 0-9 にクリップされてるので 100% を超えることは無い。
// 寄与度シェアと違って各要素を独立に「埋まり具合」で見るため、
// α が大きい軸が常に大きく見える歪みは出ない。
//
function BalanceBar({
  result,
  alpha,
}: {
  result: ReturnType<typeof calculateAmdScore>;
  alpha: AlphaWeights;
}) {
  const M = result.contributions.sigma_SU ?? 1;
  let X = 1;
  for (const a of ["TRL", "BRL", "GRL", "SRL", "HRL"] as AmdScoreAxis[]) {
    if (a === "TRL" && result.shallowTechMode) continue;
    X *= result.contributions[a] ?? 1;
  }
  const F = result.contributions.FRL ?? 1;
  const Mmax = Math.pow(10, alpha.sigma_SU);
  const xrlAxes: AmdScoreAxis[] = ["TRL", "BRL", "GRL", "SRL", "HRL"];
  const Xalpha = xrlAxes
    .filter((a) => !(a === "TRL" && result.shallowTechMode))
    .reduce((s, a) => s + alpha[a], 0);
  const Xmax = Math.pow(10, Xalpha);
  const Fmax = Math.pow(10, alpha.FRL);

  return (
    <div className="border border-[#e5e5e7] rounded-xl p-4 bg-white">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[12px] font-semibold">3 要素のバランス</div>
        <div className="text-[10px] text-muted-foreground">
          各要素を「全軸 9 (= IPO 級) max」に対する達成率で表示
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <BalanceBarRow
          label="M (マクロ)"
          value={M}
          max={Mmax}
          color={AXIS_COLOR.sigma_SU}
          bottleneck={result.bottleneck === "sigma_SU"}
        />
        <BalanceBarRow
          label="X (会社の XRL)"
          value={X}
          max={Xmax}
          color={AXIS_COLOR.TRL}
          bottleneck={(["TRL", "BRL", "GRL", "SRL", "HRL"] as AmdScoreAxis[]).includes(result.bottleneck)}
        />
        <BalanceBarRow
          label="F (CEO の FRL)"
          value={F}
          max={Fmax}
          color={AXIS_COLOR.FRL}
          bottleneck={result.bottleneck === "FRL"}
        />
      </div>
    </div>
  );
}

function BalanceBarRow({
  label,
  value,
  max,
  color,
  bottleneck,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  bottleneck: boolean;
}) {
  const pct = Math.min(1, value / max);
  return (
    <div className="grid grid-cols-[140px_1fr_180px] gap-3 items-center">
      <div className="text-[11px]" style={{ color }}>
        {label}
        {bottleneck && <span className="ml-1 text-[9px] text-red-600 font-semibold">律速</span>}
      </div>
      <div className="relative h-4 bg-slate-100 rounded overflow-hidden">
        <div
          className="h-full rounded"
          style={{ width: `${pct * 100}%`, backgroundColor: color, transition: "width 200ms" }}
        />
      </div>
      <div className="text-right text-[10px] font-mono text-muted-foreground">
        {value < 100 ? value.toFixed(2) : Math.round(value).toLocaleString()} /{" "}
        {max < 100 ? max.toFixed(2) : Math.round(max).toLocaleString()} (
        {(pct * 100).toFixed(0)}%)
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
        Before Zero Theory v3.2 — <strong>マクロ M</strong> × <strong>会社の XRL X</strong> ×{" "}
        <strong>CEO の FRL F</strong> の 3 大要素を Cobb-Douglas で統合。
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
          ① マクロ M (外部環境 / Triple Helix: 学術 μ_A × 産業 μ_I × 政府 μ_G)
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
          ② 会社の XRL X (会社に帰属する 5 軸 readiness、内閣府 SIP 互換)
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
          ③ CEO の FRL F (個人に帰属する CEO リーダーシップ / 6 因子 = ALQ 4 + Grit + Resilience)
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
  result: ReturnType<typeof calculateAmdScore>;
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
        ja="マクロ"
        sub="外部環境 / Triple Helix 観測モデル"
        value={M}
        color={AXIS_COLOR.sigma_SU}
        formula={<Tex tex={String.raw`M = (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}`} />}
        bottleneck={result.bottleneck === "sigma_SU"}
      >
        {/* Triple Helix 観測モデル: 6 観測量 × 3 隠れ状態 (μ_A/I/G) の C 行列を表示 */}
        <TripleHelixMatrix helix={tripleHelix} alphaSigma={alpha.sigma_SU} />

        {/* 入力 notes (人間が Tsukuyomi 経由で投入した値の根拠) があれば併記 */}
        {(editable.mu_notes_a || editable.mu_notes_i || editable.mu_notes_g) && (
          <div className="mt-3 rounded-md border border-cyan-200 bg-cyan-50/50 p-2 text-[11px] dark:border-cyan-800 dark:bg-cyan-950/30">
            <div className="font-medium text-cyan-900 dark:text-cyan-200">人間入力 notes (Tsukuyomi 経由)</div>
            {editable.mu_notes_a && (
              <button
                type="button"
                onClick={() => openTsukuyomiPrefill(ventureName, "μ_A (学術)", fmt(editable.mu_A, 1), editable.mu_notes_a || null)}
                className="mt-1 block w-full text-left text-cyan-800 hover:underline dark:text-cyan-200"
              >
                <span className="font-mono text-emerald-700 dark:text-emerald-400">μ_A:</span> {editable.mu_notes_a}
              </button>
            )}
            {editable.mu_notes_i && (
              <button
                type="button"
                onClick={() => openTsukuyomiPrefill(ventureName, "μ_I (産業)", fmt(editable.mu_I, 1), editable.mu_notes_i || null)}
                className="mt-1 block w-full text-left text-cyan-800 hover:underline dark:text-cyan-200"
              >
                <span className="font-mono text-amber-700 dark:text-amber-400">μ_I:</span> {editable.mu_notes_i}
              </button>
            )}
            {editable.mu_notes_g && (
              <button
                type="button"
                onClick={() => openTsukuyomiPrefill(ventureName, "μ_G (政府)", fmt(editable.mu_G, 1), editable.mu_notes_g || null)}
                className="mt-1 block w-full text-left text-cyan-800 hover:underline dark:text-cyan-200"
              >
                <span className="font-mono text-indigo-700 dark:text-indigo-400">μ_G:</span> {editable.mu_notes_g}
              </button>
            )}
          </div>
        )}
      </DetailFactorCard>

      <DetailFactorCard
        label="X"
        ja="会社の XRL"
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
        ja="CEO の FRL"
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
      className="border rounded-xl p-4 bg-white"
      style={{
        borderColor: bottleneck ? "#fca5a5" : "#e5e5e7",
        backgroundColor: bottleneck ? "#fef2f2" : "#ffffff",
      }}
    >
      <div className="flex items-baseline justify-between mb-1">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-mono font-bold" style={{ color }}>
            {label}
          </span>
          <span className="text-[13px] font-semibold">{ja}</span>
          {bottleneck && (
            <span className="text-[10px] text-red-600 font-semibold">律速</span>
          )}
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
  const bg = bottleneck ? "#fee2e2" : highlight ? "#f5f3ff" : total ? "#ecfdf5" : undefined;
  const fontWeight = total ? 600 : 400;
  const isClickable = !!onClick;
  return (
    <tr
      className={`border-b border-[#f1f5f9]${isClickable ? " hover:bg-slate-50 cursor-pointer" : ""}`}
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
  const W = 800;
  const H = 220;
  const ML = 56;
  const MR = 16;
  const MT = 16;
  const MB = 36;
  const PW = W - ML - MR;
  const PH = H - MT - MB;

  // x 軸: 評価日 (一意)
  const allPoints = [
    ...series.map((p) => ({ ...p, kind: "saved" as const })),
    { id: "current", evaluated_at: latest, score: latestScore, breakdown: latestBreakdown, kind: "current" as const },
  ].sort((a, b) => a.evaluated_at.localeCompare(b.evaluated_at));

  if (allPoints.length === 0) {
    return (
      <div className="border border-[#e5e5e7] rounded-xl p-4 bg-white text-[11px] text-muted-foreground">
        経時データなし
      </div>
    );
  }

  const ts = allPoints.map((p) => new Date(p.evaluated_at).getTime());
  const xMin = Math.min(...ts);
  const xMaxRaw = Math.max(...ts);
  const xRange = Math.max(1, xMaxRaw - xMin);
  const xMax = xMaxRaw + xRange * 0.05;

  // y 軸: log scale (1 → 100,000)
  const yMin = Math.log10(1);
  const yMax = Math.log10(100_000);
  const yOf = (v: number) => MT + PH - (Math.max(0, Math.log10(Math.max(1, v))) - yMin) / (yMax - yMin) * PH;
  const xOf = (t: number) => ML + ((t - xMin) / Math.max(1, xMax - xMin)) * PW;

  const path = allPoints
    .map((p, i) => {
      const x = xOf(new Date(p.evaluated_at).getTime());
      const y = yOf(p.score);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const phaseGuides = [30, 300, 1500, 3500, 15000, 50000];

  return (
    <div className="border border-[#e5e5e7] rounded-xl p-3 bg-white relative">
      <div className="text-[11px] text-muted-foreground mb-1 flex items-center gap-2">
        <span>AMD Score 経時 (log scale)</span>
        <span className="text-[9px] text-slate-400">プロットをクリックで内訳ポップアップ</span>
        {active && (
          <button
            type="button"
            onClick={() => setActive(null)}
            className="ml-auto text-[9px] text-cyan-700 hover:underline"
          >
            ポップアップを閉じる
          </button>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
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
              <rect x={left} y={MT} width={right - left} height={PH} fill="#ec4899" fillOpacity={0.07} />
              <line x1={x1} y1={MT} x2={x1} y2={MT + PH} stroke="#ec4899" strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
              {amdSupport.endedAt && (
                <line x1={x2} y1={MT} x2={x2} y2={MT + PH} stroke="#ec4899" strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
              )}
              <text x={(left + right) / 2} y={MT + 10} fontSize={9} fill="#be185d" textAnchor="middle" opacity={0.85}>
                AMD 支援期間
              </text>
            </g>
          );
        })()}
        {/* phase guide lines */}
        {phaseGuides.map((g) => (
          <g key={g}>
            <line x1={ML} x2={W - MR} y1={yOf(g)} y2={yOf(g)} stroke="#e5e5e7" strokeDasharray="2 2" strokeWidth={0.5} />
            <text x={ML - 6} y={yOf(g)} fontSize={9} textAnchor="end" dominantBaseline="middle" fill="#94a3b8">
              {g >= 1000 ? `${g / 1000}k` : g}
            </text>
          </g>
        ))}
        <line x1={ML} y1={MT + PH} x2={W - MR} y2={MT + PH} stroke="#475569" strokeWidth={0.5} />
        <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="#475569" strokeWidth={0.5} />

        <path d={path} fill="none" stroke="#7c3aed" strokeWidth={1.5} />
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
                r={12}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onClick={() => setActive({ id: p.id, evaluated_at: p.evaluated_at, score: p.score, breakdown: p.breakdown, px: cx, py: cy })}
              />
              <circle
                cx={cx}
                cy={cy}
                r={isActive ? 7 : (p.kind === "current" ? 6 : 4)}
                fill={p.kind === "current" ? "#dc2626" : "#7c3aed"}
                stroke={isActive ? "#0f172a" : "white"}
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
            fontSize={9}
            textAnchor="middle"
            fill="#475569"
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
  const fmt = (n: number) =>
    n < 1 ? n.toFixed(3) : n < 100 ? n.toFixed(2) : Math.round(n).toLocaleString();
  return (
    <div
      className="absolute z-10 rounded-lg border border-slate-300 bg-white shadow-lg p-3 text-[11px] min-w-[220px]"
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
          className="text-[10px] text-slate-400 hover:text-slate-700"
          aria-label="閉じる"
        >
          ×
        </button>
      </div>
      <div className="text-[10px] text-slate-500">AMD Score S</div>
      <div className="font-mono text-2xl font-bold text-slate-900 leading-none">
        {fmt(point.score)}
      </div>
      <div className="text-[9px] text-slate-400 mt-0.5">
        律速: {AXIS_LABEL_JP[point.breakdown.bottleneck]}
      </div>
      <div className="border-t border-slate-200 mt-2 pt-2 grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-[9px] text-emerald-700">M (マクロ)</div>
          <div className="font-mono font-semibold text-slate-900">{fmt(point.breakdown.M)}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-amber-700">X (XRL)</div>
          <div className="font-mono font-semibold text-slate-900">{fmt(point.breakdown.X)}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-indigo-700">F (FRL)</div>
          <div className="font-mono font-semibold text-slate-900">{fmt(point.breakdown.F)}</div>
        </div>
      </div>
      <div className="text-[9px] text-slate-500 mt-2 leading-tight">
        S = k · M · X · F<br />
        k = {fmt(point.breakdown.K)}, σ_SU = {fmt(point.breakdown.sigma_su)}
      </div>
    </div>
  );
}

// ============================================================
// FRL ALQ Panel — Walumbwa et al. (2008) ALQ 4 次元 + 自由備考
// ============================================================
const ALQ_AXES = [
  { key: "alq_self_awareness" as const, label: "自己認識", desc: "Self-awareness — 自分の強み・弱み・価値観の理解度" },
  { key: "alq_relational_transparency" as const, label: "関係透明性", desc: "Relational transparency — 本音と建前の一致、誠実性" },
  { key: "alq_balanced_processing" as const, label: "均衡的処理", desc: "Balanced processing — 反対意見も含めた客観評価" },
  { key: "alq_internalized_moral" as const, label: "道徳観", desc: "Internalized moral perspective — 倫理基準への一貫性" },
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
  const H = 280;
  const cx = W / 2;
  const cy = H / 2;
  const R = 90;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / 4;

  const points = ALQ_AXES.map((a, i) => {
    const v = (editable[a.key] as number | null) ?? 0;
    const r = (Math.max(0, Math.min(9, v)) / 9) * R;
    return { ...a, value: v, x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) };
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
            <div className="text-[9px] text-muted-foreground">6 因子から自動</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3 mt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {grid.map((g, gi) => (
            <polygon
              key={gi}
              points={ALQ_AXES.map((_, i) => {
                const x = cx + g * R * Math.cos(angle(i));
                const y = cy + g * R * Math.sin(angle(i));
                return `${x},${y}`;
              }).join(" ")}
              fill="none"
              stroke="#e5e5e7"
              strokeWidth={0.5}
            />
          ))}
          {ALQ_AXES.map((a, i) => {
            const x = cx + R * Math.cos(angle(i));
            const y = cy + R * Math.sin(angle(i));
            return (
              <g key={a.key}>
                <line x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e5e7" strokeWidth={0.5} />
                <text
                  x={cx + (R + 18) * Math.cos(angle(i))}
                  y={cy + (R + 18) * Math.sin(angle(i))}
                  fontSize={10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#475569"
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
          <div className="border-t border-slate-200 pt-2 mt-2">
            <FrlAxisRow
              ventureName={ventureName}
              label="FRL (合計)"
              fieldName="FRL"
              value={editable.frl}
              desc={editable.alq_auto_derive_frl ? "6 因子の重み付き平均で自動算出 (0.6·ALQ + 0.2·Grit + 0.2·Resilience)" : "手動値"}
              highlight
            />
          </div>
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
  const v = value ?? 0;
  return (
    <button
      type="button"
      onClick={() => openTsukuyomiPrefill(ventureName, fieldName, v.toFixed(1), null)}
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
        <div
          className="h-full rounded"
          style={{
            width: `${(v / 9) * 100}%`,
            backgroundColor: highlight ? "#dc2626" : "#94a3b8",
          }}
        />
      </div>
      <span className="font-mono text-[11px] text-right">{v.toFixed(1)}</span>
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
