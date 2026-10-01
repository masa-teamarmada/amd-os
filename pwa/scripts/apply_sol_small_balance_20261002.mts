/** SOL未確定分の少額残高前月合算。既定は読取り検算、--applyは本番配信SHA確認後のみ。 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { calculateRewardSummaryForCycle, isRewardCycleProtected } from "../src/lib/reward-summary.ts";

nextEnv.loadEnvConfig(process.cwd());
const apply = process.argv.includes("--apply");
const verifyOnly = process.argv.includes("--verify-only");
assert.ok(!(apply && verifyOnly), "applyとverify-onlyは同時指定しない");
const nativeFetch = fetch;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  global: { fetch: (input, init) => {
    if (!apply && !["GET", "HEAD"].includes(init?.method || "GET")) throw Error("dry-run: write forbidden");
    return nativeFetch(input, init);
  } },
});
const project = "p21", fromYm = "202610", endYm = "202703";
const ids = ["ID003", "ID007"];
async function read(query: any): Promise<any[]> { const r = await query; if (r.error) throw r.error; return r.data || []; }
const cyclesQuery = () => db.from("billing_cycles").select("*").eq("project_id", project).order("ym");
const noticesQuery = () => db.from("payout_notices").select("*").in("member_id", ids).order("ym").order("member_id");
const payoutsQuery = () => db.from("monthly_reward_payout").select("*").eq("project_id", project).order("ym").order("member_id");
const [cycles, notices, payouts] = await Promise.all([read(cyclesQuery()), read(noticesQuery()), read(payoutsQuery())]);
const targets = cycles.filter(c => c.ym >= fromYm && c.ym <= endYm);
assert.equal(targets.length, 6, "シーズン6か月が必要");
assert.ok(targets.every(c => !isRewardCycleProtected(c)), "保護月あり。既存額を保持して移行計画を再検討する");
assert.ok(payouts.every(p => p.ym < fromYm), "対象期間に保存済み支払明細あり");
// SOLは稼働月+3か月払い。202610稼働分は202701支払。未来PDFを自動再発行しない。
assert.ok(notices.every(n => n.ym < "202701"), "対象期間に発行済み通知書あり");
// JSON保存時にundefinedは省略され、jsonbのキー順も変わる。金額差と混同しない。
const stable = (s: any) => s && JSON.parse(JSON.stringify({ ...s, meta: s.meta && { ...s.meta, generatedAt: "" } }));
const cache = new Map<string, Promise<any>>();
const readDb: any = { from(table: string) {
  let q: any = db.from(table); const chain: any[] = []; const wrapper: any = {};
  for (const method of ["select", "eq", "neq", "not", "is", "in", "lte", "gte", "order", "maybeSingle", "limit"]) {
    wrapper[method] = (...args: any[]) => { chain.push([method, args]); q = q[method](...args); return wrapper; };
  }
  wrapper.then = (resolve: any, reject: any) => {
    const key = JSON.stringify([table, chain]);
    if (!cache.has(key)) cache.set(key, Promise.resolve(q));
    return cache.get(key)!.then(resolve, reject);
  };
  return wrapper;
} };
const previews: Array<{ cycle: any; after: any }> = [];
for (const cycle of cycles.filter(c => c.ym >= "202604" && c.ym <= endYm)) {
  const result = await calculateRewardSummaryForCycle(readDb, project, cycle.ym);
  assert.ok(result.ok && result.rewardSummary, `${cycle.ym}: 計算失敗`);
  const after = result.rewardSummary;
  const before = cycle.reward_summary_json;
  for (const id of ids) {
    const a = after.members.find(m => m.memberId === id);
    const b = before?.members?.find((m: any) => m.memberId === id);
    assert.equal(a?.basePay || 0, b?.basePay || 0, `${cycle.ym} ${id}: 発生額を変更しない`);
    assert.equal(a?.earnedPt || 0, b?.earnedPt || 0, `${cycle.ym} ${id}: ptを変更しない`);
    if (cycle.ym < fromYm) {
      assert.equal(a?.totalPay || 0, b?.totalPay || 0, `${cycle.ym}: 過去支払不変`);
      assert.equal(a?.stockYen || 0, b?.stockYen || 0, `${cycle.ym}: 過去繰越不変`);
    } else if (a) {
      assert.equal(a.totalPay % 100, 0);
      assert.equal(a.grossDueYen! + (a.roundingTopUpYen || 0), a.totalPay + a.stockYen!);
      assert.ok((a.roundingTopUpYen || 0) >= 0 && (a.roundingTopUpYen || 0) <= 198);
      if (cycle.ym >= "202610") assert.equal(a.basePay, 0, "業務停止後の新規報酬0");
      if (cycle.ym >= "202701") assert.equal(a.stockYen, 0, "最終支払で清算し、端数を残さない");
      if (cycle.ym >= "202701") assert.equal(a.totalPay, 0, "端数だけの後日支払なし");
    }
  }
  if (cycle.ym >= fromYm) previews.push({ cycle, after });
}
for (const id of ids) {
  const total = (key: "before" | "after") => previews.reduce((sum, p) => sum + ((key === "before" ? p.cycle.reward_summary_json : p.after)?.members?.find((m: any) => m.memberId === id)?.totalPay || 0), 0);
  assert.equal(total("after"), total("before"), `${id}: 今期の支払総額は変えない`);
}
console.log(JSON.stringify({ mode: verifyOnly ? "verify-only" : apply ? "apply" : "dry-run", project,
  months: previews.map(({ cycle, after }) => ({ ym: cycle.ym, topUp: after.roundingTopUpYen,
    members: after.members.filter((m: any) => ids.includes(m.memberId)).map((m: any) => ({ id: m.memberId,
      before: cycle.reward_summary_json?.members?.find((b: any) => b.memberId === m.memberId)?.totalPay || 0,
      pay: m.totalPay, carry: m.stockYen, topUp: m.roundingTopUpYen, settlement: m.smallBalanceSettlementYen })) })) }, null, 2));
if (verifyOnly) {
  for (const { cycle, after } of previews) assert.ok(isDeepStrictEqual(stable(cycle.reward_summary_json), stable(after)), `${cycle.ym}: 保存済み計算との不一致`);
  assert.deepEqual(await read(cyclesQuery()), cycles, "検証中の変更なし");
  assert.deepEqual(await read(noticesQuery()), notices, "通知書の保持");
  assert.deepEqual(await read(payoutsQuery()), payouts, "保存済み支払明細の保持");
  console.log(JSON.stringify({ verified: true, readOnly: true, rows: previews.length }));
}
if (!apply) process.exit(0);
assert.ok(process.env.SOL_SMALL_BALANCE_EXPECTED_SHA, "本番SHAの指定が必要");
assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), process.env.SOL_SMALL_BALANCE_EXPECTED_SHA);
assert.equal(execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim(), "", "適用コードはコミット済みであること");
const build = await fetch("https://amd-os-pwa.vercel.app/api/build-info", { signal: AbortSignal.timeout(20000) }).then(r => r.json());
assert.equal(build.git_sha, process.env.SOL_SMALL_BALANCE_EXPECTED_SHA);
assert.equal(build.dirty, false);
// 検算中の他操作との競合を検知する。既発行通知・保存支払・過去月は書かない。
assert.deepEqual(await read(cyclesQuery()), cycles);
assert.deepEqual(await read(noticesQuery()), notices);
assert.deepEqual(await read(payoutsQuery()), payouts);
const revision = randomUUID();
for (const { cycle, after } of previews) {
  if (isDeepStrictEqual(stable(cycle.reward_summary_json), stable(after))) continue;
  await read(db.from("billing_log").insert({ project_id: project, ym: cycle.ym, action: "sol_small_balance_prepared",
    actor: "えいみ", detail: { revision, authorization: "2026-10-02 まさ依頼: cap由来の1万円以下の残額を前月にまとめる",
      buildSha: build.git_sha, before: cycle.reward_summary_json, after } }));
  let update = db.from("billing_cycles").update({ reward_summary_json: after, updated_at: new Date().toISOString() })
    .eq("project_id", project).eq("ym", cycle.ym)
    .is("reward_paid_at", null).is("payout_notice_uploaded_at", null).is("payment_confirmed_at", null);
  update = cycle.updated_at ? update.eq("updated_at", cycle.updated_at) : update.is("updated_at", null);
  assert.equal((await read(update.select("ym"))).length, 1, `${cycle.ym}: 競合または保護状態変更`);
}
const afterCycles = await read(cyclesQuery());
assert.deepEqual(afterCycles.filter(c => c.ym < fromYm || c.ym > endYm), cycles.filter(c => c.ym < fromYm || c.ym > endYm));
for (const { cycle, after } of previews) assert.ok(isDeepStrictEqual(stable(afterCycles.find(c => c.ym === cycle.ym).reward_summary_json), stable(after)), `${cycle.ym}: 保存後照合の不一致`);
assert.deepEqual(await read(noticesQuery()), notices, "通知書の保持");
assert.deepEqual(await read(payoutsQuery()), payouts, "保存済み支払明細の保持");
await read(db.from("billing_log").insert({ project_id: project, ym: fromYm, action: "sol_small_balance_verified",
  actor: "えいみ", detail: { revision, rows: previews.length, buildSha: build.git_sha, noticesUnchanged: true, payoutsUnchanged: true } }));
console.log(JSON.stringify({ applied: true, verified: true, revision, rows: previews.length }));
