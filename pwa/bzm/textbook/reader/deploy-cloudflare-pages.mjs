#!/usr/bin/env node

/**
 * Deploy the standalone Textbook draft reader to Cloudflare Pages.
 *
 * Prerequisite:
 * - Masa creates/logs into a Cloudflare account once.
 * - Run `npx wrangler login` before this script.
 *
 * This does not use Vercel and does not touch the AMD OS PWA production deploy.
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectName = process.env.TEXTBOOK_PAGES_PROJECT || "textbook-draft";
const distDir = path.join(__dirname, "dist");
const generatedReader = path.join(__dirname, "textbook-reader.html");
const indexHtml = path.join(distDir, "index.html");

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    stdio: "inherit",
    cwd: options.cwd ?? __dirname,
    env: process.env,
  });
}

function output(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    cwd: options.cwd ?? __dirname,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

console.log("[textbook-draft] generating reader HTML...");
const generate = run("node", [path.join(__dirname, "generate-reader.mjs")]);
if (generate.status !== 0) process.exit(generate.status ?? 1);

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });
fs.copyFileSync(generatedReader, indexHtml);

console.log(`[textbook-draft] prepared ${indexHtml}`);

try {
  const whoami = output("npx", ["wrangler", "whoami"], { cwd: path.resolve(__dirname, "../../..") });
  if (/not authenticated|wrangler login|CLOUDFLARE_API_TOKEN/i.test(whoami)) {
    throw new Error("wrangler is not authenticated");
  }
} catch {
  console.error("[textbook-draft] Cloudflare is not authenticated.");
  console.error("[textbook-draft] Run interactively: npx wrangler login");
  console.error("[textbook-draft] Or set: CLOUDFLARE_API_TOKEN");
  console.error("[textbook-draft] Then rerun: node pwa/bzm/textbook/reader/deploy-cloudflare-pages.mjs");
  process.exit(1);
}

console.log(`[textbook-draft] deploying to Cloudflare Pages project: ${projectName}`);

const deploy = run(
  "npx",
  ["wrangler", "pages", "deploy", distDir, "--project-name", projectName],
  { cwd: path.resolve(__dirname, "../../..") }
);

process.exit(deploy.status ?? 1);
