import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { attachStory } from "@/lib/atlas-stories-server";

export const maxDuration = 300;

/**
 * 既存の story_id=null なシグナルをバッチでストーリー化する。
 * ?limit=25 で1回あたりの処理数を制限（Vercel maxDuration対策）。
 * 続きは次の呼び出しで自然に進む（古い順に処理）。
 *
 * Bearer CRON_SECRET 認証。
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const limit = Math.max(1, Math.min(50, parseInt(params.get("limit") || "20", 10)));

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthroKey = process.env.ANTHROPIC_API_KEY;
  if (!supaUrl || !supaKey || !anthroKey) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const db = createClient(supaUrl, supaKey);
  const anthropic = new Anthropic({ apiKey: anthroKey });

  // story_id 未付与のシグナルを古い順に
  const { data: targets, error } = await db
    .from("atlas_signals")
    .select("id, title, content, domain, suggested_tags")
    .is("story_id", null)
    .order("submitted_at", { ascending: true })
    .limit(limit);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!targets || targets.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, remaining: 0, note: "no targets" });
  }

  let attached = 0;
  let failed = 0;
  for (const s of targets) {
    const storyId = await attachStory(
      {
        title: s.title as string,
        content: s.content as string,
        domain: (s.domain as string | null) || null,
        tags: (s.suggested_tags as string[]) || [],
      },
      db,
      anthropic
    );
    if (storyId) {
      const { error: upErr } = await db
        .from("atlas_signals")
        .update({ story_id: storyId })
        .eq("id", s.id as string);
      if (upErr) {
        console.error("update signal story_id:", upErr.message);
        failed++;
      } else {
        attached++;
      }
    } else {
      failed++;
    }
  }

  // 残数
  const { count } = await db
    .from("atlas_signals")
    .select("id", { count: "exact", head: true })
    .is("story_id", null);

  return NextResponse.json({
    ok: true,
    processed: targets.length,
    attached,
    failed,
    remaining: count ?? 0,
  });
}
