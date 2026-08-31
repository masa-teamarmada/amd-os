const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'src/lib/kute-gantt-completion.ts'), 'utf8');
const ctx = { exports: {} };
vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, ctx);
const { isKuteCompletedTask, KUTE_COMPLETED_COLOR, KUTE_COMPLETED_BADGE } = ctx.exports;
for (const progressPct of [0, 50, 100]) {
  assert.equal(isKuteCompletedTask('p25', {entity:'task',state:'complete',progressPct}), true);
  for (const state of ['unassessed','current','overdue','future','not_started','blocked'])
    assert.equal(isKuteCompletedTask('p25', {entity:'task',state,progressPct}), false);
}
for (const project of ['p21','p19',null,undefined])
  assert.equal(isKuteCompletedTask(project, {entity:'task',state:'complete'}), false);
assert.equal(isKuteCompletedTask('p25', {entity:'milestone',state:'complete'}), false);
assert.equal(KUTE_COMPLETED_COLOR, '#047857');
assert.match(KUTE_COMPLETED_BADGE, /text-\[#047857\]/);
const view = fs.readFileSync(path.join(root, 'src/components/project-workspace/SxUnifiedTimeline.tsx'), 'utf8');
assert.match(view, /background: completed \? KUTE_COMPLETED_COLOR/);
assert.match(view, /!completed && row.progressRegistered/);
assert.match(view, /<RowBar\s+projectId=\{projectId\}/);
assert.equal((view.match(/isKuteCompletedTask\(projectId, row\) \? .*KUTE_COMPLETED_BADGE/g)||[]).length, 2);
assert.match(view, /complete: "完了"/);
console.log('KUTE completed task color: PASS (explicit state, desktop/mobile, non-KUTE and milestone isolation)');
