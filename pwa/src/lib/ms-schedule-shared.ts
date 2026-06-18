/**
 * ms-schedule-shared.ts
 * MS スケジュール (期間按分のデフォルト累積進捗) 計算の共有正本。
 *
 * 「N か月で完了する計画の MS は 1 か月あたり 100/N % の累積進捗がデフォルトで入る」
 * という AMD OS の基本契約をここで一元化する。
 * 利用箇所: progress-estimator / reward-summary / /api/progress/ms-schedule / /api/cron/ms-schedule-progress
 */

/**
 * PM (まさ) が確定・修正・却下した行の source 一覧。
 * これらの行は自動処理 (スケジュール按分デフォルト / LLM 推定) が上書きしない。
 * 報酬計算でも「人間確定行」として扱う唯一の判定基準。
 */
export const PM_LOCKED_PROGRESS_SOURCES = new Set([
  "pm_manual",
  "pm_confirmed",
  "pm_rejected",
  "criteria_toggle",
  "tsukuyomi_revision",
]);

export function isYm(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{6}$/.test(value);
}

export function ymToIndex(ym: string): number | null {
  if (!isYm(ym)) return null;
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return y * 12 + (m - 1);
}

export function indexToYm(index: number): string {
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}${String(m).padStart(2, "0")}`;
}

/**
 * 期間按分のデフォルト累積進捗率。
 * 開始前 = 0、最終月以降 = 100、それ以外は (経過月数 / 総月数) × 100 を小数1桁で返す。
 */
export function expectedCumPctForYm(asOfYm: string, periodStartYm: string, targetYm: string): number {
  const asOf = ymToIndex(asOfYm);
  const start = ymToIndex(periodStartYm);
  const end = ymToIndex(targetYm);
  if (asOf == null || start == null || end == null) return 0;
  if (asOf < start) return 0;
  if (asOf >= end) return 100;
  const totalMonths = Math.max(1, end - start + 1);
  const elapsedMonths = Math.max(0, asOf - start + 1);
  return Math.min(100, Math.round((elapsedMonths / totalMonths) * 1000) / 10);
}

/**
 * PM確定アンカー: その MS で最新の PM_LOCKED 行 (ym, 累積%)。
 * デフォルト按分の起点になる (2026-06-12 まさ確定の A 案アンカー方式)。
 */
export type ProgressAnchor = { ym: string; pct: number };

/**
 * アンカー方式の期間按分デフォルト累積進捗率。
 *
 * - アンカー (asOfYm より前の最新 PM_LOCKED 行) が無ければ従来の expectedCumPctForYm。
 * - アンカーがあれば「アンカー値 + (100/総月数) × アンカーからの経過月数」を 100 で cap。
 *   target_ym を過ぎても自動で 100% に飛ばさず、確定アンカーからの月割りで淡々と積む。
 */
export function anchoredExpectedCumPctForYm(
  asOfYm: string,
  periodStartYm: string,
  targetYm: string,
  anchor: ProgressAnchor | null | undefined
): number {
  const asOf = ymToIndex(asOfYm);
  const start = ymToIndex(periodStartYm);
  const end = ymToIndex(targetYm);
  if (asOf == null || start == null || end == null) return 0;
  if (asOf < start) return 0;
  const anchorIndex = anchor && isYm(anchor.ym) ? ymToIndex(anchor.ym) : null;
  if (anchorIndex == null || anchorIndex > asOf) {
    return expectedCumPctForYm(asOfYm, periodStartYm, targetYm);
  }
  const totalMonths = Math.max(1, end - start + 1);
  const anchorPct = Math.max(0, Math.min(100, Number(anchor?.pct ?? 0)));
  const monthsSinceAnchor = Math.max(0, asOf - anchorIndex);
  const pct = anchorPct + (100 / totalMonths) * monthsSinceAnchor;
  return Math.min(100, Math.round(pct * 10) / 10);
}

/**
 * 支払・表示に使うデフォルト累積進捗。
 *
 * AMD OS の基本契約は「期間がある MS は月数でプロラタ進行する」なので、
 * PM locked の低いアンカーで基準線を下回らせない。低い実績を表したい場合は
 * target_ym / period_start_ym / freeze など計画側を直す。
 */
export function proRataFloorCumPctForYm(
  asOfYm: string,
  periodStartYm: string,
  targetYm: string,
  anchor: ProgressAnchor | null | undefined
): number {
  return Math.max(
    expectedCumPctForYm(asOfYm, periodStartYm, targetYm),
    anchoredExpectedCumPctForYm(asOfYm, periodStartYm, targetYm, anchor)
  );
}

export function effectiveCumPctForYm(
  asOfYm: string,
  periodStartYm: string,
  targetYm: string,
  anchor: ProgressAnchor | null | undefined,
  lockedPct?: number | null
): number {
  const floor = proRataFloorCumPctForYm(asOfYm, periodStartYm, targetYm, anchor);
  if (lockedPct == null || !Number.isFinite(lockedPct)) return floor;
  return Math.max(floor, Math.max(0, Math.min(100, lockedPct)));
}

export type MilestoneScheduleSource = {
  period_start_ym: string | null;
  target_ym: string | null;
};

export type PlanCyclePeriod = {
  period_start_ym: string | null;
  period_end_ym: string | null;
};

export function milestonePeriod(ms: MilestoneScheduleSource, planCycle: PlanCyclePeriod) {
  const startYm = isYm(ms.period_start_ym) ? ms.period_start_ym : (isYm(planCycle.period_start_ym) ? planCycle.period_start_ym : null);
  const endYm = isYm(ms.target_ym) ? ms.target_ym : (isYm(planCycle.period_end_ym) ? planCycle.period_end_ym : startYm);
  return { startYm, endYm };
}

export type MilestoneScheduleInfo = {
  startYm: string | null;
  endYm: string | null;
  expectedPct: number;
  totalMonths: number;
  elapsedMonths: number;
  isBeforeStart: boolean;
  isAfterEnd: boolean;
};

export function milestoneSchedule(
  ms: MilestoneScheduleSource,
  planCycle: PlanCyclePeriod,
  ym: string
): MilestoneScheduleInfo {
  const { startYm, endYm } = milestonePeriod(ms, planCycle);
  const asOfIndex = ymToIndex(ym);
  const startIndex = startYm ? ymToIndex(startYm) : null;
  const endIndex = endYm ? ymToIndex(endYm) : null;
  const expectedPct = startYm && endYm ? expectedCumPctForYm(ym, startYm, endYm) : 0;
  const totalMonths = startIndex != null && endIndex != null ? Math.max(1, endIndex - startIndex + 1) : 1;
  const elapsedMonths = asOfIndex != null && startIndex != null ? Math.max(0, asOfIndex - startIndex + 1) : 0;
  return {
    startYm,
    endYm,
    expectedPct,
    totalMonths,
    elapsedMonths,
    isBeforeStart: asOfIndex != null && startIndex != null && asOfIndex < startIndex,
    isAfterEnd: asOfIndex != null && endIndex != null && asOfIndex > endIndex,
  };
}
