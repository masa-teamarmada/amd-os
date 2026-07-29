"use client";

import { ArrowLeft, ArrowRight, ChevronDown, Mail } from "lucide-react";
import type { SxManagementBundle, SxManagementPartner, SxPartnerInteraction } from "@/lib/sx-management";
import { sxNormalizePublicName } from "@/lib/sx-name-normalize";
import {
  sxBallSideLabel,
  sxFormatEventDateWithPrecision,
  sxSortInteractionsByRecency,
} from "./sx-visual-shared";

const BALL_TONE: Record<string, string> = {
  sx: "border-[#a9c2b7] bg-[#e4eee8] text-[#235f4b]",
  partner: "border-[#dfc38d] bg-[#f5e8cf] text-[#77501f]",
  shared: "border-[#bfc8d0] bg-[#edf1f3] text-[#4c5561]",
  none: "border-[#d7d0c3] bg-[#f4f1e8] text-[#716d63]",
  unknown: "border-[#c9becb] bg-[#eee9ef] text-[#665d69]",
};

function emailInteractions(partner: SxManagementPartner) {
  return sxSortInteractionsByRecency(partner.interactions.filter((item) => item.interactionKind === "email"));
}

function latestEmail(partner: SxManagementPartner) {
  return emailInteractions(partner)[0] ?? null;
}

function actorLabel(interaction: SxPartnerInteraction, partner: SxManagementPartner) {
  if (interaction.actorSide === "sx") return "石原先生";
  if (interaction.actorSide === "partner") return partner.name;
  if (interaction.actorSide === "shared") return "双方";
  return "送受信側未確認";
}

function Direction({ interaction, partner }: { interaction: SxPartnerInteraction; partner: SxManagementPartner }) {
  if (interaction.actorSide === "partner") {
    return <span className="inline-flex items-center gap-1 font-semibold text-[#315f7d]"><ArrowLeft className="h-3 w-3" aria-hidden="true" />受信</span>;
  }
  if (interaction.actorSide === "sx") {
    return <span className="inline-flex items-center gap-1 font-semibold text-[#235f4b]">送信<ArrowRight className="h-3 w-3" aria-hidden="true" /></span>;
  }
  return <span className="font-semibold text-[#665d69]">{actorLabel(interaction, partner)}</span>;
}

export function SxPartnerEmailLedger({ management }: { management: SxManagementBundle }) {
  const partners = management.partners
    .filter((partner) => emailInteractions(partner).length > 0)
    .sort((left, right) => {
      const leftDate = latestEmail(left)?.occurredOn || "";
      const rightDate = latestEmail(right)?.occurredOn || "";
      return rightDate.localeCompare(leftDate) || left.name.localeCompare(right.name, "ja");
    });
  const emailCount = partners.reduce((sum, partner) => sum + emailInteractions(partner).length, 0);
  const latestDate = partners.map((partner) => latestEmail(partner)?.occurredOn || "").sort().at(-1) || null;

  return (
    <div className="overflow-hidden border border-[#bbb3a7] bg-[#fffdf7]" data-testid="sx-partner-email-ledger">
      <div className="grid gap-2 border-b border-[#d7d0c3] bg-[#f4f1e8] px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#24231f]"><Mail className="h-3.5 w-3.5 text-[#235f4b]" aria-hidden="true" />メール接点</span>
          <span className="text-[10px] text-[#514e47]">{partners.length}先 / {emailCount}件</span>
          <span className="text-[10px] text-[#716d63]">最終確認 {latestDate ? sxFormatEventDateWithPrecision(latestDate, "day") : "未反映"}</span>
        </div>
        <span className="text-[10px] text-[#716d63]">本文・アドレスは非保存</span>
      </div>

      {partners.length === 0 ? (
        <p className="px-3 py-5 text-center text-[11px] text-[#716d63]">関係先に紐づいたメール接点はまだないよ。</p>
      ) : (
        <div className="divide-y divide-[#e4ddd0]">
          {partners.map((partner) => {
            const interactions = emailInteractions(partner);
            const latest = interactions[0];
            return (
              <details key={partner.id} className="group" data-testid="sx-partner-email-row">
                <summary className="grid min-h-14 cursor-pointer list-none grid-cols-[minmax(108px,.7fr)_minmax(0,1.45fr)_minmax(112px,.8fr)_36px] items-center gap-2 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#235f4b] max-sm:grid-cols-[minmax(0,1fr)_auto_32px]">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-bold text-[#24231f]" title={partner.name}>{partner.name}</p>
                    <p className="mt-0.5 text-[10px] text-[#716d63]">{interactions.length}件 · {sxFormatEventDateWithPrecision(latest.occurredOn, latest.occurredOnPrecision)}</p>
                  </div>
                  <div className="min-w-0 max-sm:col-span-3 max-sm:row-start-2">
                    <p className="truncate text-[11px] font-semibold text-[#24231f]" title={sxNormalizePublicName(latest.summary)}>{sxNormalizePublicName(latest.summary)}</p>
                    <p className="mt-0.5 truncate text-[10px] text-[#716d63]" title={sxNormalizePublicName(latest.outcomeSummary || partner.nextCommitment)}>{sxNormalizePublicName(latest.outcomeSummary || partner.nextCommitment)}</p>
                  </div>
                  <div className="flex min-w-0 items-center justify-end gap-2 max-sm:col-start-2 max-sm:row-start-1">
                    <Direction interaction={latest} partner={partner} />
                    <span className={`truncate rounded-full border px-2 py-1 text-[10px] font-bold ${BALL_TONE[partner.currentBallSide] || BALL_TONE.unknown}`} title={partner.currentBallOwner || "担当未確認"}>
                      ボール {sxBallSideLabel(partner.currentBallSide)}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 justify-self-end text-[#716d63] transition-transform group-open:rotate-180 max-sm:col-start-3 max-sm:row-start-1" aria-hidden="true" />
                </summary>
                <div className="border-t border-[#eee9df] bg-[#fffdf7] px-3 pb-3">
                  <div className="grid grid-cols-[72px_58px_minmax(0,1fr)_minmax(92px,.38fr)] gap-2 border-b border-[#e4ddd0] py-1.5 text-[10px] font-bold text-[#716d63] max-sm:hidden">
                    <span>日付</span><span>往復</span><span>要点</span><span>以後のボール</span>
                  </div>
                  <ol className="divide-y divide-[#eee9df]">
                    {interactions.map((interaction) => (
                      <li key={interaction.id} className="grid grid-cols-[72px_58px_minmax(0,1fr)_minmax(92px,.38fr)] gap-2 py-2 text-[10px] max-sm:grid-cols-[70px_minmax(0,1fr)]">
                        <span className="text-[#716d63]">{sxFormatEventDateWithPrecision(interaction.occurredOn, interaction.occurredOnPrecision)}</span>
                        <Direction interaction={interaction} partner={partner} />
                        <div className="min-w-0 max-sm:col-span-2">
                          <p className="font-semibold leading-4 text-[#24231f]">{sxNormalizePublicName(interaction.summary)}</p>
                          {interaction.outcomeSummary && <p className="mt-0.5 leading-4 text-[#716d63]">{sxNormalizePublicName(interaction.outcomeSummary)}</p>}
                        </div>
                        <span className="text-[#315f7d] max-sm:col-span-2">{sxBallSideLabel(interaction.ballSideAfter)}{interaction.ballOwnerAfter ? ` · ${sxNormalizePublicName(interaction.ballOwnerAfter)}` : ""}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
