import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import { SX_BUSINESS_PLAN_PHASES } from "../src/lib/sx-business-plan.ts";
import { createSxBusinessPlanPhaseMatrixXlsx } from "../src/lib/sx-business-plan-xlsx.ts";

const workbook = unzipSync(createSxBusinessPlanPhaseMatrixXlsx());
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

const injectionFixture = structuredClone(SX_BUSINESS_PLAN_PHASES);
injectionFixture[0]!.label = "=HYPERLINK(\"https://example.com\")";
const injectionSheet = strFromU8(unzipSync(createSxBusinessPlanPhaseMatrixXlsx(injectionFixture))["xl/worksheets/sheet1.xml"]!);
assert.match(injectionSheet, /&apos;=HYPERLINK/, "先頭が数式記号の文字列は式として出力しない");

console.log("sx business plan xlsx: ok");
