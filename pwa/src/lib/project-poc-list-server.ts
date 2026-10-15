import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import {amieAllTechRows} from "./project-tech-server";
import {projectPocListData,type PocAudience} from "./project-poc-list";
import {redactProjectPartnerNames} from "./project-partner-disclosure";
import {loadProjectPartnerDisclosure} from "./project-partner-disclosure-server";
import type {TechTopic,TechEntry} from "./project-tech";
export async function loadProjectPocList(db:SupabaseClient,projectId:string,audience:PocAudience="internal",canEdit=false){
  const topics=await amieAllTechRows<TechTopic>(()=>db.from("project_tech_topics").select("*").eq("project_id",projectId).neq("status","archived").contains("presentation",{version:1,kind:"effluent_ledger"}).order("sort_order").order("tech_topic_id"));
  const entries=topics.length?await amieAllTechRows<TechEntry>(()=>db.from("project_tech_entries").select("*").eq("project_id",projectId).in("tech_topic_id",topics.map(t=>t.tech_topic_id)).order("sort_order").order("tech_entry_id")):[];
  const data=projectPocListData(projectId,topics,entries,audience,canEdit);
  return audience==="internal"?data:redactProjectPartnerNames(data,await loadProjectPartnerDisclosure(db,projectId));
}
