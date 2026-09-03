#!/usr/bin/env node
/**
 * 議事録の欠損が残っていないかを実データで確かめる検査。
 *
 *   npm run check:meeting-minutes-coverage
 *   npm run check:meeting-minutes-coverage -- --stale-days 21
 *
 * 落ちる条件:
 *   1. 上限まで試して取れなかった会議 (`abandoned`) がある
 *   2. 拾い直し中のまま `--stale-days` (既定14日) を超えた会議がある
 *
 * これは実データを見る運用検査であり、deploy gate ではない。deploy gate に置くと
 * 「会議の議事録が無い」という運用の話でコードのdeployが止まってしまう。仕組みが
 * 壊れていないかの検査は npm run test:meeting-backfill-ledger と
 * npm run test:meeting-narrative-gate で、こちらが deploy.sh に入っている。
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const PWA_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const REPO_ROOT = path.resolve(PWA_ROOT, "..");

loadEnv(path.join(PWA_ROOT, ".env.local"));
loadEnv(path.join(PWA_ROOT, ".env.production.local"));
loadEnv(path.join(REPO_ROOT, ".vercel", ".env.production.local"));

const args = parseArgs(process.argv.slice(2));
const STALE_DAYS = Number(args["stale-days"] ?? 14);

async function main() {
  const rows = args.fixture
    ? JSON.parse(fs.readFileSync(path.resolve(String(args.fixture)), "utf8"))
    : await readLedger();

  const now = Date.now();
  const abandoned = rows.filter((r) => r.status === "abandoned");
  const stale = rows.filter((r) => (
    r.status === "pending"
    && Number.isFinite(Date.parse(r.meeting_start_at))
    && now - Date.parse(r.meeting_start_at) > STALE_DAYS * 86400000
  ));
  const pending = rows.filter((r) => r.status === "pending");

  process.stdout.write(`議事録の抜け: 拾い直し中${pending.length}件 / 諦めた${abandoned.length}件 / ${STALE_DAYS}日超え${stale.length}件\n`);

  const problems = [...abandoned, ...stale.filter((r) => !abandoned.includes(r))];
  if (!problems.length) {
    process.stdout.write("未処理の抜けはありません\n");
    return;
  }

  process.stderr.write(`\n手当てが必要な会議が${problems.length}件あります。\n`);
  for (const row of problems) {
    const days = Math.floor((now - Date.parse(row.meeting_start_at)) / 86400000);
    const label = row.status === "abandoned" ? "諦めた" : `${days}日放置`;
    process.stderr.write(`  - ${jst(row.meeting_start_at)} ${row.project_id ?? "PJ未解決"} ${row.title} (${label}、拾い直し${row.attempt_count}回)\n`);
  }
  process.stderr.write("\n埋め方: npm run meeting:backfill-minutes -- --file <minutes.json> --apply\n");
  process.stderr.write("対象外にする場合は台帳の status を ignored / no_material にする\n");
  process.exit(1);
}

async function readLedger() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env が無い");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db
    .from("meeting_minutes_backfill_ledger")
    .select("calendar_event_id,project_id,title,meeting_start_at,status,attempt_count")
    .in("status", ["pending", "abandoned"])
    .limit(1000);
  if (error) throw error;
  return data ?? [];
}

function jst(iso) {
  try {
    return new Date(iso).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo", year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) result[key] = true;
    else {
      result[key] = value;
      index += 1;
    }
  }
  return result;
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

main().catch((error) => {
  process.stderr.write(`coverage check failed: ${String(error?.message || error)}\n`);
  process.exit(1);
});
