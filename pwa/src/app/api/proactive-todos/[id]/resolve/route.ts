/**
 * POST /api/proactive-todos/:id/resolve
 *
 * 仕様正本: pwa/spec/2-4-proactive-todo-current-spec.md
 *
 * /proactive 画面の 3 ボタン (✅完了 / ⏸ブロック / 🗑関係ない) のサーバ側。
 * admin 限定。status='done'|'blocked'|'dismissed' のいずれかに遷移し、
 * cron による上書きを止める。
 *
 * body:
 *   { action: 'done' | 'blocked' | 'dismissed', note?: string }
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  action?: string;
  note?: string;
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase() ?? "";
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("members")
    .select("is_admin, code_name")
    .eq("email", email)
    .maybeSingle();
  if (!member?.is_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = String(body.action ?? "");
  if (!["done", "blocked", "dismissed"].includes(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const note = body.note ? String(body.note).slice(0, 500) : null;
  const nowIso = new Date().toISOString();

  const patch: Record<string, unknown> = {
    status: action,
    resolved_note: note,
    resolved_by: String(member.code_name ?? "admin"),
  };
  if (action === "done" || action === "dismissed") {
    patch.resolved_at = nowIso;
  } else {
    // blocked は resolved_at を埋めない (3日後に open へ自動復帰させるため updated_at だけ動かす)
    patch.resolved_at = null;
  }

  const { error } = await supabase.from("proactive_todos").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, action });
}
