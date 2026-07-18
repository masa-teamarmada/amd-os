import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

type DraftLine = {
  section?: "base" | "adjustment";
  type?: "item" | "text";
  description?: string;
  quantity?: number;
  unit_price?: number;
};

function isYm(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

function validateLines(value: unknown): value is DraftLine[] {
  if (!Array.isArray(value) || value.length > 100) return false;
  return value.every((line) => {
    if (!line || typeof line !== "object" || Array.isArray(line)) return false;
    const row = line as Record<string, unknown>;
    if (row.section !== "base" && row.section !== "adjustment") return false;
    if (row.type !== "item" && row.type !== "text") return false;
    if (typeof row.description !== "string" || row.description.length > 500) return false;
    if (row.type === "text") return true;
    return typeof row.quantity === "number" && Number.isFinite(row.quantity) &&
      typeof row.unit_price === "number" && Number.isFinite(row.unit_price);
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const ym = body.ym;
  const invoiceSubject = body.invoiceSubject;
  const allLinesJson = body.allLinesJson;
  if (!projectId || projectId.length > 120 || !isYm(ym) || typeof invoiceSubject !== "string" || invoiceSubject.length > 500 || typeof allLinesJson !== "string") {
    return NextResponse.json({ ok: false, error: "projectId / ym / invoiceSubject / allLinesJson を確認してね" }, { status: 400 });
  }

  let lines: unknown;
  try {
    lines = JSON.parse(allLinesJson);
  } catch {
    return NextResponse.json({ ok: false, error: "allLinesJson はJSON配列で送ってね" }, { status: 400 });
  }
  if (!validateLines(lines)) {
    return NextResponse.json({ ok: false, error: "請求明細の形式を確認してね" }, { status: 400 });
  }

  const normalizedLinesJson = JSON.stringify(lines);
  const db = createAdminClient();
  const { data, error } = await db
    .from("billing_cycles")
    .update({
      invoice_subject: invoiceSubject,
      invoice_base_lines_json: normalizedLinesJson,
    })
    .eq("project_id", projectId)
    .eq("ym", ym)
    .select("id");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data || data.length !== 1) {
    return NextResponse.json({ ok: false, error: data?.length ? "対象請求月が重複しているよ" : "対象請求月が見つからないよ" }, { status: data?.length ? 409 : 404 });
  }

  return NextResponse.json({ ok: true, updated: 1 });
}
