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
 * 明細の摘要は「SOL 業務委託料（10月お支払分）」と支払月で書き、2行目に「対象：2026年4〜5月の稼働」と
 * **今回の支払が当たる稼働月**を添える。繰越の範囲全体を書くと「4〜6月稼働分 87,185円」になり、
 * 4月の発生分にも届かない額が3か月分の支払に見える (まさ指摘 2026-10-02: ちこの 2026年9月支払)。
 * 当て方は /admin/payouts の内訳モーダルと同じ「古い稼働月の発生分から順に払う」仮定。
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
  /** 今回の本契約の支払が当たる稼働月 (古い月から順に払う仮定)。支払が 0 なら空 */
  paidMonths: PaidMonth[];
};

/** 今回の支払のうち、ある稼働月の発生分に当たる部分 */
export type PaidMonth = {
  ym: string;
  /** その月の発生分のうち今回払う額 */
  paidYen: number;
  /** その月の発生分の一部を、前回までにすでに払っている */
  startedBefore: boolean;
  /** 今回の支払で、その月の発生分を払い終える */
  completed: boolean;
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
    return { startYm: sourceYm, endYm: sourceYm, grossDueYen: 0, stockYen: 0, paidMonths: [] };
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

  return {
    startYm,
    endYm: sourceYm,
    grossDueYen: current.grossDue,
    stockYen: current.stock,
    paidMonths: allocatePaidMonths(byYm, startYm, sourceYm),
  };
}

/**
 * 今回の支払を、範囲内の稼働月の発生分へ古い月から順に当てる。
 *
 * 前回までに払った額は「範囲内の前月までの発生合計 − 今月の繰越入」で求める。月ごとの支払額を
 * 足し上げるより、控除 (`reward_member_liability_offsets`) や端数で繰越がずれても今月の繰越と食い違わない。
 */
function allocatePaidMonths(byYm: Map<string, RegularPoolAmounts>, startYm: string, endYm: string): PaidMonth[] {
  const accruals: Array<{ ym: string; yen: number }> = [];
  for (let ym = startYm, guard = 0; ym <= endYm && guard < 60; ym = addMonths(ym, 1), guard += 1) {
    const row = byYm.get(ym);
    accruals.push({ ym, yen: row ? Math.max(0, row.grossDue - row.carryIn) : 0 });
  }
  const current = byYm.get(endYm);
  if (!current) return [];
  const paid = Math.max(0, current.grossDue - current.stock);
  if (paid <= 0) return [];

  const accruedBefore = accruals.slice(0, -1).reduce((sum, row) => sum + row.yen, 0);
  let cursor = Math.max(0, accruedBefore - current.carryIn);
  const payEnd = cursor + paid;
  const result: PaidMonth[] = [];
  let monthStart = 0;
  for (const row of accruals) {
    const monthEnd = monthStart + row.yen;
    if (row.yen > 0 && cursor < monthEnd && payEnd > monthStart) {
      const from = Math.max(cursor, monthStart);
      const to = Math.min(payEnd, monthEnd);
      result.push({ ym: row.ym, paidYen: to - from, startedBefore: from > monthStart, completed: to >= monthEnd });
      cursor = to;
    }
    monthStart = monthEnd;
  }
  return result;
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

/**
 * 通知書の明細の摘要。稼働月ではなく**支払月**で書く (まさ確定 2026-10-03「◯月支払分、とかじゃダメなの？」)。
 * 「4月発生分の一部」のような書き方は、未払いの積み上がりを知らない人には読めない。
 */
export function payoutLineDescription(projectName: string, paymentYm: string): string {
  const month = YM_RE.test(paymentYm) ? `${Number(paymentYm.slice(4, 6))}月お支払分` : `${paymentYm}お支払分`;
  return `${projectName} 業務委託料（${month}）`;
}

/**
 * 摘要の2行目に添える対象の稼働月。支払通知書を仕入明細書として使うには取引の期間が要るため、
 * 支払月だけにせず、今回の支払が当たる稼働月 (古い月から順に払う仮定) を年つきで書く。
 * 「の一部」「の残り」は付けない。
 */
export function payoutTargetText(span: PayoutSourceSpan): string {
  const months = span.paidMonths ?? [];
  const first = months.length > 0 ? months[0].ym : span.endYm;
  const last = months.length > 0 ? months[months.length - 1].ym : span.endYm;
  return `対象：${ymPeriodLabel(first, last)}の稼働`;
}

/** 年つきの月の範囲。「2026年4月」「2026年4〜5月」「2025年12月〜2026年1月」 */
export function ymPeriodLabel(startYm: string, endYm: string): string {
  if (!YM_RE.test(startYm) || !YM_RE.test(endYm)) return endYm;
  const year = (ym: string) => ym.slice(0, 4);
  const month = (ym: string) => Number(ym.slice(4, 6));
  if (startYm === endYm) return `${year(endYm)}年${month(endYm)}月`;
  if (year(startYm) === year(endYm)) return `${year(endYm)}年${month(startYm)}〜${month(endYm)}月`;
  return `${year(startYm)}年${month(startYm)}月〜${year(endYm)}年${month(endYm)}月`;
}
