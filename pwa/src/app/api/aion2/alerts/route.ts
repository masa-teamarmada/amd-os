import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const TABLE = "aion2_verification_alerts";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const actual = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function readStatus(id: string) {
  const { data, error } = await createAdminClient().from(TABLE)
    .select("status,deadline_at,acknowledged_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return json({ ok: false }, 401);
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!UUID.test(id)) return json({ ok: false }, 400);
  try {
    const state = await readStatus(id);
    return state ? json({ ok: true, ...state }) : json({ ok: false }, 404);
  } catch (error) {
    console.error("[aion2-alert-status]", error);
    return json({ ok: false }, 503);
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return json({ ok: false }, 401);
  if (Number(req.headers.get("content-length") || 0) > 2048) return json({ ok: false }, 413);
  let body: { action?: string; id?: string; channel?: string; ts?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false }, 400);
  }
  const id = String(body.id || "");
  if (!UUID.test(id)) return json({ ok: false }, 400);
  const db = createAdminClient();
  try {
    if (body.action === "create") {
      const { error } = await db.from(TABLE).insert({ id, status: "pending" });
      if (error) throw error;
      return json({ ok: true, status: "pending" });
    }
    if (body.action === "activate") {
      const channel = String(body.channel || "");
      const ts = String(body.ts || "");
      if (!/^D[A-Z0-9]{8,}$/.test(channel) || !/^\d+\.\d+$/.test(ts)) return json({ ok: false }, 400);
      const deadline = new Date(Date.now() + 30_000).toISOString();
      const { error } = await db.from(TABLE).update({
        slack_channel_id: channel,
        slack_message_ts: ts,
        deadline_at: deadline,
      }).eq("id", id).eq("status", "pending");
      if (error) throw error;
      const state = await readStatus(id);
      return state ? json({ ok: true, ...state }) : json({ ok: false }, 404);
    }
    if (body.action === "expire") {
      const now = new Date().toISOString();
      const { error } = await db.from(TABLE).update({ status: "expired", finalized_at: now })
        .eq("id", id).eq("status", "pending").lte("deadline_at", now);
      if (error) throw error;
      const state = await readStatus(id);
      return state ? json({ ok: true, ...state, terminate: state.status === "expired" }) : json({ ok: false }, 404);
    }
    if (body.action === "cancel") {
      const { error } = await db.from(TABLE).update({ status: "cancelled", finalized_at: new Date().toISOString() })
        .eq("id", id).eq("status", "pending");
      if (error) throw error;
      const state = await readStatus(id);
      return state ? json({ ok: true, ...state }) : json({ ok: false }, 404);
    }
    return json({ ok: false }, 400);
  } catch (error) {
    console.error("[aion2-alert-mutation]", error);
    return json({ ok: false }, 503);
  }
}
