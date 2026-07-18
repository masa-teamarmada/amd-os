import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { buildLiveMonthlyPlInputs } from "@/lib/finance/live-monthly-pl-inputs";
import type { MonthlyPlInputs } from "@/lib/finance/monthly-pl-simulation";

type InputRow = {
  input_kind: string;
  payload: Record<string, unknown> | null;
};

function snapshotInputs(rows: InputRow[]): MonthlyPlInputs | null {
  const payloads = (kind: string) => rows
    .filter((row) => row.input_kind === kind && row.payload)
    .map((row) => row.payload as Record<string, unknown>);
  const params = rows.find((row) => row.input_kind === "params" && row.payload)?.payload;
  if (!params) return null;
  return {
    params: params as unknown as MonthlyPlInputs["params"],
    projects: payloads("project") as unknown as MonthlyPlInputs["projects"],
    fixedCosts: payloads("fixed_cost") as unknown as MonthlyPlInputs["fixedCosts"],
    recurringCashOutflows: payloads("cash_outflow") as unknown as MonthlyPlInputs["recurringCashOutflows"],
    projectRevenues: payloads("project_revenue") as unknown as MonthlyPlInputs["projectRevenues"],
    varCosts: payloads("var_cost") as unknown as MonthlyPlInputs["varCosts"],
    loans: payloads("loan") as unknown as MonthlyPlInputs["loans"],
    spots: payloads("spot") as unknown as MonthlyPlInputs["spots"],
    scenarios: payloads("scenario") as unknown as MonthlyPlInputs["scenarios"],
  };
}

/**
 * macOS のinteractive finance simulationが、PWA `/management-score` と同じ
 * live input builderを使うためのadmin-only bridge。計算・保存は一切しない。
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { data, error } = await auth.supabase
    .from("company_budget_inputs")
    .select("input_kind,payload")
    .eq("source", "gas_monthly_pl")
    .order("input_kind", { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const fallback = snapshotInputs((data ?? []) as InputRow[]);
  if (!fallback?.params) {
    return NextResponse.json({ ok: false, error: "monthly PL inputs are unavailable" }, { status: 404 });
  }

  try {
    const live = await buildLiveMonthlyPlInputs(auth.supabase, {
      startYm: fallback.params.startYm,
      months: fallback.params.months,
      fallbackParams: fallback.params,
      fallbackLoans: fallback.loans,
      fallbackSpots: fallback.spots,
      fallbackScenarios: fallback.scenarios,
      persistForecast: false,
    });
    return NextResponse.json({ ok: true, source: "live", inputs: live.inputs, warnings: live.warnings });
  } catch (liveError) {
    return NextResponse.json({
      ok: true,
      source: "snapshot",
      inputs: fallback,
      warnings: [liveError instanceof Error ? liveError.message : String(liveError)],
    });
  }
}
