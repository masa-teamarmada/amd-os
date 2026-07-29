"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, ChevronRight, Flag, Plus } from "lucide-react";
import type { SxEcdTimelineRow, SxEcdUnifiedTimeline, SxEcdSlipKind } from "@/lib/sx-executive-control-deck";
import type { SxTask } from "@/lib/sx-management";
import { sxFormatDate, sxFormatSlip } from "./sx-visual-shared";

const MONTH_ROW_H = 24;
const PIN_ROW_H = 26;
const LANE_HEADER_H = 28;
const ROW_H = 58;
const LANE_GAP = 2;

type DisplayRow = {
  id: string;
  entity: "milestone" | "task";
  milestoneId: string;
  parentTaskId: string | null;
  depth: number;
  title: string;
  state: SxEcdTimelineRow["state"];
  slipKind: SxEcdSlipKind;
  isCritical: boolean;
  isCurrent: boolean;
  plannedStart: string | null;
  plannedEnd: string | null;
  forecastEnd: string | null;
  plannedStartPct: number | null;
  plannedEndPct: number | null;
  forecastPct: number | null;
  deltaDays: number | null;
  dateCertainty: "confirmed" | "provisional" | null;
  ownerLabel: string;
  progressPct: number;
  progressRegistered: boolean;
  hasChildren: boolean;
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

function dateToPct(date: string | null, domainStart: string, domainEnd: string) {
  if (!date) return null;
  const start = Date.parse(`${domainStart}T00:00:00.000Z`);
  const end = Date.parse(`${domainEnd}T00:00:00.000Z`);
  const value = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(value) || end <= start) return null;
  return Math.min(100, Math.max(0, ((value - start) / (end - start)) * 100));
}

function diffDays(from: string | null, to: string | null) {
  if (!from || !to) return null;
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86400000);
}

function classifyTask(task: SxTask, asOf: string, deltaDays: number | null): { state: DisplayRow["state"]; slipKind: SxEcdSlipKind } {
  if (task.status === "completed") return { state: "complete", slipKind: "none" };
  if (task.status === "blocked") return { state: "blocked", slipKind: "none" };
  if (task.plannedEnd && task.plannedEnd < asOf) return { state: "overdue", slipKind: "overdue" };
  const slipKind: SxEcdSlipKind = deltaDays != null && deltaDays > 0
    ? task.dateCertainty === "confirmed" || Boolean(task.forecastChangeReason?.trim()) ? "confirmed_slip" : "provisional_slip"
    : "none";
  if (task.status === "unassessed") return { state: "unassessed", slipKind };
  if (task.status === "attention" || task.status === "at_risk") return { state: "attention", slipKind };
  return { state: task.progressPct > 0 ? "current" : "future", slipKind };
}

function milestoneDisplayRow(row: SxEcdTimelineRow, hasChildren: boolean): DisplayRow {
  return {
    id: row.milestoneId,
    entity: "milestone",
    milestoneId: row.milestoneId,
    parentTaskId: null,
    depth: 0,
    title: row.title,
    state: row.state,
    slipKind: row.slipKind,
    isCritical: row.isCritical,
    isCurrent: row.isCurrent,
    plannedStart: row.plannedStart,
    plannedEnd: row.plannedEnd,
    forecastEnd: row.forecastEnd,
    plannedStartPct: row.plannedStartPct,
    plannedEndPct: row.plannedEndPct,
    forecastPct: row.forecastPct,
    deltaDays: row.deltaDays,
    dateCertainty: row.dateCertainty,
    ownerLabel: row.ownerLabel,
    progressPct: row.progressPct,
    progressRegistered: row.state !== "unassessed",
    hasChildren,
  };
}

function taskDisplayRow(task: SxTask, depth: number, hasChildren: boolean, timeline: SxEcdUnifiedTimeline, asOf: string): DisplayRow {
  const deltaDays = diffDays(task.plannedEnd, task.forecastEnd);
  const classified = classifyTask(task, asOf, deltaDays);
  return {
    id: task.id,
    entity: "task",
    milestoneId: task.milestoneId,
    parentTaskId: task.parentTaskId,
    depth,
    title: task.title,
    state: classified.state,
    slipKind: classified.slipKind,
    isCritical: false,
    isCurrent: classified.state === "current",
    plannedStart: task.plannedStart,
    plannedEnd: task.plannedEnd,
    forecastEnd: task.forecastEnd,
    plannedStartPct: dateToPct(task.plannedStart, timeline.domainStart, timeline.domainEnd),
    plannedEndPct: dateToPct(task.plannedEnd, timeline.domainStart, timeline.domainEnd),
    forecastPct: dateToPct(task.forecastEnd, timeline.domainStart, timeline.domainEnd),
    deltaDays,
    dateCertainty: task.dateCertainty,
    ownerLabel: task.ownerLabel,
    progressPct: task.progressPct,
    progressRegistered: task.status !== "unassessed",
    hasChildren,
  };
}

function rowCenterY(lanes: Array<{ rows: DisplayRow[] }>, laneIndex: number, rowIndex: number) {
  let y = 0;
  for (let index = 0; index < laneIndex; index += 1) y += LANE_HEADER_H + lanes[index].rows.length * ROW_H + LANE_GAP;
  return y + LANE_HEADER_H + rowIndex * ROW_H + ROW_H / 2;
}

function lanesTotalHeight(lanes: Array<{ rows: DisplayRow[] }>) {
  return lanes.reduce((sum, lane) => sum + LANE_HEADER_H + lane.rows.length * ROW_H + LANE_GAP, 0);
}

function deltaText(row: DisplayRow) {
  if (row.slipKind === "provisional_slip") return row.deltaDays != null ? `${row.deltaDays > 0 ? "+" : ""}${row.deltaDays}日（仮）` : "未算定";
  return sxFormatSlip(row.deltaDays, row.slipKind);
}

function RowBar({ row, accent, selected, onSelect }: { row: DisplayRow; accent: string; selected: boolean; onSelect: () => void }) {
  const barStart = row.plannedStartPct ?? row.plannedEndPct ?? row.forecastPct ?? 0;
  const plannedEnd = row.plannedEndPct;
  const forecast = row.forecastPct;
  const slipEnd = forecast != null && plannedEnd != null && forecast > plannedEnd ? forecast : null;
  const provisional = row.dateCertainty === "provisional";
  const slipTone = row.slipKind === "overdue" ? "#b5533f" : row.slipKind === "confirmed_slip" ? "#c99a4b" : "#aaa398";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative block h-full w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] ${selected ? "bg-[#e8f2eb]/70" : "hover:bg-[#f8f5ec]/70"}`}
      aria-label={`${row.title}の詳細を開く`}
    >
      {plannedEnd != null && (
        <span className="absolute top-[19px] h-[10px] overflow-hidden rounded-sm border" style={{ left: `${barStart}%`, width: `${Math.max(plannedEnd - barStart, 0.5)}%`, borderColor: `${accent}99`, background: `${accent}${provisional ? "24" : "3d"}` }}>
          {row.progressRegistered && row.progressPct > 0 && <span className="absolute inset-y-0 left-0" style={{ width: `${row.progressPct}%`, background: accent }} />}
        </span>
      )}
      {plannedEnd != null && <span className="absolute top-[15px] h-[18px] w-[2px] bg-[#514e47]" style={{ left: `${plannedEnd}%` }} />}
      {slipEnd != null && <span className="absolute top-[23px] h-[3px]" style={{ left: `${plannedEnd ?? barStart}%`, width: `${Math.max(slipEnd - (plannedEnd ?? barStart), 0.3)}%`, background: slipTone }} />}
      {forecast != null && <span className="absolute top-[18px] h-[10px] w-[10px] -translate-x-1/2 rotate-45 border-[1.5px]" style={{ left: `${forecast}%`, borderColor: accent, background: provisional ? "#fffdf7" : accent }} />}
      <span className="absolute inset-x-1 bottom-1 flex items-center gap-2 overflow-hidden whitespace-nowrap text-[10px] font-semibold text-[#69665d]">
        <span>予定 {sxFormatDate(row.plannedEnd).slice(5)}</span>
        <span className={row.progressRegistered ? "text-[#315f7d]" : "text-[#765022]"}>進捗 {row.progressRegistered ? `${row.progressPct}%` : "未登録"}</span>
        <span>予測 {sxFormatDate(row.forecastEnd).slice(5)}</span>
        <span className={row.slipKind === "overdue" ? "text-[#8c3329]" : row.slipKind === "confirmed_slip" ? "text-[#765022]" : "text-[#77726a]"}>差 {deltaText(row)}</span>
      </span>
    </button>
  );
}

function Legend() {
  return (
    <div className="mb-2 grid gap-px border border-[#d6cebf] bg-[#d6cebf] text-[10px] text-[#514e47] sm:grid-cols-2 xl:grid-cols-5" aria-label="ガントの読み方">
      <div className="flex min-h-11 items-center gap-2 bg-[#fffdf7] px-2"><span className="h-2.5 w-10 rounded-sm border border-[#7da18f] bg-[#dceae2]" /><span><b>計画期間</b><br />薄いバー</span></div>
      <div className="flex min-h-11 items-center gap-2 bg-[#fffdf7] px-2"><span className="h-2.5 w-10 rounded-sm bg-[#38745d]" /><span><b>完了した範囲</b><br />濃い塗り・進捗率</span></div>
      <div className="flex min-h-11 items-center gap-2 bg-[#fffdf7] px-2"><span className="h-5 w-0.5 bg-[#514e47]" /><span><b>計画完了日</b><br />縦線</span></div>
      <div className="flex min-h-11 items-center gap-2 bg-[#fffdf7] px-2"><span className="h-3 w-3 rotate-45 border-2 border-[#38745d] bg-[#fffdf7]" /><span><b>完了見込み日</b><br />ひし形</span></div>
      <div className="flex min-h-11 items-center gap-2 bg-[#fffdf7] px-2"><span className="flex items-center"><i className="h-0.5 w-8 bg-[#aaa398]" /><i className="h-2.5 w-2.5 rotate-45 border border-[#77726a] bg-[#fffdf7]" /></span><span><b>予定→見込みの差</b><br />進捗ではない</span></div>
    </div>
  );
}

export function SxUnifiedTimeline({
  timeline,
  asOf,
  selectedMilestoneId,
  selectedTaskId = null,
  tasks = [],
  onSelectMilestone,
  onSelectTask = () => {},
  canManage,
  onEditMilestone,
  onCreateMilestone,
  onEditTask = () => {},
  onCreateTask = () => {},
  showPins = true,
}: {
  timeline: SxEcdUnifiedTimeline;
  asOf: string;
  selectedMilestoneId: string | null;
  selectedTaskId?: string | null;
  tasks?: SxTask[];
  onSelectMilestone: (milestoneId: string | null) => void;
  onSelectTask?: (taskId: string | null) => void;
  canManage: boolean;
  onEditMilestone: (milestoneId: string) => void;
  onCreateMilestone: (track: string | null) => void;
  onEditTask?: (taskId: string) => void;
  onCreateTask?: (milestoneId: string, parentTaskId: string | null) => void;
  showPins?: boolean;
}) {
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(() => new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => new Set());
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const taskChildren = useMemo(() => {
    const map = new Map<string, SxTask[]>();
    for (const task of tasks) {
      const key = task.parentTaskId || `milestone:${task.milestoneId}`;
      map.set(key, [...(map.get(key) || []), task]);
    }
    for (const children of map.values()) children.sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));
    return map;
  }, [tasks]);

  const visibleLanes = useMemo(() => timeline.lanes.map((lane) => {
    const rows: DisplayRow[] = [];
    const appendChildren = (milestoneId: string, parentTaskId: string | null, depth: number) => {
      const key = parentTaskId || `milestone:${milestoneId}`;
      for (const task of taskChildren.get(key) || []) {
        const children = taskChildren.get(task.id) || [];
        rows.push(taskDisplayRow(task, depth, children.length > 0, timeline, asOf));
        if (children.length > 0 && expandedTasks.has(task.id)) appendChildren(milestoneId, task.id, depth + 1);
      }
    };
    for (const milestone of lane.rows) {
      const children = taskChildren.get(`milestone:${milestone.milestoneId}`) || [];
      rows.push(milestoneDisplayRow(milestone, children.length > 0));
      if (children.length > 0 && expandedMilestones.has(milestone.milestoneId)) appendChildren(milestone.milestoneId, null, 1);
    }
    return { lane, rows };
  }), [asOf, expandedMilestones, expandedTasks, taskChildren, timeline]);

  if (!timeline.valid) {
    return <p className="border border-dashed border-[#b5533f] bg-[#f9e4e1] px-3 py-3 text-[11px] font-semibold text-[#8c3329]" data-testid="sx-unified-timeline">{timeline.reason}</p>;
  }

  const hasAnyChildren = taskChildren.size > 0;
  const allExpanded = hasAnyChildren && timeline.lanes.every((lane) => lane.rows.every((row) => !taskChildren.has(`milestone:${row.milestoneId}`) || expandedMilestones.has(row.milestoneId))) && tasks.every((task) => !taskChildren.has(task.id) || expandedTasks.has(task.id));
  const lanesHeight = lanesTotalHeight(visibleLanes);
  const pinRowHeight = showPins ? PIN_ROW_H : 0;
  const gridHeight = pinRowHeight + lanesHeight;
  const criticalPolyline = timeline.criticalPoints.flatMap((point) => {
    const laneIndex = visibleLanes.findIndex(({ lane }) => lane.key === timeline.lanes[point.laneIndex]?.key);
    if (laneIndex < 0) return [];
    const rowIndex = visibleLanes[laneIndex].rows.findIndex((row) => row.entity === "milestone" && timeline.lanes[point.laneIndex]?.rows[point.rowIndex]?.milestoneId === row.id);
    return rowIndex < 0 ? [] : [{ x: point.pct, y: pinRowHeight + rowCenterY(visibleLanes, laneIndex, rowIndex) }];
  });

  function toggleAll() {
    if (allExpanded) {
      setExpandedMilestones(new Set());
      setExpandedTasks(new Set());
    } else {
      setExpandedMilestones(new Set(timeline.lanes.flatMap((lane) => lane.rows.map((row) => row.milestoneId))));
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
        document.querySelector<HTMLElement>(`[data-plan-row="${row.entity}:${row.id}"]`)?.scrollIntoView({ block: "start" });
      });
    }
  }

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || null;
  const createUnderMilestoneId = selectedTask?.milestoneId || selectedMilestoneId;

  return (
    <div data-testid="sx-unified-timeline">
      <Legend />
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {canManage && <button type="button" onClick={() => onCreateMilestone(null)} className="inline-flex min-h-11 items-center gap-1 border border-[#315f7d] bg-[#315f7d] px-3 text-[11px] font-bold text-white"><Plus className="h-3.5 w-3.5" />工程</button>}
        {canManage && <button type="button" disabled={!createUnderMilestoneId} onClick={() => createUnderMilestoneId && onCreateTask(createUnderMilestoneId, selectedTask?.id || null)} className="inline-flex min-h-11 items-center gap-1 border border-[#bfc8c2] bg-[#fffdf7] px-3 text-[11px] font-bold text-[#205f49] disabled:cursor-not-allowed disabled:opacity-45"><Plus className="h-3.5 w-3.5" />{selectedTask ? "子タスク" : "タスク"}</button>}
        <button type="button" disabled={!hasAnyChildren} onClick={toggleAll} className="inline-flex min-h-11 items-center gap-1 border border-[#d6cebf] bg-[#fffdf7] px-3 text-[11px] font-semibold text-[#514e47] disabled:cursor-not-allowed disabled:opacity-45">{allExpanded ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}{allExpanded ? "すべて閉じる" : "すべて展開"}</button>
        <button type="button" onClick={() => { const node = scrollerRef.current; if (node) node.scrollTo({ left: Math.max(0, (node.scrollWidth - node.clientWidth) * timeline.todayPct / 100 - node.clientWidth * 0.5), behavior: "smooth" }); }} className="min-h-11 border border-[#d6cebf] bg-[#fffdf7] px-3 text-[11px] font-semibold text-[#514e47]">今日へ</button>
        <span className="ml-auto text-[10px] text-[#777166]">横に動かせるよ <span aria-hidden="true">↔</span></span>
      </div>

      <div ref={scrollerRef} className="relative overflow-x-auto overscroll-x-contain border border-[#d6cebf] bg-[#fffdf7] shadow-[inset_-14px_0_12px_-14px_rgba(36,35,31,0.42)]" tabIndex={0} aria-label="ガントチャート。左右にスクロールできる">
        <div className="min-w-[1080px]">
          <div className="grid grid-cols-[minmax(275px,320px)_minmax(0,1fr)] items-end" style={{ height: MONTH_ROW_H }}>
            <p className="sticky left-0 z-30 bg-[#fffdf7] px-2 text-[9px] font-semibold tracking-[0.1em] text-[#777166]">工程 / タスク</p>
            <div className="relative h-full">
              {timeline.months.map((month) => <span key={month.pct} className={`absolute bottom-1 pl-1 text-[9px] ${month.isYearStart ? "font-bold text-[#24231f]" : "text-[#777166]"}`} style={{ left: `${month.pct}%` }}>{month.label}</span>)}
              {timeline.objectivePct != null && <span className="absolute bottom-0 z-10 flex -translate-x-full items-center gap-0.5 whitespace-nowrap pr-1 text-[9px] font-bold text-[#5f4a66]" style={{ left: `${timeline.objectivePct}%` }}><Flag className="h-3 w-3" />設立 {sxFormatDate(timeline.objectiveDate)}</span>}
            </div>
          </div>

          <div className="grid grid-cols-[minmax(275px,320px)_minmax(0,1fr)]">
            <div className="sticky left-0 z-30 border-r border-[#d6cebf] bg-[#fffdf7]">
              {showPins && <div className="flex items-center border-b border-[#e8e2d6] px-2 text-[9px] font-semibold text-[#69665d]" style={{ height: PIN_ROW_H }}>介入の期限</div>}
              {visibleLanes.map(({ lane, rows }) => <div key={lane.key} style={{ marginBottom: LANE_GAP }}>
                <div className="flex items-center gap-1.5 border-b border-[#d6cebf] px-2" style={{ height: LANE_HEADER_H }}><span className="h-2.5 w-2.5" style={{ background: lane.accent }} /><span className="text-[10px] font-bold text-[#24231f]">{lane.label}</span><span className="text-[10px] text-[#777166]">工程 {lane.rows.length} / タスク {tasks.filter((task) => task.track === lane.key || (!task.track && lane.rows.some((row) => row.milestoneId === task.milestoneId))).length}</span></div>
                {rows.map((row) => {
                  const selected = row.entity === "milestone" ? selectedMilestoneId === row.id : selectedTaskId === row.id;
                  const expanded = row.entity === "milestone" ? expandedMilestones.has(row.id) : expandedTasks.has(row.id);
                  return <div key={`${row.entity}-${row.id}`} data-plan-row={`${row.entity}:${row.id}`} className={`group relative flex scroll-mt-3 border-b border-[#f1eee5] ${selected ? "bg-[#e8f2eb]" : "hover:bg-[#f8f5ec]"}`} style={{ height: ROW_H, paddingLeft: row.depth * 15 }}>
                    <button
                      type="button"
                      disabled={!row.hasChildren}
                      onClick={() => {
                        if (!row.hasChildren) return;
                        const update = (current: Set<string>) => { const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; };
                        if (row.entity === "milestone") setExpandedMilestones(update); else setExpandedTasks(update);
                      }}
                      className={`flex w-8 shrink-0 items-center justify-center text-[#69665d] ${row.hasChildren ? "" : "opacity-0"}`}
                      aria-label={expanded ? `${row.title}を折りたたむ` : `${row.title}を展開する`}
                    ><ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} /></button>
                    <button type="button" onClick={() => select(row)} className={`min-w-0 flex-1 px-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] ${row.isCritical ? "border-l-[3px] border-[#24231f]" : ""}`} aria-pressed={selected}>
                      <span className="flex items-center gap-1"><b className={`truncate text-[10px] ${row.entity === "task" ? "font-medium" : "font-bold"}`}>{row.title}</b>{row.entity === "task" && <i className="shrink-0 border border-[#d6cebf] px-1 text-[8px] not-italic text-[#69665d]">タスク</i>}{row.isCurrent && <i className="shrink-0 bg-[#38745d] px-1 text-[8px] not-italic text-white">進行中</i>}</span>
                      <span className="mt-1 flex items-center gap-2 overflow-hidden whitespace-nowrap text-[10px] text-[#777166]"><em className="not-italic">{ROW_STATE_TEXT[row.state]}</em><span>{row.ownerLabel}</span><span className={row.progressRegistered ? "text-[#315f7d]" : "text-[#765022]"}>進捗 {row.progressRegistered ? `${row.progressPct}%` : "未登録"}</span></span>
                    </button>
                    {canManage && <button type="button" onClick={() => row.entity === "milestone" ? onEditMilestone(row.id) : onEditTask(row.id)} className="mr-1 hidden min-w-11 items-center justify-center text-[10px] font-semibold text-[#315f7d] underline underline-offset-2 group-hover:flex focus-visible:flex">編集</button>}
                  </div>;
                })}
              </div>)}
            </div>

            <div className="relative" style={{ height: gridHeight }}>
              {timeline.months.map((month) => <span key={`grid-${month.pct}`} className={`absolute top-0 w-px ${month.isYearStart ? "bg-[#cfc7b9]" : "bg-[#eee9df]"}`} style={{ left: `${month.pct}%`, height: gridHeight }} />)}
              {timeline.objectivePct != null && <span className="absolute top-0 border-l-2 border-dotted border-[#76637b]" style={{ left: `${timeline.objectivePct}%`, height: gridHeight }} />}
              <span className="absolute top-0 z-10 w-[2px] bg-[#24231f]" style={{ left: `${timeline.todayPct}%`, height: gridHeight }} />
              <span className="absolute z-20 -translate-x-1/2 bg-[#24231f] px-1 py-px text-[8px] font-bold text-white" style={{ left: `${timeline.todayPct}%`, top: -1 }}>今日 {sxFormatDate(asOf).slice(5)}</span>

              {criticalPolyline.length >= 2 && <svg className="pointer-events-none absolute inset-0 z-[5]" width="100%" height={gridHeight} preserveAspectRatio="none" viewBox={`0 0 100 ${gridHeight}`} aria-label="重要経路"><polyline points={criticalPolyline.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#24231f" strokeWidth="1.1" strokeDasharray="3 2.2" vectorEffect="non-scaling-stroke" /></svg>}

              {showPins && <div className="absolute inset-x-0 top-0 border-b border-[#e8e2d6]" style={{ height: PIN_ROW_H }}>{timeline.pins.map((pin) => <span key={pin.key} tabIndex={0} role="button" onMouseEnter={() => setHoveredPin(pin.key)} onMouseLeave={() => setHoveredPin(null)} onFocus={() => setHoveredPin(pin.key)} onBlur={() => setHoveredPin(null)} className={`absolute top-1/2 z-20 flex h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold ${pin.side === "partner" ? "bg-[#bf7b2c] text-white" : pin.side === "unknown" ? "border-2 border-[#24231f] bg-[#fffdf7]" : "bg-[#24231f] text-white"}`} style={{ left: `${pin.duePct}%` }}>{pin.rank}{hoveredPin === pin.key && <span className="absolute top-6 z-30 w-[220px] border border-[#d6cebf] bg-[#fffdf7] p-2 text-left text-[10px] text-[#514e47] shadow-lg"><b className="block text-[#24231f]">{pin.target}</b>担当 {pin.ballOwner}<br />期限 {pin.dueDate}</span>}</span>)}</div>}

              <div className="absolute inset-x-0" style={{ top: pinRowHeight }}>
                {visibleLanes.map(({ lane, rows }) => <div key={lane.key} style={{ marginBottom: LANE_GAP }}>
                  <div className="flex items-center border-b border-[#d6cebf] px-2 text-[10px] text-[#8c3329]" style={{ height: LANE_HEADER_H }}>{lane.maxIssue ? `詰まり: ${lane.maxIssue}` : ""}</div>
                  {rows.map((row) => <div key={`${row.entity}-${row.id}`} className="border-b border-[#f1eee5]" style={{ height: ROW_H }}><RowBar row={row} accent={lane.accent} selected={row.entity === "milestone" ? selectedMilestoneId === row.id : selectedTaskId === row.id} onSelect={() => select(row)} /></div>)}
                </div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[#777166]"><span>{timeline.undatedCount > 0 ? `日程未登録の工程 ${timeline.undatedCount}件` : "全工程に日程あり"} · 完了工程 {timeline.completedCount}件</span><span aria-hidden="true">← 左右にスクロール →</span></div>
    </div>
  );
}
