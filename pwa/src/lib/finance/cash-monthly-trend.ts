/**
 * 「現金と融資」の月ごとの推移。DB も fetch も触らない純関数。
 * 正本は pwa/manual/6-13-cash-and-loans-spec.md の「03 月ごとの推移」。
 *
 * 口座の入出金明細 (実績だけ) を区分に分けて月ごとに足し、月末の口座残高と借入残高を並べる。
 * 自社の口座どうしの移動は、入りにも出にも数えない (会社の外とのお金の出入りではないため)。
 */
import { computeLedgerRunning, ledgerBalanceOn, type LedgerRow } from "@/lib/finance/ledger-running-balance";
import type { CashFlowKind, CashMonthlyTrendRow } from "@/lib/finance/cash-and-loans-types";

export type TrendEntry = LedgerRow & {
  account_id: string;
  counterparty: string | null;
  transfer_name: string | null;
  /** 予定か実績か (画面と同じ判定を済ませたもの)。 */
  isPlanned: boolean;
};

export type TrendLoanEvent = {
  loanId: string;
  /** 引き落とし口座。 */
  accountId: string | null;
  eventDate: string;
  kind: string;
  amount: number;
  principal: number;
  isPlanned: boolean;
};

export type TrendAccount = {
  accountId: string;
  /** freee とつなげない口座 (商工中金)。 */
  ledgerOnly: boolean;
};

type FlowKey = Exclude<CashFlowKind, "transfer">;

export const FLOW_KEYS: FlowKey[] = [
  "income", "loan_in", "pay_masa", "pay_members", "card", "tax", "other_out", "loan_out",
];
export const INFLOW_KEYS: FlowKey[] = ["income", "loan_in"];
export const OUTFLOW_KEYS: FlowKey[] = ["pay_masa", "pay_members", "card", "tax", "other_out", "loan_out"];

// 自社名義への振込。相手先にこれが書かれた行は、口座どうしの移動として扱う。
const OWN_ACCOUNT = /アルマダ|ｱﾙﾏﾀﾞ|商工中金|PayPay銀行から振替|→商工中金|^UFJ$/;
const LOAN_IN = /ローン借入|融資実行/;
const LOAN_OUT = /約定返済|ローン返済/;
const MASA = /山地|ヤマジ|ﾔﾏｼﾞ|マサさん/;
const CARD = /カード|ｶｰﾄﾞ/;
const TAX = /税務署|ゼイムシヨ|国庫金|コツコキン|社会保険|シヤカイホケン|地方税|源泉|消費税|法人税|住民税|年金/;
const FEE = /手数料|テスウリヨウ/;

function daysApart(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/**
 * 1行を区分に分ける。商工中金のような返済専用の口座 (freee とつなげない、借入の引き落とし口座) は
 * 相手先が書かれていないので、借入・返済の予定表と日付と額で突き合わせる。
 */
export function classifyEntry(
  entry: TrendEntry,
  context: { ledgerOnly: boolean; loanEvents: TrendLoanEvent[] },
): CashFlowKind {
  const label = `${entry.counterparty ?? ""} ${entry.transfer_name ?? ""}`;
  const deposit = Number(entry.deposit) || 0;
  const withdrawal = Number(entry.withdrawal) || 0;

  if (OWN_ACCOUNT.test(label)) return "transfer";
  if (deposit > 0 && LOAN_IN.test(label)) return "loan_in";
  if (withdrawal > 0 && LOAN_OUT.test(label)) return "loan_out";

  // 予定表との突き合わせは、相手先の書かれない返済専用の口座 (freee とつなげない口座) だけ。
  // PayPay銀行のように相手先が書かれる口座でやると、借入の数日後に入った売上まで借入に数えてしまう。
  if (context.ledgerOnly) {
    const events = context.loanEvents.filter((e) => e.accountId === entry.account_id);
    if (deposit > 0 && events.some((e) =>
      e.kind === "drawdown" && daysApart(e.eventDate, entry.entry_date) <= 3 && deposit >= e.principal * 0.5,
    )) return "loan_in";
    if (withdrawal > 0 && events.some((e) =>
      e.kind === "repayment" && daysApart(e.eventDate, entry.entry_date) <= 3
        && Math.abs(withdrawal - e.amount) <= e.amount * 0.02,
    )) return "loan_out";
    // 返済専用の口座へ入るお金は、自社のほかの口座から移したものだけ。
    // 1万円未満は口座の手数料と利息なので、ふつうの出入りとして数える。
    if (Math.max(deposit, withdrawal) >= 10_000) return "transfer";
  }

  if (deposit > 0) return "income";
  if (MASA.test(label)) return "pay_masa";
  if (CARD.test(label)) return "card";
  if (TAX.test(label)) return "tax";
  if (FEE.test(label) || !entry.counterparty?.trim()) return "other_out";
  return "pay_members";
}

function addMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

function monthEnd(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function emptyFlows(): Record<FlowKey, number> {
  return Object.fromEntries(FLOW_KEYS.map((k) => [k, 0])) as Record<FlowKey, number>;
}

/**
 * @param startYm 最初の月 (YYYY-MM)。メインの口座の明細が始まる月を渡す。
 *                それより前は口座がそろっておらず、残高が実態より小さく出る。
 */
export function buildMonthlyTrend(input: {
  accounts: TrendAccount[];
  entries: TrendEntry[];
  loanEvents: TrendLoanEvent[];
  startYm: string;
  today: string;
  /**
   * freee が銀行から取った月末残高 (YYYY-MM → 円)。freee とつなげない口座は含めない。
   * あればこちらを正にする。スプレッドシートは手入力で行の書き漏れがあり、明細を足し上げると
   * 銀行の残高からずれる (2025-10-31 に約115万円の出金が書かれていない)。
   * ずれは「明細の漏れ」(unexplained) としてその月に出る。
   */
  bankBalances?: Map<string, number>;
  /** 予定・見込みを出す先の月数 (今月の残りに加えて)。 */
  forecastMonths?: number;
  /** メインの口座 (PayPay銀行)。この口座に予定の行がある月だけ、きよの予定を使う。 */
  mainAccountId?: string;
}): CashMonthlyTrendRow[] {
  const actual = input.entries.filter((e) => !e.isPlanned && e.entry_date <= input.today);
  const ledgerOnly = new Map(input.accounts.map((a) => [a.accountId, a.ledgerOnly]));

  // 口座ごとに、実績の行だけで残高を積み上げる。
  const runningByAccount = input.accounts.map((a) =>
    computeLedgerRunning(actual.filter((e) => e.account_id === a.accountId)),
  );
  const ledgerSum = (date: string, onlyLedgerOnly: boolean) => input.accounts.reduce((sum, account, index) => {
    if (onlyLedgerOnly && !account.ledgerOnly) return sum;
    return sum + (ledgerBalanceOn(runningByAccount[index], date) ?? 0);
  }, 0);
  const balanceOn = (date: string) => {
    const bank = input.bankBalances?.get(date.slice(0, 7));
    return bank == null ? ledgerSum(date, false) : bank + ledgerSum(date, true);
  };

  const loanActual = input.loanEvents.filter((e) => !e.isPlanned && e.eventDate <= input.today);
  const loanOn = (date: string) => loanActual.reduce((sum, e) => {
    if (e.eventDate > date) return sum;
    if (e.kind === "drawdown") return sum + e.principal;
    if (e.kind === "repayment") return sum - e.principal;
    return sum;
  }, 0);

  const flowsByYm = new Map<string, Record<FlowKey, number>>();
  for (const entry of actual) {
    const kind = classifyEntry(entry, {
      ledgerOnly: ledgerOnly.get(entry.account_id) ?? false,
      loanEvents: input.loanEvents,
    });
    if (kind === "transfer") continue;
    const ym = entry.entry_date.slice(0, 7);
    const flows = flowsByYm.get(ym) ?? emptyFlows();
    flows[kind] += INFLOW_KEYS.includes(kind) ? Number(entry.deposit) || 0 : Number(entry.withdrawal) || 0;
    flowsByYm.set(ym, flows);
  }

  const rows: CashMonthlyTrendRow[] = [];
  const todayYm = input.today.slice(0, 7);
  let previousBalance = balanceOn(monthEnd(addMonthBack(input.startYm)));
  for (let ym = input.startYm; ym <= todayYm; ym = addMonth(ym)) {
    const partial = ym === todayYm;
    const asOf = partial ? input.today : monthEnd(ym);
    const flows = flowsByYm.get(ym) ?? emptyFlows();
    const inflow = INFLOW_KEYS.reduce((s, k) => s + flows[k], 0);
    const outflow = OUTFLOW_KEYS.reduce((s, k) => s + flows[k], 0);
    const endBalance = balanceOn(asOf);
    const loanOutstanding = loanOn(asOf);
    rows.push({
      ym, partial, basis: "actual", flows, inflow, outflow, endBalance, loanOutstanding,
      netOfLoans: endBalance - loanOutstanding,
      // 最初の月は前月末の残高がそろっていない (メインの口座の明細がその月から始まる) ので数えない。
      unexplained: ym === input.startYm ? 0 : endBalance - previousBalance - (inflow - outflow),
    });
    previousBalance = endBalance;
  }

  const forecastMonths = input.forecastMonths ?? 0;
  if (forecastMonths > 0 && rows.length > 0) {
    appendForecast(rows, input, ledgerOnly, flowsByYm, todayYm, forecastMonths);
  }
  return rows;
}

/**
 * 今月の残りと、その先 forecastMonths か月の見込みを足す。
 *
 * - メインの口座にきよの予定の行がある月は、その予定を使う (今月は今日までの実績＋残りの予定)。
 * - 予定の無い月は、直近3か月 (今月を除く) の実績の中央値を区分ごとに置く。
 * - 借入の返済は、どちらの月も返済予定表から。予定表の無い借入 (PayPay銀行) は、
 *   前回の返済と同じ額が毎月あると置く。借入の新規実行は見込まない。
 * - 自社の口座どうしの移動は、実績と同じく数えない。
 * 残高は、今日の実績の残高から見込みの入り − 出を積み上げる。
 */
function appendForecast(
  rows: CashMonthlyTrendRow[],
  input: Parameters<typeof buildMonthlyTrend>[0],
  ledgerOnly: Map<string, boolean>,
  actualFlowsByYm: Map<string, Record<FlowKey, number>>,
  todayYm: string,
  forecastMonths: number,
): void {
  const today = input.today;
  // 予定の行は、その口座の実績の最終日より後のものを使う。freee は銀行の明細が数日遅れて届くので、
  // 「今日より後」で切ると、実績の最終日から今日までの予定 (カードの引き落としなど) が抜け落ちる。
  const lastActual = new Map<string, string>();
  for (const e of input.entries) {
    if (e.isPlanned || e.entry_date > today) continue;
    if ((lastActual.get(e.account_id) ?? "") < e.entry_date) lastActual.set(e.account_id, e.entry_date);
  }
  const future = input.entries.filter((e) => e.isPlanned && e.entry_date > (lastActual.get(e.account_id) ?? ""));
  const planFlowsByYm = new Map<string, Record<FlowKey, number>>();
  const mainPlanned = new Set<string>();
  for (const entry of future) {
    const ym = entry.entry_date.slice(0, 7);
    if (input.mainAccountId && entry.account_id === input.mainAccountId) mainPlanned.add(ym);
    const kind = classifyEntry(entry, {
      ledgerOnly: ledgerOnly.get(entry.account_id) ?? false,
      loanEvents: input.loanEvents,
    });
    // 借入と返済は予定表から数えるので、明細の予定の行からは入れない。
    if (kind === "transfer" || kind === "loan_in" || kind === "loan_out") continue;
    const flows = planFlowsByYm.get(ym) ?? emptyFlows();
    flows[kind] += INFLOW_KEYS.includes(kind) ? Number(entry.deposit) || 0 : Number(entry.withdrawal) || 0;
    planFlowsByYm.set(ym, flows);
  }

  // 直近3か月 (今月を除く) の実績の中央値。平均にすると、一度きりの大きな支払
  // (2026-09 の借入で払った 200 万円など) が先の月にも毎月あるように見えてしまう。
  const recent = rows.filter((r) => r.basis === "actual" && r.ym < todayYm).slice(-3);
  const average = emptyFlows();
  for (const key of FLOW_KEYS) {
    if (key === "loan_in" || key === "loan_out") continue;
    const sorted = recent.map((r) => r.flows[key]).sort((a, b) => a - b);
    average[key] = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0;
  }

  // 借入の返済の見込み。予定表の回 (今日より後) と、予定表の無い借入は前回と同じ額。
  const repaymentsIn = (ym: string) => {
    let amount = 0;
    let principal = 0;
    const loanIds = [...new Set(input.loanEvents.map((e) => e.loanId))];
    for (const loanId of loanIds) {
      const events = input.loanEvents.filter((e) => e.loanId === loanId);
      const scheduled = events.filter((e) => e.kind === "repayment" && e.eventDate > today && e.eventDate.startsWith(ym));
      if (scheduled.length) {
        for (const e of scheduled) { amount += e.amount; principal += e.principal; }
        continue;
      }
      if (events.some((e) => e.kind === "repayment" && e.eventDate > today)) continue; // 予定表はあるがこの月は無い
      const lastPaid = events
        .filter((e) => e.kind === "repayment" && !e.isPlanned && e.eventDate <= today)
        .sort((a, b) => (a.eventDate < b.eventDate ? 1 : -1))[0];
      const paidThisMonth = events.some((e) => e.kind === "repayment" && !e.isPlanned && e.eventDate.startsWith(ym));
      if (lastPaid && !paidThisMonth) { amount += lastPaid.amount; principal += lastPaid.principal; }
    }
    return { amount, principal };
  };

  const current = rows[rows.length - 1];
  let balance = current.endBalance;
  let loan = current.loanOutstanding;

  // 今月: 今日までの実績に、残りの予定と返済予定を足す。
  if (current.ym === todayYm) {
    const plan = planFlowsByYm.get(todayYm) ?? emptyFlows();
    const repay = repaymentsIn(todayYm);
    const flows = { ...(actualFlowsByYm.get(todayYm) ?? emptyFlows()) };
    for (const key of FLOW_KEYS) flows[key] += plan[key];
    flows.loan_out += repay.amount;
    const addIn = INFLOW_KEYS.reduce((s, k) => s + plan[k], 0);
    const addOut = OUTFLOW_KEYS.reduce((s, k) => s + plan[k], 0) + repay.amount;
    balance += addIn - addOut;
    loan -= repay.principal;
    Object.assign(current, {
      basis: "current" as const,
      flows,
      inflow: INFLOW_KEYS.reduce((s, k) => s + flows[k], 0),
      outflow: OUTFLOW_KEYS.reduce((s, k) => s + flows[k], 0),
      endBalance: balance,
      loanOutstanding: loan,
      netOfLoans: balance - loan,
      unexplained: 0,
    });
  }

  let ym = todayYm;
  for (let i = 0; i < forecastMonths; i += 1) {
    ym = addMonth(ym);
    const usePlan = mainPlanned.has(ym);
    const flows = { ...(usePlan ? planFlowsByYm.get(ym) ?? emptyFlows() : average) };
    const repay = repaymentsIn(ym);
    flows.loan_in = 0;
    flows.loan_out = repay.amount;
    const inflow = INFLOW_KEYS.reduce((s, k) => s + flows[k], 0);
    const outflow = OUTFLOW_KEYS.reduce((s, k) => s + flows[k], 0);
    balance += inflow - outflow;
    loan -= repay.principal;
    rows.push({
      ym, partial: false, basis: usePlan ? "plan" : "average", flows, inflow, outflow,
      endBalance: balance, loanOutstanding: loan, netOfLoans: balance - loan, unexplained: 0,
    });
  }
}

function addMonthBack(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
