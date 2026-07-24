"use client";

import { useMemo } from "react";
import type { SxManagementBundle } from "@/lib/sx-management";
import { nominalizeSxActionLabel } from "@/lib/sx-action-label";
import { SxDiamondMark, SxStatusIcon, SxTickMark, sxFormatDate, sxMonthPosition } from "./sx-visual-shared";

const MONTH_COL_PX = 60;
const MIN_TIMELINE_PX = 1000;
// .sx-management-workspace button に min-height:44px / min-width:44px の全体規則があるため、
// マーカーの実測サイズ(44px四方)を前提にレーン間隔とチップ間隔を計算する。ミルストーンのチップ本体はコンパクトにし、
// クリック領域は透明な44pxボタンで包んでポインタターゲットを確保する。
const CHIP_WIDTH_PX = 88;
const CHIP_HEIGHT_PX = 26;
const HIT_TARGET_PX = 44;
const CHIP_GAP_PX = 6;
const CHIP_ROW_GAP_PX = 6;
const SLOT_WIDTH_PX = CHIP_WIDTH_PX + CHIP_GAP_PX;
const SUB_ROW_HEIGHT_PX = CHIP_HEIGHT_PX + CHIP_ROW_GAP_PX;
const LANE_TOP_PADDING_PX = 8;
const LANE_BOTTOM_PADDING_PX = 6;
const LANE_MIN_HEIGHT_PX = 60;

function formatMonthCell(value: string, previous: string | null) {
  const [year, month] = value.split("-");
  const isYearStart = !previous || previous.split("-")[0] !== year;
  return { label: `${Number(month)}月`, yearLabel: isYearStart ? `${year}年` : null, isYearStart };
}

function formatPeriodLabel(months: string[]) {
  if (months.length === 0) return "";
  const first = months[0];
  const last = months[months.length - 1];
  const [firstYear, firstMonth] = first.split("-");
  const [lastYear, lastMonth] = last.split("-");
  return `${firstYear}年${Number(firstMonth)}月–${firstYear === lastYear ? "" : `${lastYear}年`}${Number(lastMonth)}月`;
}

/** Greedy interval scheduling: assigns each item (sorted by x) the first sub-row whose last item no longer overlaps. */
function assignSubRows(itemsLeftPx: number[]) {
  const order = itemsLeftPx.map((_, index) => index).sort((a, b) => itemsLeftPx[a] - itemsLeftPx[b]);
  const rowEnds: number[] = [];
  const rowByIndex: number[] = new Array(itemsLeftPx.length).fill(0);
  for (const index of order) {
    const left = itemsLeftPx[index];
    let row = rowEnds.findIndex((end) => left >= end);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(0);
    }
    rowByIndex[index] = row;
    rowEnds[row] = left + SLOT_WIDTH_PX;
  }
  return { rowByIndex, rowCount: Math.max(1, rowEnds.length) };
}

export function SxNineMonthTimeline({
  management,
  selectedMilestoneId,
  onSelect,
}: {
  management: SxManagementBundle;
  selectedMilestoneId: string | null;
  onSelect: (milestoneId: string | null) => void;
}) {
  const months = management.horizonMonths;
  const contentWidth = Math.max(months.length * MONTH_COL_PX, MIN_TIMELINE_PX);
  const monthWidth = contentWidth / Math.max(1, months.length);
  const periodLabel = formatPeriodLabel(months);
  const todayPos = sxMonthPosition(management.asOf, months);
  const dagValid = management.judgment.dagValid;
  const criticalSet = useMemo(() => new Set(management.judgment.criticalPathSlugs), [management.judgment.criticalPathSlugs]);
  const milestoneById = useMemo(() => new Map(management.milestones.map((milestone) => [milestone.id, milestone])), [management.milestones]);
  const laneIndexByTrack = useMemo(() => new Map(management.tracks.map((track, index) => [track.key, index])), [management.tracks]);

  const laneMilestones = useMemo(() => {
    const lanes = management.tracks.map((track) => {
      const items = management.milestones
        .filter((milestone) => milestone.track === track.key)
        .map((milestone) => ({ milestone, plannedPos: sxMonthPosition(milestone.plannedEnd, months), forecastPos: sxMonthPosition(milestone.forecastEnd, months) }))
        .filter((item) => item.plannedPos != null || item.forecastPos != null)
        .map((item) => ({ ...item, leftPx: ((item.forecastPos ?? item.plannedPos ?? 0) / months.length) * contentWidth }));
      const { rowByIndex, rowCount } = assignSubRows(items.map((item) => item.leftPx));
      const laneHeight = Math.max(LANE_MIN_HEIGHT_PX, LANE_TOP_PADDING_PX + rowCount * SUB_ROW_HEIGHT_PX + LANE_BOTTOM_PADDING_PX);
      return { track, items: items.map((item, index) => ({ ...item, subRow: rowByIndex[index] })), laneHeight };
    });
    return lanes.reduce<Array<(typeof lanes)[number] & { laneTop: number }>>((acc, lane) => {
      const previous = acc[acc.length - 1];
      const laneTop = previous ? previous.laneTop + previous.laneHeight : 0;
      acc.push({ ...lane, laneTop });
      return acc;
    }, []);
  }, [management.tracks, management.milestones, months, contentWidth]);

  const totalContentHeight = laneMilestones.reduce((sum, lane) => sum + lane.laneHeight, 0);

  return (
    <div className="rounded-xl border border-[#d6cebf] bg-[#fffdf7]/95 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[#38745d]">経営航路 / {periodLabel}</p>
          <h2 className="mt-1 text-base font-semibold text-[#24231f]">事業化ロードマップ</h2>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-[#777166]">
          <span className="inline-flex items-center gap-1"><SxTickMark />予定</span>
          <span className="inline-flex items-center gap-1"><SxDiamondMark />予測</span>
          <span className="inline-flex items-center gap-1"><SxDiamondMark dashed />仮置き</span>
          <span className="inline-flex items-center gap-1"><SxDiamondMark hollow />未確認</span>
          <span className="inline-flex items-center gap-1 text-[#8c3329]"><span className="inline-block h-2.5 w-2.5 rounded-sm border border-[#b5533f] bg-[#fdf1ee]" aria-hidden="true" />停止・期限超過</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-4 border-t-2 border-dashed border-[#3d382c]" aria-hidden="true" />今日</span>
          <span className="inline-flex items-center gap-1 font-semibold text-[#3d382c]"><span className="inline-block h-2.5 w-2.5 rounded-sm ring-2 ring-[#3d382c]/60" aria-hidden="true" />重要経路</span>
        </div>
      </div>
      {!dagValid && <p className="mt-2 rounded-md border border-[#c9bfd0] bg-[#f1edf3] px-2.5 py-1.5 text-[11px] leading-4 text-[#5f4a66]">依存関係が循環しているため依存未確定。接続線は表示していないよ。</p>}
      {management.hasData ? (
        <div className="mt-3 flex overflow-x-auto rounded-lg border border-[#e4ddd0]" role="group" aria-label={`4本柱の事業化ロードマップ（${periodLabel}）。内部を横スクロールできるよ。`}>
          <div className="sticky left-0 z-10 w-[112px] shrink-0 border-r border-[#e4ddd0] bg-[#f8f5ec] sm:w-[132px]">
            <div className="h-9 border-b border-[#e4ddd0]" />
            {laneMilestones.map(({ track, laneHeight }) => (
              <div key={track.key} className="flex items-center border-b border-[#eee9df] border-l-[3px] px-2 text-[10px] font-semibold leading-tight text-[#514e47] sm:text-xs" style={{ height: laneHeight, borderLeftColor: track.accent }}>
                <span className="truncate sm:hidden">{track.shortLabel}</span>
                <span className="hidden truncate sm:inline">{track.label}</span>
              </div>
            ))}
          </div>
          <div className="relative shrink-0" style={{ width: contentWidth }}>
            <div className="grid h-9 border-b border-[#e4ddd0] bg-[#f8f5ec] text-[9px] font-semibold text-[#777166]" style={{ gridTemplateColumns: `repeat(${months.length}, ${monthWidth}px)` }}>
              {months.map((month, index) => {
                const { label, yearLabel, isYearStart } = formatMonthCell(month, index > 0 ? months[index - 1] : null);
                return (
                  <div key={month} className={`flex flex-col items-center justify-center border-l ${isYearStart ? "border-l-[#a89f8d]" : "border-[#eee9df]"}`}>
                    <span className="leading-none text-[9px] text-[#69665d]">{yearLabel ?? " "}</span>
                    <span className="leading-none">{label}</span>
                  </div>
                );
              })}
            </div>
            {laneMilestones.map(({ track, items, laneHeight }) => (
              <div key={track.key} className="relative border-b border-[#eee9df]" style={{ height: laneHeight }}>
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${months.length}, ${monthWidth}px)` }} aria-hidden="true">
                  {months.map((month, index) => {
                    const { isYearStart } = formatMonthCell(month, index > 0 ? months[index - 1] : null);
                    return <div key={month} className={`border-l ${isYearStart ? "border-l-[#a89f8d]" : "border-[#f1ede2]"}`} />;
                  })}
                </div>
                {items.map(({ milestone, plannedPos, leftPx, subRow }) => {
                  const plannedLeftPx = plannedPos != null ? (plannedPos / months.length) * contentWidth : null;
                  const selected = selectedMilestoneId === milestone.id;
                  const rustEdge = milestone.isBlocked || milestone.isOverdue;
                  const critical = criticalSet.has(milestone.slug);
                  const statusText = milestone.isBlocked ? "停止" : milestone.isOverdue ? "期限超過" : null;
                  const displayTitle = nominalizeSxActionLabel(milestone.title);
                  const topOffset = LANE_TOP_PADDING_PX + subRow * SUB_ROW_HEIGHT_PX;
                  return (
                    <div key={milestone.id} className="absolute" style={{ left: leftPx, top: topOffset }}>
                      {plannedLeftPx != null && Math.abs(plannedLeftPx - leftPx) > 1 && <span className="absolute top-1/2 h-px bg-[#d9d2c3]" style={{ left: Math.min(0, plannedLeftPx - leftPx), width: Math.abs(plannedLeftPx - leftPx) }} aria-hidden="true" />}
                      {plannedPos != null && <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: plannedLeftPx! - leftPx }}><SxTickMark tone={rustEdge ? "#8c3329" : "#3d382c"} /></span>}
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-controls="selected-management-context"
                        aria-label={`${displayTitle} / 予定 ${sxFormatDate(milestone.plannedEnd)} / 予測 ${sxFormatDate(milestone.forecastEnd)}${critical ? "（重要経路）" : ""}${statusText ? ` / ${statusText}` : ""}`}
                        onClick={() => onSelect(selected ? null : milestone.id)}
                        className="relative flex !min-h-0 !min-w-0 -translate-x-1/2 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
                        style={{ width: Math.max(CHIP_WIDTH_PX, HIT_TARGET_PX), height: HIT_TARGET_PX }}
                        title={`${displayTitle} / 予定 ${sxFormatDate(milestone.plannedEnd)} / 予測 ${sxFormatDate(milestone.forecastEnd)}${statusText ? ` / ${statusText}` : ""}${critical ? " / 重要経路" : ""}`}
                      >
                        <span
                          className={`flex w-full items-center gap-1 overflow-hidden rounded-[4px] border px-1.5 text-left text-[9px] font-semibold leading-none shadow-sm ${rustEdge ? "border-[#b5533f] bg-[#fdf1ee] text-[#8c3329]" : selected ? "border-[#38745d] bg-[#e8f2eb] text-[#205f49]" : "border-[#cfc7b9] bg-white text-[#24231f]"} ${critical ? "ring-2 ring-offset-1 ring-[#3d382c]/50" : ""}`}
                          style={{ width: CHIP_WIDTH_PX, height: CHIP_HEIGHT_PX }}
                        >
                          <SxDiamondMark tone={rustEdge ? "#8c3329" : "#3d382c"} dashed={milestone.dateCertainty === "provisional"} hollow={milestone.confidence === "unknown"} className="shrink-0" />
                          {rustEdge && <SxStatusIcon status={milestone.status} blocked={milestone.isBlocked} className="h-2.5 w-2.5 shrink-0" />}
                          {critical && <span className="shrink-0 whitespace-nowrap text-[8px] text-[#3d382c]">重要</span>}
                          {statusText && <span className="shrink-0 whitespace-nowrap">{statusText}</span>}
                          <span className="min-w-0 flex-1 truncate">{displayTitle}</span>
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
            {dagValid && (
              <svg className="pointer-events-none absolute left-0 top-9" width={contentWidth} height={totalContentHeight} aria-hidden="true">
                {management.dependencies.map((dependency) => {
                  const predecessor = milestoneById.get(dependency.predecessorMilestoneId);
                  const successor = milestoneById.get(dependency.successorMilestoneId);
                  if (!predecessor || !successor) return null;
                  const fromLaneIndex = laneIndexByTrack.get(predecessor.track);
                  const toLaneIndex = laneIndexByTrack.get(successor.track);
                  if (fromLaneIndex == null || toLaneIndex == null) return null;
                  const fromLane = laneMilestones[fromLaneIndex];
                  const toLane = laneMilestones[toLaneIndex];
                  const fromPos = sxMonthPosition(predecessor.forecastEnd || predecessor.plannedEnd, months);
                  const toPos = sxMonthPosition(successor.forecastEnd || successor.plannedEnd, months);
                  if (fromPos == null || toPos == null) return null;
                  const x1 = (fromPos / months.length) * contentWidth;
                  const x2 = (toPos / months.length) * contentWidth;
                  const y1 = fromLane.laneTop + fromLane.laneHeight / 2;
                  const y2 = toLane.laneTop + toLane.laneHeight / 2;
                  const critical = criticalSet.has(predecessor.slug) && criticalSet.has(successor.slug);
                  return <path key={dependency.id} d={`M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`} fill="none" stroke={critical ? "#3d382c" : "#b7c8d2"} strokeWidth={critical ? 2 : 1} strokeDasharray={dependency.required ? undefined : "3 2"} />;
                })}
              </svg>
            )}
            {todayPos != null && (
              <div className="pointer-events-none absolute bottom-0 top-9 border-l-2 border-dashed border-[#3d382c]/70" style={{ left: (todayPos / months.length) * contentWidth }}>
                <span className="absolute -top-4 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-[#3d382c]">今日</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-[#d6cebf] px-4 py-10 text-center text-sm text-[#777166]">管理データがまだないよ。4本柱の情報を登録するとここに航路が出る。</div>
      )}
    </div>
  );
}
