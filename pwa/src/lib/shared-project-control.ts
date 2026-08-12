/**
 * Strict projection boundary for immutable project-control publications.
 *
 * This module intentionally has no Supabase or Next.js dependency. Server readers,
 * the AMD cockpit, and external institution views all consume the same parsed shape.
 * Display values are accepted only from the sealed publication payload emitted by
 * migration 259; live/internal envelopes are never used as fallback values.
 */

export const SHARED_PROJECT_PILLAR_KEYS = [
  "business_development",
  "technology_development",
  "organizational_building",
  "funding",
] as const;

export type SharedProjectPillarKey = (typeof SHARED_PROJECT_PILLAR_KEYS)[number];
export type SharedProjectPartyKind = "amd" | "research" | "startup";
export type SharedProjectItemLane = "my" | "joint" | "waiting" | "unknown";
export type SharedProjectItemTone = "success" | "neutral" | "attention" | "critical" | "unknown";

const PILLAR_LABELS: Record<SharedProjectPillarKey, string> = {
  business_development: "事業開発",
  technology_development: "技術開発",
  organizational_building: "組織構築",
  funding: "資金調達",
};

const CONTROL_SOURCE_TABLES = [
  "project_management_milestones",
  "project_management_issues",
  "project_management_decisions",
  "project_management_action_items",
  "project_management_partner_work_items",
] as const;

type SharedProjectControlSourceTable = (typeof CONTROL_SOURCE_TABLES)[number];

const CONTROL_ENTITY_TYPES = ["milestone", "issue", "decision", "action", "partner_work_item"] as const;
export type SharedProjectControlEntityType = (typeof CONTROL_ENTITY_TYPES)[number];

const CONTROL_STATES = [
  "unknown",
  "on_track",
  "attention",
  "at_risk",
  "blocked",
  "completed",
  "open",
  "validating",
  "closed",
  "on_hold",
  "pending",
  "decided",
  "deferred",
  "in_progress",
  "waiting",
  "cancelled",
] as const;
export type SharedProjectControlState = (typeof CONTROL_STATES)[number];

const VERDICT_STATES = ["critical", "unknown", "attention", "on_track"] as const;
export type SharedProjectVerdictState = (typeof VERDICT_STATES)[number];

const TERMINAL_SUCCESS_STATES = new Set<string>([
  "accepted",
  "accepted_done",
  "closed",
  "committed",
  "completed",
  "confirmed",
  "decided",
  "filled",
  "passed",
  "validated",
]);

const TERMINAL_NEUTRAL_STATES = new Set<string>(["cancelled", "rejected"]);
const CRITICAL_STATES = new Set<string>(["blocked", "at_risk", "failed"]);
const UNKNOWN_STATES = new Set<string>(["unknown", "missing", "unshared", "unassessed"]);

export interface SharedProjectPublicationRevision {
  id: string;
  number: number;
  asOf: string;
  publishedAt: string;
  contentHash: string;
}

export interface SharedProjectSummary {
  projectId: string;
  projectName: string;
  asOf: string;
  lastVerifiedAt: string | null;
  verdict: {
    state: SharedProjectVerdictState;
    label: string;
    reason: string;
  };
}

export interface SharedProjectParty {
  partyId: string;
  kind: SharedProjectPartyKind;
  displayLabel: string;
}

export interface SharedProjectPillar {
  key: SharedProjectPillarKey;
  label: string;
  state: SharedProjectVerdictState;
  currentGateLabel: string | null;
  nextDue: string | null;
  blockedCount: number;
  unknownCount: number;
}

export interface SharedProjectControlItem {
  itemId: string;
  entityType: SharedProjectControlEntityType;
  entityId: string;
  sourceTable: SharedProjectControlSourceTable;
  sourceVersion: number;
  pillarKey: SharedProjectPillarKey;
  label: string;
  state: SharedProjectControlState;
  dueDate: string | null;
  ballPartyIds: string[];
  jointDecision: boolean;
  criticalRank: number | null;
  dependencyItemIds: string[];
  downstreamImpactLabel: string | null;
}

export interface SharedProjectPublishedControl {
  state: "published";
  viewerPartyIds: string[];
  revision: SharedProjectPublicationRevision;
  summary: SharedProjectSummary;
  parties: SharedProjectParty[];
  pillars: SharedProjectPillar[];
  controlItems: SharedProjectControlItem[];
}

export interface SharedProjectUnpublishedControl {
  state: "unpublished";
  projectId: string;
  viewerPartyIds: string[];
}

export interface SharedProjectUnauthorizedControl {
  state: "unauthorized";
}

export interface SharedProjectInvalidControl {
  state: "invalid";
  reason: string;
}

export interface SharedProjectControlError {
  state: "error";
  message: string;
}

export type ParsedSharedProjectControl =
  | SharedProjectUnauthorizedControl
  | SharedProjectUnpublishedControl
  | SharedProjectPublishedControl
  | SharedProjectInvalidControl;

export type SharedProjectControlLoadState = ParsedSharedProjectControl | SharedProjectControlError;

export interface SharedProjectCriticalPath {
  orderedItems: SharedProjectControlItem[];
  currentItem: SharedProjectControlItem | null;
  downstreamItems: SharedProjectControlItem[];
}

export interface SharedProjectControlViewItem extends SharedProjectControlItem {
  lane: SharedProjectItemLane;
  tone: SharedProjectItemTone;
  terminal: boolean;
}

export interface SharedProjectControlView {
  viewerPartyIds: string[];
  items: SharedProjectControlViewItem[];
  lanes: Record<SharedProjectItemLane, SharedProjectControlViewItem[]>;
  criticalPath: SharedProjectCriticalPath;
}

type RecordValue = Record<string, unknown>;

class PublicationParseError extends Error {}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactRecord(value: unknown, keys: readonly string[], label: string): RecordValue {
  if (!isRecord(value)) throw new PublicationParseError(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new PublicationParseError(`${label} has an invalid field set`);
  }
  return value;
}

function stringValue(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new PublicationParseError(`${label} must be a string`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) throw new PublicationParseError(`${label} is invalid`);
  return trimmed;
}

function nullableString(value: unknown, label: string, maxLength: number): string | null {
  if (value === null) return null;
  return stringValue(value, label, maxLength);
}

function integerValue(value: unknown, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new PublicationParseError(`${label} must be an integer >= ${minimum}`);
  }
  return value as number;
}

function nullablePositiveInteger(value: unknown, label: string): number | null {
  if (value === null) return null;
  return integerValue(value, label, 1);
}

function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new PublicationParseError(`${label} is outside the canonical enum`);
  }
  return value as T;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuidValue(value: unknown, label: string): string {
  const uuid = stringValue(value, label, 36).toLowerCase();
  if (!UUID_PATTERN.test(uuid)) throw new PublicationParseError(`${label} must be a canonical UUID`);
  return uuid;
}

function uniqueUuidArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new PublicationParseError(`${label} must be an array`);
  const values = value.map((entry, index) => uuidValue(entry, `${label}[${index}]`));
  if (new Set(values).size !== values.length) throw new PublicationParseError(`${label} contains duplicates`);
  return values;
}

function uniqueStringArray(value: unknown, label: string, maxLength: number): string[] {
  if (!Array.isArray(value)) throw new PublicationParseError(`${label} must be an array`);
  const values = value.map((entry, index) => stringValue(entry, `${label}[${index}]`, maxLength));
  if (new Set(values).size !== values.length) throw new PublicationParseError(`${label} contains duplicates`);
  return values;
}

function isoTimestamp(value: unknown, label: string): string {
  const timestamp = stringValue(value, label, 64);
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime()) || !/T/.test(timestamp)) {
    throw new PublicationParseError(`${label} must be a finite ISO timestamp`);
  }
  return timestamp;
}

function nullableIsoTimestamp(value: unknown, label: string): string | null {
  return value === null ? null : isoTimestamp(value, label);
}

function isoDate(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PublicationParseError(`${label} must be an ISO date`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new PublicationParseError(`${label} must be a real calendar date`);
  }
  return value;
}

function nullableIsoDate(value: unknown, label: string): string | null {
  return value === null ? null : isoDate(value, label);
}

function sameTimestamp(left: string, right: string): boolean {
  return new Date(left).getTime() === new Date(right).getTime();
}

function parseRevision(value: unknown): SharedProjectPublicationRevision {
  const row = exactRecord(value, ["id", "number", "asOf", "publishedAt", "contentHash"], "revision");
  const contentHash = stringValue(row.contentHash, "revision.contentHash", 64);
  if (!/^[0-9a-f]{64}$/.test(contentHash)) throw new PublicationParseError("revision.contentHash is invalid");
  return {
    id: uuidValue(row.id, "revision.id"),
    number: integerValue(row.number, "revision.number", 1),
    asOf: isoTimestamp(row.asOf, "revision.asOf"),
    publishedAt: isoTimestamp(row.publishedAt, "revision.publishedAt"),
    contentHash,
  };
}

function parseSummaryPayload(value: unknown): SharedProjectSummary {
  const row = exactRecord(value, ["projectId", "projectName", "asOf", "lastVerifiedAt", "verdict"], "summary payload");
  const verdict = exactRecord(row.verdict, ["state", "label", "reason"], "summary verdict");
  return {
    projectId: stringValue(row.projectId, "summary.projectId", 120),
    projectName: stringValue(row.projectName, "summary.projectName", 200),
    asOf: isoTimestamp(row.asOf, "summary.asOf"),
    lastVerifiedAt: nullableIsoTimestamp(row.lastVerifiedAt, "summary.lastVerifiedAt"),
    verdict: {
      state: enumValue(verdict.state, VERDICT_STATES, "summary.verdict.state"),
      label: stringValue(verdict.label, "summary.verdict.label", 120),
      reason: stringValue(verdict.reason, "summary.verdict.reason", 240),
    },
  };
}

function parsePartyPayload(value: unknown): SharedProjectParty {
  const row = exactRecord(value, ["partyId", "kind", "displayLabel"], "party payload");
  return {
    partyId: uuidValue(row.partyId, "party.partyId"),
    kind: enumValue(row.kind, ["amd", "research", "startup"] as const, "party.kind"),
    displayLabel: stringValue(row.displayLabel, "party.displayLabel", 120),
  };
}

function parsePillarPayload(value: unknown): SharedProjectPillar {
  const row = exactRecord(
    value,
    ["key", "label", "state", "currentGateLabel", "nextDue", "blockedCount", "unknownCount"],
    "pillar payload",
  );
  const key = enumValue(row.key, SHARED_PROJECT_PILLAR_KEYS, "pillar.key");
  const label = stringValue(row.label, "pillar.label", 40);
  if (label !== PILLAR_LABELS[key]) throw new PublicationParseError("pillar.label does not match its canonical key");
  return {
    key,
    label,
    state: enumValue(row.state, VERDICT_STATES, "pillar.state"),
    currentGateLabel: nullableString(row.currentGateLabel, "pillar.currentGateLabel", 200),
    nextDue: nullableIsoDate(row.nextDue, "pillar.nextDue"),
    blockedCount: integerValue(row.blockedCount, "pillar.blockedCount"),
    unknownCount: integerValue(row.unknownCount, "pillar.unknownCount"),
  };
}

function parseControlPayload(
  value: unknown,
  sourceTable: SharedProjectControlSourceTable,
  sourceId: string,
  sourceVersion: number,
): SharedProjectControlItem {
  const row = exactRecord(
    value,
    [
      "itemId",
      "entityType",
      "entityId",
      "pillarKey",
      "label",
      "state",
      "dueDate",
      "ballPartyIds",
      "jointDecision",
      "criticalRank",
      "dependencyItemIds",
      "downstreamImpactLabel",
    ],
    "control item payload",
  );
  const entityId = uuidValue(row.entityId, "control.entityId");
  const itemId = stringValue(row.itemId, "control.itemId", 180);
  if (entityId !== sourceId || itemId !== `${sourceTable}:${sourceId}`) {
    throw new PublicationParseError("control identity does not match its immutable source envelope");
  }
  if (typeof row.jointDecision !== "boolean") {
    throw new PublicationParseError("control.jointDecision must be boolean");
  }
  return {
    itemId,
    entityType: enumValue(row.entityType, CONTROL_ENTITY_TYPES, "control.entityType"),
    entityId,
    sourceTable,
    sourceVersion,
    pillarKey: enumValue(row.pillarKey, SHARED_PROJECT_PILLAR_KEYS, "control.pillarKey"),
    label: stringValue(row.label, "control.label", 200),
    state: enumValue(row.state, CONTROL_STATES, "control.state"),
    dueDate: nullableIsoDate(row.dueDate, "control.dueDate"),
    ballPartyIds: uniqueUuidArray(row.ballPartyIds, "control.ballPartyIds"),
    jointDecision: row.jointDecision,
    criticalRank: nullablePositiveInteger(row.criticalRank, "control.criticalRank"),
    dependencyItemIds: uniqueStringArray(row.dependencyItemIds, "control.dependencyItemIds", 180),
    downstreamImpactLabel: nullableString(row.downstreamImpactLabel, "control.downstreamImpactLabel", 240),
  };
}

function parsePublished(value: RecordValue): SharedProjectPublishedControl {
  const root = exactRecord(value, ["state", "viewerPartyIds", "revision", "items"], "published response");
  if (root.state !== "published") throw new PublicationParseError("published response state is invalid");
  const viewerPartyIds = uniqueUuidArray(root.viewerPartyIds, "viewerPartyIds");
  if (!Array.isArray(root.items)) throw new PublicationParseError("items must be an array");
  const revision = parseRevision(root.revision);

  let summary: SharedProjectSummary | null = null;
  const parties: SharedProjectParty[] = [];
  const pillars: SharedProjectPillar[] = [];
  const controlItems: SharedProjectControlItem[] = [];

  for (const [index, valueItem] of root.items.entries()) {
    const item = exactRecord(
      valueItem,
      ["itemKind", "sourceTable", "sourceId", "sourceVersion", "payload"],
      `items[${index}]`,
    );
    const itemKind = enumValue(
      item.itemKind,
      ["project_summary.v1", "party.v1", "pillar.v1", "control_item.v1"] as const,
      `items[${index}].itemKind`,
    );
    const sourceTable = stringValue(item.sourceTable, `items[${index}].sourceTable`, 100);
    const sourceId = stringValue(item.sourceId, `items[${index}].sourceId`, 180);
    const sourceVersion = integerValue(item.sourceVersion, `items[${index}].sourceVersion`, 1);

    if (itemKind === "project_summary.v1") {
      if (summary || sourceTable !== "projects" || sourceVersion !== 1) {
        throw new PublicationParseError("project summary envelope is invalid or duplicated");
      }
      summary = parseSummaryPayload(item.payload);
      if (sourceId !== summary.projectId || !sameTimestamp(summary.asOf, revision.asOf)) {
        throw new PublicationParseError("project summary does not match its revision envelope");
      }
      continue;
    }

    if (itemKind === "party.v1") {
      if (sourceTable !== "project_organization_parties" || sourceVersion !== 1) {
        throw new PublicationParseError("party envelope is invalid");
      }
      const party = parsePartyPayload(item.payload);
      if (sourceId.toLowerCase() !== party.partyId) throw new PublicationParseError("party source identity mismatch");
      parties.push(party);
      continue;
    }

    if (itemKind === "pillar.v1") {
      if (sourceTable !== "project_publication" || sourceVersion !== 1) {
        throw new PublicationParseError("pillar envelope is invalid");
      }
      const pillar = parsePillarPayload(item.payload);
      if (sourceId !== pillar.key) throw new PublicationParseError("pillar source identity mismatch");
      pillars.push(pillar);
      continue;
    }

    const controlSourceTable = enumValue(
      sourceTable,
      CONTROL_SOURCE_TABLES,
      `items[${index}].sourceTable`,
    );
    const controlSourceId = uuidValue(sourceId, `items[${index}].sourceId`);
    controlItems.push(parseControlPayload(item.payload, controlSourceTable, controlSourceId, sourceVersion));
  }

  if (!summary) throw new PublicationParseError("published response needs exactly one project summary");
  if (new Set(parties.map((party) => party.partyId)).size !== parties.length) {
    throw new PublicationParseError("party IDs must be unique");
  }
  const pillarKeys = pillars.map((pillar) => pillar.key);
  if (
    pillars.length !== SHARED_PROJECT_PILLAR_KEYS.length ||
    new Set(pillarKeys).size !== SHARED_PROJECT_PILLAR_KEYS.length ||
    SHARED_PROJECT_PILLAR_KEYS.some((key) => !pillarKeys.includes(key))
  ) {
    throw new PublicationParseError("published response must contain each canonical pillar exactly once");
  }
  const availablePartyIds = new Set(parties.map((party) => party.partyId));
  if (viewerPartyIds.some((partyId) => !availablePartyIds.has(partyId))) {
    throw new PublicationParseError("viewer party is missing from the sealed party items");
  }
  for (const control of controlItems) {
    if (control.ballPartyIds.some((partyId) => !availablePartyIds.has(partyId))) {
      throw new PublicationParseError("control ball party is missing from the sealed party items");
    }
  }
  deriveSharedProjectCriticalPath(controlItems);

  return { state: "published", viewerPartyIds, revision, summary, parties, pillars, controlItems };
}

export function parseSharedProjectControlPublication(input: unknown): ParsedSharedProjectControl {
  if (input === null) return { state: "unauthorized" };
  try {
    if (!isRecord(input)) throw new PublicationParseError("publication response must be an object");
    if (input.state === "unpublished") {
      const root = exactRecord(input, ["state", "projectId", "viewerPartyIds"], "unpublished response");
      return {
        state: "unpublished",
        projectId: stringValue(root.projectId, "projectId", 120),
        viewerPartyIds: uniqueUuidArray(root.viewerPartyIds, "viewerPartyIds"),
      };
    }
    return parsePublished(input);
  } catch (error) {
    return {
      state: "invalid",
      reason: error instanceof PublicationParseError ? error.message : "publication response is invalid",
    };
  }
}

export function sharedProjectControlError(error: unknown): SharedProjectControlError {
  return {
    state: "error",
    message: error instanceof Error && error.message ? error.message : "共有版の取得に失敗しました",
  };
}

export function isSharedProjectTerminalState(state: string): boolean {
  return TERMINAL_SUCCESS_STATES.has(state) || TERMINAL_NEUTRAL_STATES.has(state);
}

export function sharedProjectItemTone(state: string): SharedProjectItemTone {
  if (TERMINAL_SUCCESS_STATES.has(state)) return "success";
  if (TERMINAL_NEUTRAL_STATES.has(state)) return "neutral";
  if (CRITICAL_STATES.has(state)) return "critical";
  if (UNKNOWN_STATES.has(state)) return "unknown";
  return "attention";
}

export function deriveSharedProjectCriticalPath(
  items: readonly SharedProjectControlItem[],
): SharedProjectCriticalPath {
  const byId = new Map<string, SharedProjectControlItem>();
  const ranks = new Set<number>();
  for (const item of items) {
    if (byId.has(item.itemId)) throw new PublicationParseError("control item IDs must be unique");
    byId.set(item.itemId, item);
    if (item.criticalRank !== null) {
      if (ranks.has(item.criticalRank)) throw new PublicationParseError("critical ranks must be unique");
      ranks.add(item.criticalRank);
    }
  }
  for (const item of items) {
    for (const dependencyId of item.dependencyItemIds) {
      if (!byId.has(dependencyId)) throw new PublicationParseError("control dependency is dangling");
      if (dependencyId === item.itemId) throw new PublicationParseError("control dependency cannot reference itself");
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const topological: SharedProjectControlItem[] = [];
  const stableItems = [...items].sort((left, right) => {
    const rankLeft = left.criticalRank ?? Number.MAX_SAFE_INTEGER;
    const rankRight = right.criticalRank ?? Number.MAX_SAFE_INTEGER;
    return rankLeft - rankRight || left.itemId.localeCompare(right.itemId);
  });

  const visit = (item: SharedProjectControlItem) => {
    if (visited.has(item.itemId)) return;
    if (visiting.has(item.itemId)) throw new PublicationParseError("control dependency graph contains a cycle");
    visiting.add(item.itemId);
    for (const dependencyId of item.dependencyItemIds) visit(byId.get(dependencyId)!);
    visiting.delete(item.itemId);
    visited.add(item.itemId);
    topological.push(item);
  };
  stableItems.forEach(visit);

  const ranked = topological.filter((item) => item.criticalRank !== null);
  const orderedItems = ranked.length > 0
    ? ranked.sort((left, right) => left.criticalRank! - right.criticalRank! || left.itemId.localeCompare(right.itemId))
    : topological;
  const currentIndex = orderedItems.findIndex((item) => !isSharedProjectTerminalState(item.state));
  const currentItem = currentIndex >= 0 ? orderedItems[currentIndex] : null;
  return {
    orderedItems,
    currentItem,
    downstreamItems: currentIndex >= 0 ? orderedItems.slice(currentIndex + 1) : [],
  };
}

export function deriveSharedProjectControlView(
  publication: SharedProjectPublishedControl,
): SharedProjectControlView {
  const viewerPartyIds = new Set(publication.viewerPartyIds);
  const lanes: Record<SharedProjectItemLane, SharedProjectControlViewItem[]> = {
    my: [],
    joint: [],
    waiting: [],
    unknown: [],
  };
  const items = publication.controlItems.map<SharedProjectControlViewItem>((item) => {
    const lane: SharedProjectItemLane = item.ballPartyIds.some((partyId) => viewerPartyIds.has(partyId))
      ? "my"
      : item.jointDecision
        ? "joint"
        : item.ballPartyIds.length > 0
          ? "waiting"
          : "unknown";
    const projected: SharedProjectControlViewItem = {
      ...item,
      ballPartyIds: [...item.ballPartyIds],
      dependencyItemIds: [...item.dependencyItemIds],
      lane,
      tone: sharedProjectItemTone(item.state),
      terminal: isSharedProjectTerminalState(item.state),
    };
    lanes[lane].push(projected);
    return projected;
  });
  return {
    viewerPartyIds: [...publication.viewerPartyIds],
    items,
    lanes,
    criticalPath: deriveSharedProjectCriticalPath(items),
  };
}
