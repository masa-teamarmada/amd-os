import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { attachStory } from "@/lib/atlas-stories-server";

interface SeedSignal {
  title: string;
  content: string;
  source_url: string;
  source_type?: "news" | "report" | "data" | "manual";
  domain?: string;
  importance?: "high" | "medium" | "low";
  suggested_tags?: string[];
  submitted_at?: string;
}

/**
 * Bulk seed signals into atlas_signals (status=inbox).
 * Bearer CRON_SECRET 認証。タグが空なら Claude Haiku で自動付与。
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { signals?: SeedSignal[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const signals = body.signals || [];
  if (signals.length === 0) {
    return NextResponse.json({ error: "no signals" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthroKey = process.env.ANTHROPIC_API_KEY;
  if (!url || !key || !anthroKey) {
    return NextResponse.json({ error: "env missing (supabase or anthropic)" }, { status: 500 });
  }
  const db = createClient(url, key);
  const anthropic = new Anthropic({ apiKey: anthroKey });

  const autoTag = async (s: SeedSignal): Promise<{ tags: string[]; importance: string | null }> => {
    const prompt = `あなたはマクロトレンド分析のタグ付けエディタです。
以下のシグナルから、後で横串検索するためのタグを 6〜12 個提案してください。

タイトル: ${s.title}
内容: ${s.content}
分野: ${s.domain || "—"}

タグの方針:
- 素材名 / 技術名 / 地域名 / 産業名 / 規制名 / 市場名 / 社会課題などの「一般名詞」
- 特定企業名や PJ 名は使わない（一般化された呼称に置き換える）
- 単語または 2-3 語の短いフレーズ
- 日本語と英語どちらでも可
- 数年後に同じタグで検索しても意味のある粒度で

JSON のみを返してください。例:
{"tags": ["リチウム", "中国", "輸出規制"], "importance": "high"}

importance は内容から推定: high / medium / low`;
    try {
      const m = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 384,
        messages: [{ role: "user", content: prompt }],
      });
      const block = m.content[0];
      const text = block.type === "text" ? block.text : "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return { tags: [], importance: null };
      const parsed = JSON.parse(match[0]);
      const tags = Array.isArray(parsed.tags)
        ? parsed.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 16)
        : [];
      const importance =
        parsed.importance === "high" ||
        parsed.importance === "medium" ||
        parsed.importance === "low"
          ? parsed.importance
          : null;
      return { tags, importance };
    } catch (e) {
      console.error("autotag err:", e);
      return { tags: [], importance: null };
    }
  };

  const rows = [];
  for (const s of signals) {
    let tags = s.suggested_tags || [];
    let importance = s.importance || "medium";
    if (tags.length === 0) {
      const r = await autoTag(s);
      tags = r.tags;
      if (r.importance) importance = r.importance as "high" | "medium" | "low";
    }
    const storyId = await attachStory(
      { title: s.title, content: s.content, domain: s.domain || null, tags },
      db,
      anthropic
    );
    rows.push({
      title: s.title,
      content: s.content,
      source_url: s.source_url,
      source_type: s.source_type || "news",
      domain: s.domain || null,
      importance,
      suggested_tags: tags,
      status: "inbox",
      story_id: storyId,
      submitted_at: s.submitted_at || new Date().toISOString(),
    });
  }

  const { data, error } = await db.from("atlas_signals").insert(rows).select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, inserted: data?.length || 0 });
}
