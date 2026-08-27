/**
 * 見込みPJ (p32 NewCo / p33 CX再開 / p34 PSI Step2新規) を、本来の親PJ
 * (p21 SX / p20 CX / p26 VasculaX) へ統合する作業の、前後スナップショットを撮る。
 *
 * まさ指示 2026-08-27:
 *   「ひとつのシーズはひとつのPJにまとめないと明らかにおかしなことになるでしょ。
 *     SXも毎月の請求額とメンバーへの支払額を別に保存しておいてマージして、
 *     元のデータと同じになることを確認してほしい。」
 *
 * 使い方:
 *   node --experimental-strip-types --import ./scripts/register_ts_aliases.mjs \
 *     scripts/pj_merge_snapshot.mts before
 *   (統合作業)
 *   node ... scripts/pj_merge_snapshot.mts after
 *   node ... scripts/pj_merge_snapshot.mts diff
 *
 * 撮るもの:
 *   1. 対象PJの `projects` 行 (料金体系・契約期間)
 *   2. 対象PJの `billing_cycles` 全件 (毎月の請求額とメンバーへの支払額)
 *   3. 財務エンジン (`buildLiveMonthlyPlInputs`) が出す月別の売上・原価
 *      = 経営スコアと月次試算表が実際に読む値
 *
 * `diff` は 3 の月別合計を before/after で突き合わせる。PJ単位の内訳は
 * 統合で当然変わるので、**会社全体の月別合計が1円も動かないこと**を合格条件にする。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildLiveMonthlyPlInputs } from "@/lib/finance/live-monthly-pl-inputs";
import type { MonthlyPlInputs } from "@/lib/finance/monthly-pl-simulation";

const TARGET_PROJECT_IDS = ["p20", "p21", "p26", "p32", "p33", "p34"];
const SNAPSHOT_DIR = path.join(import.meta.dirname, "__snapshots__", "pj_merge_20260827");

loadEnv(path.join(import.meta.dirname, "..", ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が要る");
}
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const mode = process.argv[2];
if (!["before", "after", "diff"].includes(String(mode))) {
  throw new Error("使い方: pj_merge_snapshot.mts before|after|diff");
}

if (mode === "diff") {
  reportDiff();
} else {
  await capture(mode as "before" | "after");
}

async function capture(label: "before" | "after") {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });

  const [projectsRes, billingRes] = await Promise.all([
    supabase.from("projects").select("*").in("project_id", TARGET_PROJECT_IDS).order("project_id"),
    supabase.from("billing_cycles").select("*").in("project_id", TARGET_PROJECT_IDS).order("project_id").order("ym"),
  ]);
  if (projectsRes.error) throw projectsRes.error;
  if (billingRes.error) throw billingRes.error;

  const inputs = await buildLiveInputs();
  const monthly = monthlyTotals(inputs);

  const snapshot = {
    label,
    targetProjectIds: TARGET_PROJECT_IDS,
    params: { startYm: inputs.params.startYm, months: inputs.params.months },
    projects: projectsRes.data,
    billingCycles: billingRes.data,
    liveProjects: inputs.projects,
    liveProjectRevenues: inputs.projectRevenues,
    liveVarCosts: inputs.varCosts,
    monthlyTotals: monthly,
  };

  const file = path.join(SNAPSHOT_DIR, `${label}.json`);
  writeFileSync(file, JSON.stringify(snapshot, null, 2));
  console.log(JSON.stringify({
    saved: file,
    projects: projectsRes.data?.length ?? 0,
    billingCycles: billingRes.data?.length ?? 0,
    liveProjects: inputs.projects.length,
    liveProjectRevenues: inputs.projectRevenues?.length ?? 0,
    months: Object.keys(monthly).length,
  }, null, 2));
}

/** 財務エンジンの入力を、API route (`/api/macos/management-score/inputs`) と同じ引数で作る。 */
async function buildLiveInputs(): Promise<MonthlyPlInputs> {
  const { data, error } = await supabase
    .from("company_budget_inputs")
    .select("input_kind,payload")
    .eq("source", "gas_monthly_pl")
    .order("input_kind", { ascending: true })
    .limit(500);
  if (error) throw error;

  const rows = (data ?? []) as { input_kind: string; payload: Record<string, unknown> | null }[];
  const payloads = (kind: string) => rows.filter((row) => row.input_kind === kind && row.payload).map((row) => row.payload!);
  const params = rows.find((row) => row.input_kind === "params" && row.payload)?.payload;
  if (!params) throw new Error("company_budget_inputs に params が無い");

  const live = await buildLiveMonthlyPlInputs(supabase, {
    startYm: (params as { startYm: number }).startYm,
    months: (params as { months: number }).months,
    fallbackParams: params as unknown as MonthlyPlInputs["params"],
    fallbackLoans: payloads("loan") as unknown as MonthlyPlInputs["loans"],
    fallbackSpots: payloads("spot") as unknown as MonthlyPlInputs["spots"],
    fallbackScenarios: payloads("scenario") as unknown as MonthlyPlInputs["scenarios"],
    persistForecast: false,
  });
  return live.inputs;
}

/**
 * 会社全体の月別売上・原価。統合でPJ単位の内訳は動くが、ここは1円も動いてはいけない。
 * fixed PJ は `projects[].monthlyRevenue` を契約期間へ展開し、
 * variable PJ は `projectRevenues[]` の月別値で上書きする (エンジンと同じ合成)。
 */
function monthlyTotals(inputs: MonthlyPlInputs) {
  const startYm = inputs.params.startYm;
  const months = inputs.params.months;
  const yms: number[] = [];
  let cursor = startYm;
  for (let i = 0; i < months; i += 1) {
    yms.push(cursor);
    const year = Math.floor(cursor / 100);
    const month = cursor % 100;
    cursor = month === 12 ? (year + 1) * 100 + 1 : year * 100 + month + 1;
  }

  const overrideByKey = new Map<string, number>();
  for (const row of inputs.projectRevenues ?? []) {
    const value = (row as { monthlyRevenue?: number }).monthlyRevenue;
    if (typeof value !== "number") continue;
    overrideByKey.set(`${row.projectId}:${row.ym}`, value);
  }

  const totals: Record<string, { revenue: number; byProject: Record<string, number> }> = {};
  for (const ym of yms) {
    let revenue = 0;
    const byProject: Record<string, number> = {};
    for (const project of inputs.projects) {
      const inPeriod = ym >= project.startYm && (!project.endYm || ym <= project.endYm);
      if (!inPeriod) continue;
      const override = overrideByKey.get(`${project.projectId}:${ym}`);
      const value = typeof override === "number" ? override : project.monthlyRevenue;
      if (!value) continue;
      revenue += value;
      byProject[project.projectId] = (byProject[project.projectId] ?? 0) + value;
    }
    totals[String(ym)] = { revenue, byProject };
  }
  return totals;
}

function reportDiff() {
  const beforeFile = path.join(SNAPSHOT_DIR, "before.json");
  const afterFile = path.join(SNAPSHOT_DIR, "after.json");
  if (!existsSync(beforeFile) || !existsSync(afterFile)) {
    throw new Error("before.json と after.json の両方が要る");
  }
  const before = JSON.parse(readFileSync(beforeFile, "utf8"));
  const after = JSON.parse(readFileSync(afterFile, "utf8"));

  const yms = Array.from(new Set([...Object.keys(before.monthlyTotals), ...Object.keys(after.monthlyTotals)])).sort();
  const diffs: { ym: string; before: number; after: number; delta: number; beforeByProject: Record<string, number>; afterByProject: Record<string, number> }[] = [];
  let beforeTotal = 0;
  let afterTotal = 0;
  for (const ym of yms) {
    const b = before.monthlyTotals[ym]?.revenue ?? 0;
    const a = after.monthlyTotals[ym]?.revenue ?? 0;
    beforeTotal += b;
    afterTotal += a;
    if (b !== a) {
      diffs.push({
        ym,
        before: b,
        after: a,
        delta: a - b,
        beforeByProject: before.monthlyTotals[ym]?.byProject ?? {},
        afterByProject: after.monthlyTotals[ym]?.byProject ?? {},
      });
    }
  }

  console.log(JSON.stringify({
    months: yms.length,
    beforeTotalRevenue: beforeTotal,
    afterTotalRevenue: afterTotal,
    delta: afterTotal - beforeTotal,
    monthsWithDiff: diffs.length,
    diffs,
  }, null, 2));

  if (diffs.length > 0) {
    console.error(`\n⛔ 月別売上が ${diffs.length} か月ぶん変わっている。統合前後で会社全体の数字は動いてはいけない。`);
    process.exitCode = 1;
  } else {
    console.log("\n✅ 会社全体の月別売上は統合前後で完全一致");
  }
}

function loadEnv(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx);
    if (process.env[key]) continue;
    let value = trimmed.slice(idx + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
