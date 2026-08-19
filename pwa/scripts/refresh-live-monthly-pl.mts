/**
 * 月次試算表（live monthly PL）を再計算して company_budget_monthly へ材料化する。
 *
 * /api/cron/management-score-refresh を叩かずに、試算表だけを更新したいときに使う。
 * projects / billing_cycles / company_finance_recurring_items を書き換えた直後の反映確認用。
 *
 *   npx tsx scripts/refresh-live-monthly-pl.mts
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const { refreshLiveMonthlyPlBudget } = await import("../src/lib/finance/live-monthly-pl-budget.ts");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const result = await refreshLiveMonthlyPlBudget(supabase, {
  sourceRef: "scripts/refresh-live-monthly-pl.mts",
});
console.log(JSON.stringify(result, null, 2));
