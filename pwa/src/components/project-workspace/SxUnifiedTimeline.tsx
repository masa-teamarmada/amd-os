"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  ChevronRight,
  Flag,
  Plus,
} from "lucide-react";
import type {
  SxEcdTimelineRow,
  SxEcdUnifiedTimeline,
} from "@/lib/sx-executive-control-deck";
import type {
  SxDependency,
  SxManagementBundle,
  SxManagementMilestone,
  SxOutcome,
  SxTask,
  SxTimelineKind,
  SxTrackKey,
} from "@/lib/sx-management";
import {
  sxGateRequirementCounts,
  sxGateRequirementState,
  sxGateRequirementsBySuccessor,
  sxIsBlockingMilestone,
  sxMilestoneRequiredTaskSummary,
  type SxGateRequirement,
} from "@/lib/sx-gate-requirements";
import {
  computeBarMove,
  computeBarResizeEnd,
  computeBarResizeStart,
  computeGateEndMove,
  computeMilestoneMove,
  dateFromPct,
  diffDays,
  isWithinClickThreshold,
  shouldCancelOnLostPointerCapture,
} from "@/lib/sx-gantt-drag";
import { sxFormatDate } from "./sx-visual-shared";

const MONTH_ROW_H = 20;
const PIN_ROW_H = 22;
const LANE_HEADER_H = 22;
const ROW_H = 48;
const MILESTONE_PROMPT_FLIP_Y = 138;
const LANE_GAP = 2;
// Reserve a real pointer gutter at both ends of the date domain. A 44px diamond centred on the
// first/last day then stays wholly inside the grid, and a 16px resize handle can sit outside a
// boundary bar without disappearing under the sticky label column or the scroll edge.
const TIMELINE_SIDE_GUTTER_PX = 22;
const MIN_BAR_HIT_WIDTH_PX = 16;

function timelinePctCss(pct: number, extraPx = 0) {
  const clamped = Math.min(100, Math.max(0, pct));
  // Linear map: 0% -> 22px, 100% -> calc(100% - 22px).
  const offsetPx = TIMELINE_SIDE_GUTTER_PX * (1 - clamped / 50) + extraPx;
  return `calc(${clamped}% + ${offsetPx.toFixed(3)}px)`;
}

function timelineSpanCss(startPct: number, endPct: number) {
  const delta = Math.max(0, endPct - startPct);
  return `calc(${delta}% - ${((TIMELINE_SIDE_GUTTER_PX * 2 * delta) / 100).toFixed(3)}px)`;
}

function barHitGeometryCss(startPct: number, endPct: number) {
  const actualWidth = timelineSpanCss(startPct, endPct);
  const width = `max(${MIN_BAR_HIT_WIDTH_PX}px, ${actualWidth})`;
  // At the right edge, grow a minimum-width bar leftwards so the end handle remains inside the
  // domain gutter. Everywhere else keep the true start position fixed and grow rightwards.
  const left = endPct >= 100
    ? `calc(${timelinePctCss(endPct)} - ${width})`
    : timelinePctCss(startPct);
  return { left, width, right: `calc(${left} + ${width})` };
}

function pointerOffsetToTimelinePct(offsetX: number, paneWidth: number) {
  const innerWidth = paneWidth - TIMELINE_SIDE_GUTTER_PX * 2;
  if (innerWidth <= 0) return 0;
  return Math.min(
    100,
    Math.max(0, ((offsetX - TIMELINE_SIDE_GUTTER_PX) / innerWidth) * 100),
  );
}

type DisplayRow = {
  id: string;
  entity: "milestone" | "task";
  milestoneId: string;
  parentTaskId: string | null;
  depth: number;
  title: string;
  state: SxEcdTimelineRow["state"];
  isCritical: boolean;
  isCurrent: boolean;
  isBlockingMilestone: boolean;
  /** phase = rendered as a bar (工程); milestone = rendered as a diamond (MS). null for task
   * rows — tasks are never diamonds. Blocking-gate rows (isBlockingMilestone) always render as
   * a diamond regardless of this value — that special-case stays slug-driven, everything else
   * must read this column instead of guessing from slug. */
  timelineKind: SxTimelineKind | null;
  /** project_management_milestones.version / project_management_tasks.version at the time this
   * row was built. Sent back as expected_version on a gantt-drag PATCH. */
  version: number;
  gate: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualEnd: string | null;
  plannedStartPct: number | null;
  plannedEndPct: number | null;
  dateCertainty: "confirmed" | "provisional" | null;
  ownerLabel: string;
  progressPct: number;
  progressRegistered: boolean;
  hasChildren: boolean;
  requirements: SxGateRequirement[];
  /** Only set for the two founding-prerequisite milestone rows (business-paid-poc /
   * funding-investment). Achievement here follows sxGateRequirementState — the 4-item oral
   * agreement evidence alone is not enough, required tasks must also be complete. */
  achievement?: SxGateRequirement["state"] | null;
  requiredTaskSummary?: {
    completed: number;
    total: number;
    nextIncompleteTitle: string | null;
  } | null;
};

type LaneMeta = {
  key: string;
  label: string;
  shortLabel: string;
  accent: string;
  maxIssue: string;
};

/** The gantt shows exactly 3 lanes, never the raw 4 tracks: 資金調達(funding) has no dedicated
 * lane of its own — it merges into 組織開発 alongside organizational_building. There is no
 * separate "設立前提" lane; the two blocking milestones are forced into these 3 lanes directly
 * (see BLOCKING_MILESTONE_LANE below), not rendered as a 4th synthetic lane. */
export type SxDisplayLaneKey =
  | "business_development"
  | "technology_development"
  | "organization";

const DISPLAY_LANE_ORDER: SxDisplayLaneKey[] = [
  "business_development",
  "technology_development",
  "organization",
];

const DISPLAY_LANE_LABEL: Record<SxDisplayLaneKey, string> = {
  business_development: "事業開発",
  technology_development: "技術開発",
  organization: "組織開発",
};

function displayLaneKeyForTrack(trackKey: string): SxDisplayLaneKey {
  if (trackKey === "business_development") return "business_development";
  if (trackKey === "technology_development") return "technology_development";
  return "organization";
}

/** The 2 blocking milestones never follow their own track column — each is forced into a fixed
 * display lane regardless of its project_management_milestones.track value. */
const BLOCKING_MILESTONE_LANE: Record<string, SxDisplayLaneKey> = {
  "business-paid-poc-oral-agreement": "business_development",
  "funding-investment-oral-agreement": "organization",
};

const ROW_STATE_TEXT: Record<DisplayRow["state"], string> = {
  complete: "完了",
  current: "進行中",
  future: "予定",
  blocked: "停止",
  overdue: "期限超過",
  unassessed: "進捗未登録",
  attention: "要確認",
};

const GATE_STATE_TONE: Record<SxGateRequirement["state"], string> = {
  met: "border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]",
  unconfirmed: "border-[#e3c994] bg-[#fbf1dc] text-[#765022]",
  unmet: "border-[#d8b0a8] bg-[#f9e4e1] text-[#8c3329]",
};

const GATE_STATE_TEXT: Record<SxGateRequirement["state"], string> = {
  met: "充足",
  unconfirmed: "未確認",
  unmet: "未達",
};

function dateToPct(
  date: string | null,
  domainStart: string,
  domainEnd: string,
) {
  if (!date) return null;
  const start = Date.parse(`${domainStart}T00:00:00.000Z`);
  const end = Date.parse(`${domainEnd}T00:00:00.000Z`);
  const value = Date.parse(`${date}T00:00:00.000Z`);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(value) ||
    end <= start
  )
    return null;
  return Math.min(100, Math.max(0, ((value - start) / (end - start)) * 100));
}

function classifyTask(task: SxTask, asOf: string): DisplayRow["state"] {
  if (task.status === "completed") return "complete";
  if (task.status === "blocked") return "blocked";
  if (task.plannedEnd && task.plannedEnd < asOf) return "overdue";
  if (task.status === "unassessed") return "unassessed";
  if (task.status === "attention" || task.status === "at_risk")
    return "attention";
  return task.progressPct > 0 ? "current" : "future";
}

function milestoneDisplayRow(
  row: SxEcdTimelineRow,
  milestone: SxManagementMilestone | undefined,
  requirements: SxGateRequirement[],
  hasChildren: boolean,
): DisplayRow {
  return {
    id: row.milestoneId,
    entity: "milestone",
    milestoneId: row.milestoneId,
    parentTaskId: null,
    depth: 0,
    title: row.title,
    state: row.state,
    isCritical: row.isCritical,
    isCurrent: row.isCurrent,
    isBlockingMilestone: Boolean(milestone && sxIsBlockingMilestone(milestone)),
    timelineKind: milestone?.timelineKind ?? "phase",
    version: milestone?.version ?? 1,
    gate: milestone?.gate || row.gate,
    plannedStart: row.plannedStart,
    plannedEnd: row.plannedEnd,
    actualEnd: milestone?.actualEnd || null,
    plannedStartPct: row.plannedStartPct,
    plannedEndPct: row.plannedEndPct,
    dateCertainty: row.dateCertainty,
    ownerLabel: row.ownerLabel,
    progressPct: row.progressPct,
    progressRegistered: row.state !== "unassessed",
    hasChildren,
    requirements,
  };
}

function blockingRowState(
  status: SxManagementMilestone["manualStatus"],
): DisplayRow["state"] {
  if (status === "completed") return "complete";
  if (status === "blocked") return "blocked";
  if (status === "attention" || status === "at_risk") return "attention";
  if (status === "unassessed") return "unassessed";
  return "current";
}

/** Founding-prerequisite milestone row. Dates come straight from the milestone (currently
 * always null — no date is invented here) and go through the same dateToPct as every other
 * row, so if a real date is ever entered this row naturally gains a normal bar instead of
 * needing a separate code path. */
function blockingMilestoneRow(
  milestone: SxManagementMilestone,
  hasChildren: boolean,
  tasks: SxTask[],
  timeline: SxEcdUnifiedTimeline,
): DisplayRow {
  const summary = sxMilestoneRequiredTaskSummary(milestone.id, tasks);
  const achievement = sxGateRequirementState(milestone, tasks);
  return {
    id: milestone.id,
    entity: "milestone",
    milestoneId: milestone.id,
    parentTaskId: null,
    depth: 0,
    title: milestone.gate || milestone.title,
    state: blockingRowState(milestone.manualStatus),
    isCritical: false,
    isCurrent: false,
    isBlockingMilestone: true,
    timelineKind: milestone.timelineKind,
    version: milestone.version,
    gate: milestone.gate,
    plannedStart: milestone.plannedStart,
    plannedEnd: milestone.plannedEnd,
    actualEnd: milestone.actualEnd,
    plannedStartPct: dateToPct(
      milestone.plannedStart,
      timeline.domainStart,
      timeline.domainEnd,
    ),
    plannedEndPct: dateToPct(
      milestone.plannedEnd,
      timeline.domainStart,
      timeline.domainEnd,
    ),
    dateCertainty: milestone.dateCertainty,
    ownerLabel: milestone.ownerLabel || "担当未確認",
    progressPct: milestone.progressPct,
    progressRegistered: milestone.manualStatus !== "unassessed",
    hasChildren,
    requirements: [],
    achievement,
    requiredTaskSummary: {
      completed: summary.completed,
      total: summary.total,
      nextIncompleteTitle: summary.nextIncomplete?.title ?? null,
    },
  };
}

function taskDisplayRow(
  task: SxTask,
  depth: number,
  hasChildren: boolean,
  timeline: SxEcdUnifiedTimeline,
  asOf: string,
): DisplayRow {
  const state = classifyTask(task, asOf);
  return {
    id: task.id,
    entity: "task",
    milestoneId: task.milestoneId,
    parentTaskId: task.parentTaskId,
    depth,
    title: task.title,
    state,
    isCritical: false,
    isCurrent: state === "current",
    isBlockingMilestone: false,
    timelineKind: null,
    version: task.version,
    gate: "",
    plannedStart: task.plannedStart,
    plannedEnd: task.plannedEnd,
    actualEnd: task.actualEnd,
    plannedStartPct: dateToPct(
      task.plannedStart,
      timeline.domainStart,
      timeline.domainEnd,
    ),
    plannedEndPct: dateToPct(
      task.plannedEnd,
      timeline.domainStart,
      timeline.domainEnd,
    ),
    dateCertainty: task.dateCertainty,
    ownerLabel: task.ownerLabel,
    progressPct: task.progressPct,
    progressRegistered: task.status !== "unassessed",
    hasChildren,
    requirements: [],
  };
}

function lanesTotalHeight(
  lanes: Array<{ rows: DisplayRow[] }>,
  includeTaskWriterRow: boolean,
) {
  return lanes.reduce(
    (sum, lane) =>
      sum +
      LANE_HEADER_H +
      (lane.rows.length + (includeTaskWriterRow ? 1 : 0)) * ROW_H +
      LANE_GAP,
    0,
  );
}

/** Row height is 48px; every pointer-drag hit target (move zone, resize handles, diamond) is
 * centered vertically in the row at this height, well above the 44px minimum touch target. */
const DRAG_HIT_HEIGHT = 44;
const DRAG_HIT_TOP = (ROW_H - DRAG_HIT_HEIGHT) / 2;

function RowBar({
  row,
  accent,
  selected,
  canManage,
  dragging,
  saving,
  onOpen,
  onTimelinePoint,
  onPointerDownMove,
  onPointerDownResizeStart,
  onPointerDownResizeEnd,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
}: {
  row: DisplayRow;
  accent: string;
  selected: boolean;
  canManage: boolean;
  dragging: boolean;
  saving: boolean;
  onOpen: () => void;
  onTimelinePoint: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onPointerDownMove: (event: React.PointerEvent) => void;
  onPointerDownResizeStart: (event: React.PointerEvent) => void;
  onPointerDownResizeEnd: (event: React.PointerEvent) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
  onPointerCancel: (event: React.PointerEvent) => void;
  onLostPointerCapture: (event: React.PointerEvent) => void;
}) {
  const barStart = row.plannedStartPct ?? row.plannedEndPct ?? 0;
  const plannedEnd = row.plannedEndPct;
  const hasBar = plannedEnd != null;
  const provisional = row.dateCertainty === "provisional";
  const counts = sxGateRequirementCounts(row.requirements);
  // Any timelineKind==="milestone" row renders as a diamond, not a bar — rendering must read
  // this column, never infer from slug. The 2 founding-prerequisite gates keep their
  // isBlockingMilestone special-case (slug-driven) on top of this.
  const isMilestoneMarker = row.isBlockingMilestone || row.timelineKind === "milestone";
  // A normal range is draggable only when BOTH endpoints exist. End-only normal rows are
  // intentionally read-only on the gantt: there is no honest duration to move or resize yet.
  // The sole end-only draggable exception is the NewCo diamond below.
  const draggableBar =
    canManage && row.plannedStart != null && row.plannedEnd != null && !isMilestoneMarker;
  const draggableMilestone =
    canManage &&
    hasBar &&
    isMilestoneMarker &&
    // Only the two NewCo gates may drag from an end-only date. A generic point-MS must have its
    // start/end pair established (normally equal) before it exposes a drag affordance.
    (row.isBlockingMilestone || row.plannedStart != null);
  const barGeometry = hasBar && !isMilestoneMarker
    ? barHitGeometryCss(barStart, plannedEnd)
    : null;
  // blocking milestone行は「必須タスク 完了/総数・次の未完了」を常時1行目に出すため、日付が
  // 入ってバー/◇が付いても潰されないよう、通常行より下へ寄せる（48px行の中で summary(0-13px) →
  // ◇(13-25px) → bar(24-32px) → 予定/実績(36-48px)の順に積む。日付は捏造しない）。
  const barTop = row.isBlockingMilestone ? 24 : 15;
  const detailHitStyle = isMilestoneMarker
    ? {
        top: DRAG_HIT_TOP,
        left: timelinePctCss(plannedEnd ?? 0),
        width: DRAG_HIT_HEIGHT,
        height: DRAG_HIT_HEIGHT,
        transform: "translateX(-50%)",
      }
    : {
        top: DRAG_HIT_TOP,
        left: barGeometry?.left,
        width: barGeometry?.width,
        height: DRAG_HIT_HEIGHT,
      };
  return (
    <div
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className={`group relative h-full w-full ${selected ? "bg-[#e8f2eb]/70" : "hover:bg-[#f8f5ec]/70"} ${dragging ? "cursor-grabbing" : ""} ${saving ? "opacity-60" : ""}`}
    >
      {/* The row is split into two real interactions: its true blank timeline surface proposes
          a new MS, while the rendered bar/diamond alone owns record selection and drag. Keeping
          them as sibling buttons prevents blank-click, select and post-drag click from firing as
          one ambiguous action. */}
      <button
        type="button"
        onClick={onTimelinePoint}
        disabled={!canManage || saving}
        className="absolute inset-0 z-0 w-full cursor-crosshair text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] disabled:cursor-default"
        aria-label={`${row.title}行の日付を選んでMSを追加`}
      />
      {/* Move-drag hit target: the actual bar's full width, never empty row space. Sits below
          (DOM-order-first, so lower stacking) the resize handles, which claim their own hit area
          at each edge. Visual bar stays 8px; this hit box is >=44px tall so touch/pointer users
          don't need pixel precision to grab it. */}
      {draggableBar && (
        <button
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation();
            onPointerDownMove(event);
          }}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          onLostPointerCapture={onLostPointerCapture}
          className="absolute z-20 cursor-grab focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
          style={{
            top: DRAG_HIT_TOP,
            left: barGeometry!.left,
            width: barGeometry!.width,
            height: DRAG_HIT_HEIGHT,
          }}
          title="ドラッグで期間を移動。クリックで詳細"
          aria-label={`${row.title}。ドラッグで期間を移動、クリックで詳細を開く`}
        />
      )}
      {hasBar && !draggableBar && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="absolute z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
          style={detailHitStyle}
          aria-label={`${row.title}の詳細を開く`}
        />
      )}
      {hasBar && !isMilestoneMarker && (
        <span
          className="pointer-events-none absolute h-[8px] overflow-hidden rounded-sm border"
          style={{
            top: barTop,
            left: barGeometry!.left,
            width: barGeometry!.width,
            borderColor: `${accent}99`,
            background: `${accent}${provisional ? "24" : "3d"}`,
          }}
        >
          {row.progressRegistered && row.progressPct > 0 && (
            <span
              className="absolute inset-y-0 left-0"
              style={{ width: `${row.progressPct}%`, background: accent }}
            />
          )}
        </span>
      )}
      {draggableBar && (
        <>
          {/* Resize handles: pointerdown only (this is where setPointerCapture happens).
              pointermove/up/cancel are deliberately NOT attached here — once captured, those
              events still bubble from this span up through the DOM to the parent <button>, which
              handles them exactly once. Attaching them here too was the double-PATCH bug (the
              same pointerup fired here, then bubbled and fired again on the button). Hit area is
              >=44px tall and only reveals its visual tick on row hover/focus so it stays
              discoverable without cluttering the row at rest. Each 16px hit target sits wholly
              OUTSIDE the bar edge, so even a same-day/very narrow bar keeps its center move zone. */}
          <button
            type="button"
            onPointerDown={(event) => {
              event.stopPropagation();
              onPointerDownResizeStart(event);
            }}
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
            onLostPointerCapture={onLostPointerCapture}
            className="absolute z-30 flex w-4 cursor-ew-resize items-center justify-end opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            style={{ top: DRAG_HIT_TOP, left: `calc(${barGeometry!.left} - 16px)`, height: DRAG_HIT_HEIGHT }}
            aria-label={`${row.title}の開始日を変更`}
          >
            <span className="block h-3 w-[3px] bg-[#24231f]" />
          </button>
          <button
            type="button"
            onPointerDown={(event) => {
              event.stopPropagation();
              onPointerDownResizeEnd(event);
            }}
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
            onLostPointerCapture={onLostPointerCapture}
            className="absolute z-30 flex w-4 cursor-ew-resize items-center justify-start opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            style={{ top: DRAG_HIT_TOP, left: barGeometry!.right, height: DRAG_HIT_HEIGHT }}
            aria-label={`${row.title}の終了日を変更`}
          >
            <span className="block h-3 w-[3px] bg-[#24231f]" />
          </button>
        </>
      )}
      {draggableMilestone && (
        <button
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation();
            onPointerDownMove(event);
          }}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          onLostPointerCapture={onLostPointerCapture}
          className="absolute z-30 -translate-x-1/2 cursor-grab focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
          style={{ top: DRAG_HIT_TOP, left: timelinePctCss(plannedEnd), width: DRAG_HIT_HEIGHT, height: DRAG_HIT_HEIGHT }}
          aria-label={`${row.title}。ドラッグで予定日を変更、クリックで詳細を開く`}
        />
      )}
      {hasBar && isMilestoneMarker && (
        <span
          className="pointer-events-none absolute top-[13px] -translate-x-1/2 text-center"
          style={{ left: timelinePctCss(plannedEnd) }}
        >
          {/* NewCo blocking gate = filled purple diamond; generic MS = hollow — matches Legend. */}
          <i
            className={`mx-auto block h-3 w-3 rotate-45 border-2 border-[#5f4a66] ${row.isBlockingMilestone ? "bg-[#5f4a66]" : "bg-[#fffdf7]"}`}
            aria-hidden="true"
          />
        </span>
      )}
      {/* blocking milestone（設立前提の2件）は「どのタスクをクリアすればMS達成か」を、日程の
          有無に関わらず常時1行目に文字で示す（日程未設定の行は帯の代わりにも使う）。日付は
          捏造しない。 */}
      {row.requiredTaskSummary && (
        <span className="pointer-events-none absolute inset-x-1 top-0.5 truncate text-[10px] font-semibold text-[#5f4a66]">
          必須タスク {row.requiredTaskSummary.completed}/
          {row.requiredTaskSummary.total}
          {row.requiredTaskSummary.total === 0
            ? "（未登録）"
            : row.requiredTaskSummary.nextIncompleteTitle
              ? ` ・ 次：${row.requiredTaskSummary.nextIncompleteTitle}`
              : " ・ 全完了"}
        </span>
      )}
      <span className="pointer-events-none absolute inset-x-1 bottom-0.5 z-10 flex flex-wrap items-center gap-2 overflow-hidden whitespace-nowrap text-[10px] font-semibold text-[#69665d]">
        {hasBar ? (
          <>
            <span>予定 {sxFormatDate(row.plannedEnd).slice(5)}</span>
            {!isMilestoneMarker && (
              <span
                className={
                  row.progressRegistered ? "text-[#315f7d]" : "text-[#765022]"
                }
              >
                実績{" "}
                {row.actualEnd
                  ? `完了 ${sxFormatDate(row.actualEnd).slice(5)}`
                  : row.progressRegistered
                    ? `${row.progressPct}%`
                    : "未登録"}
              </span>
            )}
          </>
        ) : (
          <span className="flex items-center gap-1">
            {isMilestoneMarker && (
              <i
                className={`inline-block h-3 w-3 shrink-0 rotate-45 border-2 border-[#5f4a66] ${row.isBlockingMilestone ? "bg-[#5f4a66]" : "bg-[#fffdf7]"}`}
                aria-hidden="true"
              />
            )}
            日程未設定・{ROW_STATE_TEXT[row.state]}
          </span>
        )}
        {counts.total > 0 && (
          <span
            className={
              counts.met === counts.total ? "text-[#205f49]" : "text-[#765022]"
            }
          >
            前提 {counts.met}/{counts.total}
          </span>
        )}
        {row.achievement && (
          <em
            className={`border px-1.5 py-0.5 text-[9px] font-bold not-italic ${GATE_STATE_TONE[row.achievement]}`}
          >
            {GATE_STATE_TEXT[row.achievement]}
          </em>
        )}
      </span>
    </div>
  );
}

function Legend() {
  return (
    <div
      className="mb-1.5 grid gap-px border border-[#d6cebf] bg-[#d6cebf] text-[10px] text-[#514e47] sm:grid-cols-4"
      aria-label="ガントの読み方"
    >
      <div className="flex items-center gap-2 bg-[#fffdf7] px-2 py-1">
        <span className="h-2 w-8 rounded-sm border border-[#7da18f] bg-[#dceae2]" />
        <span>計画期間｜薄いバー</span>
      </div>
      <div className="flex items-center gap-2 bg-[#fffdf7] px-2 py-1">
        <span className="h-2 w-8 rounded-sm bg-[#38745d]" />
        <span>実績｜濃い塗り・進捗率</span>
      </div>
      <div className="flex items-center gap-2 bg-[#fffdf7] px-2 py-1">
        <span className="h-2.5 w-2.5 rotate-45 border-2 border-[#5f4a66] bg-[#fffdf7]" />
        <span>MS（マイルストーン）｜計画上の到達目印</span>
      </div>
      <div className="flex items-center gap-2 bg-[#fffdf7] px-2 py-1">
        <span className="h-2.5 w-2.5 rotate-45 border-2 border-[#5f4a66] bg-[#5f4a66]" />
        <span>設立ゲート｜先へ進む前提（2件のみ）</span>
      </div>
    </div>
  );
}

/** MS表示の3分類: タスクは常にタスク。工程/MSの行はtimelineKind(工程 or 一般MS)と
 * isBlockingMilestone(設立前提の2件だけ)を見て判定する — スラグから推測しない。 */
function rowKindLabel(row: DisplayRow): string {
  if (row.entity === "task") return "タスク";
  if (row.isBlockingMilestone) return "設立ゲート";
  if (row.timelineKind === "milestone") return "マイルストーン";
  return "工程";
}

/** Pointer-drag state for gantt direct editing (move/resize a phase bar, move a milestone
 * diamond). `dragging` only flips true once the pointer has moved past CLICK_DRAG_THRESHOLD_PX —
 * below that, releasing the pointer is a plain row click, not a drag commit. */
// "milestone-move" = generic point-MS: the diamond drags both planned_start/planned_end together
// (computeMilestoneMove collapses them to one date, regardless of the row's original values).
// "milestone-end-move" = a NewCo blocking gate's end diamond: only planned_end moves,
// planned_start (if any) is preserved untouched (computeGateEndMove, and the PATCH below omits
// planned_start entirely so the server never overwrites it).
type DragMode = "move" | "resize-start" | "resize-end" | "milestone-move" | "milestone-end-move";
type DragState = {
  rowId: string;
  entity: "milestone" | "task";
  mode: DragMode;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  pxPerDay: number;
  original: { plannedStart: string | null; plannedEnd: string };
  version: number;
  previewStart: string | null;
  previewEnd: string;
  dragging: boolean;
  saving: boolean;
};

export function SxUnifiedTimeline({
  timeline,
  asOf,
  projectId = null,
  selectedMilestoneId,
  selectedTaskId = null,
  milestones = [],
  dependencies = [],
  tasks = [],
  outcomes = [],
  objectiveId = null,
  onSelectMilestone,
  onSelectTask = () => {},
  canManage,
  onCreateMilestone,
  onCreateTask = () => {},
  onManagementChange = () => {},
  showPins = true,
}: {
  timeline: SxEcdUnifiedTimeline;
  asOf: string;
  /** Enables gantt-direct-edit writes (drag move/resize) — this component owns its own PATCH
   * fetch calls, matching SxPartnerPipeline's pattern rather than round-tripping every
   * pixel-drag through the parent. MSを置く placement never POSTs here either way — it only
   * calls onCreateMilestone with a prefill. Omit (e.g. the compact 経営状況図 embed in
   * SxExecutiveControlDeck, which has no write surface) to render click-select-only, with no
   * drag handles and no placement toggle. */
  projectId?: string | null;
  selectedMilestoneId: string | null;
  selectedTaskId?: string | null;
  milestones?: SxManagementMilestone[];
  dependencies?: SxDependency[];
  tasks?: SxTask[];
  outcomes?: SxOutcome[];
  objectiveId?: string | null;
  onSelectMilestone: (milestoneId: string | null) => void;
  onSelectTask?: (taskId: string | null) => void;
  canManage: boolean;
  onEditMilestone?: (milestoneId: string) => void;
  /** Never POSTs by itself — always opens the parent's create-milestone form (the single shared
   * IssueEditor create_milestone flow), prefilled with whatever this component already knows
   * (lane track, clicked planned date, matching outcome, timeline_kind). Only that form's own
   * Save button performs the POST; canceling/closing it leaves no DB row. */
  onCreateMilestone: (prefill: {
    track: SxTrackKey | null;
    laneKey?: SxDisplayLaneKey | null;
    timelineKind?: SxTimelineKind;
    plannedDate?: string | null;
    outcomeId?: string | null;
  }) => void;
  onEditTask?: (taskId: string) => void;
  onCreateTask?: (laneKey: SxDisplayLaneKey) => void;
  onManagementChange?: (bundle: SxManagementBundle, message: string) => void;
  showPins?: boolean;
}) {
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(
    // 設立前提の2件は初期展開にする（配下の必須タスクを開いた状態で見せる）。
    () =>
      new Set(milestones.filter(sxIsBlockingMilestone).map((item) => item.id)),
  );
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(
    () => new Set(),
  );
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridPaneRef = useRef<HTMLDivElement>(null);
  const justDraggedRef = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  // Mirrors `drag` synchronously (React state updates are not visible to the very next event
  // handler in the same tick) — onLostPointerCapture needs to read the true current drag state,
  // not a stale closure, to decide whether a capture loss is abnormal (cancel) or just the
  // implicit release that follows a normal pointerup (do nothing, finishDrag already owns it).
  const dragRef = useRef<DragState | null>(null);
  // Set the instant finishDrag decides to actually PATCH (before any `await`), cleared once that
  // PATCH settles. lostpointercapture for this pointerId while it's set means "that was the
  // normal release after our own pointerup save, not an abnormal loss" — must not wipe the drag.
  const commitStartedPointerIdRef = useRef<number | null>(null);
  const [pendingMilestonePoint, setPendingMilestonePoint] = useState<{
    laneKey: SxDisplayLaneKey;
    date: string;
    viewportX: number;
    viewportY: number;
    side: "above" | "below";
  } | null>(null);
  const milestonePromptRef = useRef<HTMLDivElement>(null);
  const milestonePromptYesRef = useRef<HTMLButtonElement>(null);
  const milestonePromptOriginRef = useRef<HTMLButtonElement | null>(null);
  const milestonePromptSubmittingRef = useRef(false);
  const [ganttNotice, setGanttNotice] = useState<string | null>(null);

  // dragRef.current is the single source of truth, not the setState updater's `current` argument
  // (which reflects React's queued state — batched pointer events firing in the same tick could
  // still see it stale). Resolve against dragRef.current synchronously, assign the ref
  // immediately (before setDrag even runs), then hand setDrag a plain resolved value — never a
  // function with a ref-mutation side effect inside it.
  function setDragBoth(
    next: DragState | null | ((current: DragState | null) => DragState | null),
  ) {
    const resolved =
      typeof next === "function"
        ? (next as (c: DragState | null) => DragState | null)(dragRef.current)
        : next;
    dragRef.current = resolved;
    setDrag(resolved);
  }

  function showGanttNotice(message: string) {
    setGanttNotice(message);
    window.setTimeout(() => setGanttNotice(null), 4000);
  }

  // Best-effort refetch after ANY save failure (409 conflict or otherwise) — always attempt to
  // pull the true current state so the UI never keeps showing a stale optimistic preview. If the
  // refetch itself fails, say so explicitly instead of silently leaving the user unsure whether
  // their edit landed.
  async function bestEffortRefetchManagement(
    successMessage: string,
    failureFallbackMessage: string,
  ) {
    if (!projectId) {
      showGanttNotice(failureFallbackMessage);
      return;
    }
    try {
      const response = await fetch(
        `/api/project-workspace/${encodeURIComponent(projectId)}/management`,
        { headers: { "Cache-Control": "no-store" } },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !body) throw new Error("refetch failed");
      onManagementChange(body as SxManagementBundle, successMessage);
    } catch {
      showGanttNotice(failureFallbackMessage);
    }
  }

  const milestoneById = useMemo(
    () => new Map(milestones.map((milestone) => [milestone.id, milestone])),
    [milestones],
  );
  const requirementsBySuccessor = useMemo(
    () => sxGateRequirementsBySuccessor(milestones, dependencies, tasks),
    [dependencies, milestones, tasks],
  );

  // ガント外のカード帯ではなく、専用レーンとしてガント内部に表示する2件の設立前提。
  const blockingMilestones = useMemo(
    () =>
      milestones
        .filter(sxIsBlockingMilestone)
        .sort((left, right) => left.slug.localeCompare(right.slug)),
    [milestones],
  );

  const taskChildren = useMemo(() => {
    const map = new Map<string, SxTask[]>();
    for (const task of tasks) {
      const key = task.parentTaskId || `milestone:${task.milestoneId}`;
      map.set(key, [...(map.get(key) || []), task]);
    }
    for (const children of map.values())
      children.sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          left.title.localeCompare(right.title),
      );
    return map;
  }, [tasks]);

  // 事業開発／技術開発／組織開発の3レーンだけを描く。資金調達は独立レーンを持たず組織開発へ
  // 統合し、設立前提の2件は専用の4本目レーンではなく、それぞれの対象レーンへ直接組み込む。
  const visibleLanes = useMemo(() => {
    const appendTaskChildren = (
      milestoneId: string,
      rows: DisplayRow[],
      parentTaskId: string | null,
      depth: number,
    ) => {
      const key = parentTaskId || `milestone:${milestoneId}`;
      for (const task of taskChildren.get(key) || []) {
        const children = taskChildren.get(task.id) || [];
        rows.push(
          taskDisplayRow(task, depth, children.length > 0, timeline, asOf),
        );
        if (children.length > 0 && expandedTasks.has(task.id))
          appendTaskChildren(milestoneId, rows, task.id, depth + 1);
      }
    };

    const bucket: Record<SxDisplayLaneKey, DisplayRow[]> = {
      business_development: [],
      technology_development: [],
      organization: [],
    };

    for (const milestone of blockingMilestones) {
      const rows: DisplayRow[] = [];
      const children = taskChildren.get(`milestone:${milestone.id}`) || [];
      rows.push(
        blockingMilestoneRow(milestone, children.length > 0, tasks, timeline),
      );
      if (children.length > 0 && expandedMilestones.has(milestone.id))
        appendTaskChildren(milestone.id, rows, null, 1);
      bucket[BLOCKING_MILESTONE_LANE[milestone.slug] ?? "organization"].push(
        ...rows,
      );
    }

    for (const lane of timeline.lanes) {
      const laneKey = displayLaneKeyForTrack(lane.key);
      for (const milestone of lane.rows) {
        // 設立前提の2件は上ですでに強制配置済みなので、通常の柱レーンでは二重表示しない。
        const definition = milestoneById.get(milestone.milestoneId);
        if (definition && sxIsBlockingMilestone(definition)) continue;
        const rows: DisplayRow[] = [];
        const children =
          taskChildren.get(`milestone:${milestone.milestoneId}`) || [];
        rows.push(
          milestoneDisplayRow(
            milestone,
            definition,
            requirementsBySuccessor.get(milestone.milestoneId) || [],
            children.length > 0,
          ),
        );
        if (
          children.length > 0 &&
          expandedMilestones.has(milestone.milestoneId)
        )
          appendTaskChildren(milestone.milestoneId, rows, null, 1);
        bucket[laneKey].push(...rows);
      }
    }

    const laneByKey = new Map(timeline.lanes.map((lane) => [lane.key, lane]));
    const accentFor = (key: SxDisplayLaneKey) =>
      key === "organization"
        ? (laneByKey.get("organizational_building")?.accent ??
          laneByKey.get("funding")?.accent ??
          "#69665d")
        : (laneByKey.get(key)?.accent ?? "#69665d");
    const maxIssueFor = (key: SxDisplayLaneKey) =>
      key === "organization"
        ? [
            laneByKey.get("organizational_building")?.maxIssue,
            laneByKey.get("funding")?.maxIssue,
          ]
            .filter(Boolean)
            .join(" / ")
        : (laneByKey.get(key)?.maxIssue ?? "");

    return DISPLAY_LANE_ORDER.map((key) => ({
      lane: {
        key,
        label: DISPLAY_LANE_LABEL[key],
        shortLabel: DISPLAY_LANE_LABEL[key],
        accent: accentFor(key),
        maxIssue: maxIssueFor(key),
      } satisfies LaneMeta,
      rows: bucket[key],
    }));
  }, [
    asOf,
    blockingMilestones,
    expandedMilestones,
    expandedTasks,
    milestoneById,
    requirementsBySuccessor,
    taskChildren,
    tasks,
    timeline,
  ]);

  const hasAnyChildren = taskChildren.size > 0;
  const allExpanded =
    hasAnyChildren &&
    blockingMilestones.every(
      (milestone) =>
        !taskChildren.has(`milestone:${milestone.id}`) ||
        expandedMilestones.has(milestone.id),
    ) &&
    timeline.lanes.every((lane) =>
      lane.rows.every(
        (row) =>
          !taskChildren.has(`milestone:${row.milestoneId}`) ||
          expandedMilestones.has(row.milestoneId),
      ),
    ) &&
    tasks.every(
      (task) => !taskChildren.has(task.id) || expandedTasks.has(task.id),
    );
  const lanesHeight = lanesTotalHeight(
    visibleLanes,
    canManage && Boolean(projectId),
  );
  const pinRowHeight = showPins ? PIN_ROW_H : 0;
  const gridHeight = pinRowHeight + lanesHeight;

  function toggleAll() {
    if (allExpanded) {
      setExpandedMilestones(new Set());
      setExpandedTasks(new Set());
    } else {
      setExpandedMilestones(
        new Set([
          ...blockingMilestones.map((milestone) => milestone.id),
          ...timeline.lanes.flatMap((lane) =>
            lane.rows.map((row) => row.milestoneId),
          ),
        ]),
      );
      setExpandedTasks(new Set(tasks.map((task) => task.id)));
    }
  }

  function select(row: DisplayRow) {
    if (row.entity === "milestone") {
      onSelectTask(null);
      onSelectMilestone(row.id);
    } else {
      onSelectMilestone(null);
      onSelectTask(row.id);
    }
    if (window.innerWidth <= 900) {
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(
            `[data-plan-row="${row.entity}:${row.id}"]`,
          )
          ?.scrollIntoView({ block: "start" });
      });
    }
  }

  // Esc cancels an in-flight drag without persisting anything — matches pointercancel, which is
  // handled directly on the drag handle elements below.
  const isDragging = drag !== null;
  useEffect(() => {
    if (!isDragging) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Once pointerup has started the PATCH, there is no client-side cancellation contract.
      // Keep the saving preview visible until the server settles; pretending Esc cancelled here
      // would hide an update that may already have committed.
      if (dragRef.current?.saving) return;
      event.preventDefault();
      setDragBoth(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDragging]);

  // The Y/N question is deliberately a lightweight non-modal popover. It disappears before the
  // real MS editor opens, so the dashboard never stacks two dialogs. Escape/N restore focus to
  // the exact timeline point that opened it; scrolling or resizing closes the stale-positioned
  // popover instead of leaving it detached from the clicked date.
  useEffect(() => {
    if (!pendingMilestonePoint) return;
    milestonePromptYesRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setPendingMilestonePoint(null);
      requestAnimationFrame(() => milestonePromptOriginRef.current?.focus());
    }
    function closeOnViewportMove() {
      setPendingMilestonePoint(null);
    }
    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target as Node | null;
      if (
        target &&
        !milestonePromptRef.current?.contains(target) &&
        !milestonePromptOriginRef.current?.contains(target)
      )
        setPendingMilestonePoint(null);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", closeOnViewportMove);
    window.addEventListener("scroll", closeOnViewportMove, true);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", closeOnViewportMove);
      window.removeEventListener("scroll", closeOnViewportMove, true);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [pendingMilestonePoint]);

  function beginDrag(row: DisplayRow, mode: DragMode, event: React.PointerEvent) {
    if (!canManage || !projectId || drag) return;
    if (!row.plannedEnd) return;
    // Every mode except a gate's end-only move requires a real plannedStart to drag from —
    // "milestone-end-move" is the one case where an end-only NewCo gate must still be draggable.
    if (mode !== "milestone-end-move" && !row.plannedStart) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    commitStartedPointerIdRef.current = null;
    const paneWidth = gridPaneRef.current?.getBoundingClientRect().width || 0;
    const totalDays = Math.max(1, diffDays(timeline.domainStart, timeline.domainEnd));
    setDragBoth({
      rowId: row.id,
      entity: row.entity,
      mode,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      pxPerDay: Math.max(1, paneWidth - TIMELINE_SIDE_GUTTER_PX * 2) / totalDays,
      original: { plannedStart: row.plannedStart, plannedEnd: row.plannedEnd },
      version: row.version,
      previewStart: row.plannedStart,
      previewEnd: row.plannedEnd,
      dragging: false,
      saving: false,
    });
  }

  function updateDrag(event: React.PointerEvent) {
    setDragBoth((current) => {
      if (!current || current.pointerId !== event.pointerId || current.saving) return current;
      const deltaX = event.clientX - current.startClientX;
      const deltaY = event.clientY - current.startClientY;
      const dragging = current.dragging || !isWithinClickThreshold(deltaX, deltaY);
      if (!dragging) return current.dragging === dragging ? current : { ...current, dragging };
      let previewStart = current.original.plannedStart;
      let previewEnd = current.original.plannedEnd;
      if (current.mode === "move") {
        // Guarded by beginDrag: "move" never starts without a non-null plannedStart.
        const moved = computeBarMove(
          { plannedStart: current.original.plannedStart as string, plannedEnd: current.original.plannedEnd },
          deltaX,
          current.pxPerDay,
        );
        previewStart = moved.plannedStart;
        previewEnd = moved.plannedEnd;
      } else if (current.mode === "milestone-move") {
        // Generic point-MS: collapse to a single date regardless of the row's original values,
        // so both columns always land equal (the point-MS invariant), never "preserve duration".
        const moved = computeMilestoneMove({ plannedDate: current.original.plannedEnd }, deltaX, current.pxPerDay);
        previewStart = moved.plannedDate;
        previewEnd = moved.plannedDate;
      } else if (current.mode === "resize-start") {
        previewStart = computeBarResizeStart(
          { plannedStart: current.original.plannedStart as string, plannedEnd: current.original.plannedEnd },
          deltaX,
          current.pxPerDay,
        ).plannedStart;
      } else if (current.mode === "resize-end") {
        previewEnd = computeBarResizeEnd(
          { plannedStart: current.original.plannedStart as string, plannedEnd: current.original.plannedEnd },
          deltaX,
          current.pxPerDay,
        ).plannedEnd;
      } else if (current.mode === "milestone-end-move") {
        // NewCo blocking gate: only the end diamond moves; plannedStart is preserved (and never
        // sent in the PATCH below), so the server-side value is untouched either way.
        previewEnd = computeGateEndMove(current.original, deltaX, current.pxPerDay).plannedEnd;
      }
      return { ...current, dragging, previewStart, previewEnd };
    });
  }

  function handleLostPointerCapture(event: React.PointerEvent) {
    if (
      shouldCancelOnLostPointerCapture(
        dragRef.current?.pointerId ?? null,
        commitStartedPointerIdRef.current,
        event.pointerId,
      )
    ) {
      setDragBoth(null);
    }
  }

  async function finishDrag(row: DisplayRow, event: React.PointerEvent) {
    // Read dragRef.current, not the `drag` state closed over by this render — if a pointermove
    // (updateDrag) and this pointerup land in the same batch/tick before React re-renders, the
    // `drag` variable in this closure could still be one step behind dragRef.current, and the
    // last preview computed by that pointermove would be silently dropped from the PATCH.
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId || !projectId) return;
    if (!current.dragging) {
      // Below the click/drag threshold the whole gesture is a plain click — let the button's
      // native onClick (which fires right after this pointerup) perform the selection, so
      // keyboard activation (Enter/Space, which never sees pointer events) goes through the
      // exact same path.
      setDragBoth(null);
      return;
    }
    if (
      current.previewStart === current.original.plannedStart &&
      current.previewEnd === current.original.plannedEnd
    ) {
      // Moved past the threshold but rounded back to the same day (e.g. a diagonal flick) —
      // nothing actually changed, so there is nothing to persist.
      justDraggedRef.current = true;
      window.setTimeout(() => {
        justDraggedRef.current = false;
      }, 0);
      setDragBoth(null);
      return;
    }
    justDraggedRef.current = true;
    window.setTimeout(() => {
      justDraggedRef.current = false;
    }, 0);
    // Mark the commit as begun BEFORE the first await, synchronously within this same pointerup
    // dispatch — the lostpointercapture that follows normal release checks this to know not to
    // cancel what we're about to save.
    commitStartedPointerIdRef.current = current.pointerId;
    setDragBoth({ ...current, saving: true });
    try {
      const patch: Record<string, string | null> =
        current.mode === "resize-start"
          ? { planned_start: current.previewStart }
          : current.mode === "resize-end" || current.mode === "milestone-end-move"
            ? { planned_end: current.previewEnd }
            : { planned_start: current.previewStart, planned_end: current.previewEnd };
      const response = await fetch(
        `/api/project-workspace/${encodeURIComponent(projectId)}/management`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resource: current.entity,
            id: current.rowId,
            patch,
            expected_version: current.version,
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (response.status === 409) {
        setDragBoth(null);
        await bestEffortRefetchManagement(
          "他の人がこの内容を先に更新したよ。最新の内容に更新したよ",
          "他の人がこの内容を先に更新したみたい。最新の状態を確認できなかったから、画面を再読み込みしてね",
        );
        return;
      }
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "保存できなかったよ");
      setDragBoth(null);
      onManagementChange(
        body.bundle as SxManagementBundle,
        current.mode === "milestone-move" || current.mode === "milestone-end-move"
          ? "マイルストーンの日付を更新したよ"
          : "計画日程を更新したよ",
      );
    } catch (caught) {
      setDragBoth(null);
      const message = caught instanceof Error ? caught.message : "保存できなかったよ";
      await bestEffortRefetchManagement(
        `${message}。最新の状態に更新したよ`,
        `${message}。保存できたか確認できなかったよ。画面を再読み込みしてね`,
      );
    } finally {
      commitStartedPointerIdRef.current = null;
    }
  }

  function handleRowClick(row: DisplayRow) {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    setPendingMilestonePoint(null);
    select(row);
  }

  function proposeMilestone(
    laneKey: SxDisplayLaneKey,
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    if (!canManage || !projectId) return;
    if (!timeline.valid) {
      showGanttNotice("日付軸を確定できないため、この位置にはMSを追加できないよ");
      return;
    }
    if (!objectiveId) {
      showGanttNotice("設立目標が未確認のためMSを置けないよ");
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    // Keyboard activation has no pointer coordinate. Use the focused date surface's center and let
    // the user fine-tune the prefilled date in the editor; pointer/touch keeps the exact x position.
    const clientX = event.detail === 0 ? rect.left + rect.width / 2 : event.clientX;
    const clientY = event.detail === 0 ? rect.top + rect.height / 2 : event.clientY;
    const pct = pointerOffsetToTimelinePct(clientX - rect.left, rect.width);
    const date = dateFromPct(pct, timeline.domainStart, timeline.domainEnd);
    if (!date) {
      showGanttNotice("この位置の日付を判定できなかったよ");
      return;
    }
    milestonePromptOriginRef.current = event.currentTarget;
    milestonePromptSubmittingRef.current = false;
    setPendingMilestonePoint({
      laneKey,
      date,
      viewportX: Math.min(
        window.innerWidth - Math.min(130, window.innerWidth / 2),
        Math.max(Math.min(130, window.innerWidth / 2), clientX),
      ),
      viewportY: Math.min(window.innerHeight - 18, Math.max(18, clientY)),
      side: clientY < MILESTONE_PROMPT_FLIP_Y ? "below" : "above",
    });
  }

  // Y only hands the parent a prefill and opens the existing create_milestone form. No write
  // happens until that form's Save button is pressed; N/Escape leave no DB row behind.
  function placeMilestone(laneKey: SxDisplayLaneKey, date: string) {
    if (milestonePromptSubmittingRef.current) return;
    milestonePromptSubmittingRef.current = true;
    setPendingMilestonePoint(null);
    const laneOutcomes = outcomes.filter(
      (item) => displayLaneKeyForTrack(item.track) === laneKey,
    );
    // Only preselect a parent when this visible lane maps to exactly one outcome. 組織開発 may
    // contain both funding and organizational_building outcomes; silently choosing one would
    // create a plausible-looking but semantically wrong MS. In that ambiguous case the form opens
    // with no outcome selected and makes the user choose the exact parent before Save is enabled.
    const singleOutcome = laneOutcomes.length === 1 ? laneOutcomes[0] : null;
    const track = singleOutcome?.track ?? null;
    const outcomeId = singleOutcome?.id ?? null;
    onCreateMilestone({
      track,
      laneKey,
      timelineKind: "milestone",
      plannedDate: date,
      outcomeId,
    });
  }

  return (
    <div data-testid="sx-unified-timeline">
      {!timeline.valid && (
        <p className="mb-2 border border-dashed border-[#b5533f] bg-[#f9e4e1] px-3 py-2 text-[11px] font-semibold text-[#8c3329]">
          {timeline.reason}
          {blockingMilestones.length > 0 &&
            "。設立前提の2件は日程未設定でも該当レーンに表示するよ。"}
        </p>
      )}
      {ganttNotice && (
        <p role="alert" className="mb-2 border border-[#e3c994] bg-[#fbf1dc] px-3 py-2 text-[11px] font-semibold text-[#765022]">
          {ganttNotice}
        </p>
      )}
      <div className="hidden lg:block">
        <Legend />
      </div>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        {canManage && (
          <button
            type="button"
            onClick={() => onCreateMilestone({ track: null })}
            className="inline-flex min-h-11 items-center gap-1 border border-[#315f7d] bg-[#315f7d] px-3 text-[11px] font-bold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            工程
          </button>
        )}
        <button
          type="button"
          disabled={!hasAnyChildren}
          onClick={toggleAll}
          className="inline-flex min-h-11 items-center gap-1 border border-[#d6cebf] bg-[#fffdf7] px-3 text-[11px] font-semibold text-[#514e47] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {allExpanded ? (
            <ChevronsDownUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5" />
          )}
          {allExpanded ? "すべて閉じる" : "すべて展開"}
        </button>
        <button
          type="button"
          onClick={() => {
            const node = scrollerRef.current;
            if (node)
              node.scrollTo({
                left: Math.max(
                  0,
                  ((node.scrollWidth - node.clientWidth) * timeline.todayPct) /
                    100 -
                    node.clientWidth * 0.5,
                ),
                behavior: "smooth",
              });
          }}
          className="hidden min-h-11 border border-[#d6cebf] bg-[#fffdf7] px-3 text-[11px] font-semibold text-[#514e47] lg:inline-flex lg:items-center"
        >
          今日へ
        </button>
        <span className="ml-auto hidden text-[10px] text-[#777166] lg:inline">
          横に動かせるよ <span aria-hidden="true">↔</span>
        </span>
      </div>

      <div className="space-y-2 lg:hidden" aria-label="工程とタスクの縦一覧">
        {visibleLanes.map(({ lane, rows }) => (
          <section
            key={`mobile-${lane.key}`}
            className="border border-[#d6cebf] bg-[#fffdf7]"
          >
            <header className="flex items-center gap-2 border-b border-[#d6cebf] bg-[#f8f5ec] px-3 py-2">
              <span
                className="h-2.5 w-2.5"
                style={{ background: lane.accent }}
              />
              <b className="text-[11px] text-[#24231f]">{lane.label}</b>
              <span className="text-[9px] text-[#777166]">
                工程 {rows.filter((row) => row.entity === "milestone").length}
              </span>
            </header>
            <div className="divide-y divide-[#eee9df]">
              {rows.map((row) => {
                const selected =
                  row.entity === "milestone"
                    ? selectedMilestoneId === row.id
                    : selectedTaskId === row.id;
                const expanded =
                  row.entity === "milestone"
                    ? expandedMilestones.has(row.id)
                    : expandedTasks.has(row.id);
                const counts = sxGateRequirementCounts(row.requirements);
                return (
                  <article
                    key={`mobile-${row.entity}-${row.id}`}
                    data-plan-row={`${row.entity}:${row.id}`}
                    className={`p-2.5 ${selected ? "bg-[#e8f2eb]" : "bg-white"}`}
                    style={{ marginLeft: row.depth * 12 }}
                  >
                    <div className="flex items-start gap-2">
                      {row.hasChildren && (
                        <button
                          type="button"
                          onClick={() => {
                            const update = (current: Set<string>) => {
                              const next = new Set(current);
                              if (next.has(row.id)) next.delete(row.id);
                              else next.add(row.id);
                              return next;
                            };
                            if (row.entity === "milestone")
                              setExpandedMilestones(update);
                            else setExpandedTasks(update);
                          }}
                          className="grid min-h-11 min-w-11 place-items-center text-[#69665d]"
                          aria-label={
                            expanded
                              ? `${row.title}を折りたたむ`
                              : `${row.title}を展開する`
                          }
                        >
                          <ChevronRight
                            className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
                          />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => select(row)}
                        className="min-h-11 min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
                        aria-pressed={selected}
                      >
                        <span className="flex flex-wrap items-center gap-1">
                          {(row.isBlockingMilestone || row.timelineKind === "milestone") && (
                            <i
                              className={`inline-block h-3 w-3 shrink-0 rotate-45 border-2 border-[#5f4a66] ${row.isBlockingMilestone ? "bg-[#5f4a66]" : "bg-[#fffdf7]"}`}
                              aria-hidden="true"
                            />
                          )}
                          <b className="text-[11px] text-[#24231f]">
                            {row.title}
                          </b>
                          <i className="border border-[#c9bfd0] bg-[#f1edf3] px-1 text-[8px] not-italic text-[#5f4a66]">
                            {rowKindLabel(row)}
                          </i>
                          <i className="border border-[#d6cebf] px-1 text-[8px] not-italic text-[#514e47]">
                            {ROW_STATE_TEXT[row.state]}
                          </i>
                        </span>
                        <span className="mt-1 block text-[10px] text-[#69665d]">
                          {row.plannedEnd
                            ? `${sxFormatDate(row.plannedStart)} → ${sxFormatDate(row.plannedEnd)}`
                            : "日程未設定"}{" "}
                          ・ {row.ownerLabel}
                        </span>
                        {row.entity === "milestone" &&
                          row.requiredTaskSummary && (
                            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-[#5f4a66]">
                              <span>
                                必須タスク {row.requiredTaskSummary.completed}/
                                {row.requiredTaskSummary.total}
                                {row.requiredTaskSummary.total === 0
                                  ? "（未登録）"
                                  : row.requiredTaskSummary.nextIncompleteTitle
                                    ? ` ・ 次：${row.requiredTaskSummary.nextIncompleteTitle}`
                                    : " ・ 全完了"}
                              </span>
                              {row.achievement && (
                                <em
                                  className={`border px-1 py-0.5 text-[8px] font-bold not-italic ${GATE_STATE_TONE[row.achievement]}`}
                                >
                                  {GATE_STATE_TEXT[row.achievement]}
                                </em>
                              )}
                            </span>
                          )}
                        {row.entity === "milestone" &&
                          !row.requiredTaskSummary && (
                            <span className="mt-1 block text-[10px] font-semibold text-[#5f4a66]">
                              {row.requirements.length > 0
                                ? `前提 ${counts.met}/${counts.total}｜${
                                    row.requirements
                                      .filter((item) => item.state !== "met")
                                      .map(
                                        (item) =>
                                          item.milestone.gate ||
                                          item.milestone.title,
                                      )
                                      .join(" / ") || "すべて充足"
                                  }`
                                : `到達点｜${row.gate}`}
                            </span>
                          )}
                      </button>
                    </div>
                  </article>
                );
              })}
              {canManage && projectId && timeline.valid && (
                <button
                  type="button"
                  onClick={(event) => proposeMilestone(lane.key, event)}
                  className="relative min-h-11 w-full overflow-hidden border-t border-[#d6cebf] bg-[#fffdf7] px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
                  aria-label={`${lane.label}のモバイル日付軸でMSを追加`}
                >
                  <span className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(12.5%-1px),rgba(113,109,99,0.16)_12.5%)]" />
                  <span className="relative flex items-center justify-between gap-3 text-[9px] text-[#716d63]">
                    <span>{sxFormatDate(timeline.domainStart)}</span>
                    <b className="text-[10px] text-[#235f4b]">MS｜日付位置をタップ</b>
                    <span>{sxFormatDate(timeline.domainEnd)}</span>
                  </span>
                </button>
              )}
              {canManage && projectId && (
                <button
                  type="button"
                  data-gantt-add-task-lane={lane.key}
                  onClick={() => onCreateTask(lane.key)}
                  className="flex min-h-12 w-full items-center gap-2 bg-[#fbf9f2] px-3 text-left text-[11px] font-bold text-[#205f49] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
                  aria-label={`${lane.label}に新規タスクを追加`}
                  aria-haspopup="dialog"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  新規タスク
                </button>
              )}
            </div>
          </section>
        ))}
      </div>

      <div
        ref={scrollerRef}
        className="relative hidden overflow-x-auto overscroll-x-contain border border-[#d6cebf] bg-[#fffdf7] shadow-[inset_-14px_0_12px_-14px_rgba(36,35,31,0.42)] lg:block"
        tabIndex={0}
        aria-label="ガントチャート。左右にスクロールできる"
      >
        <div className="min-w-[1080px]">
          <div
            className="grid grid-cols-[minmax(275px,320px)_minmax(0,1fr)] items-end"
            style={{ height: MONTH_ROW_H }}
          >
            <p className="sticky left-0 z-30 bg-[#fffdf7] px-2 text-[9px] font-semibold tracking-[0.1em] text-[#777166]">
              工程 / タスク
            </p>
            <div className="relative h-full">
              {timeline.months.map((month) => (
                <span
                  key={month.pct}
                  className={`absolute bottom-1 pl-1 text-[9px] ${month.isYearStart ? "font-bold text-[#24231f]" : "text-[#777166]"}`}
                  style={{ left: timelinePctCss(month.pct) }}
                >
                  {month.label}
                </span>
              ))}
              {timeline.objectivePct != null && (
                <span
                  className="absolute bottom-0 z-10 flex -translate-x-full items-center gap-0.5 whitespace-nowrap pr-1 text-[9px] font-bold text-[#5f4a66]"
                  style={{ left: timelinePctCss(timeline.objectivePct) }}
                >
                  <Flag className="h-3 w-3" />
                  設立 {sxFormatDate(timeline.objectiveDate)}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-[minmax(275px,320px)_minmax(0,1fr)]">
            <div className="sticky left-0 z-30 border-r border-[#d6cebf] bg-[#fffdf7]">
              {showPins && (
                <div
                  className="flex items-center border-b border-[#e8e2d6] px-2 text-[9px] font-semibold text-[#69665d]"
                  style={{ height: PIN_ROW_H }}
                >
                  介入の期限
                </div>
              )}
              {visibleLanes.map(({ lane, rows }) => (
                <div key={lane.key} style={{ marginBottom: LANE_GAP }}>
                  <div
                    className="flex items-center gap-1.5 border-b border-[#d6cebf] px-2"
                    style={{ height: LANE_HEADER_H }}
                  >
                    <span
                      className="h-2.5 w-2.5"
                      style={{ background: lane.accent }}
                    />
                    <span className="text-[10px] font-bold text-[#24231f]">
                      {lane.label}
                    </span>
                    <span className="text-[10px] text-[#777166]">
                      工程{" "}
                      {rows.filter((row) => row.entity === "milestone").length}{" "}
                      / タスク{" "}
                      {rows.filter((row) => row.entity === "task").length}
                    </span>
                  </div>
                  {rows.map((row) => {
                    const selected =
                      row.entity === "milestone"
                        ? selectedMilestoneId === row.id
                        : selectedTaskId === row.id;
                    const expanded =
                      row.entity === "milestone"
                        ? expandedMilestones.has(row.id)
                        : expandedTasks.has(row.id);
                    const nextRequirement = row.requirements.find(
                      (item) => item.state !== "met",
                    );
                    return (
                      <div
                        key={`${row.entity}-${row.id}`}
                        data-plan-row={`${row.entity}:${row.id}`}
                        className={`group relative flex scroll-mt-3 border-b border-[#f1eee5] ${selected ? "bg-[#e8f2eb]" : "hover:bg-[#f8f5ec]"}`}
                        style={{ height: ROW_H, paddingLeft: row.depth * 15 }}
                      >
                        <button
                          type="button"
                          disabled={!row.hasChildren}
                          onClick={() => {
                            if (!row.hasChildren) return;
                            const update = (current: Set<string>) => {
                              const next = new Set(current);
                              if (next.has(row.id)) next.delete(row.id);
                              else next.add(row.id);
                              return next;
                            };
                            if (row.entity === "milestone")
                              setExpandedMilestones(update);
                            else setExpandedTasks(update);
                          }}
                          className={`flex w-11 shrink-0 items-center justify-center text-[#69665d] ${row.hasChildren ? "" : "opacity-0"}`}
                          aria-label={
                            expanded
                              ? `${row.title}を折りたたむ`
                              : `${row.title}を展開する`
                          }
                        >
                          <ChevronRight
                            className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => select(row)}
                          className={`min-w-0 flex-1 px-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] ${row.isCritical ? "border-l-[3px] border-[#24231f]" : ""}`}
                          aria-pressed={selected}
                        >
                          <span className="flex items-center gap-1">
                            <b
                              className={`truncate text-[10px] ${row.entity === "task" ? "font-medium" : "font-bold"}`}
                            >
                              {row.title}
                            </b>
                            <i
                              className={`shrink-0 border px-1 text-[8px] not-italic ${row.entity === "milestone" ? "border-[#c9bfd0] bg-[#f1edf3] text-[#5f4a66]" : "border-[#d6cebf] text-[#69665d]"}`}
                            >
                              {rowKindLabel(row)}
                            </i>
                            {row.isCurrent && (
                              <i className="shrink-0 bg-[#38745d] px-1 text-[8px] not-italic text-white">
                                進行中
                              </i>
                            )}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 overflow-hidden whitespace-nowrap text-[10px] text-[#777166]">
                            <em className="not-italic">
                              {ROW_STATE_TEXT[row.state]}
                            </em>
                            <span>{row.ownerLabel}</span>
                            {row.requirements.length > 0 && (
                              <span
                                className={
                                  sxGateRequirementCounts(row.requirements)
                                    .met === row.requirements.length
                                    ? "text-[#205f49]"
                                    : "font-semibold text-[#765022]"
                                }
                              >
                                前提{" "}
                                {sxGateRequirementCounts(row.requirements).met}/
                                {row.requirements.length}
                              </span>
                            )}
                          </span>
                          {row.entity === "milestone" && (
                            <span className="mt-0.5 block truncate text-[9px] text-[#5f4a66]">
                              {nextRequirement
                                ? `${nextRequirement.state === "unconfirmed" ? "未確認" : "未達"}｜${nextRequirement.milestone.gate || nextRequirement.milestone.title}`
                                : `到達点｜${row.gate}`}
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                  {canManage && projectId && (
                    <button
                      type="button"
                      data-gantt-add-task-lane={lane.key}
                      onClick={() => onCreateTask(lane.key)}
                      className="flex w-full items-center gap-2 border-b border-[#e8e2d6] bg-[#fbf9f2] px-3 text-left text-[10px] font-bold text-[#205f49] hover:bg-[#f3efe5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
                      style={{ height: ROW_H }}
                      aria-label={`${lane.label}に新規タスクを追加`}
                      aria-haspopup="dialog"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      新規タスク
                      <span className="font-normal text-[#777166]">
                        このレーンへ追加
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div ref={gridPaneRef} className="relative" style={{ height: gridHeight }}>
              {timeline.months.map((month) => (
                <span
                  key={`grid-${month.pct}`}
                  className={`absolute top-0 w-px ${month.isYearStart ? "bg-[#cfc7b9]" : "bg-[#eee9df]"}`}
                  style={{ left: timelinePctCss(month.pct), height: gridHeight }}
                />
              ))}
              {timeline.objectivePct != null && (
                <span
                  className="absolute top-0 w-[2px] bg-[#76637b]/45"
                  style={{
                    left: timelinePctCss(timeline.objectivePct),
                    height: gridHeight,
                  }}
                />
              )}
              <span
                className="absolute top-0 z-10 w-[2px] bg-[#24231f]"
                style={{ left: timelinePctCss(timeline.todayPct), height: gridHeight }}
              />
              <span
                className="absolute z-20 -translate-x-1/2 bg-[#24231f] px-1 py-px text-[8px] font-bold text-white"
                style={{ left: timelinePctCss(timeline.todayPct), top: -1 }}
              >
                今日 {sxFormatDate(asOf).slice(5)}
              </span>

              {showPins && (
                <div
                  className="absolute inset-x-0 top-0 border-b border-[#e8e2d6]"
                  style={{ height: PIN_ROW_H }}
                >
                  {timeline.pins.map((pin) => (
                    <span
                      key={pin.key}
                      tabIndex={0}
                      role="button"
                      onMouseEnter={() => setHoveredPin(pin.key)}
                      onMouseLeave={() => setHoveredPin(null)}
                      onFocus={() => setHoveredPin(pin.key)}
                      onBlur={() => setHoveredPin(null)}
                      className={`absolute top-1/2 z-20 flex h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold ${pin.side === "partner" ? "bg-[#bf7b2c] text-white" : pin.side === "unknown" ? "border-2 border-[#24231f] bg-[#fffdf7]" : "bg-[#24231f] text-white"}`}
                      style={{ left: timelinePctCss(pin.duePct) }}
                    >
                      {pin.rank}
                      {hoveredPin === pin.key && (
                        <span className="absolute top-6 z-30 w-[220px] border border-[#d6cebf] bg-[#fffdf7] p-2 text-left text-[10px] text-[#514e47] shadow-lg">
                          <b className="block text-[#24231f]">{pin.target}</b>
                          担当 {pin.ballOwner}
                          <br />
                          期限 {pin.dueDate}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}

              <div className="absolute inset-x-0" style={{ top: pinRowHeight }}>
                {visibleLanes.map(({ lane, rows }) => (
                  <div key={lane.key} style={{ marginBottom: LANE_GAP }}>
                    <div
                      className="flex items-center border-b border-[#d6cebf] px-2 text-[10px] text-[#8c3329]"
                      style={{ height: LANE_HEADER_H }}
                    >
                      {lane.maxIssue ? `詰まり: ${lane.maxIssue}` : ""}
                    </div>
                    {rows.map((row) => {
                      const isDraggingThisRow = drag?.rowId === row.id;
                      const displayRow =
                        isDraggingThisRow && drag
                          ? {
                              ...row,
                              plannedStart: drag.previewStart,
                              plannedEnd: drag.previewEnd,
                              plannedStartPct: dateToPct(
                                drag.previewStart,
                                timeline.domainStart,
                                timeline.domainEnd,
                              ),
                              plannedEndPct: dateToPct(
                                drag.previewEnd,
                                timeline.domainStart,
                                timeline.domainEnd,
                              ),
                            }
                          : row;
                      const isMilestoneMarkerRow =
                        row.isBlockingMilestone || row.timelineKind === "milestone";
                      return (
                        <div
                          key={`${row.entity}-${row.id}`}
                          className="border-b border-[#f1eee5]"
                          style={{ height: ROW_H }}
                        >
                          <RowBar
                            row={displayRow}
                            accent={lane.accent}
                            selected={
                              row.entity === "milestone"
                                ? selectedMilestoneId === row.id
                                : selectedTaskId === row.id
                            }
                            canManage={canManage && Boolean(projectId)}
                            dragging={Boolean(isDraggingThisRow && drag?.dragging)}
                            saving={Boolean(isDraggingThisRow && drag?.saving)}
                            onOpen={() => handleRowClick(row)}
                            onTimelinePoint={(event) =>
                              proposeMilestone(lane.key, event)
                            }
                            onPointerDownMove={(event) =>
                              beginDrag(
                                row,
                                !isMilestoneMarkerRow
                                  ? "move"
                                  : row.isBlockingMilestone
                                    ? "milestone-end-move"
                                    : "milestone-move",
                                event,
                              )
                            }
                            onPointerDownResizeStart={(event) =>
                              beginDrag(row, "resize-start", event)
                            }
                            onPointerDownResizeEnd={(event) =>
                              beginDrag(row, "resize-end", event)
                            }
                            onPointerMove={updateDrag}
                            onPointerUp={(event) => finishDrag(row, event)}
                            onPointerCancel={() => setDragBoth(null)}
                            onLostPointerCapture={handleLostPointerCapture}
                          />
                        </div>
                      );
                    })}
                    {canManage && projectId && (
                      <div
                        aria-hidden="true"
                        className="relative border-b border-[#e8e2d6] bg-[#fbf9f2]/60"
                        style={{ height: ROW_H }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-1 hidden items-center justify-between gap-2 text-[10px] text-[#777166] lg:flex">
        <span>
          {timeline.undatedCount > 0
            ? `日程未登録の工程 ${timeline.undatedCount}件`
            : "全工程に日程あり"}{" "}
          · 完了工程 {timeline.completedCount}件
        </span>
        <span aria-hidden="true">← 左右にスクロール →</span>
      </div>
      {pendingMilestonePoint &&
        createPortal(
          <div
            ref={milestonePromptRef}
            role="dialog"
            aria-modal="false"
            aria-label="MS追加の確認"
            className={`fixed z-[120] w-[260px] -translate-x-1/2 border border-[#bcb3a4] bg-[#fffdf7] p-3 text-[#24231f] shadow-[0_18px_44px_rgba(36,35,31,0.24)] ${pendingMilestonePoint.side === "above" ? "-translate-y-[calc(100%+12px)]" : "translate-y-3"}`}
            style={{
              left: pendingMilestonePoint.viewportX,
              top: pendingMilestonePoint.viewportY,
            }}
          >
            <p className="text-[11px] font-bold">MSを追加する？</p>
            <p className="mt-1 text-[10px] text-[#716d63]">
              {DISPLAY_LANE_LABEL[pendingMilestonePoint.laneKey]} ・ {sxFormatDate(pendingMilestonePoint.date)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                ref={milestonePromptYesRef}
                type="button"
                onClick={() =>
                  placeMilestone(
                    pendingMilestonePoint.laneKey,
                    pendingMilestonePoint.date,
                  )
                }
                className="min-h-11 border border-[#205f49] bg-[#205f49] px-3 text-[11px] font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#205f49]"
              >
                Y　追加する
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingMilestonePoint(null);
                  requestAnimationFrame(() =>
                    milestonePromptOriginRef.current?.focus(),
                  );
                }}
                className="min-h-11 border border-[#c9c0b2] bg-[#fffdf7] px-3 text-[11px] font-bold text-[#514e47] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#38745d]"
              >
                N　閉じる
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
