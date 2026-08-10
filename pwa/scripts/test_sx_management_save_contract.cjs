const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const weekly = fs.readFileSync(
  path.join(root, "src/components/project-workspace/SxWeeklyControlDashboard.tsx"),
  "utf8",
);
const partners = fs.readFileSync(
  path.join(root, "src/components/project-workspace/SxPartnerPipeline.tsx"),
  "utf8",
);

const optimisticSave = weekly.indexOf("onSaved(optimistic");
const backgroundWrite = weekly.indexOf("void (async () => {");
assert.ok(optimisticSave >= 0, "existing-record edits must apply an optimistic bundle");
assert.ok(backgroundWrite > optimisticSave, "the DB write must begin after the visible save");
for (const required of [
  "sxApplyOptimisticManagementPatch",
  "onSyncFailed?.(`${message}。最新の内容に戻したよ`)",
  "${definition.title}を保存したよ。DBへ同期中",
]) {
  assert.ok(weekly.includes(required), `${required} must remain in the save flow`);
}

const partnerOptimistic = partners.indexOf("sxApplyOptimisticManagementPatch(");
const partnerBackgroundWrite = partners.indexOf("void (async () => {", partnerOptimistic);
assert.ok(partnerOptimistic >= 0, "partner cells must reflect the patch immediately");
assert.ok(
  partnerBackgroundWrite > partnerOptimistic,
  "partner cell DB writes must be background work",
);
assert.ok(
  partners.includes("return Promise.resolve();"),
  "inline cells must release the editor without waiting for the API response",
);

console.log("sx management instant-save contracts passed");
