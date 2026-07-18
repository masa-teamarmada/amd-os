const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const route = read("src/app/api/media-mentions/extract/route.ts");
const feedback = read("src/app/api/notifications/feedback/route.ts");
const dashboard = read("src/app/(app)/dashboard/page.tsx");
const monthly = read("src/app/api/project/monthly-report-print/route.ts");

assert.match(route, /POST \/api\/media-mentions\/extract/);
assert.match(route, /mentions\[\] \(1\.\.100\) required/);
assert.match(route, /createHash\("sha256"\)/);
assert.match(route, /function deterministicMentionId/);
assert.match(route, /id: mentionId/);
assert.match(route, /insertError\?\.code === "23505"/);
assert.match(route, /\.eq\("source_url", candidate\.source_url\)/);
assert.match(route, /verified: false/);
assert.match(route, /dismissed: false/);
assert.match(route, /l2_kind: "news_mention"/);
assert.match(route, /scope_key: `media:\$\{mention\.id\}`/);
assert.match(feedback, /args\.l2Kind === "news_mention"/);
assert.match(feedback, /updateMediaMentionReviewStatus/);
assert.match(dashboard, /\.eq\("verified", true\)/);
assert.match(monthly, /\.eq\("verified", true\)/);
console.log("media mention candidate contract: ok");
