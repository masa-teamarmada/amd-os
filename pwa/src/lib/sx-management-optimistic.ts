import type {
  SxManagementBundle,
  SxManagementMilestone,
  SxTask,
  SxTrackKey,
} from "./sx-management";

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

/**
 * 楽観的に置いたレコードの仮ID。DBのUUIDと衝突しない接頭辞を付ける。
 * サーバが本物のIDを返したら sxReplaceOptimisticManagementId で差し替える。
 */
export const SX_OPTIMISTIC_ID_PREFIX = "sx-optimistic-";

export function sxIsOptimisticId(id: string) {
  return id.startsWith(SX_OPTIMISTIC_ID_PREFIX);
}

export function sxNewOptimisticId(seed: string) {
  return `${SX_OPTIMISTIC_ID_PREFIX}${seed}`;
}

/**
 * 削除を画面に先に反映する。管理テーブルのIDは全体で一意なので、bundle 全体を
 * 走査して同じIDの要素を配列から落とす。その要素を指していた依存線も一緒に消す
 * （サーバも同じ扱いをするので、応答を待つ間だけ見え方が食い違うことはない）。
 */
export function sxRemoveOptimisticManagementRecord(
  bundle: SxManagementBundle,
  id: string,
): SxManagementBundle {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value))
      return value
        .filter(
          (item) =>
            !item ||
            typeof item !== "object" ||
            (item as Record<string, unknown>).id !== id,
        )
        .map(visit);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        visit(child),
      ]),
    );
  };

  const next = visit(bundle) as SxManagementBundle;
  return {
    ...next,
    scheduleDependencies: next.scheduleDependencies.filter(
      (dependency) =>
        dependency.predecessorTaskId !== id &&
        dependency.predecessorMilestoneId !== id &&
        dependency.successorTaskId !== id &&
        dependency.successorMilestoneId !== id,
    ),
  };
}

/** 仮IDを、サーバが採番した本物のIDへ入れ替える。以後の編集・削除がそのまま通るようにする。 */
export function sxReplaceOptimisticManagementId(
  bundle: SxManagementBundle,
  temporaryId: string,
  realId: string,
): SxManagementBundle {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        child === temporaryId ? realId : visit(child),
      ]),
    );
  };
  return visit(bundle) as SxManagementBundle;
}

function optimisticTask(
  projectId: string,
  id: string,
  fields: Record<string, unknown>,
): SxTask {
  const base: SxTask = {
    id,
    projectId,
    milestoneId: "",
    parentTaskId: null,
    track: null,
    title: "",
    description: null,
    status: "not_started",
    plannedStart: null,
    plannedEnd: null,
    forecastEnd: null,
    actualEnd: null,
    progressPct: 0,
    dateCertainty: "provisional",
    ownerMemberId: null,
    ownerLabel: "担当未確認",
    goal: null,
    nextDeliverable: null,
    blocker: null,
    completionCriteria: null,
    forecastChangeReason: null,
    sortOrder: 0,
    lastVerifiedAt: "",
    confidence: "unknown",
    sourceKind: "manual",
    sourceRef: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
  };
  const next = { ...base, ...fields } as SxTask;
  return {
    ...next,
    id,
    projectId,
    // フォームは未選択を空文字で送るが、サーバは null として保存する。ガントの
    // トップレベル判定は parentTaskId == null なので、空文字のまま挿入すると
    // 「作成した瞬間だけ行が出ない」欠陥になる。サーバと同じ正規化をここで行う。
    parentTaskId: next.parentTaskId ? next.parentTaskId : null,
    track: next.track ? next.track : null,
    forecastEnd: next.forecastEnd ?? next.plannedEnd,
  };
}

function optimisticMilestone(
  id: string,
  fields: Record<string, unknown>,
): SxManagementMilestone {
  const base: SxManagementMilestone = {
    id,
    slug: id,
    track: "business_development" as SxTrackKey,
    objectiveId: "",
    outcomeId: "",
    title: "",
    gate: "",
    timelineKind: "milestone",
    displayLaneKeys: [],
    version: 1,
    status: "not_started",
    manualStatus: "not_started",
    derivedStatus: "not_started",
    statusReason: "",
    reasonCodes: [],
    plannedStart: null,
    plannedEnd: null,
    forecastEnd: null,
    actualEnd: null,
    deltaDays: null,
    progressPct: 0,
    dateCertainty: "provisional",
    ownerMemberId: null,
    ownerLabel: "担当未確認",
    nextDeliverable: "次の成果未確認",
    maxIssue: "最大論点未確認",
    completionCriteria: "完了条件未確認",
    completionEvidence: null,
    criticality: "high",
    baselinePlanVersion: "",
    forecastChangeReason: null,
    statusSource: "derived",
    statusOverrideReason: null,
    statusOverrideExpiresOn: null,
    statusOverrideApprovedBy: null,
    lastVerifiedAt: "",
    confidence: "unknown",
    sourceKind: "manual",
    sourceRef: null,
    dependencySlugs: [],
    predecessorIds: [],
    successorIds: [],
    relatedIssueSlugs: [],
    relatedPartnerSlugs: [],
    linkedKpiIds: [],
    isStale: false,
    isOverdue: false,
    isBlocked: false,
  };
  const next = { ...base, ...fields } as SxManagementMilestone;
  return {
    ...next,
    id,
    manualStatus: next.status,
    derivedStatus: next.status,
    forecastEnd: next.forecastEnd ?? next.plannedEnd,
  };
}

/**
 * 新規作成を画面に先に反映する。DBが決める値（version・派生ステータス・並び順）は
 * 仮の初期値で埋めるので、次にDBから読み直したときに正しい値へ揃う。ガントが読む
 * 項目（レーン・日程・タイトル・親子）は送信内容そのままなので、見え方は変わらない。
 */
export function sxInsertOptimisticManagementRecord(
  bundle: SxManagementBundle,
  resource: "task" | "milestone",
  projectId: string,
  id: string,
  fields: Record<string, unknown>,
): SxManagementBundle {
  const normalized = normalizedPatch(resource, fields);
  if (resource === "task")
    return {
      ...bundle,
      tasks: [...bundle.tasks, optimisticTask(projectId, id, normalized)],
    };
  return {
    ...bundle,
    milestones: [...bundle.milestones, optimisticMilestone(id, normalized)],
  };
}
