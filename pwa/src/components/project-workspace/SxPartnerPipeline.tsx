"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { SxManagementBundle, SxManagementPartner, SxPartnerInteraction } from "@/lib/sx-management";
import {
  SxBadge,
  sxBallSideLabel,
  sxFormatDate,
  sxFormatDueDateWithPrecision,
  sxFormatEventDateWithPrecision,
  sxInteractionKindLabel,
  sxLatestInteraction,
  sxPartnerDisplay,
  sxSortInteractionsByRecency,
} from "./sx-visual-shared";

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
    <div role="img" aria-label={`関係段階 ${STAGE_LABEL[stage] || "未設定"}`}>
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

const BALL_SIDE_TONE: Record<string, string> = {
  sx: "border-[#b7c8d2] bg-[#eef3f5] text-[#315f7d]",
  partner: "border-[#e3c994] bg-[#fbf1dc] text-[#765022]",
  shared: "border-[#c9bfd0] bg-[#f1edf3] text-[#5f4a66]",
  none: "border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]",
  unknown: "border-[#b8b5c8] bg-[#eeedf4] text-[#55506d]",
};

const INTERACTION_KIND_TONE: Record<string, string> = {
  meeting: "border-[#b7c8d2] bg-[#eef3f5] text-[#315f7d]",
  email: "border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]",
  agreement: "border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]",
  deliverable: "border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]",
  handoff: "border-[#e3c994] bg-[#fbf1dc] text-[#765022]",
  status_update: "border-[#c9bfd0] bg-[#f1edf3] text-[#5f4a66]",
  note: "border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]",
};

function isDueUnset(partner: SxManagementPartner) {
  return partner.dueDate == null || partner.dueDatePrecision === "unknown";
}

function InteractionHistoryPanel({
  partner,
  canManage,
  onEditInteraction,
  onAddInteraction,
}: {
  partner: SxManagementPartner;
  canManage: boolean;
  onEditInteraction?: (interactionId: string) => void;
  onAddInteraction?: (partnerId: string) => void;
}) {
  const sorted = sxSortInteractionsByRecency(partner.interactions);
  return (
    <div className="mt-3 border-t border-[#e4ddd0] pt-3" id={`sx-partner-history-${partner.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">やり取り履歴（{sorted.length}件）</p>
        {canManage && (
          <button
            type="button"
            onClick={() => onAddInteraction?.(partner.id)}
            className="inline-flex min-h-11 items-center gap-1 rounded-md border border-[#cfc7b9] px-3 py-2 text-[11px] font-semibold text-[#514e47] hover:bg-[#f8f5ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />履歴を追加
          </button>
        )}
      </div>
      {sorted.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-[#d6cebf] p-3 text-[11px] text-[#777166]">やり取り履歴はまだないよ。</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {sorted.map((interaction) => (
            <li key={interaction.id} className="rounded-lg border border-[#e4ddd0] bg-[#f8f5ec] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <SxBadge tone={INTERACTION_KIND_TONE[interaction.interactionKind] || INTERACTION_KIND_TONE.note}>{sxInteractionKindLabel(interaction.interactionKind)}</SxBadge>
                  <span className="text-[10px] text-[#777166]">{sxFormatEventDateWithPrecision(interaction.occurredOn, interaction.occurredOnPrecision)}</span>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => onEditInteraction?.(interaction.id)}
                    aria-label={`${interaction.summary}を編集`}
                    className="inline-flex min-h-11 items-center gap-1 rounded-md border border-[#cfc7b9] px-2 py-1.5 text-[10px] font-semibold text-[#514e47] hover:bg-[#fffdf7]"
                  >
                    <Pencil className="h-3 w-3" aria-hidden="true" />編集
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs leading-5 text-[#24231f]">{interaction.summary}</p>
              {interaction.outcomeSummary && <p className="mt-1 text-[11px] leading-5 text-[#514e47]">{interaction.outcomeSummary}</p>}
              <p className="mt-2 text-[10px] text-[#777166]">
                以後のボール: <span className="font-semibold text-[#514e47]">{sxBallSideLabel(interaction.ballSideAfter)}</span>
                {interaction.ballOwnerAfter ? ` / ${interaction.ballOwnerAfter}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
      {partner.commitments.length > 0 && (
        <div className="mt-3 border-t border-[#e4ddd0] pt-3">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">約束・次アクション</p>
          <div className="mt-2 space-y-2">
            {partner.commitments.map((commitment) => (
              <div key={commitment.id} className="rounded-lg border border-[#e4ddd0] bg-white p-2.5 text-[11px] leading-5">
                <p className="font-semibold text-[#24231f]">{commitment.commitmentKind === "counterparty_promise" ? "相手の約束" : "SX側の次アクション"} / {commitment.title}</p>
                <p className="mt-1 text-[#69665d]">{commitment.commitmentText}</p>
                <p className="mt-1 text-[10px] text-[#777166]">
                  {commitment.commitmentKind === "counterparty_promise"
                    ? `相手 ${commitment.counterpartyOwner || "未確認"} / 約束日 ${sxFormatDate(commitment.promisedOn)}`
                    : `SX ${commitment.sxOwner || "未確認"}`}
                  {" / 期限 "}{sxFormatDate(commitment.dueDate)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** "最新記録" (latest record), not "最新イベント" (latest event): occurredOn may be unconfirmed, so
 * this is the most recently known-about interaction by recorded time, not a claim about which
 * event actually happened last (see sxLatestInteraction). */
function latestRecordSummary(interactions: SxPartnerInteraction[]) {
  const latest = sxLatestInteraction(interactions);
  if (!latest) return "履歴未登録";
  return `${sxInteractionKindLabel(latest.interactionKind)}: ${latest.summary}`;
}

/** relationshipStage → nextCommitment(dueDate) pipeline, sorted by due date. Excludes low-priority ファインケム from the primary view (spec 3.5 / .interface-design追補). */
export function SxPartnerPipeline({
  management,
  onEditPartner,
  onAddInteraction,
  onEditInteraction,
}: {
  management: SxManagementBundle;
  onEditPartner?: (partnerId: string) => void;
  onAddInteraction?: (partnerId: string) => void;
  onEditInteraction?: (interactionId: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
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

  const activeCount = rows.length;
  const partnerBallCount = rows.filter(({ partner }) => partner.currentBallSide === "partner").length;
  const sxBallCount = rows.filter(({ partner }) => partner.currentBallSide === "sx").length;
  const unknownBallCount = rows.filter(({ partner }) => partner.currentBallSide === "unknown").length;
  const dueUnsetCount = rows.filter(({ partner }) => isDueUnset(partner)).length;

  return (
    <div className="overflow-hidden rounded-lg border border-[#d6cebf] bg-[#fffdf7]" data-testid="sx-partner-pipeline">
      <div className="border-b border-[#e4ddd0] bg-[#f8f5ec] px-3 py-2">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">現在ボール → 期限付きの次の受け渡し</p>
        <h3 className="mt-0.5 text-sm font-semibold text-[#24231f]">関係先の現在ボールと次の受け渡し（重要経路・期限順）</h3>
        <div className="mt-2 flex flex-wrap gap-2" aria-label="協力機関の小集計">
          <SxBadge tone="border-[#d6cebf] bg-white text-[#514e47]">対応中 {activeCount}件</SxBadge>
          <SxBadge tone={BALL_SIDE_TONE.partner}>相手ボール {partnerBallCount}件</SxBadge>
          <SxBadge tone={BALL_SIDE_TONE.sx}>SXボール {sxBallCount}件</SxBadge>
          <SxBadge tone={unknownBallCount > 0 ? BALL_SIDE_TONE.unknown : "border-[#d6cebf] bg-white text-[#514e47]"}>ボール未確認 {unknownBallCount}件</SxBadge>
          <SxBadge tone={dueUnsetCount > 0 ? "border-[#e4a39b] bg-[#f9e4e1] text-[#8c3329]" : "border-[#d6cebf] bg-white text-[#514e47]"}>期限未設定 {dueUnsetCount}件</SxBadge>
        </div>
      </div>
      {rows.length === 0 && <p className="px-3 py-6 text-center text-xs text-[#777166]">重要経路の協力機関はまだ登録されてないよ。</p>}

      <div className="hidden xl:block">
        <div className="grid grid-cols-[124px_84px_60px_minmax(0,1fr)_minmax(0,1.35fr)_132px_minmax(0,1fr)_150px] gap-x-3 border-b border-[#e4ddd0] bg-[#f8f5ec] px-3 py-1.5 text-[9px] font-semibold text-[#777166]">
          <span>機関 / 役割</span><span>現在地</span><span>合意</span><span>現在ボール</span><span>次の受け渡し / 次の一手 / 目標状態</span><span>期限 / 最終接点</span><span>合意済み / 未合意</span><span>関連ゲート / 履歴</span>
        </div>
        {rows.map(({ partner, display, gate }) => {
          const expanded = expandedId === partner.id;
          return (
            <div key={partner.id} className="border-b border-[#eee9df]">
              <div className="grid grid-cols-[124px_84px_60px_minmax(0,1fr)_minmax(0,1.35fr)_132px_minmax(0,1fr)_150px] gap-x-3 px-3 py-2.5 text-[11px] leading-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#24231f]">{display.name}</p>
                  <p className="truncate text-[10px] text-[#777166]">{partner.roleLabel}</p>
                  {onEditPartner && management.canManage && (
                    <button type="button" onClick={() => onEditPartner(partner.id)} className="mt-1 inline-flex min-h-11 items-center gap-1 rounded-md border border-[#cfc7b9] px-2 py-1.5 text-[9px] font-semibold text-[#514e47] hover:bg-[#f8f5ec]">
                      <Pencil className="h-3 w-3" aria-hidden="true" />編集
                    </button>
                  )}
                </div>
                <div className="min-w-0"><PartnerStageRail stage={partner.relationshipStage} /></div>
                <div className="min-w-0"><SxBadge tone={AGREEMENT_TONE[partner.agreementState]}>{AGREEMENT_LABEL[partner.agreementState]}</SxBadge></div>
                <div className="min-w-0">
                  <SxBadge tone={BALL_SIDE_TONE[partner.currentBallSide]}>{sxBallSideLabel(partner.currentBallSide)}</SxBadge>
                  <p className="mt-1 truncate font-semibold text-[#24231f]">{partner.currentBallOwner || "担当未確認"}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[#315f7d]">→ {partner.nextBallOwner || "未確認"}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] font-semibold text-[#24231f]">次の一手: {partner.nextCommitment}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] text-[#777166]">目標状態: {partner.targetState || "未登録"}</p>
                </div>
                <div className="min-w-0">
                  <p className={isDueUnset(partner) ? "font-semibold text-[#8c3329]" : "text-[#514e47]"}>{sxFormatDueDateWithPrecision(partner.dueDate, partner.dueDatePrecision)}</p>
                  <p className="mt-1 truncate text-[10px] text-[#777166]">接点 {sxFormatDate(partner.lastContactDate)}</p>
                </div>
                <div className="min-w-0"><p className="truncate text-[#514e47]">合意: {partner.agreedScope || "未登録"}</p><p className="truncate text-[#8c3329]">未合意: {partner.unagreedScope || "未登録"}</p></div>
                <div className="min-w-0">
                  <p className="truncate text-[10px] text-[#777166]">{gate}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] text-[#514e47]">最新記録: {latestRecordSummary(partner.interactions)}</p>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`sx-partner-history-${partner.id}`}
                    onClick={() => setExpandedId(expanded ? null : partner.id)}
                    className="mt-1 inline-flex min-h-11 items-center gap-1 rounded-md border border-[#cfc7b9] px-2 py-1.5 text-[10px] font-semibold text-[#315f7d] hover:bg-[#eef3f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
                  >
                    履歴 {partner.interactions.length}件 {expanded ? "▾" : "▸"}
                  </button>
                </div>
              </div>
              {expanded && (
                <div className="px-3 pb-3">
                  <InteractionHistoryPanel partner={partner} canManage={management.canManage} onAddInteraction={onAddInteraction} onEditInteraction={onEditInteraction} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-2 p-2.5 xl:hidden">
        {rows.map(({ partner, display, gate }) => {
          const expanded = expandedId === partner.id;
          return (
            <article key={partner.id} className="rounded-md border border-[#e4ddd0] bg-[#f8f5ec] p-2.5 text-[11px] leading-4 md:grid md:grid-cols-2 md:gap-x-4 md:gap-y-3">
              <div className="flex items-start justify-between gap-2 md:col-span-2">
                <div className="min-w-0"><p className="truncate font-semibold text-[#24231f]">{display.name}</p><p className="truncate text-[10px] text-[#777166]">{partner.roleLabel}</p></div>
                <SxBadge tone={AGREEMENT_TONE[partner.agreementState]}>{AGREEMENT_LABEL[partner.agreementState]}</SxBadge>
              </div>
              <div className="md:col-span-2">
                <PartnerStageRail stage={partner.relationshipStage} />
              </div>
              <div className="mt-2 min-w-0 md:mt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SxBadge tone={BALL_SIDE_TONE[partner.currentBallSide]}>現在ボール: {sxBallSideLabel(partner.currentBallSide)}</SxBadge>
                  <span className="text-[10px] text-[#777166]">{partner.currentBallOwner || "担当未確認"}</span>
                </div>
                <p className="mt-1 text-[10px] font-semibold text-[#315f7d]">次の受け渡し: → {partner.nextBallOwner || "未確認"}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-[#24231f]">次の一手: {partner.nextCommitment}</p>
                <p className="mt-0.5 text-[10px] text-[#777166]">目標状態: {partner.targetState || "未登録"}</p>
                <p className={`mt-1 text-[10px] ${isDueUnset(partner) ? "font-semibold text-[#8c3329]" : "text-[#777166]"}`}>期限 {sxFormatDueDateWithPrecision(partner.dueDate, partner.dueDatePrecision)} / 接点 {sxFormatDate(partner.lastContactDate)}</p>
              </div>
              <div className="mt-2 min-w-0 md:mt-0">
                <p className="truncate text-[#514e47]">合意: {partner.agreedScope || "未登録"}</p>
                <p className="mt-0.5 truncate text-[#8c3329]">未合意: {partner.unagreedScope || "未登録"}</p>
                <p className="mt-1 text-[10px] text-[#777166]">担当 {partner.ownerLabel} / {gate}</p>
                <p className="mt-1 text-[10px] text-[#514e47]">最新記録: {latestRecordSummary(partner.interactions)}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 md:col-span-2 md:mt-0">
                {onEditPartner && management.canManage && (
                  <button type="button" onClick={() => onEditPartner(partner.id)} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-[#cfc7b9] px-3 py-2 text-[10px] font-semibold text-[#514e47] hover:bg-white">
                    <Pencil className="h-3 w-3" aria-hidden="true" />編集
                  </button>
                )}
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`sx-partner-history-${partner.id}`}
                  onClick={() => setExpandedId(expanded ? null : partner.id)}
                  className="inline-flex min-h-11 items-center gap-1 rounded-md border border-[#cfc7b9] px-3 py-2 text-[10px] font-semibold text-[#315f7d] hover:bg-white"
                >
                  履歴 {partner.interactions.length}件 {expanded ? "閉じる" : "開く"}
                </button>
              </div>
              {expanded && (
                <div className="md:col-span-2">
                  <InteractionHistoryPanel partner={partner} canManage={management.canManage} onAddInteraction={onAddInteraction} onEditInteraction={onEditInteraction} />
                </div>
              )}
            </article>
          );
        })}
      </div>
      {deferred.length > 0 && <p className="border-t border-[#e4ddd0] px-3 py-2 text-[10px] text-[#777166]">優先度低・保留（重要経路外）: {deferred.map((partner) => sxPartnerDisplay(partner).name).join(" / ")}</p>}
    </div>
  );
}
