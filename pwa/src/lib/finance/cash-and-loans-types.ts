/** `/admin/cash`「現金と融資」が使う型。サーバとクライアントで共有する。 */

export type CashLedgerEntry = {
  id: string;
  accountId: string;
  entryDate: string;
  seq: number;
  counterparty: string | null;
  transferName: string | null;
  withdrawal: number;
  deposit: number;
  /** スプレッドシートに書かれていた残高。空の行もある。 */
  sheetBalance: number | null;
  /** OS が期首から積み上げた残高。 */
  runningBalance: number;
  /** 原本の残高と積み上げが食い違っている額。0 なら一致。 */
  balanceGap: number | null;
  category: string | null;
  targetMonth: string | null;
  note: string | null;
  isPlanned: boolean;
};

export type CashMonthRow = {
  ym: string;
  label: string;
  inflow: number;
  outflow: number;
  net: number;
  endBalance: number;
  /** その月に予定行が含まれるか。 */
  hasPlanned: boolean;
};

export type CashAccountView = {
  accountId: string;
  name: string;
  shortName: string;
  institution: string;
  purpose: string | null;
  /** 実績の最終行の残高と、その日付。 */
  actualBalance: number | null;
  actualAsOf: string | null;
  /** 予定をすべて反映したあとの残高 (先の見通し)。 */
  plannedBalance: number | null;
  plannedAsOf: string | null;
  /** 期間中いちばん低くなる予定残高。資金ショートの手前を見るために出す。 */
  lowestPlanned: { date: string; balance: number } | null;
  entryCount: number;
  /** 原本の残高と積み上げが食い違う行。きよが直せるように出す。 */
  gapCount: number;
  monthly: CashMonthRow[];
  entries: CashLedgerEntry[];
};

export type LoanEventView = {
  id: string;
  eventDate: string;
  kind: "drawdown" | "repayment" | "fee";
  amount: number;
  principalAmount: number | null;
  interestAmount: number | null;
  isPlanned: boolean;
  note: string | null;
  /** そのできごとの直後に残っている元金。 */
  balanceAfter: number;
};

export type LoanView = {
  loanId: string;
  lender: string;
  shortName: string;
  accountId: string | null;
  accountName: string | null;
  annualRate: number;
  dayCountBasis: number;
  repaymentType: string;
  contractedOn: string | null;
  drawdownOn: string | null;
  principalAmount: number | null;
  creditLimit: number | null;
  termMonths: number | null;
  note: string | null;
  /** 今日時点で借りている元金。 */
  outstanding: number;
  /** 借りた総額 / 返した元金 / 払った利息 (実績のみ)。 */
  totalDrawdown: number;
  repaidPrincipal: number;
  paidInterest: number;
  /** これから払う予定の利息。 */
  plannedInterest: number;
  nextDue: { date: string; amount: number; principal: number | null; interest: number | null } | null;
  finalDueOn: string | null;
  events: LoanEventView[];
};

export type CashAndLoansResult = {
  today: string;
  accounts: CashAccountView[];
  loans: LoanView[];
  /** 全口座の実績残高の合計。 */
  totalActualBalance: number;
  /** 借入残高の合計。 */
  totalOutstanding: number;
  computedAtIso: string;
};
