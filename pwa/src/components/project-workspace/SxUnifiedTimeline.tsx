"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  ChevronRight,
  Flag,
  GripVertical,
  Plus,
  Unlink2,
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
  SxScheduleDependency,
  SxTask,
  SxTimelineKind,
  SxTrackKey,
} from "@/lib/sx-management";
import {
  sxGateRequirementCounts,
  sxGateRequirementState,
  sxIsBlockingMilestone,
  type SxGateRequirement,
} from "@/lib/sx-gate-requirements";
import {
  sxApplyOptimisticManagementPatch,
  sxNewOptimisticId,
  sxRemoveOptimisticManagementRecord,
  sxReplaceOptimisticManagementId,
} from "@/lib/sx-management-optimistic";
import { taskNestCandidateIds } from "@/lib/sx-gantt-task-nesting";
import {
  buildSxLaneFold,
  type SxDisplayLaneKey,
  type SxDisplayLaneTrackDef,
} from "@/lib/sx-display-lanes";
import {
  buildFinishToStartRoute,
  timelinePctToPx,
  visibleBarGeometryPx,
} from "@/lib/sx-gantt-dependency-route";
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

// Keep the sticky date header dense, but reserve two distinct baselines: the objective marker
// above and month labels below. A single 20px line made a January objective overlap the year/month
// label at the same x-position.
// 年ラベル(上段) + 月ラベル(下段) の2段ぶん。年と月を重ねない。
const MONTH_ROW_H = 44;
const MONTH_YEAR_ROW_H = 15;
const PIN_ROW_H = 22;
// The compact lane header doubles as the MS label band. It is deliberately smaller than a task
// row, while leaving the marker's pointer target clear of the first task bar.
const LANE_HEADER_H = 34;
const ROW_H = 48;
const MILESTONE_PROMPT_FLIP_Y = 138;
const LANE_GAP = 2;
// 時間軸の縮尺。1.0 が既定 (チャート幅 1080px)、最大 4.0 まで引き伸ばせる。
// バー・グリッド線・依存線はすべて % 配置なので、外側の幅を変えるだけで縮尺が変わる。
const GANTT_BASE_WIDTH_PX = 1080;
const GANTT_TIME_SCALE_MIN = 1;
const GANTT_TIME_SCALE_MAX = 6;
const GANTT_TIME_SCALE_STORAGE_KEY = "sx-gantt-time-scale-v1";
function clampTimeScale(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(
    GANTT_TIME_SCALE_MAX,
    Math.max(GANTT_TIME_SCALE_MIN, Math.round(value * 20) / 20),
  );
}
// Reserve a real pointer gutter at both ends of the date domain. A 44px diamond centred on the
// first/last day then stays wholly inside the grid, and a 16px resize handle can sit outside a
// boundary bar without disappearing under the sticky label column or the scroll edge.
const TIMELINE_SIDE_GUTTER_PX = 22;
const MIN_BAR_HIT_WIDTH_PX = 16;
const TASK_BAR_HEIGHT_PX = 10;
const TASK_BAR_TOP_PX = (ROW_H - TASK_BAR_HEIGHT_PX) / 2;
const MILESTONE_DIAMOND_SIZE_PX = 12;
const MILESTONE_VERTEX_RADIUS_PX = MILESTONE_DIAMOND_SIZE_PX / Math.sqrt(2);
// An MS is a gate the whole lane has to pass, not a point event on one row. It is therefore drawn
// as a vertical band spanning the lane. The band is wide enough to read as a gate at a glance
// while still leaving the task bars underneath legible where they cross it.
const MILESTONE_GATE_WIDTH_PX = 12;
const MILESTONE_GATE_HALF_PX = MILESTONE_GATE_WIDTH_PX / 2;
// Dragging a dependency towards a row that is outside the viewport has to bring that row into
// view, otherwise the link can never be completed. Auto-scroll starts this far from the scroller's
// edge and is capped so the surface never runs away from the pointer.
const DEPENDENCY_AUTOSCROLL_EDGE_PX = 56;
const DEPENDENCY_AUTOSCROLL_MAX_SPEED_PX = 18;
// Lines are thin by default, but their invisible hover target needs to be generous enough for a
// dense planning surface. This target never changes the visual geometry of the gantt.
const DEPENDENCY_EDGE_HIT_WIDTH_PX = 10;
const DEPENDENCY_HOVER_ACTION_WIDTH_PX = 56;

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
  /** Internal type from the milestone table. The gantt renders only task rows and point-MS
   * lane overlays; hidden compatibility containers are never displayed as rows. */
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
   * funding-investment). Achievement here follows the MS's own state and evidence. */
  achievement?: SxGateRequirement["state"] | null;
};

type LaneMeta = {
  key: string;
  label: string;
  shortLabel: string;
  accent: string;
  maxIssue: string;
};

// Display-lane derivation (SxDisplayLaneKey, buildSxLaneFold, the p21 3-lane fold vs. generic
// 1-lane-per-track behavior) lives in src/lib/sx-display-lanes.ts, shared with
// SxWeeklyControlDashboard.tsx's track filter/MS-form lane pickers so both surfaces agree on the
// same lane set per project (2026-08-13 柱の汎用化). Re-exported here for existing importers of
// this module (`type { SxDisplayLaneKey } from "./SxUnifiedTimeline"`).
export type { SxDisplayLaneKey } from "@/lib/sx-display-lanes";
export type SxUnifiedTimelineTrackDef = SxDisplayLaneTrackDef;

const ROW_STATE_TEXT: Record<DisplayRow["state"], string> = {
  complete: "完了",
  current: "進行中",
  future: "予定",
  blocked: "停止",
  overdue: "期限超過",
  not_started: "未着手",
  unassessed: "進捗未登録",
  attention: "要確認",
};

const GATE_STATE_TONE: Record<SxGateRequirement["state"], string> = {
  met: "border-[#6ee7b7] bg-[#ecfdf5] text-[#047857]",
  unconfirmed: "border-[#fbbf24] bg-[#fef3c7] text-[#92400e]",
  unmet: "border-[#fca5a5] bg-[#fee2e2] text-[#dc2626]",
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
  if (task.status === "not_started") return "not_started";
  if (task.status === "unassessed") return "unassessed";
  if (task.status === "attention" || task.status === "at_risk")
    return "attention";
  return task.progressPct > 0 ? "current" : "future";
}

function blockingRowState(
  status: SxManagementMilestone["manualStatus"],
): DisplayRow["state"] {
  if (status === "completed") return "complete";
  if (status === "blocked") return "blocked";
  if (status === "attention" || status === "at_risk") return "attention";
  if (status === "not_started") return "not_started";
  if (status === "unassessed") return "unassessed";
  return "current";
}

/** An MS is an overlay across its lane, never a fake parent task row. Dates come straight from
 * the record: when there is no date, it is shown as a lane-band label rather than inventing an
 * x-position. */
function milestoneAnchorRow(
  milestone: SxManagementMilestone,
  timeline: SxEcdUnifiedTimeline,
): DisplayRow {
  const isBlockingMilestone = sxIsBlockingMilestone(milestone);
  const achievement = isBlockingMilestone
    ? sxGateRequirementState(milestone)
    : null;
  return {
    id: milestone.id,
    entity: "milestone",
    milestoneId: milestone.id,
    parentTaskId: null,
    depth: 0,
    // `gate` is the completion condition's short label. The user-visible MS name is always the
    // record title: using `gate` here made the pre-existing large MS look as if it had vanished.
    title: milestone.title,
    state: blockingRowState(milestone.manualStatus),
    isCritical: false,
    isCurrent: false,
    isBlockingMilestone,
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
    progressRegistered:
      milestone.manualStatus !== "unassessed" &&
      milestone.manualStatus !== "not_started",
    hasChildren: false,
    requirements: [],
    achievement,
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
    progressRegistered:
      task.status !== "unassessed" && task.status !== "not_started",
    hasChildren,
    requirements: [],
  };
}

function lanesTotalHeight(
  lanes: Array<{ rows: DisplayRow[]; collapsed: boolean }>,
  includeTaskWriterRow: boolean,
) {
  return lanes.reduce(
    (sum, lane) =>
      sum +
      LANE_HEADER_H +
      // A collapsed lane keeps only its header band — that band is where the MS gates live, so
      // they stay visible — and drops the task rows together with the "新規タスク" writer row.
      (lane.rows.length +
        (includeTaskWriterRow && !lane.collapsed ? 1 : 0)) *
        ROW_H +
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
  dependencyEnabled,
  connectionSourceId,
  onPointerDownDependency,
  onKeyboardStartDependency,
  onCompleteDependency,
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
  dependencyEnabled: boolean;
  connectionSourceId: string | null;
  onPointerDownDependency: (
    row: DisplayRow,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  onKeyboardStartDependency: (row: DisplayRow) => void;
  onCompleteDependency: (target: ScheduleDependencyTarget) => void;
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
  const dependencyTargetPct = row.entity === "task"
    ? row.plannedStartPct
    : isMilestoneMarker
      ? row.plannedEndPct
      : null;
  // Drawing a dependency is not a mode you switch into: the "+" port is always on the row, and
  // only while a link is actually being drawn (a source is armed) do the date-drag affordances
  // stand down, so a half-finished link can never be resolved as a schedule change.
  const connectionDrafting = connectionSourceId != null;
  const isConnectionSource = connectionSourceId === `${row.entity}:${row.id}`;
  const showDependencyPort =
    dependencyEnabled &&
    (row.entity === "task" || isMilestoneMarker) &&
    (!connectionDrafting || isConnectionSource);
  // A normal range is draggable only when BOTH endpoints exist. End-only normal rows are
  // intentionally read-only on the gantt: there is no honest duration to move or resize yet.
  // The sole end-only draggable exception is the NewCo diamond below.
  const draggableBar =
    canManage && !connectionDrafting && row.plannedStart != null && row.plannedEnd != null && !isMilestoneMarker;
  const draggableMilestone =
    canManage &&
    !connectionDrafting &&
    hasBar &&
    isMilestoneMarker &&
    // Only the two NewCo gates may drag from an end-only date. A generic point-MS must have its
    // start/end pair established (normally equal) before it exposes a drag affordance.
    (row.isBlockingMilestone || row.plannedStart != null);
  const barGeometry = hasBar && !isMilestoneMarker
    ? barHitGeometryCss(barStart, plannedEnd)
    : null;
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
      className={`group relative h-full w-full ${selected ? "bg-[#ecfdf5]/70" : "hover:bg-[#f5f5f7]/70"} ${dragging ? "cursor-grabbing" : ""} ${saving ? "opacity-60" : ""}`}
    >
      {/* The row is split into two real interactions: its true blank timeline surface proposes
          a new MS, while the rendered bar/diamond alone owns record selection and drag. Keeping
          them as sibling buttons prevents blank-click, select and post-drag click from firing as
          one ambiguous action. */}
      <button
        type="button"
        onClick={onTimelinePoint}
        disabled={!canManage || saving || connectionDrafting}
        className="absolute inset-0 z-0 w-full cursor-crosshair text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#059669] disabled:cursor-default"
        aria-label={`${row.title}行の日付を選んでMSを追加`}
      />
      {/* Move-drag hit target: the actual bar's full width, never empty row space. Sits below
          (DOM-order-first, so lower stacking) the resize handles, which claim their own hit area
          at each edge. The 10px visual bar is row-centred; this hit box is >=44px tall so users
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
          className="absolute z-20 cursor-grab focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#059669]"
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
      {hasBar && !draggableBar && !isMilestoneMarker && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="absolute z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#059669]"
          style={detailHitStyle}
          aria-label={`${row.title}の詳細を開く`}
        />
      )}
      {hasBar && !isMilestoneMarker && (
        <span
          data-gantt-task-bar={row.id}
          className="pointer-events-none absolute overflow-hidden rounded-sm border"
          style={{
            top: TASK_BAR_TOP_PX,
            height: TASK_BAR_HEIGHT_PX,
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
            <span className="block h-3 w-[3px] bg-[#1d1d1f]" />
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
            <span className="block h-3 w-[3px] bg-[#1d1d1f]" />
          </button>
        </>
      )}
      {draggableMilestone && (
        <button
          type="button"
          data-gantt-milestone-marker={row.id}
          onPointerDown={(event) => {
            event.stopPropagation();
            onPointerDownMove(event);
          }}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          onLostPointerCapture={onLostPointerCapture}
          className="absolute z-30 grid -translate-x-1/2 cursor-grab place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#059669]"
          style={{ top: DRAG_HIT_TOP, left: timelinePctCss(plannedEnd), width: DRAG_HIT_HEIGHT, height: DRAG_HIT_HEIGHT }}
          aria-label={`${row.title}。ドラッグで予定日を変更、クリックで詳細を開く`}
        >
          {/* The visible ◇ lives inside its semantic button. A marker click therefore always
              selects this exact MS; the 44px button remains the generous drag hit area. */}
          <i
            className={`block h-3 w-3 rotate-45 border-2 border-[#027FDC] ${row.isBlockingMilestone ? "bg-[#027FDC]" : "bg-[#ffffff]"}`}
            aria-hidden="true"
          />
        </button>
      )}
      {hasBar && isMilestoneMarker && !draggableMilestone && (
        <button
          type="button"
          data-gantt-milestone-marker={row.id}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="absolute z-20 grid -translate-x-1/2 cursor-pointer place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#059669]"
          style={detailHitStyle}
          aria-label={`${row.title}の詳細を開く`}
        >
          {/* NewCo blocking gate = filled purple diamond; generic MS = hollow — matches Legend. */}
          <i
            className={`block h-3 w-3 rotate-45 border-2 border-[#027FDC] ${row.isBlockingMilestone ? "bg-[#027FDC]" : "bg-[#ffffff]"}`}
            aria-hidden="true"
          />
        </button>
      )}
      {/* The "+" port sits wholly to the RIGHT of everything the row already owns — past the
          16px end-resize handle for a bar, past the 44px diamond drag box for an MS — so making
          it permanent (hover-revealed, like the resize ticks) never steals a date-drag or a
          detail click. Drag it onto another row to link; Enter/Space arms it for keyboard use. */}
      {showDependencyPort && hasBar && (
          <button
            type="button"
            data-gantt-dependency-source={`${row.entity}:${row.id}`}
            data-active={isConnectionSource || undefined}
            aria-pressed={isConnectionSource}
            onPointerDown={(event) => onPointerDownDependency(row, event)}
            onClick={(event) => {
              // Pointer users drag from this port. Enter/Space has detail===0 and provides the
              // non-dragging alternative required for keyboard operation.
              if (event.detail !== 0) return;
              onKeyboardStartDependency(row);
            }}
            className="sx-gantt-dependency-port absolute z-40 grid h-11 w-6 cursor-crosshair place-items-center rounded-full text-[#027FDC] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#027FDC] data-[active=true]:text-[#047857] data-[active=true]:opacity-100"
            style={{
              top: 2,
              left: isMilestoneMarker
                ? timelinePctCss(plannedEnd, DRAG_HIT_HEIGHT / 2)
                : `calc(${barGeometry!.right} + 16px)`,
              touchAction: "none",
            }}
            title="ドラッグして他のタスク・MSへ依存線を引く"
            aria-label={`${row.title}の右端から依存線を開始`}
          >
            <Plus className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
          </button>
        )}
      {connectionSourceId &&
        (row.entity === "task" || isMilestoneMarker) &&
        dependencyTargetPct != null && (
        <button
          type="button"
          data-gantt-dependency-target-entity={row.entity}
          data-gantt-dependency-target-id={row.id}
          onClick={(event) => {
            event.stopPropagation();
            onCompleteDependency({ entity: row.entity, id: row.id });
          }}
          className="absolute z-40 grid h-11 w-7 -translate-x-1/2 place-items-center rounded-full text-[#027FDC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#027FDC]"
          style={{
            top: 2,
            left: isMilestoneMarker
              ? timelinePctCss(dependencyTargetPct, -MILESTONE_VERTEX_RADIUS_PX)
              : (barGeometry?.left ?? timelinePctCss(dependencyTargetPct)),
          }}
          aria-label={`${row.title}${row.entity === "task" ? "の左端" : ""}を接続先にする`}
        >
          <span className="h-3 w-3 rounded-full border-2 border-current bg-[#ffffff]" />
        </button>
      )}
      {/* A date-less MS has no honest x-position on the time axis, so its ◇ sits beside
          「日程未設定」. It is still the record's direct-edit affordance — never let the
          blank-timeline button underneath turn a click on this visible marker into MS creation. */}
      {!hasBar && isMilestoneMarker && (
        <button
          type="button"
          data-gantt-milestone-marker={row.id}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="absolute bottom-0 left-0 z-20 grid h-11 w-11 cursor-pointer place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#059669]"
          aria-label={`${row.title}の詳細を開く`}
        >
          <i
            className={`block h-3 w-3 translate-y-2 rotate-45 border-2 border-[#027FDC] ${row.isBlockingMilestone ? "bg-[#027FDC]" : "bg-[#ffffff]"}`}
            aria-hidden="true"
          />
        </button>
      )}
      <span className="pointer-events-none absolute inset-x-1 bottom-0.5 z-10 flex flex-wrap items-center gap-2 overflow-hidden whitespace-nowrap text-[10px] font-semibold text-[#3c3c43]">
        {/* 「予定 …/実績 未登録」の常時表示は 2026-08-08 に削除 (まさ #16)。
            日付と進捗は詳細モーダルとバーの位置・塗りで読む。 */}
        {hasBar ? null : (
          <span className={`flex items-center gap-1 ${isMilestoneMarker ? "pl-7" : ""}`}>
            日程未設定・{ROW_STATE_TEXT[row.state]}
          </span>
        )}
        {counts.total > 0 && (
          <span
            className={
              counts.met === counts.total ? "text-[#047857]" : "text-[#92400e]"
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

/** Pointer-drag state for gantt direct editing (move/resize a task bar, move an MS marker).
 * `dragging` only flips true once the pointer has moved past CLICK_DRAG_THRESHOLD_PX —
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

type TaskNestTarget =
  | { kind: "task"; taskId: string }
  | { kind: "root"; laneKey: SxDisplayLaneKey }
  /** Manual ordering: drop above/below a sibling row instead of onto it. */
  | { kind: "reorder"; taskId: string; place: "before" | "after" };

/** Separate from date-bar drag: the left-side grip moves the task hierarchy (drop onto a row) and
 * the manual order (drop between rows). The pointer position is kept so the dragged row can be
 * mirrored under the cursor while the drag is live. */
type TaskNestDragState = {
  taskId: string;
  milestoneId: string;
  title: string;
  version: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  pointerClientX: number;
  pointerClientY: number;
  dragging: boolean;
  saving: boolean;
  target: TaskNestTarget | null;
};

/** Drop zone split of a row: the outer bands reorder, the middle band nests. */
const TASK_REORDER_EDGE_RATIO = 0.32;

type ScheduleDependencySource = {
  entity: "task" | "milestone";
  id: string;
  title: string;
  pointerId: number | null;
  startX: number;
  startY: number;
};

type ScheduleDependencyTarget = {
  entity: "task" | "milestone";
  id: string;
};

type ScheduleDependencyEdge = {
  dependency: SxScheduleDependency;
  path: string;
};

export function SxUnifiedTimeline({
  timeline,
  asOf,
  tracks = [],
  projectId = null,
  selectedMilestoneId,
  selectedTaskId = null,
  milestones = [],
  scheduleDependencies = [],
  tasks = [],
  outcomes = [],
  objectiveId = null,
  onSelectMilestone,
  onSelectTask = () => {},
  canManage,
  onCreateMilestone,
  onCreateTask = () => {},
  onManagementChange = () => {},
  onManagementOptimistic,
  showPins = true,
}: {
  timeline: SxEcdUnifiedTimeline;
  asOf: string;
  /** Drives display-lane derivation (grouping/order/labels). Pass `management.tracks` (DB-backed,
   * per-project). p21 keeps its historical 3-lane fold; any other track set gets one lane per
   * track. Omit only for callers with no lane-bearing rows (falls back to no lanes). */
  tracks?: SxUnifiedTimelineTrackDef[];
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
  /** Kept in the public component contract for callers that share the management bundle. The
   * task-only renderer no longer treats milestone dependencies as displayed parent rows. */
  dependencies?: SxDependency[];
  scheduleDependencies?: SxScheduleDependency[];
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
  /** DBの応答を待たずに、親が持つbundleへ直接変更を当てる。このコンポーネントはbundle
   *  全体を持たないので、変換関数だけを渡す。省略された呼び出し元は従来どおり応答待ちで動く。 */
  onManagementOptimistic?: (
    mutate: (bundle: SxManagementBundle) => SxManagementBundle,
    message: string,
  ) => void;
  showPins?: boolean;
}) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(
    // Promoted legacy roots represent the initial, readable task hierarchy. Their own child
    // tasks are visible immediately; deeper task nesting remains independently collapsible.
    () =>
      new Set(
        tasks
          .filter((task) => task.sourceRef?.startsWith("ui-root-from-phase:"))
          .map((task) => task.id),
      ),
  );
  // Collapsing a lane hides its task rows only. The lane header band stays, so the MS gates that
  // span the lane remain readable — that is the whole point of collapsing: keep the gate rhythm,
  // drop the row detail.
  const [collapsedLanes, setCollapsedLanes] = useState<Set<SxDisplayLaneKey>>(
    () => new Set(),
  );
  const toggleLaneCollapsed = (key: SxDisplayLaneKey) => {
    setCollapsedLanes((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);
  // 時間軸の縮尺。バーもグリッドも % 配置なので、チャート全体の幅を伸ばすだけで
  // 「1か月あたりの横幅」が素直に広がる (2026-08-07 まさ)。
  const [timeScale, setTimeScale] = useState(1);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(GANTT_TIME_SCALE_STORAGE_KEY);
    const parsed = stored ? Number(stored) : NaN;
    if (Number.isFinite(parsed)) setTimeScale(clampTimeScale(parsed));
  }, []);
  const commitTimeScale = (value: number) => {
    const next = clampTimeScale(value);
    setTimeScale(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(GANTT_TIME_SCALE_STORAGE_KEY, String(next));
    }
  };
  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridPaneRef = useRef<HTMLDivElement>(null);
  const justDraggedRef = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  // Mirrors `drag` synchronously (React state updates are not visible to the very next event
  // handler in the same tick) — onLostPointerCapture needs to read the true current drag state,
  // not a stale closure, to decide whether a capture loss is abnormal (cancel) or just the
  // implicit release that follows a normal pointerup (do nothing, finishDrag already owns it).
  const dragRef = useRef<DragState | null>(null);
  const [taskNestDrag, setTaskNestDrag] = useState<TaskNestDragState | null>(
    null,
  );
  const taskNestDragRef = useRef<TaskNestDragState | null>(null);
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
  // Dependency drawing is an always-available affordance, not a mode: every schedulable row
  // carries a hover-revealed "+" port. `dependencySource != null` is the only transient state,
  // and it is what suspends the date-drag/nest-drag affordances mid-link.
  const dependencyDrawingEnabled = canManage && Boolean(projectId);
  const [dependencySource, setDependencySource] =
    useState<ScheduleDependencySource | null>(null);
  const [dependencyPreview, setDependencyPreview] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [gridPaneWidth, setGridPaneWidth] = useState(0);
  const [removingDependencyId, setRemovingDependencyId] = useState<
    string | null
  >(null);
  const [hoveredScheduleDependency, setHoveredScheduleDependency] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const dependencyHoverLeaveTimerRef = useRef<number | null>(null);
  const dependencyArrowMarkerId = `sx-gantt-arrow-${useId().replaceAll(":", "")}`;
  const connectScheduleDependencyRef = useRef<
    (target: ScheduleDependencyTarget) => void
  >(() => {});

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

  function setTaskNestDragBoth(
    next:
      | TaskNestDragState
      | null
      | ((current: TaskNestDragState | null) => TaskNestDragState | null),
  ) {
    const resolved =
      typeof next === "function"
        ? (next as (
            current: TaskNestDragState | null,
          ) => TaskNestDragState | null)(taskNestDragRef.current)
        : next;
    taskNestDragRef.current = resolved;
    setTaskNestDrag(resolved);
  }

  function showGanttNotice(message: string) {
    setGanttNotice(message);
    window.setTimeout(() => setGanttNotice(null), 4000);
  }

  function keepScheduleDependencyActions() {
    if (dependencyHoverLeaveTimerRef.current != null) {
      window.clearTimeout(dependencyHoverLeaveTimerRef.current);
      dependencyHoverLeaveTimerRef.current = null;
    }
  }

  function showScheduleDependencyActions(
    dependencyId: string,
    event: React.PointerEvent<SVGPathElement>,
  ) {
    if (!canManage || !projectId || dependencySource) return;
    const pane = gridPaneRef.current;
    if (!pane) return;
    keepScheduleDependencyActions();
    const rect = pane.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, event.clientX - rect.left));
    const y = Math.min(rect.height, Math.max(0, event.clientY - rect.top));
    setHoveredScheduleDependency({ id: dependencyId, x, y });
  }

  function hideScheduleDependencyActionsAfterLeave(dependencyId: string) {
    keepScheduleDependencyActions();
    dependencyHoverLeaveTimerRef.current = window.setTimeout(() => {
      setHoveredScheduleDependency((current) =>
        current?.id === dependencyId ? null : current,
      );
      dependencyHoverLeaveTimerRef.current = null;
    }, 180);
  }

  useEffect(
    () => () => {
      if (dependencyHoverLeaveTimerRef.current != null)
        window.clearTimeout(dependencyHoverLeaveTimerRef.current);
    },
    [],
  );

  function sourceKey(source: Pick<ScheduleDependencySource, "entity" | "id">) {
    return `${source.entity}:${source.id}`;
  }

  function dependencySourcePoint(row: DisplayRow, paneWidth: number) {
    const layout = visibleRowLayout.get(`${row.entity}:${row.id}`);
    if (!layout || paneWidth <= TIMELINE_SIDE_GUTTER_PX * 2) return null;
    const isPointMilestone =
      row.entity === "milestone" ||
      row.isBlockingMilestone ||
      row.timelineKind === "milestone";
    if (isPointMilestone) {
      if (row.plannedEndPct == null) return null;
      return {
        x:
          timelinePctToPx(
            row.plannedEndPct,
            paneWidth,
            TIMELINE_SIDE_GUTTER_PX,
          ) + MILESTONE_VERTEX_RADIUS_PX,
        y: layout.centerY,
      };
    }
    if (row.plannedEndPct == null) return null;
    const geometry = visibleBarGeometryPx(
      row.plannedStartPct ?? row.plannedEndPct,
      row.plannedEndPct,
      paneWidth,
      TIMELINE_SIDE_GUTTER_PX,
      MIN_BAR_HIT_WIDTH_PX,
    );
    return { x: geometry.right, y: layout.centerY };
  }

  function beginScheduleDependency(
    row: DisplayRow,
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    if (!dependencyDrawingEnabled || event.button !== 0) return;
    const pane = gridPaneRef.current;
    if (!pane || row.plannedEndPct == null) return;
    event.preventDefault();
    event.stopPropagation();
    const paneRect = pane.getBoundingClientRect();
    const sourcePoint = dependencySourcePoint(row, paneRect.width);
    if (!sourcePoint) return;
    const startX = sourcePoint.x;
    const startY = sourcePoint.y;
    setDependencySource({
      entity: row.entity,
      id: row.id,
      title: row.title,
      pointerId: event.pointerId,
      startX,
      startY,
    });
    setDependencyPreview({ x: startX, y: startY });
  }

  function beginKeyboardScheduleDependency(row: DisplayRow) {
    if (!dependencyDrawingEnabled || row.plannedEndPct == null) return;
    const sourcePoint = dependencySourcePoint(row, gridPaneWidth);
    if (!sourcePoint) return;
    setDependencySource({
      entity: row.entity,
      id: row.id,
      title: row.title,
      pointerId: null,
      startX: sourcePoint.x,
      startY: sourcePoint.y,
    });
    setDependencyPreview(null);
    showGanttNotice("接続先のタスクかMSを選んでね。Escで中止できるよ");
  }

  async function connectScheduleDependency(target: ScheduleDependencyTarget) {
    const source = dependencySource;
    if (!source || !projectId) {
      showGanttNotice("先にタスクかMSの右端を選んでね");
      return;
    }
    // A pointer gesture is over once it reaches a target. If validation rejects that target,
    // retain the source as a keyboard/click selection without leaving global pointer listeners
    // attached to an already-ended pointer id.
    if (source.pointerId != null)
      setDependencySource({ ...source, pointerId: null });
    const successor = target.entity === "task"
      ? tasks.find((task) => task.id === target.id)
      : milestones.find((milestone) => milestone.id === target.id);
    if (!successor) {
      showGanttNotice("接続先を確認できなかったよ");
      return;
    }
    if (source.entity === target.entity && source.id === target.id) {
      showGanttNotice("同じ項目同士は接続できないよ");
      return;
    }
    if (
      source.entity === "milestone" &&
      target.entity === "task" &&
      "milestoneId" in successor &&
      successor.milestoneId === source.id
    ) {
      showGanttNotice("MS自身の配下タスクを、そのMS完了後には接続できないよ");
      return;
    }
    const duplicate = scheduleDependencies.some(
      (item) =>
        item.predecessorType === source.entity &&
        (source.entity === "task"
          ? item.predecessorTaskId === source.id
          : item.predecessorMilestoneId === source.id) &&
        item.successorType === target.entity &&
        (target.entity === "task"
          ? item.successorTaskId === target.id
          : item.successorMilestoneId === target.id),
    );
    if (duplicate) {
      showGanttNotice("この依存線はすでにあるよ");
      return;
    }
    setDependencyPreview(null);
    setDependencySource(null);
    // 依存線は引いた瞬間に見えてほしい操作なので、先に画面へ描いてから書き込む。
    // IDはサーバが決めるため、仮IDで描いて応答のIDへ差し替える。
    const temporaryDependencyId = sxNewOptimisticId(
      `dep-${source.entity}-${source.id}-${target.entity}-${target.id}`,
    );
    const connectedMessage = `${source.title} → ${successor.title} を接続したよ`;
    if (onManagementOptimistic)
      onManagementOptimistic(
        (current) => ({
          ...current,
          scheduleDependencies: [
            ...current.scheduleDependencies,
            {
              id: temporaryDependencyId,
              predecessorType: source.entity,
              predecessorTaskId: source.entity === "task" ? source.id : null,
              predecessorMilestoneId:
                source.entity === "milestone" ? source.id : null,
              successorType: target.entity,
              successorTaskId: target.entity === "task" ? target.id : null,
              successorMilestoneId:
                target.entity === "milestone" ? target.id : null,
              dependencyType: "finish_to_start",
            },
          ],
        }),
        `${connectedMessage}。DBへ同期中`,
      );
    try {
      const response = await fetch(
        `/api/project-workspace/${encodeURIComponent(projectId)}/management`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resource: "schedule_dependency",
            fields: {
              predecessor_type: source.entity,
              predecessor_id: source.id,
              successor_type: target.entity,
              successor_id: target.id,
            },
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          typeof body.error === "string" ? body.error : "依存線を保存できなかったよ",
        );
      if (onManagementOptimistic) {
        // 応答のbundleは使わない: 送信中に入った別の編集を、古いbundleで消さないため。
        if (typeof body.id === "string" && body.id)
          onManagementOptimistic(
            (current) =>
              sxReplaceOptimisticManagementId(
                current,
                temporaryDependencyId,
                body.id as string,
              ),
            connectedMessage,
          );
        return;
      }
      onManagementChange(body.bundle as SxManagementBundle, connectedMessage);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "依存線を保存できなかったよ";
      await bestEffortRefetchManagement(
        `${message}。最新の状態に更新したよ`,
        `${message}。画面を再読み込みしてね`,
      );
    }
  }

  async function removeScheduleDependency(dependencyId: string) {
    if (!projectId || removingDependencyId) return;
    keepScheduleDependencyActions();
    setHoveredScheduleDependency(null);
    setRemovingDependencyId(dependencyId);
    if (onManagementOptimistic)
      onManagementOptimistic(
        (current) =>
          sxRemoveOptimisticManagementRecord(current, dependencyId),
        "依存線を外したよ。DBへ同期中",
      );
    try {
      const response = await fetch(
        `/api/project-workspace/${encodeURIComponent(projectId)}/management`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resource: "schedule_dependency",
            id: dependencyId,
            delete: true,
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          typeof body.error === "string" ? body.error : "依存線を外せなかったよ",
        );
      if (onManagementOptimistic) {
        showGanttNotice("依存線を外したよ");
        return;
      }
      onManagementChange(
        body.bundle as SxManagementBundle,
        "依存線を外したよ",
      );
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "依存線を外せなかったよ";
      if (onManagementOptimistic) {
        await bestEffortRefetchManagement(
          `${message}。最新の状態に戻したよ`,
          `${message}。画面を再読み込みしてね`,
        );
        return;
      }
      showGanttNotice(message);
    } finally {
      setRemovingDependencyId(null);
    }
  }

  useEffect(() => {
    connectScheduleDependencyRef.current = (target) => {
      void connectScheduleDependency(target);
    };
  });

  useEffect(() => {
    if (!dependencySource || dependencySource.pointerId == null) return;
    const pointerId = dependencySource.pointerId;
    // Last viewport position of the dragging pointer. The auto-scroll loop keeps running between
    // pointermove events (a stationary pointer parked at the edge must keep scrolling), so the
    // position it steers by has to live outside the event handler.
    let pointerClientX = 0;
    let pointerClientY = 0;
    let pointerSeen = false;
    let autoScrollFrame = 0;
    const syncPreview = () => {
      const pane = gridPaneRef.current;
      if (!pane) return;
      const rect = pane.getBoundingClientRect();
      setDependencyPreview({
        x: Math.min(rect.width, Math.max(0, pointerClientX - rect.left)),
        y: Math.min(rect.height, Math.max(0, pointerClientY - rect.top)),
      });
    };
    const edgeSpeed = (overshoot: number) =>
      Math.min(
        DEPENDENCY_AUTOSCROLL_MAX_SPEED_PX,
        Math.max(4, overshoot / 3),
      );
    const autoScrollStep = () => {
      autoScrollFrame = requestAnimationFrame(autoScrollStep);
      const scroller = scrollerRef.current;
      if (!pointerSeen || !scroller) return;
      const rect = scroller.getBoundingClientRect();
      let dx = 0;
      let dy = 0;
      if (pointerClientX < rect.left + DEPENDENCY_AUTOSCROLL_EDGE_PX)
        dx = -edgeSpeed(rect.left + DEPENDENCY_AUTOSCROLL_EDGE_PX - pointerClientX);
      else if (pointerClientX > rect.right - DEPENDENCY_AUTOSCROLL_EDGE_PX)
        dx = edgeSpeed(pointerClientX - (rect.right - DEPENDENCY_AUTOSCROLL_EDGE_PX));
      if (pointerClientY < rect.top + DEPENDENCY_AUTOSCROLL_EDGE_PX)
        dy = -edgeSpeed(rect.top + DEPENDENCY_AUTOSCROLL_EDGE_PX - pointerClientY);
      else if (pointerClientY > rect.bottom - DEPENDENCY_AUTOSCROLL_EDGE_PX)
        dy = edgeSpeed(pointerClientY - (rect.bottom - DEPENDENCY_AUTOSCROLL_EDGE_PX));
      if (!dx && !dy) return;
      const canScrollVertically =
        scroller.scrollHeight > scroller.clientHeight + 1;
      scroller.scrollLeft += dx;
      if (canScrollVertically) scroller.scrollTop += dy;
      // The gantt itself is usually taller than its scroller only horizontally; when it is not,
      // the row the user is reaching for is off the *page*, so scroll the page instead.
      else if (dy) window.scrollBy(0, dy);
      syncPreview();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerClientX = event.clientX;
      pointerClientY = event.clientY;
      pointerSeen = true;
      syncPreview();
    };
    autoScrollFrame = requestAnimationFrame(autoScrollStep);
    const finish = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>(
          "[data-gantt-dependency-target-entity][data-gantt-dependency-target-id]",
        );
      const targetEntity = target?.dataset.ganttDependencyTargetEntity;
      const targetId = target?.dataset.ganttDependencyTargetId || null;
      setDependencyPreview(null);
      if (
        targetId &&
        (targetEntity === "task" || targetEntity === "milestone")
      ) {
        connectScheduleDependencyRef.current({ entity: targetEntity, id: targetId });
      }
      else {
        const pane = gridPaneRef.current;
        const rect = pane?.getBoundingClientRect();
        const travel = rect
          ? Math.hypot(
              event.clientX - (rect.left + dependencySource.startX),
              event.clientY - (rect.top + dependencySource.startY),
            )
          : Number.POSITIVE_INFINITY;
        if (travel < 4) {
          // A click arms the source. Users can now scroll the internal gantt before clicking the
          // destination; this is also the pointer fallback when the target starts off-screen.
          setDependencySource({ ...dependencySource, pointerId: null });
          showGanttNotice(
            "起点を選んだよ。接続先のタスクかMSを選んでね。Escで中止できるよ",
          );
        } else {
          setDependencySource(null);
          showGanttNotice(
            "接続先のタスクかMSで離すか、起点と終点を順にクリックしてね",
          );
        }
      }
    };
    const cancel = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      setDependencyPreview(null);
      setDependencySource(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    return () => {
      cancelAnimationFrame(autoScrollFrame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [dependencySource]);

  useEffect(() => {
    if (!dependencySource) return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDependencySource(null);
      setDependencyPreview(null);
      showGanttNotice("依存線の接続を中止したよ");
    };
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [dependencySource]);

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
  const taskNestCandidateTaskIds = useMemo(
    () => taskNestCandidateIds(tasks, taskNestDrag?.taskId ?? null),
    [taskNestDrag?.taskId, tasks],
  );

  const laneFold = useMemo(() => buildSxLaneFold(tracks), [tracks]);

  // The visible tree contains only tasks. Legacy phase milestones remain in the database as
  // FK containers, but their promoted root task is the visual root. Point-MS records are kept
  // separately as lane-wide overlays, never as parent-like rows.
  const visibleLanes = useMemo(() => {
    const appendTaskTree = (task: SxTask, rows: DisplayRow[], depth: number) => {
      const children = taskChildren.get(task.id) || [];
      rows.push(taskDisplayRow(task, depth, children.length > 0, timeline, asOf));
      if (children.length > 0 && expandedTasks.has(task.id)) {
        for (const child of children) appendTaskTree(child, rows, depth + 1);
      }
    };

    const bucket: Record<SxDisplayLaneKey, DisplayRow[]> = {};
    for (const key of laneFold.order) bucket[key] = [];

    const laneForTask = (task: SxTask): SxDisplayLaneKey => {
      const backing = milestoneById.get(task.milestoneId);
      // A task keeps its own workstream even when it contributes to a blocking MS whose diamond
      // spans another lane. Only the MS marker is forced to the blocking-milestone lane.
      if (task.track) return laneFold.laneKeyForTrack(task.track);
      if (backing && sxIsBlockingMilestone(backing)) {
        const forced = laneFold.blockingMilestoneLane(backing.slug);
        if (forced) return forced;
      }
      return laneFold.laneKeyForTrack(backing?.track);
    };
    for (const task of tasks
      .filter((candidate) => candidate.parentTaskId == null)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title))) {
      const laneKey = laneForTask(task);
      if (bucket[laneKey]) appendTaskTree(task, bucket[laneKey], 0);
    }

    const milestoneBucket: Record<SxDisplayLaneKey, DisplayRow[]> = {};
    for (const key of laneFold.order) milestoneBucket[key] = [];
    for (const milestone of milestones.filter(
      (candidate) => candidate.timelineKind === "milestone",
    )) {
      // An MS can be placed on several groups at once (display_lane_keys). The single record is
      // then drawn as the same gate band in each of them; empty falls back to the track.
      const chosenLanes = milestone.displayLaneKeys.filter(
        (key): key is SxDisplayLaneKey => key in milestoneBucket,
      );
      const laneKeys: SxDisplayLaneKey[] = chosenLanes.length
        ? chosenLanes
        : [
            (sxIsBlockingMilestone(milestone) && laneFold.blockingMilestoneLane(milestone.slug)) ||
              laneFold.laneKeyForTrack(milestone.track),
          ];
      for (const laneKey of laneKeys)
        if (milestoneBucket[laneKey]) milestoneBucket[laneKey].push(milestoneAnchorRow(milestone, timeline));
    }

    const laneByKey = new Map(timeline.lanes.map((lane) => [lane.key, lane]));
    // p21's "organization" lane merges two raw tracks (funding + organizational_building), so its
    // accent/maxIssue are combined here. Every other project's lane key IS its track key, so this
    // is a direct lookup — no merging.
    const accentFor = (key: SxDisplayLaneKey) =>
      laneFold.isP21Fold && key === "organization"
        ? (laneByKey.get("organizational_building")?.accent ??
          laneByKey.get("funding")?.accent ??
          "#86868b")
        : (laneByKey.get(key)?.accent ?? "#86868b");
    const maxIssueFor = (key: SxDisplayLaneKey) =>
      laneFold.isP21Fold && key === "organization"
        ? [
            laneByKey.get("organizational_building")?.maxIssue,
            laneByKey.get("funding")?.maxIssue,
          ]
            .filter(Boolean)
            .join(" / ")
        : (laneByKey.get(key)?.maxIssue ?? "");

    return laneFold.order.map((key) => {
      const collapsed = collapsedLanes.has(key);
      return {
        lane: {
          key,
          label: laneFold.labelFor(key),
          shortLabel: laneFold.labelFor(key),
          accent: accentFor(key),
          maxIssue: maxIssueFor(key),
        } satisfies LaneMeta,
        collapsed,
        // Emptying `rows` is what makes the collapse ripple through every downstream consumer —
        // lane height, row layout, dependency endpoints — without a second code path.
        rows: collapsed ? [] : bucket[key],
        taskCount: bucket[key].length,
        milestones: milestoneBucket[key].sort(
          (left, right) => left.title.localeCompare(right.title),
        ),
      };
    });
  }, [
    asOf,
    collapsedLanes,
    expandedTasks,
    laneFold,
    milestoneById,
    taskChildren,
    tasks,
    timeline,
    milestones,
  ]);

  const hasAnyChildren = taskChildren.size > 0;
  const allExpanded =
    hasAnyChildren &&
    tasks.every(
      (task) => !taskChildren.has(task.id) || expandedTasks.has(task.id),
    );
  const lanesHeight = lanesTotalHeight(
    visibleLanes,
    canManage && Boolean(projectId),
  );
  const pinRowHeight = showPins ? PIN_ROW_H : 0;
  const gridHeight = pinRowHeight + lanesHeight;
  const milestoneStats = useMemo(() => {
    const all = visibleLanes.flatMap(({ milestones: laneMilestones }) => laneMilestones);
    return {
      undated: all.filter((milestone) => !milestone.plannedEnd).length,
      completed: all.filter((milestone) => milestone.state === "complete").length,
    };
  }, [visibleLanes]);

  const visibleRowLayout = useMemo(() => {
    const rows = new Map<string, { row: DisplayRow; centerY: number }>();
    let top = pinRowHeight;
    for (const {
      rows: laneRows,
      milestones: laneMilestones,
      collapsed,
    } of visibleLanes) {
      const laneTop = top;
      // The MS is a gate band spanning the whole lane, so a dependency line meets it at the
      // vertical center of that band — not at the center of the lane header strip.
      const laneSpanH =
        LANE_HEADER_H +
        (laneRows.length + (canManage && projectId && !collapsed ? 1 : 0)) * ROW_H;
      for (const milestone of laneMilestones) {
        // A multi-lane MS is drawn in every selected group; dependency lines meet the first one.
        if (rows.has(`milestone:${milestone.id}`)) continue;
        rows.set(`milestone:${milestone.id}`, {
          row: milestone,
          centerY: laneTop + laneSpanH / 2,
        });
      }
      top += LANE_HEADER_H;
      for (const row of laneRows) {
        rows.set(`${row.entity}:${row.id}`, {
          row,
          centerY: top + ROW_H / 2,
        });
        top += ROW_H;
      }
      if (canManage && projectId && !collapsed) top += ROW_H;
      top += LANE_GAP;
    }
    return rows;
  }, [canManage, pinRowHeight, projectId, visibleLanes]);

  useEffect(() => {
    const pane = gridPaneRef.current;
    if (!pane) return;
    const update = () => setGridPaneWidth(pane.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(pane);
    return () => observer.disconnect();
  }, [gridHeight]);

  const scheduleDependencyEdges = useMemo<ScheduleDependencyEdge[]>(() => {
    if (gridPaneWidth <= TIMELINE_SIDE_GUTTER_PX * 2) return [];
    const endpointX = (row: DisplayRow, side: "source" | "target") => {
      const isPointMilestone =
        row.entity === "milestone" ||
        row.isBlockingMilestone ||
        row.timelineKind === "milestone";
      if (isPointMilestone) {
        if (row.plannedEndPct == null) return null;
        const centerX = timelinePctToPx(
          row.plannedEndPct,
          gridPaneWidth,
          TIMELINE_SIDE_GUTTER_PX,
        );
        // The MS is a gate band, so a dependency line meets its vertical edge, not a diamond vertex.
        return centerX +
          (side === "source"
            ? MILESTONE_GATE_HALF_PX
            : -MILESTONE_GATE_HALF_PX);
      }
      if (
        row.plannedEndPct == null ||
        (side === "target" && row.plannedStartPct == null)
      )
        return null;
      const geometry = visibleBarGeometryPx(
        row.plannedStartPct ?? row.plannedEndPct,
        row.plannedEndPct,
        gridPaneWidth,
        TIMELINE_SIDE_GUTTER_PX,
        MIN_BAR_HIT_WIDTH_PX,
      );
      return side === "source" ? geometry.right : geometry.left;
    };
    return scheduleDependencies.flatMap((dependency) => {
      const sourceKey =
        dependency.predecessorType === "task"
          ? `task:${dependency.predecessorTaskId}`
          : `milestone:${dependency.predecessorMilestoneId}`;
      const source = visibleRowLayout.get(sourceKey);
      const targetKey = dependency.successorType === "task"
        ? `task:${dependency.successorTaskId}`
        : `milestone:${dependency.successorMilestoneId}`;
      const target = visibleRowLayout.get(targetKey);
      if (!source || !target) return [];
      const x1 = endpointX(source.row, "source");
      const x2 = endpointX(target.row, "target");
      if (x1 == null || x2 == null) return [];
      const y1 = source.centerY;
      const y2 = target.centerY;
      const route = buildFinishToStartRoute(
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      );
      return [
        {
          dependency,
          path: route.path,
        },
      ];
    });
  }, [gridPaneWidth, scheduleDependencies, visibleRowLayout]);

  const scheduleDependencyItems = useMemo(
    () =>
      scheduleDependencies.map((dependency) => {
        const sourceTitle =
          dependency.predecessorType === "task"
            ? tasks.find((task) => task.id === dependency.predecessorTaskId)
                ?.title || "非表示の先行タスク"
            : milestones.find(
                (milestone) =>
                  milestone.id === dependency.predecessorMilestoneId,
              )?.title || "非表示の先行MS";
        const targetTitle = dependency.successorType === "task"
          ? tasks.find((task) => task.id === dependency.successorTaskId)?.title ||
            "非表示の後続タスク"
          : milestones.find(
              (milestone) => milestone.id === dependency.successorMilestoneId,
            )?.title || "非表示の後続MS";
        return { dependency, sourceTitle, targetTitle };
      }),
    [milestones, scheduleDependencies, tasks],
  );
  const scheduleDependencyLabelById = useMemo(
    () =>
      new Map(
        scheduleDependencyItems.map((item) => [
          item.dependency.id,
          `${item.sourceTitle} → ${item.targetTitle}`,
        ]),
      ),
    [scheduleDependencyItems],
  );

  function toggleAll() {
    if (allExpanded) {
      setExpandedTasks(new Set());
    } else {
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

  useEffect(() => {
    if (!taskNestDrag) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || taskNestDragRef.current?.saving) return;
      event.preventDefault();
      setTaskNestDragBoth(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [taskNestDrag]);

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
    if (!canManage || !projectId || dragRef.current || taskNestDragRef.current)
      return;
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

  function laneKeyForTask(task: SxTask): SxDisplayLaneKey {
    const backing = milestoneById.get(task.milestoneId);
    if (task.track) return laneFold.laneKeyForTrack(task.track);
    if (backing && sxIsBlockingMilestone(backing)) {
      const forced = laneFold.blockingMilestoneLane(backing.slug);
      if (forced) return forced;
    }
    return laneFold.laneKeyForTrack(backing?.track);
  }

  /** Sibling group of a task in display order: same parent, and for top-level tasks also the same
   * visible lane — reordering must renumber only the rows the person can actually see reordering. */
  function orderedSiblings(task: SxTask): SxTask[] {
    const lane = laneKeyForTask(task);
    return tasks
      .filter(
        (candidate) =>
          (candidate.parentTaskId || null) === (task.parentTaskId || null) &&
          (task.parentTaskId != null || laneKeyForTask(candidate) === lane),
      )
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.title.localeCompare(right.title),
      );
  }

  function resolveTaskNestTarget(
    source: TaskNestDragState,
    clientX: number,
    clientY: number,
  ): TaskNestTarget | null {
    const hit = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-plan-row], [data-gantt-nest-root-lane]");
    if (!hit) return null;
    const sourceTask = tasks.find((task) => task.id === source.taskId) || null;
    const planRow = hit.dataset.planRow || "";
    const rowTaskId = planRow.startsWith("task:") ? planRow.slice(5) : "";
    if (rowTaskId && rowTaskId !== source.taskId) {
      const targetTask = tasks.find((task) => task.id === rowTaskId) || null;
      const canReorder = Boolean(
        sourceTask &&
          targetTask &&
          orderedSiblings(sourceTask).some((sibling) => sibling.id === targetTask.id),
      );
      const canNest = taskNestCandidateIds(tasks, source.taskId).has(rowTaskId);
      const rect = hit.getBoundingClientRect();
      const ratio = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
      if (canReorder && (ratio <= TASK_REORDER_EDGE_RATIO || !canNest))
        return {
          kind: "reorder",
          taskId: rowTaskId,
          place: ratio < 0.5 ? "before" : "after",
        };
      if (canReorder && ratio >= 1 - TASK_REORDER_EDGE_RATIO)
        return { kind: "reorder", taskId: rowTaskId, place: "after" };
      if (canNest) return { kind: "task", taskId: rowTaskId };
      // Neither sibling nor nest candidate: fall through to the lane, so dropping anywhere inside
      // the person's own lane still means "back to top level".
    }
    const laneHost = hit.closest<HTMLElement>("[data-gantt-nest-root-lane]");
    const rootLane = laneHost?.dataset.ganttNestRootLane as
      | SxDisplayLaneKey
      | undefined;
    // 自レーンなら「最上位へ戻す」、別レーンなら「そのグループへ移動」(2026-08-08 まさ #15)。
    if (rootLane) return { kind: "root", laneKey: rootLane };
    return null;
  }

  function beginTaskNestDrag(
    row: DisplayRow,
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    if (
      row.entity !== "task" ||
      !canManage ||
      !projectId ||
      dragRef.current ||
      taskNestDragRef.current ||
      dependencySource
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setTaskNestDragBoth({
      taskId: row.id,
      milestoneId: row.milestoneId,
      title: row.title,
      version: row.version,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      pointerClientX: event.clientX,
      pointerClientY: event.clientY,
      dragging: false,
      saving: false,
      target: null,
    });
  }

  function updateTaskNestDrag(event: React.PointerEvent<HTMLButtonElement>) {
    setTaskNestDragBoth((current) => {
      if (!current || current.pointerId !== event.pointerId || current.saving)
        return current;
      const deltaX = event.clientX - current.startClientX;
      const deltaY = event.clientY - current.startClientY;
      const dragging =
        current.dragging || !isWithinClickThreshold(deltaX, deltaY);
      if (!dragging) return current;
      const target = resolveTaskNestTarget(current, event.clientX, event.clientY);
      // The ghost mirrors the pointer every move, so this always produces a new state object.
      return {
        ...current,
        dragging,
        target,
        pointerClientX: event.clientX,
        pointerClientY: event.clientY,
      };
    });
  }

  /** Manual ordering: renumber the sibling group so the dragged row lands before/after the drop
   * target, then PATCH only the rows whose sort_order actually moved. */
  async function commitTaskReorder(
    current: TaskNestDragState,
    target: Extract<TaskNestTarget, { kind: "reorder" }>,
  ) {
    const sourceTask = tasks.find((task) => task.id === current.taskId);
    if (!projectId || !sourceTask) {
      setTaskNestDragBoth(null);
      return;
    }
    const siblings = orderedSiblings(sourceTask);
    const rest = siblings.filter((task) => task.id !== sourceTask.id);
    const anchor = rest.findIndex((task) => task.id === target.taskId);
    if (anchor < 0) {
      setTaskNestDragBoth(null);
      return;
    }
    const nextOrder = [...rest];
    nextOrder.splice(target.place === "before" ? anchor : anchor + 1, 0, sourceTask);
    const moved = nextOrder
      .map((task, index) => ({ task, sortOrder: index * 10 }))
      .filter(({ task, sortOrder }) => task.sortOrder !== sortOrder);
    if (moved.length === 0) {
      setTaskNestDragBoth(null);
      return;
    }
    const reorderMessage = `「${current.title}」の並び順を変えたよ`;
    if (onManagementOptimistic) {
      // 並び替えは掴んで離した瞬間に確定して見えてほしいので、DBの往復を待たない。
      onManagementOptimistic(
        (currentBundle) =>
          moved.reduce(
            (accumulated, { task, sortOrder }) =>
              sxApplyOptimisticManagementPatch(accumulated, "task", task.id, {
                sort_order: sortOrder,
              }),
            currentBundle,
          ),
        `${reorderMessage}。DBへ同期中`,
      );
      setTaskNestDragBoth(null);
    } else {
      setTaskNestDragBoth({ ...current, saving: true });
    }
    try {
      let bundle: SxManagementBundle | null = null;
      for (const { task, sortOrder } of moved) {
        const response = await fetch(
          `/api/project-workspace/${encodeURIComponent(projectId)}/management`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resource: "task",
              id: task.id,
              patch: { sort_order: sortOrder },
              expected_version: task.version,
            }),
          },
        );
        const body = await response.json().catch(() => ({}));
        if (response.status === 409) {
          setTaskNestDragBoth(null);
          await bestEffortRefetchManagement(
            "他の人がこのタスクを先に更新したよ。最新の状態に更新したよ",
            "他の人がこのタスクを先に更新したみたい。画面を再読み込みしてね",
          );
          return;
        }
        if (!response.ok)
          throw new Error(
            typeof body.error === "string"
              ? body.error
              : "タスクの並び順を保存できなかったよ",
          );
        bundle = (body.bundle as SxManagementBundle) || bundle;
      }
      setTaskNestDragBoth(null);
      // 応答のbundleは使わない: 送信中に入った別の編集を、古いbundleで消さないため。
      if (onManagementOptimistic) return;
      if (bundle) onManagementChange(bundle, reorderMessage);
    } catch (caught) {
      setTaskNestDragBoth(null);
      const message =
        caught instanceof Error
          ? caught.message
          : "タスクの並び順を保存できなかったよ";
      await bestEffortRefetchManagement(
        `${message}。最新の状態に更新したよ`,
        `${message}。保存できたか確認できなかったよ。画面を再読み込みしてね`,
      );
    }
  }

  async function finishTaskNestDrag(
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    const current = taskNestDragRef.current;
    if (!current || current.pointerId !== event.pointerId || !projectId) return;
    const target = current.dragging
      ? resolveTaskNestTarget(current, event.clientX, event.clientY)
      : null;
    if (!current.dragging || !target) {
      setTaskNestDragBoth(null);
      return;
    }
    if (target.kind === "reorder") {
      await commitTaskReorder(current, target);
      return;
    }
    const parentTaskId =
      target.kind === "task" ? target.taskId : null;
    const parentTitle = parentTaskId
      ? tasks.find((task) => task.id === parentTaskId)?.title || "親タスク"
      : null;
    const sourceTask = tasks.find((task) => task.id === current.taskId) || null;
    const crossLane =
      target.kind === "root" &&
      sourceTask &&
      laneKeyForTask(sourceTask) !== target.laneKey
        ? target.laneKey
        : null;
    const patch: Record<string, unknown> = crossLane
      ? { parent_task_id: parentTaskId, track: laneFold.trackForLane(crossLane) }
      : { parent_task_id: parentTaskId };
    const nestMessage = parentTitle
      ? `「${current.title}」を「${parentTitle}」の子タスクにしたよ`
      : crossLane
        ? `「${current.title}」を${laneFold.labelFor(crossLane)}へ移動したよ`
        : `「${current.title}」を最上位タスクに戻したよ`;
    if (onManagementOptimistic) {
      onManagementOptimistic(
        (currentBundle) =>
          sxApplyOptimisticManagementPatch(
            currentBundle,
            "task",
            current.taskId,
            patch,
          ),
        `${nestMessage}。DBへ同期中`,
      );
      if (parentTaskId)
        setExpandedTasks((currentExpanded) =>
          new Set([...currentExpanded, parentTaskId]),
        );
      setTaskNestDragBoth(null);
    } else {
      setTaskNestDragBoth({ ...current, saving: true });
    }
    try {
      const response = await fetch(
        `/api/project-workspace/${encodeURIComponent(projectId)}/management`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resource: "task",
            id: current.taskId,
            patch,
            expected_version: current.version,
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (response.status === 409) {
        setTaskNestDragBoth(null);
        await bestEffortRefetchManagement(
          "他の人がこのタスクを先に更新したよ。最新の状態に更新したよ",
          "他の人がこのタスクを先に更新したみたい。画面を再読み込みしてね",
        );
        return;
      }
      if (!response.ok)
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "タスク階層を保存できなかったよ",
        );
      if (parentTaskId)
        setExpandedTasks((currentExpanded) =>
          new Set([...currentExpanded, parentTaskId]),
        );
      setTaskNestDragBoth(null);
      if (onManagementOptimistic) return;
      onManagementChange(body.bundle as SxManagementBundle, nestMessage);
    } catch (caught) {
      setTaskNestDragBoth(null);
      const message =
        caught instanceof Error ? caught.message : "タスク階層を保存できなかったよ";
      await bestEffortRefetchManagement(
        `${message}。最新の状態に更新したよ`,
        `${message}。保存できたか確認できなかったよ。画面を再読み込みしてね`,
      );
    }
  }

  function cancelTaskNestDrag(
    event?: React.PointerEvent<HTMLButtonElement>,
  ) {
    if (event && taskNestDragRef.current?.pointerId !== event.pointerId)
      return;
    if (!taskNestDragRef.current?.saving) setTaskNestDragBoth(null);
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
    const patch: Record<string, string | null> =
      current.mode === "resize-start"
        ? { planned_start: current.previewStart }
        : current.mode === "resize-end" || current.mode === "milestone-end-move"
          ? { planned_end: current.previewEnd }
          : { planned_start: current.previewStart, planned_end: current.previewEnd };
    const dragMessage =
      current.mode === "milestone-move" || current.mode === "milestone-end-move"
        ? "マイルストーンの日付を更新したよ"
        : "計画日程を更新したよ";
    if (onManagementOptimistic) {
      // 離した瞬間に新しい日程で確定させる。DBの書き込みは裏で追いかける。
      onManagementOptimistic(
        (currentBundle) =>
          sxApplyOptimisticManagementPatch(
            currentBundle,
            current.entity,
            current.rowId,
            patch,
          ),
        `${dragMessage}。DBへ同期中`,
      );
      setDragBoth(null);
    } else {
      setDragBoth({ ...current, saving: true });
    }
    try {
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
      if (onManagementOptimistic) return;
      onManagementChange(body.bundle as SxManagementBundle, dragMessage);
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
      (item) => laneFold.laneKeyForTrack(item.track) === laneKey,
    );
    // Only preselect a parent when this visible lane maps to exactly one outcome. p21's 組織開発
    // lane folds both funding and organizational_building outcomes together; silently choosing
    // one would create a plausible-looking but semantically wrong MS. In that ambiguous case the
    // form opens with no outcome selected and makes the user choose the exact parent before Save
    // is enabled. (Non-p21 lanes map 1:1 to a track, so this ambiguity only arises there if a
    // single track legitimately has multiple outcomes.)
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
      {taskNestDrag?.dragging && (
        // The dragged row is mirrored under the cursor so the move reads like a normal
        // drag-and-drop instead of an invisible pointer gesture.
        <div
          aria-hidden
          data-gantt-task-drag-ghost={taskNestDrag.taskId}
          className="pointer-events-none fixed z-[70] max-w-[240px] truncate border border-[#047857] bg-[#ecfdf5] px-2 py-1 text-[11px] font-semibold text-[#065f46] shadow-[0_6px_14px_rgba(5,150,105,0.28)]"
          style={{
            left: taskNestDrag.pointerClientX + 12,
            top: taskNestDrag.pointerClientY + 12,
          }}
        >
          {taskNestDrag.title}
        </div>
      )}
      {!timeline.valid && (
        <p className="mb-2 border border-dashed border-[#ef4444] bg-[#fee2e2] px-3 py-2 text-[11px] font-semibold text-[#dc2626]">
          {timeline.reason}
          {milestones.some((milestone) => milestone.timelineKind === "milestone") &&
            "。MSは日程未設定でも該当レーンに表示するよ。"}
        </p>
      )}
      {ganttNotice && (
        <p role="alert" className="mb-2 border border-[#fbbf24] bg-[#fef3c7] px-3 py-2 text-[11px] font-semibold text-[#92400e]">
          {ganttNotice}
        </p>
      )}
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={!hasAnyChildren}
          onClick={toggleAll}
          className="inline-flex min-h-11 items-center gap-1 border border-[#cbd5e1] bg-[#ffffff] px-3 text-[11px] font-semibold text-[#3c3c43] disabled:cursor-not-allowed disabled:opacity-45"
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
          className="hidden min-h-11 border border-[#cbd5e1] bg-[#ffffff] px-3 text-[11px] font-semibold text-[#3c3c43] lg:inline-flex lg:items-center"
        >
          今日へ
        </button>
        <label className="hidden min-h-11 items-center gap-2 border border-[#cbd5e1] bg-[#ffffff] px-3 text-[11px] font-semibold text-[#3c3c43] lg:inline-flex">
          <span className="whitespace-nowrap">時間軸</span>
          <input
            type="range"
            data-gantt-time-scale
            min={GANTT_TIME_SCALE_MIN}
            max={GANTT_TIME_SCALE_MAX}
            step={0.05}
            value={timeScale}
            onChange={(event) => commitTimeScale(Number(event.target.value))}
            onDoubleClick={() => commitTimeScale(1)}
            className="h-1 w-32 cursor-ew-resize accent-[#059669]"
            aria-label="ガントの時間軸の縮尺"
            aria-valuetext={`${timeScale.toFixed(2)}倍`}
            title="ドラッグで時間軸を伸縮。ダブルクリックで等倍に戻る"
          />
          <span className="w-9 shrink-0 text-right tabular-nums text-[10px] text-[#3c3c43]">
            {timeScale.toFixed(2)}x
          </span>
        </label>
        <span className="ml-auto hidden text-[10px] text-[#3c3c43] lg:inline">
          {dependencySource
            ? `${dependencySource.title} → 接続先のタスクかMSへ`
            : dependencyDrawingEnabled
              ? "バーで日程変更・左のグリップで階層変更・右端の＋をドラッグで依存線"
              : "バーで日程変更・左のグリップで階層変更"}
        </span>
      </div>

      {/* 依存関係の一覧表 (details) は 2026-08-07 に削除。線そのものを hover して外す導線が
          すでにあり、一覧は使われないまま縦を食っていた (まさ指示)。 */}

      <div className="space-y-2 lg:hidden" aria-label="MSとタスクの縦一覧">
        {visibleLanes.map(({ lane, rows, milestones: laneMilestones, collapsed, taskCount }) => (
          <section
            key={`mobile-${lane.key}`}
            className="border border-[#cbd5e1] bg-[#ffffff]"
          >
            <header
              data-gantt-nest-root-lane={lane.key}
              className="border-b border-[#cbd5e1] bg-[#f5f5f7]"
            >
              <button
                type="button"
                onClick={() => toggleLaneCollapsed(lane.key)}
                aria-expanded={!collapsed}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                <ChevronRight
                  className={`h-3 w-3 shrink-0 text-[#3c3c43] transition-transform ${collapsed ? "" : "rotate-90"}`}
                  aria-hidden="true"
                />
                <span
                  className="h-2.5 w-2.5 shrink-0"
                  style={{ background: lane.accent }}
                />
                <b className="text-[11px] text-[#1d1d1f]">{lane.label}</b>
                <span className="text-[9px] text-[#3c3c43]">
                  MS {laneMilestones.length} / タスク {taskCount}
                  {collapsed ? "（折りたたみ中）" : ""}
                </span>
              </button>
            </header>
            <div className="divide-y divide-[#f1f5f9]">
              {laneMilestones.map((milestone) => {
                const displayMilestone = milestone;
                const hasScheduledPoint = displayMilestone.plannedEndPct != null;
                const incomingScheduleCount = scheduleDependencies.filter(
                  (item) =>
                    item.successorType === "milestone" &&
                    item.successorMilestoneId === milestone.id,
                ).length;
                const outgoingScheduleCount = scheduleDependencies.filter(
                  (item) =>
                    item.predecessorType === "milestone" &&
                    item.predecessorMilestoneId === milestone.id,
                ).length;
                return (
                  <article
                    key={`mobile-ms-${milestone.id}`}
                    className={selectedMilestoneId === milestone.id ? "bg-[#E8F3FC]" : "bg-[#f8fafc]"}
                  >
                    <button
                      type="button"
                      data-gantt-milestone-marker={milestone.id}
                      onClick={() => select(milestone)}
                      className="flex min-h-11 w-full items-center gap-2 px-3 text-left"
                      aria-label={`${milestone.title}の詳細を開く`}
                    >
                      <i className={`h-3 w-3 shrink-0 rotate-45 border-2 border-[#027FDC] ${milestone.isBlockingMilestone ? "bg-[#027FDC]" : "bg-[#ffffff]"}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1 text-[10px] font-bold text-[#027FDC]">{milestone.title}</span>
                      <span className="shrink-0 text-[9px] text-[#86868b]">{milestone.plannedEnd ? sxFormatDate(milestone.plannedEnd) : "日程未設定"}</span>
                    </button>
                    {dependencyDrawingEnabled && (
                      <div className="flex items-center gap-2 border-t border-[#e2e8f0] px-3 py-1.5">
                        <button
                          type="button"
                          disabled={!hasScheduledPoint}
                          onClick={() => beginKeyboardScheduleDependency(displayMilestone)}
                          className="flex min-h-11 flex-1 items-center justify-center gap-1 border border-[#7CBCEB] bg-[#ffffff] px-2 text-[10px] font-bold text-[#027FDC] disabled:opacity-40"
                        >
                          <Plus className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                          起点
                        </button>
                        {dependencySource && (
                        <button
                          type="button"
                          disabled={!hasScheduledPoint}
                          onClick={() =>
                            void connectScheduleDependency({
                              entity: "milestone",
                              id: milestone.id,
                            })
                          }
                          className="flex min-h-11 flex-1 items-center justify-center gap-1 border border-[#7CBCEB] bg-[#ffffff] px-2 text-[10px] font-bold text-[#027FDC] disabled:opacity-40"
                        >
                          <span aria-hidden="true">←</span>
                          接続先
                        </button>
                        )}
                        <span className="shrink-0 text-[9px] text-[#86868b]">
                          入{incomingScheduleCount} / 出{outgoingScheduleCount}
                        </span>
                      </div>
                    )}
                  </article>
                );
              })}
              {rows.map((row) => {
                const selected = selectedTaskId === row.id;
                const expanded = expandedTasks.has(row.id);
                const incomingScheduleCount = scheduleDependencies.filter(
                  (item) =>
                    item.successorType === "task" &&
                    item.successorTaskId === row.id,
                ).length;
                const outgoingScheduleCount = scheduleDependencies.filter(
                  (item) =>
                    item.predecessorType === "task" && item.predecessorTaskId === row.id,
                ).length;
                const isNestSource =
                  taskNestDrag?.taskId === row.id && taskNestDrag.dragging;
                const isNestTaskTarget =
                  taskNestDrag?.target?.kind === "task" &&
                  taskNestDrag.target.taskId === row.id;
                const isNestRootTarget = taskNestDrag?.target?.kind === "root" && taskNestDrag.target.laneKey === lane.key;
                const isNestCandidate = taskNestCandidateTaskIds.has(row.id);
                const reorderPlace =
                  taskNestDrag?.target?.kind === "reorder" &&
                  taskNestDrag.target.taskId === row.id
                    ? taskNestDrag.target.place
                    : null;
                return (
                  <article
                    key={`mobile-${row.entity}-${row.id}`}
                    data-plan-row={`${row.entity}:${row.id}`}
                    data-gantt-nest-target-task={
                      isNestCandidate ? row.id : undefined
                    }
                    className={`relative p-2.5 transition-colors ${isNestSource ? "opacity-45" : ""} ${isNestTaskTarget || isNestRootTarget ? "bg-[#ecfdf5] outline outline-2 outline-[#047857] outline-offset-[-2px]" : selected ? "bg-[#ecfdf5]" : "bg-white"}`}
                    style={{ marginLeft: row.depth * 12 }}
                  >
                    {reorderPlace && (
                      <span
                        aria-hidden
                        data-gantt-task-reorder-indicator={reorderPlace}
                        className={`pointer-events-none absolute inset-x-0 z-30 h-[3px] bg-[#047857] ${reorderPlace === "before" ? "top-0" : "bottom-0"}`}
                      />
                    )}
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
                            setExpandedTasks(update);
                          }}
                          className="grid min-h-11 min-w-11 place-items-center text-[#3c3c43]"
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
                      {canManage && projectId && (
                        <button
                          type="button"
                          data-gantt-task-nest-handle={row.id}
                          onPointerDown={(event) => beginTaskNestDrag(row, event)}
                          onPointerMove={updateTaskNestDrag}
                          onPointerUp={(event) => void finishTaskNestDrag(event)}
                          onPointerCancel={(event) => cancelTaskNestDrag(event)}
                          onLostPointerCapture={(event) => cancelTaskNestDrag(event)}
                          className="grid min-h-11 min-w-11 touch-none place-items-center text-[#86868b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#059669] disabled:opacity-40"
                          disabled={Boolean(dependencySource) || taskNestDrag?.saving}
                          aria-label={`${row.title}をドラッグして並び順や親タスクを変更`}
                        >
                          <GripVertical className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => select(row)}
                        className="min-h-11 min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#059669]"
                        aria-pressed={selected}
                      >
                        <span className="flex flex-wrap items-center gap-1">
                          <b className="text-[11px] text-[#1d1d1f]">
                            {row.title}
                          </b>
                          <i className="border border-[#cbd5e1] px-1 text-[8px] not-italic text-[#3c3c43]">タスク</i>
                          <i className="border border-[#cbd5e1] px-1 text-[8px] not-italic text-[#3c3c43]">
                            {ROW_STATE_TEXT[row.state]}
                          </i>
                        </span>
                        <span className="mt-1 block text-[10px] text-[#3c3c43]">
                          {row.plannedEnd
                            ? `${sxFormatDate(row.plannedStart)} → ${sxFormatDate(row.plannedEnd)}`
                            : "日程未設定"}{" "}
                          ・ {row.ownerLabel}
                        </span>
                        {(incomingScheduleCount > 0 ||
                          outgoingScheduleCount > 0) && (
                          <span className="mt-1 block text-[9px] font-semibold text-[#027FDC]">
                            依存：先行 {incomingScheduleCount} / 後続{" "}
                            {outgoingScheduleCount}
                          </span>
                        )}
                        {(isNestTaskTarget || isNestRootTarget) && (
                          <span className="mt-1 block text-[10px] font-bold text-[#047857]">
                            {isNestTaskTarget
                              ? "ここを親タスクにする"
                              : "最上位タスクに戻す"}
                          </span>
                        )}
                      </button>
                    </div>
                    {dependencyDrawingEnabled && (
                      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#e2e8f0] pt-2">
                        {row.plannedEndPct != null ? (
                          <button
                            type="button"
                            aria-pressed={
                              dependencySource ? sourceKey(dependencySource) === `task:${row.id}` : false
                            }
                            onClick={() => beginKeyboardScheduleDependency(row)}
                            className="flex min-h-11 items-center justify-center gap-1 border border-[#7CBCEB] px-2 text-[10px] font-bold text-[#027FDC] aria-pressed:bg-[#E8F3FC]"
                          >
                            <Plus className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                            右端を起点
                          </button>
                        ) : (
                          <span className="flex min-h-11 items-center justify-center border border-dashed border-[#cbd5e1] px-2 text-[9px] text-[#86868b]">
                            起点は日程が必要
                          </span>
                        )}
                        {row.entity === "task" && row.plannedStartPct != null ? (
                          <button
                            type="button"
                            disabled={!dependencySource}
                            onClick={() =>
                              void connectScheduleDependency({
                                entity: "task",
                                id: row.id,
                              })
                            }
                            className="flex min-h-11 items-center justify-center gap-1 border border-[#7CBCEB] px-2 text-[10px] font-bold text-[#027FDC] disabled:opacity-40"
                          >
                            <span aria-hidden="true">←</span>
                            左端へ接続
                          </button>
                        ) : (
                          <span className="flex min-h-11 items-center justify-center border border-dashed border-[#cbd5e1] px-2 text-[9px] text-[#86868b]">
                            接続先は開始日が必要
                          </span>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
              {canManage && projectId && timeline.valid && (
                <button
                  type="button"
                  onClick={(event) => proposeMilestone(lane.key, event)}
                  className="relative min-h-11 w-full overflow-hidden border-t border-[#cbd5e1] bg-[#ffffff] px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#059669]"
                  aria-label={`${lane.label}のモバイル日付軸でMSを追加`}
                >
                  <span className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(12.5%-1px),rgba(134,134,139,0.16)_12.5%)]" />
                  <span className="relative flex items-center justify-between gap-3 text-[9px] text-[#86868b]">
                    <span>{sxFormatDate(timeline.domainStart)}</span>
                    <b className="text-[10px] text-[#047857]">MS｜日付位置をタップ</b>
                    <span>{sxFormatDate(timeline.domainEnd)}</span>
                  </span>
                </button>
              )}
              {canManage && projectId && (
                <button
                  type="button"
                  data-gantt-add-task-lane={lane.key}
                  onClick={() => onCreateTask(lane.key)}
                  className="flex min-h-12 w-full items-center gap-2 bg-[#f8fafc] px-3 text-left text-[11px] font-bold text-[#047857] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#059669]"
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
        className="relative hidden max-h-[min(72vh,720px)] overflow-auto overscroll-contain border border-[#cbd5e1] bg-[#ffffff] shadow-[inset_-14px_0_12px_-14px_rgba(29,29,31,0.42)] lg:block"
        tabIndex={0}
        aria-label="ガントチャート。上下左右にスクロールできる"
      >
        <div style={{ minWidth: GANTT_BASE_WIDTH_PX * timeScale }}>
          <div
            className="sticky top-0 z-50 grid grid-cols-[minmax(275px,320px)_minmax(0,1fr)] items-end border-b border-[#cbd5e1] bg-[#ffffff] shadow-[0_3px_8px_rgba(29,29,31,0.08)]"
            data-gantt-sticky-header
            style={{ height: MONTH_ROW_H }}
          >
            <p className="sticky left-0 z-[51] bg-[#ffffff] px-2 text-[9px] font-semibold tracking-[0.1em] text-[#3c3c43]">
              タスク
            </p>
            <div className="relative h-full">
              {timeline.months.map((month) =>
                month.yearLabel ? (
                  <span
                    key={`year-${month.pct}`}
                    className="absolute top-0 pl-1 text-[9px] font-bold leading-none text-[#1d1d1f]"
                    style={{ left: timelinePctCss(month.pct) }}
                  >
                    {month.yearLabel}
                  </span>
                ) : null,
              )}
              {timeline.months.map((month) => (
                <span
                  key={month.pct}
                  className={`absolute bottom-0 pl-1 text-[9px] ${month.isYearStart ? "font-bold text-[#1d1d1f]" : "text-[#3c3c43]"}`}
                  style={{ left: timelinePctCss(month.pct) }}
                >
                  {month.label}
                </span>
              ))}
              {timeline.objectivePct != null && (
                <span
                  className="absolute z-10 flex -translate-x-full items-center gap-0.5 whitespace-nowrap pr-1 text-[9px] font-bold leading-none text-[#027FDC]"
                  style={{ left: timelinePctCss(timeline.objectivePct), top: MONTH_YEAR_ROW_H }}
                >
                  <Flag className="h-3 w-3" />
                  設立 {sxFormatDate(timeline.objectiveDate)}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-[minmax(275px,320px)_minmax(0,1fr)]">
            <div className="sticky left-0 z-30 border-r border-[#cbd5e1] bg-[#ffffff]">
              {showPins && (
                <div
                  className="flex items-center border-b border-[#e2e8f0] px-2 text-[9px] font-semibold text-[#3c3c43]"
                  style={{ height: PIN_ROW_H }}
                >
                  介入の期限
                </div>
              )}
              {visibleLanes.map(({ lane, milestones: laneMilestones, rows, collapsed, taskCount }) => (
                <div key={lane.key} style={{ marginBottom: LANE_GAP }}>
                  {/* The lane header is both the collapse control and the "move to top level"
                      drop target of the task-nesting drag, so the data attribute has to survive. */}
                  <button
                    type="button"
                    data-gantt-nest-root-lane={lane.key}
                    onClick={() => toggleLaneCollapsed(lane.key)}
                    aria-expanded={!collapsed}
                    className="!min-h-0 flex w-full items-center gap-1.5 border-b border-[#cbd5e1] px-2 text-left hover:bg-[#f5f5f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#059669]"
                    style={{ height: LANE_HEADER_H }}
                    title={collapsed ? "このグループを開く" : "このグループを折りたたむ（MSは残る）"}
                  >
                    <ChevronRight
                      className={`h-3 w-3 shrink-0 text-[#3c3c43] transition-transform ${collapsed ? "" : "rotate-90"}`}
                      aria-hidden="true"
                    />
                    <span
                      className="h-2.5 w-2.5 shrink-0"
                      style={{ background: lane.accent }}
                    />
                    <span className="text-[10px] font-bold text-[#1d1d1f]">
                      {lane.label}
                    </span>
                    <span className="text-[10px] text-[#3c3c43]">
                      MS {laneMilestones.length} / タスク {taskCount}
                      {collapsed ? "（折りたたみ中）" : ""}
                    </span>
                  </button>
                  {rows.map((row) => {
                    const selected = selectedTaskId === row.id;
                    const expanded = expandedTasks.has(row.id);
                    const isNestSource =
                      taskNestDrag?.taskId === row.id &&
                      taskNestDrag.dragging;
                    const isNestTaskTarget =
                      taskNestDrag?.target?.kind === "task" &&
                      taskNestDrag.target.taskId === row.id;
                    const isNestRootTarget = taskNestDrag?.target?.kind === "root" && taskNestDrag.target.laneKey === lane.key;
                    const isNestCandidate = taskNestCandidateTaskIds.has(row.id);
                    const reorderPlace =
                      taskNestDrag?.target?.kind === "reorder" &&
                      taskNestDrag.target.taskId === row.id
                        ? taskNestDrag.target.place
                        : null;
                    return (
                      <div
                        key={`${row.entity}-${row.id}`}
                        data-plan-row={`${row.entity}:${row.id}`}
                        data-gantt-nest-target-task={
                          isNestCandidate ? row.id : undefined
                        }
                        className={`group relative flex scroll-mt-3 border-b border-[#e8e8ed] transition-colors ${isNestSource ? "opacity-45" : ""} ${isNestTaskTarget || isNestRootTarget ? "bg-[#ecfdf5] outline outline-2 outline-[#047857] outline-offset-[-2px]" : selected ? "bg-[#ecfdf5]" : "hover:bg-[#f5f5f7]"}`}
                        style={{ height: ROW_H, paddingLeft: row.depth * 15 }}
                      >
                        {reorderPlace && (
                          <span
                            aria-hidden
                            data-gantt-task-reorder-indicator={reorderPlace}
                            className={`pointer-events-none absolute inset-x-0 z-30 h-[3px] bg-[#047857] ${reorderPlace === "before" ? "top-0" : "bottom-0"}`}
                          />
                        )}
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
                            setExpandedTasks(update);
                          }}
                          className={`flex w-11 shrink-0 items-center justify-center text-[#3c3c43] ${row.hasChildren ? "" : "opacity-0"}`}
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
                        {canManage && projectId && (
                          <button
                            type="button"
                            data-gantt-task-nest-handle={row.id}
                            onPointerDown={(event) => beginTaskNestDrag(row, event)}
                            onPointerMove={updateTaskNestDrag}
                            onPointerUp={(event) => void finishTaskNestDrag(event)}
                            onPointerCancel={(event) => cancelTaskNestDrag(event)}
                            onLostPointerCapture={(event) => cancelTaskNestDrag(event)}
                            className="grid h-full w-6 shrink-0 touch-none place-items-center text-[#86868b] transition-colors hover:text-[#047857] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#059669] disabled:opacity-40"
                            disabled={Boolean(dependencySource) || taskNestDrag?.saving}
                            title="ドラッグして並び替え。行の上下端で順番、中央へ重ねると子タスク、レーン見出しへ戻すと最上位"
                            aria-label={`${row.title}をドラッグして並び順や親タスクを変更`}
                          >
                            <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => select(row)}
                          className={`min-w-0 flex-1 px-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#059669] ${row.isCritical ? "border-l-[3px] border-[#1d1d1f]" : ""}`}
                          aria-pressed={selected}
                        >
                          <span className="flex items-center gap-1">
                            <b
                              className="truncate text-[10px] font-medium"
                            >
                              {row.title}
                            </b>
                            <i className="shrink-0 border border-[#cbd5e1] px-1 text-[8px] not-italic text-[#3c3c43]">タスク</i>
                            {row.isCurrent && (
                              <i className="shrink-0 bg-[#059669] px-1 text-[8px] not-italic text-white">
                                進行中
                              </i>
                            )}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 overflow-hidden whitespace-nowrap text-[10px] text-[#3c3c43]">
                            <em className="not-italic">
                              {ROW_STATE_TEXT[row.state]}
                            </em>
                            <span>{row.ownerLabel}</span>
                          </span>
                          {(isNestTaskTarget || isNestRootTarget) && (
                            <span className="mt-0.5 block text-[9px] font-bold text-[#047857]">
                              {isNestTaskTarget
                                ? "ここを親タスクにする"
                                : "最上位タスクに戻す"}
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                  {canManage && projectId && !collapsed && (
                    <button
                      type="button"
                      data-gantt-add-task-lane={lane.key}
                      onClick={() => onCreateTask(lane.key)}
                      className="flex w-full items-center gap-2 border-b border-[#e2e8f0] bg-[#f8fafc] px-3 text-left text-[10px] font-bold text-[#047857] hover:bg-[#f1f5f9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#059669]"
                      style={{ height: ROW_H }}
                      aria-label={`${lane.label}に新規タスクを追加`}
                      aria-haspopup="dialog"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      新規タスク
                      <span className="font-normal text-[#3c3c43]">
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
                  className={`absolute top-0 w-px ${month.isYearStart ? "bg-[#cbd5e1]" : "bg-[#f1f5f9]"}`}
                  style={{ left: timelinePctCss(month.pct), height: gridHeight }}
                />
              ))}
              {timeline.objectivePct != null && (
                <span
                  className="absolute top-0 w-[2px] bg-[#027FDC]/45"
                  style={{
                    left: timelinePctCss(timeline.objectivePct),
                    height: gridHeight,
                  }}
                />
              )}
              <span
                className="absolute top-0 z-10 w-[2px] bg-[#1d1d1f]"
                style={{ left: timelinePctCss(timeline.todayPct), height: gridHeight }}
              />
              <span
                className="absolute z-20 -translate-x-1/2 bg-[#1d1d1f] px-1 py-px text-[8px] font-bold text-white"
                style={{ left: timelinePctCss(timeline.todayPct), top: -1 }}
              >
                今日 {sxFormatDate(asOf).slice(5)}
              </span>

              {(scheduleDependencyEdges.length > 0 ||
                (dependencySource && dependencyPreview)) && (
                <svg
                  className="pointer-events-none absolute inset-0 z-[12] overflow-visible"
                  width={gridPaneWidth}
                  height={gridHeight}
                  viewBox={`0 0 ${gridPaneWidth} ${gridHeight}`}
                  aria-hidden="true"
                  data-gantt-schedule-dependency-lines
                >
                  <defs>
                    <marker
                      id={dependencyArrowMarkerId}
                      viewBox="0 0 8 8"
                      refX="8"
                      refY="4"
                      markerWidth="8"
                      markerHeight="8"
                      markerUnits="userSpaceOnUse"
                      orient="auto"
                    >
                      <path d="M 0 0 L 8 4 L 0 8 z" fill="#027FDC" />
                    </marker>
                  </defs>
                  {scheduleDependencyEdges.map((edge) => {
                    const hovered =
                      !dependencySource &&
                      hoveredScheduleDependency?.id === edge.dependency.id;
                    return (
                      <g key={edge.dependency.id}>
                        <path
                          data-gantt-schedule-dependency-hit={edge.dependency.id}
                          d={edge.path}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={DEPENDENCY_EDGE_HIT_WIDTH_PX}
                          pointerEvents="stroke"
                          onPointerEnter={(event) =>
                            showScheduleDependencyActions(
                              edge.dependency.id,
                              event,
                            )
                          }
                          onPointerMove={(event) =>
                            showScheduleDependencyActions(
                              edge.dependency.id,
                              event,
                            )
                          }
                          onPointerLeave={() =>
                            hideScheduleDependencyActionsAfterLeave(
                              edge.dependency.id,
                            )
                          }
                        />
                        <path
                          d={edge.path}
                          fill="none"
                          stroke="#027FDC"
                          strokeWidth={hovered ? "2" : "1.5"}
                          strokeOpacity={hovered ? "0.96" : "0.68"}
                          markerEnd={`url(#${dependencyArrowMarkerId})`}
                          pointerEvents="none"
                        />
                      </g>
                    );
                  })}
                  {dependencySource && dependencyPreview && (
                    <path
                      d={`M ${dependencySource.startX} ${dependencySource.startY} L ${dependencyPreview.x} ${dependencyPreview.y}`}
                      fill="none"
                      stroke="#047857"
                      strokeWidth="2"
                      markerEnd={`url(#${dependencyArrowMarkerId})`}
                    />
                  )}
                </svg>
              )}
              {!dependencySource &&
                canManage &&
                projectId &&
                hoveredScheduleDependency && (
                  <button
                    type="button"
                    data-gantt-schedule-dependency-hover-remove={
                      hoveredScheduleDependency.id
                    }
                    disabled={removingDependencyId != null}
                    onPointerEnter={keepScheduleDependencyActions}
                    onPointerLeave={() =>
                      hideScheduleDependencyActionsAfterLeave(
                        hoveredScheduleDependency.id,
                      )
                    }
                    onClick={() =>
                      void removeScheduleDependency(
                        hoveredScheduleDependency.id,
                      )
                    }
                    className="absolute z-[45] inline-flex h-8 min-w-14 -translate-y-1/2 items-center justify-center gap-1 border border-[#027FDC] bg-[#ffffff] px-2 text-[10px] font-bold text-[#027FDC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#027FDC] disabled:opacity-45"
                    style={{
                      left: Math.min(
                        Math.max(4, gridPaneWidth - DEPENDENCY_HOVER_ACTION_WIDTH_PX - 4),
                        Math.max(4, hoveredScheduleDependency.x + 8),
                      ),
                      top: Math.min(
                        Math.max(16, gridHeight - 16),
                        Math.max(16, hoveredScheduleDependency.y),
                      ),
                    }}
                    aria-label={`${scheduleDependencyLabelById.get(hoveredScheduleDependency.id) || "この依存関係"}を外す`}
                    title="依存線を外す"
                  >
                    <Unlink2 className="h-3.5 w-3.5" aria-hidden="true" />
                    外す
                  </button>
                )}

              {showPins && (
                <div
                  className="absolute inset-x-0 top-0 border-b border-[#e2e8f0]"
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
                      className={`absolute top-1/2 z-20 flex h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold ${pin.side === "partner" ? "bg-[#d97706] text-white" : pin.side === "unknown" ? "border-2 border-[#1d1d1f] bg-[#ffffff]" : "bg-[#1d1d1f] text-white"}`}
                      style={{ left: timelinePctCss(pin.duePct) }}
                    >
                      {pin.rank}
                      {hoveredPin === pin.key && (
                        <span className="absolute top-6 z-30 w-[220px] border border-[#cbd5e1] bg-[#ffffff] p-2 text-left text-[10px] text-[#3c3c43] shadow-lg">
                          <b className="block text-[#1d1d1f]">{pin.target}</b>
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
                {visibleLanes.map(({ lane, rows, milestones: laneMilestones, collapsed }) => (
                  <div key={lane.key} className="relative" style={{ marginBottom: LANE_GAP }}>
                    {laneMilestones.map((milestone, index) => {
                      const isDraggingThisMilestone = drag?.rowId === milestone.id;
                      const displayMilestone = isDraggingThisMilestone && drag
                        ? {
                            ...milestone,
                            plannedStart: drag.previewStart,
                            plannedEnd: drag.previewEnd,
                            plannedStartPct: dateToPct(drag.previewStart, timeline.domainStart, timeline.domainEnd),
                            plannedEndPct: dateToPct(drag.previewEnd, timeline.domainStart, timeline.domainEnd),
                          }
                        : milestone;
                      const markerPct = displayMilestone.plannedEndPct;
                      const markerMode: DragMode = displayMilestone.isBlockingMilestone
                        ? "milestone-end-move"
                        : "milestone-move";
                      return markerPct != null ? (
                        <div
                          key={`lane-ms-${milestone.id}`}
                          className="pointer-events-none absolute inset-y-0 z-[18]"
                          style={{ left: timelinePctCss(markerPct) }}
                          data-gantt-lane-milestone-spine={milestone.id}
                        >
                          {/* An MS gates the whole lane, so it is drawn as a vertical band across
                              every task row of that lane rather than as a point diamond. The band
                              is decoration only — the pointer targets stay in the header strip, so
                              a gate never swallows a click meant for a bar crossing underneath. */}
                          <span
                            className={`absolute inset-y-0 -translate-x-1/2 ${
                              milestone.isBlockingMilestone
                                ? "border-x-2 border-[#027FDC] bg-[#027FDC]/28"
                                : "border-x border-[#027FDC]/70 bg-[#027FDC]/12"
                            }`}
                            style={{ left: 0, width: MILESTONE_GATE_WIDTH_PX }}
                            aria-hidden="true"
                          />
                          <button
                            type="button"
                            data-gantt-milestone-marker={milestone.id}
                            data-gantt-dependency-target-entity={
                              dependencySource ? "milestone" : undefined
                            }
                            data-gantt-dependency-target-id={
                              dependencySource ? milestone.id : undefined
                            }
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              // Mid-link the diamond is purely a landing pad; letting it also
                              // start a date drag would resolve one gesture as two edits.
                              if (dependencySource) return;
                              beginDrag(displayMilestone, markerMode, event);
                            }}
                            onPointerMove={updateDrag}
                            onPointerUp={(event) => void finishDrag(displayMilestone, event)}
                            onPointerCancel={() => setDragBoth(null)}
                            onLostPointerCapture={handleLostPointerCapture}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (dependencySource) {
                                void connectScheduleDependency({
                                  entity: "milestone",
                                  id: milestone.id,
                                });
                                return;
                              }
                              handleRowClick(displayMilestone);
                            }}
                            className={`pointer-events-auto absolute -top-[5px] left-0 grid h-11 w-11 -translate-x-1/2 place-items-center focus-visible:outline focus-visible:outline-2 ${dependencySource ? "text-[#027FDC] focus-visible:outline-[#027FDC]" : "text-[#027FDC] focus-visible:outline-[#027FDC]"}`}
                            aria-label={
                              dependencySource
                                ? `${milestone.title}を接続先にする`
                                : `${milestone.title}の詳細を開く。ドラッグで日付を変更`
                            }
                            title={dependencySource ? "依存線を接続" : "クリックで詳細、ドラッグで日付を変更"}
                          >
                            {/* Cap at the head of the band: the grab handle for the gate's date. */}
                            <i
                              data-gantt-milestone-diamond={milestone.id}
                              className={`h-5 border-2 border-[#027FDC] ${milestone.isBlockingMilestone ? "bg-[#027FDC]" : "bg-[#ffffff]"}`}
                              style={{ width: MILESTONE_GATE_WIDTH_PX }}
                              aria-hidden="true"
                            />
                          </button>
                          {/* Lane-spanning MS get the same permanent "+" port as a row, parked
                              clear of the diamond's own 44px drag box so neither steals the other. */}
                          {dependencyDrawingEnabled && !dependencySource && (
                            <button
                              type="button"
                              data-gantt-dependency-source={`milestone:${milestone.id}`}
                              onPointerDown={(event) => {
                                event.stopPropagation();
                                beginScheduleDependency(displayMilestone, event);
                              }}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (event.detail !== 0) return;
                                beginKeyboardScheduleDependency(displayMilestone);
                              }}
                              className="sx-gantt-dependency-port pointer-events-auto absolute -top-[5px] grid h-11 w-6 cursor-crosshair place-items-center text-[#027FDC] opacity-0 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#027FDC]"
                              style={{ left: DRAG_HIT_HEIGHT / 2, touchAction: "none" }}
                              title="ドラッグして他のタスク・MSへ依存線を引く"
                              aria-label={`${milestone.title}から依存線を開始`}
                            >
                              <Plus className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                            </button>
                          )}
                          <span
                            className={`pointer-events-none absolute top-0 flex h-[34px] max-w-[144px] items-center truncate whitespace-nowrap text-[9px] font-bold text-[#027FDC] ${markerPct >= 60 ? "right-3 pr-2 text-right" : "left-3 pl-2 text-left"}`}
                            aria-hidden="true"
                          >
                            {milestone.title}
                          </span>
                        </div>
                      ) : (
                        <button
                          key={`lane-ms-undated-${milestone.id}`}
                          type="button"
                          data-gantt-milestone-marker={milestone.id}
                          onClick={() => handleRowClick(milestone)}
                          className="absolute right-1 top-0 z-[19] flex h-[22px] max-w-[52%] items-center gap-1 px-1 text-left text-[#027FDC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#027FDC]"
                          style={{ transform: `translateX(-${index * 8}px)` }}
                          aria-label={`${milestone.title}の詳細を開く`}
                        >
                          <i className={`h-3.5 w-[6px] shrink-0 border-x-2 border-[#027FDC] ${milestone.isBlockingMilestone ? "bg-[#027FDC]" : "bg-[#ffffff]"}`} aria-hidden="true" />
                          <span className="truncate whitespace-nowrap text-[9px] font-bold">{milestone.title}｜日程未設定</span>
                        </button>
                      );
                    })}
                    <div
                      className="flex items-center justify-between gap-2 border-b border-[#cbd5e1] px-2 text-[10px]"
                      style={{ height: LANE_HEADER_H }}
                    >
                      <span className="min-w-0 truncate font-semibold text-[#027FDC]">
                        {laneMilestones.length > 0
                          ? `MS ${laneMilestones.length}件`
                          : "MSなし"}
                      </span>
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
                          className="border-b border-[#e8e8ed]"
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
                            dependencyEnabled={dependencyDrawingEnabled}
                            connectionSourceId={
                              dependencySource
                                ? sourceKey(dependencySource)
                                : null
                            }
                            onPointerDownDependency={beginScheduleDependency}
                            onKeyboardStartDependency={
                              beginKeyboardScheduleDependency
                            }
                            onCompleteDependency={(target) =>
                              void connectScheduleDependency(target)
                            }
                          />
                        </div>
                      );
                    })}
                    {canManage && projectId && !collapsed && (
                      <div
                        aria-hidden="true"
                        className="relative border-b border-[#e2e8f0] bg-[#f8fafc]/60"
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
      <div className="mt-1 hidden items-center justify-between gap-2 text-[10px] text-[#3c3c43] lg:flex">
        <span>
          {milestoneStats.undated > 0
            ? `日程未登録のMS ${milestoneStats.undated}件`
            : "全MSに日程あり"}{" "}
          · 完了MS {milestoneStats.completed}件
        </span>
        <span aria-hidden="true">↕ 上下・← 左右にスクロール →</span>
      </div>
      {pendingMilestonePoint &&
        createPortal(
          <div
            ref={milestonePromptRef}
            role="dialog"
            aria-modal="false"
            aria-label="MS追加の確認"
            className={`fixed z-[120] w-[260px] -translate-x-1/2 border border-[#d2d2d7] bg-[#ffffff] p-3 text-[#1d1d1f] shadow-[0_18px_44px_rgba(29,29,31,0.24)] ${pendingMilestonePoint.side === "above" ? "-translate-y-[calc(100%+12px)]" : "translate-y-3"}`}
            style={{
              left: pendingMilestonePoint.viewportX,
              top: pendingMilestonePoint.viewportY,
            }}
          >
            <p className="text-[11px] font-bold">MSを追加する？</p>
            <p className="mt-1 text-[10px] text-[#86868b]">
              {laneFold.labelFor(pendingMilestonePoint.laneKey)} ・ {sxFormatDate(pendingMilestonePoint.date)}
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
                className="min-h-11 border border-[#047857] bg-[#047857] px-3 text-[11px] font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]"
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
                className="min-h-11 border border-[#94a3b8] bg-[#ffffff] px-3 text-[11px] font-bold text-[#3c3c43] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#059669]"
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
