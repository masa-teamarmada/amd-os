import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { NextResponse } from "next/server.js";
import { ddNdaPartyLabel, ddNdaReturnPath, DD_NDA_CONFIRMATION_VERSION } from "../src/lib/dd-nda.ts";
assert.equal(ddNdaPartyLabel({legal_status:'pre_incorporation',legal_name:'株式会社予定社'}),'株式会社チームアルマダ');
assert.equal(ddNdaPartyLabel({legal_status:'incorporated',legal_name:'合同会社実在社'}),'株式会社チームアルマダまたは合同会社実在社');
assert.throws(()=>ddNdaPartyLabel({legal_status:'incorporated',legal_name:null}));
for(const bad of ['//outside.test','https://outside.test','/dd/other','/dd/sol/nda','/dd/sol/../other','/dd/sol\\evil'])assert.equal(ddNdaReturnPath('sol',bad),'/dd/sol');
assert.equal(ddNdaReturnPath('sol','/dd/sol?tab=company&returnTo=evil'),'/dd/sol?tab=company');
function load(file:string,mocks:Record<string,unknown>){const source=readFileSync(new URL(file,import.meta.url),'utf8');const out:any={};new Function('require','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)((name:string)=>{assert.ok(name in mocks,name);return mocks[name]},out);return out;}
let allowed=true,sameOrigin=true,failed=false,logs:any[]=[];
const access:any={principal:'workspace_account',accountId:'account',email:'registered@example.test',grantId:'grant',packageId:'package',projectId:'p21',slug:'sol'};
const context={partyLabel:'株式会社チームアルマダ',prompt:'test',promptHash:'hash',version:DD_NDA_CONFIRMATION_VERSION};
const route=load('../src/app/dd/[slug]/nda/route.ts',{
 'next/server':{NextResponse},'@/lib/dd-access':{resolveDdPackageAccess:async(_slug:string,options:any)=>{assert.equal(options.requireNdaConfirmation,false);return allowed?access:null}},
 '@/lib/workspace-mutation-origin':{isSameOriginWorkspaceMutation:()=>sameOrigin},
 '@/lib/dd-nda-server':{loadDdNdaContext:async()=>context,recordDdNdaConfirmation:async(a:any,c:any)=>{if(failed)throw new Error('storage failure');logs.push({a,c})}},
});
const request=(body:any={answer:'yes',version:context.version,promptHash:context.promptHash})=>new Request('https://test/dd/sol/nda',{method:'POST',body:JSON.stringify(body)});
const params={params:Promise.resolve({slug:'sol'})};
sameOrigin=false;assert.equal((await route.POST(request(),params)).status,403);assert.equal(logs.length,0);
sameOrigin=true;allowed=false;assert.equal((await route.POST(request(),params)).status,404);assert.equal(logs.length,0);
allowed=true;for(const body of [{answer:'no'},{answer:true},{answer:'yes',version:'old',promptHash:'hash'},{answer:'yes',version:context.version,promptHash:'stale-company'}]){const response=await route.POST(request(body),params);assert.ok([400,409].includes(response.status));assert.equal(response.headers.get('set-cookie'),null)}
failed=true;const denied=await route.POST(request(),params);assert.equal(denied.status,500);assert.equal(denied.headers.get('set-cookie'),null);
failed=false;const yes=await route.POST(request(),params);assert.equal(yes.status,200);assert.equal(logs.length,1);assert.equal(logs[0].a.email,access.email);assert.equal(yes.headers.get('set-cookie'),null,'admission does not depend on a browser ticket');
// 実サーバ記録関数: 外部・内部とも、identityは認証結果からのみ保存。
let rows:any[]=[];let lookupFailed=false;let profile:any={legal_status:'pre_incorporation',legal_name:'予定社'};
const db:any={from(table:string){
 if(table==='project_company_profiles')return {select:()=>({eq:()=>({maybeSingle:async()=>({data:profile,error:null})})})};
 assert.equal(table,'workspace_access_audit_logs');
 const filters:((row:any)=>boolean)[]=[];
 const query={select(){return query},eq(k:string,v:any){filters.push(r=>r[k]===v);return query},is(k:string,v:any){filters.push(r=>r[k]===v);return query},contains(k:string,v:any){filters.push(r=>Object.entries(v).every(([key,value])=>r[k]?.[key]===value));return query},limit(n:number){assert.equal(n,1);return query},async maybeSingle(){return {data:rows.find(r=>filters.every(f=>f(r)))??null,error:lookupFailed?{message:'failure'}:null}},async insert(row:any){rows.push({...row,id:rows.length+1});return {error:null}}};
 return query;
}};
const audit=load('../src/lib/workspace-access-audit.ts',{'server-only':{}});
const wording=await import('../src/lib/dd-nda.ts');
const server=load('../src/lib/dd-nda-server.ts',{'server-only':{},'node:crypto':await import('node:crypto'),'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/dd-nda':wording,'@/lib/workspace-access-audit':audit,'@/lib/dd-confidentiality':{DD_CONFIDENTIALITY_VERSION:'notice'}});
const current=await server.loadDdNdaContext(access);
assert.equal(await server.hasDdNdaConfirmation(access),false);
// 同じメール、別イベント、別パッケージ、yes以外を入場記録としない。
rows=[
 {id:1,event_type:'dd_confidentiality_confirmed',project_id:'p21',user_account_id:'account',email:access.email,detail:{package_id:'package',answer:'yes'}},
 {id:2,event_type:'dd_nda_confirmed',project_id:'p21',user_account_id:'other',email:access.email,detail:{package_id:'package',answer:'yes'}},
 {id:3,event_type:'dd_nda_confirmed',project_id:'p21',user_account_id:'account',detail:{package_id:'other',answer:'yes'}},
 {id:4,event_type:'dd_nda_confirmed',project_id:'p21',user_account_id:'account',detail:{package_id:'package',answer:'no'}},
];
assert.equal(await server.hasDdNdaConfirmation(access),false);
rows=[];
await server.recordDdNdaConfirmation(access,current);
await server.recordDdNdaConfirmation({...access,principal:'internal_admin',memberId:'member'},current);
assert.equal(rows[0].user_account_id,'account');assert.equal(rows[0].detail.answer,'yes');assert.equal(rows[1].user_account_id,null);assert.equal(rows[1].detail.actor_member_id,'member');assert.equal(rows[1].email,access.email);
assert.equal(await server.hasDdNdaConfirmation(access),true,'existing audit confirms admission without any cookie');
assert.equal(await server.hasDdNdaConfirmation({...access,accountId:'other'}),false);
assert.equal(await server.hasDdNdaConfirmation({...access,packageId:'other'}),false);
assert.equal(await server.hasDdNdaConfirmation({...access,projectId:'other'}),false);
assert.equal(await server.hasDdNdaConfirmation({...access,grantId:'renewed',email:'changed@example.test'}),true,'stable user survives new grant/email/browser');
assert.equal(await server.hasDdNdaConfirmation({...access,principal:'internal_member',memberId:'member'}),true,'member persists across permission role changes');
assert.equal(await server.hasDdNdaConfirmation({...access,principal:'internal_admin',memberId:'other'}),false);
profile={legal_status:'incorporated',legal_name:'株式会社設立済'};
assert.equal(await server.hasDdNdaConfirmation(access),true,'confirmation is once per user/package; the original party/version stay in audit');
lookupFailed=true;await assert.rejects(server.hasDdNdaConfirmation(access),/lookup_failed/);lookupFailed=false;
// 実ページ: gateが閉じている間、本文データも通常の閲覧記録も作らない。
let confirmed=false,reads=0,contextReads=0;
const page=load('../src/app/dd/[slug]/page.tsx',{
 'react/jsx-runtime':{jsx:(component:any,props:any)=>({component,props}),jsxs:(component:any,props:any)=>({component,props})},
 'next/navigation':{notFound:()=>{throw new Error('not found')},redirect:()=>{throw new Error('redirect')}},
 '@/components/dd/DdEntryGate':{DdEntryGate:'gate'},'@/lib/dd-nda':wording,'@/lib/dd-nda-server':{loadDdNdaContext:async()=>{contextReads++;return current},hasDdNdaConfirmation:async()=>confirmed},
 '@/lib/dd-page-session':{requireDdPageSession:async()=>{}},'@/lib/dd-access':{resolveDdPackageAccess:async()=>access},'@/lib/dd-confidentiality-server':{ddContentHash:()=> 'hash'},
 '@/lib/dd-package-server':{loadDdPackageView:async()=>{reads++;return {sections:[],projectName:'test'}},recordDdAccessEvent:async()=>{reads++}},
 '@/lib/dd-project-pages-server':{loadDdProjectPage:async()=>{reads++;return {}}},'@/lib/dd-package-core':{isDdSlug:()=>true,hasDdCapability:()=>false},'@/lib/dd-pages':{DD_PAGE_KEYS:['company']},
 '@/components/dd/DdViewerShell':{DdViewerShell:'shell'},'@/components/dd/DdPackageTop':{DdPackageTop:'top'},
 '@/lib/project-surface-access':{canEditProjectSurface:async()=>false},
});
const input={params:Promise.resolve({slug:'sol'}),searchParams:Promise.resolve({tab:'company'})};
assert.equal((await page.default(input)).component,'gate');assert.equal(reads,0);assert.equal(contextReads,1);confirmed=true;await page.default(input);assert.equal(reads,3);assert.equal(contextReads,1,'confirmed readers do not re-read the first-entry prompt');
const resolver=readFileSync(new URL('../src/lib/dd-access.ts',import.meta.url),'utf8');assert.match(resolver,/requireNdaConfirmation = true/);assert.match(resolver,/hasDdNdaConfirmation\(access\)/);
console.log('DD NDA: durable per-user/package record, historical yes, cross-session/role/grant continuity, actor isolation, first-entry CSRF/stale prompt/failures and no content before yes PASS');
// 実認可関数: 普通の本文/API呼出しでは保存済みの回答確認を省略できない。
let gateOpen=false,activeMember:any={isAdmin:true,memberId:'member',email:'member@example.test'},gateChecks=0;
const accessModule=load('../src/lib/dd-access.ts',{
 'server-only':{},'@/lib/dd-nda-server':{hasDdNdaConfirmation:async()=>{gateChecks++;return gateOpen}},
 '@/lib/supabase/admin':{createAdminClient:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'package',project_id:'p21',slug:'sol',title:'test',status:'open'},error:null})})})})})},
 '@/lib/project-surface-permissions':{memberSurfacePermission:()=>null},'@/lib/project-workspace':{getCurrentMemberAccess:async()=>activeMember},
 '@/lib/workspace-access-session':{getWorkspaceAccessCandidateSession:async()=>null},'@/lib/dd-package-core':await import('../src/lib/dd-package-core.ts'),
});
assert.equal(await accessModule.resolveDdPackageAccess('sol'),null);assert.equal(gateChecks,1);
assert.ok(await accessModule.resolveDdPackageAccess('sol',{requireNdaConfirmation:false}));assert.equal(gateChecks,1);
gateOpen=true;assert.ok(await accessModule.resolveDdPackageAccess('sol'));activeMember=null;assert.equal(await accessModule.resolveDdPackageAccess('sol'),null,'NDA確認だけでは個別権限を与えない');
const logout=readFileSync(new URL('../src/app/auth/logout/route.ts',import.meta.url),'utf8');assert.match(logout,/cookie.name.startsWith\("amd_os_dd_nda_"\)/);
console.log('DD NDA actual authorization: default gate, explicit entrance bypass after permission, no admission by confirmation alone PASS');
