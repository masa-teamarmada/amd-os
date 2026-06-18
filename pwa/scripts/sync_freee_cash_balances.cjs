#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const crypto = require("crypto");
const path = require("path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const ACCOUNT_NAME = "freee口座残高合計";
const FREEE_ACCOUNT_ID = "wallet_txns_balance_total";
const INCLUDED_WALLETABLE_TYPES = new Set(["bank_account", "wallet"]);
const EXCLUDED_WALLET_NAME_PATTERNS = [/振替勘定/];

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function assertYm(ym, label) {
  if (!/^[0-9]{6}$/.test(String(ym))) throw new Error(`${label} must be YYYYMM`);
  return String(ym);
}

function ymToDate(ym) {
  return new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)) - 1, 1));
}

function dateToYm(date) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(ym, delta) {
  const date = ymToDate(ym);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return dateToYm(date);
}

function ymStart(ym) {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`;
}

function ymEnd(ym) {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(lastDay).padStart(2, "0")}`;
}

function monthRange(startYm, endYm) {
  const months = [];
  for (let ym = startYm; Number(ym) <= Number(endYm); ym = addMonths(ym, 1)) {
    months.push(ym);
  }
  return months;
}

function previousYmJst() {
  const nowJst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const date = new Date(Date.UTC(nowJst.getFullYear(), nowJst.getMonth() - 1, 1));
  return dateToYm(date);
}

function yen(value) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) {
    error.message = `${label}: ${error.message}`;
    throw error;
  }
  return data;
}

async function loadStoredFreeeToken(supabase) {
  const data = await must("select freee_oauth_tokens", supabase
    .from("freee_oauth_tokens")
    .select("refresh_token, company_id")
    .eq("token_key", "default")
    .maybeSingle());
  return {
    refreshToken: data?.refresh_token || process.env.FREEE_REFRESH_TOKEN || null,
    companyId: data?.company_id || process.env.FREEE_COMPANY_ID || null,
  };
}

async function refreshFreeeToken(supabase) {
  const clientId = process.env.FREEE_CLIENT_ID;
  const clientSecret = process.env.FREEE_CLIENT_SECRET;
  const stored = await loadStoredFreeeToken(supabase);
  if (!clientId || !clientSecret || !stored.refreshToken) {
    throw new Error("FREEE_CLIENT_ID / FREEE_CLIENT_SECRET / refresh token are required");
  }

  const res = await fetch("https://accounts.secure.freee.co.jp/public_api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: stored.refreshToken,
    }),
  });
  const body = await res.json().catch(async () => ({ error: await res.text() }));
  if (!res.ok || !body.access_token) {
    throw new Error(`freee token refresh failed: ${res.status} ${JSON.stringify(body).slice(0, 500)}`);
  }

  if (body.refresh_token) {
    await must("upsert freee_oauth_tokens", supabase.from("freee_oauth_tokens").upsert({
      token_key: "default",
      refresh_token: body.refresh_token,
      company_id: body.company_id ? String(body.company_id) : stored.companyId,
      scope: body.scope ?? null,
      external_cid: body.external_cid ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "token_key" }));
  }

  return {
    accessToken: body.access_token,
    companyId: body.company_id ? String(body.company_id) : stored.companyId,
  };
}

function freeeGetter(accessToken, companyId) {
  return async function freeeGet(pathname) {
    const separator = pathname.includes("?") ? "&" : "?";
    const companyParam = companyId && !pathname.includes("company_id=") ? `${separator}company_id=${encodeURIComponent(companyId)}` : "";
    const res = await fetch(`https://api.freee.co.jp${pathname}${companyParam}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(`freee GET ${pathname}: ${res.status} ${text.slice(0, 500)}`);
    return data;
  };
}

function walletableKey(type, id) {
  return `${type || ""}:${id || ""}`;
}

function walletableName(walletable) {
  if (!walletable) return null;
  return walletable.name || walletable.walletable_name || walletable.bank_name || walletable.type || null;
}

function isIncludedWallet(type, name) {
  if (!INCLUDED_WALLETABLE_TYPES.has(type)) return false;
  return !EXCLUDED_WALLET_NAME_PATTERNS.some((pattern) => pattern.test(name || ""));
}

async function fetchWalletables(freeeGet) {
  const data = await freeeGet("/api/1/walletables");
  const map = new Map();
  for (const walletable of data.walletables ?? []) {
    const key = walletableKey(walletable.type, walletable.id);
    map.set(key, walletable);
  }
  return map;
}

async function fetchWalletTxns(freeeGet, startDate, endDate) {
  const txns = [];
  const limit = 100;
  for (let offset = 0; offset < 5000; offset += limit) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      limit: String(limit),
      offset: String(offset),
    });
    const data = await freeeGet(`/api/1/wallet_txns?${params.toString()}`);
    const page = data.wallet_txns ?? [];
    txns.push(...page);
    if (page.length < limit) break;
  }
  return txns;
}

function buildMonthlyBalances(months, txns, walletables, historyStartDate, historyEndDate) {
  const sorted = txns
    .filter((txn) => txn.date && txn.walletable_type && txn.walletable_id != null && txn.balance != null)
    .sort((a, b) => {
      const dateCompare = String(a.date).localeCompare(String(b.date));
      if (dateCompare !== 0) return dateCompare;
      return Number(a.id ?? 0) - Number(b.id ?? 0);
    });

  const latestByWallet = new Map();
  let index = 0;
  const rows = [];

  for (const ym of months) {
    const endDate = ymEnd(ym);
    while (index < sorted.length && String(sorted[index].date) <= endDate) {
      const txn = sorted[index];
      const key = walletableKey(txn.walletable_type, txn.walletable_id);
      latestByWallet.set(key, txn);
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
        lastTxnDate: txn.date,
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

async function main() {
  const startYm = assertYm(argValue("start-ym") || "202601", "start-ym");
  const endYm = assertYm(argValue("end-ym") || previousYmJst(), "end-ym");
  const dryRun = process.argv.includes("--dry-run");
  if (Number(endYm) < Number(startYm)) throw new Error("end-ym must be >= start-ym");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are required");

  const months = monthRange(startYm, endYm);
  const historyStartYm = assertYm(argValue("history-start-ym") || addMonths(startYm, -12), "history-start-ym");
  const historyStartDate = ymStart(historyStartYm);
  const historyEndDate = ymEnd(endYm);
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { accessToken, companyId } = await refreshFreeeToken(supabase);
  const freeeGet = freeeGetter(accessToken, companyId);
  const [walletables, txns] = await Promise.all([
    fetchWalletables(freeeGet),
    fetchWalletTxns(freeeGet, historyStartDate, historyEndDate),
  ]);
  const rows = buildMonthlyBalances(months, txns, walletables, historyStartDate, historyEndDate);

  if (!dryRun) {
    await must("delete company_actual_monthly cash_balance", supabase
      .from("company_actual_monthly")
      .delete()
      .eq("scope", "company")
      .eq("category", "cash_balance")
      .eq("account_name", ACCOUNT_NAME)
      .in("ym", months));
    if (rows.length > 0) {
      await must("insert company_actual_monthly cash_balance", supabase.from("company_actual_monthly").insert(rows));
    }
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun,
    startYm,
    endYm,
    companyId,
    walletableCount: walletables.size,
    walletTxnCount: txns.length,
    rows: rows.map((row) => ({
      ym: row.ym,
      actual_amount_yen: row.actual_amount_yen,
      wallets: row.payload.wallets.map((wallet) => ({
        name: wallet.name,
        balance: wallet.balance,
        lastTxnDate: wallet.lastTxnDate,
      })),
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
