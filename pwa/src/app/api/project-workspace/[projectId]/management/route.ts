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
  | "decision"
  | "action"
  | "partner"
  | "commitment"
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
  decision: "project_management_decisions",
  action: "project_management_action_items",
  partner: "project_management_partners",
  commitment: "project_management_partner_commitments",
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
  decision: { entityType: "decision", statusColumn: "decision_state", hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  action: { entityType: "action_item", statusColumn: "status", hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  partner: { entityType: "partner", statusColumn: null, hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  commitment: { entityType: "partner_commitment", statusColumn: "status", hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  technical_test: { entityType: "technical_test", statusColumn: "status", hasLastVerified: false, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  funding_snapshot: { entityType: "funding_snapshot", statusColumn: null, hasLastVerified: false, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  organization_role: { entityType: "organization_role", statusColumn: "status", hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  raci: { entityType: "raci", statusColumn: null, hasLastVerified: true, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
  capacity: { entityType: "capacity", statusColumn: null, hasLastVerified: false, hasSourceRef: true, hasUpdatedBy: false, softDelete: true },
};

const MILESTONE_STATUSES = ["unassessed", "on_track", "attention", "at_risk", "blocked", "completed"];
const ISSUE_KINDS = ["fact", "hypothesis", "decision"];
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
    takeText("name", "name", 180); takeText("role_label", "role_label", 240); takeEnum("primary_track", TRACKS); takeEnum("relationship_stage", PARTNER_STAGES); takeEnum("agreement_state", AGREEMENT_STATES); takeText("agreed_scope", "agreed_scope", 1000); takeText("unagreed_scope", "unagreed_scope", 1000); takeDate("last_contact_date"); takeText("next_commitment", "next_commitment", 1000); takeDate("due_date"); takeText("owner_label", "owner_label", 120); takeEnum("confidence", CONFIDENCES);
  }
  if (resource === "commitment") {
    takeText("title", "title", 180); takeText("commitment_text", "commitment_text", 1000); takeEnum("status", COMMITMENT_STATUSES); takeDate("promised_on"); takeDate("due_date"); takeDate("completed_on"); takeText("owner_label", "owner_label", 120); takeOptionalText("counterparty_owner", "counterparty_owner", 120); takeOptionalText("sx_owner", "sx_owner", 120); takeOptionalText("evidence", "evidence", 1200); takeDate("next_review_on"); takeEnum("confidence", CONFIDENCES);
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

function safeDeletePatch(memberId: string) {
  return { deleted_at: new Date().toISOString(), deleted_by: memberId, source_kind: "manual", source_ref: "PWA共有管理画面" };
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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const context = await getWorkspaceContext(projectId);
  if ("response" in context) return context.response;
  try {
    const bundle = await getSxManagementBundle(projectId, context.access.scope === "portfolio" || context.access.isAdmin);
    return NextResponse.json(bundle, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "共有管理データを取得できなかったよ" }, { status: 500 });
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
    if (deleting && !meta.softDelete) throw new Error("この共有情報は非表示化に対応していないよ");
    const patch: Record<string, unknown> = deleting ? safeDeletePatch(context.access.memberId) : patchFor(resource, body.patch);
    if (resource === "milestone" && !deleting && "status" in patch && !("status_source" in patch)) patch.status_source = "manual";
    if (resource === "milestone" && patch.status_source === "override" && (!patch.status_override_reason || !patch.status_override_expires_on || !patch.status_override_approved_by)) throw new Error("状態の上書きには理由・期限・承認者が必要だよ");
    if (meta.hasLastVerified && !deleting) patch.last_verified_at = todayJst();
    if (!deleting) patch.source_kind = "manual";
    if (meta.hasSourceRef) patch.source_ref = "PWA共有管理画面";
    if (meta.hasUpdatedBy) patch.updated_by = context.access.memberId;

    const db = createAdminClient();
    const beforeSelect = resource === "kpi" ? "id,threshold,threshold_rule,threshold_upper" : meta.statusColumn || "id";
    const { data: before, error: beforeError } = await db.from(RESOURCE_TABLES[resource]).select(beforeSelect as string).eq("id", id).eq("project_id", projectId).maybeSingle();
    if (beforeError) throw new Error(`共有情報の確認に失敗したよ: ${beforeError.message}`);
    if (!before) return NextResponse.json({ error: "更新対象が見つからないよ" }, { status: 404 });
    if (resource === "kpi" && !deleting) {
      const beforeKpi = before as unknown as Record<string, unknown>;
      const mergedRule = typeof patch.threshold_rule === "string" ? patch.threshold_rule : String(beforeKpi.threshold_rule || "gte");
      const mergedThreshold = patch.threshold !== undefined ? patch.threshold : beforeKpi.threshold;
      const mergedUpper = patch.threshold_upper !== undefined ? patch.threshold_upper : beforeKpi.threshold_upper;
      if (mergedRule === "between" && (mergedThreshold == null || mergedUpper == null || Number(mergedThreshold) > Number(mergedUpper))) throw new Error("範囲内ルールは下限と上限を入力し、下限を上限以下にしてね");
    }
    const { data, error } = await db.from(RESOURCE_TABLES[resource]).update(patch).eq("id", id).eq("project_id", projectId).select("id").maybeSingle();
    if (error) throw new Error(`共有情報の更新に失敗したよ: ${error.message}`);
    if (!data) return NextResponse.json({ error: "更新対象が見つからないよ" }, { status: 404 });
    const beforeRecord = before as unknown as Record<string, unknown>;
    const beforeStatus = meta.statusColumn && typeof beforeRecord[meta.statusColumn] === "string" ? String(beforeRecord[meta.statusColumn]) : null;
    const nextStatus = meta.statusColumn && typeof patch[meta.statusColumn] === "string" ? String(patch[meta.statusColumn]) : beforeStatus;
    const { error: historyError } = await db.from("project_management_update_history").insert({ project_id: projectId, entity_type: meta.entityType, entity_id: id, update_kind: deleting ? "soft_delete" : "manual_edit", summary: deleting ? "共有情報を非表示化" : "共有情報を更新", changed_by: context.access.memberId, changed_on: todayJst(), from_status: beforeStatus, to_status: nextStatus });
    if (historyError) throw new Error(`更新履歴の記録に失敗したよ: ${historyError.message}`);
    const bundle = await getSxManagementBundle(projectId, true);
    return NextResponse.json({ ok: true, bundle });
  } catch (error) {
    const message = error instanceof Error ? error.message : "共有情報の更新に失敗したよ";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
