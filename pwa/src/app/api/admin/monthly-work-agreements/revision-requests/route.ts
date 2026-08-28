/**
 * 月初合意の修正要望を管理者が読む / 対応済みにする API。
 *
 * メンバーが出した修正要望は `open` のあいだ支払ゲートの blocker になる
 * (`monthly-work-agreement-payout-gate.ts` の `revision_requested`)。
 * 2026-08-28 まで open を閉じる経路が存在せず、要望が1件でも残ると
 * その稼働月の支払通知書を誰も発行できない詰みが起きていたので追加した。
 *
 *   GET   ?ym=YYYYMM[&memberId=&status=]  要望を読む
 *   PATCH { requestId, status, note }     open → resolved / rejected、または open へ戻す
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import {
  currentYmJst,
  isMissingMonthlyAgreementRequestTableError,
  resolveMemberForEmail,
} from "@/lib/monthly-work-agreement";
import type { MonthlyWorkAgreementRevisionRequest } from "@/lib/monthly-work-agreement-types";

const REQUEST_SELECT =
  "id, ym, member_id, project_id, request_type, body, status, snapshot_hash, created_at, resolved_at, resolved_by, resolution_note";

const ALLOWED_STATUS = new Set(["open", "resolved", "rejected"]);

function validYm(value: string | null): string {
  const ym = value || currentYmJst();
  if (!/^\d{6}$/.test(ym)) throw new Error("ym must be YYYYMM");
  return ym;
}

function toRevisionRequest(row: Record<string, unknown>): MonthlyWorkAgreementRevisionRequest {
  return {
    id: String(row.id ?? ""),
    ym: String(row.ym ?? ""),
    memberId: String(row.member_id ?? ""),
    projectId: typeof row.project_id === "string" ? row.project_id : null,
    requestType: String(row.request_type ?? "other"),
    body: String(row.body ?? ""),
    status: String(row.status ?? "open"),
    snapshotHash: typeof row.snapshot_hash === "string" ? row.snapshot_hash : null,
    createdAt: String(row.created_at ?? ""),
    resolvedAt: typeof row.resolved_at === "string" ? row.resolved_at : null,
    resolvedBy: typeof row.resolved_by === "string" ? row.resolved_by : null,
    resolutionNote: typeof row.resolution_note === "string" ? row.resolution_note : null,
  };
}

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
  const status = url.searchParams.get("status");

  try {
    const admin = createAdminClient();
    let query = admin
      .from("member_monthly_work_agreement_requests")
      .select(REQUEST_SELECT)
      .eq("ym", ym)
      .order("created_at", { ascending: false });
    if (memberId) query = query.eq("member_id", memberId);
    if (status && ALLOWED_STATUS.has(status)) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      if (isMissingMonthlyAgreementRequestTableError(error)) return NextResponse.json({ ok: true, data: [] });
      throw error;
    }
    return NextResponse.json({
      ok: true,
      data: ((data ?? []) as Array<Record<string, unknown>>).map(toRevisionRequest),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/**
 * 要望のステータスを動かす。金額や合意そのものには触れない。
 * 対応済みにしても snapshot は変わらないので、条件を実際に直したいときは
 * PJ側の金額・役割を直してから対応済みにする (hash が変わりメンバーへ再合意が出る)。
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: { requestId?: unknown; status?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!requestId) return NextResponse.json({ ok: false, error: "requestId is required" }, { status: 400 });
  if (!ALLOWED_STATUS.has(status)) {
    return NextResponse.json(
      { ok: false, error: "status must be one of: open / resolved / rejected" },
      { status: 400 },
    );
  }
  if (note.length > 2000) {
    return NextResponse.json({ ok: false, error: "対応メモは2000文字以内で入力してください" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const editor = await resolveMemberForEmail(admin, auth.user.email);
    if (!editor) return NextResponse.json({ ok: false, error: "admin editor member not found" }, { status: 403 });

    const patch =
      status === "open"
        ? { status, resolved_at: null, resolved_by: null, resolution_note: note || null, updated_at: new Date().toISOString() }
        : {
            status,
            resolved_at: new Date().toISOString(),
            resolved_by: editor.memberId,
            resolution_note: note || null,
            updated_at: new Date().toISOString(),
          };

    const { data, error } = await admin
      .from("member_monthly_work_agreement_requests")
      .update(patch)
      .eq("id", requestId)
      .select(REQUEST_SELECT)
      .maybeSingle();
    if (error) {
      if (isMissingMonthlyAgreementRequestTableError(error)) {
        return NextResponse.json({ ok: false, error: "修正要望テーブルが未適用です" }, { status: 503 });
      }
      throw error;
    }
    if (!data) return NextResponse.json({ ok: false, error: `request not found: ${requestId}` }, { status: 404 });

    return NextResponse.json({ ok: true, data: toRevisionRequest(data as Record<string, unknown>) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
