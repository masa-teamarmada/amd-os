"use client";

import type { SxManagementBundle } from "@/lib/sx-management";
import {
  computeSxProofOutcomes,
  sxProofThemeMatrix,
  SX_PROOF_DEFINITIONS,
  type SxProofId,
} from "@/lib/sx-proof-mapping";
import { sxFormatDate } from "./sx-visual-shared";

const STATUS_ORDER = ["on_track", "attention", "blocked", "unassessed"] as const;
const STATUS_LABEL: Record<string, string> = { on_track: "順調", attention: "要確認", blocked: "停止", unassessed: "未評価" };
// unassessed はバーへ塗らない（0評価の満杆誤読を作らない）。トラック地のままにし、件数だけで示す。
const STATUS_BAR_TONE: Record<string, string> = { on_track: "#38745d", attention: "#bf7b2c", blocked: "#9f3030" };

function StatusDistribution({ statusCounts, totalCount }: { statusCounts: Record<string, number>; totalCount: number }) {
  if (totalCount === 0) return <p className="text-[10px] text-[#5f5a4d]">関連テーマ未接続</p>;
  return (
    <div className="flex h-2 w-full max-w-[120px] overflow-hidden rounded-full bg-[#eee9df]" role="img" aria-label={STATUS_ORDER.map((key) => `${STATUS_LABEL[key]} ${statusCounts[key] || 0}件`).join(" / ")}>
      {STATUS_ORDER.map((key) => {
        const count = statusCounts[key] || 0;
        if (count === 0 || key === "unassessed") return null;
        return <span key={key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(count / totalCount) * 100}%`, background: STATUS_BAR_TONE[key] }} />;
      })}
    </div>
  );
}

const PROOF_HEADER_LABEL: Record<SxProofId, string> = Object.fromEntries(SX_PROOF_DEFINITIONS.map((definition) => [definition.id, definition.label])) as Record<SxProofId, string>;

function ProofMatrix() {
  const rows = sxProofThemeMatrix();
  return (
    <div className="overflow-x-auto rounded-lg border border-[#ada18a] bg-white" data-testid="sx-proof-theme-matrix">
      <table className="w-full min-w-[420px] border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-[#ada18a] bg-[#f2eee0] text-left text-[9px] font-semibold text-[#5f5a4d]">
            <th className="px-2.5 py-2">開発テーマ</th>
            {SX_PROOF_DEFINITIONS.map((definition) => <th key={definition.id} className="px-2.5 py-2 text-center leading-3">{PROOF_HEADER_LABEL[definition.id]}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slug} className="border-b border-[#d5cdba] last:border-b-0">
              <td className="px-2.5 py-2 font-semibold text-[#24231f]">{row.label}</td>
              {SX_PROOF_DEFINITIONS.map((definition) => (
                <td key={definition.id} className="px-2.5 py-2 text-center">
                  {row.proofs[definition.id]
                    ? <span className="mx-auto inline-block h-2.5 w-2.5 rounded-full bg-[#38745d]" role="img" aria-label={`${row.label}は${PROOF_HEADER_LABEL[definition.id]}へ接続`} />
                    : <span className="mx-auto inline-block h-2.5 w-2.5 rounded-full border border-[#ada18a]" role="img" aria-label={`${row.label}は${PROOF_HEADER_LABEL[definition.id]}へ未接続`} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 三つの証明ストリップ。カード3枚（1枚8行で実質2データ）をやめ、1証明=1行で 判断期限 / 関連
 * テーマ評価 / 状態分布 / 固有の不足 だけを並べる。3枚で一字一句同文だった不足は共通バナー1行へ
 * 畳み、週次で変化しない7×3接続マトリクスは既定閉の付録に置く。
 */
export function SxProofOutcomes({ management }: { management: SxManagementBundle }) {
  const outcomes = computeSxProofOutcomes(management);

  // 全証明に共通する不足は1回だけ言う（同文3連発の赤字を作らない）。
  const sharedMissing = outcomes.length > 0
    ? outcomes[0].missingInfo.filter((item) => outcomes.every((outcome) => outcome.missingInfo.includes(item)))
    : [];

  return (
    <section className="mt-2 overflow-hidden rounded-lg border border-[#a69b84] bg-[#fffdf7] p-3 sm:p-4" aria-labelledby="sx-proof-outcomes-heading" data-testid="sx-proof-outcomes">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="sx-proof-outcomes-heading" className="text-sm font-semibold text-[#24231f]">三つの証明 — オンサイトPoCへの実証経路</h2>
        <p className="text-[10px] text-[#5a574c]">TRL5は達成状態を要約する補助ラベル。主経路はこの三つ。</p>
      </div>
      <p className="mt-1 text-[10px] leading-4 text-[#5a574c]" data-testid="sx-proof-positioning">
        位置づけ: 論点・仮説台帳は「何を判断するか」を扱う経営の検証ループ（4本柱すべてが対象）。この面はその技術開発版で、オンサイトPoCへ進む条件を「何を証明できたか」で管理する。実験・検証の結果は下の7テーマの証拠・技術試験としてここへ接続され、3つ揃うと設立の技術側の前提が立つ。
      </p>

      <ul className="mt-2 divide-y divide-[#eee9df] border-y border-[#c5bba5]">
        {outcomes.map((outcome) => {
          const uniqueMissing = outcome.missingInfo.filter((item) => !sharedMissing.includes(item));
          return (
            <li key={outcome.id} className="grid min-h-11 grid-cols-1 items-center gap-x-3 gap-y-1 py-1.5 md:grid-cols-[minmax(0,1.4fr)_110px_minmax(0,1fr)_minmax(0,1.2fr)]" data-testid={`sx-proof-card-${outcome.id}`}>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-[#24231f]" title={outcome.completionCriteria}>{outcome.label}</p>
              </div>
              <p className="text-[11px] text-[#514e47]">期限 <span className="font-semibold text-[#24231f]">{sxFormatDate(outcome.deadline, "未登録")}</span></p>
              <div className="flex min-w-0 items-center gap-2 text-[10px] text-[#5a574c]">
                <span className="shrink-0">評価 {outcome.assessedCount}/{outcome.totalCount}</span>
                <StatusDistribution statusCounts={outcome.statusCounts} totalCount={outcome.totalCount} />
                <span className="shrink-0">充足 {outcome.evidenceCoveragePct == null ? "未評価" : `${outcome.evidenceCoveragePct}%`}</span>
              </div>
              <p className="min-w-0 truncate text-[10px] text-[#5a574c]" title={uniqueMissing.join(" / ") || outcome.themeLabels.join(" / ")}>
                {uniqueMissing.length > 0 ? `固有の不足: ${uniqueMissing.join(" / ")}` : `接続テーマ: ${outcome.themeLabels.join(" / ") || "未接続"}`}
              </p>
            </li>
          );
        })}
      </ul>

      {sharedMissing.length > 0 && (
        <p className="mt-1.5 text-[10px] text-[#5a574c]" data-testid="sx-proof-shared-missing">
          三証明に共通の不足: <span className="font-semibold text-[#514e47]">{sharedMissing.join(" ・ ")}</span>（解消は下の7テーマ表と次の経営介入から）
        </p>
      )}

      <details className="mt-2">
        <summary className="flex min-h-11 cursor-pointer select-none items-center text-[11px] font-semibold text-[#514e47] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]">開発テーマ × 三つの証明 接続マトリクス（7×3）を表示 — 週次で変わらない設計情報</summary>
        <div className="mt-1.5"><ProofMatrix /></div>
      </details>
    </section>
  );
}
