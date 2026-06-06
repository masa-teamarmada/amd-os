#!/usr/bin/env node

/**
 * Vercel Ignored Build Step for amd-os-pwa.
 *
 * Exit code semantics:
 * - 0: ignore / skip this Vercel build.
 * - 1: continue and build.
 *
 * Policy:
 * - Git-triggered deployments that only change documentation/textbook markdown
 *   should not consume a Vercel production deployment.
 * - CLI/manual deployments should still build, so release checkpoints can be
 *   deployed deliberately after a batch of manuscript edits.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";

const gitProvider = process.env.VERCEL_GIT_PROVIDER || "";
const gitCommitSha = process.env.VERCEL_GIT_COMMIT_SHA || "";

if (!gitProvider && !gitCommitSha) {
  console.log("[vercel-ignore] non-git deployment; build");
  process.exit(1);
}

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function changedFiles() {
  const topLevel = git(["rev-parse", "--show-toplevel"]);
  const cwd = process.cwd();
  const relativeToRoot = path.relative(topLevel, cwd) || ".";

  try {
    return git(["diff", "--name-only", "HEAD^", "HEAD"])
      .split("\n")
      .map((file) => file.trim())
      .filter(Boolean)
      .map((file) => file.replace(/\\/g, "/"));
  } catch (error) {
    console.log(`[vercel-ignore] cannot diff HEAD^..HEAD from ${relativeToRoot}; build`);
    process.exit(1);
  }
}

const files = changedFiles();

if (files.length === 0) {
  console.log("[vercel-ignore] no changed files detected; build");
  process.exit(1);
}

const ignoredPatterns = [
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^README\.md$/,
  /^SETUP_NEW_MAC\.md$/,
  /^pwa\/bzm\/textbook\//,
  /^pwa\/bzm\/public-manuscript\/.*\.md$/,
  /^pwa\/bzm\/.*\.md$/,
  /^pwa\/design\/.*\.md$/,
  /^pwa\/design_log\/.*\.md$/,
];

const forceBuildPatterns = [
  /^pwa\/src\//,
  /^pwa\/app\//,
  /^pwa\/components\//,
  /^pwa\/lib\//,
  /^pwa\/public\//,
  /^pwa\/scripts\/vercel_ignore_build\.mjs$/,
  /^pwa\/vercel\.json$/,
  /^pwa\/package\.json$/,
  /^pwa\/package-lock\.json$/,
  /^pwa\/next\.config\./,
  /^pwa\/tsconfig\.json$/,
  /^pwa\/postcss\.config\./,
  /^pwa\/tailwind\.config\./,
];

const affectsBuild = files.some((file) => {
  if (forceBuildPatterns.some((pattern) => pattern.test(file))) {
    return true;
  }
  return !ignoredPatterns.some((pattern) => pattern.test(file));
});

if (affectsBuild) {
  console.log("[vercel-ignore] build-affecting changes detected:");
  for (const file of files) console.log(`  - ${file}`);
  process.exit(1);
}

console.log("[vercel-ignore] docs/textbook-only changes; skip Vercel build:");
for (const file of files) console.log(`  - ${file}`);
process.exit(0);
