import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseMarketResearch } from "./project-market-research";
/** 入場認可後、指定PJの登録された調査資料だけを取得する。 */
export async function loadProjectMarketResearch(db: SupabaseClient, projectId: string) {
  const {data,error} = await db.from("project_config").select("value").eq("project_id",projectId).eq("key","market_research").maybeSingle();
  if (error) throw new Error(error.message);
  return parseMarketResearch(data?.value);
}
