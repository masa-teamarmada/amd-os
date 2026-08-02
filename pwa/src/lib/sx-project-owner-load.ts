import type {
  SxManagementBundle,
  SxManagementIssue,
  SxManagementMilestone,
} from "./sx-management";
import { sxHoldingsForPartner } from "./sx-partner-holdings.ts";
import { sxPartnerPrimaryIntervention } from "./sx-partner-progress.ts";

export type SxProjectWorkKind =
  | "milestone"
  | "task"
  | "issue"
  | "hypothesis"
  | "validation"
  | "decision"
  | "action"
  | "partner";

export type SxProjectWorkUnit = {
  id: string;
  kind: SxProjectWorkKind;
  kindLabel: string;
  title: string;
  ownerLabel: string;
  dueDate: string | null;
  dueDatePrecision: "day" | "month" | "unknown";
  blocked: boolean;
  dataGap: boolean;
  impactedGates: string[];
  /** Where this unit's own editable record lives, for "click through to the source" navigation.
   * Milestone/task point at the gantt row; issue/hypothesis/validation/decision/action all point
   * at their owning issue card; partner points at its ledger row. Never more than one is set. */
  navMilestoneId: string | null;
  navTaskId: string | null;
  navIssueId: string | null;
  navPartnerId: string | null;
  /** Provenance for partner-derived units only (kind === "partner") — which table/record to open
   * an editor against. Never inferred from `id` by trying lookups across tables in sequence: an
   * unrecognized/missing originResource must never fall through to a different resource type
   * (2026-08 provenance audit). null for every non-partner unit. */
  originResource:
    | "partner_work_item"
    | "commitment"
    | "partner_next_action"
    | null;
  /** The underlying record id to look up within `recordId`'s originResource table. For the
   * partner_next_action fallback this is the partner id itself (there is no separate record). */
  recordId: string | null;
  partnerId: string | null;
};

export type SxProjectOwnerLoad = {
  ownerLabel: string;
  openCount: number;
  blockedCount: number;
  overdueCount: number;
  dueSoonCount: number;
  dueUnsetCount: number;
  dataGapCount: number;
  impactedGates: string[];
  items: SxProjectWorkUnit[];
};

function owner(value: string | null | undefined) {
  const normalized = (value || "").trim();
  return !normalized || /未確認|未設定|未登録/.test(normalized)
    ? "担当未確認"
    : normalized;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function sxProjectWorkUnitIsOverdue(
  item: SxProjectWorkUnit,
  today: string,
) {
  return isOverdue(item, today);
}

export function sxProjectWorkUnitIsDueSoon(
  item: SxProjectWorkUnit,
  today: string,
) {
  return isDueSoon(item, today);
}

function isOverdue(item: SxProjectWorkUnit, today: string) {
  return (
    item.dueDatePrecision === "day" &&
    item.dueDate != null &&
    item.dueDate < today
  );
}

function isDueSoon(item: SxProjectWorkUnit, today: string) {
  return (
    item.dueDatePrecision === "day" &&
    item.dueDate != null &&
    item.dueDate >= today &&
    item.dueDate <= addDays(today, 7)
  );
}

function gateLabel(milestone: SxManagementMilestone | undefined) {
  return milestone?.gate?.trim() || milestone?.title?.trim() || null;
}

function issueGateLabels(
  issue: SxManagementIssue | undefined,
  milestoneBySlug: Map<string, SxManagementMilestone>,
) {
  if (!issue) return [];
  const slugs = Array.from(
    new Set(
      [issue.milestoneSlug, ...issue.relatedMilestoneSlugs].filter(
        (slug): slug is string => Boolean(slug),
      ),
    ),
  );
  return slugs
    .map((slug) => gateLabel(milestoneBySlug.get(slug)))
    .filter((label): label is string => Boolean(label));
}

function sortUnits(left: SxProjectWorkUnit, right: SxProjectWorkUnit) {
  if (left.blocked !== right.blocked) return left.blocked ? -1 : 1;
  return (
    (left.dueDate || "9999").localeCompare(right.dueDate || "9999") ||
    left.title.localeCompare(right.title, "ja")
  );
}

/**
 * 工程・タスク・ゲート・論点・判断・関係先を、同じ「担当者が抱える未完了単位」へ正規化する。
 * 件数だけでなく元の作業と止まるゲートを保持し、担当帯から実務へ降りられる形にする。
 */
export function sxProjectOwnerLoads(
  management: SxManagementBundle,
): SxProjectOwnerLoad[] {
  const units: SxProjectWorkUnit[] = [];
  const milestoneById = new Map(
    management.milestones.map((milestone) => [milestone.id, milestone]),
  );
  const milestoneBySlug = new Map(
    management.milestones.map((milestone) => [milestone.slug, milestone]),
  );
  const issueById = new Map(
    management.issues.map((issue) => [issue.id, issue]),
  );
  const hypothesisById = new Map(
    management.hypotheses.map((hypothesis) => [hypothesis.id, hypothesis]),
  );
  const decisionById = new Map(
    management.decisions.map((decision) => [decision.id, decision]),
  );
  const requiredSuccessors = new Map<string, string[]>();
  for (const dependency of management.dependencies) {
    if (!dependency.required) continue;
    const successor = milestoneById.get(dependency.successorMilestoneId);
    const label = gateLabel(successor);
    if (!label) continue;
    requiredSuccessors.set(dependency.predecessorMilestoneId, [
      ...(requiredSuccessors.get(dependency.predecessorMilestoneId) || []),
      label,
    ]);
  }

  const push = (
    unit: Omit<
      SxProjectWorkUnit,
      | "navMilestoneId"
      | "navTaskId"
      | "navIssueId"
      | "navPartnerId"
      | "originResource"
      | "recordId"
      | "partnerId"
    > &
      Partial<
        Pick<
          SxProjectWorkUnit,
          | "navMilestoneId"
          | "navTaskId"
          | "navIssueId"
          | "navPartnerId"
          | "originResource"
          | "recordId"
          | "partnerId"
        >
      >,
  ) =>
    units.push({
      ...unit,
      ownerLabel: owner(unit.ownerLabel),
      impactedGates: Array.from(new Set(unit.impactedGates.filter(Boolean))),
      navMilestoneId: unit.navMilestoneId ?? null,
      navTaskId: unit.navTaskId ?? null,
      navIssueId: unit.navIssueId ?? null,
      navPartnerId: unit.navPartnerId ?? null,
      originResource: unit.originResource ?? null,
      recordId: unit.recordId ?? null,
      partnerId: unit.partnerId ?? null,
    });

  for (const milestone of management.milestones) {
    if (milestone.manualStatus === "completed") continue;
    push({
      id: milestone.id,
      kind: "milestone",
      kindLabel: "工程・ゲート",
      title: milestone.title,
      ownerLabel: milestone.ownerLabel,
      dueDate: milestone.plannedEnd,
      dueDatePrecision: milestone.plannedEnd ? "day" : "unknown",
      blocked: milestone.manualStatus === "blocked",
      dataGap:
        milestone.manualStatus === "unassessed" ||
        !milestone.ownerLabel ||
        !milestone.plannedEnd,
      impactedGates:
        requiredSuccessors.get(milestone.id) ||
        [gateLabel(milestone)].filter((label): label is string =>
          Boolean(label),
        ),
      navMilestoneId: milestone.id,
    });
  }

  for (const task of management.tasks) {
    if (task.status === "completed") continue;
    const milestone = milestoneById.get(task.milestoneId);
    push({
      id: task.id,
      kind: "task",
      kindLabel: "タスク",
      title: task.title,
      ownerLabel: task.ownerLabel,
      dueDate: task.plannedEnd,
      dueDatePrecision: task.plannedEnd ? "day" : "unknown",
      blocked: task.status === "blocked",
      dataGap:
        task.status === "unassessed" || !task.ownerLabel || !task.plannedEnd,
      impactedGates: [gateLabel(milestone)].filter((label): label is string =>
        Boolean(label),
      ),
      navTaskId: task.id,
      navMilestoneId: task.milestoneId,
    });
  }

  for (const issue of management.issues) {
    if (!["open", "validating", "on_hold"].includes(issue.status)) continue;
    push({
      id: issue.id,
      kind: "issue",
      kindLabel: "論点",
      title: issue.title,
      ownerLabel: issue.ownerLabel,
      dueDate: issue.dueDate,
      dueDatePrecision: issue.dueDate ? "day" : "unknown",
      blocked: issue.status === "on_hold",
      dataGap: !issue.ownerLabel || !issue.dueDate,
      impactedGates: issueGateLabels(issue, milestoneBySlug),
      navIssueId: issue.id,
    });
  }

  for (const hypothesis of management.hypotheses) {
    if (!["open", "validating", "on_hold"].includes(hypothesis.status))
      continue;
    const issue = issueById.get(hypothesis.issueId);
    push({
      id: hypothesis.id,
      kind: "hypothesis",
      kindLabel: "仮説",
      title: hypothesis.statement,
      ownerLabel: hypothesis.ownerLabel,
      dueDate: hypothesis.dueDate,
      dueDatePrecision: hypothesis.dueDate ? "day" : "unknown",
      blocked: hypothesis.status === "on_hold",
      dataGap: !hypothesis.ownerLabel || !hypothesis.dueDate,
      impactedGates: issueGateLabels(issue, milestoneBySlug),
      navIssueId: hypothesis.issueId,
    });
  }

  for (const validation of management.validationRuns) {
    if (!["planned", "running", "blocked"].includes(validation.status))
      continue;
    const hypothesis = hypothesisById.get(validation.hypothesisId);
    const issue = hypothesis ? issueById.get(hypothesis.issueId) : undefined;
    push({
      id: validation.id,
      kind: "validation",
      kindLabel: "検証",
      title: validation.method || validation.validationKind,
      ownerLabel: validation.ownerLabel,
      dueDate: validation.dueDate,
      dueDatePrecision: validation.dueDate ? "day" : "unknown",
      blocked: validation.status === "blocked",
      dataGap: !validation.ownerLabel || !validation.dueDate,
      impactedGates: issueGateLabels(issue, milestoneBySlug),
      navIssueId: issue?.id ?? null,
    });
  }

  for (const decision of management.decisions) {
    if (!["open", "deferred"].includes(decision.status)) continue;
    const issue = decision.issueId
      ? issueById.get(decision.issueId)
      : undefined;
    push({
      id: decision.id,
      kind: "decision",
      kindLabel: "判断",
      title: decision.title,
      ownerLabel: decision.ownerLabel,
      dueDate: decision.dueDate,
      dueDatePrecision: decision.dueDate ? "day" : "unknown",
      blocked: decision.status === "deferred",
      dataGap: !decision.ownerLabel || !decision.dueDate,
      impactedGates: issueGateLabels(issue, milestoneBySlug),
      navIssueId: decision.issueId,
    });
  }

  for (const action of management.actions) {
    if (action.status === "completed") continue;
    const decision = decisionById.get(action.decisionId);
    const issue = decision?.issueId
      ? issueById.get(decision.issueId)
      : undefined;
    push({
      id: action.id,
      kind: "action",
      kindLabel: "アクション",
      title: action.title,
      ownerLabel: action.ownerLabel,
      dueDate: action.dueDate,
      dueDatePrecision: action.dueDate ? "day" : "unknown",
      blocked: action.status === "blocked",
      dataGap: !action.ownerLabel || !action.dueDate,
      impactedGates: issueGateLabels(issue, milestoneBySlug),
      navIssueId: issue?.id ?? null,
    });
  }

  for (const partner of management.partners) {
    const holdings = sxHoldingsForPartner(partner);
    if (holdings.length > 0) {
      for (const holding of holdings) {
        const milestone = holding.relatedMilestoneId
          ? milestoneById.get(holding.relatedMilestoneId)
          : undefined;
        push({
          id: holding.id,
          kind: "partner",
          kindLabel: `関係先｜${partner.name}`,
          title: holding.title,
          ownerLabel: holding.ownerLabel || "担当未確認",
          dueDate: holding.dueDate,
          dueDatePrecision: holding.dueDatePrecision,
          blocked: holding.status === "blocked",
          dataGap:
            !holding.ownerLabel || holding.dueDatePrecision === "unknown",
          impactedGates: [gateLabel(milestone)].filter(
            (label): label is string => Boolean(label),
          ),
          navPartnerId: partner.id,
          originResource: holding.originResource,
          recordId: holding.id,
          partnerId: partner.id,
        });
      }
      continue;
    }
    const fallback = sxPartnerPrimaryIntervention(partner, management.asOf);
    if (!fallback.hasConcreteAction && partner.currentBallSide === "none")
      continue;
    push({
      id: `partner:${partner.id}`,
      kind: "partner",
      kindLabel: `関係先｜${partner.name}`,
      title: fallback.title,
      ownerLabel: fallback.ownerLabel || "担当未確認",
      dueDate: fallback.dueDate,
      dueDatePrecision: fallback.dueDatePrecision,
      blocked: false,
      dataGap: true,
      impactedGates: [],
      navPartnerId: partner.id,
      originResource: "partner_next_action",
      recordId: partner.id,
      partnerId: partner.id,
    });
  }

  const byOwner = new Map<string, SxProjectWorkUnit[]>();
  for (const unit of units) {
    byOwner.set(unit.ownerLabel, [
      ...(byOwner.get(unit.ownerLabel) || []),
      unit,
    ]);
  }
  return Array.from(byOwner.entries())
    .map(([ownerLabel, items]) => ({
      ownerLabel,
      openCount: items.length,
      blockedCount: items.filter((item) => item.blocked).length,
      overdueCount: items.filter((item) => isOverdue(item, management.asOf))
        .length,
      dueSoonCount: items.filter((item) => isDueSoon(item, management.asOf))
        .length,
      dueUnsetCount: items.filter(
        (item) => item.dueDate == null || item.dueDatePrecision === "unknown",
      ).length,
      dataGapCount: items.filter((item) => item.dataGap).length,
      impactedGates: Array.from(
        new Set(items.flatMap((item) => item.impactedGates)),
      ),
      items: [...items].sort(sortUnits),
    }))
    .sort(
      (left, right) =>
        right.blockedCount - left.blockedCount ||
        right.overdueCount - left.overdueCount ||
        right.openCount - left.openCount ||
        left.ownerLabel.localeCompare(right.ownerLabel, "ja"),
    );
}
