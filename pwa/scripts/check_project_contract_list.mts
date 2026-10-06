import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { attachProjectContractEvidence, buildProjectContractList, projectContractGroups, canManageContractDisclosure, PROJECT_CONTRACT_LIST_SCOPES, type ProjectContractSource } from "../src/lib/project-contract-list.ts";
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
 "@/lib/project-contract-list-server":{loadProjectContractEvidence:async(_db:unknown,id:string,contractId:string)=>projectContractGroups(rows,id).some(row=>row.contract_id===contractId)?{contractId,documents:[],history:[],nextHistoryCursor:null}:null,loadProjectContractSources:async()=>rows,loadProjectContractList:async(_db:unknown,id:string,ddOnly:boolean,canManage:boolean)=>buildProjectContractList(rows,id,ddOnly,canManage)},
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
const dbQuery={select(s:string){selected.push(s);return dbQuery;},eq(k:string,v:unknown){dbFilters.push([k,v]);return dbQuery;},in(k:string,v:unknown){dbFilters.push([k,v]);return dbQuery;},order(){return dbQuery;},range(){return dbQuery;},then(done:(x:unknown)=>unknown){return Promise.resolve(done({data:[row],error:null}));}};
assert.ok(serverExports.loadProjectContractList);await serverExports.loadProjectContractList({from:()=>dbQuery},"p21",true);
assert.deepEqual(dbFilters,[["project_id","p21"],["registry_status","accepted"],["project_contract_scope",[...PROJECT_CONTRACT_LIST_SCOPES]],["dd_visible",true]]);
assert.ok(!selected[0].includes("source_summary"));assert.ok(!selected[0].includes("ledger_notes"));
console.log("contract list: project scope, candidate exclusion, unsigned count, hidden record/revision filtering, read-only/DD denial, manager mutation, origin/input and narrow update OK");

const doc = { document_id:"original",contract_id:"nda",project_id:"p21",version_label:"先方受領版",file_name:"original.docx",web_view_link:"https://docs.google.com/document/d/verified/edit",received_at:"2026-10-02T16:21:06+09:00",is_latest:false };
const event = { signal_id:"received",contract_id:"nda",project_id:"p21",signal_type:"contract_exchange",status:"linked",title:"受領",snippet:"確認済みの経緯",source_url:"https://mail.google.com/mail/u/#all/verified",detected_at:doc.received_at };
const withEvidence=attachProjectContractEvidence(buildProjectContractList([root],"p21",false),projectContractGroups([root],"p21"),"p21",[doc,{...doc,document_id:"foreign",project_id:"p34"},{...doc,document_id:"unrelated",contract_id:"other"},{...doc,document_id:"unsafe",web_view_link:"javascript:alert(1)"}],[event,{...event,signal_id:"candidate",status:"candidate"},{...event,signal_id:"raw",signal_type:"contract"},{...event,signal_id:"foreign",project_id:"p34"}]);
assert.equal(withEvidence.contracts.length,1);assert.equal(withEvidence.contracts[0].documents?.length,1);assert.equal(withEvidence.contracts[0].history?.length,1);
assert.ok(!("documents" in buildProjectContractList([root],"p21",true).contracts[0]));
// Execute the actual loader with children, and ensure DD never queries them.
const evidenceExports:{loadProjectContractList?:(db:unknown,id:string,ddOnly:boolean)=>Promise<unknown>}={};
new Function("require","exports",ts.transpileModule(server,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)((name:string)=>name==="server-only"?{}:{buildProjectContractList,projectContractGroups,attachProjectContractEvidence,PROJECT_CONTRACT_LIST_SCOPES},evidenceExports);
const accessed:string[]=[];const childFilters:unknown[][]=[];
const evidenceDb={from(table:string){accessed.push(table);const result=table==="contracts"?[root]:table==="contract_documents"?[{...doc,is_latest:true}]:[event];const q={select(){return q;},eq(k:string,v:unknown){if(table!=="contracts")childFilters.push([table,k,v]);return q;},in(k:string,v:unknown){if(table!=="contracts")childFilters.push([table,k,v]);return q;},order(){return q;},range(){return q;},then(done:(x:unknown)=>unknown){return Promise.resolve(done({data:result,error:null}));}};return q;}};
await evidenceExports.loadProjectContractList!(evidenceDb,"p21",true);assert.deepEqual(accessed,["contracts"]);
accessed.length=0;const loaded=await evidenceExports.loadProjectContractList!(evidenceDb,"p21",false) as {contracts:Array<{latestDocument:unknown;documents?:unknown[];history?:unknown[]}>};
assert.ok(loaded.contracts[0].latestDocument);assert.equal(loaded.contracts[0].documents,undefined);assert.equal(loaded.contracts[0].history,undefined);assert.ok(!accessed.includes("contract_signals"),"list must not read correspondence");
for(const table of ["contract_documents"]) {assert.ok(childFilters.some(f=>f[0]===table&&f[1]==="project_id"&&f[2]==="p21"));assert.ok(childFilters.some(f=>f[0]===table&&f[1]==="contract_id"));}
console.log("contract evidence: project/contract isolation, explicit linked history, safe URLs, DD non-disclosure and actual child loader OK");

// Detail reads retain workspace authorization and reject malformed cursors before touching storage.
function getReq(search:string){return new Request(`https://example.test/api/project/p21/contract-list?${search}`);}
access=null;assert.equal((await handlers.GET!(getReq("contractId=nda"),ctx)).status,401);
access={principal:"workspace_account",scope:"project",isAdmin:false,role:"readonly",email:"reader"};
rows=[root];assert.equal((await handlers.GET!(getReq("contractId=nda"),ctx)).status,200);
for(const id of ["other","studio","candidate"]) assert.equal((await handlers.GET!(getReq(`contractId=${id}`),ctx)).status,404);
assert.equal((await handlers.GET!(getReq("contractId=nda&before=evil&beforeId=bad"),ctx)).status,400);
assert.equal((await handlers.GET!(getReq("before=2026-10-02T16%3A21%3A06Z"),ctx)).status,400);
console.log("contract list: compact summary only, no eager histories, authorized detail and cursor validation OK");

// Sixty exchanges at the same timestamp must page without gaps or duplicates.
const pagedExports:{loadProjectContractEvidence?:(db:unknown,p:string,c:string,cursor?:unknown)=>Promise<any>}={};
new Function("require","exports",ts.transpileModule(server,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)((name:string)=>name==="server-only"?{}:{buildProjectContractList,projectContractGroups,attachProjectContractEvidence,PROJECT_CONTRACT_LIST_SCOPES},pagedExports);
const sixty=Array.from({length:60},(_,i)=>({...event,signal_id:`00000000-0000-0000-0000-${String(60-i).padStart(12,"0")}`}));
let documentQueries=0;
const pagingDb={from(table:string){if(table==="contract_documents")documentQueries++;let limit=Infinity;let before="";const q={select(){return q;},eq(k:string,v:unknown){if(table!=="contracts"&&k==="project_id")assert.equal(v,"p21");return q;},in(k:string,v:unknown){if(table!=="contracts")assert.deepEqual(v,["nda"]);return q;},order(){return q;},range(){return q;},limit(n:number){assert.equal(n,21);limit=n;return q;},or(s:string){assert.ok(s.startsWith("detected_at.lt."));before=s.match(/signal_id\.lt\.([^)]*)/)![1];return q;},then(done:(x:unknown)=>unknown){const data=table==="contracts"?[root]:table==="contract_documents"?[doc]:sixty.filter(e=>!before||e.signal_id<before).slice(0,limit);return Promise.resolve(done({data,error:null}));}};return q;}};
const ids:string[]=[];let cursor=undefined;
for(let page=0;page<3;page++){const result=await pagedExports.loadProjectContractEvidence!(pagingDb,"p21","nda",cursor);assert.equal(result.history.length,20);ids.push(...result.history.map((e:any)=>e.id));cursor=result.nextHistoryCursor;assert.equal(result.documents.length,page?0:1);}
assert.equal(cursor,null);assert.equal(documentQueries,1);assert.deepEqual(ids,sixty.map(e=>e.signal_id));assert.equal(new Set(ids).size,60);
console.log("contract history: sixty equal-time exchanges, stable three-page cursor, one document read, no duplicate or missing entries OK");
