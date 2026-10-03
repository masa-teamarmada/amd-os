const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
// 完了した作業の行の色。完了は作業の状態で明示し、日付や進捗%からは推定しない。
// 2026-10-03 まさ「全部統一してないとだめ。OSの大原則」で、KUTE だけの試行から全PJ同じ規則にした（spec 3-23）。
const code = fs.readFileSync(path.join(root, 'src/lib/kute-gantt-completion.ts'), 'utf8');
const ctx = { exports: {} };
vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, ctx);
const { isCompletedTaskRow, COMPLETED_TASK_COLOR, COMPLETED_TASK_BADGE } = ctx.exports;
for (const progressPct of [0, 50, 100]) {
  assert.equal(isCompletedTaskRow({entity:'task',state:'complete',progressPct}), true);
  for (const state of ['unassessed','current','overdue','future','not_started','blocked'])
    assert.equal(isCompletedTaskRow({entity:'task',state,progressPct}), false);
}
assert.equal(isCompletedTaskRow({entity:'milestone',state:'complete'}), false);
assert.equal(COMPLETED_TASK_COLOR, '#047857');
assert.match(COMPLETED_TASK_BADGE, /text-\[#047857\]/);
assert.doesNotMatch(code, /"p\d+"/, 'PJ番号で完了の色を出し分けない');
const view = fs.readFileSync(path.join(root, 'src/components/project-workspace/SxUnifiedTimeline.tsx'), 'utf8');
assert.match(view, /background: completed \? COMPLETED_TASK_COLOR/);
assert.match(view, /!completed && row.progressRegistered/);
assert.match(view, /const completed = isCompletedTaskRow\(row\);/);
assert.equal((view.match(/isCompletedTaskRow\(row\) \? .*COMPLETED_TASK_BADGE/g)||[]).length, 2);
assert.match(view, /complete: "完了"/);
console.log('Completed task color: PASS (explicit state, all PJs, milestone isolation)');
