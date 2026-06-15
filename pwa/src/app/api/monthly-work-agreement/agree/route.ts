import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/api-auth";
import {
  buildMonthlyWorkAgreementBundle,
  currentYmJst,
  isMissingMonthlyAgreementTableError,
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

  const body = (await req.json().catch(() => ({}))) as { ym?: unknown; memberId?: unknown };
  let ym: string;
  try {
    ym = validYm(body.ym);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "invalid ym" }, { status: 400 });
  }

  const admin = createAdminClient();
  const actor = await resolveMemberForEmail(admin, auth.user.email);
  if (!actor) return NextResponse.json({ ok: false, error: "member not found" }, { status: 404 });

  const memberId = typeof body.memberId === "string" && body.memberId.trim() ? body.memberId.trim() : actor.memberId;
  if (memberId !== actor.memberId) {
    return NextResponse.json({ ok: false, error: "本人以外の月次合意は保存できません" }, { status: 403 });
  }

  try {
    const bundle = await buildMonthlyWorkAgreementBundle(admin, {
      ym,
      memberId,
      viewerMemberId: actor.memberId,
    });
    if (!bundle.tableReady) {
      return NextResponse.json(
        { ok: false, error: "member_monthly_work_agreements table is not ready" },
        { status: 503 },
      );
    }

    const { data: existing, error: existingError } = await admin
      .from("member_monthly_work_agreements")
      .select("id")
      .eq("ym", ym)
      .eq("member_id", memberId)
      .eq("status", "agreed")
      .eq("snapshot_hash", bundle.currentHash)
      .maybeSingle();
    if (existingError && !isMissingMonthlyAgreementTableError(existingError)) throw existingError;

    if (!existing) {
      const { error: supersedeError } = await admin
        .from("member_monthly_work_agreements")
        .update({
          status: "superseded",
          invalidated_at: new Date().toISOString(),
          invalidation_reason: "new_agreement_snapshot",
          current_hash: bundle.currentHash,
        })
        .eq("ym", ym)
        .eq("member_id", memberId)
        .eq("status", "agreed")
        .neq("snapshot_hash", bundle.currentHash);
      if (supersedeError) throw supersedeError;

      const { error: insertError } = await admin.from("member_monthly_work_agreements").insert({
        ym,
        member_id: memberId,
        status: "agreed",
        agreed_by: actor.email || auth.user.email,
        snapshot_json: bundle.snapshot,
        snapshot_hash: bundle.currentHash,
        current_hash: bundle.currentHash,
      });
      if (insertError) throw insertError;
    }

    const refreshed = await buildMonthlyWorkAgreementBundle(admin, {
      ym,
      memberId,
      viewerMemberId: actor.memberId,
    });
    return NextResponse.json({ ok: true, bundle: refreshed });
  } catch (err) {
    const status = isMissingMonthlyAgreementTableError(err) ? 503 : 500;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status },
    );
  }
}
