#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PWA_DIR = path.resolve(new URL("..", import.meta.url).pathname);
const TOOL = path.join(PWA_DIR, "scripts/atlas_signal_review_tool.mjs");
const ROUTE = path.join(PWA_DIR, "src/app/api/atlas/signals-ingest/route.ts");

function signal(index) {
  return {
    signals: [{
      title: `fixture signal ${index}`,
      content: `fixture content ${index}`,
      source_url: `https://example.test/signals/${index}`,
      source_type: "news",
      domain: "I.ICT・AI",
      importance: "medium",
    }],
  };
}

async function writeOutbox(dir, count) {
  await fs.mkdir(dir, { recursive: true });
  await Promise.all(Array.from({ length: count }, (_, index) => fs.writeFile(
    path.join(dir, `${String(index).padStart(3, "0")}.json`),
    JSON.stringify(signal(index)),
  )));
}

async function countJson(dir) {
  try {
    return (await fs.readdir(dir)).filter((name) => name.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

async function serverWith(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  return {
    url: `http://127.0.0.1:${address.port}/api/atlas/signals-ingest`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function apply(tempDir, url) {
  const outbox = path.join(tempDir, "outbox");
  try {
    await execFileAsync(process.execPath, [TOOL, "apply-outbox-dir", "--dir", outbox, "--ingest-url", url], {
      env: { ...process.env, ATLAS_AUTOMATION_DIR: tempDir, ATLAS_INGEST_SECRET: "fixture-secret" },
    });
    return 0;
  } catch (error) {
    return error.code;
  }
}

async function main() {
  const route = await fs.readFile(ROUTE, "utf8");
  assert(!route.includes("getBackgroundAnthropic"), "raw ingest must not start background Anthropic");
  assert(!route.includes("attachStory"), "raw ingest must not attach a story synchronously");
  assert(route.includes("suggested_tags: []"), "raw insert must use empty tags");
  assert(route.includes("story_id: null"), "raw insert must leave story enrichment deferred");
  assert(route.includes('enrichment: "deferred"'), "ACK must declare deferred enrichment");

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-ingest-contract-"));
  try {
    // 62件の先頭が semantic disabled なら、1回だけ送って残り61件を送らない。
    const disabledDir = path.join(root, "disabled");
    await writeOutbox(path.join(disabledDir, "outbox"), 62);
    let disabledRequests = 0;
    const disabledServer = await serverWith((_, response) => {
      disabledRequests += 1;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: true, disabled: true }));
    });
    assert.equal(await apply(disabledDir, disabledServer.url), 75);
    await disabledServer.close();
    assert.equal(disabledRequests, 1);
    assert.equal(await countJson(path.join(disabledDir, "outbox")), 62);
    assert.equal(await countJson(path.join(disabledDir, "applied")), 0);
    assert.equal(await countJson(path.join(disabledDir, "failed")), 0);

    // cooldown中は62件あっても一度も通信しない。
    const cooldownDir = path.join(root, "cooldown");
    await writeOutbox(path.join(cooldownDir, "outbox"), 62);
    await fs.writeFile(path.join(cooldownDir, "ingest-cooldown.json"), JSON.stringify({
      until: new Date(Date.now() + 60_000).toISOString(), reason: "fixture",
    }));
    let cooldownRequests = 0;
    const cooldownServer = await serverWith((_, response) => {
      cooldownRequests += 1;
      response.end(JSON.stringify({ ok: true }));
    });
    assert.equal(await apply(cooldownDir, cooldownServer.url), 75);
    await cooldownServer.close();
    assert.equal(cooldownRequests, 0);
    assert.equal(await countJson(path.join(cooldownDir, "outbox")), 62);

    // raw 保存 ACK (enrichment deferred) は applied へ進める。既存rowの重複ACKも同じ。
    const acceptedDir = path.join(root, "accepted");
    await writeOutbox(path.join(acceptedDir, "outbox"), 1);
    const acceptedServer = await serverWith((_, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: true, accepted: 1, inserted: 1, skipped: 0, enrichment: "deferred" }));
    });
    assert.equal(await apply(acceptedDir, acceptedServer.url), 0);
    await acceptedServer.close();
    assert.equal(await countJson(path.join(acceptedDir, "outbox")), 0);
    assert.equal(await countJson(path.join(acceptedDir, "applied")), 1);

    const duplicateDir = path.join(root, "duplicate");
    await writeOutbox(path.join(duplicateDir, "outbox"), 1);
    const duplicateServer = await serverWith((_, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: true, accepted: 0, inserted: 0, skipped: 1, enrichment: "deferred" }));
    });
    assert.equal(await apply(duplicateDir, duplicateServer.url), 0);
    await duplicateServer.close();
    assert.equal(await countJson(path.join(duplicateDir, "applied")), 1);

    // 4xxは無限retryせずfailedへ隔離する。
    const invalidDir = path.join(root, "invalid");
    await writeOutbox(path.join(invalidDir, "outbox"), 1);
    const invalidServer = await serverWith((_, response) => {
      response.statusCode = 400;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: false, error: "invalid_signal_schema" }));
    });
    assert.equal(await apply(invalidDir, invalidServer.url), 1);
    await invalidServer.close();
    assert.equal(await countJson(path.join(invalidDir, "outbox")), 0);
    assert.equal(await countJson(path.join(invalidDir, "failed")), 1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
  console.log("atlas ingest contract: ok");
}

await main();
