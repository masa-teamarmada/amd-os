import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLiveMonthlyPlInputs } from "../src/lib/finance/live-monthly-pl-inputs.ts";
import { operatingCashBudget, bankLoanCashPlans } from "../src/lib/finance/live-monthly-cash-plan.ts";
import { runMonthlyPlSimulation, type MonthlyPlInputs } from "../src/lib/finance/monthly-pl-simulation.ts";
import { symmetricCashAxis, cashExpenseParts } from "../src/lib/finance/cash-chart-domain.ts";
import { selectMonthlyFallbackRows } from "../src/lib/finance/live-monthly-pl-budget.ts";

const params = {startYm:202611,months:5,initialCash:1000000,rateMember:0.65,rateCloser:0,socialInsRate:0.15,minCorpTax:0,corpTaxEffectiveRate:0};
const base: MonthlyPlInputs = {params,projects:[],fixedCosts:[{costId:"salary",costName:"給与",monthlyCost:100000,startYm:202601,costType:"salary"}],cashPlans:[{ym:202611,memberPaymentYen:11000,operatingPaymentYen:80000,socialInsurancePaymentYen:30000,bankLoanPaymentYen:10000}],paymentObligations:[{obligationId:"social",title:"社保",category:"social_insurance",amountYen:30000,amountStatus:"estimated",dueDate:"2026-11-30",expectedPaymentYm:202611,cashflowTreatment:"additive",status:"open",autoDebit:true,originCashOffsets:[{ym:202611,amountYen:30000,amountStatus:"estimated"}]}]};
const first = runMonthlyPlSimulation(base).rows[0];
assert.equal(first.operatingProfit,-115000,"PLは総支給+会社負担社保を維持");
assert.equal(first.cashOutflow,131000,"CFは手取り+支払月の本人分含む社保+報酬+返済。社保を二重加算しない");
assert.equal(first.obligationCashTimingOffset,0);
assert.equal(first.cashInflow-first.cashOutflow,first.netCashFlow);
assert.equal(first.cashBalance,869000);
const withholdingCash = runMonthlyPlSimulation({...base,paymentObligations:[{obligationId:"withholding",title:"源泉税",category:"tax",amountYen:6000,amountStatus:"estimated",dueDate:"2026-11-20",expectedPaymentYm:202611,cashflowTreatment:"additive",status:"open",autoDebit:false,payrollWithholding:true,originCashOffsets:[{ym:202611,amountYen:1000,amountStatus:"estimated"}]}]}).rows[0];
assert.equal(withholdingCash.obligationCashTimingOffset,0,"給与手取りは控除済みのため源泉税の発生月戻しを重ねない");
assert.equal(withholdingCash.netCashFlow,-137000,"源泉税は納付月に全額支出");
assert.equal(cashExpenseParts(withholdingCash)[4],6000,"源泉税も納税の積み上げへ含める");

const expenseOnly = runMonthlyPlSimulation({...base,projects:[{projectId:"ended",projectName:"残コスト",monthlyRevenue:0,startYm:202611}],projectRevenues:[{projectId:"ended",ym:202611,externalMemberCost:20000}]}).rows[0];
assert.equal(expenseOnly.costMember,20000,"売上0でも明示済み原価を落とさない");

const ledger = [
  ["代表テスト",80000],["代表テスト",20000],["メンバーテスト",30000],["JCBカード",40000],[null,145],
].map(([counterparty,withdrawal])=>({entry_date:"2026-11-25",counterparty:counterparty as string|null,withdrawal:Number(withdrawal),category:null,account_id:"bank"}));
const budget=operatingCashBudget(ledger,[{display_name:"給与：代表",item_kind:"salary",category:null,amount_yen:100000,start_ym:"202601",end_ym:null},{display_name:"代表への貸付返済",item_kind:"loan",category:null,amount_yen:20000,start_ym:"202601",end_ym:null}],[{member_name:"代表テスト",code_name:"代表"}]);
assert.deepEqual(budget,{payroll:80000,cards:40000,fees:145,total:120145,complete:true},"借入返済・外部報酬を固定支払へ混ぜない");
const loans=bankLoanCashPlans([{loan_id:"bank",lender:"銀行",principal_amount:120000,annual_rate:0.12,term_months:12,first_due_on:"2026-11-05",drawdown_on:"2026-10-01",repayment_type:"equal_principal"}],[{loan_id:"bank",event_date:"2026-11-05",kind:"repayment",amount:12000,principal_amount:10000,interest_amount:2000,is_planned:true},{loan_id:"bank",event_date:"2026-11-05",kind:"repayment",amount:11000,principal_amount:10000,interest_amount:1000,is_planned:false}],["202610","202611","202612"]);
assert.equal(loans[0].loanDisbursementYen,120000);
assert.equal(loans[1].bankLoanPaymentYen,11000,"実績と予定が共存する月は実績を優先");
assert.equal(loans[2].bankLoanPaymentYen,11100,"未登録月は契約上の元金+利息");

// 実DBと同じフィルタを実行するread-only fixture。正本の行は変更しない。
type Row=Record<string,unknown>;
const records:Record<string,Row[]>={
  projects:[
    {project_id:"company",project_name:"法人契約",fee_type:"variable",fee_amount:0,start_ym:"202601",end_ym:null,payment_due_rule:"invoice_received_60_days",payment_due_day:null,invoice_send_deadline_rule:"翌月10日"},
    {project_id:"personal",project_name:"個人顧問",fee_type:"monthly_fixed",fee_payee:"masa_personal",fee_amount:100000,start_ym:"202601"},
  ],company_finance_recurring_items:[],company_payment_obligations:[],
  members:[{member_id:"external",member_name:"外部",code_name:"外部",is_officer:false,exclude_from_payout_notice:false},{member_id:"internal",member_name:"内部",code_name:"内部",is_officer:false,exclude_from_payout_notice:true}],
  billing_cycles:[
    {project_id:"company",ym:"202608",invoice_ym:"202609",budget_reported_amount:100000,reward_summary_json:{externalRegularPayoutCapYen:99999,members:[{memberId:"external",totalPay:5000},{memberId:"internal",totalPay:50000}]}},
    {project_id:"company",ym:"202611",invoice_ym:"202612",budget_reported_amount:100000,reward_summary_json:{members:[{memberId:"external",totalPay:10000}]}},
  ],monthly_reward_payout:[{project_id:"company",ym:"202608",member_id:"external",total_pay:7000}],legacy_reward_payout_amount_override_events:[],cash_ledger_entries:[],loans:[],loan_events:[],
};
const before=JSON.stringify(records);
const db={from(table:string){let rows=[...(records[table]??[])];const q={select(){return q;},limit(n:number){rows=rows.slice(0,n);return q;},order(){return q;},eq(k:string,v:unknown){rows=rows.filter(r=>r[k]===v);return q;},in(k:string,v:unknown[]){rows=rows.filter(r=>v.includes(r[k]));return q;},gte(k:string,v:string){rows=rows.filter(r=>String(r[k])>=v);return q;},lte(k:string,v:string){rows=rows.filter(r=>String(r[k])<=v);return q;},lt(k:string,v:string){rows=rows.filter(r=>String(r[k])<v);return q;},not(k:string){rows=rows.filter(r=>r[k]!=null);return q;},then(resolve:(r:unknown)=>unknown){return Promise.resolve(resolve({data:rows,error:null}));}};return q;}} as unknown as SupabaseClient;
const live=await buildLiveMonthlyPlInputs(db,{startYm:202611,months:5,fallbackParams:params,now:new Date("2026-11-04T00:00:00Z")});
assert.equal(live.inputs.projects.some(p=>p.projectId==="personal"),false,"個人受取は会社売上から除く");
const output=runMonthlyPlSimulation(live.inputs).rows;
assert.equal(output[0].revenue,100000);
assert.equal(output[1].revenue,0,"変動売上を未登録月へ持ち越さない");
assert.equal(output[0].memberCashPayment,7700,"過去稼働の保存済み報酬を3か月後へ計上し内部配賦を除く");
assert.equal(output[3].memberCashPayment,11000,"当月発生分も同じ支払月ルール");
assert.equal(JSON.stringify(records),before,"読み取りで正本を変更しない");
for(const values of [[1,2,3],[-50,20],[0,0],[null,undefined,NaN]]){
  const domain=symmetricCashAxis(values);assert.equal((0-domain.min)/(domain.max-domain.min),0.5);assert.ok(domain.max>0);
}
for (const row of [first,...output]) assert.equal(cashExpenseParts(row).reduce((a,b)=>a+b,0),row.cashOutflow,"積み上げ棒の合計は支出と一致");
const fallbackRows=selectMonthlyFallbackRows([
  {input_kind:"params",source_id:"params",version:"v2",payload:{}},
  {input_kind:"spot",source_id:"registered",version:"manual",payload:{amount:400000}},
  {input_kind:"spot",source_id:"registered",version:"v1",payload:{amount:300000}},
  {input_kind:"project",source_id:"stale",version:"v1",payload:{}},
]);
assert.equal(fallbackRows.length,2,"登録済み臨時収支を旧パラメータ版で落とさず、重複もしない");
assert.equal(fallbackRows[1].payload.amount,400000);
console.log("live monthly cash: PL/CF separation, payment lag, personal payee, snapshots, explicit zero, loans and aligned axes passed");
