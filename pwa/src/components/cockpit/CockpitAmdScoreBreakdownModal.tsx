"use client";

/**
 * AMD Score breakdown モーダル — Before Zero Theory v3.2 (3 大要素 M × X × F)。
 *
 * 理論層: AMD Score = K · Π (X_i + 1)^α_i  (X = {σ_SU, TRL, BRL, GRL, SRL, HRL, FRL})
 * 表示層: S = M · X · F (校正定数 K = 100,000/10^Σα は k = ∛K として 3 要素均等分配)
 *   - M = k · (σ_SU+1)^α_σ                          マクロ (Triple Helix 外部環境)
 *   - X = k · Π_{x ∈ {TRL,BRL,GRL,SRL,HRL}} (x+1)^α_x  会社に帰属する 5 軸 readiness
 *   - F = k · (FRL+1)^α_F                            CEO 個人に帰属するリーダーシップ
 *
 * Shallow Tech モード (TRL=null): TRL 軸を X から除外、K 再校正。
 *
 * 詳細編集 (μ_A/μ_I/μ_G + 5 XRL + FRL のスライダー、α 重み調整) は
 * /venture-map/amd-score/[projectId] で。ここはチップクリック時の sneak peek。
 */

import Link from "next/link";
import {
  AXIS_COLOR,
  PHASE_COLOR,
  PHASE_LABEL_JP,
  calculateAmdScore,
  type AlphaWeights,
  type AmdScoreAxis,
} from "@/lib/amd-score";
import type { AmdScoreInputRow } from "@/lib/amd-score-data";
import { Tex } from "@/components/venture-map/Tex";

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
          <div className="text-[11px] text-slate-700 bg-violet-50 border border-violet-200 rounded-md px-3 py-3 leading-relaxed flex flex-col gap-3">
            <div>
              Before Zero Theory v3.2 —{" "}
              <strong>マクロ M</strong> ×{" "}
              <strong>会社の XRL X</strong> ×{" "}
              <strong>CEO の FRL F</strong> の 3 大要素を Cobb-Douglas で統合。
              <br />
              マクロトレンドの流れがあって、会社の XRL が整っていて、それを FRL 高い CEO が牽引する。
            </div>
            <div className="bg-white rounded px-3 py-2 overflow-x-auto">
              <div className="text-[10px] text-muted-foreground mb-1">全体式 (S = AMD Score)</div>
              <Tex display tex={String.raw`S \;=\; M \cdot X \cdot F`} />
            </div>
            <div className="bg-white rounded px-3 py-2 overflow-x-auto">
              <div className="text-[10px] text-muted-foreground mb-1">
                ① マクロ M (外部環境 / Triple Helix: 学術 μ_A × 産業 μ_I × 政府 μ_G)
              </div>
              <Tex
                display
                tex={String.raw`M \;=\; k \cdot (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}, \quad \sigma_{\mathrm{SU}} \;=\; \sqrt[3]{(\mu_A+1)(\mu_I+1)(\mu_G+1)} - 1`}
              />
            </div>
            <div className="bg-white rounded px-3 py-2 overflow-x-auto">
              <div className="text-[10px] text-muted-foreground mb-1">
                ② 会社の XRL X (会社に帰属する 5 軸 readiness、内閣府 SIP 互換)
              </div>
              <Tex
                display
                tex={String.raw`X \;=\; k \cdot \prod_{x \in \{\mathrm{TRL},\, \mathrm{BRL},\, \mathrm{GRL},\, \mathrm{SRL},\, \mathrm{HRL}\}} (x+1)^{\alpha_x}`}
              />
            </div>
            <div className="bg-white rounded px-3 py-2 overflow-x-auto">
              <div className="text-[10px] text-muted-foreground mb-1">
                ③ CEO の FRL F (個人に帰属する CEO リーダーシップ / ALQ ベース、α_F が最大の重み)
              </div>
              <Tex display tex={String.raw`F \;=\; k \cdot (\mathrm{FRL}+1)^{\alpha_F}`} />
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
                k = <span className="font-mono">∛(100,000 / 10^Σα)</span> は IPO 級
                100,000 への校正定数を 3 要素に均等分配したもの (default で k ≈ 0.464) ·
                Shallow Tech モード (TRL=null) では TRL を X から除外して k を再校正。
              </div>
            </div>
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
  // K を 3 要素に均等分配 (k = ∛K)。M·X·F = K · Π = score を保つ。
  const k = Math.cbrt(result.K);

  // ① M = k · (σ_SU+1)^α_σ
  const mContribution = result.contributions.sigma_SU ?? 1;
  const M = k * mContribution;

  // ② X = k · ∏_{x ∈ XRL_5} (x+1)^α_x  (Shallow Tech では TRL を除外)
  const xrlAxes: AmdScoreAxis[] = ["TRL", "BRL", "GRL", "SRL", "HRL"];
  let xrlProduct = 1;
  for (const axis of xrlAxes) {
    if (axis === "TRL" && result.shallowTechMode) continue;
    xrlProduct *= result.contributions[axis] ?? 1;
  }
  const X = k * xrlProduct;

  // ③ F = k · (FRL+1)^α_F
  const fContribution = result.contributions.FRL ?? 1;
  const F = k * fContribution;

  const fmt = (n: number, digits = 2) =>
    n < 1 ? n.toFixed(digits) : n < 100 ? n.toFixed(2) : Math.round(n).toLocaleString();

  return (
    <>
      <div className="border border-[#e5e5e7] rounded-md p-3 flex items-baseline justify-between">
        <div>
          <div className="text-[10px] text-muted-foreground">最新評価 ({latestInput.evaluated_at.slice(0, 10)})</div>
          <div className="text-3xl font-mono font-bold" style={{ color: phaseColor }}>
            S = {result.score < 1 ? result.score.toFixed(2) : Math.round(result.score).toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono mt-1">
            = M({fmt(M)}) × X({fmt(X)}) × F({fmt(F)})
          </div>
        </div>
        <div className="text-right">
          <span
            className="inline-block px-2 py-0.5 rounded-full text-[10px] text-white"
            style={{ backgroundColor: phaseColor }}
          >
            {PHASE_LABEL_JP[result.phase]}
          </span>
          {result.shallowTechMode && (
            <div className="text-[10px] text-amber-700 mt-1">Shallow Tech モード</div>
          )}
          <div className="text-[10px] text-muted-foreground mt-1">
            k = <span className="font-mono">{k.toFixed(3)}</span>
          </div>
        </div>
      </div>

      {/* ① マクロ M */}
      <FactorCard
        label="M"
        ja="マクロ"
        sub="外部環境 / Triple Helix"
        value={M}
        color={AXIS_COLOR.sigma_SU}
        formula="M = k · (σ_SU+1)^α_σ"
        bottleneck={result.bottleneck === "sigma_SU"}
      >
        <FactorRow name="μ_A (学術)" value={fmt(latestInput.mu_A ?? 0, 1)} />
        <FactorRow name="μ_I (産業)" value={fmt(latestInput.mu_I ?? 0, 1)} />
        <FactorRow name="μ_G (政府)" value={fmt(latestInput.mu_G ?? 0, 1)} />
        <FactorRow
          name="σ_SU = ∛((μ_A+1)(μ_I+1)(μ_G+1)) − 1"
          value={fmt(result.sigma_SU)}
          highlight
        />
        <FactorRow
          name="(σ_SU+1)^α_σ"
          value={fmt(mContribution)}
          note={`α_σ = ${alpha.sigma_SU.toFixed(2)}`}
        />
        <FactorRow name="× k" value={k.toFixed(3)} note="校正定数" />
        <FactorRow name="= M" value={fmt(M)} total />
      </FactorCard>

      {/* ② 会社の XRL X */}
      <FactorCard
        label="X"
        ja="会社の XRL"
        sub="会社に帰属する 5 軸 readiness"
        value={X}
        color={AXIS_COLOR.TRL}
        formula="X = k · ∏ (x+1)^α_x"
      >
        {xrlAxes.map((axis) => {
          if (axis === "TRL" && result.shallowTechMode) return null;
          const rawValue =
            axis === "TRL"
              ? latestInput.trl ?? 0
              : axis === "BRL"
                ? latestInput.brl ?? 0
                : axis === "GRL"
                  ? latestInput.grl ?? 0
                  : axis === "SRL"
                    ? latestInput.srl ?? 0
                    : latestInput.hrl ?? 0;
          const contribution = result.contributions[axis] ?? 1;
          const isBottleneck = result.bottleneck === axis;
          return (
            <FactorRow
              key={axis}
              name={`${axis} = ${fmt(rawValue, 1)}`}
              value={`(${fmt(rawValue, 1)}+1)^${alpha[axis].toFixed(2)} = ${fmt(contribution)}`}
              note={`α = ${alpha[axis].toFixed(2)}`}
              dotColor={AXIS_COLOR[axis]}
              bottleneck={isBottleneck}
            />
          );
        })}
        <FactorRow name="∏ (x+1)^α_x" value={fmt(xrlProduct)} highlight />
        <FactorRow name="× k" value={k.toFixed(3)} note="校正定数" />
        <FactorRow name="= X" value={fmt(X)} total />
      </FactorCard>

      {/* ③ CEO の FRL F */}
      <FactorCard
        label="F"
        ja="CEO の FRL"
        sub="個人に帰属 / ALQ ベース"
        value={F}
        color={AXIS_COLOR.FRL}
        formula="F = k · (FRL+1)^α_F"
        bottleneck={result.bottleneck === "FRL"}
      >
        <FactorRow name={`FRL = ${fmt(latestInput.frl ?? 0, 1)}`} value={fmt(latestInput.frl ?? 0, 1)} />
        <FactorRow
          name="(FRL+1)^α_F"
          value={fmt(fContribution)}
          note={`α_F = ${alpha.FRL.toFixed(2)} (最大重み)`}
          highlight
        />
        <FactorRow name="× k" value={k.toFixed(3)} note="校正定数" />
        <FactorRow name="= F" value={fmt(F)} total />
      </FactorCard>

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

function FactorCard({
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
  children: React.ReactNode;
}) {
  return (
    <div
      className="border rounded-md p-3"
      style={{
        borderColor: bottleneck ? "#fca5a5" : "#e5e5e7",
        backgroundColor: bottleneck ? "#fef2f2" : undefined,
      }}
    >
      <div className="flex items-baseline justify-between mb-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-mono font-bold" style={{ color }}>
            {label}
          </span>
          <span className="text-[12px] font-semibold">{ja}</span>
          {bottleneck && (
            <span className="text-[9px] text-red-600 font-semibold">律速</span>
          )}
        </div>
        <span className="text-xl font-mono font-bold" style={{ color }}>
          {value < 1 ? value.toFixed(2) : value < 100 ? value.toFixed(2) : Math.round(value).toLocaleString()}
        </span>
      </div>
      <div className="text-[10px] text-muted-foreground mb-2">
        {sub} · <span className="font-mono">{formula}</span>
      </div>
      <table className="w-full text-[11px]">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function FactorRow({
  name,
  value,
  note,
  dotColor,
  highlight = false,
  total = false,
  bottleneck = false,
}: {
  name: string;
  value: string;
  note?: string;
  dotColor?: string;
  highlight?: boolean;
  total?: boolean;
  bottleneck?: boolean;
}) {
  const bg = bottleneck ? "#fee2e2" : highlight ? "#f5f3ff" : total ? "#ecfdf5" : undefined;
  const fontWeight = total ? 600 : 400;
  return (
    <tr className="border-b border-[#f1f5f9]" style={{ backgroundColor: bg, fontWeight }}>
      <td className="py-1">
        {dotColor && <span style={{ color: dotColor }}>● </span>}
        {name}
        {bottleneck && <span className="ml-1 text-[9px] text-red-600">律速</span>}
      </td>
      <td className="text-right font-mono py-1">{value}</td>
      <td className="text-right text-[10px] text-muted-foreground py-1 pl-2 whitespace-nowrap">
        {note ?? ""}
      </td>
    </tr>
  );
}
