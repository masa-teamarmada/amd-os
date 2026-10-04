import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectTechResponse } from "./project-tech-client";

/** 3領域が読む技術台帳の正本。呼出側がPJ入場権限を確認する。 */
export async function loadProjectTechData(db: SupabaseClient, projectId: string, canEdit = false): Promise<ProjectTechResponse> {
  const [topics, entries, fragments] = await Promise.all([
    db.from("project_tech_topics").select("*").eq("project_id", projectId).neq("status", "archived").order("sort_order").order("updated_at", { ascending: false }),
    db.from("project_tech_entries").select("*").eq("project_id", projectId).order("sort_order").order("row_label"),
    db.from("project_knowledge").select("id, category, entity_name, fact_text, confidence, source, updated_at").eq("project_id", projectId).eq("status", "active").in("category", ["tech", "term", "competitor"]).order("updated_at", { ascending: false }).limit(300),
  ]);
  const error = topics.error || entries.error || fragments.error;
  if (error) throw new Error(error.message);
  return { canEdit, topics: topics.data ?? [], entries: entries.data ?? [], fragments: fragments.data ?? [] } as ProjectTechResponse;
}
