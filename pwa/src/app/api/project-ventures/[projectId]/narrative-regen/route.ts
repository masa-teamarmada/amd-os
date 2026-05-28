/**
 * 単一 PJ の沿革を即時再生成 (修正依頼の即反映用)。
 *
 * POST → { ok, count, lessons }
 *
 * cron `/api/cron/venture-narrative-refresh` と同じ `refreshNarrativeForProject()` を共有。
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshNarrativeForProject } from "@/lib/narrative-refresh";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { projectId } = await ctx.params;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? null;

  const supabase = createAdminClient();
  const r = await refreshNarrativeForProject(supabase, geminiKey, anthropicKey, projectId);
  if (!r.ok) return NextResponse.json(r, { status: 500 });
  return NextResponse.json(r);
}
