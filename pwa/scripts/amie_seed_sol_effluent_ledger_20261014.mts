import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { amieValidateEffluentEntry, amieEffluentRows, amieEffluentSummary } from "../src/lib/amie-effluent-experiments.ts";
import type { TechEntry } from "../src/lib/project-tech.ts";

// レビュー済みデータとPDFから無加工で抽出した原グラフだけを一度登録する。
// 読み取りとSQL作成が既定。--applyでStorage保存と、正規apply_ddl用SQLを作る。
const evidenceDir = process.env.AMIE_EFFLUENT_EVIDENCE_DIR;
if (!evidenceDir) throw new Error("AMIE_EFFLUENT_EVIDENCE_DIR is required");
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^['"]|['"]$/g,"")];}));
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const fixture=JSON.parse(readFileSync("scripts/data/amie_sol_effluent_ledger_20261014.json","utf8"));
const manifest=JSON.parse(readFileSync(`${evidenceDir}/元グラフ/画像出典.json`,"utf8")) as Array<{name:string;file:string;source:string;page:number;sha256:string;pdf_soft_mask_preserved:boolean}>;
const graphMap=new Map(manifest.map(g=>[g.name,g]));
const uploads=[] as Array<{path:string;bytes:Buffer}>;
for (const record of fixture.rows) {
  record.entry.experiment.graphs=record.graph_names.map((name:string)=>{
    const graph=graphMap.get(name); if(!graph)throw new Error(`Missing source graph: ${name}`);
    if(!graph.pdf_soft_mask_preserved)throw new Error("PDF image soft mask must be preserved");
    const bytes=readFileSync(graph.file);
    const hash=createHash("sha256").update(bytes).digest("hex");
    if(hash!==graph.sha256)throw new Error("Source graph hash changed");
    const path=`p21/${record.entry.tech_entry_id}/${hash}.png`;
    uploads.push({path,bytes});
    return {path,caption:name.replaceAll("_"," "),source_ref:`${graph.source} p.${graph.page}（PDF内の原画像、無加工）`};
  });
  amieValidateEffluentEntry(record.entry);
}
const summary=amieEffluentSummary(amieEffluentRows(fixture.rows.map((r:{entry:TechEntry})=>r.entry)));
if(summary.completed!==9 || fixture.rows.length!==49)throw new Error("Unexpected reconciled count");
const ids=fixture.rows.map((r:{entry:TechEntry})=>r.entry.tech_entry_id);
const [topics,entries]=await Promise.all([
  db.from("project_tech_topics").select("tech_topic_id").eq("tech_topic_id",fixture.topic.tech_topic_id),
  db.from("project_tech_entries").select("tech_entry_id").in("tech_entry_id",ids),
]);
if(topics.error||entries.error)throw new Error(topics.error?.message||entries.error?.message);
if(topics.data.length||entries.data.length)throw new Error("Ledger already exists. Do not rerun the initial seed");
const quote=(value:unknown)=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const sql=`BEGIN;\nDO $$ BEGIN IF EXISTS (SELECT 1 FROM project_tech_topics WHERE tech_topic_id='ptt_sol_effluent_experiments') THEN RAISE EXCEPTION 'Already seeded'; END IF; END $$;\nINSERT INTO project_tech_topics SELECT * FROM jsonb_populate_record(NULL::project_tech_topics, ${quote({...fixture.topic,created_by:"amie",updated_by:"amie",created_at:new Date().toISOString(),updated_at:new Date().toISOString()})});\nINSERT INTO project_tech_entries SELECT * FROM jsonb_populate_recordset(NULL::project_tech_entries, ${quote(fixture.rows.map((r:{entry:TechEntry})=>({...r.entry,created_by:"amie",updated_by:"amie",created_at:new Date().toISOString(),updated_at:new Date().toISOString()})))});\nCOMMIT;\n`;
writeFileSync(`${evidenceDir}/照合済み廃液一覧.json`,JSON.stringify(fixture,null,2));
writeFileSync(`${evidenceDir}/集計確認.json`,JSON.stringify({...summary,graphObjects:uploads.length,originalGraphImages:manifest.length},null,2));
console.log(JSON.stringify({...summary,graphObjects:uploads.length,mode:process.argv.includes("--apply")?"apply":"dry-run"}));
if(process.argv.includes("--apply")){
  for(const graph of uploads){
    const uploaded=await db.storage.from("project-tech-graphs").upload(graph.path,graph.bytes,{contentType:"image/png",upsert:false});
    if(uploaded.error&&!/already exists|Duplicate/i.test(uploaded.error.message))throw new Error(uploaded.error.message);
  }
  writeFileSync("scripts/data/amie_sol_effluent_ledger_20261014.sql",sql);
  console.log("Graphs saved. Apply the recorded SQL through scripts/apply_ddl.py, then verify rows and image hashes.");
}
