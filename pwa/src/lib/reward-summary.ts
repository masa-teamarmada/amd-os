import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PM_LOCKED_PROGRESS_SOURCES,
  effectiveCumPctForYm,
  milestonePeriod,
  type ProgressAnchor,
} from "@/lib/ms-schedule-shared";
import {
  basePayoutCapYen,
  contractBackedClientAmount,
  monthlyFixedClientAmount,
} from "@/lib/contract-money";

type SupabaseLike = SupabaseClient;

const ACTIVE_PLAN_STATUSES = ["active", "confirmed", "fixed", "draft"];
const REWARD_SUMMARY_VERSION = "server_v2_actual_contribution";
const MANUAL_REWARD_SOURCE = "admin_manual_payout";
const CAP_EXTRA_MILESTONE_TAGS = new Set(["cap_extra", "extra_contract", "contract_extra", "cap_outside", "uncapped"]);
const CONTRIBUTION_AUTO_SOURCE = "member_activities";
const CONTRIBUTION_AUTO_APPLY_CONFIDENCE = 0.6;
const CONTRIBUTION_MANUAL_STATUSES = new Set(["confirmed", "pm_override"]);
const CONTRIBUTION_USED_STATUSES = new Set(["auto_applied", "confirmed", "pm_override"]);
const LEGACY_PLANNED_SHARE_REWARD_YMS = new Set(["202604"]);

type RewardPool = "regular" | "cap_extra";
type ContributionShareSource = "planned" | "member_activities" | "confirmed" | "pm_override";
type ContributionAllocationStatus = "auto_applied" | "needs_review" | "confirmed" | "pm_override" | "rejected";

export interface RewardBreakdown {
  msKey: string;
  title: string;
  share: number;
  plannedShare?: number;
  shareSource?: ContributionShareSource;
  allocationStatus?: ContributionAllocationStatus;
  allocationConfidence?: number;
  evidenceCount?: number;
  earnedPt: number;
  msConsumedPt: number;
  pool?: RewardPool;
  ptUnit?: number;
  payYen?: number;
}

export interface RewardMember {
  memberId: string;
  memberName?: string;
  earnedPt: number;
  basePay: number;
  bonusPt: number;
  totalPay: number;
  cappedFrom?: number;
  carryInYen?: number;
  deferredYen?: number;
  grossDueYen?: number;
  stockYen?: number;
  regularEarnedPt?: number;
  extraEarnedPt?: number;
  regularBasePay?: number;
  extraBasePay?: number;
  regularPaidYen?: number;
  extraPaidYen?: number;
  regularGrossDueYen?: number;
  extraGrossDueYen?: number;
  regularStockYen?: number;
  extraStockYen?: number;
  regularCarryInYen?: number;
  extraCarryInYen?: number;
  breakdown: RewardBreakdown[];
}

export interface RewardSummary {
  ptUnit?: number;
  totalPaySum?: number;
  totalGrossDueYen?: number;
  capBudgetYen?: number;
  capped?: boolean;
  carryInYen?: number;
  carryOverYen?: number;
  monthlyBudget65?: number;
  regularPtUnit?: number;
  extraPtUnit?: number;
  regularCapBudgetYen?: number;
  extraCapBudgetYen?: number;
  extraPayoutBudgetYen?: number;
  regularTotalGrossDueYen?: number;
  extraTotalGrossDueYen?: number;
  regularCarryOverYen?: number;
  extraCarryOverYen?: number;
  members: RewardMember[];
  meta?: {
    version: string;
    source: "supabase_reward_summary" | "admin_manual_payout";
    generatedAt: string;
    projectId: string;
    ym: string;
    planCycleId: string;
    contributionAllocationSource?: "milestone_monthly_contribution_allocations";
  };
}

type BillingRow = {
  project_id: string;
  ym: string;
  budget_yen?: number | null;
  budget_reported_amount?: number | string | null;
  budget_buffer_amount?: number | string | null;
  reward_summary_json?: unknown;
};

type ProjectRow = {
  project_id: string;
  fee_type?: string | null;
  fee_amount?: number | string | null;
  start_ym?: string | null;
  end_ym?: string | null;
};

type PlanCycleRow = {
  plan_cycle_id: string;
  project_id?: string | null;
  status?: string | null;
  budget_yen?: number | string | null;
  total_points?: number | string | null;
  period_start_ym: string;
  period_end_ym: string;
};

type MilestoneRow = {
  milestone_id: string;
  title?: string | null;
  points?: number | string | null;
  tag?: string | null;
  goal_level?: string | null;
  sort_order?: number | string | null;
  period_start_ym?: string | null;
  target_ym?: string | null;
};

type ProgressRow = {
  milestone_key: string;
  ym: string;
  progress_pct?: number | string | null;
  consumed_pt?: number | string | null;
  source?: string | null;
};

type ResponsibilityRow = {
  milestone_id: string;
  member_id: string;
  share?: number | string | null;
};

type ContributionAllocationRow = {
  project_id?: string | null;
  milestone_id: string;
  ym: string;
  member_id: string;
  planned_share?: number | string | null;
  actual_share?: number | string | null;
  confidence?: number | string | null;
  source?: string | null;
  status?: string | null;
  reason?: string | null;
  evidence_count?: number | string | null;
  evidence_refs?: unknown;
};

type MemberActivityRow = {
  id: string;
  member_id?: string | null;
  project_id: string;
  ym: string;
  source: string;
  source_item_id: string;
  milestone_id?: string | null;
  title?: string | null;
  content_preview?: string | null;
  item_date?: string | null;
  raw_metadata?: unknown;
  impact?: number | string | null;
  depth?: number | string | null;
};

type EffectiveContributionShare = {
  milestone_id: string;
  ym: string;
  member_id: string;
  share: number;
  plannedShare: number;
  source: ContributionShareSource;
  status: ContributionAllocationStatus;
  confidence: number;
  evidenceCount: number;
  reason?: string | null;
};

type ContributionAllocationPlan = {
  effectiveSharesByKey: Map<string, EffectiveContributionShare[]>;
  autoRowsToPersist: ContributionAllocationRow[];
};

type MemberRow = {
  member_id: string;
  code_name?: string | null;
  member_name?: string | null;
  is_officer?: boolean | null;
  exclude_from_payout_notice?: boolean | null;
};

export type RewardSyncResult = {
  ok: boolean;
  projectId: string;
  ym: string;
  rewardSummary: RewardSummary | null;
  skippedReason?: string;
};

function numberValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function hasExplicitNumber(value: unknown): boolean {
  if (value == null || value === "") return false;
  return Number.isFinite(typeof value === "number" ? value : Number(value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function normalizeShare(value: unknown): number {
  const n = numberValue(value);
  if (n > 1 && n <= 100) return clamp01(n / 100);
  return clamp01(n);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function allocationKey(ym: string, milestoneId: string): string {
  return `${ym}:${milestoneId}`;
}

function isActualContributionAllocationEnabledForYm(ym: string): boolean {
  return !LEGACY_PLANNED_SHARE_REWARD_YMS.has(ym);
}

function plannedShareMap(responsibilities: ResponsibilityRow[], milestoneId: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const resp of responsibilities) {
    if (resp.milestone_id !== milestoneId) continue;
    const share = normalizeShare(resp.share);
    if (share > 0) map.set(resp.member_id, share);
  }
  return map;
}

function activitySourceWeight(source: string): number {
  switch (source) {
    case "manual":
      return 1.1;
    case "inferred":
      return 1;
    case "member_weekly":
      return 0.75;
    case "gmail":
    case "slack":
    case "calendar":
    case "gmeet":
    case "drive":
    case "notion":
      return 0.85;
    default:
      return 0.8;
  }
}

function activityScore(activity: MemberActivityRow): number {
  const impact = clamp(numberValue(activity.impact) || 3, 1, 5);
  const depthValue = activity.depth == null ? null : numberValue(activity.depth);
  const depthWeight = depthValue === 1 ? 1 : depthValue === 0 ? 0.45 : 0.7;
  const metadata = asRecord(activity.raw_metadata);
  const synthesisConfidence = clamp01(numberValue(metadata?.synthesis_confidence) || 0.75);
  const confidenceWeight = 0.75 + synthesisConfidence * 0.25;
  return impact * depthWeight * activitySourceWeight(activity.source) * confidenceWeight;
}

function activityMemberWeights(activity: MemberActivityRow): Array<{ memberId: string; weight: number }> {
  const metadata = asRecord(activity.raw_metadata);
  const responsibilities = Array.isArray(metadata?.responsibilities)
    ? metadata.responsibilities
    : [];
  const weighted = responsibilities
    .map((item) => {
      const row = asRecord(item);
      const memberId = String(row?.memberId || row?.member_id || "").trim();
      const weight = normalizeShare(row?.responsibility);
      return memberId && weight > 0 ? { memberId, weight } : null;
    })
    .filter((item): item is { memberId: string; weight: number } => !!item);

  if (weighted.length > 0) return weighted;
  const memberId = String(activity.member_id || "").trim();
  return memberId ? [{ memberId, weight: 1 }] : [];
}

function evidenceRefsForActivity(activity: MemberActivityRow): Array<Record<string, unknown>> {
  const metadata = asRecord(activity.raw_metadata);
  const refs = Array.isArray(metadata?.evidence_refs)
    ? metadata.evidence_refs
    : [];
  if (refs.length > 0) {
    return refs
      .map((ref) => asRecord(ref))
      .filter((ref): ref is Record<string, unknown> => !!ref)
      .slice(0, 8);
  }
  return [{
    activity_id: activity.id,
    source: activity.source,
    source_item_id: activity.source_item_id,
    title: activity.title || null,
    item_date: activity.item_date || null,
  }];
}

function contributionConfidence(params: {
  evidenceCount: number;
  explicitResponsibilityCount: number;
  topShare: number;
  totalScore: number;
}): number {
  let confidence = 0.55;
  if (params.evidenceCount >= 2) confidence += 0.08;
  if (params.evidenceCount >= 4) confidence += 0.04;
  if (params.explicitResponsibilityCount > 0) confidence += 0.12;
  if (params.topShare >= 0.8) confidence += 0.05;
  if (params.totalScore >= 3) confidence += 0.05;
  return Math.round(clamp(confidence, 0.35, 0.95) * 100) / 100;
}

function buildAutoContributionRows({
  projectId,
  months,
  milestoneIds,
  responsibilities,
  activities,
}: {
  projectId: string;
  months: string[];
  milestoneIds: string[];
  responsibilities: ResponsibilityRow[];
  activities: MemberActivityRow[];
}): ContributionAllocationRow[] {
  const monthSet = new Set(months);
  const milestoneSet = new Set(milestoneIds);
  const groups = new Map<string, {
    milestoneId: string;
    ym: string;
    memberScores: Map<string, number>;
    evidenceCount: number;
    explicitResponsibilityCount: number;
    evidenceRefs: Array<Record<string, unknown>>;
  }>();

  for (const activity of activities) {
    const milestoneId = String(activity.milestone_id || "").trim();
    if (
      !milestoneId ||
      !milestoneSet.has(milestoneId) ||
      !monthSet.has(activity.ym) ||
      !isActualContributionAllocationEnabledForYm(activity.ym)
    ) continue;
    const weights = activityMemberWeights(activity);
    if (weights.length === 0) continue;
    const totalWeight = weights.reduce((sum, row) => sum + row.weight, 0);
    if (totalWeight <= 0) continue;

    const key = allocationKey(activity.ym, milestoneId);
    const group = groups.get(key) || {
      milestoneId,
      ym: activity.ym,
      memberScores: new Map<string, number>(),
      evidenceCount: 0,
      explicitResponsibilityCount: 0,
      evidenceRefs: [],
    };
    const score = activityScore(activity);
    const hasExplicitResponsibilities = Array.isArray(asRecord(activity.raw_metadata)?.responsibilities)
      && (asRecord(activity.raw_metadata)?.responsibilities as unknown[]).length > 0;
    group.evidenceCount += 1;
    if (hasExplicitResponsibilities) group.explicitResponsibilityCount += 1;
    group.evidenceRefs.push(...evidenceRefsForActivity(activity));
    for (const row of weights) {
      const current = group.memberScores.get(row.memberId) || 0;
      group.memberScores.set(row.memberId, current + score * (row.weight / totalWeight));
    }
    groups.set(key, group);
  }

  const rows: ContributionAllocationRow[] = [];
  for (const group of groups.values()) {
    const totalScore = Array.from(group.memberScores.values()).reduce((sum, score) => sum + score, 0);
    if (totalScore <= 0) continue;
    const planned = plannedShareMap(responsibilities, group.milestoneId);
    const memberIds = new Set([...planned.keys(), ...group.memberScores.keys()]);
    const topShare = Math.max(...Array.from(group.memberScores.values()).map((score) => score / totalScore));
    const confidence = contributionConfidence({
      evidenceCount: group.evidenceCount,
      explicitResponsibilityCount: group.explicitResponsibilityCount,
      topShare,
      totalScore,
    });
    const status: ContributionAllocationStatus = confidence >= CONTRIBUTION_AUTO_APPLY_CONFIDENCE
      ? "auto_applied"
      : "needs_review";
    const reason = status === "auto_applied"
      ? "member_activities から当月実績配分を自動算出"
      : "member_activities の根拠が薄いため予定配分にfallback";
    for (const memberId of memberIds) {
      const score = group.memberScores.get(memberId) || 0;
      rows.push({
        project_id: projectId,
        milestone_id: group.milestoneId,
        ym: group.ym,
        member_id: memberId,
        planned_share: planned.get(memberId) || 0,
        actual_share: Math.round((score / totalScore) * 10000) / 10000,
        confidence,
        source: CONTRIBUTION_AUTO_SOURCE,
        status,
        reason,
        evidence_count: group.evidenceCount,
        evidence_refs: group.evidenceRefs.slice(0, 12),
      });
    }
  }
  return rows;
}

function effectiveSharesFromRows(rows: ContributionAllocationRow[], fallbackSource: ContributionShareSource): EffectiveContributionShare[] {
  const positive = rows
    .map((row) => ({
      row,
      share: normalizeShare(row.actual_share),
    }))
    .filter(({ row, share }) => share > 0 && CONTRIBUTION_USED_STATUSES.has(String(row.status || "") as ContributionAllocationStatus));
  const total = positive.reduce((sum, item) => sum + item.share, 0);
  if (total <= 0) return [];
  return positive.map(({ row, share }) => {
    const status = String(row.status || "auto_applied") as ContributionAllocationStatus;
    const source = status === "confirmed" ? "confirmed" : status === "pm_override" ? "pm_override" : fallbackSource;
    return {
      milestone_id: row.milestone_id,
      ym: row.ym,
      member_id: row.member_id,
      share: Math.round((share / total) * 10000) / 10000,
      plannedShare: normalizeShare(row.planned_share),
      source,
      status,
      confidence: clamp01(numberValue(row.confidence)),
      evidenceCount: Math.max(0, Math.round(numberValue(row.evidence_count))),
      reason: row.reason || null,
    };
  });
}

function buildContributionAllocationPlan({
  projectId,
  months,
  milestones,
  responsibilities,
  activities,
  persistedAllocations,
}: {
  projectId: string;
  months: string[];
  milestones: MilestoneRow[];
  responsibilities: ResponsibilityRow[];
  activities: MemberActivityRow[];
  persistedAllocations: ContributionAllocationRow[];
}): ContributionAllocationPlan {
  const milestoneIds = milestones.map((ms) => ms.milestone_id);
  const actualContributionMonths = months.filter(isActualContributionAllocationEnabledForYm);
  const autoRows = buildAutoContributionRows({
    projectId,
    months: actualContributionMonths,
    milestoneIds,
    responsibilities,
    activities,
  });
  const manualRowsByKey = new Map<string, ContributionAllocationRow[]>();
  for (const row of persistedAllocations) {
    if (!isActualContributionAllocationEnabledForYm(row.ym)) continue;
    const status = String(row.status || "");
    if (!CONTRIBUTION_MANUAL_STATUSES.has(status)) continue;
    const key = allocationKey(row.ym, row.milestone_id);
    const rows = manualRowsByKey.get(key) || [];
    rows.push(row);
    manualRowsByKey.set(key, rows);
  }

  const autoRowsByKey = new Map<string, ContributionAllocationRow[]>();
  for (const row of autoRows) {
    const key = allocationKey(row.ym, row.milestone_id);
    const rows = autoRowsByKey.get(key) || [];
    rows.push(row);
    autoRowsByKey.set(key, rows);
  }

  const effectiveSharesByKey = new Map<string, EffectiveContributionShare[]>();
  for (const key of new Set([...manualRowsByKey.keys(), ...autoRowsByKey.keys()])) {
    const manualShares = effectiveSharesFromRows(manualRowsByKey.get(key) || [], "confirmed");
    if (manualShares.length > 0) {
      effectiveSharesByKey.set(key, manualShares);
      continue;
    }
    const autoShares = effectiveSharesFromRows(autoRowsByKey.get(key) || [], "member_activities");
    if (autoShares.length > 0) {
      effectiveSharesByKey.set(key, autoShares);
    }
  }

  const manualKeys = new Set(manualRowsByKey.keys());
  return {
    effectiveSharesByKey,
    autoRowsToPersist: autoRows.filter((row) => !manualKeys.has(allocationKey(row.ym, row.milestone_id))),
  };
}

/**
 * project_members.is_active=false のメンバーを share から除外し、
 * 残メンバーで share 合計が 1 になるよう renormalize する。
 * 非参画メンバー (例: planned share だけ残っている離脱者) に報酬が発生するのを防ぐ。
 * activeMemberIds 未指定 (undefined) ならフィルタしない (後方互換)。
 */
function filterActiveAndRenormalize(
  shares: EffectiveContributionShare[],
  activeMemberIds?: Set<string>
): EffectiveContributionShare[] {
  if (!activeMemberIds) return shares;
  const active = shares.filter((share) => activeMemberIds.has(share.member_id));
  if (active.length === shares.length) return shares;
  const total = active.reduce((sum, share) => sum + share.share, 0);
  if (total <= 0) return [];
  return active.map((share) => ({
    ...share,
    share: Math.round((share.share / total) * 10000) / 10000,
  }));
}

function resolveContributionShares({
  ym,
  milestoneId,
  responsibilities,
  contributionSharesByKey,
  activeMemberIds,
}: {
  ym: string;
  milestoneId: string;
  responsibilities: ResponsibilityRow[];
  contributionSharesByKey?: Map<string, EffectiveContributionShare[]>;
  activeMemberIds?: Set<string>;
}): EffectiveContributionShare[] {
  const actual = isActualContributionAllocationEnabledForYm(ym)
    ? filterActiveAndRenormalize(
        contributionSharesByKey?.get(allocationKey(ym, milestoneId)) || [],
        activeMemberIds
      )
    : [];
  if (actual.length > 0) return actual;
  const planned = responsibilities
    .filter((resp) => resp.milestone_id === milestoneId && normalizeShare(resp.share) > 0)
    .map((resp) => ({
      milestone_id: resp.milestone_id,
      ym,
      member_id: resp.member_id,
      share: normalizeShare(resp.share),
      plannedShare: normalizeShare(resp.share),
      source: "planned" as const,
      status: "confirmed" as const,
      confidence: 1,
      evidenceCount: 0,
      reason: "milestone_responsibility.share fallback",
    }));
  return filterActiveAndRenormalize(planned, activeMemberIds);
}

function manualRewardSummary(value: unknown): RewardSummary | null {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.members)) return null;
  const meta = asRecord(record.meta);
  const source = String(record.manualOverrideSource ?? meta?.source ?? "");
  if (source !== MANUAL_REWARD_SOURCE && record.manualOverride !== true) return null;
  return record as unknown as RewardSummary;
}

function normalizedTag(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isCapExtraMilestone(ms: Pick<MilestoneRow, "tag">): boolean {
  return CAP_EXTRA_MILESTONE_TAGS.has(normalizedTag(ms.tag));
}

function ymToMonths(ym: string): number {
  return parseInt(ym.slice(0, 4), 10) * 12 + parseInt(ym.slice(4, 6), 10);
}

function monthsToYm(months: number): string {
  const zeroBased = months - 1;
  const y = Math.floor(zeroBased / 12);
  const m = (zeroBased % 12) + 1;
  return `${y}${String(m).padStart(2, "0")}`;
}

function prevYmStr(ym: string): string {
  return monthsToYm(ymToMonths(ym) - 1);
}

function cycleMonthCount(planCycle: PlanCycleRow | null): number {
  if (!planCycle) return 1;
  return Math.max(1, ymToMonths(planCycle.period_end_ym) - ymToMonths(planCycle.period_start_ym) + 1);
}

function monthRangeUntil(planCycle: PlanCycleRow | null, targetYm: string): string[] {
  if (!planCycle?.period_start_ym || planCycle.period_start_ym > targetYm) return [targetYm];
  const start = ymToMonths(planCycle.period_start_ym);
  const end = ymToMonths(targetYm);
  const months: string[] = [];
  for (let i = start; i <= end; i += 1) months.push(monthsToYm(i));
  return months.length > 0 ? months : [targetYm];
}

function choosePlanCycle(rows: PlanCycleRow[], ym: string): PlanCycleRow | null {
  const activeRows = rows.filter((row) => ACTIVE_PLAN_STATUSES.includes(String(row.status || "")));
  return activeRows
    .filter((row) => row.period_start_ym <= ym && row.period_end_ym >= ym)
    .sort((a, b) => b.period_start_ym.localeCompare(a.period_start_ym))[0] ?? null;
}

function isPmLockedProgressRow(row: ProgressRow): boolean {
  return PM_LOCKED_PROGRESS_SOURCES.has(String(row.source || ""));
}

function lockedConsumedPt(row: ProgressRow, points: number): number {
  if (row.consumed_pt != null) {
    const consumed = numberValue(row.consumed_pt);
    if (Number.isFinite(consumed)) return consumed;
  }
  return Math.round(numberValue(row.progress_pct) * points) / 100;
}

/**
 * 報酬計算で支払い対象にできる累積消化pt。
 * 各月の有効値 = PM確定行 (source ∈ PM_LOCKED_PROGRESS_SOURCES) があればその値、
 * なければアンカー方式のスケジュール按分デフォルト (anchoredExpectedCumPctForYm をコード計算。
 * アンカー = その月より前の最新 PM 確定行。アンカー無しは従来の期間按分に一致)。
 * DB の非確定行 (routine_auto / 野良 l2_routine / 旧AI推定) は一切参照しない。
 *
 * payableCum(ym) = max over m≤ym — cumulative max により
 * 「巻き戻り → 再上昇」での二重払いを構造的に排除する (差分が再加算されない)。
 */
function buildPayableCumMap(
  progress: ProgressRow[],
  milestones: MilestoneRow[],
  planCycle: PlanCycleRow | null,
  ym: string
): Map<string, number> {
  const map = new Map<string, number>();
  const cyclePeriod = {
    period_start_ym: planCycle?.period_start_ym ?? null,
    period_end_ym: planCycle?.period_end_ym ?? null,
  };
  for (const ms of milestones) {
    const points = numberValue(ms.points);
    const { startYm, endYm } = milestonePeriod(
      { period_start_ym: ms.period_start_ym ?? null, target_ym: ms.target_ym ?? null },
      cyclePeriod
    );
    const lockedByYm = new Map<string, ProgressRow>();
    for (const p of progress) {
      if (p.milestone_key !== ms.milestone_id || p.ym > ym) continue;
      if (!isPmLockedProgressRow(p)) continue;
      lockedByYm.set(p.ym, p);
    }
    // m より厳密に前の最新 PM 確定行をアンカーとして返す (ym 昇順走査)
    const lockedYmsSorted = Array.from(lockedByYm.keys()).sort();
    const anchorBefore = (m: string): ProgressAnchor | null => {
      let found: ProgressAnchor | null = null;
      for (const lockedYm of lockedYmsSorted) {
        if (lockedYm >= m) break;
        const row = lockedByYm.get(lockedYm)!;
        const pct = points > 0
          ? Math.max(0, Math.min(100, (lockedConsumedPt(row, points) / points) * 100))
          : Math.max(0, Math.min(100, numberValue(row.progress_pct)));
        found = { ym: lockedYm, pct };
      }
      return found;
    };
    const monthsToCheck = new Set(monthRangeUntil(planCycle, ym));
    for (const lockedYm of lockedByYm.keys()) monthsToCheck.add(lockedYm);
    monthsToCheck.add(ym);
    let payable = 0;
    for (const m of monthsToCheck) {
      if (m > ym) continue;
      const locked = lockedByYm.get(m);
      const cum = startYm && endYm
        ? Math.round(effectiveCumPctForYm(
          m,
          startYm,
          endYm,
          anchorBefore(m),
          locked ? (points > 0 ? (lockedConsumedPt(locked, points) / points) * 100 : numberValue(locked.progress_pct)) : null
        ) * points) / 100
        : locked
          ? lockedConsumedPt(locked, points)
          : 0;
      if (cum > payable) payable = cum;
    }
    map.set(ms.milestone_id, Math.round(payable * 100) / 100);
  }
  return map;
}

function deriveRewardBudgetForPt({
  billing,
  planCycle,
  project,
}: {
  billing: BillingRow;
  planCycle: PlanCycleRow | null;
  project: ProjectRow | null;
}): number {
  const cycleBudget = numberValue(planCycle?.budget_yen);
  if (cycleBudget > 0) return Math.round(cycleBudget);
  const monthlyFee = monthlyFixedClientAmount(project, billing.ym);
  if (monthlyFee > 0) return Math.round(monthlyFee * 0.65 * cycleMonthCount(planCycle));
  return Math.max(0, Math.round(numberValue(billing.budget_yen)));
}

function deriveBaseMonthlyRewardBudget({
  billing,
  planCycle,
  project,
}: {
  billing: BillingRow;
  planCycle: PlanCycleRow | null;
  project: ProjectRow | null;
}): number {
  const clientAmount = contractBackedClientAmount({
    ym: billing.ym,
    project,
    reportedAmount: billing.budget_reported_amount,
  });
  if (clientAmount > 0) return basePayoutCapYen(clientAmount, numberValue(billing.budget_buffer_amount));
  const cycleBudget = numberValue(planCycle?.budget_yen);
  if (cycleBudget > 0) return Math.round(cycleBudget / cycleMonthCount(planCycle));
  return Math.max(0, Math.round(numberValue(billing.budget_yen)));
}

function deriveMonthlyRewardBudget({
  billing,
  planCycle,
  project,
}: {
  billing: BillingRow;
  planCycle: PlanCycleRow | null;
  project: ProjectRow | null;
}): number {
  if (hasExplicitNumber(billing.budget_yen)) {
    return Math.max(0, Math.round(numberValue(billing.budget_yen)));
  }
  const monthlyFee = monthlyFixedClientAmount(project, billing.ym);
  if (monthlyFee > 0) return Math.round(monthlyFee * 0.65);
  const cycleBudget = numberValue(planCycle?.budget_yen);
  if (cycleBudget > 0) return Math.round(cycleBudget / cycleMonthCount(planCycle));
  return 0;
}

function rewardPointBasis(milestones: MilestoneRow[], planCycle: PlanCycleRow | null): { hasCapExtra: boolean; totalPt: number } {
  const hasCapExtra = milestones.some(isCapExtraMilestone);
  if (!hasCapExtra) {
    return {
      hasCapExtra,
      totalPt: numberValue(planCycle?.total_points) || milestones.reduce((sum, ms) => sum + numberValue(ms.points), 0),
    };
  }
  const extraPt = milestones.filter(isCapExtraMilestone).reduce((sum, ms) => sum + numberValue(ms.points), 0);
  const planTotalPt = numberValue(planCycle?.total_points);
  if (planTotalPt > extraPt) {
    return {
      hasCapExtra,
      totalPt: planTotalPt - extraPt,
    };
  }
  return {
    hasCapExtra,
    totalPt: milestones
      .filter((ms) => !isCapExtraMilestone(ms))
      .reduce((sum, ms) => sum + numberValue(ms.points), 0),
  };
}

function deriveRewardUnits({
  milestones,
  billing,
  planCycle,
  project,
}: {
  milestones: MilestoneRow[];
  billing: BillingRow;
  planCycle: PlanCycleRow | null;
  project: ProjectRow | null;
}) {
  const { hasCapExtra, totalPt } = rewardPointBasis(milestones, planCycle);
  const payoutBudget = deriveRewardBudgetForPt({ billing, planCycle, project });
  const regularPtUnit = totalPt > 0 ? Math.round(payoutBudget / totalPt) : 0;
  return {
    hasCapExtra,
    regularPtUnit,
    extraPtUnit: regularPtUnit,
    regularTotalPt: totalPt,
    payoutBudget,
  };
}

function deriveMonthlyRewardCaps({
  billing,
  planCycle,
  project,
  hasCapExtra,
}: {
  billing: BillingRow;
  planCycle: PlanCycleRow | null;
  project: ProjectRow | null;
  hasCapExtra: boolean;
}) {
  const fullBudget = deriveMonthlyRewardBudget({ billing, planCycle, project });
  if (!hasCapExtra) {
    return {
      regularCapYen: fullBudget,
      extraCapYen: 0,
      totalCapYen: fullBudget,
    };
  }
  const regularCapYen = deriveBaseMonthlyRewardBudget({ billing, planCycle, project });
  const extraCapYen = Math.max(0, fullBudget - regularCapYen);
  return {
    regularCapYen,
    extraCapYen,
    totalCapYen: regularCapYen + extraCapYen,
  };
}

function derivePersistedCycleBudget({
  billing,
  project,
}: {
  billing: BillingRow;
  project: ProjectRow | null;
}): number {
  if (hasExplicitNumber(billing.budget_yen)) {
    return Math.max(0, Math.round(numberValue(billing.budget_yen)));
  }

  const reportedAmount = numberValue(billing.budget_reported_amount);
  const clientAmount = contractBackedClientAmount({ ym: billing.ym, project, reportedAmount });
  if (clientAmount > 0) return basePayoutCapYen(clientAmount, numberValue(billing.budget_buffer_amount));

  return 0;
}

function buildCarryOnlyReward(
  memberMap: Record<string, string>,
  regularCarryStock: Map<string, number>,
  extraCarryStock: Map<string, number>,
  ptUnit: number,
  extraPtUnit: number
): RewardSummary | null {
  const memberIds = new Set([...regularCarryStock.keys(), ...extraCarryStock.keys()]);
  const members = Array.from(memberIds)
    .filter((memberId) => (regularCarryStock.get(memberId) || 0) > 0 || (extraCarryStock.get(memberId) || 0) > 0)
    .map((memberId) => ({
      memberId,
      memberName: memberMap[memberId] || memberId,
      earnedPt: 0,
      basePay: 0,
      bonusPt: 0,
      totalPay: 0,
      regularEarnedPt: 0,
      extraEarnedPt: 0,
      regularBasePay: 0,
      extraBasePay: 0,
      breakdown: [],
    }));
  if (members.length === 0) return null;
  return { ptUnit, regularPtUnit: ptUnit, extraPtUnit, totalPaySum: 0, members };
}

type CapAllocationInput = {
  memberId: string;
  basePay: number;
  carryInYen: number;
};

type CapAllocation = {
  basePay: number;
  carryInYen: number;
  grossDueYen: number;
  paidYen: number;
  stockYen: number;
};

function allocateCap(
  inputs: CapAllocationInput[],
  capBudgetYen: number,
  options: { payAllWhenCapMissing: boolean }
): Map<string, CapAllocation> {
  const items = inputs
    .map((item) => ({
      memberId: item.memberId,
      basePay: Math.max(0, Math.round(item.basePay)),
      carryInYen: Math.max(0, Math.round(item.carryInYen)),
    }))
    .map((item) => ({ ...item, grossDueYen: item.basePay + item.carryInYen }))
    .filter((item) => item.grossDueYen > 0);

  const map = new Map<string, CapAllocation>();
  if (items.length === 0) return map;

  const totalGrossDue = items.reduce((sum, item) => sum + item.grossDueYen, 0);
  const cap = Math.max(0, Math.round(capBudgetYen));
  if (cap <= 0) {
    for (const item of items) {
      const paidYen = options.payAllWhenCapMissing ? item.grossDueYen : 0;
      map.set(item.memberId, {
        basePay: item.basePay,
        carryInYen: item.carryInYen,
        grossDueYen: item.grossDueYen,
        paidYen,
        stockYen: Math.max(0, item.grossDueYen - paidYen),
      });
    }
    return map;
  }

  if (totalGrossDue <= cap) {
    for (const item of items) {
      map.set(item.memberId, {
        basePay: item.basePay,
        carryInYen: item.carryInYen,
        grossDueYen: item.grossDueYen,
        paidYen: item.grossDueYen,
        stockYen: 0,
      });
    }
    return map;
  }

  let remainingCap = cap;
  let remainingGross = totalGrossDue;
  items.forEach((item, index) => {
    const isLast = index === items.length - 1;
    const proportional = remainingGross > 0 ? Math.round((remainingCap * item.grossDueYen) / remainingGross) : 0;
    const paidYen = Math.min(item.grossDueYen, Math.max(0, isLast ? remainingCap : proportional));
    remainingCap -= paidYen;
    remainingGross -= item.grossDueYen;
    map.set(item.memberId, {
      basePay: item.basePay,
      carryInYen: item.carryInYen,
      grossDueYen: item.grossDueYen,
      paidYen,
      stockYen: Math.max(0, item.grossDueYen - paidYen),
    });
  });
  return map;
}

function emptyAllocation(): CapAllocation {
  return { basePay: 0, carryInYen: 0, grossDueYen: 0, paidYen: 0, stockYen: 0 };
}

export function applyRewardCapsForMonth(
  reward: RewardSummary,
  caps: { regularCapYen: number; extraCapYen: number; totalCapYen: number },
  regularCarryStock: Map<string, number>,
  extraCarryStock: Map<string, number>,
  memberMap: Record<string, string> = {}
): RewardSummary {
  const memberById = new Map(reward.members.map((member) => [member.memberId, member]));
  const memberIds = new Set([...memberById.keys(), ...regularCarryStock.keys(), ...extraCarryStock.keys()]);
  const regularInputs: CapAllocationInput[] = [];
  const extraInputs: CapAllocationInput[] = [];

  for (const memberId of memberIds) {
    const member = memberById.get(memberId);
    const extraBasePay = Math.max(0, Math.round(member?.extraBasePay || 0));
    const regularBasePay = Math.max(
      0,
      Math.round(member?.regularBasePay ?? Math.max(0, (member?.basePay || 0) - extraBasePay))
    );
    regularInputs.push({
      memberId,
      basePay: regularBasePay,
      carryInYen: regularCarryStock.get(memberId) || 0,
    });
    extraInputs.push({
      memberId,
      basePay: extraBasePay,
      carryInYen: extraCarryStock.get(memberId) || 0,
    });
  }

  const extraGrossBeforeCap = extraInputs.reduce(
    (sum, item) => sum + Math.max(0, Math.round(item.basePay)) + Math.max(0, Math.round(item.carryInYen)),
    0
  );
  const effectiveExtraCapYen = caps.extraCapYen > 0 ? caps.extraCapYen : extraGrossBeforeCap;
  const effectiveTotalCapYen = caps.regularCapYen + effectiveExtraCapYen;

  const regularAllocations = allocateCap(regularInputs, caps.regularCapYen, { payAllWhenCapMissing: false });
  const extraAllocations = allocateCap(extraInputs, effectiveExtraCapYen, { payAllWhenCapMissing: false });

  const paidMembers = Array.from(memberIds)
    .map((memberId) => {
      const member = memberById.get(memberId);
      const regular = regularAllocations.get(memberId) || emptyAllocation();
      const extra = extraAllocations.get(memberId) || emptyAllocation();
      const basePay = regular.basePay + extra.basePay;
      const carryInYen = regular.carryInYen + extra.carryInYen;
      const grossDueYen = regular.grossDueYen + extra.grossDueYen;
      const totalPay = regular.paidYen + extra.paidYen;
      const stockYen = regular.stockYen + extra.stockYen;
      return {
        ...(member || {
          memberId,
          memberName: memberMap[memberId] || memberId,
          earnedPt: 0,
          bonusPt: 0,
          breakdown: [],
        }),
        basePay,
        totalPay,
        carryInYen,
        grossDueYen,
        cappedFrom: grossDueYen > totalPay ? grossDueYen : undefined,
        deferredYen: stockYen,
        stockYen,
        regularBasePay: regular.basePay,
        extraBasePay: extra.basePay,
        regularPaidYen: regular.paidYen,
        extraPaidYen: extra.paidYen,
        regularGrossDueYen: regular.grossDueYen,
        extraGrossDueYen: extra.grossDueYen,
        regularStockYen: regular.stockYen,
        extraStockYen: extra.stockYen,
        regularCarryInYen: regular.carryInYen,
        extraCarryInYen: extra.carryInYen,
      };
    })
    .filter((member) => (member.grossDueYen || 0) > 0 || (member.earnedPt || 0) > 0)
    .sort((a, b) => (b.earnedPt || 0) - (a.earnedPt || 0) || (b.grossDueYen || 0) - (a.grossDueYen || 0));

  const totalGrossDue = paidMembers.reduce((sum, member) => sum + (member.grossDueYen || 0), 0);
  const totalPay = paidMembers.reduce((sum, member) => sum + member.totalPay, 0);
  const carryInTotal = paidMembers.reduce((sum, member) => sum + (member.carryInYen || 0), 0);
  const carryOverYen = paidMembers.reduce((sum, member) => sum + (member.stockYen || 0), 0);
  const regularTotalGrossDueYen = paidMembers.reduce((sum, member) => sum + (member.regularGrossDueYen || 0), 0);
  const extraTotalGrossDueYen = paidMembers.reduce((sum, member) => sum + (member.extraGrossDueYen || 0), 0);
  const regularCarryOverYen = paidMembers.reduce((sum, member) => sum + (member.regularStockYen || 0), 0);
  const extraCarryOverYen = paidMembers.reduce((sum, member) => sum + (member.extraStockYen || 0), 0);

  return {
    ...reward,
    members: paidMembers,
    totalPaySum: totalPay,
    totalGrossDueYen: totalGrossDue,
    capBudgetYen: effectiveTotalCapYen,
    capped: carryOverYen > 0,
    carryInYen: carryInTotal,
    carryOverYen,
    monthlyBudget65: effectiveTotalCapYen,
    regularCapBudgetYen: caps.regularCapYen,
    extraCapBudgetYen: effectiveExtraCapYen,
    extraPayoutBudgetYen: effectiveExtraCapYen,
    regularTotalGrossDueYen,
    extraTotalGrossDueYen,
    regularCarryOverYen,
    extraCarryOverYen,
  };
}

export function buildRewardSummaryUncapped({
  ym,
  milestones,
  progress,
  responsibilities,
  contributionSharesByKey,
  activeMemberIds,
  memberMap,
  billing,
  planCycle,
  project,
}: {
  ym: string;
  milestones: MilestoneRow[];
  progress: ProgressRow[];
  responsibilities: ResponsibilityRow[];
  contributionSharesByKey?: Map<string, EffectiveContributionShare[]>;
  activeMemberIds?: Set<string>;
  memberMap: Record<string, string>;
  billing: BillingRow;
  planCycle: PlanCycleRow | null;
  project: ProjectRow | null;
}): RewardSummary | null {
  if (milestones.length === 0 || responsibilities.length === 0) return null;

  const prevYm = prevYmStr(ym);
  const prevConsumedMap = buildPayableCumMap(progress, milestones, planCycle, prevYm);
  const currConsumedMap = buildPayableCumMap(progress, milestones, planCycle, ym);
  const msById = new Map(milestones.map((ms) => [ms.milestone_id, ms]));
  const { regularPtUnit, extraPtUnit, hasCapExtra } = deriveRewardUnits({ milestones, billing, planCycle, project });
  const memberPt = new Map<string, { total: number; regular: number; extra: number; regularBasePay: number; extraBasePay: number }>();
  const memberBreakdown = new Map<string, RewardBreakdown[]>();

  for (const ms of milestones) {
    const curr = currConsumedMap.get(ms.milestone_id) || 0;
    const prev = prevConsumedMap.get(ms.milestone_id) || 0;
    const msConsumedPt = Math.round(Math.max(0, curr - prev) * 100) / 100;
    if (msConsumedPt <= 0) continue;
    const pool: RewardPool = isCapExtraMilestone(ms) ? "cap_extra" : "regular";
    const ptUnit = pool === "cap_extra" ? extraPtUnit : regularPtUnit;

    const resps = resolveContributionShares({
      ym,
      milestoneId: ms.milestone_id,
      responsibilities,
      contributionSharesByKey,
      activeMemberIds,
    }).filter((resp) => resp.share > 0);
    for (const resp of resps) {
      const earnedPt = Math.round(msConsumedPt * resp.share * 100) / 100;
      const payYen = Math.round(earnedPt * ptUnit);
      const current = memberPt.get(resp.member_id) || { total: 0, regular: 0, extra: 0, regularBasePay: 0, extraBasePay: 0 };
      current.total += earnedPt;
      if (pool === "cap_extra") {
        current.extra += earnedPt;
        current.extraBasePay += payYen;
      } else {
        current.regular += earnedPt;
        current.regularBasePay += payYen;
      }
      memberPt.set(resp.member_id, current);
      const list = memberBreakdown.get(resp.member_id) || [];
      list.push({
        msKey: ms.milestone_id,
        title: msById.get(ms.milestone_id)?.title || ms.milestone_id,
        msConsumedPt,
        share: resp.share,
        plannedShare: resp.plannedShare,
        shareSource: resp.source,
        allocationStatus: resp.status,
        allocationConfidence: resp.confidence,
        evidenceCount: resp.evidenceCount,
        earnedPt,
        pool,
        ptUnit,
        payYen,
      });
      memberBreakdown.set(resp.member_id, list);
    }
  }

  const members = Array.from(memberPt.entries())
    .map(([memberId, earned]) => {
      const earnedPt = Math.round(earned.total * 100) / 100;
      const regularEarnedPt = Math.round(earned.regular * 100) / 100;
      const extraEarnedPt = Math.round(earned.extra * 100) / 100;
      const regularBasePay = Math.round(earned.regularBasePay);
      const extraBasePay = Math.round(earned.extraBasePay);
      const basePay = regularBasePay + extraBasePay;
      return {
        memberId,
        memberName: memberMap[memberId] || memberId,
        earnedPt,
        basePay,
        bonusPt: 0,
        totalPay: basePay,
        regularEarnedPt,
        extraEarnedPt,
        regularBasePay,
        extraBasePay,
        breakdown: memberBreakdown.get(memberId) || [],
      };
    })
    .filter((member) => member.earnedPt > 0)
    .sort((a, b) => b.earnedPt - a.earnedPt);

  if (members.length === 0) return null;

  return {
    ptUnit: regularPtUnit,
    regularPtUnit,
    extraPtUnit: hasCapExtra ? extraPtUnit : undefined,
    totalPaySum: members.reduce((sum, member) => sum + member.totalPay, 0),
    members,
  };
}

export function buildRewardSummary({
  ym,
  milestones,
  progress,
  responsibilities,
  contributionSharesByKey,
  activeMemberIds,
  memberMap,
  billing,
  billingsByYm,
  planCycle,
  project,
}: {
  ym: string;
  milestones: MilestoneRow[];
  progress: ProgressRow[];
  responsibilities: ResponsibilityRow[];
  contributionSharesByKey?: Map<string, EffectiveContributionShare[]>;
  activeMemberIds?: Set<string>;
  memberMap: Record<string, string>;
  billing: BillingRow;
  billingsByYm?: Map<string, BillingRow>;
  planCycle: PlanCycleRow | null;
  project: ProjectRow | null;
}): RewardSummary | null {
  const regularCarryStock = new Map<string, number>();
  const extraCarryStock = new Map<string, number>();
  let result: RewardSummary | null = null;

  for (const month of monthRangeUntil(planCycle, ym)) {
    const billingForMonth = billingsByYm?.get(month) ?? billing;
    const unitsForMonth = deriveRewardUnits({ milestones, billing: billingForMonth, planCycle, project });
    const uncapped = buildRewardSummaryUncapped({
      ym: month,
      milestones,
      progress,
      responsibilities,
      contributionSharesByKey,
      activeMemberIds,
      memberMap,
      billing: billingForMonth,
      planCycle,
      project,
    }) || buildCarryOnlyReward(memberMap, regularCarryStock, extraCarryStock, unitsForMonth.regularPtUnit, unitsForMonth.extraPtUnit);

    if (!uncapped) continue;
    const caps = deriveMonthlyRewardCaps({ billing: billingForMonth, planCycle, project, hasCapExtra: unitsForMonth.hasCapExtra });
    const capped = applyRewardCapsForMonth(uncapped, caps, regularCarryStock, extraCarryStock, memberMap);
    regularCarryStock.clear();
    extraCarryStock.clear();
    for (const member of capped.members) {
      if ((member.regularStockYen || 0) > 0) regularCarryStock.set(member.memberId, member.regularStockYen || 0);
      if ((member.extraStockYen || 0) > 0) extraCarryStock.set(member.memberId, member.extraStockYen || 0);
    }
    if (month === ym) result = capped;
  }

  if (!result) return null;
  return {
    ...result,
    meta: {
      version: REWARD_SUMMARY_VERSION,
      source: "supabase_reward_summary",
      generatedAt: new Date().toISOString(),
      projectId: billing.project_id,
      ym,
      planCycleId: planCycle?.plan_cycle_id || "",
      ...(isActualContributionAllocationEnabledForYm(ym)
        ? { contributionAllocationSource: "milestone_monthly_contribution_allocations" as const }
        : {}),
    },
  };
}

async function persistRewardSummaryForCycle({
  db,
  projectId,
  ym,
  billing,
  project,
  rewardSummary,
}: {
  db: SupabaseLike;
  projectId: string;
  ym: string;
  billing: BillingRow;
  project: ProjectRow | null;
  rewardSummary: RewardSummary | null;
}) {
  const persistedBudgetYen = derivePersistedCycleBudget({ billing, project });
  const rewardBudgetYen = Math.round(numberValue(rewardSummary?.capBudgetYen));
  const updatePayload: Record<string, unknown> = {
    reward_summary_json: rewardSummary,
    updated_at: new Date().toISOString(),
  };
  const currentBudgetYen = numberValue(billing.budget_yen);
  if (rewardBudgetYen > currentBudgetYen) {
    updatePayload.budget_yen = rewardBudgetYen;
  } else if (currentBudgetYen <= 0 && persistedBudgetYen > 0) {
    updatePayload.budget_yen = persistedBudgetYen;
  }

  const { error } = await db
    .from("billing_cycles")
    .update(updatePayload)
    .eq("project_id", projectId)
    .eq("ym", ym);
  if (error) throw error;
}

function isMissingContributionAllocationTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01"
    || code === "PGRST205"
    || message.includes("milestone_monthly_contribution_allocations")
    || message.includes("could not find the table")
    || message.includes("does not exist");
}

async function persistAutoContributionAllocationRows(db: SupabaseLike, rows: ContributionAllocationRow[]) {
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  const payload = rows.map((row) => ({
    project_id: row.project_id,
    milestone_id: row.milestone_id,
    ym: row.ym,
    member_id: row.member_id,
    planned_share: row.planned_share,
    actual_share: row.actual_share,
    confidence: row.confidence,
    source: row.source,
    status: row.status,
    reason: row.reason,
    evidence_count: row.evidence_count,
    evidence_refs: row.evidence_refs,
    auto_generated_at: now,
    updated_at: now,
  }));
  const { error } = await db
    .from("milestone_monthly_contribution_allocations")
    .upsert(payload, { onConflict: "milestone_id,ym,member_id" });
  if (error && !isMissingContributionAllocationTableError(error)) throw error;
}

export async function syncRewardSummaryForCycle(
  db: SupabaseLike,
  projectId: string,
  ym: string
): Promise<RewardSyncResult> {
  const [billingRes, projectRes, planCyclesRes, membersRes] = await Promise.all([
    db
      .from("billing_cycles")
      .select("project_id, ym, budget_yen, budget_reported_amount, budget_buffer_amount, reward_summary_json")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .maybeSingle(),
    db
      .from("projects")
      .select("project_id, fee_type, fee_amount, start_ym, end_ym")
      .eq("project_id", projectId)
      .maybeSingle(),
    db
      .from("value_plan_cycles")
      .select("plan_cycle_id, project_id, status, budget_yen, total_points, period_start_ym, period_end_ym")
      .eq("project_id", projectId)
      .in("status", ACTIVE_PLAN_STATUSES)
      .order("period_start_ym", { ascending: false }),
    db.from("members").select("member_id, code_name, member_name"),
  ]);

  if (billingRes.error) throw billingRes.error;
  if (projectRes.error) throw projectRes.error;
  if (planCyclesRes.error) throw planCyclesRes.error;
  if (membersRes.error) throw membersRes.error;

  const billing = billingRes.data as BillingRow | null;
  if (!billing) return { ok: false, projectId, ym, rewardSummary: null, skippedReason: "billing_cycle_not_found" };
  const existingManualSummary = manualRewardSummary(billing.reward_summary_json);
  const project = (projectRes.data ?? null) as ProjectRow | null;
  const planCycle = choosePlanCycle((planCyclesRes.data ?? []) as PlanCycleRow[], ym);
  if (!planCycle) {
    if (existingManualSummary) return { ok: true, projectId, ym, rewardSummary: existingManualSummary, skippedReason: "manual_override" };
    return { ok: false, projectId, ym, rewardSummary: null, skippedReason: "plan_cycle_not_found" };
  }

  const milestonesRes = await db
    .from("value_milestones")
    .select("milestone_id, title, points, tag, goal_level, sort_order, period_start_ym, target_ym")
    .eq("plan_cycle_id", planCycle.plan_cycle_id)
    .eq("is_active", true)
    .order("sort_order");
  if (milestonesRes.error) throw milestonesRes.error;

  const milestones = ((milestonesRes.data ?? []) as MilestoneRow[]).filter((ms) => String(ms.goal_level || "").toLowerCase() !== "monthly");
  if (milestones.length === 0) {
    if (existingManualSummary) return { ok: true, projectId, ym, rewardSummary: existingManualSummary, skippedReason: "manual_override" };
    await persistRewardSummaryForCycle({ db, projectId, ym, billing, project, rewardSummary: null });
    return { ok: true, projectId, ym, rewardSummary: null, skippedReason: "milestones_not_found" };
  }

  const milestoneIds = milestones.map((ms) => ms.milestone_id);
  const rewardMonths = monthRangeUntil(planCycle, ym);
  const [progressRes, responsibilitiesRes, billingRangeRes, activitiesRes, contributionAllocationsRes, projectMembersRes] = await Promise.all([
    db
      .from("milestone_monthly_progress")
      .select("milestone_key, ym, progress_pct, consumed_pt, source")
      .in("milestone_key", milestoneIds)
      .lte("ym", ym)
      .order("ym", { ascending: true }),
    db
      .from("milestone_responsibility")
      .select("milestone_id, member_id, share")
      .in("milestone_id", milestoneIds),
    db
      .from("billing_cycles")
      .select("project_id, ym, budget_yen, budget_reported_amount, budget_buffer_amount, reward_summary_json")
      .eq("project_id", projectId)
      .gte("ym", planCycle.period_start_ym)
      .lte("ym", ym)
      .order("ym", { ascending: true }),
    db
      .from("member_activities")
      .select("id, member_id, project_id, ym, source, source_item_id, milestone_id, title, content_preview, item_date, raw_metadata, impact, depth")
      .eq("project_id", projectId)
      .in("ym", rewardMonths)
      .in("milestone_id", milestoneIds),
    db
      .from("milestone_monthly_contribution_allocations")
      .select("project_id, milestone_id, ym, member_id, planned_share, actual_share, confidence, source, status, reason, evidence_count, evidence_refs")
      .eq("project_id", projectId)
      .in("ym", rewardMonths)
      .in("milestone_id", milestoneIds),
    db
      .from("project_members")
      .select("member_id, is_active")
      .eq("project_id", projectId),
  ]);
  if (progressRes.error) throw progressRes.error;
  if (responsibilitiesRes.error) throw responsibilitiesRes.error;
  if (billingRangeRes.error) throw billingRangeRes.error;
  if (activitiesRes.error) throw activitiesRes.error;
  if (contributionAllocationsRes.error && !isMissingContributionAllocationTableError(contributionAllocationsRes.error)) {
    throw contributionAllocationsRes.error;
  }
  if (projectMembersRes.error) throw projectMembersRes.error;

  const activeMemberIds = new Set(
    ((projectMembersRes.data ?? []) as Array<{ member_id: string; is_active: boolean | null }>)
      .filter((row) => row.is_active !== false)
      .map((row) => row.member_id)
  );

  const memberMap: Record<string, string> = {};
  for (const member of (membersRes.data ?? []) as MemberRow[]) {
    memberMap[member.member_id] = member.code_name || member.member_name || member.member_id;
  }

  const contributionPlan = buildContributionAllocationPlan({
    projectId,
    months: rewardMonths,
    milestones,
    responsibilities: (responsibilitiesRes.data ?? []) as ResponsibilityRow[],
    activities: (activitiesRes.data ?? []) as MemberActivityRow[],
    persistedAllocations: contributionAllocationsRes.error
      ? []
      : (contributionAllocationsRes.data ?? []) as ContributionAllocationRow[],
  });
  await persistAutoContributionAllocationRows(db, contributionPlan.autoRowsToPersist);

  const rewardSummary = buildRewardSummary({
    ym,
    milestones,
    progress: (progressRes.data ?? []) as ProgressRow[],
    responsibilities: (responsibilitiesRes.data ?? []) as ResponsibilityRow[],
    contributionSharesByKey: contributionPlan.effectiveSharesByKey,
    activeMemberIds,
    memberMap,
    billing,
    billingsByYm: new Map(((billingRangeRes.data ?? []) as BillingRow[]).map((row) => [row.ym, row])),
    planCycle,
    project,
  });

  if (!rewardSummary || rewardSummary.members.length === 0) {
    if (existingManualSummary) return { ok: true, projectId, ym, rewardSummary: existingManualSummary, skippedReason: "manual_override" };
    await persistRewardSummaryForCycle({ db, projectId, ym, billing, project, rewardSummary: null });
    return { ok: true, projectId, ym, rewardSummary: null, skippedReason: "reward_members_not_found" };
  }

  await persistRewardSummaryForCycle({ db, projectId, ym, billing, project, rewardSummary });

  return { ok: true, projectId, ym, rewardSummary };
}

export interface ForwardUncappedMonth {
  ym: string;
  /** その月に「発生した」uncapped 報酬原価 (円, 単月差分・繰越なし・cap なし) */
  uncappedTotalYen: number;
  /** anchorYm より後の未来月か (= 実績ではなく按分予測) */
  isFuture: boolean;
  members: Array<{ memberId: string; memberName?: string; earnedPt: number; payYen: number }>;
}

/**
 * plan cycle 全期間 (period_start_ym〜period_end_ym) について、各月に「発生した」
 * uncapped メンバー報酬原価を計算して返す。月次収支シミュレータの将来メンバー原価注入用。
 *
 * - capped (= 実際にいくら払うか) ではなく uncapped (= その月に発生した原価) を返す。
 *   capped は月次支払上限 + 繰越平準化が入るため「その月の原価」とはズレる。
 * - 未来月は milestone_monthly_progress に確定行が無くてもアンカー按分 (buildPayableCumMap)
 *   で「期間按分された単月消化pt」を出すので、まとめ達成にはならず月数按分される。
 * - persist=true のとき、未来月 (anchorYm より後) の uncapped を billing_cycles.reward_summary_json
 *   の forecast 用キーに保存する。既存の capped actual (実支払データ) は上書きしない。
 *
 * anchorYm はアンカー月 (= 当月)。ptUnit 導出・contribution share の確定境界に使う。
 * billing_cycle が無い月はスキップ (= INSERT しない)。
 */
export async function computeForwardUncappedMemberCosts(
  db: SupabaseLike,
  projectId: string,
  anchorYm: string,
  options?: { persist?: boolean }
): Promise<{ projectId: string; planCycleId: string | null; months: ForwardUncappedMonth[] }> {
  const persist = options?.persist === true;

  const [projectRes, planCyclesRes, membersRes] = await Promise.all([
    db
      .from("projects")
      .select("project_id, fee_type, fee_amount, start_ym, end_ym")
      .eq("project_id", projectId)
      .maybeSingle(),
    db
      .from("value_plan_cycles")
      .select("plan_cycle_id, project_id, status, budget_yen, total_points, period_start_ym, period_end_ym")
      .eq("project_id", projectId)
      .in("status", ACTIVE_PLAN_STATUSES)
      .order("period_start_ym", { ascending: false }),
    db.from("members").select("member_id, code_name, member_name"),
  ]);
  if (projectRes.error) throw projectRes.error;
  if (planCyclesRes.error) throw planCyclesRes.error;
  if (membersRes.error) throw membersRes.error;

  const project = (projectRes.data ?? null) as ProjectRow | null;
  const planCycle = choosePlanCycle((planCyclesRes.data ?? []) as PlanCycleRow[], anchorYm);
  if (!planCycle) return { projectId, planCycleId: null, months: [] };

  const milestonesRes = await db
    .from("value_milestones")
    .select("milestone_id, title, points, tag, goal_level, sort_order, period_start_ym, target_ym")
    .eq("plan_cycle_id", planCycle.plan_cycle_id)
    .eq("is_active", true)
    .order("sort_order");
  if (milestonesRes.error) throw milestonesRes.error;

  const milestones = ((milestonesRes.data ?? []) as MilestoneRow[]).filter(
    (ms) => String(ms.goal_level || "").toLowerCase() !== "monthly"
  );
  if (milestones.length === 0) return { projectId, planCycleId: planCycle.plan_cycle_id, months: [] };

  const milestoneIds = milestones.map((ms) => ms.milestone_id);
  // 全期間 (start〜end) を対象月レンジにする
  const fullMonths: string[] = [];
  {
    const start = ymToMonths(planCycle.period_start_ym);
    const end = ymToMonths(planCycle.period_end_ym);
    for (let i = start; i <= end; i += 1) fullMonths.push(monthsToYm(i));
  }

  const [progressRes, responsibilitiesRes, billingRangeRes, activitiesRes, contributionAllocationsRes, projectMembersRes] = await Promise.all([
    db
      .from("milestone_monthly_progress")
      .select("milestone_key, ym, progress_pct, consumed_pt, source")
      .in("milestone_key", milestoneIds)
      .order("ym", { ascending: true }),
    db
      .from("milestone_responsibility")
      .select("milestone_id, member_id, share")
      .in("milestone_id", milestoneIds),
    db
      .from("billing_cycles")
      .select("project_id, ym, budget_yen, budget_reported_amount, budget_buffer_amount, reward_summary_json")
      .eq("project_id", projectId)
      .gte("ym", planCycle.period_start_ym)
      .lte("ym", planCycle.period_end_ym)
      .order("ym", { ascending: true }),
    db
      .from("member_activities")
      .select("id, member_id, project_id, ym, source, source_item_id, milestone_id, title, content_preview, item_date, raw_metadata, impact, depth")
      .eq("project_id", projectId)
      .in("ym", fullMonths)
      .in("milestone_id", milestoneIds),
    db
      .from("milestone_monthly_contribution_allocations")
      .select("project_id, milestone_id, ym, member_id, planned_share, actual_share, confidence, source, status, reason, evidence_count, evidence_refs")
      .eq("project_id", projectId)
      .in("ym", fullMonths)
      .in("milestone_id", milestoneIds),
    db
      .from("project_members")
      .select("member_id, is_active")
      .eq("project_id", projectId),
  ]);
  if (progressRes.error) throw progressRes.error;
  if (responsibilitiesRes.error) throw responsibilitiesRes.error;
  if (billingRangeRes.error) throw billingRangeRes.error;
  if (activitiesRes.error) throw activitiesRes.error;
  if (contributionAllocationsRes.error && !isMissingContributionAllocationTableError(contributionAllocationsRes.error)) {
    throw contributionAllocationsRes.error;
  }
  if (projectMembersRes.error) throw projectMembersRes.error;

  const activeMemberIds = new Set(
    ((projectMembersRes.data ?? []) as Array<{ member_id: string; is_active: boolean | null }>)
      .filter((row) => row.is_active !== false)
      .map((row) => row.member_id)
  );
  const memberMap: Record<string, string> = {};
  for (const member of (membersRes.data ?? []) as MemberRow[]) {
    memberMap[member.member_id] = member.code_name || member.member_name || member.member_id;
  }

  const contributionPlan = buildContributionAllocationPlan({
    projectId,
    months: fullMonths,
    milestones,
    responsibilities: (responsibilitiesRes.data ?? []) as ResponsibilityRow[],
    activities: (activitiesRes.data ?? []) as MemberActivityRow[],
    persistedAllocations: contributionAllocationsRes.error
      ? []
      : (contributionAllocationsRes.data ?? []) as ContributionAllocationRow[],
  });

  const progress = (progressRes.data ?? []) as ProgressRow[];
  const responsibilities = (responsibilitiesRes.data ?? []) as ResponsibilityRow[];
  const billingByYm = new Map(((billingRangeRes.data ?? []) as BillingRow[]).map((row) => [row.ym, row]));

  const months: ForwardUncappedMonth[] = [];
  for (const ym of fullMonths) {
    const billing = billingByYm.get(ym);
    if (!billing) continue; // billing_cycle 無い月は INSERT せずスキップ
    const summary = buildRewardSummaryUncapped({
      ym,
      milestones,
      progress,
      responsibilities,
      contributionSharesByKey: contributionPlan.effectiveSharesByKey,
      activeMemberIds,
      memberMap,
      billing,
      planCycle,
      project,
    });
    const uncappedTotalYen = summary
      ? summary.members.reduce((sum, m) => sum + (m.totalPay || 0), 0)
      : 0;
    const isFuture = ym > anchorYm;
    months.push({
      ym,
      uncappedTotalYen,
      isFuture,
      members: (summary?.members ?? []).map((m) => ({
        memberId: m.memberId,
        memberName: m.memberName,
        earnedPt: m.earnedPt,
        payYen: m.totalPay,
      })),
    });

    if (persist && isFuture) {
      const existing = asRecord(billing.reward_summary_json) ?? {};
      const forecastPayload: Record<string, unknown> = {
        ...existing,
        forecastUncapped: {
          uncappedTotalYen,
          members: (summary?.members ?? []).map((m) => ({
            memberId: m.memberId,
            memberName: m.memberName,
            earnedPt: m.earnedPt,
            payYen: m.totalPay,
          })),
          generatedAt: new Date().toISOString(),
          planCycleId: planCycle.plan_cycle_id,
          anchorYm,
        },
      };
      const { error } = await db
        .from("billing_cycles")
        .update({ reward_summary_json: forecastPayload, updated_at: new Date().toISOString() })
        .eq("project_id", projectId)
        .eq("ym", ym);
      if (error) throw error;
    }
  }

  return { projectId, planCycleId: planCycle.plan_cycle_id, months };
}

export interface ForwardCappedMonth {
  ym: string;
  /** その月に実際に支払う capped 報酬 (円, 月次キャップ + 繰越平準化適用後 / 役員・支払対象外を除外済み) */
  cappedTotalYen: number;
  /** anchorYm より後の未来月か (= 実績ではなく按分予測) */
  isFuture: boolean;
  members: Array<{ memberId: string; memberName?: string; earnedPt: number; payYen: number }>;
}

/**
 * plan cycle 全期間 (period_start_ym〜period_end_ym) について、各月に「実際に支払う」
 * capped メンバー報酬を計算して返す。`/admin/payouts`「先12か月 PJ収支」表の将来支払予定注入用。
 *
 * - uncapped (= その月に発生した原価) ではなく capped (= 実際にいくら払うか) を返す。
 *   capped は月次支払上限 (budget_yen) + stock 繰越平準化が入るので「支払予定」の正本 (spec 7-1)。
 * - cap + carryIn 連鎖は `buildRewardSummary` が内部で planCycle 全期間を時系列に回して処理する
 *   (= ここで carryIn を手で連鎖させる必要はない)。期間全 billing を billingsByYm で渡す。
 * - 役員 (is_officer) / 支払対象外 (exclude_from_payout_notice) のメンバーは payYen から「単に落とす」。
 *   抜けた share を他メンバーに再配分はしない (再配分すると AMD 持ち出しが無限に膨らむため。i 案)。
 *
 * anchorYm はアンカー月 (= 当月)。billing_cycle が無い月はスキップ。
 */
export async function computeForwardCappedMemberCosts(
  db: SupabaseLike,
  projectId: string,
  anchorYm: string
): Promise<{ projectId: string; planCycleId: string | null; months: ForwardCappedMonth[] }> {
  const [projectRes, planCyclesRes, membersRes] = await Promise.all([
    db
      .from("projects")
      .select("project_id, fee_type, fee_amount, start_ym, end_ym")
      .eq("project_id", projectId)
      .maybeSingle(),
    db
      .from("value_plan_cycles")
      .select("plan_cycle_id, project_id, status, budget_yen, total_points, period_start_ym, period_end_ym")
      .eq("project_id", projectId)
      .in("status", ACTIVE_PLAN_STATUSES)
      .order("period_start_ym", { ascending: false }),
    db.from("members").select("member_id, code_name, member_name, is_officer, exclude_from_payout_notice"),
  ]);
  if (projectRes.error) throw projectRes.error;
  if (planCyclesRes.error) throw planCyclesRes.error;
  if (membersRes.error) throw membersRes.error;

  const project = (projectRes.data ?? null) as ProjectRow | null;
  const planCycle = choosePlanCycle((planCyclesRes.data ?? []) as PlanCycleRow[], anchorYm);
  if (!planCycle) return { projectId, planCycleId: null, months: [] };

  const milestonesRes = await db
    .from("value_milestones")
    .select("milestone_id, title, points, tag, goal_level, sort_order, period_start_ym, target_ym")
    .eq("plan_cycle_id", planCycle.plan_cycle_id)
    .eq("is_active", true)
    .order("sort_order");
  if (milestonesRes.error) throw milestonesRes.error;

  const milestones = ((milestonesRes.data ?? []) as MilestoneRow[]).filter(
    (ms) => String(ms.goal_level || "").toLowerCase() !== "monthly"
  );
  if (milestones.length === 0) return { projectId, planCycleId: planCycle.plan_cycle_id, months: [] };

  const milestoneIds = milestones.map((ms) => ms.milestone_id);
  const fullMonths: string[] = [];
  {
    const start = ymToMonths(planCycle.period_start_ym);
    const end = ymToMonths(planCycle.period_end_ym);
    for (let i = start; i <= end; i += 1) fullMonths.push(monthsToYm(i));
  }

  const [progressRes, responsibilitiesRes, billingRangeRes, activitiesRes, contributionAllocationsRes, projectMembersRes] = await Promise.all([
    db
      .from("milestone_monthly_progress")
      .select("milestone_key, ym, progress_pct, consumed_pt, source")
      .in("milestone_key", milestoneIds)
      .order("ym", { ascending: true }),
    db
      .from("milestone_responsibility")
      .select("milestone_id, member_id, share")
      .in("milestone_id", milestoneIds),
    db
      .from("billing_cycles")
      .select("project_id, ym, budget_yen, budget_reported_amount, budget_buffer_amount, reward_summary_json")
      .eq("project_id", projectId)
      .gte("ym", planCycle.period_start_ym)
      .lte("ym", planCycle.period_end_ym)
      .order("ym", { ascending: true }),
    db
      .from("member_activities")
      .select("id, member_id, project_id, ym, source, source_item_id, milestone_id, title, content_preview, item_date, raw_metadata, impact, depth")
      .eq("project_id", projectId)
      .in("ym", fullMonths)
      .in("milestone_id", milestoneIds),
    db
      .from("milestone_monthly_contribution_allocations")
      .select("project_id, milestone_id, ym, member_id, planned_share, actual_share, confidence, source, status, reason, evidence_count, evidence_refs")
      .eq("project_id", projectId)
      .in("ym", fullMonths)
      .in("milestone_id", milestoneIds),
    db
      .from("project_members")
      .select("member_id, is_active")
      .eq("project_id", projectId),
  ]);
  if (progressRes.error) throw progressRes.error;
  if (responsibilitiesRes.error) throw responsibilitiesRes.error;
  if (billingRangeRes.error) throw billingRangeRes.error;
  if (activitiesRes.error) throw activitiesRes.error;
  if (contributionAllocationsRes.error && !isMissingContributionAllocationTableError(contributionAllocationsRes.error)) {
    throw contributionAllocationsRes.error;
  }
  if (projectMembersRes.error) throw projectMembersRes.error;

  const activeMemberIds = new Set(
    ((projectMembersRes.data ?? []) as Array<{ member_id: string; is_active: boolean | null }>)
      .filter((row) => row.is_active !== false)
      .map((row) => row.member_id)
  );
  const memberMap: Record<string, string> = {};
  // 役員 / 支払対象外メンバーは支払予定から落とす (i 案: 再配分しない)
  const excludedMemberIds = new Set<string>();
  for (const member of (membersRes.data ?? []) as MemberRow[]) {
    memberMap[member.member_id] = member.code_name || member.member_name || member.member_id;
    if (member.is_officer || member.exclude_from_payout_notice) excludedMemberIds.add(member.member_id);
  }

  const contributionPlan = buildContributionAllocationPlan({
    projectId,
    months: fullMonths,
    milestones,
    responsibilities: (responsibilitiesRes.data ?? []) as ResponsibilityRow[],
    activities: (activitiesRes.data ?? []) as MemberActivityRow[],
    persistedAllocations: contributionAllocationsRes.error
      ? []
      : (contributionAllocationsRes.data ?? []) as ContributionAllocationRow[],
  });

  const progress = (progressRes.data ?? []) as ProgressRow[];
  const responsibilities = (responsibilitiesRes.data ?? []) as ResponsibilityRow[];
  const billingRows = (billingRangeRes.data ?? []) as BillingRow[];
  const billingByYm = new Map(billingRows.map((row) => [row.ym, row]));

  const months: ForwardCappedMonth[] = [];
  for (const ym of fullMonths) {
    const billing = billingByYm.get(ym);
    if (!billing) continue; // billing_cycle 無い月はスキップ
    // buildRewardSummary は planCycle 全期間を内部で時系列に回し cap + stock 繰越を連鎖させる。
    // billingsByYm に期間全 billing を渡すことで各月の cap が正しく効く。
    const summary = buildRewardSummary({
      ym,
      milestones,
      progress,
      responsibilities,
      contributionSharesByKey: contributionPlan.effectiveSharesByKey,
      activeMemberIds,
      memberMap,
      billing,
      billingsByYm: billingByYm,
      planCycle,
      project,
    });
    const payableMembers = (summary?.members ?? []).filter((m) => !excludedMemberIds.has(m.memberId));
    const cappedTotalYen = payableMembers.reduce((sum, m) => sum + (m.totalPay || 0), 0);
    months.push({
      ym,
      cappedTotalYen,
      isFuture: ym > anchorYm,
      members: payableMembers.map((m) => ({
        memberId: m.memberId,
        memberName: m.memberName,
        earnedPt: m.earnedPt,
        payYen: m.totalPay,
      })),
    });
  }

  return { projectId, planCycleId: planCycle.plan_cycle_id, months };
}

export async function syncRewardSummariesForBillingCycles(
  db: SupabaseLike,
  cycles: Array<{ project_id: string; ym: string }>
): Promise<Map<string, RewardSummary>> {
  const synced = new Map<string, RewardSummary>();
  for (const cycle of cycles) {
    const result = await syncRewardSummaryForCycle(db, cycle.project_id, cycle.ym);
    if (result.rewardSummary) synced.set(`${cycle.project_id}:${cycle.ym}`, result.rewardSummary);
  }
  return synced;
}

export async function syncRewardSummariesForProject(
  db: SupabaseLike,
  projectId: string
): Promise<Map<string, RewardSummary>> {
  const cyclesRes = await db
    .from("billing_cycles")
    .select("project_id, ym, reward_paid_at, payout_notice_uploaded_at, payment_confirmed_at")
    .eq("project_id", projectId)
    .order("ym", { ascending: true });
  if (cyclesRes.error) throw cyclesRes.error;
  return syncRewardSummariesForBillingCycles(
    db,
    ((cyclesRes.data ?? []) as Array<{
      project_id: string;
      ym: string;
      reward_paid_at?: string | null;
      payout_notice_uploaded_at?: string | null;
      payment_confirmed_at?: string | null;
    }>).filter((cycle) =>
      cycle.project_id &&
      cycle.ym &&
      !cycle.reward_paid_at &&
      !cycle.payout_notice_uploaded_at &&
      !cycle.payment_confirmed_at
    )
  );
}

export async function syncRewardSummariesForPlanCycle(
  db: SupabaseLike,
  planCycleId: string
): Promise<{ projectId: string; yms: string[]; synced: Map<string, RewardSummary> }> {
  const planCycleRes = await db
    .from("value_plan_cycles")
    .select("project_id, period_start_ym, period_end_ym")
    .eq("plan_cycle_id", planCycleId)
    .maybeSingle();
  if (planCycleRes.error) throw planCycleRes.error;

  const planCycle = planCycleRes.data as { project_id?: string | null; period_start_ym?: string | null; period_end_ym?: string | null } | null;
  const projectId = planCycle?.project_id || "";
  if (!projectId || !planCycle?.period_start_ym || !planCycle?.period_end_ym) {
    return { projectId, yms: [], synced: new Map() };
  }

  const cyclesRes = await db
    .from("billing_cycles")
    .select("project_id, ym")
    .eq("project_id", projectId)
    .gte("ym", planCycle.period_start_ym)
    .lte("ym", planCycle.period_end_ym)
    .order("ym", { ascending: true });
  if (cyclesRes.error) throw cyclesRes.error;

  const cycles = ((cyclesRes.data ?? []) as Array<{ project_id: string; ym: string }>).filter((cycle) => cycle.project_id && cycle.ym);
  const synced = await syncRewardSummariesForBillingCycles(db, cycles);
  return { projectId, yms: cycles.map((cycle) => cycle.ym), synced };
}
