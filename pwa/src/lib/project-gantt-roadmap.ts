import type { ActionNode, QuestionNode } from "./question-tree-types";

export type GanttRoadmapPhase = {
  id: string;
  title: string;
  group: string;
  row: number;
  start: string;
  end: string;
  extensionEnd: string | null;
  questionIds: string[];
};
export type ProjectGanttRoadmap = {
  title: string;
  start: string;
  end: string;
  groups: { id: string; title: string; owner: string }[];
  phases: GanttRoadmapPhase[];
  markers: { id: string; title: string; date: string }[];
  notes: string[];
  sourceLabel: string;
  dateNote: string;
};

/** Grouping is a read-only projection. A mapped descendant moves to its own phase in this
 * view, while its canonical parent, action links, dates and review state stay untouched.
 * Unmapped/new roots remain visible in an explicit remainder section. */
export function groupRoadmapQuestions(roots: QuestionNode[], roadmap: ProjectGanttRoadmap) {
  const byPhase = new Map<string, QuestionNode[]>();
  const assignments = new Map<string, string>();
  for (const phase of roadmap.phases) {
    byPhase.set(phase.id, []);
    for (const id of phase.questionIds) assignments.set(id, phase.id);
  }
  const ungrouped: QuestionNode[] = [];
  const visit = (node: QuestionNode, inherited: string | null): QuestionNode | null => {
    if (node.isProposed) return null;
    const owner = assignments.get(node.id) ?? inherited;
    const copy = { ...node, children: [] as QuestionNode[] };
    for (const child of node.children) {
      const projected = visit(child, owner);
      if (projected) copy.children.push(projected);
    }
    if (owner !== inherited) {
      byPhase.get(owner!)!.push(copy);
      return null;
    }
    return copy;
  };
  for (const root of roots) {
    const remainder = visit(root, null);
    if (remainder) ungrouped.push(remainder);
  }
  return { byPhase, ungrouped };
}

export type WorkRange = { start: string; end: string };
export type RoadmapWorkItem = {
  id: string; kind: "task" | "milestone"; title: string;
  range: WorkRange | null; children: RoadmapWorkItem[];
  action?: import("./question-tree-types").ActionNode;
};
export function spanWork(items: RoadmapWorkItem[]): WorkRange | null {
  const ranges = items.flatMap(item => item.range ? [item.range] : []);
  return ranges.length ? {
    start: ranges.reduce((a, b) => a < b.start ? a : b.start, ranges[0].start),
    end: ranges.reduce((a, b) => a > b.end ? a : b.end, ranges[0].end),
  } : null;
}
/** Questions route work, but are never timeline rows or date sources.
 * Parents use children exclusively; only leaves keep their own planned dates. */
export function projectRoadmapWork(roots: QuestionNode[], roadmap: ProjectGanttRoadmap, allActions: ActionNode[] = []) {
  const grouped = groupRoadmapQuestions(roots, roadmap);
  const seen = new Set<string>();
  // Resolve the nearest explicit task placement before rendering any question branch.
  // This also allows standalone tasks and makes detachment survive later tree refreshes.
  const actions = new Map<string, ActionNode>();
  const collect = (action: ActionNode) => {
    if (actions.has(action.id)) return;
    actions.set(action.id, action);
    action.children.forEach(collect);
  };
  allActions.forEach(collect);
  const collectTree = (node: QuestionNode) => { node.actions.forEach(collect); node.children.forEach(collectTree); };
  roots.forEach(collectTree);
  const placement = new Map<string, string | null>();
  const visited = new Set<string>();
  const place = (action: ActionNode, inherited: string | null | undefined, blocked = false) => {
    if (visited.has(action.id)) return;
    visited.add(action.id);
    const owner = blocked || action.isProposed ? null : action.ganttPhaseOverride ? action.ganttPhaseId ?? null : inherited;
    if (owner !== undefined) placement.set(action.id, owner);
    action.children.forEach(child => place(child, owner, blocked || action.isProposed));
  };
  [...actions.values()].filter(a => !a.parentId || !actions.has(a.parentId)).forEach(a => place(a, undefined));
  [...actions.values()].forEach(a => place(a, undefined));
  const eligibleActions = new Set<string>();
  const collectAction = (action: import("./question-tree-types").ActionNode) => {
    if (action.isProposed || eligibleActions.has(action.id)) return;
    eligibleActions.add(action.id);
    action.children.forEach(collectAction);
  };
  const collectQuestion = (node: QuestionNode) => {
    node.actions.forEach(collectAction);
    node.children.forEach(collectQuestion);
  };
  [...grouped.byPhase.values(), grouped.ungrouped].flat().forEach(collectQuestion);
  const actionItem = (action: ActionNode, owner?: string): RoadmapWorkItem[] => {
    if (action.isProposed || seen.has(action.id) || (placement.has(action.id) && placement.get(action.id) !== owner)) return [];
    seen.add(action.id);
    const children = action.children.flatMap(child => actionItem(child, owner));
    const range = action.children.some(child => !child.isProposed) ? spanWork(children) : action.plannedEnd
      ? {start: action.plannedStart ?? action.plannedEnd, end: action.plannedEnd} : null;
    return [{id: action.id, title: action.title, kind: "task", range, children, action}];
  };
  const questionItems = (node: QuestionNode): RoadmapWorkItem[] => {
    const children = [...node.children.flatMap(questionItems), ...node.actions.filter(a => !a.parentId || !eligibleActions.has(a.parentId)).flatMap(a => actionItem(a))];
    if (node.questionKind !== "milestone") return children;
    return [{id: node.id, title: node.title, kind: "milestone", children,
      range: children.length ? spanWork(children) : node.dueDate ? {start: node.dueDate, end: node.dueDate} : null}];
  };
  const phases = roadmap.phases.map(phase => {
    const items = (grouped.byPhase.get(phase.id) ?? []).flatMap(questionItems);
    for (const action of actions.values()) {
      if (placement.get(action.id) === phase.id && (!action.parentId || placement.get(action.parentId) !== phase.id)) {
        items.push(...actionItem(action, phase.id));
      }
    }
    return {...phase, items, range: items.length ? spanWork(items) : {start: phase.start, end: phase.end}};
  });
  // Keep the slide's shared lanes until edited children make their ranges overlap.
  const placed: typeof phases = [];
  for (const phase of phases) {
    while (placed.some(other => other.group === phase.group && other.row === phase.row &&
      (!other.range || !phase.range || (other.range.start <= phase.range.end && phase.range.start <= other.range.end)))) phase.row++;
    placed.push(phase);
  }
  const ungrouped = grouped.ungrouped.flatMap(questionItems);
  const ranges = [...phases.flatMap(p => p.range ? [p.range] : []), ...ungrouped.flatMap(i => i.range ? [i.range] : [])];
  const min = ranges.reduce((a, b) => a < b.start ? a : b.start, roadmap.start);
  const max = ranges.reduce((a, b) => a > b.end ? a : b.end, roadmap.end);
  const startMonth = Math.floor((Number(min.slice(5, 7)) - 1) / 3) * 3 + 1;
  const endMonth = Math.floor((Number(max.slice(5, 7)) - 1) / 3) * 3 + 3;
  const start = `${min.slice(0, 4)}-${String(startMonth).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(Number(max.slice(0, 4)), endMonth, 0)).toISOString().slice(0, 10);
  return {phases, ungrouped, start, end};
}
