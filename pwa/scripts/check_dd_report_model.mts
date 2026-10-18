import {completeDdReportInputs} from '../src/lib/dd-report-input-metadata.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {DdReportCalculator,validateDdOverrides,verifyDdReportCalculation} from '../src/lib/dd-report-model.ts';
import type {DdReportModel} from '../src/lib/dd-report-types.ts';
const folder=process.argv[2];if(!folder)throw new Error('Import folder required');
const model=completeDdReportInputs(JSON.parse(gunzipSync(fs.readFileSync(folder+(process.argv.includes('--current')?'/model.qa.json.gz':'/model.json.gz'))).toString()) as DdReportModel);
const base=new DdReportCalculator(model);
const inputs={'共通前提!C16':800000000,'共通前提!C17':.1};
assert(validateDdOverrides(model,inputs));
const changed=new DdReportCalculator(model,inputs);
for(const [sheet,address]of [['共通前提','E15'],['資本政策表','J10'],['資本政策表','V14'],['エクイティストーリー','B26']]as const){console.log(sheet,address,base.get(sheet,address),changed.get(sheet,address));}
assert.equal(changed.get('共通前提','E15'),.25);
assert(String(changed.get('エクイティストーリー','B26')).includes('67.5%'));
assert(!validateDdOverrides(model,{'損益・資金繰!E61':1}));
assert(!validateDdOverrides(model,{'共通前提!C16':Infinity}));
const pay=new DdReportCalculator(model,{'共通前提!C76':600000});
console.log('salary/cash',base.get('損益・資金繰','Q61'),pay.get('損益・資金繰','Q61'));
assert(Number(pay.get('損益・資金繰','Q61'))<Number(base.get('損益・資金繰','Q61')));
console.log('PASS: J-KISS linkage and payroll/cash linkage');
for(const overrides of [
  {'金属回収コスト!E5':'ジスプロシウム（Dy）'},
  {'シアノ生産コスト!E6':'人工照明'},
  {'リアクター処理コスト!I5':'循環カートリッジ'},
  {'FAME生産コスト!E5':'外部に委託'},
  {'シアノ生産コスト!I6':'購入する'},
  {'シアノ生産コスト!I7':'購入する'},
  {'リアクター処理コスト!E6':'SOL'},
  {'リアクター処理コスト!E7':'SOL'},
] as Record<string,string>[]) {
  assert(validateDdOverrides(model,overrides),JSON.stringify(overrides));
  const calc=verifyDdReportCalculation(model,overrides);
  console.log('scenario',overrides,[18,19,20,21].map(r=>calc.get('UE','K'+r)),calc.get('損益・資金繰','DT61'));
  assert.equal(calc.errors.length,0);
}
assert(!validateDdOverrides(model,{'共通前提!C202':1}));
console.log('PASS: all four cost selectors / UE / long-term cash');
