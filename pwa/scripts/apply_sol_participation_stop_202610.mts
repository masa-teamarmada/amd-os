/** SOL の 2026-10 業務停止。既定は読み取りのみ。--apply は本番 SHA 指定と全検算の成功が必須。 */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { calculateRewardSummaryForCycle, syncRewardSummariesForBillingCycles } from "../src/lib/reward-summary.ts";

nextEnv.loadEnvConfig(process.env.SOL_PT_ENV_DIR || process.cwd());
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const project = "p21", plan = "PC-p21-202604", cutoff = "202610";
const stopped = ["ID003", "ID007"];
const oldId = "MS-PC-p21-202604-1783002385281-13";
const newId = "MS-PC-p21-202604-routine-202610";
const apply = process.argv.includes("--apply");
const read = async (q: any): Promise<any[]> => { const r = await q; if (r.error) throw r.error; return r.data ?? []; };
const members = await read(db.from("project_members").select("*").eq("project_id", project));
const milestones = await read(db.from("value_milestones").select("*").eq("plan_cycle_id", plan).eq("is_active", true).order("sort_order"));
const responsibilities = await read(db.from("milestone_responsibility").select("*").in("milestone_id", milestones.map(m => m.milestone_id)));
const cycles = await read(db.from("billing_cycles").select("*").eq("project_id", project).order("ym"));
assert.equal(milestones.some(m => m.milestone_id === newId), false, "既に反映済みか部分反映。再実行せず変更履歴を確認");
const old = milestones.find(m => m.milestone_id === oldId);
assert.ok(old);
assert.deepEqual([Number(old.points), old.period_start_ym, old.target_ym], [7, "202604", "202703"]);
assert.deepEqual(responsibilities.filter(r => r.milestone_id === oldId).map(r => [r.member_id, Number(r.share)]), [["ID003", 1]]);
assert.equal(stopped.filter(id => members.some(m => m.member_id === id && m.is_active && !m.leave_ym)).length, 2);
const futureCycles = cycles.filter(c => c.ym >= cutoff);
assert.ok(futureCycles.length >= 6);
assert.ok(futureCycles.every(c => !c.reward_paid_at && !c.payout_notice_uploaded_at && !c.payment_confirmed_at), "停止後に保護済みの支払いがある");
const progress = await read(db.from("milestone_monthly_progress").select("*").eq("milestone_key", oldId));
assert.ok(progress.every(p => p.source === "routine_auto"), "定例MSに確定アンカーがあるため分割の再設計が必要");
const newMs = { milestone_id: newId, plan_cycle_id: plan, title: "定例会運営（2026年10月以降）", points: 3.5,
  tag: "routine", goal_level: "season", is_active: true, success_criteria: old.success_criteria,
  sort_order: 14, period_start_ym: cutoff, target_ym: "202703" };
const newResp = { milestone_id: newId, member_id: "ID001", share: 1, role: "担当", task_description: "定例会運営" };
const nextMembers = members.map(m => stopped.includes(m.member_id) ? { ...m, leave_ym: "202609" } : m);
const nextMs = [...milestones.map(m => m.milestone_id === oldId ? { ...m, points: 3.5, target_ym: "202609" } : m), newMs];
const nextResp = [...responsibilities, newResp];
assert.equal(nextMs.reduce((s, m) => s + Number(m.points), 0), milestones.reduce((s, m) => s + Number(m.points), 0));

// 同一 GET を共有し、本番の計算関数で変更前後を比較する。プロキシは書込みメソッドを持たない。
const cache = new Map<string, Promise<any>>();
function previewDb(proposed: boolean): any {
  return { from(table: string) {
    const chain: any[] = [];
    let query: any = db.from(table);
    const wrapper: any = {};
    for (const method of ["select", "eq", "neq", "not", "is", "in", "lte", "gte", "order", "maybeSingle", "limit"]) {
      wrapper[method] = (...args: any[]) => { chain.push([method, args]); query = query[method](...args); return wrapper; };
    }
    wrapper.then = (resolve: any, reject: any) => {
      const key = JSON.stringify([table, chain]);
      if (!cache.has(key)) cache.set(key, Promise.resolve(query));
      return cache.get(key)!.then(r => {
        if (!proposed || r.error || !Array.isArray(r.data)) return r;
        let data = r.data;
        if (table === "project_members") data = data.map((m: any) => stopped.includes(m.member_id) ? { ...m, leave_ym: "202609" } : m);
        if (table === "value_milestones" && data.some((m: any) => m.milestone_id === oldId)) {
          data = [...data.map((m: any) => m.milestone_id === oldId ? { ...m, points: 3.5, target_ym: "202609" } : m), newMs];
        }
        if (table === "milestone_responsibility" && data.some((m: any) => m.milestone_id === oldId)) data = [...data, newResp];
        return { ...r, data };
      }).then(resolve, reject);
    };
    return wrapper;
  } };
}
const stable = (summary: any) => summary && { ...summary, meta: summary.meta && { ...summary.meta, generatedAt: "" } };
const beforeDb = previewDb(false), afterDb = previewDb(true);
const yms = cycles.filter(c => c.ym >= "202604").map(c => c.ym);
const previews: any[] = [];
for (let i = 0; i < yms.length; i += 4) {
  const batch = await Promise.all(yms.slice(i, i + 4).map(async ym => {
    const [before, after] = await Promise.all([calculateRewardSummaryForCycle(beforeDb, project, ym), calculateRewardSummaryForCycle(afterDb, project, ym)]);
    assert.ok(before.ok && after.ok && before.rewardSummary && after.rewardSummary, `${ym}: 計算取得に失敗`);
    if (ym < cutoff) assert.deepEqual(stable(after.rewardSummary), stable(before.rewardSummary), `${ym}: 過去の計算結果が変化`);
    else for (const id of stopped) assert.equal(after.rewardSummary.members.find(m => m.memberId === id)?.earnedPt ?? 0, 0, `${ym} ${id}: 停止後の新規pt`);
    return { ym, before: before.rewardSummary, after: after.rewardSummary };
  }));
  previews.push(...batch);
  console.log(`検算 ${batch.map(b => b.ym).join(", ")}: OK`);
}
const october = previews.find(p => p.ym === cutoff)!;
const last = previews.find(p => p.ym === "202703")!;
for (const id of stopped) {
  const m = october.after.members.find((m: any) => m.memberId === id);
  assert.ok(m && m.carryInYen > 0 && m.totalPay > 0, `${id}: 過去の繰越が支払対象に残ること`);
  assert.equal(last.after.members.find((m: any) => m.memberId === id)?.stockYen ?? 0, 0, `${id}: 期末の未払が解消すること`);
}
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", project, historicalMonthsUnchanged: previews.filter(p => p.ym < cutoff).length,
  future: previews.filter(p => p.ym >= cutoff && p.ym <= "202703").map(p => ({ ym: p.ym, members: p.after.members.map((m: any) => ({ id: m.memberId, pt: m.earnedPt, pay: m.totalPay, carry: m.stockYen })) })) }, null, 2));
if (!apply) process.exit(0);
assert.ok(process.env.SOL_PT_EXPECTED_SHA, "本番コードの SHA 確認が必要");
const build = await fetch("https://amd-os-pwa.vercel.app/api/build-info", { signal: AbortSignal.timeout(20000) }).then(r => r.json());
assert.equal(build.git_sha, process.env.SOL_PT_EXPECTED_SHA);
assert.equal(build.dirty, false);

function snapshot(ms: any[], resp: any[]) {
  return ms.map(m => ({ milestoneId: m.milestone_id, title: m.title, points: Number(m.points), tag: m.tag,
    goalLevel: m.goal_level, isActive: m.is_active, successCriteria: m.success_criteria, sortOrder: m.sort_order,
    periodStartYm: m.period_start_ym, targetYm: m.target_ym,
    responsibilities: resp.filter(r => r.milestone_id === m.milestone_id).map(r => ({ memberId: r.member_id, share: Number(r.share), role: r.role, taskDescription: r.task_description })) }));
}
// 変更前を監査履歴へ保存してから、期待する旧値との一致条件付きで限定更新する。
const revisionId = randomUUID();
const event = await read(db.from("milestone_change_events").insert({ project_id: project, plan_cycle_id: plan,
  revision_id: revisionId, source: "manual", changed_by_email: null,
  reward_preview_status: "safe", changed_milestone_count: 2, added_milestone_count: 1, updated_milestone_count: 1,
  removed_milestone_count: 0, protected_cycle_count: cycles.filter(c => c.payment_confirmed_at || c.reward_paid_at || c.payout_notice_uploaded_at).length,
  offset_count: 0, positive_offset_yen: 0, negative_offset_yen: 0,
  before_milestones_json: snapshot(milestones, responsibilities), after_milestones_json: snapshot(nextMs, nextResp),
  change_items_json: [
    { kind: "updated", milestoneId: oldId, title: old.title, fields: [{ field: "points", label: "pt", beforeValue: 7, afterValue: 3.5 }, { field: "period", label: "期間", beforeValue: "202604 - 202703", afterValue: "202604 - 202609" }], responsibilities: [] },
    { kind: "added", milestoneId: newId, title: newMs.title, fields: [{ field: "points", label: "pt", beforeValue: null, afterValue: 3.5 }], responsibilities: [{ memberId: "ID001", role: "担当", beforeShare: null, afterShare: 1 }] },
  ], reward_preview_json: { status: "safe", sourceYms: previews.filter(p => p.ym < cutoff).map(p => p.ym), offsetCount: 0 },
  metadata_json: { operation: "sol_participation_stop_202610", state: "prepared", actor: "えいみ", authorization: "2026-09-26 まさ指示。前日に本人からSOL Slackへ10月以降の停止を通知済みとの申告",
    beforeMembers: members.filter(m => stopped.includes(m.member_id)).map(m => ({ memberId: m.member_id, joinYm: m.join_ym, leaveYm: m.leave_ym, isActive: m.is_active })),
    afterMembers: nextMembers.filter(m => stopped.includes(m.member_id)).map(m => ({ memberId: m.member_id, joinYm: m.join_ym, leaveYm: m.leave_ym, isActive: m.is_active })),
    historicalLedgerSha256: createHash("sha256").update(JSON.stringify(cycles.filter(c => c.ym < cutoff))).digest("hex"), buildSha: build.git_sha },
}).select("id"));
assert.equal(event.length, 1);
console.log(`監査履歴 ${event[0].id} を保存`);
const changedMembers = await read(db.from("project_members").update({ leave_ym: "202609" }).eq("project_id", project).in("member_id", stopped).is("leave_ym", null).eq("is_active", true).select("member_id"));
assert.equal(changedMembers.length, 2);
const changedMs = await read(db.from("value_milestones").update({ points: 3.5, target_ym: "202609" }).eq("milestone_id", oldId).eq("points", 7).eq("target_ym", "202703").select("milestone_id"));
assert.equal(changedMs.length, 1);
await read(db.from("value_milestones").insert(newMs));
await read(db.from("milestone_responsibility").insert(newResp));
await syncRewardSummariesForBillingCycles(db, futureCycles);
const afterCycles = await read(db.from("billing_cycles").select("*").eq("project_id", project).order("ym"));
assert.deepEqual(afterCycles.filter(c => c.ym < cutoff), cycles.filter(c => c.ym < cutoff), "9月以前の台帳行を保持");
for (const c of afterCycles.filter(c => c.ym >= cutoff)) {
  assert.deepEqual(stable(c.reward_summary_json), stable(previews.find(p => p.ym === c.ym)?.after), `${c.ym}: 保存結果が検算と一致`);
}
const verifiedMembers = await read(db.from("project_members").select("*").eq("project_id", project));
for (const id of stopped) assert.equal(verifiedMembers.find(m => m.member_id === id)?.leave_ym, "202609");
const eventRows = await read(db.from("milestone_change_events").select("metadata_json").eq("id", event[0].id));
await read(db.from("milestone_change_events").update({ metadata_json: { ...eventRows[0].metadata_json, state: "applied_verified", verifiedAt: new Date().toISOString() } }).eq("id", event[0].id));
console.log(JSON.stringify({ applied: true, revisionId, eventId: event[0].id, historicalRowsUnchanged: cycles.filter(c => c.ym < cutoff).length, futureRowsVerified: futureCycles.length }));
