import assert from 'node:assert/strict';
import { capitalPlanIssueAction } from '../src/lib/capital-plan-issue-action.ts';
import { checkPublishEligibility, editableValue, safeDeriveCapitalPlan, type CapitalPlan } from '../src/lib/capital-plan.ts';
const plan: CapitalPlan = {id:'test',name:'repair',holders:[{id:'founder',name:'創業者',kind:'founder'},{id:'investor',name:'投資家',kind:'investor'}],events:[
{id:'inc',type:'incorporation',label:'設立',order:1,date:'2026-10-06',allocations:[{id:'inc-a',holderId:'founder',shareClass:'common',shares:editableValue(1000)}]},
{id:'a',type:'equity_issue',label:'シリーズA',order:2,date:'2027-10-06',calculationBasis:'valuation_and_investment',preMoneyValuation:editableValue(100000000),allocations:[]},
{id:'ipo',type:'ipo',label:'IPO',order:3,date:'2029-10-06',calculationBasis:'valuation_and_investment',preMoneyValuation:editableValue(200000000),allocations:[{id:'ipo-a',holderId:'investor',shareClass:'common',shares:editableValue(0,'calculated'),amount:editableValue(20000000)}]},
]};
const broken = safeDeriveCapitalPlan(plan).plan;
const before = JSON.stringify(broken);
const issues = checkPublishEligibility(broken).blockingIssues;
assert.equal(issues.length,2,'割当不足と条件不足の2原因だけを表示');
const missingAllocation = issues.find(i=>i.code==='empty_equity_issue')!;
assert.deepEqual(capitalPlanIssueAction(missingAllocation,broken),{section:'allocations',label:'割当を編集',eventId:'a',holderId:undefined});
assert.equal(capitalPlanIssueAction(issues.find(i=>i.code==='submission_financing_incomplete')!,broken).section,'financing');
assert.equal(capitalPlanIssueAction(missingAllocation,{...broken,holders:[]}).section,'holders','株主未登録なら割当追加に進ませない');
assert.equal(capitalPlanIssueAction({...missingAllocation,holderId:'investor'},broken).holderId,'investor');
assert.equal(JSON.stringify(broken),before,'カードを押すだけでは計画を変更しない');
const repaired = structuredClone(broken);
repaired.events.find(e=>e.id==='a')!.allocations.push({id:'a-a',holderId:'investor',shareClass:'preferred',shares:editableValue(0,'calculated'),amount:editableValue(10000000)});
const derived = safeDeriveCapitalPlan(repaired);
assert.equal(derived.error,undefined);
assert.equal(checkPublishEligibility(derived.plan).eligible,true,'割当と出資額の入力後に提出可能になる');
const empty = {...plan,events:[]};
assert.equal(checkPublishEligibility(empty).blockingIssues.filter(i=>/no_events/.test(i.code)).length,1);
assert.equal(capitalPlanIssueAction(checkPublishEligibility(empty).blockingIssues[0],empty).eventId,undefined);
console.log('capital-plan repair: deduplication, event/holder routing and resolution passed');
const manualBroken = structuredClone(broken);
manualBroken.events.find(e=>e.id==='a')!.calculationBasis='manual';
assert.match(checkPublishEligibility(manualBroken).blockingIssues.find(i=>i.code==='submission_financing_incomplete')!.message,/計算基準を選んで/);
const manualRepaired = structuredClone(manualBroken);
const manualEvent = manualRepaired.events.find(e=>e.id==='a')!;
manualEvent.preMoneyValuation=editableValue(100000000);
manualEvent.pricePerShare=editableValue(100000);
manualEvent.allocations=[{id:'manual-a',holderId:'investor',shareClass:'preferred',shares:editableValue(100),amount:editableValue(10000000)}];
assert.equal(checkPublishEligibility(safeDeriveCapitalPlan(manualRepaired).plan).eligible,true,'手動の評価額/単価/株数/出資額でも提出可能');
console.log('capital-plan repair: manual financing resolved without invented conditions');
