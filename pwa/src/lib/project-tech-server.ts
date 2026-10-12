import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectTechResponse } from "./project-tech-client";
import { amieProjectDdTechTopic, amieTechDisclosureStatus } from "./amie-tech-disclosure-server";
import { techLedgerTabOf, type TechLedgerTab, type TechTopic, type TechEntry } from "./project-tech";

/** 3領域が読む技術台帳の正本。呼出側がPJ入場権限を確認する。 */
export async function loadProjectTechData(db: SupabaseClient, projectId: string, canEdit = false, audience: "internal" | "dd" | "shared" = "internal", mode?: TechLedgerTab): Promise<ProjectTechResponse> {
  const [topics, entries, fragments] = await Promise.all([
    db.from("project_tech_topics").select("*").eq("project_id", projectId).neq("status", "archived").order("sort_order").order("updated_at", { ascending: false }),
    db.from("project_tech_entries").select("*").eq("project_id", projectId).order("sort_order").order("row_label"),
    db.from("project_knowledge").select("id, category, entity_name, fact_text, confidence, source, updated_at").eq("project_id", projectId).eq("status", "active").in("category", ["tech", "term", "competitor"]).order("updated_at", { ascending: false }).limit(300),
  ]);
  const error = topics.error || entries.error || fragments.error;
  if (error) throw new Error(error.message);
  const scopedTopics = ((topics.data ?? []) as TechTopic[]).filter(t => !mode || techLedgerTabOf(t) === mode);
  const ids = new Set(scopedTopics.map(t => t.tech_topic_id));
  const scopedEntries = ((entries.data ?? []) as TechEntry[]).filter(e => ids.has(e.tech_topic_id));
  if (audience === "internal") return { audience, canEdit,
    ddPreview: (() => { const p = scopedTopics.filter(t => techLedgerTabOf(t) === "technology").map(t => amieProjectDdTechTopic(t, scopedEntries)).filter(p => p !== null); return { topics:p.map(p=>p.topic), entries:p.flatMap(p=>p.entries) }; })(),
    topics: scopedTopics.map(t => ({ ...t, disclosure_status: amieTechDisclosureStatus(t as unknown as Record<string, unknown>, "topic") })),
    entries: scopedEntries.map(e => ({ ...e, disclosure_status: amieTechDisclosureStatus(e as unknown as Record<string, unknown>, "entry") })), fragments: fragments.data ?? [] } as ProjectTechResponse;
  const projected = scopedTopics.map(t => amieProjectDdTechTopic(t, scopedEntries)).filter(p => p !== null);
  return { audience, canEdit: false, topics: projected.map(p => p.topic), entries: projected.flatMap(p => p.entries), fragments: [] };
}
