"use client";

import type { SxManagementBundle } from "@/lib/sx-management";
import { SxBadge, sxFormatDate, sxPartnerDisplay } from "./sx-visual-shared";

const STAGE_LABEL: Record<string, string> = {
  candidate: "候補", information_exchange: "情報交換", condition_alignment: "条件整理",
  meeting_coordination: "面談調整", validation_preparation: "検証準備", agreement_confirmation: "合意確認",
  executing: "実行中", on_hold: "保留",
};

const STAGE_ORDER = [
  "candidate",
  "information_exchange",
  "meeting_coordination",
  "condition_alignment",
  "validation_preparation",
  "agreement_confirmation",
  "executing",
] as const;

function PartnerStageRail({ stage }: { stage: string }) {
  const currentIndex = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  const onHold = stage === "on_hold";
  return (
    <div className="mt-1" role="img" aria-label={`関係段階 ${STAGE_LABEL[stage] || "未設定"}`}>
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {STAGE_ORDER.map((item, index) => (
          <span
            key={item}
            className={`h-1.5 flex-1 rounded-full ${
              onHold
                ? "bg-[#d6cebf]"
                : index === currentIndex
                  ? "bg-[#315f7d]"
                  : index < currentIndex
                    ? "bg-[#b7c8d2]"
                    : "bg-[#e8e2d6]"
            }`}
          />
        ))}
      </div>
      <p className={`mt-0.5 text-[9px] font-semibold ${onHold ? "text-[#777166]" : "text-[#315f7d]"}`}>
        {STAGE_LABEL[stage] || "未設定"}
      </p>
    </div>
  );
}

const AGREEMENT_TONE: Record<string, string> = {
  agreed: "border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]",
  partial: "border-[#e3c994] bg-[#fbf1dc] text-[#765022]",
  unagreed: "border-[#e4a39b] bg-[#f9e4e1] text-[#8c3329]",
};

const AGREEMENT_LABEL: Record<string, string> = { agreed: "合意済み", partial: "一部合意", unagreed: "未合意" };

/** relationshipStage → nextCommitment(dueDate) pipeline, sorted by due date. Excludes low-priority ファインケム from the primary view (spec 3.5 / .interface-design追補). */
export function SxPartnerPipeline({ management }: { management: SxManagementBundle }) {
  const milestoneLabel = (slug: string) => management.milestones.find((item) => item.slug === slug)?.title || null;
  const rows = management.partners
    .map((partner) => ({ partner, display: sxPartnerDisplay(partner) }))
    .filter(({ display }) => !display.lowPriority)
    .map(({ partner, display }) => ({
      partner, display,
      gate: partner.relatedMilestoneSlugs.map(milestoneLabel).find((label): label is string => Boolean(label)) || "関連ゲート 未接続",
    }))
    .sort((a, b) => (a.partner.dueDate || "9999-12-31").localeCompare(b.partner.dueDate || "9999-12-31"));
  const deferred = management.partners.filter((partner) => sxPartnerDisplay(partner).lowPriority);

  return (
    <div className="overflow-hidden rounded-lg border border-[#d6cebf] bg-[#fffdf7]" data-testid="sx-partner-pipeline">
      <div className="border-b border-[#e4ddd0] bg-[#f8f5ec] px-3 py-2">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">現在地 → 期限付きの次の状態</p>
        <h3 className="mt-0.5 text-sm font-semibold text-[#24231f]">協力機関パイプライン（重要経路・期限順）</h3>
      </div>
      {rows.length === 0 && <p className="px-3 py-6 text-center text-xs text-[#777166]">重要経路の協力機関はまだ登録されてないよ。</p>}
      <div className="hidden divide-y divide-[#eee9df] lg:block">
        <div className="grid grid-cols-[150px_112px_84px_1fr_1fr_150px] gap-x-3 border-b border-[#e4ddd0] bg-[#f8f5ec] px-3 py-1.5 text-[9px] font-semibold text-[#777166]">
          <span>機関 / 役割</span><span>現在地</span><span>合意</span><span>合意済み / 未合意</span><span>次の約束（期限・接点）</span><span>担当 / 関連ゲート</span>
        </div>
        {rows.map(({ partner, display, gate }) => (
          <div key={partner.id} className="grid grid-cols-[150px_112px_84px_1fr_1fr_150px] gap-x-3 px-3 py-2.5 text-[11px] leading-4">
            <div className="min-w-0"><p className="truncate font-semibold text-[#24231f]">{display.name}</p><p className="truncate text-[10px] text-[#777166]">{partner.roleLabel}</p></div>
            <div><PartnerStageRail stage={partner.relationshipStage} /></div>
            <div><SxBadge tone={AGREEMENT_TONE[partner.agreementState]}>{AGREEMENT_LABEL[partner.agreementState]}</SxBadge></div>
            <div className="min-w-0"><p className="truncate text-[#514e47]">合意: {partner.agreedScope || "未登録"}</p><p className="truncate text-[#8c3329]">未合意: {partner.unagreedScope || "未登録"}</p></div>
            <div className="min-w-0"><p className="truncate text-[#514e47]">{partner.nextCommitment || "未登録"}</p><p className="truncate text-[10px] text-[#777166]">期限 {sxFormatDate(partner.dueDate)} / 接点 {sxFormatDate(partner.lastContactDate)}</p></div>
            <div className="min-w-0 text-[10px] text-[#777166]"><p className={`truncate font-semibold ${partner.ownerLabel.includes("未確認") ? "text-[#8c3329]" : "text-[#514e47]"}`}>{partner.ownerLabel}</p><p className="truncate">{gate}</p></div>
          </div>
        ))}
      </div>
      <div className="space-y-2 p-2.5 lg:hidden">
        {rows.map(({ partner, display, gate }) => (
          <article key={partner.id} className="rounded-md border border-[#e4ddd0] bg-[#f8f5ec] p-2.5 text-[11px] leading-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><p className="truncate font-semibold text-[#24231f]">{display.name}</p><p className="truncate text-[10px] text-[#777166]">{partner.roleLabel}</p></div>
              <SxBadge tone={AGREEMENT_TONE[partner.agreementState]}>{AGREEMENT_LABEL[partner.agreementState]}</SxBadge>
            </div>
            <PartnerStageRail stage={partner.relationshipStage} />
            <p className="mt-1 text-[10px] font-semibold text-[#315f7d]">→ {partner.nextCommitment || "次の状態 未登録"}</p>
            <p className="mt-1 text-[10px] text-[#777166]">期限 {sxFormatDate(partner.dueDate)} / 接点 {sxFormatDate(partner.lastContactDate)}</p>
            <p className="mt-1 truncate text-[#514e47]">合意: {partner.agreedScope || "未登録"}</p>
            <p className="mt-0.5 truncate text-[#8c3329]">未合意: {partner.unagreedScope || "未登録"}</p>
            <p className="mt-1 text-[10px] text-[#777166]">担当 {partner.ownerLabel} / {gate}</p>
          </article>
        ))}
      </div>
      {deferred.length > 0 && <p className="border-t border-[#e4ddd0] px-3 py-2 text-[10px] text-[#777166]">優先度低・保留（重要経路外）: {deferred.map((partner) => sxPartnerDisplay(partner).name).join(" / ")}</p>}
    </div>
  );
}
