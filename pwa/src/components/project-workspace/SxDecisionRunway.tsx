"use client";

import type { SxTrackKey } from "@/lib/sx-management";
import { SX_TRACK_LABELS, SxBadge, sxFormatDate } from "./sx-visual-shared";

export type SxRunwayItem = {
  id: string;
  title: string;
  dueDate: string | null;
  ownerLabel: string;
  track: SxTrackKey;
  gateLabel: string;
  window: "overdue" | "this_week" | "within_14" | "within_30" | "later" | "unscheduled";
};

export const WINDOW_LABEL: Record<SxRunwayItem["window"], string> = {
  overdue: "期限超過",
  this_week: "今週",
  within_14: "14日以内",
  within_30: "30日以内",
  later: "30日超",
  unscheduled: "期限未設定",
};

export const WINDOW_TONE: Record<SxRunwayItem["window"], string> = {
  overdue: "border-[#b5533f] bg-[#f9e4e1] text-[#8c3329]",
  this_week: "border-[#e3c994] bg-[#fbf1dc] text-[#765022]",
  within_14: "border-[#b7c8d2] bg-[#eef3f5] text-[#315f7d]",
  within_30: "border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]",
  later: "border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]",
  unscheduled: "border-[#b8b5c8] bg-[#eeedf4] text-[#55506d]",
};

export function SxDecisionRunway({
  items,
  selectedTrack,
  onSelectTrack,
}: {
  items: SxRunwayItem[];
  selectedTrack: SxTrackKey | null;
  onSelectTrack: (track: SxTrackKey | null) => void;
}) {
  return (
    <section className="hidden min-h-[56px] grid-cols-[190px_repeat(3,minmax(0,1fr))] border-y border-[#cfc7b9] bg-[#fffdf7] lg:grid" aria-label="期限順の意思決定 最大3件">
      <div className="flex items-center justify-between gap-2 border-r border-[#e4ddd0] px-3 py-1.5">
        <div><p className="text-[9px] font-semibold tracking-[0.14em] text-[#38745d]">意思決定ランウェイ</p><h2 className="text-[11px] font-semibold text-[#24231f]">期限順・最大3件</h2></div>
        <span className="text-[9px] text-[#777166]">{items.length}</span>
      </div>
      {items.length === 0 && <p className="col-span-3 px-3 py-4 text-[11px] leading-4 text-[#777166]">期限つきの意思決定待ちは未登録。</p>}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={selectedTrack === item.track}
            aria-controls="selected-management-context"
            onClick={() => onSelectTrack(selectedTrack === item.track ? null : item.track)}
            className={`grid min-h-[54px] w-full grid-cols-[auto_1fr_auto] items-center gap-2 border-r border-[#e4ddd0] px-2.5 py-1.5 text-left transition last:border-r-0 hover:bg-[#f8f5ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] ${selectedTrack === item.track ? "bg-[#f1f6f2]" : "bg-white"}`}
          >
            <SxBadge tone={WINDOW_TONE[item.window]}>{WINDOW_LABEL[item.window]}</SxBadge>
            <div className="min-w-0"><p className="truncate text-[10px] font-semibold text-[#24231f]">{item.title}</p><p className="truncate text-[9px] text-[#777166]">{SX_TRACK_LABELS[item.track]} / {item.gateLabel} / {item.ownerLabel}</p></div>
            <span className="text-[9px] font-semibold text-[#69665d]">{sxFormatDate(item.dueDate)}</span>
          </button>
        ))}
    </section>
  );
}
