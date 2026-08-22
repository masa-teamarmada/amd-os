#!/usr/bin/env node
// SPS 2.0 SX v0.5 — G_self(12m) 到達シミュレーション（最終較正版）
// まさの大前提（2026-08-07）「締切を遅らせれば成功確率は上がるが、資金がショートする場合はそうではない」を反映:
//   - 前段（設立まで）: まさのSeed 70%は2027-04の資金の崖込みのため、時計分布を廃止し
//     63%（技術0.90×PoC 0.80×Seed 0.875）で2027-04-01設立、37%で終了、の一点へ（二重カウント解消）
//   - 後段: 確率は時間無制限の到達確率。時計はPERT。本当の締切は資金の崖（cash_out）が作る
//   - 計画期限H_v超過はPJの死ではなく「計画未達」の分類

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const input = JSON.parse(fs.readFileSync(path.join(here, "sps-2-0-sx-inputs-v0.5.json"), "utf8"));

function hashSeed(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normal(r) { const u1 = Math.max(r(), Number.EPSILON); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * r()); }
function gamma(shape, r) {
  if (shape < 1) return gamma(shape + 1, r) * Math.pow(Math.max(r(), Number.EPSILON), 1 / shape);
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x, v;
    do { x = normal(r); v = 1 + c * x; } while (v <= 0);
    v **= 3;
    const u = r();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x ** 2 + d * (1 - v + Math.log(v))) return d * v;
  }
}
function betaSample(a, b, r) { const x = gamma(a, r), y = gamma(b, r); return x / (x + y); }
function samplePert([a, m, b], r, scale = 1) {
  if (a === b) return a * scale;
  const alpha = 1 + (4 * (m - a)) / (b - a), betaShape = 1 + (4 * (b - m)) / (b - a);
  return (a + betaSample(alpha, betaShape, r) * (b - a)) * scale;
}
function quantile(s, p) { const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo); }
function summarize(values) {
  const f = values.filter(Number.isFinite).sort((a, b) => a - b);
  return { n: f.length, p05: quantile(f, 0.05), median: quantile(f, 0.5), p95: quantile(f, 0.95) };
}
function wilson(successes, runs, z = 1.96) {
  const p = successes / runs, den = 1 + z ** 2 / runs;
  const c = (p + z ** 2 / (2 * runs)) / den;
  const h = (z * Math.sqrt((p * (1 - p) + z ** 2 / (4 * runs)) / runs)) / den;
  return { low: Math.max(0, c - h), high: Math.min(1, c + h) };
}
function roundDeep(v) {
  if (typeof v === "number") return Number(v.toFixed(4));
  if (Array.isArray(v)) return v.map(roundDeep);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, n]) => [k, roundDeep(n)]));
  return v;
}
const clip = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// まさ累積: 設立まで63%、P1 50%、P2 30%、P3 25%（後段は時間無制限）
const CUM = { founded: 0.63, p1: 0.5, p2: 0.3, p3: 0.25 };

function probs(delta) {
  const c = {};
  for (const [k, v] of Object.entries(CUM)) c[k] = clip(v + delta, 0.02, 0.99);
  c.p1 = Math.min(c.p1, c.founded);
  c.p2 = Math.min(c.p2, c.p1);
  c.p3 = Math.min(c.p3, c.p2);
  return {
    pFound: c.founded,
    pP1: clip(c.p1 / c.founded, 0, 1),
    pP2: clip(c.p2 / c.p1, 0, 1),
    pP3: clip(c.p3 / c.p2, 0, 1),
  };
}

const T = Object.fromEntries(input.post_nodes.map((n) => [n.id, n.time_months]));
const cash = input.cash_model;
const pre = input.pre_founding;

function runCase(cs) {
  const runs = input.runs;
  const rng = mulberry32(hashSeed(`${input.seed_text}::${cs.id}`));
  const p = probs(cs.prob_delta_cumulative ?? 0);
  const scale = cs.time_scale ?? 1.0;
  const burnScale = cs.burn_scale ?? 1.0;
  const deadline = input.deadline_months_from_cutoff + (cs.deadline_delta_months ?? 0);
  const techShare = pre.tech_stop_share / (pre.tech_stop_share + pre.business_stop_share);

  const counts = { success: 0, tech_stop: 0, pre_founding_stop: 0, p1_stop: 0, cash_out_p1: 0, p2_stop: 0, cash_out_p2: 0, p3_stop: 0, cash_out_p3: 0, plan_deadline_missed: 0 };
  const tcSuccess = [], tcAllClear = [];

  for (let i = 0; i < runs; i += 1) {
    if (!(rng() < p.pFound)) {
      if (rng() < techShare) counts.tech_stop += 1;
      else counts.pre_founding_stop += 1;
      continue;
    }
    const tF = pre.founding_time_months;

    if (!(rng() < p.pP1)) { counts.p1_stop += 1; continue; }
    const dP1 = samplePert(T.P1, rng, scale);
    const burn1 = samplePert(cash.phase1_net_burn_myen_per_month, rng, burnScale);
    if (burn1 * dP1 > cash.phase1_initial_cash_myen) { counts.cash_out_p1 += 1; continue; }
    const rem1 = cash.phase1_initial_cash_myen - burn1 * dP1;
    const tP1 = tF + dP1;

    if (!(rng() < p.pP2)) { counts.p2_stop += 1; continue; }
    const dP2 = samplePert(T.P2, rng, scale);
    const burn2 = samplePert(cash.phase2_net_burn_myen_per_month, rng, burnScale);
    const cash2 = rem1 + cash.phase2_cash_in_myen;
    if (burn2 * dP2 > cash2) { counts.cash_out_p2 += 1; continue; }
    const rem2 = cash2 - burn2 * dP2;
    const tP2 = tP1 + dP2;

    if (!(rng() < p.pP3)) { counts.p3_stop += 1; continue; }
    const dP3 = samplePert(T.P3, rng, scale);
    const burn3 = samplePert(cash.phase3_net_burn_myen_per_month, rng, burnScale);
    if (burn3 * dP3 > rem2) { counts.cash_out_p3 += 1; continue; }
    const tC = tP2 + dP3;

    tcAllClear.push(tC);
    if (tC <= deadline) { counts.success += 1; tcSuccess.push(tC); }
    else counts.plan_deadline_missed += 1;
  }

  return {
    case: cs.id, label: cs.label, deadline_months: deadline,
    q: counts.success / runs,
    q_wilson95: wilson(counts.success, runs),
    reach_rate_ignoring_plan_deadline: tcAllClear.length / runs,
    failure_breakdown_share: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / runs])),
    t_c_success_months: summarize(tcSuccess),
    t_c_all_clear_months: summarize(tcAllClear),
  };
}

const results = {
  version: "sps-2.0-sx-results-v0.5",
  model_version: input.model_version,
  information_cutoff: input.information_cutoff,
  runs: input.runs,
  masa_cumulative_reference: CUM,
  cases: input.sensitivity_cases.map(runCase),
};
const outPath = path.join(here, "sps-2-0-sx-results-v0.5.json");
fs.writeFileSync(outPath, JSON.stringify(roundDeep(results), null, 2));
console.log("saved:", outPath);
