"use client";

/**
 * AMD Score breakdown モーダル — Before Zero Theory v3.2 (3 大要素 M × X × F)。
 *
 * S = k · M · X · F
 *   - M = (σ_SU+1)^α_σ                              マクロ (Triple Helix 外部環境)
 *   - X = Π_{x ∈ {TRL,BRL,GRL,SRL,HRL}} (x+1)^α_x   会社に帰属する 5 軸 readiness
 *   - F = (FRL+1)^α_F                               CEO 個人に帰属するリーダーシップ
 *   - k = 100,000 / 10^Σα                           IPO 級 100,000 への校正定数 (小文字)
 *
 * Shallow Tech モード (TRL=null): TRL 軸を X から除外、k 再校正。
 *
 * 詳細編集 (μ_A/μ_I/μ_G + 5 XRL + FRL のスライダー、α 重み調整) は
 * /venture-map/amd-score/[projectId] で。ここはチップクリック時の sneak peek。
 */

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AXIS_COLOR,
  calculateAmdScore,
  type AlphaWeights,
  type AmdScoreAxis,
} from "@/lib/amd-score";
// PHASE_COLOR / PHASE_LABEL_JP は使用しない (検証データ蓄積後に復活検討、2026-05-09)
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
          <h3 className="text-sm font-semibold">Legacy AMD comparison の内訳</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
            ✕
          </button>
        </div>

        <div className="px-4 py-4 flex flex-col gap-4">
          {/* 数式と律速の根拠は詳細ページに移設済み (2026-05-09)。モーダルでは値の内訳のみ表示。 */}
          <div className="text-[11px] text-slate-700 bg-violet-50 border border-violet-200 rounded-md px-3 py-2 leading-relaxed flex items-center justify-between gap-3">
            <div>
              <strong>PRS primary の下に残している legacy AMD comparison</strong>。マクロ M × 会社の XRL X × CEO の FRL F を比較用に読む。
              数式・律速の経済学的根拠は詳細ページに記載。
            </div>
            <Link
              href={`/venture-map/amd-score/${projectId}`}
              className="shrink-0 px-2 py-1 rounded bg-violet-600 text-white text-[10px] hover:bg-violet-700"
            >
              数式 →
            </Link>
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

/** モーダルの subtitle 用フォールバック (notes が空のとき表示) */
const FALLBACK_NOTE_MODAL = "根拠となる情報がないため仮置き";

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

  // フェーズタブは検証データ蓄積後に復活検討のため非表示 (2026-05-09)。
  // スコア数値は中立色 (slate-900) で固定表示。
  const scoreColor = "#0f172a";

  // 1 M = (σ_SU+1)^α_σ
  const M = result.contributions.sigma_SU ?? 1;

  // 2 X = ∏_{x ∈ XRL_5} (x+1)^α_x  (Shallow Tech では TRL を除外)
  const xrlAxes: AmdScoreAxis[] = ["TRL", "BRL", "GRL", "SRL", "HRL"];
  let X = 1;
  for (const axis of xrlAxes) {
    if (axis === "TRL" && result.shallowTechMode) continue;
    X *= result.contributions[axis] ?? 1;
  }

  // 3 F = (FRL+1)^α_F
  const F = result.contributions.FRL ?? 1;

  // S = k · M · X · F (sanity check; result.score と一致。result.K は API 名のまま)
  const fmt = (n: number, digits = 2) =>
    n < 1 ? n.toFixed(digits) : n < 100 ? n.toFixed(2) : Math.round(n).toLocaleString();

  return (
    <>
      <div className="border border-[#e5e5e7] rounded-md p-3 flex items-baseline justify-between">
        <div>
          <div className="text-[10px] text-muted-foreground">最新評価 ({latestInput.evaluated_at.slice(0, 10)})</div>
          <div className="text-3xl font-mono font-bold" style={{ color: scoreColor }}>
            S = {result.score < 1 ? result.score.toFixed(2) : Math.round(result.score).toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono mt-1">
            = k({result.K.toFixed(3)}) × M({fmt(M)}) × X({fmt(X)}) × F({fmt(F)})
          </div>
        </div>
        <div className="text-right">
          {result.shallowTechMode && (
            <div className="text-[10px] text-amber-700">Shallow Tech モード</div>
          )}
          <div className="text-[10px] text-muted-foreground mt-1">
            Σα = <span className="font-mono">{result.alphaSum.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 1 マクロ M */}
      <FactorCard
        label="M"
        ja="マクロ"
        sub="外部環境 / Triple Helix"
        value={M}
        color={AXIS_COLOR.sigma_SU}
        formula={<Tex tex={String.raw`M = (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}`} />}
        bottleneck={result.bottleneck === "sigma_SU"}
      >
        <FactorRow
          name="μ_A (学術)"
          value={fmt(latestInput.mu_A ?? 0, 1)}
          subtitle={latestInput.mu_notes?.a ?? FALLBACK_NOTE_MODAL}
          subtitleIsFallback={!latestInput.mu_notes?.a}
        />
        <FactorRow
          name="μ_I (産業)"
          value={fmt(latestInput.mu_I ?? 0, 1)}
          subtitle={latestInput.mu_notes?.i ?? FALLBACK_NOTE_MODAL}
          subtitleIsFallback={!latestInput.mu_notes?.i}
        />
        <FactorRow
          name="μ_G (政府)"
          value={fmt(latestInput.mu_G ?? 0, 1)}
          subtitle={latestInput.mu_notes?.g ?? FALLBACK_NOTE_MODAL}
          subtitleIsFallback={!latestInput.mu_notes?.g}
        />
        <FactorRow
          name={<Tex tex={String.raw`\sigma_{\mathrm{SU}} = \sqrt[3]{(\mu_A+1)(\mu_I+1)(\mu_G+1)} - 1`} />}
          value={fmt(result.sigma_SU)}
          highlight
        />
        <FactorRow
          name={<><span className="font-mono">= M =</span> <Tex tex={String.raw`(\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}`} /></>}
          value={fmt(M)}
          note={`α_σ = ${alpha.sigma_SU.toFixed(2)}`}
          total
        />
      </FactorCard>

      {/* 2 会社の XRL X */}
      <FactorCard
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
          const noteKey = axis.toLowerCase() as "trl" | "brl" | "grl" | "srl" | "hrl";
          const axisNote = latestInput.xrl_notes?.[noteKey] ?? undefined;
          return (
            <FactorRow
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
              bottleneck={isBottleneck}
              subtitle={axisNote ?? FALLBACK_NOTE_MODAL}
              subtitleIsFallback={!axisNote}
            />
          );
        })}
        <FactorRow
          name={<><span className="font-mono">= X =</span> <Tex tex={String.raw`\prod_x (x+1)^{\alpha_x}`} /></>}
          value={fmt(X)}
          total
        />
      </FactorCard>

      {/* 3 CEO の FRL F */}
      <FactorCard
        label="F"
        ja="CEO の FRL"
        sub="個人に帰属 / ALQ ベース"
        value={F}
        color={AXIS_COLOR.FRL}
        formula={<Tex tex={String.raw`F = (\mathrm{FRL}+1)^{\alpha_F}`} />}
        bottleneck={result.bottleneck === "FRL"}
      >
        <FactorRow
          name={`FRL = ${fmt(latestInput.frl ?? 0, 1)}`}
          value={fmt(latestInput.frl ?? 0, 1)}
          subtitle={latestInput.frl_notes ?? FALLBACK_NOTE_MODAL}
          subtitleIsFallback={!latestInput.frl_notes}
        />
        <FactorRow
          name={<><span className="font-mono">= F =</span> <Tex tex={String.raw`(\mathrm{FRL}+1)^{\alpha_F}`} /></>}
          value={fmt(F)}
          note={`α_F = ${alpha.FRL.toFixed(2)} (最大重み)`}
          total
        />
      </FactorCard>

      <div className="text-[10px] text-muted-foreground text-center font-mono">
        S = k × M × X × F = {result.K.toFixed(3)} × {fmt(M)} × {fmt(X)} × {fmt(F)} ≈{" "}
        {result.score < 1 ? result.score.toFixed(2) : Math.round(result.score).toLocaleString()}
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
  formula: ReactNode;
  bottleneck?: boolean;
  children: ReactNode;
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
  subtitle,
  subtitleIsFallback = false,
}: {
  name: ReactNode;
  value: ReactNode;
  /** 行末の小さい注記 (α 値など、機械的に表示するメタ情報)。 */
  note?: ReactNode;
  dotColor?: string;
  highlight?: boolean;
  total?: boolean;
  bottleneck?: boolean;
  /**
   * 軸ラベル直下に出す自由記述の根拠 (mu_notes.a / xrl_notes.trl / frl_notes など)。
   * 値の根拠を見える化するためのフィールド。
   */
  subtitle?: string;
  /** subtitle が「根拠仮置き」のフォールバックの場合は薄めて表示する */
  subtitleIsFallback?: boolean;
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
          <div
            className={`text-[9px] italic font-normal mt-0.5 leading-snug ${subtitleIsFallback ? "text-slate-400" : "text-muted-foreground"}`}
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
