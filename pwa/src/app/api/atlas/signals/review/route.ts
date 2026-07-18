import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/api-auth";

const REVIEW_STATUSES = new Set(["accepted", "held", "rejected"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function optionalUUID(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !UUID.test(value)) return undefined;
  return value;
}

function invalid(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

/**
 * Inboxの採否を書き込む共有RLS境界。
 * PWAの単件/全件AcceptとMacの同じ操作を、直接PostgREST更新にせずここへ集約する。
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

  const status = body.status;
  if (typeof status !== "string" || !REVIEW_STATUSES.has(status)) return invalid("invalid_status");
  const allInbox = body.allInbox === true;
  const signalId = optionalUUID(body.signalId);
  const targetNodeId = optionalUUID(body.targetNodeId);
  if (Object.hasOwn(body, "signalId") && signalId === undefined) return invalid("invalid_signal_id");
  if (Object.hasOwn(body, "targetNodeId") && targetNodeId === undefined) return invalid("invalid_target_node_id");
  if (allInbox && (status !== "accepted" || signalId || targetNodeId)) return invalid("invalid_bulk_review");
  if (!allInbox && !signalId) return invalid("signal_id_required");

  const reviewedAt = new Date().toISOString();
  if (allInbox) {
    const { data, error } = await auth.supabase
      .from("atlas_signals")
      .update({ status, reviewed_at: reviewedAt })
      .eq("status", "inbox")
      .select("id");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: data?.length || 0 });
  }

  const { data, error } = await auth.supabase
    .from("atlas_signals")
    .update({ status, target_node_id: targetNodeId ?? null, reviewed_at: reviewedAt })
    .eq("id", signalId)
    .select("id");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: data?.length || 0 });
}
