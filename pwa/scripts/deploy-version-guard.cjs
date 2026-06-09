#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const BUILD_INFO_PATH = "pwa/src/lib/build-info.ts";

function parseArgs(argv) {
  const args = {
    appUrl: "https://amd-os-pwa.vercel.app",
    minVersion: process.env.AMD_OS_DEPLOY_MIN_BUILD_VERSION || "v0.16.20",
    repoRoot: path.resolve(__dirname, "../.."),
    target: "production",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--app-url") args.appUrl = argv[++i];
    else if (arg === "--min-version") args.minVersion = argv[++i];
    else if (arg === "--repo-root") args.repoRoot = path.resolve(argv[++i]);
    else if (arg === "--target") args.target = argv[++i];
    else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node pwa/scripts/deploy-version-guard.cjs [--target production|preview]

Stops production deploys when local BUILD_VERSION is older than:
  - the current production BUILD_VERSION, if /api/build-info or HTML version is available
  - the maximum BUILD_VERSION found on local/origin git refs
  - the configured minimum deploy version

Preview deploys only warn, because they do not move the production alias.`);
}

function parseVersion(version) {
  if (typeof version !== "string" || version.trim() === "") return null;
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) return null;
  return {
    raw: version.trim().startsWith("v") ? version.trim() : `v${version.trim()}`,
    parts: match.slice(1, 4).map((part) => Number(part)),
  };
}

function compareVersions(a, b) {
  const left = typeof a === "string" ? parseVersion(a) : a;
  const right = typeof b === "string" ? parseVersion(b) : b;
  if (!left || !right) throw new Error(`Cannot compare versions: ${a} / ${b}`);
  for (let i = 0; i < 3; i += 1) {
    if (left.parts[i] > right.parts[i]) return 1;
    if (left.parts[i] < right.parts[i]) return -1;
  }
  return 0;
}

function extractBuildVersion(content) {
  const match = content.match(/BUILD_VERSION\s*=\s*["']([^"']+)["']/);
  return match ? match[1] : null;
}

function execGit(repoRoot, args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function readLocalBuildVersion(repoRoot) {
  const fullPath = path.join(repoRoot, BUILD_INFO_PATH);
  return extractBuildVersion(fs.readFileSync(fullPath, "utf8"));
}

function readKnownRefVersions(repoRoot) {
  const refs = execGit(repoRoot, [
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads",
    "refs/remotes/origin",
  ])
    .split("\n")
    .map((ref) => ref.trim())
    .filter((ref) => ref && ref !== "origin/HEAD");
  const versions = [];
  for (const ref of refs) {
    try {
      const content = execGit(repoRoot, ["show", `${ref}:${BUILD_INFO_PATH}`]);
      const version = extractBuildVersion(content);
      if (version) versions.push({ ref, version });
    } catch {
      // Some refs may predate the PWA build-info file. They do not contribute
      // to the max-version guard.
    }
  }
  return versions;
}

function maxRefVersion(refVersions) {
  let max = null;
  for (const entry of refVersions) {
    const parsed = parseVersion(entry.version);
    if (!parsed) continue;
    if (!max || compareVersions(parsed, max.parsed) > 0) {
      max = { ...entry, parsed };
    }
  }
  return max;
}

async function fetchText(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function readProductionVersion(appUrl) {
  const root = appUrl.replace(/\/+$/, "");
  try {
    const api = await fetchText(`${root}/api/build-info`);
    if (api.ok) {
      const data = JSON.parse(api.text);
      if (typeof data.build_version === "string") {
        return { ok: true, source: "/api/build-info", version: data.build_version };
      }
    }
    const html = await fetchText(root);
    const match = html.text.match(/\bv\d+\.\d+\.\d+\b/);
    if (html.ok && match) {
      return { ok: true, source: "html", version: match[0] };
    }
    return {
      ok: false,
      source: "/api/build-info",
      message: `production version unavailable (api status ${api.status}, html status ${html.status})`,
    };
  } catch (error) {
    return {
      ok: false,
      source: "/api/build-info",
      message: `production version fetch failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function evaluateGuard(input) {
  const target = input.target || "production";
  const failures = [];
  const warnings = [];
  const local = parseVersion(input.localVersion);
  const refMax = input.refMaxVersion ? parseVersion(input.refMaxVersion) : null;
  const production = input.productionVersion ? parseVersion(input.productionVersion) : null;
  const minimum = input.minVersion ? parseVersion(input.minVersion) : null;

  if (!local) {
    failures.push(`local BUILD_VERSION is invalid: ${input.localVersion || "(missing)"}`);
    return { ok: false, failures, warnings };
  }

  const isProduction = target === "production";
  const addProblem = isProduction ? failures : warnings;

  if (input.refScanOk === false) {
    addProblem.push("known git ref BUILD_VERSION scan failed");
  }
  if (minimum && compareVersions(local, minimum) < 0) {
    addProblem.push(`local BUILD_VERSION ${local.raw} is older than deploy minimum ${minimum.raw}`);
  }
  if (refMax && compareVersions(local, refMax) < 0) {
    addProblem.push(
      `local BUILD_VERSION ${local.raw} is older than known ref max ${refMax.raw} (${input.refMaxRef || "unknown ref"})`
    );
  }
  if (production && compareVersions(local, production) < 0) {
    addProblem.push(`local BUILD_VERSION ${local.raw} is older than production ${production.raw}`);
  }
  if (input.productionReadOk === false) {
    warnings.push(input.productionReadMessage || "production BUILD_VERSION could not be confirmed");
  }
  if (!isProduction && warnings.length > 0) {
    warnings.push("preview deploy is not hard-stopped because it does not move the production alias");
  }

  return { ok: failures.length === 0, failures, warnings };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = args.target === "preview" ? "preview" : "production";
  let refScanOk = true;
  let refVersions = [];
  try {
    refVersions = readKnownRefVersions(args.repoRoot);
  } catch (error) {
    refScanOk = false;
    console.error(`WARN: known git ref scan failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const localVersion = readLocalBuildVersion(args.repoRoot);
  const refMax = maxRefVersion(refVersions);
  const productionInfo =
    target === "production"
      ? await readProductionVersion(args.appUrl)
      : { ok: true, version: null, source: "skipped" };

  console.log("Deploy version guard");
  console.log(`  target: ${target}`);
  console.log(`  local BUILD_VERSION: ${localVersion || "missing"}`);
  console.log(`  deploy minimum: ${args.minVersion || "disabled"}`);
  console.log(`  known ref max: ${refMax ? `${refMax.parsed.raw} (${refMax.ref})` : "unavailable"}`);
  if (target === "production") {
    console.log(
      `  production BUILD_VERSION: ${
        productionInfo.ok && productionInfo.version
          ? `${productionInfo.version} (${productionInfo.source})`
          : "unavailable"
      }`
    );
  }

  const result = evaluateGuard({
    target,
    localVersion,
    minVersion: args.minVersion,
    refMaxVersion: refMax?.version || null,
    refMaxRef: refMax?.ref || null,
    refScanOk,
    productionVersion: productionInfo.ok ? productionInfo.version : null,
    productionReadOk: productionInfo.ok,
    productionReadMessage: productionInfo.message,
  });

  for (const warning of result.warnings) {
    console.log(`WARN: ${warning}`);
  }
  if (!result.ok) {
    console.error("Production deploy blocked by BUILD_VERSION rollback guard.");
    for (const failure of result.failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log("Deploy version guard passed.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

module.exports = {
  compareVersions,
  evaluateGuard,
  extractBuildVersion,
  maxRefVersion,
  parseVersion,
};
