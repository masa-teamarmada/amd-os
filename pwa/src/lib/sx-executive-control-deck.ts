/**
 * Pure derivation helpers for the SX PJ管制盤 (SxExecutiveControlDeck): the critical-path rail,
 * the intervention queue, and the upcoming-action queue. No React, no server-only import — plain
 * data in, plain data out, so this is unit-testable with `node --experimental-strip-types` and
 * safe to import from the client component. Never invents a critical path, owner, or ball side
 * that the source data doesn't have. Never displays "unassessed"/"unknown" as if it were "on
 * schedule" — those states always render as an explicit gray/amber/red state, never green.
 */
import {
  nominalizeSxActionLabel,
  nominalizeSxNextActionLabel,
} from "./sx-action-label.ts";
import { sxNormalizePublicName } from "./sx-name-normalize.ts";

export type SxEcdDatePrecision = "day" | "month" | "unknown";

/** Display boundary: real-name-normalize first, then nominalize action-like titles. Never
 * double-wraps owner fields (already normalized elsewhere). Raw underlying values are untouched —
 * this only ever runs at render/derive time on the outgoing row. */
function displayTarget(value: string): string {
  return nominalizeSxActionLabel(sxNormalizePublicName(value));
}

/** Same display boundary as displayTarget, but for multi-clause next-action text (partner
 * nextCommitment), which is allowed a single 、 joining two clauses. */
function displayNextAction(value: string): string {
  return nominalizeSxNextActionLabel(sxNormalizePublicName(value));
}

/** Precision-aware overdue check for a due date against `today` (both "YYYY-MM-DD"). A "day"
 * precision date is overdue only once it is strictly before today. A "month" precision date is
 * overdue only once the calendar month has fully passed — a day-1 placeholder within the current
 * month is NOT overdue, since the actual commitment could land any day that month. Unknown
 * precision and null dates are never overdue (nothing to be late against). */
export function sxEcdIsDueDateOverdue(
  dueDate: string | null,
  precision: SxEcdDatePrecision | undefined,
  today: string,
): boolean {
  if (!dueDate) return false;
  if (precision === "unknown") return false;
  if (precision === "month") {
    return dueDate.slice(0, 7) < today.slice(0, 7);
  }
  return dueDate < today;
}

export type SxEcdBallSide = "sx" | "partner" | "shared" | "none" | "unknown";
export type SxEcdActorSide = "sx" | "partner" | "shared" | "unknown";

export interface SxEcdMilestone {
  id: string;
  slug: string;
  title: string;
  gate: string;
  status: string;
  isBlocked: boolean;
  isOverdue: boolean;
  isStale: boolean;
  plannedEnd: string | null;
  forecastEnd: string | null;
  deltaDays: number | null;
  dateCertainty: "confirmed" | "provisional";
  ownerLabel: string;
  confidence: string;
  criticality: string;
  /** Management pillar key (事業/技術/資金/体制). Optional: older callers/tests omit it, and the
   * rail then simply carries `track: null` — never guessed. */
  track?: string | null;
  /** 計画開始日。統合タイムラインのバー描画に使う。省略時はバーを点（予定日tick）だけで描く。 */
  plannedStart?: string | null;
  /** 予測日を動かした理由。初期投入の仮置き（理由未確認）と、実際に見直した遅延を区別するために使う。 */
  forecastChangeReason?: string | null;
  /** 登録済みの進捗率。計画バーを「終わった分」と誤読させないため、進捗はこの値からだけ描く。 */
  progressPct?: number;
}

export interface SxEcdTechnicalTest {
  id: string;
  milestoneId: string | null;
  testName: string;
  status:
    "unassessed" | "planned" | "running" | "passed" | "failed" | "blocked";
  ownerLabel: string;
}

export interface SxEcdValidationRunItem {
  id: string;
  method: string;
  status: "planned" | "running" | "completed" | "blocked" | "cancelled";
  dueDate: string | null;
  ownerLabel: string;
}

export interface SxEcdActionItem {
  id: string;
  title: string;
  status: "open" | "in_progress" | "completed" | "blocked";
  dueDate: string | null;
  ownerLabel: string;
}

export interface SxEcdDecision {
  id: string;
  issueId: string | null;
  actionItems: SxEcdActionItem[];
}

export interface SxEcdIssue {
  id: string;
  slug: string;
  title: string;
  status: string;
  ownerLabel: string;
  dueDate: string | null;
  relatedMilestoneSlugs: string[];
  validationRuns: SxEcdValidationRunItem[];
  decisions: SxEcdDecision[];
}

export interface SxEcdPartnerWorkItem {
  id: string;
  partnerId: string;
  side: SxEcdActorSide;
  title: string;
  ownerLabel: string | null;
  status: string;
  dueDate: string | null;
  dueDatePrecision?: SxEcdDatePrecision;
  relatedMilestoneId: string | null;
}

export interface SxEcdPartner {
  id: string;
  slug: string;
  name: string;
  currentBallSide: SxEcdBallSide;
  currentBallOwner: string | null;
  relatedMilestoneSlugs: string[];
  nextCommitment: string | null;
  dueDate: string | null;
  dueDatePrecision?: SxEcdDatePrecision;
}

function isMissingOwnerText(value: string | null | undefined): boolean {
  const v = value ?? "";
  return (
    !v.trim() ||
    v.includes("未確認") ||
    v.includes("未設定") ||
    v.includes("未登録")
  );
}

function ownerOrUnconfirmed(value: string | null | undefined): string {
  return isMissingOwnerText(value)
    ? "未確認"
    : sxNormalizePublicName((value ?? "").trim());
}

// --- Critical path rail -----------------------------------------------------

/**
 * complete/current/future = neutral-to-positive progression, only ever green when nothing below
 * applies. unassessed = gray "要確認/未評価" (unassessed OR confidence unknown OR stale). attention
 * = amber "要注意". overdue = red/amber "期限超過". blocked = red "停止". Precedence (highest wins):
 * blocked > overdue > unassessed > attention > complete > current/future.
 */
export type SxEcdPathNodeState =
  | "complete"
  | "current"
  | "future"
  | "blocked"
  | "overdue"
  | "not_started"
  | "unassessed"
  | "attention";

export interface SxEcdPathNode {
  slug: string;
  state: SxEcdPathNodeState;
  isCurrent: boolean;
  title: string;
  gate: string;
  plannedEnd: string | null;
  forecastEnd: string | null;
  deltaDays: number | null;
  dateCertainty: "confirmed" | "provisional" | null;
  ownerLabel: string;
  milestoneId: string | null;
  /** Pillar key carried from the milestone (null when the source row doesn't have one). */
  track: string | null;
}

export interface SxEcdRailMarker {
  label: string;
  count: number;
}

export interface SxEcdCriticalPathRail {
  valid: boolean;
  reason: string | null;
  nodes: SxEcdPathNode[];
  visibleNodes: SxEcdPathNode[];
  leadingMarker: SxEcdRailMarker | null;
  trailingMarker: SxEcdRailMarker | null;
  hiddenCount: number;
  currentIndex: number;
}

function resolveNodeState(
  milestone: SxEcdMilestone,
  isCurrent: boolean,
): SxEcdPathNodeState {
  if (milestone.status === "completed") return "complete";
  if (milestone.isBlocked || milestone.status === "blocked") return "blocked";
  if (milestone.isOverdue) return "overdue";
  // 手入力の「未着手」は宣言された状態。期限超過・停止より弱く、推定 (unassessed) より強い。
  if (milestone.status === "not_started") return "not_started";
  const unknownConfidence =
    milestone.confidence === "unknown" || !milestone.confidence;
  if (
    milestone.status === "unassessed" ||
    unknownConfidence ||
    milestone.isStale
  )
    return "unassessed";
  if (milestone.status === "attention" || milestone.status === "at_risk")
    return "attention";
  // Never let a non-completed node with no known planned/forecast date render as if it were on
  // schedule (green current/future) — that would be a false claim of a confirmed timeline.
  if (!milestone.plannedEnd && !milestone.forecastEnd) return "unassessed";
  // A provisional (unconfirmed) date is never enough to claim "on schedule" (green). Surface it as
  // amber "attention" instead of current/future.
  if (milestone.dateCertainty === "provisional") return "attention";
  return isCurrent ? "current" : "future";
}

export function deriveSxCriticalPathRail(
  judgment: { dagValid: boolean; criticalPathSlugs: string[] },
  milestones: SxEcdMilestone[],
): SxEcdCriticalPathRail {
  if (!judgment.dagValid) {
    return {
      valid: false,
      reason: "依存関係不正",
      nodes: [],
      visibleNodes: [],
      leadingMarker: null,
      trailingMarker: null,
      hiddenCount: 0,
      currentIndex: -1,
    };
  }
  if (judgment.criticalPathSlugs.length === 0) {
    return {
      valid: false,
      reason: "重要経路未登録",
      nodes: [],
      visibleNodes: [],
      leadingMarker: null,
      trailingMarker: null,
      hiddenCount: 0,
      currentIndex: -1,
    };
  }

  const bySlug = new Map(
    milestones.map((milestone) => [milestone.slug, milestone]),
  );
  const slugs = judgment.criticalPathSlugs;

  let currentIndex = slugs.findIndex((slug) => {
    const milestone = bySlug.get(slug);
    return !milestone || milestone.status !== "completed";
  });
  if (currentIndex === -1) currentIndex = slugs.length;

  const nodes: SxEcdPathNode[] = slugs.map((slug, index) => {
    const milestone = bySlug.get(slug);
    const isCurrent = index === currentIndex;
    if (!milestone) {
      return {
        slug,
        state: "unassessed",
        isCurrent,
        title: slug,
        gate: "",
        plannedEnd: null,
        forecastEnd: null,
        deltaDays: null,
        dateCertainty: null,
        ownerLabel: "担当未確認",
        milestoneId: null,
        track: null,
      };
    }
    return {
      slug,
      state: resolveNodeState(milestone, isCurrent),
      isCurrent,
      title: displayTarget(milestone.title),
      gate: milestone.gate,
      plannedEnd: milestone.plannedEnd,
      forecastEnd: milestone.forecastEnd,
      deltaDays: milestone.deltaDays,
      dateCertainty: milestone.dateCertainty,
      ownerLabel: isMissingOwnerText(milestone.ownerLabel)
        ? "担当未確認"
        : sxNormalizePublicName(milestone.ownerLabel),
      milestoneId: milestone.id,
      track: milestone.track ?? null,
    };
  });

  const finalIndex = nodes.length - 1;
  let windowStart: number;
  let windowEnd: number;
  if (currentIndex >= nodes.length) {
    // Everything on the critical path is complete: show the tail (at most 1 previous + final).
    windowStart = Math.max(0, nodes.length - 2);
    windowEnd = nodes.length;
  } else {
    windowStart = Math.max(0, currentIndex - 1); // at most one previous-completed node
    windowEnd = Math.min(nodes.length, currentIndex + 1 + 3); // current + up to next 3
  }

  const leadingHiddenCount = windowStart; // all nodes before the window are completed (by construction)
  const finalIncluded = finalIndex >= windowStart && finalIndex < windowEnd;
  const trailingHiddenCount = finalIncluded
    ? 0
    : Math.max(0, finalIndex - windowEnd);

  const visibleNodes = nodes.slice(windowStart, windowEnd);
  if (!finalIncluded && finalIndex >= 0) visibleNodes.push(nodes[finalIndex]);

  const leadingMarker =
    leadingHiddenCount > 0
      ? { label: `+${leadingHiddenCount}完了`, count: leadingHiddenCount }
      : null;
  const trailingMarker =
    trailingHiddenCount > 0
      ? { label: `…${trailingHiddenCount}`, count: trailingHiddenCount }
      : null;

  return {
    valid: true,
    reason: null,
    nodes,
    visibleNodes,
    leadingMarker,
    trailingMarker,
    hiddenCount: leadingHiddenCount + trailingHiddenCount,
    currentIndex,
  };
}

// --- Intervention queue ------------------------------------------------------

export type SxEcdInterventionKind =
  | "critical_blocked"
  | "critical_overdue"
  | "technical_test_blocked"
  | "technical_test_unassessed"
  | "validation_run"
  | "action_item"
  | "partner_work_item"
  | "partner_fallback"
  | "issue_stalled"
  | "owner_unconfirmed"
  | "gate_stale"
  | "gate_unassessed";

export interface SxEcdInterventionRow {
  key: string;
  priority: number;
  kind: SxEcdInterventionKind;
  target: string;
  ballSide: string;
  ballOwner: string;
  dueDate: string | null;
  dueContextLabel: string | null;
  gate: string;
  anchor: string;
  entityType: "milestone" | "issue" | "partner" | "plan";
  entityId: string | null;
  milestoneId: string | null;
  track?: string;
  dateCertainty?: "confirmed" | "provisional" | null;
  dueDatePrecision?: SxEcdDatePrecision;
}

const BALL_SIDE_LABEL: Record<SxEcdBallSide, string> = {
  sx: "SX側",
  partner: "相手側",
  shared: "双方",
  none: "該当なし",
  unknown: "未確認",
};

function sortKey(row: SxEcdInterventionRow): string {
  const due = row.dueDate ?? "9999-99-99";
  return `${String(row.priority).padStart(2, "0")}|${due}|${row.target}`;
}

const ACTIVE_ACTION_STATUSES = new Set(["open", "in_progress"]);
const ACTIVE_VALIDATION_STATUSES = new Set(["planned", "running"]);
// Partner work-item intervention candidates: only statuses that represent live, unresolved work.
// completed/cancelled rows never surface here just because dueDate happens to be in the past —
// on_hold is deliberately excluded (no explicit spec/data justification found for treating a held
// item as a current intervention).
const ACTIVE_PARTNER_WORK_STATUSES = new Set([
  "open",
  "in_progress",
  "waiting",
  "blocked",
]);

export function deriveSxInterventionQueue(params: {
  today: string;
  criticalPathSlugs: string[];
  milestones: SxEcdMilestone[];
  technicalTests?: SxEcdTechnicalTest[];
  partnerWorkItems: SxEcdPartnerWorkItem[];
  partners: SxEcdPartner[];
  issues: SxEcdIssue[];
  /** 重要経路外の柱の現在ゲート。停止・期限超過・担当未確認・鮮度切れ・評価未完だけを、柱名を
   * 付けた介入候補として同じキューへ足す（最大遅延の柱がキューから消えないようにするため）。
   * 行の発明はしない — 該当条件が無い柱からは1行も出ない。 */
  pillarGates?: Array<{
    trackKey: string;
    trackLabel: string;
    milestoneId: string | null;
  }>;
  maxRows?: number;
}): { rows: SxEcdInterventionRow[]; totalCount: number; hiddenCount: number } {
  const {
    today,
    criticalPathSlugs,
    milestones,
    technicalTests = [],
    partnerWorkItems,
    partners,
    issues,
    pillarGates = [],
    maxRows = 4,
  } = params;
  const criticalSlugSet = new Set(criticalPathSlugs);
  const criticalMilestones = milestones.filter((milestone) =>
    criticalSlugSet.has(milestone.slug),
  );
  const criticalMilestoneIds = new Set(
    criticalMilestones.map((milestone) => milestone.id),
  );
  const milestoneById = new Map(
    milestones.map((milestone) => [milestone.id, milestone]),
  );
  const included = new Set<string>();
  const rows: SxEcdInterventionRow[] = [];

  const gateDueContext = (milestone: SxEcdMilestone | undefined) =>
    milestone
      ? {
          due: milestone.forecastEnd || milestone.plannedEnd,
          gate: milestone.gate,
        }
      : { due: null, gate: "" };

  // 1) Critical milestones directly blocked. dueDate = forecastEnd || plannedEnd (best-known date),
  //    with an explicit "予測期限" context label when the forecast is what's actually being shown,
  //    and dateCertainty carried through so the row can show a "仮" badge when provisional.
  for (const milestone of criticalMilestones) {
    if (milestone.isBlocked || milestone.status === "blocked") {
      included.add(milestone.id);
      const due = milestone.forecastEnd || milestone.plannedEnd;
      rows.push({
        key: `milestone-blocked-${milestone.id}`,
        priority: 1,
        kind: "critical_blocked",
        target: displayTarget(milestone.title),
        ballSide: "担当",
        ballOwner: ownerOrUnconfirmed(milestone.ownerLabel),
        dueDate: due,
        dueContextLabel: milestone.forecastEnd ? "予測期限" : null,
        gate: milestone.gate,
        anchor: "management-plan",
        entityType: "milestone",
        entityId: milestone.id,
        milestoneId: milestone.id,
        dateCertainty: milestone.dateCertainty,
      });
    }
  }

  // 2) Critical milestones overdue.
  for (const milestone of criticalMilestones) {
    if (included.has(milestone.id)) continue;
    if (milestone.isOverdue) {
      included.add(milestone.id);
      const due = milestone.forecastEnd || milestone.plannedEnd;
      rows.push({
        key: `milestone-overdue-${milestone.id}`,
        priority: 2,
        kind: "critical_overdue",
        target: displayTarget(milestone.title),
        ballSide: "担当",
        ballOwner: ownerOrUnconfirmed(milestone.ownerLabel),
        dueDate: due,
        dueContextLabel: milestone.forecastEnd ? "予測期限" : null,
        gate: milestone.gate,
        anchor: "management-plan",
        entityType: "milestone",
        entityId: milestone.id,
        milestoneId: milestone.id,
        dateCertainty: milestone.dateCertainty,
      });
    }
  }

  // 3) Technical tests linked to a critical milestone — exact test row, blocked/failed first,
  //    unassessed/unknown lower priority ("評価不能"). Tests have no own due date, so the row
  //    carries the parent gate's forecast/planned date with a visible "親ゲート期限" context label.
  for (const test of technicalTests) {
    if (!test.milestoneId || !criticalMilestoneIds.has(test.milestoneId))
      continue;
    const milestone = milestoneById.get(test.milestoneId);
    const { due, gate } = gateDueContext(milestone);
    if (test.status === "blocked" || test.status === "failed") {
      rows.push({
        key: `test-blocked-${test.id}`,
        priority: 1,
        kind: "technical_test_blocked",
        target: displayTarget(test.testName),
        ballSide: "担当",
        ballOwner: ownerOrUnconfirmed(test.ownerLabel),
        dueDate: due,
        dueContextLabel: "親ゲート期限",
        gate,
        anchor: "management-capacity",
        entityType: "milestone",
        entityId: test.milestoneId,
        milestoneId: test.milestoneId,
        dateCertainty: milestone?.dateCertainty,
      });
    } else if (test.status === "unassessed") {
      rows.push({
        key: `test-unassessed-${test.id}`,
        priority: 7,
        kind: "technical_test_unassessed",
        target: `${displayTarget(test.testName)}（評価不能）`,
        ballSide: "担当",
        ballOwner: ownerOrUnconfirmed(test.ownerLabel),
        dueDate: due,
        dueContextLabel: "親ゲート期限",
        gate,
        anchor: "management-capacity",
        entityType: "milestone",
        entityId: test.milestoneId,
        milestoneId: test.milestoneId,
        dateCertainty: milestone?.dateCertainty,
      });
    }
  }

  // 4) Validation runs + 5) action items derived individually from critical-linked issues.
  for (const issue of issues) {
    if (!issue.relatedMilestoneSlugs.some((slug) => criticalSlugSet.has(slug)))
      continue;
    const relatedSlug =
      issue.relatedMilestoneSlugs.find((slug) => criticalSlugSet.has(slug)) ??
      null;
    const relatedMilestone = relatedSlug
      ? milestones.find((entry) => entry.slug === relatedSlug)
      : undefined;

    for (const run of issue.validationRuns) {
      const isOverdue = Boolean(run.dueDate && run.dueDate < today);
      const isActive = ACTIVE_VALIDATION_STATUSES.has(run.status);
      if (run.status !== "blocked" && !(isActive && isOverdue)) continue;
      rows.push({
        key: `validation-${run.id}`,
        priority: 2,
        kind: "validation_run",
        target: displayTarget(run.method),
        ballSide: "担当",
        ballOwner: ownerOrUnconfirmed(run.ownerLabel),
        dueDate: run.dueDate,
        dueContextLabel: null,
        gate: relatedMilestone?.gate ?? "",
        anchor: `#sx-issue-${issue.id}`,
        entityType: "issue",
        entityId: issue.id,
        milestoneId: relatedMilestone?.id ?? null,
      });
    }

    for (const decision of issue.decisions) {
      for (const action of decision.actionItems) {
        const isOverdue = Boolean(action.dueDate && action.dueDate < today);
        const isActive = ACTIVE_ACTION_STATUSES.has(action.status);
        if (action.status !== "blocked" && !(isActive && isOverdue)) continue;
        rows.push({
          key: `action-${action.id}`,
          priority: 2,
          kind: "action_item",
          target: displayTarget(action.title),
          ballSide: "担当",
          ballOwner: ownerOrUnconfirmed(action.ownerLabel),
          dueDate: action.dueDate,
          dueContextLabel: null,
          gate: relatedMilestone?.gate ?? "",
          anchor: `#sx-issue-${issue.id}`,
          entityType: "issue",
          entityId: issue.id,
          milestoneId: relatedMilestone?.id ?? null,
        });
      }
    }
  }

  // 6) Partner work items: `item.side` + `item.ownerLabel` are the primary ball source, regardless
  //    of sx/partner/shared/unknown — SX-side work items are never hidden here. Only "active" work
  //    (open/in_progress/waiting/blocked) is ever a candidate — completed/cancelled/on_hold rows
  //    never surface as a current intervention just because dueDate is in the past.
  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));
  const isQualifyingActiveWorkItem = (item: SxEcdPartnerWorkItem): boolean => {
    if (!ACTIVE_PARTNER_WORK_STATUSES.has(item.status)) return false;
    const isBlockedOrWaiting =
      item.status === "blocked" || item.status === "waiting";
    const isOverdue = sxEcdIsDueDateOverdue(
      item.dueDate,
      item.dueDatePrecision,
      today,
    );
    return isBlockedOrWaiting || isOverdue;
  };
  for (const item of partnerWorkItems) {
    if (
      !item.relatedMilestoneId ||
      !criticalMilestoneIds.has(item.relatedMilestoneId)
    )
      continue;
    if (!isQualifyingActiveWorkItem(item)) continue;
    const partner = partnerById.get(item.partnerId);
    const milestone = milestoneById.get(item.relatedMilestoneId);
    const sideLabel: Record<SxEcdActorSide, string> = {
      sx: "SX側",
      partner: "相手側",
      shared: "双方",
      unknown: "未確認",
    };
    rows.push({
      key: `work-item-${item.id}`,
      priority: 3,
      kind: "partner_work_item",
      target: `${sxNormalizePublicName(partner?.name ?? "相手先名未確認")} — ${displayTarget(item.title)}`,
      ballSide: sideLabel[item.side] ?? "未確認",
      ballOwner: ownerOrUnconfirmed(item.ownerLabel),
      dueDate: item.dueDate,
      dueContextLabel: null,
      gate: milestone?.gate ?? "",
      anchor: `#sx-partner-${item.partnerId}`,
      entityType: "partner",
      entityId: partner?.id ?? item.partnerId,
      milestoneId: item.relatedMilestoneId,
      dueDatePrecision: item.dueDatePrecision,
    });
  }

  // 6b) Critical-linked partner fallback: partner has no directly-linked *active, qualifying*
  //     critical work item, its relatedMilestoneSlugs intersect the critical path, the current ball
  //     is on the partner/shared/unknown/sx side (i.e. anything except explicitly "none"), and it
  //     has an active dueDate/nextCommitment. Covers records lacking relatedMilestoneId without
  //     inventing a milestone link that isn't in the data. A historical/completed work item must
  //     never suppress this fallback — only an active, currently-qualifying one may.
  const directlyLinkedPartnerIds = new Set(
    partnerWorkItems
      .filter(
        (item) =>
          item.relatedMilestoneId &&
          criticalMilestoneIds.has(item.relatedMilestoneId),
      )
      .filter((item) => isQualifyingActiveWorkItem(item))
      .map((item) => item.partnerId),
  );
  for (const partner of partners) {
    if (directlyLinkedPartnerIds.has(partner.id)) continue;
    if (
      !partner.relatedMilestoneSlugs.some((slug) => criticalSlugSet.has(slug))
    )
      continue;
    if (partner.currentBallSide === "none") continue;
    const hasActiveDue = Boolean(partner.dueDate);
    const hasCommitment = Boolean(
      partner.nextCommitment && partner.nextCommitment.trim(),
    );
    if (!hasActiveDue && !hasCommitment) continue;
    const isOverdue = sxEcdIsDueDateOverdue(
      partner.dueDate,
      partner.dueDatePrecision,
      today,
    );
    if (!isOverdue && !hasCommitment) continue;
    const relatedSlug = partner.relatedMilestoneSlugs.find((slug) =>
      criticalSlugSet.has(slug),
    );
    const relatedMilestone = relatedSlug
      ? milestones.find((entry) => entry.slug === relatedSlug)
      : undefined;
    rows.push({
      key: `partner-fallback-${partner.id}`,
      priority: 4,
      kind: "partner_fallback",
      target: `${sxNormalizePublicName(partner.name)} — ${partner.nextCommitment ? displayNextAction(partner.nextCommitment) : "次の一手未確認"}`,
      ballSide: BALL_SIDE_LABEL[partner.currentBallSide],
      ballOwner: ownerOrUnconfirmed(partner.currentBallOwner),
      dueDate: partner.dueDate,
      dueContextLabel: null,
      gate: relatedMilestone?.gate ?? "",
      anchor: `#sx-partner-${partner.id}`,
      entityType: "partner",
      entityId: partner.id,
      milestoneId: relatedMilestone?.id ?? null,
      dueDatePrecision: partner.dueDatePrecision,
    });
  }

  // 7) Issue-level stall fallback (issue overdue without an individually-derivable validation/action).
  for (const issue of issues) {
    if (!issue.relatedMilestoneSlugs.some((slug) => criticalSlugSet.has(slug)))
      continue;
    const alreadyCovered = rows.some(
      (row) => row.entityType === "issue" && row.entityId === issue.id,
    );
    if (alreadyCovered) continue;
    const isOverdue = Boolean(
      issue.dueDate &&
      issue.dueDate < today &&
      issue.status !== "closed" &&
      issue.status !== "decided",
    );
    if (!isOverdue) continue;
    const relatedSlug =
      issue.relatedMilestoneSlugs.find((slug) => criticalSlugSet.has(slug)) ??
      null;
    const relatedMilestone = relatedSlug
      ? milestones.find((entry) => entry.slug === relatedSlug)
      : undefined;
    rows.push({
      key: `issue-${issue.id}`,
      priority: 5,
      kind: "issue_stalled",
      target: displayTarget(issue.title),
      ballSide: "担当",
      ballOwner: ownerOrUnconfirmed(issue.ownerLabel),
      dueDate: issue.dueDate,
      dueContextLabel: null,
      gate: relatedMilestone?.gate ?? "",
      anchor: `#sx-issue-${issue.id}`,
      entityType: "issue",
      entityId: issue.id,
      milestoneId: relatedMilestone?.id ?? null,
    });
  }

  // 8) Owner-unconfirmed / stale / unassessed critical milestones (never disappear as if the
  //    project were clear). These three causes are kept as distinct kinds — collapsing them into a
  //    single "owner_unconfirmed" bucket would hide a known owner behind "未確認" and make a
  //    stale/unassessed gate look like a missing-owner problem instead of what it actually is.
  //    Owner-missing takes precedence (it's the more actionable gap); otherwise stale beats
  //    unassessed since staleness means data exists but is out of date, vs. never evaluated.
  for (const milestone of criticalMilestones) {
    if (included.has(milestone.id)) continue;
    const ownerMissing = isMissingOwnerText(milestone.ownerLabel);
    const unassessed =
      milestone.confidence === "unknown" || milestone.status === "unassessed";
    if (!ownerMissing && !milestone.isStale && !unassessed) continue;
    const kind: SxEcdInterventionKind = ownerMissing
      ? "owner_unconfirmed"
      : milestone.isStale
        ? "gate_stale"
        : "gate_unassessed";
    const due = milestone.forecastEnd || milestone.plannedEnd;
    rows.push({
      key: `milestone-owner-${milestone.id}`,
      priority: 6,
      kind,
      target: displayTarget(milestone.title),
      ballSide: "担当",
      ballOwner: ownerOrUnconfirmed(milestone.ownerLabel),
      dueDate: due,
      dueContextLabel: milestone.forecastEnd ? "予測期限" : null,
      gate: milestone.gate,
      anchor: "management-plan",
      entityType: "milestone",
      entityId: milestone.id,
      milestoneId: milestone.id,
      dateCertainty: milestone.dateCertainty,
    });
  }

  // 9) 重要経路外の柱の現在ゲート: 停止 / 期限超過 / 担当未確認 / 鮮度切れ / 評価未完だけを、
  //    柱名プレフィックス付きで足す。既に重要経路として扱った行と重複させない。
  for (const gate of pillarGates) {
    if (!gate.milestoneId) continue;
    const milestone = milestoneById.get(gate.milestoneId);
    if (
      !milestone ||
      criticalSlugSet.has(milestone.slug) ||
      included.has(milestone.id)
    )
      continue;
    const due = milestone.forecastEnd || milestone.plannedEnd;
    const base = {
      target: `【${gate.trackLabel}】${displayTarget(milestone.title)}`,
      ballSide: "担当",
      ballOwner: ownerOrUnconfirmed(milestone.ownerLabel),
      dueDate: due,
      dueContextLabel: milestone.forecastEnd ? ("予測期限" as const) : null,
      gate: milestone.gate,
      anchor: "management-plan",
      entityType: "milestone" as const,
      entityId: milestone.id,
      milestoneId: milestone.id,
      track: gate.trackKey,
      dateCertainty: milestone.dateCertainty,
    };
    if (milestone.isBlocked || milestone.status === "blocked") {
      rows.push({
        key: `pillar-blocked-${milestone.id}`,
        priority: 1,
        kind: "critical_blocked",
        ...base,
      });
      continue;
    }
    if (milestone.isOverdue) {
      rows.push({
        key: `pillar-overdue-${milestone.id}`,
        priority: 2,
        kind: "critical_overdue",
        ...base,
      });
      continue;
    }
    const ownerMissing = isMissingOwnerText(milestone.ownerLabel);
    const unassessed =
      milestone.confidence === "unknown" || milestone.status === "unassessed";
    if (!ownerMissing && !milestone.isStale && !unassessed) continue;
    const kind: SxEcdInterventionKind = ownerMissing
      ? "owner_unconfirmed"
      : milestone.isStale
        ? "gate_stale"
        : "gate_unassessed";
    rows.push({
      key: `pillar-gap-${milestone.id}`,
      priority: 6,
      kind,
      ...base,
    });
  }

  const sorted = [...rows].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  return {
    rows: sorted.slice(0, maxRows),
    totalCount: sorted.length,
    hiddenCount: Math.max(0, sorted.length - maxRows),
  };
}

// --- Upcoming-action queue ---------------------------------------------------

export type SxEcdUpcomingWindow =
  "overdue" | "within_7" | "within_14" | "within_30" | "later" | "unset";

export interface SxEcdUpcomingRow {
  key: string;
  dedupeKey: string;
  label: string;
  ownerLabel: string;
  dueDate: string | null;
  window: SxEcdUpcomingWindow;
  gate: string | null;
  criticalLinked: boolean;
  isBlocked: boolean;
  anchor: string;
}

const WINDOW_LABEL: Record<SxEcdUpcomingWindow, string> = {
  overdue: "期限超過",
  within_7: "7日以内",
  within_14: "14日以内",
  within_30: "30日以内",
  later: "期限先",
  unset: "期限未設定",
};

const WINDOW_ORDER: SxEcdUpcomingWindow[] = [
  "overdue",
  "within_7",
  "within_14",
  "within_30",
  "later",
  "unset",
];

function classifyWindow(
  dueDate: string | null,
  today: string,
): SxEcdUpcomingWindow {
  if (!dueDate) return "unset";
  if (dueDate < today) return "overdue";
  const days = Math.round(
    (Date.parse(`${dueDate}T00:00:00.000Z`) -
      Date.parse(`${today}T00:00:00.000Z`)) /
      86400000,
  );
  if (days <= 7) return "within_7";
  if (days <= 14) return "within_14";
  if (days <= 30) return "within_30";
  return "later";
}

export function sxUpcomingWindowLabel(window: SxEcdUpcomingWindow): string {
  return WINDOW_LABEL[window];
}

export function deriveSxUpcomingQueue(params: {
  today: string;
  criticalPathSlugs: string[];
  milestones: SxEcdMilestone[];
  actions: Array<{
    id: string;
    title: string;
    ownerLabel: string;
    dueDate: string | null;
    status: string;
    issueId?: string | null;
  }>;
  decisions: Array<{
    id: string;
    title: string;
    ownerLabel: string;
    dueDate: string | null;
    status: string;
    issueId: string | null;
  }>;
  validationRuns: Array<{
    id: string;
    method: string;
    ownerLabel: string;
    dueDate: string | null;
    status: string;
    hypothesisId?: string | null;
    issueId?: string | null;
  }>;
  issues: SxEcdIssue[];
  excludeKeys?: Set<string>;
  maxRows?: number;
}): { rows: SxEcdUpcomingRow[]; totalCount: number } {
  const {
    today,
    criticalPathSlugs,
    milestones,
    actions,
    decisions,
    validationRuns,
    issues,
    excludeKeys,
    maxRows = 3,
  } = params;
  const criticalSlugSet = new Set(criticalPathSlugs);
  const milestoneBySlug = new Map(
    milestones.map((milestone) => [milestone.slug, milestone]),
  );
  const issueById = new Map(issues.map((issue) => [issue.id, issue]));

  const criticalGateFor = (
    issueId: string | null | undefined,
  ): string | null => {
    if (!issueId) return null;
    const issue = issueById.get(issueId);
    if (!issue) return null;
    const slug = issue.relatedMilestoneSlugs.find((s) =>
      criticalSlugSet.has(s),
    );
    if (!slug) return null;
    return milestoneBySlug.get(slug)?.gate ?? null;
  };

  const rows: SxEcdUpcomingRow[] = [];

  for (const action of actions) {
    if (action.status === "completed") continue;
    const dedupeKey = `action-${action.id}`;
    if (excludeKeys?.has(dedupeKey)) continue;
    const gate = criticalGateFor(action.issueId);
    rows.push({
      key: dedupeKey,
      dedupeKey,
      label: displayTarget(action.title),
      ownerLabel: ownerOrUnconfirmed(action.ownerLabel),
      dueDate: action.dueDate,
      window: classifyWindow(action.dueDate, today),
      gate,
      criticalLinked: Boolean(gate),
      isBlocked: action.status === "blocked",
      anchor: action.issueId
        ? `#sx-issue-${action.issueId}`
        : "management-plan",
    });
  }

  for (const decision of decisions) {
    if (decision.status !== "open") continue;
    const dedupeKey = `decision-${decision.id}`;
    if (excludeKeys?.has(dedupeKey)) continue;
    const gate = criticalGateFor(decision.issueId);
    rows.push({
      key: dedupeKey,
      dedupeKey,
      label: displayTarget(decision.title),
      ownerLabel: ownerOrUnconfirmed(decision.ownerLabel),
      dueDate: decision.dueDate,
      window: classifyWindow(decision.dueDate, today),
      gate,
      criticalLinked: Boolean(gate),
      isBlocked: false,
      anchor: decision.issueId
        ? `#sx-issue-${decision.issueId}`
        : "management-plan",
    });
  }

  for (const run of validationRuns) {
    if (run.status !== "planned" && run.status !== "running") continue;
    const dedupeKey = `validation-${run.id}`;
    if (excludeKeys?.has(dedupeKey)) continue;
    const gate = criticalGateFor(run.issueId);
    rows.push({
      key: dedupeKey,
      dedupeKey,
      label: displayTarget(run.method),
      ownerLabel: ownerOrUnconfirmed(run.ownerLabel),
      dueDate: run.dueDate,
      window: classifyWindow(run.dueDate, today),
      gate,
      criticalLinked: Boolean(gate),
      isBlocked: false,
      anchor: run.issueId ? `#sx-issue-${run.issueId}` : "management-plan",
    });
  }

  const sorted = [...rows].sort((a, b) => {
    const windowDiff =
      WINDOW_ORDER.indexOf(a.window) - WINDOW_ORDER.indexOf(b.window);
    if (windowDiff !== 0) return windowDiff;
    const criticalDiff = Number(b.criticalLinked) - Number(a.criticalLinked);
    if (criticalDiff !== 0) return criticalDiff;
    const blockedDiff = Number(b.isBlocked) - Number(a.isBlocked);
    if (blockedDiff !== 0) return blockedDiff;
    const due = (a.dueDate ?? "9999-99-99").localeCompare(
      b.dueDate ?? "9999-99-99",
    );
    if (due !== 0) return due;
    return a.label.localeCompare(b.label);
  });

  return { rows: sorted.slice(0, maxRows), totalCount: sorted.length };
}

// --- State map (経営状況図) ----------------------------------------------------

/** Intervention kinds that represent a live external stoppage — someone or some org actually
 * holding a ball. These render as flags attached to the path node they stop. Everything else
 * (owner missing / stale / unassessed) is a data-gap about the node itself and renders as a state
 * mark ON the node, never as a third-party flag. */
const FLAG_KINDS = new Set<SxEcdInterventionKind>([
  "critical_blocked",
  "critical_overdue",
  "technical_test_blocked",
  "validation_run",
  "action_item",
  "partner_work_item",
  "partner_fallback",
  "issue_stalled",
]);

export type SxEcdBlockerClass = "flag" | "state";

export interface SxEcdMapBlocker {
  key: string;
  /** 1..topCount when the row is in the 次の経営介入 top list, else null. The same rank number is
   * shown on the map flag and in the intervention list so both views point at the same fact. */
  rank: number | null;
  blockerClass: SxEcdBlockerClass;
  kind: SxEcdInterventionKind;
  target: string;
  ballSide: string;
  ballOwner: string;
  dueDate: string | null;
  dueDatePrecision?: SxEcdDatePrecision;
  dueContextLabel: string | null;
  dateCertainty?: "confirmed" | "provisional" | null;
  gate: string;
  anchor: string;
  entityType: SxEcdInterventionRow["entityType"];
  entityId: string | null;
  milestoneId: string | null;
}

export interface SxEcdMapNode {
  node: SxEcdPathNode;
  /** Days between this node's effective date (forecast || planned) and the previous visible
   * node's. Null when either side has no date — the component then falls back to equal spacing
   * instead of inventing a distance. Negative raw values are clamped to 0. */
  gapDaysFromPrev: number | null;
  flags: SxEcdMapBlocker[];
  stateMarks: SxEcdMapBlocker[];
}

export interface SxEcdStateMap {
  valid: boolean;
  reason: string | null;
  nodes: SxEcdMapNode[];
  leadingMarker: SxEcdRailMarker | null;
  trailingMarker: SxEcdRailMarker | null;
  /** Visible index of the current node (the one the 今日 marker precedes), -1 when every node is
   * complete or the rail is invalid. */
  todayIndex: number;
  /** Rows whose milestoneId doesn't resolve to a visible node (null, hidden completed, or beyond
   * the trailing gap). Never dropped — an unplaceable stoppage still exists. */
  unattached: SxEcdMapBlocker[];
  /** 次の経営介入: top rows of the full sorted queue, ranked 1..topCount. */
  top: SxEcdMapBlocker[];
  totalCount: number;
}

function toMapBlocker(
  row: SxEcdInterventionRow,
  rank: number | null,
): SxEcdMapBlocker {
  return {
    key: row.key,
    rank,
    blockerClass: FLAG_KINDS.has(row.kind) ? "flag" : "state",
    kind: row.kind,
    target: row.target,
    ballSide: row.ballSide,
    ballOwner: row.ballOwner,
    dueDate: row.dueDate,
    dueDatePrecision: row.dueDatePrecision,
    dueContextLabel: row.dueContextLabel,
    dateCertainty: row.dateCertainty,
    gate: row.gate,
    anchor: row.anchor,
    entityType: row.entityType,
    entityId: row.entityId,
    milestoneId: row.milestoneId,
  };
}

function diffDaysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) /
      86400000,
  );
}

/**
 * Builds the 経営状況図 model: the visible critical-path nodes with time-proportional gaps, every
 * live stoppage attached to the exact node it stops (flags), node-data gaps attached as state
 * marks, and the ranked 次の経営介入 list cross-referenced by the same rank numbers. Pure data-in
 * data-out. Attachment only ever uses the row's own milestoneId — a row that doesn't resolve to a
 * visible node goes to `unattached`, never guessed onto some node.
 */
export function deriveSxStateMap(params: {
  rail: SxEcdCriticalPathRail;
  interventionRows: SxEcdInterventionRow[];
  totalCount: number;
  topCount?: number;
}): SxEcdStateMap {
  const { rail, interventionRows, totalCount, topCount = 3 } = params;
  if (!rail.valid) {
    const top = interventionRows
      .slice(0, topCount)
      .map((row, index) => toMapBlocker(row, index + 1));
    return {
      valid: false,
      reason: rail.reason,
      nodes: [],
      leadingMarker: null,
      trailingMarker: null,
      todayIndex: -1,
      unattached: interventionRows.map((row, index) =>
        toMapBlocker(row, index < topCount ? index + 1 : null),
      ),
      top,
      totalCount,
    };
  }

  const blockers = interventionRows.map((row, index) =>
    toMapBlocker(row, index < topCount ? index + 1 : null),
  );
  const visibleIds = new Set(
    rail.visibleNodes.map((node) => node.milestoneId).filter(Boolean),
  );
  const unattached = blockers.filter(
    (blocker) => !blocker.milestoneId || !visibleIds.has(blocker.milestoneId),
  );

  const nodes: SxEcdMapNode[] = rail.visibleNodes.map((node, index) => {
    const own = blockers.filter(
      (blocker) =>
        blocker.milestoneId && blocker.milestoneId === node.milestoneId,
    );
    let gapDaysFromPrev: number | null = null;
    if (index > 0) {
      const prev = rail.visibleNodes[index - 1];
      const prevDate = prev.forecastEnd || prev.plannedEnd;
      const ownDate = node.forecastEnd || node.plannedEnd;
      if (prevDate && ownDate)
        gapDaysFromPrev = Math.max(0, diffDaysBetween(prevDate, ownDate));
    }
    return {
      node,
      gapDaysFromPrev,
      flags: own.filter((blocker) => blocker.blockerClass === "flag"),
      stateMarks: own.filter((blocker) => blocker.blockerClass === "state"),
    };
  });

  return {
    valid: true,
    reason: null,
    nodes,
    leadingMarker: rail.leadingMarker,
    trailingMarker: rail.trailingMarker,
    todayIndex: rail.visibleNodes.findIndex((node) => node.isCurrent),
    unattached,
    top: blockers.slice(0, topCount),
    totalCount,
  };
}

// --- Slip classification (期限超過 / 確認済み遅延 / 仮置きの予測差) ---------------

/**
 * 「予定より後ろ」を3つに分ける。実測の遅れと、初期投入の仮置き予測を同じ「遅延」と呼ばない。
 * - overdue: 予定日を過ぎているのに完了していない（＝実際に遅れている）
 * - confirmed_slip: 予測が予定より後ろ、かつ日付が確定扱い or 見直し理由が登録済み（＝根拠のある遅延見込み）
 * - provisional_slip: 予測が予定より後ろだが、仮日程で見直し理由も未確認（＝まだ遅延と呼べない予測差）
 * - none: 差がない、または予測が予定以内
 */
export type SxEcdSlipKind =
  "overdue" | "confirmed_slip" | "provisional_slip" | "none";

/** 見直し理由として実質的な中身がない（初期投入の定型文・未確認）と判定する。 */
function isPlaceholderForecastReason(
  reason: string | null | undefined,
): boolean {
  const value = (reason ?? "").trim();
  if (!value) return true;
  return (
    value.includes("未確認") ||
    value.includes("仮置き") ||
    value.includes("初期Seed") ||
    value.includes("初期seed")
  );
}

export function sxEcdClassifySlip(
  milestone: Pick<
    SxEcdMilestone,
    | "status"
    | "plannedEnd"
    | "forecastEnd"
    | "deltaDays"
    | "dateCertainty"
    | "isOverdue"
    | "forecastChangeReason"
  >,
  today: string,
): SxEcdSlipKind {
  if (milestone.status === "completed") return "none";
  const plannedOverdue = Boolean(
    milestone.plannedEnd && milestone.plannedEnd < today,
  );
  if (milestone.isOverdue || plannedOverdue) return "overdue";
  if (milestone.deltaDays == null || milestone.deltaDays <= 0) return "none";
  const confirmedDate = milestone.dateCertainty === "confirmed";
  const hasRealReason = !isPlaceholderForecastReason(
    milestone.forecastChangeReason,
  );
  return confirmedDate || hasRealReason ? "confirmed_slip" : "provisional_slip";
}

// --- Verdict summary (判定バー4値) ---------------------------------------------

export interface SxEcdVerdictBusinessCell {
  /** e.g. 停止 2件 / 期限超過 1件 / 遅延見込み +28日 / オンスケ / 判定不能 */
  label: string;
  tone: "ok" | "warn" | "bad" | "unknown";
  /** e.g. 最大 資金+35日 — the largest pillar delay when it exceeds the critical-path delay. */
  detail: string | null;
  provisional: boolean;
}

export interface SxEcdVerdictSummary {
  business: SxEcdVerdictBusinessCell;
  operations: {
    verdictLabel: string;
    completenessPct: number;
    criticalUnknownCount: number;
    blockedCount: number;
  };
  step2: { label: string; known: boolean };
  countdown: { days: number | null; targetDate: string | null };
}

/**
 * 判定バーの4値を導出する。業務判定（重要経路の停止・期限超過・遅延見込み）と運用判定（データ
 * 充足）を分離し、「データが埋まっていない」を事業の危機や順調へ変換しない。STEP2消化は確認
 * できた金額があるときだけ数字を出し、なければ「未確認」に閉じる。
 */
export function deriveSxVerdictSummary(params: {
  today: string;
  judgment: {
    key: string;
    dagValid: boolean;
    completenessPct: number;
    criticalUnknownCount: number;
    blockedCount: number;
  };
  criticalPathSlugs: string[];
  milestones: SxEcdMilestone[];
  tracks: Array<{
    key: string;
    shortLabel: string;
    deltaDays: number | null;
    dateCertainty: "confirmed" | "provisional" | null;
  }>;
  objectiveTargetDate: string | null;
  funding: {
    requiredAmount: number | null;
    securedAmount: number | null;
  } | null;
}): SxEcdVerdictSummary {
  const {
    today,
    judgment,
    criticalPathSlugs,
    milestones,
    tracks,
    objectiveTargetDate,
    funding,
  } = params;
  const criticalSet = new Set(criticalPathSlugs);
  const critical = milestones.filter((milestone) =>
    criticalSet.has(milestone.slug),
  );

  const maxPillar = tracks.reduce<{
    shortLabel: string;
    deltaDays: number;
    provisional: boolean;
  } | null>((best, track) => {
    if (track.deltaDays == null || track.deltaDays <= 0) return best;
    if (best && best.deltaDays >= track.deltaDays) return best;
    return {
      shortLabel: track.shortLabel,
      deltaDays: track.deltaDays,
      provisional: track.dateCertainty === "provisional",
    };
  }, null);

  let business: SxEcdVerdictBusinessCell;
  if (
    !judgment.dagValid ||
    criticalPathSlugs.length === 0 ||
    critical.length === 0
  ) {
    business = {
      label: "判定不能",
      tone: "unknown",
      detail: null,
      provisional: false,
    };
  } else {
    const blocked = critical.filter(
      (milestone) => milestone.isBlocked || milestone.status === "blocked",
    );
    const slips = critical
      .filter((milestone) => !blocked.includes(milestone))
      .map((milestone) => ({
        milestone,
        kind: sxEcdClassifySlip(milestone, today),
      }));
    const overdue = slips.filter((entry) => entry.kind === "overdue");
    const confirmedSlips = slips.filter(
      (entry) => entry.kind === "confirmed_slip",
    );
    const provisionalSlips = slips.filter(
      (entry) => entry.kind === "provisional_slip",
    );
    const maxOf = (entries: typeof slips) =>
      entries.reduce(
        (max, entry) => Math.max(max, entry.milestone.deltaDays ?? 0),
        0,
      );
    const allDatesKnown = critical.every(
      (milestone) =>
        milestone.plannedEnd ||
        milestone.forecastEnd ||
        milestone.status === "completed",
    );
    if (blocked.length > 0) {
      business = {
        label: `停止 ${blocked.length}件`,
        tone: "bad",
        detail: null,
        provisional: false,
      };
    } else if (overdue.length > 0) {
      business = {
        label: `期限超過 ${overdue.length}件`,
        tone: "bad",
        detail: null,
        provisional: false,
      };
    } else if (confirmedSlips.length > 0) {
      business = {
        label: `予定より最大${maxOf(confirmedSlips)}日遅れ見込み`,
        tone: "warn",
        detail:
          maxPillar && maxPillar.deltaDays > maxOf(confirmedSlips)
            ? `最大 ${maxPillar.shortLabel}+${maxPillar.deltaDays}日`
            : null,
        provisional: false,
      };
    } else if (provisionalSlips.length > 0) {
      // 仮日程どうしの差を「遅れ」と言い切らない。実際の遅れ（期限超過）が0件であることを主語にする。
      business = {
        label: "実際の遅れなし",
        tone: "unknown",
        detail: `仮置きの見込みは予定より最大${maxOf(provisionalSlips)}日遅れ`,
        provisional: true,
      };
    } else if (!allDatesKnown) {
      business = {
        label: "判定不能",
        tone: "unknown",
        detail: null,
        provisional: false,
      };
    } else {
      const confirmedOnTrack = critical.every(
        (milestone) =>
          milestone.status === "completed" ||
          (milestone.dateCertainty === "confirmed" &&
            milestone.status !== "unassessed" &&
            milestone.confidence !== "unknown"),
      );
      business = confirmedOnTrack
        ? { label: "オンスケ", tone: "ok", detail: null, provisional: false }
        : {
            label: "判定不能",
            tone: "unknown",
            detail: maxPillar
              ? `最大 ${maxPillar.shortLabel}+${maxPillar.deltaDays}日`
              : null,
            provisional: false,
          };
    }
  }

  const hasFundingAmounts = Boolean(
    funding &&
    (funding.requiredAmount != null || funding.securedAmount != null),
  );
  const step2 =
    hasFundingAmounts && funding
      ? {
          label: `確保 ${funding.securedAmount != null ? `${Math.round(funding.securedAmount / 10000)}万円` : "未確認"} / 必要 ${funding.requiredAmount != null ? `${Math.round(funding.requiredAmount / 10000)}万円` : "未確認"}`,
          known: true,
        }
      : { label: "未確認", known: false };

  const countdownDays = objectiveTargetDate
    ? diffDaysBetween(today, objectiveTargetDate)
    : null;

  return {
    business,
    operations: {
      verdictLabel: sxVerdictDisplayLabel(judgment.key),
      completenessPct: judgment.completenessPct,
      criticalUnknownCount: judgment.criticalUnknownCount,
      blockedCount: judgment.blockedCount,
    },
    step2,
    countdown: { days: countdownDays, targetDate: objectiveTargetDate },
  };
}

// --- Unified timeline (統合タイムライン) ----------------------------------------

export interface SxEcdTimelineRow {
  milestoneId: string;
  slug: string;
  title: string;
  track: string | null;
  state: SxEcdPathNodeState;
  /** 期限超過 / 根拠のある遅延見込み / 仮置きの予測差 / 差なし。表示トーンと語を決める。 */
  slipKind: SxEcdSlipKind;
  isCritical: boolean;
  isCurrent: boolean;
  plannedStart: string | null;
  plannedEnd: string | null;
  forecastEnd: string | null;
  plannedStartPct: number | null;
  plannedEndPct: number | null;
  forecastPct: number | null;
  deltaDays: number | null;
  dateCertainty: "confirmed" | "provisional" | null;
  ownerLabel: string;
  gate: string;
  /** 登録済みの進捗率（0-100）。未登録・未評価は0のまま。計画期間の長さとは無関係。 */
  progressPct: number;
}

export interface SxEcdTimelineLane {
  key: string;
  label: string;
  shortLabel: string;
  accent: string;
  deltaDays: number | null;
  dateCertainty: "confirmed" | "provisional" | null;
  maxIssue: string;
  rows: SxEcdTimelineRow[];
  /** レーン内の最も重い状態（overdue > confirmed_slip > provisional_slip > none）。 */
  slipKind: SxEcdSlipKind;
}

export interface SxEcdTimelinePin {
  key: string;
  rank: number;
  target: string;
  ballSide: string;
  ballOwner: string;
  dueDate: string;
  duePct: number;
  dueDatePrecision?: SxEcdDatePrecision;
  anchor: string;
  /** 止まるゲート。ピンにカーソルを合わせただけで介入の中身が読めるようにするため持たせる。 */
  gate: string;
  /** amber pin = 相手側/双方が持つボール、ink pin = 当方・担当側、hollow = ボール未確認。 */
  side: "partner" | "sx" | "unknown";
}

export interface SxEcdTimelineMonth {
  label: string;
  /** 年が変わる月と先頭月だけ `2026年`。それ以外は null。月ラベルより上の段へ描く。 */
  yearLabel: string | null;
  pct: number;
  isYearStart: boolean;
}

export interface SxEcdUnifiedTimeline {
  valid: boolean;
  reason: string | null;
  domainStart: string;
  domainEnd: string;
  todayPct: number;
  objectivePct: number | null;
  objectiveDate: string | null;
  months: SxEcdTimelineMonth[];
  lanes: SxEcdTimelineLane[];
  /** criticalPathSlugs 順の接続点（レーンindex・レーン内rowindex・x位置%）。連結線の描画用。 */
  criticalPoints: Array<{
    slug: string;
    laneIndex: number;
    rowIndex: number;
    pct: number;
  }>;
  pins: SxEcdTimelinePin[];
  /** 期日を持たない実施中マイルストーン数（タイムラインに描けない分を隠さない）。 */
  undatedCount: number;
  completedCount: number;
}

function dateToPct(
  date: string,
  domainStart: string,
  domainEnd: string,
): number {
  const start = Date.parse(`${domainStart}T00:00:00.000Z`);
  const end = Date.parse(`${domainEnd}T00:00:00.000Z`);
  const value = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return 0;
  return Math.min(100, Math.max(0, ((value - start) / (end - start)) * 100));
}

function monthStartOf(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function addMonths(monthStart: string, count: number): string {
  const [year, month] = monthStart.slice(0, 7).split("-").map(Number);
  const total = year * 12 + (month - 1) + count;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

/**
 * 経営状況図＝統合タイムラインを導出する。全ての日付付きマイルストーンを柱レーンへ置き、重要
 * 経路の接続点、今日線、設立判断旗、月目盛、①〜⑤のボールピン（各介入行の自身の期日位置）を
 * 1つの座標系（0〜100%）で返す。日付の無いマイルストーンは描かず、件数として明示する。
 */
export function deriveSxUnifiedTimeline(params: {
  today: string;
  milestones: SxEcdMilestone[];
  criticalPathSlugs: string[];
  dagValid: boolean;
  tracks: Array<{
    key: string;
    label: string;
    shortLabel: string;
    accent: string;
    deltaDays: number | null;
    dateCertainty: "confirmed" | "provisional" | null;
    maxIssue: string;
  }>;
  laneOrder?: string[];
  objectiveTargetDate: string | null;
  interventionRows: SxEcdInterventionRow[];
  pinCount?: number;
  /** weekly-control can deliberately use only planned dates; forecast data stays stored but does not affect its range or order. */
  dateMode?: "planned_only" | "planned_and_forecast";
}): SxEcdUnifiedTimeline {
  const {
    today,
    milestones,
    criticalPathSlugs,
    dagValid,
    tracks,
    objectiveTargetDate,
    interventionRows,
    pinCount = 5,
  } = params;
  const plannedOnly = params.dateMode === "planned_only";
  const laneOrder = params.laneOrder ?? [
    "business_development",
    "technology_development",
    "organizational_building",
    "funding",
  ];

  if (!dagValid) {
    return {
      valid: false,
      reason: "依存関係不正",
      domainStart: today,
      domainEnd: today,
      todayPct: 0,
      objectivePct: null,
      objectiveDate: objectiveTargetDate,
      months: [],
      lanes: [],
      criticalPoints: [],
      pins: [],
      undatedCount: 0,
      completedCount: 0,
    };
  }

  const active = milestones.filter(
    (milestone) => milestone.status !== "completed",
  );
  const dated = active.filter(
    (milestone) =>
      milestone.plannedEnd || (!plannedOnly && milestone.forecastEnd),
  );
  const undatedCount = active.length - dated.length;
  const completedCount = milestones.length - active.length;

  if (dated.length === 0) {
    return {
      valid: false,
      reason: "日程付きマイルストーン未登録",
      domainStart: today,
      domainEnd: today,
      todayPct: 0,
      objectivePct: null,
      objectiveDate: objectiveTargetDate,
      months: [],
      lanes: [],
      criticalPoints: [],
      pins: [],
      undatedCount,
      completedCount,
    };
  }

  const allDates = dated.flatMap((milestone) =>
    [milestone.plannedEnd, plannedOnly ? null : milestone.forecastEnd].filter(
      (value): value is string => Boolean(value),
    ),
  );
  const startCandidates = dated
    .map((milestone) => milestone.plannedStart ?? null)
    .filter((value): value is string => Boolean(value));
  const minDate = [today, ...allDates, ...startCandidates].reduce(
    (min, value) => (value < min ? value : min),
  );
  const maxDate = [
    today,
    ...allDates,
    ...(objectiveTargetDate ? [objectiveTargetDate] : []),
  ].reduce((max, value) => (value > max ? value : max));
  const domainStart = monthStartOf(minDate);
  const domainEnd = addMonths(monthStartOf(maxDate), 1); // 最終月の月末側へ半月〜1か月の余白

  const months: SxEcdTimelineMonth[] = [];
  for (
    let cursor = domainStart;
    cursor < domainEnd;
    cursor = addMonths(cursor, 1)
  ) {
    const [year, month] = cursor.slice(0, 7).split("-").map(Number);
    months.push({
      label: `${month}月`,
      yearLabel:
        month === 1 || cursor === domainStart ? `${year}年` : null,
      pct: dateToPct(cursor, domainStart, domainEnd),
      isYearStart: month === 1,
    });
  }

  const criticalSet = new Set(criticalPathSlugs);
  const currentSlug =
    criticalPathSlugs.find((slug) => {
      const milestone = milestones.find((item) => item.slug === slug);
      return !milestone || milestone.status !== "completed";
    }) ?? null;

  const toRow = (milestone: SxEcdMilestone): SxEcdTimelineRow => {
    const plannedStart = milestone.plannedStart ?? null;
    const isCurrent = milestone.slug === currentSlug;
    return {
      milestoneId: milestone.id,
      slug: milestone.slug,
      title: nominalizeSxActionLabel(sxNormalizePublicName(milestone.title)),
      track: milestone.track ?? null,
      state: resolveNodeState(milestone, isCurrent),
      slipKind:
        plannedOnly && milestone.plannedEnd && milestone.plannedEnd < today
          ? "overdue"
          : plannedOnly
            ? "none"
            : sxEcdClassifySlip(milestone, today),
      isCritical: criticalSet.has(milestone.slug),
      isCurrent,
      plannedStart,
      plannedEnd: milestone.plannedEnd,
      forecastEnd: plannedOnly ? null : milestone.forecastEnd,
      plannedStartPct: plannedStart
        ? dateToPct(plannedStart, domainStart, domainEnd)
        : null,
      plannedEndPct: milestone.plannedEnd
        ? dateToPct(milestone.plannedEnd, domainStart, domainEnd)
        : null,
      forecastPct:
        !plannedOnly && milestone.forecastEnd
          ? dateToPct(milestone.forecastEnd, domainStart, domainEnd)
          : null,
      deltaDays: plannedOnly ? null : milestone.deltaDays,
      dateCertainty: milestone.dateCertainty ?? null,
      ownerLabel: isMissingOwnerText(milestone.ownerLabel)
        ? "担当未確認"
        : sxNormalizePublicName(milestone.ownerLabel),
      gate: milestone.gate,
      progressPct: Math.max(0, Math.min(100, milestone.progressPct ?? 0)),
    };
  };

  const lanes: SxEcdTimelineLane[] = laneOrder.map((key) => {
    const track = tracks.find((item) => item.key === key);
    const rows = dated
      .filter((milestone) => (milestone.track ?? null) === key)
      .map(toRow)
      .sort((a, b) =>
        (plannedOnly
          ? (a.plannedEnd ?? "9999")
          : (a.forecastEnd ?? a.plannedEnd ?? "9999")
        ).localeCompare(
          plannedOnly
            ? (b.plannedEnd ?? "9999")
            : (b.forecastEnd ?? b.plannedEnd ?? "9999"),
        ),
      );
    const order: SxEcdSlipKind[] = [
      "overdue",
      "confirmed_slip",
      "provisional_slip",
      "none",
    ];
    const slipKind = rows.reduce<SxEcdSlipKind>(
      (worst, row) =>
        order.indexOf(row.slipKind) < order.indexOf(worst)
          ? row.slipKind
          : worst,
      "none",
    );
    return {
      key,
      label: track?.label ?? key,
      shortLabel: track?.shortLabel ?? key,
      accent: track?.accent ?? "#69665d",
      deltaDays: track?.deltaDays ?? null,
      dateCertainty: track?.dateCertainty ?? null,
      maxIssue: track?.maxIssue ?? "",
      rows,
      slipKind,
    };
  });
  // laneOrderに無いtrackの行も落とさない（未知トラックは末尾レーンへ）。
  const knownLaneKeys = new Set(laneOrder);
  const orphanRows = dated
    .filter((milestone) => !knownLaneKeys.has(milestone.track ?? ""))
    .map(toRow);
  if (orphanRows.length > 0) {
    lanes.push({
      key: "unknown",
      label: "柱未確認",
      shortLabel: "未確認",
      accent: "#8f8aa6",
      deltaDays: null,
      dateCertainty: null,
      maxIssue: "",
      rows: orphanRows,
      slipKind: "none",
    });
  }

  const criticalPoints = criticalPathSlugs.flatMap((slug) => {
    for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
      const rowIndex = lanes[laneIndex].rows.findIndex(
        (row) => row.slug === slug,
      );
      if (rowIndex >= 0) {
        const row = lanes[laneIndex].rows[rowIndex];
        const pct = row.forecastPct ?? row.plannedEndPct;
        if (pct == null) return [];
        return [{ slug, laneIndex, rowIndex, pct }];
      }
    }
    return [];
  });

  const rawPins: SxEcdTimelinePin[] = interventionRows
    .slice(0, pinCount)
    .map((row, index) => ({ row, rank: index + 1 }))
    .filter((entry): entry is { row: SxEcdInterventionRow; rank: number } =>
      Boolean(entry.row.dueDate),
    )
    .map(({ row, rank }) => ({
      key: row.key,
      rank,
      target: row.target,
      ballSide: row.ballSide,
      ballOwner: row.ballOwner,
      dueDate: row.dueDate as string,
      duePct: dateToPct(row.dueDate as string, domainStart, domainEnd),
      dueDatePrecision: row.dueDatePrecision,
      anchor: row.anchor,
      gate: row.gate,
      side:
        row.ballSide === "相手側" || row.ballSide === "双方"
          ? "partner"
          : row.ballSide === "未確認" ||
              (row.ballSide === "担当" && row.ballOwner === "未確認")
            ? "unknown"
            : "sx",
    }));
  // 期日が近接するピンは横に最小間隔だけずらして重なりを消す（日付自体は変えない。位置補正のみ）。
  const MIN_PIN_GAP_PCT = 3;
  const pins = [...rawPins]
    .sort((a, b) => a.duePct - b.duePct || a.rank - b.rank)
    .map((pin) => ({ ...pin }));
  for (let i = 1; i < pins.length; i += 1) {
    if (pins[i].duePct - pins[i - 1].duePct < MIN_PIN_GAP_PCT) {
      pins[i].duePct = Math.min(100, pins[i - 1].duePct + MIN_PIN_GAP_PCT);
    }
  }

  return {
    valid: true,
    reason: null,
    domainStart,
    domainEnd,
    todayPct: dateToPct(today, domainStart, domainEnd),
    objectivePct: objectiveTargetDate
      ? dateToPct(objectiveTargetDate, domainStart, domainEnd)
      : null,
    objectiveDate: objectiveTargetDate,
    months,
    lanes,
    criticalPoints,
    pins,
    undatedCount,
    completedCount,
  };
}

// --- Pillar quota for the intervention queue -----------------------------------

/**
 * 次の経営介入のtop枠へ「最大遅延の柱」を必ず1件含めるための入替。データに該当行が無い場合は
 * 行を発明せず、注記だけを返す。
 */
export function applySxInterventionPillarQuota(params: {
  rows: SxEcdInterventionRow[];
  topCount: number;
  requiredTrack: string | null;
  requiredTrackLabel: string | null;
}): {
  top: SxEcdInterventionRow[];
  quotaApplied: boolean;
  quotaNote: string | null;
} {
  const { rows, topCount, requiredTrack, requiredTrackLabel } = params;
  const top = rows.slice(0, topCount);
  if (!requiredTrack) return { top, quotaApplied: false, quotaNote: null };
  if (top.some((row) => row.track === requiredTrack))
    return { top, quotaApplied: false, quotaNote: null };
  const candidate = rows
    .slice(topCount)
    .find((row) => row.track === requiredTrack);
  if (!candidate) {
    return {
      top,
      quotaApplied: false,
      quotaNote: `${requiredTrackLabel ?? requiredTrack}の介入候補は台帳未登録`,
    };
  }
  return {
    top: [...top.slice(0, Math.max(0, topCount - 1)), candidate],
    quotaApplied: true,
    quotaNote: null,
  };
}

/** Formats a row's due date honoring its precision: month precision never fabricates a day
 * ("YYYY年M月"), day precision uses the exact date, and unknown precision never fabricates a date
 * at all ("未確認"). When no precision is supplied (older callers/tests), falls back to the plain
 * day-format so month-only seed data is never rendered as if it were day-certain. */
export function sxEcdFormatDueDate(
  dueDate: string | null,
  precision?: SxEcdDatePrecision,
): string {
  if (precision === "unknown") return "未確認";
  if (!dueDate) return "未確認";
  if (precision === "month") {
    const [year, month] = dueDate.slice(0, 7).split("-");
    return `${year}年${Number(month)}月`;
  }
  const [year, month, day] = dueDate.slice(0, 10).split("-");
  return `${year}/${Number(month)}/${Number(day)}`;
}

// --- Verdict display mapping --------------------------------------------------

/** Maps the underlying judgment key to the exact display text the audit requires. Never touches
 * the underlying judgment/DB value — display boundary only. Unassessed never maps to green/オンスケ. */
export function sxVerdictDisplayLabel(
  key: "on_track" | "attention" | "crisis" | "unassessed" | string,
): string {
  if (key === "on_track") return "オンスケ";
  if (key === "attention") return "要注意";
  if (key === "crisis") return "危険";
  return "判定不能";
}
