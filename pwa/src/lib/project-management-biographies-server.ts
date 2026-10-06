import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MANAGEMENT_BIOGRAPHIES_CONFIG_KEY, parseManagementBiographies } from "./project-management-biographies";
/** 呼出元が当該PJの閲覧認可を確認した後、明示登録された略歴だけを取得。 */
export async function loadProjectManagementBiographies(db: SupabaseClient, projectId: string) {
  const { data, error } = await db.from("project_config").select("value").eq("project_id", projectId).eq("key", MANAGEMENT_BIOGRAPHIES_CONFIG_KEY).maybeSingle();
  if (error) throw new Error(error.message);
  return parseManagementBiographies(data?.value);
}
