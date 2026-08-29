#!/usr/bin/env node
/**
 * Vercel の直近24時間デプロイ数を数えて、枯渇の手前で警告・停止する。
 *
 * 上限は Hobby プランで 100/日・アカウント全体（プロジェクト単位ではない）。
 * 2026-06-03 と 2026-08-29 に使い切って半日〜1日 本番反映が止まった。
 *
 *   node pwa/scripts/check_deploy_quota.mjs          … 警告のみ (exit 0)
 *   node pwa/scripts/check_deploy_quota.mjs --gate   … WARN=0 / BLOCK=1 を返す (pre-push 用)
 *
 * 閾値: 50件超=警告 / 90件超=停止。停止は AMD_OS_DEPLOY_QUOTA_OVERRIDE=1 で解除。
 * Vercel の認証が取れない時は黙って通す（開発を止めない）。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const WARN_AT = Number(process.env.AMD_OS_DEPLOY_QUOTA_WARN || 50);
const BLOCK_AT = Number(process.env.AMD_OS_DEPLOY_QUOTA_BLOCK || 90);
const LIMIT = 100;
const gate = process.argv.includes("--gate");

function readToken() {
  const candidates = [
    path.join(os.homedir(), "Library/Application Support/com.vercel.cli/auth.json"),
    path.join(os.homedir(), ".vercel/auth.json"),
  ];
  for (const p of candidates) {
    try {
      const t = JSON.parse(fs.readFileSync(p, "utf8"))?.token;
      if (t) return t;
    } catch {}
  }
  return null;
}

function readOrgId() {
  try {
    const p = path.join(process.cwd(), "pwa/.vercel/project.json");
    const alt = path.join(process.cwd(), ".vercel/project.json");
    const file = fs.existsSync(p) ? p : alt;
    return JSON.parse(fs.readFileSync(file, "utf8"))?.orgId ?? null;
  } catch {
    return null;
  }
}

const token = readToken();
const orgId = readOrgId();
if (!token || !orgId) process.exit(0);

const since = Date.now() - 24 * 60 * 60 * 1000;
let deployments = [];
try {
  const res = await fetch(
    `https://api.vercel.com/v6/deployments?teamId=${orgId}&limit=100&since=${since}`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) process.exit(0);
  deployments = (await res.json())?.deployments ?? [];
} catch {
  process.exit(0);
}

const perProject = {};
for (const d of deployments) perProject[d.name] = (perProject[d.name] ?? 0) + 1;
const total = deployments.length;
const breakdown = Object.entries(perProject)
  .sort((a, b) => b[1] - a[1])
  .map(([n, c]) => `${n} ${c}`)
  .join(" / ");

if (total > BLOCK_AT) {
  console.error(`\n🛑 Vercel デプロイ枠が残りわずか: 直近24時間で ${total}/${LIMIT} 件 (${breakdown})`);
  console.error("   使い切ると全プロジェクトが最大24時間反映できなくなる。push をまとめるか、時間を空けて。");
  console.error("   どうしても今 push する必要があるなら AMD_OS_DEPLOY_QUOTA_OVERRIDE=1 を付ける。\n");
  if (gate && process.env.AMD_OS_DEPLOY_QUOTA_OVERRIDE !== "1") process.exit(1);
} else if (total > WARN_AT) {
  console.error(`\n⚠️  Vercel デプロイ枠 注意: 直近24時間で ${total}/${LIMIT} 件 (${breakdown})`);
  console.error("   残りが少ない。細かい push を束ねて。docs だけの変更は build されないので気にしなくてよい。\n");
} else if (!gate) {
  console.log(`Vercel デプロイ: 直近24時間 ${total}/${LIMIT} 件 (${breakdown})`);
}
process.exit(0);
