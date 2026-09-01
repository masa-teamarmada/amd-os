#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const cockpit = read("src/components/cockpit/CockpitView.tsx");
for (const anchor of [
  "hasInstitutionRegulationsTab",
  'activeTab === "regulations"',
  "InstitutionRegulationsPanel institutionId={resolvedInstitutionId}",
])
  if (!cockpit.includes(anchor))
    throw new Error(`CockpitView missing ${anchor}`);
console.log("kute regulations cockpit contract OK");
