#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const writer = read("scripts/ms_progress_review_tool.mjs");
assert.match(writer, /validDestinationKinds = new Set\(\["bzm_textbook", "management_knowledge"\]\)/);
assert.match(writer, /destination_kind は practice_kind から推測しない/);
assert.match(writer, /destinationKind === "management_knowledge"/);
assert.match(writer, /💡 経営ノウハウ追加候補/);

const feedback = read("src/app/api/notifications/feedback/route.ts");
assert.match(feedback, /saveManagementKnowledgeFromTextbookCandidate/);
assert.match(feedback, /from\("management_knowledge_entries"\)/);
assert.match(feedback, /destination_kind: "management_knowledge"/);
assert.match(feedback, /status: "applied"/);
assert.match(feedback, /source_ref: sourceRef/);

const applier = read("scripts/apply_approved_textbook_insights.mjs");
assert.match(applier, /destination_kind is management_knowledge; this local BZM applier must not write it/);

const destinationMigration = read("scripts/migrations/193_textbook_insight_management_destination.sql");
assert.match(destinationMigration, /ALTER COLUMN target_bzm_slug DROP NOT NULL/);

const notifications = read("src/components/notifications/NotificationsClient.tsx");
assert.match(notifications, /経営ノウハウに追加/);
assert.match(notifications, /管理 → 経営ノウハウ/);
assert.match(notifications, /textbookChangeSummary\(i\)/);
assert.match(notifications, /management_reusable_when/);

console.log("textbook destination contract: ok");
