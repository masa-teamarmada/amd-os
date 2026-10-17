#!/usr/bin/env node
/**
 * AMD OS の古い版（Vercel のデプロイ）を消し、Functions Storage を一定に保つ。
 *
 * まさ 2026-10-17「AMD OSの更新が終わるたびに、直近5版と今の本番版を残して、それより古い版を消す形で」。
 * 1デプロイは関数だけで約119MB（2026-10-17 実測）。保存期間1日でも Vercel の削除処理は最大48時間遅れ、
 * 1日10〜20回の反映で直近3〜4日分（数十版）が残るため、反映のたびに整理する。
 *
 * deploy.sh が本番の切り替わり（/api/build-info の git_sha）を確かめた後に --apply で呼ぶ。
 * 手で回したときの既定は予行で、消す対象の一覧を出すだけ。
 *
 *   node pwa/scripts/cleanup_old_deployments.mjs
 *   node pwa/scripts/cleanup_old_deployments.mjs --apply --expect-production-sha <sha>
 *
 * 残す版（どれかに当たれば消さない）:
 *   - 作り終えた版（READY）の新しい順5件
 *   - 今の本番（amd-os-pwa.vercel.app が指している版）
 *   - アドレス（alias）が付いている版。消すときは `vercel remove --safe` に渡し、Vercel 側でも確かめる
 *   - 作成中・待機中の版と、取消・失敗の版（取消・失敗は中身を持たず容量を使わない。保存期間1日で Vercel が消す）
 * 消した版は Vercel の amd-os-pwa › Settings › Security › Recently Deleted から30日間戻せる。
 * 仕様: pwa/spec/5-2-development-operations-current-spec.md「反映後の旧版整理」。検査: npm run test:deployment-cleanup
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const SCOPE = "armada0130";
export const PROJECT_ID = "prj_raZW3HSKIszzPUwNTHfy7xDGzLHm";
export const PROJECT_NAME = "amd-os-pwa";
export const PRODUCTION_ALIAS = "amd-os-pwa.vercel.app";
export const KEEP_READY = 5;
const MAX_REMOVE_PER_RUN = 100;
// `vercel remove` はプロジェクト名を渡すと全版を消す。必ずこの形の版の ID だけを渡す。
export const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]+$/;

const stateOf = deployment => deployment.state ?? deployment.readyState;

/**
 * 消す版を決める。Vercel の一覧 API の要素（uid, name, projectId, state, created, meta）を受け取り、
 * 残す版・消す版・対象外（READY 以外）を返す。本番が特定できない・一覧に無いときは例外にして何も消さない。
 */
export function planDeploymentCleanup({ deployments, productionId, keepReady = KEEP_READY }) {
  if (!DEPLOYMENT_ID.test(productionId ?? "")) throw new Error("本番の版が特定できないので整理しない");
  const own = [...new Map(
    deployments
      .filter(d => d.projectId === PROJECT_ID && d.name === PROJECT_NAME && DEPLOYMENT_ID.test(d.uid ?? ""))
      .map(d => [d.uid, d]),
  ).values()];
  const production = own.find(d => d.uid === productionId);
  if (!production) throw new Error("本番の版が一覧に無いので整理しない");
  if (stateOf(production) !== "READY") throw new Error("本番の版が READY ではないので整理しない");
  const ready = own.filter(d => stateOf(d) === "READY").sort((a, b) => b.created - a.created);
  const keepIds = new Set([...ready.slice(0, keepReady).map(d => d.uid), productionId]);
  return {
    production,
    keep: ready.filter(d => keepIds.has(d.uid)),
    remove: ready.filter(d => !keepIds.has(d.uid)),
    notReady: own.filter(d => stateOf(d) !== "READY"),
  };
}

function resolveVercel() {
  try {
    execFileSync("vercel", ["--version"], { stdio: "ignore", timeout: 60_000 });
    return ["vercel"];
  } catch {
    return ["npx", "--yes", "vercel"];
  }
}

function runVercel(cli, args) {
  const [bin, ...prefix] = cli;
  return execFileSync(bin, [...prefix, ...args, "--scope", SCOPE, "--non-interactive"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
}

function api(cli, path) {
  return JSON.parse(runVercel(cli, ["api", path, "--raw"]));
}

function listDeployments(cli) {
  const all = [];
  let until;
  for (let page = 0; page < 10; page++) {
    const query = new URLSearchParams({ projectId: PROJECT_ID, limit: "100" });
    if (until) query.set("until", String(until));
    const result = api(cli, `/v6/deployments?${query}`);
    all.push(...(result.deployments ?? []));
    until = result.pagination?.next;
    if (!until) return all;
  }
  throw new Error("版の一覧が1000件を超えたので整理しない");
}

function currentProductionId(cli) {
  const alias = api(cli, `/v4/aliases/${PRODUCTION_ALIAS}`);
  if (alias.projectId !== PROJECT_ID) throw new Error(`${PRODUCTION_ALIAS} が ${PROJECT_NAME} を指していないので整理しない`);
  return alias.deploymentId;
}

function describe(deployment) {
  const created = new Date(deployment.created).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const sha = (deployment.meta?.githubCommitSha ?? "").slice(0, 8);
  const subject = (deployment.meta?.githubCommitMessage ?? "").split("\n")[0].slice(0, 50);
  return `${deployment.uid}  ${created}  ${sha}  ${subject}`;
}

function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const expectIndex = argv.indexOf("--expect-production-sha");
  const expectSha = expectIndex >= 0 ? argv[expectIndex + 1] ?? "" : "";
  if (expectIndex >= 0 && !/^[0-9a-f]{7,40}$/.test(expectSha)) throw new Error("--expect-production-sha には commit の SHA を渡す");

  const cli = resolveVercel();
  const plan = planDeploymentCleanup({ deployments: listDeployments(cli), productionId: currentProductionId(cli) });
  if (expectSha && !(plan.production.meta?.githubCommitSha ?? "").startsWith(expectSha)) {
    throw new Error(`本番が今回の版（${expectSha.slice(0, 8)}）ではないので整理しない`);
  }

  console.log(`古い版の整理（${apply ? "実行" : "予行。消すには --apply"}）`);
  console.log(`  本番: ${describe(plan.production)}`);
  console.log(`  残す版 ${plan.keep.length} 件（新しい順${KEEP_READY}件と本番）。作成中・取消・失敗の ${plan.notReady.length} 件は対象外`);
  const targets = plan.remove.slice(-MAX_REMOVE_PER_RUN);
  if (plan.remove.length > targets.length) console.log(`  消す対象 ${plan.remove.length} 件のうち、古い ${targets.length} 件だけを今回消す`);
  console.log(`  消す版 ${targets.length} 件${targets.length ? ":" : ""}`);
  for (const deployment of targets) console.log(`    - ${describe(deployment)}`);
  if (!apply || targets.length === 0) return;

  // 並行した反映で本番が動いていないかを、消す直前にもう一度確かめる。
  if (currentProductionId(cli) !== plan.production.uid) throw new Error("整理の途中で本番が切り替わったので消さない");
  let removed = 0;
  for (const deployment of targets) {
    if (!DEPLOYMENT_ID.test(deployment.uid) || deployment.uid === plan.production.uid) throw new Error(`消してはいけない版が対象に入った: ${deployment.uid}`);
    runVercel(cli, ["remove", deployment.uid, "--safe", "--yes"]);
    removed += 1;
  }
  console.log(`  ${removed} 件を消した。Vercel の Settings › Security › Recently Deleted から30日間戻せる`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`⚠ 古い版の整理を止めた: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
