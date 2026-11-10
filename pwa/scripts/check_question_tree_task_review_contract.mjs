#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");

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

// 分かったこと（project_findings）の追加で書く列が、表に実在すること。
// 2026-11-10、表に無い origin_kind を書いていたため、画面からもえいみからも追加が400で失敗していた。
function findingColumnsFromMigrations() {
  const dirs = [path.join(root, "..", "ios", "supabase", "migrations"), path.join(root, "scripts", "migrations")];
  const columns = new Set();
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) {
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      const create = sql.match(/CREATE TABLE IF NOT EXISTS public\.project_findings \(([\s\S]*?)\n\);/);
      if (create) {
        for (const line of create[1].split("\n")) {
          const match = line.trim().match(/^([a-z_]+)\s/);
          if (match) columns.add(match[1]);
        }
      }
      for (const alter of sql.matchAll(/ALTER TABLE public\.project_findings([\s\S]*?);/g)) {
        for (const match of alter[1].matchAll(/ADD COLUMN IF NOT EXISTS ([a-z_]+)/g)) columns.add(match[1]);
      }
    }
  }
  return columns;
}

const findingColumns = findingColumnsFromMigrations();
if (!findingColumns.has("summary")) throw new Error("project_findings definition was not found in migrations");

const editableFinding = route.match(/  finding: \[([\s\S]*?)\],/);
if (!editableFinding) throw new Error("EDITABLE.finding is missing from the question-tree route");
const editableColumns = [...editableFinding[1].matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
// 追加時に経路が足す列（監査・承認待ち）。
const insertedColumns = ["project_id", "last_verified_at", "created_by", "updated_by", "review_state", "proposal_reason"];
for (const column of [...editableColumns, ...insertedColumns]) {
  if (!findingColumns.has(column)) throw new Error(`question-tree writes project_findings.${column}, but the table has no such column`);
}
if (!findingColumns.has("origin_kind")) {
  requireText(route, 'const ORIGIN_KIND_RESOURCES: Resource[] = ["question", "action"];', "origin_kind guard");
  requireText(route, "if (ORIGIN_KIND_RESOURCES.includes(resource)) {\n        insert.origin_kind", "origin_kind guarded write");
}

// 未承認の分かったことを承認できる場所があること（2026-11-10。追加は通っても画面に出ず、承認できなかった）。
const treeView = read("src/components/question-tree/QuestionTreeView.tsx");
const treeLib = read("src/lib/question-tree.ts");
requireText(treeView, 'renderProposedControls("finding", finding.id)', "proposed finding approval in question detail");
requireText(treeView, "分かったこと 未承認", "proposed finding marker on question row");
forbidText(treeLib, "allFindingRows.filter((row) => !isProposed(row))", "question-tree bundle");

console.log("question-tree standalone task review contract: OK");
