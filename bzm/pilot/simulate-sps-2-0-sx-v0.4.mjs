#!/usr/bin/env node
// SPS 2.0 SX v0.3 — G_self(12m) 到達の経路シミュレーション＋資金繰り
// v0.2 との差分（事前登録 11 章）:
//   1. Seedハードカット: 設立（=Seed着金）が期限（基準 2027-04末 = 8.8か月）を超えたら経路死亡
//      （まさ 2026-08-07「4月に調達できなかったらPJ終了」）
//   2. フェーズ別資金繰り: Phase 1 現金1.5億・Phase 2 現金6億+残額を純燃焼レートで消費し、枯渇で経路死亡
//   3. Series A以降の成立確率の遅延劣化は欠測のため入れない（遅延の帰結は資金繰りのみで表現）
// ノードの確率・所要時間は v0.2 入力票と同一。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const inputV3 = JSON.parse(fs.readFileSync(path.join(here, "sps-2-0-sx-inputs-v0.4.json"), "utf8"));
const inputV2 = inputV3; // v0.4はノードを自身のJSONに持つ


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
  if (shape < 1) {
    return gamma(shape + 1, random) * Math.pow(Math.max(random(), Number.EPSILON), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x;
    let v;
    do {
      x = normal(random);
      v = 1 + c * x;
    } while (v <= 0);
    v **= 3;
    const u = random();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x ** 2 + d * (1 - v + Math.log(v))) return d * v;
  }
}

function betaSample(alpha, betaShape, random) {
  const x = gamma(alpha, random);
  const y = gamma(betaShape, random);
  return x / (x + y);
}

function samplePert([a, m, b], random, scale = 1) {
  if (a === b) return a * scale;
  const lambda = 4;
  const alpha = 1 + (lambda * (m - a)) / (b - a);
  const betaShape = 1 + (lambda * (b - m)) / (b - a);
  return (a + betaSample(alpha, betaShape, random) * (b - a)) * scale;
}

function quantile(sorted, p) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function summarize(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  return {
    n: finite.length,
    p05: quantile(finite, 0.05),
    median: quantile(finite, 0.5),
    p95: quantile(finite, 0.95),
    mean: finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null,
  };
}

function wilsonInterval(successes, runs, z = 1.96) {
  const p = successes / runs;
  const denominator = 1 + z ** 2 / runs;
  const center = (p + z ** 2 / (2 * runs)) / denominator;
  const halfWidth = (z * Math.sqrt((p * (1 - p) + z ** 2 / (4 * runs)) / runs)) / denominator;
  return { low: Math.max(0, center - halfWidth), high: Math.min(1, center + halfWidth) };
}

function roundDeep(value) {
  if (typeof value === "number") return Number(value.toFixed(4));
  if (Array.isArray(value)) return value.map(roundDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, roundDeep(nested)]));
  }
  return value;
}

const clip = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const BASE_CUMULATIVE = { tech: 0.9, b1: 0.8, b2: 0.7, p1: 0.5, p2: 0.3, p3: 0.25 };

function conditionalProbs(delta) {
  const c = {};
  for (const [key, value] of Object.entries(BASE_CUMULATIVE)) c[key] = clip(value + delta, 0.02, 0.99);
  c.b2 = Math.min(c.b2, c.b1);
  const founded = c.tech * c.b2;
  c.p1 = Math.min(c.p1, founded);
  c.p2 = Math.min(c.p2, c.p1);
  c.p3 = Math.min(c.p3, c.p2);
  return {
    pT1: c.tech,
    pB1: c.b1,
    pB2: clip(c.b2 / c.b1, 0, 1),
    pP1: clip(c.p1 / founded, 0, 1),
    pP2: clip(c.p2 / c.p1, 0, 1),
    pP3: clip(c.p3 / c.p2, 0, 1),
  };
}

const nodeTime = Object.fromEntries(inputV2.nodes.map((node) => [node.id, node.time_months]));
const cash = inputV3.cash_model;

function runCase(caseSpec) {
  const runs = inputV3.runs;
  const rng = mulberry32(hashSeed(`${inputV3.seed_text}::${caseSpec.id}`));
  const probs = conditionalProbs(caseSpec.prob_delta_cumulative ?? 0);
  const scale = caseSpec.time_scale ?? 1.0;
  const burnScale = caseSpec.burn_scale ?? 1.0;
  const deadline = inputV3.deadline_months_from_cutoff + (caseSpec.deadline_delta_months ?? 0);
  const seedDeadline = caseSpec.seed_deadline_months;

  const counts = {
    success: 0,
    tech_stop: 0,
    poc_stop: 0,
    seed_stop: 0,
    seed_timing_stop: 0,
    cash_out_p1: 0,
    cash_out_p2: 0,
    cash_out_p3: 0,
    p1_stop: 0,
    p2_stop: 0,
    p3_stop: 0,
    deadline_exceeded: 0,
  };
  const tcSuccess = [];
  const tcAllClear = [];
  const tFounded = [];
  let foundedInTime = 0;
  let trl5IncompleteAtFunding = 0;

  for (let i = 0; i < runs; i += 1) {
    const okT1 = rng() < probs.pT1;
    const dT1 = samplePert(nodeTime.T1, rng, scale);
    const okB1 = rng() < probs.pB1;
    const dB1 = samplePert(nodeTime.B1, rng, scale);
    if (!okT1 || !okB1) {
      if (!okT1) counts.tech_stop += 1;
      else counts.poc_stop += 1;
      continue;
    }
    const tTech = dT1 + samplePert(nodeTime.T2, rng, scale);
    const okB2 = rng() < probs.pB2;
    const dB2 = samplePert(nodeTime.B2, rng, scale);
    if (!okB2) {
      counts.seed_stop += 1;
      continue;
    }
    const tBiz = dB1 + dB2;
    // v0.4: 設立ゲートは事業レーンのみ（TRL5は前提でない。未達ならvaluation低下＝欠測扱いでフラグ記録のみ）
    const tF = tBiz + samplePert(nodeTime.G, rng, scale);

    // Seedハードカット: 設立=Seed着金が期限を超えたらPJ終了（まさ 2026-08-07）
    if (tF > seedDeadline) {
      counts.seed_timing_stop += 1;
      continue;
    }
    foundedInTime += 1;
    tFounded.push(tF);
    if (tTech > tF) trl5IncompleteAtFunding += 1;

    // Phase 1: 現金1.5億、純燃焼レートとの競争
    if (!(rng() < probs.pP1)) {
      counts.p1_stop += 1;
      continue;
    }
    const dP1 = samplePert(nodeTime.P1, rng, scale);
    const burn1 = samplePert(cash.phase1_net_burn_myen_per_month, rng, burnScale);
    const spent1 = burn1 * dP1;
    if (spent1 > cash.phase1_initial_cash_myen) {
      counts.cash_out_p1 += 1;
      continue;
    }
    const rem1 = cash.phase1_initial_cash_myen - spent1;
    const tP1 = tF + dP1;

    // Phase 2: Series A 6億円着金＋前残
    if (!(rng() < probs.pP2)) {
      counts.p2_stop += 1;
      continue;
    }
    const dP2 = samplePert(nodeTime.P2, rng, scale);
    const burn2 = samplePert(cash.phase2_net_burn_myen_per_month, rng, burnScale);
    const spent2 = burn2 * dP2;
    const cash2 = rem1 + cash.phase2_cash_in_myen;
    if (spent2 > cash2) {
      counts.cash_out_p2 += 1;
      continue;
    }
    const rem2 = cash2 - spent2;
    const tP2 = tP1 + dP2;

    // P3: 営業黒字化までの残走
    if (!(rng() < probs.pP3)) {
      counts.p3_stop += 1;
      continue;
    }
    const dP3 = samplePert(nodeTime.P3, rng, scale);
    const burn3 = samplePert(cash.phase3_net_burn_myen_per_month, rng, burnScale);
    if (burn3 * dP3 > rem2) {
      counts.cash_out_p3 += 1;
      continue;
    }
    const tC = tP2 + dP3;

    tcAllClear.push(tC);
    if (tC <= deadline) {
      counts.success += 1;
      tcSuccess.push(tC);
    } else {
      counts.deadline_exceeded += 1;
    }
  }

  return {
    case: caseSpec.id,
    label: caseSpec.label,
    deadline_months: deadline,
    seed_deadline_months: seedDeadline,
    q: counts.success / runs,
    q_wilson95: wilsonInterval(counts.success, runs),
    founded_in_time_rate: foundedInTime / runs,
    trl5_incomplete_at_funding_share_of_founded: foundedInTime ? trl5IncompleteAtFunding / foundedInTime : null,
    masa_seed_cumulative_reference: 0.7,
    all_clear_rate: tcAllClear.length / runs,
    failure_breakdown_share: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / runs])),
    t_c_success_months: summarize(tcSuccess),
    t_c_all_clear_months: summarize(tcAllClear),
    t_founded_months: summarize(tFounded),
  };
}

const results = {
  version: "sps-2.0-sx-results-v0.4",
  model_version: inputV3.model_version,
  information_cutoff: inputV3.information_cutoff,
  runs: inputV3.runs,
  masa_cumulative_reference: BASE_CUMULATIVE,
  cases: inputV3.sensitivity_cases.map(runCase),
};

const outPath = path.join(here, "sps-2.0-sx-results-v0.4.json");
fs.writeFileSync(outPath, JSON.stringify(roundDeep(results), null, 2));
console.log(JSON.stringify(roundDeep(results.cases.find((c) => c.case === "base")), null, 2));
console.log(`\nsaved: ${outPath}`);
