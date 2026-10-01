/** 共通ルールの初回反映と照合。毎日の自動更新と同じsyncRewardSummaryForCycleを使う。 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { calculateRewardSummaryForCycle, syncRewardSummaryForCycle } from "../src/lib/reward-summary.ts";
nextEnv.loadEnvConfig(process.cwd());
const apply = process.argv.includes("--apply");
const verify = process.argv.includes("--verify-only");
assert.ok(!(apply && verify));
const nativeFetch = fetch;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { global: { fetch(input, init) {
  if (!apply && !["GET", "HEAD"].includes(init?.method || "GET")) throw Error("read-only");
  return nativeFetch(input, init);
} } });
async function read(q: any) { const r = await q; if (r.error) throw r.error; return r.data || []; }
async function all(table: string) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 500) {
    let q = db.from(table).select("*");
    q = table === "billing_cycles" ? q.order("project_id").order("ym") : q.order("ym").order("member_id");
    if (table === "monthly_reward_payout") q = q.order("project_id");
    const batch = await read(q.range(offset, offset + 499)); rows.push(...batch); if (batch.length < 500) return rows;
  }
}
const [cycles, notices, payouts] = await Promise.all([all("billing_cycles"), all("payout_notices"), all("monthly_reward_payout")]);
const targets = cycles.filter(c => c.ym >= "202609");
const stable = (s: any) => s && JSON.parse(JSON.stringify({ ...s, meta: s.meta && { ...s.meta, generatedAt: "" } }));
const cache = new Map<string, Promise<any>>();
const cachedDb: any = { from(table: string) {
  let q: any = db.from(table); const chain: any[] = []; const wrapper: any = {};
  for (const method of ["select", "eq", "neq", "not", "is", "in", "lte", "gte", "order", "maybeSingle", "limit", "range"]) {
    wrapper[method] = (...args: any[]) => { chain.push([method, args]); q = q[method](...args); return wrapper; };
  }
  wrapper.then = (resolve: any, reject: any) => { const key = JSON.stringify([table, chain]);
    if (!cache.has(key)) cache.set(key, Promise.resolve(q)); return cache.get(key)!.then(resolve, reject); };
  return wrapper;
} };
const previews: any[] = [];
const failures: any[] = [];
for (const c of targets) {
  try {
    const r = await calculateRewardSummaryForCycle(cachedDb, c.project_id, c.ym);
    assert.ok(r.ok && r.rewardSummary);
    previews.push({ cycle: c, result: r });
  } catch (e) { failures.push({ project: c.project_id, ym: c.ym, error: e instanceof Error ? e.message : String(e) }); }
}
const total = (s: any) => (s?.members || []).reduce((sum: number, m: any) => sum + (m.totalPay || 0), 0);
console.log(JSON.stringify({ mode: apply ? "apply" : verify ? "verify" : "preview", cycles: targets.length,
  protected: previews.filter(p => p.result.skippedReason === "payout_protected").length, failures,
  changes: previews.filter(p => total(p.cycle.reward_summary_json) !== total(p.result.rewardSummary)).map(p => ({
    project: p.cycle.project_id, ym: p.cycle.ym, before: total(p.cycle.reward_summary_json), after: total(p.result.rewardSummary),
    settlement: p.result.rewardSummary.smallBalanceSettlementYen || 0,
  })) }, null, 2));
assert.equal(failures.length, 0, "検算失敗があるため適用しない");
if (verify) {
  for (const p of previews) assert.ok(isDeepStrictEqual(stable(p.cycle.reward_summary_json), stable(p.result.rewardSummary)), `${p.cycle.project_id}:${p.cycle.ym} readback mismatch`);
  console.log(JSON.stringify({ verified: true, rows: previews.length }));
}
if (!apply) process.exit(0);
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.equal(execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim(), "");
const build = await fetch("https://amd-os-pwa.vercel.app/api/build-info").then(r => r.json());
assert.equal(build.git_sha, sha); assert.equal(build.dirty, false);
assert.deepEqual(await all("billing_cycles"), cycles, "検算中の競合");
assert.deepEqual(await all("payout_notices"), notices);
assert.deepEqual(await all("monthly_reward_payout"), payouts);
const revision = randomUUID(); let updated = 0;
for (const { cycle, result } of previews) {
  if (result.skippedReason === "payout_protected" || isDeepStrictEqual(stable(cycle.reward_summary_json), stable(result.rewardSummary))) continue;
  await read(db.from("billing_log").insert({ project_id: cycle.project_id, ym: cycle.ym, action: "common_payout_policy_prepared", actor: "えいみ",
    detail: { revision, buildSha: sha, before: cycle.reward_summary_json, after: result.rewardSummary, authorization: "2026-10-02 全PJ共通化の依頼" } }));
  const synced = await syncRewardSummaryForCycle(db, cycle.project_id, cycle.ym);
  assert.ok(isDeepStrictEqual(stable(synced.rewardSummary), stable(result.rewardSummary)), `${cycle.project_id}:${cycle.ym} 計算中の入力変化`);
  updated++;
}
const actual = await all("billing_cycles");
for (const { cycle, result } of previews) {
  const saved = actual.find(c => c.project_id === cycle.project_id && c.ym === cycle.ym);
  if (result.skippedReason === "payout_protected") assert.deepEqual(saved, cycle, "保護月不変");
  else assert.ok(isDeepStrictEqual(stable(saved.reward_summary_json), stable(result.rewardSummary)), `${cycle.project_id}:${cycle.ym} 保存照合`);
}
assert.deepEqual(actual.filter(c => c.ym < "202609"), cycles.filter(c => c.ym < "202609"), "過去月不変");
assert.deepEqual(await all("payout_notices"), notices, "通知書不変");
assert.deepEqual(await all("monthly_reward_payout"), payouts, "支払明細不変");
await read(db.from("billing_log").insert({ project_id: "p00", ym: "202610", action: "common_payout_policy_verified", actor: "えいみ",
  detail: { revision, updated, verifiedRows: previews.length, buildSha: sha, noticesUnchanged: true, payoutsUnchanged: true } }));
console.log(JSON.stringify({ applied: true, verified: true, updated, rows: previews.length, revision }));
