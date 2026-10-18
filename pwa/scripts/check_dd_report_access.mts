import {ddReportFilename} from '../src/lib/dd-report-navigation.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {zipSync,unzipSync} from 'fflate';
import {createHash} from 'node:crypto';
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
let access:DdViewerAccess|null=null,editionReads=0,saves=0,calcError=false,queued=0;
const edition={id:'edition',title:'Example｜DD',source_sha256:'sha',package_id:'package',revision:1,input_overrides:{}},model={inputs:[]};
const response={json:(body:unknown,options:{status?:number}={})=>({body,status:options.status??200})};
const mocks:Record<string,unknown>={
 'next/server':{NextResponse:{...response,redirect:(url:string,options:{status:number})=>({body:{url},...options})}},'@/lib/dd-access':{resolveDdPackageAccess:async()=>access},
 '@/lib/dd-report-output-state':{queueDdReportPdf:()=>{queued++;}},
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
calcError=false;assert.equal((await out.POST(request({action:'inputs',revision:1,values:{}}),params)).status,200);assert.equal(saves,1);assert.equal(queued,1);
console.log('PASS: DD isolation / edit boundary / CSRF / revisions / failed calculations cannot save / native formats');
// Export rejects access/range/revision errors before touching private output storage.
let outputStorageReads=0,rendered=0,pdfReady=true;
let xlsxMissing=false,xlsxGenerated=0,downloads=0,editionChanged=false,disclosureChanged=false,pdfChecks=0;
let uploadedBundle:Uint8Array|undefined;
const pdfBytes=new TextEncoder().encode('%PDF-1.7 prepared fixture'),xlsxBytes=new Uint8Array([80,75,3,4,10,20,30]);
const exportMocks={...mocks,
 'fflate':{zipSync},
 '@/lib/dd-package-core':{hasDdCapability:(a:DdViewerAccess,cap:string)=>a.capabilities.includes(cap as never)},
 '@/lib/dd-report-pdf':{readDdPdfIndex:async()=>({})},'@/lib/dd-report-navigation':{ddReportFilename},'node:crypto':{createHash},
 '@/lib/dd-report-output-state':{ddReportOutputState:async(_edition:unknown,_project:unknown,format='pdf')=>{outputStorageReads++;if(format==='pdf')pdfChecks++;return {ready:format==='pdf'?pdfReady:!xlsxMissing,key:`private/${format==='pdf'&&disclosureChanged&&pdfChecks>1?'changed':'all'}.${format}`,prefix:'private',hidden:[]};},queueDdReportPdf:()=>{queued++;}},
 '@/lib/dd-report-output-server':{createDdReportOutput:({format,selected}:{format:string;selected:unknown[]})=>{if(format==='xlsx'){assert.equal(selected.length,38);xlsxGenerated++;return xlsxBytes;}rendered++;throw Error('download must not render bulk PDF');}},
 '@/lib/supabase/admin':{createAdminClient:()=>({storage:{from:()=>({
   createSignedUrl:async()=>({data:{signedUrl:'https://storage.test/download'},error:null}),
   info:async()=>({error:xlsxMissing?{message:'missing'}:null}),
   upload:async(key:string,bytes:Uint8Array)=>{if(key.endsWith('.zip'))uploadedBundle=bytes;else xlsxMissing=false;return {error:null};},
   download:async(key:string)=>{downloads++;return {data:new Blob([key.endsWith('.pdf')?pdfBytes:xlsxBytes]),error:null};},
 })}})},
 '@/lib/dd-report-server':{loadDdReportEdition:async()=>editionChanged&&downloads>=2?{...edition,revision:2}:edition,loadDdReportChapterIndex:async()=>Array.from({length:38},(_,i)=>({slug:'chapter-'+i,sort_order:i}))},
 '@/lib/dd-report-export':{},'@/lib/workspace-document-html-pdf':{},
 '@/lib/project-partner-disclosure-server':{loadProjectPartnerDisclosure:()=>{outputStorageReads++;throw Error('unexpected private read');}},
 '@/lib/project-partner-disclosure':{},
};
const exported:Record<string,(...args:unknown[])=>Promise<{body:unknown;status:number}>>={};
const exportSource=ts.transpileModule(fs.readFileSync(new URL('../src/app/api/dd/[slug]/report/export/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('require','exports',exportSource)((name:string)=>{assert(name in exportMocks,name);return exportMocks[name as keyof typeof exportMocks];},exported);
const getExport=(query:string)=>exported.GET(new Request('https://example.test/api/dd/known/report/export?'+query),params);
access=null;assert.equal((await getExport('format=pdf&scope=all')).status,404);
assert.equal((await getExport('format=zip&scope=all')).status,404);
access={...external,capabilities:['dd.view']};assert.equal((await getExport('format=pdf&scope=all')).status,404);
assert.equal((await getExport('format=zip&scope=all')).status,404);
access=external;assert.equal((await getExport('format=pdf&revision=0&scope=all')).status,409);
assert.equal((await getExport('format=pdf&scope=all&prepareBatch=-1')).status,400);
assert.equal((await getExport('format=pdf&scope=all&prepareBatch=10')).status,400);
assert.equal((await getExport('format=xlsx&scope=all&prepareBatch=0')).status,400);
assert.equal(outputStorageReads,0);
console.log('PASS: export download permission / stale revision / invalid batch boundaries');

pdfReady=true;assert.equal((await getExport('format=pdf&scope=all&revision=1')).status,303);assert.equal(rendered,0);
pdfReady=false;const queuedBefore=queued;assert.equal((await getExport('format=pdf&scope=all&revision=1')).status,409);assert.equal(rendered,0);assert.equal(queued,queuedBefore);
assert.equal((await getExport('format=pdf&scope=all&revision=1&status=1')).status,200);assert.equal(queued,queuedBefore+1);assert.equal(rendered,0);
console.log('PASS: prepared PDF downloads directly; pending downloads never render; background status resumes preparation');
assert.equal((await getExport('format=zip&scope=all&revision=1')).status,409);
assert.equal(xlsxGenerated,0,'PDF未完成時にExcel生成を始めない');
pdfReady=true;xlsxMissing=true;downloads=0;pdfChecks=0;
const bundle=await getExport('format=zip&scope=all&revision=1');
assert.equal(bundle.status,303);assert.ok(uploadedBundle,'ZIPを既存の非公開ファイル配信へ保存する');
const archive=unzipSync(uploadedBundle),names=Object.keys(archive);
assert.equal(names.length,2);assert.ok(names.every(name=>name.includes('_r1.')));
assert.deepEqual(archive[names.find(name=>name.endsWith('.pdf'))!],pdfBytes);
assert.deepEqual(archive[names.find(name=>name.endsWith('.xlsx'))!],xlsxBytes);
assert.equal(rendered,0,'一括操作でPDFを再生成しない');assert.equal(xlsxGenerated,1);
downloads=0;editionChanged=true;
assert.equal((await getExport('format=zip&scope=all&revision=1')).status,409,'準備中の版更新を検知して出力しない');
editionChanged=false;downloads=0;pdfChecks=0;disclosureChanged=true;
assert.equal((await getExport('format=zip&scope=all&revision=1')).status,409,'開示条件の更新を検知して出力しない');
console.log('PASS: PDF+Excel ZIP contains exact two files of one revision; permission, pending PDF, revision and disclosure changes reject');
