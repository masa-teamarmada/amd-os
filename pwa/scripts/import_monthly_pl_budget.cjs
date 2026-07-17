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
    { costId: "fc10", costName: "freee", monthlyCost: 5480, startYm: 202601, endYm: null, costType: "taxable", memo: "" },
    { costId: "fc11", costName: "DocuSign", monthlyCost: 3100, startYm: 202601, endYm: null, costType: "taxable", memo: "" },
    { costId: "fc12", costName: "スマホ", monthlyCost: 25000, startYm: 202601, endYm: null, costType: "taxable", memo: "" },
    { costId: "fc13", costName: "役員報酬（まさ）", monthlyCost: 700000, startYm: 202604, endYm: null, costType: "executive", memo: "" },
    { costId: "fc14", costName: "経友会", monthlyCost: 1200, startYm: 202601, endYm: null, costType: "taxable", memo: "" },
    { costId: "fc15", costName: "家賃按分", monthlyCost: 72666, startYm: 202601, endYm: null, costType: "taxable", memo: "" },
    { costId: "fc16", costName: "役員報酬（まさ）", monthlyCost: 979891, startYm: 202602, endYm: 202602, costType: "executive", memo: "" },
    { costId: "fc17", costName: "Gatto", monthlyCost: 33000, startYm: 202601, endYm: 202603, costType: "taxable", memo: "" },
  ],
  recurringCashOutflows: [
    { outflowId: "masa-loan-repayment", outflowName: "まさへの貸付返済", monthlyAmount: 200000, startYm: 202601, endYm: null, kind: "loan_payment", memo: "貸付元本返済" },
  ],
  // freee wallet_txns で 2026-01-19 実行確認済み。
  // 商工中金: 融資入金 4,929,098 + 口座間補填 100,000 -> PayPay銀行へ 5,000,000 入金。
  loans: [
    { loanId: "loan01", loanName: "商工中金", principal: 5000000, annualRate: 0.027, totalPayments: 55, startYm: 202602, method: "equal_payment", disbursementYm: 202601, memo: "freee wallet_txns confirmed 2026-01-19" },
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

function loadFinanceModule() {
  const sourcePath = path.join(process.cwd(), "src/lib/finance/monthly-pl-simulation.ts");
  require.extensions[".ts"] = (module, filename) => {
    const source = fs.readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    }).outputText;
    module._compile(output, filename);
  };
  const source = fs.readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  const moduleRequire = require("module").createRequire(sourcePath);
  new Function("require", "module", "exports", output)(moduleRequire, mod, mod.exports);
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
  for (const outflow of inputs.recurringCashOutflows) {
    rows.push({
      input_kind: "cash_outflow",
      source_id: outflow.outflowId,
      ym: outflow.startYm ? String(outflow.startYm) : null,
      project_id: null,
      label: outflow.outflowName,
      amount_yen: outflow.monthlyAmount,
      payload: outflow,
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

function assertCorrectionIntegrity(result) {
  // 貸付返済 ¥200,000/月は口座流出だけに載り、役員報酬・固定費・社保基礎には載らない。
  const april = result.rows.find((row) => row.ym === 202604);
  if (!april) throw new Error("202604 row is required for finance correction verification");
  const expected = {
    fixedCost: 1_302_746,
    socialIns: 156_000,
    loanPayment: 296_752,
    netCashFlow: 97_742,
  };
  for (const [field, value] of Object.entries(expected)) {
    if (Number(april[field]) !== value) throw new Error(`finance correction mismatch: 202604.${field}=${april[field]} (expected ${value})`);
  }
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
  assertCorrectionIntegrity(result);
  console.log("finance correction checks: ok (loan repayment is cash-only; social insurance is 156,000 yen in 202604)");

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
