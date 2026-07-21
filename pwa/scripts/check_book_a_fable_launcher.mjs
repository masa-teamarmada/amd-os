#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ARTIFACT_KIND,
  MAX_BUDGET_USD,
  REPO_ROOT,
  REQUIRED_MODEL_ID,
  readEventsJsonl,
  verifyCapturedRun,
} from "./book_a_fable_launcher.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const LAUNCHER = path.join(SCRIPT_DIR, "book_a_fable_launcher.mjs");
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const FINGERPRINT = {
  clean: true,
  digest: "same-fingerprint",
};

function happyEvents(overrides = {}) {
  const output = {
    chapter_id: "ch1",
    artifact_kind: ARTIFACT_KIND,
    theory_touch: false,
    edits: [
      {
        target_kind: "chapter_opening_narrative",
        locator: "1.0",
        replacement_markdown: "fixture only",
      },
    ],
    ...overrides.output,
  };
  return [
    {
      type: "synthetic",
      synthetic: true,
      model: "not-a-real-model",
      session_id: "synthetic-session",
    },
    {
      type: "system",
      subtype: "init",
      model: overrides.model ?? REQUIRED_MODEL_ID,
      session_id: SESSION_ID,
    },
    {
      type: "assistant",
      message: { model: overrides.model ?? REQUIRED_MODEL_ID },
      session_id: SESSION_ID,
    },
    {
      type: "result",
      subtype: overrides.status ?? "success",
      is_error: overrides.isError ?? false,
      session_id: SESSION_ID,
      total_cost_usd: overrides.cost ?? 4.25,
      structured_output: output,
    },
  ];
}

async function writeFixture(directory, name, events) {
  const fixturePath = path.join(directory, `${name}.jsonl`);
  await writeFile(
    fixturePath,
    `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
    "utf8",
  );
  return fixturePath;
}

async function verifyFixture(directory, name, events, expectedFailure) {
  const fixturePath = await writeFixture(directory, name, events);
  const parsedEvents = await readEventsJsonl(fixturePath);
  const result = verifyCapturedRun({
    events: parsedEvents,
    chapterId: "ch1",
    beforeFingerprint: FINGERPRINT,
    afterFingerprint:
      name === "repo-drift" ? { clean: true, digest: "changed" } : FINGERPRINT,
    maxBudgetUsd: MAX_BUDGET_USD,
  });
  if (expectedFailure === null) {
    assert.equal(result.accepted, true, `${name} should be accepted`);
  } else {
    assert.equal(result.accepted, false, `${name} should be rejected`);
    assert.ok(
      result.failures.some((failure) => failure.startsWith(expectedFailure)),
      `${name} did not report ${expectedFailure}: ${result.failures.join(", ")}`,
    );
  }
}

async function main() {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "book-a-fable-launcher-test-"));
  try {
    const promptPath = path.join(tempRoot, "prompt.md");
    const jobDir = path.join(tempRoot, "dry-run-job");
    await writeFile(promptPath, "fixture dry-run prompt", "utf8");
    const dryRun = spawnSync(
      process.execPath,
      [
        LAUNCHER,
        "--chapter",
        "ch1",
        "--prompt-file",
        promptPath,
        "--job-dir",
        jobDir,
        "--dry-run",
      ],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    assert.equal(dryRun.status, 0, dryRun.stderr);
    const dryRunResult = JSON.parse(dryRun.stdout);
    assert.equal(dryRunResult.fable_spawned, false);
    assert.equal(dryRunResult.required_model_id, REQUIRED_MODEL_ID);
    assert.equal(dryRunResult.max_budget_usd, MAX_BUDGET_USD);
    assert.equal(dryRunResult.fallback_enabled, false);
    assert.equal(dryRunResult.automatic_retry, false);
    assert.deepEqual(dryRunResult.tools, ["Read"]);
    await assert.rejects(readFile(jobDir, "utf8"), { code: "ENOENT" });
    assert.equal(dryRunResult.args.includes("--fallback-model"), false);
    assert.deepEqual(
      dryRunResult.args.slice(0, 20),
      [
        "--model",
        "fable",
        "--effort",
        "max",
        "--print",
        "--verbose",
        "--output-format",
        "stream-json",
        "--max-budget-usd",
        "5.00",
        "--safe-mode",
        "--permission-mode",
        "dontAsk",
        "--tools",
        "Read",
        "--no-chrome",
        "--json-schema",
        dryRunResult.args[17],
        "[PROMPT REDACTED]",
      ],
    );

    const fallbackAttempt = spawnSync(
      process.execPath,
      [
        LAUNCHER,
        "--chapter",
        "ch1",
        "--prompt-file",
        promptPath,
        "--job-dir",
        jobDir,
        "--fallback-model",
        "sonnet",
        "--dry-run",
      ],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    assert.notEqual(fallbackAttempt.status, 0);
    assert.match(fallbackAttempt.stderr, /unknown or forbidden argument/u);

    const multiChapterAttempt = spawnSync(
      process.execPath,
      [
        LAUNCHER,
        "--chapter",
        "ch1",
        "--chapter",
        "ch2",
        "--prompt-file",
        promptPath,
        "--job-dir",
        jobDir,
        "--dry-run",
      ],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    assert.notEqual(multiChapterAttempt.status, 0);
    assert.match(multiChapterAttempt.stderr, /may be supplied only once/u);

    await verifyFixture(tempRoot, "happy", happyEvents(), null);
    await verifyFixture(
      tempRoot,
      "model-mismatch",
      happyEvents({ model: "claude-sonnet-4-6" }),
      "model_gate:",
    );
    await verifyFixture(
      tempRoot,
      "cost-over",
      happyEvents({ cost: MAX_BUDGET_USD + 0.01 }),
      "cost_gate:",
    );
    await verifyFixture(
      tempRoot,
      "theory-touch",
      happyEvents({ output: { theory_touch: true } }),
      "schema_gate:theory_touch",
    );
    await verifyFixture(
      tempRoot,
      "repo-drift",
      happyEvents(),
      "repo_fingerprint_gate:drift",
    );

    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        fable_spawned: false,
        dry_run: "pass",
        fallback_argument: "rejected",
        multiple_chapters: "rejected",
        fake_fixtures: {
          happy: "accepted",
          model_mismatch: "rejected",
          cost_over: "rejected",
          theory_touch_true: "rejected",
          repo_drift: "rejected",
        },
      })}\n`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
