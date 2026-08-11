/**
 * Pure, client-safe contract for the immutable shared project publication.
 *
 * This module deliberately knows nothing about sessions, email addresses, member names, roles, or
 * Supabase. A server loader must resolve exact project-party UUIDs and pass the RPC result here.
 */

export const SHARED_PROJECT_PILLAR_KEYS = [
  "business_development",
  "technology_development",
  "organizational_building",
  "funding",
] as const;

export type SharedProjectPillarKey = (typeof SHARED_PROJECT_PILLAR_KEYS)[number];
export type SharedProjectPartyKind = "amd" | "startup" | "research";
export type SharedProjectViewerKind = "studio" | "startup" | "research" | "unknown";
export type SharedProjectVerdictState = "on_track" | "attention" | "critical" | "unknown";
export type SharedProjectFreshnessState = "current" | "stale" | "unknown";
export type SharedProjectControlBucketKey = "my" | "joint" | "waiting" | "unknown";

export const SHARED_PROJECT_CONTROL_BUCKET_ORDER = ["my", "joint", "waiting", "unknown"] as const;

export const SHARED_PROJECT_CONTROL_ENTITY_TYPES = [
  "milestone",
  "issue",
  "decision",
  "action",
  "partner_work_item",
] as const;

export type SharedProjectControlEntityType = (typeof SHARED_PROJECT_CONTROL_ENTITY_TYPES)[number];

const CONTROL_STATES = [
  "active",
  "accepted",
  "accepted_done",
  "at_risk",
  "attention",
  "blocked",
  "cancelled",
  "closed",
  "committed",
  "completed",
  "confirmed",
  "critical",
  "decided",
  "deferred",
  "failed",
  "filled",
  "in_progress",
  "missing",
  "monitoring",
  "not_started",
  "on_hold",
  "on_track",
  "open",
  "passed",
  "pending",
  "planned",
  "proposed",
  "rejected",
  "running",
  "submitted",
  "unassessed",
  "unshared",
  "unknown",
  "validated",
  "validating",
  "waiting",
] as const;

export type SharedProjectControlState = (typeof CONTROL_STATES)[number];

export type ViewerLens = {
  /** Exact server-resolved project party IDs. Never derive these from role, email, or names. */
  partyIds: string[];
  label: string;
  kind: SharedProjectViewerKind;
};

export type SharedProjectFreshness = {
  state: SharedProjectFreshnessState;
  ageDays: number | null;
  staleAfterDays: number;
};

export type SharedProjectParty = {
  partyId: string;
  sourceId: string;
  sourceVersion: number;
  kind: SharedProjectPartyKind;
  displayLabel: string;
};

export type SharedProjectPillar = {
  sourceId: string;
  sourceVersion: number;
  key: SharedProjectPillarKey;
  label: string;
  state: SharedProjectControlState;
  currentGateLabel: string | null;
  nextDue: string | null;
  blockedCount: number;
  unknownCount: number;
};

export type SharedProjectControlItem = {
  sourceId: string;
  sourceVersion: number;
  itemId: string;
  entityType: SharedProjectControlEntityType;
  entityId: string;
  pillarKey: SharedProjectPillarKey;
  label: string;
  state: SharedProjectControlState;
  dueDate: string | null;
  ballPartyIds: string[];
  jointDecision: boolean;
  criticalRank: number | null;
  dependencyItemIds: string[];
  downstreamImpactLabel: string | null;
};

export type SharedProjectCriticalPath = {
  state: "valid" | "unregistered" | "invalid";
  reason: string | null;
  nodes: SharedProjectControlItem[];
  currentItemId: string | null;
  nextItemId: string | null;
  finalItemId: string | null;
  /** Current, next, and final nodes with duplicate IDs removed, in critical-path order. */
  visibleNodes: SharedProjectControlItem[];
};

export type SharedProjectControlSnapshot = {
  publicationSourceId: string;
  revision: number;
  contentHash: string;
  projectSourceId: string;
  projectSourceVersion: number;
  projectId: string;
  projectName: string;
  asOf: string;
  publishedAt: string;
  lastVerifiedAt: string | null;
  freshness: SharedProjectFreshness;
  verdict: {
    state: SharedProjectVerdictState;
    label: string;
    reason: string;
  };
  parties: SharedProjectParty[];
  pillars: [SharedProjectPillar, SharedProjectPillar, SharedProjectPillar, SharedProjectPillar];
  items: SharedProjectControlItem[];
  criticalPath: SharedProjectCriticalPath;
};

export type SharedProjectControlPublication =
  | null
  | {
      state: "unpublished";
      projectId: string;
      viewerPartyIds: string[];
    }
  | {
      state: "published";
      snapshot: SharedProjectControlSnapshot;
      viewerPartyIds: string[];
    };

export type SharedProjectControlParseOptions = {
  /** Inject in tests and scheduled work. Defaults to the caller's current instant. */
  now?: string | Date;
  /** Product policy, not a fact from the publication. */
  staleAfterDays?: number;
};

export type SharedProjectControlView = {
  snapshot: SharedProjectControlSnapshot;
  lens: ViewerLens;
  buckets: Record<SharedProjectControlBucketKey, SharedProjectControlItem[]>;
};

export class SharedProjectControlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SharedProjectControlParseError";
  }
}

type JsonRecord = Record<string, unknown>;
type PublicationEnvelope = {
  itemKind: "project_summary.v1" | "party.v1" | "pillar.v1" | "control_item.v1";
  sourceTable: string;
  sourceId: string;
  sourceVersion: number;
  payload: JsonRecord;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_RE = /^[0-9a-f]{64}$/;
const MILLISECONDS_PER_DAY = 86_400_000;
const DEFAULT_STALE_AFTER_DAYS = 14;

const ENTITY_SOURCE_TABLE: Record<SharedProjectControlEntityType, string> = {
  milestone: "project_management_milestones",
  issue: "project_management_issues",
  decision: "project_management_decisions",
  action: "project_management_action_items",
  partner_work_item: "project_management_partner_work_items",
};

const TERMINAL_CONTROL_STATES = new Set<SharedProjectControlState>([
  "accepted_done",
  "cancelled",
  "closed",
  "completed",
  "confirmed",
  "decided",
  "filled",
  "passed",
  "rejected",
  "validated",
]);

function fail(path: string, message: string): never {
  throw new SharedProjectControlParseError(`${path}: ${message}`);
}

function record(value: unknown, path: string, allowedKeys: readonly string[], requiredKeys = allowedKeys): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "object required");
  const result = value as JsonRecord;
  const keys = Object.keys(result);
  for (const key of keys) if (!allowedKeys.includes(key)) fail(path, `unknown key ${key}`);
  for (const key of requiredKeys) if (!Object.prototype.hasOwnProperty.call(result, key)) fail(path, `missing key ${key}`);
  return result;
}

function openRecord(value: unknown, path: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "object required");
  return value as JsonRecord;
}

function stringValue(value: unknown, path: string, maxLength = 500): string {
  if (typeof value !== "string") fail(path, "string required");
  const normalized = value.trim();
  if (!normalized) fail(path, "non-empty string required");
  if (normalized.length > maxLength) fail(path, `must be at most ${maxLength} characters`);
  return normalized;
}

function nullableString(value: unknown, path: string, maxLength = 500): string | null {
  if (value === null) return null;
  return stringValue(value, path, maxLength);
}

function enumValue<const T extends readonly string[]>(value: unknown, allowed: T, path: string): T[number] {
  const parsed = stringValue(value, path, 80);
  if (!allowed.includes(parsed)) fail(path, `unsupported value ${parsed}`);
  return parsed as T[number];
}

function integerValue(value: unknown, path: string, minimum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    fail(path, `integer >= ${minimum} required`);
  }
  return value;
}

function nullablePositiveInteger(value: unknown, path: string): number | null {
  if (value === null) return null;
  return integerValue(value, path, 1);
}

function isoDateValue(value: unknown, path: string): string {
  const parsed = stringValue(value, path, 40);
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(parsed) || !Number.isFinite(Date.parse(parsed))) {
    fail(path, "valid ISO date or timestamp required");
  }
  return parsed;
}

function nullableIsoDate(value: unknown, path: string): string | null {
  if (value === null) return null;
  return isoDateValue(value, path);
}

function uuidValue(value: unknown, path: string): string {
  const parsed = stringValue(value, path, 36);
  if (!UUID_RE.test(parsed)) fail(path, "UUID required");
  return parsed.toLowerCase();
}

function uniqueStringArray(value: unknown, path: string, kind: "uuid" | "id"): string[] {
  if (!Array.isArray(value)) fail(path, "array required");
  const parsed = value.map((entry, index) =>
    kind === "uuid" ? uuidValue(entry, `${path}[${index}]`) : stringValue(entry, `${path}[${index}]`, 200),
  );
  if (new Set(parsed).size !== parsed.length) fail(path, "duplicate values are not allowed");
  return parsed;
}

function parseViewerPartyIds(value: unknown, path: string): string[] {
  const ids = uniqueStringArray(value, path, "uuid");
  if (ids.length === 0) fail(path, "at least one exact project party is required");
  return ids;
}

function parseEnvelope(value: unknown, index: number): PublicationEnvelope {
  const path = `publication.items[${index}]`;
  const item = record(value, path, ["itemKind", "sourceTable", "sourceId", "sourceVersion", "payload"]);
  return {
    itemKind: enumValue(item.itemKind, ["project_summary.v1", "party.v1", "pillar.v1", "control_item.v1"] as const, `${path}.itemKind`),
    sourceTable: stringValue(item.sourceTable, `${path}.sourceTable`, 120),
    sourceId: stringValue(item.sourceId, `${path}.sourceId`, 200),
    sourceVersion: integerValue(item.sourceVersion, `${path}.sourceVersion`, 1),
    payload: openRecord(item.payload, `${path}.payload`),
  };
}

export function deriveSharedProjectFreshness(
  lastVerifiedAt: string | null,
  options: { now: string | Date; staleAfterDays: number },
): SharedProjectFreshness {
  if (!Number.isInteger(options.staleAfterDays) || options.staleAfterDays < 0) {
    fail("freshness.staleAfterDays", "non-negative integer required");
  }
  if (lastVerifiedAt === null) return { state: "unknown", ageDays: null, staleAfterDays: options.staleAfterDays };
  const verifiedMs = Date.parse(isoDateValue(lastVerifiedAt, "freshness.lastVerifiedAt"));
  const nowValue = options.now instanceof Date ? options.now.toISOString() : isoDateValue(options.now, "freshness.now");
  const nowMs = Date.parse(nowValue);
  const ageDays = Math.max(0, Math.floor((nowMs - verifiedMs) / MILLISECONDS_PER_DAY));
  return {
    state: ageDays > options.staleAfterDays ? "stale" : "current",
    ageDays,
    staleAfterDays: options.staleAfterDays,
  };
}

function parseProjectSummary(envelope: PublicationEnvelope) {
  const path = "project_summary.v1";
  if (envelope.sourceTable !== "projects") fail(path, "sourceTable must be projects");
  const payload = record(envelope.payload, path, ["projectId", "projectName", "asOf", "lastVerifiedAt", "verdict"]);
  const verdict = record(payload.verdict, `${path}.verdict`, ["state", "label", "reason"]);
  const projectId = stringValue(payload.projectId, `${path}.projectId`, 120);
  if (envelope.sourceId !== projectId) fail(path, "sourceId must equal projectId");
  return {
    sourceId: envelope.sourceId,
    sourceVersion: envelope.sourceVersion,
    projectId,
    projectName: stringValue(payload.projectName, `${path}.projectName`, 200),
    asOf: isoDateValue(payload.asOf, `${path}.asOf`),
    lastVerifiedAt: nullableIsoDate(payload.lastVerifiedAt, `${path}.lastVerifiedAt`),
    verdict: {
      state: enumValue(verdict.state, ["on_track", "attention", "critical", "unknown"] as const, `${path}.verdict.state`),
      label: stringValue(verdict.label, `${path}.verdict.label`, 80),
      reason: stringValue(verdict.reason, `${path}.verdict.reason`, 500),
    },
  };
}

function parseParty(envelope: PublicationEnvelope, index: number): SharedProjectParty {
  const path = `party.v1[${index}]`;
  if (envelope.sourceTable !== "project_organization_parties") fail(path, "invalid sourceTable");
  const payload = record(envelope.payload, path, ["partyId", "kind", "displayLabel"]);
  const partyId = uuidValue(payload.partyId, `${path}.partyId`);
  if (envelope.sourceId.toLowerCase() !== partyId) fail(path, "sourceId must equal partyId");
  return {
    partyId,
    sourceId: envelope.sourceId,
    sourceVersion: envelope.sourceVersion,
    kind: enumValue(payload.kind, ["amd", "startup", "research"] as const, `${path}.kind`),
    displayLabel: stringValue(payload.displayLabel, `${path}.displayLabel`, 120),
  };
}

function parsePillar(envelope: PublicationEnvelope, index: number): SharedProjectPillar {
  const path = `pillar.v1[${index}]`;
  if (envelope.sourceTable !== "project_publication") fail(path, "invalid sourceTable");
  const payload = record(envelope.payload, path, ["key", "label", "state", "currentGateLabel", "nextDue", "blockedCount", "unknownCount"]);
  return {
    sourceId: envelope.sourceId,
    sourceVersion: envelope.sourceVersion,
    key: enumValue(payload.key, SHARED_PROJECT_PILLAR_KEYS, `${path}.key`),
    label: stringValue(payload.label, `${path}.label`, 80),
    state: enumValue(payload.state, CONTROL_STATES, `${path}.state`),
    currentGateLabel: nullableString(payload.currentGateLabel, `${path}.currentGateLabel`, 200),
    nextDue: nullableIsoDate(payload.nextDue, `${path}.nextDue`),
    blockedCount: integerValue(payload.blockedCount, `${path}.blockedCount`, 0),
    unknownCount: integerValue(payload.unknownCount, `${path}.unknownCount`, 0),
  };
}

function parseControlItem(envelope: PublicationEnvelope, index: number): SharedProjectControlItem {
  const path = `control_item.v1[${index}]`;
  const payload = record(
    envelope.payload,
    path,
    ["itemId", "entityType", "entityId", "pillarKey", "label", "state", "dueDate", "ballPartyIds", "jointDecision", "criticalRank", "dependencyItemIds", "downstreamImpactLabel"],
    ["itemId", "entityType", "entityId", "pillarKey", "label", "state", "dueDate", "ballPartyIds", "jointDecision", "criticalRank", "dependencyItemIds"],
  );
  const entityType = enumValue(payload.entityType, SHARED_PROJECT_CONTROL_ENTITY_TYPES, `${path}.entityType`);
  if (ENTITY_SOURCE_TABLE[entityType] !== envelope.sourceTable) fail(path, "entityType and sourceTable disagree");
  if (typeof payload.jointDecision !== "boolean") fail(`${path}.jointDecision`, "boolean required");
  return {
    sourceId: envelope.sourceId,
    sourceVersion: envelope.sourceVersion,
    itemId: stringValue(payload.itemId, `${path}.itemId`, 200),
    entityType,
    entityId: stringValue(payload.entityId, `${path}.entityId`, 200),
    pillarKey: enumValue(payload.pillarKey, SHARED_PROJECT_PILLAR_KEYS, `${path}.pillarKey`),
    label: stringValue(payload.label, `${path}.label`, 240),
    state: enumValue(payload.state, CONTROL_STATES, `${path}.state`),
    dueDate: nullableIsoDate(payload.dueDate, `${path}.dueDate`),
    ballPartyIds: uniqueStringArray(payload.ballPartyIds, `${path}.ballPartyIds`, "uuid"),
    jointDecision: payload.jointDecision,
    criticalRank: nullablePositiveInteger(payload.criticalRank, `${path}.criticalRank`),
    dependencyItemIds: uniqueStringArray(payload.dependencyItemIds, `${path}.dependencyItemIds`, "id"),
    downstreamImpactLabel: Object.prototype.hasOwnProperty.call(payload, "downstreamImpactLabel")
      ? nullableString(payload.downstreamImpactLabel, `${path}.downstreamImpactLabel`, 300)
      : null,
  };
}

function graphProblem(items: SharedProjectControlItem[]): string | null {
  const itemById = new Map(items.map((item) => [item.itemId, item]));
  for (const item of items) {
    for (const dependencyId of item.dependencyItemIds) {
      if (dependencyId === item.itemId) return `循環依存: ${item.label}`;
      if (!itemById.has(dependencyId)) return `依存先未共有: ${item.label}`;
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const hasCycle = (itemId: string): boolean => {
    if (visiting.has(itemId)) return true;
    if (visited.has(itemId)) return false;
    visiting.add(itemId);
    const item = itemById.get(itemId);
    if (item?.dependencyItemIds.some(hasCycle)) return true;
    visiting.delete(itemId);
    visited.add(itemId);
    return false;
  };
  return items.some((item) => hasCycle(item.itemId)) ? "重要経路の依存関係が循環" : null;
}

export function deriveSharedProjectCriticalPath(items: SharedProjectControlItem[]): SharedProjectCriticalPath {
  const ranked = items
    .filter((item) => item.criticalRank !== null)
    .sort((left, right) => (left.criticalRank as number) - (right.criticalRank as number) || left.itemId.localeCompare(right.itemId));
  if (ranked.length === 0) {
    return { state: "unregistered", reason: "重要経路未共有", nodes: [], currentItemId: null, nextItemId: null, finalItemId: null, visibleNodes: [] };
  }

  const problem = graphProblem(items);
  const ranks = ranked.map((item) => item.criticalRank as number);
  const rankProblem = new Set(ranks).size !== ranks.length
    ? "重要経路順位が重複"
    : ranks.some((rank, index) => rank !== index + 1)
      ? "重要経路順位に欠番"
      : null;
  if (problem || rankProblem) {
    return { state: "invalid", reason: problem ?? rankProblem, nodes: ranked, currentItemId: null, nextItemId: null, finalItemId: ranked.at(-1)?.itemId ?? null, visibleNodes: [] };
  }

  const currentIndex = ranked.findIndex((item) => !TERMINAL_CONTROL_STATES.has(item.state));
  const current = currentIndex >= 0 ? ranked[currentIndex] : null;
  const next = currentIndex >= 0 ? ranked[currentIndex + 1] ?? null : null;
  const final = ranked.at(-1) ?? null;
  const visibleIds = new Set([current?.itemId, next?.itemId, final?.itemId].filter((id): id is string => Boolean(id)));
  return {
    state: "valid",
    reason: null,
    nodes: ranked,
    currentItemId: current?.itemId ?? null,
    nextItemId: next?.itemId ?? null,
    finalItemId: final?.itemId ?? null,
    visibleNodes: ranked.filter((item) => visibleIds.has(item.itemId)),
  };
}

/** Strictly parse the service-role publication RPC result. `null` remains unauthorized. */
export function parseSharedProjectControlPublication(
  input: unknown,
  options: SharedProjectControlParseOptions = {},
): SharedProjectControlPublication {
  if (input === null) return null;
  const root = record(input, "publication", ["state", "projectId", "viewerPartyIds", "revision", "items"], ["state"]);
  const state = enumValue(root.state, ["unpublished", "published"] as const, "publication.state");
  if (state === "unpublished") {
    const unpublished = record(input, "publication", ["state", "projectId", "viewerPartyIds"]);
    return {
      state,
      projectId: stringValue(unpublished.projectId, "publication.projectId", 120),
      viewerPartyIds: parseViewerPartyIds(unpublished.viewerPartyIds, "publication.viewerPartyIds"),
    };
  }

  const published = record(input, "publication", ["state", "viewerPartyIds", "revision", "items"]);
  const viewerPartyIds = parseViewerPartyIds(published.viewerPartyIds, "publication.viewerPartyIds");
  const revision = record(published.revision, "publication.revision", ["id", "number", "asOf", "publishedAt", "contentHash"]);
  const publicationSourceId = uuidValue(revision.id, "publication.revision.id");
  const revisionNumber = integerValue(revision.number, "publication.revision.number", 1);
  const revisionAsOf = isoDateValue(revision.asOf, "publication.revision.asOf");
  const publishedAt = isoDateValue(revision.publishedAt, "publication.revision.publishedAt");
  const contentHash = stringValue(revision.contentHash, "publication.revision.contentHash", 64);
  if (!HASH_RE.test(contentHash)) fail("publication.revision.contentHash", "lowercase SHA-256 required");
  if (!Array.isArray(published.items)) fail("publication.items", "array required");
  const envelopes = published.items.map(parseEnvelope);

  const summaries = envelopes.filter((item) => item.itemKind === "project_summary.v1");
  if (summaries.length !== 1) fail("publication.items", "exactly one project_summary.v1 required");
  const summary = parseProjectSummary(summaries[0]);
  if (Date.parse(summary.asOf) !== Date.parse(revisionAsOf)) fail("publication", "summary asOf and revision asOf disagree");

  const parties = envelopes.filter((item) => item.itemKind === "party.v1").map(parseParty);
  if (new Set(parties.map((party) => party.partyId)).size !== parties.length) fail("publication.parties", "duplicate partyId");

  const rawPillars = envelopes.filter((item) => item.itemKind === "pillar.v1").map(parsePillar);
  if (rawPillars.length !== SHARED_PROJECT_PILLAR_KEYS.length) fail("publication.pillars", "exactly four pillars required");
  const pillarByKey = new Map(rawPillars.map((pillar) => [pillar.key, pillar]));
  if (pillarByKey.size !== SHARED_PROJECT_PILLAR_KEYS.length) fail("publication.pillars", "duplicate or missing pillar");
  const pillars = SHARED_PROJECT_PILLAR_KEYS.map((key) => pillarByKey.get(key));
  if (pillars.some((pillar) => !pillar)) fail("publication.pillars", "fixed pillar order is incomplete");

  const items = envelopes.filter((item) => item.itemKind === "control_item.v1").map(parseControlItem);
  if (new Set(items.map((item) => item.itemId)).size !== items.length) fail("publication.controlItems", "duplicate itemId");
  if (new Set(items.map((item) => `${item.entityType}:${item.entityId}`)).size !== items.length) {
    fail("publication.controlItems", "duplicate source entity");
  }

  const now = options.now ?? new Date();
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const snapshot: SharedProjectControlSnapshot = {
    publicationSourceId,
    revision: revisionNumber,
    contentHash,
    projectSourceId: summary.sourceId,
    projectSourceVersion: summary.sourceVersion,
    projectId: summary.projectId,
    projectName: summary.projectName,
    asOf: summary.asOf,
    publishedAt,
    lastVerifiedAt: summary.lastVerifiedAt,
    freshness: deriveSharedProjectFreshness(summary.lastVerifiedAt, { now, staleAfterDays }),
    verdict: summary.verdict,
    parties,
    pillars: pillars as SharedProjectControlSnapshot["pillars"],
    items,
    criticalPath: deriveSharedProjectCriticalPath(items),
  };
  return { state, snapshot, viewerPartyIds };
}

function validateViewerLens(lens: ViewerLens): ViewerLens {
  const partyIds = uniqueStringArray(lens.partyIds, "viewerLens.partyIds", "uuid");
  if (partyIds.length === 0) fail("viewerLens.partyIds", "at least one exact party ID required");
  return {
    partyIds,
    label: stringValue(lens.label, "viewerLens.label", 120),
    kind: enumValue(lens.kind, ["studio", "startup", "research"] as const, "viewerLens.kind"),
  };
}

function bucketFor(item: SharedProjectControlItem, viewerPartyIds: ReadonlySet<string>): SharedProjectControlBucketKey {
  if (item.ballPartyIds.length === 0) return "unknown";
  const viewerIncluded = item.ballPartyIds.some((partyId) => viewerPartyIds.has(partyId));
  if (item.jointDecision && item.ballPartyIds.length < 2) return "unknown";
  if (viewerIncluded && (item.jointDecision || item.ballPartyIds.length > 1)) return "joint";
  if (viewerIncluded) return "my";
  return "waiting";
}

function compareControlItems(left: SharedProjectControlItem, right: SharedProjectControlItem): number {
  const leftRank = left.criticalRank ?? Number.MAX_SAFE_INTEGER;
  const rightRank = right.criticalRank ?? Number.MAX_SAFE_INTEGER;
  return leftRank - rightRank
    || (left.dueDate ?? "9999-99-99").localeCompare(right.dueDate ?? "9999-99-99")
    || left.label.localeCompare(right.label, "ja")
    || left.itemId.localeCompare(right.itemId);
}

/**
 * Change only ownership grouping and labels for the viewer. The snapshot object and every source
 * fact remain byte-for-byte untouched across studio/startup/research lenses.
 */
export function deriveSharedProjectControlView(
  snapshot: SharedProjectControlSnapshot,
  inputLens: ViewerLens,
): SharedProjectControlView {
  const lens = validateViewerLens(inputLens);
  const viewerPartyIds = new Set(lens.partyIds);
  const buckets: SharedProjectControlView["buckets"] = { my: [], joint: [], waiting: [], unknown: [] };
  for (const item of snapshot.items) buckets[bucketFor(item, viewerPartyIds)].push(item);
  for (const key of SHARED_PROJECT_CONTROL_BUCKET_ORDER) buckets[key].sort(compareControlItems);
  return { snapshot, lens, buckets };
}

export function sharedProjectPartyLabel(snapshot: SharedProjectControlSnapshot, partyId: string): string {
  return snapshot.parties.find((party) => party.partyId === partyId)?.displayLabel ?? "共有主体（名称未共有）";
}
