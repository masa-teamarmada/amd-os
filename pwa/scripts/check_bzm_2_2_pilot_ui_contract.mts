import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  BZM22_TOP_METRICS,
  formatMillionJpy,
  type Bzm22PilotProject,
} from "../src/lib/bzm-2-2-pilot-ui.ts";

const root = path.resolve(import.meta.dirname, "..");
const artifactPath = path.join(root, "bzm/pilot/bzm-2-2-all-pj-provisional-v0-1.json");
const generatedDirectory = path.join(root, "src/generated/bzm-2-2-pilot");
const manifestPath = path.join(generatedDirectory, "manifest.json");
const apiPath = path.join(root, "src/app/api/project/[projectId]/bzm-2-2-pilot/route.ts");
const loaderPath = path.join(root, "src/lib/bzm-2-2-pilot-ui.server.ts");
const componentPath = path.join(root, "src/components/cockpit/Bzm22ProvisionalObservatory.tsx");
const scoreDetailPath = path.join(root, "src/components/cockpit/CockpitAmdScoreDetailTab.tsx");
const cockpitSummaryPath = path.join(root, "src/components/cockpit/Bzm22CockpitSummary.tsx");
const cockpitVenturePath = path.join(root, "src/components/cockpit/CockpitVentureStatus.tsx");

const sha256 = (value: string | Buffer) =>
  crypto.createHash("sha256").update(value).digest("hex");
const requireText = (filePath: string) => fs.readFileSync(filePath, "utf8");
const requireIncludes = (text: string, snippets: string[], label: string) => {
  const missing = snippets.filter((snippet) => !text.includes(snippet));
  if (missing.length) throw new Error(`${label}: missing ${missing.join(" | ")}`);
};

const artifactRaw = requireText(artifactPath);
const artifactSha256 = sha256(artifactRaw);
const artifact = JSON.parse(artifactRaw) as {
  projectSummary: Array<{ projectIdAux: string; projectName: string }>;
};
const manifest = JSON.parse(requireText(manifestPath)) as {
  schemaVersion: string;
  artifactSha256: string;
  projects: Array<{ projectId: string; projectName: string; file: string }>;
};
if (manifest.schemaVersion !== "bzm2.2-pilot-ui-manifest/v1") {
  throw new Error("BZM 2.2 UI manifest schema mismatch");
}
if (manifest.artifactSha256 !== artifactSha256) {
  throw new Error("BZM 2.2 UI manifest artifact hash mismatch");
}
if (!Array.isArray(manifest.projects) || manifest.projects.length !== 12) {
  throw new Error(`BZM 2.2 UI manifest expected 12 projects, got ${manifest.projects?.length ?? "missing"}`);
}

const expectedSectionCounts: Record<string, number> = {
  version_horizon_rules: 14,
  decision_state: 17,
  action_bundle: 16,
  transition: 9,
  cashflow_ledger: 26,
  intervention: 8,
  derived_outputs: 13,
};
const expectedIdName = new Map(
  artifact.projectSummary.map((row) => [row.projectIdAux, row.projectName] as const),
);

const projectionResults: Array<{ projectId: string; bytes: number }> = [];
for (const row of manifest.projects) {
  const filePath = path.join(generatedDirectory, row.file);
  const raw = requireText(filePath);
  const projection = JSON.parse(raw) as Bzm22PilotProject;
  const minifiedBytes = Buffer.byteLength(JSON.stringify({ pilot: projection }));
  projectionResults.push({ projectId: row.projectId, bytes: minifiedBytes });
  if (minifiedBytes > 256 * 1024) {
    throw new Error(`${row.projectId}: member-only UI response exceeds 256 KiB (${minifiedBytes})`);
  }
  if (projection.artifactSha256 !== artifactSha256 || projection.projectId !== row.projectId) {
    throw new Error(`${row.projectId}: projection identity/hash mismatch`);
  }
  if (projection.projectName !== expectedIdName.get(row.projectId)) {
    throw new Error(`${row.projectId}: project name mismatch`);
  }
  const groupCounts = Object.fromEntries(projection.groups.map((group) => [group.key, group.parameters.length]));
  if (JSON.stringify(groupCounts) !== JSON.stringify(expectedSectionCounts)) {
    throw new Error(`${row.projectId}: 7-group parameter counts mismatch ${JSON.stringify(groupCounts)}`);
  }
  const parameters = projection.groups.flatMap((group) => group.parameters);
  if (parameters.length !== 103 || new Set(parameters.map((parameter) => parameter.id)).size !== 103) {
    throw new Error(`${row.projectId}: expected 103 unique parameter rows`);
  }
  for (const parameter of parameters) {
    for (const field of ["observedStatus", "imputed", "unit", "rule", "sourceRefs", "confidenceDriver", "usedInCalculation", "cutoff"]) {
      if (!(field in parameter)) throw new Error(`${row.projectId}/${parameter.id}: ${field} missing`);
    }
    if (!parameter.imputed || !["low", "base", "high"].every((scenario) => scenario in parameter.imputed)) {
      throw new Error(`${row.projectId}/${parameter.id}: L/B/H missing`);
    }
  }
  if (/https?:\/\//i.test(raw) || /rawBody|messageBody|emailAddress|accessToken|refreshToken/i.test(raw)) {
    throw new Error(`${row.projectId}: projection contains forbidden raw/URL surface`);
  }
}

const apiSource = requireText(apiPath);
requireIncludes(apiSource, [
  "requireMember()",
  'export const dynamic = "force-dynamic"',
  'export const runtime = "nodejs"',
  '"Cache-Control": "private, no-store, max-age=0"',
  'view === "summary"',
], "BZM 2.2 member API");

const loaderSource = requireText(loaderPath);
requireIncludes(loaderSource, [
  'import "server-only"',
  "PILOT_LOADERS",
  "parameter",
], "BZM 2.2 server-only loader");

const componentSource = requireText(componentPath);
requireIncludes(componentSource, [
  "BZM 2.2 暫定主表示",
  "全パラメータ台帳",
  "103項目",
  "順位付け、資源配分、撤退判断には使わない",
  "低位・基準・高位の試算",
  'data-testid="bzm22-provisional-primary"',
  'symbol="J"',
  'symbol="P"',
  'symbol="Q"',
  'symbol="S"',
  "<Tex tex={formula}",
  "ParameterMobileCards",
  "ParameterDesktopTable",
  "formatUnitValue",
  "formatUnitLabel",
], "BZM 2.2 observatory UI");
if (
  BZM22_TOP_METRICS.Q.title !== "基準到達指数"
  || BZM22_TOP_METRICS.S.title !== "逆風耐久指数"
  || !BZM22_TOP_METRICS.J.formula.startsWith("J=")
  || !BZM22_TOP_METRICS.P.formula.startsWith("P=")
) {
  throw new Error("BZM 2.2 top metric symbol/formula contract mismatch");
}
if (componentSource.includes("百万円")) {
  throw new Error("BZM 2.2 monetary UI must use ¥#,###M instead of 百万円");
}
if (
  formatMillionJpy(4009.5) !== "¥4,010M"
  || formatMillionJpy(-138.5) !== "-¥139M"
  || formatMillionJpy(0.49) !== "¥0M"
) {
  throw new Error("BZM 2.2 monetary UI rounding/format contract mismatch");
}
if (/generated\/bzm-2-2-pilot|bzm-2-2-all-pj-provisional-v0-1\.json/.test(componentSource)) {
  throw new Error("BZM 2.2 client component must not import generated/raw artifacts");
}

const cockpitSummarySource = requireText(cockpitSummaryPath);
requireIncludes(cockpitSummarySource, [
  'data-testid="cockpit-bzm22-primary"',
  "BZM22_TOP_METRICS",
  "?view=summary",
  'symbol="J"',
  'symbol="P"',
  'symbol="Q"',
  'symbol="S"',
  "103パラメータと計算を見る",
], "cockpit BZM 2.2 primary summary");
const cockpitVentureSource = requireText(cockpitVenturePath);
requireIncludes(cockpitVentureSource, [
  "Bzm22CockpitSummary",
  "SPS履歴（旧モデル）",
  "旧SPS履歴を開く",
  "legacyScoreHistoryOpen",
], "cockpit BZM 2.2 primary ordering");

const scoreDetailSource = requireText(scoreDetailPath);
requireIncludes(scoreDetailSource, [
  "Bzm22ProvisionalObservatory",
  "現行SPS / BZM 2.1",
  "BZM 2.0",
  "SPS 1.0 / Legacy AMD",
  "LazyArchiveDisclosure",
], "score-detail model ordering");
const bzm22Index = scoreDetailSource.indexOf("<Bzm22ProvisionalObservatory");
const currentSpsIndex = scoreDetailSource.indexOf('title="現行SPS / BZM 2.1"');
const bzm20Index = scoreDetailSource.indexOf('title="BZM 2.0"');
const legacyIndex = scoreDetailSource.indexOf('title="SPS 1.0 / Legacy AMD"');
if (!(bzm22Index >= 0 && bzm22Index < currentSpsIndex && currentSpsIndex < bzm20Index && bzm20Index < legacyIndex)) {
  throw new Error("score-detail model order must be BZM2.2 -> current SPS2.1 -> BZM2.0 -> BZM1.0/legacy");
}

console.log(JSON.stringify({
  ok: true,
  artifactSha256,
  projects: manifest.projects.length,
  parametersPerProject: 103,
  maxMinifiedResponseBytes: Math.max(...projectionResults.map((row) => row.bytes)),
}, null, 2));
