"use client";

import { Fragment, useMemo, useState, type ReactNode, type RefObject } from "react";
import { groupRoadmapQuestions, type ProjectGanttRoadmap } from "@/lib/project-gantt-roadmap";
import type { QuestionNode } from "@/lib/question-tree-types";
import { diffDays } from "@/lib/sx-gantt-drag";
import styles from "./meeting-roadmap.module.css";
import treeStyles from "./question-tree.module.css";

export function MeetingRoadmap({ roadmap, roots, asOf, renderQuestion, axisRef, bodyRef, onExpand, dependencyLayer }: {
  roadmap: ProjectGanttRoadmap;
  roots: QuestionNode[];
  asOf: string;
  renderQuestion: (question: QuestionNode) => ReactNode;
  axisRef: RefObject<HTMLDivElement | null>;
  bodyRef: RefObject<HTMLDivElement | null>;
  onExpand: () => void;
  dependencyLayer: ReactNode;
}) {
  const [expanded, setExpanded] = useState(new Set<string>());
  const grouped = useMemo(() => groupRoadmapQuestions(roots, roadmap), [roots, roadmap]);
  const days = diffDays(roadmap.start, roadmap.end) + 1;
  const pct = (date: string) => diffDays(roadmap.start, date) / days * 100;
  const width = (start: string, end: string) => (diffDays(start, end) + 1) / days * 100;
  const quarters: { start: string; end: string; year: number; label: string }[] = [];
  for (let year = Number(roadmap.start.slice(0, 4)); year <= Number(roadmap.end.slice(0, 4)); year++) {
    for (let month = 1; month <= 12; month += 3) {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const end = new Date(Date.UTC(year, month + 2, 0)).toISOString().slice(0, 10);
      if (end < roadmap.start || start > roadmap.end) continue;
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
  return (
    <div className={styles.roadmap} data-testid="meeting-roadmap" data-expanded={expanded.size > 0 ? "true" : undefined}>
      <div className={styles.toolbar}>
        <span>定例資料の全体計画 <small>工程を押すと論点・TODOを展開</small></span>
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
              {asOf >= roadmap.start && asOf <= roadmap.end && <span className={styles.today} style={{ left: `${pct(asOf)}%` }}><b>今日</b></span>}
              {roadmap.markers.map((marker) => <span key={marker.id} className={styles.markerLine} style={{ left: `${pct(marker.date)}%` }} />)}
              {dependencyLayer}
            </div></div>
            {roadmap.groups.map((group) => {
              const phases = roadmap.phases.filter((phase) => phase.group === group.id);
              const rows = [...new Set(phases.map((phase) => phase.row))].sort((a, b) => a - b);
              return <section key={group.id} className={styles.group} data-roadmap-group={group.id}>
                {rows.map((row, index) => <Fragment key={row}>
                  <div className={styles.planRow} data-tech={group.id === "technology" ? "true" : undefined}>
                    <div className={styles.groupLabel}>{index === 0 && <><strong>{group.title}</strong><small>{group.owner}</small></>}</div>
                    <div className={styles.lane}>
                      {grid()}
                      {phases.filter((phase) => phase.row === row).map((phase) => {
                        return <Fragment key={phase.id}>
                          {phase.extensionEnd && <span className={styles.extension} data-extension={phase.id} style={{ left: `${pct(phase.start)}%`, width: `${width(phase.start, phase.extensionEnd)}%` }} />}
                          <button type="button" className={styles.bar} data-roadmap-phase={phase.id} aria-expanded={expanded.has(phase.id)} aria-label={`${phase.title}の詳細`} title={`${phase.title}：${phase.start.slice(0, 7)}〜${phase.end.slice(0, 7)}（目安）${phase.extensionEnd ? `／破線〜${phase.extensionEnd.slice(0, 7)}` : ""}`} onClick={() => toggle(phase.id)} style={{ left: `${pct(phase.start)}%`, width: `${width(phase.start, phase.end)}%` }}>
                            <span>{phase.id === "strategy" ? <>事業計画・資本政策<br />知財戦略策定</> : phase.title}</span><small>{expanded.has(phase.id) ? "−" : "+"}</small>
                          </button>
                        </Fragment>;
                      })}
                    </div>
                  </div>
                  {phases.filter((phase) => phase.row === row && expanded.has(phase.id)).map((phase) => <div key={phase.id} className={styles.detail} data-phase-detail={phase.id}>
                    <div className={styles.detailTitle}>{phase.title}<span>関連する論点・TODO</span></div>
                    {(grouped.byPhase.get(phase.id)?.length ?? 0) > 0
                      ? <div className={treeStyles.tree} data-mode="gantt">{grouped.byPhase.get(phase.id)!.map(renderQuestion)}</div>
                      : <p className={styles.empty}>この工程に紐づく承認済みの論点・TODOは未登録</p>}
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
      <p className={styles.source}>{roadmap.sourceLabel} · {roadmap.dateNote}</p>
      {grouped.ungrouped.length > 0 && <details className={styles.unmapped}><summary>工程への紐づけ前の論点 {grouped.ungrouped.length}件</summary><div className={treeStyles.tree} data-mode="gantt">{grouped.ungrouped.map(renderQuestion)}</div></details>}
    </div>
  );
}
