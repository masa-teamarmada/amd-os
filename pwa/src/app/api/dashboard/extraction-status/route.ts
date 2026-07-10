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

function needsAttention(lastCollectedAt: string | null) {
  if (!lastCollectedAt) return true;
  return Date.now() - new Date(lastCollectedAt).getTime() > 48 * 3_600_000;
}

/** Dashboardの抽出状況用。5生データの最終保存証跡と設定不足だけを返す。 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const db = createAdminClient();
  const [sourcesRes, projectsRes, connectorAuthRes, currentMemberRes] =
    await Promise.all([
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
        .is("dismissed_at", null)
        .order("updated_at", { ascending: false })
        .limit(30),
      db
        .from("members")
        .select("google_calendar_status,google_calendar_error")
        .eq("email", auth.user.email.toLowerCase())
        .maybeSingle(),
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
    if (!needsAttention(sources[source].lastCollectedAt)) continue;
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
      sources[source].resolution =
        calendarStatus === "connected"
          ? {
              reason: "接続は確認済み。48時間以上OSへの保存がない",
              actionLabel: "抽出運用を確認",
              actionHref: "/admin/settings",
            }
          : {
              reason:
                calendarStatus === "error"
                  ? "Google Calendarの接続でエラー"
                  : "Google Calendarが未接続",
              actionLabel: "再接続する",
              actionHref: "/auth/login?next=%2Fdashboard",
            };
      continue;
    }
    sources[source].resolution = {
      reason: "48時間以上OSへの保存がない。接続エラーの通知は未着",
      actionLabel: "抽出運用を確認",
      actionHref: "/admin/settings",
    };
  }

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    sources,
    setupIssues,
  });
}
