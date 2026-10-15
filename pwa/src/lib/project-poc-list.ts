import { createHash } from "node:crypto";
import { amieIsEffluentTopic, amieReadEffluentExperiment } from "./amie-effluent-experiments.ts";
import { amieTechFieldLevel } from "./amie-tech-disclosure-model.ts";
import type { ProjectTechResponse } from "./project-tech-client";
import type { TechEntry, TechTopic } from "./project-tech";

export type ProjectPocListData = Pick<ProjectTechResponse,"topics"|"entries"|"canEdit"|"audience"> & {
  /** 内部の編集者にだけ返す。開示用の行から編集元の完全な行を引く。 */
  editEntryIds?: Record<string, string>;
};
export type PocAudience = "internal" | "shared" | "dd";

/** 掲載する行と共有先は元トピックに明示する。新しい行を無断で外部へ追加しない。 */
export function projectPocListData(projectId:string, topics:TechTopic[], entries:TechEntry[], audience:PocAudience, canEdit=false):ProjectPocListData {
  const own = topics.filter(t=>t.project_id===projectId && amieIsEffluentTopic(t));
  if(audience==="internal") {
    const ids=new Set(own.map(t=>t.tech_topic_id));
    const ownEntries=entries.filter(e=>e.project_id===projectId&&ids.has(e.tech_topic_id));
    return {audience,canEdit,topics:own,entries:ownEntries,...(canEdit?{editEntryIds:Object.fromEntries(ownEntries.map(e=>[createHash("sha256").update(`${projectId}:${e.tech_entry_id}`).digest("hex"),e.tech_entry_id]))}:{})};
  }
  const result:ProjectPocListData={audience,canEdit:false,topics:[],entries:[]};
  for(const topic of own){
    if(amieTechFieldLevel(topic,["presentation"])==="core")continue;
    const share=topic.presentation?.poc_sharing as {version?:unknown;workspace?:unknown;dd?:unknown;entry_ids?:unknown}|undefined;
    if(share?.version!==1 || (audience==="dd"?share.dd:share.workspace)!==true || !Array.isArray(share.entry_ids))continue;
    const allowed=new Set(share.entry_ids.filter((x):x is string=>typeof x==="string"));
    result.topics.push({tech_topic_id:topic.tech_topic_id,project_id:projectId,block_kind:topic.block_kind,tech_domain:null,sort_order:topic.sort_order,status:topic.status,confidentiality:"internal",source_kind:topic.source_kind,needs_check:false,created_at:topic.created_at,updated_at:topic.updated_at,title:"PoCリスト",summary:null,body_md:null,source_ref:null,source_url:null,check_reason:null,created_by:null,updated_by:null,disclosure:null,disclosure_level:"dd_summary",presentation:{version:1,kind:"effluent_ledger"}});
    for(const entry of entries){
      if(entry.project_id!==projectId || entry.tech_topic_id!==topic.tech_topic_id || !allowed.has(entry.tech_entry_id) || amieTechFieldLevel(entry,["experiment","row_label","value_text"])==="core")continue;
      const e=amieReadEffluentExperiment(entry.experiment);if(!e)continue;
      const v=e.visual;
      result.entries.push({tech_entry_id:createHash("sha256").update(`${projectId}:${entry.tech_entry_id}`).digest("hex"),tech_topic_id:entry.tech_topic_id,project_id:projectId,row_label:entry.row_label,col_label:null,value_min:null,value_max:null,unit:null,rating:entry.rating,value_text:entry.value_text,observed_on:entry.observed_on,confidence:entry.confidence,source_kind:entry.source_kind,source_ref:entry.source_ref?"出典記録あり（社内正本）":null,source_url:null,condition_text:null,note:null,sort_order:entry.sort_order,needs_check:entry.needs_check,check_reason:null,created_at:entry.created_at,updated_at:entry.updated_at,created_by:null,updated_by:null,disclosure:null,disclosure_level:"dd_summary",experiment:{version:1,type_key:createHash("sha256").update(`${projectId}:${e.type_key}`).digest("hex"),kind:e.kind,status:e.status,identity_confirmed:e.identity_confirmed,provider:e.provider,components:v?.element_symbols.join(" ")??"",before:e.before,after:e.after,received_on:e.received_on,tested_on:e.tested_on,route:"",sampling_point:"",conditions:"",follow_up:"",source_entry_ids:[],source_sample_ids:[],source_test_ids:[],graphs:[],...(v?{visual:{element_symbols:v.element_symbols,water_types:v.water_types,weather:v.weather,weather_reason:v.weather_reason,analysis_note:"",changes:v.changes.map(c=>({parameter:c.parameter,before:c.before,after:c.after,time:c.time,note:"",effect:c.effect}))}}:{})}});
    }
  }
  return result;
}
