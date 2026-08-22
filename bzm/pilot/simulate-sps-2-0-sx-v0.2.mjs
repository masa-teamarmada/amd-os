#!/usr/bin/env node
// SPS 2.0 SX v0.2 — G_self(12m) 到達の経路シミュレーション
// 入力: sps-2-0-sx-inputs-v0.2.json（凍結 2026-08-07）
// 構造: 最終成功確率 + PERT所要時間の直列・並行ネットワーク。
//       再試行3分岐と独立余力4成分は使わない（事前登録 5.5 の簡素化）。
// 乱数・PERT・集計ユーティリティは v0.1 simulate-sps-2-0-pilot.mjs から流用。
// 感度ケースはケースIDごとの固定シード（PERT棄却サンプリングの消費数が可変のため、厳密な共通乱数は保証しない）。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const inputPath = process.argv[2] ?? path.join(here, "sps-2-0-sx-inputs-v0.2.json");
const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));

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

// まさの累積到達確率（hearing 2026-08-07）。感度デルタはここへ適用し、条件付きへ再較正する。
const BASE_CUMULATIVE = { tech: 0.90, b1: 0.80, b2: 0.70, p1: 0.50, p2: 0.30, p3: 0.25 };

function conditionalProbs(delta) {
  const c = {};
  for (const [key, value] of Object.entries(BASE_CUMULATIVE)) c[key] = clip(value + delta, 0.02, 0.99);
  // 単調性を保証（下流の累積が上流を超えない）
  c.b2 = Math.min(c.b2, c.b1);
  const founded = c.tech * c.b2;
  c.p1 = Math.min(c.p1, founded);
  c.p2 = Math.min(c.p2, c.p1);
  c.p3 = Math.min(c.p3, c.p2);
  return {
    pT1: c.tech,
    pT2: 1.0,
    pB1: c.b1,
    pB2: clip(c.b2 / c.b1, 0, 1),
    pG: 1.0,
    pP1: clip(c.p1 / founded, 0, 1),
    pP2: clip(c.p2 / c.p1, 0, 1),
    pP3: clip(c.p3 / c.p2, 0, 1),
    cumulative: c,
  };
}

const nodeTime = Object.fromEntries(input.nodes.map((node) => [node.id, node.time_months]));

function runCase(caseSpec) {
  const runs = input.runs;
  const rng = mulberry32(hashSeed(`${input.seed_text}::${caseSpec.id}`));
  const probs = conditionalProbs(caseSpec.prob_delta_cumulative ?? 0);
  const scale = caseSpec.time_scale ?? 1.0;
  const deadline = input.deadline_months_from_cutoff + (caseSpec.deadline_delta_months ?? 0);
  const bridgeLimit = caseSpec.bridge_constraint ? input.psi_end_months_from_cutoff + caseSpec.bridge_gap_limit_months : null;

  const counts = {
    success: 0,
    tech_stop: 0,
    poc_stop: 0,
    seed_stop: 0,
    bridge_stop: 0,
    p1_stop: 0,
    p2_stop: 0,
    p3_stop: 0,
    deadline_exceeded: 0,
  };
  let parallelDoubleStop = 0;
  const tcSuccess = [];
  const tcAllClear = [];
  const tFounded = [];

  for (let i = 0; i < runs; i += 1) {
    // 全ノードの判定・時間を順にサンプル（stopでも下流時間は引かず、経路を打ち切る）
    const okT1 = rng() < probs.pT1;
    const dT1 = samplePert(nodeTime.T1, rng, scale);
    const okB1 = rng() < probs.pB1;
    const dB1 = samplePert(nodeTime.B1, rng, scale);

    if (!okT1 || !okB1) {
      if (!okT1 && !okB1) parallelDoubleStop += 1;
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
    if (bridgeLimit !== null && tBiz > bridgeLimit) {
      counts.bridge_stop += 1;
      continue;
    }

    const tGate = Math.max(tTech, tBiz);
    const tF = tGate + samplePert(nodeTime.G, rng, scale);
    tFounded.push(tF);

    if (!(rng() < probs.pP1)) {
      counts.p1_stop += 1;
      continue;
    }
    const tP1 = tF + samplePert(nodeTime.P1, rng, scale);
    if (!(rng() < probs.pP2)) {
      counts.p2_stop += 1;
      continue;
    }
    const tP2 = tP1 + samplePert(nodeTime.P2, rng, scale);
    if (!(rng() < probs.pP3)) {
      counts.p3_stop += 1;
      continue;
    }
    const tC = tP2 + samplePert(nodeTime.P3, rng, scale);

    tcAllClear.push(tC);
    if (tC <= deadline) {
      counts.success += 1;
      tcSuccess.push(tC);
    } else {
      counts.deadline_exceeded += 1;
    }
  }

  const q = counts.success / runs;
  const allClearRate = tcAllClear.length / runs;
  return {
    case: caseSpec.id,
    label: caseSpec.label,
    deadline_months: deadline,
    conditional_probs: {
      T1: probs.pT1, T2: probs.pT2, B1: probs.pB1, B2: probs.pB2, G: probs.pG,
      P1: probs.pP1, P2: probs.pP2, P3: probs.pP3,
    },
    q,
    q_wilson95: wilsonInterval(counts.success, runs),
    all_clear_rate_ignoring_deadline: allClearRate,
    deadline_hit_rate_among_all_clear: tcAllClear.length ? counts.success / tcAllClear.length : null,
    failure_breakdown_share: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / runs])),
    parallel_double_stop_share: parallelDoubleStop / runs,
    t_c_success_months: summarize(tcSuccess),
    t_c_all_clear_months: summarize(tcAllClear),
    t_founded_months: summarize(tFounded),
  };
}

const results = {
  version: "sps-2.0-sx-results-v0.2",
  model_version: input.model_version,
  input_file: path.basename(inputPath),
  information_cutoff: input.information_cutoff,
  runs: input.runs,
  masa_cumulative_reference: BASE_CUMULATIVE,
  cases: input.sensitivity_cases.map(runCase),
};

const outPath = path.join(here, "sps-2-0-sx-results-v0.2.json");
fs.writeFileSync(outPath, JSON.stringify(roundDeep(results), null, 2));
console.log(JSON.stringify(roundDeep(results.cases.find((c) => c.case === "base")), null, 2));
console.log(`\nsaved: ${outPath}`);
