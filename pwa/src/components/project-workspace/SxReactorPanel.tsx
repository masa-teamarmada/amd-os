"use client";

import { ArrowRight, Flag } from "lucide-react";
import type { SxJudgment, SxManagementBundle, SxTrackKey } from "@/lib/sx-management";
import { SxBadge, sxFormatDate } from "./sx-visual-shared";
import { WINDOW_LABEL, WINDOW_TONE, type SxRunwayItem } from "./SxDecisionRunway";

const JUDGMENT_TONE: Record<string, string> = {
  on_track: "border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]",
  attention: "border-[#e3c994] bg-[#fbf1dc] text-[#765022]",
  crisis: "border-[#b5533f] bg-[#f9e4e1] text-[#8c3329]",
  unassessed: "border-[#b8b5c8] bg-[#eeedf4] text-[#55506d]",
};

export function SxReactorPanel({
  management,
  judgment,
  selectedTrack,
  onSelectTrack,
  topDecision,
  decisionCount = 0,
}: {
  management: SxManagementBundle;
  judgment: SxJudgment;
  selectedTrack: SxTrackKey | null;
  onSelectTrack: (track: SxTrackKey | null) => void;
  topDecision?: SxRunwayItem;
  decisionCount?: number;
}) {
  const objective = management.objective;
  const primaryReason = judgment.reasons[0] || "判定理由 未登録";

  return (
    <section className="h-full border-y border-[#cfc7b9] bg-[#fffdf7]" aria-label="経営判定と4本柱">
      <div className="grid min-h-[54px] grid-cols-[auto_1fr] items-center gap-x-3 border-b border-[#e4ddd0] px-3 py-2 sm:grid-cols-[auto_minmax(170px,1fr)_auto_auto] sm:px-4">
        <div>
          <p className="text-[9px] font-semibold tracking-[0.14em] text-[#38745d]">現在の経営判定</p>
          <SxBadge tone={JUDGMENT_TONE[judgment.key] || JUDGMENT_TONE.unassessed}>{judgment.label}</SxBadge>
        </div>
        <p className="line-clamp-2 text-[11px] leading-4 text-[#514e47] sm:line-clamp-1">{primaryReason}</p>
        <dl className="col-span-2 mt-1 flex items-center gap-3 text-[9px] text-[#777166] sm:col-span-1 sm:mt-0">
          <div><dt className="inline">充足 </dt><dd className="inline font-semibold text-[#24231f]">{judgment.completenessPct}%</dd></div>
          <div><dt className="inline">重大未確認 </dt><dd className="inline font-semibold text-[#8c3329]">{judgment.criticalUnknownCount}</dd></div>
          <div><dt className="inline">次期限 </dt><dd className="inline font-semibold text-[#24231f]">{sxFormatDate(judgment.nextDeadline)}</dd></div>
        </dl>
        <div className="hidden items-center gap-1 text-[10px] font-semibold text-[#5f4a66] sm:flex">
          <Flag className="h-3.5 w-3.5" aria-hidden="true" />設立判断 {sxFormatDate(objective?.targetDate)}
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-[#e4ddd0] sm:grid-cols-4">
        {management.tracks.map((track, index) => {
          const selected = selectedTrack === track.key;
          return (
            <button
              key={track.key}
              type="button"
              aria-pressed={selected}
              aria-controls="selected-management-context"
              onClick={() => onSelectTrack(selected ? null : track.key)}
              className={`min-h-11 border-b px-2 py-1.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] sm:border-b-0 ${index % 2 === 0 ? "border-r" : ""} ${index < 3 ? "sm:border-r" : ""} ${selected ? "bg-[#e8f2eb]" : "bg-white hover:bg-[#f8f5ec]"}`}
            >
              <span className="flex items-center gap-1.5 text-[9px] font-semibold text-[#777166]"><span className="h-2 w-2 rounded-full" style={{ background: track.accent }} />{track.label}</span>
              <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] font-semibold text-[#24231f]"><span className="truncate">{track.gate}</span><ArrowRight className="h-3 w-3 shrink-0 text-[#9b9487]" /></span>
              <span className="block truncate text-[9px] text-[#69665d]">{track.statusLabel} ・ {track.ownerLabel} ・ {sxFormatDate(track.forecastEnd)}</span>
            </button>
          );
        })}
      </div>

      {topDecision && (
        <div className="flex min-h-11 items-center gap-2 px-3 py-1.5 lg:hidden">
          <SxBadge tone={WINDOW_TONE[topDecision.window]}>{WINDOW_LABEL[topDecision.window]}</SxBadge>
          <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-[#24231f]">{topDecision.title}</p><p className="truncate text-[9px] text-[#777166]">担当 {topDecision.ownerLabel}</p></div>
          <div className="shrink-0 text-right text-[9px] text-[#777166]"><p>{sxFormatDate(topDecision.dueDate)}</p><p>残{decisionCount}</p></div>
        </div>
      )}
    </section>
  );
}
