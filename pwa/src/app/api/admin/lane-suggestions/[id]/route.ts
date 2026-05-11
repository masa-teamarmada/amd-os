/**
 * PATCH /api/admin/lane-suggestions/[id]
 *
 * LLM lane 提案 (lane_suggestions テーブル) の approve / reject を service_role で実行する。
 *
 * Body: { action: 'approve' | 'reject' }
 *   approve: project_ventures.lanes ← suggested_lanes + lane_suggestions.status='approved'
 *   reject:  lane_suggestions.status='rejected' のみ
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ ok: false, error: "action must be approve/reject" }, { status: 400 });
  }

  const db = createAdminClient();
  const reviewedAt = new Date().toISOString();

  if (body.action === "approve") {
    const { data: sugg, error: sErr } = await db
      .from("lane_suggestions")
      .select("project_id, suggested_lanes")
      .eq("id", id)
      .maybeSingle();
    if (sErr || !sugg) {
      return NextResponse.json(
        { ok: false, error: `suggestion not found: ${sErr?.message ?? "no row"}` },
        { status: 404 }
      );
    }
    const s = sugg as { project_id: string; suggested_lanes: unknown };
    const { error: pvErr } = await db
      .from("project_ventures")
      .update({ lanes: s.suggested_lanes, updated_at: reviewedAt })
      .eq("project_id", s.project_id);
    if (pvErr) {
      return NextResponse.json(
        { ok: false, error: `project_ventures update: ${pvErr.message}` },
        { status: 500 }
      );
    }
  }

  const newStatus = body.action === "approve" ? "approved" : "rejected";
  const { error } = await db
    .from("lane_suggestions")
    .update({ status: newStatus, reviewed_at: reviewedAt })
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { ok: false, error: `lane_suggestions update: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, status: newStatus });
}
