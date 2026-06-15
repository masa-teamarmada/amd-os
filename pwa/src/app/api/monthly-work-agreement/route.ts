import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/api-auth";
import {
  buildMonthlyWorkAgreementBundle,
  currentYmJst,
  resolveMemberForEmail,
} from "@/lib/monthly-work-agreement";

function validYm(value: string | null): string {
  const ym = value || currentYmJst();
  if (!/^\d{6}$/.test(ym)) throw new Error("ym must be YYYYMM");
  return ym;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  const admin = createAdminClient();
  const viewer = await resolveMemberForEmail(admin, auth.user.email);
  if (!viewer) return NextResponse.json({ ok: false, error: "member not found" }, { status: 404 });

  const url = new URL(req.url);
  let ym: string;
  try {
    ym = validYm(url.searchParams.get("ym"));
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "invalid ym" }, { status: 400 });
  }

  const requestedMemberId = url.searchParams.get("memberId")?.trim() || viewer.memberId;
  if (requestedMemberId !== viewer.memberId && !viewer.isAdmin) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  try {
    const bundle = await buildMonthlyWorkAgreementBundle(admin, {
      ym,
      memberId: requestedMemberId,
      viewerMemberId: viewer.memberId,
    });
    return NextResponse.json({ ok: true, bundle });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
