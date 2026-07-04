import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

const CATEGORIES = new Set([
  "commercialization_route",
  "coalition_design",
  "pricing",
  "sales",
  "finance",
  "governance",
  "organization",
  "fundraising",
  "legal",
  "operations",
  "other",
]);

const MATURITIES = new Set(["raw_note", "hypothesis", "field_tested", "playbook"]);
const SOURCE_KINDS = new Set(["manual", "codex", "slack", "gmail", "notion", "drive", "calendar", "meeting", "file", "other"]);
const STATUSES = new Set(["active", "needs_review", "archived", "deleted"]);

type ManagementKnowledgePayload = {
  id?: string;
  projectId?: string | null;
  title?: string;
  category?: string;
  routeType?: string | null;
  maturity?: string;
  tags?: string[] | string | null;
  summary?: string;
  bodyMd?: string;
  reusableWhen?: string | null;
  nextCheck?: string | null;
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

function normalizeTags(value: ManagementKnowledgePayload["tags"]) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((tag) => tag.trim()).filter(Boolean))).slice(0, 32);
  }
  if (typeof value === "string") {
    return Array.from(new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))).slice(0, 32);
  }
  return [];
}

function normalizeConfidence(value: ManagementKnowledgePayload["confidence"]) {
  if (value === null || value === undefined || value === "") return 0.5;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}

function rowFromPayload(body: ManagementKnowledgePayload, updatedBy: string, mode: "create" | "update") {
  const title = asCleanString(body.title, 220);
  if (mode === "create" && !title) {
    return { ok: false as const, error: "title required" };
  }

  const summary = typeof body.summary === "string" ? body.summary.trim().slice(0, 2000) : "";
  if (mode === "create" && !summary) {
    return { ok: false as const, error: "summary required" };
  }

  const category = body.category && CATEGORIES.has(body.category) ? body.category : "other";
  const maturity = body.maturity && MATURITIES.has(body.maturity) ? body.maturity : "hypothesis";
  const sourceKind = body.sourceKind && SOURCE_KINDS.has(body.sourceKind) ? body.sourceKind : "manual";
  const status = body.status && STATUSES.has(body.status) ? body.status : "active";
  const now = new Date().toISOString();

  const row: Record<string, unknown> = {
    project_id: asCleanString(body.projectId, 32),
    category,
    route_type: asCleanString(body.routeType, 160),
    maturity,
    tags: normalizeTags(body.tags),
    source_kind: sourceKind,
    source_ref: asCleanString(body.sourceRef, 1000),
    source_excerpt: asCleanString(body.sourceExcerpt, 1800),
    reusable_when: asCleanString(body.reusableWhen, 2000),
    next_check: asCleanString(body.nextCheck, 2000),
    confidence: normalizeConfidence(body.confidence),
    status,
    updated_by: updatedBy,
    updated_at: now,
    archived_at: status === "archived" || status === "deleted" ? now : null,
  };

  if (title) row.title = title;
  if (typeof body.summary === "string") row.summary = summary;
  if (typeof body.bodyMd === "string") row.body_md = body.bodyMd.trim().slice(0, 30000);
  if (mode === "create") row.created_by = updatedBy;

  return { ok: true as const, row };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const projectId = req.nextUrl.searchParams.get("projectId");
  const status = req.nextUrl.searchParams.get("status");
  const category = req.nextUrl.searchParams.get("category");
  const maturity = req.nextUrl.searchParams.get("maturity");
  const tag = req.nextUrl.searchParams.get("tag");

  const db = createAdminClient();
  let query = db
    .from("management_knowledge_entries")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (projectId) query = query.eq("project_id", projectId);
  if (status && STATUSES.has(status)) query = query.eq("status", status);
  if (category && CATEGORIES.has(category)) query = query.eq("category", category);
  if (maturity && MATURITIES.has(maturity)) query = query.eq("maturity", maturity);
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

  let body: ManagementKnowledgePayload;
  try {
    body = (await req.json()) as ManagementKnowledgePayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const normalized = rowFromPayload(body, auth.user.email, "create");
  if (!normalized.ok) {
    return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("management_knowledge_entries")
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

  let body: ManagementKnowledgePayload;
  try {
    body = (await req.json()) as ManagementKnowledgePayload;
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
    .from("management_knowledge_entries")
    .update(normalized.row)
    .eq("id", body.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, entry: data });
}
