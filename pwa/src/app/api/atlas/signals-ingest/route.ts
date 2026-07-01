/**
 * POST /api/atlas/signals-ingest
 *
 * Routine (= Claude Code scheduled remote agent) から呼ばれる受け口。
 * Routine は web_search で signals を集め、JSON を POST → このルートで
 * auto-tag + attachStory + atlas_signals INSERT を実行する。
 *
 * 設計意図 (2026-05-13):
 * - 既存の /api/cron/atlas-collect は Anthropic API 直叩きで月 ~¥3,000-5,000
 * - これを Routine 化 (Claude subscription 枠で web_search) すると API 課金 ¥0
 * - ただし auto-tag (Haiku) + attachStory (LLM) は引き続き Anthropic API で実施
 *   (= 削減率は ~70%)
 *
 * 認証: Authorization: Bearer ${ATLAS_INGEST_SECRET}
 *   (CRON_SECRET と別にしておく — Routine の漏洩で cron 全部が叩かれるリスク回避)
 *
 * Body:
 *   {
 *     signals: Array<{
 *       title: string;
 *       content: string;
 *       source_url: string;
 *       source_type?: "news" | "report" | "data" | "manual";
 *       domain?: string;
 *       importance?: "high" | "medium" | "low";
 *     }>
 *   }
 *
 * レスポンス:
 *   { ok: true, inserted: N, skipped: M }
 */

import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBackgroundAnthropic, BackgroundAnthropicDisabledError } from "@/lib/anthropic-client";
import { createClient } from "@supabase/supabase-js";
import { attachStory } from "@/lib/atlas-stories-server";

export const maxDuration = 300;
export const runtime = "nodejs";

interface SignalInput {
  title?: unknown;
  content?: unknown;
  source_url?: unknown;
  source_type?: unknown;
  domain?: unknown;
  importance?: unknown;
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.ATLAS_INGEST_SECRET || process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const db = createClient(url, key);
  let anthropic: Anthropic;
  try {
    anthropic = getBackgroundAnthropic("atlas/signals-ingest");
  } catch (e) {
    if (e instanceof BackgroundAnthropicDisabledError) {
      return NextResponse.json({ ok: true, disabled: true, reason: "background anthropic disabled" });
    }
    throw e;
  }

  let body: { signals?: SignalInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const incoming = Array.isArray(body?.signals) ? body.signals : [];
  if (incoming.length === 0) {
    return NextResponse.json({ ok: false, error: "signals array required" }, { status: 400 });
  }

  // 重複チェック:
  // - 直近48hは broad に見る
  // - outbox staging の遅延反映でも重複しないよう、入力 title / source_url は全期間で exact match も見る
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await db
    .from("atlas_signals")
    .select("title, source_url")
    .gte("submitted_at", since)
    .limit(300);
  const recentTitles = new Set<string>();
  const recentUrls = new Set<string>();
  for (const r of recent ?? []) {
    if (r.title) recentTitles.add(String(r.title));
    if (r.source_url) recentUrls.add(String(r.source_url));
  }
  const incomingTitles = Array.from(
    new Set(incoming.map((s) => asStr(s.title)).filter(Boolean))
  ).slice(0, 200);
  const incomingUrls = Array.from(
    new Set(incoming.map((s) => asStr(s.source_url)).filter(Boolean))
  ).slice(0, 200);
  if (incomingTitles.length > 0) {
    const { data: existingTitles } = await db
      .from("atlas_signals")
      .select("title")
      .in("title", incomingTitles)
      .limit(300);
    for (const r of existingTitles ?? []) {
      if (r.title) recentTitles.add(String(r.title));
    }
  }
  if (incomingUrls.length > 0) {
    const { data: existingUrls } = await db
      .from("atlas_signals")
      .select("source_url")
      .in("source_url", incomingUrls)
      .limit(300);
    for (const r of existingUrls ?? []) {
      if (r.source_url) recentUrls.add(String(r.source_url));
    }
  }

  // 入力 normalize + 重複除外
  type Draft = {
    title: string;
    content: string;
    source_url: string;
    source_type: "news" | "report" | "data" | "manual";
    domain: string | null;
    importance: "high" | "medium" | "low";
  };
  const drafts: Draft[] = [];
  let skipped = 0;
  for (const s of incoming) {
    const title = asStr(s.title);
    const content = asStr(s.content);
    const source_url = asStr(s.source_url);
    if (!title || !content || !source_url) { skipped++; continue; }
    if (recentTitles.has(title) || recentUrls.has(source_url)) { skipped++; continue; }
    const stRaw = asStr(s.source_type) as Draft["source_type"];
    const source_type = (["news","report","data","manual"] as const).includes(stRaw) ? stRaw : "news";
    const impRaw = asStr(s.importance) as Draft["importance"];
    const importance = (["high","medium","low"] as const).includes(impRaw) ? impRaw : "medium";
    drafts.push({
      title,
      content,
      source_url,
      source_type,
      domain: asStr(s.domain) || null,
      importance,
    });
  }
  if (drafts.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, skipped });
  }

  // 各 signal → auto-tag (Haiku) + attachStory (LLM)
  // 既存 /api/cron/atlas-collect と同じ helper を流用
  const autoTag = async (d: Draft): Promise<string[]> => {
    const tagPrompt = `あなたはマクロトレンド分析のタグ付けエディタです。
以下のシグナルから、後で横串検索するためのタグを 6〜12 個提案してください。

タイトル: ${d.title}
内容: ${d.content}
分野: ${d.domain ?? "—"}

タグ方針:
- 素材 / 技術 / 地域 / 産業 / 規制 / 市場 / 社会課題などの「一般名詞」
- 特定企業名や PJ 名は使わない
- 単語または 2-3 語の短いフレーズ
- 数年後に同じタグで検索しても意味のある粒度

JSON のみ返答。例: {"tags": ["リチウム", "中国", "輸出規制"]}`;
    try {
      const r = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 384,
        messages: [{ role: "user", content: tagPrompt }],
      });
      const block = r.content[0];
      const text = block?.type === "text" ? block.text : "";
      const j = text.match(/\{[\s\S]*\}/);
      if (!j) return [];
      const obj = JSON.parse(j[0]);
      return Array.isArray(obj.tags)
        ? obj.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 16)
        : [];
    } catch (e) {
      console.error("[atlas/signals-ingest] autotag err:", e);
      return [];
    }
  };

  const rows: Array<Record<string, unknown>> = [];
  for (const d of drafts) {
    const tags = await autoTag(d);
    const storyId = await attachStory(
      { title: d.title, content: d.content, domain: d.domain, tags },
      db,
      anthropic
    );
    rows.push({
      title: d.title,
      content: d.content,
      source_url: d.source_url,
      source_type: d.source_type,
      domain: d.domain,
      importance: d.importance,
      suggested_tags: tags,
      status: "inbox",
      story_id: storyId,
      submitted_at: new Date().toISOString(),
    });
  }

  const { data, error } = await db.from("atlas_signals").insert(rows).select("id");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    inserted: data?.length ?? 0,
    skipped,
    source: "routine",
  });
}
