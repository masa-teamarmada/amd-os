import type {
  SxDependency,
  SxManagementMilestone,
  SxTask,
} from "./sx-management";

export type SxGateRequirement = {
  dependency: SxDependency;
  milestone: SxManagementMilestone;
  state: "met" | "unmet" | "unconfirmed";
};

export type SxMilestoneRequiredTaskSummary = {
  total: number;
  completed: number;
  nextIncomplete: SxTask | null;
  allComplete: boolean;
};

/** All tasks directly under a milestone, in display order. Used to judge whether the
 * founding-prerequisite milestones' required task chain is fully done — a milestone with
 * zero tasks registered is never "all complete" by omission. */
export function sxMilestoneRequiredTaskSummary(
  milestoneId: string,
  tasks: SxTask[],
): SxMilestoneRequiredTaskSummary {
  const children = tasks
    .filter((task) => task.milestoneId === milestoneId)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.title.localeCompare(right.title, "ja"),
    );
  const completed = children.filter(
    (task) => task.status === "completed",
  ).length;
  const nextIncomplete =
    children.find((task) => task.status !== "completed") || null;
  return {
    total: children.length,
    completed,
    nextIncomplete,
    allComplete: children.length > 0 && completed === children.length,
  };
}

export const SX_BLOCKING_MILESTONE_SLUGS = [
  "business-paid-poc-oral-agreement",
  "funding-investment-oral-agreement",
] as const;

const BLOCKING_MILESTONE_SLUG_SET = new Set<string>(
  SX_BLOCKING_MILESTONE_SLUGS,
);

export function sxIsBlockingMilestone(
  milestone: Pick<SxManagementMilestone, "slug">,
) {
  return BLOCKING_MILESTONE_SLUG_SET.has(milestone.slug);
}

export function sxOralAgreementEvidenceReady(
  slug: string,
  evidence: string | null | undefined,
) {
  if (!BLOCKING_MILESTONE_SLUG_SET.has(slug)) return Boolean(evidence?.trim());
  const lines = (evidence || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const has = (label: RegExp) =>
    lines.some((line) => label.test(line) && /[：:].+/.test(line));
  return (
    has(/^(先方|投資家|出資者)[：:]/) &&
    has(/^合意内容[：:]/) &&
    has(/^確認日[：:]/) &&
    has(/^根拠[：:]/)
  );
}

export function sxGateRequirementState(
  milestone: SxManagementMilestone,
  tasks: SxTask[] = [],
): SxGateRequirement["state"] {
  if (milestone.manualStatus === "unassessed") return "unconfirmed";
  if (milestone.manualStatus !== "completed") return "unmet";
  const evidenceReady = sxOralAgreementEvidenceReady(
    milestone.slug,
    milestone.completionEvidence,
  );
  if (!evidenceReady) return "unconfirmed";
  // The four-item oral-agreement evidence alone is not sufficient for the two
  // founding-prerequisite milestones — every required task under them must also
  // be completed, so the milestone can't be marked achieved by evidence text alone.
  if (sxIsBlockingMilestone(milestone)) {
    return sxMilestoneRequiredTaskSummary(milestone.id, tasks).allComplete
      ? "met"
      : "unmet";
  }
  return "met";
}

export function sxGateRequirementsBySuccessor(
  milestones: SxManagementMilestone[],
  dependencies: SxDependency[],
  tasks: SxTask[] = [],
): Map<string, SxGateRequirement[]> {
  const milestoneById = new Map(
    milestones.map((milestone) => [milestone.id, milestone]),
  );
  const result = new Map<string, SxGateRequirement[]>();
  for (const dependency of dependencies) {
    if (!dependency.required) continue;
    const milestone = milestoneById.get(dependency.predecessorMilestoneId);
    if (!milestone || !sxIsBlockingMilestone(milestone)) continue;
    const requirement = {
      dependency,
      milestone,
      state: sxGateRequirementState(milestone, tasks),
    };
    result.set(dependency.successorMilestoneId, [
      ...(result.get(dependency.successorMilestoneId) || []),
      requirement,
    ]);
  }
  return result;
}

export function sxGateRequirementCounts(requirements: SxGateRequirement[]) {
  return {
    met: requirements.filter((item) => item.state === "met").length,
    total: requirements.length,
  };
}
