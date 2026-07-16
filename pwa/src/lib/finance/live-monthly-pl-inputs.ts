import type { SupabaseClient } from "@supabase/supabase-js";
import { computeForwardUncappedMemberCosts } from "@/lib/reward-summary";
import {
  expandExtraRevenue,
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
 * - 将来メンバー原価: 各 PJ の MS を期間按分した uncapped 報酬を projectRevenues[].internalMemberCost に注入
 *                    (注入された PJ/月はエンジンの revenue×rateMember を override し、実発生原価で計算される)
 * - パラメータ / 融資 / スポット: OS にライブテーブルが無いので snapshot から流用 (fallback* 引数)
 *
 * persistForecast=true のとき、将来月の uncapped を billing_cycles.reward_summary_json の
 * forecastUncapped キーへ保存する (capped actual は上書きしない)。本番データ書き込みなので
 * 呼び出し側でまさ承認済みのときだけ true を渡す。
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
  budget_yen: number | string | null;
  budget_reported_amount: number | string | null;
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
  amount_yen: number | string | null;
  frequency: string | null;
  start_ym: string | null;
  end_ym: string | null;
  status: string | null;
};

function num(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function cleanYmText(value: string | number | null | undefined): string | null {
  const ym = String(value ?? "").trim();
  return /^\d{6}$/.test(ym) ? ym : null;
}

function ymFromIsoDate(value: string | null | undefined): string | null {
  const match = String(value ?? "").trim().match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}${match[2]}`;
}

function addMonths(ym: string, delta: number): string {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
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

function isProjectActiveAtAnchor(project: ProjectRow, anchorYm: string): boolean {
  return isProjectBudgetActive(project, anchorYm) && String(project.status || "").toLowerCase() === "active";
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

function resolveExtraRevenueCashYm(
  row: ExtraRevenueRow,
  entry: ExtraRevenueEntry,
  project: ProjectRow | undefined
): number | null {
  const explicitInvoiceYm = cleanYmText(row.invoice_ym);
  if (explicitInvoiceYm) return ymToInt(explicitInvoiceYm);

  const billingYm = ymFromIsoDate(entry.billing_date);
  if (billingYm) {
    return ymToInt(
      computePaymentYmByRule(
        billingYm,
        project?.payment_due_rule ?? null,
        project?.payment_due_day ?? null,
        invoiceDeadlineReferenceDate(billingYm, project)
      )
    );
  }

  // Legacy entries without billing_date keep the historical behavior: cash in billing_cycles.ym.
  return ymToInt(row.ym);
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
  /** 将来月の uncapped を billing_cycles へ保存するか (まさ承認時のみ true) */
  persistForecast?: boolean;
}

export interface BuildLiveInputsResult {
  inputs: MonthlyPlInputs;
  /** uncapped 原価がマイナス利益を生む月の診断用 */
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

  const [projectsRes, recurringRes, obligationsRes] = await Promise.all([
    supabase
      .from("projects")
      .select("project_id, project_name, status, fee_type, fee_amount, start_ym, end_ym, freeze_from_ym, payment_due_rule, payment_due_day, invoice_send_deadline_rule")
      .limit(500),
    supabase
      .from("company_finance_recurring_items")
      .select("id, display_name, vendor_name, category, amount_yen, frequency, start_ym, end_ym, status")
      .eq("status", "active")
      .limit(500),
    supabase
      .from("company_payment_obligations")
      .select("*")
      .in("status", ["needs_review", "open", "scheduled"])
      .gte("expected_payment_ym", startYmStr)
      .lte("expected_payment_ym", endYmStr)
      .limit(2000),
  ]);
  if (projectsRes.error) throw projectsRes.error;
  if (recurringRes.error) throw recurringRes.error;
  if (obligationsRes.error) throw obligationsRes.error;

  const projects = (projectsRes.data ?? []) as ProjectRow[];
  const recurringItems = (recurringRes.data ?? []) as RecurringItemRow[];
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

  // ---- 別財布（別契約）売上: 全 PJ の billing_cycles.extra_revenue_json ----
  // 本契約 (定額/変動) とは別枠の単発受託売上。fee_type を問わず全 PJ から読む。
  // エンジンには PL 用 extraRevenue とキャッシュ用 extraRevenueCash を分けて注入する。
  // extraRevenue は売上・粗利・消費税に、extraRevenueCash は入金月の CF/残高にだけ乗る
  // (原価は cap_extra プールで別途計上済みのため自動原価率は通さない)。
  // period_start_ym〜period_end_ym 指定があれば開発期間で月次按分 (B-a, 2026-06-16)、
  // 無ければ billing_cycles.ym へ一括計上 (後方互換)。キャッシュは invoice_ym 優先、
  // 無ければ billing_date 月 + PJ 支払サイト (null は翌月末) で解決する。
  const allProjectIds = projects.map((p) => p.project_id);
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

    for (const row of (extraRes.data ?? []) as ExtraRevenueRow[]) {
      const entries = Array.isArray(row.extra_revenue_json) ? row.extra_revenue_json : [];
      for (const entry of entries) {
        const total = Math.round(num(entry?.amount_tax_excl));
        if (total <= 0) continue;
        const cashYm = resolveExtraRevenueCashYm(row, entry, projectById.get(row.project_id));
        if (cashYm == null || cashYm < startYm || cashYm > endInt) continue;
        const label = typeof entry?.label === "string" && entry.label.length > 0 ? entry.label : "別財布売上";
        projectRevenues.push({
          projectId: row.project_id,
          ym: cashYm,
          extraRevenueCash: total,
          extraRevenueCashMemo: `${label} cash receipt`,
        });
      }
    }
  }

  // ---- 固定費: company_finance_recurring_items ----
  // 社会保険料は「役員報酬・給与」に当たる固定費だけを base に算定する (engine 側で
  // costType === "executive"|"salary" のみ socialInsBase に積む)。recurring items には
  // cost_type 列が無いので display_name から役員報酬/上乗せ/給与を判別して executive を付ける。
  // それ以外 (サブスク・家賃・通信費等) は taxable のまま。
  const isExecutiveCost = (name: string): boolean =>
    /役員報酬|上乗せ|給与|給料|賞与/.test(name);
  const fixedCosts: MonthlyPlFixedCost[] = recurringItems
    .filter((item) => num(item.amount_yen) > 0)
    .map((item) => {
      const costName = item.display_name || item.vendor_name || item.category || item.id;
      return {
        costId: item.id,
        costName,
        monthlyCost: num(item.amount_yen),
        startYm: ymToInt(item.start_ym) ?? startYm,
        endYm: ymToInt(item.end_ym),
        costType: isExecutiveCost(costName) ? ("executive" as const) : ("taxable" as const),
      };
    });

  // ---- 将来メンバー原価: 各 active PJ の uncapped 報酬を projectRevenues[].internalMemberCost へ ----
  // アンカー月 = startYm 近辺の「当月」。ここでは startYm を anchor に使う
  // (将来月 = anchor より後の月が uncapped 予測)。
  const anchorYm = startYmStr;
  const forwardMemberCostByPjYm = new Map<string, number>();
  // uncapped を計算する対象 = 報酬 plan cycle を持ちうる active PJ。
  // fee_type 問わず全 active PJ を対象にする (p00 含む)。
  const activeProjectIds = projects
    .filter((p) => isProjectActiveAtAnchor(p, anchorYm))
    .map((p) => p.project_id);

  const internalCostByPjYm = new Map<string, number>();
  for (const projectId of activeProjectIds) {
    let forward;
    try {
      forward = await computeForwardUncappedMemberCosts(supabase, projectId, anchorYm, {
        persist: options.persistForecast === true,
      });
    } catch (err) {
      warnings.push(`uncapped 計算失敗 ${projectId}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    for (const month of forward.months) {
      const key = `${projectId}_${month.ym}`;
      internalCostByPjYm.set(key, month.uncappedTotalYen);
      forwardMemberCostByPjYm.set(key, month.uncappedTotalYen);
    }
  }

  // internalMemberCost を projectRevenues にマージ (既存行があれば上書き、無ければ新規行)
  const revenueIndex = new Map<string, MonthlyPlProjectRevenue>();
  for (const rev of projectRevenues) revenueIndex.set(`${rev.projectId}_${rev.ym}`, rev);
  for (const [key, cost] of internalCostByPjYm.entries()) {
    if (cost <= 0) continue;
    const [projectId, ymStr] = key.split("_");
    const existing = revenueIndex.get(`${projectId}_${ymStr}`);
    if (existing) {
      existing.internalMemberCost = cost;
    } else {
      const newRow: MonthlyPlProjectRevenue = {
        projectId,
        ym: Number(ymStr),
        internalMemberCost: cost,
      };
      projectRevenues.push(newRow);
      revenueIndex.set(key, newRow);
    }
  }

  const projectsList: MonthlyPlProject[] = [...fixedRevenueProjects, ...variableProjectShells];

  const inputs: MonthlyPlInputs = {
    params: {
      ...fallbackParams,
      startYm,
      months,
    },
    projects: projectsList,
    fixedCosts,
    projectRevenues,
    loans: options.fallbackLoans ?? [],
    spots: options.fallbackSpots ?? [],
    paymentObligations,
    scenarios: options.fallbackScenarios ?? [],
  };

  return { inputs, forwardMemberCostByPjYm, warnings };
}
