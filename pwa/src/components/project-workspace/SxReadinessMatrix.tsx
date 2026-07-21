"use client";

import type { SxManagementBundle, SxPartnerStage } from "@/lib/sx-management";
import { sxFormatDate, sxIsMissingOwner } from "./sx-visual-shared";

const FACETS = [
  { key: "owner", label: "担当" },
  { key: "due", label: "期限" },
  { key: "completion", label: "完了条件" },
  { key: "kpi", label: "KPI" },
  { key: "evidence", label: "根拠" },
] as const;

const PARTNER_STAGE_ORDER: SxPartnerStage[] = [
  "candidate",
  "information_exchange",
  "condition_alignment",
  "meeting_coordination",
  "validation_preparation",
  "agreement_confirmation",
  "executing",
  "on_hold",
];

const PARTNER_STAGE_LABEL: Record<SxPartnerStage, string> = {
  candidate: "候補",
  information_exchange: "情報交換",
  condition_alignment: "条件整理",
  meeting_coordination: "面談調整",
  validation_preparation: "検証準備",
  agreement_confirmation: "合意確認",
  executing: "実行中",
  on_hold: "保留",
};

function Valve({ filled, label }: { filled: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <span className={`h-3 w-3 rounded-full border-2 ${filled ? "border-[#38745d] bg-[#38745d]" : "border-[#b8b5c8] bg-transparent"}`} aria-hidden="true" />
      <span className="sr-only">{label}: {filled ? "確認済み" : "未確認"}</span>
    </span>
  );
}

type DueState = "confirmed" | "provisional" | "missing";

function DueValve({ state }: { state: DueState }) {
  const label = state === "confirmed" ? "期限: 確定" : state === "provisional" ? "期限: 仮置き" : "期限: 未確認";
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <span
        className={`h-3 w-3 rounded-full border-2 ${
          state === "confirmed" ? "border-[#38745d] bg-[#38745d]" : state === "provisional" ? "border-dashed border-[#bf7b2c] bg-transparent" : "border-[#b8b5c8] bg-transparent"
        }`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function SxReadinessMatrix({ management }: { management: SxManagementBundle }) {
  const rows = management.tracks.map((track) => {
    const milestone = track.milestoneId ? management.milestones.find((item) => item.id === track.milestoneId) : undefined;
    const kpiForTrack = management.kpis.filter((kpi) => kpi.track === track.key);
    const dueState: DueState = !track.plannedEnd || !track.forecastEnd ? "missing" : (milestone?.dateCertainty ?? track.dateCertainty) === "confirmed" ? "confirmed" : "provisional";
    const cells = {
      owner: !sxIsMissingOwner(track.ownerLabel),
      completion: Boolean(milestone?.completionCriteria && !milestone.completionCriteria.includes("未確認")),
      kpi: kpiForTrack.some((kpi) => kpi.actual != null && Boolean(kpi.measurementDate)),
      evidence: Boolean(track.lastVerifiedAt) && track.confidence !== "unknown",
    };
    return { track, cells, dueState };
  });

  const partners = management.partners;
  const roles = management.organizationRoles;

  return (
    <section className="rounded-xl border border-[#d6cebf] bg-[#fffdf7]/95 p-4 sm:p-5" aria-labelledby="readiness-matrix-heading">
      <p className="text-[10px] font-semibold tracking-[0.16em] text-[#38745d]">弁充足マトリクス / 外部・内部レディネス</p>
      <h2 id="readiness-matrix-heading" className="mt-1 text-base font-semibold text-[#24231f]">4柱の弁充足と協力機関・体制の現在地</h2>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-xs">
          <thead>
            <tr className="border-y border-[#d6cebf] bg-[#f8f5ec] text-left text-[10px] font-semibold text-[#777166]">
              <th className="px-3 py-2">柱</th>
              {FACETS.map((facet) => <th key={facet.key} className="px-3 py-2 text-center">{facet.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ track, cells, dueState }) => (
              <tr key={track.key} className="border-b border-[#e4ddd0]">
                <td className="px-3 py-2.5 font-semibold text-[#24231f]"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: track.accent }} aria-hidden="true" />{track.label}</td>
                {FACETS.map((facet) => <td key={facet.key} className="px-3 py-2.5 text-center">{facet.key === "due" ? <DueValve state={dueState} /> : <Valve filled={cells[facet.key]} label={facet.label} />}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-[#777166]">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#38745d] bg-[#38745d]" aria-hidden="true" />期限: 確定</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-dashed border-[#bf7b2c]" aria-hidden="true" />期限: 仮置き</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#b8b5c8]" aria-hidden="true" />未確認</span>
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold text-[#24231f]">協力機関の段階</h3>
          <ol className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-semibold text-[#777166]" aria-label="協力機関の関係段階（候補から実行中・保留まで）">
            {PARTNER_STAGE_ORDER.map((stage) => <li key={stage} className="rounded-full border border-[#e4ddd0] bg-[#f8f5ec] px-2 py-1">{PARTNER_STAGE_LABEL[stage]}</li>)}
          </ol>
          <div className="mt-3 space-y-2">
            {partners.length === 0 && <p className="rounded-lg border border-dashed border-[#d6cebf] p-3 text-[11px] text-[#777166]">協力機関はまだ未確認だよ。</p>}
            {partners.map((partner) => (
              <div key={partner.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e4ddd0] bg-[#f8f5ec] px-3 py-2">
                <div className="min-w-0"><p className="truncate text-[11px] font-semibold text-[#24231f]">{partner.name}</p><p className="text-[10px] text-[#777166]">{partner.roleLabel}</p></div>
                <span className="shrink-0 rounded-full border border-[#b7c8d2] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#315f7d]">{PARTNER_STAGE_LABEL[partner.relationshipStage]}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-[#24231f]">必須役割の充足</h3>
          <div className="mt-2 space-y-2">
            {roles.filter((role) => role.required).length === 0 && <p className="rounded-lg border border-dashed border-[#d6cebf] p-3 text-[11px] text-[#777166]">必須役割はまだ未確認だよ。</p>}
            {roles.filter((role) => role.required).map((role) => (
              <div key={role.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#c9bfd0] bg-[#f1edf3] px-3 py-2 text-[11px]">
                <div className="min-w-0"><p className="truncate font-semibold text-[#5f4a66]">{role.roleName}</p><p className="text-[10px] text-[#76637b]">{role.candidate || "候補未確認"} / 期限 {sxFormatDate(role.dueDate)}</p></div>
                <Valve filled={!role.vacancy} label={role.vacancy ? "空席" : "充足"} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
