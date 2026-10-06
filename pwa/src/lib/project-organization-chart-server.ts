import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ORGANIZATION_CHART_CONFIG_KEY, parseProjectOrganizationChart } from "./project-organization-chart";
/** 呼出元で当該PJの閲覧認可を確認。組織図用の登録値だけを読む。 */
export async function loadProjectOrganizationChart(db: SupabaseClient, projectId: string) {
  const { data, error } = await db.from("project_config").select("value").eq("project_id", projectId).eq("key", ORGANIZATION_CHART_CONFIG_KEY).maybeSingle();
  if (error) throw new Error(error.message);
  return parseProjectOrganizationChart(data?.value);
}
