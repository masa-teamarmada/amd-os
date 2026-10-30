import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getDefaultMonthlyReportYm } from "@/lib/monthly-report-default-month";
import { AdminMonthlyReportsClient, type MonthlyReportOverviewRow } from "@/components/admin/AdminMonthlyReportsClient";

export const metadata: Metadata = { title: { absolute: "月次報告書 - AMD OS" } };
export const dynamic = "force-dynamic";

type ProjectRow = {
  project_id: string;
  project_name: string;
  client_name: string | null;
  status: string;
  monthly_report_scope: "none" | "internal_only" | "internal_and_external";
};
type InternalRow = {
  project_id: string;
  status: string;
  final_content: string | null;
  draft_content: string | null;
  generated_at: string | null;
  fixed_at: string | null;
};
type SubmissionRow = {
  project_id: string;
  body_md: string | null;
  generated_at: string | null;
  updated_at: string | null;
};

function monthOptions(defaultYm: string, selectedYm: string): string[] {
  const year = Number(defaultYm.slice(0, 4));
  const month = Number(defaultYm.slice(4, 6)) - 1;
  const options = Array.from({ length: 18 }, (_, offset) => {
    const date = new Date(Date.UTC(year, month - offset, 1));
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  return [...new Set([...options, selectedYm])].sort().reverse();
}

export default async function AdminMonthlyReportsPage({ searchParams }: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const defaultYm = getDefaultMonthlyReportYm();
  const requestedYm = (await searchParams).ym;
  const ym = requestedYm && /^\d{4}(0[1-9]|1[0-2])$/.test(requestedYm) ? requestedYm : defaultYm;
  const externalYm = `${ym.slice(0, 4)}-${ym.slice(4)}`;
  const db = await createClient();
  const [projectsResult, internalResult, submissionResult] = await Promise.all([
    db.from("projects").select("project_id,project_name,client_name,status,monthly_report_scope").order("project_id"),
    db.from("monthly_reports").select("project_id,status,final_content,draft_content,generated_at,fixed_at").eq("ym", ym),
    db.from("monthly_reports_external").select("project_id,body_md,generated_at,updated_at").eq("ym", externalYm),
  ]);

  if (projectsResult.error || internalResult.error || submissionResult.error) {
    console.error("[admin monthly reports]", projectsResult.error, internalResult.error, submissionResult.error);
    return <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">月次報告書を読み込めませんでした。ページを再読み込みしてください。</div>;
  }

  const internalByProject = new Map(((internalResult.data ?? []) as InternalRow[]).map((row) => [row.project_id, row]));
  const submissionByProject = new Map(((submissionResult.data ?? []) as SubmissionRow[]).map((row) => [row.project_id, row]));
  const currentMonth = ym === defaultYm;
  const rows: MonthlyReportOverviewRow[] = ((projectsResult.data ?? []) as ProjectRow[])
    .filter((project) => {
      const active = project.status === "active" || project.status === "sales";
      return (active && project.monthly_report_scope !== "none") || internalByProject.has(project.project_id) || submissionByProject.has(project.project_id);
    })
    .map((project) => {
      const internal = internalByProject.get(project.project_id);
      const submission = submissionByProject.get(project.project_id);
      const active = project.status === "active" || project.status === "sales";
      const internalExpected = currentMonth && active && project.monthly_report_scope !== "none";
      const submissionExpected = currentMonth && active && project.monthly_report_scope === "internal_and_external";
      const internalState = internal?.final_content?.trim() && internal.status !== "invalid"
        ? "ready"
        : internal?.draft_content?.trim() && internal.status !== "invalid"
          ? "draft"
          : internalExpected ? "missing" : currentMonth ? "not_applicable" : "not_recorded";
      const submissionState = submission?.body_md?.trim()
        ? "ready"
        : submissionExpected ? "missing" : currentMonth ? "not_applicable" : "not_recorded";
      return {
        projectId: project.project_id,
        projectName: project.project_name,
        clientName: project.client_name,
        internalState,
        submissionState,
        internalUpdatedAt: internal?.fixed_at ?? internal?.generated_at ?? null,
        submissionUpdatedAt: submission?.updated_at ?? submission?.generated_at ?? null,
      };
    });

  return <AdminMonthlyReportsClient key={ym} ym={ym} currentMonth={currentMonth} monthOptions={monthOptions(defaultYm, ym)} rows={rows} />;
}
