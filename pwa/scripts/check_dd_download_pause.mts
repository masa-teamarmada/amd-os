import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import * as policy from '../src/lib/dd-report-download-policy.ts';
import {ddReportFilename,ddReportBundleFilename} from '../src/lib/dd-report-navigation.ts';
const snapshot={revision:87,documentVersion:'2.0.2',sourceSha256:'a'.repeat(64),title:'Example｜投資検討資料',layoutVersion:'layout-v21'};
const edition={id:'edition',package_id:'package',download_snapshot:snapshot,revision:88,document_version:'2.0.3',source_sha256:'new-screen-source',title:'Example｜投資検討資料'} as any;
assert.equal(policy.ddReportDownloadEdition(edition).document_version,'2.0.2');assert.equal(policy.ddReportDownloadEdition(edition).revision,87);assert.equal(edition.document_version,'2.0.3');
assert(!policy.ddReportExportsPaused({...edition,download_snapshot:null}));assert(policy.ddReportExportsPaused({...edition,package_id:'other'}),'Pause policy is data-driven for every package');
const prefix='private/v2.0.2-r87-disclosureA',xlsx=prefix+'-all.xlsx',pdf=prefix+'-all.pdf',zip=prefix+'-pdf-excel-'+createHash('sha256').update(xlsx).digest('hex').slice(0,12)+'.zip';
const stored=new Set([pdf,xlsx,zip]);let allowed=true,stateCalls=0,changedDisclosure=false,queued=0,generated=0,uploads=0;const signed:string[]=[];
const bucket={info:async(k:string)=>({error:stored.has(k)?null:'missing'}),upload:async()=>{uploads++;throw Error('Must not update files');},createSignedUrl:async(k:string,_ttl:number,opts:{download:string})=>{signed.push(opts.download);return {error:null,data:{signedUrl:'https://storage.example/'+encodeURIComponent(k)}};}};
const mocks:Record<string,any>={
 'next/server':{NextResponse:{json:(v:unknown,init:any)=>new Response(JSON.stringify(v),init),redirect:(url:string,init:any)=>new Response(null,{...init,headers:{...init.headers,Location:url}})}},
 '@/lib/dd-access':{resolveDdPackageAccess:async()=>allowed?{projectId:'project'}:null},'@/lib/dd-package-core':{hasDdCapability:()=>true},'@/lib/dd-package-server':{recordDdAccessEvent:async()=>{}},
 '@/lib/supabase/admin':{createAdminClient:()=>({storage:{from:()=>bucket}})},'@/lib/dd-report-server':{DD_REPORT_BUCKET:'private',loadDdReportEdition:async()=>edition},
 '@/lib/dd-report-output-state':{ddReportOutputState:async(e:any,_p:string,format='pdf')=>{assert.equal(e.document_version,'2.0.2');assert.equal(e.revision,87);stateCalls++;const p=changedDisclosure&&stateCalls>=3?prefix+'-changed':prefix;return {prefix:p,key:p+'-all.'+format,hidden:[],ready:stored.has(p+'-all.'+format)};},queueDdReportPdf:()=>{queued++;}},
 '@/lib/dd-report-download-policy':policy,'fflate':{zipSync:()=>{generated++;throw Error('Must not rebuild ZIP');}},'node:crypto':{createHash},'@/lib/dd-report-pdf':{},'@/lib/dd-report-navigation':{ddReportFilename,ddReportBundleFilename},
 '@/lib/dd-report-output-server':{createDdReportOutput:()=>{generated++;throw Error('Must not render');}},
};
const source=ts.transpileModule(fs.readFileSync(new URL('../src/app/api/dd/[slug]/report/export/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const out:any={};new Function('require','exports',source)((name:string)=>{assert(name in mocks,name);return mocks[name];},out);
const get=async(q:string)=>{stateCalls=0;return out.GET(new Request('https://example.com/api/dd/sol/report/export?'+q),{params:Promise.resolve({slug:'sol'})});};
const status=await get('format=pdf&scope=all&status=1&revision=88&version=2.0.3');assert.deepEqual(await status.json(),{ready:true,paused:true,revision:87,documentVersion:'2.0.2'});
for(const format of ['zip','pdf','xlsx']){const r=await get(`format=${format}&scope=all&revision=87&version=2.0.2`);assert.equal(r.status,303);assert(signed.at(-1)?.includes('v2.0.2'));}
assert.equal((await get('format=xlsx&sheet=共通前提&revision=87&version=2.0.2')).status,303,'Sheet links use the existing complete workbook');
assert.equal((await get('format=zip&revision=88&version=2.0.3')).status,409,'Do not label the frozen files as the edited screen version');
stored.delete(zip);assert.equal((await get('format=zip&revision=87&version=2.0.2')).status,409,'Missing cached file must not regenerate');stored.add(zip);
changedDisclosure=true;assert.equal((await get('format=zip&revision=87&version=2.0.2')).status,409,'Changed disclosure cannot serve the old file');changedDisclosure=false;
allowed=false;assert.equal((await get('format=zip')).status,404);assert.equal(stateCalls,0,'Authenticate before checking files');
assert.equal(queued+generated+uploads,0);
const stateSource=fs.readFileSync(new URL('../src/lib/dd-report-output-state.ts',import.meta.url),'utf8');assert(stateSource.indexOf('if(ddReportExportsPaused(edition))return;')<stateSource.indexOf('after(async'));
console.log('PASS: paused rendering / cached-only PDF, Excel and ZIP / pinned filename / no uploads or polling work / disclosure and access guards');
