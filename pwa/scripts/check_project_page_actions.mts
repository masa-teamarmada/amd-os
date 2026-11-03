import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {readProjectPageRuntime} from '../src/lib/project-page-client.ts';
const noop=()=>{};
function callback(file:string,component:string,name:string,scope:Record<string,any>){
 const source=readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const parent=ast.statements.find((n:any)=>ts.isFunctionDeclaration(n)&&n.name?.text===component);assert.ok(parent,component);
 let expression:any;function find(n:any){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name){const init=n.initializer;assert.ok(init);expression=ts.isCallExpression(init)&&init.expression.getText(ast)==='useCallback'?init.arguments[0]:init;}ts.forEachChild(n,find);}find(parent);assert.ok(expression,name);
 const js=ts.transpileModule('exports.run=('+expression.getText(ast)+');',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const output:any={};new Function(...Object.keys(scope),'exports',js)(...Object.values(scope),output);return output.run;
}
const checked:string[]=[];
for(const [file,component,kind,loader]of [
 ['CockpitCostModel','CockpitCostModel','main','loadProjectCostModel'],
 ['CockpitFuelCostModel','CockpitFuelCostModel','fuel','loadProjectFuelCostModel'],
 ['ProjectCostFormat','ProjectCostFormat','main','loadProjectCostModel'],
]){
 const old={canEdit:true,bundle:{version:'old',model:{}}},fresh={canEdit:true,bundle:{version:'saved',model:{}}};let current:any,reads=0;
 const load=callback('components/cockpit/'+file+'.tsx',component,'load',{projectId:'fixture',initialData:old,allowEdit:true,
  refreshPage:async()=>{reads++;return {operations:{record:{costs:{main:fresh,fuel:fresh}}}};},
  [loader]:async()=>{throw Error('common page must not use a second getter');},setCanEdit:noop,setBundle:(value:any)=>current=value,setDraft:(fn:any)=>fn({}),pruneDraft:(_bundle:any,draft:any)=>draft,pruneProjectCostDraft:(_bundle:any,draft:any)=>draft,
  setState:noop,setError:(error:any)=>{throw Error(String(error));},isFuelModel:()=>true});
 await load();assert.equal(current,old.bundle);assert.equal(reads,0);await load(true);assert.equal(current,fresh.bundle);assert.equal(reads,1);checked.push(component);
}
{
 const old={topics:[],entries:[{id:'old'}]},fresh={topics:[],entries:[{id:'saved'}]};let current:any,reads=0;
 const reload=callback('components/cockpit/CockpitTechnology.tsx','CockpitTechnology','reload',{projectId:'fixture',initialData:old,sharedView:false,
  refreshPage:async()=>{reads++;return {operations:{record:{tech:fresh}}};},loadProjectTech:async()=>{throw Error('second getter');},setLoaded:(value:any)=>current=value.data,setError:(error:any)=>{throw Error(String(error));}});
 await reload();assert.equal(current,old);await reload(true);assert.equal(current,fresh);assert.equal(reads,1);checked.push('technology');
}
{
 const old={audience:'internal',entries:[{id:'old'}]},fresh={audience:'internal',entries:[{id:'saved'}]};let current:any,reads=0;
 const load=callback('components/project-workspace/ProjectPocList.tsx','ProjectPocList','load',{projectId:'fixture',initialData:old,enableEditing:true,sharedView:false,
  refreshPage:async()=>{reads++;return {operations:{record:{poc:fresh}}};},loadProjectPocList:async()=>{throw Error('second getter');},setLoaded:(value:any)=>current=value.data,setError:noop,router:{refresh:()=>{throw Error('second refresh');}}});
 await load(true);assert.equal(current,fresh);assert.equal(reads,1);checked.push('PoC');
}
{
 const old={plans:[{id:'old',status:'active'}],versions:[]},fresh={plans:[...old.plans,{id:'saved',status:'active'}],versions:[]};let selected:any,reads=0;
 const load=callback('components/cockpit/CapitalPlanWorkspace.tsx','CapitalPlanWorkspace','loadPlans',{projectId:'fixture',initialData:old,
  refreshPage:async()=>{reads++;return {operations:{record:{capital:fresh}}};},fetch:async()=>{throw Error('second getter');},setPlans:noop,setVersions:noop,selectPlan:(value:any)=>selected=value.id,setSelectedPlanId:noop,setLoading:noop,setError:noop});
 await load(undefined,true);assert.equal(selected,'old');assert.equal(reads,0);await load('saved');assert.equal(selected,'saved');assert.equal(reads,1);checked.push('capital');
}
{
 const fresh={plRows:['saved'],cashRows:['saved-cash'],capitalPlan:{id:'saved'},grants:['saved-grant'],pilot:null,foundedAt:'2026-01-01'};const result:any={};
 const fn=callback('components/cockpit/ProjectFinanceFormat.tsx','ProjectFinanceFormat','reloadPl',{projectId:'fixture',refreshPage:async()=>({operations:{record:{finance:fresh}}}),loadPlMonthly:async()=>{throw Error('second getter');},
  ...Object.fromEntries(['PlRows','CashRows','CapitalPlan','Grants','Pilot','FoundedAt'].map(k=>['set'+k,(value:any)=>result[k[0].toLowerCase()+k.slice(1)]=value]))});
 await fn();assert.deepEqual(result,fresh);checked.push('finance');
}
{
 const fresh={canEdit:false,assets:[{id:'saved'}],deadlines:[],rights:[],events:[]};let result:any;
 const fn=callback('components/cockpit/CockpitIpPortfolio.tsx','CockpitIpPortfolio','load',{projectId:'fixture',refreshPage:async()=>({operations:{record:{portfolio:fresh}}}),fetch:async()=>{throw Error('second getter');},setData:(value:any)=>result=value,setLoading:noop,setError:noop});
 await fn();assert.deepEqual(result,fresh);checked.push('IP');
}
{
 const fresh={id:'saved'};let result:any;
 const fn=callback('components/cockpit/CockpitCompanyOverview.tsx','CockpitCompanyOverview','load',{projectId:'fixture',refreshPage:async()=>({operations:{record:{governance:fresh}}}),loadGovernance:async()=>{throw Error('second getter');},setData:(value:any)=>result=value,setLoading:noop,setError:noop});
 await fn();assert.equal(result,fresh);checked.push('company');
}
{
 const previous=globalThis.fetch,calls:any[]=[],signal=new AbortController().signal;try{
 globalThis.fetch=(async(url:any,options:any)=>{calls.push({url,options});return Response.json({runtime:{pageId:'fixture'}});}) as typeof fetch;
 const value=await readProjectPageRuntime('/fixture',signal);assert.equal(value.pageId,'fixture');assert.equal(calls.length,1);assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.signal,signal);
 globalThis.fetch=(async()=>Response.json({error:'denied'},{status:403}))as typeof fetch;await assert.rejects(readProjectPageRuntime('/fixture'),/denied/);
 }finally{globalThis.fetch=previous;}checked.push('common runtime read');
}
console.log(JSON.stringify({passed:true,checked,method:'execute actual source callbacks before and after a changed record; no browser or production writes',productionWrites:0}));
