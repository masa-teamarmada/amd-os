/**
 * POST /api/media-mentions/extract
 *
 * D-11 の公開メディア候補を review-first で受け付ける入口。
 * Codex collector は公開URLと要約だけを渡し、ここで候補行と通知を作る。
 * 既存の掲載（承認済み・却下済みを含む）は再作成しない。
 */
import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const ALLOWED_KINDS = new Set(["coverage", "interview", "press_release", "award", "funding", "pitch", "own_news", "other"]);
const YMD = /^20\d{2}-\d{2}-\d{2}$/;

type Candidate = {
  project_id: string;
  occurred_on: string;
  title: string;
  media_name: string;
  kind?: string | null;
  source_url: string;
  summary?: string | null;
};

function oneLine(value: unknown, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function candidateSourceHash(candidate: Required<Candidate>): string {
  const material = [
    candidate.project_id,
    candidate.occurred_on,
    candidate.title,
    candidate.media_name,
    candidate.kind,
    candidate.source_url,
  ].join("\u001f");
  return createHash("sha256").update(material).digest("hex");
}

function deterministicMentionId(sourceHash: string): string {
  const chars = sourceHash.slice(0, 32).split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  return `${chars.slice(0, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}-${chars.slice(16, 20).join("")}-${chars.slice(20, 32).join("")}`;
}

function normalize(candidate: Candidate): Required<Candidate> | null {
  const projectId = oneLine(candidate.project_id, 120);
  const occurredOn = oneLine(candidate.occurred_on, 10);
  const title = oneLine(candidate.title, 300);
  const mediaName = oneLine(candidate.media_name, 160);
  const kind = oneLine(candidate.kind || "coverage", 40).toLowerCase();
  const sourceUrl = oneLine(candidate.source_url, 2000);
  const summary = oneLine(candidate.summary, 2000);
  if (!projectId || !YMD.test(occurredOn) || !title || !mediaName || !ALLOWED_KINDS.has(kind)) return null;
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  } catch {
    return null;
  }
  return { project_id: projectId, occurred_on: occurredOn, title, media_name: mediaName, kind, source_url: sourceUrl, summary };
}

async function authorize(req: NextRequest): Promise<boolean> {
  const authorization = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret && authorization === `Bearer ${cronSecret}`) return true;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  const { data: member } = await supabase
    .from("members")
    .select("is_admin")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  return !!member?.is_admin;
}

export async function POST(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const raw = Array.isArray(body?.mentions) ? body.mentions : [];
  if (raw.length === 0 || raw.length > 100) {
    return NextResponse.json({ ok: false, error: "mentions[] (1..100) required" }, { status: 400 });
  }

  const db = createAdminClient();
  const now = new Date().toISOString();
  let inserted = 0;
  let skipped = 0;
  let notified = 0;
  const errors: string[] = [];

  for (const value of raw) {
    const candidate = normalize((value || {}) as Candidate);
    if (!candidate) {
      skipped++;
      continue;
    }

    // URL は同一記事を最も安定して指す。承認・却下済みを含め、過去の判断を絶対に壊さない。
    const { data: existing, error: existingError } = await db
      .from("project_media_mentions")
      .select("id")
      .eq("project_id", candidate.project_id)
      .eq("source_url", candidate.source_url)
      .limit(1)
      .maybeSingle();
    if (existingError) {
      errors.push(`existing lookup failed: ${existingError.message}`);
      continue;
    }
    if (existing) {
      skipped++;
      continue;
    }

    const sourceHash = candidateSourceHash(candidate);
    const mentionId = deterministicMentionId(sourceHash);
    const { data: mention, error: insertError } = await db
      .from("project_media_mentions")
      .insert({
        id: mentionId,
        project_id: candidate.project_id,
        occurred_on: candidate.occurred_on,
        title: candidate.title,
        media_name: candidate.media_name,
        kind: candidate.kind,
        source_url: candidate.source_url,
        summary: candidate.summary || null,
        ingested_by: "codex-d11-media-extract",
        verified: false,
        dismissed: false,
        updated_at: now,
      })
      .select("id")
      .single();
    // source_hash 由来のUUIDをPKにするため、同一候補が並行runしても二重作成しない。
    if (insertError?.code === "23505") {
      skipped++;
      continue;
    }
    if (insertError || !mention) {
      errors.push(`candidate insert failed: ${insertError?.message || "unknown"}`);
      continue;
    }
    inserted++;

    const { error: notificationError } = await db.from("l2_notifications").insert({
      l2_kind: "news_mention",
      target_id: candidate.project_id,
      scope_key: `media:${mention.id}`,
      title: `メディア掲載候補: ${candidate.title.slice(0, 120)}`,
      summary: candidate.summary || `${candidate.media_name} / ${candidate.occurred_on}`,
      saved_count: 0,
      total_count: 1,
      importance: candidate.kind === "award" ? 7 : 5,
      notified_at: now,
      metadata_json: {
        source_url: candidate.source_url,
        occurred_on: candidate.occurred_on,
        media_name: candidate.media_name,
        kind: candidate.kind,
        source_hash: sourceHash,
      },
    });
    if (notificationError) {
      errors.push(`notification insert failed: ${notificationError.message}`);
    } else {
      notified++;
    }
  }

  return NextResponse.json({ ok: errors.length === 0, inserted, skipped, notified, errors });
}
