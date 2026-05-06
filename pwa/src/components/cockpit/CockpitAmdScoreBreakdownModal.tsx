"use client";

/**
 * AMD Score breakdown モーダル — Before Zero Theory v3.2 (7 軸 Cobb-Douglas)。
 *
 * 計算式: AMD Score = K · Π (X_i + 1)^α_i  (X = {σ_SU, TRL, BRL, GRL, SRL, HRL, FRL})
 * Shallow Tech モード (TRL=null) では TRL 軸を除外、6 軸 + K 再校正。
 *
 * 詳細編集 (μ_A/μ_I/μ_G + 5 XRL + FRL のスライダー、α 重み調整) は
 * /venture-map/amd-score/[projectId] で。ここはチップクリック時の sneak peek。
 */

import Link from "next/link";
import {
  AMD_SCORE_AXES,
  AXIS_COLOR,
  AXIS_LABEL_JP,
  PHASE_COLOR,
  PHASE_LABEL_JP,
  calculateAmdScore,
  type AlphaWeights,
} from "@/lib/amd-score";
import type { AmdScoreInputRow } from "@/lib/amd-score-data";

interface Props {
  projectId: string;
  latestInput: AmdScoreInputRow | null;
  alpha: AlphaWeights;
  onClose: () => void;
}

export function CockpitAmdScoreBreakdownModal({ projectId, latestInput, alpha, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[640px] max-w-[92vw] max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#e5e5e7] flex items-center justify-between">
          <h3 className="text-sm font-semibold">AMD スコアの内訳</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
            ✕
          </button>
        </div>

        <div className="px-4 py-4 flex flex-col gap-4">
          <div className="text-[11px] text-slate-700 bg-violet-50 border border-violet-200 rounded-md px-3 py-2 leading-relaxed">
            Before Zero Theory v3.2 — 7 軸 Cobb-Douglas 統合指標。
            <code className="font-mono text-[10px] mx-1">Score = K · Π (X+1)^α</code>
            (X = σ_SU / TRL / BRL / GRL / SRL / HRL / FRL)。
          </div>

          {!latestInput ? (
            <div className="text-[12px] text-muted-foreground py-6 text-center">
              この PJ の AMD Score 入力はまだ登録されていません。
              <div className="mt-3">
                <Link
                  href={`/venture-map/amd-score/${projectId}`}
                  className="inline-block px-3 py-1.5 rounded bg-slate-900 text-white text-[11px]"
                >
                  入力ページを開く
                </Link>
              </div>
            </div>
          ) : (
            <BreakdownContent latestInput={latestInput} alpha={alpha} projectId={projectId} />
          )}
        </div>
      </div>
    </div>
  );
}

function BreakdownContent({
  latestInput,
  alpha,
  projectId,
}: {
  latestInput: AmdScoreInputRow;
  alpha: AlphaWeights;
  projectId: string;
}) {
  const result = calculateAmdScore(
    {
      mu_A: latestInput.mu_A ?? 0,
      mu_I: latestInput.mu_I ?? 0,
      mu_G: latestInput.mu_G ?? 0,
      TRL: latestInput.shallow_tech_mode ? null : latestInput.trl ?? 0,
      BRL: latestInput.brl ?? 0,
      GRL: latestInput.grl ?? 0,
      SRL: latestInput.srl ?? 0,
      HRL: latestInput.hrl ?? 0,
      FRL: latestInput.frl ?? 0,
    },
    alpha
  );

  const phaseColor = PHASE_COLOR[result.phase];
  const axes = AMD_SCORE_AXES.filter((a) => !(a === "TRL" && result.shallowTechMode));

  return (
    <>
      <div className="border border-[#e5e5e7] rounded-md p-3 flex items-baseline justify-between">
        <div>
          <div className="text-[10px] text-muted-foreground">最新評価 ({latestInput.evaluated_at.slice(0, 10)})</div>
          <div className="text-3xl font-mono font-bold" style={{ color: phaseColor }}>
            {result.score < 1 ? result.score.toFixed(2) : Math.round(result.score).toLocaleString()}
          </div>
        </div>
        <div className="text-right">
          <span
            className="inline-block px-2 py-0.5 rounded-full text-[10px] text-white"
            style={{ backgroundColor: phaseColor }}
          >
            {PHASE_LABEL_JP[result.phase]}
          </span>
          <div className="text-[10px] text-muted-foreground mt-1">
            律速: <span className="font-mono">{AXIS_LABEL_JP[result.bottleneck]}</span>
          </div>
          {result.shallowTechMode && (
            <div className="text-[10px] text-amber-700 mt-1">Shallow Tech モード</div>
          )}
        </div>
      </div>

      <div className="border border-[#e5e5e7] rounded-md p-3">
        <div className="text-[12px] font-semibold mb-2">軸ごとの寄与</div>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-muted-foreground border-b border-[#e5e5e7]">
              <th className="text-left py-1">軸</th>
              <th className="text-right py-1 font-mono">値</th>
              <th className="text-right py-1 font-mono">α</th>
              <th className="text-right py-1 font-mono">(X+1)^α</th>
              <th className="text-right py-1 font-mono">share</th>
            </tr>
          </thead>
          <tbody>
            {axes.map((axis) => {
              const value =
                axis === "sigma_SU"
                  ? result.sigma_SU
                  : axis === "TRL"
                    ? latestInput.trl ?? 0
                    : axis === "BRL"
                      ? latestInput.brl ?? 0
                      : axis === "GRL"
                        ? latestInput.grl ?? 0
                        : axis === "SRL"
                          ? latestInput.srl ?? 0
                          : axis === "HRL"
                            ? latestInput.hrl ?? 0
                            : latestInput.frl ?? 0;
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
                  <td className="text-right font-mono">{Number(value).toFixed(2)}</td>
                  <td className="text-right font-mono">{alpha[axis].toFixed(2)}</td>
                  <td className="text-right font-mono">{c.toFixed(2)}</td>
                  <td className="text-right font-mono">{share.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-muted-foreground space-x-2">
        <span>K = <span className="font-mono">{result.K.toFixed(4)}</span></span>
        <span>·</span>
        <span>Σα = <span className="font-mono">{result.alphaSum.toFixed(2)}</span></span>
        <span>·</span>
        <span>σ_SU = <span className="font-mono">{result.sigma_SU.toFixed(2)}</span></span>
      </div>

      <div className="border-t border-slate-200 pt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] text-muted-foreground">
          7 軸を編集・α を調整するには:
        </span>
        <Link
          href={`/venture-map/amd-score/${projectId}`}
          className="px-3 py-1 rounded bg-slate-900 text-white text-[11px]"
        >
          AMD Score 詳細ページ →
        </Link>
      </div>
    </>
  );
}
