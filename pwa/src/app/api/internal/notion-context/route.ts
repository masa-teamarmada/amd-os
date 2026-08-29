import { NextRequest, NextResponse } from "next/server";
import { fetchNotionContext } from "@/lib/sources/notion";

/**
 * 内部専用: Notion 検索の素通し読み取り。
 * NOTION_API_KEY は Vercel の sensitive env でローカルから読めないため、
 * えいみのローカルセッションや routine が議事録本文を裏取りする時に使う。
 * 認証は CRON_SECRET の Bearer 固定 (未設定なら常に 401)。読み取りのみで LLM は呼ばない。
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }
  const limit = Math.max(1, Math.min(20, Number(req.nextUrl.searchParams.get("limit") || 8)));
  try {
    const hits = await fetchNotionContext(q, limit);
    return NextResponse.json({ ok: true, query: q, count: hits.length, hits });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
