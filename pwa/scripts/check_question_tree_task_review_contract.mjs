#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const taskTab = read("src/components/cockpit/CockpitProjectTasks.tsx");
const route = read("src/app/api/project/[projectId]/question-tree/route.ts");
const spec = read("spec/3-21-question-tree-current-spec.md");

function requireText(text, expected, label) {
  if (!text.includes(expected)) throw new Error(`${label} is missing: ${expected}`);
}

function forbidText(text, forbidden, label) {
  if (text.includes(forbidden)) throw new Error(`${label} still contains retired text: ${forbidden}`);
}

requireText(taskTab, 'mutateQuestionTree(projectId, "POST", {\n        resource: "proposal_bulk"', "task-tab approval request");
requireText(route, 'if (body.resource === "proposal_bulk")', "proposal review route");
requireText(spec, 'POST { resource: "proposal_bulk", decision, ids }', "goal-tree specification");
requireText(taskTab, "承認待ちのタスク", "task-tab label");
forbidText(taskTab, "論点や仮説には紐づけず", "task-tab explanation");
forbidText(route, "扱えない種類", "question-tree error");

console.log("question-tree standalone task review contract: OK");
