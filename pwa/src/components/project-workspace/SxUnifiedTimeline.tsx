"use client";

import { useMemo, useRef, useState } from "react";
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
  SxManagementMilestone,
  SxTask,
} from "@/lib/sx-management";
import {
  sxGateRequirementCounts,
  sxGateRequirementState,
  sxGateRequirementsBySuccessor,
  sxIsBlockingMilestone,
  sxMilestoneRequiredTaskSummary,
  type SxGateRequirement,
} from "@/lib/sx-gate-requirements";
import { sxFormatDate } from "./sx-visual-shared";

const MONTH_ROW_H = 24;
const PIN_ROW_H = 26;
const LANE_HEADER_H = 28;
const ROW_H = 68;
const LANE_GAP = 2;

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

const FOUNDING_LANE_KEY = "founding-prerequisites";
const FOUNDING_LANE_META: LaneMeta = {
  key: FOUNDING_LANE_KEY,
  label: "設立前提",
  shortLabel: "前提",
  accent: "#5f4a66",
  maxIssue: "",
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

function lanesTotalHeight(lanes: Array<{ rows: DisplayRow[] }>) {
  return lanes.reduce(
    (sum, lane) => sum + LANE_HEADER_H + lane.rows.length * ROW_H + LANE_GAP,
    0,
  );
}

function RowBar({
  row,
  accent,
  selected,
  onSelect,
}: {
  row: DisplayRow;
  accent: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const barStart = row.plannedStartPct ?? row.plannedEndPct ?? 0;
  const plannedEnd = row.plannedEndPct;
  const hasBar = plannedEnd != null;
  const provisional = row.dateCertainty === "provisional";
  const counts = sxGateRequirementCounts(row.requirements);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative block h-full w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] ${selected ? "bg-[#e8f2eb]/70" : "hover:bg-[#f8f5ec]/70"}`}
      aria-label={`${row.title}の詳細を開く`}
    >
      {hasBar && (
        <span
          className="absolute top-[23px] h-[10px] overflow-hidden rounded-sm border"
          style={{
            left: `${barStart}%`,
            width: `${Math.max(plannedEnd - barStart, 0.5)}%`,
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
      {hasBar && row.isBlockingMilestone && (
        <span
          className="absolute top-[13px] -translate-x-1/2 text-center"
          style={{ left: `${plannedEnd}%` }}
        >
          <i
            className="mx-auto block h-4 w-4 rotate-45 border-2 border-[#5f4a66] bg-[#fffdf7]"
            aria-hidden="true"
          />
          <em className="mt-0.5 block whitespace-nowrap text-[8px] font-bold not-italic text-[#5f4a66]">
            マイルストーン
          </em>
        </span>
      )}
      {/* 日程未設定の行（設立前提の2件）は帯の代わりに、状態・達成連鎖・必須タスクの完了数と
          次の未完了タスクをこの同じ行の右側テキストで示す。日付を捏造しない。 */}
      {!hasBar && row.requiredTaskSummary && (
        <span className="absolute inset-x-1 top-1 truncate text-[10px] font-semibold text-[#5f4a66]">
          必須タスク {row.requiredTaskSummary.completed}/
          {row.requiredTaskSummary.total}
          {row.requiredTaskSummary.total === 0
            ? "（未登録）"
            : row.requiredTaskSummary.nextIncompleteTitle
              ? ` ・ 次：${row.requiredTaskSummary.nextIncompleteTitle}`
              : " ・ 全完了"}
        </span>
      )}
      <span className="absolute inset-x-1 bottom-1 flex flex-wrap items-center gap-2 overflow-hidden whitespace-nowrap text-[10px] font-semibold text-[#69665d]">
        {hasBar ? (
          <>
            <span>予定 {sxFormatDate(row.plannedEnd).slice(5)}</span>
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
          </>
        ) : (
          <span>日程未設定・{ROW_STATE_TEXT[row.state]}</span>
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
    </button>
  );
}

function Legend() {
  return (
    <div
      className="mb-2 grid gap-px border border-[#d6cebf] bg-[#d6cebf] text-[10px] text-[#514e47] sm:grid-cols-3"
      aria-label="ガントの読み方"
    >
      <div className="flex min-h-11 items-center gap-2 bg-[#fffdf7] px-2">
        <span className="h-2.5 w-10 rounded-sm border border-[#7da18f] bg-[#dceae2]" />
        <span>
          <b>計画期間</b>
          <br />
          薄いバー
        </span>
      </div>
      <div className="flex min-h-11 items-center gap-2 bg-[#fffdf7] px-2">
        <span className="h-2.5 w-10 rounded-sm bg-[#38745d]" />
        <span>
          <b>実績</b>
          <br />
          濃い塗り・進捗率
        </span>
      </div>
      <div className="flex min-h-11 items-center gap-2 bg-[#fffdf7] px-2">
        <span className="h-3 w-3 rotate-45 border-2 border-[#5f4a66] bg-[#fffdf7]" />
        <span>
          <b>マイルストーン</b>
          <br />
          先へ進む条件
        </span>
      </div>
    </div>
  );
}

export function SxUnifiedTimeline({
  timeline,
  asOf,
  selectedMilestoneId,
  selectedTaskId = null,
  milestones = [],
  dependencies = [],
  tasks = [],
  onSelectMilestone,
  onSelectTask = () => {},
  canManage,
  onCreateMilestone,
  onCreateTask = () => {},
  showPins = true,
}: {
  timeline: SxEcdUnifiedTimeline;
  asOf: string;
  selectedMilestoneId: string | null;
  selectedTaskId?: string | null;
  milestones?: SxManagementMilestone[];
  dependencies?: SxDependency[];
  tasks?: SxTask[];
  onSelectMilestone: (milestoneId: string | null) => void;
  onSelectTask?: (taskId: string | null) => void;
  canManage: boolean;
  onEditMilestone?: (milestoneId: string) => void;
  onCreateMilestone: (track: string | null) => void;
  onEditTask?: (taskId: string) => void;
  onCreateTask?: (milestoneId: string, parentTaskId: string | null) => void;
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

  // 設立前提の2件も通常レーンと同じ左右2列パイプラインへ統合する。ガント外の独立sectionは
  // 廃止済み — timeline全体が無効（日程付きマイルストーン0件）でもこのレーンだけは描く。
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

    const lanes: Array<{ lane: LaneMeta; rows: DisplayRow[] }> = [];

    if (blockingMilestones.length > 0) {
      const rows: DisplayRow[] = [];
      for (const milestone of blockingMilestones) {
        const children = taskChildren.get(`milestone:${milestone.id}`) || [];
        rows.push(
          blockingMilestoneRow(milestone, children.length > 0, tasks, timeline),
        );
        if (children.length > 0 && expandedMilestones.has(milestone.id))
          appendTaskChildren(milestone.id, rows, null, 1);
      }
      lanes.push({ lane: FOUNDING_LANE_META, rows });
    }

    for (const lane of timeline.lanes) {
      const rows: DisplayRow[] = [];
      for (const milestone of lane.rows) {
        // 設立前提の2件は専用レーンだけに表示し、通常の柱レーンでは二重表示しない。
        const definition = milestoneById.get(milestone.milestoneId);
        if (definition && sxIsBlockingMilestone(definition)) continue;
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
      }
      lanes.push({ lane, rows });
    }

    return lanes;
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
  const lanesHeight = lanesTotalHeight(visibleLanes);
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

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || null;
  const createUnderMilestoneId =
    selectedTask?.milestoneId || selectedMilestoneId;

  return (
    <div data-testid="sx-unified-timeline">
      {!timeline.valid && (
        <p className="mb-2 border border-dashed border-[#b5533f] bg-[#f9e4e1] px-3 py-2 text-[11px] font-semibold text-[#8c3329]">
          {timeline.reason}
          {blockingMilestones.length > 0 &&
            "。設立前提レーンは日程未設定でも下に表示するよ。"}
        </p>
      )}
      <div className="hidden lg:block">
        <Legend />
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {canManage && (
          <button
            type="button"
            onClick={() => onCreateMilestone(null)}
            className="inline-flex min-h-11 items-center gap-1 border border-[#315f7d] bg-[#315f7d] px-3 text-[11px] font-bold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            工程
          </button>
        )}
        {canManage && (
          <button
            type="button"
            disabled={!createUnderMilestoneId}
            onClick={() =>
              createUnderMilestoneId &&
              onCreateTask(createUnderMilestoneId, selectedTask?.id || null)
            }
            className="inline-flex min-h-11 items-center gap-1 border border-[#bfc8c2] bg-[#fffdf7] px-3 text-[11px] font-bold text-[#205f49] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Plus className="h-3.5 w-3.5" />
            {selectedTask ? "子タスク" : "タスク"}
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
                          <b className="text-[11px] text-[#24231f]">
                            {row.title}
                          </b>
                          <i className="border border-[#c9bfd0] bg-[#f1edf3] px-1 text-[8px] not-italic text-[#5f4a66]">
                            {row.isBlockingMilestone
                              ? "マイルストーン"
                              : row.entity === "milestone"
                                ? "工程"
                                : "タスク"}
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
                  style={{ left: `${month.pct}%` }}
                >
                  {month.label}
                </span>
              ))}
              {timeline.objectivePct != null && (
                <span
                  className="absolute bottom-0 z-10 flex -translate-x-full items-center gap-0.5 whitespace-nowrap pr-1 text-[9px] font-bold text-[#5f4a66]"
                  style={{ left: `${timeline.objectivePct}%` }}
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
                          className={`flex w-8 shrink-0 items-center justify-center text-[#69665d] ${row.hasChildren ? "" : "opacity-0"}`}
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
                              {row.isBlockingMilestone
                                ? "マイルストーン"
                                : row.entity === "milestone"
                                  ? "工程"
                                  : "タスク"}
                            </i>
                            {row.isCurrent && (
                              <i className="shrink-0 bg-[#38745d] px-1 text-[8px] not-italic text-white">
                                進行中
                              </i>
                            )}
                          </span>
                          <span className="mt-1 flex items-center gap-2 overflow-hidden whitespace-nowrap text-[10px] text-[#777166]">
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
                </div>
              ))}
            </div>

            <div className="relative" style={{ height: gridHeight }}>
              {timeline.months.map((month) => (
                <span
                  key={`grid-${month.pct}`}
                  className={`absolute top-0 w-px ${month.isYearStart ? "bg-[#cfc7b9]" : "bg-[#eee9df]"}`}
                  style={{ left: `${month.pct}%`, height: gridHeight }}
                />
              ))}
              {timeline.objectivePct != null && (
                <span
                  className="absolute top-0 w-[2px] bg-[#76637b]/45"
                  style={{
                    left: `${timeline.objectivePct}%`,
                    height: gridHeight,
                  }}
                />
              )}
              <span
                className="absolute top-0 z-10 w-[2px] bg-[#24231f]"
                style={{ left: `${timeline.todayPct}%`, height: gridHeight }}
              />
              <span
                className="absolute z-20 -translate-x-1/2 bg-[#24231f] px-1 py-px text-[8px] font-bold text-white"
                style={{ left: `${timeline.todayPct}%`, top: -1 }}
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
                      style={{ left: `${pin.duePct}%` }}
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
                    {rows.map((row) => (
                      <div
                        key={`${row.entity}-${row.id}`}
                        className="border-b border-[#f1eee5]"
                        style={{ height: ROW_H }}
                      >
                        <RowBar
                          row={row}
                          accent={lane.accent}
                          selected={
                            row.entity === "milestone"
                              ? selectedMilestoneId === row.id
                              : selectedTaskId === row.id
                          }
                          onSelect={() => select(row)}
                        />
                      </div>
                    ))}
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
    </div>
  );
}
