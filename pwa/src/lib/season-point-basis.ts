const REGULAR_POINTS_PER_MONTH = 10;

type PlanCyclePeriod = {
  period_start_ym?: string | null;
  period_end_ym?: string | null;
};

type MilestonePeriod = {
  period_start_ym?: string | null;
  periodStartYm?: string | null;
  target_ym?: string | null;
  targetYm?: string | null;
};

function ymToMonthIndex(ym: string | null | undefined): number | null {
  if (!ym || !/^\d{6}$/.test(ym)) return null;
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return year * 12 + (month - 1);
}

export function roundPt(value: number): number {
  return Math.round(value * 100) / 100;
}

export function cycleMonthCountFromYm(startYm: string | null | undefined, endYm: string | null | undefined): number {
  const start = ymToMonthIndex(startYm);
  const end = ymToMonthIndex(endYm);
  if (start === null || end === null || end < start) return 0;
  return end - start + 1;
}

export function regularPointBasisForCycle(planCycle: PlanCyclePeriod | null | undefined): number {
  const months = cycleMonthCountFromYm(planCycle?.period_start_ym, planCycle?.period_end_ym);
  return months > 0 ? roundPt(months * REGULAR_POINTS_PER_MONTH) : 0;
}

export function pointBasisForPeriod(startYm: string | null | undefined, endYm: string | null | undefined): number {
  const months = cycleMonthCountFromYm(startYm, endYm);
  return months > 0 ? roundPt(months * REGULAR_POINTS_PER_MONTH) : 0;
}

export function pointBasisForMilestonePeriod(milestone: MilestonePeriod | null | undefined): number {
  if (!milestone) return 0;
  return pointBasisForPeriod(
    milestone.period_start_ym ?? milestone.periodStartYm,
    milestone.target_ym ?? milestone.targetYm,
  );
}

export function totalPointBasisForCycle(planCycle: PlanCyclePeriod | null | undefined, extraPoints: number): number {
  return roundPt(regularPointBasisForCycle(planCycle) + Math.max(0, extraPoints));
}
