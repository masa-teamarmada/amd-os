#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const tasks = fs.readFileSync(path.join(repo, "pwa/src/components/cockpit/CockpitProjectTasks.tsx"), "utf8");
const workspace = fs.readFileSync(path.join(repo, "pwa/src/components/project-workspace/SxWeeklyControlDashboard.tsx"), "utf8");
const cockpit = fs.readFileSync(path.join(repo, "pwa/src/components/cockpit/CockpitView.tsx"), "utf8");
const page = fs.readFileSync(path.join(repo, "pwa/src/app/(app)/project/[projectId]/cockpit/page.tsx"), "utf8");

assert.match(tasks, /type TaskLane = "now" \| "week" \| "unassigned" \| "later"/);
assert.match(tasks, /action\.urgent \|\| action\.isOverdue \|\| action\.status === "blocked"/);
assert.match(tasks, /plannedEnd <= addDays\(asOf, 7\)/);
assert.match(tasks, /projectId === "p19" \? "focus" : "all"/);
assert.match(tasks, /更新基準/);
assert.match(tasks, /freshnessText\(action\)/);
assert.match(tasks, /taskScope === "all"/);
assert.match(workspace, /const ZMP_WORKSPACE_TABS/);
assert.match(workspace, /isZmpWorkspace \? "tasks" : "weekly"/);
assert.match(cockpit, /project\.projectId !== "p19" \|\| group\.key !== "business-plan-group"/);
assert.match(page, /projectId === "p19"[\s\S]*\? "tasks"/);

console.log("ZMP task focus: OK");
