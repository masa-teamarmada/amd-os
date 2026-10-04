import "server-only";
import { createAdminClient } from "./supabase/admin";
import { normalizeBusinessPlanPhases, type ProjectBusinessPlan } from "./project-business-plan";

export async function loadProjectBusinessPlan(projectId: string): Promise<ProjectBusinessPlan | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("project_business_plans")
    .select("project_id, matrix_note, source_note, phases_json, updated_at")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    projectId: data.project_id as string,
    matrixNote: (data.matrix_note as string | null) ?? null,
    sourceNote: (data.source_note as string | null) ?? null,
    phases: normalizeBusinessPlanPhases(data.phases_json),
    updatedAt: (data.updated_at as string | null) ?? null,
  };
}

