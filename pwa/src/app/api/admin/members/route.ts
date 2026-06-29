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

type PatchBody = {
  id?: unknown;
  patch?: unknown;
};

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
    patch.invoice_registration_number = text ? text.toUpperCase() : null;
  }

  if (hasOwn(rawPatch, "status")) {
    const status = stringValue(rawPatch.status);
    if (!status || !STATUS_VALUES.has(status)) throw new Error("invalid status");
    patch.status = status;
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

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return Boolean(value);
}
