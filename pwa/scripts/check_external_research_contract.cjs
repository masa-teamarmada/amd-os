const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const migration = read("scripts/migrations/255_external_research_strategy_signals.sql");
assert.match(migration, /origin_kind TEXT NOT NULL DEFAULT 'internal'/);
assert.match(migration, /research_category TEXT/);
assert.match(migration, /UNIQUE INDEX[\s\S]*project_id, source_hash[\s\S]*origin_kind = 'external_research'/);

const applier = read("scripts/ms_progress_review_tool.mjs");
assert.match(applier, /external-research-check/);
assert.match(applier, /origin_kind=eq\.external_research&source_hash=eq/);
assert.match(applier, /writtenExternalKeys/);
assert.match(applier, /external research notification has no newly inserted signal/);

const data = read("src/lib/supabase-data.ts");
assert.match(data, /\.eq\("origin_kind", "internal"\)/);
assert.match(data, /\.eq\("origin_kind", "external_research"\)[\s\S]*\.eq\("status", "confirmed"\)/);

const cockpit = read("src/components/cockpit/CockpitStrategySignals.tsx");
assert.match(cockpit, /重要な動き/);
assert.match(cockpit, /採用リサーチ/);
assert.match(cockpit, /signal\.originKind === "external_research" && signal\.status === "confirmed"/);
assert.match(cockpit, /業界・市場/);
assert.match(cockpit, /助成金/);
assert.match(cockpit, /協業候補/);

const notifications = read("src/components/notifications/NotificationsClient.tsx");
assert.match(notifications, /yesLabel: "採用"/);
assert.match(notifications, /noLabel: "見送り"/);
assert.match(notifications, /origin_kind\) === "external_research"/);

const feedback = read("src/app/api/notifications/feedback/route.ts");
assert.match(feedback, /external research feedback requires signal_source_hash/);
assert.match(feedback, /external research candidate not found for notification hash/);

console.log("external research OS contract: ok");
