import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_DESCRIPTION_CONFIG_KEY, parseProductDescription } from "./project-product-description";

/** 呼出元が当該DDの閲覧権限を確認した後、そのPJの登録資料だけを取得する。 */
export async function loadProjectProductDescription(db: SupabaseClient, projectId: string) {
  const { data, error } = await db.from("project_config").select("value")
    .eq("project_id", projectId).eq("key", PRODUCT_DESCRIPTION_CONFIG_KEY).maybeSingle();
  if (error) throw new Error(error.message);
  return parseProductDescription(data?.value);
}
