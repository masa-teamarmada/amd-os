/**
 * 本契約キャッシュ入金のフォールバック回帰テスト。
 *
 * 2026-08-16 事故: billing_cycles の行が1件でもある PJ を PJ 単位で
 * cashRevenueMode='explicit' にしていたため、台帳が将来月まで作られていない
 * 継続契約 PJ (ZMP/SE/KUTE) の入金が台帳切れ以降ゼロになり、
 * 売上は立つのに月次CFが月116万円悪く出た。
 *
 * 現行仕様: 入金 explicit の判定は「PJ×稼働月」単位。台帳のある月だけ自動入金を
 * 止め、台帳の無い月は売上 × 支払サイトの自動入金へ戻す。
 *
 *   npm run test:contract-cash-month-fallback
 */
import assert from "node:assert/strict";
import { runMonthlyPlSimulation, type MonthlyPlInputs } from "../src/lib/finance/monthly-pl-simulation.ts";

const baseInput = (): MonthlyPlInputs => ({
  params: {
    startYm: 202601,
    months: 4,
    initialCash: 0,
    rateMember: 0,
    rateCloser: 0,
    socialInsRate: 0,
    corpTaxEffectiveRate: 0,
    minCorpTax: 0,
  },
  projects: [
    {
      projectId: "pTest",
      projectName: "継続契約 PJ",
      monthlyRevenue: 100_000,
      startYm: 202601,
      endYm: null,
      type: "fixed",
      billingType: "monthly",
      closerInternal: true,
      cashDelayMonths: 0,
    },
  ],
  fixedCosts: [],
  loans: [],
  spots: [],
  projectRevenues: [],
});

const inflowByYm = (input: MonthlyPlInputs) =>
  Object.fromEntries(runMonthlyPlSimulation(input, null).rows.map((r) => [r.ym, r.cashInflow]));

// 自動入金は税込 (売上 100,000 → 入金 110,000)。台帳の額は 200,000 にして区別できるようにする。
const AUTO = 110_000;
const LEDGER = 200_000;
// 台帳の額にも消費税が乗る (エンジン共通)
const LEDGER_IN = 220_000;

// 1. 台帳が無い PJ は全月が自動入金 (従来どおり)
{
  const inflow = inflowByYm(baseInput());
  assert.deepEqual(inflow, { 202601: AUTO, 202602: AUTO, 202603: AUTO, 202604: AUTO });
}

// 2. 台帳が 202601/202602 だけにある PJ:
//    台帳のある月は台帳の額、無い 202603/202604 は自動入金へ戻る (これが今回の修正点)
{
  const input = baseInput();
  input.projects[0].cashRevenueExplicitYms = [202601, 202602];
  input.projectRevenues = [
    { projectId: "pTest", ym: 202601, contractRevenueCash: LEDGER },
    { projectId: "pTest", ym: 202602, contractRevenueCash: LEDGER },
  ];
  const inflow = inflowByYm(input);
  assert.deepEqual(
    inflow,
    { 202601: LEDGER_IN, 202602: LEDGER_IN, 202603: AUTO, 202604: AUTO },
    "台帳の無い月は自動入金へ戻ること (入金ゼロにしない)",
  );
}

// 3. 台帳のある月で自動入金を二重計上しないこと
{
  const input = baseInput();
  input.projects[0].cashRevenueExplicitYms = [202601, 202602, 202603, 202604];
  input.projectRevenues = [202601, 202602, 202603, 202604].map((ym) => ({
    projectId: "pTest",
    ym,
    contractRevenueCash: LEDGER,
  }));
  const inflow = inflowByYm(input);
  assert.deepEqual(inflow, { 202601: LEDGER_IN, 202602: LEDGER_IN, 202603: LEDGER_IN, 202604: LEDGER_IN });
}

// 4. 旧 snapshot 互換: PJ 単位 cashRevenueMode='explicit' は従来どおり全月 explicit
{
  const input = baseInput();
  input.projects[0].cashRevenueMode = "explicit";
  input.projectRevenues = [{ projectId: "pTest", ym: 202601, contractRevenueCash: LEDGER }];
  const inflow = inflowByYm(input);
  assert.deepEqual(inflow, { 202601: LEDGER_IN, 202602: 0, 202603: 0, 202604: 0 });
}

console.log("check_contract_cash_month_fallback: OK");
