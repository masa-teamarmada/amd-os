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
  /**
   * その行で新しく生じたズレ。前の「残高が書いてある行」からの差。
   * 一度ズレると以降の行にも同じ差が残り続けるので、直すべき行はこれが 0 でない行だけ。
   */
  balanceGapStep: number | null;
  category: string | null;
  targetMonth: string | null;
  note: string | null;
  isPlanned: boolean;
  /** どこから来た行か。'freee' / 'sheet:<タブ名>' / 'manual'。 */
  source: string;
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
  /** その行で新しくズレが生じた行の数。きよが直すのはこの行だけでよい。 */
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
  /** 月ごとの入り・出・残高 (実績のみ)。 */
  monthlyTrend: CashMonthlyTrendRow[];
  computedAtIso: string;
};

/** 月ごとの推移の区分。口座間の移動は入りにも出にも数えない。 */
export type CashFlowKind =
  | "income" // 入金 (売上など)
  | "loan_in" // 借入で入ったお金
  | "pay_masa" // まさへの振込 (役員報酬・立替の返金など)
  | "pay_members" // メンバー・外注への支払
  | "card" // カードの引き落とし
  | "tax" // 税金・社会保険
  | "other_out" // その他の出金 (相手先の書かれていない行、手数料など)
  | "loan_out" // 借入の返済 (利息込み)
  | "transfer"; // 自社の口座どうしの移動

/**
 * その月の数字の出どころ。
 * actual: 実績だけ / current: 今月 (今日までの実績＋残りはきよの予定) /
 * plan: きよの予定 / average: 予定が無いので直近3か月の実績の中央値。
 * 借入の返済は、どの見込みでも返済予定表 (無ければ前回と同じ額) を使う。
 */
export type CashTrendBasis = "actual" | "current" | "plan" | "average";

export type CashMonthlyTrendRow = {
  ym: string;
  /** 今月は今日まで。 */
  partial: boolean;
  basis: CashTrendBasis;
  flows: Record<Exclude<CashFlowKind, "transfer">, number>;
  inflow: number;
  outflow: number;
  /** 月末 (今月は今日) の全口座の残高。 */
  endBalance: number;
  /** 月末の借入残高 (元金)。 */
  loanOutstanding: number;
  /** 口座の残高 − 借入残高。 */
  netOfLoans: number;
  /**
   * 前の月末からの残高の増減と、入り − 出の差。0 でなければ、口座間の移動の片側が
   * 記録されていない (きよのシートの書き漏れ) などで、明細が足りていない。
   */
  unexplained: number;
};
