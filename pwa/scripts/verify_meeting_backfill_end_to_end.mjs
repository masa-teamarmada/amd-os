#!/usr/bin/env node
/**
 * 意図的に抽出窓を外した会議が、台帳に載り、再試行され、後から埋まることを通しで確かめる。
 *
 *   npm run verify:meeting-backfill                     # localhost:3000 に対して
 *   E2E_BASE_URL=https://amd-os-pwa.vercel.app npm run verify:meeting-backfill
 *
 * 合成の会議を1件作って通し、最後に必ず消す。既存データには触らない。
 * 実DBへ書くので deploy gate には入れない。仕組みを変えたときに手で走らせる。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(new URL(import.meta.url));
const { createClient } = require("@supabase/supabase-js");

const PWA_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
for (const f of [path.join(PWA_ROOT, ".env.local")]) {
  for (const raw of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const EVENT_ID = "e2e-window-miss-20260903";
const START = new Date(Date.now() - 10 * 86400000).toISOString(); // 10日前 = 抽出窓のはるか外
const SP = fs.mkdtempSync(path.join(os.tmpdir(), "meeting-backfill-e2e-"));
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";

const gate = () => {
  try {
    execFileSync("node", ["scripts/h1_background_candidate_gate.mjs", "--output", `${SP}/e2e_gate.json`, "--notion-metadata-state", `${SP}/e2e_state.json`],
      { cwd: PWA_ROOT, stdio: "pipe" });
  } catch (error) {
    // exit 10 = 候補ありの正常終了。それ以外だけを失敗として扱う。
    if (error.status !== 10) throw error;
  }
  return JSON.parse(fs.readFileSync(`${SP}/e2e_gate.json`, "utf8"));
};
const ledger = async () => (await db.from("meeting_minutes_backfill_ledger").select("*").eq("calendar_event_id", EVENT_ID).maybeSingle()).data;
const say = (step, msg) => process.stdout.write(`  ${step}. ${msg}\n`);

async function cleanup() {
  await db.from("project_meeting_summaries").delete().in("meeting_id", [`upcoming:${EVENT_ID}`, EVENT_ID]);
  await db.from("meeting_minutes_backfill_ledger").delete().eq("calendar_event_id", EVENT_ID);
}

const narrative = [
  "## 🎯背景", "この会議は仕組みの検証のために作った合成データである。" + "検証用の本文をここに置く。".repeat(20), "",
  "## 📊経緯", "抽出窓を外した会議が台帳に載り、後から埋まるかを確かめる。" + "経緯の本文をここに置く。".repeat(20), "",
  "## ✅決まったこと", "- 検証用の項目", "",
  "## ▶️次の一手", "- 検証後に削除する", "",
  "## ⚠️残課題", "- なし", "",
].join("\n");

try {
  process.stdout.write("\n=== 抽出窓を外した会議が後から埋まるかの通し確認 ===\n\n");
  await cleanup();

  say(1, "10日前の予定カードだけを作る（確定版の議事録は無い状態）");
  const { error: insErr } = await db.from("project_meeting_summaries").insert({
    meeting_id: `upcoming:${EVENT_ID}`, calendar_event_id: EVENT_ID, project_id: "p21",
    ym: START.slice(0, 7).replace("-", ""), meeting_date: START.slice(0, 10), meeting_start_at: START,
    title: "【検証用】抽出窓を外した会議", source_kinds: "upcoming", summary_short: "検証用",
    decided: [], progress: [], next_actions: [], risks: [], gmail_thread_ids: [],
    generated_at: new Date().toISOString(),
  });
  if (insErr) throw insErr;

  say(2, "定期確認を1回走らせる");
  const g1 = gate();
  const row1 = await ledger();
  const emitted1 = g1.candidates.backlog.some((c) => c.calendar_event_id === EVENT_ID);
  say("", `→ 台帳: ${row1 ? `${row1.status} / 試行${row1.attempt_count}回` : "載っていない"} / 候補に出た: ${emitted1 ? "はい" : "いいえ"}`);
  if (!row1 || row1.status !== "pending") throw new Error("台帳に pending として載らなかった");

  say(3, "もう1回走らせる（議事録はまだ無いまま）");
  gate();
  const row2 = await ledger();
  say("", `→ 台帳: ${row2.status} / 試行${row2.attempt_count}回 / 最後の結果: ${row2.last_outcome}`);
  if (row2.attempt_count !== 1) throw new Error(`失敗が次の実行に渡っていない (試行${row2.attempt_count}回)`);

  say(4, "正規手順で議事録を埋める（まず確認だけ）");
  const secret = process.env.WORKFLOW_SECRET || process.env.CRON_SECRET;
  const payload = {
    calendar_event_id: EVENT_ID, project_id: "p21", title: "【検証用】抽出窓を外した会議",
    meeting_start_at: START, source_kinds: "notion+calendar", summary_short: "検証用の議事録",
    narrative_md: narrative, decided: ["検証用の項目"], progress: [], next_actions: [], risks: [],
    generated_by_model: "e2e-verification",
  };
  const dry = await (await fetch(`${BASE}/api/meeting-summary/backfill`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ ...payload, dry_run: true }),
  })).json();
  say("", `→ 確認のみ: ${dry.ok ? "通った" : `失敗 ${dry.error}`}`);
  if (!dry.ok) throw new Error(`dry run が通らない: ${dry.error}`);

  say(5, "品質の低い議事録は弾かれることを確認");
  const bad = await (await fetch(`${BASE}/api/meeting-summary/backfill`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ ...payload, narrative_md: "短い議事録", dry_run: true }),
  })).json();
  say("", `→ ${bad.ok ? "素通りした（問題）" : `弾かれた: ${bad.error}`}`);
  if (bad.ok) throw new Error("品質gateが効いていない");

  say(6, "本当に埋める");
  const applied = await (await fetch(`${BASE}/api/meeting-summary/backfill`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ ...payload, dry_run: false }),
  })).json();
  say("", `→ ${applied.ok ? `入った (${applied.meeting.meeting_id})、台帳を閉じた: ${applied.ledger_closed}` : `失敗 ${applied.error}`}`);
  if (!applied.ok) throw new Error(`書き込みが失敗: ${applied.error}`);

  say(7, "予定カードが消えていないことを確認");
  const { data: still } = await db.from("project_meeting_summaries").select("meeting_id").eq("meeting_id", `upcoming:${EVENT_ID}`).maybeSingle();
  say("", `→ 予定カード: ${still ? "残っている" : "消えた（問題）"}`);
  if (!still) throw new Error("予定カードが消えた");

  say(8, "もう1回走らせて、台帳が閉じたままか確認");
  gate();
  const row3 = await ledger();
  say("", `→ 台帳: ${row3.status} / 候補に出る: ${JSON.parse(fs.readFileSync(`${SP}/e2e_gate.json`, "utf8")).candidates.backlog.some((c) => c.calendar_event_id === EVENT_ID) ? "はい（問題）" : "いいえ"}`);
  if (row3.status !== "recovered") throw new Error(`台帳が閉じていない: ${row3.status}`);

  process.stdout.write("\n通し確認: すべて期待どおり\n\n");
} finally {
  await cleanup();
  process.stdout.write("合成データは削除した\n");
}
