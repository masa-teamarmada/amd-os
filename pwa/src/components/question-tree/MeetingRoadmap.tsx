"use client";

import { Fragment, useMemo, useState, type ReactNode, type RefObject } from "react";
import { projectRoadmapWork, type RoadmapWorkItem, type ProjectGanttRoadmap, type WorkRange } from "@/lib/project-gantt-roadmap";
import type { ActionNode, QuestionNode } from "@/lib/question-tree-types";
import { diffDays } from "@/lib/sx-gantt-drag";
import styles from "./meeting-roadmap.module.css";
import treeStyles from "./question-tree.module.css";

export function MeetingRoadmap({ roadmap, roots, asOf, renderActionLane, onSelect, axisRef, bodyRef, onExpand, dependencyLayer }: {
  roadmap: ProjectGanttRoadmap;
  roots: QuestionNode[];
  asOf: string;
  renderActionLane: (action: ActionNode) => ReactNode;
  onSelect: (kind: "action" | "question", id: string) => void;
  axisRef: RefObject<HTMLDivElement | null>;
  bodyRef: RefObject<HTMLDivElement | null>;
  onExpand: () => void;
  dependencyLayer: ReactNode;
}) {
  const [expanded, setExpanded] = useState(new Set<string>());
  const work = useMemo(() => projectRoadmapWork(roots, roadmap), [roots, roadmap]);
  const days = diffDays(work.start, work.end) + 1;
  const pct = (date: string) => diffDays(work.start, date) / days * 100;
  const width = (start: string, end: string) => (diffDays(start, end) + 1) / days * 100;
  const months: { start: string; end: string; label: string }[] = [];
  for (let year = Number(work.start.slice(0, 4)); year <= Number(work.end.slice(0, 4)); year++) {
    for (let month = 1; month <= 12; month++) {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      if (end < work.start || start > work.end) continue;
      months.push({ start, end, label: `${month}月` });
    }
  }
  const toggle = (id: string) => {
    setExpanded(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    onExpand();
  };
  const dateLabel = (range: WorkRange | null) => range
    ? `${range.start.slice(2)}${range.start === range.end ? "" : ` 〜 ${range.end.slice(2)}`}`
    : "日程未設定";
  const grid = () => months.map(month => <span key={month.start} className={styles.gridLine} style={{ left: `${pct(month.start)}%` }} />);
  const summaryBar = (range: WorkRange | null, title: string, activate: () => void, milestone = false) => (
    <div className={`${treeStyles.lane} ${styles.timeline}`}>
      {grid()}
      {range ? <button type="button" className={milestone ? styles.milestone : styles.summaryBar}
        aria-label={`${title}：${dateLabel(range)}`} title={`${title}：${dateLabel(range)}`}
        onClick={activate} style={{ left: `${pct(range.start)}%`, width: milestone ? undefined : `${Math.max(width(range.start, range.end), .6)}%` }}>
        {milestone ? "◆" : null}
      </button> : <span className={styles.noDate}>日程未設定</span>}
    </div>
  );
  const renderWork = (item: RoadmapWorkItem, depth = 1): ReactNode => <Fragment key={`${item.kind}-${item.id}`}>
    <div className={styles.row} data-work-kind={item.kind} data-work-id={item.id} data-start={item.range?.start} data-end={item.range?.end}>
      <div className={styles.lead} style={{ paddingLeft: 12 + Math.min(depth, 4) * 16 }}>
        {item.children.length > 0 ? <button type="button" className={styles.toggle} aria-label={`${item.title}の子タスク`} aria-expanded={expanded.has(item.id)} onClick={() => toggle(item.id)}>{expanded.has(item.id) ? "▾" : "▸"}</button> : <span className={styles.toggleSpace} />}
        <div className={styles.label}>
          <button type="button" className={styles.title} onClick={() => onSelect(item.kind === "task" ? "action" : "question", item.id)}>{item.title}</button>
          <span className={styles.meta}>{item.kind === "milestone" ? "MS" : "タスク"} · {dateLabel(item.range)}</span>
        </div>
      </div>
      {item.action && !item.children.length && item.range
        ? <div className={styles.actionTimeline}>{grid()}{renderActionLane(item.action)}</div>
        : summaryBar(item.range, item.title, () => onSelect(item.kind === "task" ? "action" : "question", item.id), item.kind === "milestone" && !item.children.length)}
    </div>
    {expanded.has(item.id) && item.children.map(child => renderWork(child, depth + 1))}
  </Fragment>;
  return <div className={styles.roadmap} data-testid="meeting-roadmap">
    <div className={styles.toolbar}>
      <span>工程・MS・タスク</span>
      <button type="button" className={treeStyles.btn} onClick={() => { setExpanded(new Set()); onExpand(); }}>詳細を折り畳む</button>
    </div>
    <p className={styles.scrollHint}>日程は左右にスクロール</p>
    <div className={styles.scroll} role="region" aria-label="工程ガント（横スクロール）" tabIndex={0}>
      <div className={styles.chart}>
        <div className={styles.header}>
          <div className={styles.headLead}>名前・日程</div>
          <div className={styles.axis} ref={axisRef}>
            {[...new Set(months.map(month => month.start.slice(0, 4)))].map(year => {
              const first = months.find(month => month.start.startsWith(year))!;
              return <span key={year} className={styles.year} style={{left: `${pct(first.start)}%`}}>{year}年</span>;
            })}
            {months.map(month => <span key={month.start} className={`${treeStyles.monthTick} ${styles.month}`} style={{left: `${pct(month.start)}%`, width: `${width(month.start, month.end)}%`}}>{month.label}</span>)}</div>
        </div>
        <div className={styles.body} ref={bodyRef}>
          <div className={styles.overlay} aria-hidden="true"><div /><div className={treeStyles.ganttOverlayLane}>
            {asOf >= work.start && asOf <= work.end && <span className={treeStyles.todayLine} style={{left: `${pct(asOf)}%`}} />}
            {dependencyLayer}
          </div></div>
          {roadmap.groups.map(group => <section key={group.id} data-roadmap-group={group.id}>
            <div className={styles.groupHeading}><strong>{group.title}</strong><span>{group.owner}</span></div>
            {work.phases.filter(phase => phase.group === group.id).map(phase => <Fragment key={phase.id}>
              <div className={styles.row} data-phase-row={phase.id}>
                <div className={styles.lead}>
                  <button type="button" className={styles.toggle} aria-label={`${phase.title}の詳細`} aria-expanded={expanded.has(phase.id)} data-roadmap-phase={phase.id} data-start={phase.range?.start} data-end={phase.range?.end} onClick={() => toggle(phase.id)}>{expanded.has(phase.id) ? "▾" : "▸"}</button>
                  <div className={styles.label}>
                    <button type="button" className={styles.title} onClick={() => toggle(phase.id)} aria-expanded={expanded.has(phase.id)}>{phase.title}</button>
                    <span className={styles.meta}>{dateLabel(phase.range)}{!phase.items.length ? " · 計画" : ""}</span>
                  </div>
                </div>
                <div className={styles.phaseTimeline}>
                  {!phase.items.length && phase.extensionEnd && <span className={styles.extension} title={`資料の延長範囲：${phase.extensionEnd}`} style={{left: `${pct(phase.start)}%`, width: `${width(phase.start, phase.extensionEnd)}%`}} />}
                  {summaryBar(phase.range, phase.title, () => toggle(phase.id))}
                </div>
              </div>
              {expanded.has(phase.id) && <div data-phase-detail={phase.id}>{phase.items.length ? phase.items.map(item => renderWork(item)) : <p className={styles.empty}>子のMS・タスクは未登録</p>}</div>}
            </Fragment>)}
          </section>)}
          {work.ungrouped.length > 0 && <section><div className={styles.groupHeading}><strong>工程未分類</strong></div>{work.ungrouped.map(item => renderWork(item))}</section>}
          <div className={styles.groupHeading}><strong>節目</strong><span>資料の月精度</span></div>
          {roadmap.markers.map(marker => <div className={styles.row} key={marker.id} data-roadmap-marker={marker.id}>
            <div className={styles.lead}><span className={styles.toggleSpace} /><div className={styles.label}><span>{marker.title}</span><span className={styles.meta}>{marker.date.slice(0, 7)}</span></div></div>
            <div className={`${treeStyles.lane} ${styles.timeline}`}>{grid()}<span className={styles.marker} style={{left: `${pct(marker.date)}%`}}>◆</span></div>
          </div>)}
        </div>
      </div>
    </div>
    <details className={styles.notes}><summary>計画の補足</summary>{roadmap.notes.map(note => <p key={note}>{note}</p>)}<p>{roadmap.sourceLabel}。子がある工程は子の日程から集計。子のない工程と破線は資料の計画。日程未設定の子は期間に含まない。</p></details>
  </div>;
}
