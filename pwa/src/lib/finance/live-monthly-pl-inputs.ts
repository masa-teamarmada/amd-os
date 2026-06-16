import type { SupabaseClient } from "@supabase/supabase-js";
import { computeForwardUncappedMemberCosts } from "@/lib/reward-summary";
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
};

type BillingRow = {
  project_id: string;
  ym: string;
  budget_yen: number | string | null;
  budget_reported_amount: number | string | null;
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

function ymToInt(ym: string | null | undefined): number | null {
  if (!ym) return null;
  const n = Number(ym);
  return Number.isFinite(n) ? n : null;
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

  const [projectsRes, recurringRes] = await Promise.all([
    supabase
      .from("projects")
      .select("project_id, project_name, status, fee_type, fee_amount, start_ym, end_ym, freeze_from_ym")
      .limit(500),
    supabase
      .from("company_finance_recurring_items")
      .select("id, display_name, vendor_name, category, amount_yen, frequency, start_ym, end_ym, status")
      .eq("status", "active")
      .limit(500),
  ]);
  if (projectsRes.error) throw projectsRes.error;
  if (recurringRes.error) throw recurringRes.error;

  const projects = (projectsRes.data ?? []) as ProjectRow[];
  const recurringItems = (recurringRes.data ?? []) as RecurringItemRow[];

  // ---- 固定収益: monthly_fixed PJ ----
  const fixedRevenueProjects: MonthlyPlProject[] = projects
    .filter((p) => String(p.fee_type || "").toLowerCase() === "monthly_fixed" && num(p.fee_amount) > 0)
    .map((p) => ({
      projectId: p.project_id,
      projectName: p.project_name || p.project_id,
      monthlyRevenue: num(p.fee_amount),
      startYm: ymToInt(p.start_ym) ?? startYm,
      endYm: ymToInt(p.end_ym),
      type: "fixed",
      status: "confirmed",
      billingType: "monthly",
    }));

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
      endYm: ymToInt(p.end_ym),
      type: "fixed",
      status: "tentative",
      billingType: "monthly",
    }));

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

  // ---- 固定費: company_finance_recurring_items ----
  const fixedCosts: MonthlyPlFixedCost[] = recurringItems
    .filter((item) => num(item.amount_yen) > 0)
    .map((item) => ({
      costId: item.id,
      costName: item.display_name || item.vendor_name || item.category || item.id,
      monthlyCost: num(item.amount_yen),
      startYm: ymToInt(item.start_ym) ?? startYm,
      endYm: ymToInt(item.end_ym),
      costType: "taxable",
    }));

  // ---- 将来メンバー原価: 各 active PJ の uncapped 報酬を projectRevenues[].internalMemberCost へ ----
  // アンカー月 = startYm 近辺の「当月」。ここでは startYm を anchor に使う
  // (将来月 = anchor より後の月が uncapped 予測)。
  const anchorYm = startYmStr;
  const forwardMemberCostByPjYm = new Map<string, number>();
  // uncapped を計算する対象 = 報酬 plan cycle を持ちうる active PJ。
  // fee_type 問わず全 active PJ を対象にする (p00 含む)。
  const activeProjectIds = projects
    .filter((p) => String(p.status || "").toLowerCase() === "active")
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
    scenarios: options.fallbackScenarios ?? [],
  };

  return { inputs, forwardMemberCostByPjYm, warnings };
}
