// freee 会計の口座明細を、毎日「現金と融資」(/admin/cash) の表へ取り込む。
// 正本は pwa/manual/6-13-cash-and-loans-spec.md。
//
// まさ依頼 (2026-09-05)「dailyでfreee会計から新しい取引結果を追加できるようになってる?」
//
// 読み取りだけ。freee へは一切書き込まない (6-10「freee mutationの安全境界」と同じ立場)。
//
// 二重に増やさないための境界:
//   口座ごとの `cash_accounts.freee_sync_from` 以降の実績だけを取る。それより前は、
//   きよのスプレッドシートから取り込んだ行をそのまま残す。同じ日を両方から取ると、
//   同じ取引が2行に見えてしまうため。
//
// 取り込んだ行は source='freee' / source_row=<freeeの明細ID> を持ち、(account_id, source,
// source_row) が一意なので、同じ明細を何度取り込んでも増えない。
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchWalletTxns, type WalletTxn } from "@/lib/finance/freee-cash-balances";
import { fetchWalletablesFull } from "@/lib/finance/freee-reconciliation-client";
import { invalidateCashAndLoansCache } from "@/lib/finance/cash-and-loans";

export const runtime = "nodejs";
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };
/** 既定でさかのぼる日数。freee 側で後から明細が増える (同期の遅れ) ぶんを拾い直す。 */
const DEFAULT_LOOKBACK_DAYS = 14;

function todayJst(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function yen(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function text(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

type AccountRow = {
  account_id: string;
  short_name: string;
  freee_walletable_type: string | null;
  freee_walletable_id: number | null;
  freee_sync_from: string | null;
};

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = !!cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (!isCron) {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.errorResponse;
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const lookbackDays = Number(url.searchParams.get("days") ?? DEFAULT_LOOKBACK_DAYS) || DEFAULT_LOOKBACK_DAYS;
  const today = todayJst();

  const supabase = createAdminClient();

  try {
    const { data: accountRows, error: accountError } = await supabase
      .from("cash_accounts")
      .select("account_id, short_name, freee_walletable_type, freee_walletable_id, freee_sync_from")
      .eq("is_active", true);
    if (accountError) throw new Error(accountError.message);
    const accounts = (accountRows ?? []) as AccountRow[];

    // freee 側の口座一覧。まだ結びついていない口座を人が見て決められるよう、必ず返す。
    const walletables = await fetchWalletablesFull();
    const freeeAccounts = walletables.map((w) => ({
      id: w.id ?? null,
      type: String(w.type ?? ""),
      name: w.name || w.walletable_name || w.bank_name || null,
      syncedBalance: w.last_balance == null ? null : yen(w.last_balance),
      syncStatus: w.sync_status ?? null,
      lastSyncedAt: w.last_synced_at ?? null,
      /** AMD OS 側のどの口座と結びついているか。 */
      linkedTo: accounts.find(
        (a) => a.freee_walletable_id != null && String(a.freee_walletable_id) === String(w.id ?? ""),
      )?.account_id ?? null,
    }));

    const linked = accounts.filter((a) => a.freee_walletable_id != null && a.freee_sync_from);
    if (linked.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          skipped: "freee と結びついた口座がまだ無い",
          hint: "cash_accounts の freee_walletable_type / freee_walletable_id / freee_sync_from を入れると取り込みが始まる",
          freeeAccounts,
          osAccounts: accounts.map((a) => ({ accountId: a.account_id, shortName: a.short_name, linkedFreeeId: a.freee_walletable_id, syncFrom: a.freee_sync_from })),
        },
        { headers: NO_STORE },
      );
    }

    // 取り込みの開始日は「口座ごとの freee_sync_from」と「今日からさかのぼった日」の遅い方。
    const windowStart = linked.reduce((earliest, a) => {
      const from = a.freee_sync_from as string;
      const lookback = addDays(today, -lookbackDays);
      const start = from > lookback ? from : lookback;
      return start < earliest ? start : earliest;
    }, "9999-12-31");

    const txns = await fetchWalletTxns(windowStart, today);

    const report: Record<string, unknown>[] = [];
    for (const account of linked) {
      const from = account.freee_sync_from as string;
      const start = from > addDays(today, -lookbackDays) ? from : addDays(today, -lookbackDays);
      const mine = txns
        .filter(
          (t: WalletTxn) =>
            String(t.walletable_id ?? "") === String(account.freee_walletable_id) &&
            String(t.walletable_type ?? "") === String(account.freee_walletable_type ?? "") &&
            String(t.date ?? "") >= start,
        )
        .sort((a, b) => {
          const d = String(a.date ?? "").localeCompare(String(b.date ?? ""));
          return d !== 0 ? d : Number(a.id ?? 0) - Number(b.id ?? 0);
        });

      const seqByDate = new Map<string, number>();
      const records = mine.map((t) => {
        const date = String(t.date ?? "");
        const seq = seqByDate.get(date) ?? 0;
        seqByDate.set(date, seq + 1);
        // freee は入金/出金を entry_side で分け、金額はどちらも正の数で返す。
        const amount = Math.abs(yen(t.amount));
        const isIncome = String(t.entry_side ?? "") === "income";
        return {
          account_id: account.account_id,
          entry_date: date,
          seq,
          counterparty: text(t.description),
          transfer_name: null,
          withdrawal: isIncome ? 0 : amount,
          deposit: isIncome ? amount : 0,
          balance: t.balance == null ? null : yen(t.balance),
          category: null,
          target_month: null,
          note: null,
          is_planned: false,
          source: "freee",
          source_row: Number(t.id ?? 0) || null,
          updated_at: new Date().toISOString(),
        };
      }).filter((r) => r.source_row != null && r.entry_date);

      if (!dryRun && records.length > 0) {
        for (let i = 0; i < records.length; i += 500) {
          const { error } = await supabase
            .from("cash_ledger_entries")
            .upsert(records.slice(i, i + 500), { onConflict: "account_id,source,source_row" });
          if (error) throw new Error(`${account.short_name}: ${error.message}`);
        }
        await supabase
          .from("cash_accounts")
          .update({ freee_synced_at: new Date().toISOString() })
          .eq("account_id", account.account_id);
      }

      report.push({
        accountId: account.account_id,
        shortName: account.short_name,
        from: start,
        to: today,
        found: records.length,
        firstDate: records[0]?.entry_date ?? null,
        lastDate: records[records.length - 1]?.entry_date ?? null,
      });
    }

    if (!dryRun) invalidateCashAndLoansCache();
    return NextResponse.json({ ok: true, dryRun, today, windowStart, report, freeeAccounts }, { headers: NO_STORE });
  } catch (cause) {
    console.error("[cron freee-cash-ledger-sync]", cause);
    return NextResponse.json(
      { ok: false, error: cause instanceof Error ? cause.message : "freee cash ledger sync failed" },
      { status: 500, headers: NO_STORE },
    );
  }
}
