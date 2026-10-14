import {readFileSync,writeFileSync} from "node:fs";
import assert from "node:assert/strict";
import {createClient} from "@supabase/supabase-js";
import {amieValidateEffluentEntry,amieEffluentSummary,amieEffluentRows} from "../src/lib/amie-effluent-experiments.ts";
import type {TechEntry} from "../src/lib/project-tech.ts";
const base=process.env.AMIE_EFFLUENT_EVIDENCE_DIR;if(!base)throw new Error("Evidence directory required");
const env=Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^['"]|['"]$/g,"")];}));
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const previous=JSON.parse(readFileSync(`${base}/照合済み廃液一覧.json`,"utf8"));
const target=JSON.parse(readFileSync(`${base}/視覚表示の照合済み一覧.json`,"utf8"));
const stored=await db.from("project_tech_entries").select("tech_entry_id,experiment").eq("tech_topic_id",target.topic.tech_topic_id);
if(stored.error)throw new Error(stored.error.message);
assert.equal(stored.data.length,49);
const q=(s:string)=>`'${s.replaceAll("'","''")}'`;
const sql=["BEGIN;"];
for(const record of target.rows){
 const old=previous.rows.find((r:{slug:string})=>r.slug===record.slug);
 const actual:{tech_entry_id:string;experiment:unknown}|undefined=stored.data.find(r=>r.tech_entry_id===record.entry.tech_entry_id);
 assert.deepEqual(actual?.experiment,old.entry.experiment,"Stored experiment changed; do not overwrite");
 amieValidateEffluentEntry(record.entry);
 sql.push(`DO $$ BEGIN UPDATE project_tech_entries SET experiment=${q(JSON.stringify(record.entry.experiment))}::jsonb,updated_at=now(),updated_by='amie' WHERE tech_entry_id=${q(record.entry.tech_entry_id)} AND experiment=${q(JSON.stringify(old.entry.experiment))}::jsonb; IF NOT FOUND THEN RAISE EXCEPTION 'Experiment changed'; END IF; END $$;`);
}
sql.push(`DO $$ BEGIN UPDATE project_tech_topics SET title='実験・評価一覧',tech_domain='実験・評価',updated_at=now(),updated_by='amie' WHERE tech_topic_id='ptt_sol_effluent_experiments' AND title='廃液ごとの実験一覧' AND tech_domain='廃液実験'; IF NOT FOUND THEN RAISE EXCEPTION 'Topic changed'; END IF; END $$;`);
sql.push("COMMIT;");
assert.equal(amieEffluentSummary(amieEffluentRows(target.rows.map((r:{entry:TechEntry})=>r.entry))).completed,9);
writeFileSync(`${base}/視覚表示更新.sql`,sql.join("\n"));
console.log("Verified 49 records, same 9 completed types, original graphs unchanged. Apply prepared SQL through apply_ddl.py once.");
