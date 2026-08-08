#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const inputPath = process.argv[2] ?? path.join(here, "sps-2-0-pilot-inputs-v0.1.json");
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

function beta(alpha, betaShape, random) {
  const x = gamma(alpha, random);
  const y = gamma(betaShape, random);
  return x / (x + y);
}

function samplePert([a, m, b], random, scale = 1) {
  if (a === b) return a * scale;
  const lambda = 4;
  const alpha = 1 + lambda * (m - a) / (b - a);
  const betaShape = 1 + lambda * (b - m) / (b - a);
  return (a + beta(alpha, betaShape, random) * (b - a)) * scale;
}

function weightedChoice(branches, random) {
  const total = branches.reduce((sum, branch) => sum + branch.weight, 0);
  let draw = random() * total;
  for (const branch of branches) {
    draw -= branch.weight;
    if (draw <= 0) return branch;
  }
  return branches.at(-1);
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
    p25: quantile(finite, 0.25),
    median: quantile(finite, 0.5),
    p75: quantile(finite, 0.75),
    p95: quantile(finite, 0.95),
    mean: finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null
  };
}

function wilsonInterval(successes, runs, z = 1.96) {
  const p = successes / runs;
  const denominator = 1 + z ** 2 / runs;
  const center = (p + z ** 2 / (2 * runs)) / denominator;
  const halfWidth = z * Math.sqrt((p * (1 - p) + z ** 2 / (4 * runs)) / runs) / denominator;
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

function ancestorSet(project) {
  const byId = new Map(project.milestones.map((milestone) => [milestone.id, milestone]));
  const ancestors = new Set(project.X_star.required_milestones);
  const stack = [...ancestors];
  while (stack.length) {
    const current = byId.get(stack.pop());
    for (const dependency of current?.dependencies ?? []) {
      if (!ancestors.has(dependency)) {
        ancestors.add(dependency);
        stack.push(dependency);
      }
    }
  }
  return ancestors;
}

function simulatePath(project, random, modifiers) {
  const durationScale = modifiers.duration_scale ?? 1;
  const probabilityShift = modifiers.success_probability_shift ?? 0;
  const slackScale = modifiers.slack_scale ?? 1;
  const milestoneById = new Map(project.milestones.map((milestone) => [milestone.id, milestone]));
  const targetAncestors = ancestorSet(project);
  const completion = new Map();
  const failed = new Map();
  const events = [];
  let projectStopTime = Infinity;

  const pending = new Set(project.milestones.map((milestone) => milestone.id));
  while (pending.size) {
    let progressed = false;
    for (const id of [...pending]) {
      const milestone = milestoneById.get(id);
      const dependencyStatesKnown = milestone.dependencies.every((dependency) => completion.has(dependency) || failed.has(dependency));
      if (!dependencyStatesKnown) continue;
      pending.delete(id);
      progressed = true;

      const failedDependency = milestone.dependencies.find((dependency) => failed.has(dependency));
      if (failedDependency) {
        failed.set(id, { reason: `blocked_by:${failedDependency}`, time: failed.get(failedDependency).time });
        continue;
      }

      let start = milestone.dependencies.length
        ? Math.max(...milestone.dependencies.map((dependency) => completion.get(dependency)))
        : 0;
      let probability = Math.min(0.999, Math.max(0.001, milestone.success_probability + probabilityShift));
      let attempt = 0;
      let finished = false;
      while (!finished) {
        const finish = start + samplePert(milestone.pert_months, random, durationScale);
        if (random() < probability) {
          completion.set(id, finish);
          events.push({ time: finish, type: "success", milestone: id, impacts: milestone.success_replenishments ?? {} });
          finished = true;
          continue;
        }

        const branch = weightedChoice(milestone.failure_branches, random);
        events.push({ time: finish, type: `failure:${branch.type}`, milestone: id, impacts: milestone.failure_slack_impacts ?? {} });
        const canContinue = attempt < milestone.max_retries && branch.type !== "stop";
        if (canContinue) {
          const extra = branch.extra_pert_months
            ? samplePert(branch.extra_pert_months, random, durationScale)
            : 0;
          start = finish + extra;
          probability = Math.min(0.999, Math.max(0.001, probability * (branch.success_probability_multiplier ?? 1)));
          attempt += 1;
          continue;
        }

        failed.set(id, { reason: branch.type, time: finish });
        if (branch.type === "stop" && branch.project_stop !== false && !milestone.optional) {
          projectStopTime = Math.min(projectStopTime, finish);
        }
        finished = true;
      }
    }
    if (!progressed) throw new Error(`Dependency cycle or missing milestone in ${project.project_id}: ${[...pending].join(", ")}`);
  }

  const expiries = Object.fromEntries(project.initial_slack.map((slack) => [
    slack.id,
    samplePert(slack.pert_months, random, slackScale)
  ]));
  let ty = Infinity;
  let limitingSlack = null;
  const chronological = events.sort((a, b) => a.time - b.time);
  for (const event of chronological) {
    const nextExpiry = Object.entries(expiries).sort((a, b) => a[1] - b[1])[0];
    if (nextExpiry[1] <= event.time || projectStopTime <= event.time) {
      if (projectStopTime <= nextExpiry[1]) {
        ty = projectStopTime;
        limitingSlack = "project_stop";
      } else {
        ty = nextExpiry[1];
        limitingSlack = nextExpiry[0];
      }
      break;
    }
    for (const [component, delta] of Object.entries(event.impacts)) {
      if (component in expiries) expiries[component] += delta;
    }
    const crossed = Object.entries(expiries).sort((a, b) => a[1] - b[1])[0];
    if (crossed[1] <= event.time) {
      ty = event.time;
      limitingSlack = crossed[0];
      break;
    }
  }
  if (!Number.isFinite(ty)) {
    const nextExpiry = Object.entries(expiries).sort((a, b) => a[1] - b[1])[0];
    if (projectStopTime <= nextExpiry[1]) {
      ty = projectStopTime;
      limitingSlack = "project_stop";
    } else {
      ty = nextExpiry[1];
      limitingSlack = nextExpiry[0];
    }
  }

  const targetsReached = project.X_star.required_milestones.every((id) => completion.has(id));
  const tc = targetsReached
    ? Math.max(...project.X_star.required_milestones.map((id) => completion.get(id)))
    : Infinity;
  const horizonMonths = project.horizon_months + (modifiers.horizon_extension_months ?? 0);
  const success = Number.isFinite(tc) && tc < ty && tc <= horizonMonths;

  let failurePath = "success";
  if (!success) {
    if (!targetsReached) {
      const directFailure = [...failed.entries()]
        .filter(([id]) => targetAncestors.has(id))
        .sort((a, b) => a[1].time - b[1].time)[0];
      failurePath = directFailure ? `milestone:${directFailure[0]}:${directFailure[1].reason}` : "milestone:unresolved";
    } else if (ty <= tc) {
      failurePath = `slack:${limitingSlack}`;
    } else {
      failurePath = "deadline";
    }
  }

  return { success, tc, ty, targetsReached, failurePath };
}

function runScenario(project, scenarioName, modifiers, runs) {
  const random = mulberry32(hashSeed(`${input.model_version}:${project.project_id}`));
  const paths = Array.from({ length: runs }, () => simulatePath(project, random, modifiers));
  const successes = paths.filter((pathResult) => pathResult.success).length;
  const q = successes / runs;
  const failureCounts = new Map();
  for (const pathResult of paths) {
    if (pathResult.success) continue;
    failureCounts.set(pathResult.failurePath, (failureCounts.get(pathResult.failurePath) ?? 0) + 1);
  }
  const failurePaths = [...failureCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([pathName, count]) => ({ path: pathName, count, share_of_all_paths: count / runs, share_of_failures: count / (runs - successes || 1) }));
  const failureCategoryCounts = { milestone: 0, slack: 0, deadline: 0, other: 0 };
  for (const [pathName, count] of failureCounts.entries()) {
    const category = pathName.startsWith("milestone:")
      ? "milestone"
      : pathName.startsWith("slack:")
        ? "slack"
        : pathName === "deadline"
          ? "deadline"
          : "other";
    failureCategoryCounts[category] += count;
  }
  const simulationInterval = wilsonInterval(successes, runs);
  const reached = paths.filter((pathResult) => pathResult.targetsReached).map((pathResult) => pathResult.tc);
  const successfulTc = paths.filter((pathResult) => pathResult.success).map((pathResult) => pathResult.tc);
  const allTy = paths.map((pathResult) => pathResult.ty);
  return {
    scenario: scenarioName,
    modifiers,
    runs,
    successes,
    q,
    simulation_standard_error: Math.sqrt(q * (1 - q) / runs),
    simulation_wilson_95pct_interval: simulationInterval,
    x_star_reached_share_ignoring_deadline_and_slack: reached.length / runs,
    T_C_months_given_x_star_reached: summarize(reached),
    T_C_months_successful_paths: summarize(successfulTc),
    T_Y_months_all_paths: summarize(allTy),
    failure_categories: Object.fromEntries(Object.entries(failureCategoryCounts).map(([category, count]) => [category, {
      count,
      share_of_all_paths: count / runs,
      share_of_failures: count / (runs - successes || 1)
    }])),
    major_failure_paths: failurePaths,
    qP: {
      V_soc_pilot_points: q * project.P.V_soc.base,
      V_econ_JPY_probability_adjusted_proxy: q * project.P.V_econ.base,
      simulation_interval_only: {
        low: {
          V_soc_pilot_points: simulationInterval.low * project.P.V_soc.base,
          V_econ_JPY_probability_adjusted_proxy: simulationInterval.low * project.P.V_econ.base
        },
        high: {
          V_soc_pilot_points: simulationInterval.high * project.P.V_soc.base,
          V_econ_JPY_probability_adjusted_proxy: simulationInterval.high * project.P.V_econ.base
        }
      },
      warning: "uncalibrated q multiplied by provisional P; not a calibrated expected value, valuation, investment decision, or GO rule"
    }
  };
}

const scenarios = {
  base: {},
  duration_minus_25pct: { duration_scale: 0.75 },
  duration_plus_25pct: { duration_scale: 1.25 },
  success_probability_plus_10pp: { success_probability_shift: 0.1 },
  success_probability_minus_10pp: { success_probability_shift: -0.1 },
  initial_slack_plus_25pct: { slack_scale: 1.25 },
  initial_slack_minus_25pct: { slack_scale: 0.75 },
  horizon_plus_3months: { horizon_extension_months: 3 }
};

const results = {
  generated_at: new Date().toISOString(),
  input_file: path.basename(inputPath),
  schema_version: input.schema_version,
  model_version: input.model_version,
  status: input.status,
  seed_rule: "FNV-1a(model_version + project_id) -> mulberry32; common random-number seed across sensitivity scenarios",
  runs_per_project_per_scenario: input.simulation_runs_per_project,
  interpretation_boundary: "Model probability under frozen analyst assumptions. Not empirically calibrated success probability, valuation, investment decision, or automatic GO judgment.",
  projects: input.projects.map((project) => ({
    project_id: project.project_id,
    label: project.label,
    information_cutoff: project.information_cutoff,
    plan_version: project.plan_version,
    model_version: project.model_version,
    horizon_date: project.horizon_date,
    horizon_months: project.horizon_months,
    P: project.P,
    results: Object.entries(scenarios).map(([name, modifiers]) => runScenario(
      project,
      name,
      modifiers,
      input.simulation_runs_per_project
    ))
  }))
};

process.stdout.write(`${JSON.stringify(roundDeep(results), null, 2)}\n`);
