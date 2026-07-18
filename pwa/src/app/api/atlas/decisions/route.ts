import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/api-auth";

const ACTIONS = new Set(["起業", "スタジオ", "支援", "スルー", "保留"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function optionalDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

function invalid(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

/**
 * Atlas判断ログの共有書込み境界。
 *
 * PWAとNativeはどちらもこのrequireAuth済みのRLS clientだけを通す。
 * service_roleではなく本人のRLSを使うため、ブラウザ直書きと同じ権限を広げない。
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

  const action = body.action;
  if (typeof action !== "string" || !ACTIONS.has(action)) return invalid("invalid_action");

  const topicId = optionalText(body.topicId, 64);
  if (topicId !== undefined && topicId !== null && !UUID.test(topicId)) return invalid("invalid_topic_id");
  const rationale = optionalText(body.rationale, 12_000);
  if (Object.hasOwn(body, "rationale") && rationale === undefined) return invalid("invalid_rationale");
  const decidedAt = optionalDate(body.decidedAt);
  if (Object.hasOwn(body, "decidedAt") && decidedAt === undefined) return invalid("invalid_decided_at");
  const outcomeEvalAt = optionalDate(body.outcomeEvalAt);
  if (Object.hasOwn(body, "outcomeEvalAt") && outcomeEvalAt === undefined) return invalid("invalid_outcome_eval_at");

  const { data, error } = await auth.supabase
    .from("atlas_decisions")
    .insert({
      topic_id: topicId ?? null,
      action,
      rationale: rationale ?? null,
      decided_at: decidedAt ?? new Date().toISOString(),
      outcome_eval_at: outcomeEvalAt ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message || "decision_create_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid("invalid_json");
  }
  if (!isRecord(body)) return invalid("invalid_payload");

  const id = optionalText(body.id, 64);
  if (!id || !UUID.test(id)) return invalid("invalid_id");

  const update: Record<string, string | null> = {};
  if (Object.hasOwn(body, "action")) {
    if (typeof body.action !== "string" || !ACTIONS.has(body.action)) return invalid("invalid_action");
    update.action = body.action;
  }
  if (Object.hasOwn(body, "rationale")) {
    const rationale = optionalText(body.rationale, 12_000);
    if (rationale === undefined) return invalid("invalid_rationale");
    update.rationale = rationale;
  }
  if (Object.hasOwn(body, "outcomeEvalAt")) {
    const outcomeEvalAt = optionalDate(body.outcomeEvalAt);
    if (outcomeEvalAt === undefined) return invalid("invalid_outcome_eval_at");
    update.outcome_eval_at = outcomeEvalAt;
  }
  if (Object.hasOwn(body, "outcome")) {
    const outcome = optionalText(body.outcome, 12_000);
    if (outcome === undefined) return invalid("invalid_outcome");
    update.outcome = outcome;
  }
  if (Object.keys(update).length === 0) return invalid("empty_patch");

  const { error } = await auth.supabase
    .from("atlas_decisions")
    .update(update)
    .eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
