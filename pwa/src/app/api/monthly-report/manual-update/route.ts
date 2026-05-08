/**
 * POST /api/monthly-report/manual-update
 * body: { projectId, ym, content }
 *
 * 月次報告書の draft_content をまさが直接編集した本文で上書き。
 * - service_role で書き込む (anon RLS bypass)
 * - 認証は requireAuth (admin チェックは monthly_reports の運用上 PJ メンバー全員が対象)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/supabase/api-auth";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  let body: { projectId?: string; ym?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "invalid JSON" }, { status: 400 });
  }
  const { projectId, ym, content } = body;
  if (!projectId || !ym || typeof content !== "string") {
    return NextResponse.json(
      { ok: false, message: "projectId, ym, content required" },
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
  );

  const { error } = await supabase
    .from("monthly_reports")
    .update({ draft_content: content })
    .eq("project_id", projectId)
    .eq("ym", ym);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
