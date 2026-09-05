/**
 * `/admin/cash`「現金と融資」の集計。正本は pwa/manual/6-13-cash-and-loans-spec.md。
 *
 * 【この画面が持つもの】
 * きよが Google スプレッドシート「収支」で手入力している口座の入出金と、
 * PayPay銀行 / 商工中金 からの借入残高。つまり「現金がいくらあって、いくら借りているか」。
 *
 * 【`/admin/kiyo` の「00 お金の流れ」との違い】
 * あちらは freee 試算表から損益を見る画面 (manual/6-11)。こちらは現金と借入。
 * 同じ月でも数字は一致しない。損益と現金は別物だからで、それは 6-11 に書いてある。
 *
 * 【残高の扱い】
 * スプシに書かれている残高をそのまま持ち、あわせて OS が期首から積み上げた残高も出す。
 * 手入力なので式が切れている箇所があり、両方並べないと「どこで狂ったか」が分からない。
 * 直すのはきよなので、OS は食い違いを見せるところまでを担う。
 *
 * 参照系 (きよが日〜週単位で手で更新する) なので、spec 5-10 のとおり
 * プロセス内スナップショットを 5 分持つ。書き込み経路からは invalidate を呼ぶ。
 */
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { daysBetween } from "@/lib/finance/loan-interest";
import type {
  CashAccountView,
  CashAndLoansResult,
  CashLedgerEntry,
  CashMonthRow,
  LoanEventView,
  LoanView,
} from "@/lib/finance/cash-and-loans-types";

export type * from "@/lib/finance/cash-and-loans-types";

const PAGE_SIZE = 1000;

function num(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function text(value: unknown): string | null {
  const s = value == null ? "" : String(value).trim();
  return s === "" ? null : s;
}

/** 日本時間の今日を 'YYYY-MM-DD' で返す。 */
export function todayJst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

function ymLabel(ym: string): string {
  return `${ym.slice(0, 4)}年${Number(ym.slice(5, 7))}月`;
}

/**
 * PostgREST の 1 レスポンス上限 (既定 1000 行) を跨いでも落とさないページ読み。
 * 素の select にすると、行が 1000 を超えた日に黙って切り捨てられる (spec 5-10)。
 */
async function selectAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

type AccountRow = {
  account_id: string; name: string; short_name: string; institution: string;
  purpose: string | null; sort_order: number; is_active: boolean;
};
type EntryRow = {
  id: string; account_id: string; entry_date: string; seq: number;
  counterparty: string | null; transfer_name: string | null;
  withdrawal: number; deposit: number; balance: number | null;
  category: string | null; target_month: string | null; note: string | null; is_planned: boolean;
  source: string; source_row: number | null;
};
type LoanRow = {
  loan_id: string; lender: string; short_name: string; account_id: string | null;
  annual_rate: number | string; day_count_basis: number; repayment_type: string;
  contracted_on: string | null; drawdown_on: string | null;
  principal_amount: number | null; credit_limit: number | null; term_months: number | null;
  note: string | null; is_active: boolean;
};
type LoanEventRow = {
  id: string; loan_id: string; event_date: string; kind: string; amount: number;
  principal_amount: number | null; interest_amount: number | null;
  is_planned: boolean; note: string | null;
};

function buildAccount(account: AccountRow, rows: EntryRow[], today: string): CashAccountView {
  const sorted = [...rows].sort((a, b) =>
    a.entry_date === b.entry_date ? a.seq - b.seq : a.entry_date < b.entry_date ? -1 : 1,
  );

  // 残高の積み上げは日付順。同じ日の中だけ、取り込み元の行番号 (無ければ seq) で並べる。
  // OS 上で足した行が正しい位置に入るようにするため、ここは日付を主にする。
  // 元の表には日付が前後している箇所が1か所あり (8/6 の行が 8/5 の行より上)、
  // そこは「その行で新しくズレた」1件として印が付く。
  const inSheetOrder = [...rows].sort((a, b) => {
    if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? -1 : 1;
    const ao = a.source_row ?? a.seq + 1_000_000;
    const bo = b.source_row ?? b.seq + 1_000_000;
    return ao - bo;
  });

  // 期首残高: 残高が入っている最初の行から、そこまでの増減を差し引いて逆算する。
  const first = inSheetOrder.find((r) => r.balance != null);
  let opening = first ? num(first.balance) - num(first.deposit) + num(first.withdrawal) : 0;
  if (first) {
    for (const r of inSheetOrder) {
      if (r.id === first.id) break;
      opening -= num(r.deposit) - num(r.withdrawal);
    }
  }

  // 残高は毎回この場で積み上げ直す。取り込んだときの値を持ち回さないので、
  // 途中の行の金額を直せば、その先の残高がぜんぶ変わる (まさ 2026-09-05)。
  //
  // freee 由来の行だけは例外で、そこに書かれている残高 (銀行の実残高) で積み上げを合わせ直す。
  // 銀行の記録が唯一の事実なので、そこまでの取りこぼしをここで吸収する。
  const runningById = new Map<string, number>();
  /** その行で新しく生じたズレ。スプレッドシートの残高と積み上げが食い違う行だけに印を付ける。 */
  const gapStepById = new Map<string, number>();
  {
    let acc = opening;
    let previousGap = 0;
    for (const r of inSheetOrder) {
      const moved = num(r.deposit) - num(r.withdrawal);
      if (r.source === "freee" && r.balance != null) {
        // 銀行の実残高で合わせ直す。ここまでの積み上げとの差は「取りこぼしがあった」印。
        const before = acc + moved;
        const diff = num(r.balance) - before;
        if (diff !== 0) gapStepById.set(r.id, diff);
        acc = num(r.balance);
        previousGap = 0;
      } else {
        acc += moved;
        if (r.balance != null) {
          const gap = num(r.balance) - acc;
          gapStepById.set(r.id, gap - previousGap);
          previousGap = gap;
        }
      }
      runningById.set(r.id, acc);
    }
  }

  const entries: CashLedgerEntry[] = [];
  const monthly = new Map<string, CashMonthRow>();
  let actualBalance: number | null = null;
  let actualAsOf: string | null = null;
  let plannedBalance: number | null = null;
  let plannedAsOf: string | null = null;
  let lowestPlanned: { date: string; balance: number } | null = null;
  let lastActualRunning: number | null = null;
  let lastActualDate: string | null = null;
  let gapCount = 0;

  for (const r of sorted) {
    const isPlanned = r.is_planned || r.entry_date > today;
    const running = runningById.get(r.id) ?? 0;
    const sheetBalance = r.balance == null ? null : num(r.balance);
    const gap = sheetBalance == null ? null : sheetBalance - running;
    const gapStep = gapStepById.get(r.id) ?? null;
    if (gapStep != null && gapStep !== 0) gapCount += 1;

    entries.push({
      id: r.id, accountId: r.account_id, entryDate: r.entry_date, seq: r.seq,
      counterparty: text(r.counterparty), transferName: text(r.transfer_name),
      withdrawal: num(r.withdrawal), deposit: num(r.deposit),
      sheetBalance, runningBalance: running, balanceGap: gap, balanceGapStep: gapStep,
      category: text(r.category), targetMonth: text(r.target_month), note: text(r.note),
      isPlanned, source: r.source,
    });

    // 画面に出す残高は、常に積み上げた値。スプレッドシートに書いてあった残高は照合用に持つだけ。
    const shown = running;

    const ym = r.entry_date.slice(0, 7);
    const month = monthly.get(ym) ?? {
      ym, label: ymLabel(ym), inflow: 0, outflow: 0, net: 0, endBalance: shown, hasPlanned: false,
    };
    month.inflow += num(r.deposit);
    month.outflow += num(r.withdrawal);
    month.net = month.inflow - month.outflow;
    month.endBalance = shown;
    if (isPlanned) month.hasPlanned = true;
    monthly.set(ym, month);

    if (!isPlanned) {
      lastActualRunning = shown;
      lastActualDate = r.entry_date;
      actualBalance = shown;
      actualAsOf = r.entry_date;
    } else {
      plannedBalance = shown;
      plannedAsOf = r.entry_date;
      if (!lowestPlanned || shown < lowestPlanned.balance) {
        lowestPlanned = { date: r.entry_date, balance: shown };
      }
    }
  }

  return {
    accountId: account.account_id, name: account.name, shortName: account.short_name,
    institution: account.institution, purpose: text(account.purpose),
    actualBalance: actualBalance ?? lastActualRunning,
    actualAsOf: actualAsOf ?? lastActualDate, plannedBalance, plannedAsOf, lowestPlanned,
    entryCount: entries.length, gapCount,
    monthly: [...monthly.values()].sort((a, b) => (a.ym < b.ym ? -1 : 1)),
    entries,
  };
}

function buildLoan(loan: LoanRow, rows: LoanEventRow[], accountName: string | null, today: string): LoanView {
  const sorted = [...rows].sort((a, b) => (a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0));
  const annualRate = Number(loan.annual_rate) || 0;

  let balance = 0;
  let totalDrawdown = 0;
  let repaidPrincipal = 0;
  let paidInterest = 0;
  let plannedInterest = 0;
  let outstanding = 0;
  const events: LoanEventView[] = [];

  for (const r of sorted) {
    const isPlanned = r.is_planned || r.event_date > today;
    const principal = r.principal_amount == null ? (r.kind === "fee" ? 0 : num(r.amount)) : num(r.principal_amount);
    if (r.kind === "drawdown") {
      balance += principal;
      totalDrawdown += principal;
    } else if (r.kind === "repayment") {
      balance -= principal;
      if (isPlanned) plannedInterest += num(r.interest_amount);
      else {
        repaidPrincipal += principal;
        paidInterest += num(r.interest_amount);
      }
    }
    if (!isPlanned) outstanding = balance;
    events.push({
      id: r.id, eventDate: r.event_date, kind: r.kind as LoanEventView["kind"],
      amount: num(r.amount),
      principalAmount: r.principal_amount == null ? null : num(r.principal_amount),
      interestAmount: r.interest_amount == null ? null : num(r.interest_amount),
      isPlanned, note: text(r.note), balanceAfter: balance,
    });
  }
  // 実績のイベントが1件も無いときは、借入もまだ起きていない。
  if (!events.some((e) => !e.isPlanned)) outstanding = 0;

  const upcoming = events.find((e) => e.isPlanned && e.kind === "repayment");
  const lastRepayment = [...events].reverse().find((e) => e.kind === "repayment");

  return {
    loanId: loan.loan_id, lender: loan.lender, shortName: loan.short_name,
    accountId: loan.account_id, accountName,
    annualRate, dayCountBasis: loan.day_count_basis || 365,
    repaymentType: loan.repayment_type,
    contractedOn: loan.contracted_on, drawdownOn: loan.drawdown_on,
    principalAmount: loan.principal_amount == null ? null : num(loan.principal_amount),
    creditLimit: loan.credit_limit == null ? null : num(loan.credit_limit),
    termMonths: loan.term_months, note: text(loan.note),
    outstanding, totalDrawdown, repaidPrincipal, paidInterest, plannedInterest,
    nextDue: upcoming
      ? { date: upcoming.eventDate, amount: upcoming.amount, principal: upcoming.principalAmount, interest: upcoming.interestAmount }
      : null,
    finalDueOn: lastRepayment?.eventDate ?? null,
    events,
  };
}

async function computeInternal(): Promise<CashAndLoansResult> {
  const supabase = createAdminClient();
  const today = todayJst();

  const [accounts, entries, loans, loanEvents] = await Promise.all([
    selectAll<AccountRow>((from, to) =>
      supabase.from("cash_accounts").select("*").eq("is_active", true).order("sort_order").range(from, to),
    ),
    selectAll<EntryRow>((from, to) =>
      supabase.from("cash_ledger_entries").select("*").order("entry_date").order("seq").range(from, to),
    ),
    selectAll<LoanRow>((from, to) =>
      supabase.from("loans").select("*").eq("is_active", true).order("loan_id").range(from, to),
    ),
    selectAll<LoanEventRow>((from, to) =>
      supabase.from("loan_events").select("*").order("event_date").range(from, to),
    ),
  ]);

  const entriesByAccount = new Map<string, EntryRow[]>();
  for (const row of entries) {
    const list = entriesByAccount.get(row.account_id) ?? [];
    list.push(row);
    entriesByAccount.set(row.account_id, list);
  }
  const eventsByLoan = new Map<string, LoanEventRow[]>();
  for (const row of loanEvents) {
    const list = eventsByLoan.get(row.loan_id) ?? [];
    list.push(row);
    eventsByLoan.set(row.loan_id, list);
  }

  const accountViews = accounts.map((a) => buildAccount(a, entriesByAccount.get(a.account_id) ?? [], today));
  const accountNameById = new Map(accounts.map((a) => [a.account_id, a.short_name]));
  const loanViews = loans.map((l) =>
    buildLoan(l, eventsByLoan.get(l.loan_id) ?? [], l.account_id ? accountNameById.get(l.account_id) ?? null : null, today),
  );

  return {
    today,
    accounts: accountViews,
    loans: loanViews,
    totalActualBalance: accountViews.reduce((sum, a) => sum + (a.actualBalance ?? 0), 0),
    totalOutstanding: loanViews.reduce((sum, l) => sum + l.outstanding, 0),
    computedAtIso: new Date().toISOString(),
  };
}

// この画面は編集する場所なので、参照系の既定 (5分) より短く持つ。
// 書き込み経路からは invalidate を呼ぶが、サーバが複数で動くと書き込みを処理した側しか
// 消えない。別のタブや別の人が開いたときに古い残高が出る時間を短くする。
const CACHE_TTL_MS = 60 * 1000;
let cached: { value: CashAndLoansResult; storedAt: number } | null = null;
let inflight: Promise<CashAndLoansResult> | null = null;

export async function getCashAndLoans(force = false): Promise<CashAndLoansResult> {
  if (!force && cached && Date.now() - cached.storedAt < CACHE_TTL_MS) return cached.value;
  if (!force && inflight) return inflight;

  const request = computeInternal()
    .then((value) => {
      cached = { value, storedAt: Date.now() };
      return value;
    })
    .finally(() => {
      if (inflight === request) inflight = null;
    });
  inflight = request;
  return request;
}

/** 明細や借入を書き換えたあとに呼ぶ。 */
export function invalidateCashAndLoansCache(): void {
  cached = null;
  inflight = null;
}

export { daysBetween };
