import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

const LAYERS = new Set(["judge", "role", "memory", "tone", "safety"]);
const STATUSES = new Set(["active", "archived"]);

type ContextPayload = {
  contextId?: unknown;
  context_id?: unknown;
  systemPrompt?: unknown;
  system_prompt?: unknown;
  contextType?: unknown;
  context_type?: unknown;
  priority?: unknown;
  tags?: unknown;
  status?: unknown;
};

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function tagsWithLayer(value: unknown, layerValue: unknown): string {
  const layer = cleanText(layerValue, 32).toLowerCase();
  const selected = LAYERS.has(layer) ? layer : "tone";
  const tags = cleanText(value, 1_000)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => !LAYERS.has(tag.toLowerCase()));
  return [...new Set([...tags, selected])].join(", ");
}

function normalizedRow(payload: ContextPayload) {
  const contextId = cleanText(payload.contextId ?? payload.context_id, 240);
  const systemPrompt = cleanText(payload.systemPrompt ?? payload.system_prompt, 24_000);
  if (!contextId) return { ok: false as const, error: "contextId required" };
  if (!systemPrompt) return { ok: false as const, error: "systemPrompt required" };

  const rawPriority = Number(payload.priority);
  const priority = Number.isFinite(rawPriority) ? Math.trunc(rawPriority) : 0;
  const rawStatus = cleanText(payload.status, 32) || "active";
  if (!STATUSES.has(rawStatus)) return { ok: false as const, error: "status must be active or archived" };

  return {
    ok: true as const,
    contextId,
    row: {
      context_id: contextId,
      system_prompt: systemPrompt,
      priority,
      tags: tagsWithLayer(payload.tags, payload.contextType ?? payload.context_type),
      status: rawStatus,
      updated_at: new Date().toISOString(),
    },
  };
}

async function readPayload(request: NextRequest): Promise<ContextPayload | null> {
  try {
    return await request.json() as ContextPayload;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const status = cleanText(request.nextUrl.searchParams.get("status"), 32);
  const tag = cleanText(request.nextUrl.searchParams.get("tag"), 200);
  if (status && !STATUSES.has(status)) return NextResponse.json({ ok: false, error: "invalid status" }, { status: 400 });

  let query = createAdminClient().from("tsukuyomi_context").select("*").order("priority", { ascending: false });
  if (status) query = query.eq("status", status);
  if (tag) query = query.ilike("tags", `%${tag}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, contexts: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  const payload = await readPayload(request);
  if (!payload) return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  const normalized = normalizedRow(payload);
  if (!normalized.ok) return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });

  const now = new Date().toISOString();
  const { data, error } = await createAdminClient()
    .from("tsukuyomi_context")
    .insert({ ...normalized.row, created_at: now, updated_at: now })
    .select("*")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, context: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  const payload = await readPayload(request);
  if (!payload) return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  const normalized = normalizedRow(payload);
  if (!normalized.ok) return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });

  const { data, error } = await createAdminClient()
    .from("tsukuyomi_context")
    .update(normalized.row)
    .eq("context_id", normalized.contextId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, context: data });
}
