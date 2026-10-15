import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectPocListData} from "../src/lib/project-poc-list.ts";
import {amieEffluentRows,amieEffluentSummary} from "../src/lib/amie-effluent-experiments.ts";
import {redactProjectPartnerNames} from "../src/lib/project-partner-disclosure.ts";
import {COCKPIT_TAB_FORMATS,WORKSPACE_TAB_FORMATS,DD_ITEM_PAGES,PROJECT_PAGE_LABELS} from "../src/lib/project-formats.ts";
import type {TechEntry,TechTopic} from "../src/lib/project-tech.ts";
const fixture=JSON.parse(readFileSync("scripts/data/amie_sol_effluent_ledger_20261014.json","utf8"));
const entries=fixture.rows.map((r:{entry:TechEntry})=>r.entry) as TechEntry[];
const original=fixture.topic as TechTopic;
const topic={...original,presentation:{...original.presentation,poc_sharing:{version:1,workspace:true,dd:true,entry_ids:entries.map(e=>e.tech_entry_id)}}};
assert.equal(projectPocListData("p21",[original],entries,"dd").entries.length,0,"掲載設定のない元データを外部へ出さない");
for(const audience of ["internal","shared","dd"] as const){
 const result=projectPocListData("p21",[topic],entries,audience,true);
 assert.equal(result.entries.length,49);assert.equal(result.canEdit,audience==="internal");
 assert.equal(amieEffluentSummary(amieEffluentRows(result.entries)).completed,9,"同じ廃液の再実験を二重計上しない");
 if(audience==="internal"){assert.deepEqual(result.entries,entries);continue;}
 assert.equal(result.topics[0].title,"PoCリスト");
 for(const entry of result.entries){const experiment=entry.experiment as Record<string,any>;
  assert.equal(entry.source_url,null);assert.equal(entry.condition_text,null);assert.equal(entry.note,null);assert.equal(entry.created_by,null);
  assert.deepEqual(experiment.graphs,[]);assert.equal(experiment.conditions,"");assert.equal(experiment.route,"");assert.equal(experiment.sampling_point,"");
  assert.deepEqual(experiment.source_entry_ids,[]);assert.deepEqual(experiment.source_sample_ids,[]);assert.deepEqual(experiment.source_test_ids,[]);
  assert.match(experiment.type_key,/^[a-f0-9]{64}$/);assert.equal(experiment.visual?.analysis_note,"");
 }
 const extra=entries.map((e,i)=>i?e:{...e,secret_future_field:"秘密",experiment:{...(e.experiment as object),secret_future_field:"秘密"}});
 assert.ok(!JSON.stringify(projectPocListData("p21",[topic],extra,audience)).includes("secret_future_field"),"未知の内部項目は明示許可リストに含まれない");
}
const unapproved={...entries[0],tech_entry_id:"unapproved"};
assert.equal(projectPocListData("p21",[topic],[...entries,unapproved],"dd").entries.length,49);
const core={...entries[0],disclosure:{version:1,level:"core",reason:"再現手順",dd:null}};
assert.equal(projectPocListData("p21",[topic],[core],"dd").entries.length,0,"核心ノウハウは行単位でも除外");
assert.equal(projectPocListData("another-project",[topic],entries,"dd").topics.length,0);
assert.equal(projectPocListData("p21",[topic],entries.map(e=>({...e,project_id:"other"})),"dd").entries.length,0);
const changed={...entries[0],value_text:"更新した結論"};
assert.equal(projectPocListData("p21",[topic],[changed],"dd").entries[0].value_text,"更新した結論","掲載済み行の訂正は同じ元データから即反映");
const published=projectPocListData("p21",[topic],entries,"dd");
const hidden=redactProjectPartnerNames(published,[{id:"withheld",name:(entries[0].experiment as any).provider,slug:"hidden-provider",nameDisclosureProhibited:true}]);
assert.equal((hidden.entries[0].experiment as any).provider,"会社名非開示");
for(const format of [COCKPIT_TAB_FORMATS,WORKSPACE_TAB_FORMATS])for(const [type,groups]of Object.entries(format))assert.equal(groups.flatMap(g=>g.tabs).filter(t=>t==="poc-list").length,1,`${type}でも未登録時の入口を常設`);
assert.equal(DD_ITEM_PAGES.filter(p=>p.key==="poc-list").length,1);assert.equal(PROJECT_PAGE_LABELS["poc-list"],"PoCリスト");
const read=(f:string)=>readFileSync(f,"utf8");
assert.match(read("src/components/cockpit/CockpitTechnology.tsx"),/techLedgerTabOf\(t\) === mode && !amieIsEffluentTopic\(t\)/);
assert.match(read("src/components/cockpit/CockpitTechnology.tsx"),/window.location.replace/);
assert.match(read("src/components/dd/DdProjectPageBody.tsx"),/initialData=\{data.poc\}/);
assert.match(read("src/app/api/project-poc-list/route.ts"),/hasSharedWorkspaceProjectReadAccess\(projectId\)/);
assert.match(read("scripts/migrations/508_amie_poc_list_dd_page.sql"),/'project_page:poc-list'/);
console.log("PoC list: 49 canonical rows / 9 completed, 3 surfaces, live edits, approval scope, core exclusion, names and protected details: PASS");
