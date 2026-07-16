import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";
import { checkPublishEligibility, type CapitalPlan, type Holder, type CapitalEvent } from "@/lib/capital-plan";

export const runtime = "nodejs";

// 資本政策シミュレーションは会社概要タブと同じ方針で、全 AMD メンバーが
// 全 PJ の working scenario を閲覧・編集できる。service role はサーバー内でのみ使い、
// API 冒頭の requireMember を必須にする。

const MAX_DOCUMENT_JSON_BYTES = 500_000;
const MAX_NAME_LENGTH = 200;

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

function conflict(error: string, plan?: unknown) {
  return NextResponse.json({ ok: false, error, plan }, { status: 409 });
}

function validatePositiveInteger(value: unknown, field: string): { ok: true; value: number } | { ok: false; error: string } {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return { ok: false, error: `${field} must be a positive integer` };
  }
  return { ok: true, value };
}

function emailOf(auth: { user: { email: string } }) {
  return auth.user.email.toLowerCase();
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** document_json の最低限の shape チェック。中身の詳細は capital-plan.ts の validate に任せる。 */
function validateDocumentShape(doc: unknown): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (!isPlainObject(doc)) return { ok: false, error: "document_json must be an object" };
  if (doc.holders !== undefined && !Array.isArray(doc.holders)) return { ok: false, error: "document_json.holders must be an array" };
  if (doc.events !== undefined && !Array.isArray(doc.events)) return { ok: false, error: "document_json.events must be an array" };

  const size = Buffer.byteLength(JSON.stringify(doc), "utf8");
  if (size > MAX_DOCUMENT_JSON_BYTES) {
    return { ok: false, error: `document_json exceeds max size (${size} > ${MAX_DOCUMENT_JSON_BYTES} bytes)` };
  }
  return { ok: true, value: doc };
}

function validateName(name: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof name !== "string" || !name.trim()) return { ok: false, error: "name must be a non-empty string" };
  const trimmed = name.trim();
  if (trimmed.length > MAX_NAME_LENGTH) return { ok: false, error: `name exceeds max length (${MAX_NAME_LENGTH})` };
  return { ok: true, value: trimmed };
}

function validateProjectId(projectId: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof projectId !== "string" || !projectId.trim()) return { ok: false, error: "projectId must be a non-empty string" };
  return { ok: true, value: projectId.trim() };
}

function toCapitalPlan(row: { id: string; name: string; document_json: unknown }): CapitalPlan {
  const doc = isPlainObject(row.document_json) ? row.document_json : {};
  const holders = Array.isArray(doc.holders) ? (doc.holders as Holder[]) : [];
  const events = Array.isArray(doc.events) ? (doc.events as CapitalEvent[]) : [];
  return { id: row.id, name: row.name, holders, events };
}

/** GET /api/governance/capital-plans?projectId=p09[&planId=...] */
export async function GET(req: NextRequest) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return badRequest("projectId required");
  const planId = req.nextUrl.searchParams.get("planId");

  const db = createAdminClient();

  let plansQuery = db
    .from("project_capital_plans")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (planId) plansQuery = plansQuery.eq("id", planId);

  let versionsQuery = db
    .from("project_capital_plan_versions")
    .select("*")
    .eq("project_id", projectId)
    .order("version", { ascending: false });
  if (planId) versionsQuery = versionsQuery.eq("plan_id", planId);

  const [plansRes, versionsRes] = await Promise.all([plansQuery, versionsQuery]);
  const error = [plansRes, versionsRes].map((r) => r.error).find(Boolean);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (planId && (plansRes.data ?? []).length === 0) {
    return NextResponse.json({ ok: false, error: "plan not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    plans: plansRes.data ?? [],
    versions: versionsRes.data ?? [],
  });
}

type PostBody = {
  action?: "create" | "duplicate" | "freeze" | "restore_version";
  projectId?: string;
  name?: string;
  planId?: string;
  sourcePlanId?: string;
  expectedRevision?: number;
  version?: number;
  document_json?: unknown;
};

/** POST /api/governance/capital-plans body: { action, ... } */
export async function POST(req: NextRequest) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;
  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body?.action) return badRequest("action required");
  const email = emailOf(auth);
  const db = createAdminClient();

  if (body.action === "create") {
    const projectIdCheck = validateProjectId(body.projectId);
    if (!projectIdCheck.ok) return badRequest(projectIdCheck.error);
    const nameCheck = validateName(body.name);
    if (!nameCheck.ok) return badRequest(nameCheck.error);

    let documentJson: Record<string, unknown> = { holders: [], events: [] };
    if (body.document_json !== undefined) {
      const docCheck = validateDocumentShape(body.document_json);
      if (!docCheck.ok) return badRequest(docCheck.error);
      documentJson = docCheck.value;
    }

    const row = {
      project_id: projectIdCheck.value,
      name: nameCheck.value,
      status: "active",
      revision: 1,
      document_json: documentJson,
      created_by_email: email,
      updated_by_email: email,
    };
    const { data, error } = await db.from("project_capital_plans").insert(row).select().single();
    if (error) return badRequest(error.message);
    return NextResponse.json({ ok: true, plan: data });
  }

  if (body.action === "duplicate") {
    if (!body.sourcePlanId) return badRequest("sourcePlanId required");
    const { data: source, error: sourceError } = await db
      .from("project_capital_plans")
      .select("*")
      .eq("id", body.sourcePlanId)
      .maybeSingle();
    if (sourceError) return badRequest(sourceError.message);
    if (!source) return NextResponse.json({ ok: false, error: "source plan not found" }, { status: 404 });

    const nameCheck = validateName(body.name ?? `${source.name} コピー`);
    if (!nameCheck.ok) return badRequest(nameCheck.error);

    const row = {
      project_id: source.project_id,
      name: nameCheck.value,
      status: "active",
      revision: 1,
      document_json: source.document_json ?? { holders: [], events: [] },
      created_by_email: email,
      updated_by_email: email,
    };
    const { data, error } = await db.from("project_capital_plans").insert(row).select().single();
    if (error) return badRequest(error.message);
    return NextResponse.json({ ok: true, plan: data });
  }

  if (body.action === "freeze") {
    if (!body.planId) return badRequest("planId required");
    const revisionCheck = validatePositiveInteger(body.expectedRevision, "expectedRevision");
    if (!revisionCheck.ok) return badRequest(revisionCheck.error);
    const expectedRevision = revisionCheck.value;

    const { data: plan, error: planError } = await db
      .from("project_capital_plans")
      .select("*")
      .eq("id", body.planId)
      .maybeSingle();
    if (planError) return badRequest(planError.message);
    if (!plan) return NextResponse.json({ ok: false, error: "plan not found" }, { status: 404 });
    if (plan.revision !== expectedRevision) {
      return conflict(`revision conflict: expected ${expectedRevision}, current ${plan.revision}`, plan);
    }

    const docCheck = validateDocumentShape(plan.document_json);
    if (!docCheck.ok) return badRequest(`stored document_json is malformed: ${docCheck.error}`);

    const capitalPlan = toCapitalPlan(plan);
    const eligibility = checkPublishEligibility(capitalPlan);
    if (!eligibility.eligible) {
      return badRequest(`plan is not eligible to freeze: ${eligibility.blockingIssues.map((i) => i.message).join("; ")}`);
    }

    // latest_frozen_version の更新と version insert を単一トランザクションで
    // 行う SECURITY DEFINER RPC (migration 179) を使い、insert失敗時に
    // ポインタだけ進む破損状態が起きないようにする。
    const { data: rpcRows, error: rpcError } = await db.rpc("freeze_capital_plan", {
      p_plan_id: plan.id,
      p_expected_revision: expectedRevision,
      p_validation_summary: eligibility,
      p_published_by_email: email,
    });

    if (rpcError) {
      if (rpcError.code === "AMD01") {
        const { data: current } = await db
          .from("project_capital_plans")
          .select("*")
          .eq("id", plan.id)
          .maybeSingle();
        return conflict(rpcError.message, current ?? undefined);
      }
      if (rpcError.code === "AMD02") {
        return NextResponse.json({ ok: false, error: rpcError.message }, { status: 404 });
      }
      return badRequest(rpcError.message);
    }

    const result = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (!result) return badRequest("freeze_capital_plan returned no result");

    return NextResponse.json({ ok: true, plan: result.plan, version: result.version });
  }

  if (body.action === "restore_version") {
    if (!body.planId) return badRequest("planId required");
    const versionCheck = validatePositiveInteger(body.version, "version");
    if (!versionCheck.ok) return badRequest(versionCheck.error);
    const revisionCheck = validatePositiveInteger(body.expectedRevision, "expectedRevision");
    if (!revisionCheck.ok) return badRequest(revisionCheck.error);
    const expectedRevision = revisionCheck.value;

    const { data: frozen, error: frozenError } = await db
      .from("project_capital_plan_versions")
      .select("*")
      .eq("plan_id", body.planId)
      .eq("version", versionCheck.value)
      .maybeSingle();
    if (frozenError) return badRequest(frozenError.message);
    if (!frozen) return NextResponse.json({ ok: false, error: "frozen version not found" }, { status: 404 });

    const docCheck = validateDocumentShape(frozen.document_json);
    if (!docCheck.ok) return badRequest(`frozen document_json is malformed: ${docCheck.error}`);

    const { data: updatedPlan, error: updateError } = await db
      .from("project_capital_plans")
      .update({
        document_json: docCheck.value,
        revision: expectedRevision + 1,
        updated_by_email: email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.planId)
      .eq("revision", expectedRevision)
      .select()
      .maybeSingle();
    if (updateError) return badRequest(updateError.message);
    if (!updatedPlan) {
      const { data: current } = await db
        .from("project_capital_plans")
        .select("*")
        .eq("id", body.planId)
        .maybeSingle();
      if (!current) return NextResponse.json({ ok: false, error: "plan not found" }, { status: 404 });
      return conflict(`revision conflict: expected ${expectedRevision}, current ${current.revision}`, current);
    }

    return NextResponse.json({ ok: true, plan: updatedPlan, restoredFromVersion: frozen.version });
  }

  return badRequest("unknown action");
}

type PatchBody = {
  action?: "save" | "rename" | "archive" | "restore";
  planId?: string;
  expectedRevision?: number;
  document_json?: unknown;
  name?: string;
};

/** PATCH /api/governance/capital-plans body: { action, planId, expectedRevision, ... } */
export async function PATCH(req: NextRequest) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;
  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body?.action || !body.planId) return badRequest("action / planId required");
  const revisionCheck = validatePositiveInteger(body.expectedRevision, "expectedRevision");
  if (!revisionCheck.ok) return badRequest(revisionCheck.error);
  const expectedRevision = revisionCheck.value;

  const db = createAdminClient();
  const email = emailOf(auth);

  const patch: Record<string, unknown> = {
    revision: expectedRevision + 1,
    updated_by_email: email,
    updated_at: new Date().toISOString(),
  };

  if (body.action === "save") {
    const docCheck = validateDocumentShape(body.document_json);
    if (!docCheck.ok) return badRequest(docCheck.error);
    patch.document_json = docCheck.value;
  } else if (body.action === "rename") {
    const nameCheck = validateName(body.name);
    if (!nameCheck.ok) return badRequest(nameCheck.error);
    patch.name = nameCheck.value;
  } else if (body.action === "archive") {
    patch.status = "archived";
  } else if (body.action === "restore") {
    patch.status = "active";
  } else {
    return badRequest("unknown action");
  }

  const { data, error } = await db
    .from("project_capital_plans")
    .update(patch)
    .eq("id", body.planId)
    .eq("revision", expectedRevision)
    .select()
    .maybeSingle();
  if (error) return badRequest(error.message);
  if (!data) {
    const { data: current } = await db
      .from("project_capital_plans")
      .select("*")
      .eq("id", body.planId)
      .maybeSingle();
    if (!current) return NextResponse.json({ ok: false, error: "plan not found" }, { status: 404 });
    return conflict(`revision conflict: expected ${expectedRevision}, current ${current.revision}`, current);
  }

  return NextResponse.json({ ok: true, plan: data });
}
