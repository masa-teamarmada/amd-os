import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {canReadDdReport,canEditDdReport} from '../src/lib/dd-report-core.ts';
import type {DdViewerAccess} from '../src/lib/dd-package-core.ts';
import {formatDdReportValue} from '../src/lib/dd-report-model.ts';
const external:DdViewerAccess={principal:'workspace_account',packageId:'package',capabilities:['dd.view','dd.download'],accountId:'viewer',email:'viewer@example.test',grantId:'grant',slug:'known',projectId:'project',title:'test',packageStatus:'open',preview:false};
assert(canReadDdReport(external,{package_id:'package',status:'published'}));
assert(!canReadDdReport(external,{package_id:'other-package',status:'published'}));
assert(!canReadDdReport(external,{package_id:'package',status:'draft'}));
assert(!canReadDdReport(external,{package_id:'package',status:'archived'}));
assert(!canEditDdReport({...external,capabilities:['dd.view','dd.edit']}));
const internal={...external,principal:'internal_admin',memberId:'author',capabilities:['dd.view','dd.edit']} as DdViewerAccess;
assert(canReadDdReport(internal,{package_id:'package',status:'draft'}));assert(canEditDdReport(internal));
assert.equal(formatDdReportValue(123456789,'0.0,,'),'123.5');
assert.equal(formatDdReportValue(-123456789,'0.0,,;\\(0.0,,\\);"-"'),'(123.5)');
assert.equal(formatDdReportValue(.2083127,'0.0%'),'20.8%');
assert.equal(formatDdReportValue(.08,'"キャップ／割引率"'),'キャップ／割引率');
assert.equal(formatDdReportValue(0,'#,##0;(#,##0);"—"'),'—');
assert.equal(formatDdReportValue(45000,'yyyy/mm/dd'),'2023/03/15');
let access:DdViewerAccess|null=null,editionReads=0,saves=0,calcError=false;
const edition={id:'edition',package_id:'package',revision:1,input_overrides:{}},model={inputs:[]};
const response={json:(body:unknown,options:{status?:number}={})=>({body,status:options.status??200})};
const mocks:Record<string,unknown>={
 'next/server':{NextResponse:response},'@/lib/dd-access':{resolveDdPackageAccess:async()=>access},
 '@/lib/workspace-mutation-origin':{isSameOriginWorkspaceMutation:(r:Request)=>r.headers.get('origin')==='https://example.test'},
 '@/lib/supabase/admin':{createAdminClient:()=>({rpc:async(_name:string,args:Record<string,unknown>)=>{assert.equal(args.p_edition_id,'edition');assert.equal(args.p_actor,'author');saves++;return {data:2,error:null};}})},
 '@/lib/dd-report-server':{canEditDdReport,loadDdReportEdition:async()=>{editionReads++;return edition;},loadDdReportModel:async()=>model,loadDdReportChapterIndex:async()=>[],loadDdReportChapter:async()=>null},
 '@/lib/dd-report-model':{validateDdOverrides:(_m:unknown,values:unknown)=>JSON.stringify(values)==='{}',verifyDdReportCalculation:()=>{if(calcError)throw new Error('invalid calculation');}},
 '@/lib/dd-package-server':{recordDdAccessEvent:async()=>{}},
};
const source=ts.transpileModule(fs.readFileSync(new URL('../src/app/api/dd/[slug]/report/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const out:Record<string,(...args:unknown[])=>Promise<{body:unknown;status:number}>>={};
new Function('require','exports',source)((name:string)=>{assert(name in mocks,name);return mocks[name];},out);
const params={params:Promise.resolve({slug:'known'})},request=(data:unknown,origin='https://example.test')=>new Request('https://example.test/api/dd/known/report',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(data)});
assert.equal((await out.GET(new Request('https://example.test/api/dd/known/report'),params)).status,404);assert.equal(editionReads,0);
access=external;assert.equal((await out.POST(request({action:'inputs',revision:1,values:{}}),params)).status,404);assert.equal(saves,0);
access=internal;assert.equal((await out.POST(request({},'https://other.test'),params)).status,403);
assert.equal((await out.POST(request({action:'inputs',revision:0,values:{}}),params)).status,409);
assert.equal((await out.POST(request({action:'inputs',revision:1,values:{injected:1}}),params)).status,400);
calcError=true;assert.equal((await out.POST(request({action:'inputs',revision:1,values:{}}),params)).status,422);assert.equal(saves,0);
calcError=false;assert.equal((await out.POST(request({action:'inputs',revision:1,values:{}}),params)).status,200);assert.equal(saves,1);
console.log('PASS: DD isolation / edit boundary / CSRF / revisions / failed calculations cannot save / native formats');
