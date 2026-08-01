import type { SxDependency, SxManagementMilestone } from "./sx-management";

export type SxGateRequirement = {
  dependency: SxDependency;
  milestone: SxManagementMilestone;
  state: "met" | "unmet" | "unconfirmed";
};

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
): SxGateRequirement["state"] {
  if (milestone.manualStatus === "unassessed") return "unconfirmed";
  if (milestone.manualStatus !== "completed") return "unmet";
  return sxOralAgreementEvidenceReady(
    milestone.slug,
    milestone.completionEvidence,
  )
    ? "met"
    : "unconfirmed";
}

export function sxGateRequirementsBySuccessor(
  milestones: SxManagementMilestone[],
  dependencies: SxDependency[],
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
      state: sxGateRequirementState(milestone),
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
