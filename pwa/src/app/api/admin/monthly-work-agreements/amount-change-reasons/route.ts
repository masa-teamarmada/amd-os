import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import {
  buildMonthlyWorkAgreementBundle,
  currentYmJst,
  isMissingMonthlyAgreementAmountChangeReasonTableError,
  resolveMemberForEmail,
} from "@/lib/monthly-work-agreement";
import type { MonthlyAgreementAmountChangeReason } from "@/lib/monthly-work-agreement-types";

const REASON_MIN_LENGTH = 8;

function validYm(value: string | null): string {
  const ym = value || currentYmJst();
  if (!/^\d{6}$/.test(ym)) throw new Error("ym must be YYYYMM");
  return ym;
}

function toAmountChangeReason(row: Record<string, unknown>): MonthlyAgreementAmountChangeReason {
  return {
    id: String(row.id ?? ""),
    ym: String(row.ym ?? ""),
    memberId: String(row.member_id ?? ""),
    projectId: String(row.project_id ?? ""),
    agreementSnapshotHash: String(row.agreement_snapshot_hash ?? ""),
    reason: String(row.reason ?? ""),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedBy: typeof row.updated_by === "string" ? row.updated_by : null,
    updatedAt: String(row.updated_at ?? ""),
  };
}

/** 一覧取得。admin専用。ym必須、memberId/projectIdは任意の絞り込み。 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const url = new URL(req.url);
  let ym: string;
  try {
    ym = validYm(url.searchParams.get("ym"));
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "invalid ym" }, { status: 400 });
  }
  const memberId = url.searchParams.get("memberId");
  const projectId = url.searchParams.get("projectId");

  try {
    const admin = createAdminClient();
    let query = admin
      .from("member_monthly_work_agreement_amount_change_reasons")
      .select("id, ym, member_id, project_id, agreement_snapshot_hash, reason, created_by, created_at, updated_by, updated_at")
      .eq("ym", ym)
      .order("updated_at", { ascending: false });
    if (memberId) query = query.eq("member_id", memberId);
    if (projectId) query = query.eq("project_id", projectId);

    const { data, error } = await query;
    if (error) {
      if (isMissingMonthlyAgreementAmountChangeReasonTableError(error)) {
        return NextResponse.json({ ok: true, data: [] });
      }
      throw error;
    }
    const rows = ((data ?? []) as Array<Record<string, unknown>>).map(toAmountChangeReason);
    return NextResponse.json({ ok: true, data: rows });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/**
 * 想定報酬額の変更理由を1PJ分登録/更新する。admin専用。
 * 対象の現在snapshot hashをキーにするため、金額が変わればhashが変わり自動的に新しい理由が要求される。
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: { ym?: unknown; memberId?: unknown; projectId?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  let ym: string;
  try {
    ym = validYm(typeof body.ym === "string" ? body.ym : null);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "invalid ym" }, { status: 400 });
  }

  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const reasonRaw = typeof body.reason === "string" ? body.reason : "";
  const reason = reasonRaw.trim();

  if (!memberId) return NextResponse.json({ ok: false, error: "memberId is required" }, { status: 400 });
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId is required" }, { status: 400 });
  if (reason.length < REASON_MIN_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `reason must be at least ${REASON_MIN_LENGTH} characters after trimming` },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();

    const editor = await resolveMemberForEmail(admin, auth.user.email);
    if (!editor) {
      return NextResponse.json({ ok: false, error: "admin editor member not found" }, { status: 403 });
    }

    const { data: targetMember, error: targetMemberError } = await admin
      .from("members")
      .select("member_id")
      .eq("member_id", memberId)
      .maybeSingle();
    if (targetMemberError) throw targetMemberError;
    if (!targetMember) {
      return NextResponse.json({ ok: false, error: `member not found: ${memberId}` }, { status: 404 });
    }

    // 現在のsnapshotを再構築し、対象PJが本当にこのメンバー・この月の合意対象かを検証すると同時に
    // 理由の紐付け先となる現在snapshot hashを取得する（想像や古い値を信用しない）。
    const bundle = await buildMonthlyWorkAgreementBundle(admin, { ym, memberId });
    if (!bundle.amountChangeReasonRequiredProjectIds.includes(projectId)) {
      return NextResponse.json(
        { ok: false, error: "このPJは現在の合意内容で予定額変更の理由入力対象ではありません" },
        { status: 400 },
      );
    }

    const agreementSnapshotHash = bundle.currentHash;

    const { data: existing, error: existingError } = await admin
      .from("member_monthly_work_agreement_amount_change_reasons")
      .select("id")
      .eq("ym", ym)
      .eq("member_id", memberId)
      .eq("project_id", projectId)
      .eq("agreement_snapshot_hash", agreementSnapshotHash)
      .maybeSingle();
    if (existingError) throw existingError;

    let savedRow: Record<string, unknown> | null;
    if (existing) {
      const { data, error } = await admin
        .from("member_monthly_work_agreement_amount_change_reasons")
        .update({ reason, updated_by: editor.memberId })
        .eq("id", existing.id)
        .select("id, ym, member_id, project_id, agreement_snapshot_hash, reason, created_by, created_at, updated_by, updated_at")
        .single();
      if (error) throw error;
      savedRow = data as Record<string, unknown>;
    } else {
      const { data, error } = await admin
        .from("member_monthly_work_agreement_amount_change_reasons")
        .insert({
          ym,
          member_id: memberId,
          project_id: projectId,
          agreement_snapshot_hash: agreementSnapshotHash,
          reason,
          created_by: editor.memberId,
          updated_by: editor.memberId,
        })
        .select("id, ym, member_id, project_id, agreement_snapshot_hash, reason, created_by, created_at, updated_by, updated_at")
        .single();
      if (error) throw error;
      savedRow = data as Record<string, unknown>;
    }

    return NextResponse.json({ ok: true, data: toAmountChangeReason(savedRow!) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
