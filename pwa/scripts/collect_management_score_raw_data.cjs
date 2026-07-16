#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const tsModuleCache = new Map();

function resolveTsModule(request, fromPath) {
  if (!request.startsWith("@/") && !request.startsWith(".")) return null;
  const base = request.startsWith("@/")
    ? path.join(process.cwd(), "src", request.slice(2))
    : path.resolve(path.dirname(fromPath), request);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function loadTsModule(sourcePath) {
  const absPath = path.isAbsolute(sourcePath) ? sourcePath : path.join(process.cwd(), sourcePath);
  const cached = tsModuleCache.get(absPath);
  if (cached) return cached.exports;
  const source = fs.readFileSync(absPath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  tsModuleCache.set(absPath, mod);
  const localRequire = (request) => {
    const resolvedTs = resolveTsModule(request, absPath);
    if (resolvedTs) return loadTsModule(resolvedTs);
    return require(request);
  };
  new Function("require", "module", "exports", output)(localRequire, mod, mod.exports);
  return mod.exports;
}

function loadCollector() {
  return loadTsModule("src/lib/management-score/raw-data.ts");
}

function argValue(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function replaceEnvValue(filePath, key, value) {
  if (!value || !fs.existsSync(filePath)) return false;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  let changed = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      if (line !== `${key}=${value}`) changed = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (changed) fs.writeFileSync(filePath, next.join("\n").replace(/\n*$/, "\n"));
  return changed;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");

  const { collectManagementScoreRawData } = loadCollector();
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const beforeFreeeRefreshToken = process.env.FREEE_REFRESH_TOKEN;
  const result = await collectManagementScoreRawData(supabase, {
    ym: argValue("ym"),
    includeFreee: process.argv.includes("--include-freee"),
    freeeStartDate: argValue("start-date"),
    freeeEndDate: argValue("end-date"),
  });
  if (process.env.FREEE_REFRESH_TOKEN && process.env.FREEE_REFRESH_TOKEN !== beforeFreeeRefreshToken) {
    for (const name of [".env.local", ".env.production.local"]) {
      replaceEnvValue(path.join(process.cwd(), name), "FREEE_REFRESH_TOKEN", process.env.FREEE_REFRESH_TOKEN);
    }
    result.freeeRefreshTokenUpdated = true;
  }
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "failed") process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
