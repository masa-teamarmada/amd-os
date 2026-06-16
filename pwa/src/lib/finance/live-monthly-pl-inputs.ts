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

/** billing_cycles.extra_revenue_json の 1 要素 (= 別財布売上) */
type ExtraRevenueEntry = {
  label?: string | null;
  amount_tax_excl?: number | string | null;
  freee_invoice_number?: string | null;
  billing_date?: string | null;
  memo?: string | null;
  /**
   * 開発期間按分 (B-a, 2026-06-16 まさ確定)。period_start_ym〜period_end_ym を指定すると
   * amount_tax_excl を期間月数で割り、各月に均等配分する (pt消化と同じ「期間で割る」思想)。
   * 端数は最終月に寄せる。PL計上もキャッシュ入金も同じ按分月 (B-a)。
   * 両方未指定なら従来どおり billing_cycles.ym に一括計上 (後方互換)。
   * 形式は "YYYYMM" (例: "202605")。
   */
  period_start_ym?: string | null;
  period_end_ym?: string | null;
};

type ExtraRevenueRow = {
  project_id: string;
  ym: string;
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

function ymToInt(ym: string | null | undefined): number | null {
  if (!ym) return null;
  const n = Number(ym);
  return Number.isFinite(n) ? n : null;
}

/** YYYYMM 整数の翌月 (年跨ぎ対応)。例: 202612 -> 202701 */
function nextYmInt(ym: number): number {
  const y = Math.floor(ym / 100);
  const m = ym % 100;
  return m >= 12 ? (y + 1) * 100 + 1 : y * 100 + (m + 1);
}

/** start..end (両端含む) の月数。例: 202605..202610 = 6 */
function monthsBetween(start: number, end: number): number {
  const ys = Math.floor(start / 100);
  const ms = start % 100;
  const ye = Math.floor(end / 100);
  const me = end % 100;
  return (ye - ys) * 12 + (me - ms) + 1;
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

  // ---- 別財布（別契約）売上: 全 PJ の billing_cycles.extra_revenue_json ----
  // 本契約 (定額/変動) とは別枠の単発受託売上。fee_type を問わず全 PJ から読む。
  // エンジンには extraRevenue として注入され、売上・粗利・消費税・CF に加算される
  // (原価は cap_extra プールで別途計上済みのため自動原価率は通さない)。
  // period_start_ym〜period_end_ym 指定があれば開発期間で月次按分 (B-a, 2026-06-16)、
  // 無ければ billing_cycles.ym へ一括計上 (後方互換)。
  const allProjectIds = projects.map((p) => p.project_id);
  if (allProjectIds.length > 0) {
    const extraRes = await supabase
      .from("billing_cycles")
      .select("project_id, ym, extra_revenue_json")
      .in("project_id", allProjectIds)
      .not("extra_revenue_json", "is", null)
      .limit(2000);
    if (extraRes.error) throw extraRes.error;

    // (projectId, ym) ごとに按分後の金額とラベルを集約する
    const extraByPjYm = new Map<string, { amount: number; labels: Set<string> }>();
    const addExtra = (projectId: string, ym: number, amount: number, label: string) => {
      if (!(ym >= startYm && ym <= endInt)) return; // シミュレーション期間外は捨てる
      if (!Number.isFinite(amount) || amount === 0) return;
      const key = `${projectId}:${ym}`;
      const cur = extraByPjYm.get(key) ?? { amount: 0, labels: new Set<string>() };
      cur.amount += amount;
      if (label) cur.labels.add(label);
      extraByPjYm.set(key, cur);
    };

    for (const row of (extraRes.data ?? []) as ExtraRevenueRow[]) {
      const entries = Array.isArray(row.extra_revenue_json) ? row.extra_revenue_json : [];
      const fallbackYm = Number(row.ym);
      for (const e of entries) {
        const total = num(e?.amount_tax_excl);
        if (total <= 0) continue;
        const label = typeof e?.label === "string" && e.label.length > 0 ? e.label : "別財布売上";
        const startStr = e?.period_start_ym;
        const endStr = e?.period_end_ym;
        const pStart = ymToInt(startStr);
        const pEnd = ymToInt(endStr);
        if (pStart != null && pEnd != null && pEnd >= pStart) {
          // 開発期間で月次按分。端数は最終月に寄せる (pt消化と同じ思想)。
          const periodMonths = monthsBetween(pStart, pEnd);
          const per = Math.floor(total / periodMonths);
          let ym = pStart;
          for (let i = 0; i < periodMonths; i++) {
            const amount = i === periodMonths - 1 ? total - per * (periodMonths - 1) : per;
            addExtra(row.project_id, ym, amount, label);
            ym = nextYmInt(ym);
          }
        } else {
          // 期間指定なし → billing_cycles.ym へ一括 (後方互換)。
          addExtra(row.project_id, fallbackYm, total, label);
        }
      }
    }

    for (const [key, val] of extraByPjYm) {
      const [projectId, ymStr] = key.split(":");
      projectRevenues.push({
        projectId,
        ym: Number(ymStr),
        extraRevenue: val.amount,
        extraRevenueMemo: Array.from(val.labels).join(", ") || "別財布売上",
      });
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
