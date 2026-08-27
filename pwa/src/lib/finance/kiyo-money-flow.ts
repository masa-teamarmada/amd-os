/**
 * きよ「00 お金の流れ」タブの集計。manual/6-11-kiyo-money-flow-spec.md が正本。
 *
 * 【シーズン境界について (仕様との差分)】
 * 正本は「シーズン境界は season-finance.ts の既存定義を使う」とするが、そのファイルには
 * 境界を返す関数が無い (別財布按分のヘルパーのみ)。この OS の「シーズン」は
 * value_plan_cycles.period_start_ym〜period_end_ym という PJ 単位の概念で、PJごとに
 * 期間がバラバラ (例: p25 は 202605〜202703、p19 は 202601〜202612) なので、
 * 会社全体で1本の「今シーズン」を取れる既存定義は存在しない。
 * この画面は会社全体の集計であり、AMD 自身も `projects.project_id = "p00"` として
 * 1本の value_plan_cycles (シーズン計画) を持つため、p00 の active シーズンを
 * 会社全体の「今シーズン」境界として採用する。p00 の active シーズンが無い月は
 * 今月の範囲へフォールバックし、warnings で画面に注記する。
 */
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { currentYmJst } from "@/lib/finance/cash-anchor";
import { expandExtraRevenueCash, type ExtraRevenueEntry } from "@/lib/finance/extra-revenue";
import type {
  KiyoMoneyFlowPeriod,
  KiyoMoneyFlowRange,
  KiyoMoneyFlowInflowProject,
  KiyoMoneyFlowMemberRow,
  KiyoMoneyFlowMonthlyRow,
  KiyoMoneyFlowObligationRow,
  KiyoMoneyFlowOpexRow,
  KiyoMoneyFlowLoanRow,
  KiyoMoneyFlowOutflowCategory,
  KiyoMoneyFlowResult,
} from "@/lib/finance/kiyo-money-flow-types";

export type {
  KiyoMoneyFlowPeriod,
  KiyoMoneyFlowRange,
  KiyoMoneyFlowInflowMonth,
  KiyoMoneyFlowInflowProject,
  KiyoMoneyFlowMemberRow,
  KiyoMoneyFlowMonthlyRow,
  KiyoMoneyFlowObligationRow,
  KiyoMoneyFlowOpexRow,
  KiyoMoneyFlowLoanRow,
  KiyoMoneyFlowOutflowCategory,
  KiyoMoneyFlowResult,
} from "@/lib/finance/kiyo-money-flow-types";

type ServiceClient = ReturnType<typeof createAdminClient>;

function ym(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^\d{6}$/.test(text) ? text : null;
}

function num(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** JST の YYYYMM に変換 (payment_confirmed_at / paid_at のような timestamptz 用)。 */
function ymFromTimestampJst(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** YYYY-MM-DD (date型) 用。timezone変換は不要。 */
function ymFromDateText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}${match[2]}` : null;
}

function inRange(target: string, startYm: string | null, endYm: string | null): boolean {
  if (startYm && target < startYm) return false;
  if (endYm && target > endYm) return false;
  return true;
}

function monthsBetweenInclusive(start: string, end: string): number {
  const ys = Number(start.slice(0, 4));
  const ms = Number(start.slice(4, 6));
  const ye = Number(end.slice(0, 4));
  const me = Number(end.slice(4, 6));
  return (ye - ys) * 12 + (me - ms) + 1;
}

function addMonthsYm(base: string, delta: number): string {
  const y = Number(base.slice(0, 4));
  const m = Number(base.slice(4, 6));
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** PostgREST の1レスポンス上限 (既定1000行) を跨いでも取りこぼさないためのページ読み。 */
const PAGE_SIZE = 1000;
async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function resolveRange(
  db: ServiceClient,
  period: KiyoMoneyFlowPeriod,
): Promise<{ range: KiyoMoneyFlowRange; warnings: string[] }> {
  const warnings: string[] = [];
  const nowYm = String(currentYmJst());

  if (period === "month") {
    return { range: { kind: "month", label: "今月", startYm: nowYm, endYm: nowYm, seasonSource: null }, warnings };
  }
  if (period === "all") {
    return { range: { kind: "all", label: "ぜんぶ", startYm: null, endYm: null, seasonSource: null }, warnings };
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
    return { range: { kind: "season", label: "今シーズン", startYm, endYm, seasonSource: "amd_plan_cycle" }, warnings };
  }
  warnings.push(
    "AMD自身のシーズン計画 (p00) が見つからないため、今シーズンの代わりに今月の範囲を使っています。",
  );
  return { range: { kind: "season", label: "今シーズン", startYm: nowYm, endYm: nowYm, seasonSource: "fallback_month" }, warnings };
}

const SUMMARY_TEXT =
  "クライアントから入ったお金のうち約65%は、そのPJで働いたメンバーへの報酬になる。残りで会社の家賃やツール、社会保険・税金、借入の返済を払い、余った分がAMDの財布に貯まる。";
const NOTE_TEXT =
  "この画面はお金の流れを掴むためのざっくり全体図。数字は万円で丸めていて、1円単位の正確な帳簿はfreeeで見る。";

const OPEX_EXCLUDED_ACCOUNTS = new Set(["役員報酬", "法定福利費", "租税公課"]);

/** 元利均等返済の残高。k回払い終えた後の残債務。 */
function equalPaymentRemainingBalance(principal: number, annualRate: number, totalPayments: number, paymentsMade: number): number {
  const k = Math.max(0, Math.min(paymentsMade, totalPayments));
  const r = annualRate / 12;
  if (r <= 0) return Math.max(0, Math.round(principal * (1 - k / totalPayments)));
  const growth = Math.pow(1 + r, totalPayments);
  const growthK = Math.pow(1 + r, k);
  const remaining = (principal * (growth - growthK)) / (growth - 1);
  return Math.max(0, Math.round(remaining));
}

async function computeInternal(period: KiyoMoneyFlowPeriod): Promise<KiyoMoneyFlowResult> {
  const db = createAdminClient();
  const { range, warnings } = await resolveRange(db, period);
  const nowYm = String(currentYmJst());

  type ProjectRow = { project_id: string; project_name: string | null; client_name: string | null };
  type BillingRow = {
    project_id: string;
    ym: string;
    budget_yen: number | string | null;
    budget_reported_amount: number | string | null;
    payment_confirmed_at: string | null;
    invoice_ym: string | null;
    extra_revenue_json: ExtraRevenueEntry[] | null;
  };
  type SettlementRow = { member_id: string | null; amount_yen: number | string | null; paid_on: string | null };
  type ActualMonthlyRow = { ym: string; category: string | null; account_name: string | null; actual_amount_yen: number | string | null };

  const [
    projectsRes,
    billingRows,
    settlementRows,
    actualMonthlyRows,
    obligationsRes,
    recurringRes,
    loanInputsRes,
    membersRes,
  ] = await Promise.all([
    db.from("projects").select("project_id, project_name, client_name"),
    fetchAllRows<BillingRow>((from, to) =>
      db
        .from("billing_cycles")
        .select("project_id, ym, budget_yen, budget_reported_amount, payment_confirmed_at, invoice_ym, extra_revenue_json")
        .range(from, to),
    ),
    fetchAllRows<SettlementRow>((from, to) => db.from("member_payout_settlements").select("member_id, amount_yen, paid_on").range(from, to)),
    fetchAllRows<ActualMonthlyRow>((from, to) => db.from("company_actual_monthly").select("ym, category, account_name, actual_amount_yen").range(from, to)),
    db.from("company_payment_obligations").select("title, category, paid_amount_yen, amount_yen, paid_at, expected_payment_ym").eq("status", "paid"),
    db.from("company_finance_recurring_items").select("id, item_kind, category, display_name, vendor_name, amount_yen, status, start_ym, end_ym").eq("status", "active"),
    db.from("company_budget_inputs").select("label, amount_yen, payload").eq("input_kind", "loan"),
    db.from("members").select("member_id, member_name"),
  ]);
  for (const res of [projectsRes, obligationsRes, recurringRes, loanInputsRes, membersRes]) {
    if (res.error) throw res.error;
  }

  const projects = (projectsRes.data ?? []) as ProjectRow[];
  const projectById = new Map(projects.map((p) => [p.project_id, p]));
  const memberNameById = new Map(((membersRes.data ?? []) as Array<{ member_id: string; member_name: string | null }>).map((m) => [m.member_id, m.member_name ?? m.member_id]));

  // ---- 入ってきたお金: PJ別 ----
  const inflowByProject = new Map<string, KiyoMoneyFlowInflowProject>();
  const ensureProjectInflow = (projectId: string): KiyoMoneyFlowInflowProject => {
    let row = inflowByProject.get(projectId);
    if (!row) {
      const project = projectById.get(projectId);
      row = {
        projectId,
        projectName: project?.project_name ?? projectId,
        clientName: project?.client_name ?? null,
        contractYen: 0,
        extraYen: 0,
        totalYen: 0,
        months: [],
      };
      inflowByProject.set(projectId, row);
    }
    return row;
  };

  for (const row of billingRows) {
    if (!row.payment_confirmed_at) continue;
    const confirmedYm = ymFromTimestampJst(row.payment_confirmed_at);
    if (!confirmedYm || !inRange(confirmedYm, range.startYm, range.endYm)) continue;
    const reported = num(row.budget_reported_amount);
    const budgetYen = num(row.budget_yen);
    const amount = reported > 0 ? reported : budgetYen > 0 ? Math.round(budgetYen / 0.65) : 0;
    if (amount <= 0) continue;
    const bucket = ensureProjectInflow(row.project_id);
    bucket.contractYen += amount;
    bucket.months.push({ ym: row.ym, amountYen: amount, kind: "contract", confirmedAt: row.payment_confirmed_at });
  }

  const extraRevenueSourceRows = billingRows
    .filter((row) => Array.isArray(row.extra_revenue_json) && row.extra_revenue_json.length > 0)
    .map((row) => ({ project_id: row.project_id, ym: row.ym, invoice_ym: row.invoice_ym, extra_revenue_json: row.extra_revenue_json }));
  const expandedExtra = expandExtraRevenueCash(extraRevenueSourceRows, {
    minYm: range.startYm ? Number(range.startYm) : undefined,
    maxYm: range.endYm ? Number(range.endYm) : undefined,
  });
  for (const item of expandedExtra) {
    const itemYm = String(item.ym);
    const bucket = ensureProjectInflow(item.projectId);
    bucket.extraYen += item.amount;
    bucket.months.push({ ym: itemYm, amountYen: item.amount, kind: "extra", confirmedAt: null });
  }

  for (const bucket of inflowByProject.values()) {
    bucket.totalYen = bucket.contractYen + bucket.extraYen;
    bucket.months.sort((a, b) => a.ym.localeCompare(b.ym));
  }
  const inflowProjects = [...inflowByProject.values()]
    .filter((row) => row.totalYen > 0)
    .sort((a, b) => b.totalYen - a.totalYen);
  const inflowTotalYen = inflowProjects.reduce((sum, row) => sum + row.totalYen, 0);

  // ---- 使ったお金: メンバーへの報酬 (実振込) ----
  const settlementsInRange = settlementRows.filter((row) => {
    const paidYm = ymFromDateText(row.paid_on);
    return paidYm && inRange(paidYm, range.startYm, range.endYm) && row.member_id;
  });
  const memberTotals = new Map<string, number>();
  for (const row of settlementsInRange) {
    const memberId = String(row.member_id);
    memberTotals.set(memberId, (memberTotals.get(memberId) ?? 0) + num(row.amount_yen));
  }

  let memberBreakdownRows: Array<{ project_id: string; ym: string; member_id: string; total_pay: number }> = [];
  if (memberTotals.size > 0) {
    let query = db
      .from("monthly_reward_payout")
      .select("project_id, ym, member_id, total_pay")
      .in("member_id", [...memberTotals.keys()]);
    if (range.startYm) query = query.gte("ym", range.startYm);
    if (range.endYm) query = query.lte("ym", range.endYm);
    const { data, error } = await query;
    if (error) throw error;
    memberBreakdownRows = (data ?? []) as typeof memberBreakdownRows;
  }

  const memberRows: KiyoMoneyFlowMemberRow[] = [...memberTotals.entries()]
    .map(([memberId, amountYen]) => ({
      memberId,
      memberName: memberNameById.get(memberId) ?? memberId,
      amountYen,
      projectBreakdown: memberBreakdownRows
        .filter((row) => row.member_id === memberId)
        .map((row) => ({
          projectId: row.project_id,
          projectName: projectById.get(row.project_id)?.project_name ?? row.project_id,
          ym: row.ym,
          totalPayYen: num(row.total_pay),
        }))
        .sort((a, b) => b.ym.localeCompare(a.ym)),
    }))
    .sort((a, b) => b.amountYen - a.amountYen);
  const memberRewardTotalYen = memberRows.reduce((sum, row) => sum + row.amountYen, 0);

  // ---- company_actual_monthly (fixed_cost / cash_balance) ----
  const actualMonthly = actualMonthlyRows;

  const fixedCostInRange = actualMonthly.filter((row) => row.category === "fixed_cost" && inRange(row.ym, range.startYm, range.endYm));

  // 役員報酬: 月別
  const executiveByYm = new Map<string, number>();
  for (const row of fixedCostInRange) {
    if (row.account_name !== "役員報酬") continue;
    executiveByYm.set(row.ym, (executiveByYm.get(row.ym) ?? 0) + num(row.actual_amount_yen));
  }
  const executiveRows: KiyoMoneyFlowMonthlyRow[] = [...executiveByYm.entries()]
    .map(([ym, amountYen]) => ({ ym, amountYen }))
    .sort((a, b) => a.ym.localeCompare(b.ym));
  const executiveTotalYen = executiveRows.reduce((sum, row) => sum + row.amountYen, 0);

  // 租税公課 (社会保険・税金の一部)
  const taxRows: KiyoMoneyFlowObligationRow[] = [];
  for (const row of fixedCostInRange) {
    if (row.account_name !== "租税公課") continue;
    const amountYen = num(row.actual_amount_yen);
    if (amountYen === 0) continue;
    taxRows.push({ title: `租税公課 (${row.ym.slice(0, 4)}年${row.ym.slice(4, 6)}月)`, date: null, amountYen, source: "tax_fixed_cost" });
  }

  // 会社の運営費: fixed_cost から 役員報酬/法定福利費/租税公課 を除く、科目別合計
  const opexByAccount = new Map<string, number>();
  for (const row of fixedCostInRange) {
    const accountName = row.account_name ?? "その他";
    if (OPEX_EXCLUDED_ACCOUNTS.has(accountName)) continue;
    opexByAccount.set(accountName, (opexByAccount.get(accountName) ?? 0) + num(row.actual_amount_yen));
  }
  const opexRows: KiyoMoneyFlowOpexRow[] = [...opexByAccount.entries()]
    .map(([accountName, amountYen]) => ({ accountName, amountYen }))
    .filter((row) => row.amountYen !== 0)
    .sort((a, b) => b.amountYen - a.amountYen);
  const opexTotalYen = opexRows.reduce((sum, row) => sum + row.amountYen, 0);

  // ---- 社会保険・税金: company_payment_obligations (status='paid') ----
  type ObligationRow = { title: string | null; category: string | null; paid_amount_yen: number | string | null; amount_yen: number | string | null; paid_at: string | null; expected_payment_ym: string | null };
  const obligations = (obligationsRes.data ?? []) as ObligationRow[];
  for (const row of obligations) {
    const paidYm = ymFromTimestampJst(row.paid_at) ?? ym(row.expected_payment_ym);
    if (!paidYm || !inRange(paidYm, range.startYm, range.endYm)) continue;
    const amountYen = num(row.paid_amount_yen) || num(row.amount_yen);
    if (amountYen === 0) continue;
    taxRows.push({ title: row.title ?? "支払義務", date: row.paid_at ? row.paid_at.slice(0, 10) : null, amountYen, source: "obligation" });
  }
  taxRows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const socialInsuranceTaxTotalYen = taxRows.reduce((sum, row) => sum + row.amountYen, 0);

  // ---- 借入の返済: company_finance_recurring_items (loan_payment) ----
  type RecurringRow = {
    id: string;
    item_kind: string | null;
    category: string | null;
    display_name: string | null;
    vendor_name: string | null;
    amount_yen: number | string | null;
    status: string | null;
    start_ym: string | null;
    end_ym: string | null;
  };
  const recurringItems = (recurringRes.data ?? []) as RecurringRow[];
  const loanRows: KiyoMoneyFlowLoanRow[] = [];
  for (const item of recurringItems) {
    const isLoan = item.item_kind === "loan" || item.category === "loan_payment";
    if (!isLoan) continue;
    const monthlyAmountYen = num(item.amount_yen);
    if (monthlyAmountYen <= 0) continue;
    const itemStart = ym(item.start_ym);
    const itemEnd = ym(item.end_ym);
    const windowStart = range.startYm && itemStart ? (range.startYm > itemStart ? range.startYm : itemStart) : range.startYm ?? itemStart;
    const windowEnd = [range.endYm, itemEnd, nowYm].filter((v): v is string => Boolean(v)).sort().shift() ?? nowYm;
    if (!windowStart || windowStart > windowEnd) continue;
    const monthsCounted = monthsBetweenInclusive(windowStart, windowEnd);
    if (monthsCounted <= 0) continue;
    const amountYen = monthlyAmountYen * monthsCounted;
    loanRows.push({
      vendorName: item.vendor_name || item.display_name || "借入先未設定",
      monthlyAmountYen,
      monthsCounted,
      amountYen,
    });
  }
  const loanPaymentTotalYen = loanRows.reduce((sum, row) => sum + row.amountYen, 0);

  const outflowCategories: KiyoMoneyFlowOutflowCategory[] = [
    {
      key: "member_reward",
      label: "メンバーへの報酬",
      totalYen: memberRewardTotalYen,
      rows: memberRows,
      note: "銀行口座から実際に振り込まれた記録だけを数える。PJ別のめやすは発生ベースのため振込額とは月ズレする。",
    },
    {
      key: "executive_pay",
      label: "役員報酬",
      totalYen: executiveTotalYen,
      rows: executiveRows,
      note: "freee仕訳の役員報酬 (発生ベース)。",
    },
    {
      key: "social_insurance_tax",
      label: "社会保険・税金",
      totalYen: socialInsuranceTaxTotalYen,
      rows: taxRows,
      note: "支払いを確認できた記録だけを数える。法定福利費は社会保険の納付と重なるためここには入れない。",
    },
    {
      key: "opex",
      label: "会社の運営費（家賃・ツールなど）",
      totalYen: opexTotalYen,
      rows: opexRows,
      note: "freee仕訳の固定費 (発生ベース)。役員報酬・法定福利費・租税公課は他の分類で数えるため除く。",
    },
    {
      key: "loan_payment",
      label: "借入の返済",
      totalYen: loanPaymentTotalYen,
      rows: loanRows,
      note: "月額の返済予定 × 期間内の経過月数。",
    },
  ];
  const outflowTotalYen = outflowCategories.reduce((sum, category) => sum + category.totalYen, 0);

  // ---- AMDの財布 ----
  const cashBalanceRows = actualMonthly.filter((row) => row.category === "cash_balance").sort((a, b) => b.ym.localeCompare(a.ym));
  const latestBalance = cashBalanceRows[0];
  const balanceYen = latestBalance ? Math.round(num(latestBalance.actual_amount_yen)) : null;
  const balanceYm = latestBalance?.ym ?? null;

  type LoanInputRow = { label: string | null; amount_yen: number | string | null; payload: Record<string, unknown> | null };
  const loanInputs = (loanInputsRes.data ?? []) as LoanInputRow[];
  let loanRemainingYen: number | null = null;
  if (loanInputs.length > 0) {
    let total = 0;
    let any = false;
    for (const input of loanInputs) {
      const payload = input.payload ?? {};
      const principal = num(payload.principal ?? input.amount_yen);
      const method = String(payload.method ?? "");
      const totalPayments = num(payload.totalPayments);
      const startYm = ym(payload.startYm);
      const annualRate = num(payload.annualRate);
      if (method !== "equal_payment" || principal <= 0 || totalPayments <= 0 || !startYm) continue;
      const paymentsMade = startYm < nowYm ? monthsBetweenInclusive(startYm, addMonthsYm(nowYm, -1)) : 0;
      total += equalPaymentRemainingBalance(principal, annualRate, totalPayments, paymentsMade);
      any = true;
    }
    if (any) loanRemainingYen = total;
  }

  return {
    range,
    wallet: {
      balanceYen,
      balanceYm,
      netChangeYen: inflowTotalYen - outflowTotalYen,
      loanRemainingYen,
    },
    inflow: { totalYen: inflowTotalYen, byProject: inflowProjects },
    outflow: { totalYen: outflowTotalYen, categories: outflowCategories },
    summaryText: SUMMARY_TEXT,
    note: NOTE_TEXT,
    warnings,
    computedAtIso: new Date().toISOString(),
  };
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { value: KiyoMoneyFlowResult; storedAt: number }>();
const inflight = new Map<string, Promise<KiyoMoneyFlowResult>>();

export async function getKiyoMoneyFlow(period: KiyoMoneyFlowPeriod, force = false): Promise<KiyoMoneyFlowResult> {
  const cached = cache.get(period);
  if (!force && cached && Date.now() - cached.storedAt < CACHE_TTL_MS) return cached.value;
  const pending = inflight.get(period);
  if (!force && pending) return pending;

  const request = computeInternal(period)
    .then((value) => {
      cache.set(period, { value, storedAt: Date.now() });
      return value;
    })
    .finally(() => {
      if (inflight.get(period) === request) inflight.delete(period);
    });
  inflight.set(period, request);
  return request;
}

export function invalidateKiyoMoneyFlowCache(): void {
  cache.clear();
  inflight.clear();
}
