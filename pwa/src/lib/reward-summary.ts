type SupabaseLike = {
  from: (table: string) => any;
};

const ACTIVE_PLAN_STATUSES = ["active", "confirmed", "fixed", "draft"];
const REWARD_SUMMARY_VERSION = "server_v1";

export interface RewardBreakdown {
  msKey: string;
  title: string;
  share: number;
  earnedPt: number;
  msConsumedPt: number;
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
  budget_yen?: number | null;
  budget_reported_amount?: number | string | null;
  budget_buffer_amount?: number | string | null;
  reward_summary_json?: unknown;
};

type ProjectRow = {
  project_id: string;
  fee_type?: string | null;
  fee_amount?: number | string | null;
};

type PlanCycleRow = {
  plan_cycle_id: string;
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
  sort_order?: number | string | null;
};

type ProgressRow = {
  milestone_key: string;
  ym: string;
  progress_pct?: number | string | null;
  consumed_pt?: number | string | null;
};

type ResponsibilityRow = {
  milestone_id: string;
  member_id: string;
  share?: number | string | null;
};

type MemberRow = {
  member_id: string;
  code_name?: string | null;
  member_name?: string | null;
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
  const containing = activeRows
    .filter((row) => row.period_start_ym <= ym && row.period_end_ym >= ym)
    .sort((a, b) => b.period_start_ym.localeCompare(a.period_start_ym))[0];
  if (containing) return containing;
  return activeRows
    .filter((row) => row.period_start_ym <= ym)
    .sort((a, b) => b.period_start_ym.localeCompare(a.period_start_ym))[0] ?? null;
}

function latestProgressBefore(progress: ProgressRow[], milestoneId: string, ym: string): ProgressRow | null {
  let latest: ProgressRow | null = null;
  for (const p of progress) {
    if (p.milestone_key !== milestoneId || p.ym > ym) continue;
    if (!latest || p.ym > latest.ym) latest = p;
  }
  return latest;
}

function buildEffectiveConsumedMap(progress: ProgressRow[], milestones: MilestoneRow[], ym: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const ms of milestones) {
    map.set(ms.milestone_id, numberValue(latestProgressBefore(progress, ms.milestone_id, ym)?.consumed_pt));
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
  if (String(project?.fee_type || "").toLowerCase() === "monthly_fixed") {
    const fee = numberValue(project?.fee_amount);
    if (fee > 0) return Math.round(fee * 0.65 * cycleMonthCount(planCycle));
  }
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
  const billingBudget = numberValue(billing.budget_yen);
  if (billingBudget > 0) return Math.round(billingBudget);
  if (String(project?.fee_type || "").toLowerCase() === "monthly_fixed") {
    const fee = numberValue(project?.fee_amount);
    if (fee > 0) return Math.round(fee * 0.65);
  }
  const cycleBudget = numberValue(planCycle?.budget_yen);
  if (cycleBudget > 0) return Math.round(cycleBudget / cycleMonthCount(planCycle));
  return 0;
}

function derivePersistedCycleBudget({
  billing,
  project,
}: {
  billing: BillingRow;
  project: ProjectRow | null;
}): number {
  const current = numberValue(billing.budget_yen);
  if (current > 0) return Math.round(current);

  const reportedAmount = numberValue(billing.budget_reported_amount);
  if (reportedAmount > 0) {
    return Math.max(0, Math.round(reportedAmount * 0.65) - Math.round(numberValue(billing.budget_buffer_amount)));
  }

  if (String(project?.fee_type || "").toLowerCase() === "monthly_fixed") {
    const fee = numberValue(project?.fee_amount);
    if (fee > 0) return Math.round(fee * 0.65);
  }

  return 0;
}

function buildCarryOnlyReward(memberMap: Record<string, string>, carryStock: Map<string, number>, ptUnit: number): RewardSummary | null {
  const members = Array.from(carryStock.entries())
    .filter(([, amount]) => amount > 0)
    .map(([memberId, amount]) => ({
      memberId,
      memberName: memberMap[memberId] || memberId,
      earnedPt: 0,
      basePay: 0,
      bonusPt: 0,
      totalPay: 0,
      carryInYen: Math.round(amount),
      grossDueYen: Math.round(amount),
      breakdown: [],
    }));
  if (members.length === 0) return null;
  return { ptUnit, totalPaySum: 0, members };
}

export function applyRewardCapForMonth(
  reward: RewardSummary,
  capBudgetYen: number,
  carryStock: Map<string, number>
): RewardSummary {
  const cap = Math.round(Number(capBudgetYen || 0));
  const membersWithGross = reward.members.map((member) => {
    const currentEarned = Math.round(member.totalPay || member.basePay || 0);
    const carryIn = Math.round(carryStock.get(member.memberId) || member.carryInYen || 0);
    const grossDue = Math.max(0, currentEarned + carryIn);
    return {
      ...member,
      basePay: Math.round(member.basePay || currentEarned),
      carryInYen: carryIn,
      grossDueYen: grossDue,
      totalPay: currentEarned,
    };
  });

  const totalGrossDue = membersWithGross.reduce((sum, member) => sum + (member.grossDueYen || 0), 0);
  const carryInTotal = membersWithGross.reduce((sum, member) => sum + (member.carryInYen || 0), 0);
  if (cap <= 0 || totalGrossDue <= cap) {
    const paidMembers = membersWithGross.map((member) => ({
      ...member,
      totalPay: member.grossDueYen || 0,
      deferredYen: 0,
      stockYen: 0,
    }));
    return {
      ...reward,
      members: paidMembers,
      totalPaySum: paidMembers.reduce((sum, member) => sum + member.totalPay, 0),
      totalGrossDueYen: totalGrossDue,
      capBudgetYen: cap,
      capped: false,
      carryInYen: carryInTotal,
      carryOverYen: 0,
      monthlyBudget65: cap,
    };
  }

  let remainingCap = cap;
  let remainingGross = totalGrossDue;
  const paidMembers = membersWithGross.map((member, index) => {
    const grossDue = member.grossDueYen || 0;
    const isLast = index === membersWithGross.length - 1;
    const proportional = remainingGross > 0 ? Math.round((remainingCap * grossDue) / remainingGross) : 0;
    const paid = Math.min(grossDue, Math.max(0, isLast ? remainingCap : proportional));
    remainingCap -= paid;
    remainingGross -= grossDue;
    const deferred = Math.max(0, grossDue - paid);
    return {
      ...member,
      cappedFrom: grossDue,
      totalPay: paid,
      deferredYen: deferred,
      stockYen: deferred,
    };
  });

  return {
    ...reward,
    members: paidMembers,
    totalPaySum: paidMembers.reduce((sum, member) => sum + member.totalPay, 0),
    totalGrossDueYen: totalGrossDue,
    capBudgetYen: cap,
    capped: true,
    carryInYen: carryInTotal,
    carryOverYen: paidMembers.reduce((sum, member) => sum + (member.stockYen || 0), 0),
    monthlyBudget65: cap,
  };
}

function buildRewardSummaryUncapped({
  ym,
  milestones,
  progress,
  responsibilities,
  memberMap,
  billing,
  planCycle,
  project,
}: {
  ym: string;
  milestones: MilestoneRow[];
  progress: ProgressRow[];
  responsibilities: ResponsibilityRow[];
  memberMap: Record<string, string>;
  billing: BillingRow;
  planCycle: PlanCycleRow | null;
  project: ProjectRow | null;
}): RewardSummary | null {
  if (milestones.length === 0 || responsibilities.length === 0) return null;

  const prevYm = prevYmStr(ym);
  const prevConsumedMap = buildEffectiveConsumedMap(progress, milestones, prevYm);
  const currConsumedMap = buildEffectiveConsumedMap(progress, milestones, ym);
  const msById = new Map(milestones.map((ms) => [ms.milestone_id, ms]));
  const totalPt = numberValue(planCycle?.total_points) || milestones.reduce((sum, ms) => sum + numberValue(ms.points), 0);
  const payoutBudget = deriveRewardBudgetForPt({ billing, planCycle, project });
  const ptUnit = totalPt > 0 ? Math.round(payoutBudget / totalPt) : 0;
  const memberPt = new Map<string, number>();
  const memberBreakdown = new Map<string, RewardBreakdown[]>();

  for (const ms of milestones) {
    const curr = currConsumedMap.get(ms.milestone_id) || 0;
    const prev = prevConsumedMap.get(ms.milestone_id) || 0;
    const msConsumedPt = Math.round(Math.max(0, curr - prev) * 100) / 100;
    if (msConsumedPt <= 0) continue;

    const resps = responsibilities.filter((resp) => resp.milestone_id === ms.milestone_id && numberValue(resp.share) > 0);
    for (const resp of resps) {
      const earnedPt = Math.round(msConsumedPt * numberValue(resp.share) * 100) / 100;
      memberPt.set(resp.member_id, (memberPt.get(resp.member_id) || 0) + earnedPt);
      const list = memberBreakdown.get(resp.member_id) || [];
      list.push({
        msKey: ms.milestone_id,
        title: msById.get(ms.milestone_id)?.title || ms.milestone_id,
        msConsumedPt,
        share: numberValue(resp.share),
        earnedPt,
      });
      memberBreakdown.set(resp.member_id, list);
    }
  }

  const members = Array.from(memberPt.entries())
    .map(([memberId, earned]) => {
      const earnedPt = Math.round(earned * 100) / 100;
      const basePay = Math.round(earnedPt * ptUnit);
      return {
        memberId,
        memberName: memberMap[memberId] || memberId,
        earnedPt,
        basePay,
        bonusPt: 0,
        totalPay: basePay,
        breakdown: memberBreakdown.get(memberId) || [],
      };
    })
    .filter((member) => member.earnedPt > 0)
    .sort((a, b) => b.earnedPt - a.earnedPt);

  if (members.length === 0) return null;

  return {
    ptUnit,
    totalPaySum: members.reduce((sum, member) => sum + member.totalPay, 0),
    members,
  };
}

export function buildRewardSummary({
  ym,
  milestones,
  progress,
  responsibilities,
  memberMap,
  billing,
  planCycle,
  project,
}: {
  ym: string;
  milestones: MilestoneRow[];
  progress: ProgressRow[];
  responsibilities: ResponsibilityRow[];
  memberMap: Record<string, string>;
  billing: BillingRow;
  planCycle: PlanCycleRow | null;
  project: ProjectRow | null;
}): RewardSummary | null {
  const monthlyCap = deriveMonthlyRewardBudget({ billing, planCycle, project });
  const totalPt = numberValue(planCycle?.total_points) || milestones.reduce((sum, ms) => sum + numberValue(ms.points), 0);
  const payoutBudget = deriveRewardBudgetForPt({ billing, planCycle, project });
  const ptUnit = totalPt > 0 ? Math.round(payoutBudget / totalPt) : 0;
  const carryStock = new Map<string, number>();
  let result: RewardSummary | null = null;

  for (const month of monthRangeUntil(planCycle, ym)) {
    const uncapped = buildRewardSummaryUncapped({
      ym: month,
      milestones,
      progress,
      responsibilities,
      memberMap,
      billing,
      planCycle,
      project,
    }) || buildCarryOnlyReward(memberMap, carryStock, ptUnit);

    if (!uncapped) continue;
    const capped = applyRewardCapForMonth(uncapped, monthlyCap, carryStock);
    carryStock.clear();
    for (const member of capped.members) {
      if ((member.stockYen || 0) > 0) carryStock.set(member.memberId, member.stockYen || 0);
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
      .select("project_id, fee_type, fee_amount")
      .eq("project_id", projectId)
      .maybeSingle(),
    db
      .from("value_plan_cycles")
      .select("plan_cycle_id, status, budget_yen, total_points, period_start_ym, period_end_ym")
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
  const project = (projectRes.data ?? null) as ProjectRow | null;
  const planCycle = choosePlanCycle((planCyclesRes.data ?? []) as PlanCycleRow[], ym);
  if (!planCycle) return { ok: false, projectId, ym, rewardSummary: null, skippedReason: "plan_cycle_not_found" };

  const milestonesRes = await db
    .from("value_milestones")
    .select("milestone_id, title, points, tag, sort_order")
    .eq("plan_cycle_id", planCycle.plan_cycle_id)
    .eq("is_active", true)
    .order("sort_order");
  if (milestonesRes.error) throw milestonesRes.error;

  const milestones = ((milestonesRes.data ?? []) as MilestoneRow[]).filter((ms) => String(ms.tag || "").toLowerCase() !== "routine");
  if (milestones.length === 0) return { ok: false, projectId, ym, rewardSummary: null, skippedReason: "milestones_not_found" };

  const milestoneIds = milestones.map((ms) => ms.milestone_id);
  const [progressRes, responsibilitiesRes] = await Promise.all([
    db
      .from("milestone_monthly_progress")
      .select("milestone_key, ym, progress_pct, consumed_pt")
      .in("milestone_key", milestoneIds)
      .lte("ym", ym)
      .order("ym", { ascending: true }),
    db
      .from("milestone_responsibility")
      .select("milestone_id, member_id, share")
      .in("milestone_id", milestoneIds),
  ]);
  if (progressRes.error) throw progressRes.error;
  if (responsibilitiesRes.error) throw responsibilitiesRes.error;

  const memberMap: Record<string, string> = {};
  for (const member of (membersRes.data ?? []) as MemberRow[]) {
    memberMap[member.member_id] = member.code_name || member.member_name || member.member_id;
  }

  const rewardSummary = buildRewardSummary({
    ym,
    milestones,
    progress: (progressRes.data ?? []) as ProgressRow[],
    responsibilities: (responsibilitiesRes.data ?? []) as ResponsibilityRow[],
    memberMap,
    billing,
    planCycle,
    project,
  });

  if (!rewardSummary || rewardSummary.members.length === 0) {
    return { ok: false, projectId, ym, rewardSummary: null, skippedReason: "reward_members_not_found" };
  }

  const persistedBudgetYen = derivePersistedCycleBudget({ billing, project });
  const updatePayload: Record<string, unknown> = {
    reward_summary_json: rewardSummary,
    updated_at: new Date().toISOString(),
  };
  if (numberValue(billing.budget_yen) <= 0 && persistedBudgetYen > 0) {
    updatePayload.budget_yen = persistedBudgetYen;
  }

  const { error: updateError } = await db
    .from("billing_cycles")
    .update(updatePayload)
    .eq("project_id", projectId)
    .eq("ym", ym);
  if (updateError) throw updateError;

  return { ok: true, projectId, ym, rewardSummary };
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
