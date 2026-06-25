import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildLiveMonthlyPlInputs } from "@/lib/finance/live-monthly-pl-inputs";
import { runMonthlyPlSimulation, type MonthlyPlInputs } from "@/lib/finance/monthly-pl-simulation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type BudgetInputRow = {
  input_kind: string;
  payload: Record<string, unknown> | null;
};

type ActualCashRow = {
  ym: string;
  actual_amount_yen: number | null;
};

type CashSource = "actual" | "forecast";

function isYm(value: string | null): value is string {
  return Boolean(value && /^\d{6}$/.test(value));
}

function payloads(inputRows: BudgetInputRow[], kind: string): Record<string, unknown>[] {
  return inputRows
    .filter((row) => row.input_kind === kind)
    .map((row) => row.payload ?? {});
}

function buildSnapshotInputs(inputRows: BudgetInputRow[]): MonthlyPlInputs | null {
  const params = payloads(inputRows, "params")[0];
  if (!params) return null;
  return {
    params: params as unknown as MonthlyPlInputs["params"],
    projects: payloads(inputRows, "project") as unknown as MonthlyPlInputs["projects"],
    fixedCosts: payloads(inputRows, "fixed_cost") as unknown as MonthlyPlInputs["fixedCosts"],
    varCosts: payloads(inputRows, "var_cost") as unknown as MonthlyPlInputs["varCosts"],
    projectRevenues: payloads(inputRows, "project_revenue") as unknown as MonthlyPlInputs["projectRevenues"],
    loans: payloads(inputRows, "loan") as unknown as MonthlyPlInputs["loans"],
    spots: payloads(inputRows, "spot") as unknown as MonthlyPlInputs["spots"],
    scenarios: payloads(inputRows, "scenario") as unknown as MonthlyPlInputs["scenarios"],
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if ((from && !isYm(from)) || (to && !isYm(to))) {
      return NextResponse.json({ ok: false, error: "from/to must be YYYYMM" }, { status: 400 });
    }

    const admin = createAdminClient();
    const [inputRes, actualCashRes] = await Promise.all([
      admin
        .from("company_budget_inputs")
        .select("input_kind,payload")
        .eq("source", "gas_monthly_pl")
        .limit(500),
      admin
        .from("company_budget_actual_monthly")
        .select("ym,actual_amount_yen")
        .eq("scope", "company")
        .eq("category", "cash_balance")
        .order("ym", { ascending: true }),
    ]);

    if (inputRes.error) throw inputRes.error;
    if (actualCashRes.error) throw actualCashRes.error;

    const snapshotInputs = buildSnapshotInputs((inputRes.data ?? []) as BudgetInputRow[]);
    if (!snapshotInputs?.params) {
      return NextResponse.json({ ok: false, error: "monthly PL inputs not found" }, { status: 404 });
    }

    const live = await buildLiveMonthlyPlInputs(admin, {
      startYm: Number(snapshotInputs.params.startYm),
      months: Number(snapshotInputs.params.months),
      fallbackParams: snapshotInputs.params,
      fallbackLoans: snapshotInputs.loans,
      fallbackSpots: snapshotInputs.spots,
      fallbackScenarios: snapshotInputs.scenarios,
      persistForecast: false,
    });
    const simulation = runMonthlyPlSimulation(live.inputs, null);

    const actualCashByYm = new Map<string, number>();
    for (const row of (actualCashRes.data ?? []) as ActualCashRow[]) {
      if (row.actual_amount_yen == null) continue;
      actualCashByYm.set(row.ym, (actualCashByYm.get(row.ym) ?? 0) + row.actual_amount_yen);
    }

    const rows = simulation.rows
      .map((row) => {
        const ym = String(row.ym).padStart(6, "0");
        const actualCashBalance = actualCashByYm.get(ym) ?? null;
        const source: CashSource = actualCashBalance == null ? "forecast" : "actual";
        return {
          ym,
          cashBalance: actualCashBalance ?? row.cashBalance,
          budgetCashBalance: row.cashBalance,
          actualCashBalance,
          runwayMonths: row.runway,
          source,
        };
      })
      .filter((row) => (!from || row.ym >= from) && (!to || row.ym <= to));

    return NextResponse.json(
      {
        ok: true,
        source: "management-score-live",
        warnings: live.warnings,
        rows,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[api/finance/live-cash-balances]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
