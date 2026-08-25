/**
 * メンバー1人 × PJ × 稼働月の「支払額の内訳」を、保存済み報酬キャッシュから組み立てる読み取り専用モジュール。
 *
 * - `/admin/payouts` のメンバー行に出ている base / 繰越 / 支払 / 未払い残が、
 *   どのMSの消化とどの月の未払いから来たのかを画面で説明するために使う。
 * - 計算は一切やり直さない。読むのは `billing_cycles.reward_summary_json`(= 一覧と同じ正本キャッシュ)だけ。
 *   ここで再計算すると一覧の金額と内訳がずれるため。計算の正本は `reward-summary.ts`。
 * - 繰越 (carryIn) は plan cycle の先頭から月次で積み上がる。cycle が変わると鎖は切れるので、
 *   遡る範囲は当月が属する plan cycle の期間内に限る。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseLike = SupabaseClient;

const ACTIVE_PLAN_STATUSES = ["active", "confirmed", "fixed", "draft"];

export type MemberBreakdownMsRow = {
  msKey: string;
  title: string;
  pool: "regular" | "cap_extra";
  msConsumedPt: number;
  share: number;
  shareSource: string | null;
  earnedPt: number;
  ptUnit: number;
  payYen: number;
};

export type MemberBreakdownMonthRow = {
  ym: string;
  isTargetMonth: boolean;
  earnedPt: number;
  basePay: number;
  carryInYen: number;
  grossDueYen: number;
  paidYen: number;
  stockYen: number;
  /** この月の発生分のうち、当月繰越としてまだ残っている額 (古い発生から支払われたと仮定した内訳) */
  remainingFromThisMonthYen: number;
};

export type MemberPayoutBreakdown = {
  projectId: string;
  projectName: string;
  ym: string;
  memberId: string;
  memberName: string;
  planCycle: { planCycleId: string; periodStartYm: string; periodEndYm: string } | null;
  ptUnit: number;
  extraPtUnit: number | null;
  current: {
    earnedPt: number;
    basePay: number;
    regularBasePay: number;
    extraBasePay: number;
    carryInYen: number;
    grossDueYen: number;
    paidYen: number;
    stockYen: number;
    payoutExcluded: boolean;
    companyReserveYen: number;
  };
  cap: {
    regularCapBudgetYen: number;
    regularCapCarryInYen: number;
    effectiveRegularCapBudgetYen: number;
    extraCapBudgetYen: number | null;
    effectiveExtraCapBudgetYen: number | null;
    /** PJ全体の当月「発生+繰越」。cap をこれで割った比率で各人の支払額が決まる */
    totalGrossDueYen: number;
    projectTotalPaidYen: number;
    capped: boolean;
  };
  breakdown: MemberBreakdownMsRow[];
  months: MemberBreakdownMonthRow[];
  /** 当月の繰越額のうち、月次履歴から発生月を特定できなかった額 (キャッシュ欠損時のみ 0 以外) */
  carryUnexplainedYen: number;
  cacheGeneratedAt: string | null;
};

type PlanCycleRow = {
  plan_cycle_id: string;
  status?: string | null;
  period_start_ym: string;
  period_end_ym: string;
};

type CycleRow = {
  ym: string;
  reward_summary_json: unknown;
};

function numberValue(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function memberEntry(summary: unknown, memberId: string): Record<string, unknown> | null {
  const record = asRecord(summary);
  const members = Array.isArray(record?.members) ? (record?.members as unknown[]) : [];
  for (const raw of members) {
    const member = asRecord(raw);
    if (!member) continue;
    if (String(member.memberId ?? member.member_id ?? "") === memberId) return member;
  }
  return null;
}

function toBreakdownRows(member: Record<string, unknown> | null): MemberBreakdownMsRow[] {
  const list = Array.isArray(member?.breakdown) ? (member?.breakdown as unknown[]) : [];
  return list
    .map((raw) => {
      const item = asRecord(raw);
      if (!item) return null;
      return {
        msKey: String(item.msKey ?? ""),
        title: String(item.title ?? item.msKey ?? ""),
        pool: String(item.pool ?? "regular") === "cap_extra" ? ("cap_extra" as const) : ("regular" as const),
        msConsumedPt: numberValue(item.msConsumedPt),
        share: numberValue(item.share),
        shareSource: item.shareSource == null ? null : String(item.shareSource),
        earnedPt: numberValue(item.earnedPt),
        ptUnit: Math.round(numberValue(item.ptUnit)),
        payYen: Math.round(numberValue(item.payYen)),
      };
    })
    .filter((row): row is MemberBreakdownMsRow => row != null)
    .sort((a, b) => b.payYen - a.payYen);
}

/**
 * 「古い発生分から順に支払われた」と仮定して、当月の繰越額を発生月へ割り戻す。
 *
 * 報酬計算は cap を「発生+繰越」の合計へ按分して払うだけで、どの月の発生分を先に消したかは
 * 記録していない。どの月の未払いが残っているかを人が読める形にするには順序の仮定が要るので、
 * 古い順 (先入先出) を採る。画面側にも仮定であることを明記する。
 */
function attributeCarryToMonths(months: MemberBreakdownMonthRow[], targetYm: string): void {
  const queue: Array<{ ym: string; remaining: number }> = [];
  for (const month of months) {
    if (month.ym >= targetYm) break;
    queue.push({ ym: month.ym, remaining: month.basePay });
    let paid = month.paidYen;
    for (const item of queue) {
      if (paid <= 0) break;
      const applied = Math.min(item.remaining, paid);
      item.remaining -= applied;
      paid -= applied;
    }
  }
  const remainingByYm = new Map<string, number>();
  for (const item of queue) {
    if (item.remaining <= 0) continue;
    remainingByYm.set(item.ym, (remainingByYm.get(item.ym) ?? 0) + item.remaining);
  }
  for (const month of months) {
    month.remainingFromThisMonthYen = remainingByYm.get(month.ym) ?? 0;
  }
}

export async function loadMemberPayoutBreakdown(
  db: SupabaseLike,
  params: { projectId: string; ym: string; memberId: string }
): Promise<MemberPayoutBreakdown | null> {
  const { projectId, ym, memberId } = params;

  const [projectRes, memberRes, planCyclesRes] = await Promise.all([
    db.from("projects").select("project_id, project_name").eq("project_id", projectId).maybeSingle(),
    db.from("members").select("member_id, code_name, member_name").eq("member_id", memberId).maybeSingle(),
    db
      .from("value_plan_cycles")
      .select("plan_cycle_id, status, period_start_ym, period_end_ym")
      .eq("project_id", projectId)
      .in("status", ACTIVE_PLAN_STATUSES)
      .order("period_start_ym", { ascending: false }),
  ]);
  if (projectRes.error) throw projectRes.error;
  if (memberRes.error) throw memberRes.error;
  if (planCyclesRes.error) throw planCyclesRes.error;

  const planCycle =
    ((planCyclesRes.data ?? []) as PlanCycleRow[]).find(
      (row) => row.period_start_ym <= ym && row.period_end_ym >= ym
    ) ?? null;

  const fromYm = planCycle?.period_start_ym ?? ym;
  const cyclesRes = await db
    .from("billing_cycles")
    .select("ym, reward_summary_json")
    .eq("project_id", projectId)
    .gte("ym", fromYm)
    .lte("ym", ym)
    .order("ym", { ascending: true });
  if (cyclesRes.error) throw cyclesRes.error;

  const cycles = (cyclesRes.data ?? []) as CycleRow[];
  const targetCycle = cycles.find((cycle) => cycle.ym === ym) ?? null;
  if (!targetCycle) return null;

  const targetSummary = asRecord(targetCycle.reward_summary_json);
  const targetMember = memberEntry(targetCycle.reward_summary_json, memberId);
  if (!targetMember) return null;

  const months: MemberBreakdownMonthRow[] = [];
  for (const cycle of cycles) {
    const member = memberEntry(cycle.reward_summary_json, memberId);
    if (!member) continue;
    const basePay = Math.round(numberValue(member.basePay));
    const carryInYen = Math.round(numberValue(member.carryInYen));
    const paidYen = Math.round(
      numberValue(member.payoutExcluded ? member.companyReserveYen ?? 0 : member.totalPay)
    );
    const stockYen = Math.round(numberValue(member.stockYen ?? member.deferredYen));
    if (basePay === 0 && carryInYen === 0 && paidYen === 0 && stockYen === 0) continue;
    months.push({
      ym: cycle.ym,
      isTargetMonth: cycle.ym === ym,
      earnedPt: numberValue(member.earnedPt),
      basePay,
      carryInYen,
      grossDueYen: Math.round(numberValue(member.grossDueYen ?? basePay + carryInYen)),
      paidYen,
      stockYen,
      remainingFromThisMonthYen: 0,
    });
  }
  attributeCarryToMonths(months, ym);

  const currentCarryInYen = Math.round(numberValue(targetMember.carryInYen));
  const attributedCarryYen = months
    .filter((month) => !month.isTargetMonth)
    .reduce((sum, month) => sum + month.remainingFromThisMonthYen, 0);

  const extraPtUnitRaw = targetSummary?.extraPtUnit;
  const extraCapRaw = targetSummary?.extraCapBudgetYen;
  const effectiveExtraCapRaw = targetSummary?.effectiveExtraCapBudgetYen;
  const projectTotalPaidYen = Array.isArray(targetSummary?.members)
    ? (targetSummary?.members as unknown[]).reduce<number>((sum, raw) => {
        const item = asRecord(raw);
        if (!item) return sum;
        return sum + Math.round(numberValue(item.totalPay)) + Math.round(numberValue(item.companyReserveYen));
      }, 0)
    : 0;

  const memberName = String(
    (memberRes.data as { code_name?: string | null; member_name?: string | null } | null)?.code_name ||
      (memberRes.data as { member_name?: string | null } | null)?.member_name ||
      memberId
  );

  return {
    projectId,
    projectName: String(
      (projectRes.data as { project_name?: string | null } | null)?.project_name || projectId
    ),
    ym,
    memberId,
    memberName,
    planCycle: planCycle
      ? {
          planCycleId: planCycle.plan_cycle_id,
          periodStartYm: planCycle.period_start_ym,
          periodEndYm: planCycle.period_end_ym,
        }
      : null,
    ptUnit: Math.round(numberValue(targetSummary?.regularPtUnit ?? targetSummary?.ptUnit)),
    extraPtUnit: extraPtUnitRaw == null ? null : Math.round(numberValue(extraPtUnitRaw)),
    current: {
      earnedPt: numberValue(targetMember.earnedPt),
      basePay: Math.round(numberValue(targetMember.basePay)),
      regularBasePay: Math.round(
        numberValue(
          targetMember.regularBasePay ??
            Math.max(0, numberValue(targetMember.basePay) - numberValue(targetMember.extraBasePay))
        )
      ),
      extraBasePay: Math.round(numberValue(targetMember.extraBasePay)),
      carryInYen: currentCarryInYen,
      grossDueYen: Math.round(numberValue(targetMember.grossDueYen)),
      paidYen: Math.round(numberValue(targetMember.totalPay)),
      stockYen: Math.round(numberValue(targetMember.stockYen ?? targetMember.deferredYen)),
      payoutExcluded: Boolean(targetMember.payoutExcluded),
      companyReserveYen: Math.round(numberValue(targetMember.companyReserveYen)),
    },
    cap: {
      regularCapBudgetYen: Math.round(numberValue(targetSummary?.regularCapBudgetYen)),
      regularCapCarryInYen: Math.round(numberValue(targetSummary?.regularCapCarryInYen)),
      effectiveRegularCapBudgetYen: Math.round(
        numberValue(targetSummary?.effectiveRegularCapBudgetYen ?? targetSummary?.regularCapBudgetYen)
      ),
      extraCapBudgetYen: extraCapRaw == null ? null : Math.round(numberValue(extraCapRaw)),
      effectiveExtraCapBudgetYen:
        effectiveExtraCapRaw == null ? null : Math.round(numberValue(effectiveExtraCapRaw)),
      totalGrossDueYen: Math.round(numberValue(targetSummary?.totalGrossDueYen)),
      projectTotalPaidYen,
      capped: Boolean(targetSummary?.capped),
    },
    breakdown: toBreakdownRows(targetMember),
    months,
    carryUnexplainedYen: Math.round(currentCarryInYen - attributedCarryYen),
    cacheGeneratedAt:
      asRecord(targetSummary?.meta)?.generatedAt == null
        ? null
        : String(asRecord(targetSummary?.meta)?.generatedAt),
  };
}
