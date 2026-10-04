import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FINANCE_CASHFLOW_COLUMNS, type ProjectFinancePageData } from "./project-finance-page-data";
import { fetchBzm22PilotProject } from "./bzm-2-2-pilot-ui.server";

/** 標準試算表が使う6種類の元データ。DD用の省略版を作らない。 */
export async function loadProjectFinancePage(db: SupabaseClient, projectId: string): Promise<ProjectFinancePageData> {
  const [pl, plans, grants, venture, pilot] = await Promise.all([
    db.from("project_pl_monthly").select("id,project_id,ym,revenue_yen,cogs_yen,personnel_yen,rd_yen,marketing_yen,other_opex_yen,notes").eq("project_id", projectId).order("ym"),
    db.from("project_capital_plans").select("document_json").eq("project_id", projectId).eq("status", "active").order("updated_at", { ascending: false }).limit(1),
    db.from("project_grants").select("grant_name,agency,amount_yen,disbursed_yen,adopted_date,period_start_ym,period_end_ym").eq("project_id", projectId),
    db.from("project_ventures").select("founded_at").eq("project_id", projectId).maybeSingle(),
    fetchBzm22PilotProject(projectId),
  ]);
  const error = pl.error || plans.error || grants.error || venture.error;
  if (error) throw new Error(error.message);
  const cashRows: ProjectFinancePageData["cashRows"] = [];
  for (let from = 0; ; from += 500) {
    const result = await db.from("project_monthly_cashflow").select(FINANCE_CASHFLOW_COLUMNS).eq("project_id", projectId).order("ym").range(from, from + 499);
    if (result.error) throw new Error(result.error.message);
    cashRows.push(...(result.data ?? []) as unknown as ProjectFinancePageData["cashRows"]);
    if ((result.data?.length ?? 0) < 500) break;
  }
  return { plRows: pl.data ?? [], cashRows, capitalPlan: plans.data?.[0]?.document_json ?? null, grants: grants.data ?? [], foundedAt: venture.data?.founded_at ?? null, pilot };
}
