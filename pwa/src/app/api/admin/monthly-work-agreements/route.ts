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
    const openMilestoneIds = Array.from(new Set(bundles.flatMap((bundle) => {
      const openProjectIds = new Set(bundle.revisionRequests.filter((request) => request.status === "open").map((request) => request.projectId));
      return bundle.snapshot.projects.filter((project) => openProjectIds.has(project.projectId))
        .flatMap((project) => project.milestones.map((milestone) => milestone.milestoneId));
    })));
    const { data: responsibilityData, error: responsibilityError } = openMilestoneIds.length
      ? await admin.from("milestone_responsibility").select("milestone_id, member_id, share").in("milestone_id", openMilestoneIds)
      : { data: [], error: null };
    if (responsibilityError) throw responsibilityError;
    const assignmentsByMilestone = new Map<string, Array<{ member_id: string; share: number }>>();
    for (const row of responsibilityData ?? []) {
      const list = assignmentsByMilestone.get(row.milestone_id) ?? [];
      list.push({ member_id: row.member_id, share: Number(row.share) });
      assignmentsByMilestone.set(row.milestone_id, list);
    }
    const rows = bundles.map((bundle) => ({
      member: bundle.member,
      status: bundle.status,
      // 合意はPJごとに成立する。管理側は member ではなく member×PJ で未合意を追う
      projects: bundle.projectAgreements.map((agreement) => {
        const project = bundle.snapshot.projects.find((item) => item.projectId === agreement.projectId);
        return {
          projectId: agreement.projectId,
          projectName: agreement.projectName,
          status: agreement.status,
          agreedAt: agreement.agreedAt,
          fromLegacyMemberAgreement: agreement.fromLegacyMemberAgreement,
          expectedRewardYen: project?.expectedRewardYen ?? null,
          allocationMemberCount: project?.allocationTotals.memberCount ?? 0,
        };
      }),
      currentHash: bundle.currentHash,
      latestAgreement: bundle.latestAgreement
        ? { ...bundle.latestAgreement, snapshotJson: undefined }
        : null,
      revisionRequestCount: bundle.revisionRequests.filter((request) => request.status === "open").length,
      latestRevisionRequestAt: bundle.revisionRequests[0]?.createdAt ?? null,
      // open を先頭に出す。管理者はここから本文を読んで対応済みにする
      revisionRequests: [...bundle.revisionRequests].sort((a, b) => {
        const openRank = (status: string) => (status === "open" ? 0 : 1);
        return openRank(a.status) - openRank(b.status) || b.createdAt.localeCompare(a.createdAt);
      }),
      revisionProjectContext: Object.fromEntries(bundle.snapshot.projects
        .filter((project) => bundle.revisionRequests.some((request) => request.status === "open" && request.projectId === project.projectId))
        .map((project) => {
          const codeNameById = new Map(project.memberAllocations.map((allocation) => [allocation.memberId, allocation.codeName]));
          return [project.projectId, project.milestones.map((milestone) => ({
            milestoneId: milestone.milestoneId,
            title: milestone.title,
            taskDescription: milestone.taskDescription,
            assignments: (assignmentsByMilestone.get(milestone.milestoneId) ?? []).map((assignment) => ({
              memberId: assignment.member_id,
              codeName: codeNameById.get(assignment.member_id) ?? assignment.member_id,
              sharePct: Math.round(assignment.share * 10000) / 100,
            })),
          }))] as const;
        })),
      projectCount: bundle.snapshot.totals.projectCount,
      reviewRequiredCount: bundle.snapshot.totals.reviewRequiredCount,
      expectedRewardYen: bundle.snapshot.totals.expectedRewardYen,
      currentMonthAccrualYen: bundle.snapshot.totals.currentMonthAccrualYen,
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
        const explanation = bundle.expectedRewardChangeExplanations.find((item) => item.projectId === projectId);
        return [{
          projectId,
          projectName: project?.projectName ?? previousProject?.projectName ?? projectId,
          expectedRewardYen: project?.expectedRewardYen ?? null,
          reason: savedReason?.reason ?? null,
          autoExplained: Boolean(explanation?.explained),
          autoExplanationDetails: explanation?.details ?? [],
        }];
      }),
    }));
    rows.sort((a, b) => {
      const rank = (status: string) => status === "needs_reagreement" ? 0 : status === "pending" ? 1 : 2;
      return b.revisionRequestCount - a.revisionRequestCount
        || rank(a.status) - rank(b.status)
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
        projectAgreements: rows.reduce((sum, row) => sum + row.projects.length, 0),
        projectAgreed: rows.reduce(
          (sum, row) => sum + row.projects.filter((project) => project.status === "agreed").length,
          0,
        ),
        projectPending: rows.reduce(
          (sum, row) => sum + row.projects.filter((project) => project.status === "pending").length,
          0,
        ),
        projectNeedsReagreement: rows.reduce(
          (sum, row) => sum + row.projects.filter((project) => project.status === "needs_reagreement").length,
          0,
        ),
        reviewRequired: rows.filter((row) => row.reviewRequiredCount > 0).length,
        revisionRequests: rows.reduce((sum, row) => sum + row.revisionRequestCount, 0),
        expectedRewardYen: rows.reduce((sum, row) => sum + row.expectedRewardYen, 0),
        currentMonthAccrualYen: rows.reduce((sum, row) => sum + row.currentMonthAccrualYen, 0),
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
