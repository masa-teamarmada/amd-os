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
      ym, partial, flows, inflow, outflow, endBalance, loanOutstanding,
      netOfLoans: endBalance - loanOutstanding,
      // 最初の月は前月末の残高がそろっていない (メインの口座の明細がその月から始まる) ので数えない。
      unexplained: ym === input.startYm ? 0 : endBalance - previousBalance - (inflow - outflow),
    });
    previousBalance = endBalance;
  }
  return rows;
}

function addMonthBack(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
