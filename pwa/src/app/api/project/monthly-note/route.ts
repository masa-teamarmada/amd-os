/**
 * /api/project/monthly-note
 *
 * GET  ?projectId=&ym=  → { body, updated_at, updated_by }
 * POST { projectId, ym, body }  → upsert
 *
 * MS plan_cycle が無い PJ でも月次モーダルで「進捗ノート」を残せるようにする
 * (= 2026-05-12 まさタスク 3)。MS あり PJ でも MS に紐付かない自由記述メモとして使える。
 *
 * テーブル: project_monthly_notes (migration 056)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const ym = searchParams.get("ym");
  if (!projectId || !ym) {
    return NextResponse.json({ error: "projectId and ym required" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("project_monthly_notes")
    .select("body, updated_at, updated_by")
    .eq("project_id", projectId)
    .eq("ym", ym)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    note: data ?? { body: "", updated_at: null, updated_by: null },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await req.json().catch(() => ({}));
  const projectId = String(body.projectId || "").trim();
  const ym = String(body.ym || "").trim();
  const noteBody = String(body.body || "");

  if (!projectId || !/^\d{6}$/.test(ym)) {
    return NextResponse.json({ error: "projectId and ym (YYYYMM) required" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("project_monthly_notes")
    .upsert(
      {
        project_id: projectId,
        ym,
        body: noteBody,
        updated_by: auth.user.email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,ym" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
