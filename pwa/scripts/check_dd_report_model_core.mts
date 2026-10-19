import assert from 'node:assert/strict';
import {DdReportCalculator} from '../src/lib/dd-report-model.ts';
import type {DdReportModel} from '../src/lib/dd-report-types.ts';
const cell=(v:number|null,f:string|null=null)=>({v,f,format:'General'});
const model:DdReportModel={version:1,sourceSha256:'fixture',inputs:[],sheets:{
  Source:{path:'source',merges:[],dataTables:[],cells:{A1:cell(11),A2:cell(7),A3:cell(16),B1:cell(20),B2:cell(40),B3:cell(60)}},
  Report:{path:'report',merges:[],dataTables:[],cells:{
    A1:cell(null,"INDEX('Source'!A1:A3,2)"),
    A2:cell(null,"MIN(INDEX('Source'!A1:A3,1):INDEX('Source'!A1:A3,3))"),
    A3:cell(null,"SUM(INDEX('Source'!A1:A3,1):INDEX('Source'!A1:A3,3))"),
    A4:cell(null,"INDEX('Source'!A1:B3,3,2)"),
  }},
}};
const base=new DdReportCalculator(model,{},true);
assert.equal(base.get('Report','A1'),7);
assert.equal(base.get('Report','A2'),7);
assert.equal(base.get('Report','A3'),34);
assert.equal(base.get('Report','A4'),60);
const changed=new DdReportCalculator(model,{'Source!A2':30});
assert.equal(changed.get('Report','A1'),30);
assert.equal(changed.get('Report','A2'),11);
assert.equal(changed.get('Report','A3'),57);
assert.equal(base.errors.length+changed.errors.length,0);
console.log('PASS: Excel cross-sheet INDEX / dynamic range / changed minimum and sum');
const revised=structuredClone(model);
revised.sheets.Report.cells.A1={v:7,f:"INDEX('Source'!A1:A3,2)*2",format:'General'};
revised.sheets.Report.cells.B1={v:8,f:'A1+1',format:'General'};
revised.sheets.Report.cells.B2={v:123,f:'1+1',format:'General'};
const formulaEdit=new DdReportCalculator(revised,{},false,new Set(['Report!A1']));
assert.equal(formulaEdit.get('Report','A1'),14);
assert.equal(formulaEdit.get('Report','B1'),15,'A formula edit invalidates dependent cached results');
assert.equal(formulaEdit.get('Report','B2'),123,'Unrelated verified caches stay unchanged');
assert.equal(formulaEdit.errors.length,0);
console.log('PASS: explicit formula edits recalculate only their dependency graph');
