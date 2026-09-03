#!/usr/bin/env node
/**
 * 議事録欠損台帳の契約検査。DBにも外部サービスにも触らない deterministic test。
 *
 *   npm run test:meeting-backfill-ledger
 *
 * 落とすべきもの:
 *   1. 抽出窓 (終了60-180分) を外した会議が候補にならない
 *   2. 24時間より古い欠損が対象から外れる
 *   3. 予定カードしか無い (確定版の行が1行も無い) 会議が救済対象に入らない
 *   4. 候補として出したのに確定版ができなかった事実が、次のrunの入力にならない
 *   5. 何度試しても取れない会議が pending のまま無限に再試行される
 *   6. 確定版ができたのに台帳が pending のまま残る
 */
import process from "node:process";
import { planLedgerReconciliation } from "./lib/meeting_backfill_ledger.mjs";

const NOW = new Date("2026-09-03T12:00:00Z");
const failures = [];

function check(name, condition, detail) {
  if (condition) return;
  failures.push(`${name}${detail ? `: ${detail}` : ""}`);
}

function upcoming(id, startAt, projectId = "p21", title = "定例MTG") {
  return { meeting_id: `upcoming:${id}`, calendar_event_id: id, project_id: projectId, title, meeting_start_at: startAt, source_kinds: "upcoming" };
}

function confirmed(id, startAt, projectId = "p21", title = "定例MTG") {
  return { meeting_id: id, calendar_event_id: id, project_id: projectId, title, meeting_start_at: startAt, source_kinds: "notion+calendar" };
}

function ledger(id, patch = {}) {
  return {
    calendar_event_id: id,
    project_id: "p21",
    title: "定例MTG",
    meeting_start_at: "2026-08-19T07:00:00Z",
    status: "pending",
    attempt_count: 0,
    max_attempts: 5,
    last_emitted_at: null,
    last_attempt_at: null,
    ...patch,
  };
}

// 1. 抽出窓を大きく外した会議 (15日前) が候補になる。24時間の壁が無いこと。
{
  const plan = planLedgerReconciliation({
    now: NOW,
    summaryRows: [upcoming("ev-old", "2026-08-19T07:00:00Z")],
    ledgerRows: [],
  });
  check("窓外15日前の会議を検出する", plan.inserts.length === 1, `inserts=${plan.inserts.length}`);
  check("窓外15日前の会議を候補として出す", plan.emits.some((e) => e.calendar_event_id === "ev-old"));
}

// 2. 確定版の行が1行も無い会議でも対象になる (旧救済レーンは既存行が必要だった)。
{
  const plan = planLedgerReconciliation({
    now: NOW,
    summaryRows: [upcoming("ev-norow", "2026-08-20T04:00:00Z")],
    ledgerRows: [],
  });
  check("確定版の行が無い会議を救済対象にする", plan.emits.some((e) => e.calendar_event_id === "ev-norow"));
}

// 3. まだ開催前 / 終了直後の会議は対象にしない。
{
  const soon = new Date(NOW.getTime() - 10 * 60 * 1000).toISOString();
  const future = new Date(NOW.getTime() + 3 * 60 * 60 * 1000).toISOString();
  const plan = planLedgerReconciliation({
    now: NOW,
    summaryRows: [upcoming("ev-soon", soon), upcoming("ev-future", future)],
    ledgerRows: [],
  });
  check("開催直後(60分未満)は対象にしない", !plan.emits.some((e) => e.calendar_event_id === "ev-soon"));
  check("開催前は対象にしない", !plan.emits.some((e) => e.calendar_event_id === "ev-future"));
}

// 4. 候補として出したのに確定版ができなかった -> 次のrunで試行回数が増える。
{
  const plan = planLedgerReconciliation({
    now: NOW,
    summaryRows: [upcoming("ev-fail", "2026-08-19T07:00:00Z")],
    ledgerRows: [ledger("ev-fail", { last_emitted_at: "2026-09-03T11:00:00Z", attempt_count: 0 })],
  });
  const update = plan.updates.find((u) => u.calendar_event_id === "ev-fail");
  check("失敗が次のrunの入力になる", update?.attempt_count === 1, `update=${JSON.stringify(update)}`);
  check("失敗しても再試行は続く", plan.emits.some((e) => e.calendar_event_id === "ev-fail"));
}

// 5. 同じrun内で二重に数えない (出しただけで試行済みにしない)。
{
  const plan = planLedgerReconciliation({
    now: NOW,
    summaryRows: [upcoming("ev-once", "2026-08-19T07:00:00Z")],
    ledgerRows: [ledger("ev-once", { last_emitted_at: "2026-09-03T11:00:00Z", last_attempt_at: "2026-09-03T11:30:00Z", attempt_count: 1 })],
  });
  const update = plan.updates.find((u) => u.calendar_event_id === "ev-once");
  check("消化済みの試行を二重に数えない", update === undefined, `update=${JSON.stringify(update)}`);
}

// 6. 上限まで試したら諦め、まさの画面へ出す状態にする。
{
  const plan = planLedgerReconciliation({
    now: NOW,
    summaryRows: [upcoming("ev-giveup", "2026-08-19T07:00:00Z")],
    ledgerRows: [ledger("ev-giveup", { attempt_count: 4, max_attempts: 5, last_emitted_at: "2026-09-03T11:00:00Z" })],
  });
  const update = plan.updates.find((u) => u.calendar_event_id === "ev-giveup");
  check("上限で諦める", update?.status === "abandoned", `update=${JSON.stringify(update)}`);
  check("諦めた会議は再試行しない", !plan.emits.some((e) => e.calendar_event_id === "ev-giveup"));
}

// 7. 確定版ができたら台帳を閉じる。手動backfillでも閉じること。
{
  const plan = planLedgerReconciliation({
    now: NOW,
    summaryRows: [upcoming("ev-done", "2026-08-19T07:00:00Z"), confirmed("ev-done", "2026-08-19T07:00:00Z")],
    ledgerRows: [ledger("ev-done", { attempt_count: 2 })],
  });
  const update = plan.updates.find((u) => u.calendar_event_id === "ev-done");
  check("確定版ができたら閉じる", update?.status === "recovered", `update=${JSON.stringify(update)}`);
  check("閉じた会議は候補にしない", !plan.emits.some((e) => e.calendar_event_id === "ev-done"));
}

// 8. 同じ会議が別のCalendar idで複数の予定カードを持つとき、確定版が1つあれば全部閉じる。
//    LiSTie経営会議が id違いで3枚の予定カードを持っていた実例に対応する。
{
  const start = "2026-08-19T02:00:00Z";
  const plan = planLedgerReconciliation({
    now: NOW,
    summaryRows: [
      upcoming("ev-dup-1", start, "p07", "【web】LiSTie経営会議"),
      upcoming("ev-dup-2", start, "p07", "【web】LiSTie経営会議"),
      confirmed("ev-dup-1", start, "p07", "【web】LiSTie経営会議"),
    ],
    ledgerRows: [ledger("ev-dup-2", { project_id: "p07", meeting_start_at: start, title: "【web】LiSTie経営会議" })],
  });
  const update = plan.updates.find((u) => u.calendar_event_id === "ev-dup-2");
  check("同じ会議の別idも確定版があれば閉じる", update?.status === "recovered", `update=${JSON.stringify(update)}`);
  check("重複idを新規に積み増さない", plan.inserts.length === 0, `inserts=${JSON.stringify(plan.inserts)}`);
}

// 9. 1回のrunで出す候補数に上限がある (毎時runを長時間化させない)。
{
  const rows = [];
  for (let i = 0; i < 20; i += 1) rows.push(upcoming(`ev-many-${i}`, "2026-08-19T07:00:00Z"));
  const plan = planLedgerReconciliation({ now: NOW, summaryRows: rows, ledgerRows: [], emitLimit: 3 });
  check("1runの候補数に上限がある", plan.emits.length === 3, `emits=${plan.emits.length}`);
  check("上限を超えた分も台帳には残る", plan.inserts.length === 20, `inserts=${plan.inserts.length}`);
}

// 10. 試行の少ないものを先に出す (古い失敗が新しい欠損を締め出さない)。
{
  const plan = planLedgerReconciliation({
    now: NOW,
    summaryRows: [upcoming("ev-tried", "2026-09-01T07:00:00Z"), upcoming("ev-fresh", "2026-08-25T07:00:00Z")],
    ledgerRows: [ledger("ev-tried", { attempt_count: 3, meeting_start_at: "2026-09-01T07:00:00Z" })],
    emitLimit: 1,
  });
  check("試行の少ない会議を先に出す", plan.emits[0]?.calendar_event_id === "ev-fresh", `first=${plan.emits[0]?.calendar_event_id}`);
}

if (failures.length) {
  process.stderr.write(`議事録欠損台帳の契約検査に失敗しました (${failures.length}件)\n`);
  for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
  process.exit(1);
}
process.stdout.write("meeting backfill ledger contract: 10 checks passed\n");
