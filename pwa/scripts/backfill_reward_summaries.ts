import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { syncRewardSummariesForBillingCycles } from "../src/lib/reward-summary.ts";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const projectFilter = process.argv.find((arg) => arg.startsWith("--project="))?.split("=")[1] ?? null;
const ymFilter = process.argv.find((arg) => arg.startsWith("--ym="))?.split("=")[1] ?? null;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is required");
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let query = db
  .from("billing_cycles")
  .select("project_id, ym, reward_paid_at, payout_notice_uploaded_at, payment_confirmed_at")
  .order("project_id", { ascending: true })
  .order("ym", { ascending: true });

if (projectFilter) query = query.eq("project_id", projectFilter);
if (ymFilter) query = query.eq("ym", ymFilter);

const { data, error } = await query;
if (error) throw error;

const cycles = (data ?? []) as Array<{
  project_id: string;
  ym: string;
  reward_paid_at?: string | null;
  payout_notice_uploaded_at?: string | null;
  payment_confirmed_at?: string | null;
}>;
const synced = await syncRewardSummariesForBillingCycles(db, cycles);

console.log(JSON.stringify({
  ok: true,
  scannedCycles: cycles.length,
  syncedCycles: synced.size,
  syncedKeys: Array.from(synced.keys()).sort(),
}, null, 2));
