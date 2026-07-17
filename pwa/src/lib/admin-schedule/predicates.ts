export type SchedulePredicateRow = Record<string, unknown>;

function normalized(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s【】「」『』()[\]（）・:：/／｜|_-]+/g, "")
    .trim();
}

function present(value: unknown): boolean {
  return value != null && String(value).trim().length > 0;
}

function objectValue(value: unknown): SchedulePredicateRow {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as SchedulePredicateRow;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as SchedulePredicateRow;
    } catch {
      // Invalid metadata is not a classification source.
    }
  }
  return {};
}

const IN_PROGRESS_CONTRACT_STATUSES = new Set([
  "planned",
  "expected",
  "signingexpected",
  "unsigned",
  "pending",
  "pendingsignature",
  "inprogress",
  "negotiating",
  "draft",
  "review",
  "needsreview",
  "underreview",
  "awaitingsignature",
  "signaturepending",
]);

export function isAcceptedAmdContract(row: SchedulePredicateRow): boolean {
  return normalized(row.relationship_scope) === "amdcontract"
    && normalized(row.registry_status) === "accepted";
}

export function isCurrentAmdContract(row: SchedulePredicateRow): boolean {
  return isAcceptedAmdContract(row) && row.is_current_for_project === true;
}

export function isContractSigningExpected(row: SchedulePredicateRow): boolean {
  return isAcceptedAmdContract(row)
    && !present(row.signed_at)
    && IN_PROGRESS_CONTRACT_STATUSES.has(normalized(row.status));
}

export function isStatutoryScheduleObligation(row: SchedulePredicateRow): boolean {
  const category = normalized(row.category);
  return category === "tax" || category === "socialinsurance";
}

function isAllowedActionClassification(value: unknown): boolean {
  const category = normalized(value);
  return /tax|税/.test(category)
    || /legal|law|法/.test(category)
    || /contract|agreement|契/.test(category)
    || /finance|financial|財|会計|経理/.test(category);
}

export function isScheduleActionItem(row: SchedulePredicateRow): boolean {
  if (normalized(row.review_status) !== "confirmed" || !present(row.due_at)) return false;
  const status = normalized(row.status);
  if (status && !new Set(["open", "inprogress", "active"]).has(status)) return false;
  if (normalized(row.scope) === "company") return true;
  const metadata = objectValue(row.metadata_json ?? row.metadata);
  return [
    row.category,
    row.source,
    row.classification,
    row.source_kind,
    metadata.classification,
    metadata.category,
    metadata.source,
    metadata.domain,
  ].some(isAllowedActionClassification);
}
