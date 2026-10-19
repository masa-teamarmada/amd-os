import assert from 'node:assert/strict';
import {XMLValidator,XMLParser} from 'fast-xml-parser';
import {ddPatchWorksheetFormula} from '../src/lib/dd-report-xlsx-formulas.ts';

const parser=new XMLParser({ignoreAttributes:false});
for(const source of [
  '<c r="F304" s="185"><v>175</v></c>',
  '<c r="F304" s="185"/>',
  '<c r="F304" s="185"><f>E111</f><v>175</v></c>',
  '<c r="F304" s="185"><f t="shared" si="4"/><v>175</v></c>',
]){
  const patched=ddPatchWorksheetFormula(source,'E111*E112*E113');
  assert.equal(XMLValidator.validate(patched),true);
  const c=parser.parse(patched).c;
  assert.equal(c.f,'E111*E112*E113');
  assert.equal(c['@_s'],'185');
  assert.equal(c['@_r'],'F304');
  assert.equal((patched.match(/<f>/g)||[]).length,1);
  assert(!patched.includes('t="shared"'),'A patched cell has its own complete formula');
}
const namespaced=ddPatchWorksheetFormula('<x:c r="A1" s="2"/>','IF(B1<5,"A&B",0)');
assert.equal(XMLValidator.validate(namespaced),true);
assert.equal(parser.parse(namespaced)['x:c']['x:f'],'IF(B1<5,"A&B",0)');
console.log('PASS: formula edits survive literal, empty, existing and shared source cells, namespaces and XML escaping');
