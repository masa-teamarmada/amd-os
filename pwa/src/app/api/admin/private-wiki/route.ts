import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

const PERSON_KINDS = new Set([
  "amd_member",
  "client",
  "partner",
  "vendor",
  "investor",
  "researcher",
  "external_collaborator",
  "other",
]);

const SOURCE_KINDS = new Set([
  "manual",
  "codex",
  "slack",
  "gmail",
  "notion",
  "drive",
  "calendar",
  "meeting",
  "other",
]);

const STATUSES = new Set(["active", "needs_review", "archived", "deleted"]);

type PrivateWikiPayload = {
  id?: string;
  projectId?: string | null;
  personName?: string;
  personKind?: string;
  affiliation?: string | null;
  relationshipContext?: string | null;
  tags?: string[] | string | null;
  memoBody?: string;
  sourceKind?: string;
  sourceRef?: string | null;
  sourceExcerpt?: string | null;
  confidence?: number | string | null;
  status?: string;
};

function asCleanString(value: unknown, max = 4000) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function normalizeTags(value: PrivateWikiPayload["tags"]) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((tag) => tag.trim()).filter(Boolean))).slice(0, 24);
  }
  if (typeof value === "string") {
    return Array.from(new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))).slice(0, 24);
  }
  return [];
}

function normalizeConfidence(value: PrivateWikiPayload["confidence"]) {
  if (value === null || value === undefined || value === "") return 0.5;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}

function rowFromPayload(body: PrivateWikiPayload, updatedBy: string, mode: "create" | "update") {
  const personName = asCleanString(body.personName, 160);
  if (mode === "create" && !personName) {
    return { ok: false as const, error: "personName required" };
  }

  const personKind = body.personKind && PERSON_KINDS.has(body.personKind)
    ? body.personKind
    : "external_collaborator";
  const sourceKind = body.sourceKind && SOURCE_KINDS.has(body.sourceKind)
    ? body.sourceKind
    : "manual";
  const status = body.status && STATUSES.has(body.status) ? body.status : "active";
  const memoBody = typeof body.memoBody === "string" ? body.memoBody.trim().slice(0, 12000) : "";

  if (mode === "create" && !memoBody) {
    return { ok: false as const, error: "memoBody required" };
  }

  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    project_id: asCleanString(body.projectId, 32),
    person_kind: personKind,
    affiliation: asCleanString(body.affiliation, 300),
    relationship_context: asCleanString(body.relationshipContext, 1000),
    tags: normalizeTags(body.tags),
    source_kind: sourceKind,
    source_ref: asCleanString(body.sourceRef, 1000),
    source_excerpt: asCleanString(body.sourceExcerpt, 1800),
    confidence: normalizeConfidence(body.confidence),
    status,
    visibility: "admin_private",
    updated_by: updatedBy,
    updated_at: now,
    archived_at: status === "archived" || status === "deleted" ? now : null,
  };

  if (personName) row.person_name = personName;
  if (typeof body.memoBody === "string") row.memo_body = memoBody;
  if (mode === "create") row.created_by = updatedBy;

  return { ok: true as const, row };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const projectId = req.nextUrl.searchParams.get("projectId");
  const status = req.nextUrl.searchParams.get("status");
  const tag = req.nextUrl.searchParams.get("tag");
  const personKind = req.nextUrl.searchParams.get("personKind");

  const db = createAdminClient();
  let query = db
    .from("private_wiki_entries")
    .select("*")
    .order("project_id", { ascending: true, nullsFirst: true })
    .order("updated_at", { ascending: false })
    .limit(500);

  if (projectId) query = query.eq("project_id", projectId);
  if (status && STATUSES.has(status)) query = query.eq("status", status);
  if (personKind && PERSON_KINDS.has(personKind)) query = query.eq("person_kind", personKind);
  if (tag) query = query.contains("tags", [tag]);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, entries: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: PrivateWikiPayload;
  try {
    body = (await req.json()) as PrivateWikiPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const normalized = rowFromPayload(body, auth.user.email, "create");
  if (!normalized.ok) {
    return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("private_wiki_entries")
    .insert(normalized.row)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, entry: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: PrivateWikiPayload;
  try {
    body = (await req.json()) as PrivateWikiPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const normalized = rowFromPayload(body, auth.user.email, "update");
  if (!normalized.ok) {
    return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("private_wiki_entries")
    .update(normalized.row)
    .eq("id", body.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, entry: data });
}
