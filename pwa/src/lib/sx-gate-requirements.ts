import type {
  SxDependency,
  SxManagementMilestone,
} from "./sx-management";

export type SxGateRequirement = {
  dependency: SxDependency;
  milestone: SxManagementMilestone;
  state: "met" | "unmet" | "unconfirmed";
};

/**
 * 前提条件のMSの種類（project_management_milestones.gate_kind）。どのPJのMSにも付けられる。
 * oral_agreement は「口頭合意を確認する」MSで、後に続くMSの前提になり、確認する期間（開始日〜完了日）を持てる。
 * PJ番号や slug では決めない（2026-10-04 まさ「特定のPJだけの特例を入れたらシステムにならない」、spec 3-23 §6）。
 */
export const MILESTONE_GATE_KINDS = ["oral_agreement"] as const;
export type MilestoneGateKind = (typeof MILESTONE_GATE_KINDS)[number];

export const MILESTONE_GATE_KIND_LABEL: Record<MilestoneGateKind, string> = {
  oral_agreement: "前提条件（口頭合意の確認）",
};

export function asMilestoneGateKind(value: unknown): MilestoneGateKind | null {
  return (MILESTONE_GATE_KINDS as readonly string[]).includes(String(value))
    ? (value as MilestoneGateKind)
    : null;
}

export function sxIsBlockingMilestone(
  milestone: Pick<SxManagementMilestone, "gateKind">,
) {
  return milestone.gateKind != null;
}

export function sxOralAgreementEvidenceReady(
  gateKind: MilestoneGateKind | null,
  evidence: string | null | undefined,
) {
  if (gateKind !== "oral_agreement") return Boolean(evidence?.trim());
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
  const evidenceReady = sxOralAgreementEvidenceReady(
    milestone.gateKind,
    milestone.completionEvidence,
  );
  if (!evidenceReady) return "unconfirmed";
  return "met";
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
