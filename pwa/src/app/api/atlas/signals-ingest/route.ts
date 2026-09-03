/**
 * POST /api/atlas/signals-ingest
 *
 * 外部 collector の raw signal を正本へ受け入れる専用口。
 * LLM によるタグ付け・story 紐付けはこの同期処理に含めない。背景 LLM が停止中でも
 * raw signal の保存 ACK は返すことで、outbox の無限再送を起こさない。
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;
export const runtime = "nodejs";

const SOURCE_TYPES = new Set(["news", "report", "data", "manual"]);
const IMPORTANCE = new Set(["high", "medium", "low"]);
const MAX_SIGNALS_PER_REQUEST = 200;

interface SignalInput {
  title?: unknown;
  content?: unknown;
  source_url?: unknown;
  source_type?: unknown;
  domain?: unknown;
  importance?: unknown;
}

type RawSignal = {
  title: string;
  content: string;
  source_url: string;
  source_type: "news" | "report" | "data" | "manual";
  domain: string | null;
  importance: "high" | "medium" | "low";
};

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function normalizeSignal(input: SignalInput): RawSignal | null {
  const title = text(input.title, 500);
  const content = text(input.content, 12_000);
  const sourceUrl = text(input.source_url, 2_000);
  if (!title || !content || !sourceUrl) return null;
  try {
    const url = new URL(sourceUrl);
    if (!["http:", "https:"].includes(url.protocol)) return null;
  } catch {
    return null;
  }
  const sourceType = input.source_type === undefined ? "news" : text(input.source_type, 32);
  const importance = input.importance === undefined ? "medium" : text(input.importance, 32);
  const hasDomain = input.domain !== undefined && input.domain !== null && input.domain !== "";
  const domain = hasDomain ? text(input.domain, 160) : null;
  if (!sourceType || !SOURCE_TYPES.has(sourceType) || !importance || !IMPORTANCE.has(importance) || (hasDomain && !domain)) {
    return null;
  }
  return {
    title,
    content,
    source_url: sourceUrl,
    source_type: sourceType as RawSignal["source_type"],
    domain,
    importance: importance as RawSignal["importance"],
  };
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.ATLAS_INGEST_SECRET || process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { signals?: SignalInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const incoming = Array.isArray(body?.signals) ? body.signals : [];
  if (incoming.length === 0 || incoming.length > MAX_SIGNALS_PER_REQUEST) {
    return NextResponse.json({ ok: false, error: "signals_array_required" }, { status: 400 });
  }
  const normalized = incoming.map(normalizeSignal);
  if (normalized.some((signal) => signal === null)) {
    return NextResponse.json({ ok: false, error: "invalid_signal_schema" }, { status: 400 });
  }
  const candidates = normalized as RawSignal[];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }
  const db = createClient(url, key);
  const incomingTitles = Array.from(new Set(candidates.map((signal) => signal.title)));
  const incomingUrls = Array.from(new Set(candidates.map((signal) => signal.source_url)));
  const [titlesResult, urlsResult] = await Promise.all([
    db.from("atlas_signals").select("title").in("title", incomingTitles).limit(MAX_SIGNALS_PER_REQUEST),
    db.from("atlas_signals").select("source_url").in("source_url", incomingUrls).limit(MAX_SIGNALS_PER_REQUEST),
  ]);
  if (titlesResult.error || urlsResult.error) {
    return NextResponse.json({ ok: false, error: "dedupe_lookup_failed" }, { status: 500 });
  }
  const knownTitles = new Set((titlesResult.data ?? []).map((row) => String(row.title || "")).filter(Boolean));
  const knownUrls = new Set((urlsResult.data ?? []).map((row) => String(row.source_url || "")).filter(Boolean));
  const rows: Array<Record<string, unknown>> = [];
  let skipped = 0;
  const submittedAt = new Date().toISOString();
  for (const signal of candidates) {
    if (knownTitles.has(signal.title) || knownUrls.has(signal.source_url)) {
      skipped += 1;
      continue;
    }
    // 同一payload内の重複もここで止める。
    knownTitles.add(signal.title);
    knownUrls.add(signal.source_url);
    rows.push({
      ...signal,
      suggested_tags: [],
      story_id: null,
      status: "inbox",
      submitted_at: submittedAt,
    });
  }
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, accepted: 0, inserted: 0, skipped, enrichment: "deferred" });
  }
  const { data, error } = await db.from("atlas_signals").insert(rows).select("id");
  if (error) {
    return NextResponse.json({ ok: false, error: "raw_signal_insert_failed" }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    accepted: data?.length ?? 0,
    inserted: data?.length ?? 0,
    skipped,
    enrichment: "deferred",
    source: "routine",
  });
}
