import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLiveMonthlyPlInputs } from "@/lib/finance/live-monthly-pl-inputs";
import {
  projectCashFromAnchor,
  resolveCashAnchor,
  type CashAnchorPoint,
} from "@/lib/finance/cash-anchor";
import {
  runMonthlyPlSimulation,
  toCompanyBudgetMonthlyRows,
  type BudgetInputKind,
  type MonthlyPlSimulationResult,
  type MonthlyPlInputs,
} from "@/lib/finance/monthly-pl-simulation";

export const LIVE_MONTHLY_PL_SOURCE = "os_live_monthly_pl";
export const LIVE_MONTHLY_PL_VERSION = "os-live-current";
export const LIVE_MONTHLY_PL_ENGINE_VERSION = "os-live-monthly-pl-v1";

type BudgetInputRow = {
  input_kind: BudgetInputKind;
  source_id: string | null;
  label: string | null;
  payload: Record<string, unknown> | null;
  version: string | null;
  updated_at: string | null;
};

export type LiveMonthlyPlBudgetRefreshResult = {
  ok: boolean;
  source: typeof LIVE_MONTHLY_PL_SOURCE;
  version: typeof LIVE_MONTHLY_PL_VERSION;
  simulationRunId: string;
  startYm: number;
  months: number;
  rowCount: number;
  companyRowCount: number;
  projectRowCount: number;
  inputFallbackVersion: string | null;
  cashAnchor: CashAnchorPoint | null;
  warnings: string[];
};

function payloads(rows: BudgetInputRow[], kind: BudgetInputKind): Record<string, unknown>[] {
  return rows
    .filter((row) => row.input_kind === kind && row.payload)
    .map((row) => row.payload as Record<string, unknown>);
}

function buildFallbackInputs(rows: BudgetInputRow[]): MonthlyPlInputs | null {
  const params = rows.find((row) => row.input_kind === "params" && row.payload)?.payload;
  if (!params) return null;
  return {
    params: params as unknown as MonthlyPlInputs["params"],
    projects: payloads(rows, "project") as unknown as MonthlyPlInputs["projects"],
    fixedCosts: payloads(rows, "fixed_cost") as unknown as MonthlyPlInputs["fixedCosts"],
    recurringCashOutflows: payloads(rows, "cash_outflow") as unknown as MonthlyPlInputs["recurringCashOutflows"],
    projectRevenues: payloads(rows, "project_revenue") as unknown as MonthlyPlInputs["projectRevenues"],
    varCosts: payloads(rows, "var_cost") as unknown as MonthlyPlInputs["varCosts"],
    loans: payloads(rows, "loan") as unknown as MonthlyPlInputs["loans"],
    spots: payloads(rows, "spot") as unknown as MonthlyPlInputs["spots"],
    scenarios: payloads(rows, "scenario") as unknown as MonthlyPlInputs["scenarios"],
  };
}

function numericPayloadValue(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function shouldPersistRow(row: ReturnType<typeof toCompanyBudgetMonthlyRows>[number]): boolean {
  if (row.scope === "company") return true;
  if (row.budget_amount_yen !== 0) return true;
  return (
    numericPayloadValue(row.payload, "externalMember") > 0 ||
    numericPayloadValue(row.payload, "internalMember") > 0 ||
    numericPayloadValue(row.payload, "cashRevenue") > 0
  );
}

function recalculatedRunway(row: MonthlyPlSimulationResult["rows"][number], cashBalance: number): number {
  if (row.netCashFlow >= 0) return 999;
  return Math.round((cashBalance / Math.abs(row.netCashFlow)) * 10) / 10;
}

/**
 * freee 実残高でモデル残高を置き換える。
 * アンカーは「当月より前の最新の実績月」= 月末が確定した月に限定する (`cash-anchor.ts` 参照)。
 * 当月の残高は「締まった月の実残高 + 当月モデル月次CF」= モデル月末見込みになる。
 */
async function applyLatestActualCashAnchor(
  supabase: SupabaseClient,
  result: MonthlyPlSimulationResult
): Promise<{ result: MonthlyPlSimulationResult; anchor: CashAnchorPoint | null }> {
  const lastYm = String(result.rows.at(-1)?.ym ?? "");
  if (!lastYm) return { result, anchor: null };
  const { data, error } = await supabase
    .from("company_actual_monthly")
    .select("ym,actual_amount_yen,imported_at")
    .eq("scope", "company")
    .eq("category", "cash_balance")
    .lte("ym", lastYm)
    .order("ym", { ascending: false })
    .order("imported_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) throw new Error(`cash balance anchor load failed: ${error.message}`);

  // ym ごとに最新 imported_at の1件だけ残す
  const actualByYm = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ ym?: string | number; actual_amount_yen?: number | string | null }>) {
    const ym = String(row.ym ?? "");
    if (!ym || actualByYm.has(ym)) continue;
    const cash = Number(row.actual_amount_yen ?? 0);
    if (Number.isFinite(cash)) actualByYm.set(ym, cash);
  }
  if (actualByYm.size === 0) return { result, anchor: null };

  const anchor = resolveCashAnchor(
    result.rows.map((row) => ({
      ym: row.ym,
      actualCash: actualByYm.get(String(row.ym)) ?? null,
      modelCash: row.cashBalance,
    }))
  );
  const projected = projectCashFromAnchor(
    result.rows.map((row) => row.netCashFlow),
    anchor
  );
  const rows = result.rows.map((row, index) => {
    const cashBalance = projected[index];
    if (cashBalance == null) return row;
    return { ...row, cashBalance, runway: recalculatedRunway(row, cashBalance) };
  });
  return { result: { ...result, rows }, anchor };
}

async function loadFallbackInputRows(supabase: SupabaseClient): Promise<{
  rows: BudgetInputRow[];
  version: string | null;
}> {
  const { data, error } = await supabase
    .from("company_budget_inputs")
    .select("input_kind,source_id,label,payload,version,updated_at")
    .eq("source", "gas_monthly_pl")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1000);
  if (error) throw new Error(`company_budget_inputs fallback load failed: ${error.message}`);

  const allRows = (data ?? []) as BudgetInputRow[];
  const paramsRow = allRows.find((row) => row.input_kind === "params" && row.payload);
  const version = paramsRow?.version ?? null;
  return {
    rows: version ? allRows.filter((row) => row.version === version) : allRows,
    version,
  };
}

export async function refreshLiveMonthlyPlBudget(
  supabase: SupabaseClient,
  options: { sourceRef?: string; persistForecast?: boolean } = {}
): Promise<LiveMonthlyPlBudgetRefreshResult> {
  const fallback = await loadFallbackInputRows(supabase);
  const fallbackInputs = buildFallbackInputs(fallback.rows);
  if (!fallbackInputs?.params) throw new Error("monthly PL fallback params not found");

  const startYm = Number(fallbackInputs.params.startYm);
  const months = Number(fallbackInputs.params.months);
  if (!Number.isFinite(startYm) || !Number.isFinite(months) || months <= 0) {
    throw new Error("monthly PL fallback params are invalid");
  }

  const live = await buildLiveMonthlyPlInputs(supabase, {
    startYm,
    months,
    fallbackParams: fallbackInputs.params,
    fallbackLoans: fallbackInputs.loans,
    fallbackSpots: fallbackInputs.spots,
    fallbackScenarios: fallbackInputs.scenarios,
    persistForecast: options.persistForecast === true,
  });
  const anchored = await applyLatestActualCashAnchor(supabase, runMonthlyPlSimulation(live.inputs, null));
  const result = anchored.result;
  const cashAnchor = anchored.anchor;
  const sourceRef = options.sourceRef ?? "/management-score live monthly PL";
  const sourceRows = toCompanyBudgetMonthlyRows(result).filter(shouldPersistRow);

  const { data: runRow, error: runError } = await supabase
    .from("company_budget_simulation_runs")
    .insert({
      scenario_id: null,
      version: LIVE_MONTHLY_PL_VERSION,
      source: LIVE_MONTHLY_PL_SOURCE,
      source_ref: sourceRef,
      engine_version: LIVE_MONTHLY_PL_ENGINE_VERSION,
      params: { ...result.params, cashAnchor },
    })
    .select("id")
    .single();
  if (runError || !runRow) {
    throw new Error(`live monthly PL simulation run insert failed: ${runError?.message ?? "no row"}`);
  }
  const simulationRunId = String(runRow.id);

  const { error: deleteError } = await supabase
    .from("company_budget_monthly")
    .delete()
    .eq("source", LIVE_MONTHLY_PL_SOURCE)
    .eq("version", LIVE_MONTHLY_PL_VERSION);
  if (deleteError) throw new Error(`live monthly PL cleanup failed: ${deleteError.message}`);

  const insertRows = sourceRows.map((row) => ({
    simulation_run_id: simulationRunId,
    ym: row.ym,
    scope: row.scope,
    project_id: row.project_id,
    category: row.category,
    account_name: row.account_name,
    budget_amount_yen: row.budget_amount_yen,
    cash_amount_yen: row.cash_amount_yen,
    runway_months: row.runway_months,
    payload: row.payload,
    note: "Materialized from OS live tables for management monthly trial balance",
    source: LIVE_MONTHLY_PL_SOURCE,
    source_ref: sourceRef,
    version: LIVE_MONTHLY_PL_VERSION,
  }));

  for (let i = 0; i < insertRows.length; i += 500) {
    const { error } = await supabase.from("company_budget_monthly").insert(insertRows.slice(i, i + 500));
    if (error) throw new Error(`live monthly PL insert failed: ${error.message}`);
  }

  return {
    ok: true,
    source: LIVE_MONTHLY_PL_SOURCE,
    version: LIVE_MONTHLY_PL_VERSION,
    simulationRunId,
    startYm,
    months,
    rowCount: insertRows.length,
    companyRowCount: insertRows.filter((row) => row.scope === "company").length,
    projectRowCount: insertRows.filter((row) => row.scope === "project").length,
    inputFallbackVersion: fallback.version,
    cashAnchor,
    warnings: live.warnings,
  };
}
