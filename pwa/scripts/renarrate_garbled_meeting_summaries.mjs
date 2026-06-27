#!/usr/bin/env node
/**
 * Re-narrate garbled (LANG=C ASCII '?' replaced) project_meeting_summaries rows.
 *
 * 背景:
 *   Codex L6 meeting-flow の macbook_fallback / 手動 curl 経路で、shell 環境の
 *   LANG=C により日本語が ASCII '?' に置換されたまま Supabase REST に POST される
 *   事故が複数回起きた。提案 narrative_md / summary_short / decided / progress
 *   / next_actions / risks が `???????` だらけになるが、source_kinds は 'gmail'
 *   / 'calendar+drive+gmail' 等の正常値のため、L6 の「24h 以内 + source='none'」
 *   再評価対象から外れ、自動では直らない。
 *
 * 使い方:
 *   1) 化け検出だけ:
 *      node pwa/scripts/renarrate_garbled_meeting_summaries.mjs --scan
 *
 *   2) 化けた row を「再生成対象」にして L6 再評価を待つ:
 *      node pwa/scripts/renarrate_garbled_meeting_summaries.mjs \
 *        --meeting-id <meeting_id> --reset-for-l6
 *
 *      narrative_md / summary_short / 4 配列をクリアし、source_hash を NULL に
 *      する。`source_kinds='none'` には変えない (元データ自体は健在のため)。
 *      L6 H-1 が次回 run で source_hash mismatch 検知 → 再 narrate。
 *
 *   3) 手動で本物の narrative を流し込む:
 *      node pwa/scripts/renarrate_garbled_meeting_summaries.mjs \
 *        --meeting-id <meeting_id> --payload <path/to/payload.json>
 *
 *      payload.json は以下の形:
 *      {
 *        "title": "...",
 *        "summary_short": "...",
 *        "narrative_md": "## 🎯背景\n...\n## 📊経緯\n...\n## ✅決まったこと\n...\n## ▶️次の一手\n...\n## ⚠️残課題\n...",
 *        "decided": ["..."],
 *        "progress": ["..."],
 *        "next_actions": ["..."],
 *        "risks": ["..."]
 *      }
 *
 *      `generated_by_model` には `manual-garbled-recovery-<YYYY-MM-DD>` を入れる。
 *      `source_hash` はクリアしない (人間が直したのを L6 が再生成で上書きしない
 *      よう、`pms_preserve_rich_narrative` trigger に任せる)。
 *
 * 仕様参照: pwa/spec/3-3-meeting-flow-current-spec.md / pwa/design/meeting_summaries.md
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
loadEnv(path.join(ROOT, ".env.local"));
loadEnv(path.join(ROOT, ".env.production.local"));

const SUPABASE_URL = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function mustEnv(key) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required`);
  return value.trim();
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

/**
 * 「化け」検出: ascii '?' の連続が一定割合を超えていれば garbled とみなす。
 * 通常の日本語議事録には '?' は0〜数個しか出ない (= 末尾の疑問文程度)。
 * '????' のような4連以上 + 全体に占める '?' の割合 > 5% を閾値にする。
 */
function isGarbled(text) {
  if (!text || typeof text !== "string") return false;
  if (text.length < 10) return false;
  const questionRuns = text.match(/\?{4,}/g) || [];
  if (questionRuns.length === 0) return false;
  const questionChars = (text.match(/\?/g) || []).length;
  return questionChars / text.length > 0.05;
}

function rowIsGarbled(row) {
  const fields = [row.title, row.summary_short, row.narrative_md];
  if (fields.some(isGarbled)) return true;
  const arrays = [row.decided, row.progress, row.next_actions, row.risks];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    if (arr.some((s) => typeof s === "string" && isGarbled(s))) return true;
  }
  return false;
}

async function sb(method, pathQuery, body) {
  const url = `${SUPABASE_URL}/rest/v1/${pathQuery}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${pathQuery} -> ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function scanAll() {
  const rows = await sb(
    "GET",
    "project_meeting_summaries?select=meeting_id,project_id,meeting_date,title,summary_short,narrative_md,decided,progress,next_actions,risks,source_kinds,generated_by_model,updated_at&order=meeting_date.desc&limit=2000",
  );
  const garbled = rows.filter(rowIsGarbled);
  return { total: rows.length, garbled };
}

async function fetchOne(meetingId) {
  const rows = await sb(
    "GET",
    `project_meeting_summaries?select=*&meeting_id=eq.${encodeURIComponent(meetingId)}`,
  );
  return rows[0] || null;
}

async function resetForL6(meetingId) {
  const today = new Date().toISOString().slice(0, 10);
  const patch = {
    summary_short: "",
    narrative_md: null,
    decided: [],
    progress: [],
    next_actions: [],
    risks: [],
    source_hash: null,
    generated_by_model: `manual-garbled-reset-${today}`,
    updated_at: new Date().toISOString(),
  };
  const result = await sb(
    "PATCH",
    `project_meeting_summaries?meeting_id=eq.${encodeURIComponent(meetingId)}`,
    patch,
  );
  return result;
}

async function applyPayload(meetingId, payload) {
  const today = new Date().toISOString().slice(0, 10);
  const allowedKeys = [
    "title",
    "summary_short",
    "narrative_md",
    "decided",
    "progress",
    "next_actions",
    "risks",
  ];
  const patch = {};
  for (const key of allowedKeys) {
    if (key in payload) patch[key] = payload[key];
  }
  if (!patch.narrative_md || typeof patch.narrative_md !== "string" || patch.narrative_md.length < 200) {
    throw new Error("narrative_md must be a string of >= 200 chars (議事録本文として薄すぎる)");
  }
  const required = ["## 🎯背景", "## 📊経緯", "## ✅決まったこと", "## ▶️次の一手", "## ⚠️残課題"];
  for (const heading of required) {
    if (!patch.narrative_md.includes(heading)) {
      throw new Error(`narrative_md must include heading: ${heading}`);
    }
  }
  patch.generated_by_model = `manual-garbled-recovery-${today}`;
  patch.updated_at = new Date().toISOString();
  return sb(
    "PATCH",
    `project_meeting_summaries?meeting_id=eq.${encodeURIComponent(meetingId)}`,
    patch,
  );
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.scan) {
    const { total, garbled } = await scanAll();
    console.log(`Scanned ${total} rows. Garbled candidates: ${garbled.length}`);
    for (const row of garbled) {
      console.log(
        `  ${row.meeting_id}\t${row.project_id}\t${row.meeting_date}\t${row.source_kinds}\t${(row.title || "").slice(0, 40)}`,
      );
    }
    return;
  }

  if (!args["meeting-id"]) {
    console.error(
      "usage:\n  --scan\n  --meeting-id <id> --reset-for-l6\n  --meeting-id <id> --payload <path>",
    );
    process.exit(1);
  }

  const meetingId = args["meeting-id"];
  const row = await fetchOne(meetingId);
  if (!row) {
    console.error(`meeting_id ${meetingId} not found`);
    process.exit(1);
  }

  console.log(`Target: ${row.project_id} / ${row.meeting_date} / ${(row.title || "").slice(0, 40)}`);
  console.log(`  garbled = ${rowIsGarbled(row)}`);

  if (args["reset-for-l6"]) {
    const updated = await resetForL6(meetingId);
    console.log("reset for L6 re-evaluation done:", updated);
    return;
  }

  if (args.payload) {
    const payloadPath = path.resolve(process.cwd(), args.payload);
    if (!fs.existsSync(payloadPath)) {
      console.error(`payload file not found: ${payloadPath}`);
      process.exit(1);
    }
    const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
    const updated = await applyPayload(meetingId, payload);
    console.log("manual payload applied:", updated);
    return;
  }

  console.error("must pass --reset-for-l6 or --payload <path>");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
