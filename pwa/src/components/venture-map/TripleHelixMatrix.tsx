"use client";

/**
 * Triple Helix 観測モデル C 行列の表示コンポーネント (通常版 UI、2026-05-27 改修)。
 *
 * cockpit スコア詳細の M カード内で、6 観測量 × 3 隠れ状態 (μ_A/μ_I/μ_G) の
 * loading 行列 + PJ.lane × 直近 quarter の観測値 + 寄与計算を可視化する。
 *
 * 2026-05-27: HUD パレット (cyan/slate-950) を通常版 (slate/white) に置換。
 * μ_A/μ_I/μ_G の評価根拠 (= amd_score_inputs.mu_notes) を MuChip 直下に表示。
 *
 * 仕様: pwa/design/amd_score.md「Triple Helix 観測モデル」+ before-zero/theory/bvar_prior.md §3.2
 */

import { Tex } from "@/components/venture-map/Tex";
import type {
  TripleHelixComputed,
  ObservationData,
} from "@/lib/triple-helix-observations";

interface MuNotes {
  a: string | null;
  i: string | null;
  g: string | null;
}

interface Props {
  helix: TripleHelixComputed | null;
  alphaSigma: number;
  /** amd_score_inputs.mu_notes JSONB の中身。各 μ の評価根拠を MuChip 直下に表示する */
  muNotes?: MuNotes;
  /** μ_X (X=A/I/G) のチップをクリックしたとき: Tsukuyomi prefill 起動 */
  onMuClick?: (axis: "A" | "I" | "G") => void;
}

const FORMAT_NUM = (n: number, digits = 2) =>
  n < 1 ? n.toFixed(digits) : n < 100 ? n.toFixed(2) : Math.round(n).toLocaleString();

export function TripleHelixMatrix({ helix, alphaSigma, muNotes, onMuClick }: Props) {
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
      {/* === μ 値カード × 3 + σ_SU + M === */}
      <ValueLadder
        muA={helix.mu_a}
        muI={helix.mu_i}
        muG={helix.mu_g}
        sigmaSu={helix.sigma_su}
        M={M}
        alphaSigma={alphaSigma}
        muNotes={muNotes}
        onMuClick={onMuClick}
      />

      {/* === 6×3 観測モデル C 行列 + 観測値 === */}
      <CMatrixTable observations={helix.observations} />

      {/* === 被覆率 === */}
      <CoverageNote coverage={helix.coverage} lane={helix.lane} />
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
  muNotes,
  onMuClick,
}: {
  muA: number;
  muI: number;
  muG: number;
  sigmaSu: number;
  M: number;
  alphaSigma: number;
  muNotes?: MuNotes;
  onMuClick?: (axis: "A" | "I" | "G") => void;
}) {
  return (
    <div className="flex flex-col items-stretch gap-2">
      <div className="grid grid-cols-3 gap-2">
        <MuChip
          label="μ_A"
          subtitle="学 (Academia)"
          value={muA}
          color="emerald"
          note={muNotes?.a ?? null}
          onClick={onMuClick ? () => onMuClick("A") : undefined}
        />
        <MuChip
          label="μ_I"
          subtitle="産 (Industry)"
          value={muI}
          color="amber"
          note={muNotes?.i ?? null}
          onClick={onMuClick ? () => onMuClick("I") : undefined}
        />
        <MuChip
          label="μ_G"
          subtitle="官 (Government)"
          value={muG}
          color="indigo"
          note={muNotes?.g ?? null}
          onClick={onMuClick ? () => onMuClick("G") : undefined}
        />
      </div>
      <div className="flex items-center justify-center gap-1 text-slate-500 text-[11px]">
        <span>↓</span>
        <Tex tex={String.raw`\sigma_{\mathrm{SU}} = \sqrt[3]{(\mu_A+1)(\mu_I+1)(\mu_G+1)} - 1`} />
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-center text-sm">
        <Tex tex={String.raw`\sigma_{\mathrm{SU}} = `} />
        <span className="ml-1 font-mono text-base font-semibold tabular-nums text-slate-900">
          {FORMAT_NUM(sigmaSu, 2)}
        </span>
        <span className="ml-2 text-[10px] text-slate-500">(0-9 スケール)</span>
      </div>
      <div className="flex items-center justify-center gap-1 text-slate-500 text-[11px]">
        <span>↓</span>
        <Tex tex={String.raw`M = (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}`} />
        <span className="text-[10px]">(α_σ = {alphaSigma.toFixed(2)})</span>
      </div>
      <div className="rounded-md border border-sky-200 bg-sky-50 p-2 text-center text-sm">
        <span className="text-slate-600">M = </span>
        <span className="font-mono text-lg font-bold tabular-nums text-sky-700">
          {FORMAT_NUM(M, 2)}
        </span>
      </div>
    </div>
  );
}

const MU_COLORS: Record<string, { bg: string; text: string; border: string; chip: string }> = {
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    chip: "text-emerald-800",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    chip: "text-amber-800",
  },
  indigo: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    chip: "text-indigo-800",
  },
};

function MuChip({
  label,
  subtitle,
  value,
  color,
  note,
  onClick,
}: {
  label: string;
  subtitle: string;
  value: number;
  color: keyof typeof MU_COLORS;
  note: string | null;
  onClick?: () => void;
}) {
  const c = MU_COLORS[color];
  const Wrapper: React.ElementType = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-md border ${c.border} ${c.bg} p-2 text-left ${onClick ? "cursor-pointer hover:brightness-95 active:brightness-90" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className={`font-bold ${c.chip}`}>{label}</span>
        <span className="text-[10px] text-slate-500">{subtitle}</span>
      </div>
      <div className={`mt-0.5 font-mono text-xl font-bold tabular-nums ${c.chip}`}>
        {FORMAT_NUM(value, 2)}
        <span className="ml-1 text-[10px] font-normal text-slate-500">/ 9.0</span>
      </div>
      {/* 評価根拠 (mu_notes) — 2026-05-27 追加 */}
      {note ? (
        <div className={`mt-1 text-[10px] leading-snug ${c.text} italic line-clamp-3`} title={note}>
          {note}
        </div>
      ) : (
        <div className="mt-1 text-[10px] leading-snug text-slate-400 italic">
          根拠未入力{onClick ? " (クリックで記入)" : ""}
        </div>
      )}
      {onClick && (
        <div className="mt-1 text-[9px] text-slate-400">💬 クリックで修正依頼</div>
      )}
    </Wrapper>
  );
}

// =====================================================================
// C 行列 6×3 + 観測値テーブル
// =====================================================================

function CMatrixTable({ observations }: { observations: ObservationData[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">観測量</th>
            <th className="px-2 py-1.5 text-center font-medium">
              <span className="text-emerald-700">c → μ_A</span>
            </th>
            <th className="px-2 py-1.5 text-center font-medium">
              <span className="text-amber-700">c → μ_I</span>
            </th>
            <th className="px-2 py-1.5 text-center font-medium">
              <span className="text-indigo-700">c → μ_G</span>
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
      <p className="px-2 py-1.5 text-[10px] text-slate-500">
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
      className={`border-t border-slate-200 ${
        unavailable ? "bg-slate-50" : ""
      }`}
    >
      <td className="px-2 py-1.5">
        <div className="font-mono font-semibold text-slate-800">
          {data.observation}
        </div>
        <div className="text-[10px] leading-tight text-slate-500">
          {loading.description.split(":")[0]}
        </div>
      </td>
      <LoadingCell loading={loading.mu_a} contribution={contribution.mu_a} normalized={normalized} hue="emerald" />
      <LoadingCell loading={loading.mu_i} contribution={contribution.mu_i} normalized={normalized} hue="amber" />
      <LoadingCell loading={loading.mu_g} contribution={contribution.mu_g} normalized={normalized} hue="indigo" />
      <td className="px-2 py-1.5">
        {unavailable ? (
          <span className="text-[10px] italic text-slate-400">
            未取得 ({loading.data_source})
          </span>
        ) : (
          <div>
            <span className="font-mono tabular-nums text-slate-800">
              {current_value!.toLocaleString()}
            </span>
            <span className="ml-1 text-[10px] text-slate-500">{loading.unit}</span>
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
    emerald: (a) => `rgba(16, 185, 129, ${a * 0.32})`,
    amber: (a) => `rgba(245, 158, 11, ${a * 0.32})`,
    indigo: (a) => `rgba(99, 102, 241, ${a * 0.32})`,
  };
  const tooltip =
    normalized == null
      ? `c = ${loading.toFixed(2)} (観測量未取得)`
      : `c = ${loading.toFixed(2)}, ỹ = ${normalized.toFixed(2)}, c·ỹ = ${contribution.toFixed(2)}`;
  return (
    <td
      className="px-2 py-1.5 text-center font-mono text-xs tabular-nums text-slate-800"
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
      <span className="font-mono text-[11px] tracking-tighter text-emerald-700">
        {"▓".repeat(filled)}
        <span className="text-slate-300">{"░".repeat(empty)}</span>
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
    <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
      データ被覆率: <strong>{coverage.covered} / {coverage.total}</strong> ({pct}%)
      &nbsp;|&nbsp; lane = <code className="font-mono">{lane}</code>
      &nbsp;|&nbsp;
      <span className="text-amber-700">
        欠落観測量は Phase 2 (KAKEN / Crunchbase / project_ventures 集計) で順次取得予定
      </span>
    </div>
  );
}
