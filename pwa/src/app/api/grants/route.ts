import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

// 助成金 / 補助金 / 委託費 (project_grants)。
// read = ログイン済みメンバー (コックピットで自PJの受給状況を見る)、write = admin。
// 集計 (AMD全体累計) は /api/funding-stats 側。
// 設計: pwa/design/governance_action_items.md (助成金章)

/** GET /api/grants?projectId=p07 → 当該PJの助成金一覧 (採択日降順) */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });

  const { data, error } = await auth.supabase
    .from("project_grants")
    .select("*")
    .eq("project_id", projectId)
    .order("is_current", { ascending: false })
    .order("adopted_date", { ascending: false, nullsFirst: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, grants: data ?? [] });
}

/** POST /api/grants  body: { row } → 新規作成 (admin) */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  if (!body?.row?.project_id || !body.row.grant_name) {
    return NextResponse.json({ ok: false, error: "row.project_id / row.grant_name required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db.from("project_grants").insert({ ...body.row, created_by: auth.user.email }).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, row: data });
}

/** PATCH /api/grants  body: { id, patch } (admin) */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  if (!body?.id || !body.patch) return NextResponse.json({ ok: false, error: "id / patch required" }, { status: 400 });

  const db = createAdminClient();
  const patch = { ...body.patch, updated_by: auth.user.email, updated_at: new Date().toISOString() };
  const { data, error } = await db.from("project_grants").update(patch).eq("id", body.id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, row: data });
}

/** DELETE /api/grants?id=... (admin) */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from("project_grants").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
