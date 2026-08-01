import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Narrow, allowlisted DTO for external (workspace_account) viewers of the shared project
// workspace. This is a DELIBERATELY separate read path from getProjectWorkspaceBundle
// (project-workspace.ts) — it must never call that function or grow to select member names,
// effort/hours, evidence, source attribution, internal management (objectives/outcomes/issues/
// hypotheses/decisions/funding/partners), or contact info. If external viewers need more data
// later, extend this file's own narrow selects — do not widen scope by reusing the internal
// bundle. scripts/check_external_project_workspace_contract.mjs enforces this structurally.
export type ExternalProjectWorkspaceBundle = {
  project: {
    projectId: string;
    projectName: string;
    status: string;
  };
  planCycle: {
    planCycleId: string;
    status: string;
    periodStartYm: string | null;
    periodEndYm: string | null;
  } | null;
  milestones: Array<{
    milestoneId: string;
    title: string;
    targetYm: string | null;
    progressPct: number;
  }>;
};

export async function getExternalProjectWorkspaceBundle(
  projectId: string,
): Promise<ExternalProjectWorkspaceBundle | null> {
  const db = createAdminClient();

  const { data: project, error: projectError } = await db
    .from("projects")
    .select("project_id,project_name,status")
    .eq("project_id", projectId)
    .maybeSingle();
  if (projectError) throw new Error(`external project workspace project: ${projectError.message}`);
  if (!project) return null;

  const { data: planCycleRows, error: planError } = await db
    .from("value_plan_cycles")
    .select("plan_cycle_id,status,period_start_ym,period_end_ym")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (planError) throw new Error(`external project workspace plan: ${planError.message}`);

  const currentPlan = (planCycleRows ?? []).find((row) => row.status === "active") ?? (planCycleRows ?? [])[0] ?? null;

  let milestones: ExternalProjectWorkspaceBundle["milestones"] = [];
  if (currentPlan?.plan_cycle_id) {
    const { data: milestoneRows, error: milestoneError } = await db
      .from("value_milestones")
      .select("milestone_id,title,target_ym,sort_order,is_active")
      .eq("plan_cycle_id", currentPlan.plan_cycle_id)
      .eq("is_active", true)
      .order("sort_order")
      .limit(40);
    if (milestoneError) throw new Error(`external project workspace milestones: ${milestoneError.message}`);

    const milestoneIds = (milestoneRows ?? []).map((row) => String(row.milestone_id));
    let progressRows: Array<{ milestone_key: string; ym: string; progress_pct: number }> = [];
    if (milestoneIds.length > 0) {
      const { data, error } = await db
        .from("milestone_monthly_progress")
        .select("milestone_key,ym,progress_pct")
        .in("milestone_key", milestoneIds)
        .order("ym", { ascending: false });
      if (error) throw new Error(`external project workspace progress: ${error.message}`);
      progressRows = (data ?? []).map((row) => ({
        milestone_key: String(row.milestone_key),
        ym: String(row.ym),
        progress_pct: Number(row.progress_pct || 0),
      }));
    }

    milestones = (milestoneRows ?? []).slice(0, 8).map((row) => {
      const progress = progressRows.find((item) => item.milestone_key === String(row.milestone_id));
      return {
        milestoneId: String(row.milestone_id),
        title: String(row.title),
        targetYm: row.target_ym ? String(row.target_ym) : null,
        progressPct: Math.max(0, Math.min(100, Number(progress?.progress_pct || 0))),
      };
    });
  }

  return {
    project: {
      projectId: String(project.project_id),
      projectName: String(project.project_name),
      status: String(project.status),
    },
    planCycle: currentPlan
      ? {
          planCycleId: String(currentPlan.plan_cycle_id),
          status: String(currentPlan.status),
          periodStartYm: currentPlan.period_start_ym ? String(currentPlan.period_start_ym) : null,
          periodEndYm: currentPlan.period_end_ym ? String(currentPlan.period_end_ym) : null,
        }
      : null,
    milestones,
  };
}
