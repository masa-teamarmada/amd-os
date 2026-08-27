/**
 * きよ「00 お金の流れ」タブの集計。manual/6-11-kiyo-money-flow-spec.md が正本。
 *
 * 【データの出どころは freee会計だけ】
 * 売上・費用・入出金・残高のすべてを company_actual_monthly (= freee試算表と取引履歴の同期先)
 * から取る。OSの請求台帳 (billing_cycles) は手入力で進める前提のテーブルなので使わない。
 * 入力が止まると画面が実態とズレるため (2026-08-28 まさ指摘)。
 *
 * 【損益と現金を分ける】
 * 同じ月でも「事業のもうけ」と「口座の増減」は一致しない。入金が遅れて来る、口座から出るが
 * 費用でないもの (前年の税金・立替の返済・カードの引き落とし) がある、費用だがまだ口座から
 * 出ていないもの (翌月25日払いの役員報酬) がある。両方を並べて出す。
 */
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { currentYmJst } from "@/lib/finance/cash-anchor";
import type {
  KiyoMoneyFlowPeriodKind,
  KiyoMoneyFlowRange,
  KiyoMoneyFlowRevenueRow,
  KiyoMoneyFlowCostGroup,
  KiyoMoneyFlowCostRow,
  KiyoMoneyFlowMonthRow,
  KiyoMoneyFlowResult,
} from "@/lib/finance/kiyo-money-flow-types";

export type * from "@/lib/finance/kiyo-money-flow-types";

type ServiceClient = ReturnType<typeof createAdminClient>;

function ym(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^\d{6}$/.test(text) ? text : null;
}

function num(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function addMonthsYm(base: string, delta: number): string {
  const date = new Date(Date.UTC(Number(base.slice(0, 4)), Number(base.slice(4, 6)) - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function enumerateYms(startYm: string, endYm: string): string[] {
  const out: string[] = [];
  let cur = startYm;
  for (let i = 0; i < 240 && cur <= endYm; i += 1) {
    out.push(cur);
    cur = addMonthsYm(cur, 1);
  }
  return out;
}

function ymLabel(value: string): string {
  return `${value.slice(0, 4)}年${Number(value.slice(4, 6))}月`;
}

/** 役員報酬グループ。会社負担の社会保険料も役員・従業員の人件費としてここへ入れる */
const OFFICER_ACCOUNTS = new Set(["役員報酬", "法定福利費"]);
/** 税金グループ。法人税等の納付は費用でないのでここには入らない (試算表の租税公課だけ) */
const TAX_ACCOUNTS = new Set(["租税公課"]);
/** 営業外収益。「どこから入ってきたか」には混ぜない */
const OTHER_INCOME_ACCOUNTS = new Set(["受取利息", "雑収入"]);

const CASH_IN_CATEGORIES = new Set(["cash_inflow", "spot_income", "loan_disbursement"]);
const CASH_OUT_CATEGORIES = new Set([
  "cash_outflow",
  "spot_expense",
  "loan_payment",
  "loan_interest",
  "tax_payment_consumption",
  "tax_payment_corporate",
  "social_insurance",
]);

const SUMMARY_TEXT =
  "上の図は「事業のもうけ」。クライアントから入った売上が、メンバーへの報酬・役員報酬・会社の運営費にどう分かれて、いくら残ったかを見る。右の「口座のお金」は別の話で、実際に口座が増えたか減ったか。売上が立った月と入金の月がずれるので、この2つは一致しない。";
const NOTE_TEXT =
  "数字はfreee会計に計上済みのものだけ。請求書をまだ出していない月の売上は立っていない。1円単位の帳簿はfreeeで見る。";

async function resolveRange(
  db: ServiceClient,
  period: KiyoMoneyFlowPeriodKind,
  requestedYm: string | null,
): Promise<{ range: KiyoMoneyFlowRange; warnings: string[] }> {
  const warnings: string[] = [];
  const nowYm = String(currentYmJst());

  if (period === "month") {
    const target = requestedYm ?? nowYm;
    return {
      range: { kind: "month", label: ymLabel(target), startYm: target, endYm: target, months: [target], seasonSource: null },
      warnings,
    };
  }
  if (period === "all") {
    return { range: { kind: "all", label: "ぜんぶ", startYm: null, endYm: null, months: [], seasonSource: null }, warnings };
  }

  const { data, error } = await db
    .from("value_plan_cycles")
    .select("period_start_ym, period_end_ym")
    .eq("project_id", "p00")
    .eq("status", "active")
    .order("period_start_ym", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0] as { period_start_ym: string | null; period_end_ym: string | null } | undefined;
  const startYm = ym(row?.period_start_ym);
  const endYm = ym(row?.period_end_ym);
  if (startYm && endYm) {
    const cappedEnd = endYm > nowYm ? nowYm : endYm;
    return {
      range: { kind: "season", label: "今シーズン", startYm, endYm: cappedEnd, months: enumerateYms(startYm, cappedEnd), seasonSource: "amd_plan_cycle" },
      warnings,
    };
  }
  warnings.push("AMD自身のシーズン計画 (p00) が見つからないため、今シーズンの代わりに今月を出しています。");
  return {
    range: { kind: "season", label: "今シーズン", startYm: nowYm, endYm: nowYm, months: [nowYm], seasonSource: "fallback_month" },
    warnings,
  };
}

type ActualRow = { ym: string; category: string | null; account_name: string | null; actual_amount_yen: number | string | null; freee_partner_id: string | null };

async function computeInternal(period: KiyoMoneyFlowPeriodKind, requestedYm: string | null): Promise<KiyoMoneyFlowResult> {
  const db = createAdminClient();
  const { range, warnings } = await resolveRange(db, period, requestedYm);

  let query = db
    .from("company_actual_monthly")
    .select("ym, category, account_name, actual_amount_yen, freee_partner_id");
  if (range.startYm) query = query.gte("ym", range.startYm);
  if (range.endYm) query = query.lte("ym", range.endYm);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as ActualRow[];

  const months = range.months.length > 0
    ? range.months
    : [...new Set(rows.map((row) => row.ym))].sort();
  const monthSet = new Set(months);
  const inRange = (row: ActualRow) => monthSet.has(row.ym);

  // ---- 売上 (どこから) ----
  const revenueMap = new Map<string, KiyoMoneyFlowRevenueRow>();
  for (const row of rows) {
    if (row.category !== "revenue_partner" || !inRange(row)) continue;
    const name = row.account_name ?? "取引先未設定";
    const current = revenueMap.get(name) ?? { name, amountYen: 0, partnerId: row.freee_partner_id ?? null };
    current.amountYen += num(row.actual_amount_yen);
    revenueMap.set(name, current);
  }
  const revenueByPartner = [...revenueMap.values()].filter((row) => row.amountYen > 0).sort((a, b) => b.amountYen - a.amountYen);
  const revenueTotalYen = revenueByPartner.reduce((sum, row) => sum + row.amountYen, 0);

  const otherIncomeYen = rows
    .filter((row) => row.category === "revenue" && OTHER_INCOME_ACCOUNTS.has(row.account_name ?? "") && inRange(row))
    .reduce((sum, row) => sum + num(row.actual_amount_yen), 0);

  // ---- 費用 (何に使ったか) ----
  const officer: KiyoMoneyFlowCostRow[] = [];
  const member: KiyoMoneyFlowCostRow[] = [];
  const opex: KiyoMoneyFlowCostRow[] = [];
  const tax: KiyoMoneyFlowCostRow[] = [];
  const pushInto = (list: KiyoMoneyFlowCostRow[], name: string, amountYen: number) => {
    const found = list.find((row) => row.name === name);
    if (found) found.amountYen += amountYen;
    else list.push({ name, amountYen });
  };
  for (const row of rows) {
    if (!inRange(row)) continue;
    const amount = num(row.actual_amount_yen);
    if (amount === 0) continue;
    const name = row.account_name ?? "その他";
    if (row.category === "cost_member") pushInto(member, name === "仕入高" ? "メンバーへの外注費" : name, amount);
    else if (row.category === "fixed_cost") {
      if (OFFICER_ACCOUNTS.has(name)) pushInto(officer, name, amount);
      else if (TAX_ACCOUNTS.has(name)) pushInto(tax, name, amount);
      else pushInto(opex, name, amount);
    }
  }
  const sortRows = (list: KiyoMoneyFlowCostRow[]) => list.sort((a, b) => b.amountYen - a.amountYen);
  const sum = (list: KiyoMoneyFlowCostRow[]) => list.reduce((total, row) => total + row.amountYen, 0);

  const allGroups: KiyoMoneyFlowCostGroup[] = [
    { key: "member", label: "メンバーへの報酬", amountYen: sum(member), rows: sortRows(member), note: "PJで働いたメンバーへの外注費。freee会計に計上済みのぶん。" },
    { key: "officer", label: "役員報酬", amountYen: sum(officer), rows: sortRows(officer), note: "役員報酬の総額と、会社が負担する社会保険料。翌月25日払いの給与を確定して会計連携すると、その月ぶんが入る。" },
    { key: "opex", label: "会社の運営費", amountYen: sum(opex), rows: sortRows(opex), note: "家賃、通信費、ツール、交通費など。" },
    { key: "tax", label: "税金", amountYen: sum(tax), rows: sortRows(tax), note: "印紙税など、費用として落ちる税金。法人税の納付そのものは費用ではないのでここには入らない。" },
  ];
  const costGroups = allGroups.filter((group) => group.amountYen > 0 || group.key === "officer");

  const costTotalYen = costGroups.reduce((total, group) => total + group.amountYen, 0);
  const profitYen = revenueTotalYen + otherIncomeYen - costTotalYen;

  // ---- 口座のお金 ----
  const cashRows = rows.filter((row) => inRange(row) && (CASH_IN_CATEGORIES.has(row.category ?? "") || CASH_OUT_CATEGORIES.has(row.category ?? "")));
  const inflowYen = cashRows.filter((row) => CASH_IN_CATEGORIES.has(row.category ?? "")).reduce((total, row) => total + num(row.actual_amount_yen), 0);
  const outflowYen = cashRows.filter((row) => CASH_OUT_CATEGORIES.has(row.category ?? "")).reduce((total, row) => total + num(row.actual_amount_yen), 0);
  const cashMonths = new Set(cashRows.map((row) => row.ym));
  const cashComplete = months.length > 0 && months.every((month) => cashMonths.has(month));

  const balanceRows = rows.filter((row) => row.category === "cash_balance" && inRange(row)).sort((a, b) => b.ym.localeCompare(a.ym));
  const latestBalance = balanceRows[0];

  // ---- 月ごとの推移 ----
  const monthly: KiyoMoneyFlowMonthRow[] = months.map((month) => {
    const monthRows = rows.filter((row) => row.ym === month);
    const revenue = monthRows.filter((row) => row.category === "revenue_partner").reduce((total, row) => total + num(row.actual_amount_yen), 0)
      + monthRows.filter((row) => row.category === "revenue" && OTHER_INCOME_ACCOUNTS.has(row.account_name ?? "")).reduce((total, row) => total + num(row.actual_amount_yen), 0);
    const cost = monthRows.filter((row) => row.category === "fixed_cost" || row.category === "cost_member").reduce((total, row) => total + num(row.actual_amount_yen), 0);
    const cashIn = monthRows.filter((row) => CASH_IN_CATEGORIES.has(row.category ?? "")).reduce((total, row) => total + num(row.actual_amount_yen), 0);
    const cashOut = monthRows.filter((row) => CASH_OUT_CATEGORIES.has(row.category ?? "")).reduce((total, row) => total + num(row.actual_amount_yen), 0);
    const hasFixedCost = monthRows.some((row) => row.category === "fixed_cost");
    const hasOfficer = monthRows.some((row) => row.category === "fixed_cost" && row.account_name === "役員報酬");
    return {
      ym: month,
      revenueYen: revenue,
      costYen: cost,
      profitYen: revenue - cost,
      cashInYen: cashIn,
      cashOutYen: cashOut,
      cashNetYen: cashIn - cashOut,
      officerPayMissing: hasFixedCost && !hasOfficer,
    };
  });

  const missingOfficerMonths = monthly.filter((row) => row.officerPayMissing).map((row) => row.ym);
  if (missingOfficerMonths.length > 0) {
    warnings.push(
      `${missingOfficerMonths.map(ymLabel).join("・")}分の役員報酬がまだ会計に入っていません。翌月25日払いの給与を確定して会計連携すると入ります。それまでこの月のもうけは実際より大きく出ます。`,
    );
  }
  const unassigned = revenueByPartner.find((row) => row.name === "取引先未設定");
  if (unassigned) {
    warnings.push(`売上のうち${Math.round(unassigned.amountYen / 10000)}万円は、freeeの取引に取引先が入っていないため相手先が出ていません。`);
  }
  if (!cashComplete && months.length > 0) {
    warnings.push("口座の取引履歴がそろっていない月があるため、右の「口座のお金」はこの期間の一部だけです。");
  }

  return {
    range: { ...range, months },
    pl: { revenueTotalYen, revenueByPartner, otherIncomeYen, costTotalYen, costGroups, profitYen },
    cash: {
      inflowYen,
      outflowYen,
      netYen: inflowYen - outflowYen,
      balanceYen: latestBalance ? num(latestBalance.actual_amount_yen) : null,
      balanceYm: latestBalance?.ym ?? null,
      complete: cashComplete,
    },
    monthly: months.length > 1 ? monthly : [],
    summaryText: SUMMARY_TEXT,
    note: NOTE_TEXT,
    warnings,
    computedAtIso: new Date().toISOString(),
  };
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { value: KiyoMoneyFlowResult; storedAt: number }>();
const inflight = new Map<string, Promise<KiyoMoneyFlowResult>>();

export async function getKiyoMoneyFlow(period: KiyoMoneyFlowPeriodKind, requestedYm: string | null, force = false): Promise<KiyoMoneyFlowResult> {
  const key = `${period}:${requestedYm ?? ""}`;
  const cached = cache.get(key);
  if (!force && cached && Date.now() - cached.storedAt < CACHE_TTL_MS) return cached.value;
  const pending = inflight.get(key);
  if (!force && pending) return pending;

  const request = computeInternal(period, requestedYm)
    .then((value) => {
      cache.set(key, { value, storedAt: Date.now() });
      return value;
    })
    .finally(() => {
      if (inflight.get(key) === request) inflight.delete(key);
    });
  inflight.set(key, request);
  return request;
}

export function invalidateKiyoMoneyFlowCache(): void {
  cache.clear();
  inflight.clear();
}
