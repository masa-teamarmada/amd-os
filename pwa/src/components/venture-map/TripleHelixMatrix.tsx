"use client";

/**
 * Triple Helix 観測モデル C 行列の表示コンポーネント。
 *
 * AMD Score 詳細ページの M カード内で、6 観測量 × 3 隠れ状態 (μ_A/μ_I/μ_G) の
 * loading 行列 + PJ.lane × 直近 quarter の観測値 + 寄与計算を可視化する。
 *
 * 仕様: pwa/design/amd_score.md「Triple Helix 観測モデル」+ before-zero/theory/bvar_prior.md §3.2
 */

import { Tex } from "@/components/venture-map/Tex";
import type {
  TripleHelixComputed,
  ObservationData,
} from "@/lib/triple-helix-observations";

interface Props {
  helix: TripleHelixComputed | null;
  alphaSigma: number;
}

const FORMAT_NUM = (n: number, digits = 2) =>
  n < 1 ? n.toFixed(digits) : n < 100 ? n.toFixed(2) : Math.round(n).toLocaleString();

export function TripleHelixMatrix({ helix, alphaSigma }: Props) {
  if (!helix) {
    return (
      <div className="text-xs text-slate-500 italic">
        Triple Helix 観測モデル読み込みエラー
      </div>
    );
  }

  const M = Math.pow(helix.sigma_su + 1, alphaSigma);

  return (
    <div className="flex flex-col gap-3">
      {/* 数式は紫枠 (AmdScoreFormulaPanel) で全段表示済 — 重複避け */}

      {/* === μ 値カード × 3 + σ_SU + M === */}
      <ValueLadder
        muA={helix.mu_a}
        muI={helix.mu_i}
        muG={helix.mu_g}
        sigmaSu={helix.sigma_su}
        M={M}
        alphaSigma={alphaSigma}
      />

      {/* === 6×3 観測モデル C 行列 + 観測値 === */}
      <CMatrixTable observations={helix.observations} />

      {/* === 被覆率 === */}
      <CoverageNote coverage={helix.coverage} lane={helix.lane} />
    </div>
  );
}

// =====================================================================
// 数式パネル — 紫枠 (AmdScoreFormulaPanel) で表示するため、ここは未使用 stub。
// =====================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _UnusedFormulaPanel() {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        モデル構造
      </div>
      <div className="mt-1.5 flex flex-col gap-1 text-xs">
        <div>
          <span className="text-slate-500">① マクロ M:</span>{" "}
          <Tex tex={`M = (\\sigma_{SU}+1)^{\\alpha_\\sigma}`} />
        </div>
        <div>
          <span className="text-slate-500">② Triple Helix CD:</span>{" "}
          <Tex tex={`\\sigma_{SU} = \\sqrt[3]{(\\mu_A+1)(\\mu_I+1)(\\mu_G+1)} - 1`} />
        </div>
        <div>
          <span className="text-slate-500">③ 観測モデル:</span>{" "}
          <Tex tex={`\\mu_x = \\frac{\\sum_p c_{xp} \\, \\tilde{y}_p}{\\sum_p c_{xp}}`} />
          <span className="ml-2 text-slate-500">
            (
            <Tex tex={`p \\in \\{P, B, V, R, I_R, N, C\\}`} />)
          </span>
        </div>
        <div>
          <span className="text-slate-500">④ 観測値正規化:</span>{" "}
          <Tex tex={`\\tilde{y}_p = 9 \\, \\frac{y_p - \\min_t y_p}{\\max_t y_p - \\min_t y_p}`} />
          <span className="ml-2 text-slate-500">(過去 16 quarter で min-max)</span>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-500">
        正本: <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">theory/state_space_model.md §4.1</code>
        {" / "}
        <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">theory/bvar_prior.md §3.2</code>
      </p>
    </div>
  );
}

// =====================================================================
// μ 値ラダー — 観測量から μ までの値の流れを 3 段で見せる
// =====================================================================

function ValueLadder({
  muA,
  muI,
  muG,
  sigmaSu,
  M,
  alphaSigma,
}: {
  muA: number;
  muI: number;
  muG: number;
  sigmaSu: number;
  M: number;
  alphaSigma: number;
}) {
  return (
    <div className="flex flex-col items-stretch gap-2">
      <div className="grid grid-cols-3 gap-2">
        <MuChip label="μ_A" subtitle="学 (Academia)" value={muA} color="emerald" />
        <MuChip label="μ_I" subtitle="産 (Industry)" value={muI} color="amber" />
        <MuChip label="μ_G" subtitle="官 (Government)" value={muG} color="indigo" />
      </div>
      <div className="flex items-center justify-center gap-1 text-slate-400 text-[11px]">
        <span>↓</span>
        <Tex tex={String.raw`\sigma_{\mathrm{SU}} = \sqrt[3]{(\mu_A+1)(\mu_I+1)(\mu_G+1)} - 1`} />
      </div>
      <div className="border border-cyan-300/28 bg-slate-950/76 p-2 text-center text-sm shadow-[inset_0_0_18px_rgba(34,211,238,0.06)]">
        <Tex tex={String.raw`\sigma_{\mathrm{SU}} = `} />
        <span className="ml-1 font-mono text-base font-semibold tabular-nums">
          {FORMAT_NUM(sigmaSu, 2)}
        </span>
        <span className="ml-2 text-[10px] text-slate-400">(0-9 スケール)</span>
      </div>
      <div className="flex items-center justify-center gap-1 text-slate-400 text-[11px]">
        <span>↓</span>
        <Tex tex={String.raw`M = (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}`} />
        <span className="text-[10px]">(α_σ = {alphaSigma.toFixed(2)})</span>
      </div>
      <div className="border border-cyan-200/56 bg-cyan-300/10 p-2 text-center text-sm shadow-[0_0_20px_rgba(103,232,249,0.22)]">
        <span className="text-cyan-100/70">M = </span>
        <span className="font-mono text-lg font-bold tabular-nums text-white drop-shadow-[0_0_12px_rgba(103,232,249,0.65)]">
          {FORMAT_NUM(M, 2)}
        </span>
      </div>
    </div>
  );
}

const MU_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  emerald: {
    bg: "bg-emerald-300/10",
    text: "text-emerald-100",
    border: "border-emerald-300/42",
  },
  amber: {
    bg: "bg-amber-300/10",
    text: "text-amber-100",
    border: "border-amber-300/42",
  },
  indigo: {
    bg: "bg-indigo-300/10",
    text: "text-indigo-100",
    border: "border-indigo-300/42",
  },
};

function MuChip({
  label,
  subtitle,
  value,
  color,
}: {
  label: string;
  subtitle: string;
  value: number;
  color: keyof typeof MU_COLORS;
}) {
  const c = MU_COLORS[color];
  return (
    <div className={`border ${c.border} ${c.bg} p-2 text-center shadow-[inset_0_0_16px_rgba(34,211,238,0.05)]`}>
      <div className={`font-semibold ${c.text}`}>{label}</div>
      <div className="text-[10px] text-slate-500 dark:text-slate-400">{subtitle}</div>
      <div className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${c.text}`}>
        {FORMAT_NUM(value, 2)}
      </div>
      <div className="text-[9px] text-slate-400">/ 9.0</div>
    </div>
  );
}

// =====================================================================
// C 行列 6×3 + 観測値テーブル
// =====================================================================

function CMatrixTable({ observations }: { observations: ObservationData[] }) {
  return (
    <div className="overflow-x-auto border border-cyan-300/24 bg-slate-950/72">
      <table className="w-full text-xs">
        <thead className="bg-slate-950/96 text-cyan-100/70">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">観測量</th>
            <th className="px-2 py-1.5 text-center font-medium">
              <span className="text-emerald-700 dark:text-emerald-400">c → μ_A</span>
            </th>
            <th className="px-2 py-1.5 text-center font-medium">
              <span className="text-amber-700 dark:text-amber-400">c → μ_I</span>
            </th>
            <th className="px-2 py-1.5 text-center font-medium">
              <span className="text-indigo-700 dark:text-indigo-400">c → μ_G</span>
            </th>
            <th className="px-2 py-1.5 text-left font-medium">
              観測値 y_p (直近 Q)
            </th>
            <th className="px-2 py-1.5 text-center font-medium">
              ỹ_p
              <span className="ml-1 text-[9px] text-slate-400">(0-9)</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {observations.map((o) => (
            <ObservationRow key={o.observation} data={o} />
          ))}
        </tbody>
      </table>
      <p className="px-2 py-1.5 text-[10px] text-slate-500 dark:text-slate-500">
        セル背景色 = loading 強度 (濃いほど強)。hover で寄与値 c × ỹ。観測値 bar = ỹ_p の 0-9 正規化。
      </p>
    </div>
  );
}

function ObservationRow({ data }: { data: ObservationData }) {
  const { loading, current_value, current_quarter, normalized, contribution } = data;
  const unavailable = normalized == null || !loading.available;
  return (
    <tr
      className={`border-t border-cyan-300/14 ${
        unavailable ? "bg-slate-950/54" : ""
      }`}
    >
      <td className="px-2 py-1.5">
        <div className="font-mono font-semibold text-cyan-50">
          {data.observation}
        </div>
        <div className="text-[10px] leading-tight text-cyan-100/56">
          {loading.description.split(":")[0]}
        </div>
      </td>
      <LoadingCell loading={loading.mu_a} contribution={contribution.mu_a} normalized={normalized} hue="emerald" />
      <LoadingCell loading={loading.mu_i} contribution={contribution.mu_i} normalized={normalized} hue="amber" />
      <LoadingCell loading={loading.mu_g} contribution={contribution.mu_g} normalized={normalized} hue="indigo" />
      <td className="px-2 py-1.5">
        {unavailable ? (
          <span className="text-[10px] italic text-slate-400 dark:text-slate-500">
            未取得 ({loading.data_source})
          </span>
        ) : (
          <div>
            <span className="font-mono tabular-nums text-cyan-50">
              {current_value!.toLocaleString()}
            </span>
            <span className="ml-1 text-[10px] text-slate-500 dark:text-slate-400">{loading.unit}</span>
            {current_quarter && (
              <span className="ml-1 text-[9px] text-slate-400">@ {current_quarter}</span>
            )}
          </div>
        )}
      </td>
      <td className="px-2 py-1.5">
        {unavailable ? (
          <span className="text-[10px] text-slate-400">—</span>
        ) : (
          <NormalizedBar value={normalized!} />
        )}
      </td>
    </tr>
  );
}

function LoadingCell({
  loading,
  contribution,
  normalized,
  hue,
}: {
  loading: number;
  contribution: number;
  normalized: number | null;
  hue: "emerald" | "amber" | "indigo";
}) {
  const intensity = Math.min(1, Math.max(0, loading));
  const bgRgba: Record<string, (a: number) => string> = {
    emerald: (a) => `rgba(16, 185, 129, ${a * 0.45})`,
    amber: (a) => `rgba(245, 158, 11, ${a * 0.45})`,
    indigo: (a) => `rgba(99, 102, 241, ${a * 0.45})`,
  };
  const tooltip =
    normalized == null
      ? `c = ${loading.toFixed(2)} (観測量未取得)`
      : `c = ${loading.toFixed(2)}, ỹ = ${normalized.toFixed(2)}, c·ỹ = ${contribution.toFixed(2)}`;
  return (
    <td
      className="px-2 py-1.5 text-center font-mono text-xs tabular-nums text-cyan-50"
      style={{ backgroundColor: bgRgba[hue](intensity) }}
      title={tooltip}
    >
      {loading.toFixed(2)}
      {normalized != null && (
        <span className="ml-1 text-[9px] text-slate-500">
          ·{normalized.toFixed(1)}
        </span>
      )}
    </td>
  );
}

function NormalizedBar({ value }: { value: number }) {
  const filled = Math.round(value);
  const empty = Math.max(0, 9 - filled);
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-[11px] tracking-tighter text-emerald-600 dark:text-emerald-400">
        {"▓".repeat(filled)}
        <span className="text-slate-300 dark:text-slate-700">{"░".repeat(empty)}</span>
      </span>
      <span className="font-mono text-[10px] tabular-nums text-slate-500">{value.toFixed(1)}</span>
    </div>
  );
}

// =====================================================================
// Coverage note
// =====================================================================

function CoverageNote({ coverage, lane }: { coverage: { covered: number; total: number }; lane: string }) {
  const pct = Math.round((coverage.covered / coverage.total) * 100);
  return (
    <div className="border border-amber-300/38 bg-amber-300/10 px-2.5 py-1.5 text-[11px] text-amber-100">
      データ被覆率: <strong>{coverage.covered} / {coverage.total}</strong> ({pct}%)
      &nbsp;&nbsp;|&nbsp;&nbsp; lane = <code className="font-mono">{lane}</code>
      &nbsp;&nbsp;|&nbsp;&nbsp;
      <span className="text-amber-700 dark:text-amber-300">
        欠落観測量は Phase 2 (KAKEN / Crunchbase / project_ventures 集計) で順次取得予定
      </span>
    </div>
  );
}
