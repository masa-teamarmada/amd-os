import type { SxManagementBundle } from "./sx-management";

/**
 * Applies a PATCH exactly where the weekly-control screen reads it, before the
 * server has finished rebuilding the full management bundle. The response still
 * acknowledges the write, but is not merged on success: a complete response
 * from an older request must never erase a newer visible edit. A failed write
 * explicitly reloads the authoritative DB bundle instead.
 *
 * The screen receives the database field names (snake_case), while its view
 * models use camelCase. Keeping the conversion here prevents every editor from
 * inventing a slightly different optimistic representation.
 */
const FIELD_ALIASES: Record<string, string> = {
  evidence_kind: "kind",
  decision_state: "status",
};

const NUMBER_FIELDS = new Set([
  "progress_pct",
  "sort_order",
  "lag_days",
  "required_people",
  "confirmed_people",
  "available_hours_week",
  "planned_hours_week",
  "required_amount",
  "secured_amount",
  "unconfirmed_amount",
  "burn_per_month",
  "runway_months",
  "probability",
  "repetition",
]);

function camelKey(key: string) {
  return FIELD_ALIASES[key] || key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function optimisticValue(key: string, value: unknown) {
  if (NUMBER_FIELDS.has(key) && typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
}

function normalizedPatch(resource: string, patch: Record<string, unknown>) {
  const next = Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [
      camelKey(key),
      optimisticValue(key, value),
    ]),
  );

  // A milestone's visible state is the manually recorded state. `status` is
  // also projected so summary-level consumers update immediately; the server
  // will restore its authoritative derived state on acknowledgement.
  if (resource === "milestone" && "status" in next)
    next.manualStatus = next.status;
  return next;
}

/**
 * Returns an optimistic copy of the bundle for one existing record. UUIDs are
 * unique across the management tables, and several records deliberately appear
 * both in top-level lists and in their parent tree; recursively replacing every
 * matching copy keeps the whole screen coherent until the API bundle returns.
 */
export function sxApplyOptimisticManagementPatch(
  bundle: SxManagementBundle,
  resource: string,
  id: string,
  patch: Record<string, unknown>,
): SxManagementBundle {
  const fields = normalizedPatch(resource, patch);

  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;

    const record = value as Record<string, unknown>;
    const copied = Object.fromEntries(
      Object.entries(record).map(([key, child]) => [key, visit(child)]),
    );
    if (record.id !== id) return copied;

    const version =
      (resource === "task" || resource === "milestone") &&
      typeof record.version === "number"
        ? { version: record.version + 1 }
        : {};
    return { ...copied, ...fields, ...version };
  };

  return visit(bundle) as SxManagementBundle;
}
