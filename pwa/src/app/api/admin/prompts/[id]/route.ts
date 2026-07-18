/**
 * PATCH /api/admin/prompts/[id]
 *
 * llm_prompts の 1 行を service_role で更新。
 * AGENTS.common.md の「プロンプトはコードに書かず DB + admin UI で編集」ルールの執行 API。
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const updatedBy = auth.user.email;

  const allowed: Record<string, unknown> = {
    body: typeof body.body === "string" ? body.body : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    model: typeof body.model === "string" ? body.model : undefined,
    max_tokens: typeof body.maxTokens === "number" ? body.maxTokens : (body.maxTokens === null ? null : undefined),
    is_active: typeof body.isActive === "boolean" ? body.isActive : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  };
  const patch = Object.fromEntries(Object.entries(allowed).filter(([, v]) => v !== undefined));

  const db = createAdminClient();
  const { error } = await db.from("llm_prompts").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
