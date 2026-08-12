import { createHmac } from "node:crypto";

export const FIVE_SOURCE_NAMES = ["gmail", "drive", "calendar", "slack", "notion"] as const;
export type FiveSourceName = (typeof FIVE_SOURCE_NAMES)[number];

export type SourceScope = { id: string; kind: string };
export type SourceIndexItem = {
  id: string;
  occurredAt: string | null;
  scopeId: string;
  locator: string;
  threadId?: string | null;
  parentId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};
export type SourcePage = {
  items: SourceIndexItem[];
  nextCursor: string | null;
  eof: boolean;
  discoveredScopes?: SourceScope[];
  limitations?: string[];
};
export type SourceAdapter = {
  source: FiveSourceName;
  initialScopes: SourceScope[];
  fetchPage: (scope: SourceScope, cursor: string | null) => Promise<SourcePage>;
};
export type ProjectRouting = {
  kind: "project" | "multi_pj" | "shared" | "company" | "personal_private" | "unassigned" | "unknown";
  projectIds: string[];
  confidence: "high" | "medium" | "low" | "unknown";
};
export type ContentExtraction = {
  status: "fetched" | "skipped";
  contentHash: string | null;
  shortFeatures: string[];
  limitations?: string[];
};
export type CollectorOptions = {
  requestedFrom: string;
  requestedTo: string;
  projectIds: string[];
  hashKey: string;
  classify: (item: Readonly<SourceIndexItem>, projectIds: readonly string[]) => ProjectRouting;
  extractContent: (item: Readonly<SourceIndexItem>, routing: Readonly<ProjectRouting>) => Promise<ContentExtraction>;
  maxPagesPerScope?: number;
};
export type SourceCoverage = {
  source: FiveSourceName;
  countUnit: "source_index_occurrence";
  total: number;
  fetched: number;
  unique: number;
  duplicateOccurrences: number;
  invalidIndexItems: number;
  fetchFailed: number;
  skipped: number;
  dateRange: {
    requestedFrom: string;
    requestedTo: string;
    observedFrom: string | null;
    observedTo: string | null;
  };
  visibilityScopes: Array<{ kind: string; idHash: string }>;
  paginationComplete: boolean;
  recursiveComplete: boolean;
  extractionComplete: boolean;
  limitations: string[];
  status: "complete" | "incomplete" | "failed";
};
export type PersistablePopulationItem = {
  source: FiveSourceName;
  idHash: string;
  locator: string;
  occurredAt: string | null;
  threadHash: string | null;
  parentHash: string | null;
  routing: ProjectRouting;
  contentHash: string | null;
  shortFeatures: string[];
};
export type SourcePopulationResult = { coverage: SourceCoverage; items: PersistablePopulationItem[] };
export type FiveSourcePopulationReport = {
  contractVersion: "five-source-visible-population-v1";
  status: "complete" | "incomplete" | "failed";
  projectCount: 12;
  sources: Record<FiveSourceName, SourceCoverage>;
  items: PersistablePopulationItem[];
};

const LIMITATION_RE = /^[a-z0-9][a-z0-9:_-]{0,95}$/;
const LOCATOR_RE = /^[a-z0-9][a-z0-9:._/-]{0,191}$/i;
const SHA256_RE = /^[a-f0-9]{64}$/;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const URL_RE = /https?:\/\//i;
const FORBIDDEN_KEYS = new Set(["raw", "body", "text", "html", "url", "email", "subject", "message", "description", "attendees"]);

function hashId(source: FiveSourceName, value: string, hashKey: string): string {
  return createHmac("sha256", hashKey).update(`${source}:${value}`).digest("hex");
}
function limitation(code: unknown): string {
  const normalized = String(code || "").trim().toLowerCase();
  return LIMITATION_RE.test(normalized) ? normalized : "redacted_source_limitation";
}
function validateCohort(projectIds: readonly string[]): void {
  if (projectIds.length !== 12 || new Set(projectIds).size !== 12 || projectIds.some((id) => !id.trim())) {
    throw new Error("project cohort must contain exactly 12 distinct project IDs");
  }
}
function validateRouting(routing: ProjectRouting, cohort: readonly string[]): ProjectRouting {
  const projectIds = [...new Set(routing.projectIds)].filter((id) => cohort.includes(id)).sort();
  if (routing.kind === "project" && projectIds.length !== 1) throw new Error("project routing requires one project ID");
  if (routing.kind === "multi_pj" && projectIds.length < 2) throw new Error("multi_pj routing requires multiple project IDs");
  if (!(["project", "multi_pj"] as string[]).includes(routing.kind) && projectIds.length) {
    throw new Error(`${routing.kind} routing cannot silently carry project IDs`);
  }
  return { ...routing, projectIds };
}
function validateExtraction(extraction: ContentExtraction): void {
  if (extraction.contentHash !== null && !SHA256_RE.test(extraction.contentHash)) throw new Error("invalid content hash");
  if (!Array.isArray(extraction.shortFeatures) || extraction.shortFeatures.length > 8) throw new Error("too many short features");
  for (const feature of extraction.shortFeatures) {
    if (typeof feature !== "string" || feature.length > 160 || URL_RE.test(feature) || EMAIL_RE.test(feature)) {
      throw new Error("unsafe short feature");
    }
  }
}
function isRecursive(kind: string): boolean {
  return /thread|repl|child|block|page|recursive/i.test(kind);
}
function observedRange(items: readonly SourceIndexItem[]) {
  const dates = items.map((item) => item.occurredAt)
    .filter((value): value is string => Boolean(value && !Number.isNaN(Date.parse(value)))).sort();
  return { observedFrom: dates.at(0) ?? null, observedTo: dates.at(-1) ?? null };
}

export async function enumerateVisibleSourcePopulation(adapter: SourceAdapter, options: CollectorOptions): Promise<SourcePopulationResult> {
  validateCohort(options.projectIds);
  if (!options.requestedFrom || !options.requestedTo) throw new Error("requested date range is required");
  if (options.hashKey.length < 16) throw new Error("hashKey must contain at least 16 characters");

  const scopes = [...adapter.initialScopes];
  const knownScopes = new Set(scopes.map((scope) => scope.id));
  const limitations = new Set<string>();
  const indexItems: SourceIndexItem[] = [];
  const maxPages = options.maxPagesPerScope ?? 10_000;
  let total = 0;
  let invalidIndexItems = 0;
  let paginationComplete = true;
  let recursiveComplete = true;

  for (let scopeIndex = 0; scopeIndex < scopes.length; scopeIndex += 1) {
    const scope = scopes[scopeIndex];
    const cursors = new Set<string>();
    let cursor: string | null = null;
    let pageCount = 0;
    while (true) {
      pageCount += 1;
      if (pageCount > maxPages) {
        paginationComplete = false;
        if (isRecursive(scope.kind)) recursiveComplete = false;
        limitations.add("page_limit_reached");
        break;
      }
      let page: SourcePage;
      try {
        page = await adapter.fetchPage(scope, cursor);
      } catch {
        paginationComplete = false;
        if (isRecursive(scope.kind)) recursiveComplete = false;
        limitations.add("page_fetch_failed");
        break;
      }
      for (const code of page.limitations ?? []) limitations.add(limitation(code));
      for (const discovered of page.discoveredScopes ?? []) {
        if (!discovered.id?.trim() || knownScopes.has(discovered.id)) continue;
        knownScopes.add(discovered.id);
        scopes.push(discovered);
      }
      total += page.items.length;
      for (const item of page.items) {
        if (!item.id?.trim() || !item.scopeId?.trim() || !LOCATOR_RE.test(item.locator || "")) {
          invalidIndexItems += 1;
          limitations.add("invalid_index_item");
        } else indexItems.push(item);
      }
      if (page.eof) {
        if (page.nextCursor !== null) {
          paginationComplete = false;
          if (isRecursive(scope.kind)) recursiveComplete = false;
          limitations.add("eof_with_next_cursor");
        }
        break;
      }
      if (!page.nextCursor) {
        paginationComplete = false;
        if (isRecursive(scope.kind)) recursiveComplete = false;
        limitations.add("missing_next_cursor");
        break;
      }
      if (cursors.has(page.nextCursor)) {
        paginationComplete = false;
        if (isRecursive(scope.kind)) recursiveComplete = false;
        limitations.add("cursor_cycle_detected");
        break;
      }
      cursors.add(page.nextCursor);
      cursor = page.nextCursor;
    }
  }

  const byId = new Map<string, SourceIndexItem>();
  for (const item of indexItems) if (!byId.has(item.id)) byId.set(item.id, item);
  const uniqueItems = [...byId.values()];
  let fetched = 0;
  let fetchFailed = 0;
  let skipped = 0;
  const items: PersistablePopulationItem[] = [];

  // Required order: source-native ID dedupe -> metadata routing to the 12-PJ cohort -> deep extraction.
  // Routing never filters: shared, private, unknown and unassigned items still reach extraction.
  for (const item of uniqueItems) {
    const routing = validateRouting(options.classify(item, options.projectIds), options.projectIds);
    let extraction: ContentExtraction;
    try {
      extraction = await options.extractContent(item, routing);
      validateExtraction(extraction);
      if (extraction.status === "fetched") fetched += 1;
      else skipped += 1;
    } catch {
      fetchFailed += 1;
      extraction = { status: "skipped", contentHash: null, shortFeatures: [] };
      limitations.add("content_extract_failed");
    }
    for (const code of extraction.limitations ?? []) limitations.add(limitation(code));
    items.push({
      source: adapter.source,
      idHash: hashId(adapter.source, item.id, options.hashKey),
      locator: item.locator,
      occurredAt: item.occurredAt,
      threadHash: item.threadId ? hashId(adapter.source, item.threadId, options.hashKey) : null,
      parentHash: item.parentId ? hashId(adapter.source, item.parentId, options.hashKey) : null,
      routing,
      contentHash: extraction.contentHash,
      shortFeatures: extraction.shortFeatures,
    });
  }

  if (invalidIndexItems) limitations.add("index_items_skipped");
  const extractionComplete = fetched === uniqueItems.length;
  const status: SourceCoverage["status"] = paginationComplete && recursiveComplete && extractionComplete && !limitations.size
    ? "complete" : total === 0 && !paginationComplete ? "failed" : "incomplete";
  const coverage: SourceCoverage = {
    source: adapter.source,
    countUnit: "source_index_occurrence",
    total,
    fetched,
    unique: uniqueItems.length,
    duplicateOccurrences: indexItems.length - uniqueItems.length,
    invalidIndexItems,
    fetchFailed,
    skipped,
    dateRange: { requestedFrom: options.requestedFrom, requestedTo: options.requestedTo, ...observedRange(uniqueItems) },
    visibilityScopes: scopes.map((scope) => ({ kind: scope.kind, idHash: hashId(adapter.source, `scope:${scope.id}`, options.hashKey) })),
    paginationComplete,
    recursiveComplete,
    extractionComplete,
    limitations: [...limitations].sort(),
    status,
  };
  return { coverage, items };
}

export function buildFiveSourcePopulationReport(results: SourcePopulationResult[]): FiveSourcePopulationReport {
  const bySource = new Map(results.map((result) => [result.coverage.source, result]));
  const sources = {} as Record<FiveSourceName, SourceCoverage>;
  const items: PersistablePopulationItem[] = [];
  for (const source of FIVE_SOURCE_NAMES) {
    const result = bySource.get(source);
    if (!result) throw new Error(`missing source result: ${source}`);
    sources[source] = result.coverage;
    items.push(...result.items);
  }
  if (bySource.size !== FIVE_SOURCE_NAMES.length) throw new Error("each of the five sources is required exactly once");
  const status: FiveSourcePopulationReport["status"] = FIVE_SOURCE_NAMES.some((source) => sources[source].status === "failed")
    ? "failed" : FIVE_SOURCE_NAMES.some((source) => sources[source].status === "incomplete") ? "incomplete" : "complete";
  const report: FiveSourcePopulationReport = {
    contractVersion: "five-source-visible-population-v1", status, projectCount: 12, sources, items,
  };
  assertPersistablePopulationArtifact(report);
  return report;
}

export function assertPersistablePopulationArtifact(value: unknown, path = "root"): void {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    if (URL_RE.test(value) || EMAIL_RE.test(value)) throw new Error(`${path} contains a URL or email address`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertPersistablePopulationArtifact(entry, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) throw new Error(`${path}.${key} is forbidden in persisted artifacts`);
    assertPersistablePopulationArtifact(entry, `${path}.${key}`);
  }
}
