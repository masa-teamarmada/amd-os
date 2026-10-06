import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { buildProjectContractList, projectContractGroups, canManageContractDisclosure, PROJECT_CONTRACT_LIST_SCOPES, type ProjectContractSource } from "../src/lib/project-contract-list.ts";
const row: ProjectContractSource = {
  contract_id: "nda", project_id: "p21", contract_title: "NDA", canonical_title: null,
  counterparty_name: "相手先", contract_type: "nda", status: "under_review", registry_status: "accepted",
  relationship_scope: "amd_contract", amd_entity_name: "株式会社チームアルマダ",
  expected_signing_date: null, effective_date: null, expiration_date: null, renewal_notice_date: null,
  signed_at: null, last_activity_at: "2026-10-02", review_required: true, dd_visible: true, project_contract_scope:"project_related",
  source_summary: "CANARY_INTERNAL", ledger_notes: "CANARY_INTERNAL",
};
let rows = [row, {...row,contract_id:"hidden",contract_title:"HIDDEN_CANARY",dd_visible:false}, {...row,contract_id:"other",project_id:"p34"}, {...row,contract_id:"candidate",registry_status:"candidate" as const}, {...row,contract_id:"studio",contract_title:"STUDIO_CANARY",project_contract_scope:"studio_service" as const}, {...row,contract_id:"unknown",project_contract_scope:undefined}];
assert.equal(buildProjectContractList(rows,"p21",false,true).contracts.length,2);
const dd = buildProjectContractList(rows,"p21",true,true);
assert.equal(dd.contracts.length,1); assert.equal(dd.canManage,false);
assert.equal(dd.contracts[0].signedAt,null); assert.equal(dd.contracts[0].contractingParty,"株式会社チームアルマダ");
assert.ok(!JSON.stringify(dd).includes("CANARY"));
// Hidden revisions in the same family must not override a visible record in DD.
const root = {...row,canonical_contract_id:"nda"};
const revision = {...row,contract_id:"revision",canonical_contract_id:"nda",dd_visible:false,last_activity_at:"2026-10-06",source_summary:"HIDDEN_CANARY"};
assert.equal(buildProjectContractList([root,revision],"p21",true).contracts[0].contractId,"nda");
assert.equal(projectContractGroups([root,revision],"p21").length,1);
assert.equal(canManageContractDisclosure({principal:"workspace_account",scope:"project",isAdmin:false,role:"manager"}),true);
for (const role of ["readonly","contributor"]) assert.equal(canManageContractDisclosure({principal:"workspace_account",scope:"project",isAdmin:false,role}),false);
assert.equal(canManageContractDisclosure({principal:"member",scope:"project",isAdmin:false}),false);
const futureParty = {...row,contract_id:"newco",relationship_scope:"third_party" as const,project_contract_scope:"project_party" as const,project_party_name:"確認済みのPJ法人"};
assert.equal(buildProjectContractList([futureParty],"p21",false).contracts[0].contractingParty,"確認済みのPJ法人");
assert.equal(buildProjectContractList([{...row,project_contract_scope:"studio_service"}],"p21",true).contracts.length,0,"DD selection cannot promote a studio service contract");
const route = readFileSync(new URL("../src/app/api/project/[projectId]/contract-list/route.ts",import.meta.url),"utf8");
const compiled = ts.transpileModule(route,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
let access: {principal:"member"|"workspace_account";scope:string;isAdmin:boolean;role?:string;email:string}|null = null;
let dbCreations=0; let updates: Record<string,unknown>[]=[]; let filters: unknown[][]=[];
const query = {update(value:Record<string,unknown>){updates.push(value);return query;},eq(k:string,v:unknown){filters.push([k,v]);return query;},in(k:string,v:unknown){filters.push([k,v]);return query;},then(done:(x:unknown)=>unknown){return Promise.resolve(done({error:null}));}};
const mocks: Record<string,unknown> = {
 "next/server":{NextResponse:Response},
 "@/lib/project-shared-workspace-access":{resolveSharedWorkspaceAccess:async(id:string)=>id==="p21"?access:null},
 "@/lib/supabase/admin":{createAdminClient:()=>{dbCreations++;return{from:(table:string)=>{assert.equal(table,"contracts");return query;}};}},
 "@/lib/project-contract-list":{canManageContractDisclosure,projectContractGroups,PROJECT_CONTRACT_LIST_SCOPES},
 "@/lib/project-contract-list-server":{loadProjectContractSources:async()=>rows,loadProjectContractList:async(_db:unknown,id:string,ddOnly:boolean,canManage:boolean)=>buildProjectContractList(rows,id,ddOnly,canManage)},
 "@/lib/workspace-mutation-origin":{isSameOriginWorkspaceMutation:(req:Request)=>req.headers.get("Origin")===new URL(req.url).origin},
};
const handlers:{GET?:(r:Request,c:unknown)=>Promise<Response>;PATCH?:(r:Request,c:unknown)=>Promise<Response>}={};
new Function("require","exports",compiled.outputText)((name:string)=>{assert.ok(name in mocks,name);return mocks[name];},handlers);
assert.ok(handlers.GET);assert.ok(handlers.PATCH);
const ctx={params:Promise.resolve({projectId:"p21"})};
function req(body:unknown,origin="https://example.test"){return new Request("https://example.test/api/project/p21/contract-list",{method:"PATCH",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify(body)});}
for (const identity of ["anonymous","DD-grant-only","revoked-workspace"]) {
 assert.equal((await handlers.GET(req({}),ctx)).status,401,identity);
 assert.equal((await handlers.PATCH(req({contractId:"nda",ddVisible:false}),ctx)).status,401,identity);
}
assert.equal(dbCreations,0);
for(const role of ["readonly","contributor"]){
 access={principal:"workspace_account",scope:"project",isAdmin:false,role,email:"reader"};
 const read=await handlers.GET(req({}),ctx);assert.equal(read.status,200);assert.equal(read.headers.get("Cache-Control"),"private, no-store");assert.equal((await read.json()).canManage,false);
 assert.equal((await handlers.PATCH(req({contractId:"nda",ddVisible:false}),ctx)).status,403);
}
access={principal:"workspace_account",scope:"project",isAdmin:false,role:"manager",email:"manager"};
assert.equal((await handlers.PATCH(req({contractId:"nda",ddVisible:false},"https://evil.test"),ctx)).status,403);
assert.equal((await handlers.PATCH(req({contractId:"nda",ddVisible:"false"}),ctx)).status,400);
assert.equal((await handlers.PATCH(req({contractId:"other",ddVisible:false}),ctx)).status,404);
assert.equal((await handlers.PATCH(req({contractId:"candidate",ddVisible:false}),ctx)).status,404);
assert.equal((await handlers.GET(req({}),{params:Promise.resolve({projectId:"p34"})})).status,401);
assert.equal((await handlers.PATCH(req({contractId:"studio",ddVisible:true}),ctx)).status,404);
assert.equal((await handlers.PATCH(req({contractId:"unknown",ddVisible:true}),ctx)).status,404);
assert.equal(updates.length,0);
rows=[root,revision];
assert.equal((await handlers.PATCH(req({contractId:projectContractGroups(rows,"p21")[0].contract_id,ddVisible:false}),ctx)).status,200);
assert.equal(updates.length,1);assert.deepEqual(Object.keys(updates[0]).sort(),["dd_visible","updated_at","updated_by"]);assert.equal(updates[0].dd_visible,false);
assert.deepEqual(filters,[["project_id","p21"],["registry_status","accepted"],["project_contract_scope",[...PROJECT_CONTRACT_LIST_SCOPES]],["contract_id",projectContractGroups(rows,"p21")[0].related_contract_ids]]);
// Exercise the actual server loader to confirm filtering in the query, before DTO creation.
const server=readFileSync(new URL("../src/lib/project-contract-list-server.ts",import.meta.url),"utf8");
const serverExports:{loadProjectContractList?:(db:unknown,id:string,ddOnly:boolean)=>Promise<unknown>}={};
new Function("require","exports",ts.transpileModule(server,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)((name:string)=>name==="server-only"?{}:{buildProjectContractList,PROJECT_CONTRACT_LIST_SCOPES},serverExports);
const selected:string[]=[]; const dbFilters:unknown[][]=[];
const dbQuery={select(s:string){selected.push(s);return dbQuery;},eq(k:string,v:unknown){dbFilters.push([k,v]);return dbQuery;},in(k:string,v:unknown){dbFilters.push([k,v]);return dbQuery;},order(){return dbQuery;},then(done:(x:unknown)=>unknown){return Promise.resolve(done({data:[row],error:null}));}};
assert.ok(serverExports.loadProjectContractList);await serverExports.loadProjectContractList({from:()=>dbQuery},"p21",true);
assert.deepEqual(dbFilters,[["project_id","p21"],["registry_status","accepted"],["project_contract_scope",[...PROJECT_CONTRACT_LIST_SCOPES]],["dd_visible",true]]);
assert.ok(!selected[0].includes("source_summary"));assert.ok(!selected[0].includes("ledger_notes"));
console.log("contract list: project scope, candidate exclusion, unsigned count, hidden record/revision filtering, read-only/DD denial, manager mutation, origin/input and narrow update OK");
