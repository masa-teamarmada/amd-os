import {memberSurfacePermission} from '../src/lib/project-surface-permissions.ts';
import {hasDdCapability} from '../src/lib/dd-package-core.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/project-page-record-server.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const calls:Array<{page:string;scope?:string;args?:unknown[]}>=[],filters:Array<[string,string,unknown]>=[];let tablesRead:string[]=[];
let grantSelect='';
const db={from(table:string){tablesRead.push(table);const q:any={select:(fields:string)=>{if(table==='project_grants')grantSelect=fields;return q},eq:(key:string,value:unknown)=>{filters.push([table,key,value]);return q},order:()=>q,lte:()=>q,limit:()=>q,maybeSingle:()=>q,single:()=>q,then:(done:any)=>Promise.resolve({data:table==='projects'?{project_name:'fixture',project_category:'dtsu'}:[],error:null}).then(done)};return q}};
const all={asOf:'2026-10-27',partners:[],partnerInteractions:[{id:'history'}],partnerRoles:[{id:'role'}],history:[{id:'audit'}],fundingSnapshots:[{id:'funding'}],canManage:false};
const mocks:Record<string,any>=Object.fromEntries([...code.matchAll(/require\(["']([^"']+)["']\)/g)].map(m=>[m[1],new Proxy({},{get:(_target,key)=>key==='__esModule'?true:(..._args:unknown[])=>{throw Error('unexpected dependency '+m[1]+'.'+String(key))}})]));
Object.assign(mocks,{
 'server-only':{},
 '@/lib/supabase/admin':{createAdminClient:()=>db},
 '@/lib/project-governance-server':{loadProjectGovernance:async()=>({})},
 '@/lib/project-business-summary-server':{loadProjectBusinessSummary:async()=>{calls.push({page:'business-summary'});return {summary:'fixture',updatedBy:'fixture-owner'}}},
 '@/lib/project-poc-list-server':{loadProjectPocList:async(_db:any,_project:any,scope:string)=>{calls.push({page:'poc',scope});return {audience:scope,canEdit:false,topics:[{tech_topic_id:'topic'}],entries:(scope==='shared'?['both','workspace']:['both','dd']).map(tech_entry_id=>({tech_entry_id}))}}},
 '@/lib/question-tree':{getQuestionTreeBundle:async(...args:unknown[])=>{calls.push({page:'gantt',args});return {}}},
 '@/lib/sx-management':{getSxManagementBundle:async()=>structuredClone(all),computeSxJudgment:()=>({})},
 '@/lib/project-management-logic':{buildDagHealth:()=>({valid:true})},
 '@/lib/project-partner-disclosure':{redactProjectPartnerNames:(value:any)=>value},
 '@/lib/amd-contributions':{buildAmdContributionsPayload:(value:any)=>value},
 '@/lib/project-formats':{projectFormatTypeOf:()=> 'su'},
 '@/lib/dd-pages':{isDdEmptyPageKey:()=>false},
});
const exports:Record<string,any>={};new Function('require','exports',code)((name:string)=>mocks[name],exports);
const read=exports.loadProjectPageRecord;
const actor=(workspace:boolean,dd:boolean,external=true)=>({external,canEditRecords:!external,disclosures:{workspace,dd}});
let data=await read('p21','poc-list',actor(true,true));
assert.deepEqual(data.poc.entries.map((e:any)=>e.tech_entry_id).sort(),['both','dd','workspace']);
assert.equal(data.poc.topics.length,1);
calls.length=0;await read('p21','poc-list',actor(false,true));assert.deepEqual(calls.map(c=>c.scope),['dd']);
calls.length=0;await read('p21','poc-list',actor(true,false));assert.deepEqual(calls.map(c=>c.scope),['shared']);
await assert.rejects(read('p21','poc-list',actor(false,false)),/閲覧範囲/);
calls.length=0;await read('p21','gantt',actor(false,true));assert.deepEqual(calls[0].args,['p21',false,false],'外部のガントへ内部ポイントを載せない');
data=await read('p21','partners',actor(false,true));assert.equal(data.management.partnerInteractions.length,0);assert.equal(data.management.fundingSnapshots.length,0);
data=await read('p21','partners',actor(true,true));assert.equal(data.management.partnerInteractions[0].id,'history','既存のワークスペース入場資格がある本人の履歴を消さない');
filters.length=0;await read('p21','activity',actor(true,true));assert.ok(!grantSelect.includes('notes'));assert.ok(!grantSelect.includes('attachments_json'));assert.ok(filters.some(([t,k,v])=>t==='member_activities'&&k==='workspace_shared'&&v===true));
filters.length=0;await read('p21','activity',actor(true,true,false));assert.ok(grantSelect.includes('notes'));assert.ok(grantSelect.includes('attachments_json'));assert.ok(!filters.some(([_t,k])=>k==='workspace_shared'),'内部の本人の活動を共有済みだけへ狭めない');
calls.length=0;data=await read('p21','company',actor(false,true));assert.equal(data.businessSummary.business,null);assert.ok(!calls.some(c=>c.page==='business-summary'),'DDのみの外部閲覧者へ内部事業概要を追加開示しない');
data=await read('p21','company',actor(true,true));assert.equal(data.businessSummary.business.updatedBy,'fixture-owner');
data=await read('p21','company',{...actor(false,true),memberId:'fixture-member'});assert.equal(data.businessSummary.business.summary,'fixture','既存のAMDメンバーの閲覧資格を保持');
tablesRead=[];await assert.rejects(read('p21','unregistered',actor(true,true)),/登録されていない/);assert.deepEqual(tablesRead,['projects']);
console.log(JSON.stringify({passed:true,checks:['開示済みPoCの和集合・重複排除','入場資格の無い行を取得しない','外部ポイントを送らない','既存の履歴と開示範囲を維持','共有済み活動の権限','未登録の管理記録を拒否'],productionReads:0,productionWrites:0}));


const capabilityCode=ts.transpileModule(readFileSync(new URL('../src/lib/project-page-capabilities.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const capabilityExports:Record<string,any>={};new Function('require','exports',capabilityCode)((name:string)=>{if(name.includes('project-surface-permissions'))return {memberSurfacePermission};if(name.includes('dd-package-core'))return {hasDdCapability};throw Error(name)},capabilityExports);
const capabilities=capabilityExports.projectPageCapabilities;
const reader={memberId:'fixture-reader',isAdmin:false,scope:'project',projects:[],surfaceGrants:[]};
const dd={principal:'internal_member',memberId:'fixture-reader',preview:false,capabilities:['dd.view']};
let rights=capabilities(reader,'fixture-project',dd);assert.equal(rights.external,true);assert.equal(rights.canEditRecords,false);assert.equal(rights.canReadDraft,false);
rights=capabilities(reader,'fixture-project',{...dd,preview:true,capabilities:['dd.view','dd.edit']});assert.equal(rights.canSaveInputs,true);assert.equal(rights.canEditRecords,false,'DDパッケージの編集資格で内部台帳の編集資格を作らない');
rights=capabilities({...reader,surfaceGrants:[{project_id:'fixture-project',member_id:'fixture-reader',surface:'workspace',permission:'view'}]},'fixture-project',dd);assert.equal(rights.external,false);assert.equal(rights.canEditRecords,false);
rights=capabilities({...reader,surfaceGrants:[{project_id:'fixture-project',member_id:'fixture-reader',surface:'workspace',permission:'edit'}]},'fixture-project',dd);assert.equal(rights.canEditRecords,true);
rights=capabilities({...reader,isAdmin:true},'fixture-project',null);assert.equal(rights.canEditRecords,true);assert.equal(rights.external,false);
console.log('actor capabilities: existing project view/edit, DD-only read/edit, and admin scopes retained');
