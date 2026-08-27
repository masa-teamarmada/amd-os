import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import {
  buildMonthlyWorkAgreementBundle,
  currentYmJst,
  listActiveAgreementMemberIds,
} from "@/lib/monthly-work-agreement";
import type { AdminMonthlyWorkAgreementResponse } from "@/lib/monthly-work-agreement-types";
import { loadPayableReimbursements, reimbursementTotalYen } from "@/lib/finance/payout-reimbursements";

function validYm(value: string | null): string {
  const ym = value || currentYmJst();
  if (!/^\d{6}$/.test(ym)) throw new Error("ym must be YYYYMM");
  return ym;
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

  try {
    const admin = createAdminClient();
    const memberIds = await listActiveAgreementMemberIds(admin, ym);
    // 支払通知書と同じ立替を出す。同じ月なのに2画面で支払額が違って見えるのを避ける
    const reimbursementsByMember = await loadPayableReimbursements(admin, ym);
    const bundles = await Promise.all(
      memberIds.map((memberId) => buildMonthlyWorkAgreementBundle(admin, { ym, memberId })),
    );
    const rows = bundles.map((bundle) => ({
      member: bundle.member,
      status: bundle.status,
      currentHash: bundle.currentHash,
      latestAgreement: bundle.latestAgreement
        ? { ...bundle.latestAgreement, snapshotJson: undefined }
        : null,
      revisionRequestCount: bundle.revisionRequests.filter((request) => request.status === "open").length,
      latestRevisionRequestAt: bundle.revisionRequests[0]?.createdAt ?? null,
      projectCount: bundle.snapshot.totals.projectCount,
      reviewRequiredCount: bundle.snapshot.totals.reviewRequiredCount,
      expectedRewardYen: bundle.snapshot.totals.expectedRewardYen,
      payoutYen: bundle.snapshot.projects.reduce((sum, project) => sum + (project.payoutYen ?? 0), 0),
      stockYen: bundle.snapshot.totals.stockYen,
      reimbursementYen: reimbursementTotalYen(reimbursementsByMember.get(bundle.member.memberId)),
      grossDueYen: bundle.snapshot.projects.reduce((sum, project) => sum + (project.grossDueYen ?? 0), 0),
      carryInYen: bundle.snapshot.projects.reduce((sum, project) => sum + (project.carryInYen ?? 0), 0),
      projectNames: bundle.snapshot.projects.map((project) => project.projectName),
      amountChangeReasonRequirements: bundle.amountChangeReasonRequiredProjectIds.flatMap((projectId) => {
        const project = bundle.snapshot.projects.find((item) => item.projectId === projectId);
        const previousProject = bundle.changeSummary?.groups.find((item) => item.projectId === projectId);
        if (!project && !previousProject) return [];
        const savedReason = bundle.amountChangeReasons.find((item) => item.projectId === projectId);
        return [{
          projectId,
          projectName: project?.projectName ?? previousProject?.projectName ?? projectId,
          expectedRewardYen: project?.expectedRewardYen ?? null,
          reason: savedReason?.reason ?? null,
        }];
      }),
    }));
    rows.sort((a, b) => {
      const rank = (status: string) => status === "needs_reagreement" ? 0 : status === "pending" ? 1 : 2;
      return rank(a.status) - rank(b.status)
        || b.revisionRequestCount - a.revisionRequestCount
        || b.reviewRequiredCount - a.reviewRequiredCount
        || a.member.memberId.localeCompare(b.member.memberId);
    });
    const response: AdminMonthlyWorkAgreementResponse = {
      ym,
      tableReady: bundles.every((bundle) => bundle.tableReady),
      totals: {
        members: rows.length,
        agreed: rows.filter((row) => row.status === "agreed").length,
        pending: rows.filter((row) => row.status === "pending").length,
        needsReagreement: rows.filter((row) => row.status === "needs_reagreement").length,
        reviewRequired: rows.filter((row) => row.reviewRequiredCount > 0).length,
        revisionRequests: rows.reduce((sum, row) => sum + row.revisionRequestCount, 0),
        expectedRewardYen: rows.reduce((sum, row) => sum + row.expectedRewardYen, 0),
        payoutYen: rows.reduce((sum, row) => sum + row.payoutYen, 0),
        reimbursementYen: rows.reduce((sum, row) => sum + row.reimbursementYen, 0),
        stockYen: rows.reduce((sum, row) => sum + row.stockYen, 0),
      },
      rows,
    };
    return NextResponse.json({ ok: true, data: response });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
