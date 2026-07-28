export const LEGACY_PAYOUT_OVERRIDE_MAX_SOURCE_YM = "202606";

export type PayoutAmountOverrideEventRow = {
  id: number | string;
  event_key?: string | null;
  project_id: string;
  source_ym: string;
  member_id: string;
  action: string;
  amount_yen?: number | string | null;
  reason: string;
  authorized_by: string;
  created_at: string;
};

export type AppliedPayoutAmountOverride = {
  eventId: string;
  eventKey: string | null;
  kind: "legacy_prior_agreement";
  amountYen: number;
  calculatedTotalPayYen: number;
  reason: string;
  authorizedBy: string;
  createdAt: string;
};

type RewardMemberRecord = Record<string, unknown>;

export type OverrideAwareBillingCycle = {
  project_id: string;
  ym: string;
  reward_summary_json: unknown;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function yen(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function memberIdOf(member: RewardMemberRecord): string {
  return text(member.memberId) || text(member.member_id);
}

function overrideKey(projectId: string, sourceYm: string, memberId: string): string {
  return `${projectId}:${sourceYm}:${memberId}`;
}

function orderedOverrideEvents(rows: PayoutAmountOverrideEventRow[]): PayoutAmountOverrideEventRow[] {
  return [...rows].sort((left, right) => {
    const leftId = Number(left.id);
    const rightId = Number(right.id);
    if (Number.isFinite(leftId) && Number.isFinite(rightId) && leftId !== rightId) return leftId - rightId;
    if (left.created_at !== right.created_at) return left.created_at.localeCompare(right.created_at);
    return String(left.id).localeCompare(String(right.id));
  });
}

export function latestLegacyPayoutOverrideEvents(
  rows: PayoutAmountOverrideEventRow[]
): Map<string, PayoutAmountOverrideEventRow> {
  const latest = new Map<string, PayoutAmountOverrideEventRow>();
  for (const row of orderedOverrideEvents(rows)) {
    if (!/^\d{6}$/.test(row.source_ym) || row.source_ym > LEGACY_PAYOUT_OVERRIDE_MAX_SOURCE_YM) continue;
    latest.set(overrideKey(row.project_id, row.source_ym, row.member_id), row);
  }
  return latest;
}

function appliedOverride(
  row: PayoutAmountOverrideEventRow,
  calculatedTotalPayYen: number
): AppliedPayoutAmountOverride {
  return {
    eventId: String(row.id),
    eventKey: text(row.event_key) || null,
    kind: "legacy_prior_agreement",
    amountYen: yen(row.amount_yen),
    calculatedTotalPayYen,
    reason: text(row.reason),
    authorizedBy: text(row.authorized_by),
    createdAt: text(row.created_at),
  };
}

/**
 * 旧制度の事前合意額を、支払スナップショット/PDF向けの返却値にだけ適用する。
 * billing_cycles.reward_summary_json 自体は更新しないため、MS・stock・carry・将来月計算は変えない。
 */
export function applyLegacyPayoutAmountOverridesToCycles<T extends OverrideAwareBillingCycle>(
  cycles: T[],
  rows: PayoutAmountOverrideEventRow[]
): T[] {
  const latest = latestLegacyPayoutOverrideEvents(rows);
  if (latest.size === 0) return cycles;

  return cycles.map((cycle) => {
    const summary = record(cycle.reward_summary_json);
    const rawMembers = Array.isArray(summary?.members) ? summary.members : [];
    const relevant = [...latest.values()].filter(
      (row) => row.project_id === cycle.project_id && row.source_ym === cycle.ym
    );
    if (!summary || relevant.length === 0) return cycle;

    const overrideByMember = new Map(relevant.map((row) => [row.member_id, row]));
    const seenMemberIds = new Set<string>();
    let appliedCount = 0;

    const members = rawMembers.map((value) => {
      const member = record(value);
      if (!member) return value;
      const memberId = memberIdOf(member);
      if (!memberId) return value;
      seenMemberIds.add(memberId);
      const row = overrideByMember.get(memberId);
      if (!row || row.action !== "set") return value;

      const calculatedTotalPayYen = yen(member.totalPay ?? member.total_pay);
      const amountYen = yen(row.amount_yen);
      appliedCount += 1;
      return {
        ...member,
        totalPay: amountYen,
        regularPaidYen: amountYen,
        extraPaidYen: 0,
        payoutAmountOverride: appliedOverride(row, calculatedTotalPayYen),
      };
    });

    for (const row of relevant) {
      if (row.action !== "set" || seenMemberIds.has(row.member_id)) continue;
      const amountYen = yen(row.amount_yen);
      appliedCount += 1;
      members.push({
        memberId: row.member_id,
        earnedPt: 0,
        basePay: 0,
        bonusPt: 0,
        totalPay: amountYen,
        regularBasePay: 0,
        extraBasePay: 0,
        regularPaidYen: amountYen,
        extraPaidYen: 0,
        carryInYen: 0,
        stockYen: 0,
        regularStockYen: 0,
        extraStockYen: 0,
        grossDueYen: 0,
        regularGrossDueYen: 0,
        extraGrossDueYen: 0,
        payoutAmountOverride: appliedOverride(row, 0),
      });
    }

    if (appliedCount === 0) return cycle;
    const totalPaySum = members.reduce((sum, value) => {
      const member = record(value);
      return sum + yen(member?.totalPay ?? member?.total_pay);
    }, 0);
    const meta = record(summary.meta) ?? {};

    return {
      ...cycle,
      reward_summary_json: {
        ...summary,
        members,
        totalPaySum,
        meta: {
          ...meta,
          payoutAmountOverridesApplied: appliedCount,
          payoutAmountOverrideScope: "payout_notice_only",
        },
      },
    };
  });
}
