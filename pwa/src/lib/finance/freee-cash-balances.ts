import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { freeeApi } from "@/lib/freee-client";

const ACCOUNT_NAME = "freee口座残高合計";
const FREEE_ACCOUNT_ID = "wallet_txns_balance_total";
const INCLUDED_WALLETABLE_TYPES = new Set(["bank_account", "wallet"]);
const EXCLUDED_WALLET_NAME_PATTERNS = [/振替勘定/];

type Walletable = {
  id?: number | string;
  type?: string;
  name?: string;
  walletable_name?: string;
  bank_name?: string;
};

type WalletTxn = {
  id?: number | string;
  date?: string;
  walletable_type?: string;
  walletable_id?: number | string;
  balance?: number | string;
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
  };
}
