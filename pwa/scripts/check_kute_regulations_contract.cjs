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
  "大学発スタートアップ認定規程",
  "認定委員会内規",
  "大学発スタートアップ支援細則",
  "認定審査チェックシート",
  "docxを開く",
  "期限はAMDの管理目標",
  "版管理フォルダ",
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
