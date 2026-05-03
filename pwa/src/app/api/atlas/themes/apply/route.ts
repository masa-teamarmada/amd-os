import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 120;

interface ThemeInput {
  id?: string; // 既存テーマを更新する場合のみ
  name: string;
  description?: string;
  primary_domain?: string;
  tag_keywords?: string[];
  story_ids?: string[];
}

/**
 * クラスタリング結果を確定して DB に保存する。
 * - 各テーマを atlas_themes に upsert（name 一意）
 * - atlas_story_themes に紐付け insert（既存は ON CONFLICT で無視）
 *
 * body: { themes: ThemeInput[], replace?: boolean }
 *  - replace=true なら、含まれる story_id の既存紐付けを一旦全削除してから入れ直す
 */
export async function POST(req: NextRequest) {
  let body: { themes?: ThemeInput[]; replace?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { themes, replace } = body;
  if (!Array.isArray(themes) || themes.length === 0) {
    return NextResponse.json({ error: "themes array required" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const db = createClient(url, key);

  const result: {
    created: number;
    updated: number;
    links_inserted: number;
    errors: string[];
  } = { created: 0, updated: 0, links_inserted: 0, errors: [] };

  // replace モード: 入力 story_ids 全部の既存紐付けを一旦削除
  if (replace) {
    const allStoryIds = Array.from(
      new Set(themes.flatMap((t) => t.story_ids || []))
    );
    if (allStoryIds.length > 0) {
      const { error: delErr } = await db
        .from("atlas_story_themes")
        .delete()
        .in("story_id", allStoryIds);
      if (delErr) {
        result.errors.push("replace delete failed: " + delErr.message);
      }
    }
  }

  for (const t of themes) {
    if (!t.name || !t.name.trim()) continue;

    const themeRow = {
      name: t.name.trim(),
      description: t.description?.trim() || null,
      primary_domain: t.primary_domain?.trim() || null,
      tag_keywords: t.tag_keywords || [],
      updated_at: new Date().toISOString(),
    };

    let themeId: string | null = null;

    if (t.id) {
      // 既存テーマ更新
      const { data, error } = await db
        .from("atlas_themes")
        .update(themeRow)
        .eq("id", t.id)
        .select("id")
        .single();
      if (error) {
        result.errors.push(`update ${t.name}: ${error.message}`);
        continue;
      }
      themeId = data?.id as string;
      result.updated++;
    } else {
      // upsert by name
      const { data, error } = await db
        .from("atlas_themes")
        .upsert(themeRow, { onConflict: "name" })
        .select("id")
        .single();
      if (error) {
        result.errors.push(`upsert ${t.name}: ${error.message}`);
        continue;
      }
      themeId = data?.id as string;
      result.created++;
    }

    if (!themeId) continue;

    // 紐付け insert
    if (Array.isArray(t.story_ids) && t.story_ids.length > 0) {
      const links = t.story_ids.map((sid) => ({
        story_id: sid,
        theme_id: themeId,
        confidence: 0.85,
      }));
      const { error: linkErr } = await db
        .from("atlas_story_themes")
        .upsert(links, { onConflict: "story_id,theme_id" });
      if (linkErr) {
        result.errors.push(`link ${t.name}: ${linkErr.message}`);
      } else {
        result.links_inserted += links.length;
      }
    }
  }

  return NextResponse.json({ ok: true, ...result });
}
