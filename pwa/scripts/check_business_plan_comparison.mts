import assert from "node:assert/strict";
import fs from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { BUSINESS_PLAN_FORMAT } from "../src/lib/project-formats.ts";
import { normalizeBusinessPlanPhases, businessPlanComparisonCell, businessPlanUnclassifiedActivities } from "../src/lib/project-business-plan.ts";
import { createBusinessPlanPhaseMatrixXlsx } from "../src/lib/project-business-plan-xlsx.ts";

const source = JSON.parse(fs.readFileSync(new URL("./data/sol-phase-comparison-20261007.json", import.meta.url), "utf8"));
const phases = normalizeBusinessPlanPhases(source.phases.map((p: Record<string, unknown>, i: number) => ({ ...p, label: `Phase ${i}`, targetXrl: {} })));
assert.equal(BUSINESS_PLAN_FORMAT.comparisonRows.length, 17);
assert.equal(new Set(BUSINESS_PLAN_FORMAT.comparisonRows.map(r => r.key)).size, 17);
let activityCount = 0;
for (const phase of phases) {
  const original = Object.values(phase.lanes).flatMap(lane => lane.activities);
  const classified = BUSINESS_PLAN_FORMAT.comparisonRows.flatMap(row => businessPlanComparisonCell(phase, row.key).activities);
  assert.deepEqual([...classified].sort(), [...original].sort(), "all activities occur exactly once");
  activityCount += original.length;
}
assert.equal(activityCount, 66);
const xml = strFromU8(unzipSync(createBusinessPlanPhaseMatrixXlsx(phases))["xl/worksheets/sheet1.xml"]);
for (const row of BUSINESS_PLAN_FORMAT.comparisonRows) assert.ok(xml.includes(row.label));
for (const phase of phases) for (const lane of Object.values(phase.lanes)) for (const activity of lane.activities) assert.ok(xml.includes(activity.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")));
const legacy = normalizeBusinessPlanPhases([{ id: "legacy", label: "Legacy", lanes: { technology: { activities: ["old", "", "new"], activityRowKeys: ["invalid", "quality", "researchValidation"] } } }])[0];
assert.deepEqual(businessPlanUnclassifiedActivities(legacy, "technology"), ["old"]);
assert.deepEqual(businessPlanComparisonCell(legacy, "researchValidation").activities, ["new"]);
assert.deepEqual(businessPlanComparisonCell(legacy, "quality").activities, []);
assert.ok(strFromU8(unzipSync(createBusinessPlanPhaseMatrixXlsx([legacy]))["xl/worksheets/sheet1.xml"]).includes("old"));
console.log("business-plan comparison: 17 rows, 66 activities, XLSX preservation, legacy/invalid mappings passed");
