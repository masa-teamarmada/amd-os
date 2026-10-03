import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import { SX_BUSINESS_PLAN_PHASES } from "../src/lib/sx-business-plan.ts";
import { normalizeBusinessPlanPhases } from "../src/lib/project-business-plan.ts";
import { createBusinessPlanPhaseMatrixXlsx } from "../src/lib/project-business-plan-xlsx.ts";

// フェーズマトリクスの Excel 出力は全PJ同じ形（spec 3-23）。中身は project_business_plans の phases_json を
// 画面と同じ読み直し（normalizeBusinessPlanPhases）に通したもの。ここでは SOL の移行元データを見本に使う。
const phases = normalizeBusinessPlanPhases(structuredClone(SX_BUSINESS_PLAN_PHASES));
assert.equal(phases.length, SX_BUSINESS_PLAN_PHASES.length, "移行元のフェーズを1つも落とさない");
const workbook = unzipSync(createBusinessPlanPhaseMatrixXlsx(phases));
assert.ok(workbook["xl/workbook.xml"], "xlsx workbook XMLを含む");
assert.ok(workbook["xl/worksheets/sheet1.xml"], "フェーズマトリクスのシートを含む");
const sheet = strFromU8(workbook["xl/worksheets/sheet1.xml"]!);

assert.match(sheet, /xSplit="1" ySplit="2"/, "先頭列とヘッダーを固定する");
assert.match(sheet, /フェーズマトリクス/, "表題を出力する");
assert.match(sheet, /開発レーン/, "レーン列見出しを出力する");
assert.match(sheet, /事業開発/, "4開発レーンを出力する");
assert.match(sheet, /出口条件：/, "出口条件を出力する");
assert.match(sheet, /到達XRL：/, "到達XRLを出力する");
assert.match(sheet, /固定費バーン上限/, "フェーズ資金条件を出力する");

const injectionFixture = structuredClone(phases);
injectionFixture[0]!.label = "=HYPERLINK(\"https://example.com\")";
const injectionSheet = strFromU8(unzipSync(createBusinessPlanPhaseMatrixXlsx(injectionFixture))["xl/worksheets/sheet1.xml"]!);
assert.match(injectionSheet, /&apos;=HYPERLINK/, "先頭が数式記号の文字列は式として出力しない");

console.log("business plan phase matrix xlsx: ok");
