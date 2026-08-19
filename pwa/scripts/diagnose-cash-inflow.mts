/**
 * 月次試算表のキャッシュ入金欠落を診断する（読み取り専用。DBには書かない）。
 *
 * 症状 (2026-08-16 修正済み): 契約は継続しているのに billing_cycles が将来月に無い PJ は
 *       PJ 単位で cashRevenueMode='explicit' になり、台帳切れ以降のキャッシュ入金が 0 になった。
 *       売上（PL）は立つのに入金だけ消えるため、月次CFと現預金が実態より悪く出た。
 *
 * 現行は月単位判定 (cashRevenueExplicitYms)。このスクリプトは
 *   旧挙動 (PJ単位 explicit) と 現行 (月単位) を並べて、修正が効いていることを確認する。
 *   台帳の無い月がどれだけあるか (= 原価が入っていない月) も出す。
 *
 *   npx tsx scripts/diagnose-cash-inflow.mts
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const { buildLiveMonthlyPlInputs } = await import("../src/lib/finance/live-monthly-pl-inputs.ts");
const { runMonthlyPlSimulation } = await import("../src/lib/finance/monthly-pl-simulation.ts");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const { data: paramRow } = await supabase
  .from("company_budget_inputs")
  .select("payload")
  .eq("input_kind", "params")
  .limit(1)
  .single();
const params = (paramRow as any).payload;

const live = await buildLiveMonthlyPlInputs(supabase, {
  startYm: Number(params.startYm),
  months: Number(params.months),
  fallbackParams: params,
});

const startYm = Number(params.startYm);
const months = Number(params.months);
const scheduleYms: number[] = [];
{
  let y = Math.floor(startYm / 100);
  let m = startYm % 100;
  for (let i = 0; i < months; i++) {
    scheduleYms.push(y * 100 + m);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
}
const isActive = (ym: number, s: number, e?: number | null) => ym >= s && (e == null || ym <= e);

console.log("=== 台帳(billing_cycles)で入金が明示されている月 / 自動入金へ戻る月 ===");
for (const p of live.inputs.projects) {
  const explicit = new Set(p.cashRevenueExplicitYms ?? []);
  const activeYms = scheduleYms.filter((ym) => isActive(ym, p.startYm, p.endYm));
  const autoYms = activeYms.filter((ym) => !explicit.has(ym));
  console.log(
    `${p.projectId.padEnd(5)} ${String(p.projectName).slice(0, 26).padEnd(28)} ` +
      `契約=${p.startYm}-${p.endYm ?? "(継続)"} 台帳あり=${activeYms.length - autoYms.length}ヶ月 ` +
      `自動入金=${autoYms.length}ヶ月 ${autoYms.length ? `(${autoYms[0]}〜${autoYms[autoYms.length - 1]})` : ""}`
  );
}

const after = runMonthlyPlSimulation(live.inputs, null);

// 旧挙動の再現: 台帳の行が1件でもある PJ は全期間 explicit
const legacy = JSON.parse(JSON.stringify(live.inputs));
const legacyPjs: string[] = [];
for (const p of legacy.projects) {
  if (p.cashRevenueExplicitYms?.length) {
    p.cashRevenueMode = "explicit";
    legacyPjs.push(p.projectId);
  }
}
const before = runMonthlyPlSimulation(legacy, null);
console.log(`\n旧挙動で PJ 単位 explicit になっていた PJ: ${legacyPjs.join(", ") || "なし"}`);

console.log("\n=== 旧挙動 vs 現行(月単位判定) ===");
console.log("月       旧入金        現行入金      旧CF          現行CF        旧現預金       現行現預金");
for (let i = 0; i < after.rows.length; i++) {
  const b = before.rows[i], a = after.rows[i];
  if (String(b.ym) < "202704") continue;
  console.log(
    `${b.ym}  ${String(b.cashInflow).padStart(11)}  ${String(a.cashInflow).padStart(12)}  ${String(b.netCashFlow).padStart(11)}  ${String(a.netCashFlow).padStart(12)}  ${String(b.cashBalance).padStart(12)}  ${String(a.cashBalance).padStart(13)}`
  );
}

const minAfter = after.rows.reduce((acc, r) => (r.cashBalance < acc.cashBalance ? r : acc), after.rows[0]);
console.log(`\n現行の現預金 最小月: ${minAfter.ym} = ${minAfter.cashBalance.toLocaleString()} 円`);
