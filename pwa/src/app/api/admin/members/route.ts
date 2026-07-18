/**
 * PATCH /api/admin/members
 *
 * Admin member ledger cell edits go through service_role.
 * Browser-side updates can be blocked by RLS without changing a row, which makes
 * payout notice regeneration read stale member address / invoice data.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

const PATCHABLE_FIELDS = new Set([
  "code_name",
  "member_name",
  "email",
  "role",
  "status",
  "os_access_scope",
  "join_ym",
  "leave_ym",
  "is_admin",
  "is_officer",
  "exclude_from_payout_notice",
  "slack_id",
  "contractor_name",
  "member_address",
  "invoice_registration_number",
]);

const REQUIRED_TEXT_FIELDS = new Set(["code_name", "email"]);
const OPTIONAL_TEXT_FIELDS = new Set([
  "member_name",
  "role",
  "join_ym",
  "leave_ym",
  "slack_id",
  "contractor_name",
  "member_address",
]);
const BOOLEAN_FIELDS = new Set(["is_admin", "is_officer", "exclude_from_payout_notice"]);
const STATUS_VALUES = new Set(["active", "inactive", "left"]);
const ACCESS_SCOPE_VALUES = new Set(["portfolio", "project"]);

type PatchBody = {
  id?: unknown;
  patch?: unknown;
};

type CreateBody = {
  codeName?: unknown;
  memberName?: unknown;
  email?: unknown;
};

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: CreateBody;
  try {
    body = await req.json() as CreateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const codeName = stringValue(body.codeName);
  const memberName = stringValue(body.memberName);
  const email = stringValue(body.email)?.toLowerCase() || null;
  if (!codeName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "codeName and valid email are required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: existing } = await db.from("members").select("member_id").ilike("email", email).maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: false, error: "このメールアドレスは登録済みだよ" }, { status: 409 });
  }

  const { data: memberIds, error: idError } = await db.from("members").select("member_id").like("member_id", "ID%").limit(2000);
  if (idError) return NextResponse.json({ ok: false, error: idError.message }, { status: 500 });
  const nextNumber = Math.max(0, ...(memberIds ?? []).map((row) => Number(String(row.member_id).match(/^ID(\d+)$/)?.[1] || 0))) + 1;
  const memberId = `ID${String(nextNumber).padStart(3, "0")}`;
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("members")
    .insert({
      member_id: memberId,
      code_name: codeName,
      member_name: memberName,
      contractor_name: memberName || codeName,
      email,
      role: "project_member",
      status: "active",
      os_access_scope: "project",
      exclude_from_payout_notice: true,
      google_calendar_status: "missing",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, member: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const id = stringValue(body.id);
  const rawPatch = asRecord(body.patch);
  if (!id || !rawPatch) {
    return NextResponse.json({ ok: false, error: "id and patch are required" }, { status: 400 });
  }

  let patch: Record<string, unknown>;
  try {
    patch = normalizeMemberPatch(rawPatch);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "invalid member patch" },
      { status: 400 }
    );
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("members")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: `members update: ${error.message}` }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "member not found or not updated" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, member: data });
}

function normalizeMemberPatch(rawPatch: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};

  for (const key of Object.keys(rawPatch)) {
    if (key === "updated_at") continue;
    if (!PATCHABLE_FIELDS.has(key)) {
      throw new Error(`unsupported member field: ${key}`);
    }
  }

  for (const key of REQUIRED_TEXT_FIELDS) {
    if (!hasOwn(rawPatch, key)) continue;
    const text = stringValue(rawPatch[key]);
    if (!text) throw new Error(`${key} is required`);
    patch[key] = key === "email" ? text.toLowerCase() : text;
  }

  for (const key of OPTIONAL_TEXT_FIELDS) {
    if (!hasOwn(rawPatch, key)) continue;
    patch[key] = stringValue(rawPatch[key]);
  }

  if (hasOwn(rawPatch, "invoice_registration_number")) {
    const text = stringValue(rawPatch.invoice_registration_number);
    patch.invoice_registration_number = text ? normalizeInvoiceRegistrationNumber(text) : null;
  }

  if (hasOwn(rawPatch, "status")) {
    const status = stringValue(rawPatch.status);
    if (!status || !STATUS_VALUES.has(status)) throw new Error("invalid status");
    patch.status = status;
  }

  if (hasOwn(rawPatch, "os_access_scope")) {
    const accessScope = stringValue(rawPatch.os_access_scope);
    if (!accessScope || !ACCESS_SCOPE_VALUES.has(accessScope)) throw new Error("invalid os_access_scope");
    patch.os_access_scope = accessScope;
  }

  for (const key of BOOLEAN_FIELDS) {
    if (!hasOwn(rawPatch, key)) continue;
    patch[key] = booleanValue(rawPatch[key]);
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("patch is empty");
  }
  return patch;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function stringValue(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function normalizeInvoiceRegistrationNumber(value: string) {
  return value
    .trim()
    .normalize("NFKC")
    .replace(/[\s-]/g, "")
    .replace(/^[Tt\u0422\u0442]/, "T")
    .toUpperCase();
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return Boolean(value);
}
