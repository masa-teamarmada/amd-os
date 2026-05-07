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
import { useMemo, useState, useTransition } from "react";
import {
  ALPHA_DEFAULT,
  AMD_SCORE_AXES,
  AXIS_COLOR,
  AXIS_LABEL_JP,
  PHASE_COLOR,
  PHASE_LABEL_JP,
  calculateAmdScore,
  computeK,
  computeSigmaSU,
  logScaleNormalize,
  sumAlpha,
  type AlphaWeights,
  type AmdScoreAxis,
  type AmdScorePhase,
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
  shallow_tech_mode: boolean;
  notes: string;
}

function rowToEditable(r: AmdScoreInputRow): EditableInput {
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
    shallow_tech_mode: r.shallow_tech_mode,
    notes: r.notes ?? "",
  };
}

function emptyEditable(): EditableInput {
  return {
    evaluated_at: new Date().toISOString().slice(0, 10),
    mu_A: 0, mu_I: 0, mu_G: 0, trl: 0, brl: 0, grl: 0, srl: 0, hrl: 0, frl: 0,
    shallow_tech_mode: false,
    notes: "",
  };
}

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

  // ---- 現在の編集値で score 計算 ----
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
        FRL: editable.frl,
      },
      alpha
    );
  }, [editable, alpha]);

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
        frl: editable.frl,
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RadarChart result={result} />
            <ContributionTable result={result} alpha={alpha} />
          </div>
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
  const phaseColor = PHASE_COLOR[result.phase as AmdScorePhase];
  return (
    <div className="border border-[#e5e5e7] rounded-xl p-5 bg-white">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <div>
          <div className="text-[11px] text-muted-foreground">AMD Score</div>
          <div className="text-4xl font-mono font-bold" style={{ color: phaseColor }}>
            {result.score < 1 ? result.score.toFixed(2) : Math.round(result.score).toLocaleString()}
          </div>
        </div>
        <div className="text-right">
          <span
            className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: phaseColor }}
          >
            {PHASE_LABEL_JP[result.phase as AmdScorePhase]}
          </span>
          <div className="text-[10px] text-muted-foreground mt-1">
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
          style={{ width: `${norm * 100}%`, backgroundColor: phaseColor, transition: "width 200ms" }}
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
// Radar Chart (7 軸)
// ============================================================
function RadarChart({ result }: { result: ReturnType<typeof calculateAmdScore> }) {
  const W = 360;
  const H = 360;
  const cx = W / 2;
  const cy = H / 2;
  const R = 130;

  const axes = AMD_SCORE_AXES;
  const N = axes.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;

  // 軸値を 0-9 範囲で取り出す
  const valueOf = (axis: AmdScoreAxis): number | null => {
    if (axis === "sigma_SU") return result.sigma_SU;
    const c = result.contributions[axis];
    if (c == null) return null;
    // contribution = (value+1)^α → value = c^(1/α) - 1
    const a = (axis === "TRL" && result.shallowTechMode) ? null : null;
    if (a !== undefined && a !== null) return null;
    // contribution → value 復元用には alpha が要る、簡易には軸ラベルから直接 input を渡したいが
    // 親 component に value も持たせる方が綺麗。ここでは contributionShares を使ってバランスを描く。
    return null;
  };
  void valueOf; // silence linter — values come via props if needed

  // 円グリッド
  const grid = [0.2, 0.4, 0.6, 0.8, 1.0];

  // contribution share をプロット (0-1, total=1)
  const points = axes.map((axis, i) => {
    const share = result.contributionShares[axis] ?? 0;
    const r = Math.max(0, Math.min(1, share)) * R * 5; // 寄与シェアを 5 倍してビジュアル化
    const x = cx + r * Math.cos(angle(i));
    const y = cy + r * Math.sin(angle(i));
    return { axis, x, y, share };
  });

  return (
    <div className="border border-[#e5e5e7] rounded-xl p-3 bg-white">
      <div className="text-[11px] text-muted-foreground mb-1">寄与度シェア (radar)</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* グリッド */}
        {grid.map((g, gi) => (
          <polygon
            key={gi}
            points={axes.map((_, i) => {
              const x = cx + g * R * Math.cos(angle(i));
              const y = cy + g * R * Math.sin(angle(i));
              return `${x},${y}`;
            }).join(" ")}
            fill="none"
            stroke="#e5e5e7"
            strokeWidth={0.5}
          />
        ))}
        {/* 軸線 */}
        {axes.map((axis, i) => {
          const x = cx + R * Math.cos(angle(i));
          const y = cy + R * Math.sin(angle(i));
          return (
            <g key={axis}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e5e7" strokeWidth={0.5} />
              <text
                x={cx + (R + 14) * Math.cos(angle(i))}
                y={cy + (R + 14) * Math.sin(angle(i))}
                fontSize={10}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={axis === result.bottleneck ? "#dc2626" : "#475569"}
                fontWeight={axis === result.bottleneck ? 700 : 400}
              >
                {axis === "sigma_SU" ? "σ_SU" : axis}
              </text>
            </g>
          );
        })}
        {/* 寄与度ポリゴン */}
        <polygon
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="rgba(124,58,237,0.18)"
          stroke="#7c3aed"
          strokeWidth={1.5}
        />
        {points.map((p) => (
          <circle
            key={p.axis}
            cx={p.x}
            cy={p.y}
            r={p.axis === result.bottleneck ? 5 : 3.5}
            fill={p.axis === result.bottleneck ? "#dc2626" : AXIS_COLOR[p.axis]}
          />
        ))}
      </svg>
      <div className="text-[10px] text-muted-foreground text-center mt-1">
        各軸の対数寄与シェア。律速軸を赤強調。
      </div>
    </div>
  );
}

// ============================================================
// Contribution Table
// ============================================================
function ContributionTable({
  result,
  alpha,
}: {
  result: ReturnType<typeof calculateAmdScore>;
  alpha: AlphaWeights;
}) {
  const rows = AMD_SCORE_AXES.filter((axis) => {
    if (axis === "TRL" && result.shallowTechMode) return false;
    return result.contributions[axis] != null;
  });
  return (
    <div className="border border-[#e5e5e7] rounded-xl p-3 bg-white">
      <div className="text-[11px] text-muted-foreground mb-2">軸ごとの寄与</div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-muted-foreground border-b border-[#e5e5e7]">
            <th className="text-left py-1">軸</th>
            <th className="text-right py-1 font-mono">α</th>
            <th className="text-right py-1 font-mono">(X+1)^α</th>
            <th className="text-right py-1 font-mono">share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((axis) => {
            const c = result.contributions[axis] ?? 1;
            const share = (result.contributionShares[axis] ?? 0) * 100;
            const isBottleneck = axis === result.bottleneck;
            return (
              <tr
                key={axis}
                className="border-b border-[#f1f5f9]"
                style={isBottleneck ? { backgroundColor: "#fee2e2" } : undefined}
              >
                <td className="py-1">
                  <span style={{ color: AXIS_COLOR[axis] }}>●</span>{" "}
                  {axis === "sigma_SU" ? "σ_SU" : axis}
                  {isBottleneck && <span className="ml-1 text-[9px] text-red-600">律速</span>}
                </td>
                <td className="text-right font-mono">{alpha[axis].toFixed(2)}</td>
                <td className="text-right font-mono">{c.toFixed(2)}</td>
                <td className="text-right font-mono">{share.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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

          <ScoreSlider
            label="μ_A (学術)"
            value={editable.mu_A}
            onChange={(v) => setEditable({ ...editable, mu_A: v })}
          />
          <ScoreSlider
            label="μ_I (産業)"
            value={editable.mu_I}
            onChange={(v) => setEditable({ ...editable, mu_I: v })}
          />
          <ScoreSlider
            label="μ_G (政府)"
            value={editable.mu_G}
            onChange={(v) => setEditable({ ...editable, mu_G: v })}
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
            <ScoreSlider
              label="TRL"
              value={editable.trl ?? 0}
              onChange={(v) => setEditable({ ...editable, trl: v })}
            />
          )}
          <ScoreSlider label="BRL" value={editable.brl} onChange={(v) => setEditable({ ...editable, brl: v })} />
          <ScoreSlider label="GRL" value={editable.grl} onChange={(v) => setEditable({ ...editable, grl: v })} />
          <ScoreSlider label="SRL" value={editable.srl} onChange={(v) => setEditable({ ...editable, srl: v })} />
          <ScoreSlider label="HRL" value={editable.hrl} onChange={(v) => setEditable({ ...editable, hrl: v })} />
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
