import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

// 汎用「要対応」(期日つき inbound 義務)。5生データ抽出 + 手動。
// 設計: pwa/design/governance_action_items.md

const STATUSES = new Set(["open", "in_progress", "responded", "done", "expired", "dismissed"]);
const OPEN_STATUSES = ["open", "in_progress"];

/**
 * GET /api/action-items
 *   ?scope=open (既定: open+in_progress) | all
 *   ?projectId=p09 (任意)
 *   ?reviewed=1    (既定: confirmed のみ。1で candidate も含む)
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const sp = req.nextUrl.searchParams;
  const db = createAdminClient();

  let q = db.from("action_items").select("*");
  if (sp.get("scope") !== "all") q = q.in("status", OPEN_STATUSES);
  if (sp.get("projectId")) q = q.eq("project_id", sp.get("projectId")!);
  if (sp.get("reviewed") !== "1") q = q.eq("review_status", "confirmed");
  q = q.order("due_at", { ascending: true, nullsFirst: false });

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // 期日ラベル付与 (あと何日)
  const now = Date.now();
  const items = (data ?? []).map((r: Record<string, unknown>) => {
    const due = r.due_at ? new Date(r.due_at as string).getTime() : null;
    const daysLeft = due === null ? null : Math.floor((due - now) / 86400000);
    return { ...r, daysLeft };
  });
  return NextResponse.json({ ok: true, items });
}

/** POST /api/action-items  → 手動で要対応を追加 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  if (!body?.title) return NextResponse.json({ ok: false, error: "title required" }, { status: 400 });

  const ts = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const row = {
    action_id: body.action_id || `ai:manual-${ts}`,
    project_id: body.project_id || null,
    scope: body.scope || (body.project_id ? "project" : "personal"),
    category: body.category || "other",
    title: String(body.title).slice(0, 300),
    summary: body.summary ?? null,
    due_at: body.due_at ?? null,
    status: STATUSES.has(body.status) ? body.status : "open",
    priority: body.priority ?? null,
    action_url: body.action_url ?? null,
    assignee_member_id: body.assignee_member_id ?? "ID001",
    source: "manual",
    review_status: "confirmed",
    created_by: auth.user.email,
  };
  const db = createAdminClient();
  const { data, error } = await db.from("action_items").insert(row).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, row: data });
}

/** PATCH /api/action-items  body: { action_id, ...patch } */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  if (!body?.action_id) return NextResponse.json({ ok: false, error: "action_id required" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: auth.user.email };
  if (body.status && STATUSES.has(body.status)) {
    patch.status = body.status;
    if (body.status === "responded" || body.status === "done") patch.responded_at = new Date().toISOString();
  }
  if (typeof body.response_note === "string") patch.response_note = body.response_note;
  if (body.review_status) patch.review_status = body.review_status;
  if ("due_at" in body) patch.due_at = body.due_at;
  if ("priority" in body) patch.priority = body.priority;

  const db = createAdminClient();
  const { data, error } = await db.from("action_items").update(patch).eq("action_id", body.action_id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, row: data });
}
