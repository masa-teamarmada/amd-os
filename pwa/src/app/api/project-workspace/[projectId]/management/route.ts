import { NextRequest, NextResponse } from "next/server";
import { canAccessWorkspaceProject, getCurrentMemberAccess } from "@/lib/project-workspace";
import { getSxManagementBundle } from "@/lib/sx-management";
import { createAdminClient } from "@/lib/supabase/admin";

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
  | "dependency"
  | "technical_test"
  | "funding_snapshot"
  | "organization_role"
  | "raci"
  | "capacity";

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
  dependency: "project_management_milestone_dependencies",
  technical_test: "project_management_technical_tests",
  funding_snapshot: "project_management_funding_snapshots",
  organization_role: "project_management_organization_roles",
  raci: "project_management_raci",
  capacity: "project_management_capacity",
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
  dependency: { entityType: "dependency", statusColumn: null, hasLastVerified: false, hasSourceRef: false, hasUpdatedBy: false, softDelete: true },
  technical_test: { entityType: "technical_test", statusColumn: "status", hasLastVerified: false, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  funding_snapshot: { entityType: "funding_snapshot", statusColumn: null, hasLastVerified: false, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  organization_role: { entityType: "organization_role", statusColumn: "status", hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  raci: { entityType: "raci", statusColumn: null, hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  capacity: { entityType: "capacity", statusColumn: null, hasLastVerified: false, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
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
  dependency: "id,note,deleted_at,deleted_by",
  technical_test: "id,test_slug,test_name,deleted_at,deleted_by",
  funding_snapshot: "id,snapshot_date,deleted_at,deleted_by",
  organization_role: "id,role_slug,role_name,deleted_at,deleted_by",
  raci: "id,stakeholder_label,deleted_at,deleted_by",
  capacity: "id,role_label,deleted_at,deleted_by",
};

function deletedRecordLabel(resource: Resource, row: Record<string, unknown>) {
  const value = resource === "partner" ? row.name
    : resource === "hypothesis" ? row.statement
      : resource === "evidence" ? row.summary
        : resource === "validation" ? row.validation_kind
          : resource === "interaction" ? row.summary
          : resource === "partner_role" ? row.role_label || row.role_kind
            : resource === "partner_work_item" ? row.title
          : resource === "technical_test" ? row.test_name || row.test_slug
            : resource === "organization_role" ? row.role_name || row.role_slug
              : resource === "capacity" ? row.role_label
                : resource === "funding_snapshot" ? row.snapshot_date
                  : resource === "dependency" ? "ゲート間の依存"
                    : row.title || row.slug;
  return typeof value === "string" && value.trim() ? value : "名称未確認";
}

const MILESTONE_STATUSES = ["unassessed", "on_track", "attention", "at_risk", "blocked", "completed"];
const ISSUE_KINDS = ["fact", "hypothesis", "decision_needed"];
const ISSUE_STATUSES = ["open", "validating", "closed", "on_hold"];
const PARTNER_STAGES = ["candidate", "information_exchange", "condition_alignment", "meeting_coordination", "validation_preparation", "agreement_confirmation", "executing", "on_hold"];
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

function dateValue(value: unknown, field: string) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field}はYYYY-MM-DDで入力してね`);
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
    takeText("name", "name", 180); takeText("role_label", "role_label", 240); takeEnum("primary_track", TRACKS); takeEnum("relationship_stage", PARTNER_STAGES); takeEnum("agreement_state", AGREEMENT_STATES); takeText("agreed_scope", "agreed_scope", 1000); takeText("unagreed_scope", "unagreed_scope", 1000); takeDate("last_contact_date"); takeText("next_commitment", "next_commitment", 1000); takeDate("due_date"); takeText("owner_label", "owner_label", 120); takeEnum("current_ball_side", BALL_SIDES); takeOptionalText("current_ball_owner", "current_ball_owner", 120); takeOptionalText("next_ball_owner", "next_ball_owner", 120); takeOptionalText("target_state", "target_state", 500); takeEnum("due_date_precision", DATE_PRECISIONS); takeEnum("confidence", CONFIDENCES);
  }
  if (resource === "interaction") {
    takeEnum("interaction_kind", INTERACTION_KINDS); takeDate("occurred_on"); takeEnum("occurred_on_precision", DATE_PRECISIONS); takeText("summary", "summary", 1000); takeOptionalText("outcome_summary", "outcome_summary", 1200); takeEnum("ball_side_after", BALL_SIDES); takeOptionalText("ball_owner_after", "ball_owner_after", 120); takeEnum("actor_side", ACTOR_SIDES); takeOptionalText("actor_label", "actor_label", 120); takeEnum("confidence", CONFIDENCES);
  }
  if (resource === "partner_role") {
    takeEnum("role_kind", ROLE_KINDS); takeEnum("relationship_state", RELATIONSHIP_STATES); takeOptionalText("role_label", "role_label", 240); takeBoolean("is_primary"); takeNumber("sort_order", { min: 0 });
  }
  if (resource === "partner_work_item") {
    takeEnum("side", ACTOR_SIDES); takeEnum("item_kind", WORK_ITEM_KINDS); takeText("title", "title", 240); takeOptionalText("detail", "detail", 1200); takeOptionalText("owner_label", "owner_label", 120); takeEnum("status", WORK_ITEM_STATUSES); takeDate("due_date"); takeEnum("due_date_precision", DATE_PRECISIONS); takeOptionalText("completion_criteria", "completion_criteria", 1200); takeDate("completed_on"); takeOptionalText("completion_evidence", "completion_evidence", 1200); takeOptionalText("accepted_by", "accepted_by", 120); takeDate("accepted_on"); takeOptionalText("handoff_to", "handoff_to", 240); takeEnum("confidence", CONFIDENCES); takeNumber("sort_order", { min: 0 });
    if ("related_milestone_id" in raw) patch.related_milestone_id = raw.related_milestone_id == null || raw.related_milestone_id === "" ? null : text(raw.related_milestone_id, "related_milestone_id", 80);
  }
  if (resource === "commitment") {
    takeText("title", "title", 180); takeText("commitment_text", "commitment_text", 1000); takeEnum("commitment_kind", ["counterparty_promise", "sx_followup"]); takeEnum("status", COMMITMENT_STATUSES); takeDate("promised_on"); takeDate("due_date"); takeDate("completed_on"); takeText("owner_label", "owner_label", 120); takeOptionalText("counterparty_owner", "counterparty_owner", 120); takeOptionalText("sx_owner", "sx_owner", 120); takeOptionalText("evidence", "evidence", 1200); takeDate("next_review_on"); takeEnum("confidence", CONFIDENCES);
    if (patch.commitment_kind === "counterparty_promise" && (!patch.counterparty_owner || !patch.promised_on || !patch.evidence)) throw new Error("相手の約束には相手担当・約束日・一次根拠が必要だよ");
  }
  if (resource === "dependency") {
    takeEnum("dependency_type", ["finish_to_start", "start_to_start", "finish_to_finish"]); takeBoolean("required"); takeNumber("lag_days", { min: 0 }); takeOptionalText("note", "note", 1000);
  }
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
  if (resource === "milestone") return { ...common(), project_id: projectId, objective_id: requiredId("objective_id"), outcome_id: requiredId("outcome_id"), slug: requiredText("slug", 120), track: requiredEnum("track", TRACKS), title: requiredText("title", 180), gate: requiredText("gate", 240), status: "unassessed", planned_start: optionalDate("planned_start"), planned_end: optionalDate("planned_end"), forecast_end: optionalDate("forecast_end"), actual_end: null, progress_pct: 0, date_certainty: requiredEnum("date_certainty", ["confirmed", "provisional"], "provisional"), owner_label: requiredText("owner_label", 120), next_deliverable: requiredText("next_deliverable", 500), max_issue: requiredText("max_issue", 500), completion_criteria: requiredText("completion_criteria", 1200), completion_evidence: null, criticality: requiredEnum("criticality", ["critical", "high", "medium", "low"], "high"), baseline_plan_version: optionalTextValue("baseline_plan_version", 120) || "184-manual", forecast_change_reason: null, status_source: "derived", status_reason: "新規追加直後は未評価", last_verified_at: today, confidence: requiredEnum("confidence", CONFIDENCES, "unknown"), created_by: memberId, updated_by: memberId };
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
    assertDatePrecisionConsistency(dueDate, dueDatePrecision, "期限日", "期限精度");
    return { ...common(), project_id: projectId, slug: requiredText("slug", 120), name: requiredText("name", 180), role_label: requiredText("role_label", 240), primary_track: requiredEnum("primary_track", TRACKS), relationship_stage: requiredEnum("relationship_stage", PARTNER_STAGES, "candidate"), agreement_state: requiredEnum("agreement_state", AGREEMENT_STATES, "unagreed"), agreed_scope: requiredText("agreed_scope", 1000), unagreed_scope: requiredText("unagreed_scope", 1000), last_contact_date: optionalDate("last_contact_date"), next_commitment: requiredText("next_commitment", 1000), due_date: dueDate, owner_label: requiredText("owner_label", 120), current_ball_side: requiredEnum("current_ball_side", BALL_SIDES, "unknown"), current_ball_owner: optionalTextValue("current_ball_owner", 120), next_ball_owner: optionalTextValue("next_ball_owner", 120), target_state: optionalTextValue("target_state", 500), due_date_precision: dueDatePrecision, last_verified_at: today, confidence: requiredEnum("confidence", CONFIDENCES, "unknown") };
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
  if (resource === "technical_test") return { ...common(), project_id: projectId, milestone_id: optionalId("milestone_id"), outcome_id: optionalId("outcome_id"), test_slug: requiredText("test_slug", 120), test_name: requiredText("test_name", 180), test_condition: requiredText("test_condition", 1000), target: optionalTextValue("target", 240), actual: optionalTextValue("actual", 240), unit: requiredText("unit", 60), repetition: optionalNumber("repetition", { min: 0 }), sample: optionalTextValue("sample", 240), trl_criterion: requiredText("trl_criterion", 1000), evidence: optionalTextValue("evidence", 1200), status: "unassessed", measured_on: optionalDate("measured_on"), owner_label: requiredText("owner_label", 120), confidence: requiredEnum("confidence", CONFIDENCES, "unknown") };
  if (resource === "funding_snapshot") return { ...common(), project_id: projectId, snapshot_date: requiredDate("snapshot_date"), required_amount: optionalNumber("required_amount", { min: 0 }), secured_amount: optionalNumber("secured_amount", { min: 0 }), unconfirmed_amount: optionalNumber("unconfirmed_amount", { min: 0 }), use_summary: requiredText("use_summary", 1000), burn_per_month: optionalNumber("burn_per_month", { min: 0 }), runway_months: optionalNumber("runway_months", { min: 0 }), probability: optionalNumber("probability", { min: 0, max: 1 }), cash_condition: requiredText("cash_condition", 1200), source_label: requiredText("source_label", 240), confidence: requiredEnum("confidence", CONFIDENCES, "unknown") };
  if (resource === "organization_role") return { ...common(), project_id: projectId, role_slug: requiredText("role_slug", 120), role_name: requiredText("role_name", 180), required: raw.required == null ? true : booleanValue(raw.required, "required"), candidate: optionalTextValue("candidate", 240), commitment: optionalTextValue("commitment", 500), authority: requiredText("authority", 1000), vacancy: raw.vacancy == null ? true : booleanValue(raw.vacancy, "vacancy"), join_condition: requiredText("join_condition", 1000), due_date: optionalDate("due_date"), status: "unassessed", owner_label: requiredText("owner_label", 120), last_verified_at: today, confidence: requiredEnum("confidence", CONFIDENCES, "unknown") };
  if (resource === "raci") return { ...common(), project_id: projectId, milestone_id: requiredId("milestone_id"), stakeholder_label: requiredText("stakeholder_label", 180), responsibility_role: requiredEnum("responsibility_role", RACI_ROLES), owner_label: requiredText("owner_label", 120), confirmed: raw.confirmed == null ? false : booleanValue(raw.confirmed, "confirmed"), last_verified_at: today, confidence: requiredEnum("confidence", CONFIDENCES, "unknown") };
  if (resource === "capacity") return { ...common(), project_id: projectId, track: requiredEnum("track", TRACKS), milestone_id: optionalId("milestone_id"), role_label: requiredText("role_label", 180), required_people: requiredNumber("required_people", { min: 0 }), confirmed_people: requiredNumber("confirmed_people", { min: 0 }), available_hours_week: optionalNumber("available_hours_week", { min: 0 }), planned_hours_week: optionalNumber("planned_hours_week", { min: 0 }), measurement_date: requiredDate("measurement_date"), source_label: requiredText("source_label", 240), confidence: requiredEnum("confidence", CONFIDENCES, "unknown") };
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
  dependency: [["predecessor_milestone_id", "project_management_milestones"], ["successor_milestone_id", "project_management_milestones"]],
  raci: [["milestone_id", "project_management_milestones"]],
  capacity: [["milestone_id", "project_management_milestones"]],
  technical_test: [["milestone_id", "project_management_milestones"], ["outcome_id", "project_management_outcomes"]],
};

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

    const db = createAdminClient();
    const { data: before, error: beforeError } = await db.from(RESOURCE_TABLES[resource]).select("*").eq("id", id).eq("project_id", projectId).maybeSingle();
    if (beforeError) throw new Error(`共有情報の確認に失敗したよ: ${beforeError.message}`);
    if (!before) return NextResponse.json({ error: "更新対象が見つからないよ" }, { status: 404 });
    const beforeRecord = before as unknown as Record<string, unknown>;
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
    const { data, error } = await db.from(RESOURCE_TABLES[resource]).update(patch).eq("id", id).eq("project_id", projectId).select("id").maybeSingle();
    if (error) throw new Error(`共有情報の更新に失敗したよ: ${error.message}`);
    if (!data) return NextResponse.json({ error: "更新対象が見つからないよ" }, { status: 404 });
    const beforeStatus = meta.statusColumn && typeof beforeRecord[meta.statusColumn] === "string" ? String(beforeRecord[meta.statusColumn]) : null;
    const nextStatus = meta.statusColumn && typeof patch[meta.statusColumn] === "string" ? String(patch[meta.statusColumn]) : beforeStatus;
    const updateKind = deleting ? "soft_delete" : restoring ? "restore" : "manual_edit";
    const summary = deleting ? "共有情報を非表示化" : restoring ? "共有情報を復元" : "共有情報を更新";
    const { error: historyError } = await db.from("project_management_update_history").insert({ project_id: projectId, entity_type: meta.entityType, entity_id: id, update_kind: updateKind, summary, changed_by: context.access.memberId, changed_on: todayJst(), from_status: beforeStatus, to_status: nextStatus });
    if (historyError) {
      const rollbackPatch = Object.fromEntries(Object.keys(patch).filter((key) => Object.prototype.hasOwnProperty.call(beforeRecord, key)).map((key) => [key, beforeRecord[key]]));
      const { error: rollbackError } = await db.from(RESOURCE_TABLES[resource]).update(rollbackPatch).eq("id", id).eq("project_id", projectId);
      const rollbackNote = rollbackError ? `（更新の補償復元にも失敗: ${rollbackError.message}）` : "（更新内容は補償復元したよ）";
      throw new Error(`更新履歴の記録に失敗したよ: ${historyError.message}${rollbackNote}`);
    }
    const bundle = await getSxManagementBundle(projectId, true);
    return NextResponse.json({ ok: true, bundle });
  } catch (error) {
    const message = error instanceof Error ? error.message : "共有情報の更新に失敗したよ";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
