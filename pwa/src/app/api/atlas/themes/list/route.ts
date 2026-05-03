import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * 既存テーマと各テーマに紐付くストーリー数を返す。
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const db = createClient(url, key);

  const [themesRes, linksRes] = await Promise.all([
    db
      .from("atlas_themes")
      .select("id, name, description, primary_domain, tag_keywords")
      .eq("status", "active")
      .order("name"),
    db.from("atlas_story_themes").select("theme_id"),
  ]);

  if (themesRes.error) {
    return NextResponse.json({ error: themesRes.error.message }, { status: 500 });
  }

  const counts = new Map<string, number>();
  for (const row of linksRes.data || []) {
    const tid = row.theme_id as string;
    counts.set(tid, (counts.get(tid) || 0) + 1);
  }

  const themes = (themesRes.data || []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    description: (t.description as string | null) || null,
    primary_domain: (t.primary_domain as string | null) || null,
    tag_keywords: (t.tag_keywords as string[]) || [],
    story_count: counts.get(t.id as string) || 0,
  }));

  return NextResponse.json({ ok: true, themes });
}
