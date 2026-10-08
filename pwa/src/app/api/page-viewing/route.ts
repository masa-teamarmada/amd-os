import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePageViewingInput } from "@/lib/page-viewing-core";
import { readPageViewingSnapshot, resolvePageViewingContext } from "@/lib/page-viewing-server";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const input = parsePageViewingInput({ pathname: request.nextUrl.searchParams.get("pathname"), pageLabel: request.nextUrl.searchParams.get("pageLabel") ?? "" });
  if (!input) return reply({ error: "Invalid page" }, 400);
  try {
    const context = await resolvePageViewingContext(input);
    if (!context) return reply({ error: "Not found" }, 404);
    return reply(await readPageViewingSnapshot(context, request.nextUrl.searchParams.get("history") === "1"));
  } catch {
    return reply({ error: "閲覧情報を取得できなかったよ" }, 503);
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return reply({ error: "Forbidden" }, 403);
  if (Number(request.headers.get("content-length") || 0) > 2048) return reply({ error: "Invalid request" }, 400);
  let body;
  try { const text = await request.text(); if (text.length > 2048) return reply({ error: "Invalid request" }, 400); body = JSON.parse(text); } catch { return reply({ error: "Invalid request" }, 400); }
  const input = parsePageViewingInput(body);
  if (!input || !UUID.test(body.sessionId ?? "") || !UUID.test(body.visitId ?? "") || !Number.isSafeInteger(body.revision) || body.revision < 1 || typeof body.active !== "boolean") return reply({ error: "Invalid request" }, 400);
  try {
    const context = await resolvePageViewingContext(input);
    if (!context) return reply({ error: "Not found" }, 404);
    const { error } = await createAdminClient().rpc("amie_update_page_viewer", {
      p_session_id: body.sessionId, p_visit_id: body.visitId, p_revision: body.revision,
      p_actor_key: context.actorKey, p_actor_label: context.actorLabel, p_resource_key: context.resourceKey,
      p_page_title: context.title, p_active: body.active,
    });
    if (error) return reply({ error: "閲覧情報を更新できなかったよ" }, 503);
    if (!body.active) return reply({ ok: true });
    return reply(await readPageViewingSnapshot(context, body.history === true));
  } catch {
    return reply({ error: "閲覧情報を更新できなかったよ" }, 503);
  }
}
