import { NextRequest, NextResponse } from "next/server";
import { canAccessWorkspaceProject, getCurrentMemberAccess } from "@/lib/project-workspace";
import { getSxManagementBundle } from "@/lib/sx-management";
import { assertSafeRelationshipOrigin } from "@/lib/sx-relationship-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isStrictCalendarDate,
  isValidPlannedRange,
  isValidPointMilestoneRange,
  normalizePointMilestonePatch,
} from "@/lib/sx-gantt-drag";
import { SX_BLOCKING_MILESTONE_SLUGS } from "@/lib/sx-gate-requirements";

// The 2 NewCo founding-prerequisite gates (and their exemption from the generic point-MS
// invariant) only exist in the SX project. SX_BLOCKING_MILESTONE_SLUGS is a readonly
// literal-union tuple (`as const`); .includes() on it only accepts that literal union, not an
// arbitrary string read from a DB row/request body — this wrapper widens the check for those call
// sites without loosening the exported constant's type. Scoping to project_id='p21' too (not just
// the slug) means a same-named slug accidentally created in a different project never gets this
// exemption — mirrors migration 220's point-MS CHECK constraint, which scopes the same way.
const SX_BLOCKING_MILESTONE_PROJECT_ID = "p21";

function isBlockingMilestoneSlug(projectId: string, slug: string): boolean {
  return (
    projectId === SX_BLOCKING_MILESTONE_PROJECT_ID &&
    (SX_BLOCKING_MILESTONE_SLUGS as readonly string[]).includes(slug)
  );
}

type Resource =
  | "objective"
  | "outcome"
  | "milestone"
  | "kpi"
  | "issue"
  | "hypothesis"
  | "evidence"
  | "validation"
  | "decision"
  | "action"
  | "partner"
  | "commitment"
  | "interaction"
  | "partner_role"
  | "partner_work_item"
  | "partner_sample"
  | "dependency"
  | "schedule_dependency"
  | "technical_test"
  | "funding_snapshot"
  | "organization_role"
  | "raci"
  | "capacity"
  | "task";

const RESOURCE_TABLES: Record<Resource, string> = {
  objective: "project_management_objectives",
  outcome: "project_management_outcomes",
  milestone: "project_management_milestones",
  kpi: "project_management_kpis",
  issue: "project_management_issues",
  hypothesis: "project_management_hypotheses",
  evidence: "project_management_evidence",
  validation: "project_management_validation_runs",
  decision: "project_management_decisions",
  action: "project_management_action_items",
  partner: "project_management_partners",
  commitment: "project_management_partner_commitments",
  interaction: "project_management_partner_interactions",
  partner_role: "project_management_partner_roles",
  partner_work_item: "project_management_partner_work_items",
  partner_sample: "project_management_partner_samples",
  dependency: "project_management_milestone_dependencies",
  schedule_dependency: "project_management_schedule_dependencies",
  technical_test: "project_management_technical_tests",
  funding_snapshot: "project_management_funding_snapshots",
  organization_role: "project_management_organization_roles",
  raci: "project_management_raci",
  capacity: "project_management_capacity",
  task: "project_management_tasks",
};

const RESOURCE_META: Record<Resource, { entityType: string; statusColumn: "status" | "decision_state" | null; hasLastVerified: boolean; hasSourceRef: boolean; hasUpdatedBy: boolean; softDelete: boolean }> = {
  objective: { entityType: "objective", statusColumn: "status", hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: true, softDelete: true },
  outcome: { entityType: "outcome", statusColumn: "status", hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: true, softDelete: true },
  milestone: { entityType: "milestone", statusColumn: "status", hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: true, softDelete: true },
  kpi: { entityType: "kpi", statusColumn: null, hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: true, softDelete: true },
  issue: { entityType: "issue", statusColumn: "status", hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: true, softDelete: true },
  hypothesis: { entityType: "hypothesis", statusColumn: "status", hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  evidence: { entityType: "evidence", statusColumn: null, hasLastVerified: true, hasSourceRef: false, hasUpdatedBy: false, softDelete: true },
  validation: { entityType: "validation_run", statusColumn: "status", hasLastVerified: false, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  decision: { entityType: "decision", statusColumn: "decision_state", hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  action: { entityType: "action_item", statusColumn: "status", hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  partner: { entityType: "partner", statusColumn: null, hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  commitment: { entityType: "partner_commitment", statusColumn: "status", hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  interaction: { entityType: "partner_interaction", statusColumn: null, hasLastVerified: false, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  partner_role: { entityType: "partner_role", statusColumn: null, hasLastVerified: false, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  partner_work_item: { entityType: "partner_work_item", statusColumn: "status", hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  partner_sample: { entityType: "partner_sample", statusColumn: "status", hasLastVerified: false, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  dependency: { entityType: "dependency", statusColumn: null, hasLastVerified: false, hasSourceRef: false, hasUpdatedBy: false, softDelete: true },
  schedule_dependency: { entityType: "schedule_dependency", statusColumn: null, hasLastVerified: false, hasSourceRef: false, hasUpdatedBy: true, softDelete: true },
  technical_test: { entityType: "technical_test", statusColumn: "status", hasLastVerified: false, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  funding_snapshot: { entityType: "funding_snapshot", statusColumn: null, hasLastVerified: false, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  organization_role: { entityType: "organization_role", statusColumn: "status", hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  raci: { entityType: "raci", statusColumn: null, hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  capacity: { entityType: "capacity", statusColumn: null, hasLastVerified: false, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  task: { entityType: "task", statusColumn: "status", hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: true, softDelete: true },
};

const DELETED_SELECTS: Record<Resource, string> = {
  objective: "id,slug,title,deleted_at,deleted_by",
  outcome: "id,slug,title,deleted_at,deleted_by",
  milestone: "id,slug,title,deleted_at,deleted_by",
  kpi: "id,slug,title,deleted_at,deleted_by",
  issue: "id,slug,title,deleted_at,deleted_by",
  hypothesis: "id,statement,deleted_at,deleted_by",
  evidence: "id,summary,deleted_at,deleted_by",
  validation: "id,validation_kind,deleted_at,deleted_by",
  decision: "id,title,deleted_at,deleted_by",
  action: "id,title,deleted_at,deleted_by",
  partner: "id,slug,name,deleted_at,deleted_by",
  commitment: "id,title,deleted_at,deleted_by",
  interaction: "id,summary,deleted_at,deleted_by",
  partner_role: "id,role_kind,role_label,deleted_at,deleted_by",
  partner_work_item: "id,title,deleted_at,deleted_by",
  partner_sample: "id,label,deleted_at,deleted_by",
  dependency: "id,note,deleted_at,deleted_by",
  schedule_dependency: "id,predecessor_type,deleted_at,deleted_by",
  technical_test: "id,test_slug,test_name,deleted_at,deleted_by",
  funding_snapshot: "id,snapshot_date,deleted_at,deleted_by",
  organization_role: "id,role_slug,role_name,deleted_at,deleted_by",
  raci: "id,stakeholder_label,deleted_at,deleted_by",
  capacity: "id,role_label,deleted_at,deleted_by",
  task: "id,title,deleted_at,deleted_by",
};

function deletedRecordLabel(resource: Resource, row: Record<string, unknown>) {
  const value = resource === "partner" ? row.name
    : resource === "hypothesis" ? row.statement
      : resource === "evidence" ? row.summary
        : resource === "validation" ? row.validation_kind
          : resource === "interaction" ? row.summary
          : resource === "partner_role" ? row.role_label || row.role_kind
            : resource === "partner_work_item" ? row.title
            : resource === "partner_sample" ? row.label
          : resource === "technical_test" ? row.test_name || row.test_slug
            : resource === "organization_role" ? row.role_name || row.role_slug
              : resource === "capacity" ? row.role_label
                : resource === "funding_snapshot" ? row.snapshot_date
                  : resource === "dependency" ? "ゲート間の依存"
                    : resource === "schedule_dependency" ? "ガントの依存線"
                    : resource === "task" ? row.title
                    : row.title || row.slug;
  return typeof value === "string" && value.trim() ? value : "名称未確認";
}

const MILESTONE_STATUSES = ["not_started", "unassessed", "on_track", "attention", "at_risk", "blocked", "completed"];
const TASK_STATUSES = ["not_started", "unassessed", "on_track", "attention", "at_risk", "blocked", "completed"];
const ISSUE_KINDS = ["fact", "hypothesis", "decision_needed"];
const ISSUE_STATUSES = ["open", "validating", "closed", "on_hold"];
const PARTNER_STAGES = ["candidate", "first_contact", "information_exchange", "hearing", "meeting_coordination", "technical_review", "condition_alignment", "sample_acquisition", "validation_preparation", "agreement_confirmation", "executing", "on_hold", "declined"];
const PARTNER_ACTIVITY_STATES = ["active", "waiting_partner", "waiting_internal", "stalled", "on_hold", "dropped", "unknown"];
const POC_CATEGORIES = ["poc_candidate", "tech_partner", "sample_provider", "sample_route"];
const POC_JUDGMENTS = ["high", "medium", "low"];
const POC_GRADES = ["s", "a", "b", "x"];
const MEETING_MODES = ["onsite", "online", "hybrid", "phone"];
const SAMPLE_STATUSES = ["intent", "negotiating", "agreed_pending", "scheduled", "received", "analyzed", "unknown"];
const AGREEMENT_STATES = ["agreed", "partial", "unagreed"];
const DECISION_STATES = ["pending", "decided", "deferred"];
const ACTION_STATUSES = ["open", "in_progress", "completed", "blocked"];
const COMMITMENT_STATUSES = ["open", "in_progress", "completed", "blocked", "cancelled"];
const TEST_STATUSES = ["unassessed", "planned", "running", "passed", "failed", "blocked"];
const ROLE_STATUSES = ["unassessed", "candidate", "committed", "filled", "on_hold"];
const RACI_ROLES = ["R", "A", "C", "I"];
const TRACKS = ["business_development", "technology_development", "funding", "organizational_building"];
const CONFIDENCES = ["high", "medium", "low", "unknown"];
const BALL_SIDES = ["sx", "partner", "shared", "none", "unknown"];
const DATE_PRECISIONS = ["day", "month", "unknown"];
const INTERACTION_KINDS = ["meeting", "email", "agreement", "deliverable", "handoff", "status_update", "note"];
const ACTOR_SIDES = ["sx", "partner", "shared", "unknown"];
const ROLE_KINDS = ["joint_development", "contract_manufacturing", "customer", "shareholder_investor", "government", "media", "financial_institution", "university_research", "support_organization", "other", "unclassified"];
const RELATIONSHIP_STATES = ["candidate", "in_progress", "established", "on_hold", "ended", "unconfirmed"];
const WORK_ITEM_KINDS = ["task", "question", "deliverable", "decision", "approval", "response"];
const WORK_ITEM_STATUSES = ["open", "in_progress", "waiting", "blocked", "on_hold", "completed", "cancelled"];

function todayJst() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseResource(value: unknown): Resource {
  if (typeof value === "string" && value in RESOURCE_TABLES) return value as Resource;
  throw new Error("対象の種類が不正だよ");
}

function text(value: unknown, field: string, max = 1000) {
  if (typeof value !== "string") throw new Error(`${field}は文字列で入力してね`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field}を入力してね`);
  if (normalized.length > max) throw new Error(`${field}が長すぎるよ`);
  return normalized;
}

function optionalText(value: unknown, field: string, max = 1000) {
  if (value === null || value === "") return null;
  return text(value, field, max);
}

function enumValue(value: unknown, field: string, allowed: string[]) {
  if (typeof value !== "string" || !allowed.includes(value)) throw new Error(`${field}が不正だよ`);
  return value;
}

/** ガントのグループ（レーン）キー。MSは複数グループにまたがって置ける（DB制約 migration 241）。 */
const DISPLAY_LANE_KEYS = [
  "business_development",
  "technology_development",
  "organization",
];

function displayLaneKeysValue(value: unknown, field: string) {
  if (value == null) return null;
  if (!Array.isArray(value)) throw new Error(`${field}が不正だよ`);
  const keys = Array.from(
    new Set(value.map((entry) => enumValue(entry, field, DISPLAY_LANE_KEYS))),
  );
  return keys.length ? keys : null;
}

function dateValue(value: unknown, field: string) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !isStrictCalendarDate(value)) throw new Error(`${field}はYYYY-MM-DDの実在する日付で入力してね`);
  return value;
}

// A normal (data-editing) milestone/task PATCH must always carry expected_version — the version
// the client read the row at (optimistic concurrency for gantt drag/resize, record-sheet edits,
// and every other PATCH caller). Missing/invalid is a 400 (a caller that doesn't track version is
// a bug, not a legitimate "skip the check" case); a version that no longer matches the current row
// is a 409 — someone else's write landed first, and this PATCH must not silently overwrite it.
// EXEMPT: soft-delete (`delete: true`) and restore (`restore: true`) calls for these same two
// resources never reach requiredExpectedVersion — see the `!deleting && !restoring` guard at this
// function's only call site below. Those two are visibility toggles, not data edits (same
// reasoning as safeDeletePatch's provenance handling above), and can race harmlessly against a
// concurrent data PATCH: whichever lands second still applies cleanly (delete/restore touch only
// deleted_at/deleted_by, never planned_start/planned_end/version-guarded fields). Every other
// resource's PATCH neither requires nor reads this field at all, deleting/restoring or not.
function requiredExpectedVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw new Error("expected_versionが必要だよ");
  return value;
}

// migration 191 CHECK contract: unknown precision <-> no date, day/month precision <-> a date. The
// API must reject the same inconsistent combinations the DB would, using the merged (patch +
// existing row) value so a PATCH that only touches one of the two fields is still checked.
function assertDatePrecisionConsistency(dateValueMerged: unknown, precisionMerged: unknown, dateLabel: string, precisionLabel: string) {
  if (precisionMerged === "unknown" && dateValueMerged != null) throw new Error(`${precisionLabel}が未確認のときは${dateLabel}を入力できないよ`);
  if (precisionMerged !== "unknown" && dateValueMerged == null) throw new Error(`${precisionLabel}がday/monthのときは${dateLabel}を入力してね`);
}

// migration 192 CHECK contract: status=completed requires completion_criteria/
// completion_evidence/completed_on already set; item_kind=deliverable AND
// status=completed additionally requires accepted_by/accepted_on. Checked
// against the merged (patch + existing row) value so a PATCH touching only
// one field is still validated the same way the DB CHECK would enforce it.
function assertWorkItemCompletionRequirements(
  statusMerged: unknown,
  itemKindMerged: unknown,
  merged: { completionCriteria: unknown; completedOn: unknown; completionEvidence: unknown; acceptedBy: unknown; acceptedOn: unknown },
) {
  if (statusMerged !== "completed") return;
  if (merged.completionCriteria == null || merged.completionEvidence == null || merged.completedOn == null) {
    throw new Error("保有事項を完了にするには完了条件・完了証跡・完了日が必要だよ");
  }
  if (itemKindMerged === "deliverable" && (merged.acceptedBy == null || merged.acceptedOn == null)) {
    throw new Error("成果物を完了にするには受入担当・受入日が必要だよ");
  }
}

function numericValue(value: unknown, field: string, { min = -Infinity, max = Infinity } = {}) {
  if (value === null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${field}が不正だよ`);
  return Math.round(number * 100) / 100;
}

function booleanValue(value: unknown, field: string) {
  if (typeof value !== "boolean") throw new Error(`${field}は真偽値で入力してね`);
  return value;
}

function patchFor(resource: Resource, raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) throw new Error("更新内容が空だよ");
  const patch: Record<string, unknown> = {};
  const takeText = (input: string, output = input, max = 1000) => { if (input in raw) patch[output] = text(raw[input], input, max); };
  const takeOptionalText = (input: string, output = input, max = 1000) => { if (input in raw) patch[output] = optionalText(raw[input], input, max); };
  const takeDate = (input: string, output = input) => { if (input in raw) patch[output] = dateValue(raw[input], input); };
  const takeEnum = (input: string, allowed: string[], output = input) => { if (input in raw) patch[output] = enumValue(raw[input], input, allowed); };
  const takeNumber = (input: string, options?: { min?: number; max?: number }) => { if (input in raw) patch[input] = numericValue(raw[input], input, options); };
  const takeBoolean = (input: string) => { if (input in raw) patch[input] = booleanValue(raw[input], input); };

  if (resource === "objective") {
    takeText("title", "title", 180); takeText("definition_of_done", "definition_of_done", 1200); takeDate("target_date"); takeEnum("date_certainty", ["confirmed", "provisional"]); takeEnum("status", ["unassessed", "active", "completed", "on_hold"]); takeEnum("confidence", CONFIDENCES);
  }
  if (resource === "outcome") {
    takeText("title", "title", 180); takeText("definition_of_done", "definition_of_done", 1200); takeText("owner_label", "owner_label", 120); takeEnum("status", ["unassessed", "active", "completed", "on_hold"]); takeEnum("confidence", CONFIDENCES);
  }
  if (resource === "milestone") {
    takeText("title", "title", 180); takeText("gate", "gate", 240); takeEnum("status", MILESTONE_STATUSES); takeDate("planned_start"); takeDate("planned_end"); takeDate("forecast_end"); takeDate("actual_end"); takeNumber("progress_pct", { min: 0, max: 100 }); takeEnum("date_certainty", ["confirmed", "provisional"]); takeText("owner_label", "owner_label", 120); takeText("next_deliverable", "next_deliverable", 500); takeText("max_issue", "max_issue", 500); takeText("completion_criteria", "completion_criteria", 1200); takeOptionalText("completion_evidence", "completion_evidence", 1200); takeEnum("criticality", ["critical", "high", "medium", "low"]); takeText("baseline_plan_version", "baseline_plan_version", 120); takeOptionalText("forecast_change_reason", "forecast_change_reason", 500); takeEnum("confidence", CONFIDENCES);
    if ("display_lane_keys" in raw) patch.display_lane_keys = displayLaneKeysValue(raw.display_lane_keys, "display_lane_keys");
    if ("status_source" in raw) patch.status_source = enumValue(raw.status_source, "status_source", ["derived", "manual", "override"]);
    takeOptionalText("status_override_reason", "status_override_reason", 500); takeDate("status_override_expires_on"); takeOptionalText("status_override_approved_by", "status_override_approved_by", 120);
  }
  if (resource === "kpi") {
    takeText("title", "title", 180); takeText("metric_kind", "metric_kind", 120); takeNumber("baseline"); takeNumber("target"); takeNumber("actual"); takeText("unit", "unit", 60); takeNumber("threshold"); takeEnum("threshold_rule", ["gte", "lte", "between"]); takeNumber("threshold_upper"); takeDate("measurement_date"); takeText("frequency", "frequency", 60); takeText("source_label", "source_label", 240); takeEnum("confidence", CONFIDENCES);
  }
  if (resource === "issue") {
    takeText("title", "title", 180); takeEnum("knowledge_type", ISSUE_KINDS); takeEnum("status", ISSUE_STATUSES); takeText("owner_label", "owner_label", 120); takeDate("due_date"); takeEnum("confidence", CONFIDENCES);
  }
  if (resource === "hypothesis") {
    takeText("statement", "statement", 1200); takeEnum("status", ["open", "validating", "validated", "rejected", "decided", "on_hold"]); takeText("owner_label", "owner_label", 120); takeDate("due_date"); takeEnum("confidence", CONFIDENCES);
  }
  if (resource === "evidence") {
    takeEnum("evidence_kind", ["supporting", "counter", "missing", "observation"]); takeText("summary", "summary", 1600); takeDate("observed_on"); takeText("source_label", "source_label", 240); takeEnum("confidence", CONFIDENCES);
  }
  if (resource === "validation") {
    takeText("validation_kind", "validation_kind", 180); takeDate("planned_on"); takeDate("due_date"); takeDate("completed_on"); takeEnum("status", ["planned", "running", "completed", "blocked", "cancelled"]); takeText("owner_label", "owner_label", 120); takeText("method", "method", 1200); takeOptionalText("result_summary", "result_summary", 1600); takeEnum("confidence", CONFIDENCES);
  }
  if (resource === "decision") {
    takeText("title", "title", 180); takeText("context", "context", 1200); takeText("rationale", "rationale", 1200); takeOptionalText("decision_text", "decision_text", 1200); takeOptionalText("decided_by", "decided_by", 120); takeDate("decided_on"); takeDate("due_date"); takeText("owner_label", "owner_label", 120);
    if ("status" in raw) {
      const status = enumValue(raw.status, "status", ["open", ...DECISION_STATES]);
      patch.decision_state = status === "open" ? "pending" : status;
    }
    if ("decision_state" in raw) patch.decision_state = enumValue(raw.decision_state, "decision_state", DECISION_STATES);
    takeBoolean("is_this_week"); takeEnum("confidence", CONFIDENCES);
  }
  if (resource === "action") {
    takeText("title", "title", 240); takeText("owner_label", "owner_label", 120); takeDate("due_date"); takeText("completion_criteria", "completion_criteria", 1200); takeDate("next_review_on"); takeEnum("status", ACTION_STATUSES); takeOptionalText("completion_note", "completion_note", 1200); takeDate("completed_at");
  }
  if (resource === "partner") {
    takeText("name", "name", 180); takeOptionalText("introducer_label", "introducer_label", 120); takeOptionalText("connection_context", "connection_context", 500); takeText("role_label", "role_label", 240); takeEnum("primary_track", TRACKS); takeEnum("relationship_stage", PARTNER_STAGES); takeEnum("agreement_state", AGREEMENT_STATES); takeText("agreed_scope", "agreed_scope", 1000); takeText("unagreed_scope", "unagreed_scope", 1000); takeDate("last_contact_date"); takeText("next_commitment", "next_commitment", 1000); takeDate("due_date"); takeText("owner_label", "owner_label", 120); takeEnum("current_ball_side", BALL_SIDES); takeOptionalText("current_ball_owner", "current_ball_owner", 120); takeOptionalText("next_ball_owner", "next_ball_owner", 120); takeOptionalText("target_state", "target_state", 500); takeEnum("due_date_precision", DATE_PRECISIONS); takeEnum("confidence", CONFIDENCES);
    takeEnum("activity_state", PARTNER_ACTIVITY_STATES);
    if ("poc_category" in raw) patch.poc_category = raw.poc_category == null || raw.poc_category === "" ? null : enumValue(raw.poc_category, "poc_category", POC_CATEGORIES);
    // 判断2軸は未評価を空文字で送ってNULLへ戻せるようにする。推測値を既定で入れない。
    for (const key of ["poc_likelihood", "customer_value"] as const) {
      if (key in raw) patch[key] = raw[key] == null || raw[key] === "" ? null : enumValue(raw[key], key, POC_JUDGMENTS);
    }
    // 最左の評価カラム。空文字で「未」(NULL) へ戻せる。合成せず人が直接付ける。
    if ("poc_grade" in raw) patch.poc_grade = raw.poc_grade == null || raw.poc_grade === "" ? null : enumValue(raw.poc_grade, "poc_grade", POC_GRADES);
    takeOptionalText("value_note", "value_note", 240);
    takeOptionalText("effluent_components", "effluent_components", 500);
    takeOptionalText("effluent_volume_annual", "effluent_volume_annual", 240);
    takeOptionalText("effluent_cost_annual", "effluent_cost_annual", 240);
    // 次回面談。空文字でNULLへ戻せる。形式は未定(NULL)を既定にし、推測で埋めない。
    takeDate("next_meeting_on");
    takeOptionalText("next_meeting_time", "next_meeting_time", 60);
    if ("next_meeting_mode" in raw) patch.next_meeting_mode = raw.next_meeting_mode == null || raw.next_meeting_mode === "" ? null : enumValue(raw.next_meeting_mode, "next_meeting_mode", MEETING_MODES);
    takeOptionalText("next_meeting_place", "next_meeting_place", 500);
    takeOptionalText("next_meeting_prep", "next_meeting_prep", 1200);
    assertSafeRelationshipOrigin(patch.introducer_label, "紹介者"); assertSafeRelationshipOrigin(patch.connection_context, "接点の経緯");
  }
  if (resource === "interaction") {
    takeEnum("interaction_kind", INTERACTION_KINDS); takeDate("occurred_on"); takeEnum("occurred_on_precision", DATE_PRECISIONS); takeText("summary", "summary", 1000); takeOptionalText("outcome_summary", "outcome_summary", 1200); takeEnum("ball_side_after", BALL_SIDES); takeOptionalText("ball_owner_after", "ball_owner_after", 120); takeEnum("actor_side", ACTOR_SIDES); takeOptionalText("actor_label", "actor_label", 120); takeEnum("confidence", CONFIDENCES);
    // 議事録本文。外部共有リンクが失効しても内容が残るよう全文を保存する。
    takeOptionalText("detail_md", "detail_md", 40000);
  }
  if (resource === "partner_role") {
    takeEnum("role_kind", ROLE_KINDS); takeEnum("relationship_state", RELATIONSHIP_STATES); takeOptionalText("role_label", "role_label", 240); takeBoolean("is_primary"); takeNumber("sort_order", { min: 0 });
  }
  if (resource === "partner_work_item") {
    takeEnum("side", ACTOR_SIDES); takeEnum("item_kind", WORK_ITEM_KINDS); takeText("title", "title", 240); takeOptionalText("detail", "detail", 1200); takeOptionalText("owner_label", "owner_label", 120); takeEnum("status", WORK_ITEM_STATUSES); takeDate("due_date"); takeEnum("due_date_precision", DATE_PRECISIONS); takeOptionalText("completion_criteria", "completion_criteria", 1200); takeDate("completed_on"); takeOptionalText("completion_evidence", "completion_evidence", 1200); takeOptionalText("accepted_by", "accepted_by", 120); takeDate("accepted_on"); takeOptionalText("handoff_to", "handoff_to", 240); takeEnum("confidence", CONFIDENCES); takeNumber("sort_order", { min: 0 });
    if ("related_milestone_id" in raw) patch.related_milestone_id = raw.related_milestone_id == null || raw.related_milestone_id === "" ? null : text(raw.related_milestone_id, "related_milestone_id", 80);
  }
  if (resource === "partner_sample") {
    takeText("label", "label", 240); takeEnum("status", SAMPLE_STATUSES); takeDate("received_on"); takeOptionalText("storage_location", "storage_location", 240); takeOptionalText("owner_label", "owner_label", 120); takeOptionalText("notes", "notes", 1200); takeEnum("confidence", CONFIDENCES); takeNumber("sort_order", { min: 0 });
  }
  if (resource === "commitment") {
    takeText("title", "title", 180); takeText("commitment_text", "commitment_text", 1000); takeEnum("commitment_kind", ["counterparty_promise", "sx_followup"]); takeEnum("status", COMMITMENT_STATUSES); takeDate("promised_on"); takeDate("due_date"); takeDate("completed_on"); takeText("owner_label", "owner_label", 120); takeOptionalText("counterparty_owner", "counterparty_owner", 120); takeOptionalText("sx_owner", "sx_owner", 120); takeOptionalText("evidence", "evidence", 1200); takeDate("next_review_on"); takeEnum("confidence", CONFIDENCES);
    if (patch.commitment_kind === "counterparty_promise" && (!patch.counterparty_owner || !patch.promised_on || !patch.evidence)) throw new Error("相手の約束には相手担当・約束日・一次根拠が必要だよ");
  }
  if (resource === "dependency") {
    takeEnum("dependency_type", ["finish_to_start", "start_to_start", "finish_to_finish"]); takeBoolean("required"); takeNumber("lag_days", { min: 0 }); takeOptionalText("note", "note", 1000);
  }
  // Schedule dependencies are created/removed directly on the gantt. Their endpoints are
  // immutable: changing a line means remove it and draw another one, so PATCH exposes no fields.
  if (resource === "technical_test") {
    takeText("test_condition", "test_condition", 1000); takeOptionalText("target", "target", 240); takeOptionalText("actual", "actual", 240); takeText("unit", "unit", 60); takeNumber("repetition", { min: 0 }); takeOptionalText("sample", "sample", 240); takeText("trl_criterion", "trl_criterion", 1000); takeOptionalText("evidence", "evidence", 1200); takeEnum("status", TEST_STATUSES); takeDate("measured_on"); takeText("owner_label", "owner_label", 120); takeEnum("confidence", CONFIDENCES);
  }
  if (resource === "funding_snapshot") {
    takeNumber("required_amount", { min: 0 }); takeNumber("secured_amount", { min: 0 }); takeNumber("unconfirmed_amount", { min: 0 }); takeText("use_summary", "use_summary", 1000); takeNumber("burn_per_month", { min: 0 }); takeNumber("runway_months", { min: 0 }); takeNumber("probability", { min: 0, max: 1 }); takeText("cash_condition", "cash_condition", 1200); takeText("source_label", "source_label", 240); takeEnum("confidence", CONFIDENCES);
  }
  if (resource === "organization_role") {
    takeOptionalText("candidate", "candidate", 240); takeOptionalText("commitment", "commitment", 500); takeText("authority", "authority", 1000); takeBoolean("vacancy"); takeText("join_condition", "join_condition", 1000); takeDate("due_date"); takeEnum("status", ROLE_STATUSES); takeText("owner_label", "owner_label", 120); takeEnum("confidence", CONFIDENCES);
  }
  if (resource === "raci") {
    takeText("stakeholder_label", "stakeholder_label", 180); takeEnum("responsibility_role", RACI_ROLES); takeText("owner_label", "owner_label", 120); takeBoolean("confirmed"); takeEnum("confidence", CONFIDENCES);
  }
  if (resource === "capacity") {
    takeText("role_label", "role_label", 180); takeNumber("required_people", { min: 0 }); takeNumber("confirmed_people", { min: 0 }); takeNumber("available_hours_week", { min: 0 }); takeNumber("planned_hours_week", { min: 0 }); takeDate("measurement_date"); takeText("source_label", "source_label", 240); takeEnum("confidence", CONFIDENCES);
  }
  if (resource === "task") {
    takeText("title", "title", 180); takeOptionalText("description", "description", 1600); takeEnum("track", TRACKS); takeEnum("status", TASK_STATUSES); takeDate("planned_start"); takeDate("planned_end"); takeDate("forecast_end"); takeDate("actual_end"); takeNumber("progress_pct", { min: 0, max: 100 }); takeEnum("date_certainty", ["confirmed", "provisional"]); takeText("owner_label", "owner_label", 120); takeOptionalText("owner_member_id", "owner_member_id", 80); takeOptionalText("goal", "goal", 1200); takeOptionalText("next_deliverable", "next_deliverable", 500); takeOptionalText("blocker", "blocker", 500); takeOptionalText("completion_criteria", "completion_criteria", 1200); takeOptionalText("forecast_change_reason", "forecast_change_reason", 500); takeNumber("sort_order", { min: 0 }); takeEnum("confidence", CONFIDENCES);
    if ("milestone_id" in raw) patch.milestone_id = text(raw.milestone_id, "milestone_id", 80);
    if ("parent_task_id" in raw) patch.parent_task_id = raw.parent_task_id == null || raw.parent_task_id === "" ? null : text(raw.parent_task_id, "parent_task_id", 80);
  }
  if (Object.keys(patch).length === 0) throw new Error("更新できる項目がないよ");
  return patch;
}

// Soft-delete and restore are visibility toggles, not edits: they must never
// touch source_kind/source_ref, so a soft-deleted/restored row's original
// provenance (a migration seed, an import, current_truth) survives
// unchanged. An ordinary PATCH is different (2026-07-24 P0 reversal): it
// always stamps manual provenance below (see the hasSourceRef branch in
// PATCH) so the field-audit trail shows a human edited the row through this
// screen, not that it silently keeps reporting its original seed/import
// source forever. createFor() (a brand-new manual row) and the POST/PATCH
// audit-write rollback compensation stamp the same manual/PWA共有管理画面
// pair for the same reason. Seed rows (e.g. migration 192's role/work-item
// seed) key their existence checks on a fixed id, never on source_ref, so
// this reassignment can never cause a revival bug.
function safeDeletePatch(memberId: string) {
  return { deleted_at: new Date().toISOString(), deleted_by: memberId };
}

function createFor(resource: Resource, raw: unknown, projectId: string, memberId: string, today: string): Record<string, unknown> {
  if (!isRecord(raw)) throw new Error("追加内容が空だよ");
  const source = { source_kind: "manual", source_ref: "PWA共有管理画面" };
  const requiredText = (key: string, max = 1000) => text(raw[key], key, max);
  const optionalTextValue = (key: string, max = 1000) => raw[key] == null || raw[key] === "" ? null : text(raw[key], key, max);
  const requiredDate = (key: string, fallback = today) => dateValue(raw[key] == null || raw[key] === "" ? fallback : raw[key], key);
  const optionalDate = (key: string) => raw[key] == null || raw[key] === "" ? null : dateValue(raw[key], key);
  const requiredNumber = (key: string, options?: { min?: number; max?: number }) => numericValue(raw[key], key, options);
  const optionalNumber = (key: string, options?: { min?: number; max?: number }) => raw[key] == null || raw[key] === "" ? null : numericValue(raw[key], key, options);
  const requiredEnum = (key: string, allowed: string[], fallback?: string) => enumValue(raw[key] == null && fallback ? fallback : raw[key], key, allowed);
  const optionalId = (key: string) => raw[key] == null || raw[key] === "" ? null : text(raw[key], key, 80);
  const requiredId = (key: string) => text(raw[key], key, 80);
  const common = (withSource = true) => withSource ? source : {};

  if (resource === "objective") return { ...common(), project_id: projectId, slug: requiredText("slug", 120), title: requiredText("title", 180), definition_of_done: requiredText("definition_of_done", 1200), target_date: optionalDate("target_date"), date_certainty: requiredEnum("date_certainty", ["confirmed", "provisional"], "provisional"), status: "unassessed", last_verified_at: today, confidence: requiredEnum("confidence", CONFIDENCES, "unknown"), created_by: memberId, updated_by: memberId };
  if (resource === "outcome") return { ...common(), project_id: projectId, objective_id: requiredId("objective_id"), slug: requiredText("slug", 120), track: requiredEnum("track", TRACKS), title: requiredText("title", 180), definition_of_done: requiredText("definition_of_done", 1200), owner_label: requiredText("owner_label", 120), status: "unassessed", last_verified_at: today, confidence: requiredEnum("confidence", CONFIDENCES, "unknown"), created_by: memberId, updated_by: memberId };
  if (resource === "milestone") {
    const plannedStart = optionalDate("planned_start");
    const plannedEnd = optionalDate("planned_end");
    if (!isValidPlannedRange({ plannedStart, plannedEnd })) throw new Error("計画開始は計画完了より後にできないよ");
    // The UI creates point MS records only. `phase` remains accepted for legacy compatibility
    // data, but it is not a user-facing management concept any more.
    const timelineKind = requiredEnum("timeline_kind", ["phase", "milestone"], "phase");
    const slug = requiredText("slug", 120);
    // Generic point-MS invariant: any timeline_kind='milestone' row other than the 2 NewCo
    // founding-prerequisite gates must have planned_start/planned_end null together or equal —
    // mirrors the DB CHECK (migration 220).
    if (
      timelineKind === "milestone" &&
      !isBlockingMilestoneSlug(projectId, slug) &&
      !isValidPointMilestoneRange({ plannedStart, plannedEnd })
    ) {
      throw new Error("このMSは単一の予定日として扱うため、開始日と完了日は同じにしてね");
    }
    const title = requiredText("title", 180);
    const pointMs = timelineKind === "milestone";
    return {
      ...common(),
      project_id: projectId,
      objective_id: requiredId("objective_id"),
      outcome_id: requiredId("outcome_id"),
      slug,
      track: requiredEnum("track", TRACKS),
      title,
      display_lane_keys: displayLaneKeysValue(raw.display_lane_keys, "display_lane_keys"),
      // gate/next_deliverable are legacy NOT NULL columns. A point MS can start with these
      // explicitly unknown and be refined later.
      gate: pointMs ? optionalTextValue("gate", 240) || "未設定" : requiredText("gate", 240),
      timeline_kind: timelineKind,
      status: "unassessed",
      planned_start: plannedStart,
      planned_end: plannedEnd,
      forecast_end: optionalDate("forecast_end"),
      actual_end: null,
      progress_pct: 0,
      date_certainty: requiredEnum("date_certainty", ["confirmed", "provisional"], "provisional"),
      owner_label: pointMs ? optionalTextValue("owner_label", 120) || "担当未確認" : requiredText("owner_label", 120),
      next_deliverable: pointMs ? optionalTextValue("next_deliverable", 500) || "次の成果未確認" : requiredText("next_deliverable", 500),
      max_issue: pointMs ? optionalTextValue("max_issue", 500) || "未確認" : requiredText("max_issue", 500),
      completion_criteria: pointMs ? optionalTextValue("completion_criteria", 1200) || "未設定" : requiredText("completion_criteria", 1200),
      completion_evidence: null,
      // A newly placed point marker is not an implicit high-priority gate. Keep it neutral until
      // the user explicitly changes its importance from the detail view.
      criticality: requiredEnum(
        "criticality",
        ["critical", "high", "medium", "low"],
        pointMs ? "medium" : "high",
      ),
      baseline_plan_version: optionalTextValue("baseline_plan_version", 120) || "184-manual",
      forecast_change_reason: null,
      status_source: "derived",
      status_reason: "新規追加直後は未評価",
      last_verified_at: today,
      confidence: requiredEnum("confidence", CONFIDENCES, "unknown"),
      created_by: memberId,
      updated_by: memberId,
    };
  }
  if (resource === "kpi") {
    const thresholdRule = requiredEnum("threshold_rule", ["gte", "lte", "between"], "gte");
    const threshold = optionalNumber("threshold");
    const thresholdUpper = optionalNumber("threshold_upper");
    if (thresholdRule === "between" && (threshold == null || thresholdUpper == null || threshold > thresholdUpper)) throw new Error("範囲内ルールは下限と上限を入力し、下限を上限以下にしてね");
    return { ...common(), project_id: projectId, outcome_id: requiredId("outcome_id"), track: requiredEnum("track", TRACKS), slug: requiredText("slug", 120), title: requiredText("title", 180), metric_kind: requiredText("metric_kind", 120), baseline: optionalNumber("baseline"), target: optionalNumber("target"), actual: optionalNumber("actual"), unit: requiredText("unit", 60), threshold, measurement_date: optionalDate("measurement_date"), frequency: requiredText("frequency", 60), source_label: requiredText("source_label", 240), threshold_rule: thresholdRule, threshold_upper: thresholdUpper, confidence: requiredEnum("confidence", CONFIDENCES, "unknown"), last_verified_at: today, created_by: memberId, updated_by: memberId };
  }
  if (resource === "issue") return { ...common(), project_id: projectId, milestone_id: optionalId("milestone_id"), outcome_id: optionalId("outcome_id"), slug: requiredText("slug", 120), track: requiredEnum("track", TRACKS), title: requiredText("title", 180), knowledge_type: requiredEnum("knowledge_type", ISSUE_KINDS), status: requiredEnum("status", ISSUE_STATUSES, "open"), owner_label: requiredText("owner_label", 120), due_date: optionalDate("due_date"), last_verified_at: today, confidence: requiredEnum("confidence", CONFIDENCES, "unknown"), created_by: memberId, updated_by: memberId };
  if (resource === "hypothesis") return { ...common(), project_id: projectId, issue_id: requiredId("issue_id"), statement: requiredText("statement", 1200), status: requiredEnum("status", ["open", "validating", "validated", "rejected", "decided", "on_hold"], "open"), owner_label: requiredText("owner_label", 120), due_date: optionalDate("due_date"), confidence: requiredEnum("confidence", CONFIDENCES, "unknown"), last_verified_at: today };
  if (resource === "evidence") return { project_id: projectId, issue_id: requiredId("issue_id"), hypothesis_id: optionalId("hypothesis_id"), evidence_kind: requiredEnum("evidence_kind", ["supporting", "counter", "missing", "observation"]), summary: requiredText("summary", 1600), observed_on: optionalDate("observed_on"), source_label: requiredText("source_label", 240), confidence: requiredEnum("confidence", CONFIDENCES, "unknown"), last_verified_at: today, created_by: memberId };
  if (resource === "validation") return { ...common(), project_id: projectId, hypothesis_id: requiredId("hypothesis_id"), validation_kind: requiredText("validation_kind", 180), planned_on: optionalDate("planned_on"), due_date: optionalDate("due_date"), completed_on: optionalDate("completed_on"), status: requiredEnum("status", ["planned", "running", "completed", "blocked", "cancelled"], "planned"), owner_label: requiredText("owner_label", 120), method: requiredText("method", 1200), result_summary: optionalTextValue("result_summary", 1600), confidence: requiredEnum("confidence", CONFIDENCES, "unknown") };
  if (resource === "decision") {
    const issueId = optionalId("issue_id");
    const hypothesisId = optionalId("hypothesis_id");
    if (!issueId && !hypothesisId) throw new Error("意思決定には論点または仮説をつないでね");
    const status = raw.status == null ? "pending" : raw.status === "open" ? "pending" : requiredEnum("status", DECISION_STATES);
    const decisionText = optionalTextValue("decision_text", 1200);
    const decidedBy = optionalTextValue("decided_by", 120);
    const decidedOn = optionalDate("decided_on");
    if (status === "decided" && (!decisionText || !decidedBy || !decidedOn)) throw new Error("決定済みにするには決定内容・決定者・決定日が必要だよ");
    return { ...common(), project_id: projectId, issue_id: issueId, hypothesis_id: hypothesisId, title: requiredText("title", 180), context: requiredText("context", 1200), decision_state: status, rationale: requiredText("rationale", 1200), decision_text: decisionText, decided_by: decidedBy, decided_on: decidedOn, owner_label: requiredText("owner_label", 120), due_date: optionalDate("due_date"), is_this_week: raw.is_this_week == null ? false : booleanValue(raw.is_this_week, "is_this_week"), sort_order: optionalNumber("sort_order", { min: 0 }) || 0, confidence: requiredEnum("confidence", CONFIDENCES, "unknown"), last_verified_at: today };
  }
  if (resource === "action") return { ...common(), project_id: projectId, decision_id: requiredId("decision_id"), title: requiredText("title", 240), owner_label: requiredText("owner_label", 120), due_date: optionalDate("due_date"), completion_criteria: requiredText("completion_criteria", 1200), next_review_on: optionalDate("next_review_on"), status: requiredEnum("status", ACTION_STATUSES, "open"), completion_note: optionalTextValue("completion_note", 1200), completed_at: optionalDate("completed_at"), last_verified_at: today };
  if (resource === "partner") {
    const dueDate = optionalDate("due_date");
    const dueDatePrecision = requiredEnum("due_date_precision", DATE_PRECISIONS, "unknown");
    const introducerLabel = optionalTextValue("introducer_label", 120);
    const connectionContext = optionalTextValue("connection_context", 500);
    assertDatePrecisionConsistency(dueDate, dueDatePrecision, "期限日", "期限精度");
    assertSafeRelationshipOrigin(introducerLabel, "紹介者"); assertSafeRelationshipOrigin(connectionContext, "接点の経緯");
    return { ...common(), project_id: projectId, slug: requiredText("slug", 120), name: requiredText("name", 180), introducer_label: introducerLabel, connection_context: connectionContext, role_label: requiredText("role_label", 240), primary_track: requiredEnum("primary_track", TRACKS), relationship_stage: requiredEnum("relationship_stage", PARTNER_STAGES, "candidate"), activity_state: requiredEnum("activity_state", PARTNER_ACTIVITY_STATES, "unknown"), poc_category: raw.poc_category == null || raw.poc_category === "" ? null : enumValue(raw.poc_category, "poc_category", POC_CATEGORIES), agreement_state: requiredEnum("agreement_state", AGREEMENT_STATES, "unagreed"), agreed_scope: requiredText("agreed_scope", 1000), unagreed_scope: requiredText("unagreed_scope", 1000), last_contact_date: optionalDate("last_contact_date"), next_commitment: requiredText("next_commitment", 1000), due_date: dueDate, owner_label: requiredText("owner_label", 120), current_ball_side: requiredEnum("current_ball_side", BALL_SIDES, "unknown"), current_ball_owner: optionalTextValue("current_ball_owner", 120), next_ball_owner: optionalTextValue("next_ball_owner", 120), target_state: optionalTextValue("target_state", 500), due_date_precision: dueDatePrecision, last_verified_at: today, confidence: requiredEnum("confidence", CONFIDENCES, "unknown") };
  }
  if (resource === "interaction") {
    const occurredOn = optionalDate("occurred_on");
    const occurredOnPrecision = requiredEnum("occurred_on_precision", DATE_PRECISIONS, "unknown");
    assertDatePrecisionConsistency(occurredOn, occurredOnPrecision, "発生日", "発生日の確度");
    return { ...common(), project_id: projectId, partner_id: requiredId("partner_id"), interaction_kind: requiredEnum("interaction_kind", INTERACTION_KINDS), occurred_on: occurredOn, occurred_on_precision: occurredOnPrecision, summary: requiredText("summary", 1000), outcome_summary: optionalTextValue("outcome_summary", 1200), ball_side_after: requiredEnum("ball_side_after", BALL_SIDES, "unknown"), ball_owner_after: optionalTextValue("ball_owner_after", 120), actor_side: requiredEnum("actor_side", ACTOR_SIDES, "unknown"), actor_label: optionalTextValue("actor_label", 120), confidence: requiredEnum("confidence", CONFIDENCES, "unknown") };
  }
  if (resource === "partner_role") {
    return { ...common(), project_id: projectId, partner_id: requiredId("partner_id"), role_kind: requiredEnum("role_kind", ROLE_KINDS, "unclassified"), relationship_state: requiredEnum("relationship_state", RELATIONSHIP_STATES, "unconfirmed"), role_label: optionalTextValue("role_label", 240), is_primary: raw.is_primary == null ? false : booleanValue(raw.is_primary, "is_primary"), sort_order: optionalNumber("sort_order", { min: 0 }) || 0 };
  }
  if (resource === "partner_work_item") {
    const dueDate = optionalDate("due_date");
    const dueDatePrecision = requiredEnum("due_date_precision", DATE_PRECISIONS, "unknown");
    assertDatePrecisionConsistency(dueDate, dueDatePrecision, "期限日", "期限精度");
    const itemKind = requiredEnum("item_kind", WORK_ITEM_KINDS);
    const status = requiredEnum("status", WORK_ITEM_STATUSES, "open");
    const completionCriteria = optionalTextValue("completion_criteria", 1200);
    const completedOn = optionalDate("completed_on");
    const completionEvidence = optionalTextValue("completion_evidence", 1200);
    const acceptedBy = optionalTextValue("accepted_by", 120);
    const acceptedOn = optionalDate("accepted_on");
    assertWorkItemCompletionRequirements(status, itemKind, { completionCriteria, completedOn, completionEvidence, acceptedBy, acceptedOn });
    return { ...common(), project_id: projectId, partner_id: requiredId("partner_id"), side: requiredEnum("side", ACTOR_SIDES, "unknown"), item_kind: itemKind, title: requiredText("title", 240), detail: optionalTextValue("detail", 1200), owner_label: optionalTextValue("owner_label", 120), status, due_date: dueDate, due_date_precision: dueDatePrecision, completion_criteria: completionCriteria, completed_on: completedOn, completion_evidence: completionEvidence, accepted_by: acceptedBy, accepted_on: acceptedOn, handoff_to: optionalTextValue("handoff_to", 240), related_milestone_id: optionalId("related_milestone_id"), last_verified_at: today, confidence: requiredEnum("confidence", CONFIDENCES, "unknown"), sort_order: optionalNumber("sort_order", { min: 0 }) || 0 };
  }
  if (resource === "partner_sample") {
    return { ...common(), project_id: projectId, partner_id: requiredId("partner_id"), label: requiredText("label", 240), status: requiredEnum("status", SAMPLE_STATUSES, "unknown"), received_on: optionalDate("received_on"), storage_location: optionalTextValue("storage_location", 240), owner_label: optionalTextValue("owner_label", 120), notes: optionalTextValue("notes", 1200), confidence: requiredEnum("confidence", CONFIDENCES, "unknown"), sort_order: optionalNumber("sort_order", { min: 0 }) || 0 };
  }
  if (resource === "commitment") {
    const kind = requiredEnum("commitment_kind", ["counterparty_promise", "sx_followup"]);
    const counterpartyOwner = optionalTextValue("counterparty_owner", 120);
    const sxOwner = optionalTextValue("sx_owner", 120);
    const promisedOn = optionalDate("promised_on");
    const dueDate = optionalDate("due_date");
    const nextReviewOn = optionalDate("next_review_on");
    const evidence = optionalTextValue("evidence", 1200);
    if (kind === "counterparty_promise" && (!counterpartyOwner || !promisedOn || !evidence)) throw new Error("相手の約束には相手担当・約束日・一次根拠が必要だよ");
    if (kind === "sx_followup" && (!sxOwner || !dueDate || !nextReviewOn)) throw new Error("SX側の次アクションにはSX担当・期限・次回確認が必要だよ");
    return { ...common(), project_id: projectId, partner_id: requiredId("partner_id"), title: requiredText("title", 180), commitment_text: requiredText("commitment_text", 1000), commitment_kind: kind, status: requiredEnum("status", COMMITMENT_STATUSES, "open"), promised_on: promisedOn, due_date: dueDate, completed_on: optionalDate("completed_on"), owner_label: requiredText("owner_label", 120), counterparty_owner: counterpartyOwner, sx_owner: sxOwner, evidence, next_review_on: nextReviewOn, last_verified_at: today, confidence: requiredEnum("confidence", CONFIDENCES, "unknown") };
  }
  if (resource === "dependency") return { project_id: projectId, predecessor_milestone_id: requiredId("predecessor_milestone_id"), successor_milestone_id: requiredId("successor_milestone_id"), dependency_type: requiredEnum("dependency_type", ["finish_to_start", "start_to_start", "finish_to_finish"], "finish_to_start"), required: raw.required == null ? true : booleanValue(raw.required, "required"), lag_days: optionalNumber("lag_days", { min: 0 }) || 0, note: optionalTextValue("note", 1000), created_by: memberId };
  if (resource === "schedule_dependency") {
    const predecessorType = requiredEnum("predecessor_type", ["task", "milestone"]);
    const predecessorId = requiredId("predecessor_id");
    const successorType = raw.successor_type == null
      ? "task"
      : requiredEnum("successor_type", ["task", "milestone"]);
    const successorId = raw.successor_id == null
      ? successorType === "task"
        ? requiredId("successor_task_id")
        : requiredId("successor_milestone_id")
      : requiredId("successor_id");
    return {
      project_id: projectId,
      predecessor_type: predecessorType,
      predecessor_task_id: predecessorType === "task" ? predecessorId : null,
      predecessor_milestone_id: predecessorType === "milestone" ? predecessorId : null,
      successor_type: successorType,
      successor_task_id: successorType === "task" ? successorId : null,
      successor_milestone_id: successorType === "milestone" ? successorId : null,
      dependency_type: "finish_to_start",
      created_by: memberId,
      updated_by: memberId,
    };
  }
  if (resource === "technical_test") return { ...common(), project_id: projectId, milestone_id: optionalId("milestone_id"), outcome_id: optionalId("outcome_id"), test_slug: requiredText("test_slug", 120), test_name: requiredText("test_name", 180), test_condition: requiredText("test_condition", 1000), target: optionalTextValue("target", 240), actual: optionalTextValue("actual", 240), unit: requiredText("unit", 60), repetition: optionalNumber("repetition", { min: 0 }), sample: optionalTextValue("sample", 240), trl_criterion: requiredText("trl_criterion", 1000), evidence: optionalTextValue("evidence", 1200), status: "unassessed", measured_on: optionalDate("measured_on"), owner_label: requiredText("owner_label", 120), confidence: requiredEnum("confidence", CONFIDENCES, "unknown") };
  if (resource === "funding_snapshot") return { ...common(), project_id: projectId, snapshot_date: requiredDate("snapshot_date"), required_amount: optionalNumber("required_amount", { min: 0 }), secured_amount: optionalNumber("secured_amount", { min: 0 }), unconfirmed_amount: optionalNumber("unconfirmed_amount", { min: 0 }), use_summary: requiredText("use_summary", 1000), burn_per_month: optionalNumber("burn_per_month", { min: 0 }), runway_months: optionalNumber("runway_months", { min: 0 }), probability: optionalNumber("probability", { min: 0, max: 1 }), cash_condition: requiredText("cash_condition", 1200), source_label: requiredText("source_label", 240), confidence: requiredEnum("confidence", CONFIDENCES, "unknown") };
  if (resource === "organization_role") return { ...common(), project_id: projectId, role_slug: requiredText("role_slug", 120), role_name: requiredText("role_name", 180), required: raw.required == null ? true : booleanValue(raw.required, "required"), candidate: optionalTextValue("candidate", 240), commitment: optionalTextValue("commitment", 500), authority: requiredText("authority", 1000), vacancy: raw.vacancy == null ? true : booleanValue(raw.vacancy, "vacancy"), join_condition: requiredText("join_condition", 1000), due_date: optionalDate("due_date"), status: "unassessed", owner_label: requiredText("owner_label", 120), last_verified_at: today, confidence: requiredEnum("confidence", CONFIDENCES, "unknown") };
  if (resource === "raci") return { ...common(), project_id: projectId, milestone_id: requiredId("milestone_id"), stakeholder_label: requiredText("stakeholder_label", 180), responsibility_role: requiredEnum("responsibility_role", RACI_ROLES), owner_label: requiredText("owner_label", 120), confirmed: raw.confirmed == null ? false : booleanValue(raw.confirmed, "confirmed"), last_verified_at: today, confidence: requiredEnum("confidence", CONFIDENCES, "unknown") };
  if (resource === "capacity") return { ...common(), project_id: projectId, track: requiredEnum("track", TRACKS), milestone_id: optionalId("milestone_id"), role_label: requiredText("role_label", 180), required_people: requiredNumber("required_people", { min: 0 }), confirmed_people: requiredNumber("confirmed_people", { min: 0 }), available_hours_week: optionalNumber("available_hours_week", { min: 0 }), planned_hours_week: optionalNumber("planned_hours_week", { min: 0 }), measurement_date: requiredDate("measurement_date"), source_label: requiredText("source_label", 240), confidence: requiredEnum("confidence", CONFIDENCES, "unknown") };
  if (resource === "task") {
    const plannedStart = optionalDate("planned_start");
    const plannedEnd = optionalDate("planned_end");
    if (!isValidPlannedRange({ plannedStart, plannedEnd })) throw new Error("計画開始は計画完了より後にできないよ");
    return { ...common(), project_id: projectId, milestone_id: requiredId("milestone_id"), parent_task_id: optionalId("parent_task_id"), track: raw.track == null ? null : requiredEnum("track", TRACKS), title: requiredText("title", 180), description: optionalTextValue("description", 1600), status: requiredEnum("status", TASK_STATUSES, "unassessed"), planned_start: plannedStart, planned_end: plannedEnd, forecast_end: optionalDate("forecast_end"), actual_end: optionalDate("actual_end"), progress_pct: optionalNumber("progress_pct", { min: 0, max: 100 }) || 0, date_certainty: requiredEnum("date_certainty", ["confirmed", "provisional"], "provisional"), owner_member_id: optionalId("owner_member_id"), owner_label: requiredText("owner_label", 120), goal: optionalTextValue("goal", 1200), next_deliverable: optionalTextValue("next_deliverable", 500), blocker: optionalTextValue("blocker", 500), completion_criteria: optionalTextValue("completion_criteria", 1200), forecast_change_reason: optionalTextValue("forecast_change_reason", 500), sort_order: optionalNumber("sort_order", { min: 0 }) || 0, last_verified_at: today, confidence: requiredEnum("confidence", CONFIDENCES, "unknown"), created_by: memberId, updated_by: memberId };
  }
  throw new Error("追加できる種類が不正だよ");
}

async function getWorkspaceContext(projectId: string) {
  const access = await getCurrentMemberAccess();
  if (!access) return { response: NextResponse.json({ error: "ログインが必要だよ" }, { status: 401 }) };
  if (!canAccessWorkspaceProject(access, projectId)) return { response: NextResponse.json({ error: "このPJの共有情報には入れないよ" }, { status: 404 }) };
  return { access };
}

async function getManagerContext(projectId: string) {
  const context = await getWorkspaceContext(projectId);
  if ("response" in context) return context;
  if (context.access.scope !== "portfolio" && !context.access.isAdmin) return { response: NextResponse.json({ error: "共有情報の更新権限がないよ" }, { status: 403 }) };
  return context;
}

const PARENT_FIELDS: Partial<Record<Resource, Array<[string, string]>>> = {
  outcome: [["objective_id", "project_management_objectives"]],
  milestone: [["objective_id", "project_management_objectives"], ["outcome_id", "project_management_outcomes"]],
  kpi: [["outcome_id", "project_management_outcomes"]],
  issue: [["milestone_id", "project_management_milestones"], ["outcome_id", "project_management_outcomes"]],
  hypothesis: [["issue_id", "project_management_issues"]],
  evidence: [["issue_id", "project_management_issues"], ["hypothesis_id", "project_management_hypotheses"]],
  validation: [["hypothesis_id", "project_management_hypotheses"]],
  decision: [["issue_id", "project_management_issues"], ["hypothesis_id", "project_management_hypotheses"]],
  action: [["decision_id", "project_management_decisions"]],
  commitment: [["partner_id", "project_management_partners"]],
  interaction: [["partner_id", "project_management_partners"]],
  partner_role: [["partner_id", "project_management_partners"]],
  partner_work_item: [["partner_id", "project_management_partners"], ["related_milestone_id", "project_management_milestones"]],
  partner_sample: [["partner_id", "project_management_partners"]],
  dependency: [["predecessor_milestone_id", "project_management_milestones"], ["successor_milestone_id", "project_management_milestones"]],
  schedule_dependency: [["predecessor_task_id", "project_management_tasks"], ["predecessor_milestone_id", "project_management_milestones"], ["successor_task_id", "project_management_tasks"], ["successor_milestone_id", "project_management_milestones"]],
  raci: [["milestone_id", "project_management_milestones"]],
  capacity: [["milestone_id", "project_management_milestones"]],
  technical_test: [["milestone_id", "project_management_milestones"], ["outcome_id", "project_management_outcomes"]],
  task: [["milestone_id", "project_management_milestones"], ["parent_task_id", "project_management_tasks"]],
};

// A task can be re-parented onto another task via `parent_task_id`; a cycle (task A's
// ancestor chain eventually includes A itself) would make the gantt's tree walk recurse
// forever. Walk the existing parent_task_id chain of the proposed new parent and reject if
// it ever reaches the task being edited.
async function assertNoTaskCycle(db: ReturnType<typeof createAdminClient>, projectId: string, taskId: string, newParentTaskId: string | null) {
  if (!newParentTaskId) return;
  if (newParentTaskId === taskId) throw new Error("自分自身を親タスクにはできないよ");
  let cursor: string | null = newParentTaskId;
  const visited = new Set<string>();
  while (cursor) {
    if (cursor === taskId) throw new Error("親タスクの循環参照になるよ");
    if (visited.has(cursor)) break;
    visited.add(cursor);
    const result: { data: { parent_task_id: string | null } | null; error: { message: string } | null } = await db.from("project_management_tasks").select("parent_task_id").eq("id", cursor).eq("project_id", projectId).maybeSingle();
    if (result.error) throw new Error(`親タスクの確認に失敗したよ: ${result.error.message}`);
    cursor = result.data?.parent_task_id ?? null;
  }
}

async function assertTaskPlacement(db: ReturnType<typeof createAdminClient>, projectId: string, milestoneId: string, parentTaskId: string | null) {
  if (!parentTaskId) return;
  const { data, error } = await db
    .from("project_management_tasks")
    .select("milestone_id")
    .eq("id", parentTaskId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`親タスクの配置確認に失敗したよ: ${error.message}`);
  if (!data || String((data as { milestone_id: string }).milestone_id) !== milestoneId) throw new Error("親タスクは同じタスク群から選んでね");
}

// A milestone's outcome_id must actually belong to its objective_id, and the outcome's track must
// match the milestone's own track — assertParentsInProject only checks that each id individually
// exists in the project, not that they cohere with each other. Checked on create and on merged
// PATCH values (patchFor's milestone branch does not currently expose objective_id/outcome_id/
// track as editable, so the merged-PATCH call site is a defensive no-op today, but stays wired
// for if that ever changes).
async function assertMilestoneParentIntegrity(
  db: ReturnType<typeof createAdminClient>,
  projectId: string,
  objectiveId: string,
  outcomeId: string,
  track: string,
) {
  const { data, error } = await db
    .from("project_management_outcomes")
    .select("objective_id,track")
    .eq("id", outcomeId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`成果の確認に失敗したよ: ${error.message}`);
  if (!data) throw new Error("outcome_idはこのPJの有効な成果につないでね");
  const row = data as { objective_id: string; track: string };
  if (String(row.objective_id) !== objectiveId) throw new Error("接続する成果は選択した設立目標に属していないよ");
  if (String(row.track) !== track) throw new Error("接続する成果の柱とMSの柱が一致していないよ");
}

async function assertParentsInProject(db: ReturnType<typeof createAdminClient>, projectId: string, resource: Resource, payload: Record<string, unknown>) {
  for (const [field, table] of PARENT_FIELDS[resource] || []) {
    const id = payload[field];
    if (id == null || id === "") continue;
    const { data, error } = await db.from(table).select("id").eq("id", String(id)).eq("project_id", projectId).is("deleted_at", null).maybeSingle();
    if (error) throw new Error(`親情報の確認に失敗したよ: ${error.message}`);
    if (!data) throw new Error(`${field}はこのPJの有効な共有情報につないでね`);
  }
}

async function listDeletedRecords(db: ReturnType<typeof createAdminClient>, projectId: string) {
  const records: Array<{ resource: Resource; id: string; label: string; deletedAt: string | null; deletedBy: string | null }> = [];
  for (const resource of Object.keys(RESOURCE_TABLES) as Resource[]) {
    const { data, error } = await db.from(RESOURCE_TABLES[resource]).select(DELETED_SELECTS[resource]).eq("project_id", projectId).not("deleted_at", "is", null).order("deleted_at", { ascending: false });
    if (error) throw new Error(`非表示情報の確認に失敗したよ: ${error.message}`);
    for (const row of (data || []) as unknown as Array<Record<string, unknown>>) {
      records.push({
        resource,
        id: String(row.id),
        label: deletedRecordLabel(resource, row),
        deletedAt: typeof row.deleted_at === "string" ? row.deleted_at : null,
        deletedBy: typeof row.deleted_by === "string" ? row.deleted_by : null,
      });
    }
  }
  return records.sort((a, b) => (b.deletedAt || "").localeCompare(a.deletedAt || ""));
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const includeDeleted = _request.nextUrl.searchParams.get("include_deleted") === "true";
  const context = includeDeleted ? await getManagerContext(projectId) : await getWorkspaceContext(projectId);
  if ("response" in context) return context.response;
  try {
    if (includeDeleted) {
      const deletedRecords = await listDeletedRecords(createAdminClient(), projectId);
      return NextResponse.json({ deletedRecords }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const bundle = await getSxManagementBundle(projectId, context.access.scope === "portfolio" || context.access.isAdmin);
    return NextResponse.json(bundle, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "共有管理データを取得できなかったよ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const context = await getManagerContext(projectId);
  if ("response" in context) return context.response;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) throw new Error("追加内容が不正だよ");
    const resource = parseResource(body.resource);
    const payload = createFor(resource, body.fields ?? body.payload, projectId, context.access.memberId, todayJst());
    const db = createAdminClient();
    await assertParentsInProject(db, projectId, resource, payload);
    if (resource === "milestone") await assertMilestoneParentIntegrity(db, projectId, String(payload.objective_id), String(payload.outcome_id), String(payload.track));
    if (resource === "task") await assertTaskPlacement(db, projectId, String(payload.milestone_id), payload.parent_task_id ? String(payload.parent_task_id) : null);
    const { data, error } = await db.from(RESOURCE_TABLES[resource]).insert(payload).select("id").single();
    if (error) throw new Error(`共有情報の追加に失敗したよ: ${error.message}`);
    const id = String((data as { id: string }).id);
    const meta = RESOURCE_META[resource];
    const status = meta.statusColumn && typeof payload[meta.statusColumn] === "string" ? String(payload[meta.statusColumn]) : null;
    const { error: historyError } = await db.from("project_management_update_history").insert({
      project_id: projectId,
      entity_type: meta.entityType,
      entity_id: id,
      update_kind: "manual_create",
      summary: `${RESOURCE_TABLES[resource].replace("project_management_", "")}を追加`,
      changed_by: context.access.memberId,
      changed_on: todayJst(),
      from_status: null,
      to_status: status,
    });
    if (historyError) {
      // The authenticated API is not allowed to physically delete important
      // management rows.  If the audit write fails after the insert, make the
      // new row immediately invisible and keep the write path recoverable.
      const rollback: Record<string, unknown> = {
        deleted_at: new Date().toISOString(),
        deleted_by: context.access.memberId,
      };
      if (meta.hasSourceRef) {
        rollback.source_kind = "manual";
        rollback.source_ref = "PWA共有管理画面:履歴失敗時の補償";
      }
      const { error: rollbackError } = await db
        .from(RESOURCE_TABLES[resource])
        .update(rollback)
        .eq("id", id)
        .eq("project_id", projectId);
      const rollbackNote = rollbackError ? `（補償非表示にも失敗: ${rollbackError.message}）` : "（追加行は非表示化したよ）";
      throw new Error(`追加履歴の記録に失敗したよ: ${historyError.message}${rollbackNote}`);
    }
    const bundle = await getSxManagementBundle(projectId, true);
    return NextResponse.json({ ok: true, id, bundle }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "共有情報を追加できなかったよ";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const context = await getManagerContext(projectId);
  if ("response" in context) return context.response;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) throw new Error("更新内容が不正だよ");
    const resource = parseResource(body.resource);
    const id = text(body.id, "id", 80);
    const meta = RESOURCE_META[resource];
    const deleting = body.delete === true;
    const restoring = body.restore === true;
    if (deleting && restoring) throw new Error("非表示化と復元は同時に指定できないよ");
    if (deleting && !meta.softDelete) throw new Error("この共有情報は非表示化に対応していないよ");
    if (restoring && !meta.softDelete) throw new Error("この共有情報は復元に対応していないよ");
    const patch: Record<string, unknown> = deleting ? safeDeletePatch(context.access.memberId) : restoring ? { deleted_at: null, deleted_by: null } : patchFor(resource, body.patch);
    if (resource === "milestone" && !deleting && "status" in patch && !("status_source" in patch)) patch.status_source = "manual";
    if (resource === "milestone" && patch.status_source === "override" && (!patch.status_override_reason || !patch.status_override_expires_on || !patch.status_override_approved_by)) throw new Error("状態の上書きには理由・期限・承認者が必要だよ");
    if (meta.hasLastVerified && !deleting && !restoring) patch.last_verified_at = todayJst();
    // source_kind/source_ref: an ordinary edit always stamps manual provenance here (see
    // safeDeletePatch comment above — soft-delete/restore never reach this branch, so they leave
    // source_kind/source_ref exactly as the row already had).
    if (meta.hasSourceRef && !deleting && !restoring) {
      patch.source_kind = "manual";
      patch.source_ref = "PWA共有管理画面";
    }
    if (meta.hasUpdatedBy && !deleting && !restoring) patch.updated_by = context.access.memberId;
    if (resource === "schedule_dependency" && (deleting || restoring))
      patch.updated_by = context.access.memberId;

    const db = createAdminClient();
    const { data: before, error: beforeError } = await db.from(RESOURCE_TABLES[resource]).select("*").eq("id", id).eq("project_id", projectId).maybeSingle();
    if (beforeError) throw new Error(`共有情報の確認に失敗したよ: ${beforeError.message}`);
    if (!before) return NextResponse.json({ error: "更新対象が見つからないよ" }, { status: 404 });
    const beforeRecord = before as unknown as Record<string, unknown>;
    // MSを非表示化すると、そのMS配下のタスクは親を失う（タスクはMSにぶら下がって描画・集計される）。
    // 依存線は bundle 側が live な端点だけを通すので自動で落ちるが、タスクの移し先は人が決めるしかない。
    if (resource === "milestone" && deleting) {
      const { data: attachedTasks, error: attachedError } = await db.from(RESOURCE_TABLES.task).select("id").eq("project_id", projectId).eq("milestone_id", id).is("deleted_at", null).limit(1);
      if (attachedError) throw new Error(`MS配下のタスク確認に失敗したよ: ${attachedError.message}`);
      if (attachedTasks && attachedTasks.length > 0) throw new Error("このMSに紐づくタスクがあるから削除できないよ。先にタスクを別のMSへ移すか削除してね");
    }
    if (resource === "kpi" && !deleting && !restoring) {
      const mergedRule = typeof patch.threshold_rule === "string" ? patch.threshold_rule : String(beforeRecord.threshold_rule || "gte");
      const mergedThreshold = patch.threshold !== undefined ? patch.threshold : beforeRecord.threshold;
      const mergedUpper = patch.threshold_upper !== undefined ? patch.threshold_upper : beforeRecord.threshold_upper;
      if (mergedRule === "between" && (mergedThreshold == null || mergedUpper == null || Number(mergedThreshold) > Number(mergedUpper))) throw new Error("範囲内ルールは下限と上限を入力し、下限を上限以下にしてね");
    }
    if (resource === "decision" && !deleting && !restoring) {
      const mergedState = typeof patch.decision_state === "string" ? patch.decision_state : String(beforeRecord.decision_state || "pending");
      const mergedDecisionText = patch.decision_text !== undefined ? patch.decision_text : beforeRecord.decision_text;
      const mergedDecidedBy = patch.decided_by !== undefined ? patch.decided_by : beforeRecord.decided_by;
      const mergedDecidedOn = patch.decided_on !== undefined ? patch.decided_on : beforeRecord.decided_on;
      if (mergedState === "decided" && (!mergedDecisionText || !mergedDecidedBy || !mergedDecidedOn)) throw new Error("決定済みにするには決定内容・決定者・決定日が必要だよ");
    }
    if (resource === "commitment" && !deleting && !restoring) {
      const mergedKind = typeof patch.commitment_kind === "string" ? patch.commitment_kind : String(beforeRecord.commitment_kind || "sx_followup");
      const mergedCounterparty = patch.counterparty_owner !== undefined ? patch.counterparty_owner : beforeRecord.counterparty_owner;
      const mergedPromisedOn = patch.promised_on !== undefined ? patch.promised_on : beforeRecord.promised_on;
      const mergedEvidence = patch.evidence !== undefined ? patch.evidence : beforeRecord.evidence;
      if (mergedKind === "counterparty_promise" && (!mergedCounterparty || !mergedPromisedOn || !mergedEvidence)) throw new Error("相手の約束には相手担当・約束日・一次根拠が必要だよ");
      const mergedSxOwner = patch.sx_owner !== undefined ? patch.sx_owner : beforeRecord.sx_owner;
      const mergedDueDate = patch.due_date !== undefined ? patch.due_date : beforeRecord.due_date;
      const mergedNextReviewOn = patch.next_review_on !== undefined ? patch.next_review_on : beforeRecord.next_review_on;
      if (mergedKind === "sx_followup" && (!mergedSxOwner || !mergedDueDate || !mergedNextReviewOn)) throw new Error("SX側の次アクションにはSX担当・期限・次回確認が必要だよ");
    }
    if (resource === "partner" && !deleting && !restoring) {
      const mergedDueDate = patch.due_date !== undefined ? patch.due_date : beforeRecord.due_date;
      const mergedDueDatePrecision = typeof patch.due_date_precision === "string" ? patch.due_date_precision : String(beforeRecord.due_date_precision || "unknown");
      assertDatePrecisionConsistency(mergedDueDate, mergedDueDatePrecision, "期限日", "期限精度");
    }
    if (resource === "interaction" && !deleting && !restoring) {
      const mergedOccurredOn = patch.occurred_on !== undefined ? patch.occurred_on : beforeRecord.occurred_on;
      const mergedOccurredOnPrecision = typeof patch.occurred_on_precision === "string" ? patch.occurred_on_precision : String(beforeRecord.occurred_on_precision || "unknown");
      assertDatePrecisionConsistency(mergedOccurredOn, mergedOccurredOnPrecision, "発生日", "発生日の確度");
    }
    if (resource === "partner_work_item" && !deleting && !restoring) {
      const mergedDueDate = patch.due_date !== undefined ? patch.due_date : beforeRecord.due_date;
      const mergedDueDatePrecision = typeof patch.due_date_precision === "string" ? patch.due_date_precision : String(beforeRecord.due_date_precision || "unknown");
      assertDatePrecisionConsistency(mergedDueDate, mergedDueDatePrecision, "期限日", "期限精度");
      const mergedStatus = typeof patch.status === "string" ? patch.status : String(beforeRecord.status || "open");
      const mergedItemKind = typeof patch.item_kind === "string" ? patch.item_kind : String(beforeRecord.item_kind || "task");
      assertWorkItemCompletionRequirements(mergedStatus, mergedItemKind, {
        completionCriteria: patch.completion_criteria !== undefined ? patch.completion_criteria : beforeRecord.completion_criteria,
        completedOn: patch.completed_on !== undefined ? patch.completed_on : beforeRecord.completed_on,
        completionEvidence: patch.completion_evidence !== undefined ? patch.completion_evidence : beforeRecord.completion_evidence,
        acceptedBy: patch.accepted_by !== undefined ? patch.accepted_by : beforeRecord.accepted_by,
        acceptedOn: patch.accepted_on !== undefined ? patch.accepted_on : beforeRecord.accepted_on,
      });
    }
    if (resource === "milestone" && !deleting && !restoring) {
      const mergedObjectiveId = String(patch.objective_id !== undefined ? patch.objective_id : beforeRecord.objective_id);
      const mergedOutcomeId = String(patch.outcome_id !== undefined ? patch.outcome_id : beforeRecord.outcome_id);
      const mergedTrack = String(patch.track !== undefined ? patch.track : beforeRecord.track);
      await assertMilestoneParentIntegrity(db, projectId, mergedObjectiveId, mergedOutcomeId, mergedTrack);
      // Generic point-MS invariant (the 2 NewCo founding-prerequisite gates are exempt): PATCHing
      // only one of planned_start/planned_end moves both together; supplying both with different
      // values is a rejection, not a pick-one.
      const mergedTimelineKind = String(patch.timeline_kind !== undefined ? patch.timeline_kind : beforeRecord.timeline_kind || "phase");
      if (
        mergedTimelineKind === "milestone" &&
        !isBlockingMilestoneSlug(projectId, String(beforeRecord.slug)) &&
        ("planned_start" in patch || "planned_end" in patch)
      ) {
        const normalized = normalizePointMilestonePatch(
          patch.planned_start as string | null | undefined,
          patch.planned_end as string | null | undefined,
        );
        if (!normalized) throw new Error("このMSは単一の予定日として扱うため、開始日と完了日は同じにしてね");
        patch.planned_start = normalized.plannedStart;
        patch.planned_end = normalized.plannedEnd;
      }
    }
    let expectedVersion: number | null = null;
    if ((resource === "milestone" || resource === "task") && !deleting && !restoring) {
      const mergedStart = (patch.planned_start !== undefined ? patch.planned_start : beforeRecord.planned_start) as string | null;
      const mergedEnd = (patch.planned_end !== undefined ? patch.planned_end : beforeRecord.planned_end) as string | null;
      if (!isValidPlannedRange({ plannedStart: mergedStart, plannedEnd: mergedEnd })) throw new Error("計画開始は計画完了より後にできないよ");
      expectedVersion = requiredExpectedVersion(body.expected_version);
      if (Number(beforeRecord.version) !== expectedVersion) {
        return NextResponse.json(
          { error: "他の人がこの内容を先に更新したよ。最新の内容を読み込み直すね", code: "version_conflict", currentVersion: Number(beforeRecord.version) },
          { status: 409 },
        );
      }
    }
    if (!deleting && !restoring) {
      await assertParentsInProject(db, projectId, resource, patch);
    }
    if (resource === "task" && !deleting && !restoring) {
      const mergedMilestoneId = patch.milestone_id !== undefined ? String(patch.milestone_id) : String(beforeRecord.milestone_id);
      const mergedParentTaskId = patch.parent_task_id !== undefined ? patch.parent_task_id ? String(patch.parent_task_id) : null : beforeRecord.parent_task_id ? String(beforeRecord.parent_task_id) : null;
      await assertTaskPlacement(db, projectId, mergedMilestoneId, mergedParentTaskId);
      await assertNoTaskCycle(db, projectId, id, mergedParentTaskId);
    }
    // When expectedVersion is set, the update itself is the atomic compare-and-swap (not just the
    // `before` check above, which only rules out the common case cheaply) — the .eq("version", ...)
    // filter guarantees a write racing in between the `before` select and this statement still
    // yields 0 affected rows rather than silently landing on top of it.
    const hasVersionColumn = resource === "milestone" || resource === "task";
    let updateQuery = db.from(RESOURCE_TABLES[resource]).update(patch).eq("id", id).eq("project_id", projectId);
    if (expectedVersion != null) updateQuery = updateQuery.eq("version", expectedVersion);
    const { data, error } = await updateQuery.select(hasVersionColumn ? "id,version" : "id").maybeSingle();
    if (error) throw new Error(`共有情報の更新に失敗したよ: ${error.message}`);
    if (!data) {
      if (expectedVersion != null) {
        const { data: current } = await db.from(RESOURCE_TABLES[resource]).select("version").eq("id", id).eq("project_id", projectId).maybeSingle();
        return NextResponse.json(
          {
            error: "他の人がこの内容を先に更新したよ。最新の内容を読み込み直すね",
            code: "version_conflict",
            currentVersion: current ? Number((current as { version: unknown }).version) : null,
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: "更新対象が見つからないよ" }, { status: 404 });
    }
    const updatedVersion = hasVersionColumn ? Number((data as unknown as { id: string; version: unknown }).version) : null;
    const beforeStatus = meta.statusColumn && typeof beforeRecord[meta.statusColumn] === "string" ? String(beforeRecord[meta.statusColumn]) : null;
    const nextStatus = meta.statusColumn && typeof patch[meta.statusColumn] === "string" ? String(patch[meta.statusColumn]) : beforeStatus;
    const updateKind = deleting ? "soft_delete" : restoring ? "restore" : "manual_edit";
    const summary = deleting ? "共有情報を非表示化" : restoring ? "共有情報を復元" : "共有情報を更新";
    const { error: historyError } = await db.from("project_management_update_history").insert({ project_id: projectId, entity_type: meta.entityType, entity_id: id, update_kind: updateKind, summary, changed_by: context.access.memberId, changed_on: todayJst(), from_status: beforeStatus, to_status: nextStatus });
    if (historyError) {
      // The rollback must not clobber a later edit that landed after our own update but before
      // this compensation runs. For milestone/task (which carry `version`), CAS the rollback on
      // updatedVersion — the version our own update just produced — and select back what changed.
      // If that CAS misses, someone else's write is already on top of ours: leave it alone and
      // report that compensation could not safely run, instead of silently overwriting it.
      const rollbackPatch = Object.fromEntries(Object.keys(patch).filter((key) => Object.prototype.hasOwnProperty.call(beforeRecord, key)).map((key) => [key, beforeRecord[key]]));
      let rollbackQuery = db.from(RESOURCE_TABLES[resource]).update(rollbackPatch).eq("id", id).eq("project_id", projectId);
      if (hasVersionColumn && updatedVersion != null) rollbackQuery = rollbackQuery.eq("version", updatedVersion);
      const { data: rollbackData, error: rollbackError } = await rollbackQuery.select("id");
      const rollbackNote = rollbackError
        ? `（更新の補償復元にも失敗: ${rollbackError.message}）`
        : hasVersionColumn && (!rollbackData || rollbackData.length === 0)
          ? "（この内容は既に別の変更で上書きされていたため、補償復元は安全に実行できなかったよ。最新の状態を確認してね）"
          : "（更新内容は補償復元したよ）";
      throw new Error(`更新履歴の記録に失敗したよ: ${historyError.message}${rollbackNote}`);
    }
    const bundle = await getSxManagementBundle(projectId, true);
    return NextResponse.json({ ok: true, bundle });
  } catch (error) {
    const message = error instanceof Error ? error.message : "共有情報の更新に失敗したよ";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
