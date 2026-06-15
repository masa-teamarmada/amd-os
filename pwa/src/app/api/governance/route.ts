import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

// 株主 / 資金調達ラウンド / 株主総会 = cap table・バリュエーション最機密 → admin 限定。
// 設計: pwa/design/governance_action_items.md

const ENTITY_TABLE: Record<string, string> = {
  shareholder: "project_shareholders",
  round: "project_valuation_rounds",
  meeting: "project_shareholder_meetings",
};

/** GET /api/governance?projectId=p09  → 当該PJの株主/ラウンド/総会/要対応 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });

  const db = createAdminClient();
  const [shareholdersRes, roundsRes, meetingsRes, actionsRes] = await Promise.all([
    db.from("project_shareholders").select("*").eq("project_id", projectId).order("holder_type", { ascending: true }),
    db.from("project_valuation_rounds").select("*").eq("project_id", projectId).order("round_date", { ascending: false, nullsFirst: false }),
    db.from("project_shareholder_meetings").select("*").eq("project_id", projectId).order("meeting_date", { ascending: false, nullsFirst: false }),
    db.from("action_items").select("*").eq("project_id", projectId).neq("status", "dismissed").order("due_at", { ascending: true, nullsFirst: false }),
  ]);

  const err = shareholdersRes.error || roundsRes.error || meetingsRes.error || actionsRes.error;
  if (err) return NextResponse.json({ ok: false, error: err.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    shareholders: shareholdersRes.data ?? [],
    rounds: roundsRes.data ?? [],
    meetings: meetingsRes.data ?? [],
    actionItems: actionsRes.data ?? [],
  });
}

/** POST /api/governance  body: { entity, row }  → 新規作成 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const table = body && ENTITY_TABLE[body.entity];
  if (!table || !body.row || !body.row.project_id) {
    return NextResponse.json({ ok: false, error: "entity / row.project_id required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db.from(table).insert(body.row).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, row: data });
}

/** PATCH /api/governance  body: { entity, id, patch } */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  const table = body && ENTITY_TABLE[body.entity];
  if (!table || !body.id || !body.patch) {
    return NextResponse.json({ ok: false, error: "entity / id / patch required" }, { status: 400 });
  }

  const db = createAdminClient();
  const patch = { ...body.patch, updated_at: new Date().toISOString() };
  const { data, error } = await db.from(table).update(patch).eq("id", body.id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, row: data });
}

/** DELETE /api/governance?entity=shareholder&id=... */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const entity = req.nextUrl.searchParams.get("entity") || "";
  const id = req.nextUrl.searchParams.get("id");
  const table = ENTITY_TABLE[entity];
  if (!table || !id) return NextResponse.json({ ok: false, error: "entity / id required" }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
