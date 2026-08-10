#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function expectIncludes(relativePath, needles) {
  const source = read(relativePath);
  const missing = needles.filter((needle) => !source.includes(needle));
  if (missing.length > 0) {
    throw new Error(
      `${relativePath} is missing KUTE regulations anchors: ${missing.join(", ")}`,
    );
  }
}

expectIncludes("src/components/cockpit/CockpitKuteRegulations.tsx", [
  'data-testid="kute-regulations-tab"',
  "契約対象の7規程",
  "大学発SUとの兼業規程",
  "知財取扱・大学発SUライセンス規程",
  "大学発SUへの出資・新株予約権規程",
  "大学発SUとの共同研究規程",
  "利益相反マネジメント規程",
  "大学発スタートアップ認定規程",
  "大学発SUの共有機器利用規程",
  "認定委員会内規",
  "大学発スタートアップ支援細則",
  "認定審査チェックシート",
  "S0は対象だけ確定、S4は決裁・施行待ち",
  "8月",
  "9/4",
  "9〜11月",
  "1月",
  "進捗順",
  "既存規程・原典",
  "版管理",
]);

expectIncludes("src/components/cockpit/CockpitView.tsx", [
  'project.projectId === "p25"',
  'key: "regulations" as const',
  "CockpitKuteRegulations",
]);

expectIncludes("src/app/(app)/project/[projectId]/cockpit/page.tsx", [
  'tabParam === "regulations"',
  'tab === "regulations"',
]);

console.log("kute regulations cockpit contract OK");
