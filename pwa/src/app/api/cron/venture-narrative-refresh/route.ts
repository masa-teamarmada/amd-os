/**
 * 毎朝 03:45 JST (= UTC 18:45) cron。差分のある PJ の沿革を再生成。
 *
 * 単一 PJ の処理は `lib/narrative-refresh.ts` を共有 (単発 API ルートと共通化)。
 *
 * 認証: Authorization: Bearer ${CRON_SECRET}
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshNarrativeForProject } from "@/lib/narrative-refresh";
import { isBackgroundLlmAllowed } from "@/lib/anthropic-client";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("Authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  // 背景処理での従量課金 LLM (ここは Gemini) はデフォルト封鎖。7/1 の Anthropic 封鎖と同じ扱い。
  if (!isBackgroundLlmAllowed()) {
    return NextResponse.json({ ok: true, disabled: true, reason: "background llm disabled" });
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? null;

  const supabase = createAdminClient();
  const { data: ventures, error } = await supabase
    .from("project_ventures")
    .select("project_id, narrative_text, narrative_generated_at, narrative_invalidated_at")
    .eq("is_public", true);
  if (error || !ventures) {
    return NextResponse.json({ error: "fetch ventures failed", detail: error }, { status: 500 });
  }

  const targets = ventures.filter((v) => {
    if (!v.narrative_text) return true;
    if (!v.narrative_generated_at) return true;
    if (
      v.narrative_invalidated_at &&
      new Date(v.narrative_invalidated_at as string) > new Date(v.narrative_generated_at as string)
    ) {
      return true;
    }
    return false;
  });

  const results: { project_id: string; ok: boolean; count: number; lessons?: number; error?: string }[] = [];
  for (const v of targets) {
    const r = await refreshNarrativeForProject(supabase, geminiKey, anthropicKey, v.project_id as string);
    results.push({ project_id: v.project_id as string, ...r });
  }

  return NextResponse.json({
    refreshed: results.length,
    skipped: ventures.length - targets.length,
    results,
  });
}
