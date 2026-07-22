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
const STATUS_BAR_TONE: Record<string, string> = { on_track: "#38745d", attention: "#bf7b2c", blocked: "#9f3030", unassessed: "#b8b5c8" };

function StatusDistribution({ statusCounts, totalCount }: { statusCounts: Record<string, number>; totalCount: number }) {
  if (totalCount === 0) return <p className="text-[10px] text-[#777166]">関連テーマ未接続</p>;
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#eee9df]" role="img" aria-label={STATUS_ORDER.map((key) => `${STATUS_LABEL[key]} ${statusCounts[key] || 0}件`).join(" / ")}>
        {STATUS_ORDER.map((key) => {
          const count = statusCounts[key] || 0;
          if (count === 0) return null;
          return <span key={key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(count / totalCount) * 100}%`, background: STATUS_BAR_TONE[key] }} />;
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-[#69665d]">
        {STATUS_ORDER.filter((key) => (statusCounts[key] || 0) > 0).map((key) => (
          <span key={key} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_BAR_TONE[key] }} aria-hidden="true" />{STATUS_LABEL[key]} {statusCounts[key]}</span>
        ))}
      </div>
    </div>
  );
}

function ProofCard({ outcome }: { outcome: ReturnType<typeof computeSxProofOutcomes>[number] }) {
  const coverageLabel = outcome.evidenceCoveragePct == null ? "未評価" : `${outcome.evidenceCoveragePct}%`;
  return (
    <article className="min-w-0 rounded-lg border border-[#cfc7b9] bg-white p-3" data-testid={`sx-proof-card-${outcome.id}`}>
      <p className="text-[9px] font-semibold tracking-[0.12em] text-[#38745d]">三つの証明</p>
      <h3 className="mt-0.5 text-[13px] font-semibold leading-4 text-[#24231f]">{outcome.label}</h3>
      <p className="mt-1.5 line-clamp-2 text-[10px] leading-4 text-[#777166]">{outcome.completionCriteria}</p>
      <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
        <div>
          <p className="font-semibold text-[#777166]">証拠充足</p>
          <p className={`mt-0.5 text-sm font-semibold ${outcome.evidenceCoveragePct == null ? "text-[#55506d]" : "text-[#24231f]"}`}>{coverageLabel}</p>
        </div>
        <div>
          <p className="font-semibold text-[#777166]">判断期限</p>
          <p className="mt-0.5 text-sm font-semibold text-[#24231f]">{sxFormatDate(outcome.deadline, "未登録")}</p>
        </div>
      </div>
      <div className="mt-2.5">
        <p className="text-[10px] font-semibold text-[#777166]">関連テーマ {outcome.assessedCount}/{outcome.totalCount} 評価済み</p>
        <div className="mt-1"><StatusDistribution statusCounts={outcome.statusCounts} totalCount={outcome.totalCount} /></div>
      </div>
      <div className="mt-2.5 border-t border-[#eee9df] pt-2">
        <p className="text-[10px] font-semibold text-[#777166]">接続テーマ</p>
        <p className="mt-0.5 text-[10px] leading-4 text-[#514e47]">{outcome.themeLabels.join(" / ") || "未接続"}</p>
      </div>
      {outcome.missingInfo.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-[#eee9df] pt-2 text-[10px] leading-4 text-[#8c3329]">
          {outcome.missingInfo.map((item) => <li key={item}>不足: {item}</li>)}
        </ul>
      )}
    </article>
  );
}

const PROOF_HEADER_LABEL: Record<SxProofId, string> = Object.fromEntries(SX_PROOF_DEFINITIONS.map((definition) => [definition.id, definition.label])) as Record<SxProofId, string>;

function ProofMatrix() {
  const rows = sxProofThemeMatrix();
  return (
    <div className="overflow-x-auto rounded-lg border border-[#d6cebf] bg-white" data-testid="sx-proof-theme-matrix">
      <table className="w-full min-w-[420px] border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-[#d6cebf] bg-[#f8f5ec] text-left text-[9px] font-semibold text-[#777166]">
            <th className="px-2.5 py-2">開発テーマ</th>
            {SX_PROOF_DEFINITIONS.map((definition) => <th key={definition.id} className="px-2.5 py-2 text-center leading-3">{PROOF_HEADER_LABEL[definition.id]}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slug} className="border-b border-[#eee9df] last:border-b-0">
              <td className="px-2.5 py-2 font-semibold text-[#24231f]">{row.label}</td>
              {SX_PROOF_DEFINITIONS.map((definition) => (
                <td key={definition.id} className="px-2.5 py-2 text-center">
                  {row.proofs[definition.id]
                    ? <span className="mx-auto inline-block h-2.5 w-2.5 rounded-full bg-[#38745d]" role="img" aria-label={`${row.label}は${PROOF_HEADER_LABEL[definition.id]}へ接続`} />
                    : <span className="mx-auto inline-block h-2.5 w-2.5 rounded-full border border-[#d6cebf]" role="img" aria-label={`${row.label}は${PROOF_HEADER_LABEL[definition.id]}へ未接続`} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SxProofOutcomes({ management }: { management: SxManagementBundle }) {
  const outcomes = computeSxProofOutcomes(management);
  return (
    <section className="mt-2 overflow-hidden rounded-lg border border-[#cfc7b9] bg-[#fffdf7] p-3 sm:p-4" aria-labelledby="sx-proof-outcomes-heading" data-testid="sx-proof-outcomes">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[9px] font-semibold tracking-[0.15em] text-[#38745d]">オンサイトPoCへの実証経路</p>
          <h2 id="sx-proof-outcomes-heading" className="mt-0.5 text-sm font-semibold text-[#24231f]">PoC受入条件・原価前提 → 7つの開発テーマ → 三つの証明 → NewCo条件 → 設立判断</h2>
        </div>
        <p className="text-[10px] text-[#69665d]">TRL5は達成状態を要約する補助ラベル。主経路は下の三つの証明。</p>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {outcomes.map((outcome) => <ProofCard key={outcome.id} outcome={outcome} />)}
      </div>
      <div className="mt-3">
        <p className="text-[10px] font-semibold text-[#777166]">開発テーマ × 三つの証明 接続マトリクス（7×3）</p>
        <div className="mt-1.5"><ProofMatrix /></div>
      </div>
    </section>
  );
}
