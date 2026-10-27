import { regularPointBasisForCycle, roundPt } from "./season-point-basis.ts";
import { isNonCashAllocationMember } from "./reward-finance-summary.ts";
import type { SeasonBilling, SeasonMember, SeasonPlan } from "./payout-season-plan.ts";

type Amount = number | null;
export type SeasonMsEvidence = { msKey: string; title: string; pool: string; earnedPt: number; earnedYen: number; memberNames: string[] };
export type SeasonMemberEvidence = {
  memberId: string; memberName: string; cashYen: Amount; internalYen: Amount; accruedYen: Amount;
  closingUnfundedYen: Amount; savedAdjustmentYen: Amount; breakdown: SeasonMsEvidence[];
  externalUnpaidYen: Amount; internalUnfundedYen: Amount;
};
export type SeasonMonthEvidence = {
  ym: string; budgetYen: Amount; accruedYen: Amount; cashYen: Amount; internalYen: Amount;
  closingUnfundedYen: Amount; cumulativeRemainingYen: Amount; members: SeasonMemberEvidence[];
  externalUnpaidYen: Amount; internalUnfundedYen: Amount;
};
export type SeasonAllocationEvidence = {
  regularPointBasis: number; regularAllocatedPt: Amount; extraAllocatedPt: Amount;
  accruedYen: Amount; openingCarryYen: Amount; roundingYen: Amount; offsetsYen: Amount;
  savedAdjustmentYen: Amount; unexplainedYen: Amount; msDifferenceYen: Amount;
  monthly: SeasonMonthEvidence[]; milestones: SeasonMsEvidence[]; notes: string[];
};
function object(v: unknown): Record<string, unknown> { return v != null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {}; }
function amount(v: unknown): Amount { if (v == null || v === "") return null; const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null; }
function sum(values: Amount[]): Amount { return values.some((n) => n == null) ? null : values.reduce<number>((a, n) => a + n!, 0); }

/** Expose the saved calculation's causes. No recalculation, budget redistribution or MS edits. */
export function buildSeasonAllocationEvidence(plan: SeasonPlan, cycles: SeasonBilling[], profiles: SeasonMember[], months: string[], committedYen: Amount, budgetYen: Amount): SeasonAllocationEvidence {
  const byYm = new Map(cycles.filter((c) => c.project_id === plan.project_id).map((c) => [c.ym, c]));
  const byMember = new Map(profiles.map((p) => [p.member_id, p]));
  const milestones = new Map<string, SeasonMsEvidence>();
  const notes = new Set<string>();
  let pointsKnown = true;
  const opening: Amount[] = [], rounding: Amount[] = [], offsets: Amount[] = [];
  let cumulativeBudget: Amount = 0, cumulativeFunded: Amount = 0;
  const monthly: SeasonMonthEvidence[] = months.map((ym, index) => {
    const cycle = byYm.get(ym);
    const summary = object(cycle?.reward_summary_json);
    const rows = Array.isArray(summary.members) ? summary.members : null;
    const budget = sum([amount(cycle?.budget_yen ?? summary.regularCapBudgetYen), amount(cycle?.extra_budget_yen ?? 0)]);
    const members: SeasonMemberEvidence[] = [];
    if (!rows) { pointsKnown = false; notes.add(`${ym}の計算根拠が未取得`); }
    for (const raw of rows ?? []) {
      const m = object(raw), id = String(m.memberId ?? m.member_id ?? "");
      const profile = byMember.get(id);
      const name = profile?.code_name?.trim() || profile?.member_name?.trim() || id;
      const internal = profile?.exclude_from_payout_notice === true || isNonCashAllocationMember(m);
      const cash = internal ? 0 : amount(m.totalPay ?? m.total_pay);
      const funded = internal ? amount(m.companyReserveYen ?? m.officerReserveYen) : 0;
      const calculatedCash = internal ? 0 : amount(m.payoutSnapshotCalculatedTotalYen ?? object(m.payoutAmountOverride).calculatedTotalPayYen ?? m.totalPay ?? m.total_pay);
      const adjustment = cash == null || calculatedCash == null ? null : cash - calculatedCash;
      const accrued = amount(m.basePay ?? m.base_pay);
      const stock = amount(m.stockYen ?? m.stock_yen ?? m.deferredYen ?? m.deferred_yen ?? m.companyReserveUnfundedYen ?? 0);
      if (index === 0) opening.push(amount(m.carryInYen ?? m.carry_in_yen ?? 0));
      rounding.push(amount(m.roundingTopUpYen ?? 0)); offsets.push(amount(m.liabilityOffsetYen ?? 0));
      const breakdown: SeasonMsEvidence[] = [];
      if (!Array.isArray(m.breakdown) || (!m.breakdown.length && (accrued ?? 0) > 0)) {
        pointsKnown = false;
        if ((accrued ?? 0) > 0) notes.add(`${ym} ${name}のMS内訳が未取得`);
      }
      for (const rawLine of Array.isArray(m.breakdown) ? m.breakdown : []) {
        const b = object(rawLine);
        const pt = Number(b.earnedPt), pay = amount(b.payYen);
        if (!Number.isFinite(pt) || pay == null) { pointsKnown = false; notes.add(`${ym} ${name}のMS金額が未確認`); continue; }
        const line: SeasonMsEvidence = { msKey: String(b.msKey ?? "unidentified"), title: String(b.title ?? "MS未特定"), pool: ["cap_extra", "extra"].includes(String(b.pool)) ? "extra" : "regular", earnedPt: pt, earnedYen: pay, memberNames: [name] };
        breakdown.push(line);
        const key = `${line.pool}:${line.msKey}`;
        const annual = milestones.get(key) ?? { ...line, earnedPt: 0, earnedYen: 0, memberNames: [] };
        annual.earnedPt = roundPt(annual.earnedPt + pt); annual.earnedYen += pay;
        if (!annual.memberNames.includes(name)) annual.memberNames.push(name);
        milestones.set(key, annual);
      }
      members.push({ memberId: id, memberName: name, cashYen: cash, internalYen: funded, accruedYen: accrued, closingUnfundedYen: stock, externalUnpaidYen: internal ? 0 : stock, internalUnfundedYen: internal ? stock : 0, savedAdjustmentYen: adjustment, breakdown });
    }
    const total = (key: "cashYen" | "internalYen" | "accruedYen" | "closingUnfundedYen" | "externalUnpaidYen" | "internalUnfundedYen") => rows ? sum(members.map((m) => m[key])) : null;
    const cash = total("cashYen"), funded = total("internalYen"), stock = total("closingUnfundedYen");
    cumulativeBudget = sum([cumulativeBudget, budget]); cumulativeFunded = sum([cumulativeFunded, cash, funded]);
    const used = sum([cumulativeFunded, stock]);
    return { ym, budgetYen: budget, accruedYen: total("accruedYen"), cashYen: cash, internalYen: funded, closingUnfundedYen: stock,
      externalUnpaidYen: total("externalUnpaidYen"), internalUnfundedYen: total("internalUnfundedYen"),
      cumulativeRemainingYen: cumulativeBudget == null || used == null ? null : cumulativeBudget - used, members };
  });
  const annualMs = [...milestones.values()].sort((a, b) => b.earnedYen - a.earnedYen || a.msKey.localeCompare(b.msKey));
  const accruedYen = sum(monthly.map((m) => m.accruedYen)), openingCarryYen = sum(opening), roundingYen = sum(rounding), offsetsYen = sum(offsets);
  const savedAdjustmentYen = sum(monthly.flatMap((m) => m.members.map((member) => member.savedAdjustmentYen)));
  const explained = sum([accruedYen, openingCarryYen, roundingYen, offsetsYen == null ? null : -offsetsYen, savedAdjustmentYen]);
  const monthlyBudget = sum(monthly.map((m) => m.budgetYen));
  if (monthlyBudget != null && budgetYen != null && monthlyBudget !== budgetYen) notes.add(`月次原資合計とシーズン予算の差 ${monthlyBudget - budgetYen}円。年計の正本はシーズン予算`);
  return { regularPointBasis: regularPointBasisForCycle(plan),
    regularAllocatedPt: pointsKnown ? roundPt(annualMs.filter((m) => m.pool === "regular").reduce((a, m) => a + m.earnedPt, 0)) : null,
    extraAllocatedPt: pointsKnown ? roundPt(annualMs.filter((m) => m.pool === "extra").reduce((a, m) => a + m.earnedPt, 0)) : null,
    accruedYen, openingCarryYen, roundingYen, offsetsYen, savedAdjustmentYen,
    unexplainedYen: committedYen == null || explained == null ? null : committedYen - explained,
    msDifferenceYen: accruedYen == null || !pointsKnown ? null : accruedYen - annualMs.reduce((a, m) => a + m.earnedYen, 0),
    monthly, milestones: annualMs, notes: [...notes] };
}
