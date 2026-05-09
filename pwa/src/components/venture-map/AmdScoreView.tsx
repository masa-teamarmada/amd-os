"use client";

/**
 * AMD Score 個別 PJ ビュー — Before Zero Theory v3.2 の 7 軸 Cobb-Douglas を可視化。
 *
 * 構成:
 *   - 大きな score 数値 (log scale バー)、phase バッジ、律速軸
 *   - 7 軸 Radar (現在値、律速軸赤強調)
 *   - 経時 line chart (y log scale)
 *   - 軸スライダー編集 (0-9, 0.5 刻み) + Shallow Tech 切替 + 保存
 *   - 寄与度テーブル
 *   - α 重み調整サイドバー (0.0-2.0, 0.1 刻み, K 自動再校正)
 *
 * 仕様: pwa/design_log/2026-05_amd_score.md
 */

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Tex } from "@/components/venture-map/Tex";
import {
  ALPHA_DEFAULT,
  AMD_SCORE_AXES,
  AXIS_COLOR,
  AXIS_LABEL_JP,
  // PHASE_COLOR / PHASE_LABEL_JP は使用しない (検証データ蓄積後に復活検討、2026-05-09)
  calculateAmdScore,
  computeK,
  computeSigmaSU,
  logScaleNormalize,
  sumAlpha,
  type AlphaWeights,
  type AmdScoreAxis,
} from "@/lib/amd-score";
import {
  saveNewAlpha,
  upsertAmdScoreInput,
  type AmdScoreInputRow,
} from "@/lib/amd-score-data";
import type { VentureRow } from "@/lib/venture-map-data";

interface Props {
  venture: VentureRow;
  inputs: AmdScoreInputRow[];     // 古い順
  initialAlpha: AlphaWeights;
}

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

export function AmdScoreView({ venture, inputs, initialAlpha }: Props) {
  const [alpha, setAlpha] = useState<AlphaWeights>(initialAlpha);
  const latest = inputs[inputs.length - 1];
  const [editable, setEditable] = useState<EditableInput>(
    latest ? rowToEditable(latest) : emptyEditable()
  );
  const [editingId, setEditingId] = useState<string | null>(latest?.id ?? null);
  const [savingInput, startSaveInput] = useTransition();
  const [savingAlpha, startSaveAlpha] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  // ---- 現在の編集値で score 計算 (FRL は ALQ auto-derive モードなら平均) ----
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

  // ---- 経時データ (DB 入力 + 計算結果) ----
  const series = useMemo(() => {
    return inputs
      .filter((r) => {
        return r.mu_A != null && r.mu_I != null && r.mu_G != null;
      })
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
        return { id: r.id, evaluated_at: r.evaluated_at.slice(0, 10), score: calc.score };
      });
  }, [inputs, alpha]);

  // ---- 編集値の保存 ----
  function onSaveInput() {
    setFeedback(null);
    startSaveInput(async () => {
      const finalFrl = editable.alq_auto_derive_frl
        ? deriveFrl(editable) ?? editable.frl
        : editable.frl;
      const saved = await upsertAmdScoreInput({
        id: editingId ?? undefined,
        project_id: venture.project_id,
        evaluated_at: editable.evaluated_at + "T00:00:00.000Z",
        mu_A: editable.mu_A,
        mu_I: editable.mu_I,
        mu_G: editable.mu_G,
        trl: editable.shallow_tech_mode ? null : editable.trl,
        brl: editable.brl,
        grl: editable.grl,
        srl: editable.srl,
        hrl: editable.hrl,
        frl: finalFrl,
        alq_self_awareness: editable.alq_self_awareness,
        alq_relational_transparency: editable.alq_relational_transparency,
        alq_balanced_processing: editable.alq_balanced_processing,
        alq_internalized_moral: editable.alq_internalized_moral,
        frl_grit: editable.frl_grit,
        frl_resilience: editable.frl_resilience,
        frl_notes: editable.frl_notes || null,
        mu_notes: {
          a: editable.mu_notes_a || null,
          i: editable.mu_notes_i || null,
          g: editable.mu_notes_g || null,
        },
        xrl_notes: {
          trl: editable.xrl_notes_trl || null,
          brl: editable.xrl_notes_brl || null,
          grl: editable.xrl_notes_grl || null,
          srl: editable.xrl_notes_srl || null,
          hrl: editable.xrl_notes_hrl || null,
        },
        shallow_tech_mode: editable.shallow_tech_mode,
        notes: editable.notes || null,
        evaluator: "amy",
      });
      if (saved) {
        setFeedback(`保存しました (${saved.evaluated_at.slice(0, 10)})`);
        setEditingId(saved.id);
        setTimeout(() => window.location.reload(), 600);
      } else {
        setFeedback("保存失敗。RLS / 認証を確認");
      }
    });
  }

  function onPickRow(r: AmdScoreInputRow) {
    setEditingId(r.id);
    setEditable(rowToEditable(r));
  }

  function onNewRow() {
    setEditingId(null);
    setEditable(emptyEditable());
  }

  function onSaveAlpha() {
    setFeedback(null);
    startSaveAlpha(async () => {
      const saved = await saveNewAlpha(alpha, "UI 編集 (AmdScoreView)");
      setFeedback(saved ? "重み α を保存しました" : "重み保存失敗");
    });
  }

  function onResetAlpha() {
    setAlpha({ ...ALPHA_DEFAULT });
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="flex flex-col gap-4">
          <ScoreHeroCard result={result} venture={venture} />
          <BalanceBar result={result} alpha={alpha} />
          <FormulaPanel alpha={alpha} />
          <Factor3Breakdown result={result} alpha={alpha} editable={editable} />
          <TimeSeriesChart
            series={series}
            latest={editable.evaluated_at}
            latestScore={result.score}
            amdSupport={{
              startedAt: venture.amd_support_started_at ?? null,
              endedAt: venture.amd_support_ended_at ?? null,
            }}
          />
          <InputEditor
            editable={editable}
            setEditable={setEditable}
            inputs={inputs}
            editingId={editingId}
            onPickRow={onPickRow}
            onNewRow={onNewRow}
            onSave={onSaveInput}
            saving={savingInput}
            sigmaSU={result.sigma_SU}
          />
          <FrlAlqPanel editable={editable} setEditable={setEditable} effectiveFrl={effectiveFrl} />
        </div>

        <AlphaSidebar
          alpha={alpha}
          setAlpha={setAlpha}
          onSave={onSaveAlpha}
          onReset={onResetAlpha}
          saving={savingAlpha}
          shallowTechMode={editable.shallow_tech_mode}
        />
      </div>

      {feedback && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white text-xs px-3 py-2 rounded shadow-lg z-50">
          {feedback}
        </div>
      )}
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
  const norm = logScaleNormalize(result.score);
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

      {/* log scale バー */}
      <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full"
          style={{ width: `${norm * 100}%`, backgroundColor: scoreColor, transition: "width 200ms" }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground font-mono mt-1">
        <span>1</span><span>30</span><span>300</span><span>1.5k</span><span>3.5k</span><span>15k</span><span>50k</span><span>100k</span>
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
// Formula Panel — 全体式 + 3 要素式 + 律速の経済学的根拠 (引用つき)
// ============================================================
function FormulaPanel({ alpha }: { alpha: AlphaWeights }) {
  void alpha; // alpha 一覧は将来表示用 (現在は static text)
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
      </div>
      <div className="bg-white rounded px-3 py-2 overflow-x-auto">
        <div className="text-[10px] text-muted-foreground mb-1">
          ① マクロ M (外部環境 / Triple Helix: 学術 μ_A × 産業 μ_I × 政府 μ_G)
        </div>
        <Tex
          display
          tex={String.raw`M \;=\; (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}, \quad \sigma_{\mathrm{SU}} \;=\; \sqrt[3]{(\mu_A+1)(\mu_I+1)(\mu_G+1)} - 1`}
        />
      </div>
      <div className="bg-white rounded px-3 py-2 overflow-x-auto">
        <div className="text-[10px] text-muted-foreground mb-1">
          ② 会社の XRL X (会社に帰属する 5 軸 readiness、内閣府 SIP 互換)
        </div>
        <Tex
          display
          tex={String.raw`X \;=\; \prod_{x \in \{\mathrm{TRL},\, \mathrm{BRL},\, \mathrm{GRL},\, \mathrm{SRL},\, \mathrm{HRL}\}} (x+1)^{\alpha_x}`}
        />
      </div>
      <div className="bg-white rounded px-3 py-2 overflow-x-auto">
        <div className="text-[10px] text-muted-foreground mb-1">
          ③ CEO の FRL F (個人に帰属する CEO リーダーシップ / ALQ + Grit + Resilience)
        </div>
        <Tex display tex={String.raw`F \;=\; (\mathrm{FRL}+1)^{\alpha_F}`} />
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
}: {
  result: ReturnType<typeof calculateAmdScore>;
  alpha: AlphaWeights;
  editable: EditableInput;
}) {
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
        sub="外部環境 / Triple Helix"
        value={M}
        color={AXIS_COLOR.sigma_SU}
        formula="M = (σ_SU+1)^α_σ"
        bottleneck={result.bottleneck === "sigma_SU"}
      >
        <DetailFactorRow name="μ_A (学術)" value={fmt(editable.mu_A, 1)} subtitle={editable.mu_notes_a || undefined} />
        <DetailFactorRow name="μ_I (産業)" value={fmt(editable.mu_I, 1)} subtitle={editable.mu_notes_i || undefined} />
        <DetailFactorRow name="μ_G (政府)" value={fmt(editable.mu_G, 1)} subtitle={editable.mu_notes_g || undefined} />
        <DetailFactorRow
          name="σ_SU = ∛((μ_A+1)(μ_I+1)(μ_G+1)) − 1"
          value={fmt(result.sigma_SU)}
          highlight
        />
        <DetailFactorRow
          name="= M = (σ_SU+1)^α_σ"
          value={fmt(M)}
          note={`α_σ = ${alpha.sigma_SU.toFixed(2)}`}
          total
        />
      </DetailFactorCard>

      <DetailFactorCard
        label="X"
        ja="会社の XRL"
        sub="会社に帰属する 5 軸 readiness"
        value={X}
        color={AXIS_COLOR.TRL}
        formula="X = ∏ (x+1)^α_x"
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
          return (
            <DetailFactorRow
              key={axis}
              name={`${axis} = ${fmt(rawValue, 1)}`}
              value={`(${fmt(rawValue, 1)}+1)^${alpha[axis].toFixed(2)} = ${fmt(contribution)}`}
              note={`α = ${alpha[axis].toFixed(2)}`}
              dotColor={AXIS_COLOR[axis]}
              bottleneck={result.bottleneck === axis}
              subtitle={noteKey || undefined}
            />
          );
        })}
        <DetailFactorRow name="= X = ∏ (x+1)^α_x" value={fmt(X)} total />
      </DetailFactorCard>

      <DetailFactorCard
        label="F"
        ja="CEO の FRL"
        sub="個人に帰属 / ALQ + Grit + Resilience"
        value={F}
        color={AXIS_COLOR.FRL}
        formula="F = (FRL+1)^α_F"
        bottleneck={result.bottleneck === "FRL"}
      >
        <DetailFactorRow
          name={`FRL = ${fmt(editable.frl, 1)}`}
          value={fmt(editable.frl, 1)}
          subtitle={editable.frl_notes || undefined}
        />
        <DetailFactorRow
          name="= F = (FRL+1)^α_F"
          value={fmt(F)}
          note={`α_F = ${alpha.FRL.toFixed(2)} (最大重み)`}
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
  formula: string;
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
      </div>
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
}: {
  name: string;
  value: string;
  note?: string;
  dotColor?: string;
  highlight?: boolean;
  total?: boolean;
  bottleneck?: boolean;
  subtitle?: string;
}) {
  const bg = bottleneck ? "#fee2e2" : highlight ? "#f5f3ff" : total ? "#ecfdf5" : undefined;
  const fontWeight = total ? 600 : 400;
  return (
    <tr className="border-b border-[#f1f5f9]" style={{ backgroundColor: bg, fontWeight }}>
      <td className="py-1 align-top">
        <div>
          {dotColor && <span style={{ color: dotColor }}>● </span>}
          {name}
          {bottleneck && <span className="ml-1 text-[9px] text-red-600">律速</span>}
        </div>
        {subtitle && (
          <div className="text-[9.5px] text-muted-foreground italic font-normal mt-0.5 leading-snug">
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
function TimeSeriesChart({
  series,
  latest,
  latestScore,
  amdSupport,
}: {
  series: { id: string; evaluated_at: string; score: number }[];
  latest: string;
  latestScore: number;
  amdSupport: { startedAt: string | null; endedAt: string | null };
}) {
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
    { id: "current", evaluated_at: latest, score: latestScore, kind: "current" as const },
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
    <div className="border border-[#e5e5e7] rounded-xl p-3 bg-white">
      <div className="text-[11px] text-muted-foreground mb-1">AMD Score 経時 (log scale)</div>
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
        {allPoints.map((p) => (
          <g key={p.id}>
            <circle
              cx={xOf(new Date(p.evaluated_at).getTime())}
              cy={yOf(p.score)}
              r={p.kind === "current" ? 6 : 4}
              fill={p.kind === "current" ? "#dc2626" : "#7c3aed"}
              stroke="white"
              strokeWidth={1}
            />
          </g>
        ))}
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
    </div>
  );
}

// ============================================================
// Input Editor (sliders + history list)
// ============================================================
function InputEditor({
  editable,
  setEditable,
  inputs,
  editingId,
  onPickRow,
  onNewRow,
  onSave,
  saving,
  sigmaSU,
}: {
  editable: EditableInput;
  setEditable: (e: EditableInput) => void;
  inputs: AmdScoreInputRow[];
  editingId: string | null;
  onPickRow: (r: AmdScoreInputRow) => void;
  onNewRow: () => void;
  onSave: () => void;
  saving: boolean;
  sigmaSU: number;
}) {
  return (
    <div className="border border-[#e5e5e7] rounded-xl p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[12px] font-semibold">入力編集</div>
          <div className="text-[10px] text-muted-foreground">
            μ_A / μ_I / μ_G から σ_SU が自動算出される。各軸 0-9 (0.5 刻み)。
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNewRow}
            className="text-[11px] px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
          >
            ＋ 新規評価時点
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="text-[11px] px-3 py-1 rounded bg-slate-900 text-white disabled:opacity-50"
          >
            {saving ? "保存中…" : editingId ? "上書き保存" : "新規保存"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        <div>
          <div className="text-[11px] text-muted-foreground mb-1">過去の評価時点</div>
          <ul className="text-[11px] divide-y divide-[#f1f5f9] max-h-[260px] overflow-y-auto border border-[#e5e5e7] rounded">
            {inputs.length === 0 && (
              <li className="px-2 py-2 text-muted-foreground">未登録</li>
            )}
            {[...inputs].reverse().map((r) => (
              <li
                key={r.id}
                className={`px-2 py-1 cursor-pointer hover:bg-slate-50 ${editingId === r.id ? "bg-cyan-50" : ""}`}
                onClick={() => onPickRow(r)}
              >
                <div className="font-mono">{r.evaluated_at.slice(0, 10)}</div>
                {r.notes && <div className="text-[10px] text-muted-foreground line-clamp-1">{r.notes}</div>}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2 items-center">
            <label className="text-[11px]">評価日</label>
            <input
              type="date"
              value={editable.evaluated_at}
              onChange={(e) => setEditable({ ...editable, evaluated_at: e.target.value })}
              className="border border-slate-300 rounded px-2 py-1 text-[11px] font-mono"
            />
          </div>

          <AxisSliderWithNote
            label="μ_A (学術)"
            value={editable.mu_A}
            onChange={(v) => setEditable({ ...editable, mu_A: v })}
            note={editable.mu_notes_a}
            onNoteChange={(v) => setEditable({ ...editable, mu_notes_a: v })}
            placeholder="例: Adv. Mater. 2024 で N 件論文急増、特許も成長"
          />
          <AxisSliderWithNote
            label="μ_I (産業)"
            value={editable.mu_I}
            onChange={(v) => setEditable({ ...editable, mu_I: v })}
            note={editable.mu_notes_i}
            onNoteChange={(v) => setEditable({ ...editable, mu_notes_i: v })}
            placeholder="例: 大手 N 社が研究開発投資を発表、SoC スピンアウト動向"
          />
          <AxisSliderWithNote
            label="μ_G (政府)"
            value={editable.mu_G}
            onChange={(v) => setEditable({ ...editable, mu_G: v })}
            note={editable.mu_notes_g}
            onNoteChange={(v) => setEditable({ ...editable, mu_notes_g: v })}
            placeholder="例: 内閣府 SIP 採択、補助金 X 億円規模"
          />
          <div className="text-[10px] text-muted-foreground -mt-1">
            → σ_SU = <span className="font-mono">{sigmaSU.toFixed(2)}</span> (自動算出)
          </div>

          <div className="border-t border-slate-200 my-1" />

          <label className="flex items-center gap-2 text-[11px]">
            <input
              type="checkbox"
              checked={editable.shallow_tech_mode}
              onChange={(e) => setEditable({
                ...editable,
                shallow_tech_mode: e.target.checked,
                trl: e.target.checked ? null : 0,
              })}
            />
            Shallow Tech モード (TRL 軸を除外)
          </label>

          {!editable.shallow_tech_mode && (
            <AxisSliderWithNote
              label="TRL"
              value={editable.trl ?? 0}
              onChange={(v) => setEditable({ ...editable, trl: v })}
              note={editable.xrl_notes_trl}
              onNoteChange={(v) => setEditable({ ...editable, xrl_notes_trl: v })}
              placeholder="例: ラボ試作完了 (TRL 4)、SIP 9 段階定義に対する位置づけ"
            />
          )}
          <AxisSliderWithNote
            label="BRL"
            value={editable.brl}
            onChange={(v) => setEditable({ ...editable, brl: v })}
            note={editable.xrl_notes_brl}
            onNoteChange={(v) => setEditable({ ...editable, xrl_notes_brl: v })}
            placeholder="例: 顧客仮説 N 件検証済、収益モデル draft 完成"
          />
          <AxisSliderWithNote
            label="GRL"
            value={editable.grl}
            onChange={(v) => setEditable({ ...editable, grl: v })}
            note={editable.xrl_notes_grl}
            onNoteChange={(v) => setEditable({ ...editable, xrl_notes_grl: v })}
            placeholder="例: 規制 X 法 適合性確認済、標準化検討開始"
          />
          <AxisSliderWithNote
            label="SRL"
            value={editable.srl}
            onChange={(v) => setEditable({ ...editable, srl: v })}
            note={editable.xrl_notes_srl}
            onNoteChange={(v) => setEditable({ ...editable, xrl_notes_srl: v })}
            placeholder="例: 一般消費者向け調査 N 件、メディア露出 N 件"
          />
          <AxisSliderWithNote
            label="HRL"
            value={editable.hrl}
            onChange={(v) => setEditable({ ...editable, hrl: v })}
            note={editable.xrl_notes_hrl}
            onNoteChange={(v) => setEditable({ ...editable, xrl_notes_hrl: v })}
            placeholder="例: コア人材 N 名、補完性カバー X / Y、欠員 Z 人"
          />
          <ScoreSlider label="FRL" value={editable.frl} onChange={(v) => setEditable({ ...editable, frl: v })} />

          <div>
            <label className="text-[11px] text-muted-foreground">備考</label>
            <textarea
              value={editable.notes}
              onChange={(e) => setEditable({ ...editable, notes: e.target.value })}
              className="w-full border border-slate-300 rounded px-2 py-1 text-[11px]"
              rows={2}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr_44px] gap-2 items-center">
      <label className="text-[11px]">{label}</label>
      <input
        type="range"
        min={0}
        max={9}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="font-mono text-[11px] text-right">{value.toFixed(1)}</span>
    </div>
  );
}

/** スライダー + 評価根拠の textarea を 1 セットで。値の根拠を必ず併記して保存できるように。 */
function AxisSliderWithNote({
  label,
  value,
  onChange,
  note,
  onNoteChange,
  placeholder,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  note: string;
  onNoteChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <ScoreSlider label={label} value={value} onChange={onChange} />
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder={placeholder ?? "評価根拠 (任意)"}
        className="w-full border border-slate-200 rounded px-2 py-1 text-[10px] text-slate-700 placeholder:text-slate-400 leading-snug"
        rows={2}
      />
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
  setEditable,
  effectiveFrl,
}: {
  editable: EditableInput;
  setEditable: (e: EditableInput) => void;
  effectiveFrl: number;
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
            <div key={a.key}>
              <div className="grid grid-cols-[110px_1fr_44px] gap-2 items-center">
                <label className="text-[11px]" title={a.desc}>{a.label}</label>
                <input
                  type="range"
                  min={0}
                  max={9}
                  step={0.5}
                  value={(editable[a.key] as number | null) ?? 0}
                  onChange={(e) => setEditable({ ...editable, [a.key]: Number(e.target.value) })}
                />
                <span className="font-mono text-[11px] text-right">{((editable[a.key] as number | null) ?? 0).toFixed(1)}</span>
              </div>
              <div className="text-[9px] text-muted-foreground ml-[110px]">{a.desc}</div>
            </div>
          ))}
          {/* Grit (Duckworth 2007) */}
          <div className="border-t border-slate-200 pt-2 mt-2">
            <div className="text-[10.5px] font-semibold text-slate-700">追加因子 (起業特化、ALQ には含まれない)</div>
            <div className="text-[9px] text-muted-foreground italic mt-0.5">
              ALQ はオーセンティシティ特化のため、起業重要因子の Grit / Resilience が抜ける。これらを別軸で追加。
            </div>
          </div>
          <div>
            <div className="grid grid-cols-[110px_1fr_44px] gap-2 items-center">
              <label className="text-[11px]" title="Grit — 脇目も振らず長期目標に邁進する集中力">Grit (集中力)</label>
              <input
                type="range"
                min={0}
                max={9}
                step={0.5}
                value={editable.frl_grit ?? 0}
                onChange={(e) => setEditable({ ...editable, frl_grit: Number(e.target.value) })}
              />
              <span className="font-mono text-[11px] text-right">{(editable.frl_grit ?? 0).toFixed(1)}</span>
            </div>
            <div className="text-[9px] text-muted-foreground ml-[110px]">
              Duckworth et al. (2007) — 長期目標への passion + perseverance、脇目を振らない
            </div>
          </div>
          <div>
            <div className="grid grid-cols-[110px_1fr_44px] gap-2 items-center">
              <label className="text-[11px]" title="Resilience — 失敗・拒絶からの回復、タフさ">Resilience (タフさ)</label>
              <input
                type="range"
                min={0}
                max={9}
                step={0.5}
                value={editable.frl_resilience ?? 0}
                onChange={(e) => setEditable({ ...editable, frl_resilience: Number(e.target.value) })}
              />
              <span className="font-mono text-[11px] text-right">{(editable.frl_resilience ?? 0).toFixed(1)}</span>
            </div>
            <div className="text-[9px] text-muted-foreground ml-[110px]">
              Markman et al. (2005) — VC 拒絶等の失敗からの回復力、打たれ強さ
            </div>
          </div>

          <label className="flex items-center gap-2 text-[11px] mt-2 border-t border-slate-200 pt-2">
            <input
              type="checkbox"
              checked={editable.alq_auto_derive_frl}
              onChange={(e) => setEditable({ ...editable, alq_auto_derive_frl: e.target.checked })}
            />
            FRL を 6 因子の重み付き平均から自動算出する (0.6·ALQ + 0.2·Grit + 0.2·Resilience)
          </label>
          {!editable.alq_auto_derive_frl && (
            <div className="grid grid-cols-[110px_1fr_44px] gap-2 items-center">
              <label className="text-[11px] text-red-600 font-semibold">FRL (手動)</label>
              <input
                type="range"
                min={0}
                max={9}
                step={0.5}
                value={editable.frl}
                onChange={(e) => setEditable({ ...editable, frl: Number(e.target.value) })}
              />
              <span className="font-mono text-[11px] text-right">{editable.frl.toFixed(1)}</span>
            </div>
          )}
          <div>
            <label className="text-[11px] text-muted-foreground">FRL 自由備考</label>
            <textarea
              value={editable.frl_notes}
              onChange={(e) => setEditable({ ...editable, frl_notes: e.target.value })}
              placeholder="ALQ 4 次元では拾えない要素 (チーム外の信頼度、過去 SU 経験、Founder Network、健康状態など)"
              className="w-full border border-slate-300 rounded px-2 py-1 text-[11px]"
              rows={3}
            />
          </div>
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
// Alpha Sidebar
// ============================================================
function AlphaSidebar({
  alpha,
  setAlpha,
  onSave,
  onReset,
  saving,
  shallowTechMode,
}: {
  alpha: AlphaWeights;
  setAlpha: (a: AlphaWeights) => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
  shallowTechMode: boolean;
}) {
  const sumActive = sumAlpha(alpha, !shallowTechMode);
  const K = computeK(alpha, shallowTechMode);
  const isModified = AMD_SCORE_AXES.some((a) => alpha[a] !== ALPHA_DEFAULT[a]);

  return (
    <aside className="border border-[#e5e5e7] rounded-xl p-4 bg-white h-fit lg:sticky lg:top-4">
      <div className="text-[12px] font-semibold mb-1">重み α (弾力性)</div>
      <div className="text-[10px] text-muted-foreground mb-3">
        各軸の <span className="font-mono">α_i</span> (0.0-2.0, 0.1 刻み)。
        合計が変わると <span className="font-mono">K = 100,000 / 10^Σα</span> で IPO 級に再校正。
      </div>

      <div className="flex flex-col gap-2 mb-3">
        {AMD_SCORE_AXES.map((axis) => (
          <div key={axis} className="grid grid-cols-[88px_1fr_36px] gap-2 items-center">
            <label className="text-[10px]" style={{ color: AXIS_COLOR[axis] }}>
              {axis === "sigma_SU" ? "σ_SU" : axis}
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={alpha[axis]}
              onChange={(e) => setAlpha({ ...alpha, [axis]: Number(e.target.value) })}
            />
            <span className="font-mono text-[10px] text-right">{alpha[axis].toFixed(1)}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 pt-2 text-[10px] text-muted-foreground space-y-1 mb-3">
        <div>Σα {shallowTechMode && "(TRL 抜き)"}: <span className="font-mono">{sumActive.toFixed(2)}</span></div>
        <div>K: <span className="font-mono">{K.toFixed(4)}</span></div>
        <div className="text-[9px] text-muted-foreground">
          base case: FRL=1.5 / σ_SU=1.3 / HRL=1.1 / TRL=1.0 / BRL=0.6 / GRL=0.3 / SRL=0.2
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={!isModified}
          className="text-[11px] px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          base case に戻す
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="text-[11px] px-3 py-1.5 rounded bg-slate-900 text-white disabled:opacity-50"
        >
          {saving ? "保存中…" : "新しい α を保存"}
        </button>
      </div>
    </aside>
  );
}
