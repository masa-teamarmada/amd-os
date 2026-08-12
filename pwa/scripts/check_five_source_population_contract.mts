import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  FIVE_SOURCE_NAMES,
  assertPersistablePopulationArtifact,
  buildFiveSourcePopulationReport,
  enumerateVisibleSourcePopulation,
  type FiveSourceName,
  type SourceAdapter,
  type SourceIndexItem,
  type SourcePage,
} from "./lib/five_source_population_contract.mts";

const PROJECT_IDS = Array.from({ length: 12 }, (_, index) => `p${String(index + 1).padStart(2, "0")}`);
const FROM = "2026-01-01T00:00:00.000Z";
const TO = "2026-08-12T23:59:59.999Z";
const order: string[] = [];

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function sourceItem(source: FiveSourceName, id: string, scopeId: string, extra: Partial<SourceIndexItem> = {}): SourceIndexItem {
  const index = Number(id.replace(/\D/g, "")) || 0;
  return {
    id,
    scopeId,
    locator: `${source}:${scopeId}:${id}`,
    occurredAt: `2026-08-${String((index % 10) + 1).padStart(2, "0")}T00:00:00.000Z`,
    metadata: { projectHint: PROJECT_IDS[index % PROJECT_IDS.length] },
    ...extra,
  };
}
function pagedAdapter(source: FiveSourceName, scopeId: string, items: SourceIndexItem[], pageSize: number): SourceAdapter {
  return {
    source,
    initialScopes: [{ id: scopeId, kind: "root" }],
    async fetchPage(_scope, cursor) {
      const start = cursor ? Number(cursor) : 0;
      const next = start + pageSize;
      return { items: items.slice(start, next), nextCursor: next < items.length ? String(next) : null, eof: next >= items.length };
    },
  };
}
const options = {
  requestedFrom: FROM,
  requestedTo: TO,
  projectIds: PROJECT_IDS,
  hashKey: "fixture-only-secret-key",
  classify(item: Readonly<SourceIndexItem>) {
    order.push(`classify:${item.id}`);
    if (item.scopeId === "private-visible") {
      return { kind: "personal_private" as const, projectIds: [], confidence: "high" as const };
    }
    if (item.id.endsWith("11")) {
      return { kind: "multi_pj" as const, projectIds: [PROJECT_IDS[0], PROJECT_IDS[1]], confidence: "medium" as const };
    }
    const hint = item.metadata?.projectHint;
    return { kind: "project" as const, projectIds: [String(hint)], confidence: "high" as const };
  },
  async extractContent(item: Readonly<SourceIndexItem>) {
    order.push(`extract:${item.id}`);
    return { status: "fetched" as const, contentHash: digest(`content:${item.id}`), shortFeatures: ["safe_feature"] };
  },
};

const gmailItems = Array.from({ length: 63 }, (_, index) =>
  sourceItem("gmail", `g${index}`, "mailbox", { threadId: `thread-${Math.floor(index / 4)}` }),
);
gmailItems.splice(26, 0, { ...gmailItems[24] });
const driveItems = Array.from({ length: 205 }, (_, index) => sourceItem("drive", `d${index}`, "drive-visible"));
driveItems.splice(101, 0, { ...driveItems[99] });
const calendarItems = Array.from({ length: 101 }, (_, index) => sourceItem("calendar", `c${index}`, "calendar-primary"));

const slackAdapter: SourceAdapter = {
  source: "slack",
  initialScopes: [
    { id: "shared-channel", kind: "shared" },
    { id: "private-visible", kind: "private" },
    { id: "private-hidden", kind: "private" },
  ],
  async fetchPage(scope) {
    if (scope.id === "private-hidden") {
      return { items: [], nextCursor: null, eof: true, limitations: ["private_scope_not_authorized"] };
    }
    if (scope.id === "shared-channel") {
      return {
        items: [sourceItem("slack", "s1", scope.id, { threadId: "slack-thread-1" }), sourceItem("slack", "s2", scope.id)],
        nextCursor: null,
        eof: true,
        discoveredScopes: [{ id: "thread:slack-thread-1", kind: "thread_replies" }],
      };
    }
    if (scope.id === "thread:slack-thread-1") {
      return {
        items: [
          sourceItem("slack", "s1-reply-1", scope.id, { threadId: "slack-thread-1", parentId: "s1" }),
          sourceItem("slack", "s1-reply-2", scope.id, { threadId: "slack-thread-1", parentId: "s1" }),
        ],
        nextCursor: null,
        eof: true,
      };
    }
    return { items: [sourceItem("slack", "s-private", scope.id)], nextCursor: null, eof: true };
  },
};

const notionCalls = new Map<string, number>();
const notionAdapter: SourceAdapter = {
  source: "notion",
  initialScopes: [{ id: "notion-root", kind: "workspace_root" }],
  async fetchPage(scope, cursor): Promise<SourcePage> {
    notionCalls.set(scope.id, (notionCalls.get(scope.id) ?? 0) + 1);
    if (scope.id === "notion-root") {
      const start = cursor ? Number(cursor) : 0;
      const all = Array.from({ length: 125 }, (_, index) => sourceItem("notion", `n${index}`, scope.id));
      return {
        items: all.slice(start, start + 100),
        nextCursor: start + 100 < all.length ? String(start + 100) : null,
        eof: start + 100 >= all.length,
        discoveredScopes: start === 0 ? [{ id: "notion-child", kind: "child_blocks" }] : [],
      };
    }
    if (scope.id === "notion-child") {
      return {
        items: [sourceItem("notion", "n-child-1", scope.id, { parentId: "n0" })],
        nextCursor: null,
        eof: true,
        discoveredScopes: [{ id: "notion-grandchild", kind: "child_blocks" }],
      };
    }
    return { items: [sourceItem("notion", "n-grandchild-1", scope.id, { parentId: "n-child-1" })], nextCursor: null, eof: true };
  },
};

const results = [];
for (const adapter of [
  pagedAdapter("gmail", "mailbox", gmailItems, 25),
  pagedAdapter("drive", "drive-visible", driveItems, 100),
  pagedAdapter("calendar", "calendar-primary", calendarItems, 100),
  slackAdapter,
  notionAdapter,
]) results.push(await enumerateVisibleSourcePopulation(adapter, options));

const report = buildFiveSourcePopulationReport(results);
assert.deepEqual(Object.keys(report.sources).sort(), [...FIVE_SOURCE_NAMES].sort());
assert.equal(report.projectCount, 12);
assert.equal(report.status, "incomplete", "private visibility limits must remain visible");
assert.deepEqual(
  [report.sources.gmail.total, report.sources.gmail.fetched, report.sources.gmail.unique],
  [64, 63, 63],
);
assert.equal(report.sources.gmail.duplicateOccurrences, 1);
assert.equal(report.sources.gmail.invalidIndexItems, 0);
assert.ok(report.items.find((entry) => entry.source === "gmail")?.threadHash);
assert.deepEqual(
  [report.sources.drive.total, report.sources.drive.fetched, report.sources.drive.unique],
  [206, 205, 205],
);
assert.equal(report.sources.calendar.total, 101);
assert.ok(report.sources.slack.limitations.includes("private_scope_not_authorized"));
assert.ok(report.items.some((entry) => entry.source === "slack" && entry.parentHash));
assert.ok(report.items.some((entry) => entry.routing.kind === "personal_private"));
assert.ok(report.items.some((entry) => entry.routing.kind === "multi_pj"));
assert.equal(report.sources.notion.total, 127);
assert.equal(notionCalls.get("notion-root"), 2);
assert.equal(notionCalls.get("notion-child"), 1);
assert.equal(notionCalls.get("notion-grandchild"), 1);

for (const entry of report.items) {
  assert.match(entry.idHash, /^[a-f0-9]{64}$/);
  assert.equal("id" in entry, false);
  const rawId = entry.locator.split(":").at(-1);
  assert.ok(order.indexOf(`extract:${rawId}`) > order.indexOf(`classify:${rawId}`));
}

const incomplete = await enumerateVisibleSourcePopulation({
  source: "calendar",
  initialScopes: [{ id: "broken", kind: "calendar" }],
  async fetchPage(scope) {
    return { items: [sourceItem("calendar", "broken-1", scope.id)], nextCursor: null, eof: false };
  },
}, options);
assert.equal(incomplete.coverage.paginationComplete, false);
assert.equal(incomplete.coverage.status, "incomplete");
assert.ok(incomplete.coverage.limitations.includes("missing_next_cursor"));

const incompleteNotion = await enumerateVisibleSourcePopulation({
  source: "notion",
  initialScopes: [{ id: "root", kind: "workspace_root" }],
  async fetchPage(scope) {
    if (scope.id === "root") {
      return { items: [], nextCursor: null, eof: true, discoveredScopes: [{ id: "child", kind: "child_blocks" }] };
    }
    return { items: [], nextCursor: null, eof: false };
  },
}, options);
assert.equal(incompleteNotion.coverage.paginationComplete, false);
assert.equal(incompleteNotion.coverage.recursiveComplete, false);
assert.equal(incompleteNotion.coverage.status, "failed");

assert.throws(() => assertPersistablePopulationArtifact({ body: "forbidden" }), /forbidden/);
assert.throws(() => assertPersistablePopulationArtifact({ shortFeatures: ["https://example.invalid/raw"] }), /URL or email/);
console.log(JSON.stringify({ ok: true, status: report.status, sources: report.sources }));
