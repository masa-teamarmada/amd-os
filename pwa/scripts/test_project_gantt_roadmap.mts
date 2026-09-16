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
