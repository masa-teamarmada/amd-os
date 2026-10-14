import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import assert from "node:assert/strict";

// 初回登録済みの画像だけをPDFの透過マスク保持版へ差し替える。一度だけ適用する。
const evidence=process.env.AMIE_EFFLUENT_EVIDENCE_DIR;
if(!evidence)throw new Error("Evidence directory required");
const env=Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^['"]|['"]$/g,"")];}));
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const fixture=JSON.parse(readFileSync(`${evidence}/照合済み廃液一覧.json`,"utf8"));
const manifest=JSON.parse(readFileSync(`${evidence}/元グラフ/画像出典.json`,"utf8")) as Array<{name:string;file:string;sha256:string;pdf_soft_mask_preserved:boolean}>;
const sql:string[]=["BEGIN;"];
let changed=0;
for(const record of fixture.rows){
 const graphs=record.entry.experiment.graphs;
 if(!graphs.length)continue;
 const read=await db.from("project_tech_entries").select("experiment").eq("tech_entry_id",record.entry.tech_entry_id).single();
 if(read.error)throw new Error(read.error.message);
 assert.deepEqual(read.data.experiment,record.entry.experiment,"Stored experiment changed");
 const original=JSON.stringify(record.entry.experiment);
 for(let i=0;i<graphs.length;i++){
  const graph=manifest.find(g=>g.name===record.graph_names[i]);
  assert.ok(graph?.pdf_soft_mask_preserved);
  const bytes=readFileSync(graph.file);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),graph.sha256);
  const path=`p21/${record.entry.tech_entry_id}/${graph.sha256}.png`;
  assert.notEqual(path,graphs[i].path,"Already corrected; do not reapply");
  if(process.argv.includes("--apply")){
   const upload=await db.storage.from("project-tech-graphs").upload(path,bytes,{contentType:"image/png",upsert:false});
   if(upload.error&&!/already exists|Duplicate/i.test(upload.error.message))throw new Error(upload.error.message);
  }
  graphs[i].path=path;
 }
 const q=(s:string)=>`'${s.replaceAll("'","''")}'`;
 sql.push(`DO $$ BEGIN UPDATE project_tech_entries SET experiment=${q(JSON.stringify(record.entry.experiment))}::jsonb, updated_by='amie',updated_at=now() WHERE tech_entry_id=${q(record.entry.tech_entry_id)} AND experiment=${q(original)}::jsonb; IF NOT FOUND THEN RAISE EXCEPTION 'Experiment changed'; END IF; END $$;`);
 changed++;
}
sql.push("COMMIT;");
writeFileSync(`${evidence}/画像透過修正版一覧.json`,JSON.stringify(fixture,null,2));
writeFileSync(`${evidence}/画像透過修正.sql`,sql.join("\n"));
console.log(JSON.stringify({changedRows:changed,images:manifest.length,mode:process.argv.includes("--apply")?"upload-and-prepare":"dry-run"}));
