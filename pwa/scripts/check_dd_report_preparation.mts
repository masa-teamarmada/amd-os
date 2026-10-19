import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {ddReportVersionLabel} from '../src/lib/dd-report-navigation.ts';
import * as downloadPolicy from '../src/lib/dd-report-download-policy.ts';
import {PDFDocument} from 'pdf-lib';
const sample=await PDFDocument.create();sample.addPage([200,200]);const part=await sample.save();
const store=new Map<string,Uint8Array>(),allKey='private/r2-all.pdf',prefix='private/r2';
let rendered=0,changedDuringRender=false,changedDisclosure=false,freshRevision=2,seenOverrides:unknown;
const edition={id:'edition',revision:2,document_version:'2.0.0',status:'published',title:'Example',source_version:'test',input_overrides:{volume:1}};
const fresh={...edition,input_overrides:{volume:2}};
const bucket={
 info:async(p:string)=>({error:store.has(p)?null:{message:'not found'}}),
 upload:async(p:string,b:Uint8Array|string)=>{if(store.has(p))return {error:{message:'already exists'}};store.set(p,typeof b==='string'?Buffer.from(b):b);return {error:null};},
 download:async(p:string)=>store.has(p)?{error:null,data:{arrayBuffer:async()=>store.get(p)!,text:async()=>Buffer.from(store.get(p)!).toString()}}:{error:{message:'not found'},data:null},
 remove:async(paths:string[])=>{paths.forEach(p=>store.delete(p));return {error:null};},
};
const db={storage:{from:()=>bucket},from:()=>({select:()=>({eq:()=>({single:async()=>({error:null,data:{...fresh,revision:freshRevision}})})})})};
const mocks:Record<string,unknown>={
 'server-only':{},'node:crypto':await import('node:crypto'),'pdf-lib':{PDFDocument},
 './dd-report-download-policy':downloadPolicy,
 './supabase/admin':{createAdminClient:()=>db},
 './dd-report-navigation':{ddReportVersionLabel},
 './dd-report-output-state':{ddReportOutputState:async()=>({prefix,key:changedDisclosure&&rendered?'different.pdf':allKey,hidden:[],ready:store.has(allKey)})},
 './dd-report-server':{DD_REPORT_BUCKET:'private',loadDdReportChapterIndex:async()=>Array.from({length:5},(_,i)=>({slug:'chapter-'+i,sort_order:i})),loadDdReportChapter:async(_e:string,slug:string)=>({slug,body:{rows:[],objects:[]}}),loadDdReportModel:async()=>({}),updateDdReportBody:(b:unknown)=>b},
 './dd-report-model':{DdReportCalculator:class {constructor(_m:unknown,o:unknown){seenOverrides=o;}}},
 './dd-report-export':{orderedDdChapters:(x:unknown)=>x,ddReportPdf:async()=>{rendered++;if(changedDuringRender)freshRevision=3;return part;}},
 './dd-report-pdf':{deduplicateDdPdfStreams:()=>{},finalizeDdPdfNavigation:async()=>({})},
 './workspace-document-html-pdf':{},'./project-partner-disclosure':{redactProjectPartnerNames:(v:unknown)=>v},
};
const source=ts.transpileModule(fs.readFileSync(new URL('../src/lib/dd-report-output-server.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const out:Record<string,(...args:unknown[])=>Promise<void>>={};new Function('require','exports',source)((name:string)=>{assert(name in mocks,name);return mocks[name];},out);
await out.prepareDdReportPdf({...edition,package_id:'b0540a9f-7bde-426c-81a7-8a56a59f5b15'},'project','sol');assert.equal(rendered,0,'Paused SOL view must not render');
await assert.rejects(()=>out.createDdReportOutput({edition:{...edition,package_id:'b0540a9f-7bde-426c-81a7-8a56a59f5b15'}}),/更新は停止中/);
await out.prepareDdReportPdf(edition,'project','test');assert.equal(rendered,2);assert(store.has(allKey));assert.deepEqual(seenOverrides,{volume:2});assert(!store.has(prefix+'-building.json'));
await out.prepareDdReportPdf(edition,'project','test');assert.equal(rendered,2);
store.delete(allKey);store.delete(prefix+'-part-1.pdf');await out.prepareDdReportPdf(edition,'project','test');assert.equal(rendered,3);assert(store.has(allKey));
store.clear();rendered=0;changedDuringRender=true;await out.prepareDdReportPdf(edition,'project','test');assert(!store.has(allKey));assert(!store.has(prefix+'-building.json'));
store.clear();rendered=0;changedDuringRender=false;freshRevision=2;changedDisclosure=true;await out.prepareDdReportPdf(edition,'project','test');assert(!store.has(allKey));
store.clear();rendered=0;changedDisclosure=false;store.set(prefix+'-building.json',Buffer.from(JSON.stringify({startedAt:Date.now()})));await out.prepareDdReportPdf(edition,'project','test');assert.equal(rendered,0);
store.set(prefix+'-building.json',Buffer.from(JSON.stringify({startedAt:Date.now()-400000})));await out.prepareDdReportPdf(edition,'project','test');assert.equal(rendered,2);assert(store.has(allKey));
console.log('PASS: PDF prebuild / fresh saved inputs / cached no-op / partial resume / revision and disclosure changes abort / active and expired leases');
