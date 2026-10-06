import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { jsx, jsxs } from 'react/jsx-runtime';
function compile(file: string, mocks: Record<string, unknown>) {
  const exports: Record<string, any> = {};
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'exports', code)((name: string) => { assert.ok(name in mocks, name); return mocks[name]; }, exports);
  return exports;
}
type Row = Record<string, any>;
const calls: { table: string; filters: [string, string, unknown][]; from: number; to: number }[] = [];
let failedTable = '';
const tables: Record<string, Row[]> = {
  projects: [{ project_id: 'p21', project_name: 'project', status: 'active' }],
  value_plan_cycles: [
    { project_id: 'p21', plan_cycle_id: 'current', status: 'active', period_start_ym: '200001', period_end_ym: '209912' },
    { project_id: 'p21', plan_cycle_id: 'past', status: 'fixed', period_start_ym: '199001', period_end_ym: '199912' },
  ],
  value_milestones: Array.from({length: 201}, (_, i) => ({ milestone_id: `m${i}`, plan_cycle_id: i === 200 ? 'past' : 'current', is_active: true, sort_order: i, title: `milestone${i}` })),
  milestone_monthly_progress: [...Array.from({length: 1001}, (_, i) => ({ milestone_key: 'm0', ym: String(i), progress_pct: 1 })), {milestone_key: 'm200', ym: 'last'}, {milestone_key: 'other-project', ym: 'never'}],
  milestone_sub_items: [{sub_item_id:'last-sub',milestone_id:'m200',title:'last'}],
  milestone_responsibility: [{milestone_id:'m200',member_id:'last-member'}],
  member_ms_activities: [{milestone_id:'m200',member_id:'last-member',ym:'last',narrative:'retained'}],
  member_activities: [{id:'last-activity',project_id:'p21',milestone_id:'m200'}, {id:'cross-project',project_id:'p34',milestone_id:'m200'}],
};
const db = { from(table: string) {
  const call = {table,filters:[] as [string,string,unknown][],from:0,to:999};
  let single = false;
  const query = {
    select(){return query}, order(){return query},
    eq(k:string,v:unknown){call.filters.push(['eq',k,v]);return query},
    in(k:string,v:unknown[]){call.filters.push(['in',k,v]);assert.ok(v.length<=200);return query},
    gte(){return query},lt(){return query},limit(){return query},
    range(from:number,to:number){call.from=from;call.to=to;return query},
    single(){single=true;return query},maybeSingle(){single=true;return query},
    then(resolve:(v:unknown)=>unknown){calls.push(call);const rows=(tables[table]??[]).filter(r=>call.filters.every(([op,k,v])=>op==='eq'?r[k]===v:(v as unknown[]).includes(r[k]))).slice(call.from,call.to+1);return Promise.resolve({data:single?rows[0]??null:rows,error:failedTable===table?{message:'fixture failure'}:null}).then(resolve)},
  };return query;
}};
const cockpit = compile('../src/lib/supabase-data.ts', {
  '@supabase/supabase-js':{createClient:()=>db},'@/lib/supabase/client':{createClient:()=>db},
  '@/lib/contract-money':{contractBackedClientAmount:()=>0,yenNumber:()=>0},
  '@/lib/finance/season-finance':{allocateSeasonBufferByYm:()=>new Map(),buildExtraRevenueCashByYm:()=>new Map(),parseSeasonBufferTotal:()=>0},
  '@/lib/reward-finance-summary':{externalUnpaidStockYen:()=>0,fundedNonCashAllocationYen:()=>0},
});
const data = await cockpit.fetchCockpitFromSupabase('p21',db);
assert.equal(data.milestones.length,200);
assert.equal(data.progress.length,1001,'progress pagination must not truncate at 1000');
const past=data.pastPlanCycles[0];
assert.equal(past.milestones[0].milestoneId,'m200');assert.equal(past.progress[0].ym,'last');
assert.equal(past.subItems[0].subItemId,'last-sub');assert.equal(past.responsibilities[0].memberId,'last-member');
assert.equal(past.msActivities[0].narrative,'retained');assert.equal(past.memberActivities.length,1);
assert.ok(calls.filter(c=>c.table==='milestone_monthly_progress').every(c=>c.filters.some(([op,k])=>op==='in'&&k==='milestone_key')),'never read progress across all projects');
failedTable='milestone_sub_items';await assert.rejects(cockpit.fetchCockpitFromSupabase('p21',db),/fixture failure/);failedTable='';
tables.value_plan_cycles=[];calls.length=0;assert.equal((await cockpit.fetchCockpitFromSupabase('p21',db)).pastPlanCycles.length,0);assert.ok(!calls.some(c=>c.table==='value_milestones'),'empty cycles do not cause unscoped reads');

// DD normal pages skip live attachments; documents read only published documents.
tables.dd_packages=[{id:'package',project_id:'p21',title:'project'}];
tables.dd_package_items=[
 {id:'doc',title:'doc',sort_order:1,package_id:'package',project_id:'p21',status:'active',is_published:true,item_kind:'document',section_key:'documents',source_key:'doc'},
 {id:'tech',title:'tech',sort_order:2,package_id:'package',project_id:'p21',status:'active',is_published:true,item_kind:'tech_topic',section_key:'documents',source_key:'tech'},
 {id:'draft',title:'draft',sort_order:3,package_id:'package',project_id:'p21',status:'active',is_published:false,item_kind:'document',section_key:'documents',source_key:'draft'},
];
const liveReads:string[]=[];
const dd = compile('../src/lib/dd-package-server.ts', {
 'server-only':{},'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/workspace-access-audit':{},
 '@/lib/dd-package-core':{DD_SECTIONS:[{key:'documents',label:'documents',description:''}],isDdSectionKey:()=>true},
 '@/lib/dd-payload':{isDdItemKind:()=>true},
 '@/lib/dd-sources':{loadDdItemLive:async(o:any)=>{liveReads.push(o.sourceKey);return {data:{kind:o.itemKind},sourceAsOf:'20261006',autoUnverified:[]}},mergeDdUnverifiedNotes:()=>[]},
 '@/lib/dd-pages':{ddPageForItem:(kind:string)=>kind==='document'?'documents':'technology'},
});
const access={packageId:'package',projectId:'p21',slug:'sol'};
calls.length=0;await dd.loadDdPackageView(access,{mode:'header'});assert.equal(liveReads.length,0);assert.ok(!calls.some(c=>c.table==='dd_package_items'));
const documents=await dd.loadDdPackageView(access,{mode:'documents'});assert.deepEqual(liveReads,['doc']);assert.deepEqual(documents.sections[0].items.map((i:any)=>i.itemId),['doc']);
liveReads.length=0;await dd.loadDdPackageView(access);assert.deepEqual(liveReads,['doc','tech'],'legacy and default full view retain all published live projections');

// Route still revalidates admission before any data/audit access, on every tab.
let allowed=false;let routeReads=0;let audits=0;const modes:string[]=[];
const page=compile('../src/app/dd/[slug]/page.tsx',{
 'react/jsx-runtime':{jsx,jsxs},'next/navigation':{notFound:()=>{throw new Error('not found')}},
 '@/lib/dd-access':{resolveDdPackageAccess:async()=>allowed?access:null},
 '@/lib/dd-package-server':{loadDdPackageView:async(_:unknown,o:any)=>{routeReads++;modes.push(o.mode);return {package:{project_id:'p21'},projectName:'project',sections:[]}},recordDdAccessEvent:async()=>{audits++}},
 '@/components/dd/DdViewerShell':{DdViewerShell:()=>null},'@/components/dd/DdPackageTop':{DdPackageTop:()=>null},
 '@/lib/dd-package-core':{hasDdCapability:()=>false},'@/lib/dd-pages':{DD_PAGE_KEYS:['company','documents']},
 '@/lib/dd-project-pages-server':{loadDdProjectPage:async()=>{routeReads++;return {page:'company'}}},
});
const props=(tab:string)=>({params:Promise.resolve({slug:'sol'}),searchParams:Promise.resolve({tab})});
await assert.rejects(page.default(props('company')),/not found/);assert.equal(routeReads,0);assert.equal(audits,0);
allowed=true;await page.default(props('company'));await page.default(props('documents'));assert.deepEqual(modes,['header','documents']);assert.equal(audits,2);
allowed=false;await assert.rejects(page.default(props('company')),/not found/);assert.equal(audits,2,'revocation stops the next page request before data or audit');
console.log('project space loading: cycle scope/chunking/pagination/history/error, DD selective loading/full compatibility/fresh authorization/audit OK');

// A tab is an in-page view: preserve deep-link params without requesting the RSC route again.
const locations: string[] = []; let routeNavigations = 0;
const search = new URLSearchParams('tab=company&ym=202609&meeting=m1');
const clientPage = compile('../src/app/(app)/project/[projectId]/cockpit/page.tsx', {
  'react/jsx-runtime': {jsx,jsxs},
  react: {useEffect:()=>{},useState:()=>[{projectId:'p21',cockpit:{tasks:[]},error:null},()=>{}]},
  'next/navigation': {useParams:()=>({projectId:'p21'}),usePathname:()=>'/project/p21/cockpit',useSearchParams:()=>search,useRouter:()=>({replace:()=>{routeNavigations++}})},
  '@/components/cockpit/CockpitView': {CockpitView:()=>null},
  '@/lib/cockpit-tabs': {DEFAULT_COCKPIT_TAB:'issues',NON_DEFAULT_COCKPIT_TABS:['company','contracts']},
  '@/lib/project-page-prefetch': {},'@/lib/supabase-data': {},
});
Object.defineProperty(globalThis, 'window', {configurable:true,value:{history:{replaceState:(_:unknown,_title:string,url:string)=>locations.push(url)}}});
try {
  const rendered=clientPage.default();rendered.props.onTabChange('contracts');rendered.props.onTabChange('issues');
  assert.equal(locations[0],'/project/p21/cockpit?tab=contracts&ym=202609&meeting=m1');
  assert.equal(locations[1],'/project/p21/cockpit?ym=202609&meeting=m1');
  assert.equal(routeNavigations,0,'switching an admitted PJ tab does not wait for a new server navigation');
} finally { delete (globalThis as Record<string,unknown>).window; }
console.log('cockpit tab navigation: native history, preserved modal/deep-link params, default-tab normalization, no RSC navigation OK');
