import assert from 'node:assert/strict';
import { buildSxSourceCashLedger, buildSxMonthlyFinanceComments } from '../src/lib/sx-monthly-finance-plan.ts';
import { buildBzm22SharedMonthAxis } from '../src/lib/bzm-2-2-pilot-ui.ts';
const source = [{ ym:'2027-04', operating_cash_flow_yen:-8_200_000, investing_cash_flow_yen:-37_890_000,
  equity_funding_yen:150_000_000, grant_receipt_yen:0, net_cash_flow_yen:103_910_000,
  opening_cash_yen:0, closing_cash_yen:103_910_000, source_note:'採用計画。 source_sha256=test' }];
const ledger=buildSxSourceCashLedger(source);
assert.equal(ledger[0].operatingCashFlowYen,-8_200_000); // P/L operating profit is -8,557,417.
assert.equal(ledger[0].openingCashYen!+ledger[0].netCashFlowYen,ledger[0].closingCashYen);
assert.equal(ledger[0].operatingCashFlowYen+ledger[0].capexCashFlowYen+ledger[0].equityFundingYen,ledger[0].netCashFlowYen);
assert.deepEqual(buildSxSourceCashLedger([{...source[0],operating_cash_flow_yen:null}]),[]);
assert.deepEqual(buildSxSourceCashLedger([]),[]);
assert.equal(buildSxMonthlyFinanceComments(['2028-10'],[{label:'旧A',ym:'2028-10',amountYen:300_000_000}],source).length,0);
assert.equal(buildSxMonthlyFinanceComments(['2027-04'],[],source).length,2);
assert.ok(buildSxMonthlyFinanceComments(['2027-04'],[],source).every(x=>!x.detail.includes('source_sha256')));
const axis=buildBzm22SharedMonthAxis('2026-08-01',127);
assert.equal(axis.at(-1)?.ym,'2037-03');
assert.equal(axis.filter(x=>x.ym>='2027-04').length,120);
console.log('SX adopted cash flow: source amounts, absent-source boundary, no duplicate old round, 120-month coverage passed');
