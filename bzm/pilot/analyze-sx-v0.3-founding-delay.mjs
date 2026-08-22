#!/usr/bin/env node
// v0.3 分解分析: なぜ「設立・Seed着金が2027-04末（8.8か月）に間に合う」経路が2.9%しかないのか
// まさの質問（2026-08-07）「12月DD完了→1〜3月交渉・投資委→4月着金は普通に可能では。どうして無理だと試算しているのか」への回答用。
// 確率判定は全て成功とし（=DD・投資判断は通る前提）、時計だけを分析する。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const inputV2 = JSON.parse(fs.readFileSync(path.join(here, "sps-2-0-sx-inputs-v0.2.json"), "utf8"));

function hashSeed(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
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
function normal(random) {
  const u1 = Math.max(random(), Number.EPSILON);
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function gamma(shape, random) {
  if (shape < 1) return gamma(shape + 1, random) * Math.pow(Math.max(random(), Number.EPSILON), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x, v;
    do { x = normal(random); v = 1 + c * x; } while (v <= 0);
    v **= 3;
    const u = random();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x ** 2 + d * (1 - v + Math.log(v))) return d * v;
  }
}
function betaSample(a, b, random) {
  const x = gamma(a, random);
  const y = gamma(b, random);
  return x / (x + y);
}
function samplePert([a, m, b], random) {
  if (a === b) return a;
  const alpha = 1 + (4 * (m - a)) / (b - a);
  const betaShape = 1 + (4 * (b - m)) / (b - a);
  return a + betaSample(alpha, betaShape, random) * (b - a);
}
function quantile(sorted, p) {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
function dist(values) {
  const s = [...values].sort((a, b) => a - b);
  return { p20: quantile(s, 0.2), median: quantile(s, 0.5), p80: quantile(s, 0.8) };
}

const T = Object.fromEntries(inputV2.nodes.map((n) => [n.id, n.time_months]));
const SEED_DEADLINE = 8.8;
const RUNS = 20000;

// counterfactualケース: 時間入力・構造をどう変えると期限内設立率がどう動くか
const CASES = [
  { id: "base", label: "現行入力（v0.2/v0.3凍結値）", mod: {} },
  { id: "cf_g_fast", label: "設立手続きを[0.5,1.5,3]へ短縮（NewCo並行進行済み）", mod: { G: [0.5, 1.5, 3] } },
  { id: "cf_pess_tight", label: "悲観幅を圧縮（T1:8→4, T2:7→5, B1:10→6.5, B2:5→3）", mod: { T1: [1.5, 2.5, 4], T2: [2.5, 3.5, 5], B1: [3.5, 4.7, 6.5], B2: [0.5, 1.5, 3] } },
  { id: "cf_tech_off_gate", label: "TRL5を設立ゲートの前提から外す（技術は並行、設立は事業レーンのみ）", mod: {}, techOffGate: true },
  { id: "cf_g_fast_pess_tight", label: "設立短縮＋悲観圧縮の併用", mod: { G: [0.5, 1.5, 3], T1: [1.5, 2.5, 4], T2: [2.5, 3.5, 5], B1: [3.5, 4.7, 6.5], B2: [0.5, 1.5, 3] } },
  { id: "cf_all", label: "全部併用（設立短縮＋悲観圧縮＋技術を前提から外す）", mod: { G: [0.5, 1.5, 3], T1: [1.5, 2.5, 4], T2: [2.5, 3.5, 5], B1: [3.5, 4.7, 6.5], B2: [0.5, 1.5, 3] }, techOffGate: true },
];

const out = [];
for (const c of CASES) {
  const rng = mulberry32(hashSeed(`sx-decomp::${c.id}`));
  const t = { ...T, ...c.mod };
  const tTechArr = [], tBizArr = [], tFArr = [];
  let inTime = 0, techLimiting = 0, late = 0;
  for (let i = 0; i < RUNS; i += 1) {
    const tTech = samplePert(t.T1, rng) + samplePert(t.T2, rng);
    const tBiz = samplePert(t.B1, rng) + samplePert(t.B2, rng);
    const gate = c.techOffGate ? tBiz : Math.max(tTech, tBiz);
    const tF = gate + samplePert(t.G, rng);
    tTechArr.push(tTech); tBizArr.push(tBiz); tFArr.push(tF);
    if (tF <= SEED_DEADLINE) inTime += 1;
    else { late += 1; if (!c.techOffGate && tTech > tBiz) techLimiting += 1; }
  }
  out.push({
    label: c.label,
    founding_in_time_rate: inTime / RUNS,
    tech_limiting_share_among_late: late ? techLimiting / late : null,
    tTech: dist(tTechArr), tBiz: dist(tBizArr), tF: dist(tFArr),
  });
}

const mo = (m) => {
  const base = new Date(2026, 7, 7);
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + Math.round(m * 30.44));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

console.log(`確率は全経路成功とし、時計だけを分析（${RUNS}本）。期限=8.8か月（2027-04末）\n`);
for (const r of out) {
  console.log(`■ ${r.label}`);
  console.log(`  期限内設立率: ${(r.founding_in_time_rate * 100).toFixed(1)}%`);
  if (r.tech_limiting_share_among_late !== null)
    console.log(`  間に合わない経路のうち技術（TRL5）が律速: ${(r.tech_limiting_share_among_late * 100).toFixed(0)}%`);
  console.log(`  技術完了(TRL5): p20 ${mo(r.tTech.p20)} / 中央 ${mo(r.tTech.median)} / p80 ${mo(r.tTech.p80)}`);
  console.log(`  Seed合意:       p20 ${mo(r.tBiz.p20)} / 中央 ${mo(r.tBiz.median)} / p80 ${mo(r.tBiz.p80)}`);
  console.log(`  設立完了:       p20 ${mo(r.tF.p20)} / 中央 ${mo(r.tF.median)} / p80 ${mo(r.tF.p80)}\n`);
}
