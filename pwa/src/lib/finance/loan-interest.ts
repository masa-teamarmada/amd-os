/**
 * 借入の利息を日割りで数える。
 *
 * PayPay銀行のように「枠の中で何度でも借りて、都合がついたら返す」使い方をすると、
 * 利息は毎月おなじ額にならない。借りている元金と、その元金が何日残っていたかで決まる。
 *
 *   利息 = 残っている元金 × 年利 ÷ 365 × 日数
 *
 * ここは画面とサーバの両方から呼ぶ純関数だけを置く。DB も fetch も触らない。
 */

/** 借入 (drawdown) と返済 (repayment) の1件。日付は 'YYYY-MM-DD'。 */
export type LoanFlow = {
  date: string;
  kind: "drawdown" | "repayment";
  /** 元金の増減。返済に含まれる利息分はここに入れない。 */
  amount: number;
  label?: string;
};

/** 元金が一定だった1区間。 */
export type InterestSegment = {
  from: string;
  to: string;
  days: number;
  /** その区間ずっと借りていた元金。 */
  balance: number;
  /** 円未満を含む素の利息。表示では丸める。 */
  interest: number;
};

export type MonthlyInterest = {
  ym: string;
  interest: number;
  /** その月末時点で借りている元金。 */
  endBalance: number;
};

export type InterestResult = {
  segments: InterestSegment[];
  /** 期間全体の利息 (円未満切り捨て)。 */
  totalInterest: number;
  /** 最終日に残っている元金。 */
  finalBalance: number;
  /** 期間中いちばん多く借りていた額。 */
  maxBalance: number;
  /** 借りた総額 (何度も借りた場合はその合計)。 */
  totalDrawdown: number;
  /** 返した元金の総額。 */
  totalRepayment: number;
  byMonth: MonthlyInterest[];
};

const MS_PER_DAY = 86_400_000;

function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY);
}

/** 月末日を返す。'2026-09-30' のような形。 */
function endOfMonth(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
}

/**
 * 借入・返済の並びから、利息を日割りで積む。
 *
 * @param flows  借入と返済。順不同でよい (日付で並べ替える)。
 * @param annualRate 年利。0.14 = 年14.0%。
 * @param until  ここまでの利息を数える日 ('YYYY-MM-DD')。最後の返済日より前なら、その日で打ち切る。
 * @param dayCountBasis 日割りの分母。日本の銀行実務は 365。
 */
export function computeDailyInterest(
  flows: LoanFlow[],
  annualRate: number,
  until: string,
  dayCountBasis = 365,
): InterestResult {
  const sorted = [...flows]
    .filter((f) => Number.isFinite(f.amount) && f.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(f.date))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind === "drawdown" ? -1 : 1));

  const empty: InterestResult = {
    segments: [], totalInterest: 0, finalBalance: 0, maxBalance: 0,
    totalDrawdown: 0, totalRepayment: 0, byMonth: [],
  };
  if (sorted.length === 0) return empty;

  const startMs = toUtc(sorted[0].date);
  const endMs = toUtc(until);
  if (endMs < startMs) return empty;

  // 日付ごとの元金増減にまとめる。同じ日に借入と返済が両方あっても差し引きで扱う。
  const deltaByDate = new Map<string, number>();
  let totalDrawdown = 0;
  let totalRepayment = 0;
  for (const f of sorted) {
    if (toUtc(f.date) > endMs) continue;
    const delta = f.kind === "drawdown" ? f.amount : -f.amount;
    deltaByDate.set(f.date, (deltaByDate.get(f.date) ?? 0) + delta);
    if (f.kind === "drawdown") totalDrawdown += f.amount;
    else totalRepayment += f.amount;
  }

  // 区間の切れ目 = 元金が動いた日と、月末 (月ごとの利息を出すため)。
  const breakpoints = new Set<number>();
  for (const d of deltaByDate.keys()) breakpoints.add(toUtc(d));
  for (let ms = endOfMonth(startMs); ms < endMs; ms = endOfMonth(ms + MS_PER_DAY)) {
    breakpoints.add(ms + MS_PER_DAY);
  }
  breakpoints.add(endMs);
  const points = [...breakpoints].filter((ms) => ms >= startMs && ms <= endMs).sort((a, b) => a - b);

  const segments: InterestSegment[] = [];
  const monthly = new Map<string, { interest: number; endBalance: number }>();
  let balance = 0;
  let maxBalance = 0;
  let rawInterest = 0;

  for (let i = 0; i < points.length; i++) {
    const at = points[i];
    balance += deltaByDate.get(fromUtc(at)) ?? 0;
    if (balance > maxBalance) maxBalance = balance;
    const next = points[i + 1];
    if (next === undefined) {
      // 最終日。ここより先は数えない。
      const ym = fromUtc(at).slice(0, 7);
      const prev = monthly.get(ym) ?? { interest: 0, endBalance: balance };
      monthly.set(ym, { interest: prev.interest, endBalance: balance });
      break;
    }
    const days = Math.round((next - at) / MS_PER_DAY);
    if (days <= 0) continue;
    const interest = balance > 0 ? (balance * annualRate * days) / dayCountBasis : 0;
    rawInterest += interest;
    segments.push({ from: fromUtc(at), to: fromUtc(next), days, balance, interest });

    const ym = fromUtc(at).slice(0, 7);
    const prev = monthly.get(ym) ?? { interest: 0, endBalance: balance };
    monthly.set(ym, { interest: prev.interest + interest, endBalance: balance });
  }

  return {
    segments,
    totalInterest: Math.floor(rawInterest),
    finalBalance: balance,
    maxBalance,
    totalDrawdown,
    totalRepayment,
    byMonth: [...monthly.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([ym, v]) => ({ ym, interest: Math.floor(v.interest), endBalance: v.endBalance })),
  };
}

/**
 * 「いくらを何日借りたら利息はいくらか」の一点計算。早見表に使う。
 * 端数は切り捨て (実際の請求額は銀行の丸めに従うので、目安として出す)。
 */
export function simpleInterest(principal: number, annualRate: number, days: number, dayCountBasis = 365): number {
  if (!(principal > 0) || !(days > 0)) return 0;
  return Math.floor((principal * annualRate * days) / dayCountBasis);
}

/**
 * 元金均等 (毎月おなじ元金を返す) の返済予定を組む。商工中金がこの形。
 * 利息は前回返済日からの日数で日割りにする。
 */
export function buildEqualPrincipalSchedule(params: {
  principal: number;
  annualRate: number;
  termMonths: number;
  drawdownOn: string;
  firstDueOn: string;
  dayCountBasis?: number;
}): { dueOn: string; principal: number; interest: number; total: number; balanceAfter: number }[] {
  const { principal, annualRate, termMonths, drawdownOn, firstDueOn } = params;
  const basis = params.dayCountBasis ?? 365;
  if (!(principal > 0) || !(termMonths > 0)) return [];

  const per = Math.floor(principal / termMonths);
  const first = new Date(toUtc(firstDueOn));
  let balance = principal;
  let prev = drawdownOn;
  const rows: { dueOn: string; principal: number; interest: number; total: number; balanceAfter: number }[] = [];

  for (let i = 0; i < termMonths; i++) {
    const due = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + i, first.getUTCDate()));
    const dueOn = due.toISOString().slice(0, 10);
    const days = daysBetween(prev, dueOn);
    const interest = Math.floor((balance * annualRate * days) / basis);
    // 最終回は端数をまとめて返す。
    const principalPart = i === termMonths - 1 ? balance : per;
    balance -= principalPart;
    rows.push({ dueOn, principal: principalPart, interest, total: principalPart + interest, balanceAfter: balance });
    prev = dueOn;
  }
  return rows;
}
