import assert from "node:assert/strict";
import {
  SHARED_PROJECT_PILLAR_KEYS,
  SharedProjectControlParseError,
  deriveSharedProjectControlView,
  parseSharedProjectControlPublication,
} from "../src/lib/shared-project-control.ts";

const PARTY = {
  studio: "00000000-0000-4000-8000-000000000001",
  startup: "00000000-0000-4000-8000-000000000002",
  research: "00000000-0000-4000-8000-000000000003",
  stranger: "00000000-0000-4000-8000-000000000099",
};

function item(itemKind, sourceTable, sourceId, payload, sourceVersion = 1) {
  return { itemKind, sourceTable, sourceId, sourceVersion, payload };
}

function controlItem({
  itemId,
  entityType = "milestone",
  sourceTable = "project_management_milestones",
  pillarKey = "business_development",
  label,
  state = "on_track",
  dueDate = "2026-08-20",
  ballPartyIds = [],
  jointDecision = false,
  criticalRank = null,
  dependencyItemIds = [],
  downstreamImpactLabel = null,
}) {
  return item("control_item.v1", sourceTable, itemId, {
    itemId,
    entityType,
    entityId: itemId,
    pillarKey,
    label: label ?? itemId,
    state,
    dueDate,
    ballPartyIds,
    jointDecision,
    criticalRank,
    dependencyItemIds,
    downstreamImpactLabel,
  });
}

function fixture() {
  return {
    state: "published",
    viewerPartyIds: [PARTY.studio],
    revision: {
      id: "00000000-0000-4000-8000-000000000010",
      number: 7,
      asOf: "2026-08-11T00:00:00.000Z",
      publishedAt: "2026-08-11T01:00:00.000Z",
      contentHash: "a".repeat(64),
    },
    items: [
      item("project_summary.v1", "projects", "p21", {
        projectId: "p21",
        projectName: "SolvioraX",
        asOf: "2026-08-11T00:00:00.000Z",
        lastVerifiedAt: "2026-07-20T00:00:00.000Z",
        verdict: { state: "attention", label: "要注意", reason: "共同判断の期限を確認" },
      }),
      item("party.v1", "project_organization_parties", PARTY.studio, { partyId: PARTY.studio, kind: "amd", displayLabel: "チームアルマダ" }),
      item("party.v1", "project_organization_parties", PARTY.startup, { partyId: PARTY.startup, kind: "startup", displayLabel: "SUチーム" }),
      item("party.v1", "project_organization_parties", PARTY.research, { partyId: PARTY.research, kind: "research", displayLabel: "研究機関" }),
      item("pillar.v1", "project_publication", "business_development", { key: "business_development", label: "事業開発", state: "attention", currentGateLabel: "有償PoC条件", nextDue: "2026-08-20", blockedCount: 0, unknownCount: 0 }),
      item("pillar.v1", "project_publication", "technology_development", { key: "technology_development", label: "技術開発", state: "on_track", currentGateLabel: "連続運転", nextDue: "2026-08-25", blockedCount: 0, unknownCount: 0 }),
      item("pillar.v1", "project_publication", "organizational_building", { key: "organizational_building", label: "体制構築", state: "unshared", currentGateLabel: null, nextDue: null, blockedCount: 0, unknownCount: 1 }),
      item("pillar.v1", "project_publication", "funding", { key: "funding", label: "資金調達", state: "blocked", currentGateLabel: "資金条件", nextDue: "2026-08-30", blockedCount: 1, unknownCount: 0 }),
      controlItem({ itemId: "gate-1", label: "PoC条件合意", criticalRank: 1, ballPartyIds: [PARTY.studio] }),
      controlItem({ itemId: "gate-2", label: "技術成立", pillarKey: "technology_development", criticalRank: 2, dependencyItemIds: ["gate-1"], ballPartyIds: [PARTY.studio, PARTY.startup] }),
      controlItem({ itemId: "gate-3", label: "設立判断", pillarKey: "organizational_building", criticalRank: 3, dependencyItemIds: ["gate-2"], ballPartyIds: [PARTY.research], downstreamImpactLabel: "会社設立" }),
      controlItem({ itemId: "unknown-1", entityType: "issue", sourceTable: "project_management_issues", label: "契約条件の確認", state: "unknown", dueDate: null, ballPartyIds: [] }),
    ],
  };
}

function parse(raw = fixture()) {
  const parsed = parseSharedProjectControlPublication(raw, {
    now: "2026-08-11T12:00:00.000Z",
    staleAfterDays: 14,
  });
  assert.ok(parsed && parsed.state === "published");
  return parsed;
}

// Strict publication parser: fixed source/revision and four pillars in canonical order.
{
  const { snapshot, viewerPartyIds } = parse();
  assert.equal(snapshot.publicationSourceId, "00000000-0000-4000-8000-000000000010");
  assert.equal(snapshot.revision, 7);
  assert.deepEqual(viewerPartyIds, [PARTY.studio]);
  assert.deepEqual(snapshot.pillars.map((pillar) => pillar.key), SHARED_PROJECT_PILLAR_KEYS);
  assert.equal(snapshot.pillars[2].state, "unshared");
  assert.equal(snapshot.pillars[2].currentGateLabel, null);
  assert.equal(snapshot.pillars[2].unknownCount, 1);
  assert.equal(snapshot.freshness.state, "stale");
  assert.equal(snapshot.freshness.ageDays, 22);
}

// No publication is explicit; authorization denial remains null and is never converted to empty.
{
  assert.equal(parseSharedProjectControlPublication(null), null);
  const unpublished = parseSharedProjectControlPublication({ state: "unpublished", projectId: "p21", viewerPartyIds: [PARTY.startup] });
  assert.deepEqual(unpublished, { state: "unpublished", projectId: "p21", viewerPartyIds: [PARTY.startup] });
}

// Role lens is exact-party based. Labels and kind never grant "my".
{
  const { snapshot } = parse();
  const studio = deriveSharedProjectControlView(snapshot, { partyIds: [PARTY.studio], label: "AMD", kind: "studio" });
  const startup = deriveSharedProjectControlView(snapshot, { partyIds: [PARTY.startup], label: "SU", kind: "startup" });
  const research = deriveSharedProjectControlView(snapshot, { partyIds: [PARTY.research], label: "研究機関", kind: "research" });
  const impostor = deriveSharedProjectControlView(snapshot, { partyIds: [PARTY.stranger], label: "SUチーム", kind: "startup" });

  assert.deepEqual(studio.buckets.my.map((entry) => entry.itemId), ["gate-1"]);
  assert.deepEqual(studio.buckets.joint.map((entry) => entry.itemId), ["gate-2"]);
  assert.deepEqual(studio.buckets.waiting.map((entry) => entry.itemId), ["gate-3"]);
  assert.deepEqual(startup.buckets.joint.map((entry) => entry.itemId), ["gate-2"]);
  assert.deepEqual(research.buckets.my.map((entry) => entry.itemId), ["gate-3"]);
  assert.deepEqual(impostor.buckets.my, []);
  for (const view of [studio, startup, research, impostor]) {
    assert.deepEqual(view.buckets.unknown.map((entry) => entry.itemId), ["unknown-1"]);
    const all = Object.values(view.buckets).flat().map((entry) => entry.itemId);
    assert.equal(all.length, snapshot.items.length);
    assert.equal(new Set(all).size, snapshot.items.length);
    assert.strictEqual(view.snapshot, snapshot);
  }

  const immutableFacts = (view) => view.snapshot.items.map(({ sourceId, sourceVersion, state, dueDate, dependencyItemIds }) => ({ sourceId, sourceVersion, state, dueDate, dependencyItemIds }));
  assert.deepEqual(immutableFacts(studio), immutableFacts(startup));
  assert.deepEqual(immutableFacts(startup), immutableFacts(research));
}

// Critical path keeps exact dependencies and exposes current -> next -> final.
{
  const { snapshot } = parse();
  assert.equal(snapshot.criticalPath.state, "valid");
  assert.deepEqual(snapshot.criticalPath.nodes.map((entry) => entry.itemId), ["gate-1", "gate-2", "gate-3"]);
  assert.equal(snapshot.criticalPath.currentItemId, "gate-1");
  assert.equal(snapshot.criticalPath.nextItemId, "gate-2");
  assert.equal(snapshot.criticalPath.finalItemId, "gate-3");
  assert.deepEqual(snapshot.criticalPath.nodes[2].dependencyItemIds, ["gate-2"]);
}

// Cancelled/rejected are terminal for path advancement, but remain explicit facts.
{
  const terminal = fixture();
  terminal.items.find((entry) => entry.payload?.itemId === "gate-1").payload.state = "cancelled";
  terminal.items.find((entry) => entry.payload?.itemId === "gate-2").payload.state = "rejected";
  const path = parse(terminal).snapshot.criticalPath;
  assert.deepEqual(path.nodes.map((entry) => entry.itemId), ["gate-1", "gate-2", "gate-3"]);
  assert.equal(path.currentItemId, "gate-3");
  assert.equal(path.nextItemId, null);
}

// Dangling and cyclic dependencies remain explicit invalid states; no path is invented.
{
  const dangling = fixture();
  dangling.items.find((entry) => entry.payload?.itemId === "gate-3").payload.dependencyItemIds = ["not-published"];
  const danglingSnapshot = parse(dangling).snapshot;
  assert.equal(danglingSnapshot.criticalPath.state, "invalid");
  assert.match(danglingSnapshot.criticalPath.reason, /依存先未共有/);
  assert.deepEqual(danglingSnapshot.criticalPath.visibleNodes, []);

  const cyclic = fixture();
  cyclic.items.find((entry) => entry.payload?.itemId === "gate-1").payload.dependencyItemIds = ["gate-3"];
  const cyclicSnapshot = parse(cyclic).snapshot;
  assert.equal(cyclicSnapshot.criticalPath.state, "invalid");
  assert.match(cyclicSnapshot.criticalPath.reason, /循環/);
}

// Rank conflicts are explicit invalid, while no ranked nodes is unregistered.
{
  const duplicate = fixture();
  duplicate.items.find((entry) => entry.payload?.itemId === "gate-2").payload.criticalRank = 1;
  assert.equal(parse(duplicate).snapshot.criticalPath.state, "invalid");
  const unregistered = fixture();
  for (const entry of unregistered.items.filter((candidate) => candidate.itemKind === "control_item.v1")) entry.payload.criticalRank = null;
  assert.equal(parse(unregistered).snapshot.criticalPath.state, "unregistered");
}

// Unknown keys and non-UUID ownership fail closed.
{
  const withSecret = fixture();
  withSecret.items[0].payload.internalNote = "do not expose";
  assert.throws(() => parse(withSecret), SharedProjectControlParseError);
  const inferredOwner = fixture();
  inferredOwner.items.find((entry) => entry.payload?.itemId === "gate-1").payload.ballPartyIds = ["manager"];
  assert.throws(() => parse(inferredOwner), SharedProjectControlParseError);
}

// The serialized client snapshot contains no forbidden secret-bearing keys.
{
  const serialized = JSON.stringify(parse().snapshot);
  for (const forbidden of ["memberId", "memberName", "email", "hours", "rawEvidence", "sourceRef", "sourceUrl", "internalNote", "financialDetail"]) {
    assert.ok(!serialized.includes(`\"${forbidden}\"`), `serialized snapshot must not contain ${forbidden}`);
  }
}

console.log("test_shared_project_control.mjs: OK");
