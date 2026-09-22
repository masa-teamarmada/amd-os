import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectRoadmapWork, groupRoadmapQuestions, type ProjectGanttRoadmap } from '../src/lib/project-gantt-roadmap.ts';
import type { ActionNode, QuestionNode } from '../src/lib/question-tree-types.ts';
const sql = readFileSync('../ios/supabase/migrations/20260916160000_sol_meeting_gantt_roadmap.sql', 'utf8');
const roadmap = JSON.parse(sql.split('$roadmap$')[1]) as ProjectGanttRoadmap;
assert.equal(roadmap.phases.length, 13);
assert.deepEqual(roadmap.groups.map(g => g.title), ['経営企画／事業開発','技術開発','組織開発','資金調達']);
assert.deepEqual(roadmap.markers.map(m => m.date.slice(0,7)), ['2027-04','2027-05']);
for (const phase of roadmap.phases) {
 assert.ok(phase.start <= phase.end);
 assert.ok(!phase.extensionEnd || phase.end < phase.extensionEnd);
 assert.ok(roadmap.groups.some(g => g.id === phase.group));
}
const node = (id: string, children: QuestionNode[] = [], proposed = false) => ({id,children,isProposed:proposed,actions:[]} as unknown as QuestionNode);
const top = roadmap.phases.find(p => p.id === 'team')!.questionIds[0];
const cost = roadmap.phases.find(p => p.id === 'cost')!.questionIds[0];
const strategy = roadmap.phases.find(p => p.id === 'strategy')!.questionIds[0];
const tree = [node(top,[node(strategy,[node(cost,[node('cost-child')]),node('strategy-child'),node('proposal',[],true)])]),node('new-unmapped-root')];
const before = JSON.stringify(tree);
const result = groupRoadmapQuestions(tree, roadmap);
const flatten = (nodes: QuestionNode[]): string[] => nodes.flatMap(n => [n.id,...flatten(n.children)]);
assert.deepEqual(flatten(result.byPhase.get('team')!), [top]);
assert.deepEqual(flatten(result.byPhase.get('strategy')!), [strategy,'strategy-child']);
assert.deepEqual(flatten(result.byPhase.get('cost')!), [cost,'cost-child']);
assert.deepEqual(flatten(result.ungrouped), ['new-unmapped-root']);
const ids = [...result.byPhase.values(), result.ungrouped].flatMap(flatten);
assert.equal(ids.length, new Set(ids).size, 'no duplicate questions across phases');
assert.ok(!ids.includes('proposal'), 'unaccepted questions stay out of gantt');
assert.equal(JSON.stringify(tree), before, 'canonical hierarchy must not mutate');
console.log('PASS: 13 phases, 4 lanes, 2 milestones, inherited grouping, unique coverage, proposal isolation, immutable source');

const action = (id: string, start: string | null, end: string | null, children: ActionNode[] = []) =>
  ({id,title:id,parentId:null,plannedStart:start,plannedEnd:end,children,isProposed:false} as unknown as ActionNode);
const task = action('parent', '2020-01-01', '2030-12-31', [
  action('early', '2026-03-01', '2026-04-01'),
  action('nested', '2022-01-01', '2031-01-01', [action('late','2026-05-01','2026-10-15')]),
  action('undated',null,null),
  {...action('proposed','2010-01-01','2040-01-01'),isProposed:true},
]);
const milestone = {...node('ms'),questionKind:'milestone',dueDate:'2044-01-01',actions:[task]} as QuestionNode;
const ordinary = {...node(strategy,[milestone]),dueDate:'2050-01-01',questionKind:'open'} as QuestionNode;
const work = projectRoadmapWork([ordinary],roadmap);
const phase = work.phases.find(p=>p.id==='strategy')!;
assert.deepEqual(phase.range,{start:'2026-03-01',end:'2026-10-15'});
assert.equal(phase.items[0].kind,'milestone');
assert.deepEqual(phase.items[0].range,phase.range);
assert.deepEqual(phase.items[0].children[0].range,phase.range);
assert.equal(phase.items[0].children[0].children.length,3);
assert.equal(work.end,'2027-06-30','ignore parent/question/proposal dates');
task.children[1].children[0].plannedEnd='2028-08-09';
const moved=projectRoadmapWork([ordinary],roadmap);
assert.equal(moved.phases.find(p=>p.id==='strategy')!.range!.end,'2028-08-09');
assert.equal(moved.end,'2028-09-30','axis expands to contain changed children');
const noDates=projectRoadmapWork([{...ordinary,children:[],actions:[action('parent-undated','2026-01-01','2026-12-01',[action('empty',null,null)])]}],roadmap);
assert.equal(noDates.phases.find(p=>p.id==='strategy')!.range,null,'undated children never inherit parent or slide dates');
const leaf=projectRoadmapWork([],roadmap).phases[0];
assert.deepEqual(leaf.range,{start:leaf.start,end:leaf.end},'unbroken-down leaf phase retains source plan');
const duplicate=projectRoadmapWork([{...ordinary,actions:[task],children:[{...node('linked'),actions:[{...task.children[0],parentId:task.id}]}]}],roadmap);
assert.equal(duplicate.phases.find(p=>p.id==='strategy')!.items.length,1,'child link never displaces task hierarchy');
assert.equal(duplicate.phases.find(p=>p.id==='strategy')!.items[0].id,'parent');
console.log('PASS: MS/tasks only, nested rollup, changed dates, undated children, axis expansion, leaf plan, duplicate links');
const overlappingRoadmap = {...roadmap, phases: roadmap.phases.map(p=>p.id==='build' ? {...p,start:'2026-02-01'} : p)};
const overlapping=projectRoadmapWork([],overlappingRoadmap);
assert.notEqual(overlapping.phases.find(p=>p.id==='design')!.row,overlapping.phases.find(p=>p.id==='build')!.row,'overlapping schedules stack instead of covering each other');

const explicit = (a: ActionNode, phaseId: string | null) => ({...a,ganttPhaseOverride:true,ganttPhaseId:phaseId});
const fresh = explicit(action('new-task','2026-07-01','2026-10-01'),'strategy');
const loose = action('loose',null,null);
const idsOf = (items: ReturnType<typeof projectRoadmapWork>['ungrouped']): string[] => items.flatMap(i=>[i.id,...idsOf(i.children)]);
const phaseOf = (result: ReturnType<typeof projectRoadmapWork>, id: string) => result.phases.find(p=>idsOf(p.items).includes(id))?.id;
const created = projectRoadmapWork([],roadmap,[fresh,loose]);
assert.equal(phaseOf(created,fresh.id),'strategy');
assert.equal(phaseOf(created,loose.id),undefined);
assert.deepEqual(created.phases[0].range,{start:'2026-07-01',end:'2026-10-01'});
const linked = {...node(cost),actions:[fresh]};
const canonicalBefore = JSON.stringify(linked);
const explicitWins = projectRoadmapWork([linked],roadmap,[fresh]);
assert.equal(phaseOf(explicitWins,fresh.id),'strategy','explicit placement overrides linked question phase');
assert.equal(JSON.stringify(linked),canonicalBefore,'linking never mutates canonical questions');
assert.equal(explicitWins.phases.flatMap(p=>idsOf(p.items)).filter(id=>id===fresh.id).length,1);
const detached = explicit(fresh,null);
assert.equal(phaseOf(projectRoadmapWork([{...linked,actions:[detached]}],roadmap,[detached]),fresh.id),undefined,'detach suppresses inference');
const child = {...action('child','2026-08-01','2026-12-31'),parentId:'family'};
const splitChild = explicit({...action('split-child','2027-01-01','2027-02-01'),parentId:'family'},'cost');
const family = explicit(action('family','2020-01-01','2040-01-01',[child,splitChild]),'strategy');
const familyWork = projectRoadmapWork([],roadmap,[splitChild,child,family]);
assert.equal(phaseOf(familyWork,'child'),'strategy','children follow parent');
assert.equal(phaseOf(familyWork,'split-child'),'cost','child explicit placement wins');
assert.deepEqual(familyWork.phases[0].range,{start:'2026-08-01',end:'2026-12-31'});
assert.equal(idsOf(familyWork.phases[0].items).filter(id=>id==='child').length,1);
const sameChild = explicit(child,'strategy');
const sameFamily = {...family,children:[sameChild]};
assert.deepEqual(idsOf(projectRoadmapWork([],roadmap,[sameChild,sameFamily]).phases[0].items),['family','child']);
const proposal = {...family,isProposed:true};
assert.equal(projectRoadmapWork([],roadmap,[proposal,child,splitChild]).phases.flatMap(p=>idsOf(p.items)).length,0,'proposed branch cannot leak explicit descendants');
const unlinkedFamily = explicit(family,null);
const unlinkWork = projectRoadmapWork([],roadmap,[unlinkedFamily,child,splitChild]);
assert.equal(phaseOf(unlinkWork,'child'),undefined);
assert.equal(phaseOf(unlinkWork,'split-child'),'cost','independent child placement survives parent detachment');
console.log('PASS: direct creation, existing-task precedence, detachment, canonical preservation, nested moves, proposal isolation');

// Exercise the real route with an isolated persistence adapter: no live task writes.
const {createRequire} = await import('node:module');
const require = createRequire(import.meta.url);
const ts = require('typescript');
const vm = await import('node:vm');
const routeSource = readFileSync('src/app/api/project/[projectId]/question-tree/route.ts','utf8');
let access: {scope:string;isAdmin:boolean;memberId:string} | null = {scope:'portfolio',isAdmin:false,memberId:'test-member'};
let allowed = true;
let writes: Record<string,unknown>[] = [];
let existing: Record<string,unknown> = {id:'existing',project_id:'p21',title:'existing',version:1,review_state:'accepted',parent_id:'parent',planned_start:'2026-06-01',planned_end:'2026-07-01'};
const bundleReadback = {projectId:'p21',allActions:[]};
const adapter = {
  from(table: string) {
    assert.equal(table,'project_actions');
    const chain = {
      insert(row: Record<string,unknown>) {writes.push(row);return chain;},
      update(row: Record<string,unknown>) {writes.push(row);return chain;},
      select() {return chain;}, eq() {return chain;}, is() {return chain;},
      async single() {return {data:{id:'created'},error:null};},
      async maybeSingle() {return {data:existing,error:null};},
      then(resolve: (v:unknown)=>unknown) {return Promise.resolve({error:null}).then(resolve);},
    };return chain;
  },
};
const exports: Record<string,(r:unknown,p:unknown)=>Promise<{status:number;body:Record<string,unknown>}>> = {};
vm.runInNewContext(ts.transpileModule(routeSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports, require:(name:string) => {
    if(name==='next/server')return {NextResponse:{json:(body:unknown,options?:{status?:number})=>({status:options?.status??200,body})}};
    if(name==='@/lib/project-workspace')return {getCurrentMemberAccess:async()=>access,canAccessWorkspaceProject:()=>allowed};
    if(name==='@/lib/question-tree')return {getQuestionTreeBundle:async()=>bundleReadback};
    if(name==='@/lib/reward-summary')return {syncRewardSummaryForCycle:async()=>({ok:true})};
    if(name==='@/lib/supabase/admin')return {createAdminClient:()=>adapter};
    throw new Error(name);
  },
});
const request = (fields:Record<string,unknown>, screen=true) => ({json:async()=>({resource:'action',id:'existing',fields}),headers:{get:()=>screen?'screen':null}});
const params = {params:Promise.resolve({projectId:'p21'})};
let response=await exports.POST(request({title:'new',gantt_phase_id:'strategy',planned_start:'2026-06-01',planned_end:'2026-07-01'}),params);
assert.equal(response.status,200);assert.equal(writes.length,1);assert.equal(writes[0].gantt_phase_id,'strategy');assert.equal(writes[0].gantt_phase_override,true);assert.equal(writes[0].review_state,'accepted');assert.equal(response.body.bundle,bundleReadback);
writes=[];
await exports.POST(request({title:'proposal',gantt_phase_id:'strategy'},false),params);
assert.equal(writes[0].review_state,'proposed','agent proposals remain proposals');
writes=[];
response=await exports.PATCH(request({gantt_phase_id:null}),params);
assert.equal(response.status,200);assert.equal(writes[0].gantt_phase_id,null);assert.equal(writes[0].gantt_phase_override,true);assert.equal('parent_id' in writes[0],false);assert.equal('review_state' in writes[0],false);
writes=[];
response=await exports.PATCH(request({planned_end:'2026-01-01'}),params);
assert.equal(response.status,400);assert.equal(writes.length,0,'invalid dates rejected before persistence');
access=null;response=await exports.POST(request({title:'x',gantt_phase_id:'strategy'}),params);assert.equal(response.status,401);
access={scope:'project',isAdmin:false,memberId:'test'};response=await exports.POST(request({title:'x'}),params);assert.equal(response.status,403);
allowed=false;response=await exports.PATCH(request({gantt_phase_id:'strategy'}),params);assert.equal(response.status,404);assert.equal(writes.length,0);
console.log('PASS: real route create/readback, proposal boundary, detach preservation, dates, 401/403/404 authorization');
