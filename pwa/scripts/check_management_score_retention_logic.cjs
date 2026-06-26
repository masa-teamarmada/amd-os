#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadRawDataModule() {
  const sourcePath = path.join(process.cwd(), "src/lib/management-score/raw-data.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", output)(require, mod, mod.exports);
  return mod.exports;
}

const { classifyMeetingRetentionSignalForManagementScore } = loadRawDataModule();

const cryoXInternalRisk = classifyMeetingRetentionSignalForManagementScore({
  summary_short: "CryoXの出資タイミングを再検討し、100mK帯の技術実証、PoC、知財・創業株主設計を整える。",
  risks: [
    "100mK帯への安定到達を阻む原因が未特定で、リソース追加だけでは短期解決できない可能性がある。",
    "早すぎるエクイティ導入は、技術試行錯誤の速度を落とすリスクがある。",
  ],
});
assert.equal(cryoXInternalRisk.signalKey, "meeting:context");
assert.equal(cryoXInternalRisk.appliesToCompanyScore, false);
assert.equal(cryoXInternalRisk.signalScore, 0);

const contractRetentionRisk = classifyMeetingRetentionSignalForManagementScore({
  risks: [
    "次期契約の予算未確保により、AMDの支援継続が停止するリスクがある。",
  ],
});
assert.equal(contractRetentionRisk.signalKey, "meeting:retention_risk");
assert.equal(contractRetentionRisk.appliesToCompanyScore, true);
assert.ok(contractRetentionRisk.signalScore < 0);
assert.match(contractRetentionRisk.evidenceText || "", /予算未確保/);

const continuationPositive = classifyMeetingRetentionSignalForManagementScore({
  decided: [
    "来期も支援継続し、契約更新に向けて予算確保を進める。",
  ],
});
assert.equal(continuationPositive.signalKey, "meeting:retention_positive");
assert.equal(continuationPositive.appliesToCompanyScore, true);
assert.ok(continuationPositive.signalScore > 0);

console.log("management score retention classification ok");
