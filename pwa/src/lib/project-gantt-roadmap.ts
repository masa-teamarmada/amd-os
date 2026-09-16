import type { QuestionNode } from "./question-tree-types";

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
