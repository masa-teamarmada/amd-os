import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

const SOURCES = ["gmail", "drive", "calendar", "slack", "notion"] as const;
type SourceName = (typeof SOURCES)[number];

type SourceResolution = {
  reason: string;
  actionLabel: string;
  actionHref: string;
};

type SourceState = {
  count: number;
  lastCollectedAt: string | null;
  lastMeetingEvidenceAt: string | null;
  resolution: SourceResolution | null;
};

type ConnectorNotification = {
  title: string | null;
  body: string | null;
  link: string | null;
  meta: Record<string, unknown> | null;
  source: string | null;
  updated_at: string | null;
};

function sourceName(value: unknown): SourceName | null {
  const source = String(value ?? "").toLowerCase();
  if (source.startsWith("gmail")) return "gmail";
  if (source.startsWith("drive")) return "drive";
  if (source.startsWith("calendar")) return "calendar";
  if (source.startsWith("slack")) return "slack";
  if (source.startsWith("notion")) return "notion";
  return null;
}

function sourceNamesInNotification(row: ConnectorNotification): SourceName[] {
  const searchable = JSON.stringify([
    row.title,
    row.body,
    row.source,
    row.meta,
  ]).toLowerCase();
  return SOURCES.filter((source) => searchable.includes(source));
}

function actionHref(row: ConnectorNotification | undefined) {
  const meta = row?.meta ?? {};
  const candidate = [
    meta.reauth_url,
    meta.reauth_install_url,
    meta.reauth_app_url,
    row?.link,
  ].find((value) => typeof value === "string" && value.trim());
  const href = typeof candidate === "string" ? candidate.trim() : "";
  return href.startsWith("/") || /^https?:\/\//.test(href)
    ? href
    : "/notifications";
}

function sourceNamesInMeetingEvidence(value: unknown): SourceName[] {
  const searchable = String(value ?? "").toLowerCase();
  const found = SOURCES.filter((source) => searchable.includes(source));
  if (searchable.includes("gmeet") && !found.includes("calendar"))
    found.push("calendar");
  return found;
}

/** Dashboardの抽出状況用。保存証跡とMTG抽出での利用記録、現在の対応事項を返す。 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const db = createAdminClient();
  const [
    sourcesRes,
    projectsRes,
    connectorAuthRes,
    currentMemberRes,
    meetingEvidenceRes,
  ] = await Promise.all([
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
    db
      .from("app_notifications")
      .select("title,body,link,meta,source,updated_at")
      .eq("kind", "connector_auth")
      .is("read_at", null)
      .is("dismissed_at", null)
      .order("updated_at", { ascending: false })
      .limit(30),
    db
      .from("members")
      .select("google_calendar_status,google_calendar_error")
      .eq("email", auth.user.email.toLowerCase())
      .maybeSingle(),
    db
      .from("project_meeting_summaries")
      .select("updated_at,source_kinds")
      .order("updated_at", { ascending: false })
      .limit(300),
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
      {
        count: 0,
        lastCollectedAt: null as string | null,
        lastMeetingEvidenceAt: null as string | null,
        resolution: null as SourceResolution | null,
      },
    ]),
  ) as Record<SourceName, SourceState>;
  for (const row of sourcesRes.data ?? []) {
    const source = sourceName(row.source);
    if (!source) continue;
    sources[source].count += 1;
    if (!sources[source].lastCollectedAt)
      sources[source].lastCollectedAt = row.collected_at ?? null;
  }
  for (const meeting of meetingEvidenceRes.data ?? []) {
    for (const source of sourceNamesInMeetingEvidence(meeting.source_kinds)) {
      if (!sources[source].lastMeetingEvidenceAt)
        sources[source].lastMeetingEvidenceAt = meeting.updated_at ?? null;
    }
  }

  const setupIssues: Array<{
    projectId: string;
    projectName: string;
    missing: string[];
  }> = [];
  const missingBySource = new Map<SourceName, number>();
  for (const project of projectsRes.data ?? []) {
    if (project.monthly_report_scope === "none") continue;
    const missing = [
      project.report_emails ? null : "Gmailの抽出先メール",
      project.slack_channel_id || project.slack_channel_not_required
        ? null
        : "Slackチャンネル",
      project.drive_folder_id ? null : "Driveフォルダ",
    ].filter((value): value is string => Boolean(value));
    if (missing.length > 0)
      setupIssues.push({
        projectId: project.project_id,
        projectName: project.project_name,
        missing,
      });
    if (!project.report_emails)
      missingBySource.set("gmail", (missingBySource.get("gmail") ?? 0) + 1);
    if (!project.slack_channel_id && !project.slack_channel_not_required)
      missingBySource.set("slack", (missingBySource.get("slack") ?? 0) + 1);
    if (!project.drive_folder_id)
      missingBySource.set("drive", (missingBySource.get("drive") ?? 0) + 1);
  }

  const latestConnectorNotice = new Map<SourceName, ConnectorNotification>();
  for (const notification of (connectorAuthRes.data ??
    []) as ConnectorNotification[]) {
    for (const source of sourceNamesInNotification(notification)) {
      if (!latestConnectorNotice.has(source))
        latestConnectorNotice.set(source, notification);
    }
  }

  const calendarStatus =
    currentMemberRes.data?.google_calendar_status ?? "missing";
  for (const source of SOURCES) {
    const connectorNotice = latestConnectorNotice.get(source);
    const missingCount = missingBySource.get(source) ?? 0;

    if (connectorNotice) {
      sources[source].resolution = {
        reason: `${source === "notion" ? "Notion" : source === "slack" ? "Slack" : source === "calendar" ? "Google Calendar" : source === "gmail" ? "Gmail" : "Drive"}の再認証が必要`,
        actionLabel: "再認証を開く",
        actionHref: actionHref(connectorNotice),
      };
      continue;
    }
    if (missingCount > 0) {
      sources[source].resolution = {
        reason: `月次対象PJ ${missingCount}件の抽出設定が未完了`,
        actionLabel: "PJ台帳で直す",
        actionHref: "/admin/projects",
      };
      continue;
    }
    if (source === "calendar") {
      if (calendarStatus === "connected") continue;
      sources[source].resolution = {
        reason:
          calendarStatus === "error"
            ? "Google Calendarの接続でエラー"
            : "Google Calendarが未接続",
        actionLabel: "再接続する",
        actionHref: "/auth/login?next=%2Fdashboard",
      };
      continue;
    }
  }

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    sources,
    setupIssues,
  });
}
