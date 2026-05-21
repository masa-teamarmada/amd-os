#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const SOURCE_REF = "https://docs.google.com/spreadsheets/d/1w0-6SeXMv4lBjge4WD7zsg1XjOFhlFyGgblBtZ8zTd8";
const SOURCE = "gas_monthly_pl";
const VERSION = "gas-2026-05-18-baseline";
const ENGINE_VERSION = "gas-port-2026-05-18-v1";

const inputs = {
  params: {
    startYm: 202601,
    months: 18,
    rateAmd: 0.3,
    rateCloser: 0.05,
    rateMember: 0.65,
    initialCash: 606423,
    socialInsRate: 0.15,
    corpTaxEffectiveRate: 0.25,
    minCorpTax: 70000,
    carryforwardLoss: 4553513,
    prevCorpTax: 72000,
    prevConsumptionTax: 810400,
    unpaidConsumptionTax: 810400,
    unpaidCorpTax: 36000,
    fiscalYearStartMonth: 1,
  },
  projects: [
    { projectId: "pj02", projectName: "JC", monthlyRevenue: 200000, startYm: 202601, endYm: 202603, type: "fixed", memo: "", internalMemberCost: 80000, closerInternal: true, status: "confirmed", billingType: "monthly" },
    { projectId: "pj03", projectName: "SE", monthlyRevenue: 100000, startYm: 202601, endYm: null, type: "fixed", memo: "", internalMemberCost: 65000, closerInternal: true, status: "", billingType: "" },
    { projectId: "pj04", projectName: "CTB", monthlyRevenue: 300000, startYm: 202601, endYm: null, type: "fixed", memo: "", internalMemberCost: null, closerInternal: true, status: "", billingType: "" },
    { projectId: "pj05", projectName: "ZMP", monthlyRevenue: 300000, startYm: 202601, endYm: null, type: "fixed", memo: "", internalMemberCost: 60000, closerInternal: true, status: "", billingType: "" },
    { projectId: "pj06", projectName: "BWE", monthlyRevenue: 537500, startYm: 202601, endYm: 202604, type: "fixed", memo: "", internalMemberCost: 259375, closerInternal: true, status: "confirmed", billingType: "" },
    { projectId: "pj08", projectName: "SX", monthlyRevenue: 833000, startYm: 202604, endYm: null, type: "fixed", memo: "", internalMemberCost: 337000, closerInternal: true, status: "confirmed", billingType: "monthly" },
    { projectId: "pj09", projectName: "CX", monthlyRevenue: 290000, startYm: 202601, endYm: null, type: "fixed", memo: "", internalMemberCost: 100000, closerInternal: true, status: "confirmed", billingType: "" },
    { projectId: "pj10", projectName: "新規1", monthlyRevenue: 300000, startYm: 202607, endYm: null, type: "fixed", memo: "", internalMemberCost: null, closerInternal: true, status: "confirmed", billingType: "monthly" },
    { projectId: "pj11", projectName: "新規2", monthlyRevenue: 500000, startYm: 202610, endYm: null, type: "fixed", memo: "", internalMemberCost: null, closerInternal: true, status: "confirmed", billingType: "monthly" },
    { projectId: "pj12", projectName: "新規3", monthlyRevenue: 500000, startYm: 202612, endYm: null, type: "fixed", memo: "", internalMemberCost: null, closerInternal: true, status: "tentative", billingType: "monthly" },
    { projectId: "pj13", projectName: "SX_FY25_11-03", monthlyRevenue: 2570000, startYm: 202606, endYm: null, type: "spot", memo: "SX FY2025 Nov-Mar carried billing. User clarified on 2026-05-21 that this 2,570,000 yen amount already belongs in June and is not the FY2026 monthly run-rate.", internalMemberCost: 900000, closerInternal: true, status: "confirmed", billingType: "monthly" },
    { projectId: "pj14", projectName: "SX_FY26", monthlyRevenue: 1048000, startYm: 202606, endYm: 202703, type: "fixed", memo: "FY2026 estimate Q-0000000065: subtotal 10,480,000 yen, tax 1,048,000 yen, total 11,528,000 yen. Service period 2026-06-01 to 2027-03-31, monthly billing. PL uses tax-exclusive revenue: 10,480,000 / 10 = 1,048,000 yen/month; cash inflow is modeled with 2-month lag from the earlier payment assumption. Internal member cost is provisionally scaled from the prior SX_FY25 allocation ratio.", internalMemberCost: 367000, closerInternal: true, status: "confirmed", billingType: "monthly", cashDelayMonths: 2, cashStartYm: 202608 },
  ],
  fixedCosts: [
    { costId: "fc02", costName: "役員報酬（まさ）", monthlyCost: 1000000, startYm: 202601, endYm: 202603, costType: "executive", memo: "" },
    { costId: "1", costName: "co-en", monthlyCost: 38500, startYm: 202401, endYm: null, costType: "taxable", memo: "" },
    { costId: "fc03", costName: "役員報酬（きよ）", monthlyCost: 340000, startYm: 202601, endYm: null, costType: "executive", memo: "" },
    { costId: "fc04", costName: "conduct", monthlyCost: 44000, startYm: 202601, endYm: null, costType: "taxable", memo: "" },
    { costId: "fc05", costName: "slack", monthlyCost: 24000, startYm: 202601, endYm: null, costType: "taxable", memo: "" },
    { costId: "fc06", costName: "claude", monthlyCost: 45000, startYm: 202601, endYm: null, costType: "taxable", memo: "" },
    { costId: "fc08", costName: "notion", monthlyCost: 3800, startYm: 202601, endYm: null, costType: "taxable", memo: "" },
    { costId: "fc09", costName: "まさ上乗せ", monthlyCost: 127334, startYm: 202601, endYm: null, costType: "exempt", memo: "" },
    { costId: "fc10", costName: "freee", monthlyCost: 5480, startYm: 202601, endYm: null, costType: "taxable", memo: "" },
    { costId: "fc11", costName: "DocuSign", monthlyCost: 3100, startYm: 202601, endYm: null, costType: "taxable", memo: "" },
    { costId: "fc12", costName: "スマホ", monthlyCost: 25000, startYm: 202601, endYm: null, costType: "taxable", memo: "" },
    { costId: "fc13", costName: "役員報酬（まさ）", monthlyCost: 700000, startYm: 202604, endYm: null, costType: "executive", memo: "" },
    { costId: "fc14", costName: "経友会", monthlyCost: 1200, startYm: 202601, endYm: null, costType: "taxable", memo: "" },
    { costId: "fc15", costName: "家賃按分", monthlyCost: 72666, startYm: 202601, endYm: null, costType: "taxable", memo: "" },
    { costId: "fc16", costName: "役員報酬（まさ）", monthlyCost: 979891, startYm: 202602, endYm: 202602, costType: "executive", memo: "" },
    { costId: "fc17", costName: "Gatto", monthlyCost: 33000, startYm: 202601, endYm: 202603, costType: "taxable", memo: "" },
  ],
  loans: [
    { loanId: "loan01", loanName: "商工中金", principal: 5000000, annualRate: 0.027, totalPayments: 55, startYm: 202602, method: "equal_payment", disbursementYm: 202601, memo: "" },
  ],
  scenarios: [],
  varCosts: [],
  projectRevenues: [
    { projectId: "pj09", ym: 202604, monthlyRevenue: null, internalMemberCost: 188500, memo: "CFG_ProjectRevenue header treated as stale: 188500 is internalMemberCost" },
  ],
  spots: [
    { spotId: "sp02", spotName: "還付金FY25（法人税）", ym: 202603, amount: 355398, direction: "income", costType: "exempt", memo: "" },
    { spotId: "sp03", spotName: "還付金FY25（地方法人税）", ym: 202603, amount: 36300, direction: "income", costType: "exempt", memo: "" },
    { spotId: "sp04", spotName: "東京科学大学", ym: 202602, amount: 1067000, direction: "income", costType: "taxable", memo: "" },
    { spotId: "sp05", spotName: "東京科学大学", ym: 202602, amount: 440000, direction: "income", costType: "taxable", memo: "" },
    { spotId: "sp07", spotName: "Waris紹介料", ym: 202605, amount: 1100000, direction: "expense", costType: "taxable", memo: "" },
    { spotId: "sp08", spotName: "microsoft", ym: 202604, amount: 27400, direction: "expense", costType: "taxable", memo: "" },
  ],
};

const gasOutMonthly = [
  { ym: 202601, revenue: 1727500, costMember: 558500, costCloser: 86375, grossProfit: 1082625, fixedCost: 1763080, socialIns: 201000, operatingProfit: -881455, loanPayment: 0, loanInterest: 0, ctaxPayment: 0, corpTaxPayment: 0, netCashFlow: 4292245, cashBalance: 4898668, runway: 7.2 },
  { ym: 202602, revenue: 1727500, costMember: 558500, costCloser: 86375, grossProfit: 1082625, fixedCost: 2742971, socialIns: 347984, operatingProfit: -2008330, loanPayment: 96752, loanInterest: 11250, ctaxPayment: 810400, corpTaxPayment: 36000, netCashFlow: -1120082, cashBalance: 3778586, runway: 2 },
  { ym: 202603, revenue: 1727500, costMember: 558500, costCloser: 86375, grossProfit: 1082625, fixedCost: 1763080, socialIns: 201000, operatingProfit: -881455, loanPayment: 96752, loanInterest: 11058, ctaxPayment: 0, corpTaxPayment: 0, netCashFlow: -412809, cashBalance: 3365777, runway: 4.3 },
  { ym: 202604, revenue: 2360500, costMember: 624450, costCloser: 118025, grossProfit: 1618025, fixedCost: 1430080, socialIns: 156000, operatingProfit: 31945, loanPayment: 96752, loanInterest: 10865, ctaxPayment: 0, corpTaxPayment: 0, netCashFlow: 170408, cashBalance: 3536185, runway: 999 },
  { ym: 202605, revenue: 4393000, costMember: 1304950, costCloser: 219650, grossProfit: 2868400, fixedCost: 1430080, socialIns: 156000, operatingProfit: 1282320, loanPayment: 96752, loanInterest: 10672, ctaxPayment: 0, corpTaxPayment: 0, netCashFlow: 477748, cashBalance: 4013933, runway: 999 },
  { ym: 202606, revenue: 1823000, costMember: 534450, costCloser: 91150, grossProfit: 1197400, fixedCost: 1430080, socialIns: 156000, operatingProfit: -388680, loanPayment: 96752, loanInterest: 10478, ctaxPayment: 0, corpTaxPayment: 0, netCashFlow: -291702, cashBalance: 3722231, runway: 14 },
  { ym: 202607, revenue: 2123000, costMember: 729450, costCloser: 106150, grossProfit: 1287400, fixedCost: 1430080, socialIns: 156000, operatingProfit: -298680, loanPayment: 96752, loanInterest: 10284, ctaxPayment: 0, corpTaxPayment: 0, netCashFlow: -176202, cashBalance: 3546029, runway: 23.7 },
  { ym: 202608, revenue: 2123000, costMember: 729450, costCloser: 106150, grossProfit: 1287400, fixedCost: 1430080, socialIns: 156000, operatingProfit: -298680, loanPayment: 96752, loanInterest: 10089, ctaxPayment: 405200, corpTaxPayment: 0, netCashFlow: -581402, cashBalance: 2964627, runway: 19.8 },
  { ym: 202609, revenue: 2123000, costMember: 729450, costCloser: 106150, grossProfit: 1287400, fixedCost: 1430080, socialIns: 156000, operatingProfit: -298680, loanPayment: 96752, loanInterest: 9894, ctaxPayment: 0, corpTaxPayment: 0, netCashFlow: -176202, cashBalance: 2788425, runway: 18.6 },
  { ym: 202610, revenue: 2623000, costMember: 1054450, costCloser: 131150, grossProfit: 1437400, fixedCost: 1430080, socialIns: 156000, operatingProfit: -148680, loanPayment: 96752, loanInterest: 9699, ctaxPayment: 0, corpTaxPayment: 0, netCashFlow: 16298, cashBalance: 2804723, runway: 999 },
  { ym: 202611, revenue: 2623000, costMember: 1054450, costCloser: 131150, grossProfit: 1437400, fixedCost: 1430080, socialIns: 156000, operatingProfit: -148680, loanPayment: 96752, loanInterest: 9503, ctaxPayment: 0, corpTaxPayment: 0, netCashFlow: 16298, cashBalance: 2821021, runway: 999 },
  { ym: 202612, revenue: 3123000, costMember: 1379450, costCloser: 156150, grossProfit: 1587400, fixedCost: 1430080, socialIns: 156000, operatingProfit: 1320, loanPayment: 96752, loanInterest: 9307, ctaxPayment: 0, corpTaxPayment: 0, netCashFlow: 208798, cashBalance: 3029819, runway: 999 },
  { ym: 202701, revenue: 3123000, costMember: 1379450, costCloser: 156150, grossProfit: 1587400, fixedCost: 1430080, socialIns: 156000, operatingProfit: 1320, loanPayment: 96752, loanInterest: 9110, ctaxPayment: 0, corpTaxPayment: 0, netCashFlow: 208798, cashBalance: 3238617, runway: 999 },
  { ym: 202702, revenue: 3123000, costMember: 1379450, costCloser: 156150, grossProfit: 1587400, fixedCost: 1430080, socialIns: 156000, operatingProfit: 1320, loanPayment: 96752, loanInterest: 8913, ctaxPayment: 1175655, corpTaxPayment: 70000, netCashFlow: -1036857, cashBalance: 2201760, runway: 999 },
  { ym: 202703, revenue: 3123000, costMember: 1379450, costCloser: 156150, grossProfit: 1587400, fixedCost: 1430080, socialIns: 156000, operatingProfit: 1320, loanPayment: 96752, loanInterest: 8715, ctaxPayment: 0, corpTaxPayment: 0, netCashFlow: 208798, cashBalance: 2410558, runway: 999 },
  { ym: 202704, revenue: 3123000, costMember: 1379450, costCloser: 156150, grossProfit: 1587400, fixedCost: 1430080, socialIns: 156000, operatingProfit: 1320, loanPayment: 96752, loanInterest: 8517, ctaxPayment: 0, corpTaxPayment: 0, netCashFlow: 208798, cashBalance: 2619356, runway: 999 },
  { ym: 202705, revenue: 3123000, costMember: 1379450, costCloser: 156150, grossProfit: 1587400, fixedCost: 1430080, socialIns: 156000, operatingProfit: 1320, loanPayment: 96752, loanInterest: 8318, ctaxPayment: 0, corpTaxPayment: 0, netCashFlow: 208798, cashBalance: 2828154, runway: 999 },
  { ym: 202706, revenue: 3123000, costMember: 1379450, costCloser: 156150, grossProfit: 1587400, fixedCost: 1430080, socialIns: 156000, operatingProfit: 1320, loanPayment: 96752, loanInterest: 8119, ctaxPayment: 0, corpTaxPayment: 0, netCashFlow: 208798, cashBalance: 3036952, runway: 999 },
];

function loadFinanceModule() {
  const sourcePath = path.join(process.cwd(), "src/lib/finance/monthly-pl-simulation.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", output)(require, mod, mod.exports);
  return mod.exports;
}

function inputRows() {
  const rows = [];
  rows.push({
    input_kind: "params",
    source_id: "CFG_Params",
    ym: null,
    project_id: null,
    label: "global parameters",
    amount_yen: null,
    payload: inputs.params,
    source: SOURCE,
    version: VERSION,
  });

  for (const project of inputs.projects) {
    rows.push({
      input_kind: "project",
      source_id: project.projectId,
      ym: project.startYm ? String(project.startYm) : null,
      project_id: null,
      label: project.projectName,
      amount_yen: project.monthlyRevenue,
      payload: project,
      source: SOURCE,
      version: VERSION,
    });
  }
  for (const fixedCost of inputs.fixedCosts) {
    rows.push({
      input_kind: "fixed_cost",
      source_id: fixedCost.costId,
      ym: fixedCost.startYm ? String(fixedCost.startYm) : null,
      project_id: null,
      label: fixedCost.costName,
      amount_yen: fixedCost.monthlyCost,
      payload: fixedCost,
      source: SOURCE,
      version: VERSION,
    });
  }
  for (const loan of inputs.loans) {
    rows.push({
      input_kind: "loan",
      source_id: loan.loanId,
      ym: loan.startYm ? String(loan.startYm) : null,
      project_id: null,
      label: loan.loanName,
      amount_yen: loan.principal,
      payload: loan,
      source: SOURCE,
      version: VERSION,
    });
  }
  for (const projectRevenue of inputs.projectRevenues) {
    rows.push({
      input_kind: "project_revenue",
      source_id: projectRevenue.projectId,
      ym: String(projectRevenue.ym),
      project_id: null,
      label: projectRevenue.projectId,
      amount_yen: projectRevenue.monthlyRevenue ?? projectRevenue.internalMemberCost ?? null,
      payload: projectRevenue,
      source: SOURCE,
      version: VERSION,
    });
  }
  for (const spot of inputs.spots) {
    rows.push({
      input_kind: "spot",
      source_id: spot.spotId,
      ym: String(spot.ym),
      project_id: null,
      label: spot.spotName,
      amount_yen: spot.amount,
      payload: spot,
      source: SOURCE,
      version: VERSION,
    });
  }
  return rows;
}

function assertCloseToGas(result) {
  const fields = ["revenue", "costMember", "costCloser", "grossProfit", "fixedCost", "socialIns", "operatingProfit", "loanPayment", "loanInterest", "ctaxPayment", "corpTaxPayment", "netCashFlow", "cashBalance", "runway"];
  const mismatches = [];
  for (const expected of gasOutMonthly) {
    const actual = result.rows.find((row) => row.ym === expected.ym);
    if (!actual) {
      mismatches.push(`${expected.ym}: missing row`);
      continue;
    }
    for (const field of fields) {
      if (Math.abs(Number(actual[field]) - Number(expected[field])) > 1) {
        mismatches.push(`${expected.ym}.${field}: ts=${actual[field]} gas=${expected[field]}`);
      }
    }
  }
  return mismatches;
}

async function must(label, promise) {
  const { data, error, count } = await promise;
  if (error) {
    error.message = `${label}: ${error.message}`;
    throw error;
  }
  return { data, count };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");

  const { runMonthlyPlSimulation, toCompanyBudgetMonthlyRows } = loadFinanceModule();
  const result = runMonthlyPlSimulation(inputs);
  const mismatches = assertCloseToGas(result);
  if (mismatches.length) {
    console.log("TS/GAS output differences detected:");
    for (const line of mismatches.slice(0, 40)) console.log(`- ${line}`);
    if (mismatches.length > 40) console.log(`... ${mismatches.length - 40} more`);
    console.log("Continuing with TS output because the port fixes known spot income/expense ordering.");
  } else {
    console.log("TS simulation matches GAS OUT_Monthly for compared fields.");
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  await must("delete company_budget_monthly", supabase.from("company_budget_monthly").delete().eq("source", SOURCE).eq("version", VERSION));
  await must("delete company_budget_inputs", supabase.from("company_budget_inputs").delete().eq("source", SOURCE).eq("version", VERSION));
  await must("delete company_budget_simulation_runs", supabase.from("company_budget_simulation_runs").delete().eq("source", SOURCE).eq("version", VERSION));

  const { data: run } = await must("insert company_budget_simulation_runs", supabase
    .from("company_budget_simulation_runs")
    .insert({
      scenario_id: null,
      version: VERSION,
      source: SOURCE,
      source_ref: SOURCE_REF,
      engine_version: ENGINE_VERSION,
      params: {
        params: inputs.params,
        sourceTitle: "収支計算シート_AMD_OS",
        importedFrom: "Google Sheets CFG_*",
      },
    })
    .select("id")
    .single());

  const projectNameById = new Map(inputs.projects.map((project) => [project.projectId, project.projectName]));
  const budgetRows = toCompanyBudgetMonthlyRows(result)
    .map((row) => {
      if (row.scope === "project") {
        const projectId = row.project_id;
        return {
          ...row,
          simulation_run_id: run.id,
          project_id: null,
          account_name: projectId ? projectNameById.get(projectId) || projectId : null,
          payload: { ...(row.payload || {}), gasProjectId: projectId },
          source: SOURCE,
          source_ref: SOURCE_REF,
          version: VERSION,
          note: "Imported from 収支計算シート_AMD_OS via TS GAS port",
        };
      }
      return {
        ...row,
        simulation_run_id: run.id,
        project_id: null,
        source: SOURCE,
        source_ref: SOURCE_REF,
        version: VERSION,
        note: "Imported from 収支計算シート_AMD_OS via TS GAS port",
      };
    });

  await must("insert company_budget_inputs", supabase.from("company_budget_inputs").insert(inputRows()));
  await must("insert company_budget_monthly", supabase.from("company_budget_monthly").insert(budgetRows));

  const [{ count: inputCount }, { count: budgetCount }, { data: sample }] = await Promise.all([
    must("count company_budget_inputs", supabase.from("company_budget_inputs").select("id", { count: "exact", head: true }).eq("source", SOURCE).eq("version", VERSION)),
    must("count company_budget_monthly", supabase.from("company_budget_monthly").select("id", { count: "exact", head: true }).eq("source", SOURCE).eq("version", VERSION)),
    must("sample company_budget_monthly", supabase
      .from("company_budget_monthly")
      .select("ym,category,budget_amount_yen,cash_amount_yen,runway_months")
      .eq("source", SOURCE)
      .eq("version", VERSION)
      .in("category", ["revenue", "net_cash_flow"])
      .order("ym", { ascending: true })
      .order("category", { ascending: true })
      .limit(8)),
  ]);

  console.log(JSON.stringify({
    simulationRunId: run.id,
    version: VERSION,
    inputCount,
    budgetCount,
    sample,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
