import type { SupabaseClient } from "@supabase/supabase-js";
import {
  expandExtraRevenue,
  expandExtraRevenueCash,
  ymToInt,
  type ExtraRevenueEntry,
} from "@/lib/finance/extra-revenue";
import { isWithinContractPeriod } from "@/lib/contract-money";
import { computePaymentYmByRule } from "@/lib/payment-rules";
import {
  obligationToMonthlyInput,
  type CompanyPaymentObligation,
} from "@/lib/finance/payment-obligations";
import type {
  MonthlyPlInputs,
  MonthlyPlParams,
  MonthlyPlProject,
  MonthlyPlFixedCost,
  MonthlyPlProjectRevenue,
  MonthlyPlScenarioOverride,
  MonthlyPlLoan,
  MonthlyPlRecurringCashOutflow,
  MonthlyPlSpot,
} from "@/lib/finance/monthly-pl-simulation";

/**
 * 月次収支シミュレータの入力 (MonthlyPlInputs) を OS のライブテーブルから組み立てる。
 *
 * 凍結 snapshot (company_budget_inputs) ではなく、現行の請求サイクル / MS 進捗 / 固定費マスタ
 * を直読みするので、OS の生データが動けば次に画面を開いた時点で自動でシミュレータに乗る。
 *
 * - 固定収益: projects.fee_type='monthly_fixed' + fee_amount (契約中の月)
 * - 変動収益: projects.fee_type='variable' の PJ の billing_cycles を月別に
 *             売上 = budget_reported_amount (あれば優先)、無ければ budget_yen / 0.65 で逆算
 *             (budget_yen は報酬予算 = reported×0.65 であって売上ではないため)
 * - 固定費: company_finance_recurring_items (status='active')
 * - 売上原価: `/admin/payouts` の capped 外部支払キャッシュを projectRevenues[].externalMemberCost に注入
 *                (注入された PJ/月はエンジンの revenue×rateMember を使わず、payouts の支払予定に一致させる)
 * - パラメータ / 融資 / スポット: OS にライブテーブルが無いので snapshot から流用 (fallback* 引数)
 *
 * persistForecast は互換引数。payouts 正本化後、月次PL側は報酬キャッシュを書き換えず読むだけにする。
 */

const REWARD_RATE = 0.65;

type ProjectRow = {
  project_id: string;
  project_name: string | null;
  status: string | null;
  fee_type: string | null;
  fee_amount: number | string | null;
  start_ym: string | null;
  end_ym: string | null;
  freeze_from_ym: string | null;
  payment_due_rule: string | null;
  payment_due_day: number | null;
  invoice_send_deadline_rule?: string | null;
};

type BillingRow = {
  project_id: string;
  ym: string;
  budget_yen?: number | string | null;
  budget_reported_amount?: number | string | null;
  invoice_ym?: string | null;
  invoice_issued_at?: string | null;
  invoice_sent_at?: string | null;
  reward_summary_json?: unknown;
};

type ExtraRevenueRow = {
  project_id: string;
  ym: string;
  invoice_ym: string | null;
  extra_revenue_json: ExtraRevenueEntry[] | null;
};

type RecurringItemRow = {
  id: string;
  display_name: string | null;
  vendor_name: string | null;
  category: string | null;
  item_kind: string | null;
  amount_yen: number | string | null;
  frequency: string | null;
  start_ym: string | null;
  end_ym: string | null;
  status: string | null;
};

type MemberRow = {
  member_id: string;
  is_officer: boolean | null;
  exclude_from_payout_notice: boolean | null;
};

type PayoutCost = {
  externalYen: number;
  companyReserveYen: number;
};

function num(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function hasExplicitNumber(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  return Number.isFinite(Number(value));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function boolValue(value: unknown): boolean {
  return value === true || value === "true" || value === "TRUE" || value === "1" || value === 1;
}

function recurringClassification(item: Pick<RecurringItemRow, "item_kind" | "category">): "executive" | "salary" | "loan_payment" | null {
  const values = [item.item_kind, item.category];
  return values.includes("loan") || values.includes("loan_payment") ? "loan_payment" : values.includes("executive") ? "executive" : values.includes("salary") ? "salary" : null;
}

function rewardSummaryMembers(summary: Record<string, unknown> | null): Record<string, unknown>[] {
  const raw = summary?.members;
  if (Array.isArray(raw)) return raw.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
  const record = asRecord(raw);
  if (!record) return [];
  const members: Record<string, unknown>[] = [];
  for (const [memberId, value] of Object.entries(record)) {
    const member = asRecord(value);
    if (member) members.push({ memberId, ...member });
  }
  return members;
}

function rewardMemberId(member: Record<string, unknown>): string {
  return String(member.memberId ?? member.member_id ?? "").trim();
}

function payoutCostFromRewardSummary(
  summaryValue: unknown,
  memberById: Map<string, MemberRow>
): PayoutCost | null {
  const summary = asRecord(summaryValue);
  if (!summary) return null;

  const hasTopLevelExternal =
    hasExplicitNumber(summary.externalRegularPayoutCapYen) ||
    hasExplicitNumber(summary.externalExtraPayoutCapYen);
  const hasTopLevelReserve =
    hasExplicitNumber(summary.regularCompanyReserveYen) ||
    hasExplicitNumber(summary.extraCompanyReserveYen);

  if (hasTopLevelExternal || hasTopLevelReserve) {
    return {
      externalYen: num(summary.externalRegularPayoutCapYen) + num(summary.externalExtraPayoutCapYen),
      companyReserveYen: num(summary.regularCompanyReserveYen) + num(summary.extraCompanyReserveYen),
    };
  }

  let externalYen = 0;
  let companyReserveYen = 0;
  for (const member of rewardSummaryMembers(summary)) {
    const memberId = rewardMemberId(member);
    const memberRow = memberById.get(memberId);
    const isOfficer = memberRow?.is_officer === true;
    const isExcluded =
      memberRow?.exclude_from_payout_notice === true ||
      boolValue(member.payoutExcluded ?? member.payout_excluded);
    const extraPaidYen = num(member.extraPaidYen ?? member.extra_paid_yen);
    const totalPay = num(member.totalPay ?? member.total_pay);
    const regularPaidYen = hasExplicitNumber(member.regularPaidYen ?? member.regular_paid_yen)
      ? num(member.regularPaidYen ?? member.regular_paid_yen)
      : Math.max(0, totalPay - extraPaidYen);
    const extraReserveYen = num(member.extraCompanyReserveYen ?? member.extra_company_reserve_yen);
    const reserveYen = num(member.companyReserveYen ?? member.company_reserve_yen ?? member.officerReserveYen ?? member.officer_reserve_yen);
    const regularReserveYen = hasExplicitNumber(member.regularCompanyReserveYen ?? member.regular_company_reserve_yen)
      ? num(member.regularCompanyReserveYen ?? member.regular_company_reserve_yen)
      : Math.max(0, (reserveYen || totalPay) - extraReserveYen);

    if (isOfficer) {
      companyReserveYen += regularReserveYen + extraReserveYen;
    } else if (!isExcluded) {
      externalYen += regularPaidYen + extraPaidYen;
    }
  }

  return { externalYen, companyReserveYen };
}

function cleanYmText(value: string | number | null | undefined): string | null {
  const ym = String(value ?? "").trim();
  return /^\d{6}$/.test(ym) ? ym : null;
}

function addMonths(ym: string, delta: number): string {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ymRange(startYm: string, endYm: string): string[] {
  const months: string[] = [];
  let current = startYm;
  while (current <= endYm) {
    months.push(current);
    current = addMonths(current, 1);
  }
  return months;
}

function previousYmInt(ym: string): number | null {
  const prev = cleanYmText(ym) ? addMonths(ym, -1) : null;
  return prev ? ymToInt(prev) : null;
}

function effectiveProjectEndYm(project: ProjectRow): number | null {
  const contractEnd = ymToInt(project.end_ym);
  const freezeEnd = project.freeze_from_ym ? previousYmInt(project.freeze_from_ym) : null;
  if (contractEnd != null && freezeEnd != null) return Math.min(contractEnd, freezeEnd);
  return contractEnd ?? freezeEnd;
}

function isProjectBudgetActive(project: ProjectRow | undefined, ym: string): boolean {
  if (!project) return false;
  const status = String(project.status || "").toLowerCase();
  if (["archived", "cancelled", "canceled", "ended", "inactive", "frozen"].includes(status)) return false;
  if (project.freeze_from_ym && cleanYmText(project.freeze_from_ym) && ym >= project.freeze_from_ym) return false;
  return isWithinContractPeriod(project, ym);
}

function invoiceDeadlineDay(rule: string | null | undefined): number | null {
  const match = String(rule ?? "").match(/\d{1,2}/);
  if (!match) return null;
  const day = Number(match[0]);
  return Number.isFinite(day) ? Math.max(1, Math.min(31, day)) : null;
}

function invoiceDeadlineReferenceDate(billingYm: string, project: ProjectRow | undefined): string | null {
  if (project?.payment_due_rule !== "invoice_received_60_days") return null;
  const deadlineDay = invoiceDeadlineDay(project.invoice_send_deadline_rule);
  if (!deadlineDay) return null;
  const referenceYm = addMonths(billingYm, 1);
  const lastDay = new Date(Date.UTC(Number(referenceYm.slice(0, 4)), Number(referenceYm.slice(4, 6)), 0)).getUTCDate();
  return `${referenceYm.slice(0, 4)}-${referenceYm.slice(4, 6)}-${String(Math.min(deadlineDay, lastDay)).padStart(2, "0")}`;
}

function isoForYmDay(ym: string, day: number): string | null {
  if (!cleanYmText(ym)) return null;
  const lastDay = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)), 0)).getUTCDate();
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(Math.min(Math.max(1, day), lastDay)).padStart(2, "0")}`;
}

function contractInvoiceReferenceDate(row: BillingRow, project: ProjectRow | undefined): string | null {
  if (row.invoice_sent_at) return String(row.invoice_sent_at).slice(0, 10);
  if (row.invoice_issued_at) return String(row.invoice_issued_at).slice(0, 10);
  if (project?.payment_due_rule !== "invoice_received_60_days") return null;
  const deadlineDay = invoiceDeadlineDay(project.invoice_send_deadline_rule);
  if (!deadlineDay) return null;
  const invoiceYm = cleanYmText(row.invoice_ym);
  return invoiceYm ? isoForYmDay(invoiceYm, deadlineDay) : invoiceDeadlineReferenceDate(row.ym, project);
}

function contractRevenueCashYm(row: BillingRow, project: ProjectRow | undefined): number | null {
  const invoiceYm = cleanYmText(row.invoice_ym);
  const baseYm = invoiceYm ?? cleanYmText(row.ym);
  if (!baseYm) return null;
  return ymToInt(
    computePaymentYmByRule(
      baseYm,
      project?.payment_due_rule ?? null,
      project?.payment_due_day ?? null,
      contractInvoiceReferenceDate(row, project)
    )
  );
}

function contractNetRevenueForCycle(row: BillingRow, project: ProjectRow | undefined): number {
  const reported = num(row.budget_reported_amount);
  if (reported > 0) return reported;
  if (String(project?.fee_type || "").toLowerCase() === "monthly_fixed" && num(project?.fee_amount) > 0) {
    return num(project?.fee_amount);
  }
  const budgetYen = num(row.budget_yen);
  return budgetYen > 0 ? Math.round(budgetYen / REWARD_RATE) : 0;
}

export interface BuildLiveInputsOptions {
  /** シミュレーション開始月 (snapshot params.startYm を流用) */
  startYm: number;
  /** シミュレーション月数 (snapshot params.months を流用) */
  months: number;
  /** snapshot params をそのまま流用 (繰越欠損・社保率・各種率など) */
  fallbackParams: MonthlyPlParams;
  /** OS にライブソースが無い融資 */
  fallbackLoans?: MonthlyPlLoan[];
  /** OS にライブソースが無い臨時収支 */
  fallbackSpots?: MonthlyPlSpot[];
  /** シナリオ override (snapshot 流用) */
  fallbackScenarios?: MonthlyPlScenarioOverride[];
  /** 旧互換引数。payouts 正本化後、ここでは報酬キャッシュを書き換えない */
  persistForecast?: boolean;
}

export interface BuildLiveInputsResult {
  inputs: MonthlyPlInputs;
  /** `/admin/payouts` 由来の外部支払予定 (PJ×月) */
  forwardMemberCostByPjYm: Map<string, number>;
  /** 警告 (データ欠損など) */
  warnings: string[];
}

export async function buildLiveMonthlyPlInputs(
  supabase: SupabaseClient,
  options: BuildLiveInputsOptions
): Promise<BuildLiveInputsResult> {
  const { startYm, months, fallbackParams } = options;
  const warnings: string[] = [];

  const startYmStr = String(startYm);
  // シミュレーション対象の最終月 (startYm から months 分)
  const endInt = (() => {
    const y = Math.floor(startYm / 100);
    const m = startYm % 100;
    const total = y * 12 + (m - 1) + (months - 1);
    return Math.floor(total / 12) * 100 + ((total % 12) + 1);
  })();
  const endYmStr = String(endInt);

  const [projectsRes, recurringRes, obligationsRes, membersRes] = await Promise.all([
    supabase
      .from("projects")
      .select("project_id, project_name, status, fee_type, fee_amount, start_ym, end_ym, freeze_from_ym, payment_due_rule, payment_due_day, invoice_send_deadline_rule")
      .limit(500),
    supabase
      .from("company_finance_recurring_items")
      .select("id, display_name, vendor_name, category, item_kind, amount_yen, frequency, start_ym, end_ym, status")
      .eq("status", "active")
      .limit(500),
    supabase
      .from("company_payment_obligations")
      .select("*")
      .in("status", ["needs_review", "open", "scheduled"])
      .gte("expected_payment_ym", startYmStr)
      .lte("expected_payment_ym", endYmStr)
      .limit(2000),
    supabase
      .from("members")
      .select("member_id, is_officer, exclude_from_payout_notice")
      .limit(500),
  ]);
  if (projectsRes.error) throw projectsRes.error;
  if (recurringRes.error) throw recurringRes.error;
  if (obligationsRes.error) throw obligationsRes.error;
  if (membersRes.error) throw membersRes.error;

  const projects = (projectsRes.data ?? []) as ProjectRow[];
  const recurringItems = (recurringRes.data ?? []) as RecurringItemRow[];
  const memberById = new Map(((membersRes.data ?? []) as MemberRow[]).map((member) => [member.member_id, member]));
  const paymentObligations = ((obligationsRes.data ?? []) as CompanyPaymentObligation[])
    .map(obligationToMonthlyInput)
    .filter((row): row is NonNullable<typeof row> => row !== null);
  const projectById = new Map(projects.map((project) => [project.project_id, project]));

  // ---- 固定収益: monthly_fixed PJ ----
  const fixedRevenueProjects: MonthlyPlProject[] = projects
    .filter((p) => String(p.fee_type || "").toLowerCase() === "monthly_fixed" && num(p.fee_amount) > 0)
    .map((p) => ({
      projectId: p.project_id,
      projectName: p.project_name || p.project_id,
      monthlyRevenue: num(p.fee_amount),
      startYm: ymToInt(p.start_ym) ?? startYm,
      endYm: effectiveProjectEndYm(p),
      type: "fixed",
      status: "confirmed",
      billingType: "monthly",
      closerInternal: true,
    }))
    .filter((p) => !p.endYm || p.endYm >= p.startYm);

  // ---- 変動収益: variable PJ の billing_cycles を月別に ----
  const variableProjectIds = projects
    .filter((p) => String(p.fee_type || "").toLowerCase() === "variable")
    .map((p) => p.project_id);

  const projectRevenues: MonthlyPlProjectRevenue[] = [];
  // variable PJ も projects[] に「枠」として登録する (monthlyRevenue=0、月別は projectRevenues で上書き)
  const variableProjectShells: MonthlyPlProject[] = projects
    .filter((p) => String(p.fee_type || "").toLowerCase() === "variable")
    .map((p) => ({
      projectId: p.project_id,
      projectName: p.project_name || p.project_id,
      monthlyRevenue: 0,
      startYm: ymToInt(p.start_ym) ?? startYm,
      endYm: effectiveProjectEndYm(p),
      type: "fixed",
      status: "tentative",
      billingType: "monthly",
      closerInternal: true,
    }))
    .filter((p) => !p.endYm || p.endYm >= p.startYm);

  if (variableProjectIds.length > 0) {
    const billingRes = await supabase
      .from("billing_cycles")
      .select("project_id, ym, budget_yen, budget_reported_amount")
      .in("project_id", variableProjectIds)
      .gte("ym", startYmStr)
      .lte("ym", endYmStr)
      .limit(2000);
    if (billingRes.error) throw billingRes.error;
    for (const row of (billingRes.data ?? []) as BillingRow[]) {
      const project = projectById.get(row.project_id);
      if (!isProjectBudgetActive(project, row.ym)) continue;
      const reported = num(row.budget_reported_amount);
      const budgetYen = num(row.budget_yen);
      // 売上 = reported (あれば) / なければ budget_yen を 0.65 で割り戻し
      const revenue = reported > 0 ? reported : budgetYen > 0 ? Math.round(budgetYen / REWARD_RATE) : 0;
      if (revenue <= 0) continue;
      projectRevenues.push({
        projectId: row.project_id,
        ym: Number(row.ym),
        monthlyRevenue: revenue,
        memo: reported > 0 ? "billing_cycles.budget_reported_amount" : "billing_cycles.budget_yen/0.65",
      });
    }
  }

  const allProjectIds = projects.map((p) => p.project_id);

  // ---- 本契約売上のキャッシュ入金: billing_cycles.invoice_ym + PJ 支払条件 ----
  // PL 売上は稼働月に残し、キャッシュだけ請求月/支払サイトへ移す。
  // KUTE のように試算開始月より前の稼働分が当月入金になるケースを拾うため、
  // billing cycle は開始月から6か月遡って読む。
  // 台帳で入金を明示できた「PJ×稼働月」を集める。PJ 単位で explicit を立てると、
  // 台帳が将来月まで無い継続 PJ (ZMP/SE/KUTE) の入金が丸ごと消える。
  const contractCashExplicitYms = new Map<string, Set<number>>();
  const markContractCashExplicit = (projectId: string, ym: string) => {
    const ymInt = ymToInt(ym);
    if (ymInt == null) return;
    const set = contractCashExplicitYms.get(projectId) ?? new Set<number>();
    set.add(ymInt);
    contractCashExplicitYms.set(projectId, set);
  };
  if (allProjectIds.length > 0) {
    const contractCashLookbackYm = addMonths(startYmStr, -6);
    const contractCashRes = await supabase
      .from("billing_cycles")
      .select("project_id, ym, budget_yen, budget_reported_amount, invoice_ym, invoice_issued_at, invoice_sent_at")
      .in("project_id", allProjectIds)
      .gte("ym", contractCashLookbackYm)
      .lte("ym", endYmStr)
      .limit(5000);
    if (contractCashRes.error) throw contractCashRes.error;

    for (const row of (contractCashRes.data ?? []) as BillingRow[]) {
      const project = projectById.get(row.project_id);
      if (!isProjectBudgetActive(project, row.ym)) continue;
      const cashRevenue = contractNetRevenueForCycle(row, project);
      if (cashRevenue <= 0) continue;
      markContractCashExplicit(row.project_id, row.ym);
      const cashYm = contractRevenueCashYm(row, project);
      if (cashYm == null || cashYm < startYm || cashYm > endInt) continue;
      projectRevenues.push({
        projectId: row.project_id,
        ym: cashYm,
        contractRevenueCash: cashRevenue,
        contractRevenueCashMemo: cleanYmText(row.invoice_ym)
          ? `main contract cash from invoice_ym ${row.invoice_ym}`
          : "main contract cash from project payment terms",
      });
    }
  }

  // 台帳のある月だけ自動入金を止める。台帳の無い月 (契約継続中なのに billing_cycles が
  // まだ作られていない将来月など) はエンジンの自動入金へ戻し、売上に見合う入金を立てる。
  for (const project of [...fixedRevenueProjects, ...variableProjectShells]) {
    const explicitYms = contractCashExplicitYms.get(project.projectId);
    if (explicitYms?.size) project.cashRevenueExplicitYms = [...explicitYms].sort((a, b) => a - b);
  }

  // ---- 別財布（別契約）売上: 全 PJ の billing_cycles.extra_revenue_json ----
  // 本契約 (定額/変動) とは別枠の単発受託売上。fee_type を問わず全 PJ から読む。
  // エンジンには PL 用 extraRevenue とキャッシュ用 extraRevenueCash を分けて注入する。
  // extraRevenue は売上・粗利・消費税に、extraRevenueCash は入金月の CF/残高にだけ乗る
  // (原価は `/admin/payouts` 由来の externalMemberCost で別途注入するため自動原価率は通さない)。
  // period_start_ym〜period_end_ym 指定があれば開発期間で月次按分 (B-a, 2026-06-16)、
  // 無ければ billing_cycles.ym へ一括計上 (後方互換)。キャッシュは共通 helper で
  // 実入金月 / invoice_ym / billing_date 月 + PJ 支払サイトの順に解決する。
  if (allProjectIds.length > 0) {
    const extraRes = await supabase
      .from("billing_cycles")
      .select("project_id, ym, invoice_ym, extra_revenue_json")
      .in("project_id", allProjectIds)
      .not("extra_revenue_json", "is", null)
      .limit(2000);
    if (extraRes.error) throw extraRes.error;

    // 按分は共通ヘルパー (expandExtraRevenue) に集約。period 按分元の ym が
    // シミュレーション開始月より前でも取りこぼさないよう、絞り込みは展開後の minYm/maxYm で行う。
    const expanded = expandExtraRevenue(
      (extraRes.data ?? []) as ExtraRevenueRow[],
      { minYm: startYm, maxYm: endInt }
    );
    for (const ex of expanded) {
      projectRevenues.push({
        projectId: ex.projectId,
        ym: ex.ym,
        extraRevenue: ex.amount,
        extraRevenueMemo: ex.labels.join(", ") || "別財布売上",
      });
    }

    for (const ex of expandExtraRevenueCash((extraRes.data ?? []) as ExtraRevenueRow[], {
      minYm: startYm,
      maxYm: endInt,
      paymentTermsByProjectId: projectById,
    })) {
      projectRevenues.push({
        projectId: ex.projectId,
        ym: ex.ym,
        extraRevenueCash: ex.amount,
        extraRevenueCashMemo: `${ex.labels.join(", ") || "別財布売上"} cash receipt`,
      });
    }
  }

  // ---- 固定費: company_finance_recurring_items ----
  // 社保基礎は明示分類が executive / salary の recurring item だけに限定する。
  const recurringCashOutflows: MonthlyPlRecurringCashOutflow[] = recurringItems
    .filter((item) => item.status === "active" && recurringClassification(item) === "loan_payment" && num(item.amount_yen) > 0)
    .map((item) => ({
      outflowId: item.id,
      outflowName: item.display_name || item.vendor_name || item.category || item.id,
      monthlyAmount: num(item.amount_yen),
      startYm: ymToInt(item.start_ym) ?? startYm,
      endYm: ymToInt(item.end_ym),
      kind: "loan_payment" as const,
    }));
  const fixedCosts: MonthlyPlFixedCost[] = recurringItems
    .filter((item) => item.status === "active" && recurringClassification(item) !== "loan_payment" && num(item.amount_yen) > 0)
    .map((item) => {
      const costName = item.display_name || item.vendor_name || item.category || item.id;
      const classification = recurringClassification(item);
      return {
        costId: item.id,
        costName,
        monthlyCost: num(item.amount_yen),
        startYm: ymToInt(item.start_ym) ?? startYm,
        endYm: ymToInt(item.end_ym),
        costType: classification === "executive" || classification === "salary" ? classification : ("taxable" as const),
      };
    });

  const projectsList: MonthlyPlProject[] = [...fixedRevenueProjects, ...variableProjectShells];

  // ---- 売上原価: `/admin/payouts` の capped 外部支払予定を使う ----
  // 月次試算表の cash out / 売上原価は、MS理論原価や売上×65%ではなく
  // 支払通知書フローの正本である billing_cycles.reward_summary_json に合わせる。
  // reward cache が無い PJ/月は「支払予定なし」として 0 円を明示し、自動原価に戻さない。
  const forwardMemberCostByPjYm = new Map<string, number>();
  const payoutCostByPjYm = new Map<string, PayoutCost>();
  const payoutProjectIds = projectsList.map((project) => project.projectId);
  if (payoutProjectIds.length > 0) {
    const payoutRes = await supabase
      .from("billing_cycles")
      .select("project_id, ym, reward_summary_json")
      .in("project_id", payoutProjectIds)
      .gte("ym", startYmStr)
      .lte("ym", endYmStr)
      .limit(5000);
    if (payoutRes.error) throw payoutRes.error;
    for (const row of (payoutRes.data ?? []) as BillingRow[]) {
      const cost = payoutCostFromRewardSummary(row.reward_summary_json, memberById);
      if (!cost) continue;
      payoutCostByPjYm.set(`${row.project_id}_${row.ym}`, cost);
    }
  }

  // ---- 売上原価は台帳に入っている値だけを使う (横引きは 2026-08-27 まさ確定で廃止) ----
  // 旧実装は「契約が続くのに報酬プランが無い月」に直近3ヶ月の外部支払中央値を伸ばしていた。
  // 契約期間を1か月延ばしただけで将来の原価が勝手に生えるため、PJの統合や契約更新のたびに
  // 試算表が動いてしまう。将来月の外部支払は `billing_cycles.reward_summary_json` へ
  // 明示的に入れる (見込みなら見込み額を、支払わないなら 0 を) 運用へ切り替えた。
  // まさ指示 2026-08-27: 「この仕組みをやめたらいいんじゃないかな。やめて額が変わっちゃう
  // ところは、個別でデータを入れて変わらないようにすればいい」

  // projectRevenues に原価 override をマージ (既存行があれば上書き、無ければ新規行)
  const revenueIndex = new Map<string, MonthlyPlProjectRevenue>();
  for (const rev of projectRevenues) revenueIndex.set(`${rev.projectId}_${rev.ym}`, rev);
  for (const project of projectsList) {
    const sourceProject = projectById.get(project.projectId);
    for (const ym of ymRange(startYmStr, endYmStr)) {
      if (!isProjectBudgetActive(sourceProject, ym)) continue;
      const key = `${project.projectId}_${ym}`;
      const cost = payoutCostByPjYm.get(key);
      const externalMemberCost = cost?.externalYen ?? 0;
      const costMemo = "member cost from /admin/payouts capped external payout";
      forwardMemberCostByPjYm.set(key, externalMemberCost);
      const existing = revenueIndex.get(key);
      if (existing) {
        existing.externalMemberCost = externalMemberCost;
        existing.internalMemberCost = 0;
        existing.memo = existing.memo ?? costMemo;
      } else {
        const newRow: MonthlyPlProjectRevenue = {
          projectId: project.projectId,
          ym: Number(ym),
          externalMemberCost,
          internalMemberCost: 0,
          memo: costMemo,
        };
        projectRevenues.push(newRow);
        revenueIndex.set(key, newRow);
      }
    }
  }
  const inputs: MonthlyPlInputs = {
    params: {
      ...fallbackParams,
      startYm,
      months,
      // live 月次PLの売上原価は `/admin/payouts` の外部支払予定に一本化する。
      // 旧 GAS snapshot の理論クローザー率を残すと、payouts に存在しない原価が再発生する。
      rateCloser: 0,
    },
    projects: projectsList,
    fixedCosts,
    recurringCashOutflows,
    projectRevenues,
    loans: options.fallbackLoans ?? [],
    spots: options.fallbackSpots ?? [],
    paymentObligations,
    scenarios: options.fallbackScenarios ?? [],
  };

  return { inputs, forwardMemberCostByPjYm, warnings };
}
