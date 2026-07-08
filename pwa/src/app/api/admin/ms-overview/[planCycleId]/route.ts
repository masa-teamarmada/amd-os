/**
 * POST / PUT /api/admin/ms-overview/[planCycleId]
 *
 * Admin / MS Overview の編集保存 API。
 * cockpit 側の MS 設計編集を閉じるため、MS 本体・期間・担当 share をここで一括保存する。
 * POST は保存前の支払検算だけを返し、PUT は同じ検算を通った場合だけ保存する。
 *
 * total_points は MS 配分合計ではなく、正本ルールに戻す:
 *   本契約 regular = シーズン期間の月数 × 10pt
 *   total_points   = regular + Σ cap_extra MS points
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { contractBackedClientAmount } from "@/lib/contract-money";
import { buildExtraRevenueByYm, parseSeasonBufferTotal } from "@/lib/finance/season-finance";
import {
  calculateRewardSummaryForCycle,
  isRewardCycleProtected,
  syncRewardSummariesForProject,
  type RewardLiabilityOffsetsByYm,
  type RewardScenarioOverride,
  type RewardSummary,
} from "@/lib/reward-summary";
import { isCapExtraTag } from "@/lib/admin/ms-overview-calc";
import { capExtraPointBasisForMilestone, totalPointBasisForCycle } from "@/lib/season-point-basis";

export const runtime = "nodejs";

type ResponsibilityPayload = {
  memberId: string;
  share: number;
  role?: string | null;
  taskDescription?: string | null;
};

type MilestonePayload = {
  milestoneId?: string | null;
  title: string;
  points: number;
  tag?: string | null;
  goalLevel?: string | null;
  successCriteria?: string | null;
  periodStartYm?: string | null;
  targetYm?: string | null;
  sortOrder?: number | null;
  responsibilities?: ResponsibilityPayload[];
};

type Body = {
  milestones: MilestonePayload[];
  deletedMilestoneIds?: string[];
};

type PlanRow = {
  plan_cycle_id: string;
  project_id: string;
  period_start_ym: string;
  period_end_ym: string;
  status: string | null;
  budget_yen?: number | string | null;
  buffer_breakdown_json?: unknown;
};

type ProjectMoneyRow = {
  project_id: string;
  fee_type?: string | null;
  fee_amount?: number | string | null;
  start_ym?: string | null;
  end_ym?: string | null;
  contract_terms_json?: unknown;
};

type ExistingMilestoneRow = {
  milestone_id: string;
  plan_cycle_id: string;
  is_active: boolean | null;
};

type ProtectedBillingCycleRow = {
  project_id: string;
  ym: string;
  status?: string | null;
  budget_yen?: number | string | null;
  budget_reported_amount?: number | string | null;
  budget_buffer_amount?: number | string | null;
  reward_summary_json: unknown;
  extra_budget_yen?: number | string | null;
  reward_paid_at?: string | null;
  reward_paid_by?: string | null;
  payout_notice_uploaded_at?: string | null;
  payment_confirmed_at?: string | null;
};

type ExtraRevenueSourceRow = {
  project_id: string;
  ym: string;
  extra_revenue_json?: unknown[] | null;
};

type RewardBaseByPool = {
  memberName?: string;
  regularBaseYen: number;
  extraBaseYen: number;
  extraPaidYen: number;
};

type RewardRevisionSummary = {
  protectedCycleCount: number;
  offsetCount: number;
  totalOffsetYen: number;
  positiveOffsetYen: number;
  negativeOffsetYen: number;
  missingApplyYmCount: number;
  skippedMissingBeforeSummaryCount: number;
  voidedPreviousOffsetCount: number;
  sourceYms: string[];
  applyYms: string[];
};

type SavedMilestoneRow = {
  milestone_id: string;
  plan_cycle_id: string;
  title: string;
  points: number;
  tag: string;
  goal_level: string;
  is_active: boolean;
  success_criteria: string | null;
  sort_order: number;
  period_start_ym: string | null;
  target_ym: string | null;
};

type ResponsibilitySaveRow = {
  milestone_id: string;
  member_id: string;
  share: number;
  role: string;
  task_description: string | null;
};

type RewardRevisionOffsetDraft = {
  project_id: string;
  plan_cycle_id: string;
  source_ym: string;
  apply_ym: string | null;
  member_id: string;
  pool: "regular" | "cap_extra";
  offset_yen: number;
  before_base_yen: number;
  after_base_yen: number;
  status: "pending";
  origin_type: "ms_overview_edit";
  reason: string;
  revision_id: string;
  created_by_email: string;
  metadata_json: Record<string, unknown>;
};

type RewardRevisionImpactMember = {
  memberId: string;
  memberName: string;
  totalOffsetYen: number;
  positiveOffsetYen: number;
  negativeOffsetYen: number;
  regularOffsetYen: number;
  extraOffsetYen: number;
};

type RewardRevisionBudgetImpact = {
  clientPaymentYen: number;
  bufferYen: number;
  sourceBudgetYen: number;
  sourceBudgetOverrunYen: number;
  pjBudgetYen: number;
  seasonBudgetYen: number;
  regularBudgetYen: number;
  extraBudgetYen: number;
  memberPayoutYen: number;
  companyReserveYen: number;
  memberObligationYen: number;
  seasonEndShortageYen: number;
  budgetShortageYen: number;
  fixedPaidYen: number;
  fixedPaidSnapshotYen: number;
  fixedPaidRewardCacheYen: number;
  unverifiedPaidYen: number;
  futureProjectedPayYen: number;
  finalStockYen: number;
  projectedObligationYen: number;
  remainingBudgetYen: number;
  isOverBudget: boolean;
  isSourceOverBudget: boolean;
  protectedActualYms: string[];
  unverifiedPaidYms: string[];
  futureProjectedYms: string[];
  missingFutureSummaryYms: string[];
};

type RewardRevisionPreview = RewardRevisionSummary & {
  status: "safe" | "warning" | "blocked";
  blockers: string[];
  warnings: string[];
  memberImpacts: RewardRevisionImpactMember[];
  budgetImpact: RewardRevisionBudgetImpact | null;
  checkedAt: string;
};

type RewardRevisionImpact = RewardRevisionPreview & {
  offsetRows: RewardRevisionOffsetDraft[];
};

type PreparedMsEdit = {
  plan: PlanRow;
  project: ProjectMoneyRow | null;
  cycles: ProtectedBillingCycleRow[];
  protectedCycles: ProtectedBillingCycleRow[];
  extraRevenueRows: ExtraRevenueSourceRow[];
  deletedIds: string[];
  savedRows: SavedMilestoneRow[];
  responsibilityRows: ResponsibilitySaveRow[];
  newTotal: number;
  scenario: RewardScenarioOverride;
};

function safeNumber(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function cleanText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function cleanOptionalText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function cleanYm(value: unknown): string | null {
  const text = cleanOptionalText(value);
  if (!text) return null;
  return /^\d{6}$/.test(text) ? text : "__INVALID_YM__";
}

function newMilestoneId(planCycleId: string, index: number): string {
  return `MS-${planCycleId}-${Date.now()}-${index + 1}`;
}

function normalizeShare(value: unknown): number {
  return Math.round(safeNumber(value) * 10000) / 10000;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isMissingOffsetTableError(error: unknown): boolean {
  const record = asRecord(error);
  const code = String(record?.code ?? "");
  const message = String(record?.message ?? "");
  return code === "42P01" || code === "PGRST205" || message.includes("reward_member_liability_offsets");
}

function asRewardSummary(value: unknown): RewardSummary | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return asRewardSummary(JSON.parse(value));
    } catch {
      return null;
    }
  }
  const record = asRecord(value);
  if (!record || !Array.isArray(record.members)) return null;
  return value as RewardSummary;
}

function rewardSummaryTotalPay(summary: RewardSummary | null): number {
  const explicit = Math.round(safeNumber(summary?.totalPaySum));
  if (explicit > 0) return explicit;
  return (summary?.members ?? []).reduce((sum, member) => sum + Math.max(0, Math.round(safeNumber(member.totalPay))), 0);
}

function rewardSummaryCompanyReserve(summary: RewardSummary | null): number {
  const explicit = Math.round(safeNumber(summary?.companyReserveYen));
  if (explicit > 0) return explicit;
  return (summary?.members ?? []).reduce((sum, member) => {
    const reserve = safeNumber(member.companyReserveYen ?? member.officerReserveYen);
    return sum + Math.max(0, Math.round(reserve));
  }, 0);
}

function rewardSummaryFinalStock(summary: RewardSummary | null): number {
  const explicit = Math.round(safeNumber(summary?.carryOverYen));
  if (explicit > 0) return explicit;
  return (summary?.members ?? []).reduce((sum, member) => sum + Math.max(0, Math.round(safeNumber(member.stockYen))), 0);
}

function rewardCycleHasVerifiedPaidEvidence(cycle: ProtectedBillingCycleRow): boolean {
  return String(cycle.reward_paid_by ?? "").trim().startsWith("freee_wallet_txn_verified:");
}

function rewardBaseByMember(summary: RewardSummary | null): Map<string, RewardBaseByPool> {
  const map = new Map<string, RewardBaseByPool>();
  const members = Array.isArray(summary?.members) ? summary.members : [];
  for (const member of members as unknown as Array<Record<string, unknown>>) {
    const memberId = cleanOptionalText(member.memberId ?? member.member_id);
    if (!memberId) continue;
    const memberName = cleanOptionalText(member.memberName ?? member.member_name) ?? undefined;
    const baseYen = Math.round(safeNumber(member.basePay ?? member.base_pay));
    const extraBaseYen = Math.round(safeNumber(member.extraBasePay ?? member.extra_base_pay));
    const extraPaidYen = Math.round(safeNumber(member.extraPaidYen ?? member.extra_paid_yen));
    const explicitRegularBaseYen = member.regularBasePay ?? member.regular_base_pay;
    const regularBaseYen = explicitRegularBaseYen == null
      ? Math.max(0, baseYen - extraBaseYen)
      : Math.round(safeNumber(explicitRegularBaseYen));
    map.set(memberId, { memberName, regularBaseYen, extraBaseYen, extraPaidYen });
  }
  return map;
}

function findNextUnprotectedYm(sourceYm: string, cycles: ProtectedBillingCycleRow[]): string | null {
  return cycles
    .filter((cycle) => cycle.ym > sourceYm && !isRewardCycleProtected(cycle))
    .sort((a, b) => a.ym.localeCompare(b.ym))[0]?.ym ?? null;
}

function emptyRewardRevisionImpact(protectedCycleCount: number, sourceYms: string[] = []): RewardRevisionImpact {
  return {
    protectedCycleCount,
    offsetCount: 0,
    totalOffsetYen: 0,
    positiveOffsetYen: 0,
    negativeOffsetYen: 0,
    missingApplyYmCount: 0,
    skippedMissingBeforeSummaryCount: 0,
    voidedPreviousOffsetCount: 0,
    sourceYms,
    applyYms: [],
    status: "safe",
    blockers: [],
    warnings: [],
    memberImpacts: [],
    budgetImpact: null,
    checkedAt: new Date().toISOString(),
    offsetRows: [],
  };
}

async function loadPayoutSnapshotTotalsByYm(
  db: ReturnType<typeof createAdminClient>,
  projectId: string,
  yms: string[],
): Promise<Map<string, number>> {
  const uniqueYms = [...new Set(yms.filter(Boolean))];
  if (uniqueYms.length === 0) return new Map();
  const res = await db
    .from("monthly_reward_payout")
    .select("ym, total_pay")
    .eq("project_id", projectId)
    .in("ym", uniqueYms);
  if (res.error) throw res.error;
  const map = new Map<string, number>();
  for (const row of (res.data ?? []) as Array<{ ym?: string | null; total_pay?: unknown }>) {
    const ym = cleanOptionalText(row.ym);
    if (!ym) continue;
    map.set(ym, (map.get(ym) ?? 0) + Math.max(0, Math.round(safeNumber(row.total_pay))));
  }
  return map;
}

async function buildRewardRevisionBudgetImpact({
  db,
  plan,
  project,
  cycles,
  protectedCycles,
  scenario,
  offsetRows,
  extraRevenueRows,
}: {
  db: ReturnType<typeof createAdminClient>;
  plan: PlanRow;
  project: ProjectMoneyRow | null;
  cycles: ProtectedBillingCycleRow[];
  protectedCycles: ProtectedBillingCycleRow[];
  scenario: RewardScenarioOverride;
  offsetRows: RewardRevisionOffsetDraft[];
  extraRevenueRows: ExtraRevenueSourceRow[];
}): Promise<RewardRevisionBudgetImpact> {
  const protectedYms = protectedCycles.map((cycle) => cycle.ym);
  const payoutSnapshotTotals = await loadPayoutSnapshotTotalsByYm(db, plan.project_id, protectedYms);
  let fixedPaidSnapshotYen = 0;
  const fixedPaidRewardCacheYen = 0;
  let unverifiedPaidYen = 0;
  let protectedCompanyReserveYen = 0;
  const protectedActualYms: string[] = [];
  const unverifiedPaidYms: string[] = [];

  for (const cycle of protectedCycles) {
    const snapshotTotal = payoutSnapshotTotals.get(cycle.ym);
    const cachedSummary = asRewardSummary(cycle.reward_summary_json);
    const cachedTotal = rewardSummaryTotalPay(cachedSummary);
    protectedCompanyReserveYen += rewardSummaryCompanyReserve(cachedSummary);
    if (cycle.reward_paid_at && rewardCycleHasVerifiedPaidEvidence(cycle) && snapshotTotal != null) {
      fixedPaidSnapshotYen += snapshotTotal;
      protectedActualYms.push(cycle.ym);
      continue;
    }
    if (cycle.reward_paid_at) {
      unverifiedPaidYen += snapshotTotal ?? cachedTotal;
      unverifiedPaidYms.push(cycle.ym);
    }
  }

  const liabilityOffsetsOverride = toLiabilityOffsetsByYm(offsetRows);
  const futureCycles = cycles.filter((cycle) => !isRewardCycleProtected(cycle));
  let futureProjectedPayYen = 0;
  let futureCompanyReserveYen = 0;
  let finalStockYen = 0;
  const futureProjectedYms: string[] = [];
  const missingFutureSummaryYms: string[] = [];

  for (const cycle of futureCycles) {
    const simulated = await calculateRewardSummaryForCycle(db, plan.project_id, cycle.ym, {
      includeLiabilityOffsets: false,
      scenario,
      liabilityOffsetsOverride,
    });
    const summary = simulated.rewardSummary;
    if (!summary) {
      missingFutureSummaryYms.push(cycle.ym);
      continue;
    }
    futureProjectedPayYen += rewardSummaryTotalPay(summary);
    futureCompanyReserveYen += rewardSummaryCompanyReserve(summary);
    finalStockYen = rewardSummaryFinalStock(summary);
    futureProjectedYms.push(cycle.ym);
  }

  if (futureCycles.length === 0) {
    const lastProtected = [...protectedCycles].sort((a, b) => a.ym.localeCompare(b.ym)).at(-1);
    finalStockYen = rewardSummaryFinalStock(asRewardSummary(lastProtected?.reward_summary_json));
  }

  const regularBudgetYen = Math.max(0, Math.round(safeNumber(plan.budget_yen)));
  const extraBudgetYen = cycles.reduce((sum, cycle) => sum + Math.max(0, Math.round(safeNumber(cycle.extra_budget_yen))), 0);
  const seasonBudgetYen = regularBudgetYen + extraBudgetYen;
  const extraRevenueByYm = buildExtraRevenueByYm(extraRevenueRows, {
    projectId: plan.project_id,
    minYm: plan.period_start_ym,
    maxYm: plan.period_end_ym,
  });
  const clientPaymentYen = cycles.reduce((sum, cycle) => {
    return sum + contractBackedClientAmount({
      ym: cycle.ym,
      project,
      reportedAmount: cycle.budget_reported_amount,
      cycleStatus: cycle.status,
    }) + (extraRevenueByYm.get(cycle.ym) ?? 0);
  }, 0);
  const bufferYen = parseSeasonBufferTotal(plan.buffer_breakdown_json)
    ?? cycles.reduce((sum, cycle) => sum + Math.max(0, Math.round(safeNumber(cycle.budget_buffer_amount))), 0);
  const sourceBudgetYen = Math.max(0, Math.round((clientPaymentYen - bufferYen) * 0.65));
  const sourceBudgetOverrunYen = Math.max(0, seasonBudgetYen - sourceBudgetYen);
  const fixedPaidYen = fixedPaidSnapshotYen + fixedPaidRewardCacheYen;
  const memberPayoutYen = fixedPaidYen + futureProjectedPayYen;
  const companyReserveYen = protectedCompanyReserveYen + futureCompanyReserveYen;
  const projectedObligationYen = memberPayoutYen + companyReserveYen + finalStockYen;
  const remainingBudgetYen = seasonBudgetYen - projectedObligationYen;
  const budgetShortageYen = Math.max(0, -remainingBudgetYen);
  const seasonEndShortageYen = Math.max(0, finalStockYen);

  return {
    clientPaymentYen,
    bufferYen,
    sourceBudgetYen,
    sourceBudgetOverrunYen,
    pjBudgetYen: seasonBudgetYen,
    seasonBudgetYen,
    regularBudgetYen,
    extraBudgetYen,
    memberPayoutYen,
    companyReserveYen,
    memberObligationYen: projectedObligationYen,
    seasonEndShortageYen,
    budgetShortageYen,
    fixedPaidYen,
    fixedPaidSnapshotYen,
    fixedPaidRewardCacheYen,
    unverifiedPaidYen,
    futureProjectedPayYen,
    finalStockYen,
    projectedObligationYen,
    remainingBudgetYen,
    isOverBudget: budgetShortageYen > 0,
    isSourceOverBudget: sourceBudgetOverrunYen > 0,
    protectedActualYms: [...new Set(protectedActualYms)].sort(),
    unverifiedPaidYms: [...new Set(unverifiedPaidYms)].sort(),
    futureProjectedYms,
    missingFutureSummaryYms,
  };
}

function addMemberImpact(
  impacts: Map<string, RewardRevisionImpactMember>,
  memberId: string,
  memberName: string,
  pool: "regular" | "cap_extra",
  offsetYen: number,
) {
  const current = impacts.get(memberId) ?? {
    memberId,
    memberName,
    totalOffsetYen: 0,
    positiveOffsetYen: 0,
    negativeOffsetYen: 0,
    regularOffsetYen: 0,
    extraOffsetYen: 0,
  };
  current.memberName = memberName || current.memberName || memberId;
  current.totalOffsetYen += offsetYen;
  if (offsetYen > 0) current.positiveOffsetYen += offsetYen;
  if (offsetYen < 0) current.negativeOffsetYen += offsetYen;
  if (pool === "cap_extra") current.extraOffsetYen += offsetYen;
  else current.regularOffsetYen += offsetYen;
  impacts.set(memberId, current);
}

function toLiabilityOffsetsByYm(offsetRows: RewardRevisionOffsetDraft[]): RewardLiabilityOffsetsByYm {
  const byYm: RewardLiabilityOffsetsByYm = new Map();
  for (const row of offsetRows) {
    if (!row.apply_ym || row.offset_yen === 0) continue;
    const rows = byYm.get(row.apply_ym) ?? [];
    rows.push({
      project_id: row.project_id,
      source_ym: row.source_ym,
      apply_ym: row.apply_ym,
      member_id: row.member_id,
      offset_yen: row.offset_yen,
      pool: row.pool,
      status: row.status,
    });
    byYm.set(row.apply_ym, rows);
  }
  return byYm;
}

function publicRewardRevision(impact: RewardRevisionImpact): RewardRevisionPreview {
  const preview = { ...impact } as Partial<RewardRevisionImpact>;
  delete preview.offsetRows;
  return preview as RewardRevisionPreview;
}

async function buildRewardRevisionImpact({
  db,
  plan,
  project,
  cycles,
  protectedCycles,
  extraRevenueRows,
  actorEmail,
  scenario,
}: {
  db: ReturnType<typeof createAdminClient>;
  plan: PlanRow;
  project: ProjectMoneyRow | null;
  cycles: ProtectedBillingCycleRow[];
  protectedCycles: ProtectedBillingCycleRow[];
  extraRevenueRows: ExtraRevenueSourceRow[];
  actorEmail: string;
  scenario: RewardScenarioOverride;
}): Promise<RewardRevisionImpact> {
  const sourceYms = protectedCycles.map((cycle) => cycle.ym);
  const impact = emptyRewardRevisionImpact(protectedCycles.length, sourceYms);
  if (protectedCycles.length === 0) {
    impact.budgetImpact = await buildRewardRevisionBudgetImpact({
      db,
      plan,
      project,
      cycles,
      protectedCycles,
      scenario,
      offsetRows: [],
      extraRevenueRows,
    });
    if (impact.budgetImpact.seasonEndShortageYen > 0) {
      impact.blockers.push(
        `シーズン終了月に未払残が ${impact.budgetImpact.seasonEndShortageYen.toLocaleString("ja-JP")}円残るため保存できません`,
      );
    }
    if (impact.budgetImpact.isOverBudget) {
      impact.blockers.push(
        `メンバー支払義務がPJ予算を ${impact.budgetImpact.budgetShortageYen.toLocaleString("ja-JP")}円超過するため保存できません`,
      );
    }
    if (impact.budgetImpact.isSourceOverBudget) {
      impact.blockers.push(
        `PJ予算がクライアント支払からバッファを引いた原資上限を ${impact.budgetImpact.sourceBudgetOverrunYen.toLocaleString("ja-JP")}円超過するため保存できません`,
      );
    }
    impact.status = impact.blockers.length > 0 ? "blocked" : impact.warnings.length > 0 ? "warning" : "safe";
    return impact;
  }

  const now = new Date().toISOString();
  const revisionId = crypto.randomUUID();
  const offsetRows: RewardRevisionOffsetDraft[] = [];
  const memberImpacts = new Map<string, RewardRevisionImpactMember>();

  for (const cycle of protectedCycles) {
    const beforeSummary = asRewardSummary(cycle.reward_summary_json);
    if (!beforeSummary) {
      impact.skippedMissingBeforeSummaryCount += 1;
      continue;
    }

    const afterResult = await calculateRewardSummaryForCycle(db, plan.project_id, cycle.ym, {
      includeLiabilityOffsets: false,
      scenario,
    });
    const afterSummary = afterResult.rewardSummary;
    if (!afterSummary) {
      impact.blockers.push(`${cycle.ym} の変更後報酬を計算できないため、差額を確定できない`);
      continue;
    }

    const beforeByMember = rewardBaseByMember(beforeSummary);
    const afterByMember = rewardBaseByMember(afterSummary);
    const memberIds = new Set([...beforeByMember.keys(), ...afterByMember.keys()]);
    const applyYm = findNextUnprotectedYm(cycle.ym, cycles);

    for (const memberId of memberIds) {
      const before = beforeByMember.get(memberId) ?? { regularBaseYen: 0, extraBaseYen: 0, extraPaidYen: 0 };
      const after = afterByMember.get(memberId) ?? { regularBaseYen: 0, extraBaseYen: 0, extraPaidYen: 0 };
      const memberName = after.memberName || before.memberName || memberId;
      const poolDeltas = [
        {
          pool: "regular" as const,
          beforeBaseYen: before.regularBaseYen,
          afterBaseYen: after.regularBaseYen,
          offsetYen: after.regularBaseYen - before.regularBaseYen,
          shouldOffset: true,
        },
        {
          pool: "cap_extra" as const,
          beforeBaseYen: before.extraBaseYen,
          afterBaseYen: after.extraBaseYen,
          offsetYen: after.extraBaseYen - before.extraBaseYen,
          shouldOffset: before.extraPaidYen > 0 || after.extraPaidYen > 0,
        },
      ];

      for (const delta of poolDeltas) {
        if (!delta.shouldOffset) continue;
        if (delta.offsetYen === 0) continue;
        addMemberImpact(memberImpacts, memberId, memberName, delta.pool, delta.offsetYen);
        offsetRows.push({
          project_id: plan.project_id,
          plan_cycle_id: plan.plan_cycle_id,
          source_ym: cycle.ym,
          apply_ym: applyYm,
          member_id: memberId,
          pool: delta.pool,
          offset_yen: delta.offsetYen,
          before_base_yen: delta.beforeBaseYen,
          after_base_yen: delta.afterBaseYen,
          status: "pending",
          origin_type: "ms_overview_edit",
          reason: "MS design revision on protected billing cycle",
          revision_id: revisionId,
          created_by_email: actorEmail,
          metadata_json: {
            memberName,
            protectedFlags: {
              rewardPaidAt: cycle.reward_paid_at ?? null,
              payoutNoticeUploadedAt: cycle.payout_notice_uploaded_at ?? null,
              paymentConfirmedAt: cycle.payment_confirmed_at ?? null,
            },
            editedAt: now,
            beforeSummaryVersion: beforeSummary.meta?.version ?? null,
            afterSummaryVersion: afterSummary.meta?.version ?? null,
          },
        });
      }
    }
  }

  if (impact.skippedMissingBeforeSummaryCount > 0) {
    impact.blockers.push(
      `保護済み月 ${impact.skippedMissingBeforeSummaryCount}件で旧rewardが見つからず、払いすぎ/払い足りなさを確定できない`,
    );
  }

  const missingApplyYmCount = offsetRows.filter((row) => !cleanOptionalText(row.apply_ym)).length;
  if (missingApplyYmCount > 0) {
    impact.blockers.push(
      `差額 ${missingApplyYmCount}件に次回精算先の未保護月がないため、保存すると精算漏れになる`,
    );
  }

  const negativeRowsWithApplyYm = offsetRows.filter((row) => row.offset_yen < 0 && cleanOptionalText(row.apply_ym));
  if (negativeRowsWithApplyYm.length > 0) {
    const simulationEndYm = [...cycles.map((cycle) => cycle.ym)].sort().at(-1);
    if (!simulationEndYm) {
      impact.blockers.push("将来月の報酬計算が作れず、過払い回収の完了を確認できない");
    } else {
      const simulated = await calculateRewardSummaryForCycle(db, plan.project_id, simulationEndYm, {
        includeLiabilityOffsets: false,
        scenario,
        liabilityOffsetsOverride: toLiabilityOffsetsByYm(offsetRows),
      });
      const finalSummary = simulated.rewardSummary;
      if (!finalSummary) {
        impact.blockers.push("将来月の報酬計算が作れず、過払い回収の完了を確認できない");
      } else {
        for (const member of finalSummary.members ?? []) {
          const regularLeft = Math.round(safeNumber(member.regularLiabilityRecoupCarryYen));
          const extraLeft = Math.round(safeNumber(member.extraLiabilityRecoupCarryYen));
          const memberName = member.memberName || member.memberId;
          if (regularLeft < 0) {
            impact.blockers.push(
              `${memberName} の本契約回収がシーズン末でも ${Math.abs(regularLeft).toLocaleString("ja-JP")}円残る可能性がある`,
            );
          }
          if (extraLeft < 0) {
            impact.blockers.push(
              `${memberName} の別財布回収がシーズン末でも ${Math.abs(extraLeft).toLocaleString("ja-JP")}円残る可能性がある`,
            );
          }
        }
      }
    }
  }

  const totalOffsetYen = offsetRows.reduce((sum, row) => sum + row.offset_yen, 0);
  const positiveOffsetYen = offsetRows
    .filter((row) => row.offset_yen > 0)
    .reduce((sum, row) => sum + row.offset_yen, 0);
  const negativeOffsetYen = offsetRows
    .filter((row) => row.offset_yen < 0)
    .reduce((sum, row) => sum + row.offset_yen, 0);
  const applyYms = [...new Set(offsetRows.map((row) => cleanOptionalText(row.apply_ym)).filter(Boolean) as string[])].sort();

  impact.offsetRows = offsetRows;
  impact.offsetCount = offsetRows.length;
  impact.totalOffsetYen = totalOffsetYen;
  impact.positiveOffsetYen = positiveOffsetYen;
  impact.negativeOffsetYen = negativeOffsetYen;
  impact.missingApplyYmCount = missingApplyYmCount;
  impact.applyYms = applyYms;
  impact.memberImpacts = [...memberImpacts.values()]
    .map((member) => ({
      ...member,
      totalOffsetYen: Math.round(member.totalOffsetYen),
      positiveOffsetYen: Math.round(member.positiveOffsetYen),
      negativeOffsetYen: Math.round(member.negativeOffsetYen),
      regularOffsetYen: Math.round(member.regularOffsetYen),
      extraOffsetYen: Math.round(member.extraOffsetYen),
    }))
    .sort((a, b) => Math.abs(b.totalOffsetYen) - Math.abs(a.totalOffsetYen));
  if (offsetRows.length > 0) {
    impact.warnings.push("保存すると保護済み月の差額を、本人別に次回以降の未保護月で精算する");
  }
  impact.budgetImpact = await buildRewardRevisionBudgetImpact({
    db,
    plan,
    project,
    cycles,
    protectedCycles,
    scenario,
    offsetRows,
    extraRevenueRows,
  });
  if (impact.budgetImpact.unverifiedPaidYms.length > 0) {
    impact.blockers.push(
      `支払済み印はあるが実支払証跡と明細額が未照合の月があります: ${impact.budgetImpact.unverifiedPaidYms.join(", ")}`,
    );
  }
  if (impact.budgetImpact.missingFutureSummaryYms.length > 0) {
    impact.warnings.push(
      `未来月 ${impact.budgetImpact.missingFutureSummaryYms.join(", ")} の支払見込みを計算できない`,
    );
  }
  if (impact.budgetImpact.seasonEndShortageYen > 0) {
    impact.blockers.push(
      `シーズン終了月に未払残が ${impact.budgetImpact.seasonEndShortageYen.toLocaleString("ja-JP")}円残るため保存できません`,
    );
  }
  if (impact.budgetImpact.isOverBudget) {
    impact.blockers.push(
      `支払済み実績を固定するとメンバー支払義務がPJ予算を ${impact.budgetImpact.budgetShortageYen.toLocaleString("ja-JP")}円超過するため保存できません`,
    );
  }
  if (impact.budgetImpact.isSourceOverBudget) {
    impact.blockers.push(
      `PJ予算がクライアント支払からバッファを引いた原資上限を ${impact.budgetImpact.sourceBudgetOverrunYen.toLocaleString("ja-JP")}円超過するため保存できません`,
    );
  }
  impact.status = impact.blockers.length > 0 ? "blocked" : impact.warnings.length > 0 ? "warning" : "safe";
  return impact;
}

async function persistRewardRevisionOffsets({
  db,
  plan,
  impact,
}: {
  db: ReturnType<typeof createAdminClient>;
  plan: PlanRow;
  impact: RewardRevisionImpact;
}): Promise<RewardRevisionImpact> {
  if (impact.protectedCycleCount === 0 || impact.sourceYms.length === 0) return impact;
  const now = new Date().toISOString();
  const voidRes = await db
    .from("reward_member_liability_offsets")
    .update({ status: "voided", voided_at: now })
    .eq("project_id", plan.project_id)
    .eq("plan_cycle_id", plan.plan_cycle_id)
    .eq("origin_type", "ms_overview_edit")
    .eq("status", "pending")
    .in("source_ym", impact.sourceYms)
    .select("id");
  if (voidRes.error) throw voidRes.error;

  if (impact.offsetRows.length > 0) {
    const insertRes = await db.from("reward_member_liability_offsets").insert(impact.offsetRows);
    if (insertRes.error) throw insertRes.error;
  }

  return {
    ...impact,
    voidedPreviousOffsetCount: voidRes.data?.length ?? 0,
  };
}

function normalizedMilestonePoints(
  ms: Pick<MilestonePayload, "points" | "tag">,
  periodStartYm: string | null,
  targetYm: string | null,
): number {
  if (isCapExtraTag(ms.tag)) {
    const extraPoints = capExtraPointBasisForMilestone({ points: ms.points, periodStartYm, targetYm });
    if (extraPoints > 0) return extraPoints;
  }
  return Math.round(Math.max(0, safeNumber(ms.points)) * 100) / 100;
}

function validatePayload(body: Body): string | null {
  if (!Array.isArray(body?.milestones)) return "milestones[] is required";
  if (body.milestones.length === 0 && (!Array.isArray(body.deletedMilestoneIds) || body.deletedMilestoneIds.length === 0)) {
    return "milestones[] or deletedMilestoneIds[] is required";
  }
  for (const [index, ms] of body.milestones.entries()) {
    if (!cleanText(ms.title)) return `title is required at milestones[${index}]`;
    if (safeNumber(ms.points) < 0) return `points must be >= 0 at milestones[${index}]`;
    const start = cleanYm(ms.periodStartYm);
    const target = cleanYm(ms.targetYm);
    if (start === "__INVALID_YM__") return `periodStartYm must be YYYYMM at milestones[${index}]`;
    if (target === "__INVALID_YM__") return `targetYm must be YYYYMM at milestones[${index}]`;
    if (start && target && start > target) return `periodStartYm must be <= targetYm at milestones[${index}]`;
    for (const [respIndex, resp] of (ms.responsibilities ?? []).entries()) {
      if (!cleanText(resp.memberId)) return `memberId is required at milestones[${index}].responsibilities[${respIndex}]`;
      const share = normalizeShare(resp.share);
      if (share < 0 || share > 1) return `share must be 0..1 at milestones[${index}].responsibilities[${respIndex}]`;
    }
  }
  return null;
}

async function prepareMsEditPayload(
  db: ReturnType<typeof createAdminClient>,
  planCycleId: string,
  body: Body,
): Promise<{ ok: true; value: PreparedMsEdit } | { ok: false; response: NextResponse }> {
  const planRes = await db
    .from("value_plan_cycles")
    .select("plan_cycle_id, project_id, period_start_ym, period_end_ym, status, budget_yen, buffer_breakdown_json")
    .eq("plan_cycle_id", planCycleId)
    .maybeSingle();
  if (planRes.error) throw planRes.error;
  const plan = planRes.data as PlanRow | null;
  if (!plan) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "plan cycle not found" }, { status: 404 }) };
  }

  const [projectRes, cyclesRes, extraRevenueRes, existingRes] = await Promise.all([
    db
      .from("projects")
      .select("project_id, fee_type, fee_amount, start_ym, end_ym, contract_terms_json")
      .eq("project_id", plan.project_id)
      .maybeSingle(),
    db
      .from("billing_cycles")
      .select("project_id, ym, status, budget_yen, budget_reported_amount, budget_buffer_amount, reward_summary_json, extra_budget_yen, reward_paid_at, reward_paid_by, payout_notice_uploaded_at, payment_confirmed_at")
      .eq("project_id", plan.project_id)
      .gte("ym", plan.period_start_ym)
      .lte("ym", plan.period_end_ym)
      .order("ym", { ascending: true }),
    db
      .from("billing_cycles")
      .select("project_id, ym, extra_revenue_json")
      .eq("project_id", plan.project_id)
      .not("extra_revenue_json", "is", null),
    db
      .from("value_milestones")
      .select("milestone_id, plan_cycle_id, is_active")
      .eq("plan_cycle_id", planCycleId),
  ]);
  if (projectRes.error) throw projectRes.error;
  if (cyclesRes.error) throw cyclesRes.error;
  if (extraRevenueRes.error) throw extraRevenueRes.error;
  if (existingRes.error) throw existingRes.error;

  const project = (projectRes.data ?? null) as ProjectMoneyRow | null;
  const cycles = (cyclesRes.data ?? []) as ProtectedBillingCycleRow[];
  const extraRevenueRows = (extraRevenueRes.data ?? []) as ExtraRevenueSourceRow[];
  const protectedCycles = cycles.filter(isRewardCycleProtected);
  const existing = (existingRes.data ?? []) as ExistingMilestoneRow[];
  const existingIds = new Set(existing.map((row) => row.milestone_id));

  const deletedIds = [...new Set((body.deletedMilestoneIds ?? []).filter(Boolean))];
  for (const deletedId of deletedIds) {
    if (!existingIds.has(deletedId)) {
      return { ok: false, response: NextResponse.json({ ok: false, error: `milestone not found: ${deletedId}` }, { status: 404 }) };
    }
  }

  const savedRows: SavedMilestoneRow[] = [];
  for (const [index, ms] of body.milestones.entries()) {
    const suppliedMilestoneId = cleanOptionalText(ms.milestoneId);
    const milestoneId = suppliedMilestoneId || newMilestoneId(planCycleId, index);
    if (suppliedMilestoneId && !existingIds.has(milestoneId)) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: `milestone ${milestoneId} does not belong to plan cycle ${planCycleId}` },
          { status: 404 },
        ),
      };
    }
    const periodStartYm = cleanYm(ms.periodStartYm);
    const targetYm = cleanYm(ms.targetYm);
    savedRows.push({
      milestone_id: milestoneId,
      plan_cycle_id: planCycleId,
      title: cleanText(ms.title),
      points: normalizedMilestonePoints(ms, periodStartYm, targetYm),
      tag: cleanText(ms.tag, "normal"),
      goal_level: cleanText(ms.goalLevel, "season"),
      is_active: true,
      success_criteria: cleanOptionalText(ms.successCriteria),
      sort_order: Math.round(safeNumber(ms.sortOrder ?? index + 1)),
      period_start_ym: periodStartYm,
      target_ym: targetYm,
    });
  }

  const responsibilityRows: ResponsibilitySaveRow[] = body.milestones.flatMap((ms, index) => {
    const milestoneId = savedRows[index].milestone_id;
    return (ms.responsibilities ?? [])
      .map((resp) => ({
        milestone_id: milestoneId,
        member_id: cleanText(resp.memberId),
        share: normalizeShare(resp.share),
        role: cleanText(resp.role, "担当"),
        task_description: cleanOptionalText(resp.taskDescription),
      }))
      .filter((resp) => resp.share > 0);
  });

  const extraPoints = Math.round(
    savedRows
      .filter((row) => String(row.goal_level || "").toLowerCase() !== "monthly")
      .filter((row) => isCapExtraTag(row.tag))
      .reduce((sum, row) => sum + capExtraPointBasisForMilestone(row), 0) * 100,
  ) / 100;
  const newTotal = totalPointBasisForCycle(plan, extraPoints);
  const scenario: RewardScenarioOverride = {
    planCycleId,
    totalPoints: newTotal,
    milestones: savedRows.map((row) => ({
      milestone_id: row.milestone_id,
      title: row.title,
      points: row.points,
      tag: row.tag,
      goal_level: row.goal_level,
      sort_order: row.sort_order,
      period_start_ym: row.period_start_ym,
      target_ym: row.target_ym,
    })),
    responsibilities: responsibilityRows.map((row) => ({
      milestone_id: row.milestone_id,
      member_id: row.member_id,
      share: row.share,
    })),
  };

  return {
    ok: true,
    value: {
      plan,
      project,
      cycles,
      protectedCycles,
      extraRevenueRows,
      deletedIds,
      savedRows,
      responsibilityRows,
      newTotal,
      scenario,
    },
  };
}

async function ensureOffsetTableWhenNeeded(
  db: ReturnType<typeof createAdminClient>,
  protectedCycles: ProtectedBillingCycleRow[],
): Promise<NextResponse | null> {
  if (protectedCycles.length === 0) return null;
  const offsetTableProbe = await db.from("reward_member_liability_offsets").select("id").limit(1);
  if (!offsetTableProbe.error) return null;
  if (isMissingOffsetTableError(offsetTableProbe.error)) {
    return NextResponse.json(
      {
        ok: false,
        error: "reward_member_liability_offsets migration is required before editing MS with protected billing cycles",
      },
      { status: 409 },
    );
  }
  throw offsetTableProbe.error;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ planCycleId: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { planCycleId } = await ctx.params;
  if (!planCycleId) {
    return NextResponse.json({ ok: false, error: "planCycleId is required" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const payloadError = validatePayload(body);
  if (payloadError) return NextResponse.json({ ok: false, error: payloadError }, { status: 400 });

  try {
    const db = createAdminClient();
    const prepared = await prepareMsEditPayload(db, planCycleId, body);
    if (!prepared.ok) return prepared.response;
    const { plan, project, cycles, protectedCycles, extraRevenueRows, scenario } = prepared.value;
    const offsetTableResponse = await ensureOffsetTableWhenNeeded(db, protectedCycles);
    if (offsetTableResponse) return offsetTableResponse;

    const rewardPreview = await buildRewardRevisionImpact({
      db,
      plan,
      project,
      cycles,
      protectedCycles,
      extraRevenueRows,
      actorEmail: auth.user.email,
      scenario,
    });

    return NextResponse.json({
      ok: true,
      planCycleId,
      projectId: plan.project_id,
      rewardPreview: publicRewardRevision(rewardPreview),
    });
  } catch (err) {
    console.error("[admin ms-overview POST]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ planCycleId: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { planCycleId } = await ctx.params;
  if (!planCycleId) {
    return NextResponse.json({ ok: false, error: "planCycleId is required" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const payloadError = validatePayload(body);
  if (payloadError) return NextResponse.json({ ok: false, error: payloadError }, { status: 400 });

  try {
    const db = createAdminClient();
    const prepared = await prepareMsEditPayload(db, planCycleId, body);
    if (!prepared.ok) return prepared.response;
    const {
      plan,
      project,
      cycles,
      protectedCycles,
      extraRevenueRows,
      deletedIds,
      savedRows,
      responsibilityRows,
      newTotal,
      scenario,
    } = prepared.value;

    const offsetTableResponse = await ensureOffsetTableWhenNeeded(db, protectedCycles);
    if (offsetTableResponse) return offsetTableResponse;

    let rewardRevisionImpact = await buildRewardRevisionImpact({
      db,
      plan,
      project,
      cycles,
      protectedCycles,
      extraRevenueRows,
      actorEmail: auth.user.email,
      scenario,
    });
    if (rewardRevisionImpact.status === "blocked") {
      return NextResponse.json(
        {
          ok: false,
          error: rewardRevisionImpact.blockers[0] || "支払い安全検算で保存不可",
          rewardPreview: publicRewardRevision(rewardRevisionImpact),
        },
        { status: 409 },
      );
    }

    if (deletedIds.length > 0) {
      const respDel = await db.from("milestone_responsibility").delete().in("milestone_id", deletedIds);
      if (respDel.error) throw respDel.error;
      const archive = await db
        .from("value_milestones")
        .update({ is_active: false })
        .eq("plan_cycle_id", planCycleId)
        .in("milestone_id", deletedIds);
      if (archive.error) throw archive.error;
    }

    if (savedRows.length > 0) {
      const upsert = await db.from("value_milestones").upsert(savedRows, { onConflict: "milestone_id" });
      if (upsert.error) throw upsert.error;

      const savedIds = savedRows.map((row) => row.milestone_id);
      const respDel = await db.from("milestone_responsibility").delete().in("milestone_id", savedIds);
      if (respDel.error) throw respDel.error;

      if (responsibilityRows.length > 0) {
        const respIns = await db.from("milestone_responsibility").insert(responsibilityRows);
        if (respIns.error) throw respIns.error;
      }
    }

    const planUpd = await db
      .from("value_plan_cycles")
      .update({ total_points: newTotal })
      .eq("plan_cycle_id", planCycleId);
    if (planUpd.error) throw planUpd.error;

    rewardRevisionImpact = await persistRewardRevisionOffsets({
      db,
      plan,
      impact: rewardRevisionImpact,
    });

    let syncedYms: string[] = [];
    try {
      const synced = await syncRewardSummariesForProject(db, plan.project_id);
      syncedYms = [...synced.keys()].sort();
    } catch (syncErr) {
      console.error("[admin ms-overview PUT] reward sync failed", syncErr);
    }

    return NextResponse.json({
      ok: true,
      planCycleId,
      projectId: plan.project_id,
      updatedMilestoneCount: savedRows.length,
      archivedMilestoneCount: deletedIds.length,
      newTotalPoints: newTotal,
      rewardSummariesSyncedYms: syncedYms,
      rewardRevision: publicRewardRevision(rewardRevisionImpact),
    });
  } catch (err) {
    console.error("[admin ms-overview PUT]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
