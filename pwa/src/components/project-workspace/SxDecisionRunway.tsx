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
    <div className="flex h-full flex-col rounded-xl border border-[#cfc7b9] bg-[#fffdf7]/95 p-4 shadow-[0_10px_35px_rgba(61,56,44,0.05)] sm:p-5">
      <p className="text-[10px] font-semibold tracking-[0.16em] text-[#38745d]">意思決定ランウェイ</p>
      <h2 className="mt-1 text-sm font-semibold text-[#24231f]">期限順・今週決めること 最大3件</h2>
      <div className="mt-3 flex-1 space-y-2.5">
        {items.length === 0 && <p className="rounded-lg border border-dashed border-[#d6cebf] p-4 text-xs leading-5 text-[#777166]">期限つきの意思決定待ちはまだ登録されてないよ。</p>}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={selectedTrack === item.track}
            aria-controls="selected-management-context"
            onClick={() => onSelectTrack(selectedTrack === item.track ? null : item.track)}
            className={`min-h-11 w-full rounded-lg border p-3 text-left transition hover:bg-[#f8f5ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] ${selectedTrack === item.track ? "border-[#38745d] bg-[#f1f6f2]" : "border-[#e4ddd0] bg-white/70"}`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <SxBadge tone={WINDOW_TONE[item.window]}>{WINDOW_LABEL[item.window]}</SxBadge>
              <span className="text-[10px] font-semibold text-[#777166]">{SX_TRACK_LABELS[item.track]} / {item.gateLabel}</span>
            </div>
            <p className="mt-1.5 text-xs font-semibold leading-4 text-[#24231f]">{item.title}</p>
            <p className="mt-1 text-[11px] leading-4 text-[#69665d]">期限 {sxFormatDate(item.dueDate)} / {item.ownerLabel}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
