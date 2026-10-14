import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {amieReadEffluentExperiment,amieValidateEffluentEntry,amieEffluentRows,amieEffluentSummary} from "../src/lib/amie-effluent-experiments.ts";
import {amieProjectDdTechTopic,amieTechReviewHash} from "../src/lib/amie-tech-disclosure-server.ts";
import {amieAllTechRows} from "../src/lib/project-tech-server.ts";
import type {TechEntry} from "../src/lib/project-tech.ts";
import {techTopicNavigationDomain,techTopicNavigationTitle} from "../src/lib/project-tech.ts";
import {readExperimentVisual} from "../src/lib/experiment-result.ts";
const fixture=JSON.parse(readFileSync("scripts/data/amie_sol_effluent_ledger_20261014.json","utf8"));
const entries=fixture.rows.map((r:{entry:TechEntry})=>r.entry) as TechEntry[];
// PJや試料に固有の名前が登録されても、共通ページ名へ戻す。
for(const project_id of ["p21","p25","other-project"]){
 const topic={...fixture.topic,project_id,title:"個別の試料一覧",tech_domain:"廃液実験"};
 assert.equal(techTopicNavigationDomain(topic),"実験・評価");
 assert.equal(techTopicNavigationTitle(topic),"実験・評価一覧");
}
assert.equal(techTopicNavigationDomain({tech_domain:"技術の内容",presentation:null}),"技術の内容");
const rows=amieEffluentRows(entries);
assert.deepEqual(rows[0].experiment.visual?.element_symbols,["Cu","Zn","Mg"]);
assert.ok(!rows[0].experiment.visual?.element_symbols.includes("Fe"));
assert.equal(rows[0].experiment.visual?.weather,"storm");
assert.equal(rows[0].experiment.status,"completed");
const dye=rows.find(r=>r.experiment.type_key==="kuroki_indigo");
assert.deepEqual(dye?.experiment.visual?.water_types,["colored","metal"]);
assert.equal(dye?.experiment.visual?.changes.find(c=>c.parameter==="色")?.effect,"unknown");
assert.equal(readExperimentVisual({...rows[0].experiment.visual,element_symbols:["Xx"]}),null);
assert.equal(readExperimentVisual({...rows[0].experiment.visual,weather_reason:""}),null);
assert.equal(amieReadEffluentExperiment({...rows[0].experiment,visual:undefined})?.visual,undefined);
assert.equal(rows.length,49);
assert.equal(amieEffluentSummary(rows).completed,9);
assert.equal(amieEffluentSummary(rows).simulatedCompleted,3);
assert.equal(amieEffluentSummary(rows).completedUnresolved,4);
// 再実験は同じ種類。株・試験回数・source項目の数を種類として増やさない。
assert.equal(amieEffluentSummary([...rows,{...rows[0],entry:{...rows[0].entry,tech_entry_id:"repeat"}}]).completed,9);
const fakeDone={...rows[0],entry:{...rows[0].entry,value_text:null}};
assert.equal(amieEffluentSummary([fakeDone]).completed,0);
assert.equal(amieEffluentSummary(rows.filter(r=>r.experiment.kind!=="actual")).completed,0);
assert.equal(amieEffluentSummary(rows.filter(r=>!r.experiment.identity_confirmed)).completed,0);
assert.equal(amieReadEffluentExperiment({...rows[0].experiment,status:"analyzed"}),null);
assert.equal(amieReadEffluentExperiment({...rows[0].experiment,received_on:"2026-02-30"}),null);
assert.equal(amieReadEffluentExperiment({...rows[0].experiment,graphs:[{path:"../p99/secret.png",caption:"x",source_ref:"s"}]}),null);
assert.throws(()=>amieValidateEffluentEntry({...entries[0],source_ref:""}),/出典/);
assert.throws(()=>amieValidateEffluentEntry({...entries[0],experiment:{...rows[0].experiment,after:""}}),/処理後/);
assert.throws(()=>amieValidateEffluentEntry({...entries[0],experiment:{...rows[0].experiment,graphs:[{path:"p99/other/a.png",caption:"x",source_ref:"s"}]}}),/紐付け/);
// 廃液の原記録・元画像はDDへ自動公開しない。
assert.equal(amieProjectDdTechTopic(fixture.topic,entries),null);
const entryHash=amieTechReviewHash(entries[0] as unknown as Record<string,unknown>,"entry");
assert.notEqual(amieTechReviewHash({...entries[0],experiment:{...rows[0].experiment,after:"changed"}},"entry"),entryHash);
const base={...entries[0],experiment:undefined};
assert.equal(amieTechReviewHash(base,"entry"),amieTechReviewHash({...base,experiment:null},"entry"));
const partners=readFileSync("src/components/project-workspace/SxPartnerPipeline.tsx","utf8");
assert.ok(!partners.includes('key: "effluent"'));
assert.ok(!partners.includes('cellOrder("effluent")'));
const graphRoute=readFileSync("src/app/api/project-tech-graphs/route.ts","utf8");
assert.ok(graphRoute.includes("requireMember()"));
assert.ok(graphRoute.includes('createSignedUrl(graph.path,60)'));
assert.ok(graphRoute.includes('private, no-store'));
console.log("PASS: reconciled count, distinct types, unresolved/simulated exclusion, validation, private graphs and partner column removal");

const source=Array.from({length:1201},(_,id)=>({id}));let pageCalls=0;
const all=await amieAllTechRows(()=>({range(from:number,to:number){pageCalls++;return Promise.resolve({data:source.slice(from,to+1),error:null})}}));
assert.equal(all.length,1201);assert.equal(pageCalls,3);
console.log("PASS: ledger pagination above the database row limit");
