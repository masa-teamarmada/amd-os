import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { cronOperations, l2Datasets, rawDataSources } from "@/lib/operations-catalog";

export const runtime = "nodejs";

const SETTING_TYPES = new Set(["string", "number", "boolean"]);

type SettingsPayload = {
  key?: unknown;
  label?: unknown;
  value?: unknown;
  type?: unknown;
  description?: unknown;
};

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function settingRow(payload: SettingsPayload, updatedBy: string, mode: "create" | "update") {
  const key = cleanText(payload.key, 160);
  if (!key) return { ok: false as const, error: "key required" };

  const rawType = cleanText(payload.type, 32) || "string";
  if (!SETTING_TYPES.has(rawType)) return { ok: false as const, error: "type must be string, number, or boolean" };

  return {
    ok: true as const,
    key,
    row: {
      label: cleanText(payload.label, 240),
      value: typeof payload.value === "string" ? payload.value : "",
      type: rawType,
      description: cleanText(payload.description, 2_000),
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
      ...(mode === "create" ? { key } : {}),
    },
  };
}

async function readPayload(request: NextRequest): Promise<SettingsPayload | null> {
  try {
    return await request.json() as SettingsPayload;
  } catch {
    return null;
  }
}

function operationsCatalogPayload() {
  return {
    rawDataSources,
    l2Datasets,
    cronOperations: cronOperations.map((operation) => ({
      id: operation.id,
      label: operation.label,
      layer: operation.layer,
      cadence: operation.cadence,
      trigger: operation.trigger,
      defaultParams: operation.defaultParams,
      input: operation.input,
      output: operation.output,
      runType: operation.run.type,
      manualReason: operation.run.type === "manual" ? operation.run.reason : null,
    })),
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { data, error } = await createAdminClient().from("settings").select("*").order("key");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: data ?? [], catalog: operationsCatalogPayload() });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  const payload = await readPayload(request);
  if (!payload) return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  const normalized = settingRow(payload, auth.user.email, "create");
  if (!normalized.ok) return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });

  const { data, error } = await createAdminClient().from("settings").insert(normalized.row).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, setting: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  const payload = await readPayload(request);
  if (!payload) return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  const normalized = settingRow(payload, auth.user.email, "update");
  if (!normalized.ok) return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });

  const { data, error } = await createAdminClient()
    .from("settings")
    .update(normalized.row)
    .eq("key", normalized.key)
    .select("*")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, setting: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  const key = cleanText(request.nextUrl.searchParams.get("key"), 160);
  if (!key) return NextResponse.json({ ok: false, error: "key required" }, { status: 400 });

  const { error } = await createAdminClient().from("settings").delete().eq("key", key);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, key });
}
