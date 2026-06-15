import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/api-auth";
import {
  buildMonthlyWorkAgreementBundle,
  currentYmJst,
  isMissingMonthlyAgreementRequestTableError,
  resolveMemberForEmail,
} from "@/lib/monthly-work-agreement";

function validYm(value: unknown): string {
  const ym = typeof value === "string" && value ? value : currentYmJst();
  if (!/^\d{6}$/.test(ym)) throw new Error("ym must be YYYYMM");
  return ym;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  const body = (await req.json().catch(() => ({}))) as {
    ym?: unknown;
    memberId?: unknown;
    projectId?: unknown;
    requestType?: unknown;
    body?: unknown;
  };

  let ym: string;
  try {
    ym = validYm(body.ym);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "invalid ym" }, { status: 400 });
  }

  const requestBody = typeof body.body === "string" ? body.body.trim() : "";
  if (requestBody.length < 4) {
    return NextResponse.json({ ok: false, error: "修正要望を4文字以上で入力してください" }, { status: 400 });
  }
  if (requestBody.length > 4000) {
    return NextResponse.json({ ok: false, error: "修正要望は4000文字以内で入力してください" }, { status: 400 });
  }

  const admin = createAdminClient();
  const actor = await resolveMemberForEmail(admin, auth.user.email);
  if (!actor) return NextResponse.json({ ok: false, error: "member not found" }, { status: 404 });

  const memberId = typeof body.memberId === "string" && body.memberId.trim() ? body.memberId.trim() : actor.memberId;
  if (memberId !== actor.memberId) {
    return NextResponse.json({ ok: false, error: "本人以外の修正要望は保存できません" }, { status: 403 });
  }

  const requestType = typeof body.requestType === "string" && body.requestType.trim()
    ? body.requestType.trim().slice(0, 64)
    : "other";
  const projectId = typeof body.projectId === "string" && body.projectId.trim() ? body.projectId.trim() : null;

  try {
    const bundle = await buildMonthlyWorkAgreementBundle(admin, {
      ym,
      memberId,
      viewerMemberId: actor.memberId,
    });
    if (projectId && !bundle.snapshot.projects.some((project) => project.projectId === projectId)) {
      return NextResponse.json({ ok: false, error: "対象PJが当月合意snapshotにありません" }, { status: 400 });
    }

    const { error: insertError } = await admin.from("member_monthly_work_agreement_requests").insert({
      ym,
      member_id: memberId,
      project_id: projectId,
      request_type: requestType,
      body: requestBody,
      status: "open",
      snapshot_hash: bundle.currentHash,
    });
    if (insertError) throw insertError;

    const refreshed = await buildMonthlyWorkAgreementBundle(admin, {
      ym,
      memberId,
      viewerMemberId: actor.memberId,
    });
    return NextResponse.json({ ok: true, bundle: refreshed });
  } catch (err) {
    const status = isMissingMonthlyAgreementRequestTableError(err) ? 503 : 500;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status },
    );
  }
}
