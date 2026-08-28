/**
 * 支払通知書の明細に書く「稼働月の範囲」。
 *
 * 繰越があると、その支払には当月の発生分だけでなく過去月の未払い分も乗る。当月だけを
 * 「6月稼働分」と書くと、実際には4月から積み上がった分を払っているのに1か月分に見える
 * (まさ指摘 2026-08-28: かるの 2026年8月支払は 4〜6月の発生分)。
 *
 * 範囲に入れるのは**本契約 (regular) の繰越だけ**。別財布 (cap_extra) は支払条件が本契約と
 * 別 (ZMP の OkuDoor 開発は完了月に一括: manual/7-1 の別財布節) なので、その積立を本契約の
 * 未払いと混ぜない。混ぜると、本契約を毎月満額払っていても別財布の積立だけで
 * 「5〜7月稼働分・残りは翌月以降お支払いします」と書いてしまう (まさ指摘 2026-08-28: ZMP)。
 *
 * 検査: npm run test:payout-source-span
 */

const YM_RE = /^[0-9]{6}$/;

function numberValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function yenValue(value: unknown): number {
  return Math.round(numberValue(value));
}

function addMonths(ym: string, delta: number): string {
  if (!YM_RE.test(ym)) return ym;
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const total = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}${String(nextMonth).padStart(2, "0")}`;
}

/** 本契約 (regular) プールの繰越・発生・未払い。別財布 (cap_extra) は含まない */
export type RegularPoolAmounts = {
  /** 前月から繰り越した本契約の未払い */
  carryIn: number;
  /** 当月発生 + 繰越 = その月に払うべき本契約の総額 */
  grossDue: number;
  /** 今月払ったあとに残る本契約の未払い */
  stock: number;
};

export type PayoutSourceSpan = {
  startYm: string;
  endYm: string;
  /** その範囲で発生した本契約の支払対象額 (当月発生 + 繰越)。別財布は含まない */
  grossDueYen: number;
  /** 今回払ったあとに残る本契約の未払い。別財布は含まない */
  stockYen: number;
};

/**
 * `reward_summary_json` のメンバー行から本契約プールの金額を取る。
 *
 * `carryInYen` / `grossDueYen` / `stockYen` は regular と別財布の**混在値**なので使わない。
 */
export function regularPoolAmounts(member: Record<string, unknown>): RegularPoolAmounts {
  // regular 値を持たない古い snapshot は、混在値から別財布分を引いて代用する
  const pick = (regular: unknown, mixed: unknown, extra: unknown): number =>
    regular != null ? yenValue(regular) : Math.max(0, yenValue(mixed) - yenValue(extra));
  return {
    carryIn: pick(
      member.regularCarryInYen ?? member.regular_carry_in_yen,
      member.carryInYen ?? member.carry_in_yen,
      member.extraCarryInYen ?? member.extra_carry_in_yen
    ),
    grossDue: pick(
      member.regularGrossDueYen ?? member.regular_gross_due_yen,
      member.grossDueYen ?? member.gross_due_yen,
      member.extraGrossDueYen ?? member.extra_gross_due_yen
    ),
    stock: pick(
      member.regularStockYen ?? member.regular_stock_yen,
      member.stockYen ?? member.stock_yen,
      member.extraStockYen ?? member.extra_stock_yen
    ),
  };
}

/**
 * 本契約の繰越の鎖を遡って、この支払に含まれる稼働月の範囲を求める。
 *
 * 繰越が 0 の月まで戻ったところが範囲の先頭。plan cycle をまたぐと繰越の鎖は切れるので、
 * 遡る範囲は同じ plan cycle 内に限る (`floorYm` = `value_plan_cycles.period_start_ym`)。
 */
export function resolvePayoutSourceSpan(
  byYm: Map<string, RegularPoolAmounts>,
  sourceYm: string,
  floorYm: string | null
): PayoutSourceSpan {
  const current = byYm.get(sourceYm);
  if (!current) {
    return { startYm: sourceYm, endYm: sourceYm, grossDueYen: 0, stockYen: 0 };
  }

  let startYm = sourceYm;
  let guard = 0;
  while (guard < 60) {
    guard += 1;
    const row = byYm.get(startYm);
    if (!row || row.carryIn <= 0) break;
    const previousYm = addMonths(startYm, -1);
    if (floorYm && previousYm < floorYm) break;
    if (!byYm.has(previousYm)) break;
    startYm = previousYm;
  }

  return { startYm, endYm: sourceYm, grossDueYen: current.grossDue, stockYen: current.stock };
}

export function ymShortLabel(ym: string): string {
  return YM_RE.test(ym) ? `${Number(ym.slice(4, 6))}月稼働分` : ym;
}

export function ymSpanLabel(startYm: string, endYm: string): string {
  if (!YM_RE.test(startYm) || !YM_RE.test(endYm) || startYm === endYm) return ymShortLabel(endYm);
  const startYear = startYm.slice(0, 4);
  const endYear = endYm.slice(0, 4);
  const startMonth = Number(startYm.slice(4, 6));
  const endMonth = Number(endYm.slice(4, 6));
  if (startYear === endYear) return `${startMonth}〜${endMonth}月稼働分`;
  return `${startYear}年${startMonth}月〜${endYear}年${endMonth}月稼働分`;
}
