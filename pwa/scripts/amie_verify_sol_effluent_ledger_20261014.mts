import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import assert from "node:assert/strict";
import {amieEffluentRows,amieEffluentSummary} from "../src/lib/amie-effluent-experiments.ts";
import type {TechEntry} from "../src/lib/project-tech.ts";
const evidenceDir=process.env.AMIE_EFFLUENT_EVIDENCE_DIR;
if(!evidenceDir)throw new Error("evidence directory required");
const env=Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^['"]|['"]$/g,"")];}));
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const expected=JSON.parse(readFileSync(`${evidenceDir}/照合済み廃液一覧.json`,"utf8"));
const read=await db.from("project_tech_entries").select("*").eq("tech_topic_id",expected.topic.tech_topic_id).order("sort_order");
if(read.error)throw new Error(read.error.message);
assert.equal(read.data.length,49);
const storedRows=read.data as unknown as Array<Record<string,unknown>>;
for(const record of expected.rows){const stored:Record<string,unknown>|undefined=storedRows.find(r=>r.tech_entry_id===record.entry.tech_entry_id);assert.ok(stored);for(const key of Object.keys(record.entry))assert.deepEqual(stored[key],record.entry[key],`${record.entry.tech_entry_id}: ${key}`);}
const graphs=amieEffluentRows(read.data as TechEntry[]).flatMap(r=>r.experiment.graphs);
await Promise.all(graphs.map(async graph=>{
 const d=await db.storage.from("project-tech-graphs").download(graph.path);if(d.error||!d.data)throw new Error("Stored graph download failed");
 const hash=createHash("sha256").update(Buffer.from(await d.data.arrayBuffer())).digest("hex");
 assert.equal(hash,graph.path.split("/").at(-1)?.replace(/\.png$/,""));
}));
const report={...amieEffluentSummary(amieEffluentRows(read.data as TechEntry[])),verifiedStoredGraphs:graphs.length,verifiedOriginalPixels:true,verifiedAt:new Date().toISOString()};
writeFileSync(`${evidenceDir}/保存後の照合確認.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
