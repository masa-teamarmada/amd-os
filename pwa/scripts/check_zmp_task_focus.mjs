#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  hasEffectiveActionOwner,
  isActionAssignmentMissing,
} from "../src/lib/question-tree-assignment.ts";

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const tasks = fs.readFileSync(path.join(repo, "pwa/src/components/cockpit/CockpitProjectTasks.tsx"), "utf8");
const workspace = fs.readFileSync(path.join(repo, "pwa/src/components/project-workspace/SxWeeklyControlDashboard.tsx"), "utf8");
const cockpit = fs.readFileSync(path.join(repo, "pwa/src/components/cockpit/CockpitView.tsx"), "utf8");
const page = fs.readFileSync(path.join(repo, "pwa/src/app/(app)/project/[projectId]/cockpit/page.tsx"), "utf8");
const tree = fs.readFileSync(path.join(repo, "pwa/src/lib/question-tree.ts"), "utf8");
const migration = fs.readFileSync(path.join(repo, "ios/supabase/migrations/20260917165000_zmp_rt_decision_gate.sql"), "utf8");

assert.match(tasks, /type TaskLane = "now" \| "week" \| "unassigned" \| "hold" \| "later"/);
assert.match(tasks, /heldActionIds\.has\(action\.id\)/);
assert.match(tasks, /action\.urgent \|\| action\.isOverdue \|\| action\.status === "blocked"/);
assert.match(tasks, /plannedEnd <= addDays\(asOf, 7\)/);
assert.match(tasks, /前提の判断待ち/);
assert.match(tasks, /判断待ちで保留/);
assert.match(tasks, /sm:grid-cols-5/);
assert.match(tasks, /projectId === "p19" \? "focus" : "all"/);
assert.match(tasks, /更新基準/);
assert.match(tasks, /freshnessText\(action\)/);
assert.match(tasks, /taskScope === "all"/);
assert.match(workspace, /const ZMP_WORKSPACE_TABS/);
assert.match(workspace, /isZmpWorkspace \? "tasks" : "weekly"/);
assert.match(cockpit, /project\.projectId !== "p19" \|\| group\.key !== "business-plan-group"/);
assert.match(page, /projectId === "p19"[\s\S]*\? "tasks"/);
assert.match(tree, /isActionAssignmentMissing\(owners, ownerLabel, plannedEnd\)/);
assert.equal(hasEffectiveActionOwner([], "まさ"), true);
assert.equal(hasEffectiveActionOwner([], "こたさん・早田さん"), true);
assert.equal(hasEffectiveActionOwner([], "あび（暫定）"), true);
assert.equal(hasEffectiveActionOwner([], "担当確定待ち"), false);
assert.equal(isActionAssignmentMissing([], "まさ", "2026-11-16"), false);
assert.equal(isActionAssignmentMissing([], "まさ", null), true);
assert.equal(isActionAssignmentMissing([{ memberId: "ID001" }], "担当未確認", "2026-11-16"), false);
assert.match(migration, /KRはRTを主催できるのか？/);
assert.match(migration, /KRのRT実施可否を確認する/);
assert.match(migration, /project_action_dependencies/);

console.log("ZMP task focus: OK");
