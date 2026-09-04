// きよの Google スプレッドシート「収支」から、口座の入出金を取り込む。
// 正本は pwa/manual/6-13-cash-and-loans-spec.md。
//
// 移植は一度きりではない。きよがスプシ側で過去分を直すことがあるので、
// タブ単位でまるごと読み直して入れ替えられるようにしてある。
// 取り込んだ行は source = 'sheet:<タブ名>' が付き、OS 上で手入力した行 (source='manual') は消さない。
//
// 認証は admin セッション、または CRON_SECRET (えいみが curl で叩く用)。
// Google 認証は既存の GOOGLE_OAUTH_* を使う (src/lib/sources/google.ts)。
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import { invalidateCashAndLoansCache } from "@/lib/finance/cash-and-loans";

export const runtime = "nodejs";
export const maxDuration = 120;

const NO_STORE = { "Cache-Control": "no-store" };

/** きよのスプシ。env が無いときのための既定値も持つ (このIDはまさから直接渡されたもの)。 */
const DEFAULT_SPREADSHEET_ID = "1Q8cEnutfJzgdEXKIRDb4wUGAe6ON1MMiiz3irCrj1YA";

type ColumnMap = {
  date: number;
  transferName?: number;
  /** 相手先の列。備考しか無いタブ (商工中金) では省く。 */
  counterparty?: number;
  withdrawal: number;
  deposit: number;
  balance: number;
  category?: number;
  targetMonth?: number;
  note: number;
};

type SheetSource = {
  sheet: string;
  accountId: string;
  /** 日付に年が書かれていないタブの、先頭行が属する年。月が戻ったら翌年として数える。 */
  baseYear: number;
  cols: ColumnMap;
  /** この文字がセルに出たら、そこから下は明細ではないので読まない (商工中金の返済予定表など)。 */
  stopAt?: string;
  /**
   * 12月の次に1月が来たら年を繰り上げるか。1年ぶんで閉じているタブ (年ごとの PayPay) では
   * false にする。途中で月が戻る行が1つでもあると、そこから先が丸ごと翌年になってしまうため。
   */
  allowYearRollover?: boolean;
  /** 日付が空の行を、直前の行と同じ日として扱うか (商工中金の会費行がこの形)。 */
  carryDate?: boolean;
  /**
   * 日付がこの月数より大きく戻ったら、そこから下は別の表とみなして読まない。
   * 2025年_PayPay は明細の下に、同じ形の別ブロックがぶら下がっている
   * (2025年10月の次の行が2025年2月から始まる)。読み込むと残高が合わなくなる。
   */
  stopWhenDateGoesBackMonths?: number;
};

/**
 * タブごとの列の位置。2025年と2026年で1列ずれているので、まとめて1つの定義にはできない。
 * 列番号は 0 始まり (A列=0)。
 */
const SHEET_SOURCES: SheetSource[] = [
  {
    sheet: "2026年_PayPay", accountId: "paypay", baseYear: 2026,
    cols: { date: 1, transferName: 3, counterparty: 4, withdrawal: 5, deposit: 6, balance: 7, category: 8, targetMonth: 9, note: 10 },
  },
  {
    sheet: "2025年_PayPay", accountId: "paypay", baseYear: 2025,
    cols: { date: 1, transferName: 2, counterparty: 3, withdrawal: 4, deposit: 5, balance: 6, category: 7, targetMonth: 8, note: 9 },
    stopWhenDateGoesBackMonths: 3,
  },
  {
    // 相手先の列が無く、備考にだけ書いてある。下部に返済予定表が続くので「返済日」で打ち切る
    // (打ち切らないと予定表の金額を明細として二重に取り込む)。
    sheet: "商工中金", accountId: "shokochukin", baseYear: 2026,
    cols: { date: 2, withdrawal: 3, deposit: 4, balance: 5, note: 6 },
    stopAt: "返済日",
    allowYearRollover: true,
    carryDate: true,
  },
  {
    sheet: "UFJ通帳", accountId: "ufj", baseYear: 2023,
    cols: { date: 0, counterparty: 2, withdrawal: 3, deposit: 4, balance: 5, note: 1 },
  },
];

function yen(value: unknown): number {
  const s = String(value ?? "").replace(/[¥￥,\s]/g, "");
  if (!s || s === "-") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function text(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

/**
 * スプシの日付セルを 'YYYY-MM-DD' にする。タブによって書き方が違う。
 *   「1/19 (月)」「1/5」 … 年が無い。月が前の行より戻ったら翌年として数える。
 *   「2023.9.15」 … 年つき。
 * 読めない行 (「5/〇(〇)」のような未定) は null を返して読み飛ばす。
 */
function parseDate(
  raw: unknown,
  state: { year: number; lastMonth: number },
  allowYearRollover: boolean,
): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  const dotted = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (dotted) {
    const [, y, m, d] = dotted;
    state.year = Number(y);
    state.lastMonth = Number(m);
    return `${y}-${String(Number(m)).padStart(2, "0")}-${String(Number(d)).padStart(2, "0")}`;
  }

  const md = s.match(/^(\d{1,2})\/(\d{1,2})/);
  if (!md) return null;
  const month = Number(md[1]);
  const day = Number(md[2]);
  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) return null;
  // 12月の次に1月が来たら年が変わったとみなす。年ごとに閉じたタブでは繰り上げない。
  if (allowYearRollover && month < state.lastMonth - 6) state.year += 1;
  state.lastMonth = month;
  return `${state.year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayJst(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = !!cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (!isCron) {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.errorResponse;
  }

  const url = new URL(req.url);
  const spreadsheetId = url.searchParams.get("spreadsheetId") || process.env.AMD_FINANCE_REFERENCE_SHEET_ID || DEFAULT_SPREADSHEET_ID;
  const only = url.searchParams.get("sheet");
  const dryRun = url.searchParams.get("dryRun") === "1";
  const targets = only ? SHEET_SOURCES.filter((s) => s.sheet === only) : SHEET_SOURCES;
  if (targets.length === 0) {
    return NextResponse.json(
      { ok: false, error: `sheet=${only} は取り込み対象に入っていない`, known: SHEET_SOURCES.map((s) => s.sheet) },
      { status: 400, headers: NO_STORE },
    );
  }

  const googleAuth = await getGoogleAuthAsync();
  if (!googleAuth) {
    return NextResponse.json({ ok: false, error: "GOOGLE_OAUTH_* が未設定" }, { status: 500, headers: NO_STORE });
  }

  const sheets = google.sheets({ version: "v4", auth: googleAuth });
  const supabase = createAdminClient();
  const today = todayJst();
  const report: Record<string, unknown>[] = [];

  try {
    for (const target of targets) {
      const values = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${target.sheet}!A1:AZ2000`,
      });
      const rows = values.data.values ?? [];
      const state = { year: target.baseYear, lastMonth: 0 };
      const seqByDate = new Map<string, number>();
      const records: Record<string, unknown>[] = [];
      let skipped = 0;

      let stopped = false;
      let carried: string | null = null;
      let stoppedAtRow: number | null = null;
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] ?? [];
        if (target.stopAt && row.some((cellValue) => String(cellValue ?? "").trim() === target.stopAt)) stopped = true;
        if (stopped) continue;
        const cell = (index: number | undefined) => (index == null ? "" : row[index]);
        const rawDate = String(cell(target.cols.date) ?? "").trim();
        const parsed = parseDate(rawDate, state, target.allowYearRollover === true);
        // 日付が空でも、直前の行と同じ日として続く表がある (商工中金の会費行)。
        const entryDate: string | null = parsed ?? (target.carryDate && !rawDate ? carried : null);
        if (!entryDate) {
          if (rawDate) skipped += 1;
          continue;
        }
        // 日付が大きく戻ったら、そこから下は別の表。
        if (target.stopWhenDateGoesBackMonths && carried && entryDate < carried) {
          const back = (Number(carried.slice(0, 4)) * 12 + Number(carried.slice(5, 7)))
            - (Number(entryDate.slice(0, 4)) * 12 + Number(entryDate.slice(5, 7)));
          if (back >= target.stopWhenDateGoesBackMonths) {
            stopped = true;
            stoppedAtRow = i + 1;
            continue;
          }
        }
        carried = entryDate;
        const withdrawal = yen(cell(target.cols.withdrawal));
        const deposit = yen(cell(target.cols.deposit));
        const balanceRaw = String(cell(target.cols.balance) ?? "").trim();
        const counterparty = text(cell(target.cols.counterparty));
        const note = text(cell(target.cols.note));
        // 金額も残高も相手先も無い行は、見出しや空行。
        if (!withdrawal && !deposit && !balanceRaw && !counterparty && !note) continue;
        // 見出し行 (「対象」「備考」だけが入っている) を除く。
        if (!withdrawal && !deposit && !balanceRaw && counterparty === "対象") continue;
        if (String(cell(target.cols.date) ?? "").trim() === "取引日") continue;

        const seq = seqByDate.get(entryDate) ?? 0;
        seqByDate.set(entryDate, seq + 1);
        records.push({
          account_id: target.accountId,
          entry_date: entryDate,
          seq,
          counterparty,
          transfer_name: text(cell(target.cols.transferName)),
          withdrawal,
          deposit,
          balance: balanceRaw ? yen(balanceRaw) : null,
          category: text(cell(target.cols.category)),
          target_month: text(cell(target.cols.targetMonth)),
          note: note === counterparty ? null : note,
          is_planned: entryDate > today,
          source: `sheet:${target.sheet}`,
          source_row: i + 1,
        });
      }

      if (!dryRun) {
        // タブ単位でまるごと入れ替える。OS 上で手入力した行 (source='manual') は触らない。
        await supabase.from("cash_ledger_entries").delete().eq("source", `sheet:${target.sheet}`);
        for (let i = 0; i < records.length; i += 500) {
          const { error } = await supabase.from("cash_ledger_entries").insert(records.slice(i, i + 500));
          if (error) throw new Error(`${target.sheet}: ${error.message}`);
        }
      }
      report.push({
        sheet: target.sheet, accountId: target.accountId,
        sheetRows: rows.length, imported: records.length, skippedDateRows: skipped,
        stoppedAtRow,
        firstDate: records[0]?.entry_date ?? null,
        lastDate: records[records.length - 1]?.entry_date ?? null,
      });
    }

    if (!dryRun) {
      // 372 の初回移植で入れた行は、この取り込みが置き換える。
      await supabase.from("cash_ledger_entries").delete().eq("source", "sheet_import");
      invalidateCashAndLoansCache();
    }
    return NextResponse.json({ ok: true, dryRun, spreadsheetId, report }, { headers: NO_STORE });
  } catch (cause) {
    console.error("[admin cash-import-sheet]", cause);
    return NextResponse.json(
      { ok: false, error: cause instanceof Error ? cause.message : "import failed", report },
      { status: 500, headers: NO_STORE },
    );
  }
}
