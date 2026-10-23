import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMonthlyWorkAgreementBundle, currentYmJst, listActiveAgreementMemberIds } from "@/lib/monthly-work-agreement";
import type { KiyoRewardOutlookResponse } from "@/lib/monthly-work-agreement-types";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const ym = new URL(req.url).searchParams.get("ym") || currentYmJst();
  if (!/^(?:19|20|21)\d{2}(?:0[1-9]|1[0-2])$/.test(ym)) {
    return NextResponse.json({ ok: false, error: "対象月が正しくありません" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const memberIds = await listActiveAgreementMemberIds(admin, ym);
    const bundles = await Promise.all(
      memberIds.map((memberId) => buildMonthlyWorkAgreementBundle(admin, { ym, memberId })),
    );
    const data: KiyoRewardOutlookResponse = {
      ym,
      members: bundles.map((bundle) => ({
        memberId: bundle.member.memberId,
        codeName: bundle.member.codeName,
        projects: bundle.snapshot.projects.map((project) => ({
          projectId: project.projectId,
          projectName: project.projectName,
          milestones: project.milestones,
          payoutSchedule: project.payoutSchedule,
          seasonStartYm: project.seasonStartYm,
          seasonEndYm: project.seasonEndYm,
        })),
      })).sort((a, b) => a.memberId.localeCompare(b.memberId)),
    };
    return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    console.error("[admin kiyo reward-outlook GET]", cause);
    return NextResponse.json({ ok: false, error: "報酬の見通しを取得できません" }, { status: 500 });
  }
}
