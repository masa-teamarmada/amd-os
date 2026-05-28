import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/supabase/api-auth";

/**
 * 2つのストーリーを統合する。
 * - from の signals を to に move
 * - to の signal_count / tags / last_updated_at を更新
 * - merge log を残す
 * - from は削除
 *
 * 認証は admin セッションで行い、DB 更新だけ service role で実行する。
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: { from?: string; to?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { from, to, reason } = body;
  if (!from || !to || from === to) {
    return NextResponse.json({ error: "from/to required and must differ" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "supabase env missing" }, { status: 500 });
  }
  const db = createClient(url, key);

  // 1) 両ストーリー取得
  const [fromRes, toRes] = await Promise.all([
    db.from("atlas_stories").select("*").eq("id", from).single(),
    db.from("atlas_stories").select("*").eq("id", to).single(),
  ]);
  if (fromRes.error || !fromRes.data) {
    return NextResponse.json({ error: `from story not found: ${fromRes.error?.message}` }, { status: 404 });
  }
  if (toRes.error || !toRes.data) {
    return NextResponse.json({ error: `to story not found: ${toRes.error?.message}` }, { status: 404 });
  }
  const fromSt = fromRes.data;
  const toSt = toRes.data;

  // 2) signals を to に付け替え
  const { error: upSigErr } = await db
    .from("atlas_signals")
    .update({ story_id: to })
    .eq("story_id", from);
  if (upSigErr) {
    return NextResponse.json({ error: `signals move failed: ${upSigErr.message}` }, { status: 500 });
  }

  // 3) to の signal_count を再集計、tags をマージ
  const { count: newCount } = await db
    .from("atlas_signals")
    .select("id", { count: "exact", head: true })
    .eq("story_id", to);
  const mergedTags = Array.from(
    new Set([...((toSt.tags as string[]) || []), ...((fromSt.tags as string[]) || [])])
  ).slice(0, 32);
  const newImportance =
    fromSt.importance === "high" || toSt.importance === "high"
      ? "high"
      : fromSt.importance === "medium" || toSt.importance === "medium"
        ? "medium"
        : "low";
  const newStartedAt =
    new Date(fromSt.started_at as string).getTime() <
    new Date(toSt.started_at as string).getTime()
      ? fromSt.started_at
      : toSt.started_at;

  const { error: upToErr } = await db
    .from("atlas_stories")
    .update({
      signal_count: newCount ?? 0,
      tags: mergedTags,
      importance: newImportance,
      started_at: newStartedAt,
      last_updated_at: new Date().toISOString(),
    })
    .eq("id", to);
  if (upToErr) {
    return NextResponse.json({ error: `to update failed: ${upToErr.message}` }, { status: 500 });
  }

  // 4) merge log
  await db.from("atlas_story_merges").insert({
    merged_from_title: fromSt.title,
    merged_from_summary: fromSt.summary,
    merged_to_id: to,
    merged_to_title: toSt.title,
    reason: reason || null,
  });

  // 5) from を削除
  const { error: delErr } = await db.from("atlas_stories").delete().eq("id", from);
  if (delErr) {
    return NextResponse.json({ error: `delete from failed: ${delErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    to_id: to,
    new_signal_count: newCount ?? 0,
  });
}
