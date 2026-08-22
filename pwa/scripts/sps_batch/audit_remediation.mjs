#!/usr/bin/env node
// 使い方: node scripts/sps_batch/audit_remediation.mjs [--since 2026-08-22T17:40]
// 是正ラウンド（意味づけ欠落の直し）で追記された band を構造監査する。読み取り専用。
// 見るもの: 端点の再計算一致 / 11因子の順序と欠落 / 意味づけの充足と長さ / 署名 /
//           意味づけ一行の使い回し / 11因子が丸ごと一致する組 / 段階と帯の分布。
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

const ORDER = ["unit_economics","capital_intensity","scale_constraint","reproducibility","payer_budget",
  "customer_validation_cost","regulatory_gate","alternative_advantage","social_acceptance","microtrend_fit","patent_position"];

// 是正で入った候補 → その band を引く
const cand = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("sps_initial_assessment_candidates")
    .select("id,seed_id,supersedes_assessment_id,status,created_at")
    .eq("status", "applied").not("supersedes_assessment_id", "is", null)
    .order("created_at").range(from, from + 999);
  if (error) throw new Error(error.message);
  cand.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const since = a.since && a.since !== true ? new Date(String(a.since)) : null;
const targets = cand.filter((c) => !since || new Date(c.created_at) >= since);
const ids = targets.map((c) => c.id);

const bands = [];
for (let i = 0; i < ids.length; i += 200) {
  const { data, error } = await sb.from("seed_screening_bands")
    .select("id,seed_id,assessed_at,stage_lower,stage_upper,stage_tag,q_lower_pct,q_upper_pct,p_lower_yen,p_upper_yen,sps_lower_yen,sps_upper_yen,q_evidence,notes,p_class,q_main_factor,source_initial_candidate_id")
    .in("source_initial_candidate_id", ids.slice(i, i + 200));
  if (error) throw new Error(error.message);
  bands.push(...(data ?? []));
}

const bad = { 端点不一致: [], 因子欠落: [], 順序崩れ: [], 意味づけ空: [], 意味づけ短: [], 署名欠落: [], 英字混入: [] };
const seen = new Map(); // assessment 一行 → 使われた回数
const sig = new Map();  // 11因子の意味づけを連結したもの → seed_id[]
const qs = [], ps = [], stages = new Map();

for (const b of bands) {
  const ev = Array.isArray(b.q_evidence) ? b.q_evidence : [];
  const rl = Math.floor(Number(b.p_lower_yen) * Number(b.q_lower_pct) / 100 + 0.5);
  const ru = Math.floor(Number(b.p_upper_yen) * Number(b.q_upper_pct) / 100 + 0.5);
  if (rl !== Number(b.sps_lower_yen) || ru !== Number(b.sps_upper_yen)) bad.端点不一致.push(b.seed_id);
  if (ev.length !== 11) bad.因子欠落.push(`${b.seed_id}(${ev.length})`);
  else if (ev.map((x) => x.id).join(",") !== ORDER.join(",")) bad.順序崩れ.push(b.seed_id);
  const texts = [];
  for (const x of ev) {
    const t = String(x?.assessment ?? "").trim();
    if (!t) { bad.意味づけ空.push(`${b.seed_id}/${x?.id}`); continue; }
    if (t.length < 6) bad.意味づけ短.push(`${b.seed_id}/${x?.id}:${t}`);
    if (/[A-Za-z]{3,}/.test(t)) bad.英字混入.push(`${b.seed_id}/${x?.id}`);
    texts.push(t);
    seen.set(t, (seen.get(t) ?? 0) + 1);
  }
  if (!String(b.notes ?? "").includes("評価者: えいみ")) bad.署名欠落.push(b.seed_id);
  const k = texts.join("|");
  if (texts.length === 11) sig.set(k, [...(sig.get(k) ?? []), b.seed_id]);
  qs.push([Number(b.q_lower_pct), Number(b.q_upper_pct)]);
  ps.push([Number(b.p_lower_yen) / 1e8, Number(b.p_upper_yen) / 1e8]);
  const st = `${b.stage_lower}-${b.stage_upper}`;
  stages.set(st, (stages.get(st) ?? 0) + 1);
}

const dupSig = [...sig.entries()].filter(([, v]) => v.length > 1);
const reuse = [...seen.entries()].filter(([, n]) => n >= 5).sort((x, y) => y[1] - x[1]).slice(0, 15);
const med = (xs) => { const s = [...xs].sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : null; };

console.log(JSON.stringify({
  対象候補: targets.length, "引けたband": bands.length,
  異常: Object.fromEntries(Object.entries(bad).map(([k, v]) => [k, { 件数: v.length, 例: v.slice(0, 5) }])),
  意味づけが丸ごと一致する組: dupSig.length,
  使い回された意味づけ上位: reuse.map(([t, n]) => `${n}回 ${t}`),
  意味づけの異なり数: seen.size,
  q下限中央値: med(qs.map((x) => x[0])), q上限中央値: med(qs.map((x) => x[1])),
  P下限中央値億: med(ps.map((x) => x[0])), P上限中央値億: med(ps.map((x) => x[1])),
  段階: Object.fromEntries(stages),
}, null, 1));
