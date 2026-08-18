import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  addWeeks,
  actionItemCandidateKey,
  actionItemIdFromCandidateKey,
  isMondayWeekKey,
  mondayOfWeekJst,
  rolloverCandidates,
  validateWeeklyTaskCommand,
  weekBoundsJst,
} from "../src/lib/mypage/member-weekly-tasks.ts";

const scriptsDir = new URL(".", import.meta.url);

assert.equal(mondayOfWeekJst(new Date("2026-08-16T14:59:00.000Z")), "2026-08-10", "JST日曜の終端は前週のまま");
assert.equal(mondayOfWeekJst(new Date("2026-08-16T15:00:00.000Z")), "2026-08-17", "JST月曜で週を切り替える");
assert.equal(addWeeks("2026-08-17", 1), "2026-08-24");
assert.equal(isMondayWeekKey("2026-08-17"), true);
assert.equal(isMondayWeekKey("2026-08-18"), false);

const validCreate = validateWeeklyTaskCommand({ action: "create", weekStart: "2026-08-24", title: "  来週の確認  " });
assert.equal(validCreate.ok, true);
if (validCreate.ok) assert.equal(validCreate.title, "来週の確認");
assert.equal(validateWeeklyTaskCommand({ action: "create", weekStart: "2026-08-18", title: "invalid" }).ok, false);
assert.equal(validateWeeklyTaskCommand({ action: "set-status", taskId: "not-a-uuid", status: "completed" }).ok, false);
const actionItemKey = actionItemCandidateKey("ai:member/next-week");
assert.equal(actionItemIdFromCandidateKey(actionItemKey), "ai:member/next-week", "候補キーは action_id を安全に往復できる");
assert.equal(validateWeeklyTaskCommand({ action: "accept-candidate", weekStart: "2026-08-24", candidateKey: actionItemKey }).ok, true);
assert.equal(validateWeeklyTaskCommand({ action: "accept-candidate", weekStart: "2026-08-24", candidateKey: "action_item:bad%ZZ" }).ok, false);
assert.deepEqual(weekBoundsJst("2026-08-24"), {
  startIso: "2026-08-23T15:00:00.000Z",
  endIso: "2026-08-30T15:00:00.000Z",
}, "来週候補の期限範囲は JST 月曜始まりで閉じる");

const carryable = rolloverCandidates(
  [
    { id: "carry-me", status: "open" as const },
    { id: "done", status: "completed" as const },
    { id: "already-carried", status: "open" as const },
  ],
  ["already-carried"],
);
assert.deepEqual(carryable.map((task) => task.id), ["carry-me"], "未完了だけを一度だけ繰り越す");

const [migration, candidateMigration, route, page] = await Promise.all([
  readFile(new URL("migrations/284_member_weekly_tasks.sql", scriptsDir), "utf8"),
  readFile(new URL("migrations/285_member_weekly_task_candidates.sql", scriptsDir), "utf8"),
  readFile(new URL("../src/app/api/mypage/weekly-tasks/route.ts", scriptsDir), "utf8"),
  readFile(new URL("../src/app/(app)/mypage/page.tsx", scriptsDir), "utf8"),
]);
assert.match(migration, /member_weekly_tasks_rollover_once_idx/, "二重繰越をDB制約で防ぐ");
assert.match(migration, /previous\.status = 'open'/, "完了済みは繰り越さない");
assert.match(migration, /REVOKE ALL ON public\.member_weekly_tasks FROM anon, authenticated/, "browserからの直接書込を閉じる");
assert.match(route, /requireMember\(\)/, "APIはログインメンバーを要求する");
assert.match(route, /existing\.member_id !== viewer\.memberId/, "他人のタスク更新を拒否する");
assert.match(route, /future week rollover is not allowed/, "将来週への早期繰越を拒否する");
assert.match(candidateMigration, /member_weekly_tasks_candidate_once_idx/, "候補の二重追加をDB制約で防ぐ");
assert.match(candidateMigration, /'action_item'/, "候補を採用したタスクの出所を残す");
assert.match(route, /\.eq\("review_status", "confirmed"\)/, "未確認の要対応を候補にしない");
assert.match(route, /\.eq\("assignee_member_id", memberId\)/, "本人担当だけを候補にする");
assert.match(route, /\.in\("status", \["open", "in_progress"\]\)/, "完了済み要対応を候補にしない");
assert.match(route, /accept-candidate/, "候補は明示追加のAPI経路でだけ正本へ入る");
assert.match(page, /source_kinds/, "source_fusion ではなく根拠種類を表示する");
assert.match(page, /void writeTask/, "手動追加と完了操作は保存完了を待たずに表示する");

console.log("member weekly tasks checks passed");
