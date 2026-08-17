#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const compatibility = read("src/components/cockpit/CockpitKuteRegulations.tsx");
const cockpit = read("src/components/cockpit/CockpitView.tsx");
if (
  !compatibility.includes(
    'InstitutionRegulationsPanel institutionId="inst_kute"',
  )
)
  throw new Error("KUTE must use the shared institution regulation ledger");
for (const anchor of [
  'project.projectId === "p25"',
  'key: "regulations" as const',
  "CockpitKuteRegulations",
])
  if (!cockpit.includes(anchor))
    throw new Error(`CockpitView missing ${anchor}`);
console.log("kute regulations cockpit contract OK");
