"use client";

import { Fragment, useMemo, useState, type ReactNode, type RefObject } from "react";
import { projectRoadmapWork, type RoadmapWorkItem, type ProjectGanttRoadmap } from "@/lib/project-gantt-roadmap";
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
  const grouped = useMemo(() => projectRoadmapWork(roots, roadmap), [roots, roadmap]);
  const days = diffDays(grouped.start, grouped.end) + 1;
  const pct = (date: string) => diffDays(grouped.start, date) / days * 100;
  const width = (start: string, end: string) => (diffDays(start, end) + 1) / days * 100;
  const quarters: { start: string; end: string; year: number; label: string }[] = [];
  for (let year = Number(grouped.start.slice(0, 4)); year <= Number(grouped.end.slice(0, 4)); year++) {
    for (let month = 1; month <= 12; month += 3) {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const end = new Date(Date.UTC(year, month + 2, 0)).toISOString().slice(0, 10);
      if (end < grouped.start || start > grouped.end) continue;
      quarters.push({ start, end, year, label: `${month}–${month + 2}月` });
    }
  }
  const toggle = (id: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    onExpand();
  };
  const grid = () => quarters.map((quarter) => <span key={quarter.start} className={styles.gridLine} style={{ left: `${pct(quarter.start)}%` }} />);
  const renderWork = (item: RoadmapWorkItem, depth = 0): ReactNode => <Fragment key={`${item.kind}-${item.id}`}>
    <div className={styles.workRow} data-work-kind={item.kind} data-work-id={item.id} data-start={item.range?.start} data-end={item.range?.end}>
      <div className={styles.workLead} style={{paddingLeft: 16 + depth * 16}}>
        {item.children.length > 0 && <button type="button" className={styles.workToggle} aria-label={`${item.title}の子タスク`} aria-expanded={expanded.has(item.id)} onClick={() => toggle(item.id)}>{expanded.has(item.id) ? "−" : "+"}</button>}
        <button type="button" className={styles.workTitle} onClick={() => onSelect(item.kind === "task" ? "action" : "question", item.id)}>{item.title}</button>
        <small>{item.kind === "milestone" ? "MS" : "タスク"}</small>
      </div>
      {item.action && !item.children.length && item.range ? renderActionLane(item.action) : <div className={styles.lane}>
        {grid()}
        {item.range ? <button type="button" className={styles.workBar} aria-label={`${item.title}：${item.range.start}〜${item.range.end}`} data-summary={item.children.length > 0 ? "true" : undefined} title={`${item.range.start}〜${item.range.end}`} style={{left: `${pct(item.range.start)}%`, width: `${Math.max(width(item.range.start, item.range.end), .6)}%`}} onClick={() => onSelect(item.kind === "task" ? "action" : "question", item.id)}>{item.kind === "milestone" && !item.children.length ? "◆" : ""}</button> : <span className={styles.noDate}>日程未設定</span>}
      </div>}
    </div>
    {expanded.has(item.id) && item.children.map(child => renderWork(child, depth + 1))}
  </Fragment>;
  return (
    <div className={styles.roadmap} data-testid="meeting-roadmap" data-expanded={expanded.size > 0 ? "true" : undefined}>
      <div className={styles.toolbar}>
        <span>定例資料の全体計画 <small>工程を押すとMS・タスクを展開</small></span>
        <button type="button" onClick={() => { setExpanded(new Set()); onExpand(); }}>詳細を折り畳む</button>
      </div>
      <div className={styles.scroll}>
        <div className={styles.chart}>
          <div className={styles.header}>
            <div className={styles.corner}>工程／担当</div>
            <div className={styles.axis} ref={axisRef}>
              {quarters.map((quarter) => <div key={quarter.start} className={styles.quarter} style={{ left: `${pct(quarter.start)}%`, width: `${width(quarter.start, quarter.end)}%` }}><b>{quarter.year}</b><span>{quarter.label}</span></div>)}
            </div>
          </div>
          <div className={styles.body} ref={bodyRef}>
            <div className={styles.guideLayer} aria-hidden="true"><div /><div className={`${styles.guideLane} ${treeStyles.ganttOverlayLane}`}>
              {asOf >= grouped.start && asOf <= grouped.end && <span className={styles.today} style={{ left: `${pct(asOf)}%` }}><b>今日</b></span>}
              {roadmap.markers.map((marker) => <span key={marker.id} className={styles.markerLine} style={{ left: `${pct(marker.date)}%` }} />)}
              {dependencyLayer}
            </div></div>
            {roadmap.groups.map((group) => {
              const phases = grouped.phases.filter((phase) => phase.group === group.id);
              const rows = [...new Set(phases.map((phase) => phase.row))].sort((a, b) => a - b);
              return <section key={group.id} className={styles.group} data-roadmap-group={group.id}>
                {rows.map((row, index) => <Fragment key={row}>
                  <div className={styles.planRow} data-tech={group.id === "technology" ? "true" : undefined}>
                    <div className={styles.groupLabel}>{index === 0 && <><strong>{group.title}</strong><small>{group.owner}</small></>}</div>
                    <div className={styles.lane}>
                      {grid()}
                      {phases.filter((phase) => phase.row === row).map((phase) => {
                        return <Fragment key={phase.id}>
                          {!phase.items.length && phase.extensionEnd && <span className={styles.extension} data-extension={phase.id} style={{ left: `${pct(phase.start)}%`, width: `${width(phase.start, phase.extensionEnd)}%` }} />}
                          <button type="button" className={phase.range ? styles.bar : styles.unscheduledPhase} data-roadmap-phase={phase.id} data-narrow={phase.range && width(phase.range.start, phase.range.end) < 12 ? "true" : undefined} aria-expanded={expanded.has(phase.id)} aria-label={`${phase.title}の詳細`} data-start={phase.range?.start} data-end={phase.range?.end} title={phase.range ? `${phase.title}：${phase.range.start}〜${phase.range.end}${phase.items.length ? "（子の日程から集計）" : "（定例資料の計画）"}` : `${phase.title}：子の日程未設定`} onClick={() => toggle(phase.id)} style={phase.range ? { left: `${pct(phase.range.start)}%`, width: `${width(phase.range.start, phase.range.end)}%` } : undefined}>
                            <span>{phase.id === "strategy" ? <>事業計画・資本政策<br />知財戦略策定</> : phase.title}</span><small>{!phase.range && "日程未設定 "}{expanded.has(phase.id) ? "−" : "+"}</small>
                          </button>
                        </Fragment>;
                      })}
                    </div>
                  </div>
                  {phases.filter((phase) => phase.row === row && expanded.has(phase.id)).map((phase) => <div key={phase.id} className={styles.detail} data-phase-detail={phase.id}>
                    <div className={styles.detailTitle}>{phase.title}<span>MS・タスク</span></div>
                    {phase.items.length > 0
                      ? <div className={treeStyles.tree} data-mode="gantt">{phase.items.map(item => renderWork(item))}</div>
                      : <p className={styles.empty}>子のMS・タスクは未登録。この工程の期間は定例資料の計画。</p>}
                  </div>)}
                </Fragment>)}
              </section>;
            })}
            <div className={styles.milestones}><div>節目 <small>月の目安</small></div><div className={styles.milestoneLane}>
              {roadmap.markers.map((marker) => <div key={marker.id} className={styles.marker} data-roadmap-marker={marker.id} style={{ left: `${pct(marker.date)}%` }}><b>◆</b><span>{marker.date.slice(2, 7).replace("-", "/")}<br />{marker.title}</span></div>)}
            </div></div>
          </div>
        </div>
      </div>
      <div className={styles.notes}>{roadmap.notes.map((note) => <span key={note}>{note}</span>)}</div>
      <p className={styles.source}>{roadmap.sourceLabel} · 子がある工程は子の日程から集計。子のない工程と破線は資料の計画（月内の端点は概算）。日程未設定の子は期間に含まない。</p>
      {grouped.ungrouped.length > 0 && <details className={styles.unmapped}><summary>工程への紐づけ前のMS・タスク {grouped.ungrouped.length}件</summary><div className={treeStyles.tree} data-mode="gantt">{grouped.ungrouped.map(item => renderWork(item))}</div></details>}
    </div>
  );
}
