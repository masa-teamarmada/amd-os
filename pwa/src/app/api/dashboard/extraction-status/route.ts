import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

const SOURCES = ["gmail", "drive", "calendar", "slack", "notion"] as const;
type SourceName = (typeof SOURCES)[number];

function sourceName(value: unknown): SourceName | null {
  const source = String(value ?? "").toLowerCase();
  if (source.startsWith("gmail")) return "gmail";
  if (source.startsWith("drive")) return "drive";
  if (source.startsWith("calendar")) return "calendar";
  if (source.startsWith("slack")) return "slack";
  if (source.startsWith("notion")) return "notion";
  return null;
}

/** Dashboardの抽出状況用。5生データの最終保存証跡と設定不足だけを返す。 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const db = createAdminClient();
  const [sourcesRes, projectsRes] = await Promise.all([
    db
      .from("source_cache")
      .select("source,collected_at")
      .order("collected_at", { ascending: false })
      .limit(10_000),
    db
      .from("projects")
      .select(
        "project_id,project_name,status,monthly_report_scope,report_emails,slack_channel_id,slack_channel_not_required,drive_folder_id",
      )
      .eq("status", "active")
      .neq("project_id", "p00"),
  ]);
  if (sourcesRes.error)
    return NextResponse.json(
      { ok: false, error: sourcesRes.error.message },
      { status: 500 },
    );
  if (projectsRes.error)
    return NextResponse.json(
      { ok: false, error: projectsRes.error.message },
      { status: 500 },
    );

  const sources = Object.fromEntries(
    SOURCES.map((source) => [
      source,
      { count: 0, lastCollectedAt: null as string | null },
    ]),
  ) as Record<SourceName, { count: number; lastCollectedAt: string | null }>;
  for (const row of sourcesRes.data ?? []) {
    const source = sourceName(row.source);
    if (!source) continue;
    sources[source].count += 1;
    if (!sources[source].lastCollectedAt)
      sources[source].lastCollectedAt = row.collected_at ?? null;
  }

  const setupIssues: Array<{
    projectId: string;
    projectName: string;
    missing: string[];
  }> = [];
  for (const project of projectsRes.data ?? []) {
    if (project.monthly_report_scope === "none") continue;
    const missing = [
      project.report_emails ? null : "Gmailの抽出先メール",
      project.slack_channel_id || project.slack_channel_not_required ? null : "Slackチャンネル",
      project.drive_folder_id ? null : "Driveフォルダ",
    ].filter((value): value is string => Boolean(value));
    if (missing.length > 0)
      setupIssues.push({
        projectId: project.project_id,
        projectName: project.project_name,
        missing,
      });
  }

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    sources,
    setupIssues,
  });
}
