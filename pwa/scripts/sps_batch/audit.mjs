#!/usr/bin/env node
// 使い方:
//   node scripts/sps_batch/audit.mjs --since 2026-08-22T06:00 --list
//   node scripts/sps_batch/audit.mjs --since 2026-08-22T06:00 --index 7
//   node scripts/sps_batch/audit.mjs --seed <uuid>
// 反映済み(applied)の初回SPS評価を 1 件ずつ読み返すための閲覧専用ツール。書き込みはしない。
// --index は --since で絞った集合を created_at 昇順に並べたときの位置。
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const env = {};
for (const f of ["pwa/.env.production.local", "pwa/.env.local", ".env.production.local", ".env.local"]) {
  const fp = path.join(ROOT, f);
  if (!fs.existsSync(fp)) continue;
  for (const line of fs.readFileSync(fp, "utf8").split(/\r?\n/)) {
    const at = line.indexOf("=");
    if (at > 0 && !line.trim().startsWith("#")) env[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, "");
  }
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const a = {};
for (let i = 2; i < process.argv.length; i += 1) {
  const x = process.argv[i];
  if (!x.startsWith("--")) continue;
  a[x.slice(2)] = !process.argv[i + 1] || process.argv[i + 1].startsWith("--") ? true : process.argv[++i];
}

const COLS = "seed_id,created_at,created_by,stage_lower,stage_upper,stage_tag,q_lower_pct,q_upper_pct,p_lower_yen,p_upper_yen,sps_lower_yen,sps_upper_yen,q_main_factor,p_class,q_evidence,notes,proposal_summary,source_facts";
let q = sb.from("sps_initial_assessment_candidates").select(COLS)
  .eq("assessment_ruleset_version", "rubric-v1.1+ind-v1").eq("status", "applied")
  .order("created_at", { ascending: true }).order("seed_id", { ascending: true });
if (a.seed) q = q.eq("seed_id", a.seed);
if (a.since) q = q.gte("created_at", a.since);
if (a.until) q = q.lt("created_at", a.until);
const { data, error } = await q;
if (error) throw new Error(error.message);

const OKU = 1e8;
const oku = (v) => (Number(v) / OKU).toString();

if (a.list) {
  console.log("count:", data.length);
  data.forEach((r, i) => {
    const s = r.source_facts?.seed ?? {};
    console.log(String(i).padStart(3), r.seed_id.slice(0, 8), "|", r.stage_lower + "-" + r.stage_upper,
      "| q", r.q_lower_pct + "-" + r.q_upper_pct + "%", "| P", oku(r.p_lower_yen) + "-" + oku(r.p_upper_yen) + "億",
      "|", String(s.org_name ?? "").slice(0, 20).padEnd(20), "|", String(s.title ?? "").slice(0, 44));
  });
  process.exit(0);
}

const rows = a.index !== undefined && a.index !== true ? [data[Number(a.index)]] : data;
for (const r of rows) {
  if (!r) { console.log("no row"); continue; }
  const f = r.source_facts ?? {};
  const s = f.seed ?? {};
  console.log("SEED_ID", r.seed_id, "| created_at", r.created_at, "| by", r.created_by);
  console.log("-- 元データ --");
  console.log("org:", s.org_name, "| lane:", s.domain_lane, "| status:", s.status, "| trl/brl/hrl:", s.trl, s.brl, s.hrl);
  console.log("title:", s.title);
  console.log("summary:", String(s.summary ?? "").slice(0, 900));
  console.log("keywords:", JSON.stringify(s.keywords), "| industry:", JSON.stringify(s.industry_target));
  for (const k of ["funding", "news", "projects"]) {
    const v = f[k] ?? [];
    if (v.length) console.log(k + ":", JSON.stringify(v).slice(0, 700));
  }
  console.log("-- 評価 --");
  console.log("stage:", r.stage_lower + "-" + r.stage_upper, "| tag:", r.stage_tag);
  console.log("q:", r.q_lower_pct + "-" + r.q_upper_pct + "%", "| P:", oku(r.p_lower_yen) + "-" + oku(r.p_upper_yen) + "億",
    "| SPS:", oku(r.sps_lower_yen) + "-" + oku(r.sps_upper_yen) + "億");
  console.log("q_main_factor:", r.q_main_factor);
  console.log("p_class:", r.p_class);
  console.log("proposal_summary:", r.proposal_summary);
  console.log("notes:", r.notes);
  (r.q_evidence ?? []).forEach((x, i) => {
    console.log(` ${String(i + 1).padStart(2)} ${x.id} [${x.direction}] ${x.evidence}${x.assessment ? " / " + x.assessment : ""}`);
  });
  console.log("");
}
