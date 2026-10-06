import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const institutionBundle = {institutions:[],axes:[],criteria:[],assessmentsByInstitution:{},assessmentHistoryByInstitution:{},institutionProjectsByInstitution:{},seedCountByInstitution:{},institutionProjectIds:[]};
function compile(file:string, mocks:Record<string,unknown>) {
  const exports:Record<string,any>={};
  const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports',code)((name:string)=>{assert.ok(name in mocks,name);return mocks[name]},exports);
  return exports;
}
let queries=0;let failSeeds=false;const filters:string[]=[];
const seedRows=Array.from({length:1001},(_,i)=>({id:String(i),title:`seed${i}`,org_name:'org',researcher_name:null,status:'candidate'}));
const db={from(table:string){queries++;let from=0,to=999;return {select(){return this},order(){return this},eq(k:string,v:unknown){filters.push(`${k}:${v}`);return this},range(a:number,b:number){from=a;to=b;return this},then(done:(x:unknown)=>unknown){const data=table==='seeds'?seedRows:table==='seed_projects'?[{seed_id:'1000',project_id:'project-last',projects:{project_name:'last',status:'active',client_name:'org'}}]:[{id:'new',seed_id:'1000',sps_lower_yen:10,sps_upper_yen:20},{id:'old',seed_id:'1000',sps_lower_yen:1,sps_upper_yen:2}];return Promise.resolve(done({data:data.slice(from,to+1),error:failSeeds&&table==='seeds'?{message:'failed'}:null}));}}}};
const server=compile('../src/lib/portfolio-pulse-server.ts',{'server-only':{},'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/ers-data':{fetchErsBundle:async()=>institutionBundle},'@/lib/current-sps-model':{CURRENT_SPS_MODEL:{measureVersion:'current',assessmentRulesetVersion:'rules'}}});
const [a,b]=await Promise.all([server.loadPortfolioPulse({db}),server.loadPortfolioPulse({db})]);
assert.equal(a,b,'concurrent reads share one snapshot');assert.equal(a.seeds.length,1001);assert.equal(a.seeds[1000].project_links[0].project_id,'project-last');assert.equal(a.screeningBands.length,1);assert.equal(a.screeningBands[0].assessment_id,'new');assert.ok(!('assessmentHistoryByInstitution' in a.institutionBundle));
assert.deepEqual(filters,['measure_version:current','ruleset_version:rules','frozen:true']);
const readCount=queries;await server.loadPortfolioPulse({db});assert.equal(queries,readCount,'warm read performs zero queries');
await server.loadPortfolioPulse({db,fresh:true});assert.ok(queries>readCount,'fresh read bypasses snapshot');
server.invalidatePortfolioPulseCache();failSeeds=true;const partial=await server.loadPortfolioPulse({db});assert.equal(partial.seedsError,true);assert.equal(partial.institutionError,false);assert.equal(partial.screeningBandsError,false);
const failedCount=queries;failSeeds=false;assert.equal((await server.loadPortfolioPulse({db})).seedsError,false);assert.ok(queries>failedCount,'partial failure must be retried');
let authenticated=true;let access:any={scope:'portfolio'};let dataReads=0;let adminCreated=0;
const route=compile('../src/app/api/dashboard/portfolio-pulse/route.ts',{'next/server':{NextResponse:Response},'@/lib/supabase/api-auth':{requireMember:async()=>authenticated?{ok:true}:{ok:false,errorResponse:Response.json({}, {status:401})}},'@/lib/project-workspace':{getCurrentMemberAccess:async()=>access},'@/lib/supabase/admin':{createAdminClient:()=>{adminCreated++;return db}},'@/lib/portfolio-pulse-server':{loadPortfolioPulse:async(o:any)=>{dataReads++;assert.equal(o.fresh,true);return a}}});
const req=new Request('https://example.test/api/dashboard/portfolio-pulse?fresh=1');
authenticated=false;assert.equal((await route.GET(req)).status,401);authenticated=true;
for(const denied of [null,{scope:'project'}]){access=denied;assert.equal((await route.GET(req)).status,403)}
assert.equal(dataReads,0);assert.equal(adminCreated,0,'denied identity never creates data client');access={scope:'portfolio'};assert.equal((await route.GET(req)).status,200);assert.equal(dataReads,1);
console.log('portfolio loading: pagination >1000, latest current band, parallel/cache/fresh, failure isolation/retry, authorization before data OK');
