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

const GMAIL_SOURCE_KINDS = new Set(["gmail", "gmailextraction", "gmailmessage", "email"]);

export function isEligibleTaxSocialObligation(row: SchedulePredicateRow): boolean {
  if (!isStatutoryScheduleObligation(row)) return false;
  const sourceKind = normalized(row.source_kind);
  if (!GMAIL_SOURCE_KINDS.has(sourceKind)) return true;
  const payload = objectValue(row.payload);
  const reviewStatus = normalized(row.review_status ?? payload.review_status ?? payload.reviewStatus);
  return present(row.reviewed_at)
    || reviewStatus === "reviewed"
    || reviewStatus === "manual";
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

export type ComputedScheduleStatus =
  | "completed" | "cancelled" | "needs_source" | "overdue" | "due_today" | "due_soon" | "open";

/**
 * 予定の表示状態。元台帳で納付済みになった予定は、期限日が過去でも期限超過にしない。
 * 支払済みの照合が付いた法定納付を「要照合」や「期限超過」に混ぜると、
 * これから払う額と払い終えた額の区別が付かなくなる。
 */
export function computedScheduleStatus(
  row: SchedulePredicateRow,
  latestActionKind: string | null,
  today: string
): ComputedScheduleStatus {
  if (latestActionKind === "completed" || latestActionKind === "not_applicable") return "completed";
  const lifecycle = String(row.lifecycle_status ?? "");
  if (lifecycle === "cancelled") return "cancelled";
  if (lifecycle === "completed" && latestActionKind !== "reopened") return "completed";
  if (lifecycle === "needs_source" || present(row.missing_reason)) return "needs_source";
  if (latestActionKind === "reopened" && !present(row.due_on) && !present(row.due_ym)) return "needs_source";
  const dueOn = present(row.due_on) ? String(row.due_on) : null;
  if (dueOn) {
    const offset = Math.round((Date.parse(`${dueOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
    if (offset < 0) return "overdue";
    if (offset === 0) return "due_today";
    if (offset <= 14) return "due_soon";
    return "open";
  }
  const todayYm = today.slice(0, 7).replace("-", "");
  const dueYm = present(row.due_ym) ? String(row.due_ym) : null;
  if (dueYm && todayYm) {
    if (dueYm < todayYm) return "overdue";
    if (dueYm === todayYm) return "due_soon";
  }
  return "open";
}
