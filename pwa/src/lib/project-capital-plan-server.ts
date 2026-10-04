import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CapitalPlanPageData } from "./project-capital-plan-data";

export async function loadCapitalPlanPage(db: SupabaseClient, projectId: string): Promise<CapitalPlanPageData> {
  const [plans, versions] = await Promise.all([
    db.from("project_capital_plans").select("id,project_id,name,status,revision,document_json,created_at,updated_at").eq("project_id", projectId).order("updated_at", { ascending: false }),
    db.from("project_capital_plan_versions").select("id,plan_id,project_id,version,document_json,source_revision,validation_summary,published_at").eq("project_id", projectId).order("version", { ascending: false }),
  ]);
  if (plans.error || versions.error) throw new Error((plans.error || versions.error)!.message);
  return { plans: plans.data ?? [], versions: versions.data ?? [] } as CapitalPlanPageData;
}
