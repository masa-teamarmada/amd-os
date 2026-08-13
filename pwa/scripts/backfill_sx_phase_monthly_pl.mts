/** SX p21: BZM 2.2 M0–M60用の計画PL。既定dry-run、書込みは--apply。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { SX_ANNUAL_PROJECTION } from "../src/lib/sx-business-plan.ts";

const PROJECT_ID = "p21";
const START_YM = "2026-07"; // Phase 0のtie-out用。BZM表示は翌月M0から。
const END_YM = "2031-08"; // p21 BZM 2.2 artifact M60。
const PROFILE_WORKBOOK = "/Users/masa/projects/AMD/SX/SX_月次試算表_v1.0_260331.xlsx";
const SOURCE_TAG = "sx-bzm22-monthly-pl-v1";
const apply = process.argv.includes("--apply");
type Field = "revenue_yen" | "cogs_yen" | "personnel_yen" | "rd_yen" | "marketing_yen" | "other_opex_yen";
type Row = Record<Field, number> & { project_id: string; ym: string; notes: string };

function env(name: string) {
  const pairs = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/)).filter((item): item is RegExpMatchArray => Boolean(item));
  return Object.fromEntries(pairs.map((item) => [item[1], item[2].replace(/^"|"$/g, "")]))[name];
}
function months(start: string, end: string) {
  const [sy, sm] = start.split("-").map(Number); const [ey, em] = end.split("-").map(Number); const output: string[] = [];
  for (let value = sy * 12 + sm - 1; value <= ey * 12 + em - 1; value += 1) output.push(`${Math.floor(value / 12)}-${String(value % 12 + 1).padStart(2, "0")}`);
  return output;
}
function column(index: number) { let value = index; let output = ""; while (value > 0) { output = String.fromCharCode(65 + (value - 1) % 26) + output; value = Math.floor((value - 1) / 26); } return output; }
function profile(row: number, fiscalYear: number) {
  const xml = execFileSync("unzip", ["-p", PROFILE_WORKBOOK, "xl/worksheets/sheet2.xml"], { encoding: "utf8" });
  return Array.from({ length: 12 }, (_, index) => {
    const cell = `${column(13 + (fiscalYear - 2027) * 12 + index)}${row}`;
    const match = xml.match(new RegExp(`<c[^>]*\\br="${cell}"[^>]*>([\\s\\S]*?)<\\/c>`))?.[1].match(/<v>([^<]+)<\/v>/)?.[1];
    if (!match || !Number.isFinite(Number(match))) throw new Error(`旧月次試算表の${cell}を読めない`);
    return Number(match);
  });
}
function distribute(total: number, raw: number[]) {
  const denominator = raw.reduce((sum, value) => sum + Math.max(0, value), 0);
  const weights = denominator > 0 ? raw.map((value) => Math.max(0, value) / denominator) : raw.map(() => 1 / raw.length);
  const output = weights.map((weight) => Math.round(total * weight)); output[output.length - 1] += total - output.reduce((sum, value) => sum + value, 0); return output;
}
function phase0() {
  const phaseMonths = months("2026-07", "2027-03");
  const totals: Record<Field, number> = { revenue_yen: 0, cogs_yen: 0, personnel_yen: 5_000_000, rd_yen: 40_000_000, marketing_yen: 10_000_000, other_opex_yen: 5_000_000 };
  const values = Object.fromEntries(Object.entries(totals).map(([field, total]) => [field, distribute(total, phaseMonths.map(() => 1))])) as Record<Field, number[]>;
  return phaseMonths.map((ym, index): Row => ({ project_id: PROJECT_ID, ym, revenue_yen: values.revenue_yen[index], cogs_yen: values.cogs_yen[index], personnel_yen: values.personnel_yen[index], rd_yen: values.rd_yen[index], marketing_yen: values.marketing_yen[index], other_opex_yen: values.other_opex_yen[index], notes: `${SOURCE_TAG}; 計画値/推定値（低精度）; Phase 0 PSI・会社設立準備。2027-01までは設立前PJ支出でありNewCoのP/L・営業損失ではない。月別一次内訳なしのため9か月均等按分。PSI等6,000万円は資金源であり売上へ非算入。` }));
}
function annual() {
  const rows: Row[] = [];
  for (const plan of SX_ANNUAL_PROJECTION.filter((item) => item.fiscalYear >= 2027 && item.fiscalYear <= 2031)) {
    const personnelProfile = profile(80, plan.fiscalYear).map((value, index) => value + profile(81, plan.fiscalYear)[index]);
    const rdProfile = profile(84, plan.fiscalYear);
    const rdUsesEvenAllocation = rdProfile.every((value) => value <= 0);
    const values: Record<Field, number[]> = { revenue_yen: distribute(plan.revenueYen, profile(11, plan.fiscalYear)), cogs_yen: distribute(plan.costOfSalesYen, profile(38, plan.fiscalYear)), personnel_yen: distribute(plan.executiveCompensationYen + plan.salariesAndBonusesYen, personnelProfile), rd_yen: distribute(plan.researchAndDevelopmentYen, rdProfile), marketing_yen: Array.from({ length: 12 }, () => 0), other_opex_yen: distribute(plan.sellingGeneralAdministrativeYen, profile(85, plan.fiscalYear)) };
    const precisionNote = rdUsesEvenAllocation ? " 研究開発費は旧表に月別基準がないため12か月均等按分（低精度）。" : "";
    months(`${plan.fiscalYear}-04`, `${plan.fiscalYear + 1}-03`).forEach((ym, index) => rows.push({ project_id: PROJECT_ID, ym, revenue_yen: values.revenue_yen[index], cogs_yen: values.cogs_yen[index], personnel_yen: values.personnel_yen[index], rd_yen: values.rd_yen[index], marketing_yen: values.marketing_yen[index], other_opex_yen: values.other_opex_yen[index], notes: `${SOURCE_TAG}; 計画値/推定値; Cockpit年次PL FY${plan.fiscalYear}を金額正本、SX_月次試算表_v1.0_260331.xlsxを月別発生タイミングだけの配賦キーに使用。資本調達・補助金cash・CAPEXはPL売上に非算入。${precisionNote}` }));
  }
  return rows;
}
function same(left: Row[], right: Row[]) { return JSON.stringify(left) === JSON.stringify(right); }
function assertAnnualTieOut(rows: Row[]) {
  for (const plan of SX_ANNUAL_PROJECTION.filter((item) => item.fiscalYear >= 2027 && item.fiscalYear <= 2031)) {
    const period = rows.filter((row) => row.ym >= `${plan.fiscalYear}-04` && row.ym <= `${plan.fiscalYear + 1}-03`);
    const sum = (field: Field) => period.reduce((total, row) => total + row[field], 0);
    if (period.length !== 12 || sum("revenue_yen") !== plan.revenueYen || sum("cogs_yen") !== plan.costOfSalesYen || sum("personnel_yen") !== plan.executiveCompensationYen + plan.salariesAndBonusesYen || sum("rd_yen") !== plan.researchAndDevelopmentYen || sum("other_opex_yen") !== plan.sellingGeneralAdministrativeYen) throw new Error(`Cockpit FY${plan.fiscalYear} tie-out failed`);
  }
}

const generatedAnnual = annual(); assertAnnualTieOut(generatedAnnual);
const rows = [...phase0(), ...generatedAnnual].filter((row) => row.ym >= START_YM && row.ym <= END_YM);
if (rows.length !== 62) throw new Error(`row count mismatch: ${rows.length}`);
const phase0Cost = rows.filter((row) => row.ym <= "2027-03").reduce((sum, row) => sum + row.personnel_yen + row.rd_yen + row.marketing_yen + row.other_opex_yen, 0);
if (phase0Cost !== 60_000_000) throw new Error(`Phase 0 tie-out failed: ${phase0Cost}`);
if (rows.filter((row) => row.ym <= "2027-01").some((row) => !row.notes.includes("設立前PJ支出でありNewCoのP/L・営業損失ではない"))) throw new Error("設立前PJ支出の会計主体注記が欠けている");
const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL") ?? "", env("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false, autoRefreshToken: false } });
const { data: existing, error } = await db.from("project_pl_monthly").select("project_id,ym,revenue_yen,cogs_yen,personnel_yen,rd_yen,marketing_yen,other_opex_yen,notes").eq("project_id", PROJECT_ID).gte("ym", START_YM).lte("ym", END_YM).order("ym");
if (error) throw error;
const oldRows = (existing ?? []) as Row[];
if (oldRows.some((row) => !String(row.notes ?? "").includes(SOURCE_TAG))) throw new Error("既存の非SX配賦行を上書きしない");
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", rowCount: rows.length, phase0CostYen: phase0Cost, existingCount: oldRows.length, exactExisting: oldRows.length === rows.length && same(oldRows, rows), bzmHorizon: "M0=2026-08..M60=2031-08" }));
if (apply && !(oldRows.length === rows.length && same(oldRows, rows))) {
  const { error: writeError } = await db.from("project_pl_monthly").upsert(rows, { onConflict: "project_id,ym" }); if (writeError) throw writeError;
  const { data: readback, error: readbackError } = await db.from("project_pl_monthly").select("project_id,ym,revenue_yen,cogs_yen,personnel_yen,rd_yen,marketing_yen,other_opex_yen,notes").eq("project_id", PROJECT_ID).gte("ym", START_YM).lte("ym", END_YM).order("ym"); if (readbackError || (readback ?? []).length !== rows.length || !same(readback as Row[], rows)) throw new Error("readback tie-out failed");
  console.log("readback: ok");
}
