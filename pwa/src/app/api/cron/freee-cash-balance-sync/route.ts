// freee 会計の口座残高から、月末の現金残高を毎日取り込む。
//
// まさ依頼 (2026-09-10)「freeeとOSが連携できてないんじゃないの?」
//
// 背景: 口座の取引明細 (/api/cron/freee-cash-ledger-sync) は毎日取り込めていたのに、
// 月末残高 (company_actual_monthly の cash_balance) を書くのは経営スコアの取り込みを
// 走らせたときだけで、自動実行が無かった。そのため2026年9月時点で残高が8月25日の
// 明細で止まり、9月の残高が8月と1円も同じになっていた。えいみOSスイートの
// 「AMD + 個人残高」はこの残高を実績として読むため、稼ぐペースを実態より悪く読む。
//
// 読み取りだけ。freee へは一切書き込まない (6-10「freee mutationの安全境界」と同じ立場)。
//
// 既定では直近4か月ぶんを書き直す。freee は後から明細が増えるので、当月だけ更新すると
// 締まったはずの前月の残高が古いまま残る。
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { addMonths, assertYm, syncFreeeCashBalances } from "@/lib/finance/freee-cash-balances";

export const runtime = "nodejs";
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };
/** 既定で書き直す月数 (当月を含む)。freee 側の明細の遅れを拾い直すため。 */
const DEFAULT_MONTHS = 4;

function currentYmJst(): string {
  const jst = new Date(Date.now() + 9 * 3_600_000).toISOString();
  return `${jst.slice(0, 4)}${jst.slice(5, 7)}`;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = !!cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (!isCron) {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.errorResponse;
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  try {
    const endYm = assertYm(url.searchParams.get("to") || currentYmJst(), "to");
    const startYm = assertYm(
      url.searchParams.get("from") || addMonths(endYm, -(DEFAULT_MONTHS - 1)),
      "from",
    );
    // 残高は「その月末までの最後の明細」で決まるので、さかのぼる明細の窓は
    // 取り込む最初の月より前から取る。手で過去分を埋めるときは historyFrom で広げる。
    const historyStartYm = assertYm(
      url.searchParams.get("historyFrom") || addMonths(startYm, -12),
      "historyFrom",
    );

    const supabase = createAdminClient();
    const result = await syncFreeeCashBalances(supabase, {
      startYm,
      endYm,
      historyStartYm,
      dryRun,
    });

    return NextResponse.json(
      {
        ok: true,
        dryRun,
        startYm: result.startYm,
        endYm: result.endYm,
        historyStartYm: result.historyStartYm,
        walletableCount: result.walletableCount,
        walletTxnCount: result.walletTxnCount,
        monthCount: result.rowCount,
        cashActualRowCount: result.cashActuals?.rowCount ?? 0,
        cashActualError: result.cashActualError,
        months: result.rows,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    console.error("[cron freee-cash-balance-sync]", cause);
    return NextResponse.json({ ok: false, error: cause }, { status: 500, headers: NO_STORE });
  }
}
