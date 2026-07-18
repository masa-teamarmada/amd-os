import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/api-auth";

const SOURCE_TYPES = new Set(["news", "report", "data", "manual", "policy"]);
const IMPORTANCE = new Set(["high", "medium", "low"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function requiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  return requiredText(value, maxLength) ?? undefined;
}

function cleanTags(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of value) {
    const tag = requiredText(item, 120);
    if (!tag) return null;
    if (!seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags.slice(0, 24);
}

function invalid(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

/**
 * 手動シグナル投入の共有RLS境界。自動収集用のsignals-ingest/seedとは混ぜない。
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid("invalid_json");
  }
  if (!isRecord(body)) return invalid("invalid_payload");

  const title = requiredText(body.title, 500);
  const content = requiredText(body.content, 12_000);
  const sourceUrl = requiredText(body.sourceUrl, 2_000);
  if (!title || !content || !sourceUrl) return invalid("title_content_source_url_required");
  let source: URL;
  try {
    source = new URL(sourceUrl);
  } catch {
    return invalid("invalid_source_url");
  }
  if (!["http:", "https:"].includes(source.protocol)) return invalid("invalid_source_url");

  const sourceType = body.sourceType ?? "news";
  if (typeof sourceType !== "string" || !SOURCE_TYPES.has(sourceType)) return invalid("invalid_source_type");
  const importance = body.importance ?? "medium";
  if (typeof importance !== "string" || !IMPORTANCE.has(importance)) return invalid("invalid_importance");
  const domain = optionalText(body.domain, 160);
  if (domain === undefined) return invalid("invalid_domain");
  const tags = cleanTags(body.suggestedTags ?? []);
  if (!tags) return invalid("invalid_suggested_tags");

  const { data, error } = await auth.supabase
    .from("atlas_signals")
    .insert({
      title,
      content,
      source_url: source.toString(),
      source_type: sourceType,
      domain,
      suggested_tags: tags,
      importance,
      status: "inbox",
    })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message || "signal_submit_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}
