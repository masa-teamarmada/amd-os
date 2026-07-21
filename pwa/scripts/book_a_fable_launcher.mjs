#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  realpath,
  stat,
  writeFile,
} from "node:fs/promises";
import { EOL } from "node:os";
import path from "node:path";
import { finished } from "node:stream/promises";
import { fileURLToPath } from "node:url";

export const BASELINE_COMMIT = "236ca1b5e668df4925e3147debb290ecfbd2080f";
export const MODEL_ALIAS = "fable";
export const REQUIRED_MODEL_ID = "claude-fable-5";
export const MAX_BUDGET_USD = 5;
export const ARTIFACT_KIND = "chapter_narrative_patch";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../..");

// 現行15章だけを許可する。旧book-a-ch-4.md / book-a-ch-5.mdは履歴資料なので対象外。
export const CHAPTER_ALLOWLIST = Object.freeze({
  ch1: "pwa/bzm/book-a-ch-1.md",
  ch2: "pwa/bzm/book-a-ch-2.md",
  ch3: "pwa/bzm/book-a-ch-3.md",
  ch4: "pwa/bzm/book-a-ch-4-5.md",
  ch5: "pwa/bzm/book-a-ch-6.md",
  ch6: "pwa/bzm/book-a-ch-7.md",
  ch7: "pwa/bzm/book-a-ch-8.md",
  ch8: "pwa/bzm/book-a-ch-9.md",
  ch9: "pwa/bzm/book-a-ch-10.md",
  ch10: "pwa/bzm/book-a-ch-11.md",
  ch11: "pwa/bzm/book-a-ch-12.md",
  ch12: "pwa/bzm/book-a-ch-13.md",
  ch13: "pwa/bzm/book-a-ch-13-5.md",
  ch14: "pwa/bzm/book-a-ch-14.md",
  ch15: "pwa/bzm/book-a-ch-15.md",
});

const BASELINE_CONTEXT_PATHS = Object.freeze([
  "pwa/bzm/BOOK_A_SCENARIO_DRAFT_3.md",
  "pwa/bzm/BOOK_A_CHARACTER_BIBLE.md",
  "pwa/bzm/BOOK_A_INDEPENDENT_AGENCY.md",
  "pwa/bzm/BOOK_A_MASTER_PLAN.md",
]);

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function runGit(args, { encoding = "utf8" } = {}) {
  const result = spawnSync("git", args, {
    cwd: REPO_ROOT,
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString("utf8")
      : result.stderr;
    fail(`git ${args.join(" ")} failed: ${(stderr || "unknown error").trim()}`);
  }
  return result.stdout;
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

async function canonicalizeProspectivePath(candidatePath) {
  const absolute = path.resolve(candidatePath);
  let cursor = absolute;
  const suffix = [];
  while (true) {
    try {
      const resolved = await realpath(cursor);
      return path.join(resolved, ...suffix.reverse());
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      suffix.push(path.basename(cursor));
      cursor = parent;
    }
  }
}

async function requireExternalAbsolutePath(label, candidatePath) {
  if (!candidatePath || !path.isAbsolute(candidatePath)) {
    fail(`${label} must be an absolute path`);
  }
  const [repoReal, candidateReal] = await Promise.all([
    realpath(REPO_ROOT),
    canonicalizeProspectivePath(candidatePath),
  ]);
  if (isInside(repoReal, candidateReal)) {
    fail(`${label} must be outside the repository: ${candidateReal}`);
  }
  return candidateReal;
}

function parseArgs(argv) {
  const parsed = {
    chapterId: null,
    promptFile: null,
    jobDir: null,
    dryRun: false,
    execute: false,
  };
  const valueFlags = new Map([
    ["--chapter", "chapterId"],
    ["--prompt-file", "promptFile"],
    ["--job-dir", "jobDir"],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (token === "--execute") {
      parsed.execute = true;
      continue;
    }
    const key = valueFlags.get(token);
    if (!key) fail(`unknown or forbidden argument: ${token}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`${token} requires one value`);
    if (parsed[key] !== null) fail(`${token} may be supplied only once`);
    parsed[key] = value;
    index += 1;
  }

  if (parsed.dryRun === parsed.execute) {
    fail("choose exactly one of --dry-run or --execute");
  }
  if (!parsed.chapterId || !CHAPTER_ALLOWLIST[parsed.chapterId]) {
    fail(`--chapter must be exactly one of: ${Object.keys(CHAPTER_ALLOWLIST).join(", ")}`);
  }
  if (!parsed.promptFile) fail("--prompt-file is required");
  if (!parsed.jobDir) fail("--job-dir is required");
  return parsed;
}

export function buildOutputSchema(chapterId) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["chapter_id", "artifact_kind", "theory_touch", "edits"],
    properties: {
      chapter_id: { const: chapterId },
      artifact_kind: { const: ARTIFACT_KIND },
      theory_touch: { const: false },
      edits: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["target_kind", "locator", "replacement_markdown"],
          properties: {
            target_kind: {
              enum: ["chapter_opening_narrative", "explicit_transition"],
            },
            locator: { type: "string", minLength: 1 },
            replacement_markdown: { type: "string", minLength: 1 },
          },
        },
      },
    },
  };
}

export function buildClaudeArgs({ chapterId, prompt }) {
  const schema = buildOutputSchema(chapterId);
  const guardedPrompt = [
    `対象はBook A ${chapterId}の章頭ナラティブと、依頼文で明示された接続文だけ。`,
    "理論、数式、定義、例、引用、演習は変更しない。本文ファイルへ書き込まない。",
    "Codexのsubagent、create_thread、spawn_taskその他の委譲機能を扱わない。",
    `出力はJSON Schemaに従い、chapter_id=${chapterId}、artifact_kind=${ARTIFACT_KIND}、theory_touch=falseとする。`,
    "以下が独立launcher workerによって用意された今回だけの依頼文。",
    "---",
    prompt,
  ].join(EOL);

  const args = [
    "--model",
    MODEL_ALIAS,
    "--effort",
    "max",
    "--print",
    "--verbose",
    "--output-format",
    "stream-json",
    "--max-budget-usd",
    MAX_BUDGET_USD.toFixed(2),
    "--safe-mode",
    "--permission-mode",
    "dontAsk",
    "--tools",
    "Read",
    "--no-chrome",
    "--json-schema",
    JSON.stringify(schema),
    guardedPrompt,
  ];

  if (args.includes("--fallback-model")) fail("fallback model is forbidden");
  return args;
}

export function captureRepoFingerprint() {
  const head = runGit(["rev-parse", "HEAD"]).trim();
  const status = runGit(
    ["status", "--porcelain=v2", "-z", "--untracked-files=all"],
    { encoding: null },
  );
  const worktreeDiff = runGit(["diff", "--binary", "HEAD", "--"], {
    encoding: null,
  });
  const indexDiff = runGit(["diff", "--cached", "--binary", "--"], {
    encoding: null,
  });
  const fingerprint = {
    head,
    clean: status.length === 0,
    status_sha256: sha256(status),
    worktree_diff_sha256: sha256(worktreeDiff),
    index_diff_sha256: sha256(indexDiff),
  };
  return {
    ...fingerprint,
    digest: sha256(JSON.stringify(fingerprint)),
  };
}

export function captureBaselineBlobs(chapterId) {
  const paths = [...BASELINE_CONTEXT_PATHS, CHAPTER_ALLOWLIST[chapterId]];
  const result = {};
  for (const relativePath of paths) {
    const baselineBlob = runGit([
      "rev-parse",
      `${BASELINE_COMMIT}:${relativePath}`,
    ]).trim();
    const workingBlob = runGit(["hash-object", relativePath]).trim();
    if (baselineBlob !== workingBlob) {
      fail(`baseline drift detected for ${relativePath}`);
    }
    result[relativePath] = baselineBlob;
  }
  return result;
}

function isSyntheticEvent(event) {
  return (
    event?.synthetic === true ||
    event?.type === "synthetic" ||
    event?.subtype === "synthetic" ||
    event?.message?.model === "synthetic"
  );
}

function collectValuesByKey(value, key, output) {
  if (Array.isArray(value)) {
    for (const item of value) collectValuesByKey(item, key, output);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey === key && typeof entryValue === "string" && entryValue.length > 0) {
      output.add(entryValue);
    }
    collectValuesByKey(entryValue, key, output);
  }
}

function parseStructuredOutput(resultEvent) {
  const direct = resultEvent?.structured_output;
  if (direct && typeof direct === "object" && !Array.isArray(direct)) return direct;
  if (resultEvent?.result && typeof resultEvent.result === "object") {
    return resultEvent.result;
  }
  if (typeof resultEvent?.result === "string") {
    try {
      return JSON.parse(resultEvent.result);
    } catch {
      return null;
    }
  }
  return null;
}

export async function readEventsJsonl(eventsPath) {
  const raw = await readFile(eventsPath, "utf8");
  const lines = raw.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  if (lines.length === 0) fail("events JSONL is empty");
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch {
      fail(`events JSONL line ${index + 1} is not valid JSON`);
    }
  });
}

export function verifyCapturedRun({
  events,
  chapterId,
  beforeFingerprint,
  afterFingerprint,
  maxBudgetUsd = MAX_BUDGET_USD,
}) {
  const failures = [];
  const nonSyntheticEvents = events.filter((event) => !isSyntheticEvent(event));
  const models = new Set();
  const sessionIds = new Set();
  for (const event of nonSyntheticEvents) {
    collectValuesByKey(event, "model", models);
    collectValuesByKey(event, "session_id", sessionIds);
  }

  const resultEvents = nonSyntheticEvents.filter((event) => event?.type === "result");
  const resultEvent = resultEvents.at(-1);
  const cost = resultEvent?.total_cost_usd;
  const output = parseStructuredOutput(resultEvent);

  if (models.size !== 1 || !models.has(REQUIRED_MODEL_ID)) {
    failures.push(`model_gate:${[...models].join(",") || "none"}`);
  }
  if (sessionIds.size !== 1) {
    failures.push(`session_gate:${[...sessionIds].join(",") || "none"}`);
  }
  if (
    resultEvents.length !== 1 ||
    resultEvent?.subtype !== "success" ||
    resultEvent?.is_error === true
  ) {
    failures.push("status_gate:not_single_success");
  }
  if (
    typeof cost !== "number" ||
    !Number.isFinite(cost) ||
    cost < 0 ||
    cost > maxBudgetUsd
  ) {
    failures.push(`cost_gate:${String(cost)}`);
  }
  if (!output || output.chapter_id !== chapterId) failures.push("schema_gate:chapter_id");
  if (!output || output.artifact_kind !== ARTIFACT_KIND) {
    failures.push("schema_gate:artifact_kind");
  }
  if (!output || output.theory_touch !== false) failures.push("schema_gate:theory_touch");
  if (!Array.isArray(output?.edits) || output.edits.length === 0) {
    failures.push("schema_gate:edits");
  } else {
    const allowedKinds = new Set(["chapter_opening_narrative", "explicit_transition"]);
    if (
      output.edits.some(
        (edit) =>
          !edit ||
          !allowedKinds.has(edit.target_kind) ||
          typeof edit.locator !== "string" ||
          edit.locator.length === 0 ||
          typeof edit.replacement_markdown !== "string" ||
          edit.replacement_markdown.length === 0,
      )
    ) {
      failures.push("schema_gate:edit_shape");
    }
  }
  if (
    !beforeFingerprint?.clean ||
    !afterFingerprint?.clean ||
    beforeFingerprint?.digest !== afterFingerprint?.digest
  ) {
    failures.push("repo_fingerprint_gate:drift");
  }

  return {
    accepted: failures.length === 0,
    failures,
    observed: {
      models: [...models].sort(),
      session_ids: [...sessionIds].sort(),
      status: resultEvent?.subtype ?? null,
      total_cost_usd: typeof cost === "number" ? cost : null,
      theory_touch: output?.theory_touch ?? null,
      repo_fingerprint_equal:
        beforeFingerprint?.digest === afterFingerprint?.digest,
    },
    output,
  };
}

function renderDraftMarkdown(output) {
  return output.edits
    .map(
      (edit, index) =>
        `## ${index + 1}. ${edit.target_kind}: ${edit.locator}${EOL}${EOL}${edit.replacement_markdown}`,
    )
    .join(`${EOL}${EOL}`);
}

async function ensureNewJobDir(jobDir) {
  try {
    await stat(jobDir);
    fail(`job directory already exists; automatic rerun is forbidden: ${jobDir}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await mkdir(jobDir, { recursive: false, mode: 0o700 });
}

async function spawnClaudeOnce(args, { eventsPath, stderrPath }) {
  const eventsStream = createWriteStream(eventsPath, { flags: "wx", mode: 0o600 });
  const stderrStream = createWriteStream(stderrPath, { flags: "wx", mode: 0o600 });
  const child = spawn("claude", args, {
    cwd: REPO_ROOT,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(eventsStream);
  child.stderr.pipe(stderrStream);

  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  await Promise.all([finished(eventsStream), finished(stderrStream)]);
  return exitCode;
}

async function prepareInvocation(parsed) {
  const [promptFile, jobDir] = await Promise.all([
    requireExternalAbsolutePath("--prompt-file", parsed.promptFile),
    requireExternalAbsolutePath("--job-dir", parsed.jobDir),
  ]);
  await access(promptFile);
  const promptStat = await stat(promptFile);
  if (!promptStat.isFile()) fail("--prompt-file must point to a regular file");
  const prompt = await readFile(promptFile, "utf8");
  if (prompt.trim().length === 0) fail("--prompt-file must not be empty");

  const beforeFingerprint = captureRepoFingerprint();
  if (parsed.execute && !beforeFingerprint.clean) {
    fail("repository must be clean before launcher execution");
  }
  const baselineBlobs = captureBaselineBlobs(parsed.chapterId);
  const claudeArgs = buildClaudeArgs({ chapterId: parsed.chapterId, prompt });
  return {
    promptFile,
    jobDir,
    beforeFingerprint,
    baselineBlobs,
    claudeArgs,
  };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const prepared = await prepareInvocation(parsed);
  const sourcePath = CHAPTER_ALLOWLIST[parsed.chapterId];

  if (parsed.dryRun) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          mode: "dry-run",
          fable_spawned: false,
          chapter_id: parsed.chapterId,
          source_path: sourcePath,
          baseline_commit: BASELINE_COMMIT,
          baseline_blob_count: Object.keys(prepared.baselineBlobs).length,
          model_alias: MODEL_ALIAS,
          required_model_id: REQUIRED_MODEL_ID,
          max_budget_usd: MAX_BUDGET_USD,
          fallback_enabled: false,
          automatic_retry: false,
          tools: ["Read"],
          job_dir: prepared.jobDir,
          repo_fingerprint: prepared.beforeFingerprint.digest,
          command: "claude",
          args: prepared.claudeArgs.map((value, index, values) =>
            index === values.length - 1 ? "[PROMPT REDACTED]" : value,
          ),
        },
        null,
        2,
      )}${EOL}`,
    );
    return;
  }

  await ensureNewJobDir(prepared.jobDir);
  const eventsPath = path.join(prepared.jobDir, "events.jsonl");
  const stderrPath = path.join(prepared.jobDir, "stderr.log");
  const manifestPath = path.join(prepared.jobDir, "manifest.json");
  const verificationPath = path.join(prepared.jobDir, "verification.json");
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        chapter_id: parsed.chapterId,
        source_path: sourcePath,
        prompt_file: prepared.promptFile,
        baseline_commit: BASELINE_COMMIT,
        baseline_blobs: prepared.baselineBlobs,
        model_alias: MODEL_ALIAS,
        required_model_id: REQUIRED_MODEL_ID,
        max_budget_usd: MAX_BUDGET_USD,
        fallback_enabled: false,
        automatic_retry: false,
        attempt: 1,
        repo_fingerprint_before: prepared.beforeFingerprint,
      },
      null,
      2,
    )}${EOL}`,
    { flag: "wx", mode: 0o600 },
  );

  const exitCode = await spawnClaudeOnce(prepared.claudeArgs, {
    eventsPath,
    stderrPath,
  });
  const afterFingerprint = captureRepoFingerprint();
  const events = await readEventsJsonl(eventsPath);
  const verification = verifyCapturedRun({
    events,
    chapterId: parsed.chapterId,
    beforeFingerprint: prepared.beforeFingerprint,
    afterFingerprint,
  });
  if (exitCode !== 0) {
    verification.accepted = false;
    verification.failures.push(`process_exit_gate:${exitCode}`);
  }
  await writeFile(
    verificationPath,
    `${JSON.stringify(
      {
        ...verification,
        repo_fingerprint_before: prepared.beforeFingerprint,
        repo_fingerprint_after: afterFingerprint,
      },
      null,
      2,
    )}${EOL}`,
    { flag: "wx", mode: 0o600 },
  );

  if (!verification.accepted) {
    process.stderr.write(
      `Fable artifact rejected; automatic retry is forbidden: ${verification.failures.join(", ")}${EOL}`,
    );
    process.exitCode = 1;
    return;
  }

  await writeFile(
    path.join(prepared.jobDir, "draft.json"),
    `${JSON.stringify(verification.output, null, 2)}${EOL}`,
    { flag: "wx", mode: 0o600 },
  );
  await writeFile(
    path.join(prepared.jobDir, "draft.md"),
    `${renderDraftMarkdown(verification.output)}${EOL}`,
    { flag: "wx", mode: 0o600 },
  );
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      accepted: true,
      chapter_id: parsed.chapterId,
      job_dir: prepared.jobDir,
      total_cost_usd: verification.observed.total_cost_usd,
      session_id: verification.observed.session_ids[0],
    })}${EOL}`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}${EOL}`);
    process.exitCode = 1;
  });
}
