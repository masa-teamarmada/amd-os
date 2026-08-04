/**
 * Candidate resolution for direct task nesting in the SX gantt. This deliberately stays
 * independent from React/DOM so the same no-cycle and same-milestone rule can be exercised
 * before the interaction layer sends its PATCH.
 */
export type SxGanttNestingTask = {
  id: string;
  milestoneId: string;
  parentTaskId: string | null;
};

/** Returns task ids that can become the direct parent of `sourceTaskId`.
 *
 * A task may only nest within its own milestone. Its descendants (and its current parent, which
 * would be a no-op) are excluded. The API repeats these checks; this helper keeps invalid rows
 * from ever becoming visible drop targets. */
export function taskNestCandidateIds(
  tasks: readonly SxGanttNestingTask[],
  sourceTaskId: string | null,
): Set<string> {
  if (!sourceTaskId) return new Set();
  const source = tasks.find((task) => task.id === sourceTaskId);
  if (!source) return new Set();

  const childrenByParent = new Map<string, string[]>();
  for (const task of tasks) {
    if (!task.parentTaskId) continue;
    childrenByParent.set(task.parentTaskId, [
      ...(childrenByParent.get(task.parentTaskId) || []),
      task.id,
    ]);
  }

  const descendants = new Set<string>();
  const queue = [...(childrenByParent.get(source.id) || [])];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || descendants.has(id)) continue;
    descendants.add(id);
    queue.push(...(childrenByParent.get(id) || []));
  }

  return new Set(
    tasks
      .filter(
        (task) =>
          task.milestoneId === source.milestoneId &&
          task.id !== source.id &&
          task.id !== source.parentTaskId &&
          !descendants.has(task.id),
      )
      .map((task) => task.id),
  );
}
