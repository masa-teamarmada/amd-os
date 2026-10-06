import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseProductDescription } from "./project-product-description";

/** 当該DDへの入場認可後、創業背景として登録した文書だけを取得する。 */
export async function loadProjectFoundingBackground(db: SupabaseClient, projectId: string) {
  const { data, error } = await db.from("project_config").select("value")
    .eq("project_id", projectId).eq("key", "founding_background").maybeSingle();
  if (error) throw new Error(error.message);
  return parseProductDescription(data?.value, "創業の背景と社会課題");
}
