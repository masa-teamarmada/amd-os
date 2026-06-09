import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { buildContractNudgeCandidate, type ContractStatus } from "@/lib/contracts";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const url = new URL(req.url);
  const projectId = url.searchParams.get("project_id")?.trim() || "";
  const admin = createAdminClient();

  try {
    let query = admin
      .from("contracts")
      .select("contract_id,project_id,contract_title,counterparty_name,status,planned_at,last_activity_at,nudge_after_days,signed_at,projects(project_name,slack_channel_id)")
      .not("status", "in", "(signed,cancelled)")
      .is("signed_at", null)
      .order("last_activity_at", { ascending: true })
      .limit(500);
    if (projectId) query = query.eq("project_id", projectId);

    const { data, error } = await query;
    if (error) throw error;

    const candidates = (data ?? [])
      .map((row) => buildContractNudgeCandidate({
        contract_id: String(row.contract_id),
        project_id: String(row.project_id),
        contract_title: String(row.contract_title),
        counterparty_name: typeof row.counterparty_name === "string" ? row.counterparty_name : null,
        status: String(row.status) as ContractStatus,
        planned_at: typeof row.planned_at === "string" ? row.planned_at : null,
        last_activity_at: typeof row.last_activity_at === "string" ? row.last_activity_at : null,
        nudge_after_days: Number(row.nudge_after_days || 14),
        signed_at: typeof row.signed_at === "string" ? row.signed_at : null,
        projects: Array.isArray(row.projects) ? row.projects[0] : row.projects,
      }))
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
      .sort((a, b) => b.staleDays - a.staleDays);

    return NextResponse.json({
      ok: true,
      dryRun: true,
      projectId: projectId || null,
      candidates,
      candidateCounts: {
        total: candidates.length,
        sendable: candidates.filter((candidate) => !candidate.blocker).length,
        blocked: candidates.filter((candidate) => candidate.blocker).length,
      },
      safety: "dry-run only: Slack messages were not sent and contract_nudges rows were not inserted",
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "unknown",
    }, { status: 500 });
  }
}
