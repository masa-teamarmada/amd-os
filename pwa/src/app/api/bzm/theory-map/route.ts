import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireMember } from "@/lib/supabase/api-auth";
import {
  createEdge,
  createMemo,
  createNodeWithOptionalEdge,
  deleteEdge,
  loadTheoryMap,
  updateNode,
  type CreateEdgeInput,
  type CreateMemoInput,
  type CreateNodeInput,
  type UpdateNodeInput,
} from "@/lib/bzm-theory-store";

export const runtime = "nodejs";

type PostBody =
  | ({ action: "create_node" } & CreateNodeInput)
  | ({ action: "create_edge" } & CreateEdgeInput)
  | ({ action: "create_memo" } & CreateMemoInput);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const result = await loadTheoryMap(auth.supabase);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエストの形式が不正です。" }, { status: 400 });
  }
  if (!isRecord(rawBody)) {
    return NextResponse.json({ ok: false, error: "リクエストの形式が不正です。" }, { status: 400 });
  }
  const body = rawBody as unknown as PostBody;

  const db = createAdminClient();

  if (body.action === "create_node") {
    const result = await createNodeWithOptionalEdge(db, body, auth.user.email);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, node: result.data.node, edge: result.data.edge });
  }

  if (body.action === "create_edge") {
    const result = await createEdge(db, body, auth.user.email);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, edge: result.data });
  }

  if (body.action === "create_memo") {
    const result = await createMemo(db, body, auth.user.email);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, memo: result.data });
  }

  return NextResponse.json({ ok: false, error: "action の値が不正です。" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエストの形式が不正です。" }, { status: 400 });
  }
  if (!isRecord(rawBody)) {
    return NextResponse.json({ ok: false, error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const db = createAdminClient();
  const result = await updateNode(db, rawBody as unknown as UpdateNodeInput, auth.user.email);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, node: result.data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const edgeId = req.nextUrl.searchParams.get("edgeId") ?? "";
  const db = createAdminClient();
  const result = await deleteEdge(db, edgeId);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, edgeId: result.data.id });
}
