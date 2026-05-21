import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import {
  runMonthlyPlSimulation,
  toCompanyBudgetMonthlyRows,
  type BudgetInputKind,
  type MonthlyPlInputs,
} from "@/lib/finance/monthly-pl-simulation";

export const maxDuration = 60;

type PersistMode = false | "simulation_only" | "company_monthly";

interface SimulateRequestBody {
  inputs?: MonthlyPlInputs;
  scenarioId?: string | null;
  version?: string;
  sourceRef?: string;
  engineVersion?: string;
  persist?: PersistMode;
}

function toInputRows(inputs: MonthlyPlInputs, version: string) {
  const rows: Array<Record<string, unknown>> = [];

  const push = (
    inputKind: BudgetInputKind,
    sourceId: string | null,
    payload: Record<string, unknown>,
    options: { ym?: string | null; projectId?: string | null; label?: string | null; amountYen?: number | null } = {}
  ) => {
    rows.push({
      input_kind: inputKind,
      source_id: sourceId,
      ym: options.ym ?? null,
      project_id: options.projectId ?? null,
      label: options.label ?? null,
      amount_yen: options.amountYen ?? null,
      payload,
      source: "gas_monthly_pl",
      version,
    });
  };

  push("params", "params", inputs.params as unknown as Record<string, unknown>);
  for (const project of inputs.projects) {
    push("project", project.projectId, project as unknown as Record<string, unknown>, {
      projectId: project.projectId,
      label: project.projectName,
      amountYen: project.monthlyRevenue,
    });
  }
  for (const fixedCost of inputs.fixedCosts) {
    push("fixed_cost", fixedCost.costId, fixedCost as unknown as Record<string, unknown>, {
      label: fixedCost.costName,
      amountYen: fixedCost.monthlyCost,
    });
  }
  for (const row of inputs.projectRevenues ?? []) {
    push("project_revenue", `${row.projectId}_${row.ym}`, row as unknown as Record<string, unknown>, {
      ym: String(row.ym),
      projectId: row.projectId,
      amountYen: row.monthlyRevenue ?? null,
    });
  }
  for (const row of inputs.varCosts ?? []) {
    push("var_cost", `${row.varCostId}_${row.ym}`, row as unknown as Record<string, unknown>, {
      ym: String(row.ym),
      label: row.costName,
      amountYen: row.amount,
    });
  }
  for (const row of inputs.loans ?? []) {
    push("loan", row.loanId, row as unknown as Record<string, unknown>, {
      label: row.loanName,
      amountYen: row.principal,
    });
  }
  for (const row of inputs.spots ?? []) {
    push("spot", row.spotId, row as unknown as Record<string, unknown>, {
      ym: String(row.ym),
      label: row.spotName,
      amountYen: row.amount,
    });
  }
  for (const row of inputs.scenarios ?? []) {
    push("scenario", `${row.scenarioId}_${row.paramKey}`, row as unknown as Record<string, unknown>, {
      label: row.scenarioName ?? row.scenarioId,
    });
  }

  return rows;
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  try {
    const body = (await req.json()) as SimulateRequestBody;
    if (!body.inputs?.params || !Array.isArray(body.inputs.projects) || !Array.isArray(body.inputs.fixedCosts)) {
      return NextResponse.json(
        { ok: false, error: "inputs.params, inputs.projects, inputs.fixedCosts are required" },
        { status: 400 }
      );
    }

    const version = body.version || "baseline";
    const engineVersion = body.engineVersion || "gas-port-2026-05-18-v1";
    const result = runMonthlyPlSimulation(body.inputs, body.scenarioId ?? null);
    const budgetRows = toCompanyBudgetMonthlyRows(result);

    let simulationRunId: string | null = null;
    if (body.persist) {
      const supabase = createAdminClient();
      const { data: runRow, error: runError } = await supabase
        .from("company_budget_simulation_runs")
        .insert({
          scenario_id: body.scenarioId ?? null,
          version,
          source: "gas_monthly_pl",
          source_ref: body.sourceRef ?? null,
          engine_version: engineVersion,
          params: result.params,
        })
        .select("id")
        .single();
      if (runError) throw runError;
      simulationRunId = String(runRow.id);

      const inputRows = toInputRows(body.inputs, version);
      if (inputRows.length > 0) {
        const { error } = await supabase.from("company_budget_inputs").insert(inputRows);
        if (error) throw error;
      }

      if (body.persist === "company_monthly") {
        const companyRows = budgetRows
          .filter((row) => row.scope === "company")
          .map((row) => ({
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
            source: "gas_monthly_pl",
            source_ref: body.sourceRef ?? null,
            version,
          }));
        if (companyRows.length > 0) {
          const { error } = await supabase.from("company_budget_monthly").insert(companyRows);
          if (error) throw error;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      scenarioId: body.scenarioId ?? null,
      version,
      engineVersion,
      simulationRunId,
      result,
      budgetRows,
    });
  } catch (err) {
    console.error("[management-score finance simulate]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
