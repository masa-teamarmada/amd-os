/**
 * 反映後の旧版整理（scripts/cleanup_old_deployments.mjs）が、消してよい版だけを選ぶことの検査。
 *
 * 実行: npm run test:deployment-cleanup（deploy.sh でも実行）
 * 規則（まさ 2026-10-17）: 直近5版と今の本番版を残し、それより古い版を消す。
 * ここで守るのは、本番・新しい5版・作成中・取消・失敗・他プロジェクトの版を決して消さないこと。
 */
import assert from "node:assert/strict";
import { DEPLOYMENT_ID, PROJECT_ID, PROJECT_NAME, planDeploymentCleanup } from "./cleanup_old_deployments.mjs";

let n = 0;
const at = minutes => Date.UTC(2026, 9, 17, 0, 0) + minutes * 60_000;
const dep = (state, minutes, extra = {}) => ({ uid: `dpl_t${String(++n).padStart(3, "0")}`, name: PROJECT_NAME, projectId: PROJECT_ID, state, created: at(minutes), meta: { githubCommitSha: `${n}`.padEnd(40, "0") }, ...extra });
const ids = list => list.map(d => d.uid).sort();

// 1. 12版の READY と取消・失敗・作成中が混ざる。本番は最新。新しい5版を残し、古い7版だけを消す。
{
  const ready = Array.from({ length: 12 }, (_, i) => dep("READY", i * 10));
  const others = [dep("CANCELED", 5), dep("ERROR", 15), dep("BUILDING", 200), dep("QUEUED", 210)];
  const shuffled = [...others, ...ready].sort((a, b) => a.uid.localeCompare(b.uid) * -1);
  const plan = planDeploymentCleanup({ deployments: shuffled, productionId: ready[11].uid });
  assert.deepEqual(ids(plan.keep), ids(ready.slice(7)), "新しい5版を残す");
  assert.deepEqual(ids(plan.remove), ids(ready.slice(0, 7)), "それより古い READY だけを消す");
  assert(plan.remove.every(d => d.state === "READY"), "取消・失敗・作成中は消さない");
  assert.equal(plan.notReady.length, 4);
}

// 2. 巻き戻しで本番が古い版を指している。新しい5版に加えて本番を残す。
{
  const ready = Array.from({ length: 9 }, (_, i) => dep("READY", i * 10));
  const plan = planDeploymentCleanup({ deployments: ready, productionId: ready[1].uid });
  assert(plan.keep.some(d => d.uid === ready[1].uid), "本番は古くても残す");
  assert.equal(plan.keep.length, 6);
  assert.deepEqual(ids(plan.remove), ids([ready[0], ready[2], ready[3]]));
}

// 3. READY が5版以下なら何も消さない。
{
  const ready = Array.from({ length: 5 }, (_, i) => dep("READY", i));
  assert.equal(planDeploymentCleanup({ deployments: ready, productionId: ready[4].uid }).remove.length, 0);
}

// 4. 他プロジェクト・ID の形が違う・重複した版は対象にしない。
{
  const ready = Array.from({ length: 8 }, (_, i) => dep("READY", i * 10));
  const foreign = [
    dep("READY", -100, { projectId: "prj_other" }),
    dep("READY", -90, { name: "okudoor" }),
    { ...dep("READY", -80), uid: "amd-os-pwa" },
    { ...ready[0] },
  ];
  const plan = planDeploymentCleanup({ deployments: [...ready, ...foreign], productionId: ready[7].uid });
  assert.deepEqual(ids(plan.remove), ids(ready.slice(0, 3)), "このプロジェクトの版だけ、重複なしで選ぶ");
  assert(plan.remove.every(d => DEPLOYMENT_ID.test(d.uid)), "版の ID の形だけを渡す");
}

// 5. 本番が特定できない・一覧に無い・READY でないときは、何も消さずに止める。
{
  const ready = Array.from({ length: 8 }, (_, i) => dep("READY", i * 10));
  assert.throws(() => planDeploymentCleanup({ deployments: ready, productionId: undefined }), /本番の版が特定できない/);
  assert.throws(() => planDeploymentCleanup({ deployments: ready, productionId: "amd-os-pwa" }), /本番の版が特定できない/);
  assert.throws(() => planDeploymentCleanup({ deployments: ready, productionId: "dpl_missing" }), /一覧に無い/);
  const building = dep("BUILDING", 500);
  assert.throws(() => planDeploymentCleanup({ deployments: [...ready, building], productionId: building.uid }), /READY ではない/);
}

// 6. 一覧の古い API 表記（readyState）でも同じに扱う。
{
  const ready = Array.from({ length: 7 }, (_, i) => {
    const d = dep("READY", i * 10);
    delete d.state;
    return { ...d, readyState: "READY" };
  });
  assert.equal(planDeploymentCleanup({ deployments: ready, productionId: ready[6].uid }).remove.length, 2);
}

console.log("deployment cleanup plan: ok");
