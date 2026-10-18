import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {DD_EXECUTION_WINDOWS,ddExecutionSpan,ddExecutionTasks} from '../src/lib/dd-report-execution-plan.ts';
import {splitDdDevelopmentChapter,splitDdDevelopmentIndex,mergeDdDevelopmentForWorkbook} from '../src/lib/dd-report-development-plans.ts';
import {DdReportContent,ddReportHref} from '../src/components/dd/report/DdReportContent.tsx';
import type {DdReportChapter} from '../src/lib/dd-report-types.ts';
const file=process.argv[2];if(!file)throw Error('Current manifest required');const manifest=JSON.parse(await fs.readFile(file,'utf8'));
const source=manifest.chapters.find((c:DdReportChapter)=>c.slug==='execution-plan') as DdReportChapter,tasks=ddExecutionTasks(source.body.rows);assert.equal(tasks.length,88);
const business=splitDdDevelopmentChapter(source,'business-development-plan'),technical=splitDdDevelopmentChapter(source,'technical-development-plan'),index=splitDdDevelopmentIndex(manifest.chapters),plans=[business,technical];
assert.equal(index.length,39);assert(!index.some(c=>c.slug==='execution-plan'));assert.equal(ddExecutionTasks(business.body.rows).length,46);assert.equal(ddExecutionTasks(technical.body.rows).length,42);
const ids=new Set<string>();for(const plan of plans)for(const task of ddExecutionTasks(plan.body.rows)){assert(!ids.has(task.id));ids.add(task.id);const original=tasks.find(t=>t.id===task.id)!;assert.deepEqual(task.cells,original.cells);assert(DD_EXECUTION_WINDOWS.some(w=>ddExecutionSpan(task,w)),'Every original task remains accessible in at least one window');}
assert.equal(ids.size,88);assert.equal(ddExecutionTasks(mergeDdDevelopmentForWorkbook(plans)[0].body.rows).length,88);
for(const plan of plans){assert(plan.body.rows.some(r=>r.row>=400&&r.row<600));for(let window=0;window<3;window++){
 const html=renderToStaticMarkup(createElement(DdReportContent,{chapter:plan,slug:'sol',index,executionWindow:window}));
 assert(html.includes('ddr-execution-arrow'));assert(html.includes('role="tooltip"'));assert(!html.includes('<details'));assert(!html.includes('>区分</'));
 for(const task of ddExecutionTasks(plan.body.rows).filter(t=>ddExecutionSpan(t,DD_EXECUTION_WINDOWS[window]))){assert.equal(html.split(`data-task-id="${task.id}"`).length-1,1);for(const cell of task.cells)assert.equal(html.split(`id="cell-${cell.address}"`).length-1,1,'Source details appear once per task: '+cell.address);}
}}
assert(ddReportHref('sol','計画詳細',index,'L214')?.includes('technical-development-plan'));assert(ddReportHref('sol','計画詳細',index,'L169')?.includes('business-development-plan'));
const ongoing=tasks.find(t=>t.id==='M03')!;assert(ddExecutionSpan(ongoing,DD_EXECUTION_WINDOWS[2])?.continuesAfter);
console.log('PASS: two independent pages; all 87 original task records plus D financing task and every detail preserved; all 3 date windows, continuation, hover/focus details, routed source references, no folded table');
