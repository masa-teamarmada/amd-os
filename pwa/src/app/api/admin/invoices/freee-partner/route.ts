import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The invoice queue owns this one-field project setting.  It deliberately
 * uses the caller's admin RLS session so the native client can use exactly
 * the same bearer-authenticated path as the PWA; no service-role or direct
 * native table write is involved.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const projectId = text(body.projectId);
  const freeePartnerId = text(body.freeePartnerId);
  if (!projectId || projectId.length > 120 || !freeePartnerId || freeePartnerId.length > 120) {
    return NextResponse.json({ ok: false, error: "projectId and freeePartnerId are required" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("projects")
    .update({ freee_partner_id: freeePartnerId })
    .eq("project_id", projectId)
    .select("id, project_id, freee_partner_id");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data || data.length !== 1) {
    return NextResponse.json(
      { ok: false, error: data?.length ? "対象案件が重複しているよ" : "対象案件が見つからないよ" },
      { status: data?.length ? 409 : 404 }
    );
  }

  const row = data[0];
  return NextResponse.json({
    ok: true,
    updatedProject: {
      id: row.id,
      projectId: row.project_id,
      freeePartnerId: row.freee_partner_id,
    },
  });
}
