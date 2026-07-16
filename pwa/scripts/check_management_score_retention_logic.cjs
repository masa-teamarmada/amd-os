#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const tsModuleCache = new Map();

function resolveTsModule(request, fromPath) {
  if (!request.startsWith("@/") && !request.startsWith(".")) return null;
  const base = request.startsWith("@/")
    ? path.join(process.cwd(), "src", request.slice(2))
    : path.resolve(path.dirname(fromPath), request);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function loadTsModule(relativePath) {
  const sourcePath = path.isAbsolute(relativePath) ? relativePath : path.join(process.cwd(), relativePath);
  const cached = tsModuleCache.get(sourcePath);
  if (cached) return cached.exports;
  const source = fs.readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  tsModuleCache.set(sourcePath, mod);
  const localRequire = (request) => {
    const resolvedTs = resolveTsModule(request, sourcePath);
    if (resolvedTs) return loadTsModule(resolvedTs);
    return require(request);
  };
  new Function("require", "module", "exports", output)(localRequire, mod, mod.exports);
  return mod.exports;
}

const {
  classifyMeetingRetentionSignalForManagementScore,
  isManagementScoreRetentionProgressEligible,
  isPmLockedProgressSource,
} = loadTsModule("src/lib/management-score/raw-data.ts");
const { estimateRetentionProgressImpact } = loadTsModule("src/lib/management-score/calculate.ts");

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

assert.equal(isPmLockedProgressSource("routine_auto"), false);
assert.equal(isPmLockedProgressSource("pm_confirmed"), true);
assert.deepEqual(
  isManagementScoreRetentionProgressEligible(
    { milestone_key: "MS-p19-contract-delivery", source: "pm_confirmed" },
    { milestone_id: "MS-p19-contract-delivery", title: "契約納品", points: 10, is_active: true },
    { plan_cycle_id: "PC-p19-202606", project_id: "p19", status: "active" },
  ),
  { eligible: true, reason: "PM locked かつ契約履行・会社継続の補助材料として扱えるMS進捗" },
);
assert.equal(
  isManagementScoreRetentionProgressEligible(
    { milestone_key: "MS-p19-routine", source: "routine_auto" },
    { milestone_id: "MS-p19-routine", title: "契約納品", points: 10, is_active: true },
    { plan_cycle_id: "PC-p19-202606", project_id: "p19", status: "active" },
  ).eligible,
  false,
);
assert.equal(
  isManagementScoreRetentionProgressEligible(
    { milestone_key: "MS-p00-internal", source: "pm_confirmed" },
    { milestone_id: "MS-p00-internal", title: "AMD OS 内部運用MS", points: 0, is_active: true },
    { plan_cycle_id: "PC-p00-202606", project_id: "p00", status: "active" },
  ).eligible,
  false,
);
assert.equal(
  isManagementScoreRetentionProgressEligible(
    { milestone_key: "MS-p19-old-routine", source: "pm_confirmed" },
    { milestone_id: "MS-p19-old-routine", title: "廃止済み月次ルーティン", points: 5, is_active: false },
    { plan_cycle_id: "PC-p19-202606", project_id: "p19", status: "active" },
  ).eligible,
  false,
);

const progressRows = [
  { source_id: "mp1", signal_value_numeric: 90, payload: { milestone_key: "MS-a" } },
  { source_id: "mp2", signal_value_numeric: 70, payload: { milestone_key: "MS-b" } },
  { source_id: "mp3", signal_value_numeric: 40, payload: { milestone_key: "MS-c" } },
];
assert.equal(estimateRetentionProgressImpact(progressRows[0], progressRows, 200 / 3), 4.1);

console.log("management score retention classification ok");
