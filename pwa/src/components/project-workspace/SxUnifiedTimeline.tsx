"use client";

import { Flag } from "lucide-react";
import type { SxEcdUnifiedTimeline, SxEcdTimelineLane, SxEcdTimelineRow } from "@/lib/sx-executive-control-deck";
import { sxFormatDate, sxFormatDelta } from "./sx-visual-shared";

/**
 * 統合タイムライン（経営状況図）。旧・経営状況図レール / 事業化ロードマップ / 全件ガントの
 * 3枚を1枚へ統合した唯一の時間軸ビュー。月グリッド・今日線・設立判断旗の共通座標系に、柱レーン
 * ごとの全マイルストーン（計画バー+予定tick+予測◇+遅延幅）、重要経路の接続線、①〜⑤ボールピン
 * （各介入の自身の期日位置）を重ねる。行の高さは固定で、接続線のy座標は行indexから決定的に出す。
 */

// .sx-management-workspace のグローバル規則で button は min-height 44px（操作領域契約）。
// ラベル行とバー行の高さは同じ定数で固定し、接続線のy座標をindex計算で一致させる。
const MONTH_ROW_H = 20;
const PIN_ROW_H = 24;
const LANE_HEADER_H = 22;
const ROW_H = 44;
const LANE_GAP = 2;

const ROW_STATE_TEXT: Record<SxEcdTimelineRow["state"], string> = {
  complete: "完了",
  current: "現在",
  future: "予定",
  blocked: "停止",
  overdue: "期限超過",
  unassessed: "要確認",
  attention: "要注意",
};

/** 行が縦に積み上がる座標系での、各レーン・各行のy中心を返す（SVG接続線用）。 */
function rowCenterY(lanes: SxEcdTimelineLane[], laneIndex: number, rowIndex: number): number {
  let y = 0;
  for (let i = 0; i < laneIndex; i += 1) {
    y += LANE_HEADER_H + lanes[i].rows.length * ROW_H + LANE_GAP;
  }
  y += LANE_HEADER_H + rowIndex * ROW_H + ROW_H / 2;
  return y;
}

function lanesTotalHeight(lanes: SxEcdTimelineLane[]): number {
  return lanes.reduce((sum, lane) => sum + LANE_HEADER_H + lane.rows.length * ROW_H + LANE_GAP, 0);
}

function RowBar({ row, accent }: { row: SxEcdTimelineRow; accent: string }) {
  const barStart = row.plannedStartPct ?? row.plannedEndPct ?? row.forecastPct ?? 0;
  const plannedEnd = row.plannedEndPct;
  const forecast = row.forecastPct;
  const slipStart = plannedEnd ?? barStart;
  const slipEnd = forecast != null && plannedEnd != null && forecast > plannedEnd ? forecast : null;
  const provisional = row.dateCertainty === "provisional";
  const deltaLabel = sxFormatDelta(row.deltaDays, row.dateCertainty);
  const showDelta = row.deltaDays != null && row.deltaDays > 0;
  const labelAnchor = forecast ?? plannedEnd ?? barStart;
  return (
    <div className="relative h-full w-full" aria-hidden="true">
      {/* 計画バー: 開始→予定 */}
      {plannedEnd != null && (
        <span
          className={`absolute top-1/2 h-[6px] -translate-y-1/2 rounded-sm ${provisional ? "opacity-45" : "opacity-75"}`}
          style={{ left: `${barStart}%`, width: `${Math.max(plannedEnd - barStart, 0.4)}%`, background: accent }}
        />
      )}
      {/* 予定tick */}
      {plannedEnd != null && <span className="absolute top-1/2 h-[14px] w-[2px] -translate-y-1/2 bg-[#514e47]" style={{ left: `${plannedEnd}%` }} />}
      {/* 遅延幅: 予定→予測 */}
      {slipEnd != null && (
        <span className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#c99a4b]" style={{ left: `${slipStart}%`, width: `${Math.max(slipEnd - slipStart, 0.3)}%` }} />
      )}
      {/* 予測◇ */}
      {forecast != null && (
        <span
          className={`absolute top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rotate-45 border-[1.5px] ${provisional ? "bg-[#fffdf7]" : ""}`}
          style={{ left: `${forecast}%`, borderColor: accent, background: provisional ? undefined : accent }}
        />
      )}
      {showDelta && (
        <span
          className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[9px] font-semibold ${labelAnchor > 90 ? "-translate-x-full pr-2" : "pl-1.5"} ${row.state === "blocked" || row.state === "overdue" ? "text-[#8c3329]" : "text-[#765022]"}`}
          style={{ left: `${labelAnchor}%` }}
        >
          {deltaLabel}
        </span>
      )}
    </div>
  );
}

export function SxUnifiedTimeline({
  timeline,
  asOf,
  selectedMilestoneId,
  onSelectMilestone,
  onPinClick,
}: {
  timeline: SxEcdUnifiedTimeline;
  asOf: string;
  selectedMilestoneId: string | null;
  onSelectMilestone: (milestoneId: string | null) => void;
  onPinClick: (anchor: string) => void;
}) {
  if (!timeline.valid) {
    return (
      <p className="rounded-md border border-dashed border-[#b5533f] bg-[#f9e4e1] px-2.5 py-2 text-[11px] font-semibold text-[#8c3329]" data-testid="sx-unified-timeline">
        {timeline.reason}
      </p>
    );
  }

  const lanesHeight = lanesTotalHeight(timeline.lanes);
  const gridHeight = PIN_ROW_H + lanesHeight;
  const criticalPolyline = timeline.criticalPoints
    .map((point) => ({ x: point.pct, y: PIN_ROW_H + rowCenterY(timeline.lanes, point.laneIndex, point.rowIndex) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  return (
    <div data-testid="sx-unified-timeline">
      <div className="overflow-x-auto">
        <div className="min-w-[880px]">
          {/* 月ヘッダー */}
          <div className="grid grid-cols-[minmax(170px,205px)_minmax(0,1fr)] items-end" style={{ height: MONTH_ROW_H }}>
            <p className="sticky left-0 z-30 bg-[#fffdf7] pr-2 text-[9px] font-semibold tracking-[0.1em] text-[#9b9487]">柱 / マイルストーン</p>
            <div className="relative h-full" role="presentation">
              {timeline.months.map((month) => (
                <span key={month.pct} className={`absolute bottom-0 -translate-x-0 pl-1 text-[9px] leading-tight ${month.isYearStart ? "font-bold text-[#24231f]" : "text-[#777166]"}`} style={{ left: `${month.pct}%` }}>
                  {month.label}
                </span>
              ))}
              {timeline.objectivePct != null && (
                <span className="absolute bottom-0 z-10 flex -translate-x-full items-center gap-0.5 whitespace-nowrap pr-0.5 text-[9px] font-bold text-[#5f4a66]" style={{ left: `${timeline.objectivePct}%` }}>
                  <Flag className="h-3 w-3" aria-hidden="true" />設立判断 {sxFormatDate(timeline.objectiveDate)}
                </span>
              )}
            </div>
          </div>

          {/* ピン行 + レーン群（共通の縦グリッド背景） */}
          <div className="grid grid-cols-[minmax(170px,205px)_minmax(0,1fr)]">
            {/* 左ラベル列（横スクロール中も固定） */}
            <div className="sticky left-0 z-30 border-r border-[#e8e2d6] bg-[#fffdf7]">
              <div className="flex items-center border-b border-[#e8e2d6] pr-2" style={{ height: PIN_ROW_H }}>
                <span className="text-[9px] font-semibold text-[#69665d]">ボール・介入（①〜は下の一覧と同番号）</span>
              </div>
              {timeline.lanes.map((lane) => (
                <div key={lane.key} style={{ marginBottom: LANE_GAP }}>
                  <div className="flex min-w-0 items-center gap-1.5 border-b border-[#d6cebf] pr-2" style={{ height: LANE_HEADER_H }}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: lane.accent }} aria-hidden="true" />
                    <span className="shrink-0 text-[10px] font-bold text-[#24231f]">{lane.label}</span>
                    <span className={`shrink-0 text-[9px] font-semibold ${lane.deltaDays != null && lane.deltaDays > 0 ? "text-[#765022]" : "text-[#69665d]"}`}>{sxFormatDelta(lane.deltaDays, lane.dateCertainty)}</span>
                    {lane.maxIssue && <span className="min-w-0 truncate text-[9px] text-[#8c3329]" title={`詰まり: ${lane.maxIssue}`}>詰まり: {lane.maxIssue}</span>}
                  </div>
                  {lane.rows.map((row) => {
                    const selected = selectedMilestoneId === row.milestoneId;
                    return (
                      <button
                        key={row.slug}
                        type="button"
                        onClick={() => onSelectMilestone(row.milestoneId)}
                        aria-label={`${row.title} ${ROW_STATE_TEXT[row.state]}${row.isCurrent ? " 現在地" : ""} 予定 ${sxFormatDate(row.plannedEnd)} 予測 ${sxFormatDate(row.forecastEnd)} ${sxFormatDelta(row.deltaDays, row.dateCertainty)} 担当 ${row.ownerLabel}`}
                        aria-pressed={selected}
                        className={`flex w-full min-w-0 items-center gap-1 border-b border-[#f1eee5] pr-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] ${selected ? "bg-[#e8f2eb]" : "hover:bg-[#f8f5ec]"} ${row.isCritical ? "border-l-[3px] pl-1" : "pl-2"}`}
                        style={{ height: ROW_H, borderLeftColor: row.isCritical ? "#24231f" : undefined }}
                      >
                        <span className={`min-w-0 truncate text-[10px] leading-tight ${row.isCritical ? "font-bold text-[#24231f]" : "font-medium text-[#514e47]"}`} title={row.title}>{row.title}</span>
                        {row.isCurrent && <span className="shrink-0 rounded-sm bg-[#38745d] px-1 py-px text-[8px] font-bold leading-tight text-white">現在地</span>}
                        {row.ownerLabel === "担当未確認" && <span className="shrink-0 text-[8px] font-semibold text-[#765022]">担当?</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* 時間エリア */}
            <div className="relative" style={{ height: gridHeight }}>
              {/* 縦グリッド・今日線・設立判断線 */}
              {timeline.months.map((month) => (
                <span key={`grid-${month.pct}`} className={`absolute top-0 w-px ${month.isYearStart ? "bg-[#cfc7b9]" : "bg-[#eee9df]"}`} style={{ left: `${month.pct}%`, height: gridHeight }} aria-hidden="true" />
              ))}
              {timeline.objectivePct != null && (
                <span className="absolute top-0 border-l-2 border-dotted border-[#76637b]" style={{ left: `${timeline.objectivePct}%`, height: gridHeight }} aria-hidden="true" />
              )}
              <span className="absolute top-0 z-10 w-[2px] bg-[#24231f]" style={{ left: `${timeline.todayPct}%`, height: gridHeight }} aria-hidden="true" />
              <span className="absolute z-20 -translate-x-1/2 rounded-sm bg-[#24231f] px-1 py-px text-[8px] font-bold leading-tight text-white" style={{ left: `${timeline.todayPct}%`, top: -2 }}>
                今日 {sxFormatDate(asOf).slice(5)}
              </span>

              {/* 重要経路の接続線 */}
              {criticalPolyline.length >= 2 && (
                <svg className="pointer-events-none absolute inset-0 z-[5]" width="100%" height={gridHeight} preserveAspectRatio="none" viewBox={`0 0 100 ${gridHeight}`} aria-hidden="true">
                  <polyline
                    points={criticalPolyline.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="none"
                    stroke="#24231f"
                    strokeWidth="1.2"
                    strokeDasharray="3 2.2"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}

              {/* ピン行 */}
              <div className="absolute inset-x-0 top-0 border-b border-[#e8e2d6]" style={{ height: PIN_ROW_H }}>
                {timeline.pins.map((pin) => (
                  <a
                    key={pin.key}
                    href={pin.anchor.startsWith("#") ? pin.anchor : `#${pin.anchor}`}
                    onClick={(event) => {
                      event.preventDefault();
                      onPinClick(pin.anchor);
                    }}
                    data-sx-pin={pin.rank}
                    className={`absolute top-1/2 z-10 flex h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold leading-none text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] ${pin.side === "partner" ? "bg-[#bf7b2c]" : "bg-[#24231f]"} ${pin.dueDatePrecision === "month" ? "ring-2 ring-[#e3c994]" : ""}`}
                    style={{ left: `${pin.duePct}%` }}
                    title={`${pin.rank} ${pin.target}（期限 ${pin.dueDate}${pin.dueDatePrecision === "month" ? "・月精度" : ""}）`}
                    aria-label={`介入${pin.rank}番 ${pin.target} 期限位置`}
                  >
                    {pin.rank}
                  </a>
                ))}
              </div>

              {/* レーン行のバー */}
              <div className="absolute inset-x-0" style={{ top: PIN_ROW_H }}>
                {timeline.lanes.map((lane) => (
                  <div key={lane.key} style={{ marginBottom: LANE_GAP }}>
                    <div className="border-b border-[#d6cebf]" style={{ height: LANE_HEADER_H }} />
                    {lane.rows.map((row) => (
                      <div key={row.slug} className={`border-b border-[#f1eee5] ${row.isCurrent ? "bg-[#f4f9f5]" : ""}`} style={{ height: ROW_H }}>
                        <RowBar row={row} accent={lane.accent} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 凡例と非表示分の明示 */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px] text-[#9b9487]">
            <span>バー=計画（開始→予定） ・ 縦線=予定日 ・ ◇=予測日（中抜き=仮） ・ 橙バー=遅延幅 ・ 太字+黒左罫=重要経路（破線でつながる） ・ ①ピン=介入の期日（橙=相手側ボール / 黒=当方）</span>
            {(timeline.undatedCount > 0 || timeline.completedCount > 0) && (
              <span className="font-semibold text-[#69665d]">
                {timeline.undatedCount > 0 ? `日程未登録 ${timeline.undatedCount}件` : ""}{timeline.undatedCount > 0 && timeline.completedCount > 0 ? " ・ " : ""}{timeline.completedCount > 0 ? `完了 ${timeline.completedCount}件` : ""}（下の詳細表で確認）
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
