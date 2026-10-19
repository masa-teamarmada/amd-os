import assert from'node:assert/strict';import fs from'node:fs';import{createRequire}from'node:module';import ts from'typescript';
const require=createRequire(import.meta.url),code=ts.transpileModule(fs.readFileSync(new URL('../src/components/dd/report/DdReportSimulation.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const out:any={};new Function('require','exports',code)(require,out);let change:any;const controls={sheet:'test',values:{'test!A1':'B'},disabled:false,inputs:[{sheet:'test',address:'A1',label:'方式',value:'A',options:['A','B']}],change:(...args:unknown[])=>{change=args;}};
const group=out.DdReportInputValue({address:'A1',children:'fixed',controls});assert.equal(group.props.role,'group');assert.equal(group.props['aria-label'],'方式');assert.deepEqual(group.props.children.map((c:any)=>c.props['aria-pressed']),[false,true]);group.props.children[0].props.onClick();assert.deepEqual(change,['test!A1','A']);
assert.equal(out.DdReportInputValue({address:'A1',children:'fixed',controls:{...controls,inputs:[{...controls.inputs[0],options:['A']}]}}),'fixed');
assert.equal(out.DdReportInputValue({address:'A2',children:'plain',controls}),'plain');
console.log('PASS: segmented switches / selected state / change delivery / fixed single choice / read-only source cells');
