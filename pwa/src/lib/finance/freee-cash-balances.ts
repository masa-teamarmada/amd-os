import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { freeeApi } from "@/lib/freee-client";

const ACCOUNT_NAME = "freee口座残高合計";
const FREEE_ACCOUNT_ID = "wallet_txns_balance_total";
const INCLUDED_WALLETABLE_TYPES = new Set(["bank_account", "wallet"]);
const EXCLUDED_WALLET_NAME_PATTERNS = [/振替勘定/];

export type Walletable = {
  id?: number | string;
  type?: string;
  name?: string;
  walletable_name?: string;
  bank_name?: string;
};

export type WalletTxn = {
  id?: number | string;
  date?: string;
  walletable_type?: string;
  walletable_id?: number | string;
  balance?: number | string;
  amount?: number | string;
  entry_side?: string;
  deal_id?: number | string;
  transfer_id?: number | string;
  transaction_id?: number | string;
  type?: string;
  wallet_txn_type?: string;
  description?: string;
};

type FreeeAccountItem = {
  id?: number | string;
  name?: string;
};

export type FreeeDealDetail = {
  account_item_id?: number | string;
  account_item_name?: string;
  amount?: number | string;
};

type FreeeDealPayment = {
  id?: number | string;
  date?: string;
  amount?: number | string;
  from_walletable_type?: string;
  from_walletable_id?: number | string;
  to_walletable_type?: string;
  to_walletable_id?: number | string;
};

type FreeeDeal = {
  id?: number | string;
  type?: string;
  amount?: number | string;
  details?: FreeeDealDetail[];
  payments?: FreeeDealPayment[];
};

export type CashActualCategory =
  | "cash_inflow"
  | "cash_outflow"
  | "loan_disbursement"
  | "loan_payment"
  | "loan_interest"
  | "tax_payment_consumption"
  | "tax_payment_corporate"
  | "social_insurance"
  | "spot_income"
  | "spot_expense";

type CashActualDbRow = {
  ym: string;
  scope: "company";
  project_id: null;
  category: CashActualCategory;
  account_name: string;
  actual_amount_yen: number;
  freee_account_item_id: string;
  freee_partner_id: null;
  source_ref: string;
  raw_hash: string;
  payload: Record<string, unknown>;
};

type CashBalanceDbRow = {
  ym: string;
  scope: "company";
  project_id: null;
  category: "cash_balance";
  account_name: string;
  actual_amount_yen: number;
  freee_account_item_id: string;
  freee_partner_id: null;
  source_ref: string;
  raw_hash: string;
  payload: Record<string, unknown>;
};

export type FreeeCashBalanceSummaryRow = {
  ym: string;
  actual_amount_yen: number;
  walletCount: number;
  latestTxnDate: string | null;
};

export type SyncFreeeCashBalancesResult = {
  ok: true;
  dryRun: boolean;
  startYm: string;
  endYm: string;
  historyStartYm: string;
  walletableCount: number;
  walletTxnCount: number;
  rowCount: number;
  rows: FreeeCashBalanceSummaryRow[];
  cashActuals: SyncFreeeCashActualsResult | null;
  cashActualError: string | null;
};

export type FreeeCashActualSummaryRow = {
  ym: string;
  category: CashActualCategory;
  actual_amount_yen: number;
  transactionCount: number;
};

export type SyncFreeeCashActualsResult = {
  ok: true;
  startYm: string;
  endYm: string;
  historyStartYm: string;
  walletTxnCount: number;
  classifiedTxnCount: number;
  unclassifiedTxnCount: number;
  transferTxnCount: number;
  rowCount: number;
  rows: FreeeCashActualSummaryRow[];
};

export type SyncFreeeCashBalancesOptions = {
  startYm: string;
  endYm: string;
  historyStartYm?: string;
  dryRun?: boolean;
};

export function assertYm(ym: string, label: string): string {
  if (!/^[0-9]{6}$/.test(String(ym))) throw new Error(`${label} must be YYYYMM`);
  return String(ym);
}

export function addMonths(ym: string, delta: number): string {
  const date = ymToDate(ym);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return dateToYm(date);
}

function ymToDate(ym: string): Date {
  return new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)) - 1, 1));
}

function dateToYm(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ymStart(ym: string): string {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`;
}

function ymEnd(ym: string): string {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(lastDay).padStart(2, "0")}`;
}

function monthRange(startYm: string, endYm: string): string[] {
  const months: string[] = [];
  for (let ym = startYm; Number(ym) <= Number(endYm); ym = addMonths(ym, 1)) {
    months.push(ym);
  }
  return months;
}

function yen(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function walletableKey(type: unknown, id: unknown): string {
  return `${type || ""}:${id || ""}`;
}

function walletableName(walletable: Walletable | undefined): string | null {
  if (!walletable) return null;
  return walletable.name || walletable.walletable_name || walletable.bank_name || walletable.type || null;
}

function isIncludedWallet(type: string, name: string | null): boolean {
  if (!INCLUDED_WALLETABLE_TYPES.has(type)) return false;
  return !EXCLUDED_WALLET_NAME_PATTERNS.some((pattern) => pattern.test(name || ""));
}

async function fetchWalletables(): Promise<Map<string, Walletable>> {
  const data = await freeeApi("GET", "/api/1/walletables") as { walletables?: Walletable[] };
  const map = new Map<string, Walletable>();
  for (const walletable of data.walletables ?? []) {
    map.set(walletableKey(walletable.type, walletable.id), walletable);
  }
  return map;
}

async function fetchWalletTxns(startDate: string, endDate: string): Promise<WalletTxn[]> {
  const txns: WalletTxn[] = [];
  const limit = 100;
  for (let offset = 0; offset < 5000; offset += limit) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      limit: String(limit),
      offset: String(offset),
    });
    const data = await freeeApi("GET", `/api/1/wallet_txns?${params.toString()}`) as { wallet_txns?: WalletTxn[] };
    const page = data.wallet_txns ?? [];
    txns.push(...page);
    if (page.length < limit) break;
  }
  return txns;
}

function buildMonthlyBalances(
  months: string[],
  txns: WalletTxn[],
  walletables: Map<string, Walletable>,
  historyStartDate: string,
  historyEndDate: string
): CashBalanceDbRow[] {
  const sorted = txns
    .filter((txn) => txn.date && txn.walletable_type && txn.walletable_id != null && txn.balance != null)
    .sort((a, b) => {
      const dateCompare = String(a.date).localeCompare(String(b.date));
      if (dateCompare !== 0) return dateCompare;
      return Number(a.id ?? 0) - Number(b.id ?? 0);
    });

  const latestByWallet = new Map<string, WalletTxn>();
  let index = 0;
  const rows: CashBalanceDbRow[] = [];

  for (const ym of months) {
    const endDate = ymEnd(ym);
    while (index < sorted.length && String(sorted[index].date) <= endDate) {
      const txn = sorted[index];
      latestByWallet.set(walletableKey(txn.walletable_type, txn.walletable_id), txn);
      index += 1;
    }

    const wallets = [];
    for (const [key, txn] of latestByWallet.entries()) {
      const walletable = walletables.get(key);
      const type = String(txn.walletable_type || walletable?.type || "");
      const balance = yen(txn.balance);
      const name = walletableName(walletable) || String(txn.walletable_id);
      if (!isIncludedWallet(type, name)) continue;
      wallets.push({
        key,
        type,
        id: String(txn.walletable_id),
        name,
        balance,
        lastTxnDate: txn.date ?? null,
        lastTxnId: txn.id != null ? String(txn.id) : null,
      });
    }
    wallets.sort((a, b) => a.name.localeCompare(b.name, "ja"));
    const total = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
    const payload = {
      source: "freee.wallet_txns",
      monthEnd: endDate,
      includedWalletableTypes: Array.from(INCLUDED_WALLETABLE_TYPES),
      transactionWindow: { startDate: historyStartDate, endDate: historyEndDate },
      wallets,
    };
    rows.push({
      ym,
      scope: "company",
      project_id: null,
      category: "cash_balance",
      account_name: ACCOUNT_NAME,
      actual_amount_yen: total,
      freee_account_item_id: FREEE_ACCOUNT_ID,
      freee_partner_id: null,
      source_ref: `freee:wallet_txns_balance:${ym}`,
      raw_hash: stableHash(payload),
      payload,
    });
  }

  return rows;
}

function summarizeRows(rows: CashBalanceDbRow[]): FreeeCashBalanceSummaryRow[] {
  return rows.map((row) => {
    const wallets = Array.isArray(row.payload.wallets) ? row.payload.wallets as Array<{ lastTxnDate?: string | null }> : [];
    const latestTxnDate = wallets
      .map((wallet) => wallet.lastTxnDate ?? null)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
    return {
      ym: row.ym,
      actual_amount_yen: row.actual_amount_yen,
      walletCount: wallets.length,
      latestTxnDate,
    };
  });
}

function dateYm(value: unknown): string | null {
  const date = String(value ?? "");
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  return match ? `${match[1]}${match[2]}` : null;
}

function amountYen(value: unknown): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(Math.abs(amount)) : null;
}

function walletTxnDirection(txn: WalletTxn): "income" | "expense" | null {
  const side = String(txn.entry_side ?? "").trim().toLowerCase();
  if (["income", "deposit", "credit"].includes(side)) return "income";
  if (["expense", "withdrawal", "withdraw", "debit"].includes(side)) return "expense";
  return null;
}

function isTransferWalletTxn(txn: WalletTxn): boolean {
  if (txn.transfer_id != null) return true;
  // 摘要は転記しない。ここではfreeeが明示した口座振替を除外する判定にだけ使う。
  const kind = `${txn.type ?? ""} ${txn.wallet_txn_type ?? ""} ${txn.description ?? ""}`.toLowerCase();
  return /(^|[_\s-])transfer([_\s-]|$)|振替/.test(kind);
}

function accountCategory(name: string, direction: "income" | "expense"): CashActualCategory | null {
  const label = name.replace(/\s+/g, "");
  if (/借入金/.test(label)) return direction === "income" ? "loan_disbursement" : "loan_payment";
  if (/(支払利息|利息割引料|借入.*利息)/.test(label)) return "loan_interest";
  if (/(未払消費税|消費税等|仮受消費税)/.test(label)) return "tax_payment_consumption";
  if (/(未払法人税|法人税等|法人税)/.test(label)) return "tax_payment_corporate";
  if (/(社会保険|健康保険|厚生年金|雇用保険|労働保険)/.test(label)) return "social_insurance";
  if (direction === "income" && /(雑収入|受取利息|受取配当|固定資産売却益)/.test(label)) return "spot_income";
  if (direction === "expense" && /(雑損失|寄付金|固定資産売却損|固定資産除却損)/.test(label)) return "spot_expense";
  return null;
}

function accountNameForDetail(detail: FreeeDealDetail, accountItems: Map<string, string>): string | null {
  if (detail.account_item_name) return String(detail.account_item_name);
  if (detail.account_item_id == null) return null;
  return accountItems.get(String(detail.account_item_id)) ?? null;
}

export type MatchedDealPayment = {
  key: string;
  dealId: string;
  date: string;
  amount: number;
  direction: "income" | "expense";
  walletKey: string | null;
  details: FreeeDealDetail[];
  dealAmount: number;
};

function dealPaymentWalletKey(payment: FreeeDealPayment): string | null {
  const type = payment.from_walletable_type ?? payment.to_walletable_type;
  const id = payment.from_walletable_id ?? payment.to_walletable_id;
  return type && id != null ? walletableKey(type, id) : null;
}

function dealPayments(deals: FreeeDeal[]): MatchedDealPayment[] {
  return deals.flatMap((deal) => {
    const direction = String(deal.type ?? "").toLowerCase() as "income" | "expense";
    if (direction !== "income" && direction !== "expense") return [];
    const dealId = String(deal.id ?? "");
    if (!dealId) return [];
    const details = Array.isArray(deal.details) ? deal.details : [];
    const dealAmount = amountYen(deal.amount) ?? details.reduce((sum, detail) => sum + (amountYen(detail.amount) ?? 0), 0);
    return (deal.payments ?? []).flatMap((payment, index) => {
      const date = String(payment.date ?? "");
      const amount = amountYen(payment.amount);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || amount == null || amount === 0) return [];
      return [{
        key: String(payment.id ?? `${dealId}:${index}`),
        dealId,
        date,
        amount,
        direction,
        walletKey: dealPaymentWalletKey(payment),
        details,
        dealAmount,
      }];
    });
  });
}

function paymentCategoryAmounts(
  payment: MatchedDealPayment,
  accountItems: Map<string, string>
): Map<Exclude<CashActualCategory, "cash_inflow" | "cash_outflow">, number> {
  const categoryAmounts = new Map<Exclude<CashActualCategory, "cash_inflow" | "cash_outflow">, number>();
  const totalDetails = payment.details.reduce((sum, detail) => sum + (amountYen(detail.amount) ?? 0), 0);
  const baseAmount = totalDetails > 0 ? totalDetails : payment.dealAmount;
  if (baseAmount <= 0) return categoryAmounts;
  const ratio = payment.amount / baseAmount;
  let principalAmount = 0;
  let interestAmount = 0;

  for (const detail of payment.details) {
    const detailAmount = amountYen(detail.amount) ?? 0;
    if (detailAmount <= 0) continue;
    const name = accountNameForDetail(detail, accountItems);
    if (!name) continue;
    const category = accountCategory(name, payment.direction);
    if (!category || category === "cash_inflow" || category === "cash_outflow") continue;
    if (category === "loan_disbursement" || category === "loan_payment") {
      principalAmount += detailAmount;
      continue;
    }
    if (category === "loan_interest") {
      interestAmount += detailAmount;
      continue;
    }
    categoryAmounts.set(category, (categoryAmounts.get(category) ?? 0) + Math.round(detailAmount * ratio));
  }

  // 返済額は元本と利息を含む実際の口座流出を 1 回だけ置く。利息は内訳表示専用。
  if (principalAmount > 0) {
    const paymentCategory = payment.direction === "income" ? "loan_disbursement" : "loan_payment";
    categoryAmounts.set(paymentCategory, Math.round((principalAmount + interestAmount) * ratio));
  }
  if (interestAmount > 0) {
    categoryAmounts.set("loan_interest", Math.round(interestAmount * ratio));
  }
  return categoryAmounts;
}

async function fetchFreeeDeals(startDate: string, endDate: string): Promise<FreeeDeal[]> {
  const deals: FreeeDeal[] = [];
  const limit = 100;
  for (let offset = 0; offset < 5000; offset += limit) {
    const params = new URLSearchParams({
      start_issue_date: startDate,
      end_issue_date: endDate,
      limit: String(limit),
      offset: String(offset),
    });
    const data = await freeeApi("GET", `/api/1/deals?${params.toString()}`) as { deals?: FreeeDeal[] };
    const page = data.deals ?? [];
    deals.push(...page);
    if (page.length < limit) break;
  }
  return deals;
}

async function fetchFreeeAccountItems(): Promise<Map<string, string>> {
  const data = await freeeApi("GET", "/api/1/account_items") as { account_items?: FreeeAccountItem[] };
  const accountItems = new Map<string, string>();
  for (const item of data.account_items ?? []) {
    if (item.id != null && item.name) accountItems.set(String(item.id), String(item.name));
  }
  return accountItems;
}

const CASH_ACTUAL_ACCOUNT_NAMES: Record<CashActualCategory, string> = {
  cash_inflow: "freee取引履歴の入金",
  cash_outflow: "freee取引履歴の支払い",
  loan_disbursement: "freee取引履歴の融資実行",
  loan_payment: "freee取引履歴の借入返済",
  loan_interest: "freee取引履歴の返済利息",
  tax_payment_consumption: "freee取引履歴の消費税納付",
  tax_payment_corporate: "freee取引履歴の法人税納付",
  social_insurance: "freee取引履歴の社会保険料",
  spot_income: "freee取引履歴の臨時収入",
  spot_expense: "freee取引履歴の臨時支出",
};

export function buildFreeeCashActualRows(
  months: string[],
  txns: WalletTxn[],
  walletables: Map<string, Walletable>,
  payments: MatchedDealPayment[],
  accountItems: Map<string, string>,
  transactionWindow: { startDate: string; endDate: string }
): { rows: CashActualDbRow[]; result: Omit<SyncFreeeCashActualsResult, "ok" | "startYm" | "endYm" | "historyStartYm"> } {
  const monthsSet = new Set(months);
  const usedPayments = new Set<string>();
  const seenTxnIds = new Set<string>();
  const byDealId = new Map<string, MatchedDealPayment[]>();
  for (const payment of payments) {
    const list = byDealId.get(payment.dealId) ?? [];
    list.push(payment);
    byDealId.set(payment.dealId, list);
  }
  const categoriesByYm = new Map<string, Map<CashActualCategory, { amount: number; transactionCount: number }>>();
  const statsByYm = new Map<string, { walletTxnCount: number; classifiedTxnCount: number; unclassifiedTxnCount: number; transferTxnCount: number; matchedDealPaymentCount: number }>();
  const add = (ym: string, category: CashActualCategory, amount: number, count = 1) => {
    const categories = categoriesByYm.get(ym) ?? new Map<CashActualCategory, { amount: number; transactionCount: number }>();
    const current = categories.get(category) ?? { amount: 0, transactionCount: 0 };
    current.amount += Math.round(amount);
    current.transactionCount += count;
    categories.set(category, current);
    categoriesByYm.set(ym, categories);
  };
  const stat = (ym: string) => {
    const current = statsByYm.get(ym) ?? { walletTxnCount: 0, classifiedTxnCount: 0, unclassifiedTxnCount: 0, transferTxnCount: 0, matchedDealPaymentCount: 0 };
    statsByYm.set(ym, current);
    return current;
  };

  for (const txn of txns) {
    const ym = dateYm(txn.date);
    if (!ym || !monthsSet.has(ym)) continue;
    const walletable = walletables.get(walletableKey(txn.walletable_type, txn.walletable_id));
    const walletType = String(txn.walletable_type ?? walletable?.type ?? "");
    if (!isIncludedWallet(walletType, walletableName(walletable))) continue;
    const txnId = String(txn.id ?? `${txn.date}:${txn.walletable_type}:${txn.walletable_id}:${txn.amount ?? ""}:${txn.entry_side ?? ""}`);
    if (seenTxnIds.has(txnId)) continue;
    seenTxnIds.add(txnId);
    const summary = stat(ym);
    summary.walletTxnCount += 1;
    const direction = walletTxnDirection(txn);
    const amount = amountYen(txn.amount);
    if (!direction || amount == null || amount === 0) {
      summary.unclassifiedTxnCount += 1;
      continue;
    }
    if (isTransferWalletTxn(txn)) {
      summary.transferTxnCount += 1;
      continue;
    }

    add(ym, direction === "income" ? "cash_inflow" : "cash_outflow", amount);
    const txnWalletKey = walletableKey(txn.walletable_type, txn.walletable_id);
    const directCandidates = txn.deal_id != null ? byDealId.get(String(txn.deal_id)) ?? [] : [];
    const candidates = (directCandidates.length > 0 ? directCandidates : payments)
      .filter((payment) => !usedPayments.has(payment.key))
      .filter((payment) => payment.date === txn.date && payment.amount === amount && payment.direction === direction)
      .filter((payment) => !payment.walletKey || payment.walletKey === txnWalletKey);
    const payment = candidates.length === 1 ? candidates[0] : null;
    if (!payment) {
      summary.unclassifiedTxnCount += 1;
      continue;
    }
    usedPayments.add(payment.key);
    summary.matchedDealPaymentCount += 1;
    const classified = paymentCategoryAmounts(payment, accountItems);
    if (classified.size === 0) {
      summary.unclassifiedTxnCount += 1;
      continue;
    }
    summary.classifiedTxnCount += 1;
    for (const [category, categoryAmount] of classified.entries()) {
      if (categoryAmount > 0) add(ym, category, categoryAmount);
    }
  }

  const rows: CashActualDbRow[] = [];
  for (const ym of months) {
    const categories = categoriesByYm.get(ym) ?? new Map<CashActualCategory, { amount: number; transactionCount: number }>();
    const summary = stat(ym);
    // 毎回2行を保存して、片側が0円でも「取引履歴による実績CFを同期済み」と判別できるようにする。
    for (const category of ["cash_inflow", "cash_outflow"] as CashActualCategory[]) {
      if (!categories.has(category)) categories.set(category, { amount: 0, transactionCount: 0 });
    }
    const summaryPayload = {
      source: "freee.wallet_txns+deals",
      classificationBasis: "freee deal details.account_item_id matched to account_items; wallet transfers excluded",
      transactionWindow,
      walletTxnCount: summary.walletTxnCount,
      classifiedTxnCount: summary.classifiedTxnCount,
      unclassifiedTxnCount: summary.unclassifiedTxnCount,
      transferTxnCount: summary.transferTxnCount,
      matchedDealPaymentCount: summary.matchedDealPaymentCount,
    };
    for (const [category, value] of categories.entries()) {
      const payload = { ...summaryPayload, category, transactionCount: value.transactionCount, actualAmountYen: value.amount };
      rows.push({
        ym,
        scope: "company",
        project_id: null,
        category,
        account_name: CASH_ACTUAL_ACCOUNT_NAMES[category],
        actual_amount_yen: value.amount,
        freee_account_item_id: `wallet_txns_cash_actual:${category}`,
        freee_partner_id: null,
        source_ref: `freee:wallet_txns_cash_actual:${ym}`,
        raw_hash: stableHash(payload),
        payload,
      });
    }
  }

  const summaryRows = rows.map((row) => ({
    ym: row.ym,
    category: row.category,
    actual_amount_yen: row.actual_amount_yen,
    transactionCount: Number(row.payload.transactionCount ?? 0),
  }));
  return {
    rows,
    result: {
      walletTxnCount: Array.from(statsByYm.values()).reduce((sum, value) => sum + value.walletTxnCount, 0),
      classifiedTxnCount: Array.from(statsByYm.values()).reduce((sum, value) => sum + value.classifiedTxnCount, 0),
      unclassifiedTxnCount: Array.from(statsByYm.values()).reduce((sum, value) => sum + value.unclassifiedTxnCount, 0),
      transferTxnCount: Array.from(statsByYm.values()).reduce((sum, value) => sum + value.transferTxnCount, 0),
      rowCount: rows.length,
      rows: summaryRows,
    },
  };
}

async function syncFreeeCashActuals(
  supabase: SupabaseClient,
  options: { startYm: string; endYm: string; historyStartYm: string; historyStartDate: string; historyEndDate: string; dryRun?: boolean },
  txns: WalletTxn[],
  walletables: Map<string, Walletable>
): Promise<SyncFreeeCashActualsResult> {
  const months = monthRange(options.startYm, options.endYm);
  const [deals, accountItems] = await Promise.all([
    fetchFreeeDeals(options.historyStartDate, options.historyEndDate),
    fetchFreeeAccountItems(),
  ]);
  const built = buildFreeeCashActualRows(
    months,
    txns,
    walletables,
    dealPayments(deals),
    accountItems,
    { startDate: options.historyStartDate, endDate: options.historyEndDate }
  );
  if (!options.dryRun) {
    const sourceRefs = months.map((ym) => `freee:wallet_txns_cash_actual:${ym}`);
    const { error: deleteError } = await supabase
      .from("company_actual_monthly")
      .delete()
      .eq("scope", "company")
      .in("source_ref", sourceRefs);
    if (deleteError) throw new Error(`delete company_actual_monthly cash actuals: ${deleteError.message}`);
    if (built.rows.length > 0) {
      const { error: insertError } = await supabase.from("company_actual_monthly").insert(built.rows);
      if (insertError) throw new Error(`insert company_actual_monthly cash actuals: ${insertError.message}`);
    }
  }
  return {
    ok: true,
    startYm: options.startYm,
    endYm: options.endYm,
    historyStartYm: options.historyStartYm,
    ...built.result,
  };
}

export async function syncFreeeCashBalances(
  supabase: SupabaseClient,
  options: SyncFreeeCashBalancesOptions
): Promise<SyncFreeeCashBalancesResult> {
  const startYm = assertYm(options.startYm, "startYm");
  const endYm = assertYm(options.endYm, "endYm");
  if (Number(endYm) < Number(startYm)) throw new Error("endYm must be >= startYm");

  const months = monthRange(startYm, endYm);
  const historyStartYm = assertYm(options.historyStartYm || addMonths(startYm, -12), "historyStartYm");
  const historyStartDate = ymStart(historyStartYm);
  const historyEndDate = ymEnd(endYm);
  const [walletables, txns] = await Promise.all([
    fetchWalletables(),
    fetchWalletTxns(historyStartDate, historyEndDate),
  ]);
  const rows = buildMonthlyBalances(months, txns, walletables, historyStartDate, historyEndDate);
  let cashActuals: SyncFreeeCashActualsResult | null = null;
  let cashActualError: string | null = null;

  if (!options.dryRun) {
    const { error: deleteError } = await supabase
      .from("company_actual_monthly")
      .delete()
      .eq("scope", "company")
      .eq("category", "cash_balance")
      .eq("account_name", ACCOUNT_NAME)
      .in("ym", months);
    if (deleteError) throw new Error(`delete company_actual_monthly cash_balance: ${deleteError.message}`);

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("company_actual_monthly").insert(rows);
      if (insertError) throw new Error(`insert company_actual_monthly cash_balance: ${insertError.message}`);
    }
  }

  try {
    cashActuals = await syncFreeeCashActuals(supabase, {
      startYm,
      endYm,
      historyStartYm,
      historyStartDate,
      historyEndDate,
      dryRun: options.dryRun,
    }, txns, walletables);
  } catch (error) {
    // 口座残高を止めずに、勘定科目未取得などはD-12をpartialとして明示する。
    cashActualError = error instanceof Error ? error.message : String(error);
  }

  return {
    ok: true,
    dryRun: !!options.dryRun,
    startYm,
    endYm,
    historyStartYm,
    walletableCount: walletables.size,
    walletTxnCount: txns.length,
    rowCount: rows.length,
    rows: summarizeRows(rows),
    cashActuals,
    cashActualError,
  };
}
