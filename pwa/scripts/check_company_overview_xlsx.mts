import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import { createCompanyOverviewXlsx } from "../src/lib/company-overview-xlsx.ts";
import { type CompanyOverviewData } from "../src/lib/company-overview.ts";

const fixture: CompanyOverviewData = {
  profile: null,
  shareholders: [],
  transactions: [],
  convertibles: [],
  financialPeriods: [],
  rounds: [],
  meetings: [],
  actionItems: [],
};

const bytes = createCompanyOverviewXlsx("テストPJ", fixture);
assert.ok(bytes.length > 0, "xlsx must not be empty");

const files = unzipSync(bytes);
const workbook = files["xl/workbook.xml"];
assert.ok(workbook, "workbook.xml must exist");

const expectedSheetNames = [
  "会社概要",
  "現在cap table",
  "株式イベント",
  "資本構成推移",
  "ラウンド別cap table",
  "調達・潜在株式",
  "年度決算",
];
const workbookXML = strFromU8(workbook);
const actualSheetNames = [...workbookXML.matchAll(/<sheet name="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(actualSheetNames, expectedSheetNames, "sheet names and order must stay identical to the PWA workbook");

const worksheetFiles = Object.keys(files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
assert.equal(worksheetFiles.length, expectedSheetNames.length, "xlsx must contain exactly seven worksheets");

console.log("company overview xlsx: ok");
