import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
let access:unknown=null,edition:unknown={id:'edition',revision:7,input_overrides:{base:2}},calculationFails=false,calculated:unknown;
const published={slug:'cyanobacteria-cost',source_sheet:'シアノ生産コスト',body:{rows:[],objects:[]}};
const mocks:Record<string,unknown>={
 'next/server':{NextResponse:{json:(body:unknown,opts:{status?:number}={})=>({body,status:opts.status??200})}},
 '@/lib/dd-access':{resolveDdPackageAccess:async()=>access},
 '@/lib/workspace-mutation-origin':{isSameOriginWorkspaceMutation:(r:Request)=>r.headers.get('origin')==='https://example.test'},
 '@/lib/dd-report-server':{loadDdReportEdition:async()=>edition,loadDdReportModel:async()=>({}),loadDdReportChapter:async(_id:string,slug:string)=>slug===published.slug?published:null,updateDdReportBody:(_b:unknown,_s:string,calc:unknown)=>({calculated:calc}),redactDdReport:async(_pj:string,c:unknown)=>({redacted:c})},
 '@/lib/dd-report-model':{validateDdOverrides:(_m:unknown,v:unknown)=>JSON.stringify(v)==='{"trial":4}',DdReportCalculator:class {constructor(_m:unknown,v:unknown){if(calculationFails)throw Error('invalid');calculated=v;}}},
};
const source=ts.transpileModule(fs.readFileSync(new URL('../src/app/api/dd/[slug]/report/simulate/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const out:{POST?:(r:Request,p:unknown)=>Promise<{body:any;status:number}>}={};new Function('require','exports',source)((name:string)=>{assert(name in mocks,'Unexpected dependency / write path: '+name);return mocks[name];},out);
const request=(value:unknown,origin='https://example.test')=>new Request('https://example.test/api/dd/sol/report/simulate',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(value)}),params={params:Promise.resolve({slug:'sol'})},valid={revision:7,chapter:'cyanobacteria-cost',values:{trial:4}};
assert.equal((await out.POST!(request(valid),params)).status,404);access={principal:'workspace_account',projectId:'p21'};
assert.equal((await out.POST!(request(valid,'https://foreign.test'),params)).status,403);
assert.equal((await out.POST!(request({...valid,revision:6}),params)).status,409);
assert.equal((await out.POST!(request({...valid,chapter:'foreign'}),params)).status,404);
assert.equal((await out.POST!(request({...valid,values:{unknown:1}}),params)).status,400);
calculationFails=true;assert.equal((await out.POST!(request(valid),params)).status,422);calculationFails=false;
const result=await out.POST!(request(valid),params);assert.equal(result.status,200);assert(result.body.chapter.redacted);assert.deepEqual(calculated,{base:2,trial:4});assert.deepEqual((edition as any).input_overrides,{base:2});
edition=null;assert.equal((await out.POST!(request(valid),params)).status,404);
console.log('PASS: read-only DD scenarios / access / origin / revision / known inputs / calculation / disclosure / canonical plan unchanged / no persistence dependencies');
