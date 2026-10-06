import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDevelopmentIssues } from "./project-development-issues";
/** 当該PJの閲覧認可を済ませてから呼ぶ。明示登録された課題だけを読む。 */
export async function loadProjectDevelopmentIssues(db: SupabaseClient, projectId: string) {
  const { data, error } = await db.from("project_config").select("value").eq("project_id", projectId).eq("key", "development_issues").maybeSingle();
  if (error) throw new Error(error.message);
  return parseDevelopmentIssues(data?.value);
}
