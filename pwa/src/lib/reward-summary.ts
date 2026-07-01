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
import { pointBasisForMilestonePeriod, regularPointBasisForCycle, roundPt } from "@/lib/season-point-basis";

type SupabaseLike = SupabaseClient;

const ACTIVE_PLAN_STATUSES = ["active", "confirmed", "fixed", "draft"];
const REWARD_SUMMARY_VERSION = "server_v3_planned_share";
const CAP_EXTRA_MILESTONE_TAGS = new Set(["cap_extra", "extra_contract", "contract_extra", "cap_outside", "uncapped"]);

type RewardPool = "regular" | "cap_extra";
type ContributionShareSource = "planned";
type ContributionAllocationStatus = "planned";

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
  companyReserveYen?: number;
  regularCompanyReserveYen?: number;
  extraCompanyReserveYen?: number;
  officerReserveYen?: number;
  companyReserveUnfundedYen?: number;
  payoutExcluded?: boolean;
  excludedCarryInYen?: number;
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
  regularTotalGrossDueYen?: number;
  extraTotalGrossDueYen?: number;
  regularCarryOverYen?: number;
  extraCarryOverYen?: number;
  companyReserveYen?: number;
  regularCompanyReserveYen?: number;
  extraCompanyReserveYen?: number;
  officerReserveYen?: number;
  companyReserveUnfundedYen?: number;
  externalPayoutCapYen?: number;
  externalRegularPayoutCapYen?: number;
  externalExtraPayoutCapYen?: number;
  members: RewardMember[];
  meta?: {
    version: string;
    source: "supabase_reward_summary";
    generatedAt: string;
    projectId: string;
    ym: string;
    planCycleId: string;
  };
}

type BillingRow = {
  project_id: string;
  ym: string;
  status?: string | null;
  budget_yen?: number | null;
  budget_reported_amount?: number | string | null;
  budget_buffer_amount?: number | string | null;
  /**
   * 別財布 (cap_extra プール) の当月支払上限。
   *   NULL  = cap 未設定 (= 従来挙動。cap_extra 需要全額を即支払)
   *   0     = 当月別財布支払 0 円 (= 全額 stock 繰越)
   *   N>0   = 当月別財布支払上限 N 円
   * 完了月だけ満額を置くと「完了時一括支払」になる (ZMP OkuDoor, 設計 §5.1)。
   */
  extra_budget_yen?: number | string | null;
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
  activeMemberIds,
}: {
  ym: string;
  milestoneId: string;
  responsibilities: ResponsibilityRow[];
  activeMemberIds?: Set<string>;
}): EffectiveContributionShare[] {
  const planned = responsibilities
    .filter((resp) => resp.milestone_id === milestoneId && normalizeShare(resp.share) > 0)
    .map((resp) => ({
      milestone_id: resp.milestone_id,
      ym,
      member_id: resp.member_id,
      share: normalizeShare(resp.share),
      plannedShare: normalizeShare(resp.share),
      source: "planned" as const,
      status: "planned" as const,
      confidence: 0,
      evidenceCount: 0,
      reason: "milestone_responsibility.share",
    }));
  return filterActiveAndRenormalize(planned, activeMemberIds);
}

function normalizedTag(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isCapExtraMilestone(ms: Pick<MilestoneRow, "tag">): boolean {
  return CAP_EXTRA_MILESTONE_TAGS.has(normalizedTag(ms.tag));
}

function effectiveMilestonePoints(ms: MilestoneRow): number {
  if (isCapExtraMilestone(ms)) {
    const periodPoints = pointBasisForMilestonePeriod(ms);
    if (periodPoints > 0) return periodPoints;
  }
  return roundPt(Math.max(0, numberValue(ms.points)));
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
  if (row.progress_pct != null && row.progress_pct !== "") {
    const pct = Math.max(0, Math.min(100, numberValue(row.progress_pct)));
    return Math.round((pct * Math.max(0, points))) / 100;
  }
  if (row.consumed_pt != null && row.consumed_pt !== "") {
    const consumed = numberValue(row.consumed_pt);
    if (Number.isFinite(consumed)) return Math.max(0, Math.min(Math.max(0, points), consumed));
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
    const points = effectiveMilestonePoints(ms);
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
    cycleStatus: billing.status,
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
  const cycleRegularPt = regularPointBasisForCycle(planCycle);
  if (cycleRegularPt > 0) {
    return {
      hasCapExtra,
      totalPt: cycleRegularPt,
    };
  }
  if (!hasCapExtra) {
    return {
      hasCapExtra,
      totalPt: numberValue(planCycle?.total_points) || milestones.reduce((sum, ms) => sum + effectiveMilestonePoints(ms), 0),
    };
  }
  const extraPt = milestones.filter(isCapExtraMilestone).reduce((sum, ms) => sum + effectiveMilestonePoints(ms), 0);
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
      .reduce((sum, ms) => sum + effectiveMilestonePoints(ms), 0),
  };
}

/** cap_extra MS の points 合計 (= 別財布プールの総pt)。 */
function capExtraPointSum(milestones: MilestoneRow[]): number {
  return milestones.filter(isCapExtraMilestone).reduce((sum, ms) => sum + effectiveMilestonePoints(ms), 0);
}

function deriveRewardUnits({
  milestones,
  billing,
  planCycle,
  project,
  extraPoolBudgetYen,
}: {
  milestones: MilestoneRow[];
  billing: BillingRow;
  planCycle: PlanCycleRow | null;
  project: ProjectRow | null;
  /**
   * 別財布 (cap_extra) プールの総原資 (= Σ billing.extra_budget_yen across cycle)。
   * 渡されたとき、extra pt単価 = extraPoolBudgetYen ÷ Σ(cap_extra pt) で独立に決める。
   * これにより別財布の需要 (pt×単価) が別財布原資に一致し、完了月一括 cap で過不足なく消化される。
   * 未指定なら従来どおり extraPtUnit = regularPtUnit (= regular 単価を借用)。
   */
  extraPoolBudgetYen?: number;
}) {
  const { hasCapExtra, totalPt } = rewardPointBasis(milestones, planCycle);
  const payoutBudget = deriveRewardBudgetForPt({ billing, planCycle, project });
  const regularPtUnit = totalPt > 0 ? Math.round(payoutBudget / totalPt) : 0;
  const extraPt = capExtraPointSum(milestones);
  const extraPtUnit =
    hasCapExtra && extraPoolBudgetYen != null && extraPoolBudgetYen > 0 && extraPt > 0
      ? Math.round(extraPoolBudgetYen / extraPt)
      : regularPtUnit;
  return {
    hasCapExtra,
    regularPtUnit,
    extraPtUnit,
    regularTotalPt: totalPt,
    payoutBudget,
  };
}

/** plan cycle 全期間の Σ billing.extra_budget_yen (= 別財布プールの総原資)。明示値が1つも無ければ null。 */
function sumExtraPoolBudgetYen(billingsByYm: Map<string, BillingRow> | undefined): number | null {
  if (!billingsByYm) return null;
  let total = 0;
  let anySet = false;
  for (const billing of billingsByYm.values()) {
    if (!hasExplicitNumber(billing.extra_budget_yen)) continue;
    anySet = true;
    total += Math.max(0, Math.round(numberValue(billing.extra_budget_yen)));
  }
  return anySet ? total : null;
}

/**
 * cap_extra プール (別財布) の当月 cap を billing.extra_budget_yen から導出する。
 * 戻り値の意味:
 *   null  = cap 未設定 (= 従来挙動。applyRewardCapsForMonth が需要全額にフォールバック)
 *   number (0 含む) = この額を別財布支払 cap にする。0 = 全額 stock 繰越。
 * 本契約 budget_yen と同じ NULL/0 規約を踏襲する (spec 7-1)。
 */
function deriveExtraCapYen(billing: BillingRow): number | null {
  if (!hasExplicitNumber(billing.extra_budget_yen)) return null;
  return Math.max(0, Math.round(numberValue(billing.extra_budget_yen)));
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
}): { regularCapYen: number; extraCapYen: number | null; totalCapYen: number } {
  const fullBudget = deriveMonthlyRewardBudget({ billing, planCycle, project });
  if (!hasCapExtra) {
    return {
      regularCapYen: fullBudget,
      extraCapYen: null,
      totalCapYen: fullBudget,
    };
  }
  // cap_extra プールがある PJ は、regular cap を本契約分 (バッファ控除後) に絞り、
  // 別財布 cap は billing.extra_budget_yen から別枠で導出する。
  const regularCapYen = deriveBaseMonthlyRewardBudget({ billing, planCycle, project });
  const extraCapYen = deriveExtraCapYen(billing);
  return {
    regularCapYen,
    extraCapYen,
    totalCapYen: regularCapYen + (extraCapYen ?? 0),
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
  const clientAmount = contractBackedClientAmount({
    ym: billing.ym,
    project,
    reportedAmount,
    cycleStatus: billing.status,
  });
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
  caps: { regularCapYen: number; extraCapYen: number | null; totalCapYen: number },
  regularCarryStock: Map<string, number>,
  extraCarryStock: Map<string, number>,
  memberMap: Record<string, string> = {},
  options: {
    companyReserveMemberIds?: Set<string>;
    payoutExcludedMemberIds?: Set<string>;
  } = {}
): RewardSummary {
  const companyReserveMemberIds = options.companyReserveMemberIds ?? new Set<string>();
  const payoutExcludedMemberIds = options.payoutExcludedMemberIds ?? new Set<string>();
  const memberById = new Map(reward.members.map((member) => [member.memberId, member]));
  const memberIds = new Set([...memberById.keys(), ...regularCarryStock.keys(), ...extraCarryStock.keys()]);
  const regularInputs: CapAllocationInput[] = [];
  const extraInputs: CapAllocationInput[] = [];
  const baseByMember = new Map<string, {
    regularBasePay: number;
    extraBasePay: number;
    regularCarryInYen: number;
    extraCarryInYen: number;
  }>();

  for (const memberId of memberIds) {
    const member = memberById.get(memberId);
    const extraBasePay = Math.max(0, Math.round(member?.extraBasePay || 0));
    const regularBasePay = Math.max(
      0,
      Math.round(member?.regularBasePay ?? Math.max(0, (member?.basePay || 0) - extraBasePay))
    );
    const regularCarryInYen = regularCarryStock.get(memberId) || 0;
    const extraCarryInYen = extraCarryStock.get(memberId) || 0;
    baseByMember.set(memberId, { regularBasePay, extraBasePay, regularCarryInYen, extraCarryInYen });

    if (payoutExcludedMemberIds.has(memberId) && !companyReserveMemberIds.has(memberId)) continue;

    // 役員 (companyReserve) も非役員と同じく過去 stock を carryIn として cap 按分の母数に入れる。
    // 旧実装は役員だけ carryIn=0 にしており、cap 不足月の役員分が unfunded として消え、
    // 年間で役員 (= AMD 会社留保) が pt 比どおりに受け取れない構造損失があった (まさ確定 2026-06-19)。
    regularInputs.push({
      memberId,
      basePay: regularBasePay,
      carryInYen: regularCarryInYen,
    });
    extraInputs.push({
      memberId,
      basePay: extraBasePay,
      carryInYen: extraCarryInYen,
    });
  }

  const extraGrossBeforeCap = extraInputs.reduce(
    (sum, item) => sum + Math.max(0, Math.round(item.basePay)) + Math.max(0, Math.round(item.carryInYen)),
    0
  );
  // caps.extraCapYen が null = cap 未設定 → 従来どおり需要全額 (= 別財布即払い)。
  // 明示値 (0 含む) → その額を別財布支払 cap にする。0 = 全額 stock 繰越 (= 完了月一括の積立)。
  const effectiveExtraCapYen = caps.extraCapYen == null ? extraGrossBeforeCap : caps.extraCapYen;
  const effectiveTotalCapYen = caps.regularCapYen + effectiveExtraCapYen;

  const regularAllocations = allocateCap(regularInputs, caps.regularCapYen, { payAllWhenCapMissing: false });
  const extraAllocations = allocateCap(extraInputs, effectiveExtraCapYen, { payAllWhenCapMissing: false });

  const paidMembers = Array.from(memberIds)
    .map((memberId) => {
      const member = memberById.get(memberId);
      const baseInfo = baseByMember.get(memberId) ?? { regularBasePay: 0, extraBasePay: 0, regularCarryInYen: 0, extraCarryInYen: 0 };
      const isCompanyReserveMember = companyReserveMemberIds.has(memberId);
      const isCapExcluded = payoutExcludedMemberIds.has(memberId) && !isCompanyReserveMember;
      if (isCapExcluded) {
        const basePay = baseInfo.regularBasePay + baseInfo.extraBasePay;
        const excludedCarryInYen = baseInfo.regularCarryInYen + baseInfo.extraCarryInYen;
        return {
          ...(member || {
            memberId,
            memberName: memberMap[memberId] || memberId,
            earnedPt: 0,
            bonusPt: 0,
            breakdown: [],
          }),
          basePay,
          totalPay: 0,
          carryInYen: 0,
          grossDueYen: basePay,
          cappedFrom: undefined,
          deferredYen: 0,
          stockYen: 0,
          regularBasePay: baseInfo.regularBasePay,
          extraBasePay: baseInfo.extraBasePay,
          regularPaidYen: 0,
          extraPaidYen: 0,
          regularGrossDueYen: baseInfo.regularBasePay,
          extraGrossDueYen: baseInfo.extraBasePay,
          regularStockYen: 0,
          extraStockYen: 0,
          regularCarryInYen: 0,
          extraCarryInYen: 0,
          companyReserveYen: 0,
          regularCompanyReserveYen: 0,
          extraCompanyReserveYen: 0,
          officerReserveYen: 0,
          companyReserveUnfundedYen: 0,
          payoutExcluded: true,
          excludedCarryInYen,
        };
      }
      const regular = regularAllocations.get(memberId) || emptyAllocation();
      const extra = extraAllocations.get(memberId) || emptyAllocation();
      const basePay = regular.basePay + extra.basePay;
      const carryInYen = regular.carryInYen + extra.carryInYen;
      const grossDueYen = regular.grossDueYen + extra.grossDueYen;
      const totalPay = regular.paidYen + extra.paidYen;
      const stockYen = regular.stockYen + extra.stockYen;
      if (isCompanyReserveMember) {
        const companyReserveYen = totalPay;
        const regularCompanyReserveYen = regular.paidYen;
        const extraCompanyReserveYen = extra.paidYen;
        const companyReserveUnfundedYen = Math.max(0, grossDueYen - companyReserveYen);
        const excludedCarryInYen = baseInfo.regularCarryInYen + baseInfo.extraCarryInYen;
        return {
          ...(member || {
            memberId,
            memberName: memberMap[memberId] || memberId,
            earnedPt: 0,
            bonusPt: 0,
            breakdown: [],
          }),
          basePay,
          totalPay: 0,
          carryInYen,
          grossDueYen,
          cappedFrom: companyReserveUnfundedYen > 0 ? grossDueYen : undefined,
          // 役員は現金支払 0 だが、cap 不足で当月会社留保しきれなかった分は
          // stock として翌月へ繰り越す (非役員と同じ扱い)。これで年間で pt 比に収束する。
          deferredYen: stockYen,
          stockYen,
          regularBasePay: regular.basePay,
          extraBasePay: extra.basePay,
          regularPaidYen: 0,
          extraPaidYen: 0,
          regularGrossDueYen: regular.grossDueYen,
          extraGrossDueYen: extra.grossDueYen,
          regularStockYen: regular.stockYen,
          extraStockYen: extra.stockYen,
          regularCarryInYen: regular.carryInYen,
          extraCarryInYen: extra.carryInYen,
          companyReserveYen,
          regularCompanyReserveYen,
          extraCompanyReserveYen,
          officerReserveYen: companyReserveYen,
          companyReserveUnfundedYen,
          payoutExcluded: true,
          excludedCarryInYen,
        };
      }
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
    .filter((member) => (member.grossDueYen || 0) > 0 || (member.earnedPt || 0) > 0 || (member.companyReserveYen || 0) > 0)
    .sort((a, b) => (b.earnedPt || 0) - (a.earnedPt || 0) || (b.grossDueYen || 0) - (a.grossDueYen || 0));

  const totalGrossDue = paidMembers.reduce((sum, member) => sum + (member.grossDueYen || 0), 0);
  const totalPay = paidMembers.reduce((sum, member) => sum + member.totalPay, 0);
  const carryInTotal = paidMembers.reduce((sum, member) => sum + (member.carryInYen || 0), 0);
  const carryOverYen = paidMembers.reduce((sum, member) => sum + (member.stockYen || 0), 0);
  const regularTotalGrossDueYen = paidMembers.reduce((sum, member) => sum + (member.regularGrossDueYen || 0), 0);
  const extraTotalGrossDueYen = paidMembers.reduce((sum, member) => sum + (member.extraGrossDueYen || 0), 0);
  const regularCarryOverYen = paidMembers.reduce((sum, member) => sum + (member.regularStockYen || 0), 0);
  const extraCarryOverYen = paidMembers.reduce((sum, member) => sum + (member.extraStockYen || 0), 0);
  const companyReserveYen = paidMembers.reduce((sum, member) => sum + (member.companyReserveYen || 0), 0);
  const regularCompanyReserveYen = paidMembers.reduce((sum, member) => sum + (member.regularCompanyReserveYen || 0), 0);
  const extraCompanyReserveYen = paidMembers.reduce((sum, member) => sum + (member.extraCompanyReserveYen || 0), 0);
  const officerReserveYen = paidMembers.reduce((sum, member) => sum + (member.officerReserveYen || 0), 0);
  const companyReserveUnfundedYen = paidMembers.reduce((sum, member) => sum + (member.companyReserveUnfundedYen || 0), 0);
  const externalRegularPayoutCapYen = paidMembers.reduce(
    (sum, member) => sum + (companyReserveMemberIds.has(member.memberId) ? 0 : (member.regularPaidYen || 0)),
    0
  );
  const externalExtraPayoutCapYen = paidMembers.reduce(
    (sum, member) => sum + (companyReserveMemberIds.has(member.memberId) ? 0 : (member.extraPaidYen || 0)),
    0
  );

  return {
    ...reward,
    members: paidMembers,
    totalPaySum: totalPay,
    totalGrossDueYen: totalGrossDue,
    capBudgetYen: effectiveTotalCapYen,
    capped: carryOverYen > 0 || companyReserveUnfundedYen > 0,
    carryInYen: carryInTotal,
    carryOverYen,
    monthlyBudget65: effectiveTotalCapYen,
    regularCapBudgetYen: caps.regularCapYen,
    extraCapBudgetYen: effectiveExtraCapYen,
    externalPayoutCapYen: externalRegularPayoutCapYen + externalExtraPayoutCapYen,
    externalRegularPayoutCapYen,
    externalExtraPayoutCapYen,
    companyReserveYen,
    regularCompanyReserveYen,
    extraCompanyReserveYen,
    officerReserveYen,
    companyReserveUnfundedYen,
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
  activeMemberIds,
  memberMap,
  billing,
  planCycle,
  project,
  extraPoolBudgetYen,
}: {
  ym: string;
  milestones: MilestoneRow[];
  progress: ProgressRow[];
  responsibilities: ResponsibilityRow[];
  activeMemberIds?: Set<string>;
  memberMap: Record<string, string>;
  billing: BillingRow;
  planCycle: PlanCycleRow | null;
  project: ProjectRow | null;
  /** 別財布 (cap_extra) プールの総原資。extra pt単価の独立導出に使う (deriveRewardUnits 参照)。 */
  extraPoolBudgetYen?: number;
}): RewardSummary | null {
  if (milestones.length === 0 || responsibilities.length === 0) return null;

  const prevYm = prevYmStr(ym);
  const prevConsumedMap = buildPayableCumMap(progress, milestones, planCycle, prevYm);
  const currConsumedMap = buildPayableCumMap(progress, milestones, planCycle, ym);
  const msById = new Map(milestones.map((ms) => [ms.milestone_id, ms]));
  const { regularPtUnit, extraPtUnit, hasCapExtra } = deriveRewardUnits({ milestones, billing, planCycle, project, extraPoolBudgetYen });
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
      activeMemberIds,
    }).filter((resp) => resp.share > 0);
    for (const resp of resps) {
      const prevEarnedPtRaw = Math.max(0, prev * resp.share);
      const currEarnedPtRaw = Math.max(0, curr * resp.share);
      const earnedPtRaw = Math.max(0, currEarnedPtRaw - prevEarnedPtRaw);
      const earnedPt = Math.round(earnedPtRaw * 100) / 100;
      // 円額は「累計pt×単価」の差分で出す。月ごとの earnedPt 丸めを先に噛ませると、
      // SX DD対応のような長いMSで 0.01pt 分の年計ドリフトが出るため。
      const payYen = Math.max(0, Math.round(currEarnedPtRaw * ptUnit) - Math.round(prevEarnedPtRaw * ptUnit));
      const current = memberPt.get(resp.member_id) || { total: 0, regular: 0, extra: 0, regularBasePay: 0, extraBasePay: 0 };
      current.total += earnedPtRaw;
      if (pool === "cap_extra") {
        current.extra += earnedPtRaw;
        current.extraBasePay += payYen;
      } else {
        current.regular += earnedPtRaw;
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
  activeMemberIds,
  companyReserveMemberIds,
  payoutExcludedMemberIds,
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
  activeMemberIds?: Set<string>;
  companyReserveMemberIds?: Set<string>;
  payoutExcludedMemberIds?: Set<string>;
  memberMap: Record<string, string>;
  billing: BillingRow;
  billingsByYm?: Map<string, BillingRow>;
  planCycle: PlanCycleRow | null;
  project: ProjectRow | null;
}): RewardSummary | null {
  const regularCarryStock = new Map<string, number>();
  const extraCarryStock = new Map<string, number>();
  let result: RewardSummary | null = null;

  // 別財布 (cap_extra) プールの総原資 = Σ billing.extra_budget_yen。extra pt単価の独立導出に使う。
  const extraPoolBudgetYen = sumExtraPoolBudgetYen(billingsByYm) ?? undefined;

  for (const month of monthRangeUntil(planCycle, ym)) {
    const billingForMonth = billingsByYm?.get(month) ?? billing;
    const unitsForMonth = deriveRewardUnits({ milestones, billing: billingForMonth, planCycle, project, extraPoolBudgetYen });
    const uncapped = buildRewardSummaryUncapped({
      ym: month,
      milestones,
      progress,
      responsibilities,
      activeMemberIds,
      memberMap,
      billing: billingForMonth,
      planCycle,
      project,
      extraPoolBudgetYen,
    }) || buildCarryOnlyReward(memberMap, regularCarryStock, extraCarryStock, unitsForMonth.regularPtUnit, unitsForMonth.extraPtUnit);

    if (!uncapped) continue;
    const caps = deriveMonthlyRewardCaps({ billing: billingForMonth, planCycle, project, hasCapExtra: unitsForMonth.hasCapExtra });
    const capped = applyRewardCapsForMonth(uncapped, caps, regularCarryStock, extraCarryStock, memberMap, {
      companyReserveMemberIds,
      payoutExcludedMemberIds,
    });
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
  const rewardBudgetYen = Math.round(numberValue(rewardSummary?.regularCapBudgetYen ?? rewardSummary?.capBudgetYen));
  const updatePayload: Record<string, unknown> = {
    reward_summary_json: rewardSummary,
    updated_at: new Date().toISOString(),
  };
  const currentBudgetYen = numberValue(billing.budget_yen);
  if (rewardBudgetYen > 0 && rewardBudgetYen !== currentBudgetYen) {
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

function emptyRewardSummaryForCycle(
  projectId: string,
  ym: string,
  planCycleId = ""
): RewardSummary {
  return {
    members: [],
    totalPaySum: 0,
    totalGrossDueYen: 0,
    capBudgetYen: 0,
    capped: false,
    carryInYen: 0,
    carryOverYen: 0,
    monthlyBudget65: 0,
    regularCapBudgetYen: 0,
    extraCapBudgetYen: 0,
    regularTotalGrossDueYen: 0,
    extraTotalGrossDueYen: 0,
    regularCarryOverYen: 0,
    extraCarryOverYen: 0,
    companyReserveYen: 0,
    regularCompanyReserveYen: 0,
    extraCompanyReserveYen: 0,
    officerReserveYen: 0,
    companyReserveUnfundedYen: 0,
    externalPayoutCapYen: 0,
    externalRegularPayoutCapYen: 0,
    externalExtraPayoutCapYen: 0,
    meta: {
      version: REWARD_SUMMARY_VERSION,
      source: "supabase_reward_summary",
      generatedAt: new Date().toISOString(),
      projectId,
      ym,
      planCycleId,
    },
  };
}

export async function syncRewardSummaryForCycle(
  db: SupabaseLike,
  projectId: string,
  ym: string
): Promise<RewardSyncResult> {
  const [billingRes, projectRes, planCyclesRes, membersRes] = await Promise.all([
    db
      .from("billing_cycles")
      .select("project_id, ym, status, budget_yen, budget_reported_amount, budget_buffer_amount, extra_budget_yen, reward_summary_json")
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
    db.from("members").select("member_id, code_name, member_name, is_officer, exclude_from_payout_notice"),
  ]);

  if (billingRes.error) throw billingRes.error;
  if (projectRes.error) throw projectRes.error;
  if (planCyclesRes.error) throw planCyclesRes.error;
  if (membersRes.error) throw membersRes.error;

  const billing = billingRes.data as BillingRow | null;
  if (!billing) return { ok: false, projectId, ym, rewardSummary: null, skippedReason: "billing_cycle_not_found" };
  const project = (projectRes.data ?? null) as ProjectRow | null;
  const planCycle = choosePlanCycle((planCyclesRes.data ?? []) as PlanCycleRow[], ym);
  if (!planCycle) {
    const emptySummary = emptyRewardSummaryForCycle(projectId, ym);
    await persistRewardSummaryForCycle({ db, projectId, ym, billing, project, rewardSummary: emptySummary });
    return { ok: true, projectId, ym, rewardSummary: emptySummary, skippedReason: "plan_cycle_not_found" };
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
    const emptySummary = emptyRewardSummaryForCycle(projectId, ym, planCycle.plan_cycle_id);
    await persistRewardSummaryForCycle({ db, projectId, ym, billing, project, rewardSummary: emptySummary });
    return { ok: true, projectId, ym, rewardSummary: emptySummary, skippedReason: "milestones_not_found" };
  }

  const milestoneIds = milestones.map((ms) => ms.milestone_id);
  const [progressRes, responsibilitiesRes, billingRangeRes, projectMembersRes] = await Promise.all([
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
      .select("project_id, ym, status, budget_yen, budget_reported_amount, budget_buffer_amount, extra_budget_yen, reward_summary_json")
      .eq("project_id", projectId)
      .gte("ym", planCycle.period_start_ym)
      .lte("ym", planCycle.period_end_ym)
      .order("ym", { ascending: true }),
    db
      .from("project_members")
      .select("member_id, is_active")
      .eq("project_id", projectId),
  ]);
  if (progressRes.error) throw progressRes.error;
  if (responsibilitiesRes.error) throw responsibilitiesRes.error;
  if (billingRangeRes.error) throw billingRangeRes.error;
  if (projectMembersRes.error) throw projectMembersRes.error;

  const activeMemberIds = new Set(
    ((projectMembersRes.data ?? []) as Array<{ member_id: string; is_active: boolean | null }>)
      .filter((row) => row.is_active !== false)
      .map((row) => row.member_id)
  );

  const memberMap: Record<string, string> = {};
  const companyReserveMemberIds = new Set<string>();
  const payoutExcludedMemberIds = new Set<string>();
  for (const member of (membersRes.data ?? []) as MemberRow[]) {
    memberMap[member.member_id] = member.code_name || member.member_name || member.member_id;
    if (member.is_officer) companyReserveMemberIds.add(member.member_id);
    if (member.exclude_from_payout_notice) payoutExcludedMemberIds.add(member.member_id);
  }

  const rewardSummary = buildRewardSummary({
    ym,
    milestones,
    progress: (progressRes.data ?? []) as ProgressRow[],
    responsibilities: (responsibilitiesRes.data ?? []) as ResponsibilityRow[],
    activeMemberIds,
    companyReserveMemberIds,
    payoutExcludedMemberIds,
    memberMap,
    billing,
    billingsByYm: new Map(((billingRangeRes.data ?? []) as BillingRow[]).map((row) => [row.ym, row])),
    planCycle,
    project,
  });

  if (!rewardSummary || rewardSummary.members.length === 0) {
    const emptySummary = emptyRewardSummaryForCycle(projectId, ym, planCycle.plan_cycle_id);
    await persistRewardSummaryForCycle({ db, projectId, ym, billing, project, rewardSummary: emptySummary });
    return { ok: true, projectId, ym, rewardSummary: emptySummary, skippedReason: "reward_members_not_found" };
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

  const [progressRes, responsibilitiesRes, billingRangeRes, projectMembersRes] = await Promise.all([
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
      .select("project_id, ym, status, budget_yen, budget_reported_amount, budget_buffer_amount, extra_budget_yen, reward_summary_json")
      .eq("project_id", projectId)
      .gte("ym", planCycle.period_start_ym)
      .lte("ym", planCycle.period_end_ym)
      .order("ym", { ascending: true }),
    db
      .from("project_members")
      .select("member_id, is_active")
      .eq("project_id", projectId),
  ]);
  if (progressRes.error) throw progressRes.error;
  if (responsibilitiesRes.error) throw responsibilitiesRes.error;
  if (billingRangeRes.error) throw billingRangeRes.error;
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

  const progress = (progressRes.data ?? []) as ProgressRow[];
  const responsibilities = (responsibilitiesRes.data ?? []) as ResponsibilityRow[];
  const billingByYm = new Map(((billingRangeRes.data ?? []) as BillingRow[]).map((row) => [row.ym, row]));
  const extraPoolBudgetYen = sumExtraPoolBudgetYen(billingByYm) ?? undefined;

  const months: ForwardUncappedMonth[] = [];
  for (const ym of fullMonths) {
    const billing = billingByYm.get(ym);
    if (!billing) continue; // billing_cycle 無い月は INSERT せずスキップ
    const summary = buildRewardSummaryUncapped({
      ym,
      milestones,
      progress,
      responsibilities,
      activeMemberIds,
      memberMap,
      billing,
      planCycle,
      project,
      extraPoolBudgetYen,
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
  /** 本契約capを使う capped 額。役員の会社留保分も含める。 */
  cappedRegularYen: number;
  /** 別財布(cap_extra)を使う capped 額。役員の会社留保分も含める。 */
  cappedExtraYen: number;
  /** 本契約capから外部メンバーへ実際に支払う額。会社留保は含めない。 */
  cappedRegularExternalYen: number;
  /** 別財布から外部メンバーへ実際に支払う額。会社留保は含めない。 */
  cappedExtraExternalYen: number;
  /** 本契約capで役員稼働分として内部留保される額。 */
  regularCompanyReserveYen: number;
  /** 別財布で役員稼働分として内部留保される額。 */
  extraCompanyReserveYen: number;
  /** 本契約capに対する当月の報酬需要。carry-in を含む。 */
  regularGrossDueYen: number;
  /** 別財布に対する当月の報酬需要。carry-in を含む。 */
  extraGrossDueYen: number;
  /** 非役員メンバーへの月末未払い残。 */
  carryOverYen: number;
  /** anchorYm より後の未来月か (= 実績ではなく按分予測) */
  isFuture: boolean;
  members: Array<{ memberId: string; memberName?: string; earnedPt: number; payYen: number; regularPayYen: number; extraPayYen: number }>;
}

/**
 * plan cycle 全期間 (period_start_ym〜period_end_ym) について、各月に「本契約cap / 別財布をいくら使うか」
 * と、外部支払・会社留保・報酬需要・carry-over の内訳を計算して返す。
 * `/admin/payouts` と `/management-score` の先12か月目的別4表の将来月注入用。
 *
 * - uncapped (= その月に発生した原価) ではなく capped (= 実際にいくら払うか) を返す。
 *   capped は月次支払上限 (budget_yen) + stock 繰越平準化が入るので「支払予定」の正本 (spec 7-1)。
 * - cap + carryIn 連鎖は `buildRewardSummary` が内部で planCycle 全期間を時系列に回して処理する
 *   (= ここで carryIn を手で連鎖させる必要はない)。期間全 billing を billingsByYm で渡す。
 * - 役員 (is_officer) は通常メンバーと同じ cap 配分に入れ、会社留保分として regular/extra に分けて返す。
 * - 支払対象外 (exclude_from_payout_notice) のメンバーは cap 配分から単に落とす。
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

  const [progressRes, responsibilitiesRes, billingRangeRes, projectMembersRes] = await Promise.all([
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
      .select("project_id, ym, status, budget_yen, budget_reported_amount, budget_buffer_amount, extra_budget_yen, reward_summary_json")
      .eq("project_id", projectId)
      .gte("ym", planCycle.period_start_ym)
      .lte("ym", planCycle.period_end_ym)
      .order("ym", { ascending: true }),
    db
      .from("project_members")
      .select("member_id, is_active")
      .eq("project_id", projectId),
  ]);
  if (progressRes.error) throw progressRes.error;
  if (responsibilitiesRes.error) throw responsibilitiesRes.error;
  if (billingRangeRes.error) throw billingRangeRes.error;
  if (projectMembersRes.error) throw projectMembersRes.error;

  const activeMemberIds = new Set(
    ((projectMembersRes.data ?? []) as Array<{ member_id: string; is_active: boolean | null }>)
      .filter((row) => row.is_active !== false)
      .map((row) => row.member_id)
  );
  const memberMap: Record<string, string> = {};
  // 支払対象外メンバーは cap 配分から落とす。役員は同じ cap 配分に入れたうえで会社留保に振る。
  const excludedMemberIds = new Set<string>();
  const companyReserveMemberIds = new Set<string>();
  for (const member of (membersRes.data ?? []) as MemberRow[]) {
    memberMap[member.member_id] = member.code_name || member.member_name || member.member_id;
    if (member.is_officer) companyReserveMemberIds.add(member.member_id);
    if (member.exclude_from_payout_notice) excludedMemberIds.add(member.member_id);
  }

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
      activeMemberIds,
      companyReserveMemberIds,
      payoutExcludedMemberIds: excludedMemberIds,
      memberMap,
      billing,
      billingsByYm: billingByYm,
      planCycle,
      project,
    });
    const members = summary?.members ?? [];
    const payableMembers = members.filter((m) => !excludedMemberIds.has(m.memberId) && !m.payoutExcluded);
    const cappedRegularExternalYen = summary?.externalRegularPayoutCapYen ?? payableMembers.reduce((sum, m) => sum + (m.regularPaidYen || 0), 0);
    const cappedExtraExternalYen = summary?.externalExtraPayoutCapYen ?? payableMembers.reduce((sum, m) => sum + (m.extraPaidYen || 0), 0);
    const regularCompanyReserveYen = summary?.regularCompanyReserveYen || 0;
    const extraCompanyReserveYen = summary?.extraCompanyReserveYen || 0;
    const cappedRegularYen = cappedRegularExternalYen + regularCompanyReserveYen;
    const cappedExtraYen = cappedExtraExternalYen + extraCompanyReserveYen;
    const cappedTotalYen = cappedRegularYen + cappedExtraYen;
    months.push({
      ym,
      cappedTotalYen,
      cappedRegularYen,
      cappedExtraYen,
      cappedRegularExternalYen,
      cappedExtraExternalYen,
      regularCompanyReserveYen,
      extraCompanyReserveYen,
      regularGrossDueYen: summary?.regularTotalGrossDueYen || 0,
      extraGrossDueYen: summary?.extraTotalGrossDueYen || 0,
      carryOverYen: summary?.carryOverYen || 0,
      isFuture: ym > anchorYm,
      members: payableMembers.map((m) => ({
        memberId: m.memberId,
        memberName: m.memberName,
        earnedPt: m.earnedPt,
        payYen: m.totalPay,
        regularPayYen: m.regularPaidYen || 0,
        extraPayYen: m.extraPaidYen || 0,
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
