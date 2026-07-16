import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_ACTIONS = new Set(["completed", "not_applicable", "reopened"]);

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }
  const occurrenceId = typeof body.occurrenceId === "string" ? body.occurrenceId.trim() : "";
  const action = typeof body.action === "string" ? body.action.trim() : "";
  const evidenceRef = typeof body.evidenceRef === "string" ? body.evidenceRef.trim().slice(0, 500) : null;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;
  if (!occurrenceId || !ALLOWED_ACTIONS.has(action)) return NextResponse.json({ error: "occurrenceId と許可された action が必要" }, { status: 400 });
  if (action !== "reopened" && !reason && !evidenceRef) return NextResponse.json({ error: "完了・対象外には根拠が必要" }, { status: 400 });

  const db = createAdminClient();
  const { data: occurrence, error: occurrenceError } = await db
    .from("company_schedule_occurrences")
    .select("occurrence_id,notification_owner,current_version")
    .eq("occurrence_id", occurrenceId)
    .eq("current_version", true)
    .maybeSingle();
  if (occurrenceError) return NextResponse.json({ error: occurrenceError.message }, { status: 500 });
  if (!occurrence) return NextResponse.json({ error: "対象の運営カレンダー項目が見つからない" }, { status: 404 });
  if (occurrence.notification_owner === "payment_obligation") {
    return NextResponse.json({ error: "支払義務の完了は既存の支払正本で更新して" }, { status: 409 });
  }
  const actorEmail = String(auth.user.email ?? "").trim().toLowerCase();
  if (!actorEmail) return NextResponse.json({ error: "admin email is required" }, { status: 403 });
  const { data: member, error: memberError } = await db
    .from("members")
    .select("member_id")
    .eq("email", actorEmail)
    .maybeSingle();
  if (memberError || !member?.member_id) return NextResponse.json({ error: memberError?.message ?? "admin member not found" }, { status: 403 });
  const { data, error } = await db
    .from("company_schedule_actions")
    .insert({ occurrence_id: occurrenceId, action, acted_by_member_id: member.member_id, evidence_ref: evidenceRef, reason })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ action: data }, { status: 201 });
}
